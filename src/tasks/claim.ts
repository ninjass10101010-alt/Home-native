import { api, ApiError } from "../api/client";

/**
 * The WS-7 task-command wrapper: the ONLY seam the wall's Tasks page uses to
 * move chores. Every write is an idempotent operationId command against the
 * verified Home-ai routes (READ-ONLY refs: src/app/api/tasks/claim/route.ts,
 * src/app/api/tasks/approve/route.ts) — 200/202 success shapes, 202-queued
 * durability, refusal reason codes mapped to honest family copy. Points are
 * server-authoritative: nothing here computes or promises them.
 */

/** Kid lane actions (claim route: "claim" needs a PIN; complete/undo ride a session). */
export type ClaimAction = "claim" | "complete" | "undo";
/** Parent lane actions (approve route — always the parent's memberName + pin). */
export type ApproveAction = "approve" | "approve-all" | "send-back";

/** RFC-4122 v4 — crypto.randomUUID when present (Node/dev), manual fallback for Hermes. */
export function newOperationId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Wall task row — the display subset of Home-ai src/types/tasks.ts the page
 * reads from the SHARED /api/tasks/sync snapshot. `pendingApproval` is the
 * server's pending marker, carried as-is and never client-derived.
 */
export interface WallTask {
  id: number;
  title: string;
  assignee: string;
  assigneeEmoji: string;
  points: number;
  completed: boolean;
  pendingApproval: { byName: string; points: number; at: string } | null;
  /** Due date as an ISO day string ("2026-10-02"); "" when unset. */
  due: string;
  category: string;
  priority: "high" | "medium" | "low";
  /** Universal (open to anyone) rows are the Open board. */
  universal: boolean;
  /** Stealable = unclaimed past its due date (web isSnatchable's flag half). */
  stealable: boolean;
  crewSize: number | null;
  crewMembers: { name: string; emoji: string; checkedIn: boolean }[];
  /** Open-task speed bonus — the first claimer earns points + bonus (web speedBonus). */
  speedBonus: number;
  /** The server's own week key for the completion (never client-computed). */
  completedInWeek: string;
  completedBy: string;
}

/** Photo data-URLs never belong in a Text glyph (web safeDisplayEmoji parity, the 1 MiB
 *  incident rule) — legacy rows collapse to the silhouette. Shared by the tasks and
 *  kid-wall surfaces (kid-quest.ts re-exports it as kidEmoji for the hero). */
export function displayEmoji(raw: unknown): string {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 16 || raw.startsWith("data:")) return "👤";
  return raw;
}

/** Honest snapshot normalize: unparseable rows drop out, nothing is invented. */
export function normalizeSnapshotTasks(raw: unknown): WallTask[] {
  if (!Array.isArray(raw)) return [];
  const out: WallTask[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const t = row as Record<string, unknown>;
    const id = Number(t.id);
    if (!Number.isSafeInteger(id) || id <= 0) continue;
    const title = typeof t.title === "string" && t.title.trim() ? t.title : null;
    if (!title) continue;
    const pendingRaw = t.pendingApproval;
    const pending =
      pendingRaw && typeof pendingRaw === "object" && !Array.isArray(pendingRaw)
        ? {
            byName: typeof (pendingRaw as Record<string, unknown>).byName === "string"
              ? ((pendingRaw as Record<string, unknown>).byName as string)
              : "",
            points: Number((pendingRaw as Record<string, unknown>).points) || 0,
            // The server's normalized UTC instant for the tap — the queue
            // sorts on it newest-first (task-operation-contract.ts parity).
            at: typeof (pendingRaw as Record<string, unknown>).at === "string"
              ? ((pendingRaw as Record<string, unknown>).at as string)
              : "",
          }
        : null;
    out.push({
      id,
      title,
      assignee: typeof t.assignee === "string" ? t.assignee : "",
      assigneeEmoji: displayEmoji(t.assigneeEmoji),
      points: Number(t.points) || 0,
      completed: t.completed === true,
      pendingApproval: pending,
      due: typeof t.due === "string" && t.due ? t.due : "",
      category: typeof t.category === "string" ? t.category : "",
      priority: t.priority === "high" || t.priority === "low" ? t.priority : "medium",
      universal: t.universal === true,
      stealable: t.stealable === true,
      crewSize: Number.isFinite(Number(t.crewSize)) && Number(t.crewSize) >= 2 ? Number(t.crewSize) : null,
      // Server shape: crew = { members: [...] } (an OBJECT — the old
      // Array.isArray guard silently dropped every crew).
      crewMembers:
        t.crew && typeof t.crew === "object" && !Array.isArray(t.crew) &&
        Array.isArray((t.crew as Record<string, unknown>).members)
          ? ((t.crew as Record<string, unknown>).members as unknown[])
              .filter((m): m is Record<string, unknown> => !!m && typeof m === "object")
              .map((m) => ({
                name: typeof m.name === "string" ? m.name : "",
                emoji: displayEmoji(m.emoji),
                checkedIn: typeof m.checkedInAt === "string" && m.checkedInAt.length > 0,
              }))
          : [],
      speedBonus: Number(t.speedBonus) || 0,
      completedInWeek: typeof t.completedInWeek === "string" ? t.completedInWeek : "",
      completedBy: typeof t.completedBy === "string" ? t.completedBy : "",
    });
  }
  return out;
}

