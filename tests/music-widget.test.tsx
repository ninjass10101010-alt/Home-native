/* eslint-disable @typescript-eslint/no-require-imports, import/first -- jest.mock factories run before the imports */
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
const mockToggle = jest.fn();
const mockNext = jest.fn();
const mockPush = jest.fn();
let mockState = {
  current: null as null | { id: string; title: string; artist: string; artworkUrl: string | null; explicit: boolean | null },
  playing: false,
};
/** The role-aware content policy the viewer is under. */
let mockPolicy: { isParent: boolean; filterOn: boolean; denied: string[] } = { isParent: false, filterOn: true, denied: [] };
jest.mock("../src/music/playback", () => ({
  usePlayback: () => ({ ...mockState, policy: mockPolicy, toggle: mockToggle, next: mockNext }),
}));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));

import React from "react";
import { StyleSheet } from "react-native";
import { fireEvent, render, renderHook } from "@testing-library/react-native";
import { MusicWidget } from "../src/home/widgets/MusicWidget";
import { HEADER_BAND_H } from "../src/home/widgets/WidgetFrame";
import { ThemeProvider, useTheme } from "../src/theme/ThemeProvider";
import { musicTokensFor } from "../src/theme/music-tokens";

const wrap = ({ children }: { children: React.ReactNode }) => <ThemeProvider>{children}</ThemeProvider>;

/** The theme the app resolved — the Liquid palette follows it. */
const resolved = () => renderHook(() => useTheme(), { wrapper: wrap }).result.current;

beforeEach(() => {
  mockState = { current: null, playing: false };
  mockPolicy = { isParent: false, filterOn: true, denied: [] };
  jest.clearAllMocks();
});

it("shows the idle state and opens the player", () => {
  const { getByTestId } = render(<MusicWidget />, { wrapper: wrap });
  expect(getByTestId("music-widget-title").props.children).toBe("Nothing playing");
  fireEvent.press(getByTestId("music-widget-open"));
  expect(mockPush).toHaveBeenCalledWith("/music");
});

it("shows the current track and toggles playback", () => {
  mockState = { current: { id: "abc12345678", title: "Song", artist: "Artist", artworkUrl: null, explicit: false }, playing: false };
  const { getByTestId } = render(<MusicWidget />, { wrapper: wrap });
  expect(getByTestId("music-widget-title").props.children).toBe("Song");
  fireEvent.press(getByTestId("music-widget-play"));
  expect(mockToggle).toHaveBeenCalled();
});

it("shows a neutral placeholder for a track the viewer may not see", () => {
  mockState = {
    current: { id: "exp11111111", title: "Bad Song", artist: "Artist", artworkUrl: "https://img/bad.jpg", explicit: true },
    playing: false,
  };
  mockPolicy = { isParent: false, filterOn: true, denied: [] };
  const { getByTestId, queryByText, queryByTestId } = render(<MusicWidget />, { wrapper: wrap });
  // The card keeps its place on the 12-cell wall, but it never paints what
  // the viewer may not see: no title, no artwork.
  expect(getByTestId("music-widget-title").props.children).toBe("Nothing playing");
  expect(queryByText("Bad Song")).toBeNull();
  expect(queryByTestId("music-widget-art")).toBeNull();
});

it("a parent still sees the track on the wall", () => {
  mockState = {
    current: { id: "exp11111111", title: "Bad Song", artist: "Artist", artworkUrl: null, explicit: true },
    playing: false,
  };
  mockPolicy = { isParent: true, filterOn: true, denied: [] };
  const { getByTestId } = render(<MusicWidget />, { wrapper: wrap });
  expect(getByTestId("music-widget-title").props.children).toBe("Bad Song");
});

it("shows no title for a denied track (kid)", () => {
  // The badge did not catch this one: it says "not marked explicit", so only
  // the family's own deny-list keeps it away from a kid.
  mockState = {
    current: { id: "den11111111", title: "Till I Collapse", artist: "Eminem", artworkUrl: "https://img/eminem.jpg", explicit: false },
    playing: false,
  };
  mockPolicy = { isParent: false, filterOn: true, denied: ["eminem"] };
  const { getByTestId, queryByText, queryByTestId } = render(<MusicWidget />, { wrapper: wrap });
  // The card keeps its place on the 12-cell wall, but it never paints what
  // the viewer may not see: no title, no artwork.
  expect(getByTestId("music-widget-title").props.children).toBe("Nothing playing");
  expect(queryByText("Till I Collapse")).toBeNull();
  expect(queryByText("Eminem")).toBeNull();
  expect(queryByTestId("music-widget-art")).toBeNull();
  // And it never PLAYS it either.
  expect(getByTestId("music-widget-play").props.accessibilityState?.disabled).toBe(true);
  expect(getByTestId("music-widget-next").props.accessibilityState?.disabled).toBe(true);
});

it("a parent still sees a denied track on the wall", () => {
  mockState = {
    current: { id: "den11111111", title: "Till I Collapse", artist: "Eminem", artworkUrl: null, explicit: false },
    playing: false,
  };
  mockPolicy = { isParent: true, filterOn: true, denied: ["eminem"] };
  const { getByTestId } = render(<MusicWidget />, { wrapper: wrap });
  expect(getByTestId("music-widget-title").props.children).toBe("Till I Collapse");
});

