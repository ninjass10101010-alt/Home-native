/* eslint-disable import/first -- jest.mock factories run before the imports */
import React from "react";
import { act, render, waitFor } from "@testing-library/react-native";

const mockStartSession = jest.fn();
const mockEndCurrentSession = jest.fn();
const mockGetCurrentCastSession = jest.fn();
const mockLoadMedia = jest.fn();
const mockClientPlay = jest.fn();
const mockClientPause = jest.fn();
const mockClientSeek = jest.fn();
const mockResolveAudio = jest.fn();
const mockToggle = jest.fn();
const mockAdvanceForCast = jest.fn();
const mockPreviousForCast = jest.fn();
const mockSetCastSink = jest.fn();

const device = {
  deviceId: "tv",
  friendlyName: "Living Room",
  capabilities: [],
  deviceVersion: "1",
  icons: [],
  ipAddress: "192.168.5.220",
  modelName: "TV",
};

let mockDevices: any[] = [device];
let mockSession: any = null;
let mockStatus: any = null;
let mockPosition = 0;
let mockPlayback: any = {
  current: null,
  queue: [],
  policy: { isParent: false, filterOn: false, denied: [] },
  playing: true,
  toggle: mockToggle,
  advanceForCast: mockAdvanceForCast,
  previousForCast: mockPreviousForCast,
  setCastSink: mockSetCastSink,
};

jest.mock("react-native-google-cast", () => ({
  __esModule: true,
  default: {},
  CastContext: {
    sessionManager: {
      startSession: (id: string) => mockStartSession(id),
      endCurrentSession: (stopCasting: boolean) => mockEndCurrentSession(stopCasting),
      getCurrentCastSession: () => mockGetCurrentCastSession(),
    },
  },
  useCastState: () => "notConnected",
  useDevices: () => mockDevices,
  useCastSession: () => mockSession,
  useStreamPosition: () => mockPosition,
  useMediaStatus: () => mockStatus,
}));

jest.mock("../src/music/playback", () => ({ usePlayback: () => mockPlayback }));
jest.mock("../modules/youtube-engine", () => ({ resolveAudio: (id: string) => mockResolveAudio(id) }));

import { CastProvider, useCast } from "../src/music/CastProvider";
import type { MediaTrack } from "../src/music/types";

const track: MediaTrack = {
  id: "v1",
  title: "Hello",
  artist: "Adele",
  album: "25",
  durationSeconds: 295,
  artworkUrl: null,
  explicit: false,
  source: "youtube_music",
};
const nextTrack: MediaTrack = { ...track, id: "v2", title: "Next" };
const thirdTrack: MediaTrack = { ...track, id: "v3", title: "Third" };

const client = () => ({
  loadMedia: mockLoadMedia,
  play: mockClientPlay,
  pause: mockClientPause,
  seek: mockClientSeek,
});

function Actions({ onReady }: { onReady: (cast: ReturnType<typeof useCast>) => void }) {
  const cast = useCast();
  React.useEffect(() => {
    onReady(cast);
  });
  return null;
}

beforeEach(() => {
  jest.resetAllMocks();
  mockEndCurrentSession.mockResolvedValue(undefined);
  mockGetCurrentCastSession.mockResolvedValue(null);
  mockLoadMedia.mockResolvedValue(undefined);
  mockDevices = [device];
  mockSession = null;
  mockStatus = null;
  mockPosition = 0;
  mockPlayback = {
    current: null,
    queue: [],
    policy: { isParent: false, filterOn: false, denied: [] },
    playing: true,
    toggle: mockToggle,
    advanceForCast: mockAdvanceForCast,
    previousForCast: mockPreviousForCast,
  setCastSink: mockSetCastSink,
  };
});

