/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
jest.mock("@react-native-async-storage/async-storage", () => {
  const store = require("@react-native-async-storage/async-storage/jest/async-storage-mock");
  // Writes are dropped on purpose: the dark-theme stage test below switches
  // the theme in memory, and a PERSISTED theme would leak into the next
  // test's provider (its hydration re-render would land mid-assertion).
  return { ...store, setItem: jest.fn(async () => {}) };
});
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));
const mockPlay = jest.fn(async () => {});
const mockToggle = jest.fn();
const mockNext = jest.fn(async () => {});
const mockPrevious = jest.fn(async () => {});
const mockSeek = jest.fn(async () => {});
const mockRemoveDownload = jest.fn();
/** The queue's own affordances (the provider's remove/reorder). */
const mockRemoveFromQueue = jest.fn();
const mockMoveQueueItem = jest.fn();
const mockCycleRepeat = jest.fn();
const mockToggleShuffle = jest.fn();
/**
 * Notifies the mocked provider when the family's own list changes, so the
 * editor re-renders the way the REAL provider does (it holds the list in
 * state and hands it down).
 */
const mockDeniedSubscribers = new Set<() => void>();
const mockAddDenied = jest.fn(async (term: string) => {
  const t = term.trim();
  if (!t) return;
  if (!mockDenied.some((d) => d.toLowerCase() === t.toLowerCase())) {
    mockDenied = [...mockDenied, t];
    mockDeniedSubscribers.forEach((notify) => notify());
  }
});
const mockRemoveDenied = jest.fn(async (term: string) => {
  const t = term.trim().toLowerCase();
  const next = mockDenied.filter((d) => d.toLowerCase() !== t);
  if (next.length === mockDenied.length) return;
  mockDenied = next;
  mockDeniedSubscribers.forEach((notify) => notify());
});
const DEFAULT_CURRENT = {
  id: "abc12345678", title: "Song", artist: "Artist", album: "Album",
  durationSeconds: 200, artworkUrl: null, explicit: false, source: "youtube_music",
};
let mockCurrent: any = DEFAULT_CURRENT;
let mockQueue: any[] = [];
let mockDownloads: any[] = [];
let mockHistory: any[] = [];
/** The playhead — the position the lyrics follow. */
let mockPosition = 10;
let mockRepeat: "off" | "all" | "one" = "off";
let mockShuffle = false;
/** The family setting: the explicit filter is ON by default. */
let mockExplicitFilter: boolean | undefined = true;
/** The signed-in viewer. null = signed-out guest, which also fails closed. */
let mockMember: any = null;
/** The family's own deny-list, as the provider hands it to the surfaces. */
let mockDenied: string[] = [];

jest.mock("../src/music/playback", () => {
  // The mocked provider holds the family's own list and hands it down, like
  // the real one: a change re-renders every surface that reads it.
  const React = require("react");
  return {
    usePlayback: () => {
      const [, force] = React.useReducer((n: number) => n + 1, 0);
      React.useEffect(() => {
        const notify = () => force();
        mockDeniedSubscribers.add(notify);
        return () => { mockDeniedSubscribers.delete(notify); };
      }, []);
      return {
        current: mockCurrent,
        queue: mockQueue, index: 0, playing: false, position: mockPosition, duration: 200, buffering: false,
        repeat: mockRepeat, shuffle: mockShuffle, error: null,
        downloads: mockDownloads, downloadBytes: mockDownloads.reduce((sum, item) => sum + item.bytes, 0),
        history: mockHistory,
        settings: { repeat: mockRepeat, shuffle: mockShuffle, explicitFilter: mockExplicitFilter },
        // The provider owns the role-aware policy — the surfaces read it from
        // there so the rule can never drift between them. The POLICY carries
        // the list NORMALIZED (that is what the rule matches on)...
        policy: {
          isParent: mockMember?.role === "parent",
          filterOn: mockExplicitFilter !== false,
          denied: mockDenied.map((term) => term.trim().toLowerCase().replace(/\s+/g, " ")),
        },
        // ...while the LIST itself keeps the terms as the parent typed them.
        denylist: mockDenied.map((term, index) => ({ term, addedAt: index })),
        play: mockPlay, playQueueAt: jest.fn(), toggle: mockToggle, next: mockNext, previous: mockPrevious,
        seek: mockSeek, setRepeat: jest.fn(), cycleRepeatMode: mockCycleRepeat, toggleShuffleMode: mockToggleShuffle,
        addToQueue: jest.fn(), removeFromQueue: mockRemoveFromQueue, moveQueueItem: mockMoveQueueItem,
        downloadCurrent: jest.fn(), removeDownload: mockRemoveDownload, setExplicitFilter: jest.fn(),
        addDenied: mockAddDenied, removeDenied: mockRemoveDenied,
      };
    },
  };
});

function idleCast() {
  return {
    state: "notConnected",
    devices: [],
    target: null,
    casting: false,
    playing: false,
    position: 0,
    duration: null,
    busy: false,
    error: null,
    volume: 0.5,
    muted: false,
    connect: jest.fn(async () => true),
    startCast: jest.fn(async () => {}),
    disconnect: jest.fn(async () => {}),
    play: jest.fn(async () => {}),
    pause: jest.fn(async () => {}),
    seek: jest.fn(async () => {}),
    advance: jest.fn(async () => {}),
    previous: jest.fn(async () => {}),
    setVolume: jest.fn(async () => {}),
    adjustVolume: jest.fn(async () => {}),
    toggleMute: jest.fn(async () => {}),
  };
}
let mockCast: any = idleCast();
jest.mock("../src/music/CastProvider", () => ({ useCast: () => mockCast }));

const CLEAN_TRACK = {
  id: "clean11111", title: "Found", artist: "A", album: "", durationSeconds: 100,
  artworkUrl: null, explicit: false, source: "youtube_music",
};
const EXPLICIT_TRACK = {
  id: "exp11111111", title: "Bad Song", artist: "B", album: "", durationSeconds: 100,
  artworkUrl: null, explicit: true, source: "youtube_music",
};
/** A track the badge did not catch — only the family's own list hides it. */
const DENIED_TRACK = {
  id: "den11111111", title: "Till I Collapse", artist: "Eminem", album: "", durationSeconds: 100,
  artworkUrl: null, explicit: false, source: "youtube_music",
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

/**
 * What the on-device palette read off the cover.
 *
 * `null` means the extraction found no colour (or failed) — the stage must
 * then fall back to the banded accent, never to a made-up hue.
 */
let mockArtworkColors: { dominant: string | null; vibrant: string | null } = {
  dominant: null,
  vibrant: null,
};

jest.mock("../modules/youtube-engine", () => ({
  search: jest.fn(async () => mockSearchOutcome),
  related: jest.fn(async () => []),
  resolveAudio: jest.fn(async () => ({ url: "https://x.y/audio.m4a", mimeType: "audio/mp4",
    contentLength: 1, durationSeconds: 1, expiresAt: 0 })),
  artworkColors: jest.fn(async () => mockArtworkColors),
}));

/**
 * The lyrics the engine answered with — null means the track has none.
 *
 * The real fetcher talks to lrclib.net; the lyrics pane needs a deterministic
 * answer (and the panel must never wait on the network to paint).
 */
let mockLyrics: { timeMs: number; text: string }[] | null = null;

jest.mock("../src/music/lyrics", () => {
  const actual = jest.requireActual("../src/music/lyrics");
  return {
    ...actual,
    fetchLyrics: jest.fn(async () => mockLyrics),
  };
});

import React from "react";
import { Dimensions, ScrollView, StyleSheet } from "react-native";
import { act, fireEvent, render, renderHook, waitFor } from "@testing-library/react-native";
import { MusicPlayer } from "../src/music/MusicPlayer";
import { ThemeProvider, useTheme } from "../src/theme/ThemeProvider";
import { musicTokensFor } from "../src/theme/music-tokens";
import { bandStageTint } from "../src/music/tint";

const wrap = ({ children }: { children: React.ReactNode }) => <ThemeProvider>{children}</ThemeProvider>;

/**
 * Forces the provider into the DARK theme.
 *
 * The stage's ground is the tinted field and its band depends on the theme,
 * so the contrast contract has to be checked where the field is DARK — the
 * case the review measured (white on the dark band).
 */
function ThemeGate({ children }: { children: React.ReactNode }) {
  const { setTheme } = useTheme();
  React.useEffect(() => {
    setTheme("dark");
  }, [setTheme]);
  return <>{children}</>;
}

const darkWrap = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>
    <ThemeGate>{children}</ThemeGate>
  </ThemeProvider>
);

