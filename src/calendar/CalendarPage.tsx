import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { api, ApiError } from "../api/client";
import type { DbListEnvelope } from "../api/types";
import { useTheme } from "../theme/ThemeProvider";
import { accentDeepened, accentInk } from "../theme/mix";
import { MIN_TARGET_DP, TYPOGRAPHY } from "../theme/tokens";
import { useAuth } from "../state/AuthProvider";
import { useSync } from "../state/SyncManager";
import { EmptyState } from "../ui/EmptyState";
import { ListRow } from "../ui/ListRow";
import { SegmentedControl } from "../ui/SegmentedControl";
import {
  READ_COPY,
  READ_COPY_STALE,
  READ_RETRY_LABEL,
  classifyFailure,
  localTodayISO,
  useWidgetData,
  weekStartMondayISO,
  type ReadFailure,
} from "../home/widgets/data";
import {
  familyEventsForDay,
  googleEventsForDay,
  mergeDayRows,
  schedulesForDay,
  type DbEventRow,
  type GoogleEventRow,
  type ScheduleRow,
  type WallEvent,
} from "./events-merge";

/**
 * The wall's Calendar surface (WS-5): the family's week at a glance —
 * db-gateway events + Google Calendar + routines, read-only on purpose.
 * The web's create/edit/delete flows are parent-phone work; the wall shows
 * the family truth and says so (no dead affordances). Merge math is the
 * TodayEventsWidget port shared through ./events-merge — never a fork.
 */

const GUEST_COPY = "Sign in with your PIN to see the family's calendar.";
const LOADING_COPY = "Loading the family's calendar…";
const READONLY_COPY = "Adding events from the wall arrives with the next wave — ask a parent on the phone.";
const GOOGLE_PILL_CONNECTED = "Google Calendar isn't connected.";
const GOOGLE_PILL_ERROR = "Google Calendar couldn't load — family events may be incomplete.";
const ROUTINES_PILL = "Family routines couldn't load — events may be incomplete.";
const QUIET_WEEK_BODY = "Nothing scheduled in the next 7 days.";
const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]; // (getDay()+6)%7

function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDaysISO(iso: string, days: number): string {
  const d = isoToDate(iso);
  d.setDate(d.getDate() + days);
  return localTodayISO(d);
}

