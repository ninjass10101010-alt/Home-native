import React from "react";
import { Text, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { TYPOGRAPHY } from "../theme/tokens";
import { Material } from "../theme/Material";
import { MemberRail, type RailMember } from "../ui/MemberRail";
import { useAuth } from "../state/AuthProvider";
import { EmergencyShield } from "./EmergencyShield";
import { visibleOnWall, WidgetId, WidgetPlaceholder, WALL_SPANS } from "./widgets";

const WALL_WIDTH = 1080; // locked to the panel (spec decision 7)
const GRID_COLS = 3;
const GRID_GAP = 16;
const GRID_H_PAD = 24;
const HEADER_H = 300;
const DOCK_CLEAR = 140;
const WALL_HEIGHT = 1920;

export const GRID_CELL_H = Math.floor(
  (WALL_HEIGHT - HEADER_H - DOCK_CLEAR - GRID_GAP * (4 - 1)) / 4
); // 4 rows visible budget

/** Time-of-day greeting matching the web's wall header. */
export function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 22) return "Good evening";
  return "Good night";
}

export interface HomeWallProps {
  members: RailMember[];
  onSelectMember: (m: RailMember) => void;
  onSignOut?: () => void;
  /** id → component; ids absent from the registry render a placeholder cell. */
  widgets?: Partial<Record<WidgetId, React.ComponentType>>;
  greetingNow?: Date;
}

/**
 * The wall: greeting + member rail + the 12-cell widget bento (3 cols, 4
 * rows; photos spans 2 rows). Height is the contract — the wall never scrolls.
 */
export function HomeWall({ members, onSelectMember, onSignOut, widgets = {}, greetingNow }: HomeWallProps) {
  const { colors } = useTheme();
  const { member } = useAuth();
  const now = greetingNow ?? new Date();
  const greeting = greetingFor(now.getHours());
  const day = now.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
  const date = now.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase();
  const time = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  const defs = visibleOnWall();
  const cellW = Math.floor((WALL_WIDTH - GRID_H_PAD * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS);

  return (
    <View style={{ flex: 1, paddingHorizontal: GRID_H_PAD, paddingTop: 24 }}>
      {/* Emergency shield: 64dp, top-right of the header area, never over the rail */}
      <EmergencyShield />
      {/* Wall header (per 2026-09-09 wall spec §5): date kicker, greeting, rail */}
      <View>
        <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700", letterSpacing: 2 }}>
          {day} · {date}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 8 }}>
          <Text style={{ color: colors["color-text-primary"], fontSize: 54, fontWeight: "700", lineHeight: 58 }}>
            {greeting},{"\n"}Garcia family
          </Text>
          <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.title.fontSize }}>
            🍂 {time}
          </Text>
        </View>
      </View>

      <View style={{ marginTop: 16 }}>
        <MemberRail members={members} currentName={member?.name ?? null} onSelect={onSelectMember} onSignOut={onSignOut} />
      </View>

      {/* 12-cell bento: photos hero spans 2 rows; everything else 1×1 */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: GRID_GAP, marginTop: 20 }} testID="wall-grid">
        {defs.map((def) => {
          const span = WALL_SPANS[def.id] ?? 1;
          const Cell = widgets[def.id];
          return (
            <View
              key={def.id}
              testID={`widget-${def.id}`}
              style={{ width: cellW, height: span === 2 ? GRID_CELL_H * 2 + GRID_GAP : GRID_CELL_H }}
            >
              <Material tier="regular" style={{ flex: 1, borderRadius: 28, padding: 18 }}>
                {Cell ? <Cell /> : <WidgetPlaceholder def={def} />}
              </Material>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default HomeWall;
