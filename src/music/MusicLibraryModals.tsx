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
import type { DenyEntry, FamilyPlaylist, MediaTrack, SleepTimerMinutes } from "./types";

const PLAYLIST_EMOJIS = ["🎵", "🎉", "🔥", "🌮", "🚗", "🌙", "❤️", "🎸"];
const SLEEP_PRESETS: readonly SleepTimerMinutes[] = [15, 30, 45, 60];

export function ArtistModal({
  visible,
  artistName,
  artworkUrl,
  tracks,
  loading,
  isFavorite,
  tokens,
  onClose,
  onToggleFavorite,
  onPlayAll,
  onShuffle,
  onStartRadio,
  onPlayTrack,
  onQueueTrack,
  onPlayNextTrack,
}: {
  visible: boolean;
  artistName: string;
  artworkUrl?: string | null;
  tracks: MediaTrack[];
  loading: boolean;
  isFavorite: boolean;
  tokens: MusicTokens;
  onClose: () => void;
  onToggleFavorite: () => void;
  onPlayAll: () => void;
  onShuffle: () => void;
  onStartRadio: () => void;
  onPlayTrack: (track: MediaTrack) => void;
  onQueueTrack: (track: MediaTrack) => void;
  onPlayNextTrack?: (track: MediaTrack) => void;
}) {
  const initial = (artistName[0] || "?").toUpperCase();

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={artistName}
      testID="music-artist-modal"
    >
      <View style={{ gap: 16 }}>
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
            {artworkUrl ? (
              <Image
                source={{ uri: toHighResArtworkUrl(artworkUrl) ?? artworkUrl }}
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
            <Text style={{ color: tokens.label2, fontSize: TYPOGRAPHY.label.fontSize }}>
              Artist Profile • YouTube Music
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
            disabled={tracks.length === 0}
            style={{
              flex: 1,
              minHeight: 64,
              borderRadius: 14,
              backgroundColor: tokens.accent,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 8,
              opacity: tracks.length === 0 ? 0.5 : 1,
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
            disabled={tracks.length === 0}
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
              opacity: tracks.length === 0 ? 0.5 : 1,
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

        <View style={{ gap: 8, maxHeight: 380 }}>
          <Text style={{ color: tokens.label, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "800" }}>
            Top Tracks
          </Text>
          {loading ? (
            <View style={{ paddingVertical: 24, alignItems: "center" }}>
              <ActivityIndicator color={tokens.accent} />
            </View>
          ) : tracks.length === 0 ? (
            <Text style={{ color: tokens.label3, fontSize: TYPOGRAPHY.label.fontSize, textAlign: "center", paddingVertical: 16 }}>
              No tracks found for this artist.
            </Text>
          ) : (
            <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {tracks.map((t, idx) => (
                <View
                  key={t.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
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
                      {t.durationSeconds ? formatMusicClock(t.durationSeconds) : "--:--"}
                    </Text>
                  </Pressable>
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
              ))}
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
  onCreate,
  onClose,
}: {
  visible: boolean;
  tokens: MusicTokens;
  initialTrackCount?: number;
  onCreate: (name: string, emoji: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = React.useState("");
  const [emoji, setEmoji] = React.useState("🎵");

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    hapticSelect();
    onCreate(trimmed, emoji);
    setName("");
    setEmoji("🎵");
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
  tokens,
  onSelectPlaylist,
  onOpenCreateNew,
  onClose,
}: {
  visible: boolean;
  track: MediaTrack | null;
  playlists: readonly FamilyPlaylist[];
  tokens: MusicTokens;
  onSelectPlaylist: (playlistId: string, track: MediaTrack) => void;
  onOpenCreateNew: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title="Add to Playlist"
      description={track ? `Choose a playlist for "${track.title}"` : undefined}
      testID="music-add-playlist-modal"
    >
      <View style={{ gap: 12 }}>
        {playlists.length === 0 ? (
          <Text style={{ color: tokens.label2, fontSize: TYPOGRAPHY.body.fontSize }}>
            No custom playlists yet. Create one below to save this song.
          </Text>
        ) : (
          <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ gap: 8 }}>
            {playlists.map((pl) => {
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
                    onClose();
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
            })}
          </ScrollView>
        )}

        <Pressable
          testID="music-add-playlist-create-new"
          accessibilityRole="button"
          accessibilityLabel="Create a new playlist"
          onPress={() => {
            hapticTap();
            onClose();
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
