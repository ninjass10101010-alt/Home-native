import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

export type ChecklistTone = "amber" | "mint" | "cyan" | "lavender" | "coral";

export interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}

export interface CustomChecklist {
  id: string;
  title: string;
  emoji: string;
  tone: ChecklistTone;
  items: ChecklistItem[];
}

export const CUSTOM_CHECKLISTS_STORAGE_KEY = "consuela-custom-checklists";

export const STARTER_CHECKLISTS: CustomChecklist[] = [
  {
    id: "list-backpack",
    title: "School Backpack",
    emoji: "🎒",
    tone: "cyan",
    items: [
      { id: "bp-1", label: "Homework folder", checked: false },
      { id: "bp-2", label: "Water bottle", checked: false },
      { id: "bp-3", label: "Lunchbox", checked: false },
      { id: "bp-4", label: "Charged tablet", checked: false },
    ],
  },
  {
    id: "list-sports",
    title: "Sports & Practice Bag",
    emoji: "⚽",
    tone: "mint",
    items: [
      { id: "sp-1", label: "Jersey & cleats", checked: false },
      { id: "sp-2", label: "Shin guards", checked: false },
      { id: "sp-3", label: "Water bottle", checked: false },
      { id: "sp-4", label: "Post-game snack", checked: false },
    ],
  },
  {
    id: "list-camping",
    title: "Weekend Trip Packing",
    emoji: "🏕️",
    tone: "amber",
    items: [
      { id: "cp-1", label: "Toothbrush & PJs", checked: false },
      { id: "cp-2", label: "Phone chargers", checked: false },
      { id: "cp-3", label: "Board games", checked: false },
      { id: "cp-4", label: "Road trip snacks", checked: false },
    ],
  },
];

let cachedLists: CustomChecklist[] | null = null;
const listeners = new Set<(lists: CustomChecklist[]) => void>();

function cloneStarterChecklists(): CustomChecklist[] {
  return JSON.parse(JSON.stringify(STARTER_CHECKLISTS)) as CustomChecklist[];
}

function notifyListeners(lists: CustomChecklist[]): void {
  for (const listener of [...listeners]) {
    try {
      listener(lists);
    } catch {
      // ignore subscriber error
    }
  }
}