const KID = { id: "c1", name: "Kid", role: "child", emoji: "🐯", color: "green" };
const PARENT = { id: "p1", name: "Rebecca (Mom)", role: "parent", emoji: "🐱", color: "green" };

/**
 * The lyrics pane's ScrollView — the composite element and its instance.
 *
 * The ref is a prop (React 19), so the test can reach the instance and watch
 * exactly what the follow does to the view.
 */
function lyricsScroll(elements: any[]) {
  const element = elements.find((node) => node.props?.testID === "music-lyrics-scroll");
  if (!element) throw new Error("the lyrics scroll view is not rendered");
  return { element, instance: element.props.ref.current as ScrollView };
}

/**
 * Renders the player and lets the lyrics fetch settle INSIDE act().
 *
 * The fetch is a promise: without the flush its answer lands on the microtask
 * queue after the test body, and React reports an update outside act.
 */
async function renderPlayer() {
  const utils = render(<MusicPlayer />, { wrapper: wrap });
  await act(async () => {});
  return utils;
}

beforeEach(() => {
  mockCurrent = DEFAULT_CURRENT;
  mockQueue = [];
  mockDownloads = [];
  mockHistory = [];
  mockPosition = 10;
  mockRepeat = "off";
  mockShuffle = false;
  mockExplicitFilter = true;
  mockMember = null;
  mockDenied = [];
  mockSearchOutcome = { tracks: [CLEAN_TRACK], explicitKnown: true };
  mockArtworkColors = { dominant: null, vibrant: null };
  mockLyrics = null;
  mockCast = idleCast();
  jest.clearAllMocks();
});

it("renders now playing and drives the transport", async () => {
  const { getByTestId } = render(<MusicPlayer />, { wrapper: wrap });
  await waitFor(() => expect(getByTestId("np-title").props.children).toBe("Song"));
  fireEvent.press(getByTestId("np-play"));
  expect(mockToggle).toHaveBeenCalled();
  fireEvent.press(getByTestId("np-next"));
  expect(mockNext).toHaveBeenCalled();
  fireEvent.press(getByTestId("np-prev"));
  expect(mockPrevious).toHaveBeenCalled();
});

it("while casting, the stage drives the receiver and reads its clock", async () => {
  mockCast = {
    ...idleCast(),
    casting: true,
    target: { id: "tv", name: "Living Room" },
    playing: true,
    position: 30,
    duration: 120,
  };
  const { getByTestId, getByText } = render(<MusicPlayer />, { wrapper: wrap });
  await waitFor(() => expect(getByTestId("np-title").props.children).toBe("Song"));
  expect(getByText("0:30")).toBeTruthy();
  expect(getByText("2:00")).toBeTruthy();
  expect(getByTestId("np-play").props.accessibilityLabel).toBe("Pause");

  fireEvent.press(getByTestId("np-play"));
  expect(mockCast.pause).toHaveBeenCalledTimes(1);
  expect(mockToggle).not.toHaveBeenCalled();

  fireEvent.press(getByTestId("np-next"));
  expect(mockCast.advance).toHaveBeenCalledWith(false);
  expect(mockNext).not.toHaveBeenCalled();

  fireEvent.press(getByTestId("np-prev"));
  expect(mockCast.previous).toHaveBeenCalledTimes(1);
  expect(mockPrevious).not.toHaveBeenCalled();

  fireEvent(getByTestId("np-seek"), "layout", {
    nativeEvent: { layout: { width: 300, height: 64, x: 0, y: 0 } },
  });
  fireEvent(getByTestId("np-seek"), "press", { nativeEvent: { locationX: 150 } });
  expect(mockCast.seek).toHaveBeenCalledWith(60);
  expect(mockSeek).not.toHaveBeenCalled();
});

it("an unknown cast duration shows an honest total, never a fake 0:00", async () => {
  mockCast = {
    ...idleCast(),
    casting: true,
    target: { id: "tv", name: "Living Room" },
    playing: true,
    position: 30,
    duration: null,
  };
  const { getByTestId, getByText, queryByText } = render(<MusicPlayer />, { wrapper: wrap });
  await waitFor(() => expect(getByTestId("np-title").props.children).toBe("Song"));
  expect(getByText("0:30")).toBeTruthy();
  expect(getByText("--:--")).toBeTruthy();
  expect(queryByText("0:00")).toBeNull();
});

it("does not render the cast control when there is no current track", async () => {
  mockCurrent = null;
  const { getByTestId, queryByTestId } = render(<MusicPlayer />, { wrapper: wrap });
  await waitFor(() => expect(getByTestId("music-search-input")).toBeTruthy());
  expect(queryByTestId("cast-open")).toBeNull();
});

it("a hidden current track keeps a visible cast banner with Stop and the page-level error", async () => {
  mockMember = KID;
  mockExplicitFilter = true;
  mockCurrent = { ...EXPLICIT_TRACK };
  const disconnect = jest.fn(async () => { throw new Error("stop failed"); });
  mockCast = {
    ...idleCast(),
    casting: true,
    target: { id: "tv", name: "Living Room" },
    error: "Couldn't stop casting. Try again.",
    disconnect,
  };
  const { getByTestId, getAllByText } = render(<MusicPlayer />, { wrapper: wrap });
  await waitFor(() => expect(getByTestId("cast-alert")).toBeTruthy());
  expect(getByTestId("music-cast-error")).toBeTruthy();
  // The banner and the page-level line both carry the honest failure copy.
  expect(getAllByText("Couldn't stop casting. Try again.")).toHaveLength(2);

  await act(async () => { fireEvent.press(getByTestId("cast-stop")); });
  expect(disconnect).toHaveBeenCalledTimes(1);
});

it("when casting is paused, the play glyph offers Play", async () => {
  mockCast = {
    ...idleCast(),
    casting: true,
    target: { id: "tv", name: "Living Room" },
    playing: false,
    position: 30,
    duration: 120,
  };
  const { getByTestId } = render(<MusicPlayer />, { wrapper: wrap });
  await waitFor(() => expect(getByTestId("np-title").props.children).toBe("Song"));
  expect(getByTestId("np-play").props.accessibilityLabel).toBe("Play");
  fireEvent.press(getByTestId("np-play"));
  expect(mockCast.play).toHaveBeenCalledTimes(1);
  expect(mockCast.pause).not.toHaveBeenCalled();
});

/**
 * The Now Playing STAGE — the artwork-led, cover-tinted surface (SP2 Task 3).
 *
 * The stage is a full-width tinted field: it wears the COVER's own colour,
 * read on-device and banded so body text stays readable. Every colour comes
 * from the music tokens; the tint is the one colour the artwork supplies.
 */
