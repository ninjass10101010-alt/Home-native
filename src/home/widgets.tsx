import React from "react";

import { EmptyState } from "../ui/EmptyState";

export type WidgetId =
  | "morningBriefing"
  | "weather"
  | "aiQuickAsk"
  | "consuelaSuggestions"
  | "leaderboard"
  | "todayEvents"
  | "schedule"
  | "currentMeal"
  | "tasks"
  | "homeSecurity"
  | "homeClimate"
  | "homeLights"
  | "financeLedger"
  | "music"
  | "photos";

export interface WidgetDef {
  id: WidgetId;
  label: string;
  emoji: string;
  description: string;
}

export type WallSpan = 1 | 2;
export type WallShape = "1x1" | "1x2" | "2x1";

export function shapeCells(shape: WallShape): WallSpan {
  return shape === "1x1" ? 1 : 2;
}

export function shapeDims(shape: WallShape): { colSpan: 1 | 2; rowSpan: 1 | 2 } {
  switch (shape) {
    case "2x1":
      return { colSpan: 2, rowSpan: 1 };
    case "1x2":
      return { colSpan: 1, rowSpan: 2 };
    case "1x1":
    default:
      return { colSpan: 1, rowSpan: 1 };
  }
}

export interface WallWidgetProps {
  span: WallSpan;
  shape?: WallShape;
}

/** Port of Home-ai src/lib/layout-config.ts ALL_WIDGETS (verbatim). */
export const ALL_WIDGETS: WidgetDef[] = [
  { id: "morningBriefing", label: "Morning Briefing", emoji: "🌅", description: "Today's events, tasks, meals, and what Consuela noticed" },
  { id: "weather", label: "Weather", emoji: "⛅", description: "Current weather & atmospheric conditions" },
  { id: "aiQuickAsk", label: "AI Quick Ask", emoji: "💬", description: "Quick chat prompt to ask Consuela anything" },
  { id: "consuelaSuggestions", label: "Consuela's Suggestions", emoji: "✨", description: "Proactive alerts Consuela noticed for you" },
  { id: "leaderboard", label: "Leaderboard", emoji: "🏆", description: "This week's family points race" },
  { id: "todayEvents", label: "Today's Events", emoji: "📅", description: "Upcoming events for the day" },
  { id: "schedule", label: "Daily Schedule", emoji: "🕐", description: "Routines and reminders" },
  { id: "currentMeal", label: "Current Meal", emoji: "🍽️", description: "Today's meal plan" },
  { id: "tasks", label: "Tasks", emoji: "✅", description: "Pending chores and to-dos" },
  { id: "homeSecurity", label: "Home Security", emoji: "🛡️", description: "Who's home, doors & locks, alarm" },
  { id: "homeClimate", label: "Home Climate", emoji: "🌡️", description: "Indoor temperature and thermostat" },
  { id: "homeLights", label: "Home Lights", emoji: "💡", description: "Quick light toggles and scenes" },
  { id: "financeLedger", label: "The Ledger", emoji: "📒", description: "Parents only — family balances & budget (Alex)" },
  { id: "music", label: "Music", emoji: "🎵", description: "Now playing with transport controls" },
  { id: "photos", label: "Photos", emoji: "📸", description: "A rotating stream of family photos from the shared library" },
];

export const WALL_CONFIGURABLE_WIDGETS: WidgetId[] = [
  "photos",
  "todayEvents",
  "weather",
  "tasks",
  "schedule",
  "currentMeal",
  "leaderboard",
  "music",
  "morningBriefing",
  "homeSecurity",
  "homeClimate",
  "homeLights",
];

export const WALL_DEFAULT_HIDDEN_WIDGETS: WidgetId[] = [
  "morningBriefing",
  "homeSecurity",
  "homeClimate",
  "homeLights",
];

export const WALL_LOCKED_HIDDEN_WIDGETS: WidgetId[] = [
  "aiQuickAsk",
  "consuelaSuggestions",
  "financeLedger",
];

export const WALL_HIDDEN_WIDGETS: WidgetId[] = [
  ...WALL_DEFAULT_HIDDEN_WIDGETS,
  ...WALL_LOCKED_HIDDEN_WIDGETS,
];

export const WALL_SHAPES: Partial<Record<WidgetId, WallShape>> = {
  photos: "1x2",
  weather: "1x2",
  schedule: "2x1",
  music: "2x1",
};

export const WALL_SPANS: Partial<Record<WidgetId, WallSpan>> = {
  photos: 2,
  weather: 2,
  schedule: 2,
  music: 2,
};

export function wallRowBudget(span: WallSpan): 2 | 4 {
  return span === 2 ? 4 : 2;
}

/**
 * The web's per-widget tone map (WidgetCard `--widget-tone`, globals.css:
 * 765-791). Every wall card wears its tone (wash + border + disc); photos
 * keeps a sage-neutral frame around its full-bleed hero.
 */
