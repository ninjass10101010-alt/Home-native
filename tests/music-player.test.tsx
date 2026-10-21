jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));
const mockPlay = jest.fn(async () => {});
const mockToggle = jest.fn();
const mockNext = jest.fn(async () => {});
const mockSeek = jest.fn(async () => {});
const mockRemoveDownload = jest.fn();
const DEFAULT_CURRENT = {
  id: "abc12345678", title: "Song", artist: "Artist", album: "Album",
  durationSeconds: 200, artworkUrl: null, explicit: false, source: "youtube_music",
};
let mockCurrent: any = DEFAULT_CURRENT;
let mockDownloads: any[] = [];
let mockHistory: any[] = [];
/** The family setting: the explicit filter is ON by default. */
let mockExplicitFilter = true;
/** The signed-in viewer. null = signed-out guest, which also fails closed. */
let mockMember: any = null;

jest.mock("../src/state/AuthProvider", () => ({
  useAuth: () => ({ member: mockMember, hydrated: true, signOut: jest.fn(), poke: jest.fn() }),
}));

jest.mock("../src/music/playback", () => ({
  usePlayback: () => ({
    current: mockCurrent,
    queue: [], index: 0, playing: false, position: 10, duration: 200, buffering: false,
    repeat: "off", shuffle: false, error: null,
    downloads: mockDownloads, downloadBytes: mockDownloads.reduce((sum, item) => sum + item.bytes, 0),
    history: mockHistory,
    settings: { repeat: "off", shuffle: false, explicitFilter: mockExplicitFilter },
    play: mockPlay, playQueueAt: jest.fn(), toggle: mockToggle, next: mockNext, previous: jest.fn(),
    seek: mockSeek, setRepeat: jest.fn(), cycleRepeatMode: jest.fn(), toggleShuffleMode: jest.fn(),
    addToQueue: jest.fn(), removeFromQueue: jest.fn(), moveQueueItem: jest.fn(),
    downloadCurrent: jest.fn(), removeDownload: mockRemoveDownload, setExplicitFilter: jest.fn(),
  }),
}));

const CLEAN_TRACK = {
  id: "clean11111", title: "Found", artist: "A", album: "", durationSeconds: 100,
  artworkUrl: null, explicit: false, source: "youtube_music",
};
const EXPLICIT_TRACK = {
  id: "exp11111111", title: "Bad Song", artist: "B", album: "", durationSeconds: 100,
  artworkUrl: null, explicit: true, source: "youtube_music",
};
const UNRATED_TRACK = {
  id: "unr111111111", title: "Unknown Song", artist: "C", album: "", durationSeconds: 100,
  artworkUrl: null, explicit: null, source: "youtube_music",
};

/** What the engine answered for the last search (the truth the UI must honor). */
let mockSearchOutcome: { tracks: any[]; explicitKnown: boolean } = {
  tracks: [CLEAN_TRACK],
  explicitKnown: true,
};

jest.mock("../modules/youtube-engine", () => ({
  search: jest.fn(async () => mockSearchOutcome),
  related: jest.fn(async () => []),
  resolveAudio: jest.fn(async () => ({ url: "https://x.y/audio.m4a", mimeType: "audio/mp4",
    contentLength: 1, durationSeconds: 1, expiresAt: 0 })),
}));

import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { MusicPlayer } from "../src/music/MusicPlayer";
import { ThemeProvider } from "../src/theme/ThemeProvider";

const wrap = ({ children }: { children: React.ReactNode }) => <ThemeProvider>{children}</ThemeProvider>;

const KID = { id: "c1", name: "Kid", role: "child", emoji: "🐯", color: "green" };
const PARENT = { id: "p1", name: "Rebecca (Mom)", role: "parent", emoji: "🐱", color: "green" };

beforeEach(() => {
  mockCurrent = DEFAULT_CURRENT;
  mockDownloads = [];
  mockHistory = [];
  mockExplicitFilter = true;
  mockMember = null;
  mockSearchOutcome = { tracks: [CLEAN_TRACK], explicitKnown: true };
  jest.clearAllMocks();
});

it("renders now playing and drives the transport", async () => {
  const { getByTestId } = render(<MusicPlayer />, { wrapper: wrap });
  await waitFor(() => expect(getByTestId("np-title").props.children).toBe("Song"));
  fireEvent.press(getByTestId("np-play"));
  expect(mockToggle).toHaveBeenCalled();
  fireEvent.press(getByTestId("np-next"));
  expect(mockNext).toHaveBeenCalled();
});

