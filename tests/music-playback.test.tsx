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

/** The player's status — `didJustFinish` is what rolls playback forward. */
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
/**
 * When set, the NEXT stream resolve waits for it — so the start stays IN
 * FLIGHT (the stream is still being resolved) while the queue has already
 * moved on. One shot: the gate is consumed by the first resolve that meets it.
 */
let mockResolveGate: Promise<void> | null = null;

jest.mock("../modules/youtube-engine", () => ({
  resolveAudio: async (id: string) => {
    const gate = mockResolveGate;
    mockResolveGate = null;
    if (gate) await gate;
    return mockResolve(id);
  },
  search: jest.fn(async () => []),
  related: jest.fn(async () => []),
}));

/**
 * The signed-in viewer. `null` = signed out, which fails closed exactly like
 * a kid role. The provider reads it through `useAuth()`.
 */
let mockMember: any = null;
jest.mock("../src/state/AuthProvider", () => ({
  useAuth: () => ({
    member: mockMember, hydrated: true, mode: "family",
    signOut: jest.fn(async () => {}), poke: jest.fn(),
  }),
}));

import React from "react";
import { act, render, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { PlaybackProvider, usePlayback } from "../src/music/playback";
import type { MediaTrack } from "../src/music/types";

const clean: MediaTrack = {
  id: "clean11111", title: "Clean Song", artist: "Artist", album: "Album",
  durationSeconds: 120, artworkUrl: "https://img/clean.jpg", explicit: false, source: "youtube_music",
};
const explicit: MediaTrack = {
  id: "exp11111111", title: "Bad Song", artist: "Artist", album: "Album",
  durationSeconds: 120, artworkUrl: "https://img/bad.jpg", explicit: true, source: "youtube_music",
};
/**
 * A track the badge did NOT catch: it says "not marked explicit", so only the
 * family's own deny-list can keep it away from a kid.
 */
const denied: MediaTrack = {
  id: "den11111111", title: "Till I Collapse", artist: "Eminem", album: "Album",
  durationSeconds: 120, artworkUrl: null, explicit: false, source: "youtube_music",
};
/** A third row, so the auto-advance has somewhere it must NOT roll into. */
const third: MediaTrack = {
  id: "thr11111111", title: "Third Song", artist: "Artist", album: "Album",
  durationSeconds: 120, artworkUrl: null, explicit: false, source: "youtube_music",
};

const KID = { id: "c1", name: "Kid", role: "child", emoji: "🐯", color: "green" };
const PARENT = { id: "p1", name: "Rebecca (Mom)", role: "parent", emoji: "🐱", color: "green" };

function Probe() {
  const { current, queue, play, playQueueAt, addToQueue, downloadCurrent, policy, denylist, addDenied, removeDenied } = usePlayback();
  return (
    <>
      <Text testID="title">{current?.title ?? "none"}</Text>
      <Text testID="queue">{queue.map((t) => t.id).join(",") || "empty"}</Text>
      <Text testID="play-pair" onPress={() => void play(clean, [clean, explicit])}>play pair</Text>
      <Text testID="play-triple" onPress={() => void play(clean, [clean, explicit, third])}>play triple</Text>
      <Text testID="play-bad" onPress={() => void play(explicit)}>play bad</Text>
      <Text testID="add-bad" onPress={() => addToQueue(explicit)}>add bad</Text>
      <Text testID="play-queue-at-bad" onPress={() => void playQueueAt([clean, explicit], 1)}>play queue at bad</Text>
      <Text testID="download" onPress={() => void downloadCurrent()}>download</Text>
      <Text testID="play-denied" onPress={() => void play(denied)}>play denied</Text>
      <Text testID="play-denied-pair" onPress={() => void play(clean, [clean, denied])}>play denied pair</Text>
      {/* The policy's normalized deny-list terms — the rule every surface reads. */}
      <Text testID="policy-denied">{(policy?.denied ?? []).join("|")}</Text>
      <Text testID="denylist">{(denylist ?? []).map((e: { term: string }) => e.term).join("|")}</Text>
      <Text testID="add-denied" onPress={() => void addDenied?.("Eminem")}>add denied</Text>
      <Text testID="add-denied-lower" onPress={() => void addDenied?.("eminem")}>add denied lower</Text>
      <Text testID="add-artist" onPress={() => void addDenied?.("artist")}>add artist</Text>
      <Text testID="add-empty" onPress={() => void addDenied?.("   ")}>add empty</Text>
      <Text testID="remove-denied" onPress={() => void removeDenied?.("EMINEM")}>remove denied</Text>
    </>
  );
}

/** A FRESH element every call — React bails out of a re-render on an
 *  identical element reference, and the role switch needs a real re-render. */
const tree = () => (
  <PlaybackProvider>
    <Probe />
  </PlaybackProvider>
);

/** Let the provider's mount effect finish loading the stores. */
const settle = async () => {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
};

beforeEach(async () => {
  await AsyncStorage.clear();
  mockMember = null;
  mockStatus = { isLoaded: true, playing: false, currentTime: 4, duration: 120, didJustFinish: false };
  mockResolveGate = null;
  jest.clearAllMocks();
});

it("resolves the stream on-device and plays the native URL", async () => {
  const { getByTestId } = render(tree());
  await act(async () => { getByTestId("play-pair").props.onPress(); });
  await waitFor(() => expect(getByTestId("title").props.children).toBe("Clean Song"));
  expect(mockResolve).toHaveBeenCalledWith("clean11111");
  expect(mockReplace).toHaveBeenCalledWith({ uri: "https://rr1---sn-test.googlevideo.com/videoplayback?x=1" });
  expect(mockPlay).toHaveBeenCalled();
  expect(mockLock).toHaveBeenCalledWith(true, expect.objectContaining({ title: "Clean Song" }));
});

it("a parent may queue and play an explicit track", async () => {
  mockMember = PARENT;
  const { getByTestId } = render(tree());
  await act(async () => { getByTestId("play-pair").props.onPress(); });
  await waitFor(() => expect(getByTestId("title").props.children).toBe("Clean Song"));
  expect(getByTestId("queue").props.children).toBe("clean11111,exp11111111");
});

it("a kid never gets an explicit track into the queue", async () => {
  mockMember = KID;
  const { getByTestId } = render(tree());
  await act(async () => { getByTestId("play-pair").props.onPress(); });
  await waitFor(() => expect(getByTestId("title").props.children).toBe("Clean Song"));
  expect(getByTestId("queue").props.children).toBe("clean11111");
});

it("a kid cannot play an explicit track at all", async () => {
  mockMember = KID;
  const { getByTestId } = render(tree());
  await act(async () => { getByTestId("play-bad").props.onPress(); });
  expect(mockResolve).not.toHaveBeenCalledWith("exp11111111");
  expect(getByTestId("title").props.children).toBe("none");
  expect(getByTestId("queue").props.children).toBe("empty");
});

it("a kid cannot queue an explicit track", async () => {
  mockMember = KID;
  const { getByTestId } = render(tree());
  await act(async () => { getByTestId("play-pair").props.onPress(); });
  await waitFor(() => expect(getByTestId("queue").props.children).toBe("clean11111"));
  await act(async () => { getByTestId("add-bad").props.onPress(); });
  expect(getByTestId("queue").props.children).toBe("clean11111");
});

it("a kid cannot jump to an explicit row of the queue", async () => {
  mockMember = KID;
  const { getByTestId } = render(tree());
  await act(async () => { getByTestId("play-queue-at-bad").props.onPress(); });
  expect(mockResolve).not.toHaveBeenCalledWith("exp11111111");
  expect(getByTestId("title").props.children).toBe("none");
  expect(getByTestId("queue").props.children).toBe("empty");
});

it("a parent may jump to an explicit row of the queue", async () => {
  mockMember = PARENT;
  const { getByTestId } = render(tree());
  await act(async () => { getByTestId("play-queue-at-bad").props.onPress(); });
  await waitFor(() => expect(getByTestId("title").props.children).toBe("Bad Song"));
  expect(getByTestId("queue").props.children).toBe("clean11111,exp11111111");
});

it("a parent→kid switch drops the hidden track from the queue", async () => {
  mockMember = PARENT;
  const { getByTestId, rerender } = render(tree());
  await act(async () => { getByTestId("play-pair").props.onPress(); });
  await waitFor(() => expect(getByTestId("queue").props.children).toBe("clean11111,exp11111111"));
  mockMember = KID;
  await act(async () => { rerender(tree()); });
  expect(getByTestId("queue").props.children).toBe("clean11111");
});

it("a parent→kid switch STOPS the explicit track that was playing", async () => {
  mockMember = PARENT;
  const { getByTestId, rerender } = render(tree());
  await act(async () => { getByTestId("play-bad").props.onPress(); });
  await waitFor(() => expect(getByTestId("title").props.children).toBe("Bad Song"));
  mockMember = KID;
  await act(async () => { rerender(tree()); });
  expect(getByTestId("title").props.children).toBe("none");
  expect(mockPause).toHaveBeenCalled();
  // The lock screen must not keep the title either.
  expect(mockLock).toHaveBeenCalledWith(false);
});

it("auto-advance never rolls into a track the new viewer may not see", async () => {
  mockMember = PARENT;
  const { getByTestId, rerender } = render(tree());
  await act(async () => { getByTestId("play-pair").props.onPress(); });
  await waitFor(() => expect(getByTestId("title").props.children).toBe("Clean Song"));
  // The track finishes at the very moment the kid signs in: the queue the
  // effect still holds carries the explicit track, and it must NOT be played.
  mockStatus = { ...mockStatus, didJustFinish: true };
  mockMember = KID;
  await act(async () => { rerender(tree()); });
  expect(mockResolve).not.toHaveBeenCalledWith("exp11111111");
  expect(mockPause).toHaveBeenCalled();
});

it("a parent's auto-advance still rolls into an explicit track", async () => {
  mockMember = PARENT;
  const { getByTestId, rerender } = render(tree());
  await act(async () => { getByTestId("play-pair").props.onPress(); });
  await waitFor(() => expect(getByTestId("title").props.children).toBe("Clean Song"));
  mockStatus = { ...mockStatus, didJustFinish: true };
  await act(async () => { rerender(tree()); });
  await waitFor(() => expect(getByTestId("title").props.children).toBe("Bad Song"));
  expect(mockResolve).toHaveBeenCalledWith("exp11111111");
});

it("the auto-advance does not roll forward while a start is in flight", async () => {
  mockMember = PARENT;
  const { getByTestId, rerender } = render(tree());
  await act(async () => { getByTestId("play-triple").props.onPress(); });
  await waitFor(() => expect(getByTestId("title").props.children).toBe("Clean Song"));
  // The NEXT stream takes a moment: the start is IN FLIGHT while the queue
  // has already moved on, and the finish flag that is still on screen belongs
  // to the PREVIOUS track.
  let release: () => void = () => {};
  mockResolveGate = new Promise<void>((resolve) => { release = resolve; });
  mockStatus = { ...mockStatus, didJustFinish: true };
  await act(async () => { rerender(tree()); });
  await waitFor(() => expect(getByTestId("title").props.children).toBe("Bad Song"));
  // The queue moved on, but the transport must NOT roll a second time while
  // the start is still in flight: the finish flag belongs to the track that
  // just ended, not to the one that is starting.
  await act(async () => { rerender(tree()); });
  expect(mockResolve).not.toHaveBeenCalledWith("thr11111111");
  expect(getByTestId("title").props.children).toBe("Bad Song");
  await act(async () => { release(); });
});

it("a download carries the track's rating into the tray", async () => {
  mockMember = PARENT;
  const { getByTestId } = render(tree());
  await act(async () => { getByTestId("play-bad").props.onPress(); });
  await waitFor(() => expect(getByTestId("title").props.children).toBe("Bad Song"));
  await act(async () => { getByTestId("download").props.onPress(); });
  await waitFor(async () => {
    const raw = await AsyncStorage.getItem("music.downloads");
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw as string)[0].explicit).toBe(true);
  });
});

