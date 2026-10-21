import type { MediaTrack } from "./types";

export interface ExplicitPolicy {
  /** A parent role sees everything; kid roles (child/pet/guest) fail closed. */
  isParent: boolean;
  /** The family setting: when off, nothing is filtered at all. */
  filterOn: boolean;
}

/**
 * Whether a track must be hidden from the viewer.
 *
 * The policy FAILS CLOSED: while the filter is on, a kid role sees a track
 * only when its rating is KNOWN CLEAN (`explicit === false`). A track that is
 * badged explicit (`true`) and a track whose rating is UNKNOWN (`null` — the
 * NewPipe fallback path, or a `related()` row) are both hidden, because an
 * unknown rating is not a clean rating.
 */
export function isExplicitHidden(
  track: Pick<MediaTrack, "explicit">,
  policy: ExplicitPolicy
): boolean {
  if (!policy.filterOn) return false;
  if (policy.isParent) return false;
  if (track.explicit === false) return false;
  return true; // explicit === true, or unknown (null) -> hidden for kids
}

/** How many tracks carry no rating at all (`explicit === null`). */
export function countUnrated(tracks: Pick<MediaTrack, "explicit">[]): number {
  return tracks.filter((t) => t.explicit === null).length;
}
