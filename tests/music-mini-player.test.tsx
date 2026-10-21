jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
const mockToggle = jest.fn();
/** The track the provider is on (null = nothing playing). */
let mockState: any = {
  current: { id: "abc12345678", title: "Song", artist: "Artist", artworkUrl: null, explicit: false },
  playing: false,
};
/** The role-aware explicit policy the viewer is under. */
let mockPolicy: any = { isParent: false, filterOn: true };
jest.mock("../src/music/playback", () => ({
  usePlayback: () => ({ ...mockState, policy: mockPolicy, toggle: mockToggle, next: jest.fn() }),
}));
let mockPath = "/";
jest.mock("expo-router", () => ({ usePathname: () => mockPath, useRouter: () => ({ push: jest.fn() }) }));

import React from "react";
import { render } from "@testing-library/react-native";
import { MiniPlayer } from "../src/music/MiniPlayer";
import { ThemeProvider } from "../src/theme/ThemeProvider";

const wrap = ({ children }: { children: React.ReactNode }) => <ThemeProvider>{children}</ThemeProvider>;

beforeEach(() => {
  mockPath = "/";
  mockState = {
    current: { id: "abc12345678", title: "Song", artist: "Artist", artworkUrl: null, explicit: false },
    playing: false,
  };
  mockPolicy = { isParent: false, filterOn: true };
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
  mockPolicy = { isParent: false, filterOn: true };
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
  mockPolicy = { isParent: true, filterOn: true };
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
  mockPolicy = { isParent: false, filterOn: true };
  const { getByTestId } = render(<MiniPlayer />, { wrapper: wrap });
  expect(getByTestId("mini-player-play").props.accessibilityState?.disabled).toBe(true);
  expect(getByTestId("mini-player-next").props.accessibilityState?.disabled).toBe(true);
});

it("keeps the transport live for a track the viewer may see", () => {
  const { getByTestId } = render(<MiniPlayer />, { wrapper: wrap });
  expect(getByTestId("mini-player-play").props.accessibilityState?.disabled).toBe(false);
  expect(getByTestId("mini-player-next").props.accessibilityState?.disabled).toBe(false);
});
