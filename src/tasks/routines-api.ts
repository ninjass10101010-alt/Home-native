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
    const res = await api<any>("/api/schedules");
    const serverRows = Array.isArray(res?.schedules)
      ? res.schedules
      : Array.isArray(res)
        ? res
        : [];
    if (serverRows.length > 0 && !local) {
      const mapped: FamilyRoutine[] = serverRows.map((r: any, idx: number) => ({
        id: String(r.id ?? `srv-${idx}`),
        title: String(r.title || r.name || "Routine"),
        emoji: typeof r.emoji === "string" && r.emoji.trim() ? r.emoji : "⏰",
        slot:
          r.slot === "morning" || r.slot === "afternoon" || r.slot === "evening" || r.slot === "weekend"
            ? r.slot
            : "morning",
        time: typeof r.time === "string" && r.time ? r.time : "08:00",
        assignee: typeof r.assignee === "string" && r.assignee ? r.assignee : "All",
        points: Number(r.points) || 15,
        steps: Array.isArray(r.steps) && r.steps.length > 0
          ? r.steps.map((s: any, sIdx: number) => ({
              id: String(s.id ?? `step-${sIdx}`),
              title: String(typeof s === "string" ? s : s.title || "Step"),
              emoji: typeof s?.emoji === "string" ? s.emoji : "✓",
            }))
          : DEFAULT_ROUTINES[0].steps,
      }));
      return mapped;
    }
  } catch {
    // server optional; fallback to local or defaults
  }

  return local ?? DEFAULT_ROUTINES;
}

export async function saveRoutines(routines: FamilyRoutine[]): Promise<void> {
  try {
    await AsyncStorage.setItem(ROUTINES_STORAGE_KEY, JSON.stringify(routines));
  } catch {
    // ignore
  }
}

export async function loadRoutineProgress(dateISO: string): Promise<DailyRoutineProgress> {
  try {
    const raw = await AsyncStorage.getItem(`${ROUTINE_PROGRESS_PREFIX}${dateISO}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return {
          checkedSteps: parsed.checkedSteps ?? {},
          completedRoutines: parsed.completedRoutines ?? {},
        };
      }
    }
  } catch {
    // ignore
  }
  return { checkedSteps: {}, completedRoutines: {} };
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
}
