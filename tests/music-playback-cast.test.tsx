/* eslint-disable import/first -- jest.mock factories run before the imports */
/* eslint-disable @typescript-eslint/no-require-imports -- the AsyncStorage jest mock is CommonJS-only */
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
const mockStartSession = jest.fn();
const mockEndCurrentSession = jest.fn();
const mockGetCurrentCastSession = jest.fn();
const mockLoadMedia = jest.fn();
const mockClientPlay = jest.fn();
const mockClientPause = jest.fn();
const mockClientSeek = jest.fn();
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
/** The real CastProvider is mounted by ONE integration test below. */
let mockCastSession: any = null;
let mockCastStatus: any = null;
let mockCastPosition = 0;

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
/**
 * The real CastProvider (loaded with `jest.requireActual` in one integration
 * test) talks to the Cast SDK through these; the rest of this file keeps the
 * module-level CastProvider mock.
 */
jest.mock("react-native-google-cast", () => ({
  __esModule: true,
  default: {},
  CastContext: {
    sessionManager: {
      startSession: (id: string) => mockStartSession(id),
      endCurrentSession: (stopCasting: boolean) => mockEndCurrentSession(stopCasting),
      getCurrentCastSession: () => mockGetCurrentCastSession(),
      onSessionStarted: (_handler: (session: any) => void) => ({ remove: () => {} }),
      onSessionStartFailed: (_handler: (session: any, error: string) => void) => ({ remove: () => {} }),
    },
  },
  useCastState: () => "notConnected",
  useDevices: () => [
    {
      deviceId: "tv",
      friendlyName: "Living Room",
      capabilities: [],
      deviceVersion: "1",
      icons: [],
      ipAddress: "192.168.5.220",
      modelName: "TV",
    },
  ],
  useCastSession: () => mockCastSession,
  useStreamPosition: () => mockCastPosition,
  useMediaStatus: () => mockCastStatus,
}));
jest.mock("../modules/youtube-engine", () => ({
  resolveAudio: (id: string) => mockResolve(id),
  search: jest.fn(async () => []),
  related: jest.fn(async () => []),
}));
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => "/",
}));
/** The wall widget's cast surface is idle here — this suite exercises the sink. */
jest.mock("../src/music/CastProvider", () => ({
  useCast: () => ({
    casting: false,
    playing: false,
    play: jest.fn(async () => {}),
    pause: jest.fn(async () => {}),
    advance: jest.fn(async () => {}),
  }),
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
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { PlaybackProvider, usePlayback, type PlaybackValue } from "../src/music/playback";
import { MusicWidget } from "../src/home/widgets/MusicWidget";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import type { MediaTrack } from "../src/music/types";

/** The REAL cast provider, bypassing this file's module-level mock. */
const realCast = jest.requireActual<typeof import("../src/music/CastProvider")>(
  "../src/music/CastProvider"
);
let realCastApi: ReturnType<typeof realCast.useCast> | null = null;
function RealCastProbe() {
  const cast = realCast.useCast();
  React.useEffect(() => { realCastApi = cast; });
  return null;
}

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
      <Text testID="history">{value.history.map((t) => t.id).join(",") || "empty"}</Text>
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
  mockPause.mockClear();
  mockReplace.mockClear();
  mockSeek.mockClear();
  mockLock.mockClear();
};

/** The state update must be flushed by act; the holder keeps the return typed. */
const callAdvance = async (auto: boolean): Promise<MediaTrack | null> => {
  const result: { track: MediaTrack | null } = { track: null };
  await act(async () => { result.track = api.advanceForCast(auto); });
  return result.track;
};

const callPrevious = async (): Promise<MediaTrack | null> => {
  const result: { track: MediaTrack | null } = { track: null };
  await act(async () => { result.track = api.previousForCast(); });
  return result.track;
};

beforeEach(async () => {
  await AsyncStorage.clear();
  mockMember = KID;
  mockStatus = { isLoaded: true, playing: false, currentTime: 4, duration: 120, didJustFinish: false };
  mockCastSession = null;
  mockCastStatus = null;
  mockCastPosition = 0;
  realCastApi = null;
  mockStartSession.mockResolvedValue(true);
  mockEndCurrentSession.mockResolvedValue(undefined);
  mockGetCurrentCastSession.mockResolvedValue(null);
  mockLoadMedia.mockResolvedValue(undefined);
  mockClientPlay.mockResolvedValue(undefined);
  mockClientPause.mockResolvedValue(undefined);
  mockClientSeek.mockResolvedValue(undefined);
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
  expect(mockPause).not.toHaveBeenCalled();
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
  expect(mockPause).not.toHaveBeenCalled();
  expect(mockReplace).not.toHaveBeenCalled();
  expect(mockSeek).not.toHaveBeenCalled();
});

it("auto advance at the end of a repeat-off queue returns null and leaves the queue where it was", async () => {
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
  expect(mockPause).not.toHaveBeenCalled();
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
  expect(mockPause).not.toHaveBeenCalled();
  expect(mockReplace).not.toHaveBeenCalled();
  expect(mockSeek).not.toHaveBeenCalled();
});

it("previousForCast skips a hidden track and never calls the player", async () => {
  const { getByTestId } = render(tree());
  await act(async () => { getByTestId("play-triple").props.onPress(); });
  await waitFor(() => expect(getByTestId("title").props.children).toBe("First"));
  middle.explicit = true;
  await callAdvance(false);
  expect(api.index).toBe(2);
  clearPlayer();

  const moved = await callPrevious();

  expect(moved?.id).toBe("visible-1");
  expect(api.index).toBe(0);
  expect(getByTestId("index").props.children).toBe("0");
  expect(getByTestId("title").props.children).toBe("First");
  expect(mockPlay).not.toHaveBeenCalled();
  expect(mockPause).not.toHaveBeenCalled();
  expect(mockReplace).not.toHaveBeenCalled();
  expect(mockSeek).not.toHaveBeenCalled();
});

/**
 * THE LOCAL-PLAY CHOKE POINT (SP4 task 5 review fix).
 *
 * Search results, queue/history rows and the wall widget all drive the
 * provider's transport. With a live cast session the provider installs the
 * receiver's loader as a sink, so those paths reach the TV and never start
 * the tablet's own audio.
 */
it("installs a cast sink that stops local sound, then routes play and next to the receiver", async () => {
  render(tree());
  const sink = jest.fn(async (_track: MediaTrack) => {});
  clearPlayer();

  await act(async () => { api.setCastSink(sink); });
  // Installing the sink stops whatever the local player was doing AND drops
  // the lock screen, so the system Play action cannot resume tablet audio.
  expect(mockPause).toHaveBeenCalled();
  expect(mockLock).toHaveBeenCalledWith(false);
  mockLock.mockClear();

  // A search-result row plays through the provider.
  await act(async () => { await api.play(first, [first, middle]); });
  expect(sink).toHaveBeenCalledWith(first);
  expect(mockReplace).not.toHaveBeenCalled();
  expect(mockPlay).not.toHaveBeenCalled();
  expect(mockLock).not.toHaveBeenCalled();

  // The next row / widget transport.
  await act(async () => { await api.next(); });
  expect(sink).toHaveBeenLastCalledWith(middle);
  expect(mockReplace).not.toHaveBeenCalled();
  expect(mockPlay).not.toHaveBeenCalled();
  expect(mockLock).not.toHaveBeenCalled();
});

it("a repeat-one next on a cast session reloads on the receiver, not locally", async () => {
  render(tree());
  const sink = jest.fn(async (_track: MediaTrack) => {});
  await act(async () => { api.setCastSink(sink); });
  await act(async () => { await api.play(first, [first]); });
  await act(async () => { api.setRepeat("one"); });
  clearPlayer();

  await act(async () => { await api.next(); });

  expect(sink).toHaveBeenLastCalledWith(first);
  expect(mockSeek).not.toHaveBeenCalled();
  expect(mockPlay).not.toHaveBeenCalled();
});

it("toggle while a sink is installed reloads on the receiver and never touches local audio", async () => {
  render(tree());
  await act(async () => { await api.play(first, [first, middle]); });
  const sink = jest.fn(async (_track: MediaTrack) => {});
  await act(async () => { api.setCastSink(sink); });
  clearPlayer();

  await act(async () => { api.toggle(); });

  expect(sink).toHaveBeenCalledWith(first);
  expect(mockPlay).not.toHaveBeenCalled();
  expect(mockPause).not.toHaveBeenCalled();
  expect(mockReplace).not.toHaveBeenCalled();
  expect(mockSeek).not.toHaveBeenCalled();
});

it("previous while a sink is installed reloads on the receiver and never touches local audio", async () => {
  render(tree());
  await act(async () => { await api.play(first, [first, middle]); });
  await act(async () => { await api.next(); });
  const sink = jest.fn(async (_track: MediaTrack) => {});
  await act(async () => { api.setCastSink(sink); });
  clearPlayer();

  // Past three seconds "previous" restarts the current track on the receiver.
  await act(async () => { await api.previous(); });

  expect(sink).toHaveBeenCalledWith(middle);
  expect(mockPlay).not.toHaveBeenCalled();
  expect(mockPause).not.toHaveBeenCalled();
  expect(mockReplace).not.toHaveBeenCalled();
  expect(mockSeek).not.toHaveBeenCalled();
});

it("parkLocal points the local player at the track without starting it", async () => {
  render(tree());
  await act(async () => { await api.play(first, [first, middle]); });
  await act(async () => { await api.next(); });
  clearPlayer();

  await act(async () => { await api.parkLocal(last); });

  expect(mockResolve).toHaveBeenLastCalledWith("visible-2");
  expect(mockReplace).toHaveBeenCalledWith({
    uri: "https://rr1---sn-test.googlevideo.com/videoplayback?x=1",
  });
  expect(mockPlay).not.toHaveBeenCalled();
  expect(mockLock).toHaveBeenCalledWith(false);
  expect(mockSeek).toHaveBeenCalledWith(0);
});

it("parkLocal surfaces a resolve failure through the existing error", async () => {
  mockResolve.mockRejectedValueOnce(new Error("blocked"));
  render(tree());
  clearPlayer();

  await act(async () => { await api.parkLocal(first); });

  expect(mockReplace).not.toHaveBeenCalled();
  expect(mockPlay).not.toHaveBeenCalled();
  expect(api.error).toBe("resolve_failed");
});

it("parkLocal never loads a track the viewer may not see", async () => {
  render(tree());
  middle.explicit = true;
  clearPlayer();

  await act(async () => { await api.parkLocal(middle); });

  // Pause and drop the lock screen, but never resolve or replace with a track
  // this viewer may not see.
  expect(mockPause).toHaveBeenCalled();
  expect(mockLock).toHaveBeenCalledWith(false);
  expect(mockResolve).not.toHaveBeenCalled();
  expect(mockReplace).not.toHaveBeenCalled();
  expect(mockPlay).not.toHaveBeenCalled();
  expect(mockSeek).not.toHaveBeenCalled();
});

it("parkLocal swallows native replace and lock-screen throws", async () => {
  render(tree());
  clearPlayer();

  mockReplace.mockImplementationOnce(() => { throw new Error("native replace"); });
  await act(async () => { await api.parkLocal(first); });
  mockLock.mockImplementationOnce(() => { throw new Error("native lock"); });
  await act(async () => { await api.parkLocal(last); });

  // A native throw must not escape the fire-and-forget cast teardown or read
  // as a playback error.
  expect(api.error).toBeNull();
  expect(mockPlay).not.toHaveBeenCalled();
});

it("a sink installed while the local stream is resolving takes the track before local audio starts", async () => {
  type Resolved = {
    url: string;
    mimeType: string;
    contentLength: number;
    durationSeconds: number;
    expiresAt: number;
  };
  let release!: (value: Resolved | PromiseLike<Resolved>) => void;
  mockResolve.mockReturnValueOnce(new Promise((resolve) => { release = resolve; }));
  render(tree());
  clearPlayer();

  let playing: Promise<void> = Promise.resolve();
  await act(async () => { playing = api.play(first); });

  const sink = jest.fn(async (_track: MediaTrack) => {});
  await act(async () => { api.setCastSink(sink); });
  clearPlayer();

  await act(async () => {
    release({
      url: "https://rr1---sn-test.googlevideo.com/videoplayback?x=late",
      mimeType: "audio/mp4",
      contentLength: 1024,
      durationSeconds: 120,
      expiresAt: 0,
    });
    await playing;
  });

  // The cast session went live while the local resolve was in flight: the
  // receiver owns the sound, so the resolved URL is never handed to the
  // tablet's player.
  expect(sink).toHaveBeenCalledWith(first);
  expect(mockReplace).not.toHaveBeenCalled();
  expect(mockPlay).not.toHaveBeenCalled();
  expect(mockLock).not.toHaveBeenCalled();
});

it("a parked track is what the local toggle resumes", async () => {
  render(tree());
  clearPlayer();

  await act(async () => { await api.parkLocal(last); });
  expect(mockReplace).toHaveBeenCalledTimes(1);
  expect(mockPlay).not.toHaveBeenCalled();

  await act(async () => { api.toggle(); });

  expect(mockPlay).toHaveBeenCalledTimes(1);
});

it("the wall Music widget's next starts the receiver, not local audio", async () => {
  const { getByTestId } = render(
    <PlaybackProvider>
      <ThemeProvider>
        <Probe />
        <MusicWidget />
      </ThemeProvider>
    </PlaybackProvider>
  );
  const sink = jest.fn(async (_track: MediaTrack) => {});
  await act(async () => { api.setCastSink(sink); });
  await act(async () => { await api.play(first, [first, middle]); });
  clearPlayer();

  await act(async () => { fireEvent.press(getByTestId("music-widget-next")); });
  await waitFor(() => expect(sink).toHaveBeenLastCalledWith(middle));
  expect(mockReplace).not.toHaveBeenCalled();
  expect(mockPlay).not.toHaveBeenCalled();
  expect(mockLock).not.toHaveBeenCalled();
});

it("clears the cast sink and resumes local playback", async () => {
  render(tree());
  const sink = jest.fn(async (_track: MediaTrack) => {});
  await act(async () => { api.setCastSink(sink); });
  await act(async () => { api.setCastSink(null); });
  clearPlayer();

  await act(async () => { await api.play(last); });

  expect(sink).not.toHaveBeenCalled();
  expect(mockReplace).toHaveBeenCalledTimes(1);
  expect(mockPlay).toHaveBeenCalledTimes(1);
  expect(mockLock).toHaveBeenCalled();
});

/**
 * THE STOP REPRO (SP4 task 5 final review).
 *
 * A → connect → search row B (the sink moves the queue to B) → the receiver
 * load fails. The cast surface never gets a track, but the LOCAL transport is
 * already pointing at B. Stop must park B — never the pre-cast local A — or
 * Play resumes A under B's title.
 */
it("a failed cast load still parks the chosen track, and the local toggle resumes it", async () => {
  const sessionClient = {
    loadMedia: mockLoadMedia,
    play: mockClientPlay,
    pause: mockClientPause,
    seek: mockClientSeek,
  };
  const castDevice = { deviceId: "tv", friendlyName: "Living Room" };
  const castSession = {
    client: sessionClient,
    getCastDevice: async () => castDevice,
  };
  // The hook stays empty until the SDK event (which this suite never emits):
  // the local play below must stay LOCAL.
  mockCastSession = null;
  mockStartSession.mockResolvedValue(true);
  mockGetCurrentCastSession.mockResolvedValue(castSession);
  mockLoadMedia.mockRejectedValueOnce(new Error("load failed"));

  render(
    <PlaybackProvider>
      <realCast.CastProvider>
        <Probe />
        <RealCastProbe />
      </realCast.CastProvider>
    </PlaybackProvider>
  );

  await act(async () => {});
  // Local A is playing before the family connects the TV.
  await act(async () => { await api.play(first); });
  expect(mockPlay).toHaveBeenCalledTimes(1);

  await act(async () => { await realCastApi!.connect("tv"); });
  await act(async () => {});
  expect(realCastApi!.target?.id).toBe("tv");
  clearPlayer();

  // Search row B goes to the receiver through the sink. The load FAILS, so
  // `cast.track` stays null while `playback.current` is B.
  await act(async () => { await api.play(last); });
  expect(api.current?.id).toBe("visible-2");
  expect(mockLoadMedia).toHaveBeenCalledTimes(1);
  expect(realCastApi!.casting).toBe(false);
  clearPlayer();

  // Stop parks B, the track the family chose — not the pre-cast local A.
  const resolvesBeforeStop = mockResolve.mock.calls.length;
  await act(async () => { await realCastApi!.disconnect(); });
  expect(mockResolve.mock.calls.slice(resolvesBeforeStop)).toEqual([["visible-2"]]);
  expect(mockReplace).toHaveBeenCalledTimes(1);
  expect(mockPlay).not.toHaveBeenCalled();
  expect(mockLock).toHaveBeenCalledWith(false);

  // A local Play after Stop resumes B (the parked track), never A.
  await act(async () => { api.toggle(); });
  expect(mockPlay).toHaveBeenCalledTimes(1);
});

it("a local play records the track in history exactly once", async () => {
  const { getByTestId } = render(tree());
  await act(async () => { await api.play(first); });
  await waitFor(() => expect(getByTestId("history").props.children).toBe("visible-1"));
});

it("a session restored at mount installs the sink, so a later play reaches the receiver and history", async () => {
  const restoredClient = {
    loadMedia: mockLoadMedia,
    play: mockClientPlay,
    pause: mockClientPause,
    seek: mockClientSeek,
  };
  const restoredDevice = { deviceId: "tv", friendlyName: "Living Room" };
  const restoredSession = {
    client: restoredClient,
    getCastDevice: async () => restoredDevice,
  };
  mockCastSession = restoredSession;
  mockGetCurrentCastSession.mockResolvedValue(restoredSession);

  const { getByTestId } = render(
    <PlaybackProvider>
      <realCast.CastProvider>
        <Probe />
        <RealCastProbe />
      </realCast.CastProvider>
    </PlaybackProvider>
  );
  await act(async () => {});
  await waitFor(() => expect(realCastApi?.target?.id).toBe("tv"));
  // Hydrating the restored session silences the tablet at once.
  expect(mockPause).toHaveBeenCalled();
  clearPlayer();

  // A later playback play goes through the provider's sink to the receiver;
  // it never starts local audio and records the track in history once.
  await act(async () => { await api.play(first); });
  await waitFor(() => expect(mockLoadMedia).toHaveBeenCalledTimes(1));
  expect(mockReplace).not.toHaveBeenCalled();
  expect(mockPlay).not.toHaveBeenCalled();
  await waitFor(() => expect(getByTestId("history").props.children).toBe("visible-1"));
});

it("previousForCast clamps to the current track at the start of a repeat-off queue", async () => {
  const { getByTestId } = render(tree());
  await act(async () => { getByTestId("play-triple").props.onPress(); });
  await waitFor(() => expect(getByTestId("title").props.children).toBe("First"));
  clearPlayer();

  const moved = await callPrevious();

  expect(moved?.id).toBe("visible-1");
  expect(api.index).toBe(0);
  expect(getByTestId("index").props.children).toBe("0");
  expect(getByTestId("title").props.children).toBe("First");
  expect(mockPlay).not.toHaveBeenCalled();
  expect(mockPause).not.toHaveBeenCalled();
  expect(mockReplace).not.toHaveBeenCalled();
  expect(mockSeek).not.toHaveBeenCalled();
});
