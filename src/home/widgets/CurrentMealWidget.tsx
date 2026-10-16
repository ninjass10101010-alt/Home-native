import React from "react";
import { Text, View } from "react-native";
import { api, ApiError } from "../../api/client";
import type { DbListEnvelope } from "../../api/types";
import { useAuth } from "../../state/AuthProvider";
import { useTheme } from "../../theme/ThemeProvider";
import { TYPOGRAPHY } from "../../theme/tokens";
import { mix } from "../../theme/mix";
import { Chip } from "../../ui/Chip";
import { WidgetFrame } from "./WidgetFrame";
import { useWidgetData, weekStartMondayISO } from "./data";
import { currentSlotFor } from "../../meals/slot";
import { publishWallStats, weekCellsFor } from "../wall-stats";

/** meal_plan_entries row (subset) — see Home-ai src/lib/pb-seed.ts schema. */
interface MealRow {
  id?: string | number;
  name?: string;
  emoji?: string;
  time?: string; // weekday short, e.g. "Sat"
  mealType?: string;
  tags?: unknown; // json
  weekOf?: string;
}

/** schedules row (subset) — mealType "" / "none" rows are not meals. */
interface ScheduleRow {
  id?: string | number;
  title?: string;
  time?: string; // "HH:MM"
  mealType?: string;
}

const MEAL_THEMES: Record<string, { icon: string; label: string }> = {
  breakfast: { icon: "🌅", label: "Breakfast" },
  lunch: { icon: "☀️", label: "Lunch" },
  dinner: { icon: "🌙", label: "Dinner" },
  snack: { icon: "🍎", label: "Snack" },
};

