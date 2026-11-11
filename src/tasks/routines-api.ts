import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../api/client";

export type RoutineSlot = "morning" | "afternoon" | "evening" | "weekend";

export type RoutineDayCode = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";

export const ALL_ROUTINE_DAYS: readonly RoutineDayCode[] = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
] as const;

export const WEEKDAY_ROUTINE_DAYS: readonly RoutineDayCode[] = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
] as const;

export const WEEKEND_ROUTINE_DAYS: readonly RoutineDayCode[] = [
  "sat",
  "sun",
] as const;

export const ROUTINE_DAY_META: Record<
  RoutineDayCode,
  { short: string; label: string; initial: string }
> = {
  sun: { short: "Sun", label: "Sunday", initial: "S" },
  mon: { short: "Mon", label: "Monday", initial: "M" },
  tue: { short: "Tue", label: "Tuesday", initial: "T" },
  wed: { short: "Wed", label: "Wednesday", initial: "W" },
  thu: { short: "Thu", label: "Thursday", initial: "T" },
  fri: { short: "Fri", label: "Friday", initial: "F" },
  sat: { short: "Sat", label: "Saturday", initial: "S" },
};

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
  assignee: string;
  assignees?: string[];
  daysOfWeek?: RoutineDayCode[];
  points: number;
  missedPenalty?: number;
  requiresApproval?: boolean;
  active?: boolean;
  createdAt?: string;
  steps: RoutineStep[];
}

export interface RoutineSettings {
  defaultPoints: number;
  defaultMissedPenalty: number;
  accountabilityEnabled: boolean;
  parentCountsTowardRace: boolean;
  defaultRequiresApproval: boolean;
  streakBonusEveryDays: number;
  streakBonusPoints: number;
}

export const DEFAULT_ROUTINE_SETTINGS: RoutineSettings = {
  defaultPoints: 15,
  defaultMissedPenalty: 5,
  accountabilityEnabled: true,
  parentCountsTowardRace: true,
  defaultRequiresApproval: false,
  streakBonusEveryDays: 7,
  streakBonusPoints: 10,
};

export interface RoutineCompletionMeta {
  status: "completed" | "pending_approval" | "approved";
  at: string;
  by: string;
  pointsAwarded: number;
  countedTowardRace: boolean;
  operationId?: string;
  approvedBy?: string;
  approvedAt?: string;
  streakAtCompletion?: number;
  streakBonusAwarded?: number;
}

export interface DailyRoutineProgress {
  date?: string;
  memberCheckedSteps?: Record<string, string[]>;
  memberCompleted?: Record<string, RoutineCompletionMeta>;
  checkedSteps: Record<string, string[]>;
  completedRoutines: Record<string, boolean>;
}

export interface RoutineMissedEntry {
  id: string;
  date: string;
  routineId: string;
  routineTitle: string;
  routineEmoji: string;
  memberName: string;
  memberKey: string;
  penaltyPoints: number;
  deductedPoints: number;
  countedTowardRace: boolean;
  excused: boolean;
  excusedBy?: string;
  excusedAt?: string;
  refundedPoints?: number;
  detectedAt: string;
  operationId?: string;
  excuseOperationId?: string;
}

export interface RoutineStreakStats {
  current: number;
  longest: number;
  lastCompletedDay?: string;
}

export interface RoutineAccountabilityState {
  lastSweptDay: string;
  missedEntries: RoutineMissedEntry[];
  streaks: Record<string, RoutineStreakStats>;
}

export const DEFAULT_ACCOUNTABILITY_STATE: RoutineAccountabilityState = {
  lastSweptDay: "",
  missedEntries: [],
  streaks: {},
};

const ROUTINES_KEY = "@consuela/routines_v1";
const ROUTINE_PROGRESS_PREFIX = "@consuela/routine_progress_v1:";
const ROUTINE_SETTINGS_KEY = "@consuela/routine_settings_v1";
const ROUTINE_ACCOUNTABILITY_KEY = "@consuela/routine_accountability_v1";

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
    daysOfWeek: ["sun", "mon", "tue", "wed", "thu", "fri", "sat"],
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
    daysOfWeek: ["mon", "tue", "wed", "thu", "fri"],
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
    daysOfWeek: ["sun", "mon", "tue", "wed", "thu", "fri", "sat"],
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
    daysOfWeek: ["sat", "sun"],
    points: 30,
    steps: [
      { id: "s1", title: "Bring laundry hamper down", emoji: "🧺" },
      { id: "s2", title: "Water indoor plants", emoji: "🪴" },
      { id: "s3", title: "Brush pet & refill bowls", emoji: "🐕" },
      { id: "s4", title: "Wipe down desk & dresser", emoji: "✨" },
    ],
  },
];

