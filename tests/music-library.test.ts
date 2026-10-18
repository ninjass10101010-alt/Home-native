jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  appendHistory,
  loadHistory,
  loadMusicSettings,
  mergeHistory,
  removeDownloadEntry,
  saveDownloads,
  totalDownloadBytes,
  upsertDownload,
} from "../src/music/library";
import type { DownloadEntry, MediaTrack } from "../src/music/types";

const track = (id: string): MediaTrack => ({
  id, title: `T-${id}`, artist: "A", album: "", durationSeconds: 120,
  artworkUrl: null, explicit: false, source: "youtube_music",
});

const download = (id: string, bytes = 100): DownloadEntry => ({
  id, title: `T-${id}`, artist: "A", album: "", durationSeconds: 120,
  artworkUrl: null, fileUri: `file:///music/${id}.m4a`, bytes, savedAt: 1,
});

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe("music library", () => {
  it("merges history newest-first and dedupes", () => {
    const first = mergeHistory([], track("a"));
    const second = mergeHistory(first, track("b"));
    const replay = mergeHistory(second, track("a"));
    expect(replay.map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("caps history at the limit", () => {
    let history: MediaTrack[] = [];
    for (let i = 0; i < 505; i++) history = mergeHistory(history, track(String(i)), 500);
    expect(history).toHaveLength(500);
  });

  it("persists and loads history", async () => {
    await appendHistory(track("x"));
    await appendHistory(track("y"));
    expect((await loadHistory()).map((t) => t.id)).toEqual(["y", "x"]);
  });

  it("upserts and removes downloads, and totals their bytes", async () => {
    const list = upsertDownload(upsertDownload([], download("a", 50)), download("a", 75));
    expect(list).toHaveLength(1);
    expect(list[0].bytes).toBe(75);
    expect(totalDownloadBytes(list)).toBe(75);
    expect(removeDownloadEntry(list, "a")).toEqual([]);
    await saveDownloads(list);
  });

  it("returns defaults when settings are absent", async () => {
    expect(await loadMusicSettings()).toEqual({
      repeat: "off",
      shuffle: false,
      explicitFilter: true,
    });
  });
});