/**
 * One discriminated outcome for every command, honest by construction:
 * - applied: 200, reconciled — the server confirmed the change.
 * - sending: 202 EITHER WAY — durably queued (queued:true) or applied but
 *   unreconciled (success:true, reconciled:false). NEVER assume instant apply:
 *   poll the shared snapshot; the optional notice is the server's own honest
 *   sentence (e.g. approvals that haven't reached the kitchen display).
 * - refused: the server said no — `reason` rides the copy map, `wrongPin`
 *   keeps the pad open (401 unauthorized), `refreshes` marks codes that prove
 *   the on-screen row is stale (404 unknown / 409 state conflicts).
 */
export type TaskCommandOutcome =
  | { kind: "applied"; skipped?: number }
  | { kind: "sending"; notice?: string }
  | { kind: "refused"; reason: string; status: number; wrongPin: boolean; refreshes: boolean };

interface TaskCommandResponse {
  success?: boolean;
  queued?: boolean;
  reconciled?: boolean;
  reason?: string;
  error?: string;
  skipped?: number;
}

/** The refusal codes both command routes actually emit, said the way the family reads them (web LEDGER_REFUSAL_COPY parity; both unknown_task spellings listed — the approve route hyphenates its display reason). */
const TASK_REFUSAL_COPY: Record<string, string> = {
  unauthorized: "Wrong PIN — try again.",
  pin_required: "Enter your PIN to finish that.",
  session_required: "Sign in again to finish that.",
  not_allowed: "That isn't allowed right now.",
  adult_only: "Only a grown-up can do that.",
  unknown_member: "That name isn't on the family roster any more.",
  unknown_actor: "That name isn't on the family roster any more.",
  not_task_owner: "That chore isn't yours to check off.",
  unknown_task: "That chore isn't on the family's list any more.",
  "unknown-task": "That chore isn't on the family's list any more.",
  invalid_task_state: "That chore isn't in a state that allows that.",
  target_required: "Pick which family member that's for first.",
  incomplete_task_state: "That chore isn't in a state that allows that.",
  already_completed: "That one's already done.",
  already_claimed: "Somebody already claimed that one.",
  already_undone: "That one was already taken back.",
  nothing_to_undo: "There's nothing to take back on that one.",
  operation_conflict: "That change was already applied once.",
  semantic_duplicate: "That tap was already approved once.",
  ambiguous_task: "That chore matched more than one row on the family's list.",
  not_crew_task: "That chore isn't a crew chore.",
  invalid_crew_member: "That family member isn't on that crew.",
  member_checked_in: "That family member already did their part.",
  no_checkins: "Nobody's checked in on that crew yet.",
  crew_full: "That crew is full already.",
  crew_close_not_allowed: "Only a grown-up can close that crew.",
  member_roster_unavailable: "Consuela couldn't read the family list — try again in a moment.",
  task_store_unavailable: "Consuela couldn't read the chores — try again in a moment.",
  ledger_unavailable: "Consuela couldn't reach the points board — try again in a moment.",
  insufficient_balance: "There aren't enough points for that yet.",
  snapshot_write_failed: "Consuela couldn't save that yet — try again in a moment.",
  payload_too_large: "That was too big to send — try again.",
  forbidden_claim_payload: "That request didn't look right — try again.",
  unreachable: "Couldn't reach Consuela — check the connection and try again.",
};