it("lists downloads and removes one", async () => {
  mockDownloads = [{
    id: "abc12345678", title: "Song", artist: "Artist", album: "",
    durationSeconds: 200, artworkUrl: null, fileUri: "file:///x", bytes: 1000, savedAt: 1,
  }];
  const { getByTestId } = render(<MusicPlayer />, { wrapper: wrap });
  await waitFor(() => expect(getByTestId("music-download-abc12345678")).toBeTruthy());
  fireEvent.press(getByTestId("music-download-remove-abc12345678"));
  expect(mockRemoveDownload).toHaveBeenCalledWith("abc12345678");
});

it("searches through the native engine", async () => {
  mockCurrent = null;
  const { search } = require("../modules/youtube-engine");
  const { getByTestId, findByText } = render(<MusicPlayer />, { wrapper: wrap });
  const input = getByTestId("music-search-input");
  fireEvent.changeText(input, "beatles");
  fireEvent.press(getByTestId("music-search-submit"));
  expect(await findByText("Found")).toBeTruthy();
  expect(search).toHaveBeenCalledWith("beatles", expect.any(Number));
});

it("shows a recently played shelf when idle", async () => {
  mockCurrent = null;
  mockHistory = [{
    id: "zzz99999999", title: "Older", artist: "Artist", album: "",
    durationSeconds: 100, artworkUrl: null, explicit: false, source: "youtube_music",
  }];
  const { getByTestId } = render(<MusicPlayer />, { wrapper: wrap });
  await waitFor(() => expect(getByTestId("music-history-zzz99999999")).toBeTruthy());
});

it("hides a known-explicit track from a kid member and says so plainly", async () => {
  mockCurrent = null;
  mockMember = KID;
  mockSearchOutcome = { tracks: [EXPLICIT_TRACK], explicitKnown: true };
  const { getByTestId, findByText, queryByText } = render(<MusicPlayer />, { wrapper: wrap });
  fireEvent.changeText(getByTestId("music-search-input"), "beatles");
  fireEvent.press(getByTestId("music-search-submit"));
  expect(await findByText("Nothing here to play — ask a parent to pick something.")).toBeTruthy();
  expect(queryByText("Bad Song")).toBeNull();
});

it("fails closed: a kid member never sees an unrated track", async () => {
  mockCurrent = null;
  mockMember = KID;
  mockSearchOutcome = { tracks: [UNRATED_TRACK], explicitKnown: true };
  const { getByTestId, findByText, queryByText } = render(<MusicPlayer />, { wrapper: wrap });
  fireEvent.changeText(getByTestId("music-search-input"), "beatles");
  fireEvent.press(getByTestId("music-search-submit"));
  expect(await findByText("These tracks aren't rated, so they can't be shown here.")).toBeTruthy();
  expect(queryByText("Unknown Song")).toBeNull();
});

it("says so plainly when the ratings could not be checked at all", async () => {
  mockCurrent = null;
  mockMember = KID;
  mockSearchOutcome = { tracks: [UNRATED_TRACK], explicitKnown: false };
  const { getByTestId, findByText, queryByText } = render(<MusicPlayer />, { wrapper: wrap });
  fireEvent.changeText(getByTestId("music-search-input"), "beatles");
  fireEvent.press(getByTestId("music-search-submit"));
  expect(await findByText("Couldn't check these tracks — ask a parent to pick something.")).toBeTruthy();
  expect(queryByText("Unknown Song")).toBeNull();
});

it("a parent member sees both an explicit and an unrated track", async () => {
  mockCurrent = null;
  mockMember = PARENT;
  mockSearchOutcome = { tracks: [EXPLICIT_TRACK, UNRATED_TRACK], explicitKnown: true };
  const { getByTestId, findByText } = render(<MusicPlayer />, { wrapper: wrap });
  fireEvent.changeText(getByTestId("music-search-input"), "beatles");
  fireEvent.press(getByTestId("music-search-submit"));
  expect(await findByText("Bad Song")).toBeTruthy();
  expect(await findByText("Unknown Song")).toBeTruthy();
});

it("with the filter off, a kid member sees an explicit track", async () => {
  mockCurrent = null;
  mockExplicitFilter = false;
  mockMember = KID;
  mockSearchOutcome = { tracks: [EXPLICIT_TRACK], explicitKnown: true };
  const { getByTestId, findByText } = render(<MusicPlayer />, { wrapper: wrap });
  fireEvent.changeText(getByTestId("music-search-input"), "beatles");
  fireEvent.press(getByTestId("music-search-submit"));
  expect(await findByText("Bad Song")).toBeTruthy();
});

it("says plainly when the search found nothing at all", async () => {
  mockCurrent = null;
  mockMember = KID;
  mockSearchOutcome = { tracks: [], explicitKnown: true };
  const { getByTestId, findByText } = render(<MusicPlayer />, { wrapper: wrap });
  fireEvent.changeText(getByTestId("music-search-input"), "zzzz");
  fireEvent.press(getByTestId("music-search-submit"));
  expect(await findByText("No songs matched that search.")).toBeTruthy();
});
