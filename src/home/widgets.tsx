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

/** Wall default order + hidden set (verbatim from TABLET_DEFAULT_WIDGETS / TABLET_HIDDEN_WIDGETS). */
export const WALL_DEFAULT_WIDGETS: WidgetId[] = [
  "photos",
  "morningBriefing", "weather", "todayEvents", "tasks",
  "currentMeal", "aiQuickAsk", "leaderboard",
  "homeSecurity", "homeClimate", "homeLights",
  "schedule", "consuelaSuggestions", "music", "financeLedger",
];
export const WALL_HIDDEN_WIDGETS: WidgetId[] = ["schedule", "consuelaSuggestions", "music", "financeLedger"];

/** Only photos earns 2 cells on the wall board (the portrait hero). */
export const WALL_SPANS: Partial<Record<WidgetId, number>> = { photos: 2 };

export const WALL_COLS = 3;
export const WALL_ROWS = 4;

/**
 * Dense row-major placement — the web's `grid-flow-dense` port. A span-2
 * widget anchors in the first free slot whose next row cell is also free
 * (photos → col-1 rows 1–2); every other widget fills the next free slot.
 * Returns one widget list per column (top→bottom). Exactly WALL_ROWS cells
 * per column when the registry sums to WALL_COLS × WALL_ROWS.
 */
export function wallColumns(defs: WidgetDef[] = visibleOnWall()): WidgetDef[][] {
  const occupied = new Set<string>();
  const cols: WidgetDef[][] = Array.from({ length: WALL_COLS }, () => []);
  for (const def of defs) {
    const span = WALL_SPANS[def.id] ?? 1;
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

export function visibleOnWall(): WidgetDef[] {
  const off = new Set(WALL_HIDDEN_WIDGETS);
  return WALL_DEFAULT_WIDGETS.map((id) => ALL_WIDGETS.find((w) => w.id === id)!).filter((w) => !off.has(w.id));
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