/* ------------------------------------------------------------------ *
 * THE DENY-LIST — the family's own signal, carried by the SAME policy
 * every surface already reads.
 * ------------------------------------------------------------------ */

/** The stored list the provider loads on mount. */
const seedDenylist = async (terms: string[]) => {
  await AsyncStorage.setItem("music.denylist", JSON.stringify(terms.map((term, i) => ({ term, addedAt: i + 1 }))));
};

it("a denied track never enters the queue for a kid", async () => {
  mockMember = KID;
  await seedDenylist(["eminem"]);
  const { getByTestId } = render(tree());
  // The provider loads the list on mount; the rule is live from then on.
  await waitFor(() => expect(getByTestId("policy-denied").props.children).toBe("eminem"));
  await act(async () => { getByTestId("play-denied-pair").props.onPress(); });
  expect(getByTestId("queue").props.children).toBe("clean11111");
  expect(mockResolve).not.toHaveBeenCalledWith("den11111111");
});

it("a kid cannot play a denied track at all", async () => {
  mockMember = KID;
  await seedDenylist(["eminem"]);
  const { getByTestId } = render(tree());
  await waitFor(() => expect(getByTestId("policy-denied").props.children).toBe("eminem"));
  await act(async () => { getByTestId("play-denied").props.onPress(); });
  expect(mockResolve).not.toHaveBeenCalledWith("den11111111");
  expect(getByTestId("title").props.children).toBe("none");
  expect(getByTestId("queue").props.children).toBe("empty");
});

