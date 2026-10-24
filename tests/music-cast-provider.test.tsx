/* eslint-disable import/first -- jest.mock factories run before the imports */
import React from "react";
import { act, render, waitFor } from "@testing-library/react-native";

const mockStartSession = jest.fn();
const mockSessionStartedRemove = jest.fn();
const mockSessionStartFailedRemove = jest.fn();
const mockEndCurrentSession = jest.fn();
const mockGetCurrentCastSession = jest.fn();
const mockLoadMedia = jest.fn();
const mockClientPlay = jest.fn();
const mockClientPause = jest.fn();
const mockClientSeek = jest.fn();
const mockGetVolume = jest.fn(async () => 0.5);
const mockIsMute = jest.fn(async () => false);
const mockSetVolume = jest.fn();
const mockSetMute = jest.fn();
const mockResolveAudio = jest.fn();
const mockToggle = jest.fn();
const mockPauseLocal = jest.fn();
const mockParkLocal = jest.fn(async (_track: any) => {});
const mockAdvanceForCast = jest.fn();
const mockPreviousForCast = jest.fn();
const mockSetCastSink = jest.fn();
const mockRecordHistory = jest.fn(async (_track: any) => {});

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
let mockSessionStarted: ((session: any) => void) | null = null;
let mockSessionStartFailed: ((session: any, error: string) => void) | null = null;
let mockSession: any = null;
let mockStatus: any = null;
let mockPosition = 0;
let mockPlayback: any = {
  current: null,
  queue: [],
  policy: { isParent: false, filterOn: false, denied: [] },
  playing: true,
  toggle: mockToggle,
  pauseLocal: mockPauseLocal,
  parkLocal: mockParkLocal,
  advanceForCast: mockAdvanceForCast,
  previousForCast: mockPreviousForCast,
  setCastSink: mockSetCastSink,
  recordHistory: mockRecordHistory,
};

jest.mock("react-native-google-cast", () => ({
  __esModule: true,
  default: {},
  CastContext: {
    sessionManager: {
      startSession: (id: string) => mockStartSession(id),
      endCurrentSession: (stopCasting: boolean) => mockEndCurrentSession(stopCasting),
      getCurrentCastSession: () => mockGetCurrentCastSession(),
      onSessionStarted: (handler: (session: any) => void) => {
        mockSessionStarted = handler;
        return {
          remove: () => {
            if (mockSessionStarted === handler) mockSessionStarted = null;
            mockSessionStartedRemove();
          },
        };
      },
      onSessionStartFailed: (handler: (session: any, error: string) => void) => {
        mockSessionStartFailed = handler;
        return {
          remove: () => {
            if (mockSessionStartFailed === handler) mockSessionStartFailed = null;
            mockSessionStartFailedRemove();
          },
        };
      },
    },
  },
  useCastState: () => "notConnected",
  useDevices: () => mockDevices,
  useCastSession: () => mockSession,
  useStreamPosition: () => mockPosition,
  useMediaStatus: () => mockStatus,
}));

jest.mock("../src/music/playback", () => ({ usePlayback: () => mockPlayback }));
jest.mock("../modules/youtube-engine", () => ({
  resolveAudio: (id: string) => mockResolveAudio(id),
  // The last resolution (the codec chip's truth) and its subscription.
  lastStreamFormat: jest.fn(() => null),
  subscribeStreamFormat: jest.fn(() => () => {}),
}));

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

const sessionFor = (d = device, c: any = client()) => ({
  client: c,
  getCastDevice: async () => d,
  getVolume: mockGetVolume,
  isMute: mockIsMute,
  setVolume: mockSetVolume,
  setMute: mockSetMute,
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
  mockRecordHistory.mockResolvedValue(undefined);
  mockGetCurrentCastSession.mockResolvedValue(null);
  mockLoadMedia.mockResolvedValue(undefined);
  mockGetVolume.mockResolvedValue(0.5);
  mockIsMute.mockResolvedValue(false);
  mockDevices = [device];
  mockSession = null;
  mockSessionStarted = null;
  mockSessionStartFailed = null;
  mockStatus = null;
  mockPosition = 0;
  mockPlayback = {
    current: null,
    queue: [],
    policy: { isParent: false, filterOn: false, denied: [] },
    playing: true,
    toggle: mockToggle,
    pauseLocal: mockPauseLocal,
    parkLocal: mockParkLocal,
    advanceForCast: mockAdvanceForCast,
    previousForCast: mockPreviousForCast,
    setCastSink: mockSetCastSink,
    recordHistory: mockRecordHistory,
  };
});