test("startCast resolves a FRESH url and loads it on the session client", async () => {
  mockStartSession.mockResolvedValue(true);
  mockResolveAudio.mockResolvedValue({ url: "https://rr.example/fresh", mimeType: "audio/mp4", durationSeconds: 295 });
  mockGetCurrentCastSession.mockResolvedValue({ client: client() });
  let api!: ReturnType<typeof useCast>;
  render(
    <CastProvider>
      <Actions onReady={(v) => { api = v; }} />
    </CastProvider>
  );
  await act(async () => {});
  await act(async () => { await api.connect("tv"); await api.startCast(track); });
  expect(mockResolveAudio).toHaveBeenCalledWith("v1");
  expect(mockLoadMedia).toHaveBeenCalledWith({
    mediaInfo: expect.objectContaining({
      contentUrl: "https://rr.example/fresh",
      contentType: "audio/mp4",
      contentId: "v1",
    }),
    autoplay: true,
  });
  expect(mockToggle).toHaveBeenCalled();
});

test("a bare connect does not pause local audio; starting a cast does", async () => {
  mockStartSession.mockResolvedValue(true);
  mockResolveAudio.mockResolvedValue({ url: "https://rr.example/fresh", mimeType: "audio/mp4", durationSeconds: 295 });
  mockGetCurrentCastSession.mockResolvedValue({ client: client() });
  let api!: ReturnType<typeof useCast>;
  render(
    <CastProvider>
      <Actions onReady={(v) => { api = v; }} />
    </CastProvider>
  );
  await act(async () => {});
  await act(async () => { await api.connect("tv"); });
  expect(mockToggle).not.toHaveBeenCalled();
  await act(async () => { await api.startCast(track); });
  expect(mockToggle).toHaveBeenCalledTimes(1);
});

test("a live session installs the cast sink and clears it on stop", async () => {
  mockStartSession.mockResolvedValue(true);
  mockResolveAudio.mockResolvedValue({ url: "https://rr.example/fresh", mimeType: "audio/mp4", durationSeconds: 295 });
  mockGetCurrentCastSession.mockResolvedValue({ client: client() });
  let api!: ReturnType<typeof useCast>;
  render(
    <CastProvider>
      <Actions onReady={(v) => { api = v; }} />
    </CastProvider>
  );
  await act(async () => {});
  await act(async () => { await api.connect("tv"); });
  expect(mockSetCastSink).toHaveBeenCalledWith(expect.any(Function));

  // The installed sink is the provider's own loader: handing it a track
  // reaches the receiver.
  const sink = mockSetCastSink.mock.calls.find(([value]) => typeof value === "function")?.[0] as
    | ((value: MediaTrack) => Promise<void>)
    | undefined;
  await act(async () => { await sink?.(track); });
  expect(mockLoadMedia).toHaveBeenCalledTimes(1);

  await act(async () => { await api.disconnect(); });
  expect(mockSetCastSink).toHaveBeenLastCalledWith(null);
});

test("a failed load names the target and never pauses local audio", async () => {
  mockStartSession.mockResolvedValue(true);
  mockResolveAudio.mockResolvedValue({ url: "https://rr.example/fresh", mimeType: "audio/mp4", durationSeconds: 295 });
  mockLoadMedia.mockRejectedValueOnce(new Error("load failed"));
  mockGetCurrentCastSession.mockResolvedValue({ client: client() });
  let api!: ReturnType<typeof useCast>;
  render(
    <CastProvider>
      <Actions onReady={(v) => { api = v; }} />
    </CastProvider>
  );
  await act(async () => {});
  await act(async () => { await api.connect("tv"); await api.startCast(track); });
  expect(mockLoadMedia).toHaveBeenCalled();
  expect(mockToggle).not.toHaveBeenCalled();
  expect(api.casting).toBe(false);
  expect(api.error).toBe("Couldn't cast to Living Room.");
});

