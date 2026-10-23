/**
 * The cast-safe queue bridge: `advanceForCast` moves the queue through the
 * SAME visibility gate as the local transport, but it must never touch
 * expo-audio — the receiver plays the next track, not the tablet.
 *
 * The harness is the expo-audio harness from music-playback.test.tsx: the
 * native player is mocked, so any play/replace/seek call is observable.
 */
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

let mockStatus: any = {
  isLoaded: true, playing: false, currentTime: 4, duration: 120, didJustFinish: false,
};

jest.mock("expo-audio", () => ({
  useAudioPlayer: () => ({
    playing: false, isLoaded: true, currentTime: 0, duration: 0,
    play: mockPlay, pause: mockPause, replace: mockReplace,
    seekTo: mockSeek, remove: jest.fn(), setActiveForLockScreen: mockLock,
    updateLockScreenMetadata: jest.fn(), setPlaybackRate: jest.fn(),
  }),
  useAudioPlayerStatus: () => mockStatus,
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

/** A kid, so the content policy is the one that hides the middle track. */
const KID = { id: "c1", name: "Kid", role: "child", emoji: "🐯", color: "green" };
let mockMember: any = KID;
jest.mock("../src/state/AuthProvider", () => ({
  useAuth: () => ({
    member: mockMember,
    role: mockMember ? mockMember.role : null,
    sessionVerified: mockMember !== null,
    hydrated: true,
    mode: "family",
    signOut: jest.fn(async () => {}), poke: jest.fn(),
  }),
}));

import React from "react";
import { act, render, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { PlaybackProvider, usePlayback, type PlaybackValue } from "../src/music/playback";
import type { MediaTrack } from "../src/music/types";

const first: MediaTrack = {
  id: "visible-1", title: "First", artist: "Artist", album: "Album",
  durationSeconds: 120, artworkUrl: null, explicit: false, source: "youtube_music",
};
/**
 * The middle track starts NOT MARKED EXPLICIT, so it enters the queue — then
 * the rating flips while it is already queued. That is the race the queue
 * bridge must survive: the queue snapshot can predate the policy that now
 * hides a row, so `advanceForCast` re-checks the gate (exactly like `next`).
 */
const middle: MediaTrack = {
  id: "hidden-1", title: "Middle", artist: "Artist", album: "Album",
  durationSeconds: 120, artworkUrl: null, explicit: false, source: "youtube_music",
};
const last: MediaTrack = {
  id: "visible-2", title: "Last", artist: "Artist", album: "Album",
  durationSeconds: 120, artworkUrl: null, explicit: false, source: "youtube_music",
};

let api!: PlaybackValue;

function Probe() {
  const value = usePlayback();
  React.useEffect(() => { api = value; });
  return (
    <>
      <Text testID="title">{value.current?.title ?? "none"}</Text>
      <Text testID="index">{String(value.index)}</Text>
      <Text testID="queue">{value.queue.map((t) => t.id).join(",") || "empty"}</Text>
      <Text testID="play-triple" onPress={() => void value.playQueueAt([first, middle, last], 0)}>
        play triple
      </Text>
      <Text testID="play-last" onPress={() => void value.playQueueAt([first, last], 1)}>
        play last
      </Text>
    </>
  );
}

const tree = () => (
  <PlaybackProvider>
    <Probe />
  </PlaybackProvider>
);

/** Clear the calls made while the queue was being built. */
const clearPlayer = () => {
  mockPlay.mockClear();
  mockReplace.mockClear();
  mockSeek.mockClear();
};

/** The state update must be flushed by act; the holder keeps the return typed. */
const callAdvance = async (auto: boolean): Promise<MediaTrack | null> => {
  const result: { track: MediaTrack | null } = { track: null };
  await act(async () => { result.track = api.advanceForCast(auto); });
  return result.track;
};

beforeEach(async () => {
  await AsyncStorage.clear();
  mockMember = KID;
  mockStatus = { isLoaded: true, playing: false, currentTime: 4, duration: 120, didJustFinish: false };
  middle.explicit = false;
  jest.clearAllMocks();
});

it("advanceForCast moves the index through visible tracks only and never calls the player", async () => {
  const { getByTestId } = render(tree());
  await act(async () => { getByTestId("play-triple").props.onPress(); });
  await waitFor(() => expect(getByTestId("title").props.children).toBe("First"));
  expect(getByTestId("queue").props.children).toBe("visible-1,hidden-1,visible-2");

  // The middle row is now hidden to the kid — but it is still in the queue
  // snapshot the cast bridge holds.
  middle.explicit = true;
  clearPlayer();

  const moved = await callAdvance(false);

  expect(moved?.id).toBe("visible-2");
  expect(api.index).toBe(2);
  expect(getByTestId("index").props.children).toBe("2");
  expect(getByTestId("title").props.children).toBe("Last");
  expect(mockPlay).not.toHaveBeenCalled();
  expect(mockReplace).not.toHaveBeenCalled();
  expect(mockSeek).not.toHaveBeenCalled();
});

it("repeat-one returns the same track and keeps the index", async () => {
  const { getByTestId } = render(tree());
  await act(async () => { getByTestId("play-triple").props.onPress(); });
  await waitFor(() => expect(getByTestId("title").props.children).toBe("First"));
  await act(async () => { api.setRepeat("one"); });
  clearPlayer();

  const moved = await callAdvance(true);

  expect(moved?.id).toBe("visible-1");
  expect(api.index).toBe(0);
  expect(getByTestId("index").props.children).toBe("0");
  expect(getByTestId("title").props.children).toBe("First");
  expect(mockPlay).not.toHaveBeenCalled();
  expect(mockReplace).not.toHaveBeenCalled();
  expect(mockSeek).not.toHaveBeenCalled();
});

it("repeat-off at the end returns null and leaves the queue where it was", async () => {
  const { getByTestId } = render(tree());
  await act(async () => { getByTestId("play-last").props.onPress(); });
  await waitFor(() => expect(getByTestId("title").props.children).toBe("Last"));
  clearPlayer();

  const moved = await callAdvance(true);

  expect(moved).toBeNull();
  expect(api.index).toBe(1);
  expect(getByTestId("index").props.children).toBe("1");
  expect(getByTestId("title").props.children).toBe("Last");
  expect(mockPlay).not.toHaveBeenCalled();
  expect(mockReplace).not.toHaveBeenCalled();
  expect(mockSeek).not.toHaveBeenCalled();
});

it("an empty queue returns null without touching the player", async () => {
  render(tree());
  clearPlayer();

  const moved = await callAdvance(true);

  expect(moved).toBeNull();
  expect(api.index).toBe(-1);
  expect(mockPlay).not.toHaveBeenCalled();
  expect(mockReplace).not.toHaveBeenCalled();
  expect(mockSeek).not.toHaveBeenCalled();
});
