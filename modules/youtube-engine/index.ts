import { requireNativeModule } from "expo-modules-core";
import type { ArtworkColors, MediaTrack, ResolvedAudio } from "./src/types";

/**
 * The native module is resolved LAZILY, at call time.
 *
 * `requireNativeModule` throws at IMPORT time when the module is absent (web
 * preview, or a device build without the native side), and expo-router
 * imports every route eagerly - so a module-scope lookup took the whole app
 * tree down (the wall never rendered) instead of failing the one probe
 * screen that uses it.
 */
function native(): any {
  return requireNativeModule("YoutubeEngine");
}

/**
 * The answer to one search.
 *
 * `explicitKnown` says whether the ratings in `tracks` are AUTHORITATIVE:
 * `false` only when the native engine took its fallback path (NewPipe), where
 * every track's rating is unknown (`explicit === null`). It is read from THAT
 * call's native result — never from a global — so a degraded search can never
 * be mistaken for a rated one.
 */
export interface SearchOutcome {
  tracks: MediaTrack[];
  /** false when the engine fell back and ratings are unknown. */
  explicitKnown: boolean;
}

const SEARCH_CACHE_LIMIT = 50;
const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const searchCache = new Map<string, { outcome: SearchOutcome; expiresAt: number }>();
const inFlightSearch = new Map<string, Promise<SearchOutcome>>();

export async function search(query: string, limit = 20): Promise<SearchOutcome> {
  const q = query.trim();
  if (!q) return { tracks: [], explicitKnown: true };
  const cacheKey = `${q.toLowerCase()}#${limit}`;
  const now = Date.now();
  const cached = searchCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.outcome;
  }
  const existing = inFlightSearch.get(cacheKey);
  if (existing) return existing;

  const task = (async (): Promise<SearchOutcome> => {
    const result = (await native().search(q, limit)) as Partial<SearchOutcome> & {
      tracks?: MediaTrack[];
    };
    const tracks = Array.isArray(result?.tracks) ? result.tracks : [];
    // A shape mismatch (a missing or non-boolean flag) means the ratings are NOT
    // known — never claim authority the native result did not give.
    const outcome: SearchOutcome = {
      tracks,
      explicitKnown: typeof result?.explicitKnown === "boolean" ? result.explicitKnown : false,
    };
    // Cache only authoritative non-empty outcomes so a degraded fallback or transient
    // empty result never sticks in memory.
    if (outcome.explicitKnown && outcome.tracks.length > 0) {
      if (searchCache.size >= SEARCH_CACHE_LIMIT) {
        const oldest = searchCache.keys().next().value;
        if (oldest !== undefined) searchCache.delete(oldest);
      }
      searchCache.set(cacheKey, { outcome, expiresAt: Date.now() + SEARCH_CACHE_TTL_MS });
    }
    return outcome;
  })();

  inFlightSearch.set(cacheKey, task);
  try {
    return await task;
  } finally {
    inFlightSearch.delete(cacheKey);
  }
}

/**
 * The stream the engine resolved LAST.
 *
 * The Now Playing screen labels the stream it is playing — the codec and the
 * stream's own bitrate — and the resolution happens in the playback provider
 * (local playback) and in the cast provider (the receiver's load). Both go
 * through this wrapper, so this is the ONE place that knows what the last
 * resolution was.
 *
 * The track's id travels WITH the format: a chip may only speak for the
 * track it belongs to, never for whatever resolved last.
 */
export interface StreamFormat {
  /** The track the stream belongs to. */
  id: string;
  /** The stream's container (e.g. "audio/mp4"). */
  mimeType: string | null;
  /** The stream's average bitrate, in bits per second. */
  bitrate: number | null;
  /** The stream's own codec ("mp4a.40.2", "opus", "vorbis"). */
  codec: string | null;
}

/** The last resolution, or null when nothing has resolved yet. */
let lastStream: StreamFormat | null = null;

/** The surfaces that want to know when a stream resolves. */
const streamListeners = new Set<(format: StreamFormat) => void>();

/**
 * The stream the engine resolved last — the codec chip's truth.
 */
export function lastStreamFormat(): StreamFormat | null {
  return lastStream;
}

/**
 * Subscribe to the stream resolutions.
 *
 * The listener is called with every resolution (the local one and the
 * receiver's), and the returned function unsubscribes it.
 */
export function subscribeStreamFormat(
  listener: (format: StreamFormat) => void
): () => void {
  streamListeners.add(listener);
  return () => {
    streamListeners.delete(listener);
  };
}

const AUDIO_CACHE_LIMIT = 50;
const STREAM_EXPIRY_SAFETY_MS = 60 * 1000;

interface CachedStream {
  audio: ResolvedAudio;
  format: StreamFormat;
  expiresAt: number;
}

