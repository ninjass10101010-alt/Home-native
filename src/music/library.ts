import AsyncStorage from "@react-native-async-storage/async-storage";
import type { DownloadEntry, MediaTrack, RepeatMode } from "./types";

const DOWNLOADS_KEY = "music.downloads";
const HISTORY_KEY = "music.history";
const SETTINGS_KEY = "music.settings";

export const HISTORY_LIMIT = 500;
export const DOWNLOAD_CAP_BYTES = 2 * 1024 * 1024 * 1024;

export interface MusicSettings {
  repeat: RepeatMode;
  shuffle: boolean;
  explicitFilter: boolean;
}

export const DEFAULT_SETTINGS: MusicSettings = { repeat: "off", shuffle: false, explicitFilter: true };

const REPEAT_MODES: RepeatMode[] = ["off", "all", "one"];

/**
 * Merge a persisted settings payload OVER the defaults.
 *
 * A payload written before a key existed must never DISABLE that key's
 * default: the explicit filter fails closed, so a payload with no
 * `explicitFilter` key keeps the filter ON (only an explicit `false` turns
 * it off). The same merge restores `repeat`/`shuffle` for payloads that
 * predate them.
 */
export function mergeMusicSettings(stored: Partial<MusicSettings> | null | undefined): MusicSettings {
  const repeat = stored?.repeat;
  return {
    repeat: repeat && REPEAT_MODES.includes(repeat) ? repeat : DEFAULT_SETTINGS.repeat,
    shuffle: typeof stored?.shuffle === "boolean" ? stored.shuffle : DEFAULT_SETTINGS.shuffle,
    explicitFilter:
      typeof stored?.explicitFilter === "boolean" ? stored.explicitFilter : DEFAULT_SETTINGS.explicitFilter,
  };
}

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage is a cache; a failed write must never break playback.
  }
}

export function mergeHistory(
  history: MediaTrack[],
  track: MediaTrack,
  limit = HISTORY_LIMIT
): MediaTrack[] {
  return [track, ...history.filter((entry) => entry.id !== track.id)].slice(0, limit);
}

export function upsertDownload(list: DownloadEntry[], entry: DownloadEntry): DownloadEntry[] {
  return [entry, ...list.filter((item) => item.id !== entry.id)];
}

export function removeDownloadEntry(list: DownloadEntry[], id: string): DownloadEntry[] {
  return list.filter((item) => item.id !== id);
}

export function totalDownloadBytes(list: DownloadEntry[]): number {
  return list.reduce((sum, item) => sum + (Number.isFinite(item.bytes) ? item.bytes : 0), 0);
}

/**
 * A download written BEFORE the rating existed carries no `explicit` key.
 *
 * It must NOT read as "not marked explicit" (that would let an explicit
 * track reach a kid through the tray): a missing rating is UNKNOWN, and an
 * unknown rating is hidden from a kid role.
 */
export function normalizeDownload(entry: DownloadEntry): DownloadEntry {
  return { ...entry, explicit: typeof entry.explicit === "boolean" ? entry.explicit : null };
}

export async function loadDownloads(): Promise<DownloadEntry[]> {
  const list = await readJson<DownloadEntry[]>(DOWNLOADS_KEY, []);
  return Array.isArray(list) ? list.map(normalizeDownload) : [];
}

export function saveDownloads(list: DownloadEntry[]): Promise<void> {
  return writeJson(DOWNLOADS_KEY, list);
}

export function loadHistory(): Promise<MediaTrack[]> {
  return readJson<MediaTrack[]>(HISTORY_KEY, []);
}

export async function appendHistory(track: MediaTrack): Promise<MediaTrack[]> {
  const next = mergeHistory(await loadHistory(), track);
  await writeJson(HISTORY_KEY, next);
  return next;
}

export async function loadMusicSettings(): Promise<MusicSettings> {
  // MERGE, never trust the raw payload: a payload persisted before a key
  // existed must keep that key's default (the explicit filter fails closed).
  const stored = await readJson<Partial<MusicSettings> | null>(SETTINGS_KEY, null);
  return mergeMusicSettings(stored);
}

export function saveMusicSettings(settings: MusicSettings): Promise<void> {
  return writeJson(SETTINGS_KEY, settings);
}
