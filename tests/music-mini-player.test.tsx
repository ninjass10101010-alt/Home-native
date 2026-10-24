/* eslint-disable @typescript-eslint/no-require-imports, import/first -- jest.mock factories run before the imports */
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
const mockToggle = jest.fn();
const mockNext = jest.fn(async () => {});
/** The track the provider is on (null = nothing playing). */
let mockState: any = {
  current: { id: "abc12345678", title: "Song", artist: "Artist", artworkUrl: null, explicit: false },
  playing: false,
};
/** The role-aware content policy the viewer is under. */
let mockPolicy: any = { isParent: false, filterOn: true, denied: [] };
jest.mock("../src/music/playback", () => ({
  usePlayback: () => ({ ...mockState, policy: mockPolicy, toggle: mockToggle, next: mockNext }),
}));
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
let mockCastState: any = idleCast();
jest.mock("../src/music/CastProvider", () => ({ useCast: () => mockCastState }));
let mockPath = "/";
jest.mock("expo-router", () => ({ usePathname: () => mockPath, useRouter: () => ({ push: jest.fn() }) }));

import React from "react";
import { StyleSheet } from "react-native";
import { fireEvent, render, renderHook } from "@testing-library/react-native";
import { MiniPlayer } from "../src/music/MiniPlayer";
import { ThemeProvider, useTheme } from "../src/theme/ThemeProvider";
import { musicTokensFor } from "../src/theme/music-tokens";
import { DOCK_TOP_OFFSET } from "../src/nav/CapsuleDock";

const wrap = ({ children }: { children: React.ReactNode }) => <ThemeProvider>{children}</ThemeProvider>;

/** The theme the app resolved — the Liquid palette follows it. */
const resolved = () => renderHook(() => useTheme(), { wrapper: wrap }).result.current;

beforeEach(() => {
  mockPath = "/";
  mockState = {
    current: { id: "abc12345678", title: "Song", artist: "Artist", artworkUrl: null, explicit: false },
    playing: false,
  };
  mockPolicy = { isParent: false, filterOn: true, denied: [] };
  mockCastState = idleCast();
  jest.clearAllMocks();
});

it("renders on a normal route and hides on the player route", () => {
  mockPath = "/";
  const first = render(<MiniPlayer />, { wrapper: wrap });
  expect(first.getByTestId("mini-player")).toBeTruthy();
  first.unmount();
  mockPath = "/music";
  const second = render(<MiniPlayer />, { wrapper: wrap });
  expect(second.queryByTestId("mini-player")).toBeNull();
});

it("marks the bar as casting only while a cast is live", () => {
  const idle = render(<MiniPlayer />, { wrapper: wrap });
  expect(idle.queryByTestId("mini-player-cast")).toBeNull();
  idle.unmount();

  mockCastState = { ...mockCastState, casting: true, target: { id: "tv", name: "Living Room" } };
  const live = render(<MiniPlayer />, { wrapper: wrap });
  expect(live.getByTestId("mini-player-cast")).toBeTruthy();
  expect(live.getByText("Casting")).toBeTruthy();
});

it("routes the transport to the receiver while casting", () => {
  const castPause = jest.fn(async () => {});
  const castAdvance = jest.fn(async () => {});
  mockCastState = {
    ...idleCast(),
    casting: true,
    target: { id: "tv", name: "Living Room" },
    playing: true,
    pause: castPause,
    advance: castAdvance,
  };
  const { getByTestId } = render(<MiniPlayer />, { wrapper: wrap });

  expect(getByTestId("mini-player-play").props.accessibilityLabel).toBe("Pause");
  fireEvent.press(getByTestId("mini-player-play"));
  expect(castPause).toHaveBeenCalledTimes(1);
  expect(mockToggle).not.toHaveBeenCalled();

  fireEvent.press(getByTestId("mini-player-next"));
  expect(castAdvance).toHaveBeenCalledWith(false);
  expect(mockNext).not.toHaveBeenCalled();
});

it("starts the receiver when a paused cast is resumed", () => {
  const castPlay = jest.fn(async () => {});
  mockCastState = {
    ...idleCast(),
    casting: true,
    target: { id: "tv", name: "Living Room" },
    playing: false,
    play: castPlay,
  };
  const { getByTestId } = render(<MiniPlayer />, { wrapper: wrap });

  expect(getByTestId("mini-player-play").props.accessibilityLabel).toBe("Play");
  fireEvent.press(getByTestId("mini-player-play"));
  expect(castPlay).toHaveBeenCalledTimes(1);
  expect(mockToggle).not.toHaveBeenCalled();
});

it("keeps the local transport while not casting", () => {
  const castPause = jest.fn(async () => {});
  const castAdvance = jest.fn(async () => {});
  mockCastState = {
    ...idleCast(),
    playing: true,
    pause: castPause,
    advance: castAdvance,
  };
  const { getByTestId } = render(<MiniPlayer />, { wrapper: wrap });

  fireEvent.press(getByTestId("mini-player-play"));
  expect(mockToggle).toHaveBeenCalledTimes(1);
  expect(castPause).not.toHaveBeenCalled();

  fireEvent.press(getByTestId("mini-player-next"));
  expect(mockNext).toHaveBeenCalledTimes(1);
  expect(castAdvance).not.toHaveBeenCalled();
});

