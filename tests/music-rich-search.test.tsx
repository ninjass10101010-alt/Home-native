/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factory uses synchronous require */
import React from "react";
import { Linking } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { MusicPlayer } from "../src/music/MusicPlayer";
import type { ArtistProfile, MediaTrack, MusicCollectionDetail } from "../src/music/types";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const CLEAN_SONG_1: MediaTrack = {
  id: "b393RtiIA18",
  title: "Un Millón de Primaveras",
  artist: "Vicente Fernández",
  album: "",
  durationSeconds: 174,
  artworkUrl: "https://i.ytimg.com/v1.jpg",
  explicit: false,
  source: "youtube_music",
};

const CLEAN_SONG_2: MediaTrack = {
  id: "KYhATSuavAA",
  title: "La Diferencia",
  artist: "Vicente Fernández",
  album: "",
  durationSeconds: 171,
  artworkUrl: "https://i.ytimg.com/v2.jpg",
  explicit: false,
  source: "youtube_music",
};

const EXPLICIT_TRACK: MediaTrack = {
  id: "zlJ0Aj9y67c",
  title: "Lose Yourself",
  artist: "Eminem",
  album: "Curtain Call",
  durationSeconds: 326,
  artworkUrl: null,
  explicit: true,
  source: "youtube_music",
};

const OMV_UNRATED_TRACK: MediaTrack = {
  id: "xFYQQPAOz7Y",
  title: "Unbadged Video Track",
  artist: "Eminem",
  album: "",
  durationSeconds: 328,
  artworkUrl: null,
  explicit: null,
  source: "youtube_music",
};

const ARTIST_PROFILE: ArtistProfile = {
  browseId: "UChYPL8XRXNqerL5hLkd9E9g",
  name: "Vicente Fernández",
  subtitle: "47.4M monthly audience",
  description: "",
  artworkUrl: "https://yt3.googleusercontent.com/vicente",
  topSongs: [CLEAN_SONG_1, CLEAN_SONG_2],
  albums: [
    {
      browseId: "MPREb_ckLfEPIIv5v",
      title: "Por Tu Maldito Amor",
      artist: "Vicente Fernández",
      year: "1990",
      albumType: "Album",
      subtitle: "Album • Vicente Fernández • 1990",
      artworkUrl: "https://yt3.googleusercontent.com/alb1",
      explicit: false,
    },
  ],
  singles: [],
  playlists: [
    {
      browseId: "VLRDCLAK5uy_vicente",
      title: "Presenting Vicente Fernández",
      author: "YouTube Music",
      subtitle: "Playlist • YouTube Music",
      artworkUrl: "https://yt3.googleusercontent.com/pl1",
    },
  ],
  relatedArtists: [
    {
      browseId: "UCWTCgsyubCH0BhjDkVXcpdA",
      name: "Joan Sebastian",
      subtitle: "39.5M monthly audience",
      artworkUrl: null,
    },
  ],
  explicitKnown: true,
};

const ALBUM_DETAIL: MusicCollectionDetail = {
  browseId: "MPREb_ckLfEPIIv5v",
  kind: "album",
  title: "Por Tu Maldito Amor",
  subtitle: "Album • 1990",
  artist: "Vicente Fernández",
  artworkUrl: "https://yt3.googleusercontent.com/alb1",
  tracks: [
    {
      id: "gfm2zSgQ8cQ",
      title: "Por Tu Maldito Amor",
      artist: "Vicente Fernández",
      album: "Por Tu Maldito Amor",
      durationSeconds: 238,
      artworkUrl: "https://yt3.googleusercontent.com/alb1",
      explicit: false,
      source: "youtube_music",
    },
  ],
  explicitKnown: true,
};

let mockIsParent = true;
let mockDenied: string[] = [];
const mockPlay = jest.fn(async () => {});
const mockAddToQueue = jest.fn();