function emptyProgress(date?: string): DailyRoutineProgress {
  return {
    ...(date ? { date } : {}),
    checkedSteps: {},
    completedRoutines: {},
    memberCheckedSteps: {},
    memberCompleted: {},
  };
}

function normalizeProgress(raw: unknown, date?: string): DailyRoutineProgress {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return emptyProgress(date);
  }
  const r = raw as Record<string, unknown>;
  const normalizeSteps = (input: unknown): Record<string, string[]> => {
    if (!input || typeof input !== "object" || Array.isArray(input)) return {};
    const out: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (Array.isArray(v)) out[k] = v.map((s) => String(s));
    }
    return out;
  };
  return {
    ...(date ? { date } : typeof r.date === "string" ? { date: r.date } : {}),
    checkedSteps: normalizeSteps(r.checkedSteps),
    completedRoutines:
      r.completedRoutines && typeof r.completedRoutines === "object"
        ? (r.completedRoutines as Record<string, boolean>)
        : {},
    memberCheckedSteps: normalizeSteps(r.memberCheckedSteps),
    memberCompleted:
      r.memberCompleted && typeof r.memberCompleted === "object"
        ? (r.memberCompleted as Record<string, RoutineCompletionMeta>)
        : {},
  };
}

export async function loadRoutines(): Promise<FamilyRoutine[]> {
  let local: FamilyRoutine[] | null = null;
  try {
    const raw = await AsyncStorage.getItem(ROUTINES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) local = parsed as FamilyRoutine[];
    }
  } catch {
    // ignore local read error
  }

  try {
    const res = await api<{ routines?: FamilyRoutine[]; settings?: RoutineSettings; accountability?: RoutineAccountabilityState }>("/api/routines", {
      timeoutMs: 4000,
    });
    if (res?.settings) {
      await AsyncStorage.setItem(ROUTINE_SETTINGS_KEY, JSON.stringify(res.settings)).catch(() => {});
    }
    if (res?.accountability) {
      await AsyncStorage.setItem(ROUTINE_ACCOUNTABILITY_KEY, JSON.stringify(res.accountability)).catch(() => {});
    }
    if (Array.isArray(res?.routines)) {
      await AsyncStorage.setItem(ROUTINES_KEY, JSON.stringify(res.routines)).catch(() => {});
      return res.routines;
    }
  } catch {
    // offline or backend unavailable
  }

  return local && local.length > 0 ? local : DEFAULT_ROUTINES;
}

export async function saveRoutines(routines: FamilyRoutine[], pin?: string): Promise<void> {
  await AsyncStorage.setItem(ROUTINES_KEY, JSON.stringify(routines)).catch(() => {});
  try {
    const headers: Record<string, string> = pin ? { "x-admin-pin": pin } : {};
    await api("/api/routines", {
      method: "PUT",
      ...(Object.keys(headers).length > 0 ? { headers } : {}),
      body: { routines },
      timeoutMs: 5000,
    });
  } catch {
    // quiet local-first fallback (preserved for backward-compat with existing callers/tests)
  }
}

