import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { MusicIsland } from "../src/music/MusicIsland";
import { usePlayback } from "../src/music/playback";
import { useCast } from "../src/music/CastProvider";
import { usePathname } from "expo-router";
import { useTheme } from "../src/theme/ThemeProvider";

jest.mock("../src/music/playback");
jest.mock("../src/music/CastProvider");
jest.mock("expo-router");
jest.mock("../src/theme/ThemeProvider");
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const mockTrack = {
  id: "track1",
  title: "Test Song",
  artist: "Test Artist",
  artworkUrl: "https://example.com/art.jpg",
};

describe("MusicIsland", () => {
  beforeEach(() => {
    (usePlayback as jest.Mock).mockReturnValue({
      current: null,
      playing: false,
      position: 0,
      duration: 0,
    });
    (useCast as jest.Mock).mockReturnValue({ casting: false });
    (usePathname as jest.Mock).mockReturnValue("/");
    (useTheme as jest.Mock).mockReturnValue({ theme: "dark", boost: false, reduceMotion: false });
  });

  it("renders null when no current track", () => {
    const { queryByTestId } = render(<MusicIsland />);
    expect(queryByTestId("music-island")).toBeNull();
  });

  it("hides on /music and /screensaver", () => {
    (usePlayback as jest.Mock).mockReturnValue({ current: mockTrack });

    (usePathname as jest.Mock).mockReturnValue("/music");
    const { queryByTestId: query1 } = render(<MusicIsland />);
    expect(query1("music-island")).toBeNull();

    (usePathname as jest.Mock).mockReturnValue("/screensaver");
    const { queryByTestId: query2 } = render(<MusicIsland />);
    expect(query2("music-island")).toBeNull();
  });

  it("renders collapsed with art, title, and progress", () => {
    (usePlayback as jest.Mock).mockReturnValue({
      current: mockTrack,
      position: 30000,
      duration: 180000,
    });

    const { getByTestId } = render(<MusicIsland />);

    expect(getByTestId("music-island")).toBeTruthy();
    expect(getByTestId("music-island-collapsed")).toBeTruthy();
    expect(getByTestId("music-island-art")).toBeTruthy();
    expect(getByTestId("music-island-title").props.children).toBe("Test Song");
    expect(getByTestId("music-island-progress")).toBeTruthy();
  });

  it("expands on tap", () => {
    (usePlayback as jest.Mock).mockReturnValue({ current: mockTrack });

    const { getByTestId, queryByTestId } = render(<MusicIsland />);

    expect(queryByTestId("music-island-expanded")).toBeNull();

    fireEvent.press(getByTestId("music-island-collapsed"));

    expect(getByTestId("music-island-expanded")).toBeTruthy();
  });

  it("auto-collapses after 5 seconds", async () => {
    jest.useFakeTimers();
    (usePlayback as jest.Mock).mockReturnValue({ current: mockTrack });

    const { getByTestId, queryByTestId } = render(<MusicIsland />);

    fireEvent.press(getByTestId("music-island-collapsed"));
    expect(getByTestId("music-island-expanded")).toBeTruthy();

    jest.advanceTimersByTime(5000);

    await waitFor(() => {
      expect(queryByTestId("music-island-expanded")).toBeNull();
    });

    jest.useRealTimers();
  });

  it("collapses on tap outside", () => {
    (usePlayback as jest.Mock).mockReturnValue({ current: mockTrack });

    const { getByTestId, queryByTestId } = render(<MusicIsland />);

    fireEvent.press(getByTestId("music-island-collapsed"));
    expect(getByTestId("music-island-expanded")).toBeTruthy();

    fireEvent.press(getByTestId("music-island-backdrop"));

    expect(queryByTestId("music-island-expanded")).toBeNull();
  });

  it("shows cast indicator when casting", () => {
    (usePlayback as jest.Mock).mockReturnValue({ current: mockTrack });
    (useCast as jest.Mock).mockReturnValue({ casting: true });

    const { getByTestId } = render(<MusicIsland />);

    expect(getByTestId("music-island-cast")).toBeTruthy();
  });
});