test("startCast resolves a FRESH url and loads it on the session client", async () => {
  mockStartSession.mockResolvedValue(true);
  mockResolveAudio.mockResolvedValue({ url: "https://rr.example/fresh", mimeType: "audio/mp4", durationSeconds: 295 });
  mockGetCurrentCastSession.mockResolvedValue(sessionFor());
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
  expect(mockRecordHistory).toHaveBeenCalledTimes(1);
  expect(mockRecordHistory).toHaveBeenCalledWith(track);
  expect(mockToggle).not.toHaveBeenCalled();
});

test("connect pauses local audio directly; starting a cast never toggles it", async () => {
  mockStartSession.mockResolvedValue(true);
  mockResolveAudio.mockResolvedValue({ url: "https://rr.example/fresh", mimeType: "audio/mp4", durationSeconds: 295 });
  mockGetCurrentCastSession.mockResolvedValue(sessionFor());
  let api!: ReturnType<typeof useCast>;
  render(
    <CastProvider>
      <Actions onReady={(v) => { api = v; }} />
    </CastProvider>
  );
  await act(async () => {});
  await act(async () => { await api.connect("tv"); });
  expect(mockPauseLocal).toHaveBeenCalledTimes(1);
  expect(mockToggle).not.toHaveBeenCalled();
  await act(async () => { await api.startCast(track); });
  expect(mockToggle).not.toHaveBeenCalled();
  expect(mockPauseLocal).toHaveBeenCalledTimes(1);
});

