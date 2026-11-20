import React from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  artworkBlurred,
  artworkColors,
  browseArtist,
  browseCollection,
  prefetchAudio,
  search as engineSearch,
} from "../../modules/youtube-engine";
import { useTheme } from "../theme/ThemeProvider";
import { hapticTap } from "../theme/haptics";
import { mix } from "../theme/mix";
import { musicTokensFor } from "../theme/music-tokens";
import { FONTS, TYPOGRAPHY } from "../theme/tokens";
import { SegmentedControl } from "../ui/SegmentedControl";
import { CastControl } from "./CastControl";
import { useCast } from "./CastProvider";
import { MusicBackdrop } from "./MusicBackdrop";
import {
  FamilyMixesShelf,
  FavoriteArtistsShelf,
  RecommendedArtistsShelf,
  SearchResults,
  SearchSuggestionsStrip,
  SimilarTracksShelf,
  StationsShelf,
  type SearchCategoryFilter,
} from "./MusicBrowse";
import { MusicIcon } from "./MusicIcons";
import {
  AddToPlaylistModal,
  ArtistModal,
  CollectionDetailModal,
  CreatePlaylistModal,
  DenyListModal,
  MusicParentPinModal,
  PlaylistDetailModal,
  SleepTimerModal,
  YouTubeAccountModal,
  type CollectionTrackItem,
} from "./MusicLibraryModals";
import { DownloadsTray, HistoryShelf, LyricsPane, QueuePane } from "./MusicQueueLyrics";
import { NowPlayingStage, StageMiniBar } from "./MusicStage";
import {
  countUnrated,
  isAlbumHidden,
  isArtistHidden,
  isContentHidden,
  isPlaylistHidden,
  searchNote,
  visibleTracks,
} from "./explicit";
import {
  getRecommendedArtists,
  isFavoriteArtist,
  loadFavoriteArtists,
  saveFavoriteArtists,
  toggleFavoriteArtist,
} from "./library";
import { currentLineIndex, fetchLyrics, type LyricLine } from "./lyrics";
import { usePlayback } from "./playback";
import {
  FAMILY_MIXES,
  fetchSimilarTracks,
  MUSIC_STATIONS,
  type FamilyMix,
  type MusicStation,
} from "./stations";
import {
  buildSearchSuggestions,
  clearRecentSearches,
  loadRecentSearches,
  saveRecentSearch,
  type SearchSuggestion,
} from "./suggestions";
import type {
  ArtistProfile,
  FavoriteArtist,
  MediaTrack,
  MusicAlbumSummary,
  MusicArtistSummary,
  MusicPlaylistSummary,
  YouTubeAccountPlaylist,
  YouTubeAccountStatus,
} from "./types";
import {
  addTrackToRemoteYouTubePlaylist,
  checkYouTubeConnectStatus,
  createRemoteYouTubePlaylist,
  disconnectYouTubeAccount,
  fetchYouTubeAccountState,
  fetchYouTubePlaylistItems,
  fetchYouTubePlaylists,
  removeTrackFromRemoteYouTubePlaylist,
  startYouTubeConnect,
  syncYouTubeTrackLike,
} from "./youtube-account";

/** The Now Playing screen's modes. Stage is the artwork-led one. */
type Mode = "stage" | "lyrics" | "queue" | "library";
type LibraryTab = "all" | "artists" | "mixes" | "history" | "downloads";

