/* eslint-disable import/first -- jest.mock factories run before the imports */
import React from "react";
import { act, render } from "@testing-library/react-native";

const mockStartSession = jest.fn();
const mockEndCurrentSession = jest.fn();
const mockGetCurrentCastSession = jest.fn();
const mockLoadMedia = jest.fn();
const mockClientPlay = jest.fn();
const mockClientPause = jest.fn();
const mockClientSeek = jest.fn();
const mockResolveAudio = jest.fn();
const mockToggle = jest.fn();

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
let mockPlayback: any = {
  current: null,
  queue: [],
  policy: { isParent: false, filterOn: false, denied: [] },
  playing: true,
  toggle: mockToggle,
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
  useStreamPosition: () => 0,
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
  mockPlayback = {
    current: null,
    queue: [],
    policy: { isParent: false, filterOn: false, denied: [] },
    playing: true,
    toggle: mockToggle,
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

test("a failed session start surfaces honest copy and never loads", async () => {
  mockStartSession.mockRejectedValue(new Error("nope"));
  let api!: ReturnType<typeof useCast>;
  render(
    <CastProvider>
      <Actions onReady={(v) => { api = v; }} />
    </CastProvider>
  );
  await act(async () => {});
  await act(async () => { await api.connect("tv"); });
  expect(mockLoadMedia).not.toHaveBeenCalled();
  expect(api.error).toBe("Couldn't cast to Living Room.");
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