describe("the Now Playing stage", () => {
  /** The theme the app resolved — the tint's band depends on it. */
  const resolved = () => renderHook(() => useTheme(), { wrapper: wrap }).result.current;

  it("offers the three modes — Now Playing, Lyrics and Queue", () => {
    const { getByTestId, getByText } = render(<MusicPlayer />, { wrapper: wrap });
    expect(getByTestId("music-mode")).toBeTruthy();
    expect(getByText("Now Playing")).toBeTruthy();
    expect(getByText("Lyrics")).toBeTruthy();
    expect(getByText("Queue")).toBeTruthy();
  });

  it("opens on the stage — the lyrics and the queue sit behind the switcher", () => {
    const { getByTestId, getByText, queryByTestId } = render(<MusicPlayer />, { wrapper: wrap });
    expect(getByTestId("np-stage")).toBeTruthy();
    fireEvent.press(getByText("Lyrics"));
    expect(queryByTestId("np-stage")).toBeNull();
    fireEvent.press(getByText("Now Playing"));
    expect(getByTestId("np-stage")).toBeTruthy();
  });

  it("tints itself from the artwork's own colour", async () => {
    mockCurrent = { ...DEFAULT_CURRENT, artworkUrl: "https://img.example/cover.jpg" };
    mockArtworkColors = { dominant: "#3B82F6", vibrant: null };
    const { getByTestId } = render(<MusicPlayer />, { wrapper: wrap });
    const { theme } = resolved();
    await waitFor(() => {
      const stage = getByTestId("np-stage");
      expect(StyleSheet.flatten(stage.props.style).backgroundColor).toBe(
        bandStageTint("#3B82F6", theme)
      );
    });
  });

  it("falls back to the banded accent when the cover carries no colour", async () => {
    mockCurrent = { ...DEFAULT_CURRENT, artworkUrl: "https://img.example/cover.jpg" };
    mockArtworkColors = { dominant: null, vibrant: null };
    const { artworkColors } = require("../modules/youtube-engine");
    const { getByTestId } = render(<MusicPlayer />, { wrapper: wrap });
    const { theme, boost } = resolved();
    const expected = bandStageTint(musicTokensFor(theme, boost).accent, theme);
    // the engine WAS asked — and its empty answer is what falls back.
    await waitFor(() =>
      expect(artworkColors).toHaveBeenCalledWith("https://img.example/cover.jpg")
    );
    const stage = getByTestId("np-stage");
    expect(StyleSheet.flatten(stage.props.style).backgroundColor).toBe(expected);
  });

  it("never asks the engine for a colour when the track has no artwork", async () => {
    const { artworkColors } = require("../modules/youtube-engine");
    const { getByTestId } = render(<MusicPlayer />, { wrapper: wrap });
    await waitFor(() => expect(getByTestId("np-stage")).toBeTruthy());
    expect(artworkColors).not.toHaveBeenCalled();
  });

  it("reads the cover's colour once per track", async () => {
    mockCurrent = { ...DEFAULT_CURRENT, artworkUrl: "https://img.example/cover.jpg" };
    mockArtworkColors = { dominant: "#3B82F6", vibrant: null };
    const { artworkColors } = require("../modules/youtube-engine");
    const { getByTestId, rerender } = render(<MusicPlayer />, { wrapper: wrap });
    await waitFor(() => expect(artworkColors).toHaveBeenCalledTimes(1));
    // a re-render must not read the cover again — the tint is cached
    rerender(<MusicPlayer />);
    await waitFor(() => expect(getByTestId("np-stage")).toBeTruthy());
    expect(artworkColors).toHaveBeenCalledTimes(1);
  });

  it("is a full-width tinted field on the Liquid radius", () => {
    const { getByTestId } = render(<MusicPlayer />, { wrapper: wrap });
    const { theme, boost } = resolved();
    const style = StyleSheet.flatten(getByTestId("np-stage").props.style);
    expect(style.borderRadius).toBe(musicTokensFor(theme, boost).panelRadius);
  });

  it("the artwork leads, at the Liquid edge", () => {
    const { getByTestId } = render(<MusicPlayer />, { wrapper: wrap });
    const { theme, boost } = resolved();
    const tokens = musicTokensFor(theme, boost);
    const windowWidth = Dimensions.get("window").width;
    const style = StyleSheet.flatten(getByTestId("np-artwork").props.style);
    expect(style.width).toBe(Math.min(windowWidth - 2 * tokens.pageMargin, 560));
    expect(style.height).toBe(style.width);
    expect(style.borderRadius).toBe(tokens.artworkRadius);
  });

  it("the transport is thumb-sized: an 88dp play disc, 72dp skips", () => {
    const { getByTestId } = render(<MusicPlayer />, { wrapper: wrap });
    const styleOf = (id: string) => StyleSheet.flatten(getByTestId(id).props.style);
    expect(styleOf("np-play").width).toBe(88);
    expect(styleOf("np-prev").width).toBe(72);
    expect(styleOf("np-next").width).toBe(72);
  });

  it("the scrubber keeps a 64dp hit area", () => {
    const { getByTestId } = render(<MusicPlayer />, { wrapper: wrap });
    const style = StyleSheet.flatten(getByTestId("np-seek").props.style);
    expect(style.height).toBeGreaterThanOrEqual(64);
  });

  it("the secondary row holds shuffle, repeat and download", () => {
    const { getByTestId } = render(<MusicPlayer />, { wrapper: wrap });
    for (const id of ["np-shuffle", "np-repeat", "np-download"]) {
      expect(getByTestId(id)).toBeTruthy();
    }
  });

  it("shows the receiver volume row only while casting", async () => {
    const idle = await renderPlayer();
    expect(idle.getByTestId("np-stage")).toBeTruthy();
    expect(idle.queryByTestId("stage-volume")).toBeNull();
    idle.unmount();

    mockCast = {
      ...idleCast(),
      casting: true,
      target: { id: "tv", name: "Living Room" },
      volume: 0.4,
    };
    const casting = await renderPlayer();
    expect(casting.getByTestId("stage-volume")).toBeTruthy();
    expect(casting.getByTestId("stage-volume-percent")).toBeTruthy();
    expect(casting.getByText("40%")).toBeTruthy();
  });

  it("the stage volume bar drives the receiver's amplifier", async () => {
    mockCast = {
      ...idleCast(),
      casting: true,
      target: { id: "tv", name: "Living Room" },
      volume: 0.4,
      muted: false,
    };
    const { getByTestId } = await renderPlayer();
    await waitFor(() => expect(getByTestId("stage-volume")).toBeTruthy());
    const bar = getByTestId("stage-volume-bar");
    fireEvent(bar, "layout", {
      nativeEvent: { layout: { width: 200, height: 64, x: 0, y: 0 } },
    });

    await act(async () => {
      fireEvent(bar, "responderGrant", { nativeEvent: { locationX: 100 } });
    });
    expect(mockCast.setVolume).toHaveBeenCalledWith(0.5);

    await act(async () => {
      fireEvent(bar, "accessibilityAction", { nativeEvent: { actionName: "decrement" } });
    });
    expect(mockCast.adjustVolume).toHaveBeenCalledWith(-0.02);

    await act(async () => {
      fireEvent(bar, "accessibilityAction", { nativeEvent: { actionName: "increment" } });
    });
    expect(mockCast.adjustVolume).toHaveBeenCalledWith(0.02);

    await act(async () => {
      fireEvent.press(getByTestId("stage-volume-mute"));
    });
    expect(mockCast.toggleMute).toHaveBeenCalledTimes(1);
  });

  it("the chips on the tinted field wear the DARK scrim, never a white fill", async () => {
    // A white fill LIFTS the ground under the chip's own label (the dark
    // band's brightest tint + white@12% measured 4.06:1 — under the 4.5
    // floor). The scrim DARKENS that ground instead, in both themes, so the
    // label clears AA on any tint in the band (tests/music-stage-contrast).
    const { theme, boost } = resolved();
    const tokens = musicTokensFor(theme, boost);
    const { getByTestId } = await renderPlayer();
    const styleOf = (id: string) => StyleSheet.flatten(getByTestId(id).props.style);
    expect(styleOf("np-shuffle").backgroundColor).toBe(tokens.scrim);
    expect(styleOf("np-repeat").backgroundColor).toBe(tokens.scrim);
    expect(styleOf("np-download").backgroundColor).toBe(tokens.scrim);
  });

  it("paints every stage text tier in the FULL label token — no dim tier on the tint", async () => {
    // The stage's ground is the tinted field, NOT the page ground the tiers
    // were checked against: on the tint the dim tiers read ~3.4:1 (label2) and
    // ~2.6:1 (label3). So the stage dims nothing — every tier on the tint
    // reads the full, opaque `label` token, and the hierarchy comes from the
    // type steps and weight (see tests/music-stage-contrast.test.ts).
    const { getByTestId, getByText } = render(<MusicPlayer />, { wrapper: darkWrap });
    const tokens = musicTokensFor("dark", false);
    const colorOf = (node: any) => StyleSheet.flatten(node.props.style)?.color;

    // the tree really is in the dark theme: the stage wears the DARK band
    await waitFor(() =>
      expect(StyleSheet.flatten(getByTestId("np-stage").props.style).backgroundColor).toBe(
        bandStageTint(tokens.accent, "dark")
      )
    );

    // the title — the display serif at the stage's big size
    expect(colorOf(getByTestId("np-title"))).toBe(tokens.label);
    // the artist — one step under the title
    expect(colorOf(getByText("Artist"))).toBe(tokens.label);
    // the time labels — the smallest step on the tint
    expect(colorOf(getByText("0:10"))).toBe(tokens.label);
    expect(colorOf(getByText("3:20"))).toBe(tokens.label);
  });

  it("keeps the stage's hierarchy in SIZE and WEIGHT, never in colour", () => {
    const { getByTestId, getByText } = render(<MusicPlayer />, { wrapper: wrap });
    const styleOf = (node: any) => StyleSheet.flatten(node.props.style);

    const title = styleOf(getByTestId("np-title"));
    const artist = styleOf(getByText("Artist"));
    const time = styleOf(getByText("0:10"));

    expect(title.fontSize).toBeGreaterThan(artist.fontSize);
    expect(artist.fontSize).toBeGreaterThan(time.fontSize);
    // the type floor: nothing on the stage drops below 14sp
    expect(time.fontSize).toBeGreaterThanOrEqual(14);
    // the weight carries what the colour used to: the artist reads a step
    // heavier than the times, and the title leads on size.
    expect(artist.fontWeight).toBe("600");
    expect(time.fontWeight).toBe("500");
  });
});

