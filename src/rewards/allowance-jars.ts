import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type AllowanceJarId = "spend" | "save" | "give";

export type AllowanceJarTone = "cyan" | "mint" | "coral";

export interface AllowanceJarMeta {
  id: AllowanceJarId;
  title: string;
  subtitle: string;
  emoji: string;
  tone: AllowanceJarTone;
}

export const ALLOWANCE_JAR_META: AllowanceJarMeta[] = [
  { id: "spend", title: "Spend Jar", subtitle: "Everyday treats & fun", emoji: "🛍️", tone: "cyan" },
  { id: "save", title: "Save Jar", subtitle: "Big mountain goals", emoji: "🏔️", tone: "mint" },
  { id: "give", title: "Give & Share Jar", subtitle: "Gifts & kindness", emoji: "💝", tone: "coral" },
];

export interface AllowanceJarHistoryEntry {
  id: string;
  jar: AllowanceJarId;
  amount: number;
  note: string;
  createdAt: string;
}

export interface AllowanceJarsState {
  spend: number;
  save: number;
  give: number;
  history: { id: string; jar: AllowanceJarId; amount: number; note: string; createdAt: string }[];
}

export const ALLOWANCE_JARS_STORAGE_KEY = "consuela-allowance-jars";

export const DEFAULT_ALLOWANCE_JARS: AllowanceJarsState = {
  spend: 15,
  save: 40,
  give: 10,
  history: [],
};

let memoryCache: AllowanceJarsState | null = null;
const listeners = new Set<(state: AllowanceJarsState) => void>();

function notify(state: AllowanceJarsState): void {
  listeners.forEach((listener) => {
    try {
      listener(state);
    } catch {
      // ignore
    }
  });
}

export async function loadAllowanceJars(): Promise<AllowanceJarsState> {
  if (memoryCache !== null) {
    return {
      ...memoryCache,
      history: [...memoryCache.history],
    };
  }
  try {
    const raw = await AsyncStorage.getItem(ALLOWANCE_JARS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        const spend =
          typeof parsed.spend === "number" && !Number.isNaN(parsed.spend)
            ? parsed.spend
            : DEFAULT_ALLOWANCE_JARS.spend;
        const save =
          typeof parsed.save === "number" && !Number.isNaN(parsed.save)
            ? parsed.save
            : DEFAULT_ALLOWANCE_JARS.save;
        const give =
          typeof parsed.give === "number" && !Number.isNaN(parsed.give)
            ? parsed.give
            : DEFAULT_ALLOWANCE_JARS.give;
        const history = Array.isArray(parsed.history) ? parsed.history : [];
        memoryCache = { spend, save, give, history };
        return { ...memoryCache, history: [...memoryCache.history] };
      }
    }
  } catch {
    // ignore
  }
  memoryCache = {
    ...DEFAULT_ALLOWANCE_JARS,
    history: [],
  };
  return { ...memoryCache, history: [] };
}

export async function adjustAllowanceJar(
  jar: AllowanceJarId,
  amount: number,
  note?: string
): Promise<AllowanceJarsState> {
  const current = await loadAllowanceJars();
  const currentBalance = current[jar] ?? 0;
  const nextBalance = Math.max(0, currentBalance + amount);
  const txEntry: AllowanceJarHistoryEntry = {
    id: `jar-tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    jar,
    amount,
    note: note ?? (amount >= 0 ? `+${amount}` : `${amount}`),
    createdAt: new Date().toISOString(),
  };
  const nextState: AllowanceJarsState = {
    ...current,
    [jar]: nextBalance,
    history: [txEntry, ...current.history].slice(0, 50),
  };
  memoryCache = nextState;
  try {
    await AsyncStorage.setItem(ALLOWANCE_JARS_STORAGE_KEY, JSON.stringify(nextState));
  } catch {
    // ignore
  }
  notify(nextState);
  return { ...nextState, history: [...nextState.history] };
}

export function _resetAllowanceJarsForTest(initial: AllowanceJarsState | null = null): void {
  memoryCache = initial ? { ...initial, history: [...initial.history] } : null;
  listeners.clear();
}

export function useAllowanceJars() {
  const [jars, setJars] = useState<AllowanceJarsState>(
    () => memoryCache ?? { ...DEFAULT_ALLOWANCE_JARS, history: [] }
  );
  const [loaded, setLoaded] = useState<boolean>(() => memoryCache !== null);

  useEffect(() => {
    let alive = true;
    const onUpdate = (next: AllowanceJarsState) => {
      if (alive) {
        setJars(next);
        setLoaded(true);
      }
    };
    listeners.add(onUpdate);

    void loadAllowanceJars().then((res) => {
      if (alive) {
        setJars(res);
        setLoaded(true);
      }
    });

    return () => {
      alive = false;
      listeners.delete(onUpdate);
    };
  }, []);

  const adjustJar = useCallback(
    async (jar: AllowanceJarId, amount: number, note?: string) => {
      return adjustAllowanceJar(jar, amount, note);
    },
    []
  );

  return {
    state: jars,
    jars,
    loaded,
    adjustJar,
    adjustAllowanceJar: adjustJar,
    refresh: loadAllowanceJars,
  };
}
