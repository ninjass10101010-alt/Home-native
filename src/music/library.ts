import AsyncStorage from "@react-native-async-storage/async-storage";
import type { DenyEntry, DownloadEntry, MediaTrack, RepeatMode } from "./types";

const DOWNLOADS_KEY = "music.downloads";
const HISTORY_KEY = "music.history";
const HISTORY_VERSION_KEY = "music.history.version";
const SETTINGS_KEY = "music.settings";
const DENYLIST_KEY = "music.denylist";

export const HISTORY_LIMIT = 500;
export const DOWNLOAD_CAP_BYTES = 2 * 1024 * 1024 * 1024;

/**
 * The history schema version.
 *
 * v2 = the TRI-STATE rating (`explicit: boolean | null`). The engine before
 * that change hardcoded `explicit: false` on EVERY track it produced, so
 * every history row it wrote claims "not marked explicit" for a track that
 * may well be badged explicit — a stale claim, not a rating. A payload with
 * no version marker (or one older than this) comes from that era.
 */
export const HISTORY_SCHEMA_VERSION = 2;

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

/**
 * The history rows as the viewer must read them.
 *
 * A LEGACY payload (no version marker, or one older than the tri-state
 * change) carries a hardcoded `explicit: false` on every row — a stale
 * "not marked explicit" claim, never a rating. Such a row is UNKNOWN: the
 * shelf keeps it (a parent still sees it) but it is never claimed to be
 * clean, so a kid fails closed on it and a pre-existing explicit track can
 * no longer reach them through "Recently played".
 *
 * A CURRENT payload keeps its real rating; a row that somehow lost its
 * rating is still UNKNOWN, never a false "not marked explicit".
 */
export function normalizeHistory(entries: MediaTrack[], legacy: boolean): MediaTrack[] {
  return entries.map((entry) => ({
    ...entry,
    explicit: legacy || typeof entry.explicit !== "boolean" ? null : entry.explicit,
  }));
}

export async function loadHistory(): Promise<MediaTrack[]> {
  const [rows, version] = await Promise.all([
    readJson<MediaTrack[]>(HISTORY_KEY, []),
    readJson<number>(HISTORY_VERSION_KEY, 0),
  ]);
  const list = Array.isArray(rows) ? rows : [];
  // No marker (or an older one) = the legacy era: every row's rating is
  // UNKNOWN, because the `false` it carries was hardcoded, not measured.
  const legacy = !(typeof version === "number" && version >= HISTORY_SCHEMA_VERSION);
  return normalizeHistory(list, legacy);
}

export async function appendHistory(track: MediaTrack): Promise<MediaTrack[]> {
  const next = mergeHistory(await loadHistory(), track);
  await writeJson(HISTORY_KEY, next);
  // The marker is written AFTER the rows: a marker that says "current" must
  // never outlive the rows it describes.
  await writeJson(HISTORY_VERSION_KEY, HISTORY_SCHEMA_VERSION);
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

/**
 * The family's deny-list, as stored.
 *
 * The store NEVER throws: a corrupt (or half-written) payload reads as an
 * EMPTY list, because a broken store must not take the music surface down
 * with it. `readJson` already swallows a parse error and returns the
 * fallback, and a payload that is not an array (or that holds a row with no
 * string term) is filtered out here — the policy treats an unusable term as
 * no term at all.
 */
export async function loadDenylist(): Promise<DenyEntry[]> {
  const list = await readJson<DenyEntry[]>(DENYLIST_KEY, []);
  return Array.isArray(list) ? list.filter((e) => typeof e?.term === "string") : [];
}

export function saveDenylist(list: DenyEntry[]): Promise<void> {
  return writeJson(DENYLIST_KEY, list);
}