jest.mock("../src/music/playback", () => ({
  usePlayback: () => ({
    current: null,
    queue: [],
    index: -1,
    playing: false,
    position: 0,
    duration: 0,
    buffering: false,
    repeat: "off",
    shuffle: false,
    error: null,
    downloads: [],
    downloadBytes: 0,
    history: [],
    settings: { repeat: "off", shuffle: false, explicitFilter: true },
    denylist: mockDenied,
    policy: { isParent: mockIsParent, filterOn: true, denied: mockDenied },
    streamFormat: null,
    player: { volume: 0.7 },
    likedTracks: [],
    playlists: [{ id: "hh1", name: "Household", emoji: "🏠", tracks: [], createdAt: 1, updatedAt: 1 }],
    sleepTimerEndsAt: null,
    play: mockPlay,
    playQueueAt: jest.fn(),
    toggle: jest.fn(),
    next: jest.fn(),
    previous: jest.fn(),
    seek: jest.fn(),
    cycleRepeatMode: jest.fn(),
    toggleShuffleMode: jest.fn(),
    addToQueue: mockAddToQueue,
    playNext: jest.fn(),
    clearQueue: jest.fn(),
    setSleepTimer: jest.fn(),
    isLiked: () => false,
    toggleLike: jest.fn(),
    createPlaylist: jest.fn(),
    deletePlaylist: jest.fn(),
    addTrackToPlaylist: jest.fn(),
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
    devices: [],
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

const mockEngineSearch = jest.fn();
const mockBrowseArtist = jest.fn();
const mockBrowseCollection = jest.fn();

jest.mock("../modules/youtube-engine", () => ({
  search: (...args: unknown[]) => mockEngineSearch(...args),
  browseArtist: (...args: unknown[]) => mockBrowseArtist(...args),
  browseCollection: (...args: unknown[]) => mockBrowseCollection(...args),
  related: jest.fn(async () => []),
  prefetchAudio: jest.fn(async () => null),
  artworkColors: jest.fn(async () => ({ dominant: "#0E7490", vibrant: null })),
  artworkBlurred: jest.fn(async () => null),
}));

const mockFetchYtState = jest.fn();
const mockFetchYtPlaylists = jest.fn();
const mockFetchYtPlaylistItems = jest.fn();
const mockStartYtConnect = jest.fn();
const mockCheckYtStatus = jest.fn();
const mockAddTrackToRemoteYt = jest.fn();

jest.mock("../src/music/youtube-account", () => ({
  fetchYouTubeAccountState: () => mockFetchYtState(),
  fetchYouTubePlaylists: () => mockFetchYtPlaylists(),
  fetchYouTubePlaylistItems: (id: string) => mockFetchYtPlaylistItems(id),
  startYouTubeConnect: () => mockStartYtConnect(),
  checkYouTubeConnectStatus: () => mockCheckYtStatus(),
  disconnectYouTubeAccount: jest.fn(async () => true),
  createRemoteYouTubePlaylist: jest.fn(async () => ({ id: "PL_NEW", title: "New", description: "", itemCount: 0, artworkUrl: null, privacyStatus: "private" })),
  addTrackToRemoteYouTubePlaylist: (plId: string, vid: string) => mockAddTrackToRemoteYt(plId, vid),
  removeTrackFromRemoteYouTubePlaylist: jest.fn(async () => true),
  syncYouTubeTrackLike: jest.fn(async () => {}),
}));

const wrap = ({ children }: { children: React.ReactNode }) => <ThemeProvider>{children}</ThemeProvider>;

describe("Rich Artist/Album/Playlist Search & Composio YouTube Account Sync", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    mockIsParent = true;
    mockDenied = [];
    mockFetchYtState.mockResolvedValue({
      connected: false,
      pending: false,
      status: null,
      accountEmail: null,
    });
    mockFetchYtPlaylists.mockResolvedValue([]);
    mockFetchYtPlaylistItems.mockResolvedValue([]);
    mockStartYtConnect.mockResolvedValue({
      authUrl: "https://backend.composio.dev/link/yt",
      connectedAccountId: "ca_yt_1",
      expiresAt: null,
    });
    mockCheckYtStatus.mockResolvedValue({
      connected: true,
      pending: false,
      status: "ACTIVE",
      accountEmail: "family@example.com",
    });
    mockAddTrackToRemoteYt.mockResolvedValue({
      playlistItemId: "PLI_1",
      playlistId: "PL_FAVES",
      videoId: "b393RtiIA18",
    });

    mockEngineSearch.mockResolvedValue({
      tracks: [CLEAN_SONG_1],
      explicitKnown: true,
      topArtist: {
        browseId: "UChYPL8XRXNqerL5hLkd9E9g",
        name: "Vicente Fernández",
        subtitle: "Artist • 47.4M monthly audience",
        artworkUrl: "https://yt3.googleusercontent.com/vicente",
      },
      artists: [],
      albums: ARTIST_PROFILE.albums,
      playlists: ARTIST_PROFILE.playlists,
    });
    mockBrowseArtist.mockResolvedValue(ARTIST_PROFILE);
    mockBrowseCollection.mockResolvedValue(ALBUM_DETAIL);
  });

  it("renders Artist Hero Card, Popular Songs, Albums & Singles, Playlists, and category filter pills on artist search", async () => {
    const { findByTestId, getByTestId, queryByTestId, getByText } = render(<MusicPlayer />, {
      wrapper: wrap,
    });
    fireEvent.changeText(getByTestId("music-search-input"), "Vicente Fernandez");
    fireEvent.press(getByTestId("music-search-submit"));

    expect(await findByTestId("music-search-artist-hero")).toBeTruthy();
    expect(await findByTestId("music-search-albums-shelf")).toBeTruthy();
    expect(await findByTestId("music-search-playlists-shelf")).toBeTruthy();
    expect(await findByTestId("music-result-KYhATSuavAA")).toBeTruthy();
    expect(getByText("Por Tu Maldito Amor")).toBeTruthy();
    expect(getByText("Presenting Vicente Fernández")).toBeTruthy();

    fireEvent.press(getByTestId("music-search-filter-albums"));
    expect(getByTestId("music-search-albums-shelf")).toBeTruthy();
    expect(queryByTestId("music-results")).toBeNull();
    expect(queryByTestId("music-search-playlists-shelf")).toBeNull();

    fireEvent.press(getByTestId("music-search-filter-all"));
    expect(getByTestId("music-results")).toBeTruthy();
  });

  it("opens an Album from search results inside CollectionDetailModal and plays tracks", async () => {
    const { findByTestId, getByTestId } = render(<MusicPlayer />, { wrapper: wrap });
    fireEvent.changeText(getByTestId("music-search-input"), "Vicente Fernandez");
    fireEvent.press(getByTestId("music-search-submit"));

    const albumCard = await findByTestId("music-search-album-MPREb_ckLfEPIIv5v");
    fireEvent.press(albumCard);

    expect(await findByTestId("music-collection-modal")).toBeTruthy();
    await waitFor(() => expect(mockBrowseCollection).toHaveBeenCalledWith("MPREb_ckLfEPIIv5v"));

    fireEvent.press(getByTestId("music-collection-play-all"));
    expect(mockPlay).toHaveBeenCalledWith(ALBUM_DETAIL.tracks[0], ALBUM_DETAIL.tracks);
  });

  it("fails closed for kids on denied artists, explicit albums, and unbadged OMV playlist items", async () => {
    mockIsParent = false;
    mockDenied = ["eminem"];
    mockEngineSearch.mockResolvedValue({
      tracks: [EXPLICIT_TRACK],
      explicitKnown: true,
      topArtist: {
        browseId: "UCedvOgsKFzcK3hA5taf3KoQ",
        name: "Eminem",
        subtitle: "Artist",
        artworkUrl: null,
      },
      artists: [],
      albums: [
        {
          browseId: "MPREb_em",
          title: "The Eminem Show",
          artist: "Eminem",
          year: "2002",
          albumType: "Album",
          subtitle: "Album • 2002",
          artworkUrl: null,
          explicit: true,
        },
      ],
      playlists: [
        {
          browseId: "VLRD_PL",
          title: "Presenting Eminem",
          author: "Eminem",
          subtitle: "Playlist",
          artworkUrl: null,
        },
        {
          browseId: "VLRD_SAFE",
          title: "Cumbias Mix",
          author: "YouTube Music",
          subtitle: "Playlist",
          artworkUrl: null,
        },
      ],
    });
    mockBrowseCollection.mockResolvedValue({
      browseId: "VLRD_SAFE",
      kind: "playlist",
      title: "Cumbias Mix",
      subtitle: "Playlist",
      artist: "YouTube Music",
      artworkUrl: null,
      tracks: [OMV_UNRATED_TRACK],
      explicitKnown: true,
    });

    const { findByTestId, getByTestId, queryByTestId, findByText } = render(<MusicPlayer />, {
      wrapper: wrap,
    });
    fireEvent.changeText(getByTestId("music-search-input"), "eminem");
    fireEvent.press(getByTestId("music-search-submit"));

    await waitFor(() => expect(getByTestId("music-search-playlist-VLRD_SAFE")).toBeTruthy());
    expect(queryByTestId("music-search-artist-hero")).toBeNull();
    expect(queryByTestId("music-search-albums-shelf")).toBeNull();
    expect(queryByTestId("music-search-playlist-VLRD_PL")).toBeNull();
    expect(mockBrowseArtist).not.toHaveBeenCalled();

    fireEvent.press(getByTestId("music-search-playlist-VLRD_SAFE"));
    expect(await findByTestId("music-collection-modal")).toBeTruthy();
    expect(await findByText("These tracks aren't rated, so they can't be shown here.")).toBeTruthy();
  });

  it("lets a parent link YouTube via Composio, browse synced playlists, and add songs directly to a YouTube playlist", async () => {
    const openSpy = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
    mockFetchYtState.mockResolvedValue({
      connected: true,
      pending: false,
      status: "ACTIVE",
      accountEmail: "family@example.com",
    });
    mockFetchYtPlaylists.mockResolvedValue([
      {
        id: "PL_FAVES",
        title: "Road Trip Hits",
        description: "",
        itemCount: 5,
        artworkUrl: null,
        privacyStatus: "private",
      },
    ]);

    const { findByTestId, getByTestId, findByText } = render(<MusicPlayer />, { wrapper: wrap });
    expect(await findByTestId("music-yt-playlist-PL_FAVES")).toBeTruthy();
    expect(await findByText("YouTube Linked")).toBeTruthy();

    fireEvent.press(getByTestId("music-yt-connect-open"));
    expect(await findByTestId("music-yt-account-modal")).toBeTruthy();
    expect(await findByText("Connected: family@example.com")).toBeTruthy();

    // Add a search result directly to the YouTube account playlist
    fireEvent.changeText(getByTestId("music-search-input"), "Vicente Fernandez");
    fireEvent.press(getByTestId("music-search-submit"));
    const plBtn = await findByTestId(`music-result-playlist-${CLEAN_SONG_1.id}`);
    fireEvent.press(plBtn);

    expect(await findByTestId("music-add-playlist-modal")).toBeTruthy();
    const ytTarget = await findByTestId("music-add-to-yt-PL_FAVES");
    fireEvent.press(ytTarget);
    await waitFor(() =>
      expect(mockAddTrackToRemoteYt).toHaveBeenCalledWith("PL_FAVES", CLEAN_SONG_1.id)
    );
    openSpy.mockRestore();
  });

  it("hides YouTube account link controls completely from kid roles", async () => {
    mockIsParent = false;
    mockFetchYtState.mockResolvedValue({
      connected: true,
      pending: false,
      status: "ACTIVE",
      accountEmail: "family@example.com",
    });
    mockFetchYtPlaylists.mockResolvedValue([
      {
        id: "PL_FAVES",
        title: "Road Trip Hits",
        description: "",
        itemCount: 5,
        artworkUrl: null,
        privacyStatus: "private",
      },
    ]);

    const { findByTestId, queryByTestId } = render(<MusicPlayer />, { wrapper: wrap });
    await findByTestId("music-family-mixes-shelf");
    expect(queryByTestId("music-yt-connect-open")).toBeNull();
  });
});