/**
 * The Now Playing LYRICS mode (SP2 Task 4).
 *
 * The words are the surface: bold lines, the current line led in the accent
 * and scaled, its neighbours stepping down. Tapping a line SEEKS to it, and
 * the follow keeps the current line in view — without ever fighting a finger
 * that is scrolling.
 */
describe("the Now Playing lyrics mode", () => {
  const LINES = [
    { timeMs: 1000, text: "First line" },
    { timeMs: 5000, text: "Second line" },
    { timeMs: 9000, text: "Third line" },
  ];

  it("renders the lyrics behind the switcher, not the stage", async () => {
    mockLyrics = LINES;
    const { getByText, getByTestId, queryByTestId, findByText } = await renderPlayer();
    fireEvent.press(getByText("Lyrics"));
    expect(getByTestId("music-lyrics")).toBeTruthy();
    expect(queryByTestId("np-stage")).toBeNull();
    expect(await findByText("Second line")).toBeTruthy();
  });

  it("keeps the honest empty state byte-for-byte", async () => {
    mockLyrics = null;
    const { getByText, findByText } = await renderPlayer();
    fireEvent.press(getByText("Lyrics"));
    expect(await findByText("No lyrics for this track.")).toBeTruthy();
  });

  it("tapping a line seeks to that line", async () => {
    mockLyrics = LINES;
    const { getByText, getByTestId } = await renderPlayer();
    fireEvent.press(getByText("Lyrics"));
    await waitFor(() => expect(getByTestId("music-lyric-1")).toBeTruthy());
    fireEvent.press(getByTestId("music-lyric-1"));
    expect(mockSeek).toHaveBeenCalledWith(5);
  });

  it("while casting, the active lyric line follows the receiver's clock", async () => {
    mockLyrics = LINES;
    mockPosition = 0; // the tablet's own clock is stale while casting
    mockCast = {
      ...idleCast(),
      casting: true,
      target: { id: "tv", name: "Living Room" },
      playing: true,
      position: 1,
      duration: 120,
    };
    const { theme, boost } = renderHook(() => useTheme(), { wrapper: wrap }).result.current;
    const tokens = musicTokensFor(theme, boost);
    const { getByText, getByTestId, rerender } = await renderPlayer();
    fireEvent.press(getByText("Lyrics"));
    await waitFor(() => expect(getByTestId("music-lyric-0")).toBeTruthy());
    const styleOf = (node: any) => StyleSheet.flatten(node.props.style);

    expect(styleOf(getByText("First line")).color).toBe(tokens.accent);

    // A position-only cast tick moves the active line.
    mockCast = { ...mockCast, position: 6 };
    rerender(<MusicPlayer />);
    expect(styleOf(getByText("Second line")).color).toBe(tokens.accent);
    expect(styleOf(getByText("First line")).color).not.toBe(tokens.accent);
  });

  it("while casting, tapping a lyric seeks the receiver, not the paused local player", async () => {
    mockCast = {
      ...idleCast(),
      casting: true,
      target: { id: "tv", name: "Living Room" },
      playing: true,
      position: 30,
      duration: 120,
    };
    mockLyrics = LINES;
    const { getByText, getByTestId } = await renderPlayer();
    fireEvent.press(getByText("Lyrics"));
    await waitFor(() => expect(getByTestId("music-lyric-1")).toBeTruthy());
    fireEvent.press(getByTestId("music-lyric-1"));
    expect(mockCast.seek).toHaveBeenCalledWith(5);
    expect(mockSeek).not.toHaveBeenCalled();
  });

  it("leads the current line in the accent and scales it; the neighbours step down", async () => {
    mockLyrics = LINES;
    mockPosition = 6; // 6000ms — the second line is the one being sung
    const { theme, boost } = renderHook(() => useTheme(), { wrapper: wrap }).result.current;
    const tokens = musicTokensFor(theme, boost);
    const { getByText, getByTestId } = await renderPlayer();
    fireEvent.press(getByText("Lyrics"));
    await waitFor(() => expect(getByTestId("music-lyric-1")).toBeTruthy());
    const styleOf = (node: any) => StyleSheet.flatten(node.props.style);

    // the current line: the accent, and scaled up a touch
    const current = styleOf(getByText("Second line"));
    expect(current.color).toBe(tokens.accent);
    expect(current.transform[0].scale).toBeGreaterThan(1);
    // its neighbours: the second tier
    expect(styleOf(getByText("First line")).color).toBe(tokens.label2);
    expect(styleOf(getByText("Third line")).color).toBe(tokens.label2);
    // everything further away: the third tier
    expect(styleOf(getByText("Second line")).fontSize).toBeGreaterThanOrEqual(14);
  });

  it("holds the 14sp floor on every line", async () => {
    mockLyrics = LINES;
    const { getByText, getByTestId } = await renderPlayer();
    fireEvent.press(getByText("Lyrics"));
    await waitFor(() => expect(getByTestId("music-lyric-0")).toBeTruthy());
    const styleOf = (node: any) => StyleSheet.flatten(node.props.style);
    for (const text of ["First line", "Second line", "Third line"]) {
      expect(styleOf(getByText(text)).fontSize).toBeGreaterThanOrEqual(14);
    }
  });

  it("the follow scrolls the current line into view", async () => {
    mockLyrics = LINES;
    mockPosition = 0;
    const { getByText, getByTestId, UNSAFE_getAllByType, rerender } = await renderPlayer();
    fireEvent.press(getByText("Lyrics"));
    await waitFor(() => expect(getByTestId("music-lyric-0")).toBeTruthy());

    const scroll = lyricsScroll(UNSAFE_getAllByType(ScrollView));
    const spy = jest.spyOn(Object.getPrototypeOf(scroll.instance), "scrollTo");

    // the lines are measured (jest has no layout engine, so the pane is told)
    fireEvent(getByTestId("music-lyric-1"), "layout", { nativeEvent: { layout: { x: 0, y: 64, width: 600, height: 64 } } });
    fireEvent(getByTestId("music-lyric-2"), "layout", { nativeEvent: { layout: { x: 0, y: 128, width: 600, height: 64 } } });
    spy.mockClear();

    // the song moves on to the second line — the follow follows it
    mockPosition = 6;
    rerender(<MusicPlayer />);
    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(spy).toHaveBeenCalledWith({ y: 64, animated: true });
  });

  it("the follow pauses while the user scrolls and resumes ~3s later", async () => {
    jest.useFakeTimers();
    try {
      mockLyrics = LINES;
      mockPosition = 0;
      const { getByText, getByTestId, UNSAFE_getAllByType, rerender } = await renderPlayer();
      fireEvent.press(getByText("Lyrics"));

      const scroll = lyricsScroll(UNSAFE_getAllByType(ScrollView));
      const spy = jest.spyOn(Object.getPrototypeOf(scroll.instance), "scrollTo");
      fireEvent(getByTestId("music-lyric-2"), "layout", { nativeEvent: { layout: { x: 0, y: 128, width: 600, height: 64 } } });
      spy.mockClear();

      // the user drags the list: the follow must not fight the finger
      fireEvent(scroll.element, "scrollBeginDrag", {
        nativeEvent: {
          contentOffset: { x: 0, y: 220 },
          contentSize: { width: 600, height: 2000 },
          layoutMeasurement: { width: 600, height: 600 },
        },
      });

      mockPosition = 9;
      rerender(<MusicPlayer />);
      expect(spy).not.toHaveBeenCalled();

      // ...and it comes back once the pause expires
      act(() => { jest.advanceTimersByTime(3000); });
      expect(spy).toHaveBeenCalledWith({ y: 128, animated: true });
    } finally {
      jest.useRealTimers();
    }
  });
});

