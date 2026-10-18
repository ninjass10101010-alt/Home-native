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

const DEFAULT_SETTINGS: MusicSettings = { repeat: "off", shuffle: false, explicitFilter: true };

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

export function loadDownloads(): Promise<DownloadEntry[]> {
  return readJson<DownloadEntry[]>(DOWNLOADS_KEY, []);
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
  return readJson<MusicSettings>(SETTINGS_KEY, DEFAULT_SETTINGS);
}

export function saveMusicSettings(settings: MusicSettings): Promise<void> {
  return writeJson(SETTINGS_KEY, settings);
}