it("paints the current track's title and artwork", () => {
  mockState = {
    current: { id: "abc12345678", title: "Song", artist: "Artist", artworkUrl: "https://img/x.jpg", explicit: false },
    playing: false,
  };
  const { getByText, getByTestId } = render(<MiniPlayer />, { wrapper: wrap });
  expect(getByText("Song")).toBeTruthy();
  expect(getByTestId("mini-player-art")).toBeTruthy();
});

it("shows a neutral placeholder for a track the viewer may not see", () => {
  mockState = {
    current: { id: "exp11111111", title: "Bad Song", artist: "Artist", artworkUrl: "https://img/bad.jpg", explicit: true },
    playing: false,
  };
  mockPolicy = { isParent: false, filterOn: true, denied: [] };
  const { getByTestId, queryByText, queryByTestId } = render(<MiniPlayer />, { wrapper: wrap });
  // The bar keeps its place on the wall, but it never paints what the
  // viewer may not see: no title, no artwork.
  expect(getByTestId("mini-player")).toBeTruthy();
  expect(queryByText("Bad Song")).toBeNull();
  expect(queryByTestId("mini-player-art")).toBeNull();
  expect(getByTestId("mini-player-title").props.children).toBe("Nothing playing");
});

it("a parent still sees the track", () => {
  mockState = {
    current: { id: "exp11111111", title: "Bad Song", artist: "Artist", artworkUrl: null, explicit: true },
    playing: false,
  };
  mockPolicy = { isParent: true, filterOn: true, denied: [] };
  const { getByText } = render(<MiniPlayer />, { wrapper: wrap });
  expect(getByText("Bad Song")).toBeTruthy();
});

it("disables the transport for a track the viewer may not see", () => {
  // Symmetry with the wall card: the bar never PAINTS what the viewer may
  // not see, and it never PLAYS it either — the transport is disabled.
  mockState = {
    current: { id: "exp11111111", title: "Bad Song", artist: "Artist", artworkUrl: null, explicit: true },
    playing: false,
  };
  mockPolicy = { isParent: false, filterOn: true, denied: [] };
  const { getByTestId } = render(<MiniPlayer />, { wrapper: wrap });
  expect(getByTestId("mini-player-play").props.accessibilityState?.disabled).toBe(true);
  expect(getByTestId("mini-player-next").props.accessibilityState?.disabled).toBe(true);
});

it("keeps the transport live for a track the viewer may see", () => {
  const { getByTestId } = render(<MiniPlayer />, { wrapper: wrap });
  expect(getByTestId("mini-player-play").props.accessibilityState?.disabled).toBe(false);
  expect(getByTestId("mini-player-next").props.accessibilityState?.disabled).toBe(false);
});

it("shows no title for a denied track (kid)", () => {
  // The badge did not catch this one: it says "not marked explicit", so only
  // the family's own deny-list keeps it away from a kid.
  mockState = {
    current: { id: "den11111111", title: "Till I Collapse", artist: "Eminem", artworkUrl: "https://img/eminem.jpg", explicit: false },
    playing: false,
  };
  mockPolicy = { isParent: false, filterOn: true, denied: ["eminem"] };
  const { getByTestId, queryByText, queryByTestId } = render(<MiniPlayer />, { wrapper: wrap });
  // The bar keeps its place on the wall, but it never paints what the
  // viewer may not see: no title, no artwork.
  expect(getByTestId("mini-player")).toBeTruthy();
  expect(queryByText("Till I Collapse")).toBeNull();
  expect(queryByText("Eminem")).toBeNull();
  expect(queryByTestId("mini-player-art")).toBeNull();
  expect(getByTestId("mini-player-title").props.children).toBe("Nothing playing");
  // And it never PLAYS it either.
  expect(getByTestId("mini-player-play").props.accessibilityState?.disabled).toBe(true);
  expect(getByTestId("mini-player-next").props.accessibilityState?.disabled).toBe(true);
});

it("a parent still sees a denied track on the bar", () => {
  mockState = {
    current: { id: "den11111111", title: "Till I Collapse", artist: "Eminem", artworkUrl: null, explicit: false },
    playing: false,
  };
  mockPolicy = { isParent: true, filterOn: true, denied: ["eminem"] };
  const { getByText } = render(<MiniPlayer />, { wrapper: wrap });
  expect(getByText("Till I Collapse")).toBeTruthy();
});

it("the deny rule holds even with the explicit filter off", () => {
  mockState = {
    current: { id: "den11111111", title: "Till I Collapse", artist: "Eminem", artworkUrl: null, explicit: false },
    playing: false,
  };
  mockPolicy = { isParent: false, filterOn: false, denied: ["eminem"] };
  const { getByTestId, queryByText } = render(<MiniPlayer />, { wrapper: wrap });
  expect(queryByText("Till I Collapse")).toBeNull();
  expect(getByTestId("mini-player-title").props.children).toBe("Nothing playing");
});

