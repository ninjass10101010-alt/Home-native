import { countUnrated, isExplicitHidden } from "../src/music/explicit";

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
  it("known-clean tracks are always visible", () => {
    expect(isExplicitHidden(track(false), { isParent: false, filterOn: true })).toBe(false);
  });
  it("with the filter off, kids see everything", () => {
    expect(isExplicitHidden(track(true), { isParent: false, filterOn: false })).toBe(false);
    expect(isExplicitHidden(track(null), { isParent: false, filterOn: false })).toBe(false);
  });
  it("counts unrated tracks", () => {
    expect(countUnrated([track(null), track(false), track(true), track(null)])).toBe(2);
  });
});
