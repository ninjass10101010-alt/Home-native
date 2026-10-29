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
  Animated,
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
import { mix } from "../theme/mix";
import {
  subscribeActiveNotification,
  dismissActiveNotification,
  type ActiveNotification,
} from "../native/notificationFeed";

function formatTime(sec: number): string {
  if (!sec || isNaN(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

function categoryMeta(category: string, timing?: string) {
  switch (category) {
    case "emergency":
      return { icon: "🚨", label: "EMERGENCY ALERT", colorKey: "color-accent-rose" as const };
    case "weather":
      return { icon: "⛈️", label: "WEATHER ADVISORY", colorKey: "color-accent-cyan" as const };
    case "calendar":
      return {
        icon: "📅",
        label: timing === "advance" ? "15-MIN CALENDAR REMINDER" : "CALENDAR EVENT",
        colorKey: "color-accent-amber" as const,
      };
    case "routines":
      return {
        icon: "⏰",
        label: timing === "advance" ? "15-MIN ROUTINE REMINDER" : "ROUTINE DUE",
        colorKey: "color-accent-emerald" as const,
      };
    default:
      return { icon: "🔔", label: "REMINDER", colorKey: "color-accent-amber" as const };
  }
}

export function WaveformBars({
  playing,
  color,
  testID = "music-island-waveform",
}: {
  playing: boolean;
  color: string;
  testID?: string;
}) {
  const { reduceMotion } = useTheme();
  const [bar1] = useState(() => new Animated.Value(playing ? 14 : 2));
  const [bar2] = useState(() => new Animated.Value(playing ? 18 : 2));
  const [bar3] = useState(() => new Animated.Value(playing ? 11 : 2));
  const [bar4] = useState(() => new Animated.Value(playing ? 16 : 2));

  useEffect(() => {
    if (reduceMotion || process.env.NODE_ENV === "test") {
      bar1.setValue(playing ? 14 : 2);
      bar2.setValue(playing ? 18 : 2);
      bar3.setValue(playing ? 11 : 2);
      bar4.setValue(playing ? 16 : 2);
      return;
    }

    if (!playing) {
      // Off state: smoothly drop to flat minimal baseline
      Animated.parallel([
        Animated.timing(bar1, { toValue: 2, duration: 180, useNativeDriver: false }),
        Animated.timing(bar2, { toValue: 2, duration: 180, useNativeDriver: false }),
        Animated.timing(bar3, { toValue: 2, duration: 180, useNativeDriver: false }),
        Animated.timing(bar4, { toValue: 2, duration: 180, useNativeDriver: false }),
      ]).start();
      return;
    }

    // Active state: lively, rhythmic jumping equalizer bars
    const anim1 = Animated.loop(
      Animated.sequence([
        Animated.timing(bar1, { toValue: 18, duration: 320, useNativeDriver: false }),
        Animated.timing(bar1, { toValue: 5, duration: 280, useNativeDriver: false }),
        Animated.timing(bar1, { toValue: 14, duration: 300, useNativeDriver: false }),
        Animated.timing(bar1, { toValue: 4, duration: 240, useNativeDriver: false }),
      ])
    );
    const anim2 = Animated.loop(
      Animated.sequence([
        Animated.timing(bar2, { toValue: 6, duration: 240, useNativeDriver: false }),
        Animated.timing(bar2, { toValue: 20, duration: 340, useNativeDriver: false }),
        Animated.timing(bar2, { toValue: 9, duration: 270, useNativeDriver: false }),
        Animated.timing(bar2, { toValue: 17, duration: 310, useNativeDriver: false }),
      ])
    );
    const anim3 = Animated.loop(
      Animated.sequence([
        Animated.timing(bar3, { toValue: 16, duration: 290, useNativeDriver: false }),
        Animated.timing(bar3, { toValue: 4, duration: 300, useNativeDriver: false }),
        Animated.timing(bar3, { toValue: 12, duration: 260, useNativeDriver: false }),
        Animated.timing(bar3, { toValue: 7, duration: 250, useNativeDriver: false }),
      ])
    );
    const anim4 = Animated.loop(
      Animated.sequence([
        Animated.timing(bar4, { toValue: 8, duration: 250, useNativeDriver: false }),
        Animated.timing(bar4, { toValue: 19, duration: 330, useNativeDriver: false }),
        Animated.timing(bar4, { toValue: 5, duration: 270, useNativeDriver: false }),
        Animated.timing(bar4, { toValue: 15, duration: 290, useNativeDriver: false }),
      ])
    );

    anim1.start();
    anim2.start();
    anim3.start();
    anim4.start();

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
      anim4.stop();
    };
  }, [playing, reduceMotion, bar1, bar2, bar3, bar4]);

  return (
    <View style={styles.equalizer} testID={testID}>
      <Animated.View style={[styles.eqBar, { height: bar1, backgroundColor: color, opacity: playing ? 1 : 0.35 }]} />
      <Animated.View style={[styles.eqBar, { height: bar2, backgroundColor: color, opacity: playing ? 1 : 0.35 }]} />
      <Animated.View style={[styles.eqBar, { height: bar3, backgroundColor: color, opacity: playing ? 1 : 0.35 }]} />
      <Animated.View style={[styles.eqBar, { height: bar4, backgroundColor: color, opacity: playing ? 1 : 0.35 }]} />
    </View>
  );
}

export function MusicIsland() {
  const router = useRouter();
  const pathname = usePathname();
  const { current, playing, position, duration, toggle, next, previous, stopAndClear, player } = usePlayback();
  const cast = useCast();
  const volume = useOutputVolume(player);
  const { colors, theme, boost, reduceMotion } = useTheme();
  const tokens = React.useMemo(() => musicTokensFor(theme, boost), [theme, boost]);

  const [expanded, setExpanded] = useState(false);
  const [stopArmed, setStopArmed] = useState(false);
  const autoCollapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopArmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Notification alert lifecycle:
  // "large" (5s pop-up) -> "minimized" (into Island with glow for 60s) -> "idle" (dismissed)
  const [alertStage, setAlertStage] = useState<"idle" | "large" | "minimized">("idle");
  const [activeAlert, setActiveAlert] = useState<ActiveNotification | null>(null);
  const largeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const minTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [glowAnim] = useState(() => new Animated.Value(0.35));

  const handleDismissAlert = useCallback(() => {
    if (largeTimerRef.current) clearTimeout(largeTimerRef.current);
    if (minTimerRef.current) clearTimeout(minTimerRef.current);
    setAlertStage("idle");
    setActiveAlert(null);
    dismissActiveNotification();
  }, []);

  const handleMinimizeAlert = useCallback(() => {
    if (largeTimerRef.current) clearTimeout(largeTimerRef.current);
    setAlertStage("minimized");
  }, []);

  const handleExpandAlert = useCallback(() => {
    if (minTimerRef.current) clearTimeout(minTimerRef.current);
    setAlertStage("large");
    largeTimerRef.current = setTimeout(() => {
      setAlertStage("minimized");
    }, 5000);
  }, []);

  // Subscribe directly to external notification feed
  useEffect(() => {
    return subscribeActiveNotification((notif) => {
      if (notif) {
        setActiveAlert(notif);
        setAlertStage("large");

        if (largeTimerRef.current) clearTimeout(largeTimerRef.current);
        if (minTimerRef.current) clearTimeout(minTimerRef.current);

        largeTimerRef.current = setTimeout(() => {
          setAlertStage("minimized");
        }, 5000);
      } else {
        setAlertStage("idle");
        setActiveAlert(null);
        if (largeTimerRef.current) clearTimeout(largeTimerRef.current);
        if (minTimerRef.current) clearTimeout(minTimerRef.current);
      }
    });
  }, []);

  // Glow animation & 60-second timer when minimized in the island
  useEffect(() => {
    if (alertStage === "minimized") {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 850,
            useNativeDriver: false,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.35,
            duration: 850,
            useNativeDriver: false,
          }),
        ])
      );
      if (!reduceMotion) {
        loop.start();
      } else {
        glowAnim.setValue(0.75);
      }

      minTimerRef.current = setTimeout(() => {
        setAlertStage("idle");
        setActiveAlert(null);
        dismissActiveNotification();
      }, 60000);

      return () => {
        loop.stop();
        if (minTimerRef.current) clearTimeout(minTimerRef.current);
      };
    }
  }, [alertStage, reduceMotion, glowAnim]);

  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = (e: GestureResponderEvent) => {
    touchStartY.current = e.nativeEvent.pageY;
  };

  const handleTouchEnd = (e: GestureResponderEvent) => {
    if (touchStartY.current !== null) {
      const dy = e.nativeEvent.pageY - touchStartY.current;
      touchStartY.current = null;
      if (dy < -20) {
        if (alertStage === "large") {
          handleMinimizeAlert();
        } else if (alertStage === "minimized") {
          handleDismissAlert();
        }
      }
    }
  };

  // Auto-collapse music after 5s
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

  // Island appears if music is playing OR if a notification alert is active!
  if (!current && (!activeAlert || alertStage === "idle")) return null;
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

  const catMeta = activeAlert ? categoryMeta(activeAlert.category, activeAlert.timing) : null;
  const alertColor = catMeta ? (colors?.[catMeta.colorKey] ?? tokens.accent) : tokens.accent;
  const isAlertMinimized = alertStage === "minimized" && Boolean(activeAlert);

  return (
    <>
      {(expanded || alertStage === "large") && (
        <Pressable
          testID={expanded ? "music-island-backdrop" : "notification-alert-backdrop"}
          style={[StyleSheet.absoluteFill, { bottom: DOCK_TOP_OFFSET }]}
          onPress={() => {
            if (expanded) handleCollapse();
            if (alertStage === "large") handleMinimizeAlert();
          }}
        />
      )}
      <View testID="music-island" style={styles.container} pointerEvents="box-none">
        {alertStage === "large" && activeAlert ? (
          <Animated.View
            testID="notification-alert-large"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            style={[
              styles.alertLarge,
              {
                backgroundColor: tokens.glassStrong,
                borderColor: alertColor,
                shadowColor: alertColor,
              },
            ]}
          >
            {/* Top row: Category tag + dismiss button */}
            <View style={styles.alertHeaderRow}>
              <View style={[styles.alertCategoryPill, { backgroundColor: mix(alertColor, "transparent", 20) }]}>
                <Text style={styles.alertCategoryIcon}>{catMeta?.icon}</Text>
                <Text style={[styles.alertCategoryLabel, { color: alertColor }]}>
                  {catMeta?.label}
                </Text>
              </View>
              <Pressable
                testID="notification-alert-dismiss"
                onPress={handleDismissAlert}
                accessibilityLabel="Dismiss notification"
                hitSlop={8}
                style={styles.alertDismissBtn}
              >
                <Text style={[styles.alertDismissText, { color: tokens.label2 }]}>✕</Text>
              </Pressable>
            </View>

            {/* Title and body */}
            <Pressable onPress={handleMinimizeAlert} style={styles.alertBodyPressable}>
              <Text
                testID="notification-alert-title"
                style={[styles.alertTitle, { color: tokens.label }]}
                numberOfLines={1}
              >
                {activeAlert.title}
              </Text>
              <Text
                testID="notification-alert-body"
                style={[styles.alertBody, { color: tokens.label2 }]}
                numberOfLines={2}
              >
                {activeAlert.body}
              </Text>

              {/* Swipe affordance */}
              <View style={styles.alertAffordanceRow}>
                <View style={[styles.alertSwipeBar, { backgroundColor: tokens.panelRim }]} />
                <Text style={[styles.alertAffordanceText, { color: tokens.label3 }]}>
                  Swipe up to minimize to Island
                </Text>
              </View>
            </Pressable>
          </Animated.View>
        ) : !expanded ? (
          !current && isAlertMinimized ? (
            /* Minimized Notification Pill (when no music is playing) */
            <Animated.View
              style={{
                borderRadius: 23,
                shadowColor: alertColor,
                shadowOpacity: 0.75,
                shadowRadius: 16,
                elevation: 10,
              }}
            >
              <Pressable
                testID="music-island-collapsed"
                onPress={handleExpandAlert}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                style={[
                  styles.collapsed,
                  {
                    backgroundColor: tokens.glassStrong,
                    borderColor: alertColor,
                  },
                ]}
              >
                <View style={styles.alertPillIconContainer}>
                  <Text style={styles.alertPillIcon}>{catMeta?.icon}</Text>
                </View>
                <View style={styles.collapsedMeta}>
                  <Text
                    testID="notification-minimized-title"
                    style={[styles.title, { color: tokens.label }]}
                    numberOfLines={1}
                  >
                    {activeAlert?.title}
                  </Text>
                  {activeAlert?.timing && (
                    <Text style={[styles.cast, { color: alertColor }]}>
                      {activeAlert.timing === "advance" ? "15m" : "Now"}
                    </Text>
                  )}
                </View>
                <Pressable
                  testID="notification-alert-dismiss"
                  onPress={handleDismissAlert}
                  accessibilityLabel="Dismiss notification"
                  hitSlop={8}
                  style={styles.pillDismissBtn}
                >
                  <Text style={[styles.pillDismissIcon, { color: tokens.label2 }]}>✕</Text>
                </Pressable>
              </Pressable>
            </Animated.View>
          ) : current && isAlertMinimized ? (
            /* Merged Music + Notification Minimized Pill */
            <Animated.View
              style={{
                borderRadius: 23,
                shadowColor: alertColor,
                shadowOpacity: 0.75,
                shadowRadius: 16,
                elevation: 10,
              }}
            >
              <Pressable
                testID="music-island-collapsed"
                onPress={handleExpand}
                style={[
                  styles.collapsed,
                  styles.collapsedAlertActive,
                  {
                    backgroundColor: tokens.glassStrong,
                    borderColor: alertColor,
                  },
                ]}
              >
                <View style={styles.leftWaveform}>
                  <WaveformBars playing={playing} color={tokens.accent} />
                </View>

                <View style={styles.collapsedMeta}>
                  <Text
                    testID="music-island-title"
                    style={[styles.title, { color: tokens.label }]}
                    numberOfLines={1}
                  >
                    {current.title}
                  </Text>
                </View>

                {/* Divider between music and notification */}
                <View style={[styles.pillDivider, { backgroundColor: tokens.panelRim }]} />

                {/* Minimized alert badge on right */}
                <Pressable
                  testID="notification-minimized-pill"
                  onPress={handleExpandAlert}
                  hitSlop={6}
                  style={styles.pillAlertRight}
                >
                  <Text style={styles.alertPillIcon}>{catMeta?.icon}</Text>
                  <Text style={[styles.pillAlertLabel, { color: alertColor }]} numberOfLines={1}>
                    {activeAlert?.timing === "advance" ? "15m" : "Alert"}
                  </Text>
                </Pressable>
              </Pressable>
            </Animated.View>
          ) : current ? (
            /* Standard Collapsed Music Island */
            <Pressable
              testID="music-island-collapsed"
              onPress={handleExpand}
              style={[
                styles.collapsed,
                {
                  backgroundColor: tokens.glassStrong,
                  borderColor: playing ? mix(tokens.accent, tokens.glassRim, 40) : tokens.glassRim,
                  shadowColor: playing ? tokens.accent : tokens.shadow,
                  shadowOpacity: playing ? 0.5 : 0.25,
                  shadowRadius: playing ? 14 : 8,
                },
              ]}
            >
              {/* Left: Sound Wave Equalizer (dancing when playing, flat off when paused) */}
              <View style={styles.leftWaveform}>
                <WaveformBars playing={playing} color={tokens.accent} />
              </View>

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

              {/* Right: mini artwork with Apple squircle radius */}
              <View style={styles.artContainer}>
                <Image
                  testID="music-island-art"
                  source={{ uri: current.artworkUrl ?? undefined }}
                  style={styles.art}
                />
                {playing && (
                  <View
                    style={[
                      styles.activeDot,
                      { backgroundColor: tokens.accent, borderColor: tokens.glassStrong },
                    ]}
                  />
                )}
              </View>

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
          ) : null
        ) : current ? (
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
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 }}>
                  <View style={[styles.deviceBadge, { backgroundColor: tokens.panel }]}>
                    <Text style={[styles.deviceBadgeText, { color: tokens.label2 }]}>
                      {cast.casting ? "📡 Casting" : "🔊 Local Speaker"}
                    </Text>
                  </View>
                  <WaveformBars playing={playing} color={tokens.accent} />
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
                  {
                    backgroundColor: tokens.accent,
                    shadowColor: playing ? tokens.accent : tokens.shadow,
                    shadowOpacity: playing ? 0.6 : 0.3,
                    shadowRadius: playing ? 10 : 6,
                  },
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
        ) : null}
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
    paddingHorizontal: 14,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
    maxWidth: 390,
    overflow: "hidden",
  },
  collapsedAlertActive: {
    maxWidth: 440,
  },
  leftWaveform: {
    marginRight: 10,
    justifyContent: "center",
  },
  artContainer: {
    position: "relative",
    marginLeft: 6,
  },
  art: {
    width: 28,
    height: 28,
    borderRadius: 8,
  },
  activeDot: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
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
    maxWidth: 480,
    padding: 18,
    borderRadius: 32,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.65,
    shadowRadius: 24,
    elevation: 20,
  },
  // Large Alert Window
  alertLarge: {
    width: "100%",
    maxWidth: 520,
    padding: 16,
    borderRadius: 28,
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.7,
    shadowRadius: 20,
    elevation: 20,
  },
  alertHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  alertCategoryPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  alertCategoryIcon: {
    fontSize: 14,
  },
  alertCategoryLabel: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  alertDismissBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  alertDismissText: {
    fontSize: 16,
    fontWeight: "600",
  },
  alertBodyPressable: {
    marginTop: 2,
  },
  alertTitle: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  alertBody: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
  alertAffordanceRow: {
    alignItems: "center",
    marginTop: 10,
    gap: 4,
  },
  alertSwipeBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  alertAffordanceText: {
    fontSize: 14,
    fontWeight: "500",
  },
  alertPillIconContainer: {
    marginRight: 8,
  },
  alertPillIcon: {
    fontSize: 16,
  },
  pillDismissBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 6,
  },
  pillDismissIcon: {
    fontSize: 14,
    fontWeight: "600",
  },
  pillDivider: {
    width: 1,
    height: 18,
    marginHorizontal: 8,
  },
  pillAlertRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingLeft: 4,
  },
  pillAlertLabel: {
    fontSize: 14,
    fontWeight: "700",
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
