/**
 * wallActivity.ts — Activity-based widget scoring and dynamic layout.
 *
 * The wall's bento grid is a FIXED 3×4 cell frame (12 cells). This module
 * scores every visible widget by its current "activity" — how much the family
 * needs to see it RIGHT NOW — and returns a dynamic span map that gives busy
 * widgets more room (span 2 → tall card) and quiet ones less (span 1 → compact
 * card). The ordering is also arranged so the busiest widgets rise to the
 * top of their columns.
 *
 * The scoring never INVENTS data: it reads the wall-stats store (which is
 * itself fed by the widgets' own reads), so a score of 0 means "the widget
 * answered and has nothing to show", and `null` means "the widget hasn't
 * answered yet" — the two are NOT the same (the kit bans the silent empty).
 *
 * Rules:
 *   1. Total cells must always sum to 12 (3 cols × 4 rows = 12 cells).
 *   2. Photos always keeps its default span (it's the hero visual anchor).
 *   3. If tasks has 0 items, it shrinks to span-1 (compact).
 *   4. If tasks has active items, it expands to span-2 (tall).
 *   5. The busiest flexible widgets earn the span-2 slots.
 *   6. Placement in wallColumns packs cleanly into 3 columns of height 4.
 */

import { type WallStats } from "./wall-stats";
import {
  type WidgetId,
  type WallSpan,
  WALL_SPANS,
} from "./widgets";
import { type WallLayout } from "./wallLayout";

/** Per-widget activity score: higher = more important right now. */
export interface WidgetActivity {
  id: WidgetId;
  score: number;
  /** True when the widget's source has answered with real data. */
  settled: boolean;
}

/**
 * Score each widget's current activity from the wall-stats store.
 *
 * Scale is 0 (empty / nothing to show) to 100 (critical / high volume).
 */
export function scoreWidgets(stats: WallStats): Map<WidgetId, WidgetActivity> {
  const scores = new Map<WidgetId, WidgetActivity>();

  // Tasks: more pending = more important.
  // 0 pending = score 5 (demote to compact).
  const taskScore =
    stats.openTasks === null
      ? { score: 50, settled: false }
      : stats.openTasks === 0
        ? { score: 5, settled: true } // 0 tasks → compact span 1
        : stats.openTasks <= 2
          ? { score: 65, settled: true }
          : stats.openTasks <= 5
            ? { score: 80, settled: true }
            : { score: 95, settled: true }; // 6+ tasks → critical
  scores.set("tasks", { id: "tasks", ...taskScore });

  // Today's events: more events = show more
  const eventScore =
    stats.eventsToday === null
      ? { score: 50, settled: false }
      : stats.eventsToday === 0
        ? { score: 5, settled: true } // 0 events → compact span 1
        : stats.eventsToday <= 2
          ? { score: 65, settled: true }
          : stats.eventsToday <= 4
            ? { score: 80, settled: true }
            : { score: 95, settled: true };
  scores.set("todayEvents", { id: "todayEvents", ...eventScore });

  // Planned meals (week)
  const mealScore =
    stats.plannedDays === null
      ? { score: 40, settled: false }
      : stats.plannedDays === 0
        ? { score: 10, settled: true }
        : stats.plannedDays <= 3
          ? { score: 45, settled: true }
          : { score: 60, settled: true };
  scores.set("currentMeal", { id: "currentMeal", ...mealScore });

  // Photos: always neutral 50 — visual anchor, kept at span 2
  scores.set("photos", { id: "photos", score: 50, settled: true });

  // Weather: glanceable
  scores.set("weather", { id: "weather", score: 48, settled: true });

  // Morning briefing: medium priority
  scores.set("morningBriefing", { id: "morningBriefing", score: 42, settled: true });

  // Leaderboard: motivational but not urgent
  scores.set("leaderboard", { id: "leaderboard", score: 30, settled: true });

  // Music: has dynamic island now, card is lower priority
  scores.set("music", { id: "music", score: 25, settled: true });

  // Home controls (often hidden by default)
  scores.set("homeSecurity", { id: "homeSecurity", score: 20, settled: true });
  scores.set("homeClimate", { id: "homeClimate", score: 15, settled: true });
  scores.set("homeLights", { id: "homeLights", score: 15, settled: true });

  return scores;
}

