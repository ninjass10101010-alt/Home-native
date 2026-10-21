import { useEffect, useReducer } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ALL_WIDGETS, WALL_DEFAULT_WIDGETS, WALL_HIDDEN_WIDGETS, WALL_SPANS, type WidgetId } from "./widgets";

/**
 * wallLayout.ts — the wall's per-device widget SIZE + visibility preference.
 *
 * The wall is a fixed 3x4 board (12 cells) that never scrolls: a glanceable
 * surface read from across the room. Today the size of each cell is baked in
 * (`WALL_SPANS` gives the photo hero two rows, everything else one), so the
 * family cannot give a widget more of the board.
 *
 * This module is the ONE place that decides how the board is filled:
 *   - the ORDER comes from the wall's default order (unchanged - a reorder is
 *     a different feature and the board is read left-to-right, top-to-bottom);
 *   - the SIZE of each widget is the user's choice (1 cell, or 2 cells = two
 *     rows in one column, the photo hero's shape);
 *   - the VISIBILITY is the user's choice too, because a size change has to be
 *     able to free cells before another widget can take them.
 *
 * The board has exactly 12 cells. A layout that would need MORE than 12 is
 * refused by the editor (and never rendered), and a layout that uses fewer
 * leaves the remainder as honest empty canvas - the wall never invents a cell.
 *
 * The preference is DEVICE-LOCAL (AsyncStorage), like the theme: the panel is
 * one screen in the house, and the layout is that screen's own arrangement.
 * It is not pushed to the NAS - the family shares the DATA, not the furniture.
 */

const KEY = "consuela-wall-layout";

/** A widget takes one cell, or two (two rows of one column). */
export type WallSpan = 1 | 2;

/** The board's whole budget: 3 columns x 4 rows. */
export const WALL_CELLS = 12;

export interface WallLayout {
  /** widget id -> how many cells it takes. Absent = the default span. */
  spans: Partial<Record<WidgetId, WallSpan>>;
  /** widget ids the family turned off. */
  hidden: WidgetId[];
}

const ALL_IDS = new Set<string>(ALL_WIDGETS.map((w) => w.id));

/** The layout a fresh device starts with: today's board, unchanged. */
export const DEFAULT_WALL_LAYOUT: WallLayout = {
  spans: defaultSpans(),
  hidden: [...WALL_HIDDEN_WIDGETS],
};

/** The board's baked-in sizes, as the layout's typed defaults. */
function defaultSpans(): Partial<Record<WidgetId, WallSpan>> {
  const out: Partial<Record<WidgetId, WallSpan>> = {};
  for (const [id, span] of Object.entries(WALL_SPANS)) {
    if (span === 1 || span === 2) out[id as WidgetId] = span;
  }
  return out;
}

/** Repair anything a hand-edited or stale store hands us. */
export function normalizeWallLayout(raw: unknown): WallLayout {
  // The board's own defaults are the FLOOR: a stored layout may add to them
  // (a widget the family turned off, a size they picked) but a malformed
  // store must never silently un-hide a widget the board ships hidden.
  const out: WallLayout = { spans: defaultSpans(), hidden: [...DEFAULT_WALL_LAYOUT.hidden] };
  if (!raw || typeof raw !== "object") return out;
  const record = raw as Partial<WallLayout>;
  if (record.spans && typeof record.spans === "object") {
    for (const [id, span] of Object.entries(record.spans)) {
      if (!ALL_IDS.has(id)) continue;
      if (span === 1 || span === 2) out.spans[id as WidgetId] = span;
    }
  }
  if (Array.isArray(record.hidden)) {
    // A stored list ADDS to the defaults (the family may hide more, never
    // fewer - the board's shipped-off widgets stay off unless the family
    // explicitly turns one back on through the editor).
    for (const id of record.hidden) {
      if (typeof id === "string" && ALL_IDS.has(id) && !out.hidden.includes(id as WidgetId)) {
        out.hidden.push(id as WidgetId);
      }
    }
  }
  return out;
}

/** The widgets the board shows, in the board's order. */
export function layoutWidgets(layout: WallLayout): WidgetId[] {
  const off = new Set(layout.hidden);
  return WALL_DEFAULT_WIDGETS.filter((id) => !off.has(id));
}

/** The size of one widget (its default when the layout says nothing). */
export function layoutSpan(layout: WallLayout, id: WidgetId): WallSpan {
  const own = layout.spans[id];
  if (own === 1 || own === 2) return own;
  const baked = WALL_SPANS[id];
  return baked === 2 ? 2 : 1;
}

/** How many cells the layout uses, and how many are left over. */
export function layoutCells(layout: WallLayout): { used: number; free: number } {
  const used = layoutWidgets(layout).reduce((sum, id) => sum + layoutSpan(layout, id), 0);
  return { used, free: Math.max(0, WALL_CELLS - used) };
}

/**
 * Would this layout fit the board? The wall is a contract: 12 cells, no
 * scrolling, no overflow. A layout that needs more cells is REFUSED (the
 * editor disables the control and says why) rather than silently dropping a
 * widget off the bottom of the board.
 */
export function layoutFits(layout: WallLayout): boolean {
  return layoutCells(layout).used <= WALL_CELLS;
}

/* ───────────────────────────── the store ───────────────────────────── */

let layout: WallLayout = DEFAULT_WALL_LAYOUT;
let hydrated = false;
let hydrating = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of [...listeners]) listener();
}

function ensureHydrated() {
  if (hydrated || hydrating) return;
  hydrating = true;
  AsyncStorage.getItem(KEY)
    .then((raw) => {
      layout = raw ? normalizeWallLayout(JSON.parse(raw)) : DEFAULT_WALL_LAYOUT;
      hydrated = true;
      emit();
    })
    .catch(() => {
      hydrated = true;
      emit();
    });
}

/** Read the layout (and change it) from any surface. */
export function useWallLayout() {
  const [, bump] = useReducer((c: number) => c + 1, 0);
  useEffect(() => {
    ensureHydrated();
    const listener = () => bump();
    listeners.add(listener);
    listener();
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const setLayout = (next: WallLayout) => {
    if (!layoutFits(next)) return false;
    layout = next;
    emit();
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
    return true;
  };

  return { layout, setLayout, hydrated };
}

/** Test hook - drop the layout back to the default. */
export function resetWallLayout() {
  layout = DEFAULT_WALL_LAYOUT;
  hydrated = true;
  emit();
}
