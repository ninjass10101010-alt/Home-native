/**
 * MusicIsland.tsx — Compact Dynamic Island for Now Playing.
 *
 * Sits pinned at the top-center of the screen:
 * - Collapsed: minimal floating pill displaying artwork, title,
 *   subtle EQ animation, and progress bar.
 * - Expanded: expands into a full control island featuring album art,
 *   title/artist metadata, scrubber, transport buttons, super-reactive
 *   drag/touch volume slider, and stop action.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  GestureResponderEvent,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { usePathname, useRouter } from "expo-router";
import { usePlayback } from "./playback";
import { useCast } from "./CastProvider";
import { useTheme } from "../theme/ThemeProvider";
import { musicTokensFor } from "../theme/music-tokens";
import { useOutputVolume } from "./output-volume";
import { DOCK_TOP_OFFSET } from "../nav/CapsuleDock";

function formatTime(sec: number): string {
  if (!sec || isNaN(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

function WaveformBars({ playing, color }: { playing: boolean; color: string }) {
  return (
    <View style={styles.equalizer} testID="music-island-waveform">
      <View style={[styles.eqBar, { height: playing ? 14 : 4, backgroundColor: color }]} />
      <View style={[styles.eqBar, { height: playing ? 18 : 6, backgroundColor: color }]} />
      <View style={[styles.eqBar, { height: playing ? 11 : 4, backgroundColor: color }]} />
      <View style={[styles.eqBar, { height: playing ? 16 : 5, backgroundColor: color }]} />
    </View>
  );
}

export function MusicIsland() {
  const router = useRouter();
  const pathname = usePathname();
  const { current, playing, position, duration, toggle, next, previous, stopAndClear } = usePlayback();
  const cast = useCast();
  const volume = useOutputVolume(null);
  const { theme, boost } = useTheme();
  const tokens = React.useMemo(() => musicTokensFor(theme, boost), [theme, boost]);

  const [expanded, setExpanded] = useState(false);
  const [stopArmed, setStopArmed] = useState(false);
  const autoCollapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopArmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-collapse after 5s
  useEffect(() => {
    if (expanded) {
      autoCollapseTimer.current = setTimeout(() => {
        setExpanded(false);
        setStopArmed(false);
      }, 5000);
      return () => {
        if (autoCollapseTimer.current) {
          clearTimeout(autoCollapseTimer.current);
          autoCollapseTimer.current = null;
        }
      };
    }
  }, [expanded]);

  // Volume slider interaction
  const [isDraggingVolume, setIsDraggingVolume] = useState(false);
  const [dragVolume, setDragVolume] = useState<number | null>(null);
  const [trackWidth, setTrackWidth] = useState(1);

  const calculateVolumeFromX = useCallback(
    (locationX: number) => {
      if (trackWidth <= 0) return 0;
      const fraction = Math.max(0, Math.min(1, locationX / trackWidth));
      return fraction;
    },
    [trackWidth],
  );

  const handleResponderGrant = useCallback(
    (e: GestureResponderEvent) => {
      setIsDraggingVolume(true);
      const newVol = calculateVolumeFromX(e.nativeEvent.locationX);
      setDragVolume(newVol);
      volume.setValue(newVol);
    },
    [calculateVolumeFromX, volume],
  );

  const handleResponderMove = useCallback(
    (e: GestureResponderEvent) => {
      const newVol = calculateVolumeFromX(e.nativeEvent.locationX);
      setDragVolume(newVol);
      volume.setValue(newVol);
    },
    [calculateVolumeFromX, volume],
  );

  const handleResponderRelease = useCallback(
    (e: GestureResponderEvent) => {
      const finalVol = calculateVolumeFromX(e.nativeEvent.locationX);
      volume.setValue(finalVol);
      setIsDraggingVolume(false);
      setDragVolume(null);
    },
    [calculateVolumeFromX, volume],
  );

  const handleResponderTerminate = useCallback(() => {
    setIsDraggingVolume(false);
    setDragVolume(null);
  }, []);

  if (!current) return null;
  if (pathname === "/music" || pathname === "/screensaver") return null;

  const handleExpand = () => setExpanded(true);
  const handleCollapse = () => {
    setExpanded(false);
    setStopArmed(false);
    if (stopArmTimer.current) {
      clearTimeout(stopArmTimer.current);
      stopArmTimer.current = null;
    }
    if (autoCollapseTimer.current) {
      clearTimeout(autoCollapseTimer.current);
      autoCollapseTimer.current = null;
    }
  };

  const handleStopPress = () => {
    if (!stopArmed) {
      setStopArmed(true);
      if (autoCollapseTimer.current) {
        clearTimeout(autoCollapseTimer.current);
        autoCollapseTimer.current = null;
      }
      stopArmTimer.current = setTimeout(() => {
        setStopArmed(false);
        autoCollapseTimer.current = setTimeout(() => {
          setExpanded(false);
        }, 5000);
      }, 5000);
    } else {
      stopAndClear();
      setStopArmed(false);
      setExpanded(false);
      if (stopArmTimer.current) {
        clearTimeout(stopArmTimer.current);
        stopArmTimer.current = null;
      }
      if (autoCollapseTimer.current) {
        clearTimeout(autoCollapseTimer.current);
        autoCollapseTimer.current = null;
      }
    }
  };

  const progress = duration > 0 ? position / duration : 0;
  const currentVolumeValue = isDraggingVolume && dragVolume !== null ? dragVolume : (volume?.muted ? 0 : (volume?.value ?? 0.5));

  return (
    <>
      {expanded && (
        <Pressable
          testID="music-island-backdrop"
          style={[StyleSheet.absoluteFill, { bottom: DOCK_TOP_OFFSET }]}
          onPress={handleCollapse}
        />
      )}
      <View testID="music-island" style={styles.container} pointerEvents="box-none">
        {!expanded ? (
          <Pressable
            testID="music-island-collapsed"
            onPress={handleExpand}
            style={[
              styles.collapsed,
              {
                backgroundColor: tokens.glassStrong,
                borderColor: tokens.glassRim,
                shadowColor: tokens.shadow,
              },
            ]}
          >
            {/* Left: mini artwork */}
            <Image
              testID="music-island-art"
              source={{ uri: current.artworkUrl ?? undefined }}
              style={styles.art}
            />

            {/* Middle: Title & optional Cast badge */}
            <View style={styles.collapsedMeta}>
              <Text
                testID="music-island-title"
                style={[styles.title, { color: tokens.label }]}
                numberOfLines={1}
              >
                {current.title}
              </Text>
              {cast.casting && (
                <Text testID="music-island-cast" style={[styles.cast, { color: tokens.green }]}>
                  Casting
                </Text>
              )}
            </View>

            {/* Right: Sound Wave Equalizer */}
            <WaveformBars playing={playing} color={tokens.accent || tokens.green} />

            {/* Bottom: Hairline progress indicator */}
            <View
              testID="music-island-progress"
              style={[styles.progress, { backgroundColor: tokens.panelRim }]}
            >
              <View
                style={[
                  styles.progressFill,
                  { backgroundColor: tokens.accent, width: `${progress * 100}%` },
                ]}
              />
            </View>
          </Pressable>
        ) : (
          <View
            testID="music-island-expanded"
            style={[
              styles.expanded,
              {
                borderColor: tokens.glassRim,
                backgroundColor: tokens.glassStrong,
                shadowColor: tokens.shadow,
              },
            ]}
          >
            {/* Top row: Artwork, metadata & device badge */}
            <View style={styles.expandedTop}>
              <Pressable
                testID="music-island-art-expanded"
                onPress={() => router.push("/music" as never)}
              >
                <Image source={{ uri: current.artworkUrl ?? undefined }} style={styles.artExpanded} />
              </Pressable>
              <View style={styles.meta}>
                <Text style={[styles.titleExpanded, { color: tokens.label }]} numberOfLines={1}>
                  {current.title}
                </Text>
                <Text style={[styles.artist, { color: tokens.label2 }]} numberOfLines={1}>
                  {current.artist || "Unknown Artist"}
                </Text>
                <View style={[styles.deviceBadge, { backgroundColor: tokens.panel }]}>
                  <Text style={[styles.deviceBadgeText, { color: tokens.label2 }]}>
                    {cast.casting ? "📡 Casting" : "🔊 Local Speaker"}
                  </Text>
                </View>
              </View>
            </View>

            {/* Scrubber progress */}
            <View style={styles.scrubberContainer}>
              <View style={[styles.scrubberTrack, { backgroundColor: tokens.panelRim }]}>
                <View style={[styles.scrubberFill, { backgroundColor: tokens.accent, width: `${progress * 100}%` }]} />
              </View>
              <View style={styles.scrubberTimes}>
                <Text style={[styles.timeLabel, { color: tokens.label3 }]}>{formatTime(position)}</Text>
                <Text style={[styles.timeLabel, { color: tokens.label3 }]}>
                  {duration > 0 ? `-${formatTime(Math.max(0, duration - position))}` : "0:00"}
                </Text>
              </View>
            </View>

            {/* Playback Transport Controls */}
            <View style={styles.controls}>
              <Pressable
                testID="music-island-prev"
                onPress={() => (cast.casting ? cast.previous() : previous())}
                style={({ pressed }) => [
                  styles.controlButton,
                  { backgroundColor: tokens.panel },
                  pressed && { opacity: 0.6 },
                ]}
                accessibilityLabel="Previous track"
              >
                <Text style={[styles.controlGlyph, { color: tokens.label }]}>⏮</Text>
              </Pressable>

              <Pressable
                testID="music-island-play"
                onPress={() => (cast.casting ? (cast.playing ? cast.pause() : cast.play()) : toggle())}
                style={({ pressed }) => [
                  styles.playButton,
                  { backgroundColor: tokens.accent, shadowColor: tokens.shadow },
                  pressed && { opacity: 0.8 },
                ]}
                accessibilityLabel={playing ? "Pause" : "Play"}
              >
                <Text style={[styles.playGlyph, { color: tokens.onAccent }]}>{playing ? "⏸" : "▶"}</Text>
              </Pressable>

              <Pressable
                testID="music-island-next"
                onPress={() => (cast.casting ? cast.advance(false) : next())}
                style={({ pressed }) => [
                  styles.controlButton,
                  { backgroundColor: tokens.panel },
                  pressed && { opacity: 0.6 },
                ]}
                accessibilityLabel="Next track"
              >
                <Text style={[styles.controlGlyph, { color: tokens.label }]}>⏭</Text>
              </Pressable>
            </View>

            {/* Super-reactive Volume Slider row */}
            <View style={styles.volumeRow}>
              <Text style={[styles.volumeLabel, { color: tokens.label2 }]}>
                Volume · {Math.round(currentVolumeValue * 100)}%
              </Text>
              <View style={styles.volumeBarWrapper}>
                <Text style={styles.speakerIcon}>🔉</Text>
                <View
                  testID="music-island-volume-bar"
                  onStartShouldSetResponder={() => true}
                  onMoveShouldSetResponder={() => true}
                  onResponderGrant={handleResponderGrant}
                  onResponderMove={handleResponderMove}
                  onResponderRelease={handleResponderRelease}
                  onResponderTerminate={handleResponderTerminate}
                  onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
                  style={[styles.volumeBar, { backgroundColor: tokens.panelRim }]}
                >
                  <View
                    style={[
                      styles.volumeFill,
                      {
                        backgroundColor: volume?.muted ? tokens.label3 : tokens.accent,
                        width: `${currentVolumeValue * 100}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.speakerIcon}>🔊</Text>

                <Pressable
                  testID="music-island-mute"
                  onPress={() => volume?.toggleMute()}
                  style={[styles.muteButton, { backgroundColor: tokens.panel }]}
                  accessibilityLabel={volume?.muted ? "Unmute" : "Mute"}
                >
                  <Text style={styles.muteIcon}>
                    {volume?.muted ? "🔇" : "🔔"}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Stop / Clear Action */}
            <Pressable
              testID="music-island-stop"
              onPress={handleStopPress}
              style={[
                styles.stopButton,
                { backgroundColor: stopArmed ? tokens.accent : tokens.panel },
              ]}
              accessibilityLabel={stopArmed ? "Confirm stop" : "Stop"}
            >
              <Text style={[styles.stopButtonText, { color: tokens.label }]}>
                {stopArmed ? "Confirm" : "Stop"}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 8,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 9999,
  },
  // Collapsed Dynamic Island Pill
  collapsed: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
    maxWidth: 320,
    overflow: "hidden",
  },
  art: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 10,
  },
  collapsedMeta: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginRight: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  cast: {
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 6,
  },
  equalizer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2.5,
    height: 20,
    justifyContent: "center",
  },
  eqBar: {
    width: 3,
    borderRadius: 1.5,
  },
  progress: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: 2,
  },
  // Expanded Dynamic Island Card
  expanded: {
    width: "100%",
    maxWidth: 420,
    padding: 18,
    borderRadius: 34,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.65,
    shadowRadius: 24,
    elevation: 20,
  },
  expandedTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  artExpanded: {
    width: 60,
    height: 60,
    borderRadius: 14,
    marginRight: 14,
  },
  meta: {
    flex: 1,
    justifyContent: "center",
  },
  titleExpanded: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  artist: {
    fontSize: 14,
    marginTop: 2,
  },
  deviceBadge: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  deviceBadgeText: {
    fontSize: 14,
    fontWeight: "500",
  },
  scrubberContainer: {
    marginBottom: 12,
  },
  scrubberTrack: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  scrubberFill: {
    height: 4,
    borderRadius: 2,
  },
  scrubberTimes: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  timeLabel: {
    fontSize: 14,
    fontVariant: ["tabular-nums"],
  },
  controls: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 20,
    marginBottom: 16,
  },
  controlButton: {
    width: 48,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 24,
  },
  controlGlyph: {
    fontSize: 20,
  },
  playButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: "center",
    alignItems: "center",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  playGlyph: {
    fontSize: 24,
  },
  volumeRow: {
    marginBottom: 14,
  },
  volumeLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
  },
  volumeBarWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  speakerIcon: {
    fontSize: 14,
  },
  volumeBar: {
    flex: 1,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    overflow: "hidden",
  },
  volumeFill: {
    height: "100%",
    borderRadius: 11,
  },
  muteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 4,
  },
  muteIcon: {
    fontSize: 14,
  },
  stopButton: {
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  stopButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
