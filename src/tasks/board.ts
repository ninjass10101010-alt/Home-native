import { localTodayISO } from "../home/widgets/data";
import type { WallTask } from "./claim";

/**
 * The Tasks board's pure selection rules, ported from Home-ai's tasks page
 * (page.tsx memberScoped/openBoard + task-utils isSnatchable/isCrewTask).
 * The board reads ONE shared snapshot; every rule below is display-only —
 * nothing here computes or promises points.
 */

/** A task is claimable when it is universal, past-due and stealable, or a crew task with room. */
export function isCrewTask(t: Pick<WallTask, "crewSize">): boolean {
  return !!t.crewSize && t.crewSize >= 2;
}

export function crewFull(t: Pick<WallTask, "crewSize" | "crewMembers">): boolean {
  if (!t.crewSize) return false;
  return t.crewMembers.length >= t.crewSize;
}

/** web isSnatchable: `!!stealable && !completed && due && due < today`. */
export function isSnatchable(t: WallTask, today: string = localTodayISO()): boolean {
  return t.stealable && !t.completed && !!t.due && t.due < today;
}

export function isOpenable(t: WallTask, me: string): boolean {
  if (t.completed) return false;
  if (isCrewTask(t)) {
    if (crewFull(t)) return false;
    // I already joined (or I am the assignee) — it is mine, not up for grabs.
    if (me && (t.crewMembers.some((m) => m.name === me) || t.assignee === me)) return false;
    return true;
  }
  return t.universal || isSnatchable(t);
}

/** The Open board: claimable rows, richest first (web openBoard's
 *  `b.points - a.points`). The board only exists for the family-wide filters —
 *  a specific member's chip collapses it to the empty state (web parity). */
export function openBoard(tasks: WallTask[], me: string, filter: string): WallTask[] {
  if (filter !== "All" && filter !== "My Tasks" && filter !== "Open") return [];
  return tasks.filter((t) => isOpenable(t, me)).sort((a, b) => b.points - a.points);
}

/** The member filter's scope predicate (web memberScoped). */
export function memberScoped(
  tasks: WallTask[],
  filter: string,
  me: string,
  opts: { myTasksLabel: string }
): WallTask[] {
  return tasks.filter((t) => {
    if (filter === "Open") return !t.completed && (t.universal || isSnatchable(t) || (isCrewTask(t) && !crewFull(t)));
    // "My Tasks" is a LITERAL label (web parity) — it can never collide with a
    // roster name or the guest's "All", which falls through to the last line.
    if (filter === "My Tasks") {
      const mine = me !== "" && t.assignee === me;
      const claimable = isOpenable(t, me);
      return mine || claimable;
    }
    return filter === "All" || t.assignee === filter;
  });
}

/** Pending = scoped, not completed (web `pending`). */
export function pendingBoard(tasks: WallTask[]): WallTask[] {
  return tasks.filter((t) => !t.completed);
}

/** The Completed card's pinned group first: rows still waiting on a decision
 *  (web completedGroups.pending), newest tap first — the queue is a parent's
 *  "what landed since I looked" scan (web approvalQueue parity). */
export function completedWaiting(tasks: WallTask[]): WallTask[] {
  return tasks
    .filter((t) => t.completed && !!t.pendingApproval)
    .sort((a, b) => Date.parse(b.pendingApproval?.at ?? "") - Date.parse(a.pendingApproval?.at ?? "") || b.id - a.id);
}

/** Completed rows that are NOT waiting, newest server week key first. */
export function completedHistory(tasks: WallTask[]): WallTask[] {
  return tasks
    .filter((t) => t.completed && !t.pendingApproval)
    .sort((a, b) => (b.completedInWeek || "").localeCompare(a.completedInWeek || "") || a.id - b.id);
}