/** Widgets whose span is FIXED and never dynamically resized (visual anchor). */
const LOCKED_SPAN_WIDGETS = new Set<WidgetId>(["photos"]);

/**
 * Compute dynamic spans that perfectly fit the 12-cell grid budget.
 *
 * For N visible widgets (usually 8), exactly (12 - N) widgets must be span-2
 * so that 2 * (12 - N) + 1 * (2N - 12) = 12 cells.
 * For N = 8, exactly 4 widgets are span-2 (photos + top 3 flexible widgets).
 */
export function dynamicSpans(
  layout: WallLayout,
  activities: Map<WidgetId, WidgetActivity>,
  visibleIds: WidgetId[],
): Partial<Record<WidgetId, WallSpan>> {
  const spans: Partial<Record<WidgetId, WallSpan>> = {};
  const totalCells = 12;

  // Lock fixed widgets (photos is locked at span 2)
  let lockedSpanTotal = 0;
  for (const id of visibleIds) {
    if (LOCKED_SPAN_WIDGETS.has(id)) {
      const lockedSpan = (layout.spans[id] ?? WALL_SPANS[id] ?? 2) as WallSpan;
      spans[id] = lockedSpan;
      lockedSpanTotal += lockedSpan;
    }
  }

  const flexibleIds = visibleIds.filter((id) => !LOCKED_SPAN_WIDGETS.has(id));
  const flexibleCount = flexibleIds.length;
  const remainingCells = totalCells - lockedSpanTotal;

  // Calculate target number of span-2 flexible widgets:
  // 2 * k + 1 * (flexibleCount - k) = remainingCells
  // k + flexibleCount = remainingCells => k = remainingCells - flexibleCount
  const targetSpan2 = Math.max(0, Math.min(flexibleCount, remainingCells - flexibleCount));

  // Sort flexible widgets by activity score descending
  const sorted = [...flexibleIds].sort((a, b) => {
    const sa = activities.get(a)?.score ?? 0;
    const sb = activities.get(b)?.score ?? 0;
    return sb - sa;
  });

  // Top targetSpan2 flexible widgets get span 2; the rest get span 1
  sorted.forEach((id, index) => {
    spans[id] = index < targetSpan2 ? 2 : 1;
  });

  return spans;
}

/**
 * Sort widget IDs for dense row-major placement in wallColumns.
 *
 * Orders span-2 widgets first (photos, then top busy span-2 widgets),
 * followed by span-1 widgets. This guarantees:
 * - Col 0: photos (span 2) + 1 span-2 widget (height 4)
 * - Col 1: 1 span-2 widget + 2 span-1 widgets (height 4)
 * - Col 2: 1 span-2 widget + 2 span-1 widgets (height 4)
 * Perfect 3×4 packing with busiest cards at eye level.
 */
export function activityOrder(
  visibleIds: WidgetId[],
  activities: Map<WidgetId, WidgetActivity>,
  spans?: Partial<Record<WidgetId, WallSpan>>,
): WidgetId[] {
  const effectiveSpans = spans ?? {};

  // Separate into span-2 and span-1
  const span2s: WidgetId[] = [];
  const span1s: WidgetId[] = [];

  for (const id of visibleIds) {
    const s = effectiveSpans[id] ?? (LOCKED_SPAN_WIDGETS.has(id) ? 2 : 1);
    if (s === 2) {
      span2s.push(id);
    } else {
      span1s.push(id);
    }
  }

  // Photos stays at the front of span-2s
  const photosIndex = span2s.indexOf("photos");
  if (photosIndex > 0) {
    span2s.splice(photosIndex, 1);
    span2s.unshift("photos");
  }

  // Sort other span-2s by score descending
  const otherSpan2s = span2s.filter((id) => id !== "photos").sort((a, b) => {
    const sa = activities.get(a)?.score ?? 0;
    const sb = activities.get(b)?.score ?? 0;
    return sb - sa;
  });

  // Sort span-1s by score descending
  span1s.sort((a, b) => {
    const sa = activities.get(a)?.score ?? 0;
    const sb = activities.get(b)?.score ?? 0;
    return sb - sa;
  });

  const orderedSpan2s = span2s.includes("photos") ? ["photos" as WidgetId, ...otherSpan2s] : otherSpan2s;
  return [...orderedSpan2s, ...span1s];
}