export const WIDGET_TONES: Record<WidgetId, string> = {
  morningBriefing: "apricot",
  weather: "nori",
  aiQuickAsk: "violet",
  consuelaSuggestions: "violet",
  leaderboard: "amber",
  todayEvents: "nori",
  schedule: "cyan",
  currentMeal: "mint",
  tasks: "rose",
  homeSecurity: "rose",
  homeClimate: "cyan",
  homeLights: "amber",
  financeLedger: "sage",
  music: "violet",
  photos: "sage",
};

export const WALL_COLS = 3;
export const WALL_ROWS = 4;

export interface WallPlacement {
  def: WidgetDef;
  row: number;
  col: number;
  rowSpan: 1 | 2;
  colSpan: 1 | 2;
  shape: WallShape;
}

function findFirstSlot(
  occupied: Set<string>,
  rowSpan: 1 | 2,
  colSpan: 1 | 2,
): { row: number; col: number } | null {
  for (let r = 0; r < WALL_ROWS; r++) {
    for (let c = 0; c < WALL_COLS; c++) {
      if (r + rowSpan > WALL_ROWS || c + colSpan > WALL_COLS) continue;
      let free = true;
      for (let dr = 0; dr < rowSpan && free; dr++) {
        for (let dc = 0; dc < colSpan; dc++) {
          if (occupied.has(`${r + dr},${c + dc}`)) {
            free = false;
            break;
          }
        }
      }
      if (free) return { row: r, col: c };
    }
  }
  return null;
}

/**
 * Dense 2D row-major bento placement (3 columns × 4 rows = 12 cells).
 * Symmetrical Bookends + Wide Strips v3 places Photos (1×2) & Weather (1×2)
 * framing Today (1×1) + Tasks (1×1), with wide Daily Schedule (2×1) + Dinner (1×1)
 * on row 3, and Leaderboard (1×1) + wide Music (2×1) on row 4.
 */
export function wallPlacements(
  defs: WidgetDef[] = visibleOnWall(),
  shapes: Partial<Record<WidgetId, WallShape>> = WALL_SHAPES,
  opts?: { strict?: boolean },
): { placements: WallPlacement[]; fitsAll: boolean } {
  const occupied = new Set<string>();
  const placements: WallPlacement[] = [];
  let fitsAll = true;
  const strict = Boolean(opts?.strict);

  for (const def of defs) {
    const preferred = shapes[def.id] ?? WALL_SHAPES[def.id] ?? "1x1";
    const candidates: WallShape[] = strict
      ? [preferred]
      : preferred === "2x1"
        ? ["2x1", "1x2", "1x1"]
        : preferred === "1x2"
          ? ["1x2", "2x1", "1x1"]
          : ["1x1"];

    let placed: WallPlacement | null = null;
    for (const shape of candidates) {
      const dims = shapeDims(shape);
      const slot = findFirstSlot(occupied, dims.rowSpan, dims.colSpan);
      if (slot) {
        for (let dr = 0; dr < dims.rowSpan; dr++) {
          for (let dc = 0; dc < dims.colSpan; dc++) {
            occupied.add(`${slot.row + dr},${slot.col + dc}`);
          }
        }
        placed = {
          def,
          row: slot.row,
          col: slot.col,
          rowSpan: dims.rowSpan,
          colSpan: dims.colSpan,
          shape,
        };
        break;
      }
    }
    if (!placed) {
      fitsAll = false;
    } else {
      placements.push(placed);
    }
  }
  return { placements, fitsAll };
}

/**
 * Legacy column projection over `wallPlacements`. Kept so column-based helpers
 * and tests continue to inspect per-column membership cleanly.
 */
export function wallColumns(
  defs: WidgetDef[] = visibleOnWall(),
  spans: Partial<Record<WidgetId, WallSpan>> = WALL_SPANS,
): WidgetDef[][] {
  const shapes: Partial<Record<WidgetId, WallShape>> = {};
  for (const def of defs) {
    const span = spans[def.id] ?? WALL_SPANS[def.id] ?? 1;
    shapes[def.id] = span === 2 ? (WALL_SHAPES[def.id] ?? "1x2") : "1x1";
  }
  const { placements } = wallPlacements(defs, shapes);
  const cols: WidgetDef[][] = Array.from({ length: WALL_COLS }, () => []);
  for (const p of placements) {
    cols[p.col].push(p.def);
  }
  return cols;
}

export function visibleOnWall(hidden: readonly WidgetId[] = WALL_HIDDEN_WIDGETS): WidgetDef[] {
  const off = new Set(hidden);
  return WALL_CONFIGURABLE_WIDGETS
    .map((id) => ALL_WIDGETS.find((widget) => widget.id === id))
    .filter((widget): widget is WidgetDef => Boolean(widget))
    .filter((widget) => !off.has(widget.id));
}

/** A placeholder card until a widget's own task lands its content. */
export function WidgetPlaceholder({ def }: { def: WidgetDef }) {
  return (
    <EmptyState
      icon={def.emoji}
      title={def.label}
      body="Arrives in its own Wave 1 task"
      flat
    />
  );
}
