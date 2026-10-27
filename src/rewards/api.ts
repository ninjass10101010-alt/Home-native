import AsyncStorage from "@react-native-async-storage/async-storage";
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

export interface CustomRewardItem {
  id: string | number;
  name: string;
  emoji: string;
  cost: number;
  category?: string;
}

export interface RewardPass {
  id: string;
  rewardId: string | number;
  rewardName: string;
  emoji: string;
  cost: number;
  memberName: string;
  redeemedAt: string;
  used: boolean;
}

export interface LocalFamilyGoal {
  id: string;
  title: string;
  emoji: string;
  targetPoints: number;
}

const CUSTOM_REWARDS_KEY = "@consuela/rewards_custom_v1";
const REWARD_PASSES_KEY = "@consuela/rewards_passes_v1";
const FAMILY_GOALS_KEY = "@consuela/family_goals_v1";

export const REWARD_CATEGORIES = ["All", "⭐ Affordable", "Treats", "Screen Time", "Privileges", "Activities"] as const;

export const CURATED_REWARD_TEMPLATES: CustomRewardItem[] = [
  { id: "tpl-1", name: "Ice Cream Trip", emoji: "🍦", cost: 50, category: "Treats" },
  { id: "tpl-2", name: "30m Bonus Gaming", emoji: "🎮", cost: 60, category: "Screen Time" },
  { id: "tpl-3", name: "Pick Friday Movie", emoji: "🎬", cost: 80, category: "Privileges" },
  { id: "tpl-4", name: "Stay Up 30m Late", emoji: "🌙", cost: 100, category: "Privileges" },
  { id: "tpl-5", name: "Choose Family Dinner", emoji: "🍕", cost: 120, category: "Treats" },
  { id: "tpl-6", name: "Skip 1 Chore Pass", emoji: "🛡️", cost: 150, category: "Privileges" },
  { id: "tpl-7", name: "Arcade / Bowling Outing", emoji: "🕹️", cost: 250, category: "Activities" },
];

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

export async function loadCustomRewards(): Promise<CustomRewardItem[]> {
  try {
    const raw = await AsyncStorage.getItem(CUSTOM_REWARDS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

export async function saveCustomRewards(items: CustomRewardItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CUSTOM_REWARDS_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

export async function loadRewardPasses(): Promise<RewardPass[]> {
  try {
    const raw = await AsyncStorage.getItem(REWARD_PASSES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

export async function saveRewardPasses(passes: RewardPass[]): Promise<void> {
  try {
    await AsyncStorage.setItem(REWARD_PASSES_KEY, JSON.stringify(passes));
  } catch {
    // ignore
  }
}

export async function loadLocalFamilyGoals(): Promise<LocalFamilyGoal[]> {
  try {
    const raw = await AsyncStorage.getItem(FAMILY_GOALS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

export async function saveLocalFamilyGoals(goals: LocalFamilyGoal[]): Promise<void> {
  try {
    await AsyncStorage.setItem(FAMILY_GOALS_KEY, JSON.stringify(goals));
  } catch {
    // ignore
  }
}