/**
 * The Now Playing QUEUE mode (SP2 Task 4).
 *
 * "Playing Next" is a panel — the visible queue, and nothing a viewer may not
 * see — with the recently played rows below it. Every row is thumb-sized.
 */
describe("the Now Playing queue mode", () => {
  const SECOND = {
    id: "second1111", title: "Second Song", artist: "D", album: "", durationSeconds: 100,
    artworkUrl: null, explicit: false, source: "youtube_music",
  };

  it("renders the queue panel with the visible tracks", async () => {
    mockQueue = [CLEAN_TRACK, SECOND];
    const { getByText, getByTestId } = await renderPlayer();
    fireEvent.press(getByText("Queue"));
    expect(getByTestId("music-queue")).toBeTruthy();
    expect(getByText("Playing Next")).toBeTruthy();
    expect(getByText("Found")).toBeTruthy();
    expect(getByText("Second Song")).toBeTruthy();
  });

  it("never paints a track the viewer may not see", async () => {
    mockMember = KID;
    mockDenied = ["eminem"];
    mockQueue = [CLEAN_TRACK, DENIED_TRACK];
    const { getByText, queryByText } = await renderPlayer();
    fireEvent.press(getByText("Queue"));
    expect(getByText("Found")).toBeTruthy();
    expect(queryByText("Till I Collapse")).toBeNull();
  });

  it("the rows are thumb-sized and carry the artwork, the title and the artist", async () => {
    mockQueue = [CLEAN_TRACK];
    const { theme, boost } = renderHook(() => useTheme(), { wrapper: wrap }).result.current;
    const tokens = musicTokensFor(theme, boost);
    const { getByText, getByTestId } = await renderPlayer();
    fireEvent.press(getByText("Queue"));
    const row = StyleSheet.flatten(getByTestId("music-queue-row-0").props.style);
    expect(row.minHeight).toBeGreaterThanOrEqual(64);
    const thumb = StyleSheet.flatten(getByTestId("music-queue-thumb-0").props.style);
    expect(thumb.width).toBe(48);
    expect(thumb.height).toBe(48);
    const styleOf = (node: any) => StyleSheet.flatten(node.props.style);
    expect(styleOf(getByText("Found")).color).toBe(tokens.label);
    expect(styleOf(getByText("A")).color).toBe(tokens.label3);
  });

  it("removes a track from the queue and reorders another", async () => {
    mockQueue = [CLEAN_TRACK, SECOND];
    const { getByText, getByTestId } = await renderPlayer();
    fireEvent.press(getByText("Queue"));
    fireEvent.press(getByTestId("music-queue-remove-0"));
    expect(mockRemoveFromQueue).toHaveBeenCalledWith(0);
    fireEvent.press(getByTestId("music-queue-down-0"));
    expect(mockMoveQueueItem).toHaveBeenCalledWith(0, 1);
  });

  it("lists the recently played rows below the queue", async () => {
    mockQueue = [CLEAN_TRACK];
    mockHistory = [{
      id: "zzz99999999", title: "Older", artist: "Artist", album: "",
      durationSeconds: 100, artworkUrl: null, explicit: false, source: "youtube_music",
    }];
    const { getByText, getByTestId } = await renderPlayer();
    fireEvent.press(getByText("Queue"));
    expect(getByText("Recently played")).toBeTruthy();
    const row = getByTestId("music-history-zzz99999999");
    expect(row).toBeTruthy();
    fireEvent.press(row);
    expect(mockPlay).toHaveBeenCalledWith(expect.objectContaining({ id: "zzz99999999" }), [expect.objectContaining({ id: "zzz99999999" })]);
  });

  it("the shuffle and repeat capsules sit in the section header", async () => {
    mockQueue = [CLEAN_TRACK];
    mockShuffle = true;
    mockRepeat = "all";
    const { getByText, getByTestId } = await renderPlayer();
    fireEvent.press(getByText("Queue"));
    const shuffle = getByTestId("music-queue-shuffle");
    const repeat = getByTestId("music-queue-repeat");
    expect(shuffle).toBeTruthy();
    expect(repeat).toBeTruthy();
    fireEvent.press(shuffle);
    expect(mockToggleShuffle).toHaveBeenCalled();
    fireEvent.press(repeat);
    expect(mockCycleRepeat).toHaveBeenCalled();
  });
});

/**
 * The SEARCH surface (SP2 Task 5) — the field, the Top Result and the rows.
 *
 * The search results are rebuilt on the Liquid palette: a sheet-ground field,
 * a TOP RESULT card (the artwork leads at 120) and the remaining results as
 * rows on a panel with hairline separators. The honest states and the
 * markers keep their copy — and the markers stay parent-only.
 */
