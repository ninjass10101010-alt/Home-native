import React from "react";
import { Text, View } from "react-native";
import { api, ApiError } from "../../api/client";
import type { DbListEnvelope } from "../../api/types";
import { useTheme } from "../../theme/ThemeProvider";
import { TYPOGRAPHY } from "../../theme/tokens";
import { EmptyState } from "../../ui/EmptyState";
import { ListRow } from "../../ui/ListRow";
import { WidgetFrame } from "./WidgetFrame";
import { classifyFailure, formatTime12h, localTodayISO, useWidgetData, type ReadFailure } from "./data";

/** db events row (Home-ai src/db/index.ts:108-126 reads these raw fields). */
interface DbEventRow {
  id?: string | number;
  title?: string;
  date?: string; // "YYYY-MM-DD"
  time?: string; // "HH:MM"
  member?: string;
  icon?: string;
}

/** Google row per docs/wave1-endpoints.md + lib/calendar/google-mapping.ts. */
interface GoogleEventRow {
  google_id?: string;
  summary?: string;
  start_iso?: string;
  end_iso?: string;
  all_day?: boolean;
  calendar_id?: string;
}

interface WallEvent {
  id: string;
  title: string;
  time?: string; // "5:30 PM" | "All day" | undefined
  sortMinutes: number;
  icon: string;
  member?: string;
}

const ALL_DAY_TIME = "All day";
const ALL_DAY_SORT_MINUTES = -1;
const UNKNOWN_SORT_MINUTES = 24 * 60; // unparseable sorts last, never midnight
const WALL_ROW_BUDGET = 2; // the wall reads at a glance — more rows live on /calendar

function isDateOnly(iso: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso);
}

/** Port of google-mapping.parseGoogleStart: date-only is LOCAL midnight (never UTC). */
function parseStart(startIso: string, allDay: boolean): Date | null {
  if (!startIso) return null;
  if (allDay && isDateOnly(startIso)) {
    const [y, m, d] = startIso.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const d = new Date(startIso);
  return Number.isNaN(d.getTime()) ? null : d;
}

const localMidnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Port of googleEventCoveredDays (all-day end is EXCLUSIVE; capped at 366). */
export function googleCoversDay(row: GoogleEventRow, dayISO: string): boolean {
  const startIso = row.start_iso || "";
  const dateOnly = isDateOnly(startIso);
  const start = parseStart(startIso, dateOnly);
  if (!start) return false;
  const first = localMidnight(start);

  let last: Date;
  if (dateOnly) {
    const end = isDateOnly(row.end_iso || "") ? parseStart(row.end_iso as string, true) : null;
    last =
      !end || localMidnight(end) <= first
        ? first
        : new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1);
  } else {
    const end = row.end_iso ? new Date(row.end_iso) : null;
    if (!end || Number.isNaN(end.getTime()) || end <= start) {
      last = first;
    } else {
      const midnightEnd =
        end.getHours() === 0 && end.getMinutes() === 0 && end.getSeconds() === 0 && end.getMilliseconds() === 0;
      last = localMidnight(midnightEnd ? new Date(end.getTime() - 1) : end);
    }
  }

  const cur = new Date(first);
  let guard = 0;
  while (cur <= last && guard < 366) {
    if (localTodayISO(cur) === dayISO) return true;
    cur.setDate(cur.getDate() + 1);
    guard += 1;
  }
  return false;
}

/** Port of googleEventClockTime: device zone == family zone on the wall panel. */
function googleClock(row: GoogleEventRow): { time?: string; sortMinutes: number } {
  const iso = (row.start_iso ?? "").trim();
  if (!iso) return { time: undefined, sortMinutes: UNKNOWN_SORT_MINUTES };
  if (row.all_day || isDateOnly(iso)) return { time: ALL_DAY_TIME, sortMinutes: ALL_DAY_SORT_MINUTES };
  const start = parseStart(iso, false);
  if (!start) return { time: undefined, sortMinutes: UNKNOWN_SORT_MINUTES };
  return {
    time: start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
    sortMinutes: start.getHours() * 60 + start.getMinutes(),
  };
}

