import {
  countUnrated,
  findVisibleIndex,
  isContentHidden,
  isDeniedTerm,
  isExplicitHidden,
  searchNote,
  visibleTracks,
  NOTE_NO_RESULTS,
  NOTE_NOTHING_HERE,
  NOTE_NOTHING_HERE_PARENT,
  NOTE_UNRATED_ALL,
  NOTE_UNRATED_SOME,
  NOTE_UNKNOWN_RATINGS,
  type SearchFacts,
} from "../src/music/explicit";

const track = (explicit: boolean | null) => ({
  id: "abc12345678", title: "Song", artist: "Artist", album: "",
  durationSeconds: 120, artworkUrl: null, explicit, source: "youtube_music" as const,
});

describe("explicit policy", () => {
  it("hides known-explicit tracks from kids while the filter is on", () => {
    expect(isExplicitHidden(track(true), { isParent: false, filterOn: true })).toBe(true);
  });
  it("shows known-explicit tracks to parents", () => {
    expect(isExplicitHidden(track(true), { isParent: true, filterOn: true })).toBe(false);
  });
  it("fails closed: kids never see an unrated track while the filter is on", () => {
    expect(isExplicitHidden(track(null), { isParent: false, filterOn: true })).toBe(true);
  });
  it("parents see unrated tracks", () => {
    expect(isExplicitHidden(track(null), { isParent: true, filterOn: true })).toBe(false);
  });
  it("a track that is not marked explicit is always visible", () => {
    expect(isExplicitHidden(track(false), { isParent: false, filterOn: true })).toBe(false);
  });
  it("with the filter off, kids see everything", () => {
    expect(isExplicitHidden(track(true), { isParent: false, filterOn: false })).toBe(false);
    expect(isExplicitHidden(track(null), { isParent: false, filterOn: false })).toBe(false);
  });
  it("with the filter off, a parent sees everything", () => {
    expect(isExplicitHidden(track(true), { isParent: true, filterOn: false })).toBe(false);
  });
  it("with the filter off, a kid still sees a clean track", () => {
    expect(isExplicitHidden(track(false), { isParent: false, filterOn: false })).toBe(false);
  });
  it("counts unrated tracks", () => {
    expect(countUnrated([track(null), track(false), track(true), track(null)])).toBe(2);
  });
  it("counts a missing rating as unrated, like the policy hides it", () => {
    const missing = { ...track(null), explicit: undefined as unknown as null };
    expect(countUnrated([missing])).toBe(1);
    expect(isExplicitHidden(missing, { isParent: false, filterOn: true })).toBe(true);
  });
});

/**
 * The search-note truth table.
 *
 * The rule, re-derived here from the contract (not from the implementation):
 * something to play → no note · nothing returned → "no songs matched" — but
 * ONLY when the ratings were authoritative or the viewer is a parent, because
 * a kid whose search ran on the fallback path must be told the check could
 * not be made, never shown an empty list that reads as "nothing found" ·
 * a parent → never told to ask a parent · ratings unknown → "couldn't check" ·
 * some rows unrated → the unrated sentence · otherwise → "nothing to play".
 */
function expectedTestId(facts: SearchFacts): string | null {
  if (facts.visible > 0) return null;
  if (facts.total === 0) {
    return facts.isParent || facts.explicitKnown
      ? "music-search-note-empty"
      : "music-search-note-unknown";
  }
  if (facts.isParent) return "music-search-note-parent";
  if (!facts.explicitKnown) return "music-search-note-unknown";
  if (facts.unrated > 0) return "music-search-note-unrated";
  return "music-search-note-explicit";
}

/** Every combination of (explicitKnown, isParent, visible, unrated, total). */
const ALL_COMBOS: SearchFacts[] = [];
for (const explicitKnown of [true, false]) {
  for (const isParent of [true, false]) {
    for (const visible of [0, 1, 2]) {
      for (const unrated of [0, 1, 2]) {
        for (const total of [0, 1, 2, 3]) {
          ALL_COMBOS.push({ explicitKnown, isParent, visible, unrated, total });
        }
      }
    }
  }
}

