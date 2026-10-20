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
let mockCurrent: any = {
  id: "abc12345678", title: "Song", artist: "Artist", album: "Album",
  durationSeconds: 200, artworkUrl: null, explicit: false, source: "youtube_music",
};
let mockDownloads: any[] = [];
let mockHistory: any[] = [];
jest.mock("../src/music/playback", () => ({
  usePlayback: () => ({
    current: mockCurrent,
    queue: [], index: 0, playing: false, position: 10, duration: 200, buffering: false,
    repeat: "off", shuffle: false, error: null,
    downloads: mockDownloads, downloadBytes: mockDownloads.reduce((sum, item) => sum + item.bytes, 0),
    history: mockHistory,
    settings: { repeat: "off", shuffle: false, explicitFilter: true },
    play: mockPlay, playQueueAt: jest.fn(), toggle: mockToggle, next: mockNext, previous: jest.fn(),
    seek: mockSeek, setRepeat: jest.fn(), cycleRepeatMode: jest.fn(), toggleShuffleMode: jest.fn(),
    addToQueue: jest.fn(), removeFromQueue: jest.fn(), moveQueueItem: jest.fn(),
    downloadCurrent: jest.fn(), removeDownload: mockRemoveDownload, setExplicitFilter: jest.fn(),
  }),
}));

jest.mock("../modules/youtube-engine", () => ({
  search: jest.fn(async () => [
    { id: "abc12345678", title: "Found", artist: "A", album: "", durationSeconds: 100,
      artworkUrl: null, explicit: false, source: "youtube_music" },
  ]),
  related: jest.fn(async () => []),
  resolveAudio: jest.fn(async () => ({ url: "https://x.y/audio.m4a", mimeType: "audio/mp4",
    contentLength: 1, durationSeconds: 1, expiresAt: 0 })),
}));

import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { MusicPlayer } from "../src/music/MusicPlayer";
import { ThemeProvider } from "../src/theme/ThemeProvider";

const wrap = ({ children }: { children: React.ReactNode }) => <ThemeProvider>{children}</ThemeProvider>;

beforeEach(() => {
  mockDownloads = [];
  mockHistory = [];
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
