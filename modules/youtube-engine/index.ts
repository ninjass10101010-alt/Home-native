import { requireNativeModule } from "expo-modules-core";
import type { MediaTrack, ResolvedAudio } from "./src/types";

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
  return { tracks, explicitKnown: result?.explicitKnown !== false };
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

export type { MediaTrack, ResolvedAudio } from "./src/types";