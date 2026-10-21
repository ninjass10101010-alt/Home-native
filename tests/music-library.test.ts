jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  appendHistory,
  HISTORY_SCHEMA_VERSION,
  loadDenylist,
  loadDownloads,
  loadHistory,
  loadMusicSettings,
  mergeHistory,
  mergeMusicSettings,
  removeDownloadEntry,
  saveDenylist,
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
  artworkUrl: null, fileUri: `file:///music/${id}.m4a`, bytes, savedAt: 1, explicit: false,
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

  it("merges a persisted payload written before a key existed", async () => {
    // The payload predates `explicitFilter`: the filter must stay ON (it
    // fails closed), and the keys it DOES carry are honoured.
    await AsyncStorage.setItem("music.settings", JSON.stringify({ repeat: "one", shuffle: true }));
    expect(await loadMusicSettings()).toEqual({
      repeat: "one",
      shuffle: true,
      explicitFilter: true,
    });
  });

  it("honours an explicit explicitFilter:false", async () => {
    await AsyncStorage.setItem("music.settings", JSON.stringify({ explicitFilter: false }));
    expect(await loadMusicSettings()).toEqual({
      repeat: "off",
      shuffle: false,
      explicitFilter: false,
    });
  });

  it("falls back to the defaults when the stored payload is not a settings object", async () => {
    await AsyncStorage.setItem("music.settings", "[]");
    expect(await loadMusicSettings()).toEqual({
      repeat: "off",
      shuffle: false,
      explicitFilter: true,
    });
  });

  it("mergeMusicSettings keeps every default a payload omits", () => {
    expect(mergeMusicSettings({ repeat: "all" })).toEqual({
      repeat: "all",
      shuffle: false,
      explicitFilter: true,
    });
    expect(mergeMusicSettings(null)).toEqual({
      repeat: "off",
      shuffle: false,
      explicitFilter: true,
    });
  });

  it("carries the track's rating on a download", async () => {
    await saveDownloads([{ ...download("a"), explicit: true }]);
    expect((await loadDownloads())[0].explicit).toBe(true);
  });

  it("a download written before the rating existed loads as UNKNOWN, not as clean", async () => {
    // The payload predates the `explicit` key: it must not read as "not
    // marked explicit" (that would let an explicit track reach a kid).
    const legacy = { ...download("a") } as Partial<DownloadEntry>;
    delete legacy.explicit;
    await AsyncStorage.setItem("music.downloads", JSON.stringify([legacy]));
    const loaded = await loadDownloads();
    expect(loaded[0].explicit).toBeNull();
  });

  it("a history payload written in the LEGACY shape loads as UNKNOWN, not as clean", async () => {
    // Before the tri-state change the engine hardcoded `explicit: false` on
    // EVERY track, so a legacy row's "false" is a stale claim, not a rating:
    // it must read as UNKNOWN, or a pre-existing explicit track stays
    // reachable through "Recently played".
    const legacy = { ...track("a"), explicit: false };
    await AsyncStorage.setItem("music.history", JSON.stringify([legacy]));
    const loaded = await loadHistory();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe("a");
    expect(loaded[0].explicit).toBeNull();
  });

  it("a history payload written with an OLDER version marker loads as UNKNOWN", async () => {
    await AsyncStorage.setItem("music.history", JSON.stringify([{ ...track("a"), explicit: false }]));
    await AsyncStorage.setItem("music.history.version", JSON.stringify(HISTORY_SCHEMA_VERSION - 1));
    const loaded = await loadHistory();
    expect(loaded[0].explicit).toBeNull();
  });

  it("a history payload written in the CURRENT shape keeps its real rating", async () => {
    await AsyncStorage.setItem(
      "music.history",
      JSON.stringify([{ ...track("a"), explicit: true }, { ...track("b"), explicit: false }])
    );
    await AsyncStorage.setItem("music.history.version", JSON.stringify(HISTORY_SCHEMA_VERSION));
    const loaded = await loadHistory();
    expect(loaded.map((t) => t.explicit)).toEqual([true, false]);
  });

  it("appending a track marks the history as current, so its real rating survives", async () => {
    // The marker is written with the rows: a row written after the change
    // keeps the rating the engine measured.
    await appendHistory({ ...track("a"), explicit: true });
    const loaded = await loadHistory();
    expect(loaded[0].explicit).toBe(true);
  });

  it("round-trips the deny-list", async () => {
    await saveDenylist([{ term: "eminem", addedAt: 1 }, { term: "lose yourself", addedAt: 2 }]);
    expect(await loadDenylist()).toEqual([{ term: "eminem", addedAt: 1 }, { term: "lose yourself", addedAt: 2 }]);
  });

  it("reads a corrupt deny-list as empty instead of throwing", async () => {
    await AsyncStorage.setItem("music.denylist", "{not json");
    expect(await loadDenylist()).toEqual([]);
  });
});
