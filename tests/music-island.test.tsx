import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { MusicIsland } from "../src/music/MusicIsland";
import { usePlayback } from "../src/music/playback";
import { useCast } from "../src/music/CastProvider";
import { usePathname, useRouter } from "expo-router";
import { useTheme } from "../src/theme/ThemeProvider";
import { useOutputVolume } from "../src/music/output-volume";

jest.mock("../src/music/playback");
jest.mock("../src/music/CastProvider");
jest.mock("../src/music/output-volume");
jest.mock("expo-router", () => ({
  usePathname: jest.fn(() => "/"),
  useRouter: jest.fn(() => ({ push: jest.fn() })),
}));
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
    (useOutputVolume as jest.Mock).mockReturnValue({
      value: 0.5,
      muted: false,
      setValue: jest.fn(),
      nudge: jest.fn(),
      toggleMute: jest.fn(),
      target: "local",
    });
    (useRouter as jest.Mock).mockReturnValue({ push: jest.fn() });
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

  it("prev/play/next buttons drive playback", () => {
    const mockToggle = jest.fn();
    const mockNext = jest.fn();
    const mockPrevious = jest.fn();

    (usePlayback as jest.Mock).mockReturnValue({
      current: mockTrack,
      playing: false,
      toggle: mockToggle,
      next: mockNext,
      previous: mockPrevious,
    });

    const { getByTestId } = render(<MusicIsland />);

    fireEvent.press(getByTestId("music-island-collapsed"));

    fireEvent.press(getByTestId("music-island-prev"));
    expect(mockPrevious).toHaveBeenCalled();

    fireEvent.press(getByTestId("music-island-play"));
    expect(mockToggle).toHaveBeenCalled();

    fireEvent.press(getByTestId("music-island-next"));
    expect(mockNext).toHaveBeenCalled();
  });

  it("tap art navigates to music screen", () => {
    const mockPush = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
    (usePlayback as jest.Mock).mockReturnValue({ current: mockTrack });

    const { getByTestId } = render(<MusicIsland />);

    fireEvent.press(getByTestId("music-island-collapsed"));
    fireEvent.press(getByTestId("music-island-art-expanded"));

    expect(mockPush).toHaveBeenCalledWith("/music");
  });

  it("stop arms on first tap, clears on second", async () => {
    jest.useFakeTimers();
    const mockStopAndClear = jest.fn();
    (usePlayback as jest.Mock).mockReturnValue({
      current: mockTrack,
      stopAndClear: mockStopAndClear,
    });

    const { getByTestId, getByText } = render(<MusicIsland />);

    fireEvent.press(getByTestId("music-island-collapsed"));

    expect(getByText("Stop")).toBeTruthy();

    const stopButton = getByTestId("music-island-stop");
    fireEvent.press(stopButton);
    expect(getByText("Confirm")).toBeTruthy();
    expect(mockStopAndClear).not.toHaveBeenCalled();

    fireEvent.press(stopButton);
    expect(mockStopAndClear).toHaveBeenCalled();

    jest.useRealTimers();
  });

  it("stop arm resets after 5s", async () => {
    jest.useFakeTimers();
    (usePlayback as jest.Mock).mockReturnValue({
      current: mockTrack,
      stopAndClear: jest.fn(),
    });

    const { getByTestId, getByText } = render(<MusicIsland />);

    fireEvent.press(getByTestId("music-island-collapsed"));

    const stopButton = getByTestId("music-island-stop");
    fireEvent.press(stopButton);
    expect(getByText("Confirm")).toBeTruthy();

    jest.advanceTimersByTime(5000);

    await waitFor(() => {
      expect(getByText("Stop")).toBeTruthy();
    });

    jest.useRealTimers();
  });
});
