import { api, ApiError } from "../api/client";
import { newOperationId } from "../tasks/claim";
import type { DbListEnvelope } from "../api/types";

export { ApiError };

export interface RedeemRewardInput {
  rewardId: string | number;
  rewardName?: string | null;
  memberName: string;
  pin: string;
  parentName?: string;
  parentPin?: string;
}

export async function redeemReward(input: RedeemRewardInput): Promise<unknown> {
  return api("/api/rewards/redeem", {
    method: "POST",
    body: {
      operationId: newOperationId(),
      rewardId: input.rewardId,
      rewardName: input.rewardName ?? null,
      memberName: input.memberName,
      pin: input.pin,
      ...(input.parentName ? { parentName: input.parentName } : {}),
      ...(input.parentPin ? { parentPin: input.parentPin } : {}),
    },
  });
}

export async function fetchAllTimeTotals(): Promise<{
  historyComplete?: boolean;
  points?: Record<string, number> | null;
  totals?: Record<string, { points?: number | null } | number>;
} | null> {
  try {
    return await api("/api/tasks/all-time");
  } catch {
    return null;
  }
}

export async function fetchDbCollection(collection: string): Promise<any[]> {
  try {
    const res = await api<DbListEnvelope<any>>(`/api/db/${collection}`);
    return Array.isArray(res?.items) ? res.items : [];
  } catch {
    return [];
  }
}

export async function celebrateHallOfFame(input: {
  id?: string | number;
  memberName?: string;
  weekStart?: string;
}): Promise<unknown> {
  return api("/api/hall-of-fame/celebrate", {
    method: "POST",
    body: {
      ...(input.id !== undefined ? { id: input.id } : {}),
      ...(input.memberName ? { memberName: input.memberName } : {}),
      ...(input.weekStart ? { weekStart: input.weekStart } : {}),
    },
  });
}