it("a parent still plays a denied track", async () => {
  mockMember = PARENT;
  await seedDenylist(["eminem"]);
  const { getByTestId } = render(tree());
  await waitFor(() => expect(getByTestId("policy-denied").props.children).toBe("eminem"));
  await act(async () => { getByTestId("play-denied").props.onPress(); });
  await waitFor(() => expect(getByTestId("title").props.children).toBe("Till I Collapse"));
  expect(getByTestId("queue").props.children).toBe("den11111111");
});

it("the deny rule holds even with the explicit filter OFF", async () => {
  mockMember = KID;
  // The filter setting governs the BADGE only: the family's own list is
  // independent of it.
  await AsyncStorage.setItem("music.settings", JSON.stringify({ repeat: "off", shuffle: false, explicitFilter: false }));
  await seedDenylist(["eminem"]);
  const { getByTestId } = render(tree());
  await waitFor(() => expect(getByTestId("policy-denied").props.children).toBe("eminem"));
  await act(async () => { getByTestId("play-denied").props.onPress(); });
  expect(mockResolve).not.toHaveBeenCalledWith("den11111111");
  expect(getByTestId("title").props.children).toBe("none");
});

it("adds a term to the deny-list, persists it, and the policy updates immediately", async () => {
  mockMember = KID;
  const { getByTestId } = render(tree());
  await settle();
  expect(getByTestId("denylist").props.children).toBe("");
  await act(async () => { getByTestId("add-denied").props.onPress(); });
  await waitFor(() => expect(getByTestId("denylist").props.children).toBe("Eminem"));
  // The policy carries the NORMALIZED term, so the rule is live at once.
  expect(getByTestId("policy-denied").props.children).toBe("eminem");
  const raw = await AsyncStorage.getItem("music.denylist");
  expect(JSON.parse(raw as string)).toEqual([{ term: "Eminem", addedAt: expect.any(Number) }]);
});

