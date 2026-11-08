import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import { newOperationId } from "./claim";

export const CHORE_STREAKS_STORAGE_KEY = "consuela-chore-streaks";
export const FAMILY_NOTES_STORAGE_KEY = "consuela-family-sticky-notes";

export interface StreakMilestone {
  days: number;
  id: string;
  idName?: string;
  title: string;
  badge: string;
  accentKey: string;
  bonusLabel: string;
}

export const STREAK_MILESTONES: StreakMilestone[] = [
  { days: 3, id: "spark", title: "3-Day Spark", badge: "🔥", accentKey: "amber", bonusLabel: "Habit Builder" },
  { days: 7, id: "flame", title: "7-Day Flame", badge: "🌟", accentKey: "coral", bonusLabel: "Full Week Hero" },
  { days: 14, id: "champion", title: "14-Day Champion", badge: "👑", accentKey: "violet", bonusLabel: "Two-Week Master" },
  { days: 30, id: "legend", idName: "legend", title: "30-Day Legend", badge: "🏆", accentKey: "mint", bonusLabel: "Unstoppable Legend" },
];

export interface MemberStreakResolution {
  count: number;
  currentMilestone: StreakMilestone | null;
  nextMilestone: StreakMilestone;
  progressPct: number;
}

/**
 * Resolves a member's current streak and milestone progress.
 * Reads Math.max(weekData?.streak?.[memberName] ?? 0, localStreaks?.[memberName] ?? 0).
 */
export function resolveMemberStreak(
  weekData: { streak?: Record<string, number> } | undefined,
  memberName: string,
  localStreaks?: Record<string, number>
): MemberStreakResolution {
  const count = Math.max(weekData?.streak?.[memberName] ?? 0, localStreaks?.[memberName] ?? 0);

  // Highest achieved milestone (where count >= milestone.days)
  const achieved = STREAK_MILESTONES.filter((m) => count >= m.days);
  const currentMilestone = achieved.length > 0 ? achieved[achieved.length - 1] : null;

  // Next milestone to aim for (first where count < milestone.days)
  const nextTarget = STREAK_MILESTONES.find((m) => count < m.days);
  const nextMilestone = nextTarget ?? STREAK_MILESTONES[STREAK_MILESTONES.length - 1];

  let progressPct: number;
  if (count >= nextMilestone.days) {
    progressPct = 100;
  } else {
    progressPct = Math.min(100, Math.max(0, Math.round((count / nextMilestone.days) * 100)));
  }

  return {
    count,
    currentMilestone,
    nextMilestone,
    progressPct,
  };
}

interface StoredStreaksPayload {
  streaks: Record<string, number>;
  lastCompletedDate?: Record<string, string>;
}

/**
 * Loads the stored local streak map ({ [memberName]: streakCount }).
 */
export async function loadLocalStreaks(): Promise<Record<string, number>> {
  try {
    const raw = await AsyncStorage.getItem(CHORE_STREAKS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      if (parsed.streaks && typeof parsed.streaks === "object") {
        return parsed.streaks as Record<string, number>;
      }
      return parsed as Record<string, number>;
    }
    return {};
  } catch {
    return {};
  }
}

/**
 * Records a chore completion for memberName on todayISO.
 * Increments or maintains the streak count and persists it.
 */
export async function recordLocalStreakCompletion(memberName: string, todayISO: string): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(CHORE_STREAKS_STORAGE_KEY);
    let streaks: Record<string, number> = {};
    let lastDates: Record<string, string> = {};

    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        if (parsed.streaks && typeof parsed.streaks === "object") {
          streaks = { ...parsed.streaks };
          if (parsed.lastCompletedDate && typeof parsed.lastCompletedDate === "object") {
            lastDates = { ...parsed.lastCompletedDate };
          }
        } else {
          streaks = { ...parsed };
        }
      }
    }

    const lastDate = lastDates[memberName];
    const currentStreak = streaks[memberName] ?? 0;
    let newStreak = currentStreak;

    if (!lastDate) {
      newStreak = Math.max(1, currentStreak + 1);
    } else if (lastDate === todayISO) {
      // Completed today already: maintain streak
      newStreak = Math.max(1, currentStreak);
    } else {
      const dLast = new Date(`${lastDate.slice(0, 10)}T12:00:00Z`).getTime();
      const dToday = new Date(`${todayISO.slice(0, 10)}T12:00:00Z`).getTime();
      const diffDays = Math.round((dToday - dLast) / 86_400_000);

      if (diffDays === 1) {
        newStreak = currentStreak + 1;
      } else if (diffDays > 1) {
        newStreak = 1;
      } else {
        newStreak = Math.max(1, currentStreak);
      }
    }

    streaks[memberName] = newStreak;
    lastDates[memberName] = todayISO;

    const payload: StoredStreaksPayload = {
      streaks,
      lastCompletedDate: lastDates,
    };
    await AsyncStorage.setItem(CHORE_STREAKS_STORAGE_KEY, JSON.stringify(payload));
    return newStreak;
  } catch {
    return 1;
  }
}

