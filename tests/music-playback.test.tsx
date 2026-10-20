const mockReplace = jest.fn();
const mockPlay = jest.fn();
const mockPause = jest.fn();
const mockSeek = jest.fn(async () => {});
const mockLock = jest.fn();
const mockResolve = jest.fn(async (_id: string) => ({
  url: "https://rr1---sn-test.googlevideo.com/videoplayback?x=1",
  mimeType: "audio/mp4",
  contentLength: 1024,
  durationSeconds: 120,
  expiresAt: 0,
}));

jest.mock("expo-audio", () => ({
  useAudioPlayer: () => ({
    playing: false, isLoaded: true, currentTime: 0, duration: 0,
    play: mockPlay, pause: mockPause, replace: mockReplace,
    seekTo: mockSeek, remove: jest.fn(), setActiveForLockScreen: mockLock,
    updateLockScreenMetadata: jest.fn(), setPlaybackRate: jest.fn(),
  }),
  useAudioPlayerStatus: () => ({ isLoaded: true, playing: false, currentTime: 4, duration: 120, didJustFinish: false }),
  AudioModule: { setAudioModeAsync: jest.fn(async () => {}) },
}));
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("../modules/youtube-engine", () => ({
  resolveAudio: (id: string) => mockResolve(id),
  search: jest.fn(async () => []),
  related: jest.fn(async () => []),
}));

import React from "react";
import { act, render, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import { PlaybackProvider, usePlayback } from "../src/music/playback";
import type { MediaTrack } from "../src/music/types";

const track: MediaTrack = {
  id: "abc12345678", title: "Song", artist: "Artist", album: "Album",
  durationSeconds: 120, artworkUrl: "https://img/x.jpg", explicit: false, source: "youtube_music",
};

function Probe() {
  const { current, play } = usePlayback();
  return (
    <>
      <Text testID="title">{current?.title ?? "none"}</Text>
      <Text testID="play" onPress={() => void play(track)}>play</Text>
    </>
  );
}

it("resolves the stream on-device and plays the native URL", async () => {
  const { getByTestId } = render(
    <PlaybackProvider><Probe /></PlaybackProvider>
  );
  await act(async () => { getByTestId("play").props.onPress(); });
  await waitFor(() => expect(getByTestId("title").props.children).toBe("Song"));
  expect(mockResolve).toHaveBeenCalledWith("abc12345678");
  expect(mockReplace).toHaveBeenCalledWith({ uri: "https://rr1---sn-test.googlevideo.com/videoplayback?x=1" });
  expect(mockPlay).toHaveBeenCalled();
  expect(mockLock).toHaveBeenCalledWith(true, expect.objectContaining({ title: "Song" }));
});
