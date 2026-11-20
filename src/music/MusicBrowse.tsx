import React from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../theme/ThemeProvider";
import { hapticSelect, hapticTap } from "../theme/haptics";
import { mix } from "../theme/mix";
import type { MusicTokens } from "../theme/music-tokens";
import { TYPOGRAPHY } from "../theme/tokens";
import { MusicIcon, type MusicIconName } from "./MusicIcons";
import { ArtworkThumb, PanelCard } from "./MusicQueueLyrics";
import { toHighResArtworkUrl } from "./artwork";
import { isDeniedTerm } from "./explicit";
import { isFavoriteArtist } from "./library";
import type { FamilyMix, MusicStation } from "./stations";
import type { SearchSuggestion } from "./suggestions";
import type {
  ArtistProfile,
  FamilyPlaylist,
  FavoriteArtist,
  MediaTrack,
  MusicAlbumSummary,
  MusicArtistSummary,
  MusicPlaylistSummary,
  RecommendedArtist,
  YouTubeAccountPlaylist,
} from "./types";

function suggestionIcon(kind: SearchSuggestion["kind"]): MusicIconName {
  switch (kind) {
    case "recent":
      return "clock";
    case "artist":
      return "star";
    case "station":
      return "radio";
    case "mix":
      return "sparkles";
    case "track":
    default:
      return "music";
  }
}