export const TASK_REFUSAL_FALLBACK = "That didn't go through — try again.";

export function taskRefusalCopy(reason?: string): string {
  if (!reason) return TASK_REFUSAL_FALLBACK;
  return TASK_REFUSAL_COPY[reason] ?? TASK_REFUSAL_FALLBACK;
}

function reasonOf(res: TaskCommandResponse | null | undefined): string {
  if (!res) return "";
  if (typeof res.reason === "string" && res.reason) return res.reason;
  if (typeof res.error === "string" && res.error) return res.error;
  return "";
}

/** A resolved 2xx body that is neither a success nor a queued marker is a protocol anomaly — say so honestly, refresh nothing. */
function outcomeFromAnomalousBody(res: TaskCommandResponse | null | undefined, status: number): TaskCommandOutcome {
  return { kind: "refused", reason: reasonOf(res), status, wrongPin: false, refreshes: false };
}

function outcomeFromError(e: unknown): TaskCommandOutcome {
  if (e instanceof ApiError) {
    return {
      kind: "refused",
      reason: e.code,
      status: e.status,
      wrongPin: e.status === 401 && e.code === "unauthorized",
      // 404/409 mean the row provably moved on — pull the fresh snapshot.
      refreshes: e.status === 404 || e.status === 409,
    };
  }
  return { kind: "refused", reason: "unreachable", status: 0, wrongPin: false, refreshes: false };
}

function outcomeFromResponse(res: TaskCommandResponse | null | undefined): TaskCommandOutcome {
  if (!res) return outcomeFromAnomalousBody(null, 0);
  if (res.success === true) {
    if (res.reconciled === false) {
      return { kind: "sending" };
    }
    return { kind: "applied" };
  }
  if (res.queued === true) {
    // Durably queued server-side (202 + queued:true) — the drain owns the retry.
    return { kind: "sending" };
  }
  return outcomeFromAnomalousBody(res, 200);
}

/** POST /api/tasks/claim — {operationId, action, taskId, memberName?, pin?} exactly. */
export async function submitClaim(input: {
  action: ClaimAction;
  taskId: number;
  memberName?: string;
  pin?: string;
}): Promise<TaskCommandOutcome> {
  const body: Record<string, unknown> = {
    operationId: newOperationId(),
    action: input.action,
    taskId: input.taskId,
  };
  if (input.memberName !== undefined) body.memberName = input.memberName;
  if (input.pin !== undefined) body.pin = input.pin;
  try {
    const res = await api<TaskCommandResponse>("/api/tasks/claim", { method: "POST", body });
    return outcomeFromResponse(res);
  } catch (e) {
    return outcomeFromError(e);
  }
}

/** POST /api/tasks/approve — {operationId, action, taskId?/taskIds?, memberName, pin} (the PARENT's credentials). */
export async function submitApproval(input: {
  action: ApproveAction;
  taskId?: number;
  taskIds?: number[];
  memberName: string;
  pin: string;
}): Promise<TaskCommandOutcome> {
  const body: Record<string, unknown> = {
    operationId: newOperationId(),
    action: input.action,
    memberName: input.memberName,
    pin: input.pin,
  };
  if (input.taskId !== undefined) body.taskId = input.taskId;
  if (input.taskIds !== undefined) body.taskIds = input.taskIds;
  try {
    const res = await api<TaskCommandResponse>("/api/tasks/approve", { method: "POST", body });
    if (res && res.success === true) {
      if (res.reconciled === false) {
        // Applied, projection pending — carry the server's own honest notice
        // (e.g. "N approvals did not reach the kitchen display yet").
        return { kind: "sending", ...(typeof res.error === "string" && res.error ? { notice: res.error } : {}) };
      }
      return {
        kind: "applied",
        ...(typeof res.skipped === "number" && res.skipped > 0 ? { skipped: res.skipped } : {}),
      };
    }
    if (res && res.queued === true) return { kind: "sending" };
    return outcomeFromAnomalousBody(res, 200);
  } catch (e) {
    return outcomeFromError(e);
  }
}