/** The stat row. All three read server-authored facts — no client arithmetic over points. */
export function taskStats(
  tasks: WallTask[],
  weekPoints: Record<string, number> | undefined,
  weekStart: string | undefined,
  /** The active member filter: a specific member scopes the earned total to
   *  that member's own ledger row (web `scopedEarned`), exactly like the two
   *  counts beside it. `me` resolves the "My Tasks" label to the signed-in
   *  member. */
  memberFilter?: string,
  me?: string,
  /** The UNFILTERED board: the "Open" filter's scope holds no completed rows
   *  (memberScoped("Open") is `!completed && …`), so its completion count must
   *  come from the family-wide rows — a scoped length is a structural zero. */
  allTasks?: WallTask[]
): {
  pending: number;
  completedThisWeek: number;
  earnedThisWeek: number;
} {
  const scopedName =
    memberFilter === "My Tasks" ? me : memberFilter && memberFilter !== "All" && memberFilter !== "Open" ? memberFilter : undefined;
  const entries = scopedName
    ? ([[scopedName, weekPoints?.[scopedName] ?? 0]] as [string, number][])
    : (Object.entries(weekPoints ?? {}) as [string, number][]);
  const earnedThisWeek = entries.reduce((sum, [, p]) => sum + (Number(p) || 0), 0);
  // completedThisWeek follows the filter the way the web does (page.tsx:2446-2454):
  // under "Open" it counts this week's UNIVERSAL completions (Open excludes
  // every completed row from its scope, so a plain length would be a
  // structural 0); under a member filter it counts EITHER side of the
  // completion (a chore Bailey completed for Rebecca belongs to both rows).
  // "in the current week" = the row's own server key equals the snapshot's
  // weekStart (never a client-side week computation).
  const inCurrentWeek = (t: WallTask): boolean => !weekStart || t.completedInWeek === weekStart;
  let completedThisWeek: number;
  if (memberFilter === "Open") {
    completedThisWeek = (allTasks ?? tasks).filter((t) => t.completed && t.universal && inCurrentWeek(t)).length;
  } else if (scopedName) {
    completedThisWeek = tasks.filter(
      (t) =>
        t.completed &&
        inCurrentWeek(t) &&
        (t.assignee === scopedName || t.completedBy === scopedName)
    ).length;
  } else {
    completedThisWeek = tasks.filter((t) => t.completed && !!t.completedInWeek && inCurrentWeek(t)).length;
  }
  return {
    pending: tasks.filter((t) => !t.completed).length,
    completedThisWeek,
    earnedThisWeek,
  };
}

/** Completed rows regrouped by the server's own week key, newest first (web
 *  groupCompletedTasksByWeek parity) — one header per week, never a single
 *  label borrowed from the newest row. */
export function completedByWeek(tasks: WallTask[]): { weekKey: string; rows: WallTask[] }[] {
  const groups = new Map<string, WallTask[]>();
  for (const t of completedHistory(tasks)) {
    const key = t.completedInWeek || "";
    const bucket = groups.get(key);
    if (bucket) bucket.push(t);
    else groups.set(key, [t]);
  }
  return [...groups.entries()].map(([weekKey, rows]) => ({ weekKey, rows }));
}

/** Filter chip labels: "All" (or "My Tasks" when signed in), the roster, then "Open" (web memberFilterOptions). */
export function filterOptions(
  tasks: WallTask[],
  opts: { signedIn: boolean; roster: { name: string; emoji: string }[]; me: string; meEmoji?: string }
): { id: string; label: string; emoji: string }[] {
  const myLabel = opts.signedIn ? "My Tasks" : "All";
  const names = new Set<string>();
  if (opts.me) names.add(opts.me);
  // "Open" is the unassigned board's own filter chip (appended below), NOT a
  // member - a task assigned to "Open" must not add a SECOND chip with the
  // same id, or the rail renders two "Open" tiles (React duplicate-key).
  for (const m of opts.roster) if (m.name) names.add(m.name);
  // A task can be assigned to a LEGACY name ("Aurora Garcia") while the
  // roster carries the current one ("Aurora"). Adding the raw assignee would
  // render TWO tiles that both read "Aurora" - one person, two chips. Fold
  // the legacy name onto the roster member with the same first name.
  const rosterByFirstName = new Map(
    opts.roster.filter((m) => m.name).map((m) => [m.name.split(" ")[0].toLowerCase(), m.name])
  );
  for (const t of tasks) {
    const assignee = t.assignee;
    if (!assignee) continue;
    if (assignee.toLowerCase() === "open") continue;
    const folded = rosterByFirstName.get(assignee.split(" ")[0].toLowerCase());
    names.add(folded ?? assignee);
  }
  const byName = new Map(opts.roster.map((m) => [m.name, m.emoji]));
  const emojiFor = (name: string) => {
    for (const t of tasks) if (t.assignee === name && t.assigneeEmoji) return t.assigneeEmoji;
    return byName.get(name) ?? "👤";
  };
  return [
    { id: myLabel, label: myLabel, emoji: opts.signedIn && opts.meEmoji ? opts.meEmoji : "👥" },
    ...[...names].sort((a, b) => a.localeCompare(b)).map((n) => ({ id: n, label: n.split(" ")[0], emoji: emojiFor(n) })),
    { id: "Open", label: "Open", emoji: "🫳" },
  ];
}

/** Left rail color by priority (web priorityColor — high rose, medium amber, low mint). */
export function priorityColor(
  priority: "high" | "medium" | "low",
  colors: Record<string, string | undefined>
): string {
  const key = priority === "high" ? "color-accent-rose" : priority === "low" ? "color-accent-mint" : "color-accent-amber";
  return colors[key] ?? colors["color-accent"] ?? "transparent";
}

/** Week group label from the server's own week key — the web's
 *  `Week of Sep 28` wording; "This week" only when the key IS the current
 *  week. Never a raw ISO key in a family-facing card. */
export function weekGroupLabel(weekKey: string, currentWeekStart: string | undefined): string {
  if (!weekKey) return "Earlier";
  if (currentWeekStart && weekKey === currentWeekStart) return "This week";
  const d = new Date(`${weekKey}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? `Week of ${weekKey}`
    : `Week of ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}