const hhmmToMinutes = (time?: string): number => {
  const m = time?.match(/^(\d{1,2}):(\d{2})$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : UNKNOWN_SORT_MINUTES;
};

/**
 * "Today" cell — family calendar (db-gateway events for the local day) merged
 * with Google Calendar, all-day rows first (the reference sort). A Google
 * failure is ADMITTED as a pill while family events stay on screen (the
 * ReadStatePill pattern) — never silently rendered as a quiet day.
 */
export function TodayEventsWidget() {
  const { colors } = useTheme();

  const { status, data, failure, stale, retry } = useWidgetData(async () => {
    const today = localTodayISO();

    // Family events: the failure of this read is the widget's failure.
    const db = await api<DbListEnvelope<DbEventRow>>("/api/db/events");
    const family: WallEvent[] = (Array.isArray(db?.items) ? db.items : [])
      .filter((e) => e?.date === today)
      .map((e, i) => {
        const minutes = hhmmToMinutes(e.time);
        return {
          id: `db_${String(e.id ?? i)}`,
          title: e.title || "Untitled event",
          time: formatTime12h(e.time),
          sortMinutes: minutes,
          icon: e.icon || "📅",
          member: e.member || undefined,
        };
      });

    // Google: a failure here degrades to an honest pill, not a widget failure.
    let google: WallEvent[] = [];
    let googleFailure: ReadFailure | null = null;
    try {
      const res = await api<{ ok?: boolean; events?: GoogleEventRow[] }>("/api/google-calendar");
      // Body fields win over status: ok:false means the read is not truth.
      if (res && res.ok !== false) {
        google = (Array.isArray(res.events) ? res.events : [])
          .filter((row) => googleCoversDay(row, today))
          .map((row, i) => {
            const clock = googleClock(row);
            return {
              id: `g_${row.google_id ?? i}`,
              title: row.summary || "(no title)",
              time: clock.time ?? ALL_DAY_TIME,
              sortMinutes: clock.sortMinutes,
              icon: "📅",
              member: "Google",
            };
          });
      } else {
        googleFailure = "error";
      }
    } catch (e) {
      googleFailure = e instanceof ApiError ? classifyFailure(e) : "error";
    }

    const events = [...family, ...google].sort((a, b) => a.sortMinutes - b.sortMinutes);
    return { events, googleFailure };
  });

  const events = data?.events ?? [];
  const googleFailure = data?.googleFailure ?? null;
  const visible = events.slice(0, WALL_ROW_BUDGET);
  const hidden = events.length - visible.length;

  const description = `${events.length} ${events.length === 1 ? "event" : "events"} on the family calendar`;

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
      {googleFailure ? (
        <Text
          testID="todayEvents-google-pill"
          style={{
            color: colors["color-accent-amber"] ?? colors["color-text-secondary"],
            fontSize: TYPOGRAPHY.label.fontSize,
            marginBottom: 8,
          }}
        >
          {googleFailure === "unauthorised"
            ? "Google Calendar isn't connected."
            : "Google Calendar couldn't load — family events may be incomplete."}
        </Text>
      ) : null}
      {visible.length === 0 ? (
        <EmptyState flat icon="🌿" title="Quiet day" body="No events are scheduled for today." style={{ flex: 1 }} />
      ) : (
        <View style={{ gap: 8 }}>
          {visible.map((event) => (
            <ListRow
              key={event.id}
              leading={<Text style={{ fontSize: 20 }}>{event.icon}</Text>}
              title={event.title}
              subtitle={event.time}
              trailing={
                event.member ? (
                  <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "600" }}>
                    {String(event.member).split(" ")[0]}
                  </Text>
                ) : undefined
              }
            />
          ))}
          {hidden > 0 ? (
            <Text
              style={{
                color: colors["color-text-secondary"],
                fontSize: TYPOGRAPHY.label.fontSize,
                fontWeight: "600",
                textAlign: "center",
                marginTop: 2,
              }}
            >
              +{hidden} more
            </Text>
          ) : null}
        </View>
      )}
    </WidgetFrame>
  );
}

export default TodayEventsWidget;
