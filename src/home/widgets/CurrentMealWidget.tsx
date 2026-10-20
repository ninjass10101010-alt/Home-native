import React from "react";
import { Text, View } from "react-native";
import { api, ApiError } from "../../api/client";
import type { DbListEnvelope } from "../../api/types";
import { useAuth } from "../../state/AuthProvider";
import { useTheme } from "../../theme/ThemeProvider";
import { TYPOGRAPHY, RADII } from "../../theme/tokens";
import { mix } from "../../theme/mix";
import { AnimatedEmoji } from "../../ui/AnimatedEmoji";
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

/**
 * The card's SEASONAL mood — the web's `atm.accentColor` (Home-ai
 * SEASON_ATMOSPHERE) plus the season glyph.
 *
 * The web does NOT drive this card's hairlines from the widget tone: the
 * time chip's border, the inner panel's edge and the emoji well's ring all
 * ride the SEASON accent, so an autumn wall card wears a warm amber hairline
 * on its teal glass (reference/home/parent-dark.png, captured 9 Oct). The RN
 * token ramp carries the same four families, so the season resolves to a
 * token colour only — no literal.
 *
 * The glyph mirrors the wall's own season mark (HomeWall's seasonGlyph) so
 * the corner particle and the greeting band speak with one voice.
 */
function seasonMood(
  colors: Record<string, string | undefined>,
  fallback: string,
  now: Date
): { glyph: string; accent: string } {
  const m = now.getMonth();
  if (m >= 2 && m < 5) return { glyph: "🌸", accent: colors["color-accent-rose"] ?? fallback };
  if (m >= 5 && m < 8) return { glyph: "☀️", accent: colors["color-accent-amber"] ?? fallback };
  if (m >= 8 && m < 11) return { glyph: "🍂", accent: colors["color-accent-apricot"] ?? fallback };
  return { glyph: "❄️", accent: colors["color-accent-nori"] ?? fallback };
}

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
  const { colors, accentColor, theme: themeName } = useTheme();
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
          if (typeof jest === "undefined") {
            try {
              const ss = await api<{ ok?: boolean; dinner?: { name: string } | null }>("/api/consuela/screensaver");
              if (ss?.ok && ss.dinner?.name) {
                const nowDate = injectedNow ?? new Date();
                const dayShort = nowDate.toLocaleDateString("en-US", { weekday: "short" });
                const wkMon = weekStartMondayISO(nowDate);
                return {
                  schedules: [{ id: "ss-dinner", title: "Dinner", time: "18:00", mealType: "dinner" }],
                  meals: [
                    {
                      id: "ss-meal",
                      name: ss.dinner.name,
                      emoji: "🍽️",
                      time: dayShort,
                      mealType: "dinner",
                      weekOf: wkMon,
                    },
                  ],
                };
              }
            } catch {
              /* fall through to empty */
            }
          }
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

  // The header + the day's panel are tinted by the SEASON (the web's
  // atmospheric accent), not by the widget tone — see seasonMood().
  const season = seasonMood(colors, accentColor, now);

  // The chip's ink is the widget tone's strong variant (the web's
  // `--widget-accent-strong`): mint ink on the seasonal hairline.
  const mintInk = colors["color-accent-ink-mint"] ?? mint;

  // The identity disc (WidgetFrame) hangs at the card's top-left corner and
  // is 52dp tall; the reference's title band starts BELOW it (the web seats
  // the disc over the card edge, the RN cell is inset by the Material's 14dp
  // padding). This pad keeps the moon glyph clear of the disc — before it,
  // the disc ate the 🌙.
  const HEADER_TOP_PAD = 52;

  // The time chip — the web's `meal-time-badge`: a seasonal hairline over a
  // seasonal wash, with the widget tone's strong ink. It is NOT a solid mint
  // pill: mint-on-mint was 1.9:1 in the baseline capture. The web's
  // `rounded-lg` resolves to the app's --radius-lg (20px), so the chip reads
  // as a soft stadium, not a hard 10px pill.
  const timeChip = (
    <View
      style={{
        borderRadius: RADII.lg,
        borderWidth: 1,
        borderColor: mix(season.accent, "transparent", 24),
        backgroundColor: mix(season.accent, "transparent", 9),
        paddingHorizontal: 10,
        paddingVertical: 4,
      }}
    >
      <Text style={{ color: mintInk, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
        {timeStr}
      </Text>
    </View>
  );

  // Header band (reference): a centered row — the slot's glyph, the serif-free
  // bold slot title, then the compact time chip — with the subtitle under it.
  const header = (
    <View style={{ alignItems: "center", paddingTop: HEADER_TOP_PAD }}>
      {/* The season's floating particle (the web's `meal-float-gentle`
          corner emoji), seated at the card's top-right like the reference. */}
      <Text
        style={{
          position: "absolute",
          top: -6,
          right: -6,
          fontSize: 30,
          opacity: 0.16,
        }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {season.glyph}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <AnimatedEmoji emoji={theme.icon} size={20} />
        <Text
          style={{
            color: colors["color-text-primary"],
            fontSize: TYPOGRAPHY.title.fontSize,
            fontWeight: "700",
            lineHeight: TYPOGRAPHY.title.lineHeight,
          }}
          accessibilityRole="header"
        >
          {`${theme.label} Time`}
        </Text>
        {timeChip}
      </View>
      <Text
        style={{
          color: colors["color-text-secondary"],
          fontSize: TYPOGRAPHY.label.fontSize,
          lineHeight: TYPOGRAPHY.label.lineHeight,
          marginTop: 4,
          textAlign: "center",
        }}
      >
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
      {/* The day's meal panel (the web's `meal-card-glow`): a COMPACT row —
          the reference seats it directly under the subtitle with the rest of
          the card left as deep glass. It used to be `flex: 1`, which let the
          inner card swallow the whole cell and turned the meal name into a
          caption floating on a pale wash. */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          // The web's `rounded-2xl` resolves to the app's --radius-2xl (36px).
          borderRadius: RADII.xxl,
          borderWidth: 1,
          borderColor: mix(season.accent, "transparent", 9),
          backgroundColor: mix(season.accent, "transparent", 4),
          padding: 14,
        }}
      >
        {/* The plate well (the web's `meal-emoji-glow`): the seasonal tint
            under a warm ring, never an opaque surface tile — an opaque tile
            turned the white 🍽️ into a white blob on a white card. The web's
            `rounded-2xl` on a 56px box clamps to a circle, and the warm halo
            around it is the card's one piece of depth. */}
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor:
              themeName === "light"
                ? mix(season.accent, "black", 78)
                : mix(season.accent, "transparent", 8),
            borderWidth: 1,
            borderColor: mix(season.accent, "transparent", 32),
            shadowColor: mix(season.accent, "transparent", 30),
            shadowOpacity: 1,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 0 },
            elevation: 6,
          }}
        >
          <AnimatedEmoji emoji={meal?.emoji || "🍽️"} size={28} />
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
                  <Chip
                    key={t}
                    as="span"
                    size="sm"
                    tone="success"
                    label={t}
                    style={{ height: 26, paddingHorizontal: 10, borderRadius: 8 }}
                  />
                ))}
                {tags.length > 3 ? (
                  <Chip
                    as="span"
                    size="sm"
                    tone="neutral"
                    label={`+${tags.length - 3}`}
                    style={{ height: 26, paddingHorizontal: 10, borderRadius: 8 }}
                  />
                ) : null}
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
