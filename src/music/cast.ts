import type { MediaTrack } from "./types";

export type CastStateValue =
  | "unavailable"
  | "noDevicesAvailable"
  | "notConnected"
  | "connecting"
  | "connected";

export interface CastTarget { id: string; name: string }

export interface CastResolution {
  url: string;
  mimeType: string;
  durationSeconds: number | null;
}

const STATES: readonly CastStateValue[] = [
  "noDevicesAvailable", "notConnected", "connecting", "connected",
];

export function normalizeCastState(raw: string | null | undefined): CastStateValue {
  return raw && (STATES as readonly string[]).includes(raw) ? (raw as CastStateValue) : "unavailable";
}

export function toTargets(devices: { deviceId: string; friendlyName: string }[]): CastTarget[] {
  const seen = new Set<string>();
  const targets: CastTarget[] = [];
  for (const device of devices) {
    const name = device.friendlyName.trim();
    if (!device.deviceId || !name || seen.has(device.deviceId)) continue;
    seen.add(device.deviceId);
    targets.push({ id: device.deviceId, name });
  }
  return targets.sort((a, b) => a.name.localeCompare(b.name));
}

export function castMediaInfo(track: MediaTrack, resolved: CastResolution) {
  return {
    contentUrl: resolved.url,
    contentType: resolved.mimeType,
    contentId: track.id,
    streamType: "buffered" as const,
    ...(resolved.durationSeconds !== null ? { streamDuration: resolved.durationSeconds } : {}),
    metadata: {
      type: "musicTrack" as const,
      title: track.title,
      artist: track.artist,
      albumTitle: track.album,
      ...(track.artworkUrl ? { images: [{ url: track.artworkUrl }] } : {}),
    },
  };
}

export function castStatusAction(
  status: { playerState?: string | null; idleReason?: string | null } | null | undefined,
): "advance" | "error" | "none" {
  if (!status || status.playerState !== "idle") return "none";
  if (status.idleReason === "finished") return "advance";
  if (status.idleReason === "error") return "error";
  return "none";
}

export function castErrorCopy(name: string): string {
  return `Couldn't cast to ${name}.`;
}