function longDate(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

interface CalendarLoad {
  dbEvents: DbEventRow[];
  googleRows: GoogleEventRow[];
  schedules: ScheduleRow[];
  googleFailure: ReadFailure | null;
  schedulesFailure: boolean;
}

export function CalendarPage({ now = new Date() }: { now?: Date }) {
  const { colors, accentColor } = useTheme();
  const { member } = useAuth();
  const { stale: syncStale } = useSync();

  const [view, setView] = useState<"week" | "agenda">("week");
  const todayISO = localTodayISO(now);
  const [selectedISO, setSelectedISO] = useState(todayISO);

  const { status, data, failure, stale: dataStale, retry } = useWidgetData<CalendarLoad>(async () => {
    // Family events: the failure of this read is the page's failure.
    const db = await api<DbListEnvelope<DbEventRow>>("/api/db/events");
    const dbEvents = Array.isArray(db?.items) ? db.items : [];

    // Google: a failure degrades to an honest pill while family events stay.
    let googleRows: GoogleEventRow[] = [];
    let googleFailure: ReadFailure | null = null;
    try {
      const res = await api<{ ok?: boolean; connected?: boolean; events?: GoogleEventRow[] }>("/api/google-calendar");
      // Body fields win over status; connected:false is its own honest state —
      // a silent empty calendar must not ship twice (web's fixed bug,
      // calendar page.tsx:313-348; 200 shape {ok:true, connected:false, events:[]}).
      if (res && res.ok !== false && res.connected === false) {
        googleFailure = "not_connected";
      } else if (res && res.ok !== false) {
        googleRows = Array.isArray(res.events) ? res.events : [];
      } else {
        googleFailure = "error";
      }
    } catch (e) {
      googleFailure = e instanceof ApiError ? classifyFailure(e) : "error";
      // 502 partial: keep the events the server still has (widget parity).
      if (e instanceof ApiError && Array.isArray((e.body as any)?.events)) {
        googleRows = (e.body as any).events as GoogleEventRow[];
      }
    }

    // Routines are additive to the day lists — a failed read admits a pill,
    // never a silently empty weekday.
    let schedules: ScheduleRow[] = [];
    let schedulesFailure = false;
    try {
      const res = await api<DbListEnvelope<ScheduleRow>>("/api/db/schedules");
      schedules = Array.isArray(res?.items) ? res.items : [];
    } catch {
      schedulesFailure = true;
    }

    return { dbEvents, googleRows, schedules, googleFailure, schedulesFailure };
  });

  // Stale badge: widget truth first (failure with last-good), sync styleness second.
  const stale = dataStale || syncStale;

  const weekStart = weekStartMondayISO(now);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i)), [weekStart]);
  const agendaDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysISO(todayISO, i)), [todayISO]);

  const rowsForDay = (iso: string): WallEvent[] => {
    if (!data) return [];
    return mergeDayRows(
      familyEventsForDay(data.dbEvents, iso),
      googleEventsForDay(data.googleRows, iso),
      schedulesForDay(data.schedules, isoToDate(iso))
    );
  };

  const pillInk = colors["color-accent-amber"] ?? colors["color-text-secondary"];
  const pills = (
    <View style={{ gap: 4 }}>
      {data?.googleFailure ? (
        <Text
          testID="calendar-google-pill"
          style={{ color: pillInk, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "600" }}
        >
          {data.googleFailure === "unauthorised" || data.googleFailure === "not_connected"
            ? GOOGLE_PILL_CONNECTED
            : GOOGLE_PILL_ERROR}
        </Text>
      ) : null}
      {data?.schedulesFailure ? (
        <Text
          testID="calendar-routines-pill"
          style={{ color: pillInk, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "600" }}
        >
          {ROUTINES_PILL}
        </Text>
      ) : null}
    </View>
  );

  const renderRow = (row: WallEvent) => (
    <ListRow
      key={row.id}
      testID={`cal-row-${row.id}`}
      leading={<Text style={{ fontSize: 24 }}>{row.icon}</Text>}
      title={row.title}
      subtitle={row.time}
      leftRailColor={row.railToken ? colors[row.railToken] : undefined}
      trailing={
        row.member ? (
          <Text
            style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "600" }}
          >
            {String(row.member).split(" ")[0]}
          </Text>
        ) : undefined
      }
    />
  );

  const readonlyNote = (
    <Text
      testID="calendar-readonly-note"
      style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize, textAlign: "center" }}
    >
      {READONLY_COPY}
    </Text>
  );

  const selectedRows = rowsForDay(selectedISO);
  const agendaHasRows = agendaDays.some((iso) => rowsForDay(iso).length > 0);

  return (
    <View testID="calendar-page" style={{ flex: 1, paddingHorizontal: 24, paddingTop: 16 }}>
      {/* Page header */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{ color: colors["color-text-primary"], fontSize: 54, fontWeight: "700" }}>Calendar</Text>
        <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.body.fontSize, marginTop: 4 }}>
          {"The family's week at a glance"}
        </Text>
        {stale && member ? (
          <Text
            testID="calendar-stale"
            style={{
              color: colors["color-accent-amber"] ?? accentColor,
              fontSize: TYPOGRAPHY.label.fontSize,
              fontWeight: "600",
              marginTop: 6,
            }}
          >
            {READ_COPY_STALE}
          </Text>
        ) : null}
      </View>

      {!member ? (
        <EmptyState icon="📅" title="Calendar" body={GUEST_COPY} />
      ) : status === "loading" ? (
        <View testID="calendar-loading" accessibilityLabel={LOADING_COPY} style={{ gap: 12 }}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ height: 64, borderRadius: 20, backgroundColor: colors["color-surface-2"] }} />
          ))}
        </View>
      ) : status === "error" ? (
        <View testID="calendar-error">
          <EmptyState
            icon="📅"
            title="Calendar"
            body={READ_COPY[failure ?? "error"]}
            actionLabel={READ_RETRY_LABEL}
            onAction={retry}
          />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <SegmentedControl
            testID="calendar-tabs"
            accessibilityLabel="Calendar view"
            emphasize
            options={[
              { id: "week", label: "Week", icon: <Text style={{ fontSize: 16 }}>📆</Text> },
              { id: "agenda", label: "Agenda", icon: <Text style={{ fontSize: 16 }}>📋</Text> },
            ]}
            value={view}
            onChange={(id) => setView(id as "week" | "agenda")}
          />
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 180 }} showsVerticalScrollIndicator={false}>
            {view === "week" ? (
              <View style={{ marginTop: 16, gap: 16 }}>
                {/* Week strip: Mon–Sun chips, today accented, tap → that day */}
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {weekDays.map((iso) => {
                    const d = isoToDate(iso);
                    const weekdayIdx = (d.getDay() + 6) % 7;
                    const isToday = iso === todayISO;
                    const isSelected = iso === selectedISO;
                    const chipInk = isSelected
                      ? colors["color-primary-foreground"]
                      : isToday
                        ? accentInk(accentColor, colors["color-text-primary"])
                        : colors["color-text-secondary"];
                    return (
                      <Pressable
                        key={iso}
                        testID={`cal-day-${iso}`}
                        accessibilityRole="button"
                        accessibilityLabel={isToday ? `Today, ${longDate(d)}` : longDate(d)}
                        accessibilityState={{ selected: isSelected }}
                        onPress={() => setSelectedISO(iso)}
                        style={{
                          flex: 1,
                          minHeight: MIN_TARGET_DP,
                          borderRadius: 16,
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 2,
                          backgroundColor: isSelected ? accentDeepened(accentColor, 60) : colors["color-surface-2"],
                          borderWidth: !isSelected && isToday ? 2 : 0,
                          borderColor: accentColor,
                        }}
                      >
                        <Text style={{ color: chipInk, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "600" }}>
                          {DAY_SHORT[weekdayIdx]}
                        </Text>
                        <Text
                          style={{
                            color: chipInk,
                            fontSize: TYPOGRAPHY.body.fontSize,
                            fontWeight: "700",
                          }}
                        >
                          {d.getDate()}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Selected day */}
                <View style={{ gap: 12 }}>
                  <View>
                    <Text
                      testID="cal-selected-heading"
                      style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.title.fontSize, fontWeight: "700" }}
                    >
                      {longDate(isoToDate(selectedISO))}
                    </Text>
                    <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.body.fontSize, marginTop: 2 }}>
                      {(() => {
                        // Routines are not events — the count must not lie
                        // (a 3-routine, 0-event day is not "3 events").
                        const events = selectedRows.filter((r) => !r.isRoutine).length;
                        const routines = selectedRows.length - events;
                        const eventPart = `${events} ${events === 1 ? "event" : "events"}`;
                        return routines > 0 ? `${eventPart} · ${routines} ${routines === 1 ? "routine" : "routines"}` : eventPart;
                      })()}
                    </Text>
                  </View>
                  {pills}
                  {selectedRows.length === 0 ? (
                    <EmptyState
                      flat
                      icon="🌿"
                      title="Quiet day"
                      body={
                        selectedISO === todayISO
                          ? "No events are scheduled for today."
                          : "No events are scheduled for this day."
                      }
                    />
                  ) : (
                    <View style={{ gap: 8 }}>{selectedRows.map(renderRow)}</View>
                  )}
                </View>
                {readonlyNote}
              </View>
            ) : (
              <View style={{ marginTop: 16, gap: 24 }}>
                {pills}
                {!agendaHasRows ? (
                  <EmptyState flat icon="🌿" title="Quiet week" body={QUIET_WEEK_BODY} />
                ) : (
                  agendaDays.map((iso) => {
                    const rows = rowsForDay(iso);
                    if (rows.length === 0) return null; // quiet days omitted — noise, not information (web parity)
                    const d = isoToDate(iso);
                    const heading = iso === todayISO ? `Today · ${longDate(d)}` : longDate(d);
                    return (
                      <View key={iso} style={{ gap: 10 }}>
                        <Text
                          testID={`cal-agenda-${iso}`}
                          style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.title.fontSize, fontWeight: "700" }}
                        >
                          {heading}
                        </Text>
                        <View style={{ gap: 8 }}>{rows.map(renderRow)}</View>
                      </View>
                    );
                  })
                )}
                {readonlyNote}
              </View>
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

export default CalendarPage;