export function MusicPlayer() {
  const { colors, theme, boost, reduceMotion } = useTheme();
  const tokens = React.useMemo(() => musicTokensFor(theme, boost), [theme, boost]);
  const {
    current,
    queue,
    playing,
    position,
    duration,
    error,
    streamFormat,
    player,
    play,
    toggle,
    next,
    previous,
    seek,
    repeat,
    shuffle,
    cycleRepeatMode,
    toggleShuffleMode,
    downloadCurrent,
    addToQueue,
    removeFromQueue,
    moveQueueItem,
    downloads,
    removeDownload,
    history,
    policy,
    settings,
    setExplicitFilter,
    denylist,
    addDenied,
    removeDenied,
    unlockMusicParent,
    lockMusicParent,
    likedTracks = [],
    playlists = [],
    sleepTimerEndsAt = null,
    playNext,
    clearQueue,
    setSleepTimer,
    isLiked,
    toggleLike,
    createPlaylist,
    deletePlaylist,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
  } = usePlayback();
  const cast = useCast();
  const casting = cast.casting;

  const [query, setQuery] = React.useState("");
  const [tracks, setTracks] = React.useState<MediaTrack[]>([]);
  const [explicitKnown, setExplicitKnown] = React.useState(true);
  const [topArtist, setTopArtist] = React.useState<MusicArtistSummary | null>(null);
  const [searchArtists, setSearchArtists] = React.useState<MusicArtistSummary[]>([]);
  const [searchAlbums, setSearchAlbums] = React.useState<MusicAlbumSummary[]>([]);
  const [searchPlaylists, setSearchPlaylists] = React.useState<MusicPlaylistSummary[]>([]);
  const [searchFilter, setSearchFilter] = React.useState<SearchCategoryFilter>("all");
  const [inlineArtistProfile, setInlineArtistProfile] = React.useState<ArtistProfile | null>(null);
  const [loadingInlineArtist, setLoadingInlineArtist] = React.useState(false);
  const [hasSearched, setHasSearched] = React.useState(false);
  const [searching, setSearching] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<Mode>("stage");
  const [lyricsFor, setLyricsFor] = React.useState<{ id: string; lines: LyricLine[] | null } | null>(null);
  const [searchOpen, setSearchOpen] = React.useState(false);

  const [denyOpen, setDenyOpen] = React.useState(false);
  const [denyTerm, setDenyTerm] = React.useState("");
  const [parentPinOpen, setParentPinOpen] = React.useState(false);
  const [parentPinBusy, setParentPinBusy] = React.useState(false);
  const [parentPinError, setParentPinError] = React.useState<string | null>(null);
  const [parentPinAttempt, setParentPinAttempt] = React.useState(0);

  const [sleepModalOpen, setSleepModalOpen] = React.useState(false);
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  const [createPlaylistOpen, setCreatePlaylistOpen] = React.useState(false);
  const [createPlaylistSeed, setCreatePlaylistSeed] = React.useState<MediaTrack[]>([]);
  const [addToPlaylistTrack, setAddToPlaylistTrack] = React.useState<MediaTrack | null>(null);
  const [selectedPlaylistId, setSelectedPlaylistId] = React.useState<string | null>(null);

  const [similarTrackState, setSimilarTrackState] = React.useState<{ id: string; tracks: MediaTrack[] } | null>(null);
  const [activeArtist, setActiveArtist] = React.useState<{ name: string; artworkUrl?: string | null; browseId?: string } | null>(null);
  const [rawArtistProfile, setRawArtistProfile] = React.useState<ArtistProfile | null>(null);
  const [rawArtistTracks, setRawArtistTracks] = React.useState<MediaTrack[]>([]);
  const [loadingArtistTracks, setLoadingArtistTracks] = React.useState(false);
  const [artistModalOpen, setArtistModalOpen] = React.useState(false);

  const [activeCollection, setActiveCollection] = React.useState<{
    browseId: string;
    kind: "album" | "playlist";
    title: string;
    subtitle: string;
    artist: string;
    artworkUrl: string | null;
    isRemoteAccount: boolean;
    explicitKnown: boolean;
    rawTracks: CollectionTrackItem[];
  } | null>(null);
  const [collectionLoading, setCollectionLoading] = React.useState(false);

  const [ytStatus, setYtStatus] = React.useState<YouTubeAccountStatus>({
    connected: false,
    pending: false,
    status: null,
    accountEmail: null,
  });
  const [ytPlaylists, setYtPlaylists] = React.useState<YouTubeAccountPlaylist[]>([]);
  const [ytModalOpen, setYtModalOpen] = React.useState(false);
  const [ytBusy, setYtBusy] = React.useState(false);
  const [ytError, setYtError] = React.useState<string | null>(null);

  const [libraryTab, setLibraryTab] = React.useState<LibraryTab>("all");

  const [favoriteArtists, setFavoriteArtists] = React.useState<FavoriteArtist[]>([]);
  const [recentSearches, setRecentSearches] = React.useState<string[]>([]);
  const [submittedQuery, setSubmittedQuery] = React.useState("");
  const liveSearchTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSearchedTermRef = React.useRef("");
  const searchRequestIdRef = React.useRef(0);

  React.useEffect(() => {
    if (!sleepTimerEndsAt) return;
    const tick = () => setNowMs(Date.now());
    const immediate = setTimeout(tick, 0);
    const interval = setInterval(tick, 30_000);
    return () => {
      clearTimeout(immediate);
      clearInterval(interval);
    };
  }, [sleepTimerEndsAt]);

  const sleepRemainingMinutes =
    sleepTimerEndsAt && sleepTimerEndsAt > nowMs
      ? Math.max(1, Math.ceil((sleepTimerEndsAt - nowMs) / 60_000))
      : null;

  React.useEffect(() => {
    let alive = true;
    void loadFavoriteArtists().then((list) => {
      if (alive && list.length > 0) setFavoriteArtists(list);
    });
    void loadRecentSearches().then((recent) => {
      if (alive && recent.length > 0) setRecentSearches(recent);
    });
    return () => {
      alive = false;
    };
  }, []);

  const handleToggleFavoriteArtist = React.useCallback(
    (artistName: string, artworkUrl?: string | null) => {
      setFavoriteArtists((prev) => {
        const updated = toggleFavoriteArtist(prev, artistName, artworkUrl);
        void saveFavoriteArtists(updated);
        return updated;
      });
    },
    []
  );

  const deniedKey = (policy.denied ?? []).join("\u0000");
  const stablePolicy = React.useMemo(
    () => ({
      isParent: policy.isParent,
      filterOn: policy.filterOn,
      denied: policy.denied,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [policy.isParent, policy.filterOn, deniedKey]
  );
  const isParent = stablePolicy.isParent;
  const visible = React.useMemo(() => visibleTracks(tracks, stablePolicy), [tracks, stablePolicy]);
  const visibleQueue = React.useMemo(() => visibleTracks(queue, stablePolicy), [queue, stablePolicy]);
  const visibleHistory = React.useMemo(() => visibleTracks(history, stablePolicy), [history, stablePolicy]);
  const visibleDownloads = React.useMemo(() => visibleTracks(downloads, stablePolicy), [downloads, stablePolicy]);
  const visibleLiked = React.useMemo(() => visibleTracks(likedTracks, stablePolicy), [likedTracks, stablePolicy]);
  const visiblePlaylists = React.useMemo(
    () =>
      playlists.map((pl) => ({
        ...pl,
        tracks: visibleTracks(pl.tracks, stablePolicy),
      })),
    [playlists, stablePolicy]
  );
  const visibleCurrent = current && !isContentHidden(current, stablePolicy) ? current : null;

  const filterArtistProfile = React.useCallback(
    (profile: ArtistProfile | null): ArtistProfile | null => {
      if (!profile || isArtistHidden(profile.name, stablePolicy)) return null;
      return {
        ...profile,
        topSongs: visibleTracks(profile.topSongs, stablePolicy),
        albums: profile.albums.filter((a) => !isAlbumHidden(a, stablePolicy)),
        singles: profile.singles.filter((a) => !isAlbumHidden(a, stablePolicy)),
        playlists: profile.playlists.filter((p) => !isPlaylistHidden(p, stablePolicy)),
        relatedArtists: profile.relatedArtists.filter((r) => !isArtistHidden(r.name, stablePolicy)),
      };
    },
    [stablePolicy]
  );

  const visibleTopArtist = React.useMemo(
    () => (topArtist && !isArtistHidden(topArtist.name, stablePolicy) ? topArtist : null),
    [topArtist, stablePolicy]
  );
  const visibleSearchArtists = React.useMemo(
    () => searchArtists.filter((a) => !isArtistHidden(a.name, stablePolicy)),
    [searchArtists, stablePolicy]
  );
  const visibleSearchAlbums = React.useMemo(
    () => searchAlbums.filter((a) => !isAlbumHidden(a, stablePolicy)),
    [searchAlbums, stablePolicy]
  );
  const visibleSearchPlaylists = React.useMemo(
    () => searchPlaylists.filter((p) => !isPlaylistHidden(p, stablePolicy)),
    [searchPlaylists, stablePolicy]
  );
  const visibleInlineArtistProfile = React.useMemo(
    () => filterArtistProfile(inlineArtistProfile),
    [inlineArtistProfile, filterArtistProfile]
  );
  const visibleModalArtistProfile = React.useMemo(
    () => filterArtistProfile(rawArtistProfile),
    [rawArtistProfile, filterArtistProfile]
  );
  const visibleModalArtistTracks = React.useMemo(() => {
    if (visibleModalArtistProfile && visibleModalArtistProfile.topSongs.length > 0) {
      return visibleModalArtistProfile.topSongs;
    }
    return visibleTracks(rawArtistTracks, stablePolicy);
  }, [visibleModalArtistProfile, rawArtistTracks, stablePolicy]);

  const visibleCollectionTracks = React.useMemo(
    () => (activeCollection ? visibleTracks(activeCollection.rawTracks, stablePolicy) : []),
    [activeCollection, stablePolicy]
  );
  const collectionNote = React.useMemo(() => {
    if (!activeCollection || collectionLoading) return null;
    if (visibleCollectionTracks.length > 0) return null;
    return searchNote({
      visible: 0,
      total: activeCollection.rawTracks.length,
      unrated: countUnrated(activeCollection.rawTracks),
      explicitKnown: activeCollection.explicitKnown,
      isParent,
    });
  }, [activeCollection, collectionLoading, visibleCollectionTracks.length, isParent]);

  const refreshYouTubeState = React.useCallback(async (syncPlaylistsToo = true) => {
    try {
      const state = await fetchYouTubeAccountState();
      setYtStatus(state);
      if (state.connected && syncPlaylistsToo) {
        const list = await fetchYouTubePlaylists();
        setYtPlaylists(list);
      } else if (!state.connected) {
        setYtPlaylists([]);
      }
    } catch {
      // YouTube account integration is optional; never block music UI.
    }
  }, []);

  React.useEffect(() => {
    let alive = true;
    void fetchYouTubeAccountState()
      .then(async (state) => {
        if (!alive) return;
        setYtStatus(state);
        if (state.connected) {
          const list = await fetchYouTubePlaylists();
          if (alive) setYtPlaylists(list);
        } else {
          setYtPlaylists([]);
        }
      })
      .catch(() => {
        // YouTube account integration is optional; never block music UI.
      });
    return () => {
      alive = false;
    };
  }, [isParent]);

  const visibleYouTubePlaylists = React.useMemo(
    () =>
      ytStatus.connected
        ? ytPlaylists.filter((pl) => !isPlaylistHidden({ title: pl.title, author: "" }, stablePolicy))
        : [],
    [ytStatus.connected, ytPlaylists, stablePolicy]
  );

  const selectedPlaylist = React.useMemo(
    () => visiblePlaylists.find((p) => p.id === selectedPlaylistId) ?? null,
    [visiblePlaylists, selectedPlaylistId]
  );

  const suggestions = React.useMemo(
    () =>
      buildSearchSuggestions(query, {
        recentSearches,
        favoriteArtists,
        history: visibleHistory,
      }),
    [query, recentSearches, favoriteArtists, visibleHistory]
  );

  React.useEffect(() => {
    if (!visibleCurrent) return;
    let alive = true;
    void fetchSimilarTracks(visibleCurrent)
      .then((sim) => {
        if (alive) {
          setSimilarTrackState({ id: visibleCurrent.id, tracks: visibleTracks(sim, stablePolicy) });
        }
      })
      .catch(() => {
        if (alive) setSimilarTrackState({ id: visibleCurrent.id, tracks: [] });
      });
    return () => {
      alive = false;
    };
  }, [visibleCurrent, stablePolicy]);

  const similarTracks =
    visibleCurrent && similarTrackState?.id === visibleCurrent.id ? similarTrackState.tracks : [];

  const isCurrentArtistFavorite = visibleCurrent
    ? isFavoriteArtist(favoriteArtists, visibleCurrent.artist)
    : false;

  const currentTrackLiked = visibleCurrent
    ? isLiked
      ? isLiked(visibleCurrent.id)
      : visibleLiked.some((t) => t.id === visibleCurrent.id)
    : false;

  const recommendedArtists = React.useMemo(
    () => getRecommendedArtists(visibleHistory, favoriteArtists),
    [visibleHistory, favoriteArtists]
  );

  const openArtistProfile = React.useCallback(
    async (artistName: string, artworkUrl?: string | null, browseId?: string) => {
      const trimmed = artistName.trim();
      if (!trimmed) return;
      setActiveArtist({ name: trimmed, artworkUrl: artworkUrl ?? null, browseId });
      setRawArtistProfile(null);
      setRawArtistTracks([]);
      setLoadingArtistTracks(true);
      setArtistModalOpen(true);
      try {
        let resolvedBrowseId = browseId;
        let fallbackTracks: MediaTrack[] = [];
        if (!resolvedBrowseId) {
          const outcome = await engineSearch(trimmed, 20);
          fallbackTracks = outcome.tracks;
          if (outcome.topArtist?.browseId && !isArtistHidden(outcome.topArtist.name, stablePolicy)) {
            resolvedBrowseId = outcome.topArtist.browseId;
          } else {
            const firstMatch = outcome.artists?.find((a) => !isArtistHidden(a.name, stablePolicy));
            if (firstMatch) resolvedBrowseId = firstMatch.browseId;
          }
        }
        let loadedProfile: ArtistProfile | null = null;
        if (resolvedBrowseId && typeof browseArtist === "function" && !isArtistHidden(trimmed, stablePolicy)) {
          loadedProfile = await browseArtist(resolvedBrowseId);
        }
        if (loadedProfile) {
          setRawArtistProfile(loadedProfile);
          const vis = visibleTracks(loadedProfile.topSongs, stablePolicy);
          if (vis.length > 0 && typeof prefetchAudio === "function") {
            void prefetchAudio(vis[0].id);
          }
        } else {
          if (fallbackTracks.length === 0) {
            const outcome = await engineSearch(trimmed, 25);
            fallbackTracks = outcome.tracks;
          }
          setRawArtistTracks(fallbackTracks);
          const vis = visibleTracks(fallbackTracks, stablePolicy);
          if (vis.length > 0 && typeof prefetchAudio === "function") {
            void prefetchAudio(vis[0].id);
          }
        }
      } catch {
        setRawArtistTracks([]);
        setRawArtistProfile(null);
      } finally {
        setLoadingArtistTracks(false);
      }
    },
    [stablePolicy]
  );

  const openCollection = React.useCallback(
    async (args: {
      browseId: string;
      kind: "album" | "playlist";
      title: string;
      subtitle: string;
      artist: string;
      artworkUrl: string | null;
      isRemoteAccount?: boolean;
    }) => {
      const isRemote = args.isRemoteAccount === true;
      setActiveCollection({
        browseId: args.browseId,
        kind: args.kind,
        title: args.title,
        subtitle: args.subtitle,
        artist: args.artist,
        artworkUrl: args.artworkUrl,
        isRemoteAccount: isRemote,
        explicitKnown: true,
        rawTracks: [],
      });
      setCollectionLoading(true);
      try {
        if (isRemote) {
          const items = await fetchYouTubePlaylistItems(args.browseId);
          setActiveCollection((prev) =>
            prev && prev.browseId === args.browseId
              ? { ...prev, explicitKnown: true, rawTracks: items }
              : prev
          );
          const vis = visibleTracks(items, stablePolicy);
          if (vis.length > 0 && typeof prefetchAudio === "function") {
            void prefetchAudio(vis[0].id);
          }
        } else if (typeof browseCollection === "function") {
          const detail = await browseCollection(args.browseId);
          if (detail) {
            setActiveCollection({
              browseId: detail.browseId,
              kind: detail.kind,
              title: detail.title || args.title,
              subtitle: detail.subtitle || args.subtitle,
              artist: detail.artist || args.artist,
              artworkUrl: detail.artworkUrl ?? args.artworkUrl,
              isRemoteAccount: false,
              explicitKnown: detail.explicitKnown,
              rawTracks: detail.tracks,
            });
            const vis = visibleTracks(detail.tracks, stablePolicy);
            if (vis.length > 0 && typeof prefetchAudio === "function") {
              void prefetchAudio(vis[0].id);
            }
          }
        }
      } catch {
        // Collection remains open with honest empty note.
      } finally {
        setCollectionLoading(false);
      }
    },
    [stablePolicy]
  );

  const handleCreateStation = async (track: MediaTrack) => {
    setSearching(true);
    try {
      const similar = await fetchSimilarTracks(track, 25);
      const vis = visibleTracks(similar, policy);
      if (vis.length > 0) {
        await play(vis[0], vis);
        setMode("stage");
      }
    } catch {
      // station fallback
    } finally {
      setSearching(false);
    }
  };

  const selectStation = React.useCallback(
    async (station: MusicStation) => {
      setQuery(station.query);
      setSubmittedQuery(station.query);
      lastSearchedTermRef.current = station.query;
      setSearchOpen(false);
      setSearching(true);
      setSearchError(null);
      try {
        const outcome = await engineSearch(station.query, 25);
        setTracks(outcome.tracks);
        setExplicitKnown(outcome.explicitKnown);
        setHasSearched(true);
        const vis = visibleTracks(outcome.tracks, policy);
        if (vis.length > 0) {
          await play(vis[0], vis);
          setMode("stage");
        }
      } catch (e) {
        setSearchError(e instanceof Error ? e.message : "station_failed");
      } finally {
        setSearching(false);
      }
    },
    [play, policy]
  );

  const selectMix = React.useCallback(
    async (mixItem: FamilyMix) => {
      setQuery(mixItem.query);
      setSubmittedQuery(mixItem.query);
      lastSearchedTermRef.current = mixItem.query;
      setSearchOpen(false);
      setSearching(true);
      setSearchError(null);
      try {
        const outcome = await engineSearch(mixItem.query, 25);
        setTracks(outcome.tracks);
        setExplicitKnown(outcome.explicitKnown);
        setHasSearched(true);
        const vis = visibleTracks(outcome.tracks, policy);
        if (vis.length > 0) {
          await play(vis[0], vis);
          setMode("stage");
        }
      } catch (e) {
        setSearchError(e instanceof Error ? e.message : "mix_failed");
      } finally {
        setSearching(false);
      }
    },
    [play, policy]
  );

  const unrated = countUnrated(tracks);
  const inlineSongCount = visibleInlineArtistProfile?.topSongs.length ?? 0;
  const hasAnyVisibleRichContent =
    visible.length > 0 ||
    inlineSongCount > 0 ||
    visibleTopArtist !== null ||
    visibleSearchArtists.length > 0 ||
    visibleSearchAlbums.length > 0 ||
    visibleSearchPlaylists.length > 0;
  const note =
    hasSearched && !searching && !searchError
      ? hasAnyVisibleRichContent && (tracks.length === 0 || visible.length > 0 || inlineSongCount > 0)
        ? null
        : searchNote({
            visible: Math.max(visible.length, inlineSongCount),
            total: tracks.length,
            unrated,
            explicitKnown,
            isParent,
          })
      : null;

  React.useEffect(() => {
    if (!visibleCurrent) return;
    let alive = true;
    void fetchLyrics(visibleCurrent).then((lines) => {
      if (alive) setLyricsFor({ id: visibleCurrent.id, lines });
    });
    return () => {
      alive = false;
    };
  }, [visibleCurrent]);

  const lyrics = visibleCurrent && lyricsFor?.id === visibleCurrent.id ? lyricsFor.lines : null;

  const runSearch = React.useCallback(
    async (rawTerm: string, options?: { saveRecent?: boolean; markSubmitted?: boolean }) => {
      const term = rawTerm.trim();
      if (!term) return;
      if (liveSearchTimerRef.current) {
        clearTimeout(liveSearchTimerRef.current);
        liveSearchTimerRef.current = null;
      }
      const reqId = ++searchRequestIdRef.current;
      lastSearchedTermRef.current = term;
      if (options?.markSubmitted !== false) {
        setSubmittedQuery(term);
      }
      if (options?.saveRecent !== false) {
        void saveRecentSearch(term).then((updated) => setRecentSearches(updated));
      }
      setSearching(true);
      setSearchError(null);
      setInlineArtistProfile(null);
      setLoadingInlineArtist(false);
      try {
        const outcome = await engineSearch(term, 20);
        if (reqId !== searchRequestIdRef.current) return;
        setTracks(outcome.tracks);
        setExplicitKnown(outcome.explicitKnown);
        setTopArtist(outcome.topArtist ?? null);
        setSearchArtists(outcome.artists ?? []);
        setSearchAlbums(outcome.albums ?? []);
        setSearchPlaylists(outcome.playlists ?? []);
        setSearchFilter("all");
        setHasSearched(true);

        const vis = visibleTracks(outcome.tracks, stablePolicy);
        if (vis.length > 0 && typeof prefetchAudio === "function") {
          void prefetchAudio(vis[0].id);
        }

        const hero = outcome.topArtist;
        if (
          hero?.browseId &&
          !isArtistHidden(hero.name, stablePolicy) &&
          typeof browseArtist === "function"
        ) {
          setLoadingInlineArtist(true);
          void browseArtist(hero.browseId)
            .then((profile) => {
              if (reqId !== searchRequestIdRef.current) return;
              setInlineArtistProfile(profile);
              if (profile) {
                const topVis = visibleTracks(profile.topSongs, stablePolicy);
                if (topVis.length > 0 && typeof prefetchAudio === "function") {
                  void prefetchAudio(topVis[0].id);
                }
              }
            })
            .catch(() => {})
            .finally(() => {
              if (reqId === searchRequestIdRef.current) {
                setLoadingInlineArtist(false);
              }
            });
        }
      } catch (e) {
        if (reqId !== searchRequestIdRef.current) return;
        setSearchError(e instanceof Error ? e.message : "search_failed");
        setTracks([]);
        setTopArtist(null);
        setSearchArtists([]);
        setSearchAlbums([]);
        setSearchPlaylists([]);
        setInlineArtistProfile(null);
        setExplicitKnown(false);
        setHasSearched(true);
      } finally {
        if (reqId === searchRequestIdRef.current) {
          setSearching(false);
        }
      }
    },
    [stablePolicy]
  );

  const search = async () => {
    await runSearch(query, { saveRecent: true, markSubmitted: true });
  };

  const handleClearSearch = () => {
    if (liveSearchTimerRef.current) {
      clearTimeout(liveSearchTimerRef.current);
      liveSearchTimerRef.current = null;
    }
    searchRequestIdRef.current += 1;
    lastSearchedTermRef.current = "";
    setSubmittedQuery("");
    setQuery("");
    setTracks([]);
    setTopArtist(null);
    setSearchArtists([]);
    setSearchAlbums([]);
    setSearchPlaylists([]);
    setSearchFilter("all");
    setInlineArtistProfile(null);
    setLoadingInlineArtist(false);
    setHasSearched(false);
    setSearchError(null);
  };

  const handleSelectSuggestion = (suggestion: SearchSuggestion) => {
    setQuery(suggestion.query);
    void runSearch(suggestion.query, { saveRecent: true, markSubmitted: true });
  };

  const handleClearRecentSearches = () => {
    setRecentSearches([]);
    void clearRecentSearches();
  };

  React.useEffect(() => {
    const term = query.trim();
    if (liveSearchTimerRef.current) {
      clearTimeout(liveSearchTimerRef.current);
      liveSearchTimerRef.current = null;
    }
    if (term.length < 3 || term === lastSearchedTermRef.current) {
      return;
    }
    liveSearchTimerRef.current = setTimeout(() => {
      liveSearchTimerRef.current = null;
      if (term !== lastSearchedTermRef.current) {
        void runSearch(term, { saveRecent: false, markSubmitted: false });
      }
    }, 320);
    return () => {
      if (liveSearchTimerRef.current) {
        clearTimeout(liveSearchTimerRef.current);
        liveSearchTimerRef.current = null;
      }
    };
  }, [query, runSearch]);

  const clockPosition = casting ? cast.position : position;
  const activeLine = lyrics ? currentLineIndex(lyrics, clockPosition * 1000) : -1;
  const downloaded = !!visibleCurrent && downloads.some((d) => d.id === visibleCurrent.id);

  const [tintCache, setTintCache] = React.useState<Record<string, string | null>>({});
  const trackId = visibleCurrent?.id ?? null;
  const artworkUrl = visibleCurrent?.artworkUrl ?? null;
  const tintKey = trackId ? `${theme}:${trackId}` : null;

  React.useEffect(() => {
    if (!trackId || !artworkUrl || !tintKey) return;
    if (tintKey in tintCache) return;
    let alive = true;
    const settle = (value: string | null) => {
      if (!alive) return;
      setTintCache((prev) => ({ ...prev, [tintKey]: value }));
    };
    void artworkColors(artworkUrl)
      .then((extracted) => settle(extracted.dominant))
      .catch(() => settle(null));
    return () => {
      alive = false;
    };
  }, [trackId, artworkUrl, tintKey, tintCache]);

  const rawDominant = tintKey && tintKey in tintCache ? tintCache[tintKey] : null;

  const [blurred, setBlurred] = React.useState<{ key: string; uri: string | null } | null>(null);
  React.useEffect(() => {
    if (!artworkUrl) return;
    let alive = true;
    void artworkBlurred(artworkUrl)
      .then((uri) => {
        if (alive) setBlurred({ key: artworkUrl, uri });
      })
      .catch(() => {
        if (alive) setBlurred({ key: artworkUrl, uri: null });
      });
    return () => {
      alive = false;
    };
  }, [artworkUrl]);

  const backdropUri = artworkUrl
    ? blurred && blurred.key === artworkUrl
      ? blurred.uri ?? artworkUrl
      : artworkUrl
    : null;

  const addDenyTerm = () => {
    const term = denyTerm.trim();
    if (!term) return;
    void addDenied(term);
    setDenyTerm("");
  };

  const openPlaylistCreator = (seedTracks: MediaTrack[] = []) => {
    setCreatePlaylistSeed(seedTracks);
    setCreatePlaylistOpen(true);
  };

  const handleToggleLikeWithSync = React.useCallback(
    (track: MediaTrack) => {
      if (!toggleLike) return;
      const currentlyLiked = isLiked ? isLiked(track.id) : visibleLiked.some((t) => t.id === track.id);
      toggleLike(track);
      if (isParent && ytStatus.connected) {
        void syncYouTubeTrackLike(track.id, !currentlyLiked);
      }
    },
    [toggleLike, isLiked, visibleLiked, isParent, ytStatus.connected]
  );

  const activeToggleHandler = casting ? (cast.playing ? cast.pause : cast.play) : toggle;
  const activeNextHandler = casting ? () => void cast.advance(false) : () => void next();

  const headerPillStyle = {
    minHeight: 64,
    paddingHorizontal: 14,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.panelRim,
    backgroundColor: visibleCurrent ? tokens.glassFill : tokens.panel,
  };

  return (
    <>
      <MusicBackdrop
        uri={backdropUri}
        dominantHex={rawDominant}
        theme={theme}
        boost={boost}
        positionMs={Math.max(0, Math.round(clockPosition * 1000))}
      />
      <ScrollView
        testID="music-player"
        contentContainerStyle={{ padding: tokens.pageMargin, gap: tokens.shelfGap, paddingBottom: 200 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Top Masthead */}
        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <Text style={{ color: tokens.label, fontFamily: FONTS.display, fontSize: 44 }}>Music</Text>
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 999,
              backgroundColor: mix(tokens.accent, tokens.panel, 20),
              borderWidth: 1,
              borderColor: tokens.panelRim,
            }}
          >
            <Text style={{ color: tokens.label, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
              Ad-free
            </Text>
          </View>

          <View style={{ marginLeft: "auto", flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <CastControl track={visibleCurrent} />

            {isParent ? (
              <>
                {typeof setExplicitFilter === "function" ? (
                  <Pressable
                    testID="music-explicit-toggle"
                    accessibilityRole="button"
                    accessibilityLabel={settings?.explicitFilter === false ? "Turn kid-safe filter on" : "Allow explicit songs"}
                    hitSlop={8}
                    onPress={() => {
                      hapticTap();
                      setExplicitFilter(settings?.explicitFilter === false);
                    }}
                    style={headerPillStyle}
                  >
                    <MusicIcon name="shield" size={18} color={tokens.accent} filled={settings?.explicitFilter !== false} />
                    <Text style={{ color: tokens.label, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
                      {settings?.explicitFilter === false ? "Filter: Off" : "Filter: On"}
                    </Text>
                  </Pressable>
                ) : null}
                <Pressable
                  testID="music-deny-open"
                  accessibilityRole="button"
                  accessibilityLabel="Blocked artists and songs"
                  hitSlop={8}
                  onPress={() => {
                    hapticTap();
                    setDenyOpen(true);
                  }}
                  style={headerPillStyle}
                >
                  <Text style={{ color: tokens.label, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
                    Blocked
                  </Text>
                </Pressable>
                {typeof lockMusicParent === "function" ? (
                  <Pressable
                    testID="music-parent-lock"
                    accessibilityRole="button"
                    accessibilityLabel="Lock parent music mode"
                    hitSlop={8}
                    onPress={() => {
                      hapticTap();
                      setDenyOpen(false);
                      lockMusicParent();
                    }}
                    style={{
                      ...headerPillStyle,
                      backgroundColor: mix(tokens.accent, tokens.panel, 22),
                      borderColor: tokens.accent,
                    }}
                  >
                    <MusicIcon name="lock" size={18} color={tokens.label} />
                    <Text style={{ color: tokens.label, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
                      Lock
                    </Text>
                  </Pressable>
                ) : null}
              </>
            ) : typeof unlockMusicParent === "function" ? (
              <Pressable
                testID="music-parent-unlock"
                accessibilityRole="button"
                accessibilityLabel="Unlock parent music controls"
                hitSlop={8}
                onPress={() => {
                  hapticTap();
                  setParentPinError(null);
                  setParentPinOpen(true);
                }}
                style={headerPillStyle}
              >
                <MusicIcon name="lock" size={18} color={tokens.label} />
                <Text style={{ color: tokens.label, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
                  Parent
                </Text>
              </Pressable>
            ) : null}

            {visibleCurrent ? (
              <Pressable
                testID="music-header-search"
                accessibilityRole="button"
                accessibilityLabel="Search music"
                hitSlop={8}
                onPress={() => {
                  hapticTap();
                  setSearchOpen((v) => !v);
                }}
                style={{
                  ...headerPillStyle,
                  backgroundColor: searchOpen ? tokens.accent : headerPillStyle.backgroundColor,
                  borderColor: searchOpen ? tokens.accent : tokens.panelRim,
                }}
              >
                <MusicIcon name="search" size={18} color={searchOpen ? tokens.onAccent : tokens.label} />
                <Text
                  style={{
                    color: searchOpen ? tokens.onAccent : tokens.label,
                    fontSize: TYPOGRAPHY.body.fontSize,
                    fontWeight: "700",
                  }}
                >
                  Search
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* Search Field & Results */}
        {searchOpen || !visibleCurrent ? (
          <View style={{ gap: tokens.shelfGap }}>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TextInput
                testID="music-search-input"
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={() => void search()}
                placeholder="Search YouTube Music…"
                placeholderTextColor={tokens.label2}
                style={{
                  flex: 1,
                  minHeight: 64,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: tokens.panelRim,
                  backgroundColor: tokens.sheet,
                  paddingHorizontal: 16,
                  color: tokens.label,
                  fontSize: TYPOGRAPHY.body.fontSize,
                }}
              />
              {query.length > 0 ? (
                <Pressable
                  testID="music-search-clear"
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                  onPress={handleClearSearch}
                  style={{
                    minHeight: 64,
                    minWidth: 64,
                    paddingHorizontal: 16,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: tokens.panelRim,
                    backgroundColor: tokens.sheet,
                  }}
                >
                  <MusicIcon name="close" size={20} color={tokens.label2} />
                </Pressable>
              ) : null}
              <Pressable
                testID="music-search-submit"
                accessibilityRole="button"
                accessibilityLabel="Search"
                onPress={() => void search()}
                style={{
                  minHeight: 64,
                  minWidth: 64,
                  paddingHorizontal: 22,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 14,
                  backgroundColor: tokens.accent,
                }}
              >
                <Text style={{ color: tokens.onAccent, fontSize: TYPOGRAPHY.title.fontSize, fontWeight: "800" }}>
                  Go
                </Text>
              </Pressable>
            </View>

            {query.trim().length > 0 && query.trim() !== submittedQuery && suggestions.length > 0 ? (
              <SearchSuggestionsStrip
                testID="music-search-suggestions"
                title="Suggestions"
                suggestions={suggestions}
                tokens={tokens}
                onSelect={handleSelectSuggestion}
              />
            ) : query.trim().length === 0 && recentSearches.length > 0 && !hasSearched ? (
              <SearchSuggestionsStrip
                testID="music-recent-searches"
                title="Recent searches"
                suggestions={suggestions.filter((s) => s.kind === "recent")}
                tokens={tokens}
                onSelect={handleSelectSuggestion}
                onClearRecent={handleClearRecentSearches}
              />
            ) : null}

            {searching ? <ActivityIndicator color={tokens.accent} /> : null}
            {searchError ? (
              <Text style={{ color: colors["color-accent-rose"], ...TYPOGRAPHY.body }}>{searchError}</Text>
            ) : null}

            {hasAnyVisibleRichContent ? (
              <SearchResults
                tracks={visible}
                tokens={tokens}
                isParent={isParent}
                denied={policy.denied ?? []}
                topArtist={visibleTopArtist}
                artists={visibleSearchArtists}
                albums={visibleSearchAlbums}
                playlists={visibleSearchPlaylists}
                artistProfile={visibleInlineArtistProfile}
                loadingArtistProfile={loadingInlineArtist}
                searchFilter={searchFilter}
                onChangeFilter={setSearchFilter}
                isFavoriteArtistFn={(name) => isFavoriteArtist(favoriteArtists, name)}
                onToggleFavoriteArtist={(name, art) => handleToggleFavoriteArtist(name, art)}
                onSelectArtist={(art) => void openArtistProfile(art.name, art.artworkUrl, art.browseId)}
                onSelectAlbum={(alb) =>
                  void openCollection({
                    browseId: alb.browseId,
                    kind: "album",
                    title: alb.title,
                    subtitle: alb.subtitle,
                    artist: alb.artist,
                    artworkUrl: alb.artworkUrl,
                  })
                }
                onSelectPlaylist={(pl) =>
                  void openCollection({
                    browseId: pl.browseId,
                    kind: "playlist",
                    title: pl.title,
                    subtitle: pl.subtitle,
                    artist: pl.author,
                    artworkUrl: pl.artworkUrl,
                  })
                }
                onPlay={(track, list) => void play(track, list)}
                onQueue={(track) => addToQueue(track)}
                onPlayNext={playNext ? (track) => playNext(track) : undefined}
                isLiked={isLiked}
                onToggleLike={toggleLike ? handleToggleLikeWithSync : undefined}
                onAddToPlaylist={
                  addTrackToPlaylist || (isParent && ytStatus.connected)
                    ? (track) => setAddToPlaylistTrack(track)
                    : undefined
                }
              />
            ) : null}

            {note ? (
              <Text
                testID={note.testID}
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                style={{ color: tokens.label2, ...TYPOGRAPHY.body, paddingVertical: 12 }}
              >
                {note.text}
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* Cast alert when active cast has hidden track / no visible current track */}
        {cast.target !== null && !visibleCurrent ? (
          <View
            testID="cast-alert"
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              minHeight: 64,
              padding: 12,
              borderRadius: tokens.panelRadius,
              borderWidth: 1,
              borderColor: tokens.panelRim,
              backgroundColor: tokens.panel,
            }}
          >
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={{
                flex: 1,
                color: cast.error ? colors["color-accent-rose"] : tokens.label,
                fontSize: TYPOGRAPHY.body.fontSize,
                lineHeight: TYPOGRAPHY.body.lineHeight,
              }}
            >
              {cast.error ?? `Casting to ${cast.target.name}.`}
            </Text>
            <Pressable
              testID="cast-stop"
              accessibilityRole="button"
              accessibilityLabel="Stop casting"
              onPress={() => {
                void cast.disconnect().catch(() => {});
              }}
              style={{
                minHeight: 64,
                minWidth: 64,
                paddingHorizontal: 16,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 14,
                borderWidth: 1,
                borderColor: tokens.panelRim,
                backgroundColor: tokens.scrim,
              }}
            >
              <Text style={{ color: tokens.label, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
                Stop casting
              </Text>
            </Pressable>
          </View>
        ) : null}

        {!visibleCurrent && cast.error ? (
          <Text
            testID="music-cast-error"
            style={{ color: colors["color-accent-rose"], fontSize: TYPOGRAPHY.body.fontSize, lineHeight: TYPOGRAPHY.body.lineHeight }}
          >
            {cast.error}
          </Text>
        ) : null}

        {visibleCurrent ? (
          <>
            <SegmentedControl
              testID="music-mode"
              accessibilityLabel="Now Playing view"
              options={[
                { id: "stage", label: "Now Playing" },
                { id: "lyrics", label: "Lyrics" },
                { id: "queue", label: "Queue" },
                { id: "library", label: "Library" },
              ]}
              value={mode}
              onChange={(id) => setMode(id as Mode)}
            />

            {mode !== "stage" ? (
              <StageMiniBar
                track={visibleCurrent}
                playing={casting ? cast.playing : playing}
                tokens={tokens}
                onOpenStage={() => setMode("stage")}
                onToggle={activeToggleHandler}
                onNext={activeNextHandler}
              />
            ) : null}

            {mode === "stage" ? (
              <>
                <NowPlayingStage
                  track={visibleCurrent}
                  tokens={tokens}
                  reduceMotion={reduceMotion}
                  playing={casting ? cast.playing : playing}
                  position={casting ? cast.position : position}
                  duration={casting ? (cast.duration ?? 0) : duration}
                  repeat={repeat}
                  shuffle={shuffle}
                  downloaded={downloaded}
                  casting={casting}
                  player={player}
                  queueCount={visibleQueue.length}
                  streamFormat={
                    streamFormat && streamFormat.id === visibleCurrent.id
                      ? streamFormat
                      : null
                  }
                  onToggle={activeToggleHandler}
                  onNext={activeNextHandler}
                  onPrevious={casting ? () => void cast.previous() : () => void previous()}
                  onSeek={casting ? (seconds) => void cast.seek(seconds) : (seconds) => void seek(seconds)}
                  onToggleShuffle={toggleShuffleMode}
                  onCycleRepeat={cycleRepeatMode}
                  onDownload={() => void downloadCurrent()}
                  isFavorite={isCurrentArtistFavorite}
                  onToggleFavorite={() =>
                    handleToggleFavoriteArtist(visibleCurrent.artist, visibleCurrent.artworkUrl)
                  }
                  isLiked={currentTrackLiked}
                  onToggleLike={toggleLike ? () => handleToggleLikeWithSync(visibleCurrent) : undefined}
                  sleepRemainingMinutes={sleepRemainingMinutes}
                  onOpenLyrics={() => setMode("lyrics")}
                  onOpenQueue={() => setMode("queue")}
                  onOpenAddToPlaylist={
                    addTrackToPlaylist || (isParent && ytStatus.connected)
                      ? () => setAddToPlaylistTrack(visibleCurrent)
                      : undefined
                  }
                  onOpenSleepTimer={setSleepTimer ? () => setSleepModalOpen(true) : undefined}
                  onCreateStation={() => void handleCreateStation(visibleCurrent)}
                  onSelectArtist={(artist) =>
                    void openArtistProfile(artist, visibleCurrent.artworkUrl)
                  }
                />

                {similarTracks.length > 0 ? (
                  <SimilarTracksShelf
                    tracks={similarTracks}
                    tokens={tokens}
                    currentTrackTitle={visibleCurrent.title}
                    onPlay={(track, list) => void play(track, list)}
                    onQueue={(track) => addToQueue(track)}
                    onPlayNext={playNext ? (track) => playNext(track) : undefined}
                    onSelectArtist={(artist) => void openArtistProfile(artist)}
                  />
                ) : null}

                <StationsShelf
                  stations={MUSIC_STATIONS}
                  tokens={tokens}
                  onSelectStation={(st) => void selectStation(st)}
                />
              </>
            ) : null}

            {mode === "lyrics" ? (
              <LyricsPane
                lines={lyrics}
                activeIndex={activeLine}
                positionMs={Math.max(0, Math.round(clockPosition * 1000))}
                tokens={tokens}
                reduceMotion={reduceMotion}
                onSeek={casting ? (seconds) => void cast.seek(seconds) : (seconds) => void seek(seconds)}
              />
            ) : null}

            {mode === "queue" ? (
              <QueuePane
                queue={visibleQueue}
                currentTrackId={visibleCurrent.id}
                history={visibleHistory}
                tokens={tokens}
                shuffle={shuffle}
                repeat={repeat}
                onToggleShuffle={toggleShuffleMode}
                onCycleRepeat={cycleRepeatMode}
                onPlay={(track, list) => void play(track, list)}
                onRemove={(index) => removeFromQueue(index)}
                onMove={(from, to) => moveQueueItem(from, to)}
                onPlayNext={playNext ? (track) => playNext(track) : undefined}
                onClearQueue={clearQueue}
                onSaveQueueAsPlaylist={
                  createPlaylist ? () => openPlaylistCreator(visibleQueue) : undefined
                }
              />
            ) : null}

            {mode === "library" ? (
              <View style={{ gap: tokens.shelfGap }}>
                <SegmentedControl
                  testID="music-library-filter"
                  accessibilityLabel="Library view filter"
                  options={[
                    { id: "all", label: "Overview" },
                    { id: "artists", label: "Artists" },
                    { id: "mixes", label: "Mixes" },
                    { id: "history", label: "History" },
                    { id: "downloads", label: "Downloads" },
                  ]}
                  value={libraryTab}
                  onChange={(id) => setLibraryTab(id as LibraryTab)}
                />

                {libraryTab === "all" || libraryTab === "artists" ? (
                  <>
                    <FavoriteArtistsShelf
                      favorites={favoriteArtists}
                      tokens={tokens}
                      onSelectArtist={(artist) => void openArtistProfile(artist)}
                      onToggleFavorite={(artist) => handleToggleFavoriteArtist(artist)}
                    />
                    <RecommendedArtistsShelf
                      recommendations={recommendedArtists}
                      favorites={favoriteArtists}
                      tokens={tokens}
                      onSelectArtist={(artist) => void openArtistProfile(artist)}
                      onToggleFavorite={(artist) => handleToggleFavoriteArtist(artist)}
                    />
                  </>
                ) : null}

                {libraryTab === "all" || libraryTab === "mixes" ? (
                  <FamilyMixesShelf
                    mixes={FAMILY_MIXES}
                    likedCount={visibleLiked.length}
                    customPlaylists={visiblePlaylists}
                    youtubeConnected={ytStatus.connected}
                    youtubePlaylists={visibleYouTubePlaylists}
                    isParent={isParent}
                    tokens={tokens}
                    onSelectMix={(m) => void selectMix(m)}
                    onPlayLikedSongs={() => {
                      if (visibleLiked.length > 0) {
                        void play(visibleLiked[0], visibleLiked);
                        setMode("stage");
                      }
                    }}
                    onOpenPlaylist={(pl) => setSelectedPlaylistId(pl.id)}
                    onOpenCreatePlaylist={createPlaylist ? () => openPlaylistCreator([]) : undefined}
                    onOpenYouTubeConnect={isParent ? () => setYtModalOpen(true) : undefined}
                    onOpenYouTubePlaylist={(ytPl) =>
                      void openCollection({
                        browseId: ytPl.id,
                        kind: "playlist",
                        title: ytPl.title,
                        subtitle: `${ytPl.itemCount} songs`,
                        artist: ytStatus.accountEmail ?? "YouTube Account",
                        artworkUrl: ytPl.artworkUrl,
                        isRemoteAccount: true,
                      })
                    }
                  />
                ) : null}

                {(libraryTab === "all" || libraryTab === "history") && visibleHistory.length > 0 ? (
                  <HistoryShelf
                    history={visibleHistory}
                    tokens={tokens}
                    onPlay={(track, list) => void play(track, list)}
                    onPlayNext={playNext ? (track) => playNext(track) : undefined}
                  />
                ) : null}

                {(libraryTab === "all" || libraryTab === "downloads") && visibleDownloads.length > 0 ? (
                  <DownloadsTray
                    downloads={visibleDownloads}
                    tokens={tokens}
                    onRemove={(id) => void removeDownload(id)}
                  />
                ) : null}
              </View>
            ) : null}

            {error ? (
              <Text style={{ color: colors["color-accent-rose"], fontSize: TYPOGRAPHY.body.fontSize, lineHeight: TYPOGRAPHY.body.lineHeight }}>
                {error}
              </Text>
            ) : null}

            {mode !== "library" && visibleDownloads.length > 0 ? (
              <DownloadsTray
                downloads={visibleDownloads}
                tokens={tokens}
                onRemove={(id) => void removeDownload(id)}
              />
            ) : null}
          </>
        ) : (
          <>
            {!hasSearched ? (
              <>
                {visibleHistory.length > 0 ? (
                  <HistoryShelf
                    history={visibleHistory}
                    tokens={tokens}
                    onPlay={(track, list) => void play(track, list)}
                    onPlayNext={playNext ? (track) => playNext(track) : undefined}
                  />
                ) : null}

                <StationsShelf
                  stations={MUSIC_STATIONS}
                  tokens={tokens}
                  onSelectStation={(st) => void selectStation(st)}
                />

                <FamilyMixesShelf
                  mixes={FAMILY_MIXES}
                  likedCount={visibleLiked.length}
                  customPlaylists={visiblePlaylists}
                  youtubeConnected={ytStatus.connected}
                  youtubePlaylists={visibleYouTubePlaylists}
                  isParent={isParent}
                  tokens={tokens}
                  onSelectMix={(m) => void selectMix(m)}
                  onPlayLikedSongs={() => {
                    if (visibleLiked.length > 0) {
                      void play(visibleLiked[0], visibleLiked);
                      setMode("stage");
                    }
                  }}
                  onOpenPlaylist={(pl) => setSelectedPlaylistId(pl.id)}
                  onOpenCreatePlaylist={createPlaylist ? () => openPlaylistCreator([]) : undefined}
                  onOpenYouTubeConnect={isParent ? () => setYtModalOpen(true) : undefined}
                  onOpenYouTubePlaylist={(ytPl) =>
                    void openCollection({
                      browseId: ytPl.id,
                      kind: "playlist",
                      title: ytPl.title,
                      subtitle: `${ytPl.itemCount} songs`,
                      artist: ytStatus.accountEmail ?? "YouTube Account",
                      artworkUrl: ytPl.artworkUrl,
                      isRemoteAccount: true,
                    })
                  }
                />

                <FavoriteArtistsShelf
                  favorites={favoriteArtists}
                  tokens={tokens}
                  onSelectArtist={(artist) => void openArtistProfile(artist)}
                  onToggleFavorite={(artist) => handleToggleFavoriteArtist(artist)}
                />

                <RecommendedArtistsShelf
                  recommendations={recommendedArtists}
                  favorites={favoriteArtists}
                  tokens={tokens}
                  onSelectArtist={(artist) => void openArtistProfile(artist)}
                  onToggleFavorite={(artist) => handleToggleFavoriteArtist(artist)}
                />
              </>
            ) : visibleHistory.length > 0 ? (
              <HistoryShelf
                history={visibleHistory}
                tokens={tokens}
                onPlay={(track, list) => void play(track, list)}
                onPlayNext={playNext ? (track) => playNext(track) : undefined}
              />
            ) : null}
          </>
        )}
      </ScrollView>

      {activeArtist ? (
        <ArtistModal
          visible={artistModalOpen}
          artistName={activeArtist.name}
          artworkUrl={activeArtist.artworkUrl}
          tracks={visibleModalArtistTracks}
          profile={visibleModalArtistProfile}
          loading={loadingArtistTracks}
          isFavorite={isFavoriteArtist(favoriteArtists, activeArtist.name)}
          isParent={isParent}
          denied={policy.denied ?? []}
          tokens={tokens}
          isLiked={isLiked}
          onToggleLike={toggleLike ? handleToggleLikeWithSync : undefined}
          onAddToPlaylist={
            addTrackToPlaylist || (isParent && ytStatus.connected)
              ? (track) => setAddToPlaylistTrack(track)
              : undefined
          }
          onClose={() => setArtistModalOpen(false)}
          onToggleFavorite={() => handleToggleFavoriteArtist(activeArtist.name, activeArtist.artworkUrl)}
          onPlayAll={() => {
            if (visibleModalArtistTracks.length > 0) {
              void play(visibleModalArtistTracks[0], visibleModalArtistTracks);
              setArtistModalOpen(false);
              setMode("stage");
            }
          }}
          onShuffle={() => {
            if (visibleModalArtistTracks.length > 0) {
              const shuffled = [...visibleModalArtistTracks].sort(() => Math.random() - 0.5);
              void play(shuffled[0], shuffled);
              setArtistModalOpen(false);
              setMode("stage");
            }
          }}
          onStartRadio={() => {
            void (async () => {
              setArtistModalOpen(false);
              setSearching(true);
              try {
                const outcome = await engineSearch(`${activeArtist.name} radio`, 25);
                const vis = visibleTracks(outcome.tracks, stablePolicy);
                if (vis.length > 0) {
                  await play(vis[0], vis);
                  setMode("stage");
                }
              } finally {
                setSearching(false);
              }
            })();
          }}
          onPlayTrack={(track) => {
            void play(track, visibleModalArtistTracks);
            setArtistModalOpen(false);
            setMode("stage");
          }}
          onQueueTrack={(track) => {
            addToQueue(track);
          }}
          onPlayNextTrack={playNext ? (track) => playNext(track) : undefined}
          onSelectAlbum={(alb) => {
            setArtistModalOpen(false);
            void openCollection({
              browseId: alb.browseId,
              kind: "album",
              title: alb.title,
              subtitle: alb.subtitle,
              artist: alb.artist || activeArtist.name,
              artworkUrl: alb.artworkUrl,
            });
          }}
          onSelectPlaylist={(pl) => {
            setArtistModalOpen(false);
            void openCollection({
              browseId: pl.browseId,
              kind: "playlist",
              title: pl.title,
              subtitle: pl.subtitle,
              artist: pl.author || activeArtist.name,
              artworkUrl: pl.artworkUrl,
            });
          }}
          onSelectArtist={(sim) => void openArtistProfile(sim.name, sim.artworkUrl, sim.browseId)}
        />
      ) : null}

      {activeCollection ? (
        <CollectionDetailModal
          visible={true}
          title={activeCollection.title}
          subtitle={activeCollection.subtitle}
          artist={activeCollection.artist}
          kind={activeCollection.kind}
          artworkUrl={activeCollection.artworkUrl}
          tracks={visibleCollectionTracks}
          noteText={collectionNote?.text ?? null}
          loading={collectionLoading}
          isRemoteAccount={activeCollection.isRemoteAccount}
          isParent={isParent}
          denied={policy.denied ?? []}
          tokens={tokens}
          isLiked={isLiked}
          onPlayAll={() => {
            if (visibleCollectionTracks.length > 0) {
              void play(visibleCollectionTracks[0], visibleCollectionTracks);
              setActiveCollection(null);
              setMode("stage");
            }
          }}
          onShuffle={() => {
            if (visibleCollectionTracks.length > 0) {
              const shuffled = [...visibleCollectionTracks].sort(() => Math.random() - 0.5);
              void play(shuffled[0], shuffled);
              setActiveCollection(null);
              setMode("stage");
            }
          }}
          onQueueAll={() => {
            visibleCollectionTracks.forEach((t) => addToQueue(t));
            setActiveCollection(null);
          }}
          onSaveToHousehold={
            createPlaylist && !activeCollection.isRemoteAccount
              ? () => {
                  setActiveCollection(null);
                  openPlaylistCreator(visibleCollectionTracks);
                }
              : undefined
          }
          onRefreshRemote={
            activeCollection.isRemoteAccount
              ? () =>
                  void openCollection({
                    browseId: activeCollection.browseId,
                    kind: "playlist",
                    title: activeCollection.title,
                    subtitle: activeCollection.subtitle,
                    artist: activeCollection.artist,
                    artworkUrl: activeCollection.artworkUrl,
                    isRemoteAccount: true,
                  })
              : undefined
          }
          onPlayTrack={(track) => {
            void play(track, visibleCollectionTracks);
            setActiveCollection(null);
            setMode("stage");
          }}
          onQueueTrack={(track) => addToQueue(track)}
          onPlayNextTrack={playNext ? (track) => playNext(track) : undefined}
          onToggleLike={toggleLike ? handleToggleLikeWithSync : undefined}
          onAddToPlaylist={
            addTrackToPlaylist || (isParent && ytStatus.connected)
              ? (track) => setAddToPlaylistTrack(track)
              : undefined
          }
          onRemoveRemoteTrack={
            isParent && activeCollection.isRemoteAccount
              ? (playlistItemId) => {
                  const plId = activeCollection.browseId;
                  void removeTrackFromRemoteYouTubePlaylist(plId, playlistItemId)
                    .then(() => {
                      setActiveCollection((prev) =>
                        prev && prev.browseId === plId
                          ? { ...prev, rawTracks: prev.rawTracks.filter((r) => r.playlistItemId !== playlistItemId) }
                          : prev
                      );
                      void refreshYouTubeState(true);
                    })
                    .catch(() => {});
                }
              : undefined
          }
          onClose={() => setActiveCollection(null)}
        />
      ) : null}

      <SleepTimerModal
        visible={sleepModalOpen}
        remainingMinutes={sleepRemainingMinutes}
        tokens={tokens}
        onSelectMinutes={(mins) => setSleepTimer?.(mins)}
        onClose={() => setSleepModalOpen(false)}
      />

      <CreatePlaylistModal
        visible={createPlaylistOpen}
        tokens={tokens}
        initialTrackCount={createPlaylistSeed.length}
        canCreateOnYouTube={isParent && ytStatus.connected}
        onCreate={(name, emoji, alsoYouTube) => {
          createPlaylist?.(name, emoji, createPlaylistSeed);
          if (alsoYouTube && isParent && ytStatus.connected) {
            void createRemoteYouTubePlaylist(name)
              .then(async (remotePl) => {
                for (const t of createPlaylistSeed) {
                  await addTrackToRemoteYouTubePlaylist(remotePl.id, t.id).catch(() => {});
                }
                await refreshYouTubeState(true);
              })
              .catch(() => {});
          }
        }}
        onClose={() => {
          setCreatePlaylistOpen(false);
          setCreatePlaylistSeed([]);
        }}
      />

      <AddToPlaylistModal
        visible={addToPlaylistTrack !== null}
        track={addToPlaylistTrack}
        playlists={visiblePlaylists}
        isParent={isParent}
        youtubeConnected={ytStatus.connected}
        youtubePlaylists={visibleYouTubePlaylists}
        tokens={tokens}
        onSelectPlaylist={(playlistId, track) => {
          addTrackToPlaylist?.(playlistId, track);
        }}
        onSelectYouTubePlaylist={async (playlistId, track) => {
          await addTrackToRemoteYouTubePlaylist(playlistId, track.id);
          await refreshYouTubeState(true);
        }}
        onOpenCreateNew={() => {
          openPlaylistCreator(addToPlaylistTrack ? [addToPlaylistTrack] : []);
        }}
        onClose={() => setAddToPlaylistTrack(null)}
      />

      {isParent ? (
        <YouTubeAccountModal
          visible={ytModalOpen}
          status={ytStatus}
          busy={ytBusy}
          error={ytError}
          tokens={tokens}
          onStartConnect={() => {
            setYtBusy(true);
            setYtError(null);
            void startYouTubeConnect()
              .then(async ({ authUrl }) => {
                setYtStatus((prev) => ({ ...prev, pending: true, status: "INITIATED" }));
                await Linking.openURL(authUrl);
              })
              .catch((e: unknown) => {
                setYtError(e instanceof Error ? e.message : "Could not start YouTube connection.");
              })
              .finally(() => setYtBusy(false));
          }}
          onCheckStatus={() => {
            setYtBusy(true);
            setYtError(null);
            void checkYouTubeConnectStatus()
              .then(async (nextState) => {
                setYtStatus(nextState);
                if (nextState.connected) {
                  const list = await fetchYouTubePlaylists();
                  setYtPlaylists(list);
                }
              })
              .catch((e: unknown) => {
                setYtError(e instanceof Error ? e.message : "Could not check YouTube status.");
              })
              .finally(() => setYtBusy(false));
          }}
          onSyncNow={() => {
            setYtBusy(true);
            setYtError(null);
            void refreshYouTubeState(true)
              .catch((e: unknown) => {
                setYtError(e instanceof Error ? e.message : "Could not sync playlists.");
              })
              .finally(() => setYtBusy(false));
          }}
          onDisconnect={() => {
            setYtBusy(true);
            setYtError(null);
            void disconnectYouTubeAccount()
              .then(() => {
                setYtStatus({ connected: false, pending: false, status: null, accountEmail: null });
                setYtPlaylists([]);
                setYtModalOpen(false);
              })
              .catch((e: unknown) => {
                setYtError(e instanceof Error ? e.message : "Could not disconnect YouTube.");
              })
              .finally(() => setYtBusy(false));
          }}
          onClose={() => {
            if (!ytBusy) {
              setYtError(null);
              setYtModalOpen(false);
            }
          }}
        />
      ) : null}

      <PlaylistDetailModal
        visible={selectedPlaylist !== null}
        playlist={selectedPlaylist}
        tokens={tokens}
        onPlayAll={(list) => {
          if (list.length > 0) {
            void play(list[0], list);
            setSelectedPlaylistId(null);
            setMode("stage");
          }
        }}
        onShuffle={(list) => {
          if (list.length > 0) {
            const shuffled = [...list].sort(() => Math.random() - 0.5);
            void play(shuffled[0], shuffled);
            setSelectedPlaylistId(null);
            setMode("stage");
          }
        }}
        onPlayTrack={(track, list) => {
          void play(track, list);
          setSelectedPlaylistId(null);
          setMode("stage");
        }}
        onRemoveTrack={(playlistId, trackIdToRemove) => {
          removeTrackFromPlaylist?.(playlistId, trackIdToRemove);
        }}
        onDeletePlaylist={(playlistId) => {
          deletePlaylist?.(playlistId);
        }}
        onClose={() => setSelectedPlaylistId(null)}
      />

      {isParent ? (
        <DenyListModal
          visible={denyOpen}
          denylist={denylist}
          denyTerm={denyTerm}
          tokens={tokens}
          onChangeTerm={setDenyTerm}
          onAddTerm={addDenyTerm}
          onRemoveTerm={(term) => void removeDenied(term)}
          onClose={() => setDenyOpen(false)}
        />
      ) : null}

      <MusicParentPinModal
        visible={parentPinOpen}
        busy={parentPinBusy}
        error={parentPinError}
        attempt={parentPinAttempt}
        onVerified={(pin) => {
          if (!unlockMusicParent || parentPinBusy) return;
          setParentPinBusy(true);
          setParentPinError(null);
          void unlockMusicParent(pin)
            .then(() => {
              setParentPinOpen(false);
              setParentPinError(null);
            })
            .catch((e: unknown) => {
              setParentPinError(e instanceof Error ? e.message : "Parent PIN required.");
              setParentPinAttempt((n) => n + 1);
            })
            .finally(() => {
              setParentPinBusy(false);
            });
        }}
        onCancel={() => {
          if (!parentPinBusy) {
            setParentPinOpen(false);
            setParentPinError(null);
          }
        }}
      />
    </>
  );
}

export default MusicPlayer;
