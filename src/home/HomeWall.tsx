import React from "react";
import { Platform, Text, useWindowDimensions, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { ACCENTS, FONTS, TYPOGRAPHY } from "../theme/tokens";
import { Material } from "../theme/Material";
import { MemberRail, type RailMember } from "../ui/MemberRail";
import { useAuth } from "../state/AuthProvider";
import { EmergencyShield } from "./EmergencyShield";
import { visibleOnWall, WidgetId, WidgetPlaceholder, WALL_SPANS, WIDGET_TONES, wallColumns } from "./widgets";
import { WallStatStrip, ThisWeekCard } from "./WallStatsStrip";

// Panel locked to 1080×1920 portrait (spec decision 7); 3×4 dense grid lives in widgets.tsx.
const GRID_GAP = 16;
const GRID_H_PAD = 24;
/** Grid top margin (the web's mt-6 rhythm, tightened to the wall's 16+4). */
const GRID_TOP = 20;
/**
 * Header budget: date/rail band + greeting + the KPI band. Measured rows
 * (tests/home-wall.test.tsx pins the arithmetic): padTop 24 + rail band 114
 * (88 avatar + 6 + 20 label) + 12 + two-line greeting 116 + 12 + KPI band 90
 * = 368. 385 reserved leaves 17dp for a longer rail label or a third
 * greeting line. Receiving the KPI band + "This Week" tail back is what the
 * reference captures show — the wall used to absorb both into ~40% taller
 * cards, and the critic called that mis-budget out.
 */
const HEADER_H = 385;
const DOCK_CLEAR = 140;
/** "This Week" tail (header 48 + strip 69 + DayLine 16 + 2×10 gaps + 24
 *  padding) = 177 measured; 190 reserved leaves 13dp. */
const TAIL_H = 190;
/** Grid → tail gap. */
const TAIL_GAP = 20;
const WALL_HEIGHT = 1920;

/**
 * Cell height. The derivation subtracts EVERY fixed row it sits between —
 * header, both gaps, the tail, the dock clearance and the grid's own internal
 * gaps — so the reservation sum itself fits the panel (1919 of 1920), not
 * just the "measured" one. The old formula omitted the grid's top margin, so
 * the reservation ran 18dp OVER the panel and the wall only fitted because
 * the header measured 12dp under budget.
 */
export const GRID_CELL_H = Math.floor(
  (WALL_HEIGHT - HEADER_H - DOCK_CLEAR - GRID_TOP - TAIL_GAP - TAIL_H - GRID_GAP * (4 - 1)) / 4
);

/** Time-of-day greeting matching the web's wall header. */
export function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 22) return "Good evening";
  return "Good night";
}

/**
 * The clock's season glyph — the web's month band (page.tsx:411-413), ported
 * so a hardcoded 🍂 can't be right for one month and wrong for nine.
 * Spring = Mar–May, Summer = Jun–Aug, Autumn = Sep–Nov, Winter = Dec–Feb.
 */
export function seasonGlyph(month: number): string {
  if (month >= 2 && month <= 4) return "🌸";
  if (month >= 5 && month <= 7) return "☀️";
  if (month >= 8 && month <= 10) return "🍂";
  return "❄️";
}

export interface HomeWallProps {
  members: RailMember[];
  onSelectMember: (m: RailMember) => void;
  onSignOut?: () => void;
  /** id → component; ids absent from the registry render a placeholder cell. */
  widgets?: Partial<Record<WidgetId, React.ComponentType>>;
  greetingNow?: Date;
  /** The "This Week" strip's destination (/meals?day=). Absent = read-only. */
  onSelectDay?: (dayId: string) => void;
  /** Opens the Home "More…" sheet. */
  onOpenMore?: () => void;
}

/**
 * The wall: greeting + member rail + the 12-cell widget bento (3 cols, 4
 * rows; photos spans 2 rows). Height is the contract — the wall never scrolls.
 */
