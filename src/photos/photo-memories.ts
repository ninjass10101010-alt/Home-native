import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

export type ReactionKey = "love" | "haha" | "wow" | "party";

export interface PhotoMemoryRecord {
  photoId: string;
  customCaption?: string;
  reactions: Record<ReactionKey, number>;
}

export const PHOTO_MEMORIES_STORAGE_KEY = "consuela-photo-memories";

export const REACTION_KEYS: ReactionKey[] = ["love", "haha", "wow", "party"];

export const REACTION_EMOJIS: Record<ReactionKey, string> = {
  love: "❤️",
  haha: "😂",
  wow: "🤩",
  party: "🎉",
};

export const DEFAULT_REACTIONS: Record<ReactionKey, number> = {
  love: 0,
  haha: 0,
  wow: 0,
  party: 0,
};

/**
 * Loads all stored photo memories and reactions from AsyncStorage.
 */
export async function loadPhotoMemories(): Promise<Record<string, PhotoMemoryRecord>> {
  try {
    const raw = await AsyncStorage.getItem(PHOTO_MEMORIES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, PhotoMemoryRecord>) : {};
  } catch {
    return {};
  }
}

/**
 * Records a guestbook reaction for a photo.
 */
export async function reactToPhoto(photoId: string, key: ReactionKey): Promise<PhotoMemoryRecord> {
  try {
    const current = await loadPhotoMemories();
    const existing = current[photoId] || {
      photoId,
      reactions: { ...DEFAULT_REACTIONS },
    };
    const reactions = { ...DEFAULT_REACTIONS, ...(existing.reactions || {}) };
    reactions[key] = (reactions[key] || 0) + 1;
    const updatedRecord: PhotoMemoryRecord = {
      ...existing,
      photoId,
      reactions,
    };
    current[photoId] = updatedRecord;
    await AsyncStorage.setItem(PHOTO_MEMORIES_STORAGE_KEY, JSON.stringify(current));
    return updatedRecord;
  } catch {
    return {
      photoId,
      reactions: { ...DEFAULT_REACTIONS, [key]: 1 },
    };
  }
}

/**
 * Saves a warm custom caption / memory note for a photo.
 */
export async function savePhotoCaption(photoId: string, caption: string): Promise<PhotoMemoryRecord> {
  try {
    const current = await loadPhotoMemories();
    const existing = current[photoId] || {
      photoId,
      reactions: { ...DEFAULT_REACTIONS },
    };
    const updatedRecord: PhotoMemoryRecord = {
      ...existing,
      photoId,
      customCaption: caption.trim(),
    };
    current[photoId] = updatedRecord;
    await AsyncStorage.setItem(PHOTO_MEMORIES_STORAGE_KEY, JSON.stringify(current));
    return updatedRecord;
  } catch {
    return {
      photoId,
      customCaption: caption.trim(),
      reactions: { ...DEFAULT_REACTIONS },
    };
  }
}

/**
 * Test helper to reset photo memories storage.
 */
export async function _resetPhotoMemoriesForTest(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PHOTO_MEMORIES_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * React hook to access and update photo memories and guestbook reactions.
 */
export function usePhotoMemories() {
  const [memories, setMemories] = useState<Record<string, PhotoMemoryRecord>>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const data = await loadPhotoMemories();
    setMemories(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    let alive = true;
    void loadPhotoMemories().then((data) => {
      if (alive) {
        setMemories(data);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const react = useCallback(async (photoId: string, key: ReactionKey) => {
    const updated = await reactToPhoto(photoId, key);
    setMemories((prev) => ({
      ...prev,
      [photoId]: updated,
    }));
    return updated;
  }, []);

  const saveCaption = useCallback(async (photoId: string, caption: string) => {
    const updated = await savePhotoCaption(photoId, caption);
    setMemories((prev) => ({
      ...prev,
      [photoId]: updated,
    }));
    return updated;
  }, []);

  return {
    memories,
    loading,
    refresh,
    react,
    saveCaption,
  };
}