test("a hidden track is refused before it is resolved or loaded", async () => {
  mockStartSession.mockResolvedValue(true);
  mockGetCurrentCastSession.mockResolvedValue({ client: client() });
  mockPlayback = {
    ...mockPlayback,
    policy: { isParent: false, filterOn: true, denied: ["adele"] },
  };
  let api!: ReturnType<typeof useCast>;
  render(
    <CastProvider>
      <Actions onReady={(v) => { api = v; }} />
    </CastProvider>
  );
  await act(async () => {});
  await act(async () => { await api.connect("tv"); await api.startCast(track); });
  expect(mockResolveAudio).not.toHaveBeenCalled();
  expect(mockLoadMedia).not.toHaveBeenCalled();
  expect(api.casting).toBe(false);
  expect(api.error).toBe("This track isn't available to cast.");
});

test("a failed session start surfaces honest copy, reports false and never loads", async () => {
  mockStartSession.mockRejectedValue(new Error("nope"));
  let api!: ReturnType<typeof useCast>;
  render(
    <CastProvider>
      <Actions onReady={(v) => { api = v; }} />
    </CastProvider>
  );
  await act(async () => {});
  let connected = true;
  await act(async () => { connected = await api.connect("tv"); });
  expect(connected).toBe(false);
  expect(mockLoadMedia).not.toHaveBeenCalled();
  expect(api.error).toBe("Couldn't cast to Living Room.");
});

test("an unknown device reports false without opening a session", async () => {
  let api!: ReturnType<typeof useCast>;
  render(
    <CastProvider>
      <Actions onReady={(v) => { api = v; }} />
    </CastProvider>
  );
  await act(async () => {});
  let connected = true;
  await act(async () => { connected = await api.connect("missing"); });
  expect(connected).toBe(false);
  expect(mockStartSession).not.toHaveBeenCalled();
});

test("never loads without a session and asks for a device", async () => {
  let api!: ReturnType<typeof useCast>;
  render(
    <CastProvider>
      <Actions onReady={(v) => { api = v; }} />
    </CastProvider>
  );
  await act(async () => {});
  await act(async () => { await api.startCast(track); });
  expect(mockResolveAudio).not.toHaveBeenCalled();
  expect(mockLoadMedia).not.toHaveBeenCalled();
  expect(api.error).toBe("Choose a device to cast to.");
});

test("the transport drives the cast client and disconnect ends the session", async () => {
  mockStartSession.mockResolvedValue(true);
  mockGetCurrentCastSession.mockResolvedValue({ client: client() });
  let api!: ReturnType<typeof useCast>;
  render(
    <CastProvider>
      <Actions onReady={(v) => { api = v; }} />
    </CastProvider>
  );
  await act(async () => {});
  await act(async () => { await api.connect("tv"); });
  await act(async () => {
    await api.play();
    await api.pause();
    await api.seek(42);
  });
  expect(mockClientPlay).toHaveBeenCalled();
  expect(mockClientPause).toHaveBeenCalled();
  expect(mockClientSeek).toHaveBeenCalledWith({ position: 42 });
  await act(async () => { await api.disconnect(); });
  expect(mockEndCurrentSession).toHaveBeenCalledWith(true);
  expect(api.target).toBeNull();
});

test("previous seeks the receiver to the start when it is past three seconds", async () => {
  mockStartSession.mockResolvedValue(true);
  mockGetCurrentCastSession.mockResolvedValue({ client: client() });
  mockPosition = 5;
  let api!: ReturnType<typeof useCast>;
  render(
    <CastProvider>
      <Actions onReady={(v) => { api = v; }} />
    </CastProvider>
  );
  await act(async () => {});
  await act(async () => { await api.connect("tv"); await api.previous(); });
  expect(mockClientSeek).toHaveBeenCalledWith({ position: 0 });
  expect(mockPreviousForCast).not.toHaveBeenCalled();
  expect(mockLoadMedia).not.toHaveBeenCalled();
});