describe("the search surface on the Liquid panels", () => {
  const SECOND = {
    id: "second1111", title: "Second Song", artist: "D", album: "", durationSeconds: 100,
    artworkUrl: null, explicit: false, source: "youtube_music",
  };
  const THIRD = {
    id: "third11111", title: "Third Song", artist: "E", album: "", durationSeconds: 100,
    artworkUrl: null, explicit: false, source: "youtube_music",
  };

  /** The tokens the surface is painted with. */
  const tokens = () => {
    const { theme, boost } = renderHook(() => useTheme(), { wrapper: wrap }).result.current;
    return musicTokensFor(theme, boost);
  };

  /** Runs a search and lets the answer settle INSIDE act(). */
  const search = async (term: string) => {
    const utils = render(<MusicPlayer />, { wrapper: wrap });
    fireEvent.changeText(utils.getByTestId("music-search-input"), term);
    await act(async () => {
      fireEvent.press(utils.getByTestId("music-search-submit"));
    });
    return utils;
  };

  it("the field is a sheet-ground box on the Liquid radius", () => {
    mockCurrent = null;
    const t = tokens();
    const { getByTestId } = render(<MusicPlayer />, { wrapper: wrap });
    const field = StyleSheet.flatten(getByTestId("music-search-input").props.style);
    expect(field.backgroundColor).toBe(t.sheet);
    expect(field.borderRadius).toBe(14);
    // the field is thumb-sized
    expect(field.minHeight).toBeGreaterThanOrEqual(64);
    const submit = StyleSheet.flatten(getByTestId("music-search-submit").props.style);
    expect(submit.minHeight).toBeGreaterThanOrEqual(64);
  });

  it("leads with a TOP RESULT card — the artwork leads at 120", async () => {
    mockCurrent = null;
    mockSearchOutcome = { tracks: [CLEAN_TRACK, SECOND], explicitKnown: true };
    const t = tokens();
    const { getByTestId, findByTestId } = await search("beatles");
    const card = await findByTestId("music-top-result");
    expect(StyleSheet.flatten(card.props.style).backgroundColor).toBe(t.panel);
    const artwork = StyleSheet.flatten(getByTestId("music-top-result-artwork").props.style);
    expect(artwork.width).toBe(120);
    expect(artwork.height).toBe(120);
    expect(artwork.borderRadius).toBe(t.artworkRadius);
  });

  it("the Top Result plays from its own Play button", async () => {
    mockCurrent = null;
    mockSearchOutcome = { tracks: [CLEAN_TRACK, SECOND], explicitKnown: true };
    const { findByTestId } = await search("beatles");
    const play = await findByTestId("music-top-result-play");
    expect(StyleSheet.flatten(play.props.style).minHeight).toBeGreaterThanOrEqual(64);
    fireEvent.press(play);
    expect(mockPlay).toHaveBeenCalledWith(CLEAN_TRACK, [CLEAN_TRACK, SECOND]);
  });

  it("while a cast session is live, search and queue rows hand playback to the provider", async () => {
    mockCast = {
      ...idleCast(),
      casting: true,
      target: { id: "tv", name: "Living Room" },
      playing: true,
    };
    mockCurrent = null;
    mockSearchOutcome = { tracks: [CLEAN_TRACK, SECOND], explicitKnown: true };
    const view = render(<MusicPlayer />, { wrapper: wrap });
    fireEvent.changeText(view.getByTestId("music-search-input"), "beatles");
    await act(async () => {
      fireEvent.press(view.getByTestId("music-search-submit"));
    });

    // The search TOP RESULT goes through the provider's play path — the one
    // that routes to the receiver while the cast sink is installed.
    fireEvent.press(await view.findByTestId("music-top-result-play"));
    expect(mockPlay).toHaveBeenCalledWith(CLEAN_TRACK, [CLEAN_TRACK, SECOND]);
    expect(mockCast.startCast).not.toHaveBeenCalled();

    mockCurrent = DEFAULT_CURRENT;
    mockQueue = [CLEAN_TRACK, SECOND];
    view.rerender(<MusicPlayer />);
    fireEvent.press(view.getByText("Queue"));
    fireEvent.press(view.getByTestId("music-queue-row-1"));
    expect(mockPlay).toHaveBeenLastCalledWith(SECOND, [CLEAN_TRACK, SECOND]);
    expect(mockCast.startCast).not.toHaveBeenCalled();
  });

  it("keeps the remaining results as rows on a panel, with hairline separators", async () => {
    mockCurrent = null;
    mockSearchOutcome = { tracks: [CLEAN_TRACK, SECOND, THIRD], explicitKnown: true };
    const t = tokens();
    const { getByTestId, findByTestId, getByText } = await search("beatles");
    const panel = await findByTestId("music-results");
    expect(StyleSheet.flatten(panel.props.style).backgroundColor).toBe(t.panel);
    const row = StyleSheet.flatten(getByTestId(`music-result-${SECOND.id}`).props.style);
    expect(row.minHeight).toBeGreaterThanOrEqual(64);
    // the row below it carries the hairline
    const next = StyleSheet.flatten(getByTestId(`music-result-${THIRD.id}`).props.style);
    expect(next.borderTopWidth).toBe(1);
    expect(next.borderTopColor).toBe(t.panelSeparator);
    const thumb = StyleSheet.flatten(getByTestId(`music-result-thumb-${SECOND.id}`).props.style);
    expect(thumb.width).toBe(48);
    expect(thumb.height).toBe(48);
    // the words read the right tiers: the title is the label, the artist the third
    const styleOf = (node: any) => StyleSheet.flatten(node.props.style);
    expect(styleOf(getByText("Second Song")).color).toBe(t.label);
    expect(styleOf(getByText("D")).color).toBe(t.label3);
  });

  it("gives the Top Result its own + Queue control", async () => {
    mockCurrent = null;
    mockSearchOutcome = { tracks: [CLEAN_TRACK, SECOND], explicitKnown: true };
    const { findByTestId, getAllByText } = await search("beatles");
    const queue = await findByTestId("music-top-result-queue");
    expect(StyleSheet.flatten(queue.props.style).minHeight).toBeGreaterThanOrEqual(64);
    // the copy is unchanged — on the card and on the row below it
    expect(getAllByText("+ Queue").length).toBe(2);
  });

  it("keeps the markers' copy — on the Top Result and on a row alike", async () => {
    mockCurrent = null;
    mockMember = PARENT;
    mockDenied = ["eminem"];
    mockSearchOutcome = { tracks: [UNRATED_TRACK, DENIED_TRACK], explicitKnown: true };
    const { findByText, findByTestId } = await search("beatles");
    // the copy is byte-identical
    expect(await findByText("Unrated")).toBeTruthy();
    expect(await findByText("Blocked for kids")).toBeTruthy();
    expect(await findByTestId(`music-result-unrated-${UNRATED_TRACK.id}`)).toBeTruthy();
    expect(await findByTestId(`music-result-blocked-${DENIED_TRACK.id}`)).toBeTruthy();
  });

  it("never marks the Top Result for a kid role", async () => {
    mockCurrent = null;
    mockMember = KID;
    mockExplicitFilter = false;
    mockSearchOutcome = { tracks: [UNRATED_TRACK], explicitKnown: true };
    const { findByTestId, queryByTestId } = await search("beatles");
    expect(await findByTestId("music-top-result")).toBeTruthy();
    expect(queryByTestId(`music-result-unrated-${UNRATED_TRACK.id}`)).toBeNull();
  });

  it("never paints a track the viewer may not see — not on the card, not on a row", async () => {
    mockCurrent = null;
    mockMember = KID;
    mockDenied = ["eminem"];
    mockSearchOutcome = { tracks: [DENIED_TRACK, CLEAN_TRACK], explicitKnown: true };
    const { findByText, queryByText } = await search("eminem");
    expect(await findByText("Found")).toBeTruthy();
    expect(queryByText("Till I Collapse")).toBeNull();
    expect(queryByText("Blocked for kids")).toBeNull();
  });

  it("keeps the honest states byte-for-byte, on the token grounds", async () => {
    mockCurrent = null;
    mockMember = KID;
    mockSearchOutcome = { tracks: [], explicitKnown: true };
    const t = tokens();
    const { getByTestId, findByText } = await search("zzzz");
    const note = await findByText("No songs matched that search.");
    expect(note).toBeTruthy();
    expect(StyleSheet.flatten(note.props.style).color).toBe(t.label2);
    expect(getByTestId("music-search-note-empty")).toBeTruthy();
  });
});

/**
 * The DOWNLOADS tray (SP2 Task 5) — panel rows, the byte count, the delete.
 */
describe("the downloads tray on the Liquid panels", () => {
  const SAVED = {
    id: "dl11111111", title: "Saved Song", artist: "A", album: "", durationSeconds: 100,
    artworkUrl: null, fileUri: "file:///x.m4a", bytes: 5 * 1024 * 1024, savedAt: 1,
    explicit: false,
  };

  it("lists the downloads as panel rows, with the byte count and a thumb-sized delete", async () => {
    mockDownloads = [SAVED];
    const t = (() => {
      const { theme, boost } = renderHook(() => useTheme(), { wrapper: wrap }).result.current;
      return musicTokensFor(theme, boost);
    })();
    const { getByTestId, getByText } = render(<MusicPlayer />, { wrapper: wrap });
    await waitFor(() => expect(getByTestId("music-download-dl11111111")).toBeTruthy());
    const row = StyleSheet.flatten(getByTestId("music-download-dl11111111").props.style);
    expect(row.minHeight).toBeGreaterThanOrEqual(64);
    // the byte count reads the third tier
    expect(StyleSheet.flatten(getByText("5 MB").props.style).color).toBe(t.label3);
    // the delete control is thumb-sized
    const remove = StyleSheet.flatten(getByTestId("music-download-remove-dl11111111").props.style);
    expect(remove.minHeight).toBeGreaterThanOrEqual(64);
  });

  it("keeps the header's honest cap copy", async () => {
    mockDownloads = [SAVED];
    const { getByText } = render(<MusicPlayer />, { wrapper: wrap });
    await waitFor(() => expect(getByText("Downloads · 5 MB")).toBeTruthy());
  });
});

/**
 * The RECENTLY PLAYED shelf (SP2 Task 5) — panel rows on the grouped ground.
 */
describe("the recently played shelf on the Liquid panels", () => {
  it("sits on the grouped ground, and plays through the visible history", async () => {
    mockCurrent = null;
    mockHistory = [CLEAN_TRACK];
    const t = (() => {
      const { theme, boost } = renderHook(() => useTheme(), { wrapper: wrap }).result.current;
      return musicTokensFor(theme, boost);
    })();
    const { getByTestId } = render(<MusicPlayer />, { wrapper: wrap });
    await waitFor(() => expect(getByTestId("music-history-shelf")).toBeTruthy());
    expect(StyleSheet.flatten(getByTestId("music-history-shelf").props.style).backgroundColor).toBe(t.grouped);
    const row = StyleSheet.flatten(getByTestId(`music-history-${CLEAN_TRACK.id}`).props.style);
    expect(row.minHeight).toBeGreaterThanOrEqual(64);
    // the play behaviour is unchanged: it plays through the VISIBLE history
    fireEvent.press(getByTestId(`music-history-${CLEAN_TRACK.id}`));
    expect(mockPlay).toHaveBeenCalledWith(CLEAN_TRACK, [CLEAN_TRACK]);
  });
});

it("lists downloads and removes one", async () => {
  // The download carries its rating: a row the viewer may not see is not
  // listed at all (see "hides an explicit download from a kid" below).
  mockDownloads = [{
    id: "abc12345678", title: "Song", artist: "Artist", album: "",
    durationSeconds: 200, artworkUrl: null, fileUri: "file:///x", bytes: 1000, savedAt: 1,
    explicit: false,
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

it("fails closed when the persisted setting has no explicitFilter key at all", async () => {
  mockCurrent = null;
  mockMember = KID;
  // A payload written before the key existed: `explicitFilter` is undefined,
  // so the filter must stay ON (only an explicit `false` turns it off).
  mockExplicitFilter = undefined;
  mockSearchOutcome = { tracks: [EXPLICIT_TRACK], explicitKnown: true };
  const { getByTestId, findByText, queryByText } = render(<MusicPlayer />, { wrapper: wrap });
  fireEvent.changeText(getByTestId("music-search-input"), "beatles");
  fireEvent.press(getByTestId("music-search-submit"));
  expect(await findByText("Nothing here to play — ask a parent to pick something.")).toBeTruthy();
  expect(queryByText("Bad Song")).toBeNull();
});

it("marks an unrated row as Unrated for a parent", async () => {
  mockCurrent = null;
  mockMember = PARENT;
  mockSearchOutcome = { tracks: [UNRATED_TRACK, CLEAN_TRACK], explicitKnown: true };
  const { getByTestId, findByTestId, findByText, queryByTestId } = render(<MusicPlayer />, { wrapper: wrap });
  fireEvent.changeText(getByTestId("music-search-input"), "beatles");
  fireEvent.press(getByTestId("music-search-submit"));
  const marker = await findByTestId(`music-result-unrated-${UNRATED_TRACK.id}`);
  expect(marker).toBeTruthy();
  expect(await findByText("Unrated")).toBeTruthy();
  // A row that is not marked explicit carries no marker.
  expect(queryByTestId(`music-result-unrated-${CLEAN_TRACK.id}`)).toBeNull();
});

it("a kid never sees a denied row in the search results", async () => {
  // The badge did not catch this one: it says "not marked explicit", so only
  // the family's own deny-list keeps it away from a kid.
  mockCurrent = null;
  mockMember = KID;
  mockDenied = ["eminem"];
  mockSearchOutcome = { tracks: [DENIED_TRACK, CLEAN_TRACK], explicitKnown: true };
  const { getByTestId, findByText, queryByText } = render(<MusicPlayer />, { wrapper: wrap });
  fireEvent.changeText(getByTestId("music-search-input"), "eminem");
  fireEvent.press(getByTestId("music-search-submit"));
  expect(await findByText("Found")).toBeTruthy();
  expect(queryByText("Till I Collapse")).toBeNull();
});

it("a parent still sees a denied row in the search results", async () => {
  mockCurrent = null;
  mockMember = PARENT;
  mockDenied = ["eminem"];
  mockSearchOutcome = { tracks: [DENIED_TRACK, CLEAN_TRACK], explicitKnown: true };
  const { getByTestId, findByText } = render(<MusicPlayer />, { wrapper: wrap });
  fireEvent.changeText(getByTestId("music-search-input"), "eminem");
  fireEvent.press(getByTestId("music-search-submit"));
  expect(await findByText("Till I Collapse")).toBeTruthy();
});

it("a kid never sees a denied row with the explicit filter OFF", async () => {
  // The filter setting governs the BADGE only: the family's own list holds
  // either way.
  mockCurrent = null;
  mockMember = KID;
  mockExplicitFilter = false;
  mockDenied = ["eminem"];
  mockSearchOutcome = { tracks: [DENIED_TRACK, CLEAN_TRACK], explicitKnown: true };
  const { getByTestId, findByText, queryByText } = render(<MusicPlayer />, { wrapper: wrap });
  fireEvent.changeText(getByTestId("music-search-input"), "eminem");
  fireEvent.press(getByTestId("music-search-submit"));
  expect(await findByText("Found")).toBeTruthy();
  expect(queryByText("Till I Collapse")).toBeNull();
});

it("does not mark a row that is not marked explicit", async () => {
  mockCurrent = null;
  mockMember = PARENT;
  mockSearchOutcome = { tracks: [CLEAN_TRACK], explicitKnown: true };
  const { getByTestId, findByText, queryByTestId } = render(<MusicPlayer />, { wrapper: wrap });
  fireEvent.changeText(getByTestId("music-search-input"), "beatles");
  fireEvent.press(getByTestId("music-search-submit"));
  expect(await findByText("Found")).toBeTruthy();
  expect(queryByTestId(`music-result-unrated-${CLEAN_TRACK.id}`)).toBeNull();
});

it("never marks a row for a kid role", async () => {
  mockCurrent = null;
  mockMember = KID;
  mockExplicitFilter = false;
  mockSearchOutcome = { tracks: [UNRATED_TRACK], explicitKnown: true };
  const { getByTestId, findByText, queryByTestId } = render(<MusicPlayer />, { wrapper: wrap });
  fireEvent.changeText(getByTestId("music-search-input"), "beatles");
  fireEvent.press(getByTestId("music-search-submit"));
  expect(await findByText("Unknown Song")).toBeTruthy();
  expect(queryByTestId(`music-result-unrated-${UNRATED_TRACK.id}`)).toBeNull();
});

it("says the check failed when the ratings were unknown and no track came back", async () => {
  mockCurrent = null;
  mockMember = KID;
  mockSearchOutcome = { tracks: [], explicitKnown: false };
  const { getByTestId, findByText, queryByText } = render(<MusicPlayer />, { wrapper: wrap });
  fireEvent.changeText(getByTestId("music-search-input"), "zzzz");
  fireEvent.press(getByTestId("music-search-submit"));
  // An empty list must never read as "nothing found" when the truth is
  // "we could not check the ratings".
  expect(await findByText("Couldn't check these tracks — ask a parent to pick something.")).toBeTruthy();
  expect(queryByText("No songs matched that search.")).toBeNull();
});

it("says nothing matched to a parent when the search found nothing", async () => {
  mockCurrent = null;
  mockMember = PARENT;
  mockSearchOutcome = { tracks: [], explicitKnown: false };
  const { getByTestId, findByText, queryByText } = render(<MusicPlayer />, { wrapper: wrap });
  fireEvent.changeText(getByTestId("music-search-input"), "zzzz");
  fireEvent.press(getByTestId("music-search-submit"));
  expect(await findByText("No songs matched that search.")).toBeTruthy();
  expect(queryByText("Couldn't check these tracks — ask a parent to pick something.")).toBeNull();
});

it("is accurate when only some of the hidden tracks are unrated", async () => {
  mockCurrent = null;
  mockMember = KID;
  mockSearchOutcome = { tracks: [UNRATED_TRACK, EXPLICIT_TRACK], explicitKnown: true };
  const { getByTestId, findByText } = render(<MusicPlayer />, { wrapper: wrap });
  fireEvent.changeText(getByTestId("music-search-input"), "beatles");
  fireEvent.press(getByTestId("music-search-submit"));
  expect(await findByText("Some of these tracks aren't rated, so they can't be shown here.")).toBeTruthy();
});

it("announces the search note to screen readers", async () => {
  mockCurrent = null;
  mockMember = KID;
  mockSearchOutcome = { tracks: [], explicitKnown: true };
  const { getByTestId, findByTestId } = render(<MusicPlayer />, { wrapper: wrap });
  fireEvent.changeText(getByTestId("music-search-input"), "zzzz");
  fireEvent.press(getByTestId("music-search-submit"));
  const note = await findByTestId("music-search-note-empty");
  expect(note.props.accessibilityRole).toBe("alert");
  expect(note.props.accessibilityLiveRegion).toBe("polite");
});

/**
 * The queue, the history and the downloads are track surfaces too: the
 * explicit policy covers every place a kid can SEE a track, not just the
 * search results.
 */
describe("the other track surfaces", () => {
  it("hides an explicit track from the queue for a kid", async () => {
    mockMember = KID;
    mockQueue = [CLEAN_TRACK, EXPLICIT_TRACK];
    const { getByText, queryByText, findByText } = render(<MusicPlayer />, { wrapper: wrap });
    fireEvent.press(getByText("Queue"));
    expect(await findByText("Found")).toBeTruthy();
    expect(queryByText("Bad Song")).toBeNull();
  });

  it("shows an explicit track in the queue to a parent", async () => {
    mockMember = PARENT;
    mockQueue = [CLEAN_TRACK, EXPLICIT_TRACK];
    const { getByText, findByText } = render(<MusicPlayer />, { wrapper: wrap });
    fireEvent.press(getByText("Queue"));
    expect(await findByText("Bad Song")).toBeTruthy();
  });

  it("hands the player the FILTERED queue, never the raw one", async () => {
    mockMember = KID;
    mockQueue = [CLEAN_TRACK, EXPLICIT_TRACK];
    const { getByText, findByText } = render(<MusicPlayer />, { wrapper: wrap });
    fireEvent.press(getByText("Queue"));
    fireEvent.press(await findByText("Found"));
    expect(mockPlay).toHaveBeenCalledWith(CLEAN_TRACK, [CLEAN_TRACK]);
  });

  it("hands a parent the whole queue", async () => {
    mockMember = PARENT;
    mockQueue = [CLEAN_TRACK, EXPLICIT_TRACK];
    const { getByText, findByText } = render(<MusicPlayer />, { wrapper: wrap });
    fireEvent.press(getByText("Queue"));
    fireEvent.press(await findByText("Found"));
    expect(mockPlay).toHaveBeenCalledWith(CLEAN_TRACK, [CLEAN_TRACK, EXPLICIT_TRACK]);
  });

  it("hides an explicit track from the recently played shelf for a kid", async () => {
    mockCurrent = null;
    mockMember = KID;
    mockHistory = [CLEAN_TRACK, EXPLICIT_TRACK];
    const { getByTestId, queryByTestId } = render(<MusicPlayer />, { wrapper: wrap });
    expect(getByTestId(`music-history-${CLEAN_TRACK.id}`)).toBeTruthy();
    expect(queryByTestId(`music-history-${EXPLICIT_TRACK.id}`)).toBeNull();
  });

  it("plays the recently played track from the FILTERED shelf", async () => {
    mockCurrent = null;
    mockMember = KID;
    mockHistory = [CLEAN_TRACK, EXPLICIT_TRACK];
    const { getByTestId } = render(<MusicPlayer />, { wrapper: wrap });
    fireEvent.press(getByTestId(`music-history-${CLEAN_TRACK.id}`));
    expect(mockPlay).toHaveBeenCalledWith(CLEAN_TRACK, [CLEAN_TRACK]);
  });

  it("hides an explicit download from a kid", async () => {
    mockMember = KID;
    mockDownloads = [
      { ...CLEAN_TRACK, fileUri: "file:///clean.m4a", bytes: 1000, savedAt: 1 },
      { ...EXPLICIT_TRACK, fileUri: "file:///bad.m4a", bytes: 2000, savedAt: 1 },
    ];
    const { getByTestId, queryByTestId } = render(<MusicPlayer />, { wrapper: wrap });
    expect(getByTestId(`music-download-${CLEAN_TRACK.id}`)).toBeTruthy();
    expect(queryByTestId(`music-download-${EXPLICIT_TRACK.id}`)).toBeNull();
  });

  it("shows an explicit download to a parent", async () => {
    mockMember = PARENT;
    mockDownloads = [
      { ...EXPLICIT_TRACK, fileUri: "file:///bad.m4a", bytes: 2000, savedAt: 1 },
    ];
    const { getByTestId } = render(<MusicPlayer />, { wrapper: wrap });
    expect(getByTestId(`music-download-${EXPLICIT_TRACK.id}`)).toBeTruthy();
  });

  it("never paints a now-playing panel for a track the viewer may not see", async () => {
    mockMember = KID;
    mockCurrent = EXPLICIT_TRACK;
    const { queryByTestId, queryByText } = render(<MusicPlayer />, { wrapper: wrap });
    expect(queryByTestId("np-title")).toBeNull();
    expect(queryByText("Bad Song")).toBeNull();
  });

  it("paints the now-playing panel for a track the viewer may see", async () => {
    mockMember = KID;
    mockCurrent = CLEAN_TRACK;
    const { getByTestId } = render(<MusicPlayer />, { wrapper: wrap });
    expect(getByTestId("np-title").props.children).toBe("Found");
  });
});

/**
 * The parent-only editor: a parent names what stays away from the kids.
 * A kid role NEVER sees the control — not the button, not the list.
 */
describe("the parent-only deny-list editor", () => {
  it("a kid never sees the Blocked button", () => {
    mockMember = KID;
    const { queryByText, queryByTestId } = render(<MusicPlayer />, { wrapper: wrap });
    expect(queryByText("Blocked")).toBeNull();
    expect(queryByTestId("music-deny-open")).toBeNull();
  });

  it("a parent sees the Blocked button and can open the editor", async () => {
    mockMember = PARENT;
    const { getByText, findByTestId, findByText } = render(<MusicPlayer />, { wrapper: wrap });
    expect(getByText("Blocked")).toBeTruthy();
    fireEvent.press(getByText("Blocked"));
    expect(await findByTestId("music-deny-modal")).toBeTruthy();
    expect(await findByText("Blocked artists & songs")).toBeTruthy();
    expect(await findByText("Anything matching these stays away from the kids.")).toBeTruthy();
  });

  it("the editor lists the terms and can add and remove one", async () => {
    mockMember = PARENT;
    mockDenied = ["eminem"];
    const { getByText, getByTestId, findByText, queryByText } = render(<MusicPlayer />, { wrapper: wrap });
    fireEvent.press(getByText("Blocked"));
    // the family's own list is listed as it was typed
    expect(await findByText("eminem")).toBeTruthy();
    // add a term
    fireEvent.changeText(getByTestId("music-deny-input"), "drake");
    fireEvent.press(getByTestId("music-deny-add"));
    expect(mockAddDenied).toHaveBeenCalledWith("drake");
    expect(await findByText("drake")).toBeTruthy();
    // remove a term
    fireEvent.press(getByTestId("music-deny-remove-0"));
    expect(mockRemoveDenied).toHaveBeenCalledWith("eminem");
    await waitFor(() => expect(queryByText("eminem")).toBeNull());
  });

  it("says so plainly when nothing is blocked yet", async () => {
    mockMember = PARENT;
    const { getByText, findByText } = render(<MusicPlayer />, { wrapper: wrap });
    fireEvent.press(getByText("Blocked"));
    expect(await findByText("Nothing blocked yet.")).toBeTruthy();
  });

  it("a parent sees a denied row marked 'Blocked for kids'", async () => {
    mockCurrent = null;
    mockMember = PARENT;
    mockDenied = ["eminem"];
    mockSearchOutcome = { tracks: [DENIED_TRACK, CLEAN_TRACK], explicitKnown: true };
    const { getByTestId, findByText, findByTestId } = render(<MusicPlayer />, { wrapper: wrap });
    fireEvent.changeText(getByTestId("music-search-input"), "eminem");
    fireEvent.press(getByTestId("music-search-submit"));
    expect(await findByText("Till I Collapse")).toBeTruthy();
    expect(await findByText("Blocked for kids")).toBeTruthy();
    expect(await findByTestId(`music-result-blocked-${DENIED_TRACK.id}`)).toBeTruthy();
    // a row that is not denied carries no marker
    expect(() => getByTestId(`music-result-blocked-${CLEAN_TRACK.id}`)).toThrow();
  });

  it("a denied row is not rendered for a kid", async () => {
    mockCurrent = null;
    mockMember = KID;
    mockDenied = ["eminem"];
    mockSearchOutcome = { tracks: [DENIED_TRACK, CLEAN_TRACK], explicitKnown: true };
    const { getByTestId, findByText, queryByText, queryByTestId } = render(<MusicPlayer />, { wrapper: wrap });
    fireEvent.changeText(getByTestId("music-search-input"), "eminem");
    fireEvent.press(getByTestId("music-search-submit"));
    expect(await findByText("Found")).toBeTruthy();
    expect(queryByText("Till I Collapse")).toBeNull();
    expect(queryByText("Blocked for kids")).toBeNull();
    expect(queryByTestId(`music-result-blocked-${DENIED_TRACK.id}`)).toBeNull();
  });
});
