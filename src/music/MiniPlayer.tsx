import React from "react";
import { Image, Pressable, Text, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { useTheme } from "../theme/ThemeProvider";
import { TYPOGRAPHY } from "../theme/tokens";
import { mix } from "../theme/mix";
import { Material } from "../theme/Material";
import { usePlayback } from "./playback";

export function MiniPlayer() {
  const { colors, accentColor } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const { current, playing, toggle, next } = usePlayback();

  if (!current) return null;
  if (pathname === "/music" || pathname === "/screensaver") return null;

  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 16, right: 16, bottom: 120, alignItems: "center" }}>
      <Material tier="regular" style={{ width: "100%", maxWidth: 760, borderRadius: 24, padding: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable testID="mini-player" accessibilityRole="button" accessibilityLabel={`Open music. ${current.title} by ${current.artist}`} onPress={() => router.push("/music" as never)} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64 }}>
            <Material tier="thin" style={{ width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              {current.artworkUrl ? <Image source={{ uri: current.artworkUrl }} style={{ width: 52, height: 52 }} /> : <Text style={{ fontSize: 24 }}>🎵</Text>}
            </Material>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ color: colors["color-text-primary"], fontWeight: "700", fontSize: TYPOGRAPHY.body.fontSize }}>{current.title}</Text>
              <Text numberOfLines={1} style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }}>{current.artist}</Text>
            </View>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={playing ? "Pause" : "Play"} hitSlop={10} onPress={toggle} style={{ width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: mix(accentColor, "transparent", 22) }}>
            <Text style={{ color: colors["color-text-primary"], fontSize: 20 }}>{playing ? "❚❚" : "▶"}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Next track" hitSlop={10} onPress={() => void next()} style={{ width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: mix(colors["color-text-primary"], "transparent", 6) }}>
            <Text style={{ color: colors["color-text-primary"], fontSize: 18 }}>⏭</Text>
          </Pressable>
        </View>
      </Material>
    </View>
  );
}

export default MiniPlayer;
