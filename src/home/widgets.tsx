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

export interface WallWidgetProps {
  span: WallSpan;
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
  "weather",
  "todayEvents",
  "tasks",
  "morningBriefing",
  "music",
  "currentMeal",
  "leaderboard",
  "homeSecurity",
  "homeClimate",
  "homeLights",
];

export const WALL_DEFAULT_HIDDEN_WIDGETS: WidgetId[] = [
  "homeSecurity",
  "homeClimate",
  "homeLights",
];

export const WALL_LOCKED_HIDDEN_WIDGETS: WidgetId[] = [
  "aiQuickAsk",
  "schedule",
  "consuelaSuggestions",
  "financeLedger",
];

export const WALL_HIDDEN_WIDGETS: WidgetId[] = [
  ...WALL_DEFAULT_HIDDEN_WIDGETS,
  ...WALL_LOCKED_HIDDEN_WIDGETS,
];

export const WALL_SPANS: Partial<Record<WidgetId, WallSpan>> = {
  photos: 2,
  weather: 2,
  todayEvents: 2,
  tasks: 2,
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

/**
 * Dense row-major placement — the web's `grid-flow-dense` port. A span-2
 * widget anchors in the first free slot whose next row cell is also free
 * (the photo hero → col-1 rows 1–2); every other widget fills the next free
 * slot. Returns one widget list per column (top→bottom). Exactly WALL_ROWS
 * cells per column when the layout sums to WALL_COLS × WALL_ROWS.
 *
 * The span map is the USER'S (src/home/wallLayout.ts): the board's sizes are
 * a per-device preference, not a constant.
 */
export function wallColumns(
  defs: WidgetDef[] = visibleOnWall(),
  spans: Partial<Record<WidgetId, WallSpan>> = WALL_SPANS
): WidgetDef[][] {
  const occupied = new Set<string>();
  const cols: WidgetDef[][] = Array.from({ length: WALL_COLS }, () => []);
  for (const def of defs) {
    const span = spans[def.id] ?? WALL_SPANS[def.id] ?? 1;
    outer: for (let r = 0; r < WALL_ROWS; r++) {
      for (let c = 0; c < WALL_COLS; c++) {
        if (occupied.has(`${r},${c}`)) continue;
        if (span === 2 && (r + 1 >= WALL_ROWS || occupied.has(`${r + 1},${c}`))) continue;
        occupied.add(`${r},${c}`);
        if (span === 2) occupied.add(`${r + 1},${c}`);
        cols[c].push(def);
        break outer;
      }
    }
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
