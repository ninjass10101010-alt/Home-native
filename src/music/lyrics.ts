import { getBaseUrl } from "../api/config";
import { loadSessionCookie } from "../api/session";
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

/** Fetch + cache parsed lyrics. Returns null when the server has none. */
export async function fetchLyrics(track: MediaTrack): Promise<LyricLine[] | null> {
  const cached = cache.get(track.id);
  if (cached) return cached;

  const cookie = await loadSessionCookie();
  if (!cookie) return null;

  try {
    const params = new URLSearchParams({ id: track.id, title: track.title, artist: track.artist });
    if (typeof track.durationSeconds === "number") {
      params.set("duration", String(Math.round(track.durationSeconds)));
    }
    const response = await fetch(`${getBaseUrl()}/api/media/lyrics?${params.toString()}`, {
      headers: { Cookie: `consuela_session=${cookie}` },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { lyrics?: string | null; synced?: boolean };
    if (typeof data.lyrics !== "string" || !data.lyrics.trim()) return null;
    const parsed = parseLrc(data.lyrics);
    const result = parsed.length > 0 ? parsed : [{ timeMs: 0, text: data.lyrics }];
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