/** null = unparseable (excluded from selection — a 0-min sentinel always reads "passed"). */
function parseTimeToMinutes(t?: string): number | null {
  const m = t?.match(/^(\d{1,2}):(\d{2})$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function formatClock(t: string): string {
  const mins = parseTimeToMinutes(t);
  if (mins === null) return t;
  const h = Math.floor(mins / 60);
  const period = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(mins % 60).padStart(2, "0")} ${period}`;
}

function formatDuration(totalMinutes: number): string {
  const mins = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function tagsOf(row: MealRow): string[] {
  return Array.isArray(row.tags) ? row.tags.filter((t): t is string => typeof t === "string") : [];
}

export interface CurrentMealWidgetProps {
  /** Test hook: freeze "now"; production leaves it undefined (30s wall-clock tick). */
  now?: Date;
}

/**
 * Current Meal cell — port of Home-ai CurrentMealWidget's selection logic:
 * the household meal SCHEDULE picks the active slot (breakfast/lunch/dinner),
 * rolling forward when a slot started >60m ago; the meal PLAN row must match
 * today's weekday + the active slot + the current week (no cross-slot
 * fallback — that's the wrong-meal bug). The schedule/meals reads ride the
 * same verified db-gateway surface as events.
 */
export function CurrentMealWidget({ now: injectedNow }: CurrentMealWidgetProps) {
  const { colors, accentColor } = useTheme();
  const { member, hydrated } = useAuth();
  const guest = hydrated && !member;
  const [tickNow, setTickNow] = React.useState<Date | null>(null);

  // The slot ("it's almost dinner") moves with the wall clock even between
  // data pulses — a 30s tick recomputes selection from the last good rows.
  React.useEffect(() => {
    if (injectedNow) return;
    const t = setInterval(() => setTickNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, [injectedNow]);

  const { status, data, failure, stale, retry } = useWidgetData(
    async () => {
      try {
        const [schedulesRes, mealsRes] = await Promise.all([
          api<DbListEnvelope<ScheduleRow>>("/api/db/schedules"),
          api<DbListEnvelope<MealRow>>("/api/db/meal_plan_entries"),
        ]);
        return {
          schedules: Array.isArray(schedulesRes?.items) ? schedulesRes.items : [],
          meals: Array.isArray(mealsRes?.items) ? mealsRes.items : [],
        };
      } catch (e) {
        if (guest && e instanceof ApiError && e.status === 401) {
          return { schedules: [], meals: [] };
        }
        throw e;
      }
    },
    // Reference guest capture: the meal card renders LIVE signed-out (the
    // db-gateway reads are public). Guests see the honest "No meal planned
    // yet" — never a PIN gate.
    { guestVisible: true }
  );

  const now = injectedNow ?? tickNow ?? new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const timeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  // The shared slot rule (src/meals/slot.ts) — the wall cell and the page
  // agree because there is ONE implementation (the critic's fork-ban).
  const current: { mealType: string; time?: string; minutes: number | null } = (() => {
    const slot = currentSlotFor(data?.schedules ?? [], now);
    // The row can carry the slot either explicitly (mealType) or via the
    // title keyword — match both so a title-only "Dinner" schedule keeps its
    // time on the card (the web reads the same schedule object).
    const rows = data?.schedules ?? [];
    const row =
      rows.find((s) => s.mealType === slot) ??
      rows.find((s) => (s.title ?? "").toLowerCase().includes(slot) && parseTimeToMinutes(s.time) !== null) ??
      null;
    return { mealType: slot, time: row?.time, minutes: row ? parseTimeToMinutes(row.time) : null };
  })();

  const mealType = current.mealType as keyof typeof MEAL_THEMES;
  const theme = MEAL_THEMES[mealType] ?? MEAL_THEMES.dinner;
  const scheduledTime = current.time ? formatClock(current.time) : "";
  const minutesUntil = current.minutes === null ? null : current.minutes - nowMinutes;

  const todayShort = now.toLocaleDateString("en-US", { weekday: "short" });
  const weekMonday = weekStartMondayISO(now);
  const meal =
    (data?.meals ?? []).find(
      (m) => (m.weekOf || weekMonday) === weekMonday && m.time === todayShort && m.mealType === mealType
    ) ?? null;

  const subtitle = !scheduledTime
    ? "Set a meal schedule to see times"
    : minutesUntil === null || minutesUntil > 90
      ? `Scheduled at ${scheduledTime}`
      : minutesUntil > 0
        ? minutesUntil <= 15
          ? `Almost time · in ${formatDuration(minutesUntil)}`
          : `In ${formatDuration(minutesUntil)} · at ${scheduledTime}`
        : `Started at ${scheduledTime}`;

  // Card tint mirrors the web's proximity glow (static at wall distance): the
  // meal accent mints the card border at 30%, matching `accentColor`+`30` web fill.
  const mint = colors["color-accent-mint"] ?? accentColor;

  // Title band (reference): plain "🌙 Dinner Time" title with a COMPACT time
  // chip beside it — styled with mint translucent glass matching web reference.
  const header = (
    <View style={{ alignItems: "center", gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, justifyContent: "center" }}>
        <Text
          style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.title.fontSize, fontWeight: "700" }}
          accessibilityRole="header"
        >
          {`${theme.icon} ${theme.label} Time`}
        </Text>
        <View
          style={{
            borderRadius: 9999,
            borderWidth: 1,
            borderColor: mix(mint, "transparent", 32),
            backgroundColor: mix(mint, "transparent", 16),
            paddingHorizontal: 12,
            paddingVertical: 4,
          }}
        >
          <Text style={{ color: colors["color-accent-ink-mint"] ?? mint, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
            {timeStr}
          </Text>
        </View>
      </View>
      <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }}>
        {subtitle}
      </Text>
    </View>
  );

  const tags = meal ? tagsOf(meal) : [];

  // The KPI band + "This Week" strip read THIS widget's meal rows — the wall
  // header's "Days planned" tile and the week strip must agree with the card
  // that owns the read (src/home/wall-stats.ts). Week-matched rows only:
  // a meal without weekOf predates the week-scoped planner and belongs to the
  // current week (the web's plannedDaysThisWeek rule, verbatim).
  React.useEffect(() => {
    if (!data) return;
    const weekMonday = weekStartMondayISO(now);
    const plannedLabels = new Set<string>();
    for (const m of data.meals) {
      if ((m.weekOf || weekMonday) === weekMonday && typeof m.time === "string" && m.time) {
        plannedLabels.add(m.time);
      }
    }
    const cells = weekCellsFor(now, plannedLabels);
    publishWallStats({
      plannedDays: cells.filter((c) => c.planned).length,
      weekCells: cells,
    });
  }, [data, now.getDate()]); // eslint-disable-line react-hooks/exhaustive-deps -- re-derive on a date change, not every tick

  return (
    <WidgetFrame
      id="currentMeal"
      icon={theme.icon}
      title={`${theme.label} Time`}
      status={status}
      failure={failure}
      hasData={data !== null}
      stale={stale}
      onRetry={retry}
      header={header}
      showDisc
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: mix(mint, "transparent", 24),
          backgroundColor: mix(mint, colors["color-surface-0"] ?? "#0b1020", 8),
          padding: 14,
          flex: 1,
          minHeight: 0,
        }}
      >
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors["color-surface-2"],
          }}
        >
          <Text style={{ fontSize: 28 }}>{meal?.emoji || "🍽️"}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={2}
            style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}
          >
            {meal ? meal.name || "Untitled meal" : "No meal planned yet"}
          </Text>
          {meal ? (
            tags.length > 0 ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                {tags.slice(0, 3).map((t) => (
                  <Chip key={t} as="span" size="sm" tone="success" label={t} />
                ))}
                {tags.length > 3 ? <Chip as="span" size="sm" tone="neutral" label={`+${tags.length - 3}`} /> : null}
              </View>
            ) : null
          ) : (
            <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize, marginTop: 4 }}>
              Plan {theme.label.toLowerCase()} in the Kitchen tab
            </Text>
          )}
        </View>
      </View>
    </WidgetFrame>
  );
}

export default CurrentMealWidget;