export function HomeWall({ members, onSelectMember, onSignOut, widgets = {}, greetingNow, onSelectDay, onOpenMore }: HomeWallProps) {
  const { colors, accentColor, theme } = useTheme();
  const { member } = useAuth();
  const now = greetingNow ?? new Date();
  const greeting = greetingFor(now.getHours());
  const day = now.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
  const date = now.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase();
  const time = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  // Web parity (page.tsx:537): signed in → the session member's first name;
  // signed out → the family label. The family surname lives only on the NAS
  // (live roster) — never in this source (public-ish remote).
  const familyName = member?.name?.split(" ")[0] ?? "family";

  const defs = visibleOnWall();
  const columns = wallColumns(defs);
  const { width: winW, height: winH } = useWindowDimensions();
  const effectiveWallH =
    typeof jest === "undefined" && Platform.OS === "android" && winW >= 960 && winH > WALL_HEIGHT
      ? winH
      : WALL_HEIGHT;
  const cellH =
    effectiveWallH === WALL_HEIGHT
      ? GRID_CELL_H
      : Math.floor(
          (effectiveWallH - HEADER_H - DOCK_CLEAR - GRID_TOP - TAIL_GAP - TAIL_H - GRID_GAP * (4 - 1)) / 4
        );

  return (
    <View style={{ flex: 1, paddingHorizontal: GRID_H_PAD, paddingTop: 20 }}>
      {/* Emergency shield: 64dp, top-right of the header area, never over the rail */}
      <EmergencyShield style={{ zIndex: 10 }} />
      {/* Row 1: Date/time eyebrow + single-line Greeting on the left, clearing the top-right
          EmergencyShield & status pill. */}
      <View style={{ paddingRight: 88 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 28 }}>
          <Text
            numberOfLines={1}
            style={{
              color: colors["color-text-secondary"],
              fontSize: TYPOGRAPHY.label.fontSize,
              fontWeight: "700",
              letterSpacing: 2,
              flexShrink: 0,
            }}
          >
            {day} · {date}
          </Text>
          <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "600" }}>
            {seasonGlyph(now.getMonth())} {time}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 12, marginTop: 2, flexWrap: "wrap" }}>
          <Text
            numberOfLines={1}
            style={{ color: colors["color-text-primary"], fontSize: 46, fontWeight: "700", lineHeight: 58, fontFamily: FONTS.display }}
          >
            {greeting},{" "}
            {/* lineHeight is explicit on the nested span too: the outer
                lineHeight caps inherited children at the platform default
                (~65 at 54sp), and the card height budget depends on this line
                measuring 58. */}
            <Text style={{ color: accentColor, lineHeight: 58 }}>{familyName}</Text>
          </Text>
        </View>
      </View>

      {/* Row 2: Dedicated full-width MemberRail — spans edge-to-edge so all 9
          family member pill tiles have generous breathing room with zero clipping. */}
      <View style={{ marginTop: 14, marginBottom: 4 }}>
        <MemberRail members={members} currentName={member?.name ?? null} onSelect={onSelectMember} onSignOut={onSignOut} />
      </View>

      {/* KPI band — the web's three StatTiles (Events/Tasks/Week), fed by the
          widgets that already own each fact (src/home/wall-stats.ts). */}
      <WallStatStrip />

      {/* 12-cell bento: three explicit columns (web grid-flow-dense port) so
          photos can span rows 1–2 in col-1 while cols 2–3 fill beside it.
          Total height = 4×GRID_CELL_H + 3×GRID_GAP = WALL_HEIGHT − HEADER_H − DOCK_CLEAR. */}
      <View style={{ flexDirection: "row", gap: GRID_GAP, marginTop: GRID_TOP }} testID="wall-grid">
        {columns.map((col, ci) => (
          <View key={`col-${ci}`} style={{ flex: 1, gap: GRID_GAP }} testID={`wall-col-${ci}`}>
            {col.map((def) => {
              const span = WALL_SPANS[def.id] ?? 1;
              const Cell = widgets[def.id];
              const isFullBleed = def.id === "photos" || def.id === "weather";
              // Per-widget tone (web WidgetCard parity): a tone wash + tone
              // hairline on every card — the wall's most distinctive cue.
              const tone = (ACCENTS as { dark: Record<string, string>; light: Record<string, string> })[theme]?.[WIDGET_TONES[def.id]] ?? accentColor;
              return (
                <View
                  key={def.id}
                  testID={`widget-${def.id}`}
                  style={{ height: span === 2 ? cellH * 2 + GRID_GAP : cellH }}
                >
                  <Material
                    tier="regular"
                    tone={isFullBleed ? undefined : tone}
                    style={{
                      flex: 1,
                      borderRadius: 28,
                      padding: isFullBleed ? 0 : 14,
                    }}
                  >
                    {Cell ? <Cell /> : <WidgetPlaceholder def={def} />}
                  </Material>
                </View>
              );
            })}
          </View>
        ))}
      </View>

      {/* "This Week" tail (web page.tsx:1070-1095): the week strip + a
          week-mode DayLine, in a sibling below the bento — one tap from Home,
          /meals?day= is the same contract the web relies on. */}
      <View style={{ marginTop: TAIL_GAP, paddingBottom: DOCK_CLEAR }}>
        <ThisWeekCard onSelectDay={onSelectDay} onOpenMore={onOpenMore} />
      </View>
    </View>
  );
}

export default HomeWall;
