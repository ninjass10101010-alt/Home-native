/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factory uses synchronous require */
import React from "react";
import { StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { MusicPlayer } from "../src/music/MusicPlayer";
import { clearRecentSearches, loadRecentSearches, saveRecentSearch } from "../src/music/suggestions";
import type { FamilyPlaylist, MediaTrack } from "../src/music/types";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const TRACK_A: MediaTrack = {
  id: "trackA",
  title: "Bidi Bidi Bom Bom",
  artist: "Selena",
  album: "Amor Prohibido",
  durationSeconds: 210,
  artworkUrl: "https://lh3.googleusercontent.com/selena=w120-h120",
  explicit: false,
  source: "youtube_music",
};

const DOWNLOAD_ENTRY = {
  id: "dlA",
  title: "Offline Track",
  artist: "Los Ángeles Azules",
  album: "Cumbia",
  durationSeconds: 180,
  artworkUrl: null,
  explicit: false,
  fileUri: "file:///offline.m4a",
  bytes: 4 * 1024 * 1024,
  savedAt: 100,
};

let mockCurrent: MediaTrack | null = TRACK_A;
let mockDownloads: (typeof DOWNLOAD_ENTRY)[] = [];
let mockLiked: MediaTrack[] = [];
let mockPlaylists: FamilyPlaylist[] = [];
const mockPlay = jest.fn(async () => {});
const mockToggle = jest.fn();
const mockNext = jest.fn(async () => {});
const mockToggleLike = jest.fn();
const mockSetSleepTimer = jest.fn();
const mockCreatePlaylist = jest.fn();
const mockAddTrackToPlaylist = jest.fn();

jest.mock("../src/music/playback", () => ({
  usePlayback: () => ({
    current: mockCurrent,
    queue: mockCurrent ? [mockCurrent] : [],
    index: mockCurrent ? 0 : -1,
    playing: true,
    position: 35,
    duration: 210,
    buffering: false,
    repeat: "off",
    shuffle: false,
    error: null,
    downloads: mockDownloads,
    downloadBytes: 0,
    history: [TRACK_A],
    settings: { repeat: "off", shuffle: false, explicitFilter: true },
    denylist: [],
    policy: { isParent: true, filterOn: true, denied: [] },
    streamFormat: null,
    player: { volume: 0.7 },
    likedTracks: mockLiked,
    playlists: mockPlaylists,
    sleepTimerEndsAt: null,
    play: mockPlay,
    playQueueAt: jest.fn(),
    toggle: mockToggle,
    next: mockNext,
    previous: jest.fn(),
    seek: jest.fn(),
    cycleRepeatMode: jest.fn(),
    toggleShuffleMode: jest.fn(),
    addToQueue: jest.fn(),
    playNext: jest.fn(),
    clearQueue: jest.fn(),
    setSleepTimer: mockSetSleepTimer,
    isLiked: (id: string) => mockLiked.some((t) => t.id === id),
    toggleLike: mockToggleLike,
    createPlaylist: mockCreatePlaylist,
    deletePlaylist: jest.fn(),
    addTrackToPlaylist: mockAddTrackToPlaylist,
    removeTrackFromPlaylist: jest.fn(),
    removeFromQueue: jest.fn(),
    moveQueueItem: jest.fn(),
    downloadCurrent: jest.fn(),
    removeDownload: jest.fn(),
    addDenied: jest.fn(),
    removeDenied: jest.fn(),
    stopAndClear: jest.fn(),
  }),
}));

jest.mock("../src/music/CastProvider", () => ({
  useCast: () => ({
    state: "notConnected",
    casting: false,
    target: null,
    devices: [{ id: "sp1", name: "Kitchen speaker" }],
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
  }),
}));

jest.mock("../modules/youtube-engine", () => ({
  search: jest.fn().mockResolvedValue({ tracks: [], explicitKnown: true }),
  related: jest.fn().mockResolvedValue([]),
  artworkColors: jest.fn().mockResolvedValue({ dominant: "#0E7490", vibrant: null }),
  artworkBlurred: jest.fn().mockResolvedValue("file:///blur.jpg"),
}));

const wrap = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

describe("Warm Glass v2 Music overhaul", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    await clearRecentSearches();
    jest.clearAllMocks();
    mockCurrent = TRACK_A;
    mockDownloads = [];
    mockLiked = [];
    mockPlaylists = [];
  });

  it("saveRecentSearch strips partial prefix typos when full query is submitted", async () => {
    await saveRecentSearch("Alejandr");
    await saveRecentSearch("Vicente");
    const updated = await saveRecentSearch("Alejandro Fernández");
    expect(updated).toEqual(["Alejandro Fernández", "Vicente"]);
    expect(await loadRecentSearches()).toEqual(["Alejandro Fernández", "Vicente"]);
  });

  it("removes the wasted Sign-in-to-play hero card and exposes Cast in the idle browse header", async () => {
    mockCurrent = null;
    const { getByTestId, queryByText } = render(<MusicPlayer />, { wrapper: wrap });
    await waitFor(() => expect(getByTestId("music-stations-shelf")).toBeTruthy());

    expect(queryByText("Millions of songs, no ads. Sign in to play.")).toBeNull();
    expect(getByTestId("cast-open")).toBeTruthy();
  });

  it("filters Browse Stations & Moods by category chip and restores all", async () => {
    mockCurrent = null;
    const { getByTestId, queryByTestId } = render(<MusicPlayer />, { wrapper: wrap });
    await waitFor(() => expect(getByTestId("music-station-reggaeton-fuego")).toBeTruthy());

    fireEvent.press(getByTestId("music-station-filter-family"));
    expect(getByTestId("music-station-family-singalong")).toBeTruthy();
    expect(queryByTestId("music-station-reggaeton-fuego")).toBeNull();

    fireEvent.press(getByTestId("music-station-filter-all"));
    expect(getByTestId("music-station-reggaeton-fuego")).toBeTruthy();
  });

  it("centers the album artwork container on the Now Playing stage", async () => {
    const { getByTestId } = render(<MusicPlayer />, { wrapper: wrap });
    await waitFor(() => expect(getByTestId("np-artwork-frame")).toBeTruthy());
    expect(StyleSheet.flatten(getByTestId("np-artwork-frame").props.style).alignSelf).toBe("center");
  });

  it("renders StageMiniBar in Lyrics, Queue, and Library modes and returns to stage on tap", async () => {
    const { getByTestId, getByText, queryByTestId } = render(<MusicPlayer />, { wrapper: wrap });
    await waitFor(() => expect(getByTestId("np-stage")).toBeTruthy());
    expect(queryByTestId("music-stage-minibar")).toBeNull();

    fireEvent.press(getByText("Lyrics"));
    expect(getByTestId("music-stage-minibar")).toBeTruthy();
    fireEvent.press(getByTestId("music-stage-minibar-play"));
    expect(mockToggle).toHaveBeenCalledTimes(1);

    fireEvent.press(getByText("Queue"));
    expect(getByTestId("music-stage-minibar")).toBeTruthy();

    fireEvent.press(getByText("Library"));
    expect(getByTestId("music-stage-minibar")).toBeTruthy();

    fireEvent.press(getByTestId("music-stage-minibar-open"));
    expect(getByTestId("np-stage")).toBeTruthy();
  });

  it("toggles Like Track, Sleep Timer presets, and Add to Playlist from Now Playing", async () => {
    mockPlaylists = [
      { id: "pl1", name: "Fiesta", emoji: "🎉", tracks: [], createdAt: 1, updatedAt: 1 },
    ];
    const { getByTestId } = render(<MusicPlayer />, { wrapper: wrap });
    await waitFor(() => expect(getByTestId("np-like-track")).toBeTruthy());

    fireEvent.press(getByTestId("np-like-track"));
    expect(mockToggleLike).toHaveBeenCalledWith(TRACK_A);

    fireEvent.press(getByTestId("np-sleep-timer"));
    expect(getByTestId("music-sleep-modal")).toBeTruthy();
    fireEvent.press(getByTestId("music-sleep-opt-15"));
    expect(mockSetSleepTimer).toHaveBeenCalledWith(15);

    fireEvent.press(getByTestId("np-add-to-playlist"));
    expect(getByTestId("music-add-playlist-modal")).toBeTruthy();
    fireEvent.press(getByTestId("music-add-to-playlist-pl1"));
    expect(mockAddTrackToPlaylist).toHaveBeenCalledWith("pl1", TRACK_A);
  });

  it("opens Create Playlist modal from Family Mixes and avoids duplicate Downloads tray in Library mode", async () => {
    mockDownloads = [DOWNLOAD_ENTRY];
    const { getByTestId, getByText, getAllByTestId } = render(<MusicPlayer />, { wrapper: wrap });
    await waitFor(() => expect(getByTestId("music-mode")).toBeTruthy());

    fireEvent.press(getByText("Library"));
    expect(getAllByTestId("music-downloads")).toHaveLength(1);

    fireEvent.press(getByTestId("music-create-playlist-open"));
    expect(getByTestId("music-create-playlist-modal")).toBeTruthy();
    fireEvent.changeText(getByTestId("music-playlist-name-input"), "Sunday Cleaning");
    fireEvent.press(getByTestId("music-playlist-create-submit"));
    expect(mockCreatePlaylist).toHaveBeenCalledWith("Sunday Cleaning", "🎵", []);
  });
});
