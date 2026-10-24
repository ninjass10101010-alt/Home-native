import type { MediaTrack } from "./types";

export interface LyricWord {
  /** When the word is sung (ms from the start of the track). */
  timeMs: number;
  /** The word itself — trimmed, never padded with the spacing around it. */
  text: string;
}

export interface LyricLine {
  timeMs: number;
  text: string;
  /**
   * The WORD timings — EMPTY for a line-only LRC.
   *
   * WHY EMPTY AND NOT FAKE: a source that carries no word timing gets the
   * LINE-level fill (the whole line lights up while it is sung). Inventing
   * per-word times would make the karaoke lie about where the song is.
   */
  words: LyricWord[];
}

/**
 * A piece of a line — one word (with the spacing in front of it), or the
 * text around the words.
 *
 * THE SEGMENT IS WHAT THE KARAOKE PAINTS: `sung` says whether the playhead
 * has reached this piece. The text of the segments, joined, is always the
 * line's own text — the fill never changes WHAT the line says.
 */
export interface LyricSegment {
  text: string;
  sung: boolean;
}

/** A LINE stamp — `[mm:ss.xx]` (the classic LRC line marker). */
const LINE_STAMP = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
/** A WORD stamp — `<mm:ss.xx>` (the enhanced LRC word marker). */
const WORD_STAMP = /<(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?>/g;
const OFFSET = /\[offset:\s*([+-]?\d+)\s*\]/i;

function fractionToMs(value: string | undefined): number {
  if (!value) return 0;
  if (value.length === 1) return Number(value) * 100;
  if (value.length === 2) return Number(value) * 10;
  return Number(value.slice(0, 3));
}

function stampMs(match: RegExpExecArray): number {
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  return minutes * 60_000 + seconds * 1000 + fractionToMs(match[3]);
}

/** The `[offset:±ms]` tag of a file — 0 when there is none. */
function readOffset(raw: string): number {
  const match = OFFSET.exec(raw);
  return match ? Number(match[1]) || 0 : 0;
}

/** Every line stamp of one source line, in ms. */
function lineStamps(sourceLine: string): number[] {
  LINE_STAMP.lastIndex = 0;
  const stamps: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = LINE_STAMP.exec(sourceLine)) !== null) {
    stamps.push(stampMs(match));
  }
  return stamps;
}

/** The source line with every stamp (line AND word) taken off it. */
function stripStamps(sourceLine: string): string {
  LINE_STAMP.lastIndex = 0;
  WORD_STAMP.lastIndex = 0;
  return sourceLine.replace(LINE_STAMP, "").replace(WORD_STAMP, "").trim();
}

/**
 * The word timings of one source line.
 *
 * Each word stamp owns the text that follows it, up to the next word stamp.
 * A stamp with no text behind it is dropped (an empty word is not a word).
 */
function wordTimings(sourceLine: string): LyricWord[] {
  WORD_STAMP.lastIndex = 0;
  const marks: { start: number; end: number; timeMs: number }[] = [];
  let match: RegExpExecArray | null;
  while ((match = WORD_STAMP.exec(sourceLine)) !== null) {
    marks.push({
      start: match.index,
      end: match.index + match[0].length,
      timeMs: stampMs(match),
    });
  }

  const words: LyricWord[] = [];
  for (let i = 0; i < marks.length; i++) {
    const from = marks[i].end;
    const to = i + 1 < marks.length ? marks[i + 1].start : sourceLine.length;
    const text = sourceLine.slice(from, to).trim();
    if (!text) continue;
    words.push({ timeMs: marks[i].timeMs, text });
  }
  return words;
}

/**
 * Line-synced LRC.
 *
 * The plain format: one `[mm:ss.xx]` stamp per line. A file that also
 * carries word stamps still parses here — as LINE-level lyrics, with no
 * words (the honest answer: this parser does not know the word times).
 */
