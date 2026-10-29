import { api } from "../api/client";
import { getBaseUrl } from "../api/config";
import { getSessionCookie } from "../api/session";

/**
 * The ONE photo-source + moderation seam — shared by the Home hero widget
 * (rotation) and the Photos page (management grid) so a cookie/key drift can
 * never make them disagree (the slot.ts "one shared rule" contract).
 */

export interface WallPhoto {
  id: string;
  url: string; // "/api/photos/file?r=<id>&f=<filename>" — session cookie required
  width: number;
  height: number;
  takenAt: string;
  caption?: string;
  album?: string;
  /** Management feed only (GET /api/photos?all=1): omitted on the wall feed. */
  showOnWall?: boolean;
}

export type PhotoTransition = "crossfade" | "dissolve" | "slide" | "cut";
export type PhotoOrder = "shuffle" | "newest" | "oldest";

export interface PhotoSettings {
  rotateSeconds: number; // clamped 10–600, default 75
  transition: PhotoTransition;
  order: PhotoOrder;
  showCaption: boolean;
}

export const DEFAULT_PHOTO_SETTINGS: PhotoSettings = {
  rotateSeconds: 75,
  transition: "crossfade",
  order: "shuffle",
  showCaption: true,
};

export const PHOTO_TRANSITION_OPTIONS: { id: PhotoTransition; label: string; description: string }[] = [
  { id: "crossfade", label: "Crossfade", description: "Smooth fade between photos" },
  { id: "dissolve", label: "Dissolve", description: "Soft dissolve blend" },
  { id: "slide", label: "Slide", description: "Horizontal slide motion" },
  { id: "cut", label: "Cut", description: "Instant change" },
];

export const PHOTO_ROTATE_PRESETS = [
  { seconds: 30, label: "Fast · 30s" },
  { seconds: 75, label: "Normal · 75s" },
  { seconds: 300, label: "Slow · 5m" },
] as const;

export const PHOTO_ORDER_OPTIONS: { id: PhotoOrder; label: string; description: string }[] = [
  { id: "shuffle", label: "Shuffle", description: "Daily seeded mix" },
  { id: "newest", label: "Newest", description: "Most recent first" },
  { id: "oldest", label: "Oldest", description: "Oldest memories first" },
];

/** Clamp rotate seconds into [10, 600]. */
export function clampRotateSeconds(raw: unknown): number {
  const num = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(num)) return DEFAULT_PHOTO_SETTINGS.rotateSeconds;
  return Math.max(10, Math.min(600, Math.round(num)));
}

/** Server validates order (400 on unknown) — clamp the interval like the web. */
export function clampSettings(s: Partial<PhotoSettings>): PhotoSettings {
  return {
    rotateSeconds: clampRotateSeconds(s.rotateSeconds),
    transition: s.transition && ["crossfade", "dissolve", "slide", "cut"].includes(s.transition) ? s.transition : DEFAULT_PHOTO_SETTINGS.transition,
    order: s.order && ["shuffle", "newest", "oldest"].includes(s.order) ? s.order : DEFAULT_PHOTO_SETTINGS.order,
    showCaption: s.showCaption !== undefined ? Boolean(s.showCaption) : DEFAULT_PHOTO_SETTINGS.showCaption,
  };
}

/** Fetch shared wall photo settings. */
export async function getPhotoSettings(): Promise<{ settings: PhotoSettings; degraded: boolean }> {
  try {
    const res = await api<{ ok: boolean; settings: PhotoSettings; degraded?: boolean }>("/api/photos/settings");
    return {
      settings: res?.settings ? clampSettings(res.settings) : DEFAULT_PHOTO_SETTINGS,
      degraded: !!res?.degraded,
    };
  } catch {
    return {
      settings: DEFAULT_PHOTO_SETTINGS,
      degraded: true,
    };
  }
}

/** Update shared photo settings (parent only on backend). */
export async function updatePhotoSettings(patch: Partial<PhotoSettings>): Promise<PhotoSettings> {
  const res = await api<{ ok: boolean; settings: PhotoSettings }>("/api/photos/settings", {
    method: "PATCH",
    body: patch,
  });
  return res?.settings ? clampSettings(res.settings) : DEFAULT_PHOTO_SETTINGS;
}

/** Cookie-authenticated RN Image source for a photo file URL (RN fresco). */
export function photoSource(p: Pick<WallPhoto, "url">) {
  const cookie = getSessionCookie();
  return {
    uri: `${getBaseUrl()}${p.url}`,
    headers: cookie ? { Cookie: `consuela_session=${cookie}` } : undefined,
  };
}

/**
 * PATCH /api/photos {id, showOnWall} — the moderation lever. Server is the
 * authority: it re-reads the live parent identity (verifyLiveParentSession)
 * and refuses non-parents (401/403); the client never judges the role from a
 * stale cookie claim.
 */
export async function setPhotoShowOnWall(id: string, showOnWall: boolean) {
  return api<{ ok: boolean }>("/api/photos", {
    method: "PATCH",
    body: { id, showOnWall },
  });
}
