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

export async function search(query: string, limit = 20): Promise<MediaTrack[]> {
  const q = query.trim();
  if (!q) return [];
  const tracks = (await native().search(q, limit)) as MediaTrack[];
  return Array.isArray(tracks) ? tracks : [];
}

export async function resolveAudio(id: string): Promise<ResolvedAudio> {
  return (await native().resolveAudio(id)) as ResolvedAudio;
}

export async function related(id: string): Promise<MediaTrack[]> {
  const tracks = (await native().related(id)) as MediaTrack[];
  return Array.isArray(tracks) ? tracks : [];
}

export type { MediaTrack, ResolvedAudio } from "./src/types";