it("ignores an empty term and a duplicate (case-insensitively)", async () => {
  mockMember = KID;
  const { getByTestId } = render(tree());
  await settle();
  expect(getByTestId("denylist").props.children).toBe("");
  await act(async () => { getByTestId("add-empty").props.onPress(); });
  expect(getByTestId("denylist").props.children).toBe("");
  await act(async () => { getByTestId("add-denied").props.onPress(); });
  await waitFor(() => expect(getByTestId("denylist").props.children).toBe("Eminem"));
  await act(async () => { getByTestId("add-denied-lower").props.onPress(); });
  expect(getByTestId("denylist").props.children).toBe("Eminem");
  const raw = await AsyncStorage.getItem("music.denylist");
  expect(JSON.parse(raw as string)).toHaveLength(1);
});

it("removing a term unblocks it again", async () => {
  mockMember = KID;
  await seedDenylist(["eminem"]);
  const { getByTestId } = render(tree());
  await waitFor(() => expect(getByTestId("policy-denied").props.children).toBe("eminem"));
  await act(async () => { getByTestId("remove-denied").props.onPress(); });
  await waitFor(() => expect(getByTestId("policy-denied").props.children).toBe(""));
  expect(getByTestId("denylist").props.children).toBe("");
  const raw = await AsyncStorage.getItem("music.denylist");
  expect(JSON.parse(raw as string)).toEqual([]);
  // The track is playable again — the rule is off, not the track.
  await act(async () => { getByTestId("play-denied").props.onPress(); });
  await waitFor(() => expect(getByTestId("title").props.children).toBe("Till I Collapse"));
});

it("a term added later drops the now-denied track from a kid's queue and stops it", async () => {
  mockMember = KID;
  const { getByTestId } = render(tree());
  await settle();
  await act(async () => { getByTestId("play-pair").props.onPress(); });
  await waitFor(() => expect(getByTestId("title").props.children).toBe("Clean Song"));
  // The track's artist is "Artist" — the term matches it.
  await act(async () => { getByTestId("add-artist").props.onPress(); });
  await waitFor(() => expect(getByTestId("title").props.children).toBe("none"));
  expect(getByTestId("queue").props.children).toBe("empty");
  expect(mockPause).toHaveBeenCalled();
  // The lock screen must not keep the title either.
  expect(mockLock).toHaveBeenCalledWith(false);
});

/* ------------------------------------------------------------------ *
 * THE RACE — the parent types a term before the store has answered.
 * ------------------------------------------------------------------ */

it("a term added BEFORE the store answered is never lost", async () => {
  mockMember = KID;
  await seedDenylist(["eminem"]);
  const { getByTestId } = render(tree());
  // The store has NOT answered yet — the parent types a term right away.
  await act(async () => { getByTestId("add-artist").props.onPress(); });
  // The store answers: the family's stored term AND the early add must both
  // be in the list — the load must never swallow the early add.
  await waitFor(() => expect(getByTestId("denylist").props.children).toBe("eminem|artist"));
  await waitFor(async () => {
    const raw = await AsyncStorage.getItem("music.denylist");
    expect(JSON.parse(raw as string).map((e: { term: string }) => e.term)).toEqual(["eminem", "artist"]);
  });
});

it("an early add wins over the stored copy of the SAME term", async () => {
  mockMember = KID;
  await seedDenylist(["eminem"]);
  const { getByTestId } = render(tree());
  // The parent types the term the family already blocked, before the store
  // answered: their own spelling is the one that stays.
  await act(async () => { getByTestId("add-denied").props.onPress(); });
  await waitFor(() => expect(getByTestId("denylist").props.children).toBe("Eminem"));
  // One rule, not two: the same term twice is still one rule.
  await waitFor(async () => {
    const raw = await AsyncStorage.getItem("music.denylist");
    expect(JSON.parse(raw as string)).toHaveLength(1);
  });
});