export function parseLrc(raw: string): LyricLine[] {
  if (!raw) return [];
  const offsetMs = readOffset(raw);
  const lines: LyricLine[] = [];

  for (const sourceLine of raw.split(/\r?\n/)) {
    const stamps = lineStamps(sourceLine);
    if (stamps.length === 0) continue;
    const text = stripStamps(sourceLine);
    for (const stamp of stamps) {
      lines.push({ timeMs: Math.max(0, stamp + offsetMs), text, words: [] });
    }
  }

  return lines.sort((a, b) => a.timeMs - b.timeMs);
}

/**
 * ENHANCED LRC — the line stamps AND the word stamps.
 *
 * The format is a line stamp followed by word stamps:
 *
 *     [00:12.00] <00:12.00> Hello <00:12.50> world
 *
 * A plain line (no word stamps) parses exactly as it does in `parseLrc` —
 * with no words. That is the fallback: a source that only knows when a
 * LINE is sung gets the line-level fill, never a made-up word time.
 */
export function parseEnhancedLrc(raw: string): LyricLine[] {
  if (!raw) return [];
  const offsetMs = readOffset(raw);
  const lines: LyricLine[] = [];

  for (const sourceLine of raw.split(/\r?\n/)) {
    const stamps = lineStamps(sourceLine);
    const words = wordTimings(sourceLine);
    if (stamps.length === 0 && words.length === 0) continue;

    const text = words.length > 0 ? words.map((word) => word.text).join(" ") : stripStamps(sourceLine);
    // A line with only word stamps starts at its first word.
    const times = stamps.length > 0 ? stamps : [words[0].timeMs];

    for (let index = 0; index < times.length; index++) {
      lines.push({
        timeMs: Math.max(0, times[index] + offsetMs),
        text,
        // The word times belong to the FIRST line stamp — a second stamp on
        // the same line repeats the line, and its word times are the first
        // one's.
        words:
          index === 0
            ? words.map((word) => ({ timeMs: Math.max(0, word.timeMs + offsetMs), text: word.text }))
            : [],
      });
    }
  }

  return lines.sort((a, b) => a.timeMs - b.timeMs);
}

/**
 * LRCLIB's own LYRICSFILE — the payload its API ships today.
 *
 * The file is YAML, but only a narrow slice of it is ever read: the
 * `lines:` block, with each line's text, its start and (when the record is
 * word-synced) its words and their starts. The plain `plain:` block and the
 * metadata are ignored.
 *
 * WHY A NARROW READER AND NOT A YAML LIBRARY: the shape is fixed and small
 * (the specification is public), and the app must not grow a YAML parser to
 * draw karaoke words.
 */
export function parseLyricsFile(raw: string): LyricLine[] {
  if (!raw || !raw.trim()) return [];

  interface Entry {
    text: string;
    timeMs: number | null;
  }

  const lines: LyricLine[] = [];
  let inLines = false;
  let inWords = false;
  let wordsIndent = 0;
  let line: { text: string; timeMs: number | null; words: Entry[] } | null = null;
  let word: Entry | null = null;

  const apply = (entry: Entry, key: string, value: string) => {
    if (key === "text") {
      entry.text = unquoteYaml(value);
    } else if (key === "start_ms") {
      const ms = Number(value);
      entry.timeMs = Number.isFinite(ms) ? ms : null;
    }
  };

  const flush = () => {
    if (!line) return;
    const words: LyricWord[] = [];
    for (const entry of line.words) {
      if (entry.timeMs === null) continue;
      const text = entry.text.trim();
      if (!text) continue;
      words.push({ timeMs: entry.timeMs, text });
    }
    // A line without a start cannot be placed in time — it is dropped.
    if (line.timeMs !== null) {
      lines.push({
        timeMs: line.timeMs,
        // The file's OWN text is the line's text — the words only fill it in.
        text:
          line.text.trim() ||
          (words.length > 0 ? words.map((word) => word.text).join(" ") : ""),
        words,
      });
    }
    line = null;
    word = null;
  };

  for (const rawLine of raw.split(/\r?\n/)) {
    if (!rawLine.trim()) continue;
    const indent = rawLine.length - rawLine.trimStart().length;
    const trimmed = rawLine.trim();

    if (indent === 0) {
      // A TOP-LEVEL key: only `lines:` is read.
      inLines = trimmed.startsWith("lines:");
      inWords = false;
      continue;
    }
    if (!inLines) continue;

    if (trimmed === "words:") {
      inWords = true;
      wordsIndent = indent;
      continue;
    }

    if (trimmed.startsWith("- ")) {
      const pair = splitYamlPair(trimmed.slice(2));
      if (inWords && indent > wordsIndent) {
        // A WORD entry.
        word = { text: "", timeMs: null };
        if (line) line.words.push(word);
        if (pair) apply(word, pair.key, pair.value);
        continue;
      }
      // A LINE entry.
      inWords = false;
      flush();
      line = { text: "", timeMs: null, words: [] };
      if (pair) apply(line, pair.key, pair.value);
      continue;
    }

    const pair = splitYamlPair(trimmed);
    if (!pair) continue;
    if (inWords && indent <= wordsIndent) {
      // The words block is OVER — these keys belong to the line again.
      inWords = false;
      word = null;
    }
    if (inWords && word) {
      apply(word, pair.key, pair.value);
    } else if (line) {
      apply(line, pair.key, pair.value);
    }
  }
  flush();

  return lines.sort((a, b) => a.timeMs - b.timeMs);
}

