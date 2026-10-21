import {
  countUnrated,
  isExplicitHidden,
  searchNote,
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
