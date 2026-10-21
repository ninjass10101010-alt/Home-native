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
 * only when its rating is NOT MARKED EXPLICIT (`explicit === false`). A track
 * that is badged explicit (`true`) and a track whose rating is UNKNOWN (`null`
 * — the NewPipe fallback path, or a `related()` row) are both hidden, because
 * an unknown rating is no rating at all.
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

/**
 * The tracks the viewer may see, in order.
 *
 * The ONE place a list is filtered against the policy — the search results,
 * the queue, the history, the downloads tray and the chrome all read their
 * rows through this, so no surface can drift from the rule.
 */
export function visibleTracks<T extends Pick<MediaTrack, "explicit">>(
  tracks: T[],
  policy: ExplicitPolicy
): T[] {
  return tracks.filter((track) => !isExplicitHidden(track, policy));
}

/**
 * The first track the viewer may see, scanning from `start`.
 *
 * This is how the transport SKIPS what the viewer may not see: `direction` is
 * 1 (forward) or -1 (backward), and `wrap` lets the scan continue from the
 * far end (a "repeat all" queue). It returns -1 when the viewer may see
 * NOTHING in that direction — the caller must then STOP, never fall back to
 * a hidden track.
 */
export function findVisibleIndex(
  tracks: Pick<MediaTrack, "explicit">[],
  start: number,
  policy: ExplicitPolicy,
  direction: 1 | -1 = 1,
  wrap = false
): number {
  const n = tracks.length;
  if (n === 0) return -1;
  const begin = ((start % n) + n) % n;
  const count = wrap ? n : direction === 1 ? n - begin : begin + 1;
  for (let step = 0; step < count; step += 1) {
    const index = ((begin + direction * step) % n + n) % n;
    if (!isExplicitHidden(tracks[index], policy)) return index;
  }
  return -1;
}

/**
 * How many tracks carry no rating at all.
 *
 * `explicit == null` covers BOTH `null` (the NewPipe fallback path, or a
 * `related()` row) and a missing key — so this agrees with `isExplicitHidden`,
 * which hides anything that is not positively "not marked explicit".
 */
export function countUnrated(tracks: Pick<MediaTrack, "explicit">[]): number {
  return tracks.filter((t) => t.explicit == null).length;
}

/**
 * The honest states of a finished search.
 *
 * A kid must never read an empty list as "nothing found" when the truth is
 * "we hid them" — so every reason gets its own plain sentence, with no
 * jargon and no explanation paragraph.
 */
export const NOTE_UNKNOWN_RATINGS = "Couldn't check these tracks — ask a parent to pick something.";
export const NOTE_UNRATED_ALL = "These tracks aren't rated, so they can't be shown here.";
export const NOTE_UNRATED_SOME = "Some of these tracks aren't rated, so they can't be shown here.";
export const NOTE_NOTHING_HERE = "Nothing here to play — ask a parent to pick something.";
/** A parent is never told to "ask a parent" — this state is unreachable for them. */
export const NOTE_NOTHING_HERE_PARENT = "Nothing here to play.";
export const NOTE_NO_RESULTS = "No songs matched that search.";

export interface SearchFacts {
  /** How many tracks the viewer may see. */
  visible: number;
  /** How many tracks the engine returned. */
  total: number;
  /** How many of those carry no rating at all. */
  unrated: number;
  /** Whether the ratings were authoritative for this search. */
  explicitKnown: boolean;
  /** A parent role sees everything; every other role fails closed. */
  isParent: boolean;
}

export interface SearchNote {
  testID: string;
  text: string;
}

/**
 * Which honest state (if any) a finished search is in.
 *
 * The order IS the truth table:
 *
 * 1. Something to play → no note at all.
 * 2. The engine returned nothing → "no songs matched", but ONLY when the
 *    ratings were authoritative (or the viewer is a parent). A kid whose
 *    search ran on the fallback path is told the check could not be made:
 *    an empty list must never read as "nothing found" when the truth is
 *    "we could not check" (spec §6a — the honesty rule).
 * 3. A parent → nothing was hidden from them; never tell a parent to ask a parent.
 * 4. The ratings were never authoritative → the kid is told the check failed.
 * 5. Some rows carry no rating → the kid is told those rows were unrated.
 * 6. Otherwise every hidden row was known-explicit → "nothing here to play".
 */
export function searchNote(facts: SearchFacts): SearchNote | null {
  if (facts.visible > 0) return null;
  if (facts.total === 0) {
    return facts.isParent || facts.explicitKnown
      ? { testID: "music-search-note-empty", text: NOTE_NO_RESULTS }
      : { testID: "music-search-note-unknown", text: NOTE_UNKNOWN_RATINGS };
  }
  if (facts.isParent) return { testID: "music-search-note-parent", text: NOTE_NOTHING_HERE_PARENT };
  if (!facts.explicitKnown) return { testID: "music-search-note-unknown", text: NOTE_UNKNOWN_RATINGS };
  if (facts.unrated > 0) {
    return {
      testID: "music-search-note-unrated",
      text: facts.unrated >= facts.total ? NOTE_UNRATED_ALL : NOTE_UNRATED_SOME,
    };
  }
  return { testID: "music-search-note-explicit", text: NOTE_NOTHING_HERE };
}
