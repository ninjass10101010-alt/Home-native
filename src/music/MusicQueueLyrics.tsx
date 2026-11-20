import React from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { hapticTap } from "../theme/haptics";
import { mix } from "../theme/mix";
import type { MusicTokens } from "../theme/music-tokens";
import { TYPOGRAPHY } from "../theme/tokens";
import { SwipeableRow } from "../ui/SwipeableRow";
import { MusicIcon, type MusicIconName } from "./MusicIcons";
import { WaveformBars } from "./MusicIsland";
import { toHighResArtworkUrl } from "./artwork";
import { totalDownloadBytes } from "./library";
import { FOLLOW_PAUSE_MS, followOffset, lyricSegments, type LyricLine } from "./lyrics";
import type { DownloadEntry, MediaTrack, RepeatMode } from "./types";

const LYRICS_VIEWPORT_DP = 600;

export function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 100) return `${Math.round(mb)} MB`;
  return `${Math.round(mb * 10) / 10} MB`;
}

export function PanelCard({
  testID,
  children,
  tokens,
  style,
}: {
  testID?: string;
  children: React.ReactNode;
  tokens: MusicTokens;
  style?: object;
}) {
  return (
    <View
      testID={testID}
      style={[
        {
          backgroundColor: tokens.panel,
          borderRadius: tokens.panelRadius,
          borderWidth: 1,
          borderColor: tokens.panelRim,
          overflow: "hidden",
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function ArtworkThumb({
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
        <MusicIcon name="music" size={20} color={tokens.label} />
      )}
    </View>
  );
}

export interface LyricsPaneProps {
  lines: LyricLine[] | null;
  activeIndex: number;
  positionMs: number;
  tokens: MusicTokens;
  reduceMotion: boolean;
  onSeek: (seconds: number) => void;
}

export function LyricsPane({
  lines,
  activeIndex,
  positionMs,
  tokens,
  reduceMotion,
  onSeek,
}: LyricsPaneProps) {
  const scrollRef = React.useRef<ScrollView | null>(null);
  const offsets = React.useRef<Record<number, number>>({});
  const viewportHeight = React.useRef(0);
  const [followPaused, setFollowPaused] = React.useState(false);
  const resumeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToLine = React.useCallback(
    (index: number) => {
      const y = offsets.current[index];
      if (y === undefined) return;
      scrollRef.current?.scrollTo({
        y: followOffset(y, viewportHeight.current),
        animated: !reduceMotion,
      });
    },
    [reduceMotion]
  );

  React.useEffect(() => {
    if (activeIndex < 0 || followPaused) return;
    scrollToLine(activeIndex);
  }, [activeIndex, followPaused, scrollToLine]);

  const pauseFollow = React.useCallback(() => {
    setFollowPaused(true);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setFollowPaused(false), FOLLOW_PAUSE_MS);
  }, []);

  const resumeFollow = React.useCallback(() => {
    if (resumeTimer.current) {
      clearTimeout(resumeTimer.current);
      resumeTimer.current = null;
    }
    setFollowPaused(false);
  }, []);

  React.useEffect(
    () => () => {
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    },
    []
  );

  return (
    <View style={{ position: "relative" }}>
      <ScrollView
        ref={scrollRef}
        testID="music-lyrics-scroll"
        style={{
          maxHeight: LYRICS_VIEWPORT_DP,
          backgroundColor: tokens.glassStrong,
          borderRadius: tokens.panelRadius,
          borderWidth: 1,
          borderColor: tokens.glassRim,
          overflow: "hidden",
        }}
        nestedScrollEnabled
        onLayout={(e) => {
          viewportHeight.current = e.nativeEvent.layout.height;
        }}
        onScrollBeginDrag={pauseFollow}
      >
        <View testID="music-lyrics" style={{ gap: 4, paddingVertical: 10, paddingHorizontal: 18 }}>
          {lines && lines.length > 0 ? (
            lines.map((line, index) => {
              const isCurrent = index === activeIndex;
              const isNeighbour =
                activeIndex >= 0 && (index === activeIndex - 1 || index === activeIndex + 1);
              const color = isCurrent ? tokens.accent : isNeighbour ? tokens.label2 : tokens.label3;
              const segments =
                isCurrent && line.words.length > 0 ? lyricSegments(line, positionMs) : null;
              return (
                <Pressable
                  key={`${line.timeMs}-${index}`}
                  testID={`music-lyric-${index}`}
                  accessibilityRole="button"
                  accessibilityLabel={line.text || "Rest"}
                  onPress={() => {
                    resumeFollow();
                    onSeek(line.timeMs / 1000);
                  }}
                  onLayout={(e) => {
                    offsets.current[index] = e.nativeEvent.layout.y;
                    if (index === activeIndex && !followPaused) scrollToLine(index);
                  }}
                  style={{ minHeight: 64, justifyContent: "center", paddingVertical: 8 }}
                >
                  <Text
                    style={{
                      color,
                      fontSize: 22,
                      lineHeight: 30,
                      fontWeight: isCurrent ? "800" : "700",
                      transform: isCurrent ? [{ scale: 1.04 }] : undefined,
                    }}
                  >
                    {segments
                      ? segments.map((segment, segmentIndex) => (
                          <Text
                            key={segmentIndex}
                            testID={`music-lyric-${index}-seg-${segmentIndex}`}
                            style={{
                              color: segment.sung ? tokens.accent : tokens.label2,
                            }}
                          >
                            {segment.text}
                          </Text>
                        ))
                      : (line.text || "♪")}
                  </Text>
                </Pressable>
              );
            })
          ) : (
            <View style={{ paddingVertical: 20, gap: 6 }}>
              <Text
                testID="music-lyrics-empty"
                style={{ color: tokens.label2, ...TYPOGRAPHY.body }}
              >
                No lyrics for this track.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {followPaused && lines && lines.length > 0 && activeIndex >= 0 ? (
        <Pressable
          testID="music-lyrics-resume-follow"
          accessibilityRole="button"
          accessibilityLabel="Resume synced lyrics"
          onPress={() => {
            hapticTap();
            resumeFollow();
            scrollToLine(activeIndex);
          }}
          style={{
            position: "absolute",
            right: 16,
            bottom: 16,
            minHeight: 64,
            paddingHorizontal: 18,
            borderRadius: 999,
            backgroundColor: tokens.accent,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: tokens.onAccent, ...TYPOGRAPHY.body, fontWeight: "700" }}>
            Resume sync
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export interface QueuePaneProps {
  queue: MediaTrack[];
  currentTrackId?: string | null;
  history: MediaTrack[];
  tokens: MusicTokens;
  shuffle: boolean;
  repeat: RepeatMode;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
  onPlay: (track: MediaTrack, list: MediaTrack[]) => void;
  onRemove: (index: number) => void;
  onMove: (from: number, to: number) => void;
  onPlayNext?: (track: MediaTrack) => void;
  onClearQueue?: () => void;
  onSaveQueueAsPlaylist?: () => void;
}

export function QueuePane({
  queue,
  currentTrackId,
  history,
  tokens,
  shuffle,
  repeat,
  onToggleShuffle,
  onCycleRepeat,
  onPlay,
  onRemove,
  onMove,
  onPlayNext,
  onClearQueue,
  onSaveQueueAsPlaylist,
}: QueuePaneProps) {
  return (
    <View testID="music-queue" style={{ gap: tokens.shelfGap }}>
      <View
        testID="music-queue-panel"
        style={{
          backgroundColor: tokens.glassFill,
          borderRadius: tokens.panelRadius,
          borderWidth: 1,
          borderColor: tokens.glassRim,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 8,
            paddingHorizontal: 16,
            paddingVertical: 10,
            minHeight: 64,
          }}
        >
          <Text style={{ color: tokens.label, ...TYPOGRAPHY.title, fontWeight: "700", flex: 1 }}>
            Playing Next
          </Text>
          {queue.length > 0 && onSaveQueueAsPlaylist ? (
            <Pressable
              testID="music-queue-save-playlist"
              accessibilityRole="button"
              accessibilityLabel="Save queue as playlist"
              onPress={() => {
                hapticTap();
                onSaveQueueAsPlaylist();
              }}
              style={{
                minWidth: 64,
                minHeight: 64,
                paddingHorizontal: 14,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: tokens.glassRim,
              }}
            >
              <MusicIcon name="playlist" size={18} color={tokens.label} />
              <Text style={{ color: tokens.label, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
                Save
              </Text>
            </Pressable>
          ) : null}
          {queue.length > 1 && onClearQueue ? (
            <Pressable
              testID="music-queue-clear"
              accessibilityRole="button"
              accessibilityLabel="Clear upcoming tracks"
              onPress={() => {
                hapticTap();
                onClearQueue();
              }}
              style={{
                minWidth: 64,
                minHeight: 64,
                paddingHorizontal: 14,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 999,
                borderWidth: 1,
                borderColor: tokens.glassRim,
              }}
            >
              <Text style={{ color: tokens.label, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
                Clear
              </Text>
            </Pressable>
          ) : null}
          <QueueCapsule
            testID="music-queue-shuffle"
            label="Shuffle"
            active={shuffle}
            onPress={onToggleShuffle}
            tokens={tokens}
          />
          <QueueCapsule
            testID="music-queue-repeat"
            label="Repeat"
            active={repeat !== "off"}
            onPress={onCycleRepeat}
            tokens={tokens}
          />
        </View>
        {queue.length === 0 ? (
          <Text
            testID="music-queue-empty"
            style={{
              color: tokens.label,
              ...TYPOGRAPHY.body,
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderTopWidth: 1,
              borderTopColor: tokens.panelSeparator,
            }}
          >
            The queue is empty.
          </Text>
        ) : (
          queue.map((track, index) => (
            <QueueRow
              key={`${track.id}-${index}`}
              track={track}
              index={index}
              count={queue.length}
              isCurrent={!!currentTrackId && track.id === currentTrackId}
              queue={queue}
              tokens={tokens}
              onPlay={onPlay}
              onRemove={onRemove}
              onMove={onMove}
            />
          ))
        )}
      </View>

      <HistoryShelf
        history={history}
        tokens={tokens}
        onPlay={onPlay}
        onPlayNext={onPlayNext}
      />
    </View>
  );
}

function QueueRow({
  track,
  index,
  count,
  isCurrent,
  queue,
  tokens,
  onPlay,
  onRemove,
  onMove,
}: {
  track: MediaTrack;
  index: number;
  count: number;
  isCurrent: boolean;
  queue: MediaTrack[];
  tokens: MusicTokens;
  onPlay: (track: MediaTrack, list: MediaTrack[]) => void;
  onRemove: (index: number) => void;
  onMove: (from: number, to: number) => void;
}) {
  return (
    <SwipeableRow
      testID={`music-queue-swipe-${index}`}
      actions={[
        {
          key: "remove",
          label: "Remove",
          intent: "destructive",
          onAction: () => onRemove(index),
        },
      ]}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          minHeight: 64,
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderTopWidth: 1,
          borderTopColor: tokens.panelSeparator,
          backgroundColor: isCurrent ? mix(tokens.accent, "transparent", 16) : "transparent",
        }}
      >
        <ArtworkThumb testID={`music-queue-thumb-${index}`} track={track} tokens={tokens} />
        <Pressable
          testID={`music-queue-row-${index}`}
          accessibilityRole="button"
          accessibilityLabel={`Play ${track.title} by ${track.artist}`}
          onPress={() => onPlay(track, queue)}
          style={{ flex: 1, minHeight: 64, justifyContent: "center" }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {isCurrent ? (
              <WaveformBars playing color={tokens.accent} />
            ) : null}
            <Text numberOfLines={1} style={{ flex: 1, color: tokens.label, ...TYPOGRAPHY.body, fontWeight: "700" }}>
              {track.title}
            </Text>
          </View>
          <Text numberOfLines={1} style={{ color: tokens.label, ...TYPOGRAPHY.label }}>
            {track.artist}
          </Text>
        </Pressable>
        <QueueAction
          testID={`music-queue-up-${index}`}
          label={`Move ${track.title} up`}
          icon="up"
          disabled={index === 0}
          onPress={() => onMove(index, index - 1)}
          tokens={tokens}
        />
        <QueueAction
          testID={`music-queue-down-${index}`}
          label={`Move ${track.title} down`}
          icon="down"
          disabled={index === count - 1}
          onPress={() => onMove(index, index + 1)}
          tokens={tokens}
        />
        <QueueAction
          testID={`music-queue-remove-${index}`}
          label={`Remove ${track.title} from the queue`}
          icon="close"
          onPress={() => onRemove(index)}
          tokens={tokens}
        />
      </View>
    </SwipeableRow>
  );
}

export const HistoryShelf = React.memo(function HistoryShelf({
  history,
  tokens,
  onPlay,
  onPlayNext,
}: {
  history: MediaTrack[];
  tokens: MusicTokens;
  onPlay: (track: MediaTrack, list: MediaTrack[]) => void;
  onPlayNext?: (track: MediaTrack) => void;
}) {
  return (
    <View
      testID="music-history-shelf"
      style={{
        backgroundColor: tokens.grouped,
        borderRadius: tokens.panelRadius,
        borderWidth: 1,
        borderColor: tokens.panelRim,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          paddingVertical: 8,
          minHeight: 64,
        }}
      >
        <Text style={{ color: tokens.label, ...TYPOGRAPHY.title, fontWeight: "700" }}>
          Recently played
        </Text>
        <Text style={{ color: tokens.label3, ...TYPOGRAPHY.label }}>
          {history.length > 0 ? `${Math.min(history.length, 8)} recent` : "History"}
        </Text>
      </View>
      {history.length === 0 ? (
        <Text
          testID="music-history-empty"
          style={{
            color: tokens.label2,
            ...TYPOGRAPHY.body,
            paddingHorizontal: 16,
            paddingVertical: 14,
            borderTopWidth: 1,
            borderTopColor: tokens.panelSeparator,
          }}
        >
          Nothing played yet.
        </Text>
      ) : (
        <View
          style={{
            backgroundColor: tokens.panel,
            margin: 10,
            borderRadius: tokens.artworkRadius,
            borderWidth: 1,
            borderColor: tokens.panelRim,
            overflow: "hidden",
          }}
        >
          {history.slice(0, 8).map((track, index) => (
            <View
              key={track.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                minHeight: 64,
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderTopWidth: index === 0 ? 0 : 1,
                borderTopColor: tokens.panelSeparator,
              }}
            >
              <ArtworkThumb testID={`music-history-thumb-${track.id}`} track={track} tokens={tokens} />
              <Pressable
                testID={`music-history-${track.id}`}
                accessibilityRole="button"
                accessibilityLabel={`Play ${track.title} by ${track.artist}`}
                onPress={() => onPlay(track, history)}
                style={{ flex: 1, minHeight: 64, justifyContent: "center" }}
              >
                <Text numberOfLines={1} style={{ color: tokens.label, ...TYPOGRAPHY.body, fontWeight: "700" }}>
                  {track.title}
                </Text>
                <Text numberOfLines={1} style={{ color: tokens.label3, ...TYPOGRAPHY.label }}>
                  {track.artist}
                </Text>
              </Pressable>
              {onPlayNext ? (
                <Pressable
                  testID={`music-history-playnext-${track.id}`}
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
                    paddingHorizontal: 12,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: tokens.artworkRadius,
                  }}
                >
                  <MusicIcon name="playNext" size={20} color={tokens.label2} />
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      )}
    </View>
  );
});

export const DownloadsTray = React.memo(function DownloadsTray({
  downloads,
  tokens,
  onRemove,
}: {
  downloads: DownloadEntry[];
  tokens: MusicTokens;
  onRemove: (id: string) => void;
}) {
  return (
    <View testID="music-downloads" style={{ gap: tokens.shelfGap }}>
      <Text style={{ color: tokens.label, ...TYPOGRAPHY.title, fontWeight: "700" }}>
        Downloads · {formatBytes(totalDownloadBytes(downloads))}
      </Text>
      <PanelCard tokens={tokens}>
        {downloads.map((item, index) => (
          <View
            key={item.id}
            testID={`music-download-${item.id}`}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              minHeight: 64,
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderTopWidth: index === 0 ? 0 : 1,
              borderTopColor: tokens.panelSeparator,
            }}
          >
            <ArtworkThumb testID={`music-download-thumb-${item.id}`} track={item} tokens={tokens} />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ color: tokens.label, ...TYPOGRAPHY.body, fontWeight: "700" }}>
                {item.title}
              </Text>
              <Text numberOfLines={1} style={{ color: tokens.label3, ...TYPOGRAPHY.label }}>
                {item.artist}
              </Text>
            </View>
            <Text style={{ color: tokens.label3, ...TYPOGRAPHY.label }}>{formatBytes(item.bytes)}</Text>
            <Pressable
              testID={`music-download-remove-${item.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Delete download ${item.title}`}
              onPress={() => {
                hapticTap();
                onRemove(item.id);
              }}
              style={{
                minHeight: 64,
                minWidth: 64,
                paddingHorizontal: 12,
                flexDirection: "row",
                gap: 6,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: tokens.artworkRadius,
                borderWidth: 1,
                borderColor: tokens.panelRim,
              }}
            >
              <MusicIcon name="trash" size={16} color={tokens.label} />
              <Text style={{ color: tokens.label, ...TYPOGRAPHY.label, fontWeight: "700" }}>Delete</Text>
            </Pressable>
          </View>
        ))}
      </PanelCard>
    </View>
  );
});

function QueueAction({
  testID,
  label,
  icon,
  disabled,
  onPress,
  tokens,
}: {
  testID: string;
  label: string;
  icon: MusicIconName;
  disabled?: boolean;
  onPress: () => void;
  tokens: MusicTokens;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={() => {
        if (disabled) return;
        hapticTap();
        onPress();
      }}
      style={{ width: 64, height: 64, alignItems: "center", justifyContent: "center" }}
    >
      <MusicIcon name={icon} size={20} color={disabled ? tokens.label3 : tokens.label2} />
    </Pressable>
  );
}

function QueueCapsule({
  testID,
  label,
  active,
  onPress,
  tokens,
}: {
  testID: string;
  label: string;
  active: boolean;
  onPress: () => void;
  tokens: MusicTokens;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${label} ${active ? "on" : "off"}`}
      accessibilityState={{ selected: active }}
      onPress={() => {
        hapticTap();
        onPress();
      }}
      style={{
        minWidth: 64,
        minHeight: 64,
        paddingHorizontal: 16,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? tokens.accent : tokens.panelRim,
        backgroundColor: active ? mix(tokens.accent, "transparent", 18) : "transparent",
      }}
    >
      <Text style={{ color: tokens.label, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
        {label}
      </Text>
    </Pressable>
  );
}
