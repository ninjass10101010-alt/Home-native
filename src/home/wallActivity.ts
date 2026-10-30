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
  // 1 pending = score 20 (compact 1-cell card).
  // 2+ pending = more content (can expand to 2 cells).
  const taskScore =
    stats.openTasks === null
      ? { score: 50, settled: false }
      : stats.openTasks === 0
        ? { score: 5, settled: true } // 0 tasks → compact span 1
        : stats.openTasks <= 1
          ? { score: 20, settled: true } // 1 task → compact span 1
          : stats.openTasks <= 3
            ? { score: 70, settled: true }
            : stats.openTasks <= 5
              ? { score: 85, settled: true }
              : { score: 95, settled: true }; // 6+ tasks → critical
  scores.set("tasks", { id: "tasks", ...taskScore });

  // Today's events: more events = show more.
  // 0 or 1 event = compact span 1 (fits cleanly in 1 cell with DayLine).
  // 2+ events = more content (can expand to 2 cells).
  const eventScore =
    stats.eventsToday === null
      ? { score: 50, settled: false }
      : stats.eventsToday === 0
        ? { score: 5, settled: true } // 0 events → compact span 1
        : stats.eventsToday <= 1
          ? { score: 20, settled: true } // 1 event → compact span 1
          : stats.eventsToday <= 3
            ? { score: 70, settled: true }
            : stats.eventsToday <= 5
              ? { score: 85, settled: true }
              : { score: 95, settled: true };
  scores.set("todayEvents", { id: "todayEvents", ...eventScore });

  // Planned meals (week)
  const mealScore =
    stats.plannedDays === null
      ? { score: 40, settled: false }
      : stats.plannedDays <= 1
        ? { score: 15, settled: true }
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

  // Daily schedule: routines and timeline
  scores.set("schedule", { id: "schedule", score: 40, settled: true });

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
 * Check if a widget has multi-item or rich content that justifies expanding to a large 2-cell card.
 *
 * If a widget has small content (0 or 1 event, 0 or 1 task, 0 or 1 planned meal, or compact controls),
 * it must remain small (span 1) to keep the board clean without empty voids.
 */
export function hasMoreContent(id: WidgetId, stats: WallStats): boolean {
  switch (id) {
    case "photos":
      return true; // Fixed visual anchor
    case "todayEvents":
      // 0 or 1 event = small content (fits cleanly in 1 cell with DayLine)
      // 2+ events = more content, needs 2 cells for full schedule
      return stats.eventsToday !== null && stats.eventsToday >= 2;
    case "tasks":
      // 0 or 1 task = small content (single chore or caught-up state)
      // 2+ tasks = more content, needs 2 cells for chore list and assignees
      return stats.openTasks !== null && stats.openTasks >= 2;
    case "currentMeal":
      // 0 or 1 planned day = small content
      // 2+ planned days = more content
      return stats.plannedDays !== null && stats.plannedDays >= 2;
    case "weather":
      // Weather has a rich 5-day forecast row directly on the card
      return true;
    case "schedule":
      // Daily schedule with timeline and routines
      return true;
    default:
      // Other widgets (music, briefing, leaderboard, home controls) are compact 1-cell cards
      return false;
  }
}

/**
 * Compute dynamic spans that smartly size cards based on actual content volume:
 * - Widgets with small content (<= 1 item) stay small (span 1).
 * - Widgets with more content (2+ items, rich forecast) can expand to span 2,
 *   up to the board's 12-cell budget.
 * - Explicit user layout preferences (e.g. setting calendar to 1 cell in Settings)
 *   are ALWAYS respected and never overridden by auto-arrange.
 */
export function dynamicSpans(
  layout: WallLayout,
  activities: Map<WidgetId, WidgetActivity>,
  visibleIds: WidgetId[],
  stats?: WallStats,
): Partial<Record<WidgetId, WallSpan>> {
  const spans: Partial<Record<WidgetId, WallSpan>> = {};
  const totalCells = 12;

  // 1. Lock fixed widgets (photos is locked at span 2)
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

  // Max extra cells available to expand eligible widgets from 1 to 2 cells
  const maxSpan2 = Math.max(0, Math.min(flexibleCount, remainingCells - flexibleCount));

  // Determine which flexible widgets are eligible to expand to span 2:
  // A widget can be span 2 ONLY IF:
  //   a) The user did NOT explicitly configure it as 1 cell in layout.spans (user choice respected!), AND
  //   b) It has multi-item or rich content (hasMoreContent), NOT small content (<= 1 item).
  const eligibleIds = flexibleIds.filter((id) => {
    // If the user explicitly set 1 cell in Settings, honor their choice: never expand to 2
    if (layout.spans[id] === 1) return false;

    if (stats) {
      return hasMoreContent(id, stats);
    }
    // Fallback when stats is omitted (e.g. early tests): check settled score threshold
    const act = activities.get(id);
    if (!act || !act.settled) return (layout.spans[id] ?? WALL_SPANS[id]) === 2;
    return act.score >= 50;
  });

  // Sort eligible widgets by activity score descending (busiest first)
  const sortedEligible = [...eligibleIds].sort((a, b) => {
    const sa = activities.get(a)?.score ?? 0;
    const sb = activities.get(b)?.score ?? 0;
    return sb - sa;
  });

  const span2Set = new Set<WidgetId>(sortedEligible.slice(0, maxSpan2));

  // Top eligible widgets get span 2; small-content and 1-cell widgets stay at span 1
  for (const id of flexibleIds) {
    spans[id] = span2Set.has(id) ? 2 : 1;
  }

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
