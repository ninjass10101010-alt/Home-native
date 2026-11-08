import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type KudosBadgeId = "kind-heart" | "team-player" | "super-helper" | "bright-spark";

export type KudosBadgeTone = "coral" | "cyan" | "amber" | "lavender";

export interface KudosBadge {
  id: KudosBadgeId;
  label: string;
  emoji: string;
  tone: KudosBadgeTone;
}

export const KUDOS_BADGES: KudosBadge[] = [
  { id: "kind-heart", label: "Kind Heart", emoji: "💖", tone: "coral" },
  { id: "team-player", label: "Team Player", emoji: "🤝", tone: "cyan" },
  { id: "super-helper", label: "Super Helper", emoji: "🌟", tone: "amber" },
  { id: "bright-spark", label: "Bright Spark", emoji: "🧠", tone: "lavender" },
];

export const KUDOS_QUICK_MESSAGES = [
  "Helped out without being asked!",
  "Shared & took turns so kindly!",
  "Helped clean up after dinner!",
  "Cheered up a family member today!",
] as const;

export interface KudosEntry {
  id: string;
  fromName: string;
  fromEmoji: string;
  toName: string;
  toEmoji: string;
  message: string;
  badgeId: KudosBadgeId;
  createdAt: string;
}

export const KUDOS_STORAGE_KEY = "consuela-kudos-jar";

let memoryCache: KudosEntry[] | null = null;
const listeners = new Set<(entries: KudosEntry[]) => void>();

function notify(entries: KudosEntry[]) {
  listeners.forEach((listener) => {
    try {
      listener(entries);
    } catch {
      // ignore
    }
  });
}

export async function loadKudosJar(): Promise<KudosEntry[]> {
  if (memoryCache !== null) {
    return [...memoryCache];
  }
  try {
    const raw = await AsyncStorage.getItem(KUDOS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        memoryCache = parsed;
        return [...memoryCache];
      }
    }
  } catch {
    // ignore
  }
  memoryCache = [];
  return [];
}

export async function addKudosEntry(
  entry: Omit<KudosEntry, "id" | "createdAt"> & { id?: string; createdAt?: string }
): Promise<KudosEntry> {
  const current = await loadKudosJar();
  const created: KudosEntry = {
    id: entry.id ?? `kudos-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    fromName: entry.fromName,
    fromEmoji: entry.fromEmoji,
    toName: entry.toName,
    toEmoji: entry.toEmoji,
    message: entry.message,
    badgeId: entry.badgeId,
    createdAt: entry.createdAt ?? new Date().toISOString(),
  };
  const next = [created, ...current];
  memoryCache = next;
  try {
    await AsyncStorage.setItem(KUDOS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  notify(next);
  return created;
}

export async function deleteKudosEntry(id: string): Promise<boolean> {
  const current = await loadKudosJar();
  const next = current.filter((e) => e.id !== id);
  if (next.length === current.length) return false;
  memoryCache = next;
  try {
    await AsyncStorage.setItem(KUDOS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  notify(next);
  return true;
}

export function _resetKudosJarForTest(initial: KudosEntry[] | null = null): void {
  memoryCache = initial ? [...initial] : null;
  listeners.clear();
}

export function useKudosJar() {
  const [entries, setEntries] = useState<KudosEntry[]>(() => memoryCache ?? []);
  const [loaded, setLoaded] = useState<boolean>(() => memoryCache !== null);

  useEffect(() => {
    let alive = true;
    const onUpdate = (next: KudosEntry[]) => {
      if (alive) {
        setEntries(next);
        setLoaded(true);
      }
    };
    listeners.add(onUpdate);

    void loadKudosJar().then((res) => {
      if (alive) {
        setEntries(res);
        setLoaded(true);
      }
    });

    return () => {
      alive = false;
      listeners.delete(onUpdate);
    };
  }, []);

  const addEntry = useCallback(
    async (entry: Omit<KudosEntry, "id" | "createdAt"> & { id?: string; createdAt?: string }) => {
      return addKudosEntry(entry);
    },
    []
  );

  const deleteEntry = useCallback(async (id: string) => {
    return deleteKudosEntry(id);
  }, []);

  return {
    entries,
    loaded,
    addEntry,
    deleteEntry,
    refresh: loadKudosJar,
  };
}
