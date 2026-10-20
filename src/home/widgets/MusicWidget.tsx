import React from "react";
import { Image, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../state/AuthProvider";
import { useTheme } from "../../theme/ThemeProvider";
import { TYPOGRAPHY } from "../../theme/tokens";
import { mix } from "../../theme/mix";
import { Material } from "../../theme/Material";
import { WidgetFrame } from "./WidgetFrame";
import { usePlayback } from "../../music/playback";

const ART = 56;

export function MusicWidget() {
  const { colors, accentColor } = useTheme();
  const router = useRouter();
  const { member, hydrated } = useAuth();
  const { current, playing, toggle, next } = usePlayback();
  const guest = hydrated && !member;
  const open = () => router.push("/music" as never);

  return (
    <WidgetFrame
      id="music"
      icon="🎵"
      title="Music"
      description={guest ? "Sign in to listen" : current ? "Now playing" : "Ad-free YouTube Music"}
      status="ready"
      failure={null}
      hasData
      stale={false}
      onRetry={open}
    >
      {guest ? (
        <Pressable
          testID="music-widget-signin"
          accessibilityRole="button"
          accessibilityLabel="Sign in from the member rail to play music"
          onPress={open}
          style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 8 }}
        >
          <Text style={{ fontSize: 40 }}>🔒</Text>
          <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, textAlign: "center" }}>
            Sign in from the member rail
          </Text>
        </Pressable>
      ) : (
        <View style={{ flex: 1, gap: 10 }}>
          {/* The artwork/title is the "open music" target; the transport
              controls are SIBLINGS of it, not children - a Pressable nested
              inside a Pressable renders <button> inside <button> on web
              (invalid HTML, and the capture harness treats it as a defect)
              and swallows the inner tap on Android. */}
          <Pressable
            testID="music-widget-open"
            accessibilityRole="button"
            accessibilityLabel={current ? `Open music. ${current.title} by ${current.artist}` : "Open music"}
            onPress={open}
            style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
          >

            <Material tier="thin" style={{ width: ART, height: ART, borderRadius: 16, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              {current?.artworkUrl ? (
                <Image source={{ uri: current.artworkUrl }} style={{ width: ART, height: ART }} resizeMode="cover" />
              ) : (
                <Text style={{ fontSize: 28 }}>🎵</Text>
              )}
            </Material>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text testID="music-widget-title" numberOfLines={1} style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
                {current ? current.title : "Nothing playing"}
              </Text>
              <Text numberOfLines={1} style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }}>
                {current ? current.artist : "Search YouTube Music from the player"}
              </Text>
            </View>
          </Pressable>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Pressable
              testID="music-widget-play"
              accessibilityRole="button"
              accessibilityLabel={playing ? "Pause" : "Play"}
              accessibilityState={{ disabled: !current }}
              disabled={!current}
              hitSlop={12}
              onPress={(event) => { event?.stopPropagation?.(); toggle(); }}
              style={{
                width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center",
                backgroundColor: mix(accentColor, "transparent", current ? 22 : 8),
                borderWidth: 1, borderColor: mix(accentColor, "transparent", current ? 45 : 18),
              }}
            >
              <Text style={{ fontSize: 18, color: colors["color-text-primary"] }}>{playing ? "❚❚" : "▶"}</Text>
            </Pressable>
            <Pressable
              testID="music-widget-next"
              accessibilityRole="button"
              accessibilityLabel="Next track"
              accessibilityState={{ disabled: !current }}
              disabled={!current}
              hitSlop={12}
              onPress={(event) => { event?.stopPropagation?.(); void next(); }}
              style={{ width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: mix(colors["color-text-primary"], "transparent", 6) }}
            >
              <Text style={{ fontSize: 16, color: colors["color-text-primary"] }}>▶▶</Text>
            </Pressable>
            <Pressable
              testID="music-widget-open-link"
              accessibilityRole="button"
              accessibilityLabel="Open music"
              onPress={open}
              style={{ marginLeft: "auto", minHeight: 48, justifyContent: "center" }}
            >
              <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "600" }}>
                Open →
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </WidgetFrame>
  );
}

export default MusicWidget;