it("the deny rule holds even with the explicit filter off", () => {
  mockState = {
    current: { id: "den11111111", title: "Till I Collapse", artist: "Eminem", artworkUrl: null, explicit: false },
    playing: false,
  };
  mockPolicy = { isParent: false, filterOn: false, denied: ["eminem"] };
  const { getByTestId, queryByText } = render(<MusicWidget />, { wrapper: wrap });
  expect(queryByText("Till I Collapse")).toBeNull();
  expect(getByTestId("music-widget-title").props.children).toBe("Nothing playing");
});

/**
 * THE WALL CARD (SP2 Task 6) — the interior is restyled, the GEOMETRY is not.
 *
 * The wall is a fixed 3×4 board and `paint:audit` samples the painted discs
 * on it: the card's identity disc and its header band must NOT move a pixel,
 * or the whole wall's paint gate trips. These tests pin that geometry here,
 * so a future restyle breaks the suite instead of the wall.
 */
describe("the wall card's geometry", () => {
  const styleOf = (node: any) => StyleSheet.flatten(node.props.style) as Record<string, any>;

  it("keeps the identity disc's seat — the painted disc does not move", () => {
    const { getByTestId } = render(<MusicWidget />, { wrapper: wrap });
    // The disc is hidden from the a11y tree (it is decoration), so the
    // query has to ask for it explicitly.
    const style = styleOf(getByTestId("music-icon-disc", { includeHiddenElements: true }));
    // The frame's badge contract: a 64dp box, seated 10dp out of the
    // content origin (the wall's shared disc geometry).
    expect(style.width).toBe(64);
    expect(style.height).toBe(64);
    expect(style.top).toBe(-10);
    expect(style.left).toBe(-10);
  });

  it("keeps the header band at the shared height — the row's rule does not move", () => {
    const { getByTestId } = render(<MusicWidget />, { wrapper: wrap });
    const style = styleOf(getByTestId("music-widget-header"));
    expect(style.minHeight).toBe(HEADER_BAND_H);
  });

  it("the card's own frame is the shared wall frame", () => {
    const { getByTestId } = render(<MusicWidget />, { wrapper: wrap });
    // The frame owns the title band and the content area — the card never
    // re-invents them (that is what keeps the 12 cells on one grid).
    expect(getByTestId("music-widget-open")).toBeTruthy();
    expect(getByTestId("music-widget-art-chip")).toBeTruthy();
  });
});

/**
 * THE INTERIOR — the Liquid palette: the artwork leads, the tint chip is a
 * panel with a panel rim, the labels read the music tiers.
 */
describe("the wall card's interior", () => {
  const styleOf = (node: any) => StyleSheet.flatten(node.props.style) as Record<string, any>;

  it("the artwork leads in a panel chip with a panel rim", () => {
    const { getByTestId } = render(<MusicWidget />, { wrapper: wrap });
    const { theme, boost } = resolved();
    const tokens = musicTokensFor(theme, boost);
    const style = styleOf(getByTestId("music-widget-art-chip"));
    expect(style.backgroundColor).toBe(tokens.panel);
    expect(style.borderColor).toBe(tokens.panelRim);
    expect(style.borderWidth).toBe(1);
    expect(style.borderRadius).toBe(tokens.artworkRadius);
  });

  it("the labels read the music tiers", () => {
    const { getByTestId } = render(<MusicWidget />, { wrapper: wrap });
    const { theme, boost } = resolved();
    const tokens = musicTokensFor(theme, boost);
    expect(styleOf(getByTestId("music-widget-title")).color).toBe(tokens.label);
    expect(styleOf(getByTestId("music-widget-artist")).color).toBe(tokens.label3);
  });

  it("the transport keeps its a11y labels", () => {
    const { getByTestId } = render(<MusicWidget />, { wrapper: wrap });
    expect(getByTestId("music-widget-play").props.accessibilityLabel).toBe("Play");
    expect(getByTestId("music-widget-next").props.accessibilityLabel).toBe("Next track");
    expect(getByTestId("music-widget-open").props.accessibilityLabel).toBe("Open music");
  });
});

/**
 * THE NEUTRAL STATE — a track the viewer may not see keeps the card's place
 * on the 12-cell wall and says the neutral truth instead: no title, no
 * artist, no artwork, and a disabled transport.
 */
describe("the wall card's neutral state", () => {
  it("says the neutral truth for a hidden track — and paints none of it", () => {
    mockState = {
      current: { id: "exp11111111", title: "Bad Song", artist: "Artist", artworkUrl: "https://img/bad.jpg", explicit: true },
      playing: false,
    };
    mockPolicy = { isParent: false, filterOn: true, denied: [] };
    const { getByTestId, queryByText, queryByTestId } = render(<MusicWidget />, { wrapper: wrap });
    expect(getByTestId("music-widget-title").props.children).toBe("Nothing playing");
    expect(getByTestId("music-widget-artist").props.children).toBe("Search YouTube Music from the player");
    expect(queryByText("Bad Song")).toBeNull();
    expect(queryByText("Artist")).toBeNull();
    expect(queryByTestId("music-widget-art")).toBeNull();
    // And it never PLAYS it either.
    expect(getByTestId("music-widget-play").props.accessibilityState?.disabled).toBe(true);
    expect(getByTestId("music-widget-next").props.accessibilityState?.disabled).toBe(true);
  });
});