/**
 * THE CAPSULE (SP2 Task 6) — the bar above the dock, on the Liquid palette.
 *
 * The bar is a music surface like every other one: it reads the music tokens
 * (the panel fill, the panel rim, the label tiers) and it keeps its geometry
 * contract — the artwork leads at 48dp, the transport is thumb-sized.
 */
describe("the MiniPlayer capsule", () => {
  const styleOf = (node: any) => StyleSheet.flatten(node.props.style) as Record<string, any>;

  it("is a floating GLASS pill — the dense glass fill, the glass rim, the pill radius", () => {
    const { getByTestId } = render(<MiniPlayer />, { wrapper: wrap });
    const { theme, boost } = resolved();
    const tokens = musicTokensFor(theme, boost);
    const style = styleOf(getByTestId("mini-player-capsule"));
    // The pill carries the transport glyphs over content whose colour is
    // unknown, so it wears the DENSE glass (opaque on purpose) and the glass
    // hairline, with a soft shadow so it reads as raised above the page.
    expect(style.backgroundColor).toBe(tokens.glassStrong);
    expect(style.borderColor).toBe(tokens.glassRim);
    expect(style.borderWidth).toBe(1);
    expect(style.borderRadius).toBe(9999);
    expect(style.shadowColor).toBe(tokens.shadow);
  });

  it("floats above the dock — absorbed by the page, never overlapping it", () => {
    const { getByTestId } = render(<MiniPlayer />, { wrapper: wrap });
    const float = styleOf(getByTestId("mini-player-floating"));
    expect(float.position).toBe("absolute");
    // The floating layer clears the dock's top edge (no overlap).
    expect(float.bottom).toBeGreaterThanOrEqual(DOCK_TOP_OFFSET);
  });

  it("the artwork leads at 48dp on the Liquid radius", () => {
    const { getByTestId } = render(<MiniPlayer />, { wrapper: wrap });
    const { theme, boost } = resolved();
    const tokens = musicTokensFor(theme, boost);
    const style = styleOf(getByTestId("mini-player-art-tile"));
    expect(style.width).toBe(48);
    expect(style.height).toBe(48);
    expect(style.borderRadius).toBe(tokens.artworkRadius);
  });

  it("the title and the artist read the music tiers", () => {
    const { getByTestId } = render(<MiniPlayer />, { wrapper: wrap });
    const { theme, boost } = resolved();
    const tokens = musicTokensFor(theme, boost);
    expect(styleOf(getByTestId("mini-player-title")).color).toBe(tokens.label);
    expect(styleOf(getByTestId("mini-player-artist")).color).toBe(tokens.label3);
  });

  it("the transport is thumb-sized — play/pause and next are at least 64dp", () => {
    const { getByTestId } = render(<MiniPlayer />, { wrapper: wrap });
    for (const id of ["mini-player-play", "mini-player-next"]) {
      const style = styleOf(getByTestId(id));
      expect(style.width).toBeGreaterThanOrEqual(64);
      expect(style.height).toBeGreaterThanOrEqual(64);
    }
  });

  it("keeps its testIDs and its a11y labels", () => {
    const { getByTestId } = render(<MiniPlayer />, { wrapper: wrap });
    expect(getByTestId("mini-player")).toBeTruthy();
    expect(getByTestId("mini-player-play").props.accessibilityLabel).toBe("Play");
    expect(getByTestId("mini-player-next").props.accessibilityLabel).toBe("Next track");
  });
});

/**
 * THE NEUTRAL STATE — a track the viewer may not see keeps the bar's place
 * and says the neutral truth: no title, no artist, no artwork, and a
 * disabled transport.
 */
describe("the MiniPlayer's neutral state", () => {
  it("says the neutral truth for a hidden track — and paints none of it", () => {
    mockState = {
      current: { id: "exp11111111", title: "Bad Song", artist: "Artist", artworkUrl: "https://img/bad.jpg", explicit: true },
      playing: false,
    };
    mockPolicy = { isParent: false, filterOn: true, denied: [] };
    const { getByTestId, queryByText, queryByTestId } = render(<MiniPlayer />, { wrapper: wrap });
    expect(getByTestId("mini-player")).toBeTruthy();
    expect(getByTestId("mini-player-capsule")).toBeTruthy();
    expect(queryByText("Bad Song")).toBeNull();
    expect(queryByText("Artist")).toBeNull();
    expect(queryByTestId("mini-player-art")).toBeNull();
    expect(getByTestId("mini-player-title").props.children).toBe("Nothing playing");
    expect(getByTestId("mini-player-artist").props.children).toBe("Search YouTube Music from the player");
    // And it never PLAYS it either.
    expect(getByTestId("mini-player-play").props.accessibilityState?.disabled).toBe(true);
    expect(getByTestId("mini-player-next").props.accessibilityState?.disabled).toBe(true);
  });
});
