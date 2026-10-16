import React, { useCallback, useRef } from "react";
import { Pressable, Text, View } from "react-native";
import { api, ApiError } from "../../api/client";
import { useRouter } from "expo-router";
import type { DbListEnvelope } from "../../api/types";
import { useAuth } from "../../state/AuthProvider";
import { useTheme } from "../../theme/ThemeProvider";
import { mix } from "../../theme/mix";
import { TYPOGRAPHY } from "../../theme/tokens";
import { EmptyState } from "../../ui/EmptyState";
import { ListRow } from "../../ui/ListRow";
import { WidgetFrame } from "./WidgetFrame";
import {
  classifyFailure,
  localTodayISO,
  READ_RETRY_LABEL,
  useWidgetData,
  type ReadFailure,
} from "./data";
import {
  familyEventsForDay,
  googleEventsForDay,
  FAMILY_RAIL_TOKEN,
  GOOGLE_RAIL_TOKEN,
  type DbEventRow,
  type GoogleEventRow,
  type WallEvent,
} from "../../calendar/events-merge";
import { publishWallStats } from "../wall-stats";
import { DayLine } from "./DayLine";

const WALL_ROW_BUDGET = 2; // the wall reads at a glance — more rows live on /calendar
const GOOGLE_MEMBER = "Google";
const GOOGLE_PILL_CONNECTED = "Google Calendar isn't connected.";
const GOOGLE_PILL_PIN = "Google Calendar: Sign in with your PIN to see the family's data.";
const GOOGLE_PILL_ERROR = "Google Calendar couldn't load — family events may be incomplete.";

/**
 * Web eventLineColor parity (Home-ai page.tsx:549) → the row's left rail AND
 * its member-chip tint: Google rows paint cyan, family rows paint nori, a
 * routine's own colour wins when the server sent one.
 */
function railTokenFor(event: WallEvent): string {
  if (event.member === GOOGLE_MEMBER) return GOOGLE_RAIL_TOKEN;
  return event.railToken ?? FAMILY_RAIL_TOKEN;
}

/**
 * The member chip: a tinted pill of the EVENT's accent (the same colour the
 * rail paints) with body ink — the web's gradient chip, never a neutral label.
 */
