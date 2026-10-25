import React, { useState, useRef } from "react";
import { Image, View, Text, Pressable, StyleSheet } from "react-native";
import { usePathname } from "expo-router";
import { usePlayback } from "./playback";
import { useCast } from "./CastProvider";
import { useTheme } from "../theme/ThemeProvider";
import { musicTokensFor } from "../theme/music-tokens";

export function MusicIsland() {
  const { current, position, duration } = usePlayback();
  const cast = useCast();
  const pathname = usePathname();
  const { theme, boost } = useTheme();

  const [expanded, setExpanded] = useState(false);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up timer on unmount
  React.useEffect(() => {
    return () => {
      if (collapseTimer.current) {
        clearTimeout(collapseTimer.current);
        collapseTimer.current = null;
      }
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
    }, 5000);
  };

  const handleCollapse = () => {
    setExpanded(false);
    if (collapseTimer.current) {
      clearTimeout(collapseTimer.current);
      collapseTimer.current = null;
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
            <Text>Expanded controls (Task 4)</Text>
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
  },
});