const audioCache = new Map<string, CachedStream>();
const inFlightAudio = new Map<string, Promise<{ raw: ResolvedAudio; entry: CachedStream | null }>>();

async function resolveAudioInternal(
  id: string
): Promise<{ raw: ResolvedAudio; entry: CachedStream | null }> {
  const cached = audioCache.get(id);
  if (cached && cached.expiresAt > Date.now() + STREAM_EXPIRY_SAFETY_MS) {
    return { raw: cached.audio, entry: cached };
  }
  const existing = inFlightAudio.get(id);
  if (existing) return existing;

  const task = (async () => {
    const raw = (await native().resolveAudio(id)) as ResolvedAudio;
    const answer = raw && typeof raw === "object" ? raw : null;
    const bitrate =
      typeof answer?.bitrate === "number" && Number.isFinite(answer.bitrate)
        ? answer.bitrate
        : null;
    const codec =
      typeof answer?.codec === "string" && answer.codec.length > 0 ? answer.codec : null;
    const format: StreamFormat = {
      id,
      mimeType: typeof answer?.mimeType === "string" ? answer.mimeType : null,
      bitrate,
      codec,
    };
    if (!answer) {
      return { raw, entry: null };
    }
    const normalized: ResolvedAudio = { ...answer, bitrate, codec };
    const expiresAt =
      typeof answer.expiresAt === "number" && Number.isFinite(answer.expiresAt)
        ? answer.expiresAt
        : 0;
    const entry: CachedStream = { audio: normalized, format, expiresAt };
    if (
      typeof normalized.url === "string" &&
      normalized.url.length > 0 &&
      expiresAt > Date.now() + STREAM_EXPIRY_SAFETY_MS
    ) {
      if (audioCache.size >= AUDIO_CACHE_LIMIT) {
        const oldest = audioCache.keys().next().value;
        if (oldest !== undefined) audioCache.delete(oldest);
      }
      audioCache.set(id, entry);
    }
    return { raw: normalized, entry };
  })();

  inFlightAudio.set(id, task);
  try {
    return await task;
  } finally {
    inFlightAudio.delete(id);
  }
}

/**
 * The playable URL for one track, and the stream's own truth.
 *
 * The shape cannot lie: the bitrate is a number or it is null — a native
 * answer that carries no rate (or a wrongly typed one) is no rate, never a
 * made-up value. Every other field is passed through untouched, so the
 * cast path's media info is byte-identical to what it always was.
 */
export async function resolveAudio(id: string): Promise<ResolvedAudio> {
  const { raw, entry } = await resolveAudioInternal(id);
  const format: StreamFormat = entry
    ? entry.format
    : {
        id,
        mimeType: null,
        bitrate: null,
        codec: null,
      };
  lastStream = format;
  for (const listener of streamListeners) listener(format);
  // A native answer that is not an answer is passed through untouched: the
  // caller must see the SAME failure it always saw (no stream at all), never
  // a half-built one with a missing URL.
  return entry ? entry.audio : raw;
}

/**
 * Pre-resolves a track's playable stream in the background into the bounded
 * stream cache without mutating `lastStream` or firing `streamListeners` for
 * whatever is currently playing on the stage.
 *
 * When `resolveAudio(id)` is later called for playback, the cached stream is
 * returned in 0ms and `streamListeners` are notified at that moment.
 */
export async function prefetchAudio(id: string): Promise<ResolvedAudio | null> {
  const key = id.trim();
  if (!key) return null;
  try {
    const { entry } = await resolveAudioInternal(key);
    return entry ? entry.audio : null;
  } catch {
    return null;
  }
}

const RELATED_CACHE_LIMIT = 50;
const RELATED_CACHE_TTL_MS = 10 * 60 * 1000;
const relatedCache = new Map<string, { tracks: MediaTrack[]; expiresAt: number }>();
const inFlightRelated = new Map<string, Promise<MediaTrack[]>>();

/**
 * The related tracks for one video.
 *
 * The native side resolves these over NewPipe, which exposes no explicit
 * badge: every row's rating is UNKNOWN (`explicit === null`). The shape stays
 * a plain array — a related row is never authoritative.
 */
export async function related(id: string): Promise<MediaTrack[]> {
  const key = id.trim();
  if (!key) return [];
  const now = Date.now();
  const cached = relatedCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.tracks;
  }
  const existing = inFlightRelated.get(key);
  if (existing) return existing;

  const task = (async (): Promise<MediaTrack[]> => {
    const tracks = (await native().related(key)) as MediaTrack[];
    const list = Array.isArray(tracks) ? tracks : [];
    if (list.length > 0) {
      if (relatedCache.size >= RELATED_CACHE_LIMIT) {
        const oldest = relatedCache.keys().next().value;
        if (oldest !== undefined) relatedCache.delete(oldest);
      }
      relatedCache.set(key, { tracks: list, expiresAt: Date.now() + RELATED_CACHE_TTL_MS });
    }
    return list;
  })();

  inFlightRelated.set(key, task);
  try {
    return await task;
  } finally {
    inFlightRelated.delete(key);
  }
}

