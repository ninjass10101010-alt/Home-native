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

export async function search(query: string, limit = 20): Promise<SearchOutcome> {
  const q = query.trim();
  if (!q) return { tracks: [], explicitKnown: true };
  const result = (await native().search(q, limit)) as Partial<SearchOutcome> & {
    tracks?: MediaTrack[];
  };
  const tracks = Array.isArray(result?.tracks) ? result.tracks : [];
  // A shape mismatch (a missing or non-boolean flag) means the ratings are NOT
  // known — never claim authority the native result did not give.
  return {
    tracks,
    explicitKnown: typeof result?.explicitKnown === "boolean" ? result.explicitKnown : false,
  };
}

export async function resolveAudio(id: string): Promise<ResolvedAudio> {
  return (await native().resolveAudio(id)) as ResolvedAudio;
}

/**
 * The related tracks for one video.
 *
 * The native side resolves these over NewPipe, which exposes no explicit
 * badge: every row's rating is UNKNOWN (`explicit === null`). The shape stays
 * a plain array — a related row is never authoritative.
 */
export async function related(id: string): Promise<MediaTrack[]> {
  const tracks = (await native().related(id)) as MediaTrack[];
  return Array.isArray(tracks) ? tracks : [];
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