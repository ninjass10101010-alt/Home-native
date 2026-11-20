import React from "react";
import { Dimensions, Image, Platform, Pressable, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import type { StreamFormat } from "../../modules/youtube-engine";
import { hapticSelect, hapticTap } from "../theme/haptics";
import { mix } from "../theme/mix";
import type { MusicTokens } from "../theme/music-tokens";
import { SPRING, TYPOGRAPHY } from "../theme/tokens";
import { CastVolume } from "./CastVolume";
import { MusicIcon, type MusicIconName } from "./MusicIcons";
import { WaveformBars } from "./MusicIsland";
import { TransportPill } from "./TransportPill";
import { toHighResArtworkUrl } from "./artwork";
import { formatCodecChip } from "./codec";
import { STAGE_TYPE } from "./stage-type";
import type { MediaTrack, RepeatMode } from "./types";

const STAGE_FADE_MS = 250;
const STAGE_MAX_ARTWORK_EDGE = 560;

type NativeResponderBlock = { onShouldBlockNativeResponder: () => boolean };
const BLOCK_NATIVE_RESPONDER = {
  onShouldBlockNativeResponder: () => true,
} as NativeResponderBlock;

export function formatMusicClock(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export interface ScrubberSectionProps {
  position: number;
  duration: number;
  tokens: MusicTokens;
  onSeek: (seconds: number) => void;
}

export const ScrubberSection = React.memo(function ScrubberSection({
  position,
  duration,
  tokens,
  onSeek,
}: ScrubberSectionProps) {
  const [seekWidth, setSeekWidth] = React.useState(0);
  const [draggingFraction, setDraggingFraction] = React.useState<number | null>(null);

  const liveFraction = duration > 0 ? Math.min(1, Math.max(0, position / duration)) : 0;
  const displayFraction = draggingFraction ?? liveFraction;
  const displaySeconds = draggingFraction !== null && duration > 0
    ? draggingFraction * duration
    : position;

  const fractionFromX = (locationX: number) => {
    if (seekWidth <= 0) return 0;
    return Math.min(1, Math.max(0, locationX / seekWidth));
  };

  return (
    <>
      <Pressable
        testID="np-seek"
        accessibilityRole="adjustable"
        accessibilityLabel="Seek"
        accessibilityValue={{
          min: 0,
          max: Math.max(0, Math.round(duration)),
          now: Math.max(0, Math.round(displaySeconds)),
        }}
        onLayout={(e) => setSeekWidth(e.nativeEvent.layout.width)}
        onPress={(e) => {
          if (seekWidth > 0 && duration > 0 && draggingFraction === null) {
            onSeek(fractionFromX(e.nativeEvent.locationX) * duration);
          }
        }}
        onStartShouldSetResponder={() => seekWidth > 0 && duration > 0}
        onMoveShouldSetResponder={() => seekWidth > 0 && duration > 0}
        {...BLOCK_NATIVE_RESPONDER}
        onResponderGrant={(e) => {
          if (seekWidth > 0 && duration > 0) {
            setDraggingFraction(fractionFromX(e.nativeEvent.locationX));
          }
        }}
        onResponderMove={(e) => {
          if (seekWidth > 0 && duration > 0) {
            setDraggingFraction(fractionFromX(e.nativeEvent.locationX));
          }
        }}
        onResponderRelease={(e) => {
          if (seekWidth > 0 && duration > 0) {
            const targetFrac = fractionFromX(e.nativeEvent.locationX);
            setDraggingFraction(null);
            hapticSelect();
            onSeek(targetFrac * duration);
          } else {
            setDraggingFraction(null);
          }
        }}
        onResponderTerminate={() => setDraggingFraction(null)}
        style={{ height: 64, justifyContent: "center" }}
      >
        <View style={{ height: draggingFraction !== null ? 8 : 6, borderRadius: 4, backgroundColor: mix(tokens.label, "transparent", 28), overflow: "visible", justifyContent: "center" }}>
          <View
            style={{
              width: `${Math.round(displayFraction * 100)}%`,
              height: "100%",
              borderRadius: 4,
              backgroundColor: tokens.accent,
            }}
          />
          {duration > 0 ? (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: `${Math.round(displayFraction * 100)}%`,
                marginLeft: draggingFraction !== null ? -10 : -7,
                width: draggingFraction !== null ? 20 : 14,
                height: draggingFraction !== null ? 20 : 14,
                borderRadius: 10,
                backgroundColor: tokens.accent,
                borderWidth: 2,
                borderColor: tokens.onAccent,
              }}
            />
          ) : null}
        </View>
      </Pressable>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: tokens.label, fontSize: TYPOGRAPHY.label.fontSize, lineHeight: TYPOGRAPHY.label.lineHeight, fontWeight: "500" }}>
          {formatMusicClock(displaySeconds)}
        </Text>
        <Text style={{ color: tokens.label, fontSize: TYPOGRAPHY.label.fontSize, lineHeight: TYPOGRAPHY.label.lineHeight, fontWeight: "500" }}>
          {duration > 0 ? formatMusicClock(duration) : "--:--"}
        </Text>
      </View>
    </>
  );
});

