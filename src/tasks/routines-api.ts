import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../api/client";

export type RoutineSlot = "morning" | "afternoon" | "evening" | "weekend";

export interface RoutineStep {
  id: string;
  title: string;
  emoji: string;
}

export interface FamilyRoutine {
  id: string;
  title: string;
  emoji: string;
  slot: RoutineSlot;
  time: string;
  assignee: string; // "All" or member name
  points: number;
  steps: RoutineStep[];
}

export interface DailyRoutineProgress {
  checkedSteps: Record<string, string[]>; // routineId -> stepIds[]
  completedRoutines: Record<string, boolean>; // routineId -> true
}

const ROUTINES_STORAGE_KEY = "@consuela/routines_v1";
const ROUTINE_PROGRESS_PREFIX = "@consuela/routine_progress_v1:";

export const ROUTINE_SLOT_META: Record<
  RoutineSlot,
  { label: string; emoji: string; timeDefault: string; toneKey: string }
> = {
  morning: { label: "Morning", emoji: "☀️", timeDefault: "07:15", toneKey: "color-accent-amber" },
  afternoon: { label: "After School", emoji: "🎒", timeDefault: "15:30", toneKey: "color-accent-cyan" },
  evening: { label: "Bedtime", emoji: "🌙", timeDefault: "20:00", toneKey: "color-accent-violet" },
  weekend: { label: "Weekend", emoji: "🧹", timeDefault: "10:00", toneKey: "color-accent-mint" },
};

export const DEFAULT_ROUTINES: FamilyRoutine[] = [
  {
    id: "rt-morning",
    title: "Morning Launchpad",
    emoji: "☀️",
    slot: "morning",
    time: "07:15",
    assignee: "All",
    points: 15,
    steps: [
      { id: "s1", title: "Brush teeth & wash face", emoji: "🪥" },
      { id: "s2", title: "Make bed neatly", emoji: "🛏️" },
      { id: "s3", title: "Get dressed for the day", emoji: "👕" },
      { id: "s4", title: "Pack backpack & water bottle", emoji: "🎒" },
    ],
  },
  {
    id: "rt-afternoon",
    title: "After-School Reset",
    emoji: "🎒",
    slot: "afternoon",
    time: "15:30",
    assignee: "All",
    points: 20,
    steps: [
      { id: "s1", title: "Shoes & coat on hooks", emoji: "👟" },
      { id: "s2", title: "Empty lunchbox into sink", emoji: "🍱" },
      { id: "s3", title: "20 mins homework or reading", emoji: "📚" },
      { id: "s4", title: "Healthy afternoon snack", emoji: "🍎" },
    ],
  },
  {
    id: "rt-evening",
    title: "Evening Wind-Down",
    emoji: "🌙",
    slot: "evening",
    time: "20:00",
    assignee: "All",
    points: 15,
    steps: [
      { id: "s1", title: "10-minute room tidy", emoji: "🧸" },
      { id: "s2", title: "Shower & pajamas on", emoji: "🚿" },
      { id: "s3", title: "Lay out tomorrow's clothes", emoji: "👕" },
      { id: "s4", title: "Read in bed (screens off)", emoji: "📖" },
    ],
  },
  {
    id: "rt-weekend",
    title: "Saturday Power Hour",
    emoji: "🧹",
    slot: "weekend",
    time: "10:00",
    assignee: "All",
    points: 30,
    steps: [
      { id: "s1", title: "Bring laundry hamper down", emoji: "🧺" },
      { id: "s2", title: "Water indoor plants", emoji: "🪴" },
      { id: "s3", title: "Brush pet & refill bowls", emoji: "🐕" },
      { id: "s4", title: "Wipe down desk & dresser", emoji: "✨" },
    ],
  },
];

export async function loadRoutines(): Promise<FamilyRoutine[]> {
  let local: FamilyRoutine[] | null = null;
  try {
    const raw = await AsyncStorage.getItem(ROUTINES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        local = parsed;
      }
    }
  } catch {
    // ignore storage errors
  }

  try {
    const res = await api<{ ok?: boolean; routines?: FamilyRoutine[] }>("/api/routines", {
      timeoutMs: 4000,
    });
    if (res?.ok && Array.isArray(res.routines) && res.routines.length > 0) {
      void AsyncStorage.setItem(ROUTINES_STORAGE_KEY, JSON.stringify(res.routines)).catch(() => {});
      return res.routines;
    }
  } catch {
    // server optional / unreachable; fallback to local or defaults
  }

  return local ?? DEFAULT_ROUTINES;
}

export async function saveRoutines(routines: FamilyRoutine[]): Promise<void> {
  try {
    await AsyncStorage.setItem(ROUTINES_STORAGE_KEY, JSON.stringify(routines));
  } catch {
    // ignore
  }

  try {
    await api("/api/routines", {
      method: "PUT",
      body: { routines },
      timeoutMs: 5000,
    });
  } catch {
    // best-effort remote sync
  }
}

export async function loadRoutineProgress(dateISO: string): Promise<DailyRoutineProgress> {
  let localProgress: DailyRoutineProgress = { checkedSteps: {}, completedRoutines: {} };
  try {
    const raw = await AsyncStorage.getItem(`${ROUTINE_PROGRESS_PREFIX}${dateISO}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        localProgress = {
          checkedSteps: parsed.checkedSteps ?? {},
          completedRoutines: parsed.completedRoutines ?? {},
        };
      }
    }
  } catch {
    // ignore
  }

  try {
    const res = await api<{ ok?: boolean; progress?: DailyRoutineProgress }>(
      `/api/routines/progress?date=${encodeURIComponent(dateISO)}`,
      { timeoutMs: 4000 },
    );
    if (res?.ok && res.progress) {
      const serverChecked = res.progress.checkedSteps || {};
      const serverCompleted = res.progress.completedRoutines || {};
      const mergedChecked: Record<string, string[]> = { ...serverChecked };
      for (const [rId, steps] of Object.entries(localProgress.checkedSteps)) {
        const set = new Set([...(mergedChecked[rId] || []), ...steps]);
        mergedChecked[rId] = Array.from(set);
      }
      const mergedCompleted: Record<string, boolean> = {
        ...serverCompleted,
        ...localProgress.completedRoutines,
      };
      const merged: DailyRoutineProgress = {
        checkedSteps: mergedChecked,
        completedRoutines: mergedCompleted,
      };
      void AsyncStorage.setItem(`${ROUTINE_PROGRESS_PREFIX}${dateISO}`, JSON.stringify(merged)).catch(() => {});
      return merged;
    }
  } catch {
    // server unreachable; return local
  }

  return localProgress;
}

export async function saveRoutineProgress(
  dateISO: string,
  progress: DailyRoutineProgress,
): Promise<void> {
  try {
    await AsyncStorage.setItem(`${ROUTINE_PROGRESS_PREFIX}${dateISO}`, JSON.stringify(progress));
  } catch {
    // ignore
  }

  try {
    await api("/api/routines/progress", {
      method: "PUT",
      body: { date: dateISO, progress },
      timeoutMs: 5000,
    });
  } catch {
    // best-effort remote sync
  }
}
