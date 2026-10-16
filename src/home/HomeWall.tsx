import React from "react";
import { Text, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { ACCENTS, FONTS, TYPOGRAPHY } from "../theme/tokens";
import { mixAlpha } from "../ui/SoftButton";
import { Material } from "../theme/Material";
import { MoreButton } from "../nav/CapsuleDock";
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

  return (
    <View style={{ flex: 1, paddingHorizontal: GRID_H_PAD, paddingTop: 24 }}>
      {/* Emergency shield: 64dp, top-right of the header area, never over the rail */}
      <EmergencyShield />
      {/* Wall header (web page.tsx:615-632 parity): ROW 1 = date kicker + the
          identity rail sharing the band; ROW 2 = greeting with the clock
          inline beside the name (the web explicitly deleted the stranded
          far-right clock) — clearing the floating shield's column. */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingRight: 88, gap: 16 }}>
        <Text
          style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700", letterSpacing: 2 }}
        >
          {day} · {date}
        </Text>
        <MemberRail members={members} currentName={member?.name ?? null} onSelect={onSelectMember} onSignOut={onSignOut} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
        <Text style={{ color: colors["color-text-primary"], fontSize: 54, fontWeight: "700", lineHeight: 58, fontFamily: FONTS.display }}>
          {greeting},{"\n"}
          {/* lineHeight is explicit on the nested span too: the outer
              lineHeight caps inherited children at the platform default
              (~65 at 54sp), and the card height budget depends on this line
              measuring exactly 2×58. */}
          <Text style={{ color: accentColor, lineHeight: 58 }}>{familyName}</Text>
        </Text>
        <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.title.fontSize, marginBottom: 6 }}>
          {seasonGlyph(now.getMonth())} {time}
        </Text>
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
              // Per-widget tone (web WidgetCard parity): a tone wash + tone
              // hairline on every card — the wall's most distinctive cue.
              const tone = (ACCENTS as { dark: Record<string, string>; light: Record<string, string> })[theme]?.[WIDGET_TONES[def.id]] ?? accentColor;
              return (
                <View
                  key={def.id}
                  testID={`widget-${def.id}`}
                  style={{ height: span === 2 ? GRID_CELL_H * 2 + GRID_GAP : GRID_CELL_H }}
                >
                  <Material
                    tier="regular"
                    style={{
                      flex: 1,
                      borderRadius: 28,
                      padding: 18,
                      borderWidth: 1,
                      borderColor: mixAlpha(tone, 0.32),
                      backgroundColor: mixAlpha(tone, 0.10),
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
        <ThisWeekCard onSelectDay={onSelectDay} />
      </View>

      {onOpenMore ? (
        <View style={{ position: "absolute", right: 24, bottom: 96 }} pointerEvents="box-none">
          <MoreButton onPress={onOpenMore} />
        </View>
      ) : null}
    </View>
  );
}

export default HomeWall;
