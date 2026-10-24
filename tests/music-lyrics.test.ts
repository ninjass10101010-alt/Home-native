jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

import {
  currentLineIndex,
  fetchLyrics,
  followOffset,
  FOLLOW_PAUSE_MS,
  parseEnhancedLrc,
  parseLrc,
  parseLyricsFile,
  wordIndexAt,
} from "../src/music/lyrics";

describe("LRC parser", () => {
  it("parses timestamps, sorts them and keeps text", () => {
    const lines = parseLrc("[00:03.00]World\n[00:01.00]Hello\n");
    expect(lines).toEqual([
      { timeMs: 1000, text: "Hello", words: [] },
      { timeMs: 3000, text: "World", words: [] },
    ]);
  });

  it("supports hundredths, multiple stamps and an offset", () => {
    const lines = parseLrc("[offset:+500]\n[00:01.25][00:02.25]Again");
    expect(lines).toEqual([
      { timeMs: 1750, text: "Again", words: [] },
      { timeMs: 2750, text: "Again", words: [] },
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
 * The KARAOKE parser — the word-by-word timings.
 *
 * Two sources carry them: the classic enhanced LRC (`<mm:ss.xx>` word
 * stamps) and LRCLIB's own Lyricsfile (the payload its API ships today).
 * Both produce the same shape, so the pane never asks where a timing came
 * from.
 */
describe("the word timings", () => {
  test("enhanced LRC yields per-word timings", () => {
    const lines = parseEnhancedLrc("[00:12.00] <00:12.00> Hello <00:12.50> world");
    expect(lines[0].words.map((w) => w.text)).toEqual(["Hello", "world"]);
    expect(wordIndexAt(lines[0], 12500)).toBe(1);
  });

  test("line-only LRC still parses and reports no words", () => {
    expect(parseLrc("[00:12.00] Hello world")[0].words).toEqual([]);
  });

  it("keeps the word times and the line's own time", () => {
    const lines = parseEnhancedLrc("[00:12.00] <00:12.00> Hello <00:12.50> world");
    expect(lines[0].timeMs).toBe(12000);
    expect(lines[0].words[0]).toEqual({ timeMs: 12000, text: "Hello" });
    expect(lines[0].words[1]).toEqual({ timeMs: 12500, text: "world" });
    expect(lines[0].text).toBe("Hello world");
  });

  it("reads a line-only LRC through the enhanced parser as well — with no words", () => {
    const lines = parseEnhancedLrc("[00:12.00] Hello world");
    expect(lines).toEqual([{ timeMs: 12000, text: "Hello world", words: [] }]);
  });

  it("moves the words with the offset, like the lines", () => {
    const lines = parseEnhancedLrc("[offset:+500]\n[00:12.00] <00:12.00> Hello");
    expect(lines[0].timeMs).toBe(12500);
    expect(lines[0].words[0].timeMs).toBe(12500);
  });

  it("names the word being sung — and says nothing before the first one", () => {
    const lines = parseEnhancedLrc("[00:12.00] <00:12.00> Hello <00:12.50> world");
    expect(wordIndexAt(lines[0], 11999)).toBe(-1);
    expect(wordIndexAt(lines[0], 12000)).toBe(0);
    expect(wordIndexAt(lines[0], 12499)).toBe(0);
    expect(wordIndexAt(lines[0], 12500)).toBe(1);
    expect(wordIndexAt(lines[0], 99999)).toBe(1);
  });

  it("says nothing for a line with no words", () => {
    const lines = parseLrc("[00:12.00] Hello world");
    expect(wordIndexAt(lines[0], 12000)).toBe(-1);
  });

  it("ignores malformed word stamps instead of inventing timings", () => {
    const lines = parseEnhancedLrc("[00:12.00] <bad> Hello <00:12.50> world");
    expect(lines[0].words.map((w) => w.text)).toEqual(["world"]);
  });

  it("reads LRCLIB's own Lyricsfile — the payload its API ships today", () => {
    const yaml = [
      "version: '1.0'",
      "metadata:",
      "  title: Lemon",
      "  artist: Hiromi Iwasaki",
      "  duration_ms: 192209",
      "  instrumental: false",
      "lines:",
      "  - text: Wazato chigau na no",
      "    words:",
      '      - text: "Wazato "',
      "        start_ms: 22685",
      '      - text: "chigau "',
      "        start_ms: 23993",
      "    start_ms: 22685",
      "    end_ms: 25975",
      "plain: |",
      "  Wazato chigau na no",
    ].join("\n");
    const lines = parseLyricsFile(yaml);
    expect(lines).toHaveLength(1);
    expect(lines[0].timeMs).toBe(22685);
    expect(lines[0].text).toBe("Wazato chigau na no");
    expect(lines[0].words).toEqual([
      { timeMs: 22685, text: "Wazato" },
      { timeMs: 23993, text: "chigau" },
    ]);
    expect(wordIndexAt(lines[0], 24000)).toBe(1);
  });

  it("reads a Lyricsfile with no words as plain lines", () => {
    const yaml = [
      "version: '1.0'",
      "lines:",
      "  - text: 'Waiting for the signal'",
      "    start_ms: 12400",
      "    end_ms: 15750",
    ].join("\n");
    expect(parseLyricsFile(yaml)).toEqual([
      { timeMs: 12400, text: "Waiting for the signal", words: [] },
    ]);
  });

  it("says nothing for a Lyricsfile it cannot read", () => {
    expect(parseLyricsFile("")).toEqual([]);
    expect(parseLyricsFile("version: '1.0'\nmetadata:\n  title: Nothing\n")).toEqual([]);
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

  it("hands the word timings over when LRCLIB ships a word-synced Lyricsfile", async () => {
    global.fetch = jest.fn(async (url: string) => ({
      ok: true,
      json: async () => ({
        syncedLyrics: "[00:22.68]Wazato chigau na no",
        plainLyrics: "Wazato chigau na no",
        lyricsfile: [
          "version: '1.0'",
          "lines:",
          "  - text: Wazato chigau na no",
          "    words:",
          '      - text: "Wazato "',
          "        start_ms: 22685",
          '      - text: "chigau "',
          "        start_ms: 23993",
          "    start_ms: 22685",
        ].join("\n"),
      }),
      url,
    })) as unknown as typeof fetch;
    const lines = await fetchLyrics({
      id: "lemon00001", title: "Lemon", artist: "Hiromi Iwasaki", album: "Yugure",
      durationSeconds: 192, artworkUrl: null, explicit: false, source: "youtube_music",
    });
    expect(lines?.[0]?.words).toEqual([
      { timeMs: 22685, text: "Wazato" },
      { timeMs: 23993, text: "chigau" },
    ]);
  });
});
