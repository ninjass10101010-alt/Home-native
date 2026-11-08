import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

export type CountdownTone = "amber" | "mint" | "cyan" | "lavender" | "coral";

export interface CountdownEvent {
  id: string;
  title: string;
  targetDate: string; // YYYY-MM-DD
  emoji: string;
  tone: CountdownTone;
  createdAt: string;
}

export interface CountdownPreset {
  title: string;
  emoji: string;
  tone: CountdownTone;
  daysOut: number;
}

export const COUNTDOWN_PRESETS: readonly CountdownPreset[] = [
  { title: "Family Vacation", emoji: "🏰", tone: "cyan", daysOut: 14 },
  { title: "Birthday Party", emoji: "🎂", tone: "coral", daysOut: 7 },
  { title: "Summer Break", emoji: "🏖️", tone: "amber", daysOut: 30 },
  { title: "Grandma Visits", emoji: "👵", tone: "lavender", daysOut: 5 },
  { title: "Holiday Gathering", emoji: "🎄", tone: "mint", daysOut: 21 },
] as const;

export interface CountdownDaysResult {
  daysLeft: number;
  badgeLabel: string;
  status: "today" | "tomorrow" | "upcoming" | "past";
}

/**
 * Computes difference in calendar days between targetDateISO and now (local midnight comparison).
 */
export function computeCountdownDays(
  targetDateISO: string,
  now: Date = new Date()
): CountdownDaysResult {
  const [y, m, d] = targetDateISO.split("-").map(Number);
  const target = new Date(y, m - 1, d, 0, 0, 0, 0);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  const diffMs = target.getTime() - today.getTime();
  const daysLeft = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (Number.isNaN(daysLeft)) {
    return { daysLeft: 0, badgeLabel: "Upcoming", status: "upcoming" };
  }

  if (daysLeft === 0) {
    return { daysLeft: 0, badgeLabel: "Today! 🎉", status: "today" };
  }
  if (daysLeft === 1) {
    return { daysLeft: 1, badgeLabel: "Tomorrow! ✨", status: "tomorrow" };
  }
  if (daysLeft > 1) {
    return { daysLeft, badgeLabel: `${daysLeft} days`, status: "upcoming" };
  }
  return { daysLeft, badgeLabel: `${Math.abs(daysLeft)}d ago`, status: "past" };
}

export const COUNTDOWNS_STORAGE_KEY = "consuela-calendar-countdowns";

let memoryCachedCountdowns: CountdownEvent[] = [];
let isHydrated = false;
const listeners = new Set<(countdowns: CountdownEvent[]) => void>();

function notifyListeners(countdowns: CountdownEvent[]): void {
  memoryCachedCountdowns = countdowns;
  for (const listener of [...listeners]) {
    try {
      listener(countdowns);
    } catch {
      // ignore listener errors
    }
  }
}

/**
 * Loads countdown events from AsyncStorage or returns in-memory cache.
 */
export async function loadCountdowns(): Promise<CountdownEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(COUNTDOWNS_STORAGE_KEY);
    if (!raw) {
      memoryCachedCountdowns = [];
      isHydrated = true;
      return [];
    }
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? (parsed as CountdownEvent[]) : [];
    memoryCachedCountdowns = list;
    isHydrated = true;
    return list;
  } catch {
    memoryCachedCountdowns = [];
    isHydrated = true;
    return [];
  }
}

/**
 * Saves countdown events to AsyncStorage and updates in-memory cache + listeners.
 */
export async function saveCountdowns(countdowns: CountdownEvent[]): Promise<void> {
  notifyListeners(countdowns);
  try {
    await AsyncStorage.setItem(COUNTDOWNS_STORAGE_KEY, JSON.stringify(countdowns));
  } catch {
    // ignore storage write errors
  }
}

/**
 * Adds a new countdown event, persists it, and notifies subscribers.
 */
export async function addCountdown(
  event: Omit<CountdownEvent, "id" | "createdAt"> & { id?: string; createdAt?: string }
): Promise<CountdownEvent> {
  const current = await loadCountdowns();
  const newEvent: CountdownEvent = {
    id: event.id || `cd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: event.title.trim(),
    targetDate: event.targetDate,
    emoji: event.emoji || "⏳",
    tone: event.tone || "amber",
    createdAt: event.createdAt || new Date().toISOString(),
  };
  const updated = [newEvent, ...current];
  await saveCountdowns(updated);
  return newEvent;
}

/**
 * Removes a countdown event by id, persists changes, and notifies subscribers.
 */
export async function deleteCountdown(id: string): Promise<CountdownEvent[]> {
  const current = await loadCountdowns();
  const updated = current.filter((c) => c.id !== id);
  await saveCountdowns(updated);
  return updated;
}

/**
 * Clears memory cache and AsyncStorage key for test hygiene.
 */
export async function _resetCountdownsForTest(): Promise<void> {
  memoryCachedCountdowns = [];
  isHydrated = false;
  notifyListeners([]);
  try {
    await AsyncStorage.removeItem(COUNTDOWNS_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * React hook for reading and mutating countdown events with in-memory sync.
 */
export function useCountdowns() {
  const [countdowns, setCountdowns] = useState<CountdownEvent[]>(memoryCachedCountdowns);
  const [loading, setLoading] = useState(!isHydrated);

  useEffect(() => {
    let alive = true;
    void loadCountdowns().then((data) => {
      if (alive) {
        setCountdowns([...data]);
        setLoading(false);
      }
    });

    const listener = (updated: CountdownEvent[]) => {
      if (alive) {
        setCountdowns([...updated]);
      }
    };
    listeners.add(listener);
    return () => {
      alive = false;
      listeners.delete(listener);
    };
  }, []);

  const add = useCallback(
    async (event: Omit<CountdownEvent, "id" | "createdAt"> & { id?: string; createdAt?: string }) => {
      return await addCountdown(event);
    },
    []
  );

  const remove = useCallback(async (id: string) => {
    return await deleteCountdown(id);
  }, []);

  return {
    countdowns,
    loading,
    addCountdown: add,
    deleteCountdown: remove,
    refresh: loadCountdowns,
  };
}
