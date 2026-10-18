jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
const mockToggle = jest.fn();
const mockNext = jest.fn();
const mockPush = jest.fn();
let mockState = {
  current: null as null | { title: string; artist: string; artworkUrl: string | null },
  playing: false,
};
jest.mock("../src/music/playback", () => ({
  usePlayback: () => ({ ...mockState, toggle: mockToggle, next: mockNext }),
}));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));

import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { MusicWidget } from "../src/home/widgets/MusicWidget";
import { ThemeProvider } from "../src/theme/ThemeProvider";

const wrap = ({ children }: { children: React.ReactNode }) => <ThemeProvider>{children}</ThemeProvider>;

beforeEach(() => {
  mockState = { current: null, playing: false };
  jest.clearAllMocks();
});

it("shows the idle state and opens the player", () => {
  const { getByTestId } = render(<MusicWidget />, { wrapper: wrap });
  expect(getByTestId("music-widget-title").props.children).toBe("Nothing playing");
  fireEvent.press(getByTestId("music-widget-open"));
  expect(mockPush).toHaveBeenCalledWith("/music");
});

it("shows the current track and toggles playback", () => {
  mockState = { current: { title: "Song", artist: "Artist", artworkUrl: null }, playing: false };
  const { getByTestId } = render(<MusicWidget />, { wrapper: wrap });
  expect(getByTestId("music-widget-title").props.children).toBe("Song");
  fireEvent.press(getByTestId("music-widget-play"));
  expect(mockToggle).toHaveBeenCalled();
});
