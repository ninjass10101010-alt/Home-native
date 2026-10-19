import { requireNativeModule } from "expo-modules-core";
import type { MediaTrack, ResolvedAudio } from "./src/types";

const Native = requireNativeModule("YoutubeEngine");

export async function search(query: string, limit = 20): Promise<MediaTrack[]> {
  const q = query.trim();
  if (!q) return [];
  const tracks = (await Native.search(q, limit)) as MediaTrack[];
  return Array.isArray(tracks) ? tracks : [];
}

export async function resolveAudio(id: string): Promise<ResolvedAudio> {
  return (await Native.resolveAudio(id)) as ResolvedAudio;
}

export async function related(id: string): Promise<MediaTrack[]> {
  const tracks = (await Native.related(id)) as MediaTrack[];
  return Array.isArray(tracks) ? tracks : [];
}

export type { MediaTrack, ResolvedAudio } from "./src/types";