export const SearchSuggestionsStrip = React.memo(function SearchSuggestionsStrip({
  testID,
  title,
  suggestions,
  tokens,
  onSelect,
  onClearRecent,
}: {
  testID: string;
  title: string;
  suggestions: SearchSuggestion[];
  tokens: MusicTokens;
  onSelect: (suggestion: SearchSuggestion) => void;
  onClearRecent?: () => void;
}) {
  if (suggestions.length === 0) return null;
  return (
    <View
      testID={testID}
      style={{
        backgroundColor: tokens.panel,
        borderRadius: tokens.panelRadius,
        borderWidth: 1,
        borderColor: tokens.panelRim,
        padding: 14,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ color: tokens.label2, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
          {title}
        </Text>
        {onClearRecent ? (
          <Pressable
            testID="music-clear-recent-searches"
            accessibilityRole="button"
            accessibilityLabel="Clear recent searches"
            hitSlop={12}
            onPress={() => {
              hapticTap();
              onClearRecent();
            }}
            style={{ minHeight: 44, paddingHorizontal: 10, justifyContent: "center" }}
          >
            <Text style={{ color: tokens.accent, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
              Clear
            </Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: 10 }}
      >
        {suggestions.map((item) => (
          <Pressable
            key={item.id}
            testID={`music-search-suggestion-${item.id}`}
            accessibilityRole="button"
            accessibilityLabel={`Search ${item.label}`}
            onPress={() => {
              hapticTap();
              onSelect(item);
            }}
            style={{
              minHeight: 64,
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: tokens.panelRim,
              backgroundColor: tokens.sheet,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            <MusicIcon name={suggestionIcon(item.kind)} size={18} color={tokens.accent} />
            <View>
              <Text numberOfLines={1} style={{ color: tokens.label, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
                {item.label}
              </Text>
              <Text numberOfLines={1} style={{ color: tokens.label3, fontSize: TYPOGRAPHY.label.fontSize }}>
                {item.subtitle}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
});

export function ArtworkLead({
  testID,
  track,
  tokens,
}: {
  testID: string;
  track: { artworkUrl: string | null };
  tokens: MusicTokens;
}) {
  return (
    <View
      testID={testID}
      style={{
        width: 120,
        height: 120,
        borderRadius: tokens.artworkRadius,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: tokens.grouped,
      }}
    >
      {track.artworkUrl ? (
        <Image
          source={{ uri: toHighResArtworkUrl(track.artworkUrl) ?? track.artworkUrl }}
          style={{ width: 120, height: 120 }}
          resizeMode="cover"
        />
      ) : (
        <MusicIcon name="music" size={40} color={tokens.label} />
      )}
    </View>
  );
}

export function Marker({
  testID,
  label,
  tokens,
  accent,
}: {
  testID: string;
  label: string;
  tokens: MusicTokens;
  accent?: boolean;
}) {
  return (
    <View
      testID={testID}
      style={{
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: accent ? tokens.accent : tokens.panelRim,
      }}
    >
      <Text style={{ color: tokens.label2, fontSize: TYPOGRAPHY.label.fontSize, lineHeight: TYPOGRAPHY.label.lineHeight, fontWeight: "600" }}>
        {label}
      </Text>
    </View>
  );
}

export type SearchCategoryFilter = "all" | "songs" | "artists" | "albums" | "playlists";

const SEARCH_FILTER_TABS: readonly { id: SearchCategoryFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "songs", label: "Songs" },
  { id: "artists", label: "Artists" },
  { id: "albums", label: "Albums" },
  { id: "playlists", label: "Playlists" },
];

export const SearchResults = React.memo(function SearchResults({
  tracks,
  tokens,
  isParent,
  denied,
  topArtist = null,
  artists = [],
  albums = [],
  playlists = [],
  artistProfile = null,
  loadingArtistProfile = false,
  searchFilter = "all",
  onChangeFilter,
  isFavoriteArtistFn,
  onToggleFavoriteArtist,
  onSelectArtist,
  onSelectAlbum,
  onSelectPlaylist,
  onPlay,
  onQueue,
  onPlayNext,
  isLiked,
  onToggleLike,
  onAddToPlaylist,
}: {
  tracks: MediaTrack[];
  tokens: MusicTokens;
  isParent: boolean;
  denied: string[];
  topArtist?: MusicArtistSummary | null;
  artists?: MusicArtistSummary[];
  albums?: MusicAlbumSummary[];
  playlists?: MusicPlaylistSummary[];
  artistProfile?: ArtistProfile | null;
  loadingArtistProfile?: boolean;
  searchFilter?: SearchCategoryFilter;
  onChangeFilter?: (filter: SearchCategoryFilter) => void;
  isFavoriteArtistFn?: (name: string) => boolean;
  onToggleFavoriteArtist?: (name: string, artworkUrl?: string | null) => void;
  onSelectArtist?: (artist: { name: string; artworkUrl?: string | null; browseId?: string }) => void;
  onSelectAlbum?: (album: MusicAlbumSummary) => void;
  onSelectPlaylist?: (playlist: MusicPlaylistSummary) => void;
  onPlay: (track: MediaTrack, list: MediaTrack[]) => void;
  onQueue: (track: MediaTrack) => void;
  onPlayNext?: (track: MediaTrack) => void;
  isLiked?: (trackId: string) => boolean;
  onToggleLike?: (track: MediaTrack) => void;
  onAddToPlaylist?: (track: MediaTrack) => void;
}) {
  const hasRichSections =
    Boolean(topArtist) || artists.length > 0 || albums.length > 0 || playlists.length > 0;

  const mergedAlbums = React.useMemo(() => {
    const out: MusicAlbumSummary[] = [];
    const seen = new Set<string>();
    const addAll = (items: readonly MusicAlbumSummary[] | undefined) => {
      if (!items) return;
      for (const a of items) {
        if (!seen.has(a.browseId)) {
          seen.add(a.browseId);
          out.push(a);
        }
      }
    };
    addAll(artistProfile?.albums);
    addAll(artistProfile?.singles);
    addAll(albums);
    return out;
  }, [artistProfile, albums]);

  const mergedPlaylists = React.useMemo(() => {
    const out: MusicPlaylistSummary[] = [];
    const seen = new Set<string>();
    const addAll = (items: readonly MusicPlaylistSummary[] | undefined) => {
      if (!items) return;
      for (const p of items) {
        if (!seen.has(p.browseId)) {
          seen.add(p.browseId);
          out.push(p);
        }
      }
    };
    addAll(artistProfile?.playlists);
    addAll(playlists);
    return out;
  }, [artistProfile, playlists]);

  const mergedArtists = React.useMemo(() => {
    const out: MusicArtistSummary[] = [];
    const seen = new Set<string>();
    if (topArtist) seen.add(topArtist.browseId);
    for (const a of [...artists, ...(artistProfile?.relatedArtists ?? [])]) {
      if (!seen.has(a.browseId)) {
        seen.add(a.browseId);
        out.push(a);
      }
    }
    return out;
  }, [topArtist, artists, artistProfile]);

  const popularTracks = React.useMemo(() => {
    if (!topArtist) return tracks;
    const base =
      artistProfile && artistProfile.topSongs.length > 0 ? artistProfile.topSongs : tracks;
    const out: MediaTrack[] = [];
    const seen = new Set<string>();
    for (const t of [...base, ...tracks]) {
      if (!seen.has(t.id)) {
        seen.add(t.id);
        out.push(t);
      }
    }
    return out;
  }, [topArtist, artistProfile, tracks]);

  const showSongs = searchFilter === "all" || searchFilter === "songs";
  const showArtists = searchFilter === "all" || searchFilter === "artists";
  const showAlbums = searchFilter === "all" || searchFilter === "albums";
  const showPlaylists = searchFilter === "all" || searchFilter === "playlists";

  const [top, ...rest] = tracks;

  return (
    <View style={{ gap: tokens.shelfGap }}>
      {hasRichSections && onChangeFilter ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {SEARCH_FILTER_TABS.map((tab) => {
            const active = searchFilter === tab.id;
            return (
              <Pressable
                key={tab.id}
                testID={`music-search-filter-${tab.id}`}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  hapticSelect();
                  onChangeFilter(tab.id);
                }}
                style={{
                  minHeight: 64,
                  minWidth: 64,
                  paddingHorizontal: 18,
                  borderRadius: 999,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: active ? tokens.accent : tokens.panelRim,
                  backgroundColor: active ? tokens.accent : tokens.panel,
                }}
              >
                <Text
                  style={{
                    color: active ? tokens.onAccent : tokens.label,
                    fontSize: TYPOGRAPHY.body.fontSize,
                    fontWeight: "700",
                  }}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {topArtist && showArtists ? (
        <ArtistHeroCard
          artist={topArtist}
          tokens={tokens}
          popularTracks={popularTracks}
          loading={loadingArtistProfile}
          isFavorite={isFavoriteArtistFn ? isFavoriteArtistFn(topArtist.name) : false}
          onPlayHits={() => {
            if (popularTracks.length > 0) {
              onPlay(popularTracks[0], popularTracks);
            } else {
              onSelectArtist?.(topArtist);
            }
          }}
          onToggleFavorite={
            onToggleFavoriteArtist
              ? () => onToggleFavoriteArtist(topArtist.name, topArtist.artworkUrl)
              : undefined
          }
          onOpenProfile={() => onSelectArtist?.(topArtist)}
        />
      ) : null}

      {topArtist ? (
        showSongs && popularTracks.length > 0 ? (
          <View style={{ gap: 8 }}>
            <Text
              style={{
                color: tokens.label,
                ...TYPOGRAPHY.title,
                fontWeight: "700",
                paddingHorizontal: 4,
              }}
            >
              Popular Songs
            </Text>
            <PanelCard testID="music-results" tokens={tokens}>
              {popularTracks.slice(0, searchFilter === "songs" ? 25 : 8).map((track, index) => (
                <ResultRow
                  key={track.id}
                  track={track}
                  list={popularTracks}
                  index={index}
                  tokens={tokens}
                  isParent={isParent}
                  denied={denied}
                  onPlay={onPlay}
                  onQueue={onQueue}
                  onPlayNext={onPlayNext}
                  liked={isLiked ? isLiked(track.id) : false}
                  onToggleLike={onToggleLike}
                  onAddToPlaylist={onAddToPlaylist}
                  onSelectArtist={
                    onSelectArtist && track.artist
                      ? () => onSelectArtist({ name: track.artist, artworkUrl: track.artworkUrl })
                      : undefined
                  }
                />
              ))}
            </PanelCard>
          </View>
        ) : null
      ) : showSongs && top ? (
        <>
          <TopResultCard
            track={top}
            list={tracks}
            tokens={tokens}
            isParent={isParent}
            denied={denied}
            onPlay={onPlay}
            onQueue={onQueue}
            onPlayNext={onPlayNext}
            liked={isLiked ? isLiked(top.id) : false}
            onToggleLike={onToggleLike}
            onAddToPlaylist={onAddToPlaylist}
            onSelectArtist={
              onSelectArtist && top.artist
                ? () => onSelectArtist({ name: top.artist, artworkUrl: top.artworkUrl })
                : undefined
            }
          />
          {rest.length > 0 ? (
            <PanelCard testID="music-results" tokens={tokens}>
              {rest.map((track, index) => (
                <ResultRow
                  key={track.id}
                  track={track}
                  list={tracks}
                  index={index}
                  tokens={tokens}
                  isParent={isParent}
                  denied={denied}
                  onPlay={onPlay}
                  onQueue={onQueue}
                  onPlayNext={onPlayNext}
                  liked={isLiked ? isLiked(track.id) : false}
                  onToggleLike={onToggleLike}
                  onAddToPlaylist={onAddToPlaylist}
                  onSelectArtist={
                    onSelectArtist && track.artist
                      ? () => onSelectArtist({ name: track.artist, artworkUrl: track.artworkUrl })
                      : undefined
                  }
                />
              ))}
            </PanelCard>
          ) : null}
        </>
      ) : null}

      {showAlbums && mergedAlbums.length > 0 && onSelectAlbum ? (
        <AlbumsCarousel
          title={topArtist ? "Albums & Singles" : "Albums"}
          albums={mergedAlbums}
          tokens={tokens}
          isParent={isParent}
          onSelectAlbum={onSelectAlbum}
        />
      ) : null}

      {showPlaylists && mergedPlaylists.length > 0 && onSelectPlaylist ? (
        <PlaylistsCarousel
          title="Playlists"
          playlists={mergedPlaylists}
          tokens={tokens}
          onSelectPlaylist={onSelectPlaylist}
        />
      ) : null}

      {showArtists && mergedArtists.length > 0 && onSelectArtist ? (
        <ArtistsCarousel
          title={topArtist ? "Related Artists" : "Artists"}
          artists={mergedArtists}
          tokens={tokens}
          onSelectArtist={(artist) => onSelectArtist(artist)}
        />
      ) : null}
    </View>
  );
});

function ArtistHeroCard({
  artist,
  tokens,
  popularTracks,
  loading,
  isFavorite,
  onPlayHits,
  onToggleFavorite,
  onOpenProfile,
}: {
  artist: MusicArtistSummary;
  tokens: MusicTokens;
  popularTracks: MediaTrack[];
  loading: boolean;
  isFavorite: boolean;
  onPlayHits: () => void;
  onToggleFavorite?: () => void;
  onOpenProfile: () => void;
}) {
  const initial = (artist.name[0] || "?").toUpperCase();
  return (
    <View
      testID="music-search-artist-hero"
      style={{
        backgroundColor: tokens.panel,
        borderRadius: tokens.panelRadius,
        borderWidth: 1,
        borderColor: tokens.panelRim,
        padding: 16,
        gap: 14,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open artist ${artist.name}`}
        onPress={onOpenProfile}
        style={{ flexDirection: "row", alignItems: "center", gap: 16, minHeight: 84 }}
      >
        <View
          style={{
            width: 88,
            height: 88,
            borderRadius: 44,
            overflow: "hidden",
            borderWidth: 2,
            borderColor: tokens.accent,
            backgroundColor: mix(tokens.accent, tokens.grouped, 22),
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {artist.artworkUrl ? (
            <Image
              source={{ uri: toHighResArtworkUrl(artist.artworkUrl) ?? artist.artworkUrl }}
              style={{ width: 88, height: 88 }}
              resizeMode="cover"
            />
          ) : (
            <Text style={{ color: tokens.label, fontSize: 32, fontWeight: "800" }}>{initial}</Text>
          )}
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text numberOfLines={2} style={{ color: tokens.label, ...TYPOGRAPHY.title, fontWeight: "800" }}>
            {artist.name}
          </Text>
          <Text numberOfLines={1} style={{ color: tokens.label3, ...TYPOGRAPHY.label }}>
            {artist.subtitle}
          </Text>
        </View>
      </Pressable>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <Pressable
          testID="music-search-hero-play"
          accessibilityRole="button"
          accessibilityLabel={`Play hits by ${artist.name}`}
          onPress={() => {
            hapticTap();
            onPlayHits();
          }}
          style={{
            minHeight: 64,
            paddingHorizontal: 22,
            borderRadius: tokens.panelRadius,
            backgroundColor: tokens.accent,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            opacity: popularTracks.length === 0 && loading ? 0.7 : 1,
          }}
        >
          <MusicIcon name="play" size={18} color={tokens.onAccent} filled />
          <Text style={{ color: tokens.onAccent, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "800" }}>
            Play Hits
          </Text>
        </Pressable>

        {onToggleFavorite ? (
          <Pressable
            testID="music-search-hero-fav"
            accessibilityRole="button"
            accessibilityLabel={isFavorite ? `Remove ${artist.name} from favorites` : `Favorite ${artist.name}`}
            onPress={() => {
              hapticSelect();
              onToggleFavorite();
            }}
            style={{
              minHeight: 64,
              minWidth: 64,
              paddingHorizontal: 18,
              borderRadius: tokens.panelRadius,
              borderWidth: 1,
              borderColor: isFavorite ? tokens.accent : tokens.panelRim,
              backgroundColor: isFavorite ? mix(tokens.accent, tokens.panel, 18) : tokens.sheet,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <MusicIcon name="star" size={18} color={isFavorite ? tokens.accent : tokens.label} filled={isFavorite} />
            <Text style={{ color: tokens.label, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
              {isFavorite ? "Favorited" : "Favorite"}
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          testID="music-search-hero-open"
          accessibilityRole="button"
          accessibilityLabel={`Browse ${artist.name} albums and playlists`}
          onPress={() => {
            hapticTap();
            onOpenProfile();
          }}
          style={{
            minHeight: 64,
            minWidth: 64,
            paddingHorizontal: 18,
            borderRadius: tokens.panelRadius,
            borderWidth: 1,
            borderColor: tokens.panelRim,
            backgroundColor: tokens.sheet,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <MusicIcon name="disc" size={18} color={tokens.label} />
          <Text style={{ color: tokens.label, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
            Albums & Playlists
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function AlbumsCarousel({
  title,
  albums,
  tokens,
  isParent,
  onSelectAlbum,
}: {
  title: string;
  albums: readonly MusicAlbumSummary[];
  tokens: MusicTokens;
  isParent: boolean;
  onSelectAlbum: (album: MusicAlbumSummary) => void;
}) {
  return (
    <View
      testID="music-search-albums-shelf"
      style={{
        backgroundColor: tokens.grouped,
        borderRadius: tokens.panelRadius,
        borderWidth: 1,
        borderColor: tokens.panelRim,
        padding: 16,
        gap: 12,
      }}
    >
      <Text style={{ color: tokens.label, ...TYPOGRAPHY.title, fontWeight: "700" }}>
        {title}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
        {albums.map((album) => {
          const meta = [album.albumType, album.year].filter(Boolean).join(" • ") || album.artist;
          return (
            <Pressable
              key={album.browseId}
              testID={`music-search-album-${album.browseId}`}
              accessibilityRole="button"
              accessibilityLabel={`Open ${album.albumType.toLowerCase()} ${album.title}`}
              onPress={() => {
                hapticTap();
                onSelectAlbum(album);
              }}
              style={{
                width: 176,
                backgroundColor: tokens.panel,
                borderRadius: tokens.panelRadius,
                borderWidth: 1,
                borderColor: tokens.panelRim,
                padding: 12,
                gap: 8,
              }}
            >
              <View
                style={{
                  width: 150,
                  height: 150,
                  borderRadius: tokens.artworkRadius,
                  overflow: "hidden",
                  backgroundColor: mix(tokens.accent, tokens.grouped, 18),
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {album.artworkUrl ? (
                  <Image
                    source={{ uri: toHighResArtworkUrl(album.artworkUrl) ?? album.artworkUrl }}
                    style={{ width: 150, height: 150 }}
                    resizeMode="cover"
                  />
                ) : (
                  <MusicIcon name="disc" size={44} color={tokens.accent} />
                )}
              </View>
              <Text numberOfLines={2} style={{ color: tokens.label, ...TYPOGRAPHY.body, fontWeight: "700" }}>
                {album.title}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                <Text numberOfLines={1} style={{ flex: 1, color: tokens.label3, ...TYPOGRAPHY.label }}>
                  {meta}
                </Text>
                {isParent && album.explicit === true ? (
                  <Marker testID={`music-album-explicit-${album.browseId}`} label="E" tokens={tokens} />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function PlaylistsCarousel({
  title,
  playlists,
  tokens,
  onSelectPlaylist,
}: {
  title: string;
  playlists: readonly MusicPlaylistSummary[];
  tokens: MusicTokens;
  onSelectPlaylist: (playlist: MusicPlaylistSummary) => void;
}) {
  return (
    <View
      testID="music-search-playlists-shelf"
      style={{
        backgroundColor: tokens.grouped,
        borderRadius: tokens.panelRadius,
        borderWidth: 1,
        borderColor: tokens.panelRim,
        padding: 16,
        gap: 12,
      }}
    >
      <Text style={{ color: tokens.label, ...TYPOGRAPHY.title, fontWeight: "700" }}>
        {title}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
        {playlists.map((pl) => (
          <Pressable
            key={pl.browseId}
            testID={`music-search-playlist-${pl.browseId}`}
            accessibilityRole="button"
            accessibilityLabel={`Open playlist ${pl.title}`}
            onPress={() => {
              hapticTap();
              onSelectPlaylist(pl);
            }}
            style={{
              width: 192,
              backgroundColor: tokens.panel,
              borderRadius: tokens.panelRadius,
              borderWidth: 1,
              borderColor: tokens.panelRim,
              padding: 12,
              gap: 8,
            }}
          >
            <View
              style={{
                width: 166,
                height: 124,
                borderRadius: tokens.artworkRadius,
                overflow: "hidden",
                backgroundColor: mix(tokens.accent, tokens.grouped, 18),
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {pl.artworkUrl ? (
                <Image
                  source={{ uri: toHighResArtworkUrl(pl.artworkUrl) ?? pl.artworkUrl }}
                  style={{ width: 166, height: 124 }}
                  resizeMode="cover"
                />
              ) : (
                <MusicIcon name="playlist" size={40} color={tokens.accent} />
              )}
            </View>
            <Text numberOfLines={2} style={{ color: tokens.label, ...TYPOGRAPHY.body, fontWeight: "700" }}>
              {pl.title}
            </Text>
            <Text numberOfLines={1} style={{ color: tokens.label3, ...TYPOGRAPHY.label }}>
              {pl.author || pl.subtitle || "YouTube Music"}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function ArtistsCarousel({
  title,
  artists,
  tokens,
  onSelectArtist,
}: {
  title: string;
  artists: readonly MusicArtistSummary[];
  tokens: MusicTokens;
  onSelectArtist: (artist: MusicArtistSummary) => void;
}) {
  return (
    <View
      testID="music-search-artists-shelf"
      style={{
        backgroundColor: tokens.grouped,
        borderRadius: tokens.panelRadius,
        borderWidth: 1,
        borderColor: tokens.panelRim,
        padding: 16,
        gap: 12,
      }}
    >
      <Text style={{ color: tokens.label, ...TYPOGRAPHY.title, fontWeight: "700" }}>
        {title}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
        {artists.map((art) => {
          const initial = (art.name[0] || "?").toUpperCase();
          return (
            <Pressable
              key={art.browseId}
              testID={`music-search-artist-${art.browseId}`}
              accessibilityRole="button"
              accessibilityLabel={`View artist ${art.name}`}
              onPress={() => {
                hapticTap();
                onSelectArtist(art);
              }}
              style={{
                width: 148,
                backgroundColor: tokens.panel,
                borderRadius: tokens.panelRadius,
                borderWidth: 1,
                borderColor: tokens.panelRim,
                padding: 12,
                alignItems: "center",
                gap: 8,
              }}
            >
              <View
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  overflow: "hidden",
                  borderWidth: 1,
                  borderColor: tokens.panelRim,
                  backgroundColor: mix(tokens.accent, tokens.grouped, 20),
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {art.artworkUrl ? (
                  <Image
                    source={{ uri: toHighResArtworkUrl(art.artworkUrl) ?? art.artworkUrl }}
                    style={{ width: 80, height: 80 }}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={{ color: tokens.label, fontSize: 28, fontWeight: "800" }}>{initial}</Text>
                )}
              </View>
              <Text numberOfLines={2} style={{ color: tokens.label, ...TYPOGRAPHY.body, fontWeight: "700", textAlign: "center" }}>
                {art.name}
              </Text>
              <Text numberOfLines={1} style={{ color: tokens.label3, ...TYPOGRAPHY.label, textAlign: "center" }}>
                {art.subtitle}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function TopResultCard({
  track,
  list,
  tokens,
  isParent,
  denied,
  onPlay,
  onQueue,
  onPlayNext,
  liked,
  onToggleLike,
  onAddToPlaylist,
  onSelectArtist,
}: {
  track: MediaTrack;
  list: MediaTrack[];
  tokens: MusicTokens;
  isParent: boolean;
  denied: string[];
  onPlay: (track: MediaTrack, list: MediaTrack[]) => void;
  onQueue: (track: MediaTrack) => void;
  onPlayNext?: (track: MediaTrack) => void;
  liked?: boolean;
  onToggleLike?: (track: MediaTrack) => void;
  onAddToPlaylist?: (track: MediaTrack) => void;
  onSelectArtist?: () => void;
}) {
  const unratedRow = isParent && track.explicit === null;
  const blockedRow = isParent && isDeniedTerm(track, denied);
  return (
    <View
      testID="music-top-result"
      style={{
        backgroundColor: tokens.panel,
        borderRadius: tokens.panelRadius,
        borderWidth: 1,
        borderColor: tokens.panelRim,
        padding: 16,
        gap: 14,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
        <ArtworkLead testID="music-top-result-artwork" track={track} tokens={tokens} />
        <Pressable
          testID={`music-result-${track.id}`}
          accessibilityRole="button"
          accessibilityLabel={`Play ${track.title} by ${track.artist}${unratedRow ? ", unrated" : ""}${blockedRow ? ", blocked for kids" : ""}`}
          onPress={() => onPlay(track, list)}
          style={{ flex: 1, minHeight: 64, justifyContent: "center" }}
        >
          <Text numberOfLines={2} style={{ color: tokens.label, ...TYPOGRAPHY.title, fontWeight: "700" }}>
            {track.title}
          </Text>
          {onSelectArtist && track.artist ? (
            <Pressable
              testID="music-top-result-artist"
              accessibilityRole="button"
              accessibilityLabel={`View artist ${track.artist}`}
              onPress={(e) => {
                e?.stopPropagation?.();
                onSelectArtist();
              }}
              hitSlop={6}
            >
              <Text numberOfLines={1} style={{ color: tokens.accent, ...TYPOGRAPHY.label, fontWeight: "700" }}>
                {track.artist}
              </Text>
            </Pressable>
          ) : (
            <Text numberOfLines={1} style={{ color: tokens.label3, ...TYPOGRAPHY.label }}>
              {track.artist}
            </Text>
          )}
          {unratedRow || blockedRow ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
              {unratedRow ? (
                <Marker testID={`music-result-unrated-${track.id}`} label="Unrated" tokens={tokens} />
              ) : null}
              {blockedRow ? (
                <Marker testID={`music-result-blocked-${track.id}`} label="Blocked for kids" tokens={tokens} accent />
              ) : null}
            </View>
          ) : null}
        </Pressable>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
        <Pressable
          testID="music-top-result-play"
          accessibilityRole="button"
          accessibilityLabel={`Play ${track.title}`}
          onPress={() => {
            hapticTap();
            onPlay(track, list);
          }}
          style={{
            minHeight: 64,
            paddingHorizontal: 24,
            flexDirection: "row",
            gap: 8,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: tokens.panelRadius,
            backgroundColor: tokens.accent,
          }}
        >
          <MusicIcon name="play" size={18} color={tokens.onAccent} filled />
          <Text style={{ color: tokens.onAccent, fontSize: TYPOGRAPHY.title.fontSize, fontWeight: "800" }}>
            Play
          </Text>
        </Pressable>
        {onPlayNext ? (
          <Pressable
            testID="music-top-result-playnext"
            accessibilityRole="button"
            accessibilityLabel={`Play ${track.title} next`}
            onPress={() => {
              hapticTap();
              onPlayNext(track);
            }}
            style={{
              minHeight: 64,
              paddingHorizontal: 18,
              flexDirection: "row",
              gap: 6,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: tokens.panelRadius,
              borderWidth: 1,
              borderColor: tokens.panelRim,
            }}
          >
            <MusicIcon name="playNext" size={18} color={tokens.label} />
            <Text style={{ color: tokens.label, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
              Play Next
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          testID="music-top-result-queue"
          accessibilityRole="button"
          accessibilityLabel={`Add ${track.title} to queue`}
          onPress={() => {
            hapticTap();
            onQueue(track);
          }}
          style={{
            minHeight: 64,
            paddingHorizontal: 18,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: tokens.panelRadius,
            borderWidth: 1,
            borderColor: tokens.panelRim,
          }}
        >
          <Text style={{ color: tokens.label, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
            + Queue
          </Text>
        </Pressable>
        {onToggleLike ? (
          <Pressable
            testID="music-top-result-like"
            accessibilityRole="button"
            accessibilityLabel={liked ? `Unlike ${track.title}` : `Like ${track.title}`}
            onPress={() => {
              hapticSelect();
              onToggleLike(track);
            }}
            style={{
              minWidth: 64,
              minHeight: 64,
              borderRadius: tokens.panelRadius,
              borderWidth: 1,
              borderColor: liked ? tokens.accent : tokens.panelRim,
              backgroundColor: liked ? mix(tokens.accent, tokens.panel, 18) : "transparent",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MusicIcon name="heart" size={20} color={liked ? tokens.accent : tokens.label} filled={liked} />
          </Pressable>
        ) : null}
        {onAddToPlaylist ? (
          <Pressable
            testID="music-top-result-playlist"
            accessibilityRole="button"
            accessibilityLabel={`Add ${track.title} to a playlist`}
            onPress={() => {
              hapticTap();
              onAddToPlaylist(track);
            }}
            style={{
              minWidth: 64,
              minHeight: 64,
              borderRadius: tokens.panelRadius,
              borderWidth: 1,
              borderColor: tokens.panelRim,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MusicIcon name="playlist" size={20} color={tokens.label} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function ResultRow({
  track,
  list,
  index,
  tokens,
  isParent,
  denied,
  onPlay,
  onQueue,
  onPlayNext,
  liked,
  onToggleLike,
  onAddToPlaylist,
  onSelectArtist,
}: {
  track: MediaTrack;
  list: MediaTrack[];
  index: number;
  tokens: MusicTokens;
  isParent: boolean;
  denied: string[];
  onPlay: (track: MediaTrack, list: MediaTrack[]) => void;
  onQueue: (track: MediaTrack) => void;
  onPlayNext?: (track: MediaTrack) => void;
  liked?: boolean;
  onToggleLike?: (track: MediaTrack) => void;
  onAddToPlaylist?: (track: MediaTrack) => void;
  onSelectArtist?: () => void;
}) {
  const unratedRow = isParent && track.explicit === null;
  const blockedRow = isParent && isDeniedTerm(track, denied);
  return (
    <Pressable
      testID={`music-result-${track.id}`}
      accessibilityRole="button"
      accessibilityLabel={`Play ${track.title} by ${track.artist}${unratedRow ? ", unrated" : ""}${blockedRow ? ", blocked for kids" : ""}`}
      onPress={() => onPlay(track, list)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        minHeight: 64,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderTopWidth: index === 0 ? 0 : 1,
        borderTopColor: tokens.panelSeparator,
      }}
    >
      <ArtworkThumb testID={`music-result-thumb-${track.id}`} track={track} tokens={tokens} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text numberOfLines={1} style={{ color: tokens.label, ...TYPOGRAPHY.body, fontWeight: "700", flexShrink: 1 }}>
            {track.title}
          </Text>
          {unratedRow ? (
            <Marker testID={`music-result-unrated-${track.id}`} label="Unrated" tokens={tokens} />
          ) : null}
          {blockedRow ? (
            <Marker testID={`music-result-blocked-${track.id}`} label="Blocked for kids" tokens={tokens} accent />
          ) : null}
        </View>
        {onSelectArtist && track.artist ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View artist ${track.artist}`}
            onPress={(e) => {
              e?.stopPropagation?.();
              onSelectArtist();
            }}
            hitSlop={4}
          >
            <Text numberOfLines={1} style={{ color: tokens.label3, ...TYPOGRAPHY.label }}>
              {track.artist}
            </Text>
          </Pressable>
        ) : (
          <Text numberOfLines={1} style={{ color: tokens.label3, ...TYPOGRAPHY.label }}>
            {track.artist}
          </Text>
        )}
      </View>
      {onAddToPlaylist ? (
        <Pressable
          testID={`music-result-playlist-${track.id}`}
          accessibilityRole="button"
          accessibilityLabel={`Add ${track.title} to playlist`}
          onPress={(e) => {
            e?.stopPropagation?.();
            hapticTap();
            onAddToPlaylist(track);
          }}
          style={{
            minWidth: 64,
            minHeight: 64,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MusicIcon name="playlist" size={18} color={tokens.label2} />
        </Pressable>
      ) : null}
      {onToggleLike ? (
        <Pressable
          testID={`music-result-like-${track.id}`}
          accessibilityRole="button"
          accessibilityLabel={liked ? `Unlike ${track.title}` : `Like ${track.title}`}
          onPress={(e) => {
            e?.stopPropagation?.();
            hapticSelect();
            onToggleLike(track);
          }}
          style={{
            minWidth: 64,
            minHeight: 64,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MusicIcon name="heart" size={18} color={liked ? tokens.accent : tokens.label3} filled={liked} />
        </Pressable>
      ) : null}
      {onPlayNext ? (
        <Pressable
          testID={`music-result-playnext-${track.id}`}
          accessibilityRole="button"
          accessibilityLabel={`Play ${track.title} next`}
          onPress={(e) => {
            e?.stopPropagation?.();
            hapticTap();
            onPlayNext(track);
          }}
          style={{
            minWidth: 64,
            minHeight: 64,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MusicIcon name="playNext" size={18} color={tokens.label2} />
        </Pressable>
      ) : null}
      <Pressable
        testID={`music-result-queue-${track.id}`}
        accessibilityRole="button"
        accessibilityLabel={`Add ${track.title} to queue`}
        hitSlop={8}
        onPress={(e) => {
          e?.stopPropagation?.();
          hapticTap();
          onQueue(track);
        }}
        style={{
          minHeight: 64,
          minWidth: 64,
          paddingHorizontal: 12,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: tokens.artworkRadius,
        }}
      >
        <Text style={{ color: tokens.label2, ...TYPOGRAPHY.label, fontWeight: "700" }}>+ Queue</Text>
      </Pressable>
    </Pressable>
  );
}

type StationCategoryFilter = "all" | MusicStation["category"];

const STATION_FILTERS: readonly { id: StationCategoryFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "genre", label: "Latin & Genres" },
  { id: "hits", label: "Hits" },
  { id: "mood", label: "Mood" },
  { id: "family", label: "Family" },
];

export const StationsShelf = React.memo(function StationsShelf({
  stations,
  tokens,
  onSelectStation,
}: {
  stations: readonly MusicStation[];
  tokens: MusicTokens;
  onSelectStation: (station: MusicStation) => void;
}) {
  const { colors } = useTheme();
  const [filter, setFilter] = React.useState<StationCategoryFilter>("all");

  const accentSwatchFor = (index: number): string => {
    const swatches = [
      colors["color-accent-coral"] ?? tokens.accent,
      colors["color-accent-nori"] ?? tokens.accent,
      colors["color-accent-amber"] ?? tokens.accent,
      colors["color-accent-violet"] ?? tokens.accent,
      colors["color-accent-mint"] ?? tokens.accent,
      colors["color-accent-cyan"] ?? tokens.accent,
    ];
    return swatches[index % swatches.length];
  };

  const visibleStations = React.useMemo(
    () => (filter === "all" ? stations : stations.filter((s) => s.category === filter)),
    [stations, filter]
  );

  return (
    <View
      testID="music-stations-shelf"
      style={{
        backgroundColor: tokens.grouped,
        borderRadius: tokens.panelRadius,
        borderWidth: 1,
        borderColor: tokens.panelRim,
        overflow: "hidden",
        padding: 16,
        gap: 12,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 }}>
        <Text style={{ color: tokens.label, ...TYPOGRAPHY.title, fontWeight: "700" }}>
          Browse Stations & Moods
        </Text>
        <Text style={{ color: tokens.label3, ...TYPOGRAPHY.label }}>
          Pick a vibe
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {STATION_FILTERS.map((tab) => {
          const active = filter === tab.id;
          return (
            <Pressable
              key={tab.id}
              testID={`music-station-filter-${tab.id}`}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => {
                hapticSelect();
                setFilter(tab.id);
              }}
              style={{
                minHeight: 64,
                minWidth: 64,
                paddingHorizontal: 18,
                borderRadius: 999,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: active ? tokens.accent : tokens.panelRim,
                backgroundColor: active ? tokens.accent : tokens.panel,
              }}
            >
              <Text
                style={{
                  color: active ? tokens.onAccent : tokens.label,
                  fontSize: TYPOGRAPHY.body.fontSize,
                  fontWeight: "700",
                }}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingVertical: 4 }}>
        {visibleStations.map((st, idx) => {
          const swatch = accentSwatchFor(idx);
          return (
            <Pressable
              key={st.id}
              testID={`music-station-${st.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Play station ${st.title}: ${st.subtitle}`}
              onPress={() => {
                hapticTap();
                onSelectStation(st);
              }}
              style={{
                width: 224,
                backgroundColor: tokens.panel,
                borderRadius: tokens.panelRadius,
                borderWidth: 1,
                borderColor: tokens.panelRim,
                overflow: "hidden",
              }}
            >
              <LinearGradient
                colors={[
                  mix(swatch, tokens.grouped, 34),
                  mix(swatch, tokens.panel, 14),
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  height: 92,
                  padding: 14,
                  justifyContent: "space-between",
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 36 }}>{st.emoji}</Text>
                  {st.badge ? (
                    <View
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 999,
                        backgroundColor: tokens.panel,
                        borderWidth: 1,
                        borderColor: tokens.panelRim,
                      }}
                    >
                      <Text style={{ color: tokens.label, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
                        {st.badge}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <View
                  style={{
                    alignSelf: "flex-end",
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: tokens.accent,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <MusicIcon name="play" size={18} color={tokens.onAccent} filled />
                </View>
              </LinearGradient>

              <View style={{ padding: 14, gap: 4 }}>
                <Text numberOfLines={2} style={{ color: tokens.label, ...TYPOGRAPHY.body, fontWeight: "800" }}>
                  {st.title}
                </Text>
                <Text numberOfLines={2} style={{ color: tokens.label3, fontSize: TYPOGRAPHY.label.fontSize, lineHeight: 18 }}>
                  {st.subtitle}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
});

export const FamilyMixesShelf = React.memo(function FamilyMixesShelf({
  mixes,
  likedCount = 0,
  customPlaylists = [],
  youtubeConnected = false,
  youtubePlaylists = [],
  isParent = false,
  tokens,
  onSelectMix,
  onPlayLikedSongs,
  onOpenPlaylist,
  onOpenCreatePlaylist,
  onOpenYouTubeConnect,
  onOpenYouTubePlaylist,
}: {
  mixes: readonly FamilyMix[];
  likedCount?: number;
  customPlaylists?: readonly FamilyPlaylist[];
  youtubeConnected?: boolean;
  youtubePlaylists?: readonly YouTubeAccountPlaylist[];
  isParent?: boolean;
  tokens: MusicTokens;
  onSelectMix: (mix: FamilyMix) => void;
  onPlayLikedSongs?: () => void;
  onOpenPlaylist?: (playlist: FamilyPlaylist) => void;
  onOpenCreatePlaylist?: () => void;
  onOpenYouTubeConnect?: () => void;
  onOpenYouTubePlaylist?: (playlist: YouTubeAccountPlaylist) => void;
}) {
  const { colors } = useTheme();
  const mixSwatchFor = (index: number): string => {
    const swatches = [
      colors["color-accent-amber"] ?? tokens.accent,
      colors["color-accent-violet"] ?? tokens.accent,
      colors["color-accent-mint"] ?? tokens.accent,
      colors["color-accent-nori"] ?? tokens.accent,
      colors["color-accent-coral"] ?? tokens.accent,
    ];
    return swatches[index % swatches.length];
  };

  return (
    <View
      testID="music-family-mixes-shelf"
      style={{
        backgroundColor: tokens.grouped,
        borderRadius: tokens.panelRadius,
        borderWidth: 1,
        borderColor: tokens.panelRim,
        overflow: "hidden",
        padding: 16,
        gap: 12,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, minHeight: 44 }}>
        <View style={{ flex: 1, minWidth: 180 }}>
          <Text style={{ color: tokens.label, ...TYPOGRAPHY.title, fontWeight: "700" }}>
            Family Mixes & Playlists
          </Text>
          <Text style={{ color: tokens.label3, ...TYPOGRAPHY.label }}>
            Made for home
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {isParent && onOpenYouTubeConnect ? (
            <Pressable
              testID="music-yt-connect-open"
              accessibilityRole="button"
              accessibilityLabel={youtubeConnected ? "Manage linked YouTube account" : "Link YouTube account"}
              onPress={() => {
                hapticTap();
                onOpenYouTubeConnect();
              }}
              style={{
                minHeight: 64,
                minWidth: 64,
                paddingHorizontal: 14,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: youtubeConnected ? tokens.accent : tokens.panelRim,
                backgroundColor: youtubeConnected ? mix(tokens.accent, tokens.panel, 18) : tokens.panel,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
            >
              <MusicIcon name="link" size={16} color={youtubeConnected ? tokens.accent : tokens.label2} />
              <Text style={{ color: tokens.label, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
                {youtubeConnected ? "YouTube Linked" : "Link YouTube"}
              </Text>
            </Pressable>
          ) : null}
          {onOpenCreatePlaylist ? (
            <Pressable
              testID="music-create-playlist-open"
              accessibilityRole="button"
              accessibilityLabel="Create a new family playlist"
              onPress={() => {
                hapticTap();
                onOpenCreatePlaylist();
              }}
              style={{
                minHeight: 64,
                minWidth: 64,
                paddingHorizontal: 16,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: tokens.panelRim,
                backgroundColor: tokens.panel,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <MusicIcon name="plus" size={18} color={tokens.accent} />
              <Text style={{ color: tokens.label, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
                New Playlist
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingVertical: 4 }}>
        {likedCount > 0 && onPlayLikedSongs ? (
          <Pressable
            testID="music-liked-songs-card"
            accessibilityRole="button"
            accessibilityLabel={`Play Liked Songs (${likedCount} tracks)`}
            onPress={() => {
              hapticTap();
              onPlayLikedSongs();
            }}
            style={{
              width: 224,
              backgroundColor: tokens.panel,
              borderRadius: tokens.panelRadius,
              borderWidth: 1,
              borderColor: tokens.accent,
              overflow: "hidden",
            }}
          >
            <LinearGradient
              colors={[
                mix(tokens.accent, tokens.grouped, 38),
                mix(tokens.accent, tokens.panel, 16),
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                height: 86,
                padding: 14,
                flexDirection: "row",
                alignItems: "flex-end",
                justifyContent: "space-between",
              }}
            >
              <MusicIcon name="heart" size={34} color={tokens.accent} filled />
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: tokens.accent,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MusicIcon name="play" size={18} color={tokens.onAccent} filled />
              </View>
            </LinearGradient>
            <View style={{ padding: 14, gap: 4 }}>
              <Text numberOfLines={1} style={{ color: tokens.label, ...TYPOGRAPHY.body, fontWeight: "800" }}>
                Liked Songs
              </Text>
              <Text numberOfLines={2} style={{ color: tokens.label3, fontSize: TYPOGRAPHY.label.fontSize, lineHeight: 18 }}>
                {likedCount} {likedCount === 1 ? "saved song" : "saved songs"}
              </Text>
            </View>
          </Pressable>
        ) : null}

        {customPlaylists.map((pl, idx) => {
          const swatch = mixSwatchFor(idx + 1);
          return (
            <Pressable
              key={pl.id}
              testID={`music-custom-playlist-${pl.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Open playlist ${pl.name}`}
              onPress={() => {
                hapticTap();
                onOpenPlaylist?.(pl);
              }}
              style={{
                width: 224,
                backgroundColor: tokens.panel,
                borderRadius: tokens.panelRadius,
                borderWidth: 1,
                borderColor: tokens.panelRim,
                overflow: "hidden",
              }}
            >
              <LinearGradient
                colors={[
                  mix(swatch, tokens.grouped, 34),
                  mix(swatch, tokens.panel, 14),
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  height: 86,
                  padding: 14,
                  flexDirection: "row",
                  alignItems: "flex-end",
                  justifyContent: "space-between",
                }}
              >
                <Text style={{ fontSize: 34 }}>{pl.emoji}</Text>
                <View
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 999,
                    backgroundColor: tokens.panel,
                    borderWidth: 1,
                    borderColor: tokens.panelRim,
                  }}
                >
                  <Text style={{ color: tokens.label, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
                    Playlist
                  </Text>
                </View>
              </LinearGradient>
              <View style={{ padding: 14, gap: 4 }}>
                <Text numberOfLines={2} style={{ color: tokens.label, ...TYPOGRAPHY.body, fontWeight: "800" }}>
                  {pl.name}
                </Text>
                <Text numberOfLines={2} style={{ color: tokens.label3, fontSize: TYPOGRAPHY.label.fontSize, lineHeight: 18 }}>
                  {pl.tracks.length} {pl.tracks.length === 1 ? "track" : "tracks"}
                </Text>
              </View>
            </Pressable>
          );
        })}

        {youtubeConnected
          ? youtubePlaylists.map((ytPl) => (
              <Pressable
                key={`yt-${ytPl.id}`}
                testID={`music-yt-playlist-${ytPl.id}`}
                accessibilityRole="button"
                accessibilityLabel={`Open YouTube playlist ${ytPl.title}`}
                onPress={() => {
                  hapticTap();
                  onOpenYouTubePlaylist?.(ytPl);
                }}
                style={{
                  width: 224,
                  backgroundColor: tokens.panel,
                  borderRadius: tokens.panelRadius,
                  borderWidth: 1,
                  borderColor: tokens.accent,
                  overflow: "hidden",
                }}
              >
                {ytPl.artworkUrl ? (
                  <View style={{ height: 86, width: "100%", overflow: "hidden" }}>
                    <Image
                      source={{ uri: toHighResArtworkUrl(ytPl.artworkUrl) ?? ytPl.artworkUrl }}
                      style={{ width: 224, height: 86 }}
                      resizeMode="cover"
                    />
                    <View
                      style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 999,
                        backgroundColor: tokens.panel,
                        borderWidth: 1,
                        borderColor: tokens.panelRim,
                      }}
                    >
                      <Text style={{ color: tokens.label, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
                        YouTube
                      </Text>
                    </View>
                  </View>
                ) : (
                  <LinearGradient
                    colors={[
                      mix(tokens.accent, tokens.grouped, 34),
                      mix(tokens.accent, tokens.panel, 14),
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      height: 86,
                      padding: 14,
                      flexDirection: "row",
                      alignItems: "flex-end",
                      justifyContent: "space-between",
                    }}
                  >
                    <MusicIcon name="playlist" size={30} color={tokens.accent} />
                    <View
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 999,
                        backgroundColor: tokens.panel,
                        borderWidth: 1,
                        borderColor: tokens.panelRim,
                      }}
                    >
                      <Text style={{ color: tokens.label, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
                        YouTube
                      </Text>
                    </View>
                  </LinearGradient>
                )}
                <View style={{ padding: 14, gap: 4 }}>
                  <Text numberOfLines={2} style={{ color: tokens.label, ...TYPOGRAPHY.body, fontWeight: "800" }}>
                    {ytPl.title}
                  </Text>
                  <Text numberOfLines={1} style={{ color: tokens.label3, fontSize: TYPOGRAPHY.label.fontSize }}>
                    {ytPl.itemCount} {ytPl.itemCount === 1 ? "song" : "songs"}
                  </Text>
                </View>
              </Pressable>
            ))
          : null}

        {mixes.map((mixItem, idx) => {
          const swatch = mixSwatchFor(idx);
          return (
            <Pressable
              key={mixItem.id}
              testID={`music-family-mix-${mixItem.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Play ${mixItem.title}`}
              onPress={() => {
                hapticTap();
                onSelectMix(mixItem);
              }}
              style={{
                width: 224,
                backgroundColor: tokens.panel,
                borderRadius: tokens.panelRadius,
                borderWidth: 1,
                borderColor: tokens.panelRim,
                overflow: "hidden",
              }}
            >
              <LinearGradient
                colors={[
                  mix(swatch, tokens.grouped, 32),
                  mix(swatch, tokens.panel, 14),
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  height: 86,
                  padding: 14,
                  flexDirection: "row",
                  alignItems: "flex-end",
                  justifyContent: "space-between",
                }}
              >
                <Text style={{ fontSize: 34 }}>{mixItem.emoji}</Text>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: tokens.accent,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <MusicIcon name="play" size={18} color={tokens.onAccent} filled />
                </View>
              </LinearGradient>

              <View style={{ padding: 14, gap: 4 }}>
                <Text numberOfLines={2} style={{ color: tokens.label, ...TYPOGRAPHY.body, fontWeight: "800" }}>
                  {mixItem.title}
                </Text>
                <Text numberOfLines={2} style={{ color: tokens.label3, fontSize: TYPOGRAPHY.label.fontSize, lineHeight: 18 }}>
                  {mixItem.description}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
});

export const SimilarTracksShelf = React.memo(function SimilarTracksShelf({
  tracks,
  tokens,
  onPlay,
  onQueue,
  onPlayNext,
  onSelectArtist,
}: {
  tracks: MediaTrack[];
  tokens: MusicTokens;
  currentTrackTitle: string;
  onPlay: (track: MediaTrack, list: MediaTrack[]) => void;
  onQueue: (track: MediaTrack) => void;
  onPlayNext?: (track: MediaTrack) => void;
  onSelectArtist?: (artist: string) => void;
}) {
  return (
    <View
      testID="music-similar-tracks-shelf"
      style={{
        backgroundColor: tokens.grouped,
        borderRadius: tokens.panelRadius,
        borderWidth: 1,
        borderColor: tokens.panelRim,
        overflow: "hidden",
        padding: 16,
        gap: 12,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 }}>
        <Text numberOfLines={1} style={{ flex: 1, color: tokens.label, ...TYPOGRAPHY.title, fontWeight: "700" }}>
          More Like This
        </Text>
        <Text style={{ color: tokens.label3, ...TYPOGRAPHY.label }}>
          Keep the vibe going
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingVertical: 4 }}>
        {tracks.map((track) => (
          <View
            key={track.id}
            testID={`music-similar-track-${track.id}`}
            style={{
              width: 196,
              backgroundColor: tokens.panel,
              borderRadius: tokens.panelRadius,
              borderWidth: 1,
              borderColor: tokens.panelRim,
              padding: 12,
              gap: 10,
              justifyContent: "space-between",
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Play ${track.title}`}
              onPress={() => {
                hapticTap();
                onPlay(track, tracks);
              }}
              style={{
                width: "100%",
                height: 128,
                borderRadius: tokens.artworkRadius,
                backgroundColor: mix(tokens.label, "transparent", 8),
                overflow: "hidden",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {track.artworkUrl ? (
                <Image
                  source={{ uri: toHighResArtworkUrl(track.artworkUrl) ?? track.artworkUrl }}
                  style={{ width: "100%", height: 128 }}
                  resizeMode="cover"
                />
              ) : (
                <MusicIcon name="music" size={40} color={tokens.label} />
              )}
            </Pressable>

            <View style={{ gap: 2 }}>
              <Text numberOfLines={2} style={{ color: tokens.label, ...TYPOGRAPHY.body, fontWeight: "700" }}>
                {track.title}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`View ${track.artist}`}
                onPress={() => onSelectArtist?.(track.artist)}
                hitSlop={4}
              >
                <Text numberOfLines={1} style={{ color: tokens.label3, fontSize: TYPOGRAPHY.label.fontSize }}>
                  {track.artist}
                </Text>
              </Pressable>
            </View>

            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Play ${track.title}`}
                onPress={() => {
                  hapticTap();
                  onPlay(track, tracks);
                }}
                style={{
                  flex: 1,
                  minHeight: 64,
                  borderRadius: 14,
                  backgroundColor: tokens.accent,
                  flexDirection: "row",
                  gap: 6,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MusicIcon name="play" size={16} color={tokens.onAccent} filled />
                <Text style={{ color: tokens.onAccent, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "800" }}>
                  Play
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Play ${track.title} next or queue`}
                onPress={() => {
                  hapticTap();
                  if (onPlayNext) onPlayNext(track);
                  else onQueue(track);
                }}
                style={{
                  minWidth: 64,
                  minHeight: 64,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: tokens.panelRim,
                  backgroundColor: tokens.sheet,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MusicIcon name={onPlayNext ? "playNext" : "plus"} size={20} color={tokens.label} />
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
});

export const FavoriteArtistsShelf = React.memo(function FavoriteArtistsShelf({
  favorites,
  tokens,
  onSelectArtist,
  onToggleFavorite,
}: {
  favorites: FavoriteArtist[];
  tokens: MusicTokens;
  onSelectArtist: (artistName: string) => void;
  onToggleFavorite: (artistName: string) => void;
}) {
  return (
    <View
      testID="music-favorite-artists-shelf"
      style={{
        backgroundColor: tokens.grouped,
        borderRadius: tokens.panelRadius,
        borderWidth: 1,
        borderColor: tokens.panelRim,
        overflow: "hidden",
        padding: 16,
        gap: 12,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 }}>
        <Text style={{ color: tokens.label, ...TYPOGRAPHY.title, fontWeight: "700" }}>
          Favorite Artists
        </Text>
        <Text style={{ color: tokens.label3, ...TYPOGRAPHY.label }}>
          {favorites.length} {favorites.length === 1 ? "artist" : "artists"}
        </Text>
      </View>

      {favorites.length === 0 ? (
        <View style={{ paddingVertical: 18, alignItems: "center", gap: 8 }}>
          <MusicIcon name="star" size={32} color={tokens.accent} />
          <Text style={{ color: tokens.label2, ...TYPOGRAPHY.body, textAlign: "center" }}>
            No favorite artists saved yet. Tap the ★ star while listening to add artists here.
          </Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingVertical: 4 }}>
          {favorites.map((artist) => {
            const initial = (artist.name[0] || "?").toUpperCase();
            return (
              <View
                key={artist.name}
                testID={`music-favorite-artist-item-${artist.name}`}
                style={{
                  width: 148,
                  alignItems: "center",
                  gap: 8,
                  backgroundColor: tokens.panel,
                  borderRadius: tokens.panelRadius,
                  borderWidth: 1,
                  borderColor: tokens.panelRim,
                  padding: 12,
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Play songs by ${artist.name}`}
                  onPress={() => {
                    hapticTap();
                    onSelectArtist(artist.name);
                  }}
                  style={{
                    width: 84,
                    height: 84,
                    borderRadius: 42,
                    backgroundColor: mix(tokens.accent, tokens.grouped, 22),
                    borderWidth: 2,
                    borderColor: tokens.accent,
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                  }}
                >
                  {artist.artworkUrl ? (
                    <Image
                      source={{ uri: toHighResArtworkUrl(artist.artworkUrl) ?? artist.artworkUrl }}
                      style={{ width: 84, height: 84 }}
                      resizeMode="cover"
                    />
                  ) : (
                    <Text style={{ color: tokens.label, fontSize: 28, fontWeight: "800" }}>{initial}</Text>
                  )}
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`View ${artist.name}`}
                  onPress={() => onSelectArtist(artist.name)}
                  style={{ minHeight: 44, justifyContent: "center" }}
                >
                  <Text numberOfLines={2} style={{ color: tokens.label, ...TYPOGRAPHY.body, fontWeight: "700", textAlign: "center" }}>
                    {artist.name}
                  </Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${artist.name} from favorites`}
                  onPress={() => {
                    hapticSelect();
                    onToggleFavorite(artist.name);
                  }}
                  style={{
                    minHeight: 64,
                    minWidth: 64,
                    paddingHorizontal: 14,
                    flexDirection: "row",
                    gap: 6,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 999,
                    backgroundColor: mix(tokens.accent, tokens.panel, 18),
                    borderWidth: 1,
                    borderColor: tokens.panelRim,
                  }}
                >
                  <MusicIcon name="star" size={16} color={tokens.accent} filled />
                  <Text style={{ color: tokens.label, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
                    Favorited
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
});

export const RecommendedArtistsShelf = React.memo(function RecommendedArtistsShelf({
  recommendations,
  favorites,
  tokens,
  onSelectArtist,
  onToggleFavorite,
}: {
  recommendations: RecommendedArtist[];
  favorites: FavoriteArtist[];
  tokens: MusicTokens;
  onSelectArtist: (artistName: string) => void;
  onToggleFavorite: (artistName: string) => void;
}) {
  const { colors } = useTheme();
  const avatarTint = (index: number): string => {
    const swatches = [
      colors["color-accent-nori"] ?? tokens.accent,
      colors["color-accent-violet"] ?? tokens.accent,
      colors["color-accent-mint"] ?? tokens.accent,
      colors["color-accent-amber"] ?? tokens.accent,
      colors["color-accent-coral"] ?? tokens.accent,
    ];
    return swatches[index % swatches.length];
  };

  return (
    <View
      testID="music-recommended-artists-shelf"
      style={{
        backgroundColor: tokens.grouped,
        borderRadius: tokens.panelRadius,
        borderWidth: 1,
        borderColor: tokens.panelRim,
        overflow: "hidden",
        padding: 16,
        gap: 12,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 }}>
        <Text style={{ color: tokens.label, ...TYPOGRAPHY.title, fontWeight: "700" }}>
          Recommended Artists
        </Text>
        <Text style={{ color: tokens.label3, ...TYPOGRAPHY.label }}>
          Picked for your family
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingVertical: 4 }}>
        {recommendations.map((rec, idx) => {
          const isFav = isFavoriteArtist(favorites, rec.name);
          const initial = (rec.name[0] || "?").toUpperCase();
          const swatch = avatarTint(idx);
          return (
            <View
              key={rec.name}
              testID={`music-recommended-artist-${rec.name}`}
              style={{
                width: 196,
                backgroundColor: tokens.panel,
                borderRadius: tokens.panelRadius,
                borderWidth: 1,
                borderColor: tokens.panelRim,
                padding: 14,
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Play ${rec.name}`}
                onPress={() => {
                  hapticTap();
                  onSelectArtist(rec.name);
                }}
                style={{
                  width: 76,
                  height: 76,
                  borderRadius: 38,
                  backgroundColor: mix(swatch, tokens.grouped, 26),
                  borderWidth: 1,
                  borderColor: tokens.panelRim,
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                {rec.artworkUrl ? (
                  <Image
                    source={{ uri: toHighResArtworkUrl(rec.artworkUrl) ?? rec.artworkUrl }}
                    style={{ width: 76, height: 76 }}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={{ color: tokens.label, fontSize: 28, fontWeight: "800" }}>{initial}</Text>
                )}
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Search ${rec.name}`}
                onPress={() => onSelectArtist(rec.name)}
                style={{ alignItems: "center", minHeight: 48, justifyContent: "center", gap: 2 }}
              >
                <Text numberOfLines={2} style={{ color: tokens.label, ...TYPOGRAPHY.body, fontWeight: "700", textAlign: "center" }}>
                  {rec.name}
                </Text>
                <Text numberOfLines={1} style={{ color: tokens.label3, fontSize: TYPOGRAPHY.label.fontSize }}>
                  {rec.genre}
                </Text>
              </Pressable>

              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 3,
                  borderRadius: 999,
                  backgroundColor: mix(tokens.label, "transparent", 8),
                }}
              >
                <Text numberOfLines={1} style={{ color: tokens.label2, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "600" }}>
                  {rec.reason}
                </Text>
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, width: "100%" }}>
                <Pressable
                  testID={`music-rec-play-${rec.name}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Play ${rec.name}`}
                  onPress={() => {
                    hapticTap();
                    onSelectArtist(rec.name);
                  }}
                  style={{
                    flex: 1,
                    minHeight: 64,
                    paddingHorizontal: 14,
                    borderRadius: 14,
                    backgroundColor: tokens.accent,
                    flexDirection: "row",
                    gap: 6,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <MusicIcon name="play" size={16} color={tokens.onAccent} filled />
                  <Text style={{ color: tokens.onAccent, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
                    Play
                  </Text>
                </Pressable>

                <Pressable
                  testID={`music-rec-fav-${rec.name}`}
                  accessibilityRole="button"
                  accessibilityLabel={isFav ? `Remove ${rec.name}` : `Favorite ${rec.name}`}
                  onPress={() => {
                    hapticSelect();
                    onToggleFavorite(rec.name);
                  }}
                  style={{
                    minHeight: 64,
                    minWidth: 64,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: isFav ? tokens.accent : tokens.panelRim,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: isFav ? mix(tokens.accent, tokens.panel, 20) : tokens.sheet,
                  }}
                >
                  <MusicIcon name="star" size={20} color={isFav ? tokens.accent : tokens.label} filled={isFav} />
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
});
