import React, { useState, useRef } from "react";
import { Image, View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { usePlayback } from "./playback";
import { useCast } from "./CastProvider";
import { useOutputVolume } from "./output-volume";
import { useTheme } from "../theme/ThemeProvider";
import { musicTokensFor } from "../theme/music-tokens";

export function MusicIsland() {
  const { current, position, duration, playing, toggle, next, previous, stopAndClear, player } = usePlayback();
  const cast = useCast();
  const pathname = usePathname();
  const router = useRouter();
  const { theme, boost } = useTheme();
  const volume = useOutputVolume(player);

  const [expanded, setExpanded] = useState(false);
  const [stopArmed, setStopArmed] = useState(false);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopArmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up timers on unmount
  React.useEffect(() => {
    return () => {
      if (collapseTimer.current) clearTimeout(collapseTimer.current);
      if (stopArmTimer.current) clearTimeout(stopArmTimer.current);
    };
  }, []);

  // Hide when no track or on music/screensaver
  if (!current || pathname === "/music" || pathname === "/screensaver") {
    return null;
  }

  const tokens = musicTokensFor(theme, boost);

  const handleExpand = () => {
    setExpanded(true);

    // Auto-collapse after 5s
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    collapseTimer.current = setTimeout(() => {
      setExpanded(false);
      setStopArmed(false);
    }, 5000);
  };

  const handleCollapse = () => {
    setExpanded(false);
    setStopArmed(false);
    if (collapseTimer.current) {
      clearTimeout(collapseTimer.current);
      collapseTimer.current = null;
    }
    if (stopArmTimer.current) {
      clearTimeout(stopArmTimer.current);
      stopArmTimer.current = null;
    }
  };

  const handleStopPress = () => {
    if (!stopArmed) {
      setStopArmed(true);
      if (stopArmTimer.current) clearTimeout(stopArmTimer.current);
      stopArmTimer.current = setTimeout(() => {
        setStopArmed(false);
        // After arm resets, start collapse timer
        if (collapseTimer.current) clearTimeout(collapseTimer.current);
        collapseTimer.current = setTimeout(() => {
          setExpanded(false);
          setStopArmed(false);
        }, 5000);
      }, 5000);
      // Clear collapse timer while armed (give user time to confirm)
      if (collapseTimer.current) {
        clearTimeout(collapseTimer.current);
        collapseTimer.current = null;
      }
    } else {
      // Stop cast if active, then clear
      if (cast.casting) {
        cast.disconnect().catch(() => {});
      }
      stopAndClear();
      setStopArmed(false);
      setExpanded(false);
      if (stopArmTimer.current) {
        clearTimeout(stopArmTimer.current);
        stopArmTimer.current = null;
      }
    }
  };

  const progress = duration > 0 ? position / duration : 0;

  return (
    <>
      {expanded && (
        <Pressable
          testID="music-island-backdrop"
          style={StyleSheet.absoluteFill}
          onPress={handleCollapse}
        />
      )}
      <View testID="music-island" style={styles.container}>
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
            <Image
              testID="music-island-art"
              source={{ uri: current.artworkUrl ?? undefined }}
              style={styles.art}
            />
            <Text
              testID="music-island-title"
              style={[styles.title, { color: tokens.label }]}
              numberOfLines={1}
            >
              {current.title}
            </Text>
            {cast.casting && (
              <Text testID="music-island-cast" style={[styles.cast, { color: tokens.label2 }]}>
                Casting
              </Text>
            )}
            <View
              testID="music-island-progress"
              style={[
                styles.progress,
                { backgroundColor: tokens.glassRim },
              ]}
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
          <View testID="music-island-expanded" style={[styles.expanded, { backgroundColor: tokens.glassStrong }]}>
            <View style={styles.expandedTop}>
              <Pressable
                testID="music-island-art-expanded"
                onPress={() => router.push("/music" as never)}
              >
                <Image source={{ uri: current.artworkUrl ?? undefined }} style={styles.artExpanded} />
              </Pressable>
              <View style={styles.meta}>
                <Text style={[styles.titleExpanded, { color: tokens.label }]}>
                  {current.title}
                </Text>
                <Text style={[styles.artist, { color: tokens.label2 }]}>
                  {current.artist}
                </Text>
              </View>
            </View>

            <View style={styles.controls}>
              <Pressable
                testID="music-island-prev"
                onPress={() => (cast.casting ? cast.previous() : previous())}
                style={styles.controlButton}
                accessibilityLabel="Previous track"
              >
                <Text style={{ color: tokens.label }}>⏮</Text>
              </Pressable>

              <Pressable
                testID="music-island-play"
                onPress={() => (cast.casting ? (cast.playing ? cast.pause() : cast.play()) : toggle())}
                style={[styles.controlButton, styles.playButton]}
                accessibilityLabel={playing ? "Pause" : "Play"}
              >
                <Text style={{ color: tokens.label }}>{playing ? "⏸" : "▶"}</Text>
              </Pressable>

              <Pressable
                testID="music-island-next"
                onPress={() => (cast.casting ? cast.advance(false) : next())}
                style={styles.controlButton}
                accessibilityLabel="Next track"
              >
                <Text style={{ color: tokens.label }}>⏭</Text>
              </Pressable>
            </View>

            <View style={styles.volumeRow}>
              <Text style={{ color: tokens.label2, fontSize: 12 }}>
                Volume ({volume.target})
              </Text>
            </View>

            <Pressable
              testID="music-island-stop"
              onPress={handleStopPress}
              style={[styles.stopButton, { backgroundColor: stopArmed ? tokens.accent : tokens.glassRim }]}
              accessibilityLabel={stopArmed ? "Confirm stop" : "Stop"}
            >
              <Text style={{ color: tokens.label }}>
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
    top: 16,
    left: 16,
    right: 16,
    alignItems: "center",
    zIndex: 1000,
  },
  collapsed: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    maxWidth: 400,
  },
  art: {
    width: 40,
    height: 40,
    borderRadius: 6,
    marginRight: 12,
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
  },
  cast: {
    fontSize: 12,
    marginLeft: 8,
  },
  progress: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: "hidden",
  },
  progressFill: {
    height: 2,
  },
  expanded: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    maxWidth: 400,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  expandedTop: {
    flexDirection: "row",
    marginBottom: 12,
  },
  artExpanded: {
    width: 64,
    height: 64,
    borderRadius: 8,
    marginRight: 12,
  },
  meta: {
    flex: 1,
    justifyContent: "center",
  },
  titleExpanded: {
    fontSize: 16,
    fontWeight: "700",
  },
  artist: {
    fontSize: 14,
    marginTop: 4,
  },
  controls: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  controlButton: {
    width: 64,
    height: 64,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 8,
  },
  playButton: {
    width: 72,
    height: 72,
  },
  volumeRow: {
    marginBottom: 12,
  },
  stopButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: "center",
  },
});