function MemberChip({ label, color }: { label: string; color: string }) {
  const { colors } = useTheme();
  return (
    <View
      testID={`todayEvents-member-chip-${label}`}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${label} event`}
      style={{
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: mix(color, "transparent", 40),
        borderWidth: 1,
        borderColor: mix(color, "transparent", 55),
      }}
    >
      <Text
        numberOfLines={1}
        style={{
          color: colors["color-text-primary"],
          fontSize: TYPOGRAPHY.label.fontSize,
          lineHeight: TYPOGRAPHY.label.lineHeight,
          fontWeight: "700",
        }}
      >
        {label}
      </Text>
    </View>
  );
}

/**
 * The Google failure pill (web ReadStatePill): amber measured-AA ink on an
 * amber wash, the honest copy, and a working "Try again" — the WHOLE pill is
 * the retry target at the wall's 64dp floor (it is the only affordance in an
 * error state, so it must be impossible to miss).
 */
function GooglePill({ failure, onRetry }: { failure: ReadFailure; onRetry: () => void }) {
  const { colors } = useTheme();
  // Web ReadStatePill parity: the umauthorised lane reads the PIN gate, not
  // the connected copy (the reference guest capture shows exactly this pill).
  const message =
    failure === "unauthorised"
      ? `🔒 ${GOOGLE_PILL_PIN}`
      : failure === "not_connected"
        ? GOOGLE_PILL_CONNECTED
        : GOOGLE_PILL_ERROR;
  const amber = colors["color-accent-amber"];
  const ink = colors["color-accent-ink-amber"] ?? colors["color-text-secondary"];
  return (
    <Pressable
      testID="todayEvents-google-pill"
      onPress={onRetry}
      accessibilityRole="button"
      accessibilityLabel={`${message} ${READ_RETRY_LABEL}`}
      accessibilityHint="Re-reads the family and Google calendars"
      style={({ pressed }) => ({
        minHeight: 64,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: mix(amber, "transparent", 45),
        backgroundColor: mix(amber, "transparent", 14),
        paddingHorizontal: 14,
        paddingVertical: 10,
        marginBottom: 10,
        justifyContent: "center",
        gap: 4,
        opacity: pressed ? 0.9 : 1,
      })}
    >
      <Text
        style={{
          color: ink,
          fontSize: TYPOGRAPHY.label.fontSize,
          lineHeight: TYPOGRAPHY.label.lineHeight,
          fontWeight: "600",
        }}
      >
        {message}
      </Text>
      <Text
        style={{
          alignSelf: "flex-start",
          color: ink,
          fontSize: TYPOGRAPHY.label.fontSize,
          lineHeight: TYPOGRAPHY.label.lineHeight,
          fontWeight: "700",
          textDecorationLine: "underline",
        }}
      >
        {READ_RETRY_LABEL}
      </Text>
    </Pressable>
  );
}

interface TodayPayload {
  events: WallEvent[];
  googleFailure: ReadFailure | null;
}

/**
 * "Today" cell — family calendar (db-gateway events for the local day) merged
 * with Google Calendar, all-day rows first (the reference sort). A Google
 * failure is ADMITTED as a retryable pill while family events stay on screen
 * (the ReadStatePill pattern) — never silently rendered as a quiet day. The
 * household clock (DayLine) rides above the rows, and every row paints the
 * web's per-event rail + tinted member chip.
 */
export function TodayEventsWidget() {
  const { colors } = useTheme();
  const router = useRouter();
  const { member, hydrated } = useAuth();
  /** Belt-and-braces guest gate: a signed-out wall must land on the PIN copy
   *  with ZERO doomed fetches, even if a future read-path change stops
   *  short-circuiting before the load runs. */
  const guest = hydrated && !member;

  /** Last good Google rows, kept across a transient failed refresh (the web's
   *  googleTodayRawRef pattern) — a 502 must not erase the family's calendar. */
  const lastGoodGoogleRef = useRef<WallEvent[]>([]);

  const load = useCallback(async (): Promise<TodayPayload> => {
    const today = localTodayISO();

    // Family events: the db-gateway read is public — it renders LIVE on the
    // signed-out wall (the reference guest capture: "0 events on the family
    // calendar" + rows visible). Its failure is the widget's failure.
    let family: WallEvent[] = [];
    try {
      const db = await api<DbListEnvelope<DbEventRow>>("/api/db/events");
      family = familyEventsForDay(Array.isArray(db?.items) ? db.items : [], today);
    } catch (e) {
      if (guest && e instanceof ApiError && e.status === 401) {
        family = [];
      } else {
        throw e;
      }
    }

    // Google: a failure here degrades to an honest pill, not a widget failure.
    let google: WallEvent[] = [];
    let googleFailure: ReadFailure | null = null;
    if (guest) {
      // The Google lane IS session-gated: the guest gets the PIN-gated pill
      // with Try again and ZERO doomed fetches (reference guest capture).
      googleFailure = "unauthorised";
    } else
    try {
      const res = await api<{ ok?: boolean; connected?: boolean; events?: GoogleEventRow[] }>("/api/google-calendar");
      // Body fields win over status: ok:false means the read is not truth;
      // connected:false is its own honest state — NOT a silent empty (the
      // web's fixed bug; 200 shape {ok:true, connected:false, events:[]}).
      if (res && res.ok !== false && res.connected === false) {
        googleFailure = "not_connected";
        google = []; // explicit disconnect drops the rows (web parity)
        lastGoodGoogleRef.current = [];
      } else if (res && res.ok !== false) {
        google = googleEventsForDay(Array.isArray(res.events) ? res.events : [], today);
        lastGoodGoogleRef.current = google;
      } else {
        googleFailure = "error";
        google = lastGoodGoogleRef.current; // transient: keep last-good, badged by the pill
      }
    } catch (e) {
      googleFailure = e instanceof ApiError ? classifyFailure(e) : "error";
      // 502 partial: the server attached the events it still has — keep them
      // (honesty means showing what's live + the failure pill, not dropping data).
      const partial =
        e instanceof ApiError && Array.isArray((e.body as { events?: GoogleEventRow[] })?.events)
          ? (e.body as { events: GoogleEventRow[] }).events
          : null;
      if (partial) {
        google = googleEventsForDay(partial, today);
        lastGoodGoogleRef.current = google;
      } else if (googleFailure === "error" || googleFailure === "offline") {
        google = lastGoodGoogleRef.current;
      } else {
        // unauthorised (401/403): the rows are no longer ours to show.
        google = [];
        lastGoodGoogleRef.current = [];
      }
    }

    const events = [...family, ...google].sort((a, b) => a.sortMinutes - b.sortMinutes);
    return { events, googleFailure };
  }, [guest]);

  const { status, data, failure, stale, retry } = useWidgetData<TodayPayload>(load, { guestVisible: true });

  const events = data?.events ?? [];
  const googleFailure = data?.googleFailure ?? null;
  const visible = events.slice(0, WALL_ROW_BUDGET);
  const hidden = events.length - visible.length;
  const description = `${events.length} ${events.length === 1 ? "event" : "events"} on the family calendar`;
  const daylineTone = colors["color-accent-selected"] ?? colors[FAMILY_RAIL_TOKEN];

  // The wall's KPI band reads THIS widget's count (src/home/wall-stats.ts) —
  // one read, two surfaces, so the "Events · Today" tile can never disagree
  // with the card it sits above. A null data set publishes nothing.
  React.useEffect(() => {
    if (data) publishWallStats({ eventsToday: data.events.length });
  }, [data]);

  return (
    <WidgetFrame
      id="todayEvents"
      icon="📅"
      title="Today"
      description={description}
      status={status}
      failure={failure}
      hasData={data !== null}
      stale={stale}
      onRetry={retry}
    >
      <View style={{ flex: 1 }}>
        {googleFailure ? <GooglePill failure={googleFailure} onRetry={retry} /> : null}
        <DayLine
          testID="todayEvents-dayline"
          tone={daylineTone}
          markers={events
            .filter((e) => Number.isFinite(e.sortMinutes) && e.sortMinutes > 0 && e.sortMinutes < 1440)
            .map((e) => ({
              position: (e.sortMinutes / 1440) * 100,
              color: mix(colors[railTokenFor(e)], "transparent", 75),
            }))}
        />
        {visible.length === 0 ? (
          <EmptyState flat icon="🌿" title="Quiet day" body="No events are scheduled for today." style={{ flex: 1 }} />
        ) : (
          <View style={{ gap: 8 }}>
            {visible.map((event) => {
              const railColor = colors[railTokenFor(event)];
              const chipLabel = event.member ? String(event.member).split(" ")[0] : null;
              return (
                <ListRow
                  key={event.id}
                  testID={`todayEvents-row-${event.id}`}
                  style={{ minHeight: 52, paddingVertical: 8 }}
                  leading={<Text style={{ fontSize: 20 }}>{event.icon}</Text>}
                  title={event.title}
                  subtitle={event.time}
                  leftRailColor={railColor}
                  trailing={chipLabel ? <MemberChip label={chipLabel} color={railColor} /> : undefined}
                />
              );
            })}
            {/* Web footer parity (page.tsx:819): a link to /calendar, so the
                overflow row opens the surface that shows the rest of the day. */}
            {hidden > 0 ? (
              <Pressable
                testID="todayEvents-more-footer"
                accessibilityRole="link"
                accessibilityLabel={`${hidden} more events. Open calendar`}
                hitSlop={16}
                onPress={() => router.push("/calendar")}
                style={{ minHeight: 28, justifyContent: "center", marginTop: 2 }}
              >
                <Text
                  style={{
                    color: colors["color-text-secondary"],
                    fontSize: TYPOGRAPHY.label.fontSize,
                    fontWeight: "600",
                    textAlign: "center",
                  }}
                >
                  {`+${hidden} more · See all →`}
                </Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </View>
    </WidgetFrame>
  );
}

export default TodayEventsWidget;