export interface FamilyStickyNote {
  id: string;
  text: string;
  author: string;
  emoji: string;
  tone: "amber" | "mint" | "cyan" | "lavender" | "coral";
  pinned: boolean;
  createdAt: string;
}

export const DEFAULT_STICKY_NOTES: FamilyStickyNote[] = [];

/**
 * Loads family sticky notes from AsyncStorage.
 */
export async function loadStickyNotes(): Promise<FamilyStickyNote[]> {
  try {
    const raw = await AsyncStorage.getItem(FAMILY_NOTES_STORAGE_KEY);
    if (!raw) return DEFAULT_STICKY_NOTES;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FamilyStickyNote[]) : DEFAULT_STICKY_NOTES;
  } catch {
    return DEFAULT_STICKY_NOTES;
  }
}

/**
 * Saves family sticky notes to AsyncStorage.
 */
export async function saveStickyNotes(notes: FamilyStickyNote[]): Promise<void> {
  try {
    await AsyncStorage.setItem(FAMILY_NOTES_STORAGE_KEY, JSON.stringify(notes));
  } catch {
    // ignore storage errors
  }
}

/**
 * Adds a new sticky note to the board.
 */
export async function addStickyNote(
  note: Omit<FamilyStickyNote, "id" | "createdAt"> & { id?: string; createdAt?: string }
): Promise<FamilyStickyNote> {
  const current = await loadStickyNotes();
  const newNote: FamilyStickyNote = {
    id: note.id || `note-${newOperationId()}`,
    text: note.text.trim(),
    author: note.author,
    emoji: note.emoji || "📝",
    tone: note.tone ?? "amber",
    pinned: note.pinned ?? false,
    createdAt: note.createdAt || new Date().toISOString(),
  };
  const updated = [newNote, ...current];
  await saveStickyNotes(updated);
  return newNote;
}

/**
 * Toggles the pinned state of a sticky note.
 */
export async function togglePinStickyNote(id: string): Promise<FamilyStickyNote[]> {
  const current = await loadStickyNotes();
  const updated = current.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n));
  await saveStickyNotes(updated);
  return updated;
}

/**
 * Deletes a sticky note from the board.
 */
export async function deleteStickyNote(id: string): Promise<FamilyStickyNote[]> {
  const current = await loadStickyNotes();
  const updated = current.filter((n) => n.id !== id);
  await saveStickyNotes(updated);
  return updated;
}

/**
 * Clears streaks and notes storage for test hygiene.
 */
export async function _resetStreaksAndNotesMemoryForTest(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([CHORE_STREAKS_STORAGE_KEY, FAMILY_NOTES_STORAGE_KEY]);
  } catch {
    // ignore
  }
}

/**
 * React hook for managing family sticky notes.
 */
export function useFamilyStickyNotes() {
  const [notes, setNotes] = useState<FamilyStickyNote[]>(DEFAULT_STICKY_NOTES);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const data = await loadStickyNotes();
    setNotes(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load from AsyncStorage is the idiom
    void refresh();
  }, [refresh]);

  const addNote = useCallback(
    async (note: Omit<FamilyStickyNote, "id" | "createdAt"> & { id?: string; createdAt?: string }) => {
      const created = await addStickyNote(note);
      setNotes((prev) => [created, ...prev]);
      return created;
    },
    []
  );

  const togglePin = useCallback(async (id: string) => {
    const updated = await togglePinStickyNote(id);
    setNotes(updated);
  }, []);

  const deleteNote = useCallback(async (id: string) => {
    const updated = await deleteStickyNote(id);
    setNotes(updated);
  }, []);

  return {
    notes,
    loading,
    refresh,
    addNote,
    togglePin,
    deleteNote,
  };
}