test("previous loads the previous visible track near the start", async () => {
  const previousTrack: MediaTrack = { ...track, id: "v0", title: "Previous" };
  mockStartSession.mockResolvedValue(true);
  mockResolveAudio.mockResolvedValue({ url: "https://rr.example/fresh", mimeType: "audio/mp4", durationSeconds: 295 });
  mockGetCurrentCastSession.mockResolvedValue({ client: client() });
  mockPreviousForCast.mockReturnValue(previousTrack);
  mockPosition = 2;
  let api!: ReturnType<typeof useCast>;
  render(
    <CastProvider>
      <Actions onReady={(v) => { api = v; }} />
    </CastProvider>
  );
  await act(async () => {});
  await act(async () => { await api.connect("tv"); await api.previous(); });
  expect(mockPreviousForCast).toHaveBeenCalledTimes(1);
  expect(mockClientSeek).not.toHaveBeenCalled();
  expect(mockResolveAudio).toHaveBeenCalledWith("v0");
  expect(mockLoadMedia).toHaveBeenCalledWith(
    expect.objectContaining({
      mediaInfo: expect.objectContaining({ contentId: "v0" }),
    })
  );
});

test("a policy change that hides the cast track stops the session", async () => {
  mockStartSession.mockResolvedValue(true);
  mockResolveAudio.mockResolvedValue({ url: "https://rr.example/fresh", mimeType: "audio/mp4", durationSeconds: 295 });
  mockGetCurrentCastSession.mockResolvedValue({ client: client() });
  mockPlayback = { ...mockPlayback, playing: false };
  let api!: ReturnType<typeof useCast>;
  const view = render(
    <CastProvider>
      <Actions onReady={(v) => { api = v; }} />
    </CastProvider>
  );
  await act(async () => {});
  await act(async () => { await api.connect("tv"); await api.startCast(track); });
  expect(api.casting).toBe(true);
  mockPlayback = {
    ...mockPlayback,
    policy: { isParent: false, filterOn: true, denied: ["adele"] },
  };
  view.rerender(
    <CastProvider>
      <Actions onReady={(v) => { api = v; }} />
    </CastProvider>
  );
  await act(async () => {});
  expect(mockEndCurrentSession).toHaveBeenCalledWith(true);
  expect(api.casting).toBe(false);
});

test("a finished cast advances exactly once per completion", async () => {
  mockStartSession.mockResolvedValue(true);
  mockResolveAudio.mockResolvedValue({ url: "https://rr.example/fresh", mimeType: "audio/mp4", durationSeconds: 295 });
  mockGetCurrentCastSession.mockResolvedValue({ client: client() });
  mockAdvanceForCast.mockReturnValueOnce(nextTrack).mockReturnValueOnce(thirdTrack);

  let api!: ReturnType<typeof useCast>;
  const tree = () => (
    <CastProvider>
      <Actions onReady={(v) => { api = v; }} />
    </CastProvider>
  );
  const view = render(tree());
  await act(async () => {});
  await act(async () => { await api.connect("tv"); await api.startCast(track); });
  expect(mockLoadMedia).toHaveBeenCalledTimes(1);

  // The receiver finishes the cast track and keeps reporting FINISHED.
  mockStatus = { playerState: "idle", idleReason: "finished", mediaSessionId: 1 };
  await act(async () => { view.rerender(tree()); });
  await waitFor(() => expect(mockLoadMedia).toHaveBeenCalledTimes(2));

  expect(mockAdvanceForCast).toHaveBeenCalledTimes(1);
  expect(mockAdvanceForCast).toHaveBeenCalledWith(true);
  expect(mockResolveAudio).toHaveBeenLastCalledWith("v2");

  // The stale FINISHED status is still on screen: no second advance.
  await act(async () => { view.rerender(tree()); });
  await act(async () => {});
  expect(mockAdvanceForCast).toHaveBeenCalledTimes(1);
  expect(mockLoadMedia).toHaveBeenCalledTimes(2);

  // The next track finishes — a new media session is a new completion.
  mockStatus = { playerState: "idle", idleReason: "finished", mediaSessionId: 2 };
  await act(async () => { view.rerender(tree()); });
  await waitFor(() => expect(mockLoadMedia).toHaveBeenCalledTimes(3));

  expect(mockAdvanceForCast).toHaveBeenCalledTimes(2);
  expect(mockResolveAudio).toHaveBeenLastCalledWith("v3");
});

