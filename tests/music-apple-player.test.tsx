import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { MusicPlayer } from "../src/music/MusicPlayer";
import type { MediaTrack } from "../src/music/types";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const MOCK_TRACK: MediaTrack = {
  id: "track123456",
  title: "Cruel Summer",
  artist: "Taylor Swift",
  album: "Lover",
  durationSeconds: 178,
  artworkUrl: "https://lh3.googleusercontent.com/test=w120-h120-l90-rj",
  explicit: false,
  source: "youtube_music",
};

let mockCurrent: MediaTrack | null = MOCK_TRACK;
let mockPlay = jest.fn();
let mockSearch = jest.fn();

jest.mock("../src/music/playback", () => ({
  usePlayback: () => ({
    current: mockCurrent,
    queue: [MOCK_TRACK],
    index: 0,
    playing: true,
    position: 45,
    duration: 178,
    buffering: false,
    repeat: "off",
    shuffle: false,
    error: null,
    downloads: [],
    downloadBytes: 0,
    history: [MOCK_TRACK],
    settings: { repeat: "off", shuffle: false, explicitFilter: true },
    denylist: [],
    policy: { isParent: true, explicitFilter: true, denied: [] },
    streamFormat: null,
    player: { volume: 0.8 },
    play: mockPlay,
    playQueueAt: jest.fn(),
    toggle: jest.fn(),
    next: jest.fn(),
    previous: jest.fn(),
    seek: jest.fn(),
    cycleRepeatMode: jest.fn(),
    toggleShuffleMode: jest.fn(),
    addToQueue: jest.fn(),
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
    casting: false,
    target: null,
    devices: [],
    discovering: false,
    playing: false,
    position: 0,
    duration: 0,
    error: null,
    busy: false,
    connect: jest.fn(),
    disconnect: jest.fn(),
    play: jest.fn(),
    pause: jest.fn(),
    seek: jest.fn(),
    advance: jest.fn(),
    previous: jest.fn(),
  }),
}));

jest.mock("../src/state/AuthProvider", () => ({
  useAuth: () => ({ role: "parent", member: { name: "Dad" }, hydrated: true, poke: jest.fn() }),
}));

jest.mock("../modules/youtube-engine", () => ({
  search: (...args: any[]) => mockSearch(...args),
  artworkColors: jest.fn().mockResolvedValue({ dominant: "#E11D48", vibrant: null }),
  artworkBlurred: jest.fn().mockResolvedValue("file:///cache/blur.jpg"),
}));

const wrap = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

describe("Apple Music Player enhancements", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrent = MOCK_TRACK;
  });

  it("renders Apple Music Favorite Star toggle on the Now Playing stage", async () => {
    const { getByTestId } = render(<MusicPlayer />, { wrapper: wrap });
    await waitFor(() => expect(getByTestId("music-favorite-artist")).toBeTruthy());

    const starBtn = getByTestId("music-favorite-artist");
    expect(starBtn.props.accessibilityLabel).toContain("Taylor Swift");

    // Toggle star on
    fireEvent.press(starBtn);
    await waitFor(() => {
      expect(getByTestId("music-favorite-artist")).toBeTruthy();
    });
  });

  it("renders Apple Music bottom utility actions (lyrics and queue shortcuts)", async () => {
    const { getByTestId, queryByTestId } = render(<MusicPlayer />, { wrapper: wrap });
    await waitFor(() => expect(getByTestId("np-open-lyrics")).toBeTruthy());
    expect(getByTestId("np-open-queue")).toBeTruthy();

    // Tapping lyrics button switches view away from stage to lyrics
    fireEvent.press(getByTestId("np-open-lyrics"));
    expect(queryByTestId("np-stage")).toBeNull();
  });

  it("switches to Library mode and displays Favorite and Recommended Artists shelves", async () => {
    const { getByTestId, getByText } = render(<MusicPlayer />, { wrapper: wrap });
    await waitFor(() => expect(getByTestId("music-mode")).toBeTruthy());

    // Switch to Library
    fireEvent.press(getByText("Library"));

    await waitFor(() => {
      expect(getByTestId("music-favorite-artists-shelf")).toBeTruthy();
      expect(getByTestId("music-recommended-artists-shelf")).toBeTruthy();
    });
  });

  it("displays Favorite and Recommended shelves when idle (no track playing)", async () => {
    mockCurrent = null;
    const { getByTestId } = render(<MusicPlayer />, { wrapper: wrap });

    await waitFor(() => {
      expect(getByTestId("music-favorite-artists-shelf")).toBeTruthy();
      expect(getByTestId("music-recommended-artists-shelf")).toBeTruthy();
    });
  });
});
