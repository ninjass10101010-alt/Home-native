import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  artworkBlurred,
  artworkColors,
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
} from "./MusicBrowse";
import { MusicIcon } from "./MusicIcons";
import {
  AddToPlaylistModal,
  ArtistModal,
  CreatePlaylistModal,
  DenyListModal,
  MusicParentPinModal,
  PlaylistDetailModal,
  SleepTimerModal,
} from "./MusicLibraryModals";
import { DownloadsTray, HistoryShelf, LyricsPane, QueuePane } from "./MusicQueueLyrics";
import { NowPlayingStage, StageMiniBar } from "./MusicStage";
import { countUnrated, isContentHidden, searchNote, visibleTracks } from "./explicit";
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
import type { FavoriteArtist, MediaTrack } from "./types";

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
  const [activeArtist, setActiveArtist] = React.useState<{ name: string; artworkUrl?: string | null } | null>(null);
  const [artistTracks, setArtistTracks] = React.useState<MediaTrack[]>([]);
  const [loadingArtistTracks, setLoadingArtistTracks] = React.useState(false);
  const [artistModalOpen, setArtistModalOpen] = React.useState(false);
  const [libraryTab, setLibraryTab] = React.useState<LibraryTab>("all");

  const [favoriteArtists, setFavoriteArtists] = React.useState<FavoriteArtist[]>([]);
  const [recentSearches, setRecentSearches] = React.useState<string[]>([]);
  const [submittedQuery, setSubmittedQuery] = React.useState("");
  const liveSearchTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSearchedTermRef = React.useRef("");

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
    async (artistName: string, artworkUrl?: string | null) => {
      const trimmed = artistName.trim();
      if (!trimmed) return;
      setActiveArtist({ name: trimmed, artworkUrl: artworkUrl ?? null });
      setLoadingArtistTracks(true);
      setArtistModalOpen(true);
      try {
        const outcome = await engineSearch(trimmed, 25);
        const vis = visibleTracks(outcome.tracks, policy);
        setArtistTracks(vis);
        if (vis.length > 0 && typeof prefetchAudio === "function") {
          void prefetchAudio(vis[0].id);
        }
      } catch {
        setArtistTracks([]);
      } finally {
        setLoadingArtistTracks(false);
      }
    },
    [policy]
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
  const note =
    hasSearched && !searching && !searchError
      ? searchNote({ visible: visible.length, total: tracks.length, unrated, explicitKnown, isParent })
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
      lastSearchedTermRef.current = term;
      if (options?.markSubmitted !== false) {
        setSubmittedQuery(term);
      }
      if (options?.saveRecent !== false) {
        void saveRecentSearch(term).then((updated) => setRecentSearches(updated));
      }
      setSearching(true);
      setSearchError(null);
      try {
        const outcome = await engineSearch(term, 20);
        setTracks(outcome.tracks);
        setExplicitKnown(outcome.explicitKnown);
        setHasSearched(true);
        const vis = visibleTracks(outcome.tracks, policy);
        if (vis.length > 0 && typeof prefetchAudio === "function") {
          void prefetchAudio(vis[0].id);
        }
      } catch (e) {
        setSearchError(e instanceof Error ? e.message : "search_failed");
        setTracks([]);
        setExplicitKnown(false);
        setHasSearched(true);
      } finally {
        setSearching(false);
      }
    },
    [policy]
  );

  const search = async () => {
    await runSearch(query, { saveRecent: true, markSubmitted: true });
  };

  const handleClearSearch = () => {
    if (liveSearchTimerRef.current) {
      clearTimeout(liveSearchTimerRef.current);
      liveSearchTimerRef.current = null;
    }
    lastSearchedTermRef.current = "";
    setSubmittedQuery("");
    setQuery("");
    setTracks([]);
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

            {visible.length > 0 ? (
              <SearchResults
                tracks={visible}
                tokens={tokens}
                isParent={isParent}
                denied={policy.denied ?? []}
                onPlay={(track, list) => void play(track, list)}
                onQueue={(track) => addToQueue(track)}
                onPlayNext={playNext ? (track) => playNext(track) : undefined}
                isLiked={isLiked}
                onToggleLike={toggleLike ? (track) => toggleLike(track) : undefined}
                onAddToPlaylist={addTrackToPlaylist ? (track) => setAddToPlaylistTrack(track) : undefined}
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
                  onToggleLike={toggleLike ? () => toggleLike(visibleCurrent) : undefined}
                  sleepRemainingMinutes={sleepRemainingMinutes}
                  onOpenLyrics={() => setMode("lyrics")}
                  onOpenQueue={() => setMode("queue")}
                  onOpenAddToPlaylist={
                    addTrackToPlaylist ? () => setAddToPlaylistTrack(visibleCurrent) : undefined
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
          tracks={artistTracks}
          loading={loadingArtistTracks}
          isFavorite={isFavoriteArtist(favoriteArtists, activeArtist.name)}
          tokens={tokens}
          onClose={() => setArtistModalOpen(false)}
          onToggleFavorite={() => handleToggleFavoriteArtist(activeArtist.name, activeArtist.artworkUrl)}
          onPlayAll={() => {
            if (artistTracks.length > 0) {
              void play(artistTracks[0], artistTracks);
              setArtistModalOpen(false);
              setMode("stage");
            }
          }}
          onShuffle={() => {
            if (artistTracks.length > 0) {
              const shuffled = [...artistTracks].sort(() => Math.random() - 0.5);
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
                const vis = visibleTracks(outcome.tracks, policy);
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
            void play(track, artistTracks);
            setArtistModalOpen(false);
            setMode("stage");
          }}
          onQueueTrack={(track) => {
            addToQueue(track);
          }}
          onPlayNextTrack={playNext ? (track) => playNext(track) : undefined}
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
        onCreate={(name, emoji) => {
          createPlaylist?.(name, emoji, createPlaylistSeed);
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
        tokens={tokens}
        onSelectPlaylist={(playlistId, track) => {
          addTrackToPlaylist?.(playlistId, track);
        }}
        onOpenCreateNew={() => {
          openPlaylistCreator(addToPlaylistTrack ? [addToPlaylistTrack] : []);
        }}
        onClose={() => setAddToPlaylistTrack(null)}
      />

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