test("without mediaSessionId, the playing transition re-arms each completion (real SDK sequence)", async () => {
  mockStartSession.mockResolvedValue(true);
  mockResolveAudio.mockResolvedValue({ url: "https://rr.example/fresh", mimeType: "audio/mp4", durationSeconds: 295 });
  mockGetCurrentCastSession.mockResolvedValue({ client: client() });
  mockAdvanceForCast.mockReturnValueOnce(nextTrack).mockReturnValueOnce(thirdTrack);

  let api!: ReturnType<typeof useCast>;
  const tree = () => (
    <CastProvider>
      <Actions onReady={(v) => { api = v; }} />
    </CastProvider>
  );
  const view = render(tree());
  await act(async () => {});

  // The receiver is PLAYING (the load autoplays) and reports NO mediaSessionId
  // — the only shape react-native-google-cast 4.9.1 can produce.
  mockStatus = { playerState: "playing", idleReason: null };
  await act(async () => { await api.connect("tv"); await api.startCast(track); });
  await act(async () => { view.rerender(tree()); });
  expect(mockLoadMedia).toHaveBeenCalledTimes(1);
  expect(mockAdvanceForCast).not.toHaveBeenCalled();

  // First completion: idle/finished, still no session id.
  mockStatus = { playerState: "idle", idleReason: "finished" };
  await act(async () => { view.rerender(tree()); });
  await waitFor(() => expect(mockLoadMedia).toHaveBeenCalledTimes(2));
  expect(mockAdvanceForCast).toHaveBeenCalledTimes(1);
  expect(mockAdvanceForCast).toHaveBeenCalledWith(true);
  expect(mockResolveAudio).toHaveBeenLastCalledWith("v2");

  // The 1 Hz status tick is a NEW object that differs ONLY in streamPosition:
  // same playerState/idleReason, same (missing) session id. No second advance.
  mockStatus = { playerState: "idle", idleReason: "finished", streamPosition: 42 };
  await act(async () => { view.rerender(tree()); });
  mockStatus = { playerState: "idle", idleReason: "finished", streamPosition: 43 };
  await act(async () => { view.rerender(tree()); });
  expect(mockAdvanceForCast).toHaveBeenCalledTimes(1);
  expect(mockLoadMedia).toHaveBeenCalledTimes(2);

  // The receiver reports PLAYING again: the guard re-arms (the key shape is
  // `none:<trackId>` both times, so this transition is the only re-arm).
  mockStatus = { playerState: "playing", idleReason: null };
  await act(async () => { view.rerender(tree()); });

  // Second completion: the next finish advances again.
  mockStatus = { playerState: "idle", idleReason: "finished" };
  await act(async () => { view.rerender(tree()); });
  await waitFor(() => expect(mockLoadMedia).toHaveBeenCalledTimes(3));
  expect(mockAdvanceForCast).toHaveBeenCalledTimes(2);
  expect(mockResolveAudio).toHaveBeenLastCalledWith("v3");
});

