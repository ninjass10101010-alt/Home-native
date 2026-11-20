import React from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { hapticSelect, hapticTap } from "../theme/haptics";
import { mix } from "../theme/mix";
import type { MusicTokens } from "../theme/music-tokens";
import { TYPOGRAPHY } from "../theme/tokens";
import { Modal } from "../ui/Modal";
import { PinPad } from "../ui/PinPad";
import { MusicIcon } from "./MusicIcons";
import { ArtworkThumb } from "./MusicQueueLyrics";
import { formatMusicClock } from "./MusicStage";
import { toHighResArtworkUrl } from "./artwork";
import { isDeniedTerm } from "./explicit";
import type {
  ArtistProfile,
  DenyEntry,
  FamilyPlaylist,
  MediaTrack,
  MusicAlbumSummary,
  MusicArtistSummary,
  MusicPlaylistSummary,
  SleepTimerMinutes,
  YouTubeAccountPlaylist,
  YouTubeAccountStatus,
} from "./types";

const PLAYLIST_EMOJIS = ["🎵", "🎉", "🔥", "🌮", "🚗", "🌙", "❤️", "🎸"];
const SLEEP_PRESETS: readonly SleepTimerMinutes[] = [15, 30, 45, 60];

type ArtistSectionTab = "popular" | "albums" | "playlists" | "similar";

export function ArtistModal({
  visible,
  artistName,
  artworkUrl,
  tracks,
  profile = null,
  loading,
  isFavorite,
  isParent = false,
  denied = [],
  tokens,
  isLiked,
  onToggleLike,
  onAddToPlaylist,
  onClose,
  onToggleFavorite,
  onPlayAll,
  onShuffle,
  onStartRadio,
  onPlayTrack,
  onQueueTrack,
  onPlayNextTrack,
  onSelectAlbum,
  onSelectPlaylist,
  onSelectArtist,
}: {
  visible: boolean;
  artistName: string;
  artworkUrl?: string | null;
  tracks: MediaTrack[];
  profile?: ArtistProfile | null;
  loading: boolean;
  isFavorite: boolean;
  isParent?: boolean;
  denied?: string[];
  tokens: MusicTokens;
  isLiked?: (trackId: string) => boolean;
  onToggleLike?: (track: MediaTrack) => void;
  onAddToPlaylist?: (track: MediaTrack) => void;
  onClose: () => void;
  onToggleFavorite: () => void;
  onPlayAll: () => void;
  onShuffle: () => void;
  onStartRadio: () => void;
  onPlayTrack: (track: MediaTrack) => void;
  onQueueTrack: (track: MediaTrack) => void;
  onPlayNextTrack?: (track: MediaTrack) => void;
  onSelectAlbum?: (album: MusicAlbumSummary) => void;
  onSelectPlaylist?: (playlist: MusicPlaylistSummary) => void;
  onSelectArtist?: (artist: MusicArtistSummary) => void;
}) {
  const [sectionState, setSectionState] = React.useState<{
    artist: string;
    tab: ArtistSectionTab;
  }>({ artist: artistName, tab: "popular" });
  const section: ArtistSectionTab =
    sectionState.artist === artistName ? sectionState.tab : "popular";
  const setSection = (tab: ArtistSectionTab) => setSectionState({ artist: artistName, tab });

  const initial = (artistName[0] || "?").toUpperCase();
  const displayArtwork = profile?.artworkUrl ?? artworkUrl;
  const displayTracks = profile && profile.topSongs.length > 0 ? profile.topSongs : tracks;
  const displayAlbums = React.useMemo(
    () => [...(profile?.albums ?? []), ...(profile?.singles ?? [])],
    [profile]
  );
  const displayPlaylists = profile?.playlists ?? [];
  const displaySimilar = profile?.relatedArtists ?? [];
  const hasSecondaryTabs =
    displayAlbums.length > 0 || displayPlaylists.length > 0 || displaySimilar.length > 0;

  const tabs: { id: ArtistSectionTab; label: string }[] = [
    { id: "popular", label: `Popular${displayTracks.length > 0 ? ` (${displayTracks.length})` : ""}` },
    ...(displayAlbums.length > 0 ? [{ id: "albums" as const, label: `Albums (${displayAlbums.length})` }] : []),
    ...(displayPlaylists.length > 0
      ? [{ id: "playlists" as const, label: `Playlists (${displayPlaylists.length})` }]
      : []),
    ...(displaySimilar.length > 0 ? [{ id: "similar" as const, label: `Similar (${displaySimilar.length})` }] : []),
  ];

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={artistName}
      testID="music-artist-modal"
    >
      <View style={{ gap: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: tokens.panel,
              borderWidth: 2,
              borderColor: tokens.panelRim,
              overflow: "hidden",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {displayArtwork ? (
              <Image
                source={{ uri: toHighResArtworkUrl(displayArtwork) ?? displayArtwork }}
                style={{ width: 80, height: 80 }}
                resizeMode="cover"
              />
            ) : (
              <Text style={{ color: tokens.label, fontSize: 32, fontWeight: "800" }}>{initial}</Text>
            )}
          </View>

          <View style={{ flex: 1, gap: 4 }}>
            <Text numberOfLines={2} style={{ color: tokens.label, fontSize: TYPOGRAPHY.title.fontSize, fontWeight: "800" }}>
              {artistName}
            </Text>
            <Text numberOfLines={1} style={{ color: tokens.label2, fontSize: TYPOGRAPHY.label.fontSize }}>
              {profile?.subtitle || "Artist Profile • YouTube Music"}
            </Text>
          </View>

          <Pressable
            testID="music-artist-modal-fav"
            accessibilityRole="button"
            accessibilityLabel={isFavorite ? `Unfavorite ${artistName}` : `Favorite ${artistName}`}
            onPress={() => {
              hapticSelect();
              onToggleFavorite();
            }}
            style={{
              minHeight: 64,
              minWidth: 64,
              paddingHorizontal: 14,
              borderRadius: 16,
              backgroundColor: isFavorite ? mix(tokens.accent, "transparent", 20) : mix(tokens.label, "transparent", 8),
              borderWidth: 1,
              borderColor: isFavorite ? tokens.accent : tokens.panelRim,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 6,
            }}
          >
            <MusicIcon name="star" size={18} color={isFavorite ? tokens.accent : tokens.label} filled={isFavorite} />
            <Text style={{ color: tokens.label, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
              {isFavorite ? "Favorited" : "Favorite"}
            </Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable
            testID="music-artist-modal-play"
            accessibilityRole="button"
            accessibilityLabel={`Play top songs by ${artistName}`}
            onPress={() => {
              hapticTap();
              onPlayAll();
            }}
            disabled={displayTracks.length === 0}
            style={{
              flex: 1,
              minHeight: 64,
              borderRadius: 14,
              backgroundColor: tokens.accent,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 8,
              opacity: displayTracks.length === 0 ? 0.5 : 1,
            }}
          >
            <MusicIcon name="play" size={18} color={tokens.onAccent} filled />
            <Text style={{ color: tokens.onAccent, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "800" }}>
              Play Hits
            </Text>
          </Pressable>

          <Pressable
            testID="music-artist-modal-shuffle"
            accessibilityRole="button"
            accessibilityLabel={`Shuffle songs by ${artistName}`}
            onPress={() => {
              hapticTap();
              onShuffle();
            }}
            disabled={displayTracks.length === 0}
            style={{
              flex: 1,
              minHeight: 64,
              borderRadius: 14,
              backgroundColor: mix(tokens.label, "transparent", 10),
              borderWidth: 1,
              borderColor: tokens.panelRim,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 8,
              opacity: displayTracks.length === 0 ? 0.5 : 1,
            }}
          >
            <MusicIcon name="shuffle" size={18} color={tokens.label} />
            <Text style={{ color: tokens.label, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "800" }}>
              Shuffle
            </Text>
          </Pressable>

          <Pressable
            testID="music-artist-modal-radio"
            accessibilityRole="button"
            accessibilityLabel={`Start radio for ${artistName}`}
            onPress={() => {
              hapticTap();
              onStartRadio();
            }}
            style={{
              flex: 1,
              minHeight: 64,
              borderRadius: 14,
              backgroundColor: mix(tokens.accent, "transparent", 18),
              borderWidth: 1,
              borderColor: tokens.accent,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 8,
            }}
          >
            <MusicIcon name="radio" size={18} color={tokens.label} />
            <Text style={{ color: tokens.label, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "800" }}>
              Radio
            </Text>
          </Pressable>
        </View>

        {hasSecondaryTabs ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {tabs.map((tab) => {
              const active = section === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  testID={`music-artist-tab-${tab.id}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    hapticSelect();
                    setSection(tab.id);
                  }}
                  style={{
                    minHeight: 64,
                    minWidth: 64,
                    paddingHorizontal: 16,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: active ? tokens.accent : tokens.panelRim,
                    backgroundColor: active ? tokens.accent : tokens.sheet,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      color: active ? tokens.onAccent : tokens.label,
                      fontSize: TYPOGRAPHY.label.fontSize,
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

        <View style={{ gap: 8, maxHeight: 380 }}>
          {section === "popular" ? (
            <>
              <Text style={{ color: tokens.label, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "800" }}>
                Popular Songs
              </Text>
              {loading ? (
                <View style={{ paddingVertical: 24, alignItems: "center" }}>
                  <ActivityIndicator color={tokens.accent} />
                </View>
              ) : displayTracks.length === 0 ? (
                <Text style={{ color: tokens.label3, fontSize: TYPOGRAPHY.label.fontSize, textAlign: "center", paddingVertical: 16 }}>
                  No tracks found for this artist.
                </Text>
              ) : (
                <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {displayTracks.map((t, idx) => {
                    const liked = isLiked ? isLiked(t.id) : false;
                    const blocked = isParent && isDeniedTerm(t, denied);
                    return (
                      <View
                        key={t.id}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                          minHeight: 64,
                          paddingHorizontal: 10,
                          borderRadius: 14,
                          backgroundColor: mix(tokens.label, "transparent", 4),
                        }}
                      >
                        <Text style={{ color: tokens.label3, fontSize: TYPOGRAPHY.label.fontSize, width: 22, textAlign: "center", fontWeight: "700" }}>
                          {idx + 1}
                        </Text>
                        <ArtworkThumb testID={`music-artist-track-thumb-${t.id}`} track={t} tokens={tokens} />
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Play ${t.title}`}
                          onPress={() => onPlayTrack(t)}
                          style={{ flex: 1, minHeight: 64, justifyContent: "center", gap: 2 }}
                        >
                          <Text numberOfLines={1} style={{ color: tokens.label, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
                            {t.title}
                          </Text>
                          <Text numberOfLines={1} style={{ color: tokens.label3, fontSize: TYPOGRAPHY.label.fontSize }}>
                            {t.durationSeconds ? formatMusicClock(t.durationSeconds) : t.artist || "--:--"}
                            {blocked ? " • Blocked for kids" : ""}
                          </Text>
                        </Pressable>
                        {onToggleLike ? (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={liked ? `Unlike ${t.title}` : `Like ${t.title}`}
                            onPress={() => {
                              hapticSelect();
                              onToggleLike(t);
                            }}
                            style={{
                              minWidth: 64,
                              minHeight: 64,
                              alignItems: "center",
                              justifyContent: "center",
                              borderRadius: 12,
                            }}
                          >
                            <MusicIcon name="heart" size={18} color={liked ? tokens.accent : tokens.label3} filled={liked} />
                          </Pressable>
                        ) : null}
                        {onAddToPlaylist ? (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Add ${t.title} to playlist`}
                            onPress={() => {
                              hapticTap();
                              onAddToPlaylist(t);
                            }}
                            style={{
                              minWidth: 64,
                              minHeight: 64,
                              alignItems: "center",
                              justifyContent: "center",
                              borderRadius: 12,
                              backgroundColor: mix(tokens.label, "transparent", 6),
                            }}
                          >
                            <MusicIcon name="playlist" size={18} color={tokens.label} />
                          </Pressable>
                        ) : null}
                        {onPlayNextTrack ? (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Play ${t.title} next`}
                            onPress={() => {
                              hapticTap();
                              onPlayNextTrack(t);
                            }}
                            style={{
                              minWidth: 64,
                              minHeight: 64,
                              alignItems: "center",
                              justifyContent: "center",
                              borderRadius: 12,
                              backgroundColor: mix(tokens.label, "transparent", 8),
                            }}
                          >
                            <MusicIcon name="playNext" size={18} color={tokens.label} />
                          </Pressable>
                        ) : null}
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Add ${t.title} to queue`}
                          onPress={() => {
                            hapticTap();
                            onQueueTrack(t);
                          }}
                          style={{
                            minWidth: 64,
                            minHeight: 64,
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: 12,
                            backgroundColor: mix(tokens.label, "transparent", 8),
                          }}
                        >
                          <MusicIcon name="plus" size={18} color={tokens.label} />
                        </Pressable>
                      </View>
                    );
                  })}
                </ScrollView>
              )}
            </>
          ) : section === "albums" ? (
            <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {displayAlbums.map((alb) => {
                const meta = [alb.albumType, alb.year].filter(Boolean).join(" • ") || "Album";
                return (
                  <Pressable
                    key={alb.browseId}
                    testID={`music-artist-album-${alb.browseId}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Open album ${alb.title}`}
                    onPress={() => {
                      hapticTap();
                      onSelectAlbum?.(alb);
                    }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      minHeight: 68,
                      padding: 10,
                      borderRadius: 14,
                      backgroundColor: tokens.sheet,
                      borderWidth: 1,
                      borderColor: tokens.panelRim,
                    }}
                  >
                    <View
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 10,
                        overflow: "hidden",
                        backgroundColor: tokens.grouped,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {alb.artworkUrl ? (
                        <Image
                          source={{ uri: toHighResArtworkUrl(alb.artworkUrl) ?? alb.artworkUrl }}
                          style={{ width: 56, height: 56 }}
                          resizeMode="cover"
                        />
                      ) : (
                        <MusicIcon name="disc" size={24} color={tokens.accent} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={{ color: tokens.label, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
                        {alb.title}
                      </Text>
                      <Text numberOfLines={1} style={{ color: tokens.label3, fontSize: TYPOGRAPHY.label.fontSize }}>
                        {meta}{isParent && alb.explicit ? " • E" : ""}
                      </Text>
                    </View>
                    <MusicIcon name="chevronRight" size={18} color={tokens.label2} />
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : section === "playlists" ? (
            <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {displayPlaylists.map((pl) => (
                <Pressable
                  key={pl.browseId}
                  testID={`music-artist-playlist-${pl.browseId}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Open playlist ${pl.title}`}
                  onPress={() => {
                    hapticTap();
                    onSelectPlaylist?.(pl);
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    minHeight: 68,
                    padding: 10,
                    borderRadius: 14,
                    backgroundColor: tokens.sheet,
                    borderWidth: 1,
                    borderColor: tokens.panelRim,
                  }}
                >
                  <View
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 10,
                      overflow: "hidden",
                      backgroundColor: tokens.grouped,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {pl.artworkUrl ? (
                      <Image
                        source={{ uri: toHighResArtworkUrl(pl.artworkUrl) ?? pl.artworkUrl }}
                        style={{ width: 56, height: 56 }}
                        resizeMode="cover"
                      />
                    ) : (
                      <MusicIcon name="playlist" size={24} color={tokens.accent} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ color: tokens.label, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
                      {pl.title}
                    </Text>
                    <Text numberOfLines={1} style={{ color: tokens.label3, fontSize: TYPOGRAPHY.label.fontSize }}>
                      {pl.author || pl.subtitle || "YouTube Music"}
                    </Text>
                  </View>
                  <MusicIcon name="chevronRight" size={18} color={tokens.label2} />
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {displaySimilar.map((sim) => {
                const simInitial = (sim.name[0] || "?").toUpperCase();
                return (
                  <Pressable
                    key={sim.browseId}
                    testID={`music-artist-related-${sim.browseId}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Open artist ${sim.name}`}
                    onPress={() => {
                      hapticTap();
                      onSelectArtist?.(sim);
                    }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      minHeight: 68,
                      padding: 10,
                      borderRadius: 14,
                      backgroundColor: tokens.sheet,
                      borderWidth: 1,
                      borderColor: tokens.panelRim,
                    }}
                  >
                    <View
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 28,
                        overflow: "hidden",
                        backgroundColor: tokens.grouped,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {sim.artworkUrl ? (
                        <Image
                          source={{ uri: toHighResArtworkUrl(sim.artworkUrl) ?? sim.artworkUrl }}
                          style={{ width: 56, height: 56 }}
                          resizeMode="cover"
                        />
                      ) : (
                        <Text style={{ color: tokens.label, fontSize: 20, fontWeight: "800" }}>{simInitial}</Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={{ color: tokens.label, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
                        {sim.name}
                      </Text>
                      <Text numberOfLines={1} style={{ color: tokens.label3, fontSize: TYPOGRAPHY.label.fontSize }}>
                        {sim.subtitle}
                      </Text>
                    </View>
                    <MusicIcon name="chevronRight" size={18} color={tokens.label2} />
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

export function SleepTimerModal({
  visible,
  remainingMinutes,
  tokens,
  onSelectMinutes,
  onClose,
}: {
  visible: boolean;
  remainingMinutes: number | null;
  tokens: MusicTokens;
  onSelectMinutes: (minutes: number | null) => void;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title="Sleep Timer"
      description={
        remainingMinutes !== null
          ? `Playback will pause automatically in about ${remainingMinutes} minute${remainingMinutes === 1 ? "" : "s"}.`
          : "Pause music and Google speaker casts automatically after a set time."
      }
      testID="music-sleep-modal"
    >
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {SLEEP_PRESETS.map((mins) => (
            <Pressable
              key={mins}
              testID={`music-sleep-opt-${mins}`}
              accessibilityRole="button"
              accessibilityLabel={`Set sleep timer for ${mins} minutes`}
              onPress={() => {
                hapticSelect();
                onSelectMinutes(mins);
                onClose();
              }}
              style={{
                flexGrow: 1,
                minWidth: 110,
                minHeight: 64,
                borderRadius: 16,
                backgroundColor: tokens.accent,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 16,
              }}
            >
              <Text style={{ color: tokens.onAccent, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "800" }}>
                {mins} min
              </Text>
            </Pressable>
          ))}
        </View>

        {remainingMinutes !== null ? (
          <Pressable
            testID="music-sleep-opt-off"
            accessibilityRole="button"
            accessibilityLabel="Turn off sleep timer"
            onPress={() => {
              hapticTap();
              onSelectMinutes(null);
              onClose();
            }}
            style={{
              minHeight: 64,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: tokens.panelRim,
              backgroundColor: tokens.sheet,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: tokens.label, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
              Turn Off Timer
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Modal>
  );
}

export function CreatePlaylistModal({
  visible,
  tokens,
  initialTrackCount = 0,
  canCreateOnYouTube = false,
  onCreate,
  onClose,
}: {
  visible: boolean;
  tokens: MusicTokens;
  initialTrackCount?: number;
  canCreateOnYouTube?: boolean;
  onCreate: (name: string, emoji: string, alsoYouTube?: boolean) => void;
  onClose: () => void;
}) {
  const [name, setName] = React.useState("");
  const [emoji, setEmoji] = React.useState("🎵");
  const [alsoYouTube, setAlsoYouTube] = React.useState(false);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    hapticSelect();
    onCreate(trimmed, emoji, canCreateOnYouTube && alsoYouTube);
    setName("");
    setEmoji("🎵");
    setAlsoYouTube(false);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title="New Family Playlist"
      description={
        initialTrackCount > 0
          ? `Includes ${initialTrackCount} track${initialTrackCount === 1 ? "" : "s"} currently ready.`
          : "Save favorite songs into a shared household playlist."
      }
      testID="music-create-playlist-modal"
    >
      <View style={{ gap: 14 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {PLAYLIST_EMOJIS.map((choice) => {
            const active = emoji === choice;
            return (
              <Pressable
                key={choice}
                accessibilityRole="button"
                accessibilityLabel={`Choose icon ${choice}`}
                accessibilityState={{ selected: active }}
                onPress={() => {
                  hapticSelect();
                  setEmoji(choice);
                }}
                style={{
                  minWidth: 64,
                  minHeight: 64,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: active ? tokens.accent : tokens.panelRim,
                  backgroundColor: active ? mix(tokens.accent, tokens.sheet, 22) : tokens.sheet,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 26 }}>{choice}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <TextInput
          testID="music-playlist-name-input"
          value={name}
          onChangeText={setName}
          onSubmitEditing={handleSubmit}
          placeholder="Playlist name (e.g. Sunday Cleaning)…"
          placeholderTextColor={tokens.label3}
          style={{
            minHeight: 64,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: tokens.panelRim,
            backgroundColor: tokens.sheet,
            paddingHorizontal: 16,
            color: tokens.label,
            fontSize: TYPOGRAPHY.body.fontSize,
          }}
        />

        {canCreateOnYouTube ? (
          <Pressable
            testID="music-playlist-youtube-toggle"
            accessibilityRole="button"
            accessibilityState={{ selected: alsoYouTube }}
            onPress={() => {
              hapticSelect();
              setAlsoYouTube((v) => !v);
            }}
            style={{
              minHeight: 64,
              paddingHorizontal: 16,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: alsoYouTube ? tokens.accent : tokens.panelRim,
              backgroundColor: alsoYouTube ? mix(tokens.accent, tokens.sheet, 18) : tokens.sheet,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: tokens.label, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
                Also save to my YouTube account
              </Text>
              <Text style={{ color: tokens.label3, fontSize: TYPOGRAPHY.label.fontSize }}>
                Creates this playlist directly on YouTube Music
              </Text>
            </View>
            <MusicIcon name={alsoYouTube ? "check" : "link"} size={20} color={alsoYouTube ? tokens.accent : tokens.label2} />
          </Pressable>
        ) : null}

        <Pressable
          testID="music-playlist-create-submit"
          accessibilityRole="button"
          accessibilityLabel="Create playlist"
          disabled={!name.trim()}
          onPress={handleSubmit}
          style={{
            minHeight: 64,
            borderRadius: 16,
            backgroundColor: tokens.accent,
            alignItems: "center",
            justifyContent: "center",
            opacity: name.trim() ? 1 : 0.5,
          }}
        >
          <Text style={{ color: tokens.onAccent, fontSize: TYPOGRAPHY.title.fontSize, fontWeight: "800" }}>
            Create Playlist
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}

export function AddToPlaylistModal({
  visible,
  track,
  playlists,
  isParent = false,
  youtubeConnected = false,
  youtubePlaylists = [],
  tokens,
  onSelectPlaylist,
  onSelectYouTubePlaylist,
  onOpenCreateNew,
  onClose,
}: {
  visible: boolean;
  track: MediaTrack | null;
  playlists: readonly FamilyPlaylist[];
  isParent?: boolean;
  youtubeConnected?: boolean;
  youtubePlaylists?: readonly YouTubeAccountPlaylist[];
  tokens: MusicTokens;
  onSelectPlaylist: (playlistId: string, track: MediaTrack) => void;
  onSelectYouTubePlaylist?: (playlistId: string, track: MediaTrack) => Promise<void> | void;
  onOpenCreateNew: () => void;
  onClose: () => void;
}) {
  const [busyYtId, setBusyYtId] = React.useState<string | null>(null);
  const [ytError, setYtError] = React.useState<string | null>(null);

  const handleClose = () => {
    setBusyYtId(null);
    setYtError(null);
    onClose();
  };

  const showYouTubeSection = isParent && youtubeConnected && youtubePlaylists.length > 0 && !!onSelectYouTubePlaylist;

  return (
    <Modal
      visible={visible}
      onClose={handleClose}
      title="Add to Playlist"
      description={track ? `Choose a playlist for "${track.title}"` : undefined}
      testID="music-add-playlist-modal"
    >
      <View style={{ gap: 12 }}>
        {ytError ? (
          <Text style={{ color: tokens.label, fontSize: TYPOGRAPHY.label.fontSize }}>
            {ytError}
          </Text>
        ) : null}

        <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ gap: 10 }}>
          {showYouTubeSection ? (
            <View style={{ gap: 8 }}>
              <Text style={{ color: tokens.accent, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "800" }}>
                Your YouTube Account Playlists
              </Text>
              {youtubePlaylists.map((yt) => (
                <Pressable
                  key={`yt-${yt.id}`}
                  testID={`music-add-to-yt-${yt.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Add to YouTube playlist ${yt.title}`}
                  disabled={busyYtId !== null}
                  onPress={() => {
                    if (!track || !onSelectYouTubePlaylist) return;
                    setBusyYtId(yt.id);
                    setYtError(null);
                    void Promise.resolve(onSelectYouTubePlaylist(yt.id, track))
                      .then(() => {
                        hapticSelect();
                        handleClose();
                      })
                      .catch((e: unknown) => {
                        setYtError(e instanceof Error ? e.message : "Could not save to YouTube.");
                      })
                      .finally(() => setBusyYtId(null));
                  }}
                  style={{
                    minHeight: 64,
                    paddingHorizontal: 16,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: tokens.accent,
                    backgroundColor: tokens.sheet,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <MusicIcon name="link" size={20} color={tokens.accent} />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ color: tokens.label, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
                      {yt.title}
                    </Text>
                    <Text style={{ color: tokens.label3, fontSize: TYPOGRAPHY.label.fontSize }}>
                      YouTube • {yt.itemCount} {yt.itemCount === 1 ? "song" : "songs"}
                    </Text>
                  </View>
                  {busyYtId === yt.id ? (
                    <ActivityIndicator color={tokens.accent} />
                  ) : (
                    <MusicIcon name="plus" size={20} color={tokens.accent} />
                  )}
                </Pressable>
              ))}
            </View>
          ) : null}

          <View style={{ gap: 8 }}>
            {showYouTubeSection ? (
              <Text style={{ color: tokens.label2, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "800", marginTop: 4 }}>
                Household Playlists
              </Text>
            ) : null}
            {playlists.length === 0 ? (
              <Text style={{ color: tokens.label2, fontSize: TYPOGRAPHY.body.fontSize }}>
                No household playlists yet. Create one below to save this song.
              </Text>
            ) : (
              playlists.map((pl) => {
                const alreadyAdded = !!track && pl.tracks.some((t) => t.id === track.id);
                return (
                  <Pressable
                    key={pl.id}
                    testID={`music-add-to-playlist-${pl.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Add to ${pl.name}`}
                    onPress={() => {
                      if (!track) return;
                      hapticSelect();
                      onSelectPlaylist(pl.id, track);
                      handleClose();
                    }}
                    style={{
                      minHeight: 64,
                      paddingHorizontal: 16,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: alreadyAdded ? tokens.accent : tokens.panelRim,
                      backgroundColor: tokens.sheet,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <Text style={{ fontSize: 24 }}>{pl.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={{ color: tokens.label, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
                        {pl.name}
                      </Text>
                      <Text style={{ color: tokens.label3, fontSize: TYPOGRAPHY.label.fontSize }}>
                        {pl.tracks.length} {pl.tracks.length === 1 ? "track" : "tracks"}
                      </Text>
                    </View>
                    {alreadyAdded ? (
                      <MusicIcon name="check" size={20} color={tokens.accent} />
                    ) : (
                      <MusicIcon name="plus" size={20} color={tokens.label} />
                    )}
                  </Pressable>
                );
              })
            )}
          </View>
        </ScrollView>

        <Pressable
          testID="music-add-playlist-create-new"
          accessibilityRole="button"
          accessibilityLabel="Create a new playlist"
          onPress={() => {
            hapticTap();
            handleClose();
            onOpenCreateNew();
          }}
          style={{
            minHeight: 64,
            borderRadius: 16,
            backgroundColor: tokens.accent,
            flexDirection: "row",
            gap: 8,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MusicIcon name="plus" size={20} color={tokens.onAccent} />
          <Text style={{ color: tokens.onAccent, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "800" }}>
            Create New Playlist
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}

export function PlaylistDetailModal({
  visible,
  playlist,
  tokens,
  onPlayAll,
  onShuffle,
  onPlayTrack,
  onRemoveTrack,
  onDeletePlaylist,
  onClose,
}: {
  visible: boolean;
  playlist: FamilyPlaylist | null;
  tokens: MusicTokens;
  onPlayAll: (tracks: MediaTrack[]) => void;
  onShuffle: (tracks: MediaTrack[]) => void;
  onPlayTrack: (track: MediaTrack, list: MediaTrack[]) => void;
  onRemoveTrack: (playlistId: string, trackId: string) => void;
  onDeletePlaylist: (playlistId: string) => void;
  onClose: () => void;
}) {
  if (!playlist) return null;
  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={`${playlist.emoji} ${playlist.name}`}
      description={`${playlist.tracks.length} ${playlist.tracks.length === 1 ? "track" : "tracks"}`}
      testID="music-playlist-detail-modal"
    >
      <View style={{ gap: 14 }}>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable
            testID="music-playlist-play-all"
            accessibilityRole="button"
            accessibilityLabel={`Play ${playlist.name}`}
            disabled={playlist.tracks.length === 0}
            onPress={() => {
              hapticTap();
              onPlayAll(playlist.tracks);
            }}
            style={{
              flex: 1,
              minHeight: 64,
              borderRadius: 16,
              backgroundColor: tokens.accent,
              flexDirection: "row",
              gap: 8,
              alignItems: "center",
              justifyContent: "center",
              opacity: playlist.tracks.length === 0 ? 0.5 : 1,
            }}
          >
            <MusicIcon name="play" size={18} color={tokens.onAccent} filled />
            <Text style={{ color: tokens.onAccent, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "800" }}>
              Play All
            </Text>
          </Pressable>
          <Pressable
            testID="music-playlist-shuffle"
            accessibilityRole="button"
            accessibilityLabel={`Shuffle ${playlist.name}`}
            disabled={playlist.tracks.length === 0}
            onPress={() => {
              hapticTap();
              onShuffle(playlist.tracks);
            }}
            style={{
              flex: 1,
              minHeight: 64,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: tokens.panelRim,
              backgroundColor: tokens.sheet,
              flexDirection: "row",
              gap: 8,
              alignItems: "center",
              justifyContent: "center",
              opacity: playlist.tracks.length === 0 ? 0.5 : 1,
            }}
          >
            <MusicIcon name="shuffle" size={18} color={tokens.label} />
            <Text style={{ color: tokens.label, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
              Shuffle
            </Text>
          </Pressable>
        </View>

        {playlist.tracks.length === 0 ? (
          <Text style={{ color: tokens.label2, fontSize: TYPOGRAPHY.body.fontSize, paddingVertical: 12 }}>
            No tracks in this playlist yet. Tap the playlist button on any song to add it here.
          </Text>
        ) : (
          <ScrollView style={{ maxHeight: 340 }} contentContainerStyle={{ gap: 8 }}>
            {playlist.tracks.map((track) => (
              <View
                key={track.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  minHeight: 64,
                  paddingHorizontal: 10,
                  borderRadius: 14,
                  backgroundColor: tokens.sheet,
                }}
              >
                <ArtworkThumb testID={`music-pl-thumb-${track.id}`} track={track} tokens={tokens} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Play ${track.title}`}
                  onPress={() => onPlayTrack(track, playlist.tracks)}
                  style={{ flex: 1, minHeight: 64, justifyContent: "center" }}
                >
                  <Text numberOfLines={1} style={{ color: tokens.label, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
                    {track.title}
                  </Text>
                  <Text numberOfLines={1} style={{ color: tokens.label3, fontSize: TYPOGRAPHY.label.fontSize }}>
                    {track.artist}
                  </Text>
                </Pressable>
                <Pressable
                  testID={`music-pl-remove-${track.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${track.title} from ${playlist.name}`}
                  onPress={() => {
                    hapticTap();
                    onRemoveTrack(playlist.id, track.id);
                  }}
                  style={{ minWidth: 64, minHeight: 64, alignItems: "center", justifyContent: "center" }}
                >
                  <MusicIcon name="close" size={18} color={tokens.label2} />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        )}

        <Pressable
          testID="music-playlist-delete"
          accessibilityRole="button"
          accessibilityLabel={`Delete playlist ${playlist.name}`}
          onPress={() => {
            hapticTap();
            onDeletePlaylist(playlist.id);
            onClose();
          }}
          style={{
            minHeight: 64,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: tokens.panelRim,
            flexDirection: "row",
            gap: 8,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MusicIcon name="trash" size={18} color={tokens.label} />
          <Text style={{ color: tokens.label, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
            Delete Playlist
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}

export function DenyListModal({
  visible,
  denylist,
  denyTerm,
  tokens,
  onChangeTerm,
  onAddTerm,
  onRemoveTerm,
  onClose,
}: {
  visible: boolean;
  denylist: DenyEntry[];
  denyTerm: string;
  tokens: MusicTokens;
  onChangeTerm: (text: string) => void;
  onAddTerm: () => void;
  onRemoveTerm: (term: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title="Blocked artists & songs"
      testID="music-deny-modal"
    >
      <View style={{ gap: 12 }}>
        <Text style={{ color: tokens.label2, fontSize: TYPOGRAPHY.body.fontSize, lineHeight: TYPOGRAPHY.body.lineHeight }}>
          Anything matching these stays away from the kids.
        </Text>

        {denylist.length === 0 ? (
          <Text testID="music-deny-empty" style={{ color: tokens.label2, fontSize: TYPOGRAPHY.body.fontSize, lineHeight: TYPOGRAPHY.body.lineHeight }}>
            Nothing blocked yet.
          </Text>
        ) : (
          denylist.map((entry, index) => (
            <View
              key={`${entry.term}-${index}`}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64 }}
            >
              <Text numberOfLines={1} style={{ flex: 1, color: tokens.label, fontSize: TYPOGRAPHY.body.fontSize }}>
                {entry.term}
              </Text>
              <Pressable
                testID={`music-deny-remove-${index}`}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${entry.term} from the blocked list`}
                onPress={() => onRemoveTerm(entry.term)}
                style={{ minHeight: 64, minWidth: 64, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: mix(tokens.label, "transparent", 8) }}
              >
                <Text style={{ color: tokens.label, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>Remove</Text>
              </Pressable>
            </View>
          ))
        )}

        <View style={{ flexDirection: "row", gap: 10 }}>
          <TextInput
            testID="music-deny-input"
            value={denyTerm}
            onChangeText={onChangeTerm}
            onSubmitEditing={onAddTerm}
            placeholder="Artist or song name"
            placeholderTextColor={tokens.label3}
            style={{ flex: 1, minHeight: 64, borderWidth: 1, borderColor: tokens.panelRim, borderRadius: 16, paddingHorizontal: 16, color: tokens.label, fontSize: TYPOGRAPHY.body.fontSize }}
          />
          <Pressable
            testID="music-deny-add"
            accessibilityRole="button"
            accessibilityLabel="Add to the blocked list"
            onPress={onAddTerm}
            style={{ minHeight: 64, paddingHorizontal: 20, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: tokens.accent }}
          >
            <Text style={{ color: tokens.onAccent, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "800" }}>Add</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export function MusicParentPinModal({
  visible,
  busy,
  error,
  attempt,
  onVerified,
  onCancel,
}: {
  visible: boolean;
  busy: boolean;
  error: string | null;
  attempt: number;
  onVerified: (pin: string) => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      visible={visible}
      onClose={onCancel}
      title="Parent PIN for Music"
      description="Unlock explicit tracks, the kid-safe filter, and the blocked list for this session"
      dismissable={!busy}
      testID="music-parent-pin-modal"
    >
      <PinPad
        key={`music-parent-pin-${attempt}`}
        testID="music-parent-pinpad"
        member={{ name: "Parent", emoji: "🔒" }}
        onVerified={onVerified}
        onCancel={onCancel}
        busy={busy}
        error={error}
      />
    </Modal>
  );
}

export interface CollectionTrackItem extends MediaTrack {
  playlistItemId?: string;
}

export function CollectionDetailModal({
  visible,
  title,
  subtitle,
  artist,
  kind,
  artworkUrl,
  tracks,
  noteText = null,
  loading,
  isRemoteAccount = false,
  isParent = false,
  denied = [],
  tokens,
  isLiked,
  onPlayAll,
  onShuffle,
  onQueueAll,
  onSaveToHousehold,
  onRefreshRemote,
  onPlayTrack,
  onQueueTrack,
  onPlayNextTrack,
  onToggleLike,
  onAddToPlaylist,
  onRemoveRemoteTrack,
  onClose,
}: {
  visible: boolean;
  title: string;
  subtitle: string;
  artist: string;
  kind: "album" | "playlist";
  artworkUrl: string | null;
  tracks: readonly CollectionTrackItem[];
  noteText?: string | null;
  loading: boolean;
  isRemoteAccount?: boolean;
  isParent?: boolean;
  denied?: string[];
  tokens: MusicTokens;
  isLiked?: (trackId: string) => boolean;
  onPlayAll: () => void;
  onShuffle: () => void;
  onQueueAll?: () => void;
  onSaveToHousehold?: () => void;
  onRefreshRemote?: () => void;
  onPlayTrack: (track: MediaTrack) => void;
  onQueueTrack: (track: MediaTrack) => void;
  onPlayNextTrack?: (track: MediaTrack) => void;
  onToggleLike?: (track: MediaTrack) => void;
  onAddToPlaylist?: (track: MediaTrack) => void;
  onRemoveRemoteTrack?: (playlistItemId: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={title || (kind === "album" ? "Album" : "Playlist")}
      testID="music-collection-modal"
    >
      <View style={{ gap: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View
            style={{
              width: 88,
              height: 88,
              borderRadius: 16,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: tokens.panelRim,
              backgroundColor: tokens.grouped,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {artworkUrl ? (
              <Image
                source={{ uri: toHighResArtworkUrl(artworkUrl) ?? artworkUrl }}
                style={{ width: 88, height: 88 }}
                resizeMode="cover"
              />
            ) : (
              <MusicIcon name={kind === "album" ? "disc" : "playlist"} size={36} color={tokens.accent} />
            )}
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text numberOfLines={2} style={{ color: tokens.label, fontSize: TYPOGRAPHY.title.fontSize, fontWeight: "800" }}>
              {title}
            </Text>
            {artist ? (
              <Text numberOfLines={1} style={{ color: tokens.label2, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "600" }}>
                {artist}
              </Text>
            ) : null}
            <Text numberOfLines={1} style={{ color: tokens.label3, fontSize: TYPOGRAPHY.label.fontSize }}>
              {isRemoteAccount ? `Synced with YouTube • ${tracks.length} songs` : subtitle || `${tracks.length} songs`}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Pressable
            testID="music-collection-play-all"
            accessibilityRole="button"
            accessibilityLabel={`Play ${title}`}
            disabled={tracks.length === 0}
            onPress={() => {
              hapticTap();
              onPlayAll();
            }}
            style={{
              flexGrow: 1,
              minHeight: 64,
              minWidth: 120,
              paddingHorizontal: 16,
              borderRadius: 16,
              backgroundColor: tokens.accent,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              opacity: tracks.length === 0 ? 0.5 : 1,
            }}
          >
            <MusicIcon name="play" size={18} color={tokens.onAccent} filled />
            <Text style={{ color: tokens.onAccent, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "800" }}>
              Play All
            </Text>
          </Pressable>

          <Pressable
            testID="music-collection-shuffle"
            accessibilityRole="button"
            accessibilityLabel={`Shuffle ${title}`}
            disabled={tracks.length === 0}
            onPress={() => {
              hapticTap();
              onShuffle();
            }}
            style={{
              minHeight: 64,
              minWidth: 64,
              paddingHorizontal: 16,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: tokens.panelRim,
              backgroundColor: tokens.sheet,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              opacity: tracks.length === 0 ? 0.5 : 1,
            }}
          >
            <MusicIcon name="shuffle" size={18} color={tokens.label} />
            <Text style={{ color: tokens.label, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
              Shuffle
            </Text>
          </Pressable>

          {onQueueAll ? (
            <Pressable
              testID="music-collection-queue-all"
              accessibilityRole="button"
              accessibilityLabel={`Add ${title} to queue`}
              disabled={tracks.length === 0}
              onPress={() => {
                hapticTap();
                onQueueAll();
              }}
              style={{
                minHeight: 64,
                minWidth: 64,
                paddingHorizontal: 16,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: tokens.panelRim,
                backgroundColor: tokens.sheet,
                alignItems: "center",
                justifyContent: "center",
                opacity: tracks.length === 0 ? 0.5 : 1,
              }}
            >
              <Text style={{ color: tokens.label, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
                + Queue
              </Text>
            </Pressable>
          ) : null}

          {onSaveToHousehold && tracks.length > 0 ? (
            <Pressable
              testID="music-collection-save"
              accessibilityRole="button"
              accessibilityLabel={`Save ${title} as household playlist`}
              onPress={() => {
                hapticTap();
                onSaveToHousehold();
              }}
              style={{
                minHeight: 64,
                minWidth: 64,
                paddingHorizontal: 14,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: tokens.panelRim,
                backgroundColor: tokens.sheet,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
            >
              <MusicIcon name="playlist" size={18} color={tokens.label} />
              <Text style={{ color: tokens.label, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
                Save Mix
              </Text>
            </Pressable>
          ) : null}

          {isRemoteAccount && onRefreshRemote ? (
            <Pressable
              testID="music-collection-refresh"
              accessibilityRole="button"
              accessibilityLabel="Refresh synced YouTube playlist"
              onPress={() => {
                hapticTap();
                onRefreshRemote();
              }}
              style={{
                minHeight: 64,
                minWidth: 64,
                paddingHorizontal: 14,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: tokens.accent,
                backgroundColor: tokens.sheet,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: tokens.accent, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
                Refresh
              </Text>
            </Pressable>
          ) : null}
        </View>

        {loading ? (
          <View style={{ paddingVertical: 28, alignItems: "center" }}>
            <ActivityIndicator color={tokens.accent} />
          </View>
        ) : tracks.length === 0 ? (
          <Text
            testID="music-collection-empty-note"
            style={{ color: tokens.label2, fontSize: TYPOGRAPHY.body.fontSize, textAlign: "center", paddingVertical: 16 }}
          >
            {noteText ?? "No playable songs found here."}
          </Text>
        ) : (
          <ScrollView nestedScrollEnabled style={{ maxHeight: 380 }} contentContainerStyle={{ gap: 8 }}>
            {tracks.map((track, idx) => {
              const liked = isLiked ? isLiked(track.id) : false;
              const unrated = isParent && track.explicit === null;
              const blocked = isParent && isDeniedTerm(track, denied);
              return (
                <View
                  key={`${track.id}-${idx}`}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    minHeight: 64,
                    paddingHorizontal: 10,
                    borderRadius: 14,
                    backgroundColor: tokens.sheet,
                  }}
                >
                  <Text style={{ color: tokens.label3, fontSize: TYPOGRAPHY.label.fontSize, width: 24, textAlign: "center", fontWeight: "700" }}>
                    {idx + 1}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Play ${track.title}`}
                    onPress={() => onPlayTrack(track)}
                    style={{ flex: 1, minHeight: 64, justifyContent: "center" }}
                  >
                    <Text numberOfLines={1} style={{ color: tokens.label, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
                      {track.title}
                    </Text>
                    <Text numberOfLines={1} style={{ color: tokens.label3, fontSize: TYPOGRAPHY.label.fontSize }}>
                      {[
                        track.artist || artist,
                        track.durationSeconds ? formatMusicClock(track.durationSeconds) : null,
                        unrated ? "Unrated" : null,
                        blocked ? "Blocked for kids" : null,
                      ]
                        .filter(Boolean)
                        .join(" • ")}
                    </Text>
                  </Pressable>
                  {onToggleLike ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={liked ? `Unlike ${track.title}` : `Like ${track.title}`}
                      onPress={() => {
                        hapticSelect();
                        onToggleLike(track);
                      }}
                      style={{ minWidth: 64, minHeight: 64, alignItems: "center", justifyContent: "center" }}
                    >
                      <MusicIcon name="heart" size={18} color={liked ? tokens.accent : tokens.label3} filled={liked} />
                    </Pressable>
                  ) : null}
                  {onAddToPlaylist && !isRemoteAccount ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Add ${track.title} to playlist`}
                      onPress={() => {
                        hapticTap();
                        onAddToPlaylist(track);
                      }}
                      style={{ minWidth: 64, minHeight: 64, alignItems: "center", justifyContent: "center" }}
                    >
                      <MusicIcon name="playlist" size={18} color={tokens.label2} />
                    </Pressable>
                  ) : null}
                  {onPlayNextTrack ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Play ${track.title} next`}
                      onPress={() => {
                        hapticTap();
                        onPlayNextTrack(track);
                      }}
                      style={{ minWidth: 64, minHeight: 64, alignItems: "center", justifyContent: "center" }}
                    >
                      <MusicIcon name="playNext" size={18} color={tokens.label2} />
                    </Pressable>
                  ) : null}
                  {isParent && isRemoteAccount && track.playlistItemId && onRemoveRemoteTrack ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${track.title} from YouTube playlist`}
                      onPress={() => {
                        hapticTap();
                        onRemoveRemoteTrack(track.playlistItemId!);
                      }}
                      style={{ minWidth: 64, minHeight: 64, alignItems: "center", justifyContent: "center" }}
                    >
                      <MusicIcon name="trash" size={18} color={tokens.label2} />
                    </Pressable>
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Add ${track.title} to queue`}
                      onPress={() => {
                        hapticTap();
                        onQueueTrack(track);
                      }}
                      style={{ minWidth: 64, minHeight: 64, alignItems: "center", justifyContent: "center" }}
                    >
                      <MusicIcon name="plus" size={18} color={tokens.label2} />
                    </Pressable>
                  )}
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

export function YouTubeAccountModal({
  visible,
  status,
  busy,
  error,
  tokens,
  onStartConnect,
  onCheckStatus,
  onSyncNow,
  onDisconnect,
  onClose,
}: {
  visible: boolean;
  status: YouTubeAccountStatus;
  busy: boolean;
  error: string | null;
  tokens: MusicTokens;
  onStartConnect: () => void;
  onCheckStatus: () => void;
  onSyncNow: () => void;
  onDisconnect: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title="YouTube Account Sync"
      description="Link your YouTube account through Consuela so playlists and liked songs sync with this panel."
      testID="music-yt-account-modal"
    >
      <View style={{ gap: 12 }}>
        <View
          style={{
            padding: 14,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: status.connected ? tokens.accent : tokens.panelRim,
            backgroundColor: tokens.sheet,
            gap: 4,
          }}
        >
          <Text style={{ color: tokens.label, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "800" }}>
            {status.connected
              ? status.accountEmail
                ? `Connected: ${status.accountEmail}`
                : "Connected to YouTube"
              : status.pending
                ? "Waiting for Google sign-in…"
                : "Not connected yet"}
          </Text>
          <Text style={{ color: tokens.label3, fontSize: TYPOGRAPHY.label.fontSize }}>
            {status.connected
              ? "Playlists and liked tracks sync with your YouTube Music library."
              : status.pending
                ? "Finish signing in with Google in the browser tab, then tap Check Sign-in Status."
                : "Uses the household Composio YouTube connector without adding password credentials to the app."}
          </Text>
        </View>

        {error ? (
          <Text testID="music-yt-error" style={{ color: tokens.label, fontSize: TYPOGRAPHY.label.fontSize }}>
            {error}
          </Text>
        ) : null}

        {busy ? <ActivityIndicator color={tokens.accent} /> : null}

        {status.connected ? (
          <View style={{ gap: 10 }}>
            <Pressable
              testID="music-yt-sync-now"
              accessibilityRole="button"
              accessibilityLabel="Refresh YouTube playlists"
              disabled={busy}
              onPress={() => {
                hapticTap();
                onSyncNow();
              }}
              style={{
                minHeight: 64,
                borderRadius: 16,
                backgroundColor: tokens.accent,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: tokens.onAccent, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "800" }}>
                Sync Playlists Now
              </Text>
            </Pressable>
            <Pressable
              testID="music-yt-disconnect"
              accessibilityRole="button"
              accessibilityLabel="Disconnect YouTube account"
              disabled={busy}
              onPress={() => {
                hapticTap();
                onDisconnect();
              }}
              style={{
                minHeight: 64,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: tokens.panelRim,
                backgroundColor: tokens.sheet,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: tokens.label, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
                Disconnect YouTube
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            <Pressable
              testID="music-yt-start-connect"
              accessibilityRole="button"
              accessibilityLabel="Link YouTube account"
              disabled={busy}
              onPress={() => {
                hapticTap();
                onStartConnect();
              }}
              style={{
                minHeight: 64,
                borderRadius: 16,
                backgroundColor: tokens.accent,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <MusicIcon name="link" size={18} color={tokens.onAccent} />
              <Text style={{ color: tokens.onAccent, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "800" }}>
                Link YouTube Account
              </Text>
            </Pressable>
            <Pressable
              testID="music-yt-check-status"
              accessibilityRole="button"
              accessibilityLabel="Check Google sign-in status"
              disabled={busy}
              onPress={() => {
                hapticTap();
                onCheckStatus();
              }}
              style={{
                minHeight: 64,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: tokens.panelRim,
                backgroundColor: tokens.sheet,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: tokens.label, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
                Check Sign-in Status
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}