test("a live session installs the cast sink and clears it on stop", async () => {
  mockStartSession.mockResolvedValue(true);
  mockResolveAudio.mockResolvedValue({ url: "https://rr.example/fresh", mimeType: "audio/mp4", durationSeconds: 295 });
  mockGetCurrentCastSession.mockResolvedValue(sessionFor());
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

test("a session restored at mount hydrates the target, pauses local and installs the sink", async () => {
  const restored = sessionFor(device);
  mockSession = restored;
  mockGetCurrentCastSession.mockResolvedValue(restored);
  mockResolveAudio.mockResolvedValue({ url: "https://rr.example/fresh", mimeType: "audio/mp4", durationSeconds: 295 });
  let api!: ReturnType<typeof useCast>;
  render(
    <CastProvider>
      <Actions onReady={(v) => { api = v; }} />
    </CastProvider>
  );
  await act(async () => {});
  await waitFor(() => expect(api.target?.id).toBe("tv"));
  expect(api.target?.name).toBe("Living Room");
  expect(mockPauseLocal).toHaveBeenCalled();
  expect(mockSetCastSink).toHaveBeenCalledWith(expect.any(Function));

  // The restored session is the sink: a later play reaches the receiver.
  const sink = mockSetCastSink.mock.calls.find(([value]) => typeof value === "function")?.[0] as
    | ((value: MediaTrack) => Promise<void>)
    | undefined;
  await act(async () => { await sink?.(track); });
  expect(mockLoadMedia).toHaveBeenCalledTimes(1);
  expect(mockRecordHistory).toHaveBeenCalledWith(track);
});

test("a failed load names the target, pauses local audio and never re-enters the sink", async () => {
  mockStartSession.mockResolvedValue(true);
  mockResolveAudio.mockResolvedValue({ url: "https://rr.example/fresh", mimeType: "audio/mp4", durationSeconds: 295 });
  mockLoadMedia.mockRejectedValueOnce(new Error("load failed"));
  mockGetCurrentCastSession.mockResolvedValue(sessionFor());
  let api!: ReturnType<typeof useCast>;
  render(
    <CastProvider>
      <Actions onReady={(v) => { api = v; }} />
    </CastProvider>
  );
  await act(async () => {});
  await act(async () => { await api.connect("tv"); await api.startCast(track); });
  // Connect always pauses the tablet directly; the failed load is reported
  // once and never routed back through the sink or `toggle`.
  expect(mockLoadMedia).toHaveBeenCalledTimes(1);
  expect(mockPauseLocal).toHaveBeenCalledTimes(1);
  expect(mockToggle).not.toHaveBeenCalled();
  expect(mockRecordHistory).not.toHaveBeenCalled();
  expect(api.casting).toBe(false);
  expect(api.error).toBe("Couldn't cast to Living Room.");
});

test("a session event emitted before startSession resolves is not missed", async () => {
  const earlyLoad = jest.fn(async () => {});
  const earlyClient = { ...client(), loadMedia: earlyLoad };
  mockStartSession.mockImplementation(async () => {
    // The tablet's receiver starts during the startSession call itself: the
    // event lands before the returned promise resolves.
    mockSessionStarted?.(sessionFor(device, earlyClient));
    return true;
  });
  mockGetCurrentCastSession.mockResolvedValue(null);
  mockResolveAudio.mockResolvedValue({ url: "https://rr.example/fresh", mimeType: "audio/mp4", durationSeconds: 295 });
  let api!: ReturnType<typeof useCast>;
  render(
    <CastProvider>
      <Actions onReady={(v) => { api = v; }} />
    </CastProvider>
  );
  await act(async () => {});

  let connected = false;
  await act(async () => { connected = await api.connect("tv"); });
  expect(connected).toBe(true);
  expect(api.target?.id).toBe("tv");
  expect(mockEndCurrentSession).not.toHaveBeenCalled();
  expect(mockSessionStartedRemove).toHaveBeenCalled();
  expect(mockSessionStartFailedRemove).toHaveBeenCalled();

  await act(async () => { await api.startCast(track); });
  expect(earlyLoad).toHaveBeenCalledTimes(1);
  expect(mockLoadMedia).not.toHaveBeenCalled();
});

test("connect waits for the receiver and loads on the session that arrives later", async () => {
  const lateLoad = jest.fn(async () => {});
  const lateClient = { ...client(), loadMedia: lateLoad };
  mockStartSession.mockResolvedValue(true);
  mockGetCurrentCastSession.mockResolvedValue(null);
  mockResolveAudio.mockResolvedValue({ url: "https://rr.example/fresh", mimeType: "audio/mp4", durationSeconds: 295 });
  let api!: ReturnType<typeof useCast>;
  render(
    <CastProvider>
      <Actions onReady={(v) => { api = v; }} />
    </CastProvider>
  );
  await act(async () => {});

  let pending!: Promise<boolean>;
  await act(async () => {
    pending = api.connect("tv");
    await Promise.resolve();
  });
  // startSession resolved, but the SDK session has not arrived yet: the
  // connect must NOT read the missing session as a failure.
  expect(api.busy).toBe(true);

  await act(async () => { mockSessionStarted?.(sessionFor(device, lateClient)); });
  let connected = false;
  await act(async () => { connected = await pending; });
  expect(connected).toBe(true);
  expect(api.target?.id).toBe("tv");
  expect(api.busy).toBe(false);

  await act(async () => { await api.startCast(track); });
  expect(lateLoad).toHaveBeenCalledTimes(1);
  expect(mockLoadMedia).not.toHaveBeenCalled();
});

test("a device switch ignores the old session and waits for the new device", async () => {
  const speaker = { ...device, deviceId: "speaker", friendlyName: "Kitchen" };
  const speakerLoad = jest.fn(async () => {});
  const speakerClient = { ...client(), loadMedia: speakerLoad };
  mockDevices = [device, speaker];
  mockStartSession.mockResolvedValue(true);
  // The SDK still reports the OLD session after startSession resolves; only
  // the onSessionStarted event names the new device.
  mockGetCurrentCastSession.mockResolvedValue(sessionFor(device));
  mockResolveAudio.mockResolvedValue({ url: "https://rr.example/fresh", mimeType: "audio/mp4", durationSeconds: 295 });
  let api!: ReturnType<typeof useCast>;
  render(
    <CastProvider>
      <Actions onReady={(v) => { api = v; }} />
    </CastProvider>
  );
  await act(async () => {});
  await act(async () => { await api.connect("tv"); });
  expect(api.target?.id).toBe("tv");

  let pending!: Promise<boolean>;
  await act(async () => {
    pending = api.connect("speaker");
    await Promise.resolve();
  });
  let settled = false;
  void pending.then(() => { settled = true; });
  await act(async () => { await Promise.resolve(); });
  // Still waiting: the OLD device must never satisfy the new connect.
  expect(settled).toBe(false);
  expect(api.target?.id).toBe("tv");

  await act(async () => { mockSessionStarted?.(sessionFor(speaker, speakerClient)); });
  let switched = false;
  await act(async () => { switched = await pending; });
  expect(switched).toBe(true);
  expect(api.target?.id).toBe("speaker");

  await act(async () => { await api.startCast(track); });
  expect(speakerLoad).toHaveBeenCalledTimes(1);
});

test("connect gives up after the bounded wait and ends the session it opened", async () => {
  jest.useFakeTimers();
  try {
    mockStartSession.mockResolvedValue(true);
    mockGetCurrentCastSession.mockResolvedValue(null);
    let api!: ReturnType<typeof useCast>;
    render(
      <CastProvider>
        <Actions onReady={(v) => { api = v; }} />
      </CastProvider>
    );
    await act(async () => {});

    let pending!: Promise<boolean>;
    await act(async () => {
      pending = api.connect("tv");
      await Promise.resolve();
    });
    await act(async () => {
      jest.advanceTimersByTime(6000);
      await Promise.resolve();
    });

    let connected = true;
    await act(async () => { connected = await pending; });
    expect(connected).toBe(false);
    expect(mockEndCurrentSession).toHaveBeenCalledWith(true);
    expect(mockSessionStartedRemove).toHaveBeenCalled();
    expect(mockSessionStartFailedRemove).toHaveBeenCalled();
    expect(api.target).toBeNull();
    expect(api.error).toBe("Couldn't cast to Living Room.");
    expect(mockLoadMedia).not.toHaveBeenCalled();
  } finally {
    jest.useRealTimers();
  }
});

test("a failed session start ends the session it opened and reports false", async () => {
  mockStartSession.mockResolvedValue(true);
  mockGetCurrentCastSession.mockResolvedValue(null);
  let api!: ReturnType<typeof useCast>;
  render(
    <CastProvider>
      <Actions onReady={(v) => { api = v; }} />
    </CastProvider>
  );
  await act(async () => {});

  let pending!: Promise<boolean>;
  await act(async () => {
    pending = api.connect("tv");
    await Promise.resolve();
  });
  await act(async () => { mockSessionStartFailed?.({}, "start failed"); });

  let connected = true;
  await act(async () => { connected = await pending; });
  expect(connected).toBe(false);
  // `startSession` returned true, so a live session may exist even though the
  // receiver never produced one: end it instead of leaving it running.
  expect(mockEndCurrentSession).toHaveBeenCalledWith(true);
  expect(mockSessionStartedRemove).toHaveBeenCalled();
  expect(mockSessionStartFailedRemove).toHaveBeenCalled();
  expect(api.target).toBeNull();
  expect(api.error).toBe("Couldn't cast to Living Room.");
});

test("a refused session start settles the wait and removes its listeners", async () => {
  mockStartSession.mockResolvedValue(false);
  mockGetCurrentCastSession.mockResolvedValue(null);
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
  expect(mockSessionStartedRemove).toHaveBeenCalled();
  expect(mockSessionStartFailedRemove).toHaveBeenCalled();
  // Nothing was opened, so there is nothing to tear down.
  expect(mockEndCurrentSession).not.toHaveBeenCalled();
  expect(api.target).toBeNull();
  expect(api.error).toBe("Couldn't cast to Living Room.");
});

test("a live session parks once across disconnect and the session-end effect", async () => {
  const sessionClient = client();
  mockSession = sessionFor(device, sessionClient);
  mockStartSession.mockResolvedValue(true);
  mockResolveAudio.mockResolvedValue({ url: "https://rr.example/fresh", mimeType: "audio/mp4", durationSeconds: 295 });
  mockGetCurrentCastSession.mockResolvedValue(sessionFor(device, sessionClient));
  mockPlayback = { ...mockPlayback, current: track };
  let api!: ReturnType<typeof useCast>;
  const tree = () => (
    <CastProvider>
      <Actions onReady={(v) => { api = v; }} />
    </CastProvider>
  );
  const view = render(tree());
  await act(async () => {});
  await act(async () => { await api.connect("tv"); await api.startCast(track); });
  expect(api.casting).toBe(true);

  // A normal Stop parks once...
  await act(async () => { await api.disconnect(); });
  expect(mockParkLocal).toHaveBeenCalledTimes(1);
  expect(mockParkLocal).toHaveBeenCalledWith(track);

  // ...and the live session disappearing afterwards must not park again for
  // the same track.
  mockSession = null;
  await act(async () => { view.rerender(tree()); });
  await act(async () => {});
  expect(mockParkLocal).toHaveBeenCalledTimes(1);
});

test("a hidden track is refused before it is resolved or loaded", async () => {
  mockStartSession.mockResolvedValue(true);
  mockGetCurrentCastSession.mockResolvedValue(sessionFor());
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

test("a failed device switch ends the previous session before clearing", async () => {
  const speaker = { ...device, deviceId: "speaker", friendlyName: "Kitchen" };
  mockDevices = [device, speaker];
  mockStartSession.mockResolvedValueOnce(true).mockRejectedValueOnce(new Error("switch failed"));
  mockGetCurrentCastSession.mockResolvedValue(sessionFor());
  let api!: ReturnType<typeof useCast>;
  render(
    <CastProvider>
      <Actions onReady={(v) => { api = v; }} />
    </CastProvider>
  );
  await act(async () => {});
  await act(async () => { await api.connect("tv"); });
  expect(api.target?.id).toBe("tv");

  let connected = true;
  await act(async () => { connected = await api.connect("speaker"); });
  expect(connected).toBe(false);
  expect(mockEndCurrentSession).toHaveBeenCalledWith(true);
  expect(api.target).toBeNull();
  expect(api.error).toBe("Couldn't cast to Kitchen.");
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
  mockGetCurrentCastSession.mockResolvedValue(sessionFor());
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
  // A connected-but-idle session never held a cast track: nothing to park.
  expect(mockParkLocal).not.toHaveBeenCalled();
  expect(api.target).toBeNull();
});

test("disconnect parks the local transport on the last cast track", async () => {
  mockStartSession.mockResolvedValue(true);
  mockResolveAudio.mockResolvedValue({ url: "https://rr.example/fresh", mimeType: "audio/mp4", durationSeconds: 295 });
  mockGetCurrentCastSession.mockResolvedValue(sessionFor());
  let api!: ReturnType<typeof useCast>;
  render(
    <CastProvider>
      <Actions onReady={(v) => { api = v; }} />
    </CastProvider>
  );
  await act(async () => {});
  await act(async () => { await api.connect("tv"); await api.startCast(track); });
  await act(async () => { await api.disconnect(); });
  expect(mockEndCurrentSession).toHaveBeenCalledWith(true);
  expect(mockParkLocal).toHaveBeenCalledWith(track);
});

test("losing the cast session parks the local transport on the current cast track", async () => {
  const sessionClient = client();
  mockSession = sessionFor(device, sessionClient);
  mockStartSession.mockResolvedValue(true);
  mockResolveAudio.mockResolvedValue({ url: "https://rr.example/fresh", mimeType: "audio/mp4", durationSeconds: 295 });
  mockGetCurrentCastSession.mockResolvedValue(sessionFor(device, sessionClient));
  mockPlayback = { ...mockPlayback, current: nextTrack };
  let api!: ReturnType<typeof useCast>;
  const tree = () => (
    <CastProvider>
      <Actions onReady={(v) => { api = v; }} />
    </CastProvider>
  );
  const view = render(tree());
  await act(async () => {});
  await act(async () => { await api.connect("tv"); await api.startCast(track); });
  expect(api.casting).toBe(true);

  mockSession = null;
  await act(async () => { view.rerender(tree()); });
  await waitFor(() => expect(mockParkLocal).toHaveBeenCalledWith(nextTrack));
  expect(api.casting).toBe(false);
  expect(api.target).toBeNull();
});

test("previous seeks the receiver to the start when it is past three seconds", async () => {
  mockStartSession.mockResolvedValue(true);
  mockGetCurrentCastSession.mockResolvedValue(sessionFor());
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
  mockGetCurrentCastSession.mockResolvedValue(sessionFor());
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
  mockGetCurrentCastSession.mockResolvedValue(sessionFor());
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
  mockGetCurrentCastSession.mockResolvedValue(sessionFor());
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
  mockGetCurrentCastSession.mockResolvedValue(sessionFor());
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
  mockGetCurrentCastSession.mockResolvedValue(sessionFor());
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
  mockGetCurrentCastSession.mockResolvedValue(sessionFor());
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
  mockGetCurrentCastSession.mockResolvedValue(sessionFor());
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

test("connect hydrates the receiver's volume and mute state", async () => {
  mockStartSession.mockResolvedValue(true);
  mockGetCurrentCastSession.mockResolvedValue(sessionFor());
  mockGetVolume.mockResolvedValue(0.35);
  mockIsMute.mockResolvedValue(true);
  let api!: ReturnType<typeof useCast>;
  render(
    <CastProvider>
      <Actions onReady={(v) => { api = v; }} />
    </CastProvider>
  );
  await act(async () => {});
  await act(async () => { await api.connect("tv"); });
  expect(mockGetVolume).toHaveBeenCalled();
  expect(mockIsMute).toHaveBeenCalled();
  expect(api.volume).toBe(0.35);
  expect(api.muted).toBe(true);
});

test("a restored session hydrates the receiver's volume and mute state", async () => {
  mockSession = sessionFor(device);
  mockGetCurrentCastSession.mockResolvedValue(mockSession);
  mockGetVolume.mockResolvedValue(0.8);
  mockIsMute.mockResolvedValue(true);
  let api!: ReturnType<typeof useCast>;
  render(
    <CastProvider>
      <Actions onReady={(v) => { api = v; }} />
    </CastProvider>
  );
  await act(async () => {});
  await waitFor(() => expect(api.target?.id).toBe("tv"));
  expect(mockGetVolume).toHaveBeenCalled();
  expect(mockIsMute).toHaveBeenCalled();
  expect(api.volume).toBe(0.8);
  expect(api.muted).toBe(true);
});

test("a stale volume read never overwrites a newer user nudge", async () => {
  mockStartSession.mockResolvedValue(true);
  mockGetCurrentCastSession.mockResolvedValue(sessionFor());
  let resolveVolume!: (value: number) => void;
  mockGetVolume.mockImplementationOnce(
    () => new Promise<number>((resolve) => { resolveVolume = resolve; })
  );
  let api!: ReturnType<typeof useCast>;
  render(
    <CastProvider>
      <Actions onReady={(v) => { api = v; }} />
    </CastProvider>
  );
  await act(async () => {});
  await act(async () => { await api.connect("tv"); });
  // The sheet is usable while the receiver read is still in flight.
  expect(api.busy).toBe(false);

  await act(async () => { await api.adjustVolume(0.1); });
  expect(api.volume).toBe(0.6);

  // The old read resolves late: the family's nudge must win.
  await act(async () => {
    resolveVolume(0.1);
    await Promise.resolve();
  });
  expect(api.volume).toBe(0.6);
  expect(mockSetVolume).toHaveBeenLastCalledWith(0.6);
});

test("a device switch discards the old receiver's late volume read", async () => {
  const speaker = { ...device, deviceId: "speaker", friendlyName: "Kitchen" };
  const speakerSession = sessionFor(speaker);
  let currentSession: any = sessionFor(device);
  mockDevices = [device, speaker];
  mockStartSession.mockResolvedValue(true);
  mockGetCurrentCastSession.mockImplementation(async () => currentSession);
  let resolveOldVolume!: (value: number) => void;
  mockGetVolume.mockImplementationOnce(
    () => new Promise<number>((resolve) => { resolveOldVolume = resolve; })
  );
  let api!: ReturnType<typeof useCast>;
  render(
    <CastProvider>
      <Actions onReady={(v) => { api = v; }} />
    </CastProvider>
  );
  await act(async () => {});
  await act(async () => { await api.connect("tv"); });
  expect(api.target?.id).toBe("tv");

  currentSession = speakerSession;
  mockGetVolume.mockResolvedValue(0.2);
  await act(async () => { await api.connect("speaker"); });
  expect(api.target?.id).toBe("speaker");
  expect(api.volume).toBe(0.2);

  // The TV's read lands after the switch: the kitchen level must stand.
  await act(async () => {
    resolveOldVolume(0.9);
    await Promise.resolve();
  });
  expect(api.volume).toBe(0.2);
  expect(api.target?.id).toBe("speaker");
});

test("a rejected hydration preserves the previous level and mute state", async () => {
  mockStartSession.mockResolvedValue(true);
  mockGetCurrentCastSession.mockResolvedValue(sessionFor());
  mockGetVolume.mockResolvedValue(0.66);
  mockIsMute.mockResolvedValue(true);
  let api!: ReturnType<typeof useCast>;
  render(
    <CastProvider>
      <Actions onReady={(v) => { api = v; }} />
    </CastProvider>
  );
  await act(async () => {});
  await act(async () => { await api.connect("tv"); });
  expect(api.volume).toBe(0.66);
  expect(api.muted).toBe(true);

  mockGetVolume.mockRejectedValue(new Error("no volume"));
  mockIsMute.mockRejectedValue(new Error("no mute"));
  await act(async () => { await api.connect("tv"); });
  expect(api.volume).toBe(0.66);
  expect(api.muted).toBe(true);
});

test("one failed hydration read does not discard the other", async () => {
  mockStartSession.mockResolvedValue(true);
  mockGetCurrentCastSession.mockResolvedValue(sessionFor());
  mockGetVolume.mockResolvedValue(0.6);
  mockIsMute.mockResolvedValue(true);
  let api!: ReturnType<typeof useCast>;
  render(
    <CastProvider>
      <Actions onReady={(v) => { api = v; }} />
    </CastProvider>
  );
  await act(async () => {});
  await act(async () => { await api.connect("tv"); });
  expect(api.volume).toBe(0.6);
  expect(api.muted).toBe(true);

  // isMute fails: the good level still lands.
  mockGetVolume.mockResolvedValue(0.3);
  mockIsMute.mockRejectedValueOnce(new Error("no mute"));
  await act(async () => { await api.connect("tv"); });
  expect(api.volume).toBe(0.3);
  expect(api.muted).toBe(true);

  // getVolume fails: the good mute still lands.
  mockGetVolume.mockRejectedValueOnce(new Error("no volume"));
  mockIsMute.mockResolvedValue(false);
  await act(async () => { await api.connect("tv"); });
  expect(api.volume).toBe(0.3);
  expect(api.muted).toBe(false);
});

test("adjustVolume clamps at zero and up, and sends the rounded level", async () => {
  mockStartSession.mockResolvedValue(true);
  mockGetCurrentCastSession.mockResolvedValue(sessionFor());
  mockGetVolume.mockResolvedValue(0.05);
  let api!: ReturnType<typeof useCast>;
  render(
    <CastProvider>
      <Actions onReady={(v) => { api = v; }} />
    </CastProvider>
  );
  await act(async () => {});
  await act(async () => { await api.connect("tv"); });

  await act(async () => { await api.adjustVolume(-0.1); });
  expect(mockSetVolume).toHaveBeenLastCalledWith(0);
  expect(api.volume).toBe(0);

  await act(async () => { await api.adjustVolume(0.1); });
  expect(mockSetVolume).toHaveBeenLastCalledWith(0.1);
  expect(api.volume).toBe(0.1);

  mockGetVolume.mockResolvedValue(0.95);
  await act(async () => { await api.connect("tv"); });
  await act(async () => { await api.adjustVolume(0.1); });
  expect(mockSetVolume).toHaveBeenLastCalledWith(1);
  expect(api.volume).toBe(1);
});

test("adjustVolume sends a rounded level, not a float artefact", async () => {
  mockStartSession.mockResolvedValue(true);
  mockGetCurrentCastSession.mockResolvedValue(sessionFor());
  mockGetVolume.mockResolvedValue(0.5);
  let api!: ReturnType<typeof useCast>;
  render(
    <CastProvider>
      <Actions onReady={(v) => { api = v; }} />
    </CastProvider>
  );
  await act(async () => {});
  await act(async () => { await api.connect("tv"); });
  await act(async () => { await api.adjustVolume(0.1); });
  expect(mockSetVolume).toHaveBeenLastCalledWith(0.6);
  expect(api.volume).toBe(0.6);
});

test("setVolume clamps to [0,1] and rounds to two decimals", async () => {
  mockStartSession.mockResolvedValue(true);
  mockGetCurrentCastSession.mockResolvedValue(sessionFor());
  let api!: ReturnType<typeof useCast>;
  render(
    <CastProvider>
      <Actions onReady={(v) => { api = v; }} />
    </CastProvider>
  );
  await act(async () => {});
  await act(async () => { await api.connect("tv"); });

  await act(async () => { await api.setVolume(-0.5); });
  expect(mockSetVolume).toHaveBeenLastCalledWith(0);
  expect(api.volume).toBe(0);

  await act(async () => { await api.setVolume(0.556); });
  expect(mockSetVolume).toHaveBeenLastCalledWith(0.56);
  expect(api.volume).toBe(0.56);

  await act(async () => { await api.setVolume(2); });
  expect(mockSetVolume).toHaveBeenLastCalledWith(1);
  expect(api.volume).toBe(1);
});

test("a stale volume read never overwrites a newer setVolume", async () => {
  mockStartSession.mockResolvedValue(true);
  mockGetCurrentCastSession.mockResolvedValue(sessionFor());
  let resolveVolume!: (value: number) => void;
  mockGetVolume.mockImplementationOnce(
    () => new Promise<number>((resolve) => { resolveVolume = resolve; })
  );
  let api!: ReturnType<typeof useCast>;
  render(
    <CastProvider>
      <Actions onReady={(v) => { api = v; }} />
    </CastProvider>
  );
  await act(async () => {});
  await act(async () => { await api.connect("tv"); });
  expect(api.busy).toBe(false);

  await act(async () => { await api.setVolume(0.8); });
  expect(api.volume).toBe(0.8);

  // The old read resolves late: the family's absolute set must win.
  await act(async () => {
    resolveVolume(0.1);
    await Promise.resolve();
  });
  expect(api.volume).toBe(0.8);
  expect(mockSetVolume).toHaveBeenLastCalledWith(0.8);
});

test("adjusting up while muted also unmutes the receiver", async () => {
  mockStartSession.mockResolvedValue(true);
  mockGetCurrentCastSession.mockResolvedValue(sessionFor());
  mockIsMute.mockResolvedValue(true);
  let api!: ReturnType<typeof useCast>;
  render(
    <CastProvider>
      <Actions onReady={(v) => { api = v; }} />
    </CastProvider>
  );
  await act(async () => {});
  await act(async () => { await api.connect("tv"); });
  expect(api.muted).toBe(true);

  await act(async () => { await api.adjustVolume(0.1); });
  expect(mockSetMute).toHaveBeenCalledWith(false);
  expect(api.muted).toBe(false);
});

test("raising the level with setVolume lifts a mute", async () => {
  mockStartSession.mockResolvedValue(true);
  mockGetCurrentCastSession.mockResolvedValue(sessionFor());
  mockGetVolume.mockResolvedValue(0.4);
  mockIsMute.mockResolvedValue(true);
  let api!: ReturnType<typeof useCast>;
  render(
    <CastProvider>
      <Actions onReady={(v) => { api = v; }} />
    </CastProvider>
  );
  await act(async () => {});
  await act(async () => { await api.connect("tv"); });
  expect(api.muted).toBe(true);

  await act(async () => { await api.setVolume(0.6); });
  expect(mockSetVolume).toHaveBeenLastCalledWith(0.6);
  expect(mockSetMute).toHaveBeenCalledWith(false);
  expect(api.muted).toBe(false);
});

test("lowering the level with setVolume keeps the receiver muted", async () => {
  mockStartSession.mockResolvedValue(true);
  mockGetCurrentCastSession.mockResolvedValue(sessionFor());
  mockGetVolume.mockResolvedValue(0.6);
  mockIsMute.mockResolvedValue(true);
  let api!: ReturnType<typeof useCast>;
  render(
    <CastProvider>
      <Actions onReady={(v) => { api = v; }} />
    </CastProvider>
  );
  await act(async () => {});
  await act(async () => { await api.connect("tv"); });
  expect(api.muted).toBe(true);

  await act(async () => { await api.setVolume(0.2); });
  expect(mockSetVolume).toHaveBeenLastCalledWith(0.2);
  expect(mockSetMute).not.toHaveBeenCalled();
  expect(api.muted).toBe(true);
});

test("toggleMute flips the receiver and the state", async () => {
  mockStartSession.mockResolvedValue(true);
  mockGetCurrentCastSession.mockResolvedValue(sessionFor());
  let api!: ReturnType<typeof useCast>;
  render(
    <CastProvider>
      <Actions onReady={(v) => { api = v; }} />
    </CastProvider>
  );
  await act(async () => {});
  await act(async () => { await api.connect("tv"); });
  expect(api.muted).toBe(false);

  await act(async () => { await api.toggleMute(); });
  expect(mockSetMute).toHaveBeenLastCalledWith(true);
  expect(api.muted).toBe(true);

  await act(async () => { await api.toggleMute(); });
  expect(mockSetMute).toHaveBeenLastCalledWith(false);
  expect(api.muted).toBe(false);
});

test("volume controls are a no-op without a session", async () => {
  let api!: ReturnType<typeof useCast>;
  render(
    <CastProvider>
      <Actions onReady={(v) => { api = v; }} />
    </CastProvider>
  );
  await act(async () => {});
  await act(async () => {
    await api.setVolume(0.8);
    await api.adjustVolume(0.1);
    await api.toggleMute();
  });
  expect(mockSetVolume).not.toHaveBeenCalled();
  expect(mockSetMute).not.toHaveBeenCalled();
  expect(api.volume).toBe(0.5);
  expect(api.muted).toBe(false);
});
