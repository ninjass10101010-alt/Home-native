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
jest.mock("../src/music/playback", () => ({
  usePlayback: () => ({
    current: { id: "abc12345678", title: "Song", artist: "Artist", album: "Album", durationSeconds: 200, artworkUrl: null, explicit: false, source: "youtube_music" },
    queue: [], index: 0, playing: false, position: 10, duration: 200, buffering: false,
    repeat: "off", shuffle: false, error: null, downloads: [], downloadBytes: 0,
    settings: { repeat: "off", shuffle: false, explicitFilter: true },
    play: mockPlay, playQueueAt: jest.fn(), toggle: mockToggle, next: mockNext, previous: jest.fn(),
    seek: mockSeek, setRepeat: jest.fn(), cycleRepeatMode: jest.fn(), toggleShuffleMode: jest.fn(),
    addToQueue: jest.fn(), removeFromQueue: jest.fn(), moveQueueItem: jest.fn(),
    downloadCurrent: jest.fn(), removeDownload: jest.fn(), setExplicitFilter: jest.fn(),
  }),
}));

import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { MusicPlayer } from "../src/music/MusicPlayer";
import { ThemeProvider } from "../src/theme/ThemeProvider";

const wrap = ({ children }: { children: React.ReactNode }) => <ThemeProvider>{children}</ThemeProvider>;

it("renders now playing and drives the transport", () => {
  const { getByTestId } = render(<MusicPlayer />, { wrapper: wrap });
  expect(getByTestId("np-title").props.children).toBe("Song");
  fireEvent.press(getByTestId("np-play"));
  expect(mockToggle).toHaveBeenCalled();
  fireEvent.press(getByTestId("np-next"));
  expect(mockNext).toHaveBeenCalled();
});