describe("search note", () => {
  it("lands in the honest state for every combination of the facts", () => {
    for (const facts of ALL_COMBOS) {
      const note = searchNote(facts);
      expect(note?.testID ?? null).toBe(expectedTestId(facts));
    }
  });

  it("shows no note when there is something to play", () => {
    expect(searchNote({ visible: 2, total: 2, unrated: 0, explicitKnown: true, isParent: false })).toBeNull();
    expect(searchNote({ visible: 1, total: 3, unrated: 1, explicitKnown: false, isParent: false })).toBeNull();
  });

  it("never tells a parent to ask a parent", () => {
    for (const facts of ALL_COMBOS.filter((f) => f.isParent)) {
      const note = searchNote(facts);
      if (!note) continue;
      expect(note.text).not.toContain("ask a parent");
      expect(note.text).not.toContain("Couldn't check");
    }
  });

  it("shows 'no results' only when the engine returned nothing AND the ratings were authoritative", () => {
    for (const facts of ALL_COMBOS) {
      const note = searchNote(facts);
      if (!note) continue;
      if (note.text === NOTE_NO_RESULTS) {
        expect(facts.total).toBe(0);
        expect(facts.isParent || facts.explicitKnown).toBe(true);
      } else if (facts.total === 0) {
        // Zero tracks with no authority over the ratings: the check could not
        // be made, so the kid is told THAT — never "nothing found".
        expect(note.text).toBe(NOTE_UNKNOWN_RATINGS);
      } else {
        expect(facts.total).toBeGreaterThan(0);
      }
    }
  });

  it("always explains an empty list to a kid", () => {
    for (const facts of ALL_COMBOS) {
      if (facts.isParent || facts.visible > 0) continue;
      expect(searchNote(facts)).not.toBeNull();
    }
  });

  it("tells a kid the check could not be made when the search returned zero tracks on the fallback path", () => {
    const note = searchNote({ visible: 0, total: 0, unrated: 0, explicitKnown: false, isParent: false });
    expect(note?.testID).toBe("music-search-note-unknown");
    expect(note?.text).toBe(NOTE_UNKNOWN_RATINGS);
    expect(note?.text).not.toBe(NOTE_NO_RESULTS);
  });

  it("says nothing matched when the search returned zero tracks and the ratings were authoritative", () => {
    const note = searchNote({ visible: 0, total: 0, unrated: 0, explicitKnown: true, isParent: false });
    expect(note?.testID).toBe("music-search-note-empty");
    expect(note?.text).toBe(NOTE_NO_RESULTS);
  });

  it("says nothing matched to a parent even when the ratings were never authoritative", () => {
    const note = searchNote({ visible: 0, total: 0, unrated: 0, explicitKnown: false, isParent: true });
    expect(note?.testID).toBe("music-search-note-empty");
    expect(note?.text).toBe(NOTE_NO_RESULTS);
  });

  it("says the check failed when the ratings were never authoritative", () => {
    const note = searchNote({ visible: 0, total: 2, unrated: 2, explicitKnown: false, isParent: false });
    expect(note?.testID).toBe("music-search-note-unknown");
    expect(note?.text).toBe(NOTE_UNKNOWN_RATINGS);
  });

  it("says every track is unrated only when every hidden track is unrated", () => {
    const all = searchNote({ visible: 0, total: 2, unrated: 2, explicitKnown: true, isParent: false });
    expect(all?.testID).toBe("music-search-note-unrated");
    expect(all?.text).toBe(NOTE_UNRATED_ALL);
  });

  it("says SOME tracks are unrated when only some hidden tracks are unrated", () => {
    const some = searchNote({ visible: 0, total: 3, unrated: 2, explicitKnown: true, isParent: false });
    expect(some?.testID).toBe("music-search-note-unrated");
    expect(some?.text).toBe(NOTE_UNRATED_SOME);
    expect(some?.text).not.toBe(NOTE_UNRATED_ALL);
  });

  it("says nothing here to play when every hidden track was known-explicit", () => {
    const note = searchNote({ visible: 0, total: 2, unrated: 0, explicitKnown: true, isParent: false });
    expect(note?.testID).toBe("music-search-note-explicit");
    expect(note?.text).toBe(NOTE_NOTHING_HERE);
  });

  it("gives a parent a parent-safe sentence (never 'ask a parent')", () => {
    const note = searchNote({ visible: 0, total: 2, unrated: 1, explicitKnown: false, isParent: true });
    expect(note?.testID).toBe("music-search-note-parent");
    expect(note?.text).toBe(NOTE_NOTHING_HERE_PARENT);
  });
});

/**
 * The queue's visible scan — how the transport SKIPS what the viewer may not
 * see. The rule, re-derived here from the contract: the scan returns the
 * first track the viewer may see at or after the start (forward) or at or
 * before it (backward), and -1 when there is nothing to see in that
 * direction — the caller must then STOP, never fall back to a hidden track.
 */