export async function loadRoutineProgress(dateISO: string): Promise<DailyRoutineProgress> {
  const key = `${ROUTINE_PROGRESS_PREFIX}${dateISO}`;
  let local: DailyRoutineProgress = emptyProgress(dateISO);
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw) {
      local = normalizeProgress(JSON.parse(raw), dateISO);
    }
  } catch {
    // ignore
  }

  try {
    const res = await api<{
      progress?: DailyRoutineProgress;
      settings?: RoutineSettings;
      accountability?: RoutineAccountabilityState;
    }>(`/api/routines/progress?date=${encodeURIComponent(dateISO)}`, { timeoutMs: 4000 });
    if (res?.settings) {
      await AsyncStorage.setItem(ROUTINE_SETTINGS_KEY, JSON.stringify(res.settings)).catch(() => {});
    }
    if (res?.accountability) {
      await AsyncStorage.setItem(ROUTINE_ACCOUNTABILITY_KEY, JSON.stringify(res.accountability)).catch(() => {});
    }
    if (res?.progress) {
      const serverProg = normalizeProgress(res.progress, dateISO);
      const mergedMemberChecked: Record<string, string[]> = { ...local.memberCheckedSteps };
      for (const [k, v] of Object.entries(serverProg.memberCheckedSteps ?? {})) {
        mergedMemberChecked[k] = Array.from(new Set([...(mergedMemberChecked[k] ?? []), ...v]));
      }
      const mergedChecked: Record<string, string[]> = { ...local.checkedSteps };
      for (const [k, v] of Object.entries(serverProg.checkedSteps ?? {})) {
        mergedChecked[k] = Array.from(new Set([...(mergedChecked[k] ?? []), ...v]));
      }
      const merged: DailyRoutineProgress = {
        date: dateISO,
        checkedSteps: mergedChecked,
        completedRoutines: { ...local.completedRoutines, ...serverProg.completedRoutines },
        memberCheckedSteps: mergedMemberChecked,
        memberCompleted: { ...local.memberCompleted, ...serverProg.memberCompleted },
      };
      await AsyncStorage.setItem(key, JSON.stringify(merged)).catch(() => {});
      return merged;
    }
  } catch {
    // offline fallback
  }

  return local;
}

export async function saveRoutineProgress(
  dateISO: string,
  progress: DailyRoutineProgress,
): Promise<void> {
  const key = `${ROUTINE_PROGRESS_PREFIX}${dateISO}`;
  await AsyncStorage.setItem(key, JSON.stringify(progress)).catch(() => {});
  try {
    await api("/api/routines/progress", {
      method: "PUT",
      body: { date: dateISO, progress },
      timeoutMs: 5000,
    });
  } catch {
    // best-effort sync
  }
}

export interface RoutinesBundle {
  routines: FamilyRoutine[];
  settings: RoutineSettings;
  accountability: RoutineAccountabilityState;
  progress: DailyRoutineProgress;
  todayISO: string;
  offline: boolean;
}

export async function loadCachedRoutinesBundle(dateISO: string): Promise<Omit<RoutinesBundle, "offline">> {
  let routines: FamilyRoutine[] = DEFAULT_ROUTINES;
  let settings: RoutineSettings = DEFAULT_ROUTINE_SETTINGS;
  let accountability: RoutineAccountabilityState = DEFAULT_ACCOUNTABILITY_STATE;
  let progress: DailyRoutineProgress = emptyProgress(dateISO);

  try {
    const [rRaw, sRaw, aRaw, pRaw] = await Promise.all([
      AsyncStorage.getItem(ROUTINES_KEY),
      AsyncStorage.getItem(ROUTINE_SETTINGS_KEY),
      AsyncStorage.getItem(ROUTINE_ACCOUNTABILITY_KEY),
      AsyncStorage.getItem(`${ROUTINE_PROGRESS_PREFIX}${dateISO}`),
    ]);
    if (rRaw) {
      const parsed = JSON.parse(rRaw);
      if (Array.isArray(parsed) && parsed.length > 0) routines = parsed;
    }
    if (sRaw) {
      const parsed = JSON.parse(sRaw);
      if (parsed && typeof parsed === "object") {
        settings = { ...DEFAULT_ROUTINE_SETTINGS, ...parsed };
      }
    }
    if (aRaw) {
      const parsed = JSON.parse(aRaw);
      if (parsed && typeof parsed === "object") {
        accountability = {
          lastSweptDay: typeof parsed.lastSweptDay === "string" ? parsed.lastSweptDay : "",
          missedEntries: Array.isArray(parsed.missedEntries) ? parsed.missedEntries : [],
          streaks:
            parsed.streaks && typeof parsed.streaks === "object" ? parsed.streaks : {},
        };
      }
    }
    if (pRaw) {
      progress = normalizeProgress(JSON.parse(pRaw), dateISO);
    }
  } catch {
    // ignore storage errors
  }

  return { routines, settings, accountability, progress, todayISO: dateISO };
}

