import React from "react";
import { Text, View } from "react-native";
import { api, ApiError } from "../../api/client";
import type { DbListEnvelope } from "../../api/types";
import { useTheme } from "../../theme/ThemeProvider";
import { TYPOGRAPHY } from "../../theme/tokens";
import { EmptyState } from "../../ui/EmptyState";
import { ListRow } from "../../ui/ListRow";
import { WidgetFrame } from "./WidgetFrame";
import { classifyFailure, localTodayISO, useWidgetData, type ReadFailure } from "./data";
import {
  familyEventsForDay,
  googleEventsForDay,
  type DbEventRow,
  type GoogleEventRow,
  type WallEvent,
} from "../../calendar/events-merge";

const WALL_ROW_BUDGET = 2; // the wall reads at a glance — more rows live on /calendar

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
    const family = familyEventsForDay(Array.isArray(db?.items) ? db.items : [], today);

    // Google: a failure here degrades to an honest pill, not a widget failure.
    let google: WallEvent[] = [];
    let googleFailure: ReadFailure | null = null;
    try {
      const res = await api<{ ok?: boolean; connected?: boolean; events?: GoogleEventRow[] }>("/api/google-calendar");
      // Body fields win over status: ok:false means the read is not truth;
      // connected:false is its own honest state — NOT a silent empty (the
      // web's fixed bug; 200 shape {ok:true, connected:false, events:[]}).
      if (res && res.ok !== false && res.connected === false) {
        googleFailure = "not_connected";
      } else if (res && res.ok !== false) {
        google = googleEventsForDay(Array.isArray(res.events) ? res.events : [], today);
      } else {
        googleFailure = "error";
      }
    } catch (e) {
      googleFailure = e instanceof ApiError ? classifyFailure(e) : "error";
      // 502 partial: the server attached the events it still has — keep them
      // (honesty means showing what's live + the failure pill, not dropping data).
      if (e instanceof ApiError && Array.isArray((e.body as any)?.events)) {
        google = googleEventsForDay((e.body as any).events as GoogleEventRow[], today);
      }
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
          {googleFailure === "unauthorised" || googleFailure === "not_connected"
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