describe("the visible scan", () => {
  const KID = { isParent: false, filterOn: true };
  const PARENT = { isParent: true, filterOn: true };

  it("finds the first track the viewer may see", () => {
    expect(findVisibleIndex([track(false), track(true), track(false)], 0, KID)).toBe(0);
    expect(findVisibleIndex([track(true), track(false)], 0, KID)).toBe(1);
  });

  it("skips the hidden tracks between the start and the next visible one", () => {
    expect(findVisibleIndex([track(false), track(true), track(null), track(false)], 1, KID)).toBe(3);
  });

  it("stops at the end instead of wrapping when the queue does not repeat", () => {
    expect(findVisibleIndex([track(false), track(true)], 1, KID)).toBe(-1);
  });

  it("wraps to the far end when the queue repeats all", () => {
    expect(findVisibleIndex([track(false), track(true)], 1, KID, 1, true)).toBe(0);
  });

  it("scans backwards for the previous track", () => {
    expect(findVisibleIndex([track(true), track(false), track(true)], 2, KID, -1)).toBe(1);
    expect(findVisibleIndex([track(true), track(false), track(true)], 2, KID, -1, true)).toBe(1);
  });

  it("returns -1 when the viewer may see nothing in that direction", () => {
    expect(findVisibleIndex([track(true), track(null)], 0, KID)).toBe(-1);
    expect(findVisibleIndex([track(true), track(null)], 0, KID, -1)).toBe(-1);
    expect(findVisibleIndex([], 0, KID)).toBe(-1);
  });

  it("a parent sees every track, so the scan never blocks them", () => {
    expect(findVisibleIndex([track(true)], 0, PARENT)).toBe(0);
    expect(findVisibleIndex([track(true), track(null)], 1, PARENT)).toBe(1);
  });

  it("with the filter off, a kid sees every track too", () => {
    const off = { isParent: false, filterOn: false };
    expect(findVisibleIndex([track(true), track(null)], 0, off)).toBe(0);
  });

  it("filters a list down to what the viewer may see", () => {
    const list = [track(false), track(true), track(null)];
    expect(visibleTracks(list, KID).map((t) => t.explicit)).toEqual([false]);
    expect(visibleTracks(list, PARENT)).toHaveLength(3);
  });

  it("a list with a missing rating is filtered out for a kid", () => {
    const missing = { ...track(null), explicit: undefined as unknown as null };
    expect(visibleTracks([missing], KID)).toHaveLength(0);
  });
});

/**
 * The family's own deny-list — a SECOND signal beside the one-sided YouTube
 * badge. The badge MARKS the explicit tracks; it does not certify the rest,
 * so an unbadged explicit song can still reach a kid. The deny-list is the
 * family's own answer to that gap.
 *
 * The rule, re-derived here from the contract (not from the implementation):
 * ONE list, matched case-insensitively as a SUBSTRING against BOTH the artist
 * and the title, whitespace-normalized on both sides; an EMPTY term never
 * matches; a PARENT is never blocked; and the deny rule holds even while the
 * explicit filter is OFF — the filter setting governs the badge, never the
 * family's own list.
 */
describe("deny-list policy", () => {
  const track = (explicit: boolean | null, artist: string, title: string) => ({
    explicit, artist, title,
  });

  it("matches a term against the artist, case-insensitively", () => {
    expect(isDeniedTerm(track(false, "Eminem", "Till I Collapse"), ["eminem"])).toBe(true);
  });
  it("matches a term against the title", () => {
    expect(isDeniedTerm(track(false, "Someone", "Lose Yourself"), ["lose yourself"])).toBe(true);
  });
  it("normalizes whitespace and case on both sides", () => {
    expect(isDeniedTerm(track(false, "  Eminem  ", "x"), ["EMINEM"])).toBe(true);
  });
  it("does not match an unrelated term", () => {
    expect(isDeniedTerm(track(false, "Adele", "Hello"), ["eminem"])).toBe(false);
  });
  it("an empty term never matches", () => {
    expect(isDeniedTerm(track(false, "Eminem", "x"), ["", "   "])).toBe(false);
  });
  it("hides a denied track from a kid", () => {
    expect(isContentHidden(track(false, "Eminem", "x"), { isParent: false, filterOn: true, denied: ["eminem"] })).toBe(true);
  });
  it("never hides a track from a parent", () => {
    expect(isContentHidden(track(true, "Eminem", "x"), { isParent: true, filterOn: true, denied: ["eminem"] })).toBe(false);
  });
  it("applies the deny rule even with the explicit filter OFF", () => {
    expect(isContentHidden(track(false, "Eminem", "x"), { isParent: false, filterOn: false, denied: ["eminem"] })).toBe(true);
  });
  it("keeps the explicit rule: a kid sees only not-marked-explicit tracks while the filter is on", () => {
    expect(isContentHidden(track(false, "Adele", "Hello"), { isParent: false, filterOn: true, denied: [] })).toBe(false);
    expect(isContentHidden(track(true, "Adele", "Hello"), { isParent: false, filterOn: true, denied: [] })).toBe(true);
    expect(isContentHidden(track(null, "Adele", "Hello"), { isParent: false, filterOn: true, denied: [] })).toBe(true);
  });
  it("keeps the explicit rule switch: with the filter off, a kid sees an explicit track", () => {
    expect(isContentHidden(track(true, "Adele", "Hello"), { isParent: false, filterOn: false, denied: [] })).toBe(false);
  });
});