export async function loadRoutinesBundle(dateISO: string): Promise<RoutinesBundle> {
  const cached = await loadCachedRoutinesBundle(dateISO);
  try {
    const [listRes, progRes] = await Promise.all([
      api<{
        routines?: FamilyRoutine[];
        settings?: RoutineSettings;
        accountability?: RoutineAccountabilityState;
      }>("/api/routines", { timeoutMs: 4500 }),
      api<{
        todayISO?: string;
        progress?: DailyRoutineProgress;
        settings?: RoutineSettings;
        accountability?: RoutineAccountabilityState;
      }>(`/api/routines/progress?date=${encodeURIComponent(dateISO)}`, { timeoutMs: 4500 }),
    ]);

    const routines = Array.isArray(listRes?.routines) ? listRes.routines : cached.routines;
    const settings = progRes?.settings ?? listRes?.settings ?? cached.settings;
    const accountability =
      progRes?.accountability ?? listRes?.accountability ?? cached.accountability;
    const effectiveToday = progRes?.todayISO || dateISO;
    const progress = normalizeProgress(progRes?.progress, effectiveToday);

    await Promise.all([
      AsyncStorage.setItem(ROUTINES_KEY, JSON.stringify(routines)),
      AsyncStorage.setItem(ROUTINE_SETTINGS_KEY, JSON.stringify(settings)),
      AsyncStorage.setItem(ROUTINE_ACCOUNTABILITY_KEY, JSON.stringify(accountability)),
      AsyncStorage.setItem(`${ROUTINE_PROGRESS_PREFIX}${dateISO}`, JSON.stringify(progress)),
    ]).catch(() => {});

    return {
      routines,
      settings,
      accountability,
      progress,
      todayISO: effectiveToday,
      offline: false,
    };
  } catch {
    return {
      ...cached,
      offline: true,
    };
  }
}

export type RoutineManagementAction =
  | { action: "upsert_routine"; routine: FamilyRoutine; pin?: string }
  | { action: "delete_routine"; routineId: string; pin?: string }
  | { action: "update_settings"; settings: RoutineSettings; pin?: string };

export async function postRoutineAction(payload: RoutineManagementAction): Promise<{
  routines: FamilyRoutine[];
  settings: RoutineSettings;
  accountability: RoutineAccountabilityState;
}> {
  const { pin, ...body } = payload;
  const headers: Record<string, string> = pin ? { "x-admin-pin": pin } : {};
  const res = await api<{
    ok?: boolean;
    routines?: FamilyRoutine[];
    settings?: RoutineSettings;
    accountability?: RoutineAccountabilityState;
  }>("/api/routines", {
    method: "POST",
    ...(Object.keys(headers).length > 0 ? { headers } : {}),
    body,
    timeoutMs: 6000,
  });

  const cached = await loadCachedRoutinesBundle(new Date().toISOString().slice(0, 10));
  let routines = cached.routines;
  if (Array.isArray(res?.routines)) {
    routines = res.routines;
  } else if (payload.action === "upsert_routine") {
    const exists = routines.some((r) => r.id === payload.routine.id);
    routines = exists
      ? routines.map((r) => (r.id === payload.routine.id ? payload.routine : r))
      : [...routines, payload.routine];
  } else if (payload.action === "delete_routine") {
    routines = routines.filter((r) => r.id !== payload.routineId);
  }

  const settings =
    res?.settings && typeof res.settings === "object"
      ? { ...DEFAULT_ROUTINE_SETTINGS, ...res.settings }
      : payload.action === "update_settings"
        ? payload.settings
        : cached.settings;

  const accountability =
    res?.accountability && typeof res.accountability === "object"
      ? res.accountability
      : cached.accountability;

  await Promise.all([
    AsyncStorage.setItem(ROUTINES_KEY, JSON.stringify(routines)),
    AsyncStorage.setItem(ROUTINE_SETTINGS_KEY, JSON.stringify(settings)),
    AsyncStorage.setItem(ROUTINE_ACCOUNTABILITY_KEY, JSON.stringify(accountability)),
  ]).catch(() => {});

  return { routines, settings, accountability };
}

export type RoutineProgressAction =
  | {
      action: "toggle_step";
      date?: string;
      routineId: string;
      stepId: string;
      memberName: string;
    }
  | {
      action: "complete_routine";
      date?: string;
      routineId: string;
      memberName: string;
    }
  | {
      action: "uncomplete_routine";
      date?: string;
      routineId: string;
      memberName: string;
    }
  | {
      action: "approve_routine";
      date?: string;
      routineId: string;
      memberName: string;
      pin?: string;
    }
  | {
      action: "send_back_routine";
      date?: string;
      routineId: string;
      memberName: string;
      pin?: string;
    }
  | {
      action: "excuse_missed";
      entryId: string;
      pin?: string;
    };

