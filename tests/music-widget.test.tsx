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
import { fireEvent, render } from "@testing-library/react-native";
import { MusicWidget } from "../src/home/widgets/MusicWidget";
import { ThemeProvider } from "../src/theme/ThemeProvider";

const wrap = ({ children }: { children: React.ReactNode }) => <ThemeProvider>{children}</ThemeProvider>;

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
