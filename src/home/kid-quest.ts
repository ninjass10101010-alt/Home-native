import {
  displayEmoji,
  normalizeSnapshotTasks,
  type WallTask,
} from "../tasks/claim";
import type { WeekData } from "../state/SyncManager";

/**
 * Kid-wall read model (WS-4): pure helpers over the SHARED SyncManager
 * snapshot. Points/streak are the server's own values keyed by the exact FULL
 * member name (the web ledgerKey lesson: "Alex" never matches "Alexandra")
 * and are never computed here. The level is the ONE thing the web kid home
 * derives from points — its math (KidHome.tsx POINTS_PER_LEVEL = 50:
 * floor(points / 50) + 1) is ported verbatim and fed the same week points;
 * the snapshot carries no all-time points, so the chip wears the web's exact
 * week-points semantics and a label can never claim otherwise.
 */

/** Crew growth rule ported from Home-ai src/lib/task-utils.ts isCrewTask. */
export function crewTaskIdsOf(rawTasks: unknown): Set<number> {
  const ids = new Set<number>();
  if (!Array.isArray(rawTasks)) return ids;
  for (const row of rawTasks) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const r = row as Record<string, unknown>;
    const crewSize = Number(r.crewSize);
    // the real shape needs crewSize >= 2; a crew:{members} object without the
    // size still marks the row a crew (belt + suspenders, same rule family)
    const hasCrewRoster =
      !!r.crew && typeof r.crew === "object" && !Array.isArray(r.crew);
    if (!(crewSize >= 2) && !hasCrewRoster) continue;
    const id = Number(r.id);
    if (Number.isSafeInteger(id) && id > 0) ids.add(id);
  }
  return ids;
}

/** The kid wall's quest list: TasksPage assignee semantics verbatim —
 *  assigned to the signed-in name AND (open OR waiting on a parent's OK). */
export function kidQuestsFor(rawTasks: unknown, memberName: string): WallTask[] {
  if (!memberName) return [];
  return normalizeSnapshotTasks(rawTasks).filter(
    (t) => t.assignee === memberName && (!t.completed || !!t.pendingApproval)
  );
}

export function kidPoints(weekData: WeekData | undefined, memberName: string): number {
  if (!weekData?.points || !memberName) return 0;
  return Number(weekData.points[memberName]) || 0;
}

export function kidStreak(weekData: WeekData | undefined, memberName: string): number {
  if (!weekData?.streak || !memberName) return 0;
  return Number(weekData.streak[memberName]) || 0;
}

/**
 * Hero emoji — roster emojis may be photo data URLs (the 1 MiB incident
 * rule: never a Text glyph, snapshot slims to 👤 at write). This is the wall
 * hero-side reader of the SAME rule TasksPage renders with.
 */
export const kidEmoji = displayEmoji;
