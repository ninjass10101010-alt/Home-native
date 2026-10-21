/**
 * wall-stats.ts — the wall header's KPI band, fed by the widgets that already
 * own each fact.
 *
 * Why a store and not three more fetches: Today's Events, Tasks and Current
 * Meal each already read their own source (the WidgetFrame contract: one read
 * per source, honest degradation, no duplicate network paths). The KPI band
 * publishes nothing new — it publishes what those reads already produced, so
 * the band can never disagree with the card it sits above, and a guest wall
 * costs the same fetches it did before.
 *
 * Every value is `null` until its source has actually answered. `null` is
 * NEVER rendered as a number: the tile wears the web's "—" placeholder and
 * the other tiles stay blank until truth arrives. A fabricated 0 on a
 * still-loading read is the exact "silent empty" the kit bans — and so is a
 * fabricated 0 on a read that FAILED or was never authorised: a wall that
 * could not reach the family publishes `publishWallStatsUnknown(...)`, never
 * a number it did not read.
 *
 * A STALE read is neither of those. The card below the band shows the
 * last-good copy and says so ("Showing your saved copy — couldn't refresh."),
 * so the band publishes that SAME copy — the band can never disagree with
 * the card it sits above — and marks it stale (`openTasksStale`), which the
 * tile renders as a marker. Publishing it as UNKNOWN instead (the previous
 * round's fix) put "—" in the band while the card asserted 17: the same
 * frame, two contradictory claims.
 */

import { useEffect, useReducer } from "react";

/** One cell of the wall's week strip: a weekday, its date, and whether the
 *  family planned anything for it. */
export interface WallDayCell {
  label: string;
  date: number;
  planned: boolean;
  isToday: boolean;
}

export interface WallStats {
  /** Today's merged family + Google events. null = the read hasn't answered. */
  eventsToday: number | null;
  /** Open (not completed) tasks from the shared sync snapshot. */
  openTasks: number | null;
  /**
   * TRUE when `openTasks` is the LAST-GOOD copy — the refresh failed and the
   * number on screen is the copy the card is already showing, badged. The
   * band publishes the card's own number (never a different one, never an
   * UNKNOWN while the card asserts a count) and this flag is what makes the
   * tile carry the staleness: "stale data is badged or hidden, never faked".
   */
  openTasksStale: boolean;
  /** Distinct weekdays with at least one planned meal this week. */
  plannedDays: number | null;
  /** The Mon–Sun strip cells for the current week. */
  weekCells: WallDayCell[] | null;
}

const INITIAL: WallStats = {
  eventsToday: null,
  openTasks: null,
  openTasksStale: false,
  plannedDays: null,
  weekCells: null,
};

let stats: WallStats = INITIAL;
const listeners = new Set<() => void>();

/** Merge a widget's freshly-read truth into the band. Late publishers win;
 *  a widget that unmounts simply stops updating its slice. */
export function publishWallStats(next: Partial<WallStats>): void {
  stats = { ...stats, ...next };
  for (const listener of [...listeners]) listener();
}

/**
 * Publish the UNKNOWN for one slice — the source could not answer (it is
 * unreachable, the wall is signed out, or the read failed).
 *
 * This exists so that "we do not know" is a first-class, NAMED state: the
 * band shows its placeholder glyph, and the tile can never claim a count it
 * did not read. A guest or offline wall once published a hard `0` for the
 * pending tasks, which contradicted the PIN gate on the card directly below
 * it — a fabricated count is the exact "silent empty" the kit bans.
 *
 * NOTE (critic round 4, HIGH 5): the UNKNOWN is for a read that produced NO
 * truth. A read that produced a LAST-GOOD copy is not unknown — it is stale,
 * and it is published as the number the card is already showing, together
 * with `openTasksStale`. Publishing that copy as UNKNOWN made the band and
 * the card disagree in the same frame: the band claimed "—" while the card
 * asserted "17 pending for the family" 380px below it.
 */
export function publishWallStatsUnknown(slice: "eventsToday" | "openTasks" | "plannedDays"): void {
  publishWallStats(slice === "openTasks" ? { openTasks: null, openTasksStale: false } : { [slice]: null });
}

/** Subscribe to the band. Reading during render is safe: the module state is
 *  replaced (never mutated) on every publish, and the reducer re-render is
 *  what makes the new object visible. */
export function useWallStats(): WallStats {
  const [, bump] = useReducer((c: number) => c + 1, 0);
  useEffect(() => {
    const listener = () => bump();
    listeners.add(listener);
    listener(); // a publish between first render and this effect must not be lost
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return stats;
}

/** Test/route-teardown hook: drop every slice back to "not answered yet". */
export function resetWallStats(): void {
  stats = INITIAL;
}

/** Weekday short labels in Monday-first order (web `weekdayLabels`). */
export const WEEK_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/**
 * The Mon–Sun cells of the week containing `now` (web `weekDays`: label, date
 * numeral, today accent, sage when meals exist). `plannedLabels` carries the
 * weekday shorts that have at least one row for the current week.
 */
/**
 * The strip's SKELETON: the same cells with no planned-day knowledge, used
 * when the meals read has not answered (or failed). The strip's dates and
 * today accent are calendar facts, not meal data — the web renders them
 * regardless and waits for the sage dots. Publishing nothing instead makes
 * the whole band vanish, which hides the calendar under a meal outage.
 */
export function weekSkeletonFor(now: Date): WallDayCell[] {
  return weekCellsFor(now, new Set());
}

export function weekCellsFor(now: Date, plannedLabels: ReadonlySet<string>): WallDayCell[] {
  const mondayIndex = (now.getDay() + 6) % 7; // 0 for Monday
  const todayLabel = WEEK_LABELS[mondayIndex];
  return WEEK_LABELS.map((label, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() - mondayIndex + i);
    return { label, date: d.getDate(), planned: plannedLabels.has(label), isToday: label === todayLabel };
  });
}