test("repeat-one reloads the same track and advances again after the next finish", async () => {
  mockStartSession.mockResolvedValue(true);
  mockResolveAudio.mockResolvedValue({ url: "https://rr.example/fresh", mimeType: "audio/mp4", durationSeconds: 295 });
  mockGetCurrentCastSession.mockResolvedValue({ client: client() });
  // Repeat-one: the queue step returns the SAME track every time.
  mockAdvanceForCast.mockReturnValue(track);

  let api!: ReturnType<typeof useCast>;
  const tree = () => (
    <CastProvider>
      <Actions onReady={(v) => { api = v; }} />
    </CastProvider>
  );
  const view = render(tree());
  await act(async () => {});

  mockStatus = { playerState: "playing", idleReason: null };
  await act(async () => { await api.connect("tv"); await api.startCast(track); });
  await act(async () => { view.rerender(tree()); });
  expect(mockLoadMedia).toHaveBeenCalledTimes(1);

  // First finish: one advance, and the SAME track is loaded again.
  mockStatus = { playerState: "idle", idleReason: "finished" };
  await act(async () => { view.rerender(tree()); });
  await waitFor(() => expect(mockLoadMedia).toHaveBeenCalledTimes(2));
  expect(mockAdvanceForCast).toHaveBeenCalledTimes(1);
  expect(mockLoadMedia).toHaveBeenLastCalledWith(
    expect.objectContaining({
      mediaInfo: expect.objectContaining({ contentId: "v1" }),
    })
  );

  // The reload starts playing: with no mediaSessionId this is the ONLY re-arm.
  mockStatus = { playerState: "playing", idleReason: null };
  await act(async () => { view.rerender(tree()); });

  // The reloaded track finishes again — it must advance, not stall.
  mockStatus = { playerState: "idle", idleReason: "finished" };
  await act(async () => { view.rerender(tree()); });
  await waitFor(() => expect(mockLoadMedia).toHaveBeenCalledTimes(3));
  expect(mockAdvanceForCast).toHaveBeenCalledTimes(2);
  expect(mockResolveAudio).toHaveBeenLastCalledWith("v1");
});

test("a cast error keeps the honest error path and does not advance", async () => {
  mockStartSession.mockResolvedValue(true);
  mockResolveAudio.mockResolvedValue({ url: "https://rr.example/fresh", mimeType: "audio/mp4", durationSeconds: 295 });
  mockGetCurrentCastSession.mockResolvedValue({ client: client() });
  let api!: ReturnType<typeof useCast>;
  const view = render(
    <CastProvider>
      <Actions onReady={(v) => { api = v; }} />
    </CastProvider>
  );
  await act(async () => {});
  await act(async () => { await api.connect("tv"); await api.startCast(track); });

  mockStatus = { playerState: "idle", idleReason: "error", mediaSessionId: 1 };
  await act(async () => {
    view.rerender(
      <CastProvider>
        <Actions onReady={(v) => { api = v; }} />
      </CastProvider>
    );
  });

  expect(mockAdvanceForCast).not.toHaveBeenCalled();
  expect(api.error).toBe("The cast stopped. Try again.");
});

test("a failed policy stop keeps the cast surface and says so", async () => {
  mockStartSession.mockResolvedValue(true);
  mockResolveAudio.mockResolvedValue({ url: "https://rr.example/fresh", mimeType: "audio/mp4", durationSeconds: 295 });
  mockGetCurrentCastSession.mockResolvedValue({ client: client() });
  mockPlayback = { ...mockPlayback, playing: false };
  let api!: ReturnType<typeof useCast>;
  const view = render(
    <CastProvider>
      <Actions onReady={(v) => { api = v; }} />
    </CastProvider>
  );
  await act(async () => {});
  await act(async () => { await api.connect("tv"); await api.startCast(track); });
  expect(api.casting).toBe(true);
  mockEndCurrentSession.mockRejectedValue(new Error("stop failed"));
  mockPlayback = {
    ...mockPlayback,
    policy: { isParent: false, filterOn: true, denied: ["adele"] },
  };
  view.rerender(
    <CastProvider>
      <Actions onReady={(v) => { api = v; }} />
    </CastProvider>
  );
  await act(async () => {});
  expect(mockEndCurrentSession).toHaveBeenCalledTimes(1);
  expect(api.casting).toBe(true);
  expect(api.target?.id).toBe("tv");
  expect(api.error).toBe("Couldn't stop casting. Try again.");
});
