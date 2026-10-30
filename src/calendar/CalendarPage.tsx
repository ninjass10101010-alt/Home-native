import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { api, ApiError } from "../api/client";
import type { DbListEnvelope, ServerMember } from "../api/types";
import { useTheme } from "../theme/ThemeProvider";
import { accentDeepened } from "../theme/mix";
import { Material } from "../theme/Material";
import { MIN_TARGET_DP, TYPOGRAPHY } from "../theme/tokens";
import { useAuth } from "../state/AuthProvider";
import { useSync } from "../state/SyncManager";
import { Chip } from "../ui/Chip";
import { SoftButton } from "../ui/SoftButton";
import { EmptyState } from "../ui/EmptyState";
import { SegmentedControl } from "../ui/SegmentedControl";
import { SignedOutBanner } from "../ui/SignedOutBanner";
import { isPhotoUri } from "../ui/MemberRail";
import { FALLBACK_MEMBERS, readCachedMembers } from "../api/members";
import {
  READ_COPY,
  READ_COPY_STALE,
  classifyFailure,
  useWidgetData,
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
import { EventComposer, type EventDraft } from "./EventComposer";
import { addDaysISO, localDateISO, monthGridCells, selectedWeekISO } from "./date-utils";

/**
 * The wall's Calendar surface (WS-7): Triple-A Visual & Architectural Parity.
 * - Top amber SignedOutBanner for guests with entire 2-column page mounted
 * - Glass Header Bar: Calendar / Garcia Family + Add event & Theme toggle
 * - Date-Led Hero Count Banner: Giant tabular day numeral, stacked uppercase
 *   weekday kicker, and bold event count headline
 * - Horizontal Member Filter Strip with avatars
 * - 2-Column Split:
 *   Left: Month Grid Card (Month title, < Today > nav, 7-day week strip, 7x5 month grid with event dots)
 *   Right: Selected Day card (today/date heading, event count, event bubbles, REST OF THIS WEEK section)
 * - Bottom full-width Card: "Later this month" with horizontal day mini-cards
 * - Agenda/Schedule tab: 7-day grouped timeline with quiet days omitted
 */

const LOADING_COPY = "Loading the family's calendar…";
const READONLY_COPY = "Adding events from the wall arrives with the next wave — ask a parent on the phone.";
const GOOGLE_PILL_CONNECTED = "Google Calendar isn't connected.";
const GOOGLE_PILL_ERROR = "Google Calendar couldn't load — family events may be incomplete.";
const ROUTINES_PILL = "Family routines couldn't load — events may be incomplete.";
const QUIET_WEEK_BODY = "Nothing scheduled in the next 7 days.";
const SIGNED_OUT_BANNER = "🔐 Signed out — showing your saved copy. Every change stays on this device until you sign in.";

const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
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
  const { colors, theme, accentColor, setTheme } = useTheme();
  const { member } = useAuth();
  const isParent = String(member?.role ?? "").toLowerCase() === "parent";
  const { stale: syncStale } = useSync();
  const router = useRouter();

  const [view, setView] = useState<"week" | "agenda">("week");
  const [selectedISO, setSelectedISO] = useState(localDateISO(now));
  const [viewYear, setViewYear] = useState(() => isoToDate(localDateISO(now)).getFullYear());
  const [viewMonth, setViewMonth] = useState(() => isoToDate(localDateISO(now)).getMonth());
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [roster, setRoster] = useState<ServerMember[]>([]);

  const [composerOpen, setComposerOpen] = useState(false);
  const [composerSaving, setComposerSaving] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [optimisticRows, setOptimisticRows] = useState<DbEventRow[]>([]);
  const [pendingNotice, setPendingNotice] = useState<string | null>(null);
  const [pendingSourceId, setPendingSourceId] = useState<string | null>(null);
  const [liveNow, setLiveNow] = useState<Date | null>(null);

  useEffect(() => {
    const id = setInterval(() => setLiveNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const clock = liveNow ?? now;
  const todayISO = localDateISO(clock);

  useEffect(() => {
    let alive = true;
    void readCachedMembers().then((cached) => {
      if (!alive) return;
      const rows = cached.length > 0 ? cached : FALLBACK_MEMBERS;
      setRoster(rows.filter((r) => (r.name || "").trim()));
    });
    return () => {
      alive = false;
    };
  }, []);

  const { status, data, failure, stale: dataStale, retry } = useWidgetData<CalendarLoad>(async () => {
    const db = await api<DbListEnvelope<DbEventRow>>("/api/db/events");
    const dbEvents = Array.isArray(db?.items) ? db.items : [];

    let googleRows: GoogleEventRow[] = [];
    let googleFailure: ReadFailure | null = null;
    try {
      const res = await api<{ ok?: boolean; connected?: boolean; events?: GoogleEventRow[] }>("/api/google-calendar");
      if (res && res.ok !== false && res.connected === false) {
        googleFailure = "not_connected";
      } else if (res && res.ok !== false) {
        googleRows = Array.isArray(res.events) ? res.events : [];
      } else {
        googleFailure = "error";
      }
    } catch (e) {
      googleFailure = e instanceof ApiError ? classifyFailure(e) : "error";
      if (e instanceof ApiError && Array.isArray((e.body as any)?.events)) {
        googleRows = (e.body as any).events as GoogleEventRow[];
      }
    }

    let schedules: ScheduleRow[] = [];
    let schedulesFailure = false;
    try {
      const res = await api<DbListEnvelope<ScheduleRow>>("/api/db/schedules");
      schedules = Array.isArray(res?.items) ? res.items : [];
    } catch {
      schedulesFailure = true;
    }

    return { dbEvents, googleRows, schedules, googleFailure, schedulesFailure };
  }, { guestVisible: true });

  const stale = dataStale || syncStale;
  const pageFailed = status === "error" && data === null;
  const dbEvents = useMemo(() => {
    const server = Array.isArray(data?.dbEvents) ? data.dbEvents : [];
    if (optimisticRows.length === 0) return server;
    const ids = new Set(server.map((e) => String(e.id)));
    return [...server, ...optimisticRows.filter((e) => !ids.has(String(e.id)))];
  }, [data, optimisticRows]);

  const cells = useMemo(() => monthGridCells(viewYear, viewMonth), [viewYear, viewMonth]);
  const weekStartISO = selectedWeekISO(selectedISO);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysISO(weekStartISO, i)), [weekStartISO]);
  const restOfWeek = useMemo(() => weekDays.filter((d) => d !== selectedISO), [weekDays, selectedISO]);
  const agendaDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysISO(todayISO, i)), [todayISO]);

  const rawRowsForDay = useCallback((iso: string): WallEvent[] => {
    if (!data) return [];
    return mergeDayRows(
      familyEventsForDay(dbEvents, iso),
      googleEventsForDay(data.googleRows, iso),
      schedulesForDay(data.schedules, isoToDate(iso))
    );
  }, [data, dbEvents]);

  const rowsForDay = useCallback((iso: string): WallEvent[] => {
    const rows = rawRowsForDay(iso);
    if (!selectedMember || selectedMember === "All") return rows;
    return rows.filter((row) => !row.member || row.member === selectedMember);
  }, [rawRowsForDay, selectedMember]);

  const calendarEventsForDay = useCallback((iso: string): WallEvent[] => {
    if (!data) return [];
    const rows = mergeDayRows(
      familyEventsForDay(dbEvents, iso),
      googleEventsForDay(data.googleRows, iso)
    );
    if (!selectedMember || selectedMember === "All") return rows;
    return rows.filter((row) => !row.member || row.member === selectedMember);
  }, [dbEvents, data, selectedMember]);

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

  const selectedRows = rowsForDay(selectedISO);
  const selectedEventCount = calendarEventsForDay(selectedISO).length;
  const agendaHasRows = agendaDays.some((iso) => rowsForDay(iso).length > 0);

  // REST OF THIS WEEK: other days in the week that have calendar events (no routines)
  const restOfWeekDays = useMemo(() => {
    return restOfWeek
      .map((iso) => {
        const d = isoToDate(iso);
        const rows = rawRowsForDay(iso);
        const weekdayShort = DAY_SHORT[(d.getDay() + 6) % 7].toUpperCase();
        return { iso, date: d, weekdayShort, dayNumber: d.getDate(), rows };
      })
      .filter((item) => item.rows.length > 0);
  }, [restOfWeek, rawRowsForDay]);

  // LATER THIS MONTH: days in the viewed month after the selected date that have calendar events
  const laterThisMonthDays = useMemo(() => {
    const list: { iso: string; date: Date; weekdayShort: string; dayNumber: number; events: WallEvent[] }[] = [];
    const year = viewYear;
    const month = viewMonth;
    const selectedDay = isoToDate(selectedISO).getDate();
    const daysInMonth = new Date(year, month + 1, 0, 12).getDate();
    const seen = new Set<string>();

    for (let d = selectedDay + 1; d <= daysInMonth; d++) {
      const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      if (seen.has(iso)) continue;
      seen.add(iso);
      const rows = calendarEventsForDay(iso);
      if (rows.length > 0) {
        const dateObj = new Date(year, month, d, 12);
        const weekdayShort = dateObj.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
        list.push({ iso, date: dateObj, weekdayShort, dayNumber: d, events: rows });
      }
    }
    return list;
  }, [selectedISO, viewYear, viewMonth, calendarEventsForDay]);

  const saveEvent = async (draft: EventDraft) => {
    setComposerSaving(true);
    setComposerError(null);
    try {
      const res = await api<{ ok?: boolean; event?: DbEventRow; google?: { status?: string } }>(
        "/api/calendar/events",
        { method: "POST", body: draft },
      );
      if (!res?.ok || !res.event) throw new Error("save_failed");
      setOptimisticRows((prev) => [...prev, res.event!]);
      setComposerOpen(false);
      retry();
      if (res.google?.status && res.google.status !== "synced") {
        setPendingNotice("Saved here — Google not updated. Retry when Google is connected.");
        setPendingSourceId(String(res.event.id));
      } else {
        setPendingNotice(null);
        setPendingSourceId(null);
      }
    } catch (error) {
      const status = error instanceof ApiError ? error.status : undefined;
      setComposerError(
        status === 403
          ? "Only a parent can add events."
          : "Event wasn't saved — check the connection.",
      );
    } finally {
      setComposerSaving(false);
    }
  };

  const retryGoogle = async (sourceId?: string) => {
    if (!sourceId) return;
    try {
      await api(`/api/calendar/events/${encodeURIComponent(sourceId)}/retry-google`, { method: "POST" });
      retry();
      setPendingNotice(null);
      setPendingSourceId(null);
    } catch {
      setPendingNotice("Google Calendar couldn't save this event. Try again later.");
    }
  };

  const selectDay = useCallback((iso: string) => {
    setSelectedISO(iso);
    const d = isoToDate(iso);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }, []);

  const monthShift = useCallback((delta: number) => {
    const d = isoToDate(selectedISO);
    const target = new Date(d.getFullYear(), d.getMonth() + delta, 1, 12);
    const last = new Date(target.getFullYear(), target.getMonth() + 1, 0, 12).getDate();
    target.setDate(d.getDate() <= last ? d.getDate() : 1);
    const iso = localDateISO(target);
    setSelectedISO(iso);
    setViewYear(target.getFullYear());
    setViewMonth(target.getMonth());
  }, [selectedISO]);

  const iconTargetStyle = { width: MIN_TARGET_DP, height: MIN_TARGET_DP, alignItems: "center", justifyContent: "center" } as const;

  const readonlyNote = (
    <Text
      testID="calendar-readonly-note"
      style={{
        color: colors["color-text-muted"],
        fontSize: TYPOGRAPHY.label.fontSize,
        textAlign: "center",
        marginTop: 8,
      }}
    >
      {isParent ? READONLY_COPY : "Ask a parent to add or change events."}
    </Text>
  );

  const renderRow = (row: WallEvent) => (
    <View
      key={row.id}
      testID={`cal-row-${row.id}`}
      style={{
        borderRadius: 18,
        padding: 14,
        backgroundColor: colors["color-surface-2"],
        borderWidth: 1,
        borderColor: colors["color-border"],
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
        <View
          style={{
            width: 4,
            height: 36,
            borderRadius: 2,
            backgroundColor: row.railToken ? colors[row.railToken] ?? accentColor : accentColor,
          }}
        />
        <View style={{ gap: 2, flex: 1 }}>
          <Text style={{ color: colors["color-text-secondary"], fontSize: 14, fontWeight: "600" }}>
            {row.time ?? "Time TBD"}
          </Text>
          <Text
            numberOfLines={1}
            style={{ color: colors["color-text-primary"], fontSize: 17, fontWeight: "700" }}
          >
            {row.title}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {row.member ? (
          <Chip
            size="sm"
            as="span"
            label={String(row.member).split(" ")[0]}
            tone={row.member === "Google" ? "cyan" : "accent"}
          />
        ) : null}
        {row.source === "family" && row.sourceId && (
          row.googleSyncStatus === "pending" || row.googleSyncStatus === "failed"
        ) ? (
          <Chip
            label={row.googleSyncStatus === "failed" ? "Google failed · Retry" : "Google pending · Retry"}
            tone={row.googleSyncStatus === "failed" ? "danger" : "warning"}
            onPress={() => void retryGoogle(row.sourceId)}
            accessibilityLabel={`Retry Google sync for ${row.title}`}
          />
        ) : null}
      </View>
    </View>
  );

  if (pageFailed) {
    return (
      <View testID="calendar-page" style={{ flex: 1, paddingHorizontal: 24, paddingTop: 16 }}>
        <EmptyState
          testID="calendar-page-error"
          icon="📡"
          title="Calendar unreachable"
          body="Consuela couldn't reach the family calendar. Your saved copy will return when the connection does."
          actionLabel="Try again"
          onAction={retry}
        />
      </View>
    );
  }

  return (
    <View testID="calendar-page" style={{ flex: 1, paddingHorizontal: 24, paddingTop: 16 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 180, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Signed-out banner (web SyncStatusBanner parity) */}
        {!member ? (
          <SignedOutBanner
            title={SIGNED_OUT_BANNER}
            action={
              <Text
                style={{
                  color: colors["color-accent-amber"],
                  fontSize: TYPOGRAPHY.label.fontSize,
                  fontWeight: "700",
                  textDecorationLine: "underline",
                }}
              >
                Sign in with your PIN →
              </Text>
            }
            onPress={() => router.push("/settings")}
          />
        ) : null}

        {/* 1. Top Glass Header Bar */}
        <Material
          tier="regular"
          style={{
            borderRadius: 22,
            paddingHorizontal: 20,
            paddingVertical: 14,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View>
            <Text style={{ color: colors["color-text-primary"], fontSize: 24, fontWeight: "700" }}>
              Calendar
            </Text>
            <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.body.fontSize }}>
              Garcia Family
            </Text>
          </View>
           <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            {isParent ? (
              <SoftButton testID="add-event" accessibilityLabel="Add event" onPress={() => setComposerOpen(true)} size="sm">
                Add event
              </SoftButton>
            ) : (
              <Text style={{ color: colors["color-text-muted"], fontSize: 14 }}>
                Ask a parent to add or change events.
              </Text>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Toggle theme"
              onPress={() => setTheme(theme === "dark" ? "light" : "dark")}
              style={({ pressed }) => ({
                ...iconTargetStyle,
                borderRadius: 32,
                backgroundColor: colors["color-surface-2"],
                opacity: pressed ? 0.7 : 1,
              })}
            >
               <Text style={{ fontSize: 18 }}>{theme === "dark" ? "☀️" : "🌙"}</Text>
            </Pressable>
          </View>
        </Material>

        {/* 2. Date-Led Hero Count Banner */}
        <Material
          tier="regular"
          tone={accentColor}
          style={{
            borderRadius: 28,
            paddingHorizontal: 24,
            paddingVertical: 18,
            flexDirection: "row",
            alignItems: "center",
            gap: 18,
          }}
        >
          <Text
            style={{
              color: colors["color-text-primary"],
              fontSize: 56,
              lineHeight: 60,
              fontWeight: "800",
              fontVariant: ["tabular-nums"],
            }}
          >
            {isoToDate(selectedISO).getDate()}
          </Text>
          <View style={{ gap: 2 }}>
            <Text
              style={{
                color: colors["color-text-secondary"],
                fontSize: TYPOGRAPHY.label.fontSize,
                fontWeight: "700",
                letterSpacing: 1.5,
                textTransform: "uppercase",
              }}
            >
              {isoToDate(selectedISO).toLocaleDateString("en-US", { weekday: "long" }).toUpperCase()}
            </Text>
            <Text
              style={{
                color: colors["color-text-primary"],
                fontSize: 22,
                fontWeight: "700",
              }}
            >
              {selectedEventCount > 0
                ? `${selectedEventCount} ${selectedEventCount === 1 ? "event" : "events"}`
                : "Nothing else today"}
            </Text>
          </View>
        </Material>

        {/* Status line directly under Hero card */}
        {failure && failure !== "not_connected" ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors["color-accent-amber"] }} />
            <Text
              style={{
                color: colors["color-accent-amber"] ?? colors["color-text-secondary"],
                fontSize: TYPOGRAPHY.label.fontSize,
                fontWeight: "600",
              }}
            >
              {READ_COPY[failure]}
            </Text>
          </View>
        ) : stale ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors["color-accent-amber"] }} />
            <Text
              testID="calendar-stale"
              style={{
                color: colors["color-accent-amber"] ?? accentColor,
                fontSize: TYPOGRAPHY.label.fontSize,
                fontWeight: "600",
              }}
            >
              {READ_COPY_STALE}
            </Text>
          </View>
        ) : null}

        {/* 3. Horizontal Member Filter Strip */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 10, paddingVertical: 4, alignItems: "center" }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Filter all family members"
            onPress={() => setSelectedMember(null)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 20,
              backgroundColor: selectedMember === null ? accentDeepened(accentColor, 50) : colors["color-surface-2"],
              borderWidth: 1,
              borderColor: selectedMember === null ? accentColor : colors["color-border"],
            }}
          >
            <Text style={{ fontSize: 16 }}>👥</Text>
            <Text
              style={{
                color: selectedMember === null ? colors["color-primary-foreground"] : colors["color-text-primary"],
                fontSize: 15,
                fontWeight: "600",
              }}
            >
              All
            </Text>
          </Pressable>

          {roster.map((m) => {
            const isSelected = selectedMember === m.name;
            const firstName = m.name.split(" ")[0];
            const hasPhoto = isPhotoUri(m.emoji);
            return (
              <Pressable
                key={m.id ?? m.name}
                accessibilityRole="button"
                accessibilityLabel={`Filter by ${m.name}`}
                onPress={() => setSelectedMember(isSelected ? null : m.name)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 20,
                  backgroundColor: isSelected ? accentDeepened(accentColor, 50) : colors["color-surface-2"],
                  borderWidth: 1,
                  borderColor: isSelected ? accentColor : colors["color-border"],
                }}
              >
                {hasPhoto ? (
                  <Image source={{ uri: m.emoji }} style={{ width: 28, height: 28, borderRadius: 14 }} />
                ) : (
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: colors["color-surface-3"],
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 16 }}>{m.emoji || "👤"}</Text>
                  </View>
                )}
                <Text
                  style={{
                    color: isSelected ? colors["color-primary-foreground"] : colors["color-text-primary"],
                    fontSize: 15,
                    fontWeight: "600",
                  }}
                >
                  {firstName}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* 4. Segmented Control */}
        <SegmentedControl
          testID="calendar-tabs"
          accessibilityLabel="Calendar view"
          emphasize
          options={[
            { id: "week", label: "Calendar", icon: <Text style={{ fontSize: 16 }}>📅</Text> },
            {
              id: "agenda",
              label: (
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text
                    style={{
                      color: view === "agenda" ? colors["color-primary-foreground"] : colors["color-text-secondary"],
                      fontWeight: "600",
                    }}
                  >
                    Schedule
                  </Text>
                  <Text style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}>Agenda</Text>
                </View>
              ),
              icon: <Text style={{ fontSize: 16 }}>⏰</Text>,
            },
          ]}
          value={view}
          onChange={(id) => setView(id as "week" | "agenda")}
        />

        {status === "loading" && !data ? (
          <View testID="calendar-loading" accessibilityLabel={LOADING_COPY} style={{ gap: 12 }}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={{ height: 64, borderRadius: 20, backgroundColor: colors["color-surface-2"] }} />
            ))}
          </View>
        ) : view === "week" ? (
          <View style={{ gap: 16 }}>
            {/* 2-Column Split: Month Grid (Left) + Selected Day (Right) */}
            <View style={{ flexDirection: "row", gap: 16 }}>
              {/* Left Column Card: Month Grid */}
              <Material
                tier="regular"
                tone={colors["color-accent-nori"]}
                style={{
                  flex: 1,
                  borderRadius: 28,
                  padding: 20,
                  gap: 16,
                }}
              >
                {/* Month title + Nav */}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text
                    style={{
                      color: colors["color-text-primary"],
                      fontSize: 22,
                      fontWeight: "700",
                      fontFamily: "serif",
                    }}
                  >
                    {MONTH_NAMES[viewMonth]} {viewYear}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Previous month"
                      onPress={() => monthShift(-1)}
                      style={[iconTargetStyle, { borderRadius: 18, backgroundColor: colors["color-surface-2"] }]}
                    >
                      <Text style={{ color: colors["color-text-primary"], fontSize: 18 }}>‹</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Jump to today"
                      onPress={() => {
                        setSelectedISO(todayISO);
                        setViewYear(isoToDate(todayISO).getFullYear());
                        setViewMonth(isoToDate(todayISO).getMonth());
                      }}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 18,
                        backgroundColor: colors["color-surface-2"],
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ color: colors["color-text-primary"], fontSize: 14, fontWeight: "600" }}>
                        Today
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Next month"
                      onPress={() => monthShift(1)}
                      style={[iconTargetStyle, { borderRadius: 18, backgroundColor: colors["color-surface-2"] }]}
                    >
                      <Text style={{ color: colors["color-text-primary"], fontSize: 18 }}>›</Text>
                    </Pressable>
                  </View>
                </View>

                {/* Sunday-first month grid (no separate week strip) */}
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                    <View key={d} style={{ flex: 1, alignItems: "center" }}>
                      <Text style={{ color: colors["color-text-secondary"], fontSize: 14, fontWeight: "700" }}>
                        {d}
                      </Text>
                    </View>
                  ))}
                </View>

                <View style={{ gap: 8 }} testID="cal-month-grid">
                  {[0, 1, 2, 3, 4, 5].map((week) => (
                    <View key={week} style={{ flexDirection: "row" }}>
                      {cells.slice(week * 7, week * 7 + 7).map((cell) => {
                        const selected = cell.iso === selectedISO;
                        const isToday = cell.iso === todayISO;
                        const inSelectedWeek = cell.iso >= weekStartISO && cell.iso <= addDaysISO(weekStartISO, 6);
                        return (
                          <Pressable
                            key={cell.iso}
                            testID={`cal-day-${cell.iso}`}
                            onPress={() => selectDay(cell.iso)}
                            accessibilityRole="button"
                            accessibilityLabel={`${longDate(isoToDate(cell.iso))}${selected ? ", selected" : ""}`}
                            accessibilityState={{ selected }}
                            style={[
                              {
                                flex: 1,
                                minWidth: MIN_TARGET_DP,
                                minHeight: MIN_TARGET_DP,
                                alignItems: "center",
                                justifyContent: "center",
                                borderRadius: 14,
                              },
                              inSelectedWeek && { backgroundColor: colors["color-surface-2"] },
                              selected && { backgroundColor: accentDeepened(accentColor, 40) },
                              !cell.inMonth && { opacity: 0.45 },
                            ]}
                          >
                            <Text
                              style={{
                                color: selected
                                  ? colors["color-primary-foreground"]
                                  : isToday
                                    ? colors["color-text-primary"]
                                    : colors["color-text-secondary"],
                                fontSize: 16,
                                fontWeight: selected || isToday ? "700" : "500",
                                fontVariant: ["tabular-nums"],
                              }}
                            >
                              {cell.day}
                            </Text>
                            {isToday ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: accentColor, marginTop: 2 }} /> : null}
                          </Pressable>
                        );
                      })}
                    </View>
                  ))}
                </View>
              </Material>

              {/* Right Column Card: Selected Day & REST OF THIS WEEK */}
              <Material
                tier="regular"
                tone={colors["color-accent-cyan"]}
                style={{
                  flex: 1,
                  borderRadius: 28,
                  padding: 20,
                  gap: 16,
                }}
              >
                {/* Header with calendar badge + title + counts + Add */}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 14,
                        backgroundColor: colors["color-surface-2"],
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ fontSize: 22 }}>📅</Text>
                    </View>
                    <View>
                      <Text
                        testID="cal-selected-heading"
                        style={{ color: colors["color-text-primary"], fontSize: 20, fontWeight: "700" }}
                      >
                        {selectedISO === todayISO ? `Today · ${longDate(isoToDate(selectedISO))}` : longDate(isoToDate(selectedISO))}
                      </Text>
                      <Text
                        testID="cal-selected-counts"
                        style={{ color: colors["color-text-secondary"], fontSize: 14, marginTop: 2 }}
                      >
                        {(() => {
                          const events = selectedRows.filter((r) => !r.isRoutine).length;
                          const routines = selectedRows.length - events;
                          const eventPart = `${events} ${events === 1 ? "event" : "events"}`;
                          return routines > 0 ? `${eventPart} · ${routines} ${routines === 1 ? "routine" : "routines"}` : eventPart;
                        })()}
                      </Text>
                    </View>
                  </View>
                  {isParent ? (
                  <Pressable
                    testID="cal-add-event"
                    accessibilityRole="button"
                    accessibilityLabel="Add event"
                    onPress={() => setComposerOpen(true)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 16,
                      backgroundColor: colors["color-surface-2"],
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: colors["color-text-primary"], fontSize: 14, fontWeight: "600" }}>
                      + Add
                    </Text>
                  </Pressable>
                  ) : null}
                </View>

                {pills}

                {pendingNotice ? (
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingVertical: 8 }}>
                    <Text style={{ color: colors["color-text-secondary"], fontSize: 14, flex: 1 }}>{pendingNotice}</Text>
                    <SoftButton
                      variant="secondary"
                      onPress={() => void retryGoogle(pendingSourceId ?? undefined)}
                    >
                      Retry
                    </SoftButton>
                  </View>
                ) : null}

                {/* Selected Day's Event cards */}
                {selectedRows.length === 0 ? (
                  <View testID="cal-selected-events" style={{ alignItems: "center", justifyContent: "center", paddingVertical: 36, gap: 8 }}>
                    <Text style={{ fontSize: 28 }}>✨</Text>
                    <Text
                      style={{
                        color: colors["color-text-primary"],
                        fontSize: TYPOGRAPHY.title.fontSize,
                        fontWeight: "700",
                      }}
                    >
                      Quiet day
                    </Text>
                    <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.body.fontSize }}>
                      {selectedISO === todayISO
                        ? "No events are scheduled for today."
                        : "No events are scheduled for this day."}
                    </Text>
                  </View>
                ) : (
                  <View testID="cal-selected-events" style={{ gap: 10 }}>{selectedRows.map(renderRow)}</View>
                )}

                {/* REST OF THIS WEEK section */}
                {restOfWeekDays.length > 0 ? (
                  <View
                    style={{
                      borderTopWidth: 1,
                      borderTopColor: colors["color-border"],
                      paddingTop: 16,
                      gap: 12,
                    }}
                  >
                    <Text
                      style={{
                        color: colors["color-text-secondary"],
                        fontSize: 14,
                        fontWeight: "700",
                        letterSpacing: 1.5,
                        textTransform: "uppercase",
                      }}
                    >
                      REST OF THIS WEEK
                    </Text>
                    <View style={{ gap: 10 }}>
                      {restOfWeekDays.map((item) => (
                        <Pressable
                          key={item.iso}
                          accessibilityRole="button"
                          accessibilityLabel={`View events on ${item.weekdayShort} ${item.dayNumber}`}
                          onPress={() => selectDay(item.iso)}
                          style={{
                            flexDirection: "row",
                            alignItems: "flex-start",
                            gap: 12,
                            paddingVertical: 6,
                          }}
                        >
                          <View
                            style={{
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              borderRadius: 10,
                              backgroundColor: colors["color-surface-2"],
                              alignItems: "center",
                              minWidth: 48,
                            }}
                          >
                            <Text
                              style={{
                                color: colors["color-text-secondary"],
                                fontSize: 14,
                                fontWeight: "700",
                              }}
                            >
                              {item.weekdayShort}
                            </Text>
                            <Text
                              style={{
                                color: colors["color-text-primary"],
                                fontSize: 14,
                                fontWeight: "800",
                                fontVariant: ["tabular-nums"],
                              }}
                            >
                              {item.dayNumber}
                            </Text>
                          </View>
                          <View style={{ flex: 1, gap: 4 }}>
                            {item.rows.map((r, ri) => (
                              <View key={r.id || ri} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                <View
                                  style={{
                                    width: 4,
                                    height: 4,
                                    borderRadius: 2,
                                    backgroundColor: colors["color-accent-cyan"],
                                  }}
                                />
                                <Text
                                  numberOfLines={1}
                                  style={{
                                    color: colors["color-text-secondary"],
                                    fontSize: 14,
                                    fontWeight: "600",
                                  }}
                                >
                                   {r.time ? `${r.time} · ` : "Time TBD · "}
                                  <Text style={{ color: colors["color-text-primary"], fontWeight: "700" }}>
                                    {r.title}
                                  </Text>
                                </Text>
                              </View>
                            ))}
                          </View>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ) : null}
              </Material>
            </View>

            {/* Bottom Full-Width Card: Later this month */}
            {laterThisMonthDays.length > 0 ? (
            <Material
              tier="regular"
              tone={colors["color-accent-mint"]}
              style={{
                borderRadius: 28,
                padding: 20,
                gap: 16,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: colors["color-surface-2"],
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: colors["color-text-primary"], fontSize: 18, fontWeight: "700" }}>→</Text>
                </View>
                <View>
                  <Text style={{ color: colors["color-text-primary"], fontSize: 20, fontWeight: "700" }}>
                    Later this month
                  </Text>
                  <Text style={{ color: colors["color-text-secondary"], fontSize: 14 }}>
                    {laterThisMonthDays.length} {laterThisMonthDays.length === 1 ? "day" : "days"} with events
                  </Text>
                </View>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                  {laterThisMonthDays.map((item) => (
                    <Pressable
                      key={item.iso}
                      accessibilityRole="button"
                      accessibilityLabel={`Jump to ${item.weekdayShort} ${item.dayNumber}`}
                      onPress={() => selectDay(item.iso)}
                      style={{
                        width: 156,
                        borderRadius: 20,
                        padding: 14,
                        backgroundColor: colors["color-surface-2"],
                        borderWidth: 1,
                        borderColor: colors["color-border"],
                        gap: 8,
                      }}
                    >
                      <Text
                        style={{
                          color: colors["color-text-secondary"],
                          fontSize: 14,
                          fontWeight: "700",
                          textTransform: "uppercase",
                        }}
                      >
                        {item.weekdayShort}
                      </Text>
                      <Text
                        style={{
                          color: colors["color-text-primary"],
                          fontSize: 28,
                          fontWeight: "800",
                          fontVariant: ["tabular-nums"],
                        }}
                      >
                        {item.dayNumber}
                      </Text>
                      <View style={{ gap: 4 }}>
                        {item.events.slice(0, 3).map((e, ei) => (
                          <Text
                            key={e.id || ei}
                            numberOfLines={1}
                            style={{ color: colors["color-text-secondary"], fontSize: 14, lineHeight: 16 }}
                          >
                            • {e.title}
                          </Text>
                        ))}
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
            </Material>
            ) : null}

            {readonlyNote}
          </View>
        ) : (
          /* Agenda / Schedule view */
          <View style={{ gap: 20, marginTop: 8 }}>
            {pills}
            {!agendaHasRows ? (
              <EmptyState flat icon="🌿" title="Quiet week" body={QUIET_WEEK_BODY} />
            ) : (
              agendaDays.map((iso) => {
                const rows = rowsForDay(iso);
                if (rows.length === 0) return null;
                const d = isoToDate(iso);
                const heading = iso === todayISO ? `Today · ${longDate(d)}` : longDate(d);
                return (
                  <View key={iso} style={{ gap: 10 }}>
                    <Text
                      testID={`cal-agenda-${iso}`}
                      style={{
                        color: colors["color-text-primary"],
                        fontSize: TYPOGRAPHY.title.fontSize,
                        fontWeight: "700",
                      }}
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
      {composerOpen ? (
        <EventComposer
          visible={composerOpen}
          defaultDate={selectedISO}
          members={roster.map((m) => m.name)}
          saving={composerSaving}
          error={composerError}
          onClose={() => { setComposerOpen(false); setComposerError(null); }}
          onSave={saveEvent}
        />
      ) : null}
    </View>
  );
}

export default CalendarPage;