export function subscribeCustomLists(listener: (lists: CustomChecklist[]) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Loads custom checklists from AsyncStorage. Seeds with STARTER_CHECKLISTS
 * when storage is empty on first load.
 */
export async function loadCustomLists(): Promise<CustomChecklist[]> {
  try {
    const raw = await AsyncStorage.getItem(CUSTOM_CHECKLISTS_STORAGE_KEY);
    if (raw === null || raw === undefined) {
      const seeded = cloneStarterChecklists();
      await AsyncStorage.setItem(CUSTOM_CHECKLISTS_STORAGE_KEY, JSON.stringify(seeded));
      cachedLists = seeded;
      notifyListeners(seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      cachedLists = parsed as CustomChecklist[];
      return cachedLists;
    }
    const fallback = cloneStarterChecklists();
    cachedLists = fallback;
    return fallback;
  } catch {
    const fallback = cachedLists ?? cloneStarterChecklists();
    cachedLists = fallback;
    return fallback;
  }
}

/**
 * Saves checklists to memory cache and AsyncStorage, notifying subscribers.
 */
async function saveCustomLists(lists: CustomChecklist[]): Promise<void> {
  cachedLists = lists;
  try {
    await AsyncStorage.setItem(CUSTOM_CHECKLISTS_STORAGE_KEY, JSON.stringify(lists));
  } catch {
    // ignore storage errors
  }
  notifyListeners(lists);
}

/**
 * Toggles the checked status of an item within a checklist.
 */
export async function toggleChecklistItem(listId: string, itemId: string): Promise<CustomChecklist[]> {
  const current = await loadCustomLists();
  const updated = current.map((list) => {
    if (list.id !== listId) return list;
    return {
      ...list,
      items: list.items.map((item) => (item.id === itemId ? { ...item, checked: !item.checked } : item)),
    };
  });
  await saveCustomLists(updated);
  return updated;
}

/**
 * Resets all items in a checklist to unchecked (checked = false).
 */
export async function resetChecklistChecks(listId: string): Promise<CustomChecklist[]> {
  const current = await loadCustomLists();
  const updated = current.map((list) => {
    if (list.id !== listId) return list;
    return {
      ...list,
      items: list.items.map((item) => ({ ...item, checked: false })),
    };
  });
  await saveCustomLists(updated);
  return updated;
}

/**
 * Adds a new item to a checklist.
 */
export async function addChecklistItem(listId: string, label: string): Promise<CustomChecklist[]> {
  const trimmed = label.trim();
  if (!trimmed) return await loadCustomLists();
  const current = await loadCustomLists();
  const newItemId = `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const updated = current.map((list) => {
    if (list.id !== listId) return list;
    return {
      ...list,
      items: [...list.items, { id: newItemId, label: trimmed, checked: false }],
    };
  });
  await saveCustomLists(updated);
  return updated;
}

/**
 * Removes an item from a checklist.
 */
export async function deleteChecklistItem(listId: string, itemId: string): Promise<CustomChecklist[]> {
  const current = await loadCustomLists();
  const updated = current.map((list) => {
    if (list.id !== listId) return list;
    return {
      ...list,
      items: list.items.filter((item) => item.id !== itemId),
    };
  });
  await saveCustomLists(updated);
  return updated;
}

export interface CreateCustomChecklistInput {
  id?: string;
  title: string;
  emoji?: string;
  tone?: ChecklistTone;
  items?: (string | ChecklistItem)[];
}

/**
 * Creates a new custom checklist and appends it to storage.
 */
export async function createCustomChecklist(
  params: CreateCustomChecklistInput | string,
  maybeEmoji?: string,
  maybeTone?: ChecklistTone
): Promise<CustomChecklist> {
  const current = await loadCustomLists();
  let title = "";
  let emoji = "📋";
  let tone: ChecklistTone = "cyan";
  let items: ChecklistItem[] = [];
  let customId: string | undefined;

  if (typeof params === "string") {
    title = params.trim();
    if (maybeEmoji) emoji = maybeEmoji;
    if (maybeTone) tone = maybeTone;
  } else {
    title = (params.title || "").trim();
    if (params.emoji) emoji = params.emoji;
    if (params.tone) tone = params.tone;
    if (params.id) customId = params.id;
    if (params.items && Array.isArray(params.items)) {
      items = params.items.map((it, idx) => {
        if (typeof it === "string") {
          return {
            id: `item-${Date.now()}-${idx}`,
            label: it.trim(),
            checked: false,
          };
        }
        return it;
      });
    }
  }

  const id = customId || `list-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const created: CustomChecklist = {
    id,
    title: title || "New Checklist",
    emoji,
    tone,
    items,
  };

  const updated = [...current, created];
  await saveCustomLists(updated);
  return created;
}

/**
 * Deletes a custom checklist.
 */
export async function deleteCustomChecklist(listId: string): Promise<CustomChecklist[]> {
  const current = await loadCustomLists();
  const updated = current.filter((list) => list.id !== listId);
  await saveCustomLists(updated);
  return updated;
}

/**
 * Resets custom checklist memory cache and AsyncStorage (test utility).
 */
export async function _resetCustomListsForTest(): Promise<void> {
  cachedLists = null;
  listeners.clear();
  try {
    await AsyncStorage.removeItem(CUSTOM_CHECKLISTS_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * React hook to read and manipulate custom checklists with live sync across components.
 */
export function useCustomChecklists() {
  const [lists, setLists] = useState<CustomChecklist[]>(cachedLists ?? STARTER_CHECKLISTS);
  const [loading, setLoading] = useState<boolean>(cachedLists === null);

  const refresh = useCallback(async () => {
    const data = await loadCustomLists();
    setLists(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    let alive = true;
    void loadCustomLists().then((data) => {
      if (alive) {
        setLists(data);
        setLoading(false);
      }
    });

    const unsub = subscribeCustomLists((next) => {
      if (alive) {
        setLists(next);
      }
    });

    return () => {
      alive = false;
      unsub();
    };
  }, []);

  const toggleItem = useCallback(async (listId: string, itemId: string) => {
    return await toggleChecklistItem(listId, itemId);
  }, []);

  const resetChecks = useCallback(async (listId: string) => {
    return await resetChecklistChecks(listId);
  }, []);

  const addItem = useCallback(async (listId: string, label: string) => {
    return await addChecklistItem(listId, label);
  }, []);

  const deleteItem = useCallback(async (listId: string, itemId: string) => {
    return await deleteChecklistItem(listId, itemId);
  }, []);

  const createList = useCallback(
    async (params: CreateCustomChecklistInput | string, maybeEmoji?: string, maybeTone?: ChecklistTone) => {
      return await createCustomChecklist(params, maybeEmoji, maybeTone);
    },
    []
  );

  const deleteList = useCallback(async (listId: string) => {
    return await deleteCustomChecklist(listId);
  }, []);

  return {
    lists,
    loading,
    refresh,
    toggleItem,
    resetChecks,
    addItem,
    deleteItem,
    createList,
    deleteList,
    toggleChecklistItem,
    resetChecklistChecks,
    addChecklistItem,
    deleteChecklistItem,
    createCustomChecklist,
    deleteCustomChecklist,
  };
}
