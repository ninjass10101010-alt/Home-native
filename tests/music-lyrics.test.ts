jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

import { currentLineIndex, followOffset, FOLLOW_PAUSE_MS, parseLrc } from "../src/music/lyrics";

describe("LRC parser", () => {
  it("parses timestamps, sorts them and keeps text", () => {
    const lines = parseLrc("[00:03.00]World\n[00:01.00]Hello\n");
    expect(lines).toEqual([
      { timeMs: 1000, text: "Hello" },
      { timeMs: 3000, text: "World" },
    ]);
  });

  it("supports hundredths, multiple stamps and an offset", () => {
    const lines = parseLrc("[offset:+500]\n[00:01.25][00:02.25]Again");
    expect(lines).toEqual([
      { timeMs: 1750, text: "Again" },
      { timeMs: 2750, text: "Again" },
    ]);
  });

  it("ignores lines without timestamps and malformed input", () => {
    expect(parseLrc("not lyrics\n[bad]")).toEqual([]);
  });

  it("finds the current line without look-ahead", () => {
    const lines = parseLrc("[00:01.00]A\n[00:05.00]B");
    expect(currentLineIndex(lines, 999)).toBe(-1);
    expect(currentLineIndex(lines, 1000)).toBe(0);
    expect(currentLineIndex(lines, 4999)).toBe(0);
    expect(currentLineIndex(lines, 5000)).toBe(1);
  });
});

/**
 * The auto-follow's maths — where the view lands when the song moves on.
 */
describe("the lyrics follow", () => {
  it("brings the current line into the upper third of the viewport", () => {
    // A line 600px down, in a 900px viewport: the lead-in is a third of the
    // viewport, so the line lands 300px down — read, not glued to the edge.
    expect(followOffset(600, 900)).toBe(300);
  });

  it("never scrolls above the top of the list", () => {
    expect(followOffset(100, 900)).toBe(0);
    expect(followOffset(0, 900)).toBe(0);
    expect(followOffset(-40, 900)).toBe(0);
  });

  it("scrolls to the line itself when the viewport is not measured yet", () => {
    expect(followOffset(128, 0)).toBe(128);
  });

  it("pauses for ~3s after the user scrolls — long enough to read, short enough to resume", () => {
    expect(FOLLOW_PAUSE_MS).toBe(3000);
  });
});

describe("fetchLyrics", () => {
  it("fetches lyrics from LRCLIB directly", async () => {
    global.fetch = jest.fn(async (url: string) => ({
      ok: true,
      json: async () => ({ syncedLyrics: "[00:01.00]hello", plainLyrics: "hello" }),
      url,
    })) as unknown as typeof fetch;
    const { fetchLyrics } = require("../src/music/lyrics");
    const lines = await fetchLyrics({
      id: "abc12345678", title: "Song", artist: "Artist", album: "Album",
      durationSeconds: 120, artworkUrl: null, explicit: false, source: "youtube_music",
    });
    expect(lines?.[0]?.text).toBe("hello");
    expect(String((global.fetch as jest.Mock).mock.calls[0][0])).toContain("lrclib.net/api/get");
  });
});
