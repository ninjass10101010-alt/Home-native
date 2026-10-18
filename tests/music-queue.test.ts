import {
  createQueue,
  cycleRepeat,
  moveInQueue,
  nextIndex,
  previousIndex,
  removeAt,
  toggleShuffle,
} from "../src/music/queue";
import type { MediaTrack } from "../src/music/types";

const track = (id: string): MediaTrack => ({
  id,
  title: `T-${id}`,
  artist: "A",
  album: "",
  durationSeconds: 120,
  artworkUrl: null,
  explicit: false,
  source: "youtube_music",
});

const tracks = ["a", "b", "c", "d"].map(track);

describe("music queue", () => {
  it("creates a queue at the requested track", () => {
    const q = createQueue(tracks, 2);
    expect(q.index).toBe(2);
    expect(q.tracks.map((t) => t.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("advances, stops at the end, and wraps when repeating all", () => {
    const q = createQueue(tracks, 3);
    expect(nextIndex(q)).toBe(3); // manual next at the end stays put
    expect(nextIndex(q, { auto: true })).toBe(-1); // playback stops
    const all = { ...q, repeat: "all" as const };
    expect(nextIndex(all, { auto: true })).toBe(0);
  });

  it("repeats the same track when repeat is one and playback auto-advances", () => {
    const q = { ...createQueue(tracks, 1), repeat: "one" as const };
    expect(nextIndex(q, { auto: true })).toBe(1);
    expect(nextIndex(q)).toBe(2); // a manual next always moves
  });

  it("goes back safely and wraps under repeat all", () => {
    expect(previousIndex(createQueue(tracks, 2))).toBe(1);
    expect(previousIndex(createQueue(tracks, 0))).toBe(0);
    expect(previousIndex({ ...createQueue(tracks, 0), repeat: "all" })).toBe(3);
  });

  it("cycles repeat modes off → all → one → off", () => {
    expect(cycleRepeat("off")).toBe("all");
    expect(cycleRepeat("all")).toBe("one");
    expect(cycleRepeat("one")).toBe("off");
  });

  it("shuffles with the current song first and restores the base order", () => {
    const q = createQueue(tracks, 2);
    const shuffled = toggleShuffle(q, () => 0.99);
    expect(shuffled.shuffle).toBe(true);
    expect(shuffled.tracks[0].id).toBe("c");
    expect(shuffled.index).toBe(0);
    const restored = toggleShuffle(shuffled, () => 0.99);
    expect(restored.tracks.map((t) => t.id)).toEqual(["a", "b", "c", "d"]);
    expect(restored.index).toBe(2);
  });

  it("removes and moves tracks without losing the current one", () => {
    const q = createQueue(tracks, 1);
    const removed = removeAt(q, 0);
    expect(removed.tracks.map((t) => t.id)).toEqual(["b", "c", "d"]);
    expect(removed.index).toBe(0);
    const moved = moveInQueue(createQueue(tracks, 0), 0, 2);
    expect(moved.tracks.map((t) => t.id)).toEqual(["b", "c", "a", "d"]);
    expect(moved.index).toBe(2);
  });
});
