import type { MediaTrack } from "./types";

export interface LyricLine {
  timeMs: number;
  text: string;
}

const STAMP = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
const OFFSET = /\[offset:\s*([+-]?\d+)\s*\]/i;

function fractionToMs(value: string | undefined): number {
  if (!value) return 0;
  if (value.length === 1) return Number(value) * 100;
  if (value.length === 2) return Number(value) * 10;
  return Number(value.slice(0, 3));
}

/** Line-synced LRC. Multiple stamps on one line produce one entry each. */
export function parseLrc(raw: string): LyricLine[] {
  if (!raw) return [];
  const offsetMatch = OFFSET.exec(raw);
  const offsetMs = offsetMatch ? Number(offsetMatch[1]) || 0 : 0;
  const lines: LyricLine[] = [];

  for (const sourceLine of raw.split(/\r?\n/)) {
    STAMP.lastIndex = 0;
    const stamps: number[] = [];
    let match: RegExpExecArray | null;
    while ((match = STAMP.exec(sourceLine)) !== null) {
      const minutes = Number(match[1]);
      const seconds = Number(match[2]);
      stamps.push(minutes * 60_000 + seconds * 1000 + fractionToMs(match[3]));
    }
    if (stamps.length === 0) continue;
    const text = sourceLine.replace(STAMP, "").trim();
    for (const stamp of stamps) {
      lines.push({ timeMs: Math.max(0, stamp + offsetMs), text });
    }
  }

  return lines.sort((a, b) => a.timeMs - b.timeMs);
}

/** Index of the line whose timestamp is the latest one at or before position. */
export function currentLineIndex(lines: LyricLine[], positionMs: number): number {
  if (lines.length === 0 || positionMs < lines[0].timeMs) return -1;
  let low = 0;
  let high = lines.length - 1;
  let result = -1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (lines[mid].timeMs <= positionMs) {
      result = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return result;
}

const cache = new Map<string, LyricLine[]>();
const MAX_CACHE = 100;

const LRCLIB_GET = "https://lrclib.net/api/get";

/** Fetch + cache parsed lyrics from LRCLIB. Returns null when none exist. */
export async function fetchLyrics(track: MediaTrack): Promise<LyricLine[] | null> {
  const cached = cache.get(track.id);
  if (cached) return cached;

  try {
    const params = new URLSearchParams({
      track_name: track.title,
      artist_name: track.artist,
    });
    if (track.album) params.set("album_name", track.album);
    if (typeof track.durationSeconds === "number") {
      params.set("duration", String(Math.round(track.durationSeconds)));
    }
    const response = await fetch(`${LRCLIB_GET}?${params.toString()}`, {
      headers: { "User-Agent": "Consuela/1.0 (family dashboard)" },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { syncedLyrics?: string | null; plainLyrics?: string | null };
    const raw = data.syncedLyrics || data.plainLyrics || "";
    if (!raw.trim()) return null;
    const parsed = parseLrc(raw);
    const result = parsed.length > 0 ? parsed : [{ timeMs: 0, text: raw }];
    cache.set(track.id, result);
    if (cache.size > MAX_CACHE) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    return result;
  } catch {
    return null;
  }
}

export function clearLyricsCache(): void {
  cache.clear();
}

/* ── The auto-follow (the pane that keeps the current line in view) ───────── */

/**
 * How long the follow stays paused after the user scrolls (ms).
 *
 * WHY A PAUSE AT ALL: the follow moves the view to the line being sung. If
 * it kept doing that while a finger was on the glass, the list would fight
 * the scroll — the worst possible feel on a wall panel. So a scroll pauses
 * the follow, and the follow comes back a few seconds later.
 */
export const FOLLOW_PAUSE_MS = 3000;

/**
 * The offset the follow scrolls to, so the current line sits in the upper
 * third of the viewport (not glued to the top edge, where it would be cut).
 *
 * A viewport that has not been measured yet (height 0) scrolls to the line
 * itself — the honest answer when nothing else is known.
 */
export function followOffset(lineY: number, viewportHeight: number): number {
  if (!Number.isFinite(lineY) || lineY <= 0) return 0;
  const lead = Math.max(0, Math.round(viewportHeight / 3));
  return Math.max(0, lineY - lead);
}