/** `key: value` → the pair (the FIRST colon splits; the value may hold one). */
function splitYamlPair(body: string): { key: string; value: string } | null {
  const colon = body.indexOf(":");
  if (colon < 0) return null;
  return { key: body.slice(0, colon).trim(), value: body.slice(colon + 1).trim() };
}

/** A YAML scalar, unquoted the way YAML unquotes it. */
function unquoteYaml(value: string): string {
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'");
  }
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
  return value;
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

/**
 * The word being sung at a position — (-1 when no word has started).
 *
 * It is the LAST word whose time has come: a word is sung FROM its own
 * time, so the word at the playhead is the one being sung.
 */
export function wordIndexAt(line: LyricLine, positionMs: number): number {
  const words = line.words;
  if (words.length === 0) return -1;
  let result = -1;
  for (let i = 0; i < words.length; i++) {
    if (words[i].timeMs <= positionMs) {
      result = i;
    } else {
      break;
    }
  }
  return result;
}

/**
 * The pieces of a line the karaoke fill paints.
 *
 * The line is walked word by word: each word takes the spacing in front of
 * it, so the segments, joined, are ALWAYS the line's own text — the fill
 * changes how the line looks, never what it says. A line with no word
 * timings comes back as one unsung piece (the line-level fill: the whole
 * line is painted by the pane's active colour).
 */
export function lyricSegments(line: LyricLine, positionMs: number): LyricSegment[] {
  const words = line.words;
  if (words.length === 0) return [{ text: line.text, sung: false }];

  const sungUpTo = wordIndexAt(line, positionMs);
  const segments: LyricSegment[] = [];
  let cursor = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const at = line.text.indexOf(word.text, cursor);
    // A word the line does not carry (a stale timing) is skipped, not
    // guessed at.
    if (at < 0) continue;
    segments.push({
      text: line.text.slice(cursor, at + word.text.length),
      sung: i <= sungUpTo,
    });
    cursor = at + word.text.length;
  }

  if (cursor < line.text.length) {
    segments.push({ text: line.text.slice(cursor), sung: false });
  }

  return segments;
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
    const data = (await response.json()) as {
      syncedLyrics?: string | null;
      plainLyrics?: string | null;
      lyricsfile?: string | null;
    };
    const raw = data.syncedLyrics || data.plainLyrics || "";
    if (!raw.trim() && !data.lyricsfile) return null;

    // The WORD timings: LRCLIB's own Lyricsfile carries them when the record
    // is word-synced. The enhanced LRC parser reads the classic `<mm:ss.xx>`
    // word stamps when a source uses those instead.
    const fromFile = data.lyricsfile ? parseLyricsFile(data.lyricsfile) : [];
    const wordSynced = fromFile.some((line) => line.words.length > 0);
    const parsed = wordSynced ? fromFile : parseEnhancedLrc(raw);
    const result = parsed.length > 0 ? parsed : [{ timeMs: 0, text: raw, words: [] }];
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
