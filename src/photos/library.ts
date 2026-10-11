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