export interface RoutineProgressActionResult {
  date: string;
  progress: DailyRoutineProgress;
  accountability: RoutineAccountabilityState;
  pointsDelta?: number;
  completion?: RoutineCompletionMeta;
}

export async function postRoutineProgressAction(
  payload: RoutineProgressAction,
): Promise<RoutineProgressActionResult> {
  const pin = "pin" in payload ? payload.pin : undefined;
  const body = { ...payload };
  if ("pin" in body) delete (body as { pin?: string }).pin;
  const headers: Record<string, string> = pin ? { "x-admin-pin": pin } : {};

  const res = await api<Partial<RoutineProgressActionResult> & { ok?: boolean }>(
    "/api/routines/progress",
    {
      method: "POST",
      ...(Object.keys(headers).length > 0 ? { headers } : {}),
      body,
      timeoutMs: 6000,
    },
  );

  const effectiveDate =
    res?.date || ("date" in payload && payload.date ? payload.date : new Date().toISOString().slice(0, 10));
  const cached = await loadCachedRoutinesBundle(effectiveDate);

  let normalizedProg: DailyRoutineProgress;
  if (res?.progress && typeof res.progress === "object") {
    normalizedProg = normalizeProgress(res.progress, effectiveDate);
  } else {
    normalizedProg = normalizeProgress(cached.progress, effectiveDate);
    if (payload.action === "toggle_step") {
      const mKey = `${payload.routineId}::${payload.memberName.trim().toLowerCase()}`;
      const existing = normalizedProg.memberCheckedSteps?.[mKey] ?? [];
      const nextSteps = existing.includes(payload.stepId)
        ? existing.filter((s) => s !== payload.stepId)
        : [...existing, payload.stepId];
      normalizedProg = {
        ...normalizedProg,
        checkedSteps: { ...normalizedProg.checkedSteps, [payload.routineId]: nextSteps },
        memberCheckedSteps: { ...normalizedProg.memberCheckedSteps, [mKey]: nextSteps },
      };
    } else if (payload.action === "complete_routine") {
      const mKey = `${payload.routineId}::${payload.memberName.trim().toLowerCase()}`;
      const rt = cached.routines.find((r) => r.id === payload.routineId);
      const stepIds = rt ? rt.steps.map((s) => s.id) : [];
      normalizedProg = {
        ...normalizedProg,
        checkedSteps: { ...normalizedProg.checkedSteps, [payload.routineId]: stepIds },
        completedRoutines: { ...normalizedProg.completedRoutines, [payload.routineId]: true },
        memberCheckedSteps: { ...normalizedProg.memberCheckedSteps, [mKey]: stepIds },
        memberCompleted: {
          ...normalizedProg.memberCompleted,
          [mKey]: {
            status: "completed",
            at: new Date().toISOString(),
            by: payload.memberName,
            pointsAwarded: rt?.points ?? 0,
            countedTowardRace: true,
          },
        },
      };
    } else if (payload.action === "uncomplete_routine") {
      const mKey = `${payload.routineId}::${payload.memberName.trim().toLowerCase()}`;
      const nextMemberComp = { ...normalizedProg.memberCompleted };
      delete nextMemberComp[mKey];
      const nextLegacyComp = { ...normalizedProg.completedRoutines };
      delete nextLegacyComp[payload.routineId];
      normalizedProg = {
        ...normalizedProg,
        checkedSteps: { ...normalizedProg.checkedSteps, [payload.routineId]: [] },
        completedRoutines: nextLegacyComp,
        memberCheckedSteps: { ...normalizedProg.memberCheckedSteps, [mKey]: [] },
        memberCompleted: nextMemberComp,
      };
    }
  }

  const accountability =
    res?.accountability && typeof res.accountability === "object"
      ? res.accountability
      : cached.accountability;

  await Promise.all([
    AsyncStorage.setItem(
      `${ROUTINE_PROGRESS_PREFIX}${effectiveDate}`,
      JSON.stringify(normalizedProg),
    ),
    AsyncStorage.setItem(
      ROUTINE_ACCOUNTABILITY_KEY,
      JSON.stringify(accountability),
    ),
  ]).catch(() => {});

  return {
    date: effectiveDate,
    progress: normalizedProg,
    accountability,
    pointsDelta: res?.pointsDelta,
    completion: res?.completion,
  };
}