/**
 * Clears in-memory search, related, and resolved-stream caches (used by tests
 * or on explicit cache reset).
 */
export function clearEngineCaches(): void {
  searchCache.clear();
  inFlightSearch.clear();
  audioCache.clear();
  inFlightAudio.clear();
  relatedCache.clear();
  inFlightRelated.clear();
}

/**
 * The cache's ceiling.
 *
 * A cover is read once and then remembered for the session; the ceiling
 * keeps a long listening session from growing the cache without end. The
 * oldest entry is dropped first.
 */
const ARTWORK_CACHE_LIMIT = 100;

/**
 * The colours already read, by artwork URL.
 *
 * A module-level cache, not a state one: the colours are a property of the
 * cover, not of the screen, and the stage asks for the same cover again
 * every time the track comes back around.
 */
const artworkCache = new Map<string, ArtworkColors>();

/**
 * The artwork's own colour, read on-device.
 *
 * The extraction happens in the native module (AndroidX Palette), off Expo's
 * shared async queue, and it never throws there. This wrapper adds the two
 * things JS is good at: a shape that cannot lie (a missing or wrongly typed
 * field becomes null, never a made-up colour) and a small cache so a cover
 * is read once.
 *
 * A failure — a dead network, a 404, a build without the native module —
 * answers with two nulls, and the stage falls back to the accent token.
 */
export async function artworkColors(url: string): Promise<ArtworkColors> {
  const key = url.trim();
  if (!key) return { dominant: null, vibrant: null };
  const cached = artworkCache.get(key);
  if (cached) return cached;

  let answer: ArtworkColors = { dominant: null, vibrant: null };
  try {
    const raw = (await native().artworkColors(key)) as
      | Partial<ArtworkColors>
      | null
      | undefined;
    answer = {
      dominant: typeof raw?.dominant === "string" ? raw.dominant : null,
      vibrant: typeof raw?.vibrant === "string" ? raw.vibrant : null,
    };
  } catch {
    // The native side never throws, but a build without the module (the web
    // preview) does — and the answer is the same either way: no colour.
    answer = { dominant: null, vibrant: null };
  }

  if (artworkCache.size >= ARTWORK_CACHE_LIMIT) {
    const oldest = artworkCache.keys().next().value;
    if (oldest !== undefined) artworkCache.delete(oldest);
  }
  artworkCache.set(key, answer);
  return answer;
}

export type { ArtworkColors, MediaTrack, ResolvedAudio } from "./src/types";

/**
 * The blurred artwork's radius, in the image's own pixels.
 *
 * The default is the one the spec asks for: a radius that fully obscures the
 * artwork's detail (~24dp equivalent), so nothing under the title can be
 * read.
 */
export const ARTWORK_BLUR_RADIUS = 24;

/**
 * The blurred artwork, by artwork URL and radius.
 *
 * The native side downloads the cover, blurs it (a colour field, not a
 * picture), writes it into the app's cache and answers with a `file://` URI.
 *
 * The contract is the same one the colour extraction has, and for the same
 * reason — a backdrop is an ENHANCEMENT, never a blocker:
 *
 *  - It NEVER rejects. A dead network, a 404, a body that is not an image, a
 *    build without the native module — every one of them answers with null,
 *    and the app paints the unblurred cover under the tint scrim.
 *  - It NEVER invents a URI. A native answer that is not a string becomes
 *    null, never a made-up path.
 *  - It NEVER logs the URL. The logging discipline is the native side's.
 *
 * A NULL IS CACHED TOO: a cover that could not be blurred must not be asked
 * again on every render of the stage.
 */
const blurredCache = new Map<string, string | null>();

export async function artworkBlurred(
  url: string,
  radius: number = ARTWORK_BLUR_RADIUS
): Promise<string | null> {
  const key = url.trim();
  if (!key) return null;
  const cacheKey = `${key}#${radius}`;
  const cached = blurredCache.get(cacheKey);
  if (cached !== undefined) return cached;

  let answer: string | null = null;
  try {
    const raw = (await native().artworkBlurred(key, radius)) as unknown;
    answer = typeof raw === "string" && raw.length > 0 ? raw : null;
  } catch {
    // The native side never rejects, but a build without the module (the web
    // preview) does — and the answer is the same either way: no blur.
    answer = null;
  }

  if (blurredCache.size >= ARTWORK_CACHE_LIMIT) {
    const oldest = blurredCache.keys().next().value;
    if (oldest !== undefined) blurredCache.delete(oldest);
  }
  blurredCache.set(cacheKey, answer);
  return answer;
}