export interface StageProps {
  track: MediaTrack;
  tokens: MusicTokens;
  reduceMotion: boolean;
  playing: boolean;
  position: number;
  duration: number;
  repeat: RepeatMode;
  shuffle: boolean;
  downloaded: boolean;
  casting: boolean;
  player?: { volume: number } | null;
  queueCount?: number;
  streamFormat: StreamFormat | null;
  onToggle: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSeek: (seconds: number) => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
  onDownload: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  isLiked?: boolean;
  onToggleLike?: () => void;
  sleepRemainingMinutes?: number | null;
  onOpenLyrics?: () => void;
  onOpenQueue?: () => void;
  onOpenAddToPlaylist?: () => void;
  onOpenSleepTimer?: () => void;
  onCreateStation?: () => void;
  onSelectArtist?: (artist: string) => void;
}

function StageUtilityChip({
  testID,
  accessibilityLabel,
  icon,
  label,
  active = false,
  filled = false,
  tokens,
  onPress,
}: {
  testID: string;
  accessibilityLabel: string;
  icon: MusicIconName;
  label: string;
  active?: boolean;
  filled?: boolean;
  tokens: MusicTokens;
  onPress?: () => void;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={active ? { selected: true } : undefined}
      onPress={() => {
        hapticTap();
        onPress?.();
      }}
      style={{
        flex: 1,
        minWidth: 64,
        minHeight: 64,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        borderWidth: 1,
        borderColor: active ? tokens.accent : tokens.glassRim,
        backgroundColor: active ? mix(tokens.accent, tokens.glassFill, 20) : tokens.glassFill,
      }}
    >
      <MusicIcon
        name={icon}
        size={20}
        color={active ? tokens.accent : tokens.label}
        filled={filled}
      />
      <Text
        numberOfLines={1}
        style={{
          color: tokens.label,
          fontSize: TYPOGRAPHY.label.fontSize,
          lineHeight: TYPOGRAPHY.label.lineHeight,
          fontWeight: "600",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export const NowPlayingStage = React.memo(function NowPlayingStage({
  track,
  tokens,
  reduceMotion,
  playing,
  position,
  duration,
  repeat,
  shuffle,
  downloaded,
  player,
  queueCount = 0,
  streamFormat,
  onToggle,
  onNext,
  onPrevious,
  onSeek,
  onToggleShuffle,
  onCycleRepeat,
  onDownload,
  isFavorite = false,
  onToggleFavorite,
  isLiked = false,
  onToggleLike,
  sleepRemainingMinutes = null,
  onOpenLyrics,
  onOpenQueue,
  onOpenAddToPlaylist,
  onOpenSleepTimer,
  onCreateStation,
  onSelectArtist,
}: StageProps) {
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);

  React.useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(opacity);
      cancelAnimation(scale);
      opacity.value = 1;
      scale.value = 1;
      return;
    }
    cancelAnimation(opacity);
    cancelAnimation(scale);
    opacity.value = withTiming(1, { duration: STAGE_FADE_MS });
    scale.value = withSpring(playing ? 1 : 0.94, SPRING.settle);
  }, [track.id, playing, reduceMotion, opacity, scale]);

  const artworkStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const windowWidth = Dimensions.get("window").width;
  const artworkEdge = Math.min(windowWidth - 2 * tokens.pageMargin, STAGE_MAX_ARTWORK_EDGE);

  return (
    <View
      testID="np-stage"
      style={{
        backgroundColor: tokens.glassFill,
        borderRadius: tokens.panelRadius,
        borderWidth: 1,
        borderColor: tokens.glassRim,
        padding: tokens.pageMargin,
        gap: tokens.shelfGap,
        shadowColor: tokens.shadow,
        shadowOpacity: 1,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 12 },
        boxShadow: Platform.OS === "android" ? `0 12 28 ${tokens.shadow}` : undefined,
      }}
    >
      {/* Centered album artwork */}
      <Animated.View
        testID="np-artwork-frame"
        style={[
          {
            alignSelf: "center",
            width: artworkEdge,
            height: artworkEdge,
            borderRadius: tokens.artworkRadius,
            shadowColor: tokens.shadow,
            shadowOpacity: 1,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 12 },
            boxShadow: Platform.OS === "android" ? `0 14 28 ${tokens.shadow}` : undefined,
          },
          artworkStyle,
        ]}
      >
        <View
          testID="np-artwork"
          style={{
            width: artworkEdge,
            height: artworkEdge,
            borderRadius: tokens.artworkRadius,
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: mix(tokens.label, "transparent", 8),
            borderWidth: 1,
            borderColor: tokens.glassRim,
          }}
        >
          {track.artworkUrl ? (
            <Image
              source={{ uri: toHighResArtworkUrl(track.artworkUrl) ?? track.artworkUrl }}
              style={{ width: artworkEdge, height: artworkEdge }}
              resizeMode="cover"
            />
          ) : (
            <MusicIcon name="music" size={96} color={tokens.label} />
          )}
        </View>
      </Animated.View>

      {/* Track Title + Like & Favorite Artist controls */}
      <View style={{ alignItems: "center", gap: 6, marginTop: 4 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            paddingHorizontal: 8,
            width: "100%",
          }}
        >
          {onToggleLike ? (
            <Pressable
              testID="np-like-track"
              accessibilityRole="button"
              accessibilityLabel={isLiked ? `Unlike ${track.title}` : `Like ${track.title}`}
              accessibilityState={{ selected: isLiked }}
              onPress={() => {
                hapticSelect();
                onToggleLike();
              }}
              style={{
                minWidth: 64,
                minHeight: 64,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 32,
                borderWidth: 1,
                borderColor: isLiked ? tokens.accent : tokens.glassRim,
                backgroundColor: isLiked
                  ? mix(tokens.accent, tokens.glassFill, 22)
                  : mix(tokens.label, "transparent", 8),
              }}
            >
              <MusicIcon
                name="heart"
                size={24}
                color={isLiked ? tokens.accent : tokens.label}
                filled={isLiked}
              />
            </Pressable>
          ) : null}

          <Text
            testID="np-title"
            numberOfLines={2}
            style={{
              color: tokens.label,
              ...STAGE_TYPE.title,
              textAlign: "center",
              flex: 1,
            }}
          >
            {track.title}
          </Text>

          {onToggleFavorite ? (
            <Pressable
              testID="music-favorite-artist"
              accessibilityRole="button"
              accessibilityLabel={
                isFavorite
                  ? `Remove ${track.artist} from favorite artists`
                  : `Save ${track.artist} to favorite artists`
              }
              accessibilityState={{ selected: isFavorite }}
              onPress={() => {
                hapticSelect();
                onToggleFavorite();
              }}
              style={{
                minWidth: 64,
                minHeight: 64,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 32,
                borderWidth: 1,
                borderColor: isFavorite ? tokens.accent : tokens.glassRim,
                backgroundColor: isFavorite
                  ? mix(tokens.accent, tokens.glassFill, 22)
                  : mix(tokens.label, "transparent", 8),
              }}
            >
              <MusicIcon
                name="star"
                size={24}
                color={isFavorite ? tokens.accent : tokens.label}
                filled={isFavorite}
              />
            </Pressable>
          ) : null}
        </View>

        <Pressable
          testID="np-artist-name"
          accessibilityRole="button"
          accessibilityLabel={`View ${track.artist}`}
          hitSlop={8}
          onPress={() => {
            hapticTap();
            onSelectArtist?.(track.artist);
          }}
        >
          <Text numberOfLines={1} style={{ color: tokens.label, ...STAGE_TYPE.artist, textAlign: "center" }}>
            {track.artist}
          </Text>
        </Pressable>
      </View>

      <ScrubberSection
        position={position}
        duration={duration}
        tokens={tokens}
        onSeek={onSeek}
      />

      {/* Codec truth chip */}
      <View
        testID="np-codec"
        style={{
          alignSelf: "center",
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 16,
          paddingVertical: 6,
          borderRadius: 999,
          backgroundColor: tokens.glassFill,
          borderWidth: 1,
          borderColor: playing ? mix(tokens.accent, tokens.glassRim, 30) : tokens.glassRim,
        }}
      >
        {playing ? (
          <WaveformBars playing={playing} color={tokens.accent} testID="np-codec-waveform" />
        ) : null}
        <Text
          testID="np-codec-label"
          style={{
            color: tokens.label,
            fontSize: TYPOGRAPHY.label.fontSize,
            lineHeight: TYPOGRAPHY.label.lineHeight,
            fontWeight: "700",
          }}
        >
          {formatCodecChip({
            mimeType: streamFormat?.mimeType ?? null,
            bitrate: streamFormat?.bitrate ?? null,
            codec: streamFormat?.codec ?? null,
          })}
        </Text>
      </View>

      <View style={{ alignItems: "center" }}>
        <TransportPill
          playing={playing}
          shuffle={shuffle}
          repeat={repeat}
          onToggle={onToggle}
          onNext={onNext}
          onPrevious={onPrevious}
          onToggleShuffle={onToggleShuffle}
          onCycleRepeat={onCycleRepeat}
        />
      </View>

      <CastVolume compact player={player} />

      {/* Utility Strip: Lyrics · Queue · Save to Playlist · Sleep Timer */}
      <View
        testID="np-apple-actions"
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingVertical: 4,
        }}
      >
        <StageUtilityChip
          testID="np-open-lyrics"
          accessibilityLabel="Lyrics view"
          icon="lyrics"
          label="Full Lyrics"
          tokens={tokens}
          onPress={onOpenLyrics}
        />
        <StageUtilityChip
          testID="np-open-queue"
          accessibilityLabel="Queue view"
          icon="queue"
          label={queueCount > 1 ? `Up Next (${queueCount})` : "Up Next"}
          tokens={tokens}
          onPress={onOpenQueue}
        />
        {onOpenAddToPlaylist ? (
          <StageUtilityChip
            testID="np-add-to-playlist"
            accessibilityLabel={`Add ${track.title} to a playlist`}
            icon="playlist"
            label="Playlist"
            tokens={tokens}
            onPress={onOpenAddToPlaylist}
          />
        ) : null}
        {onOpenSleepTimer ? (
          <StageUtilityChip
            testID="np-sleep-timer"
            accessibilityLabel="Sleep timer"
            icon="moon"
            label={sleepRemainingMinutes ? `${sleepRemainingMinutes}m` : "Sleep"}
            active={sleepRemainingMinutes !== null}
            filled={sleepRemainingMinutes !== null}
            tokens={tokens}
            onPress={onOpenSleepTimer}
          />
        ) : null}
      </View>

      {/* Station + Download row */}
      <View style={{ flexDirection: "row", gap: 12 }}>
        {onCreateStation ? (
          <Pressable
            testID="np-create-station"
            accessibilityRole="button"
            accessibilityLabel="Create station from this track"
            onPress={() => {
              hapticTap();
              onCreateStation();
            }}
            style={{
              flex: 1,
              minHeight: 64,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              borderRadius: tokens.panelRadius,
              backgroundColor: mix(tokens.accent, tokens.glassFill, 20),
              borderWidth: 1,
              borderColor: tokens.accent,
            }}
          >
            <MusicIcon name="sparkles" size={20} color={tokens.label} filled />
            <Text style={{ color: tokens.label, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
              Create Station
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          testID="np-download"
          accessibilityRole="button"
          accessibilityLabel={downloaded ? "Downloaded" : "Download this track"}
          disabled={downloaded}
          onPress={() => {
            hapticTap();
            onDownload();
          }}
          style={{
            flex: 1,
            minHeight: 64,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            borderRadius: tokens.panelRadius,
            backgroundColor: tokens.glassFill,
            borderWidth: 1,
            borderColor: tokens.glassRim,
          }}
        >
          <MusicIcon name={downloaded ? "check" : "download"} size={20} color={tokens.label} />
          <Text style={{ color: tokens.label, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
            {downloaded ? "Downloaded ✓" : "Download"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
});

/**
 * Compact Now Playing strip shown above Lyrics, Queue, and Library modes so
 * transport remains reachable without leaving those views.
 */
export const StageMiniBar = React.memo(function StageMiniBar({
  track,
  playing,
  tokens,
  onOpenStage,
  onToggle,
  onNext,
}: {
  track: MediaTrack;
  playing: boolean;
  tokens: MusicTokens;
  onOpenStage: () => void;
  onToggle: () => void;
  onNext: () => void;
}) {
  return (
    <View
      testID="music-stage-minibar"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 10,
        borderRadius: tokens.panelRadius,
        borderWidth: 1,
        borderColor: tokens.glassRim,
        backgroundColor: tokens.glassStrong,
      }}
    >
      <Pressable
        testID="music-stage-minibar-open"
        accessibilityRole="button"
        accessibilityLabel={`Return to Now Playing: ${track.title}`}
        onPress={() => {
          hapticTap();
          onOpenStage();
        }}
        style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64 }}
      >
        <View
          style={{
            width: 48,
            height: 48,
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
              style={{ width: 48, height: 48 }}
              resizeMode="cover"
            />
          ) : (
            <MusicIcon name="music" size={22} color={tokens.label} />
          )}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={1} style={{ color: tokens.label, ...TYPOGRAPHY.body, fontWeight: "700" }}>
            {track.title}
          </Text>
          <Text numberOfLines={1} style={{ color: tokens.label2, ...TYPOGRAPHY.label }}>
            {track.artist}
          </Text>
        </View>
      </Pressable>

      <Pressable
        testID="music-stage-minibar-play"
        accessibilityRole="button"
        accessibilityLabel={playing ? "Pause playback" : "Resume playback"}
        onPress={() => {
          hapticTap();
          onToggle();
        }}
        style={{
          minWidth: 64,
          minHeight: 64,
          borderRadius: 32,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: tokens.accent,
        }}
      >
        <MusicIcon name={playing ? "pause" : "play"} size={24} color={tokens.onAccent} filled />
      </Pressable>

      <Pressable
        testID="music-stage-minibar-next"
        accessibilityRole="button"
        accessibilityLabel="Next track"
        onPress={() => {
          hapticTap();
          onNext();
        }}
        style={{
          minWidth: 64,
          minHeight: 64,
          borderRadius: 16,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: tokens.glassRim,
          backgroundColor: tokens.glassFill,
        }}
      >
        <MusicIcon name="next" size={22} color={tokens.label} filled />
      </Pressable>
    </View>
  );
});
