import React from "react";
import { Image, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../state/AuthProvider";
import { useTheme } from "../../theme/ThemeProvider";
import { ACCENTS, TYPOGRAPHY } from "../../theme/tokens";
import { mix } from "../../theme/mix";
import { musicTokensFor } from "../../theme/music-tokens";
import { HomeWidgetIcon } from "../../ui/HomeWidgetIcon";
import { WidgetFrame } from "./WidgetFrame";
import type { WallShape, WallSpan } from "../widgets";
import { usePlaybackCore } from "../../music/playback";
import { useCast } from "../../music/CastProvider";
import { isContentHidden } from "../../music/explicit";

const COMPACT_ART = 64;
const WIDE_ART = 92;
const MUSIC_GLYPH = "♫";

export function MusicWidget({ shape }: { span?: WallSpan; shape?: WallShape } = {}) {
  const { colors, theme, boost, accentColor } = useTheme();
  const tokens = React.useMemo(() => musicTokensFor(theme, boost), [theme, boost]);
  const router = useRouter();
  const { member, hydrated } = useAuth();
  const { current, playing, toggle, next, policy } = usePlaybackCore();
  const cast = useCast();
  const guest = hydrated && !member;
  const isWide = shape === "2x1";
  const open = () => router.replace("/music" as never);
  const violetTone = ACCENTS[theme]?.violet ?? accentColor;
  const violetInk = colors["color-accent-ink-violet"] ?? tokens.label2;

  const hidden = !!current && isContentHidden(current, policy);
  const showTrack = !!current && !hidden;
  const casting = cast.casting;
  const transportPlaying = casting ? cast.playing : playing;
  const artEdge = isWide ? WIDE_ART : COMPACT_ART;

  const headerRightLink = !guest ? (
    <Pressable
      testID="music-widget-open-link"
      accessibilityRole="button"
      accessibilityLabel="Open music"
      onPress={open}
      hitSlop={{ top: 14, bottom: 14, left: 12, right: 12 }}
      style={{ minHeight: 36, justifyContent: "center", paddingHorizontal: 6 }}
    >
      <Text style={{ color: tokens.label2, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "600" }}>
        Open →
      </Text>
    </Pressable>
  ) : null;

  return (
    <WidgetFrame
      id="music"
      icon={MUSIC_GLYPH}
      title="Music"
      description="Ad-free YouTube Music"
      headerRight={headerRightLink}
      onHeaderPress={open}
      headerPressLabel="Open music"
      showHeaderChevron={guest}
      status="ready"
      failure={null}
      hasData
      stale={false}
      onRetry={open}
    >
      {guest ? (
        isWide ? (
          <Pressable
            testID="music-widget-signin"
            accessibilityRole="button"
            accessibilityLabel="Sign in from the member rail to play music"
            onPress={open}
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              paddingHorizontal: 8,
            }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: mix(violetTone, "transparent", 14),
                borderWidth: 1,
                borderColor: mix(violetTone, "transparent", 32),
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 26, lineHeight: 30 }}>🔒</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text
                style={{
                  color: colors["color-text-primary"],
                  fontSize: TYPOGRAPHY.title.fontSize,
                  fontWeight: "700",
                }}
              >
                Sign in to listen
              </Text>
              <Text
                numberOfLines={1}
                style={{
                  color: colors["color-text-secondary"],
                  fontSize: TYPOGRAPHY.label.fontSize,
                  lineHeight: TYPOGRAPHY.label.lineHeight,
                }}
              >
                Sign in from the member rail to play music.
              </Text>
            </View>
            <View
              style={{
                minHeight: 48,
                paddingHorizontal: 18,
                borderRadius: 999,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: mix(violetTone, "transparent", 14),
                borderWidth: 1,
                borderColor: mix(violetTone, "transparent", 34),
              }}
            >
              <Text style={{ color: violetInk, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
                Open Music →
              </Text>
            </View>
          </Pressable>
        ) : (
          <Pressable
            testID="music-widget-signin"
            accessibilityRole="button"
            accessibilityLabel="Sign in from the member rail to play music"
            onPress={open}
            style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 6 }}
          >
            <Text style={{ fontSize: 30, lineHeight: 36 }}>🔒</Text>
            <Text
              style={{
                color: colors["color-text-primary"],
                fontSize: TYPOGRAPHY.title.fontSize,
                fontWeight: "700",
                textAlign: "center",
              }}
            >
              Sign in to listen
            </Text>
            <Text
              style={{
                color: colors["color-text-secondary"],
                fontSize: TYPOGRAPHY.label.fontSize,
                lineHeight: TYPOGRAPHY.label.lineHeight,
                textAlign: "center",
              }}
            >
              Sign in from the member rail to play music.
            </Text>
          </Pressable>
        )
      ) : isWide ? (
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 16 }}>
          <Pressable
            testID="music-widget-open"
            accessibilityRole="button"
            accessibilityLabel={showTrack ? `Open music. ${current?.title} by ${current?.artist}` : "Open music"}
            onPress={open}
            style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 16, minHeight: WIDE_ART }}
          >
            <View
              testID="music-widget-art-chip"
              style={{
                width: WIDE_ART,
                height: WIDE_ART,
                borderRadius: tokens.artworkRadius,
                backgroundColor: tokens.panel,
                borderWidth: 1,
                borderColor: tokens.panelRim,
                overflow: "hidden",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {showTrack && current?.artworkUrl ? (
                <Image
                  testID="music-widget-art"
                  source={{ uri: current.artworkUrl }}
                  style={{ width: WIDE_ART - 2, height: WIDE_ART - 2 }}
                  resizeMode="cover"
                />
              ) : (
                <HomeWidgetIcon variant="music" size={56} />
              )}
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <Text
                numberOfLines={1}
                style={{
                  color: violetInk,
                  fontSize: TYPOGRAPHY.label.fontSize,
                  fontWeight: "700",
                }}
              >
                {casting
                  ? `Casting · ${cast.target?.name ?? "Speaker"}`
                  : showTrack
                    ? "Now playing"
                    : "Ready to play"}
              </Text>
              <Text
                testID="music-widget-title"
                numberOfLines={2}
                style={{ color: tokens.label, fontSize: 18, lineHeight: 22, fontWeight: "700" }}
              >
                {showTrack ? current?.title : "Nothing playing"}
              </Text>
              <Text
                testID="music-widget-artist"
                numberOfLines={1}
                style={{ color: tokens.label3, fontSize: TYPOGRAPHY.label.fontSize }}
              >
                {showTrack ? current?.artist : "Search YouTube Music from the player"}
              </Text>
            </View>
          </Pressable>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <Pressable
              testID="music-widget-play"
              accessibilityRole="button"
              accessibilityLabel={transportPlaying ? "Pause" : "Play"}
              accessibilityState={{ disabled: !showTrack }}
              disabled={!showTrack}
              hitSlop={6}
              onPress={(event) => {
                event?.stopPropagation?.();
                if (casting) void (cast.playing ? cast.pause() : cast.play());
                else toggle();
              }}
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: showTrack
                  ? mix(violetTone, "transparent", 24)
                  : mix(tokens.label, "transparent", 4),
                borderWidth: 1,
                borderColor: showTrack
                  ? mix(violetTone, "transparent", 48)
                  : mix(tokens.panelRim, "transparent", 40),
              }}
            >
              <Text style={{ fontSize: 20, color: showTrack ? tokens.label : tokens.label3 }}>
                {transportPlaying ? "❚❚" : "▶"}
              </Text>
            </Pressable>
            <Pressable
              testID="music-widget-next"
              accessibilityRole="button"
              accessibilityLabel="Next track"
              accessibilityState={{ disabled: !showTrack }}
              disabled={!showTrack}
              hitSlop={8}
              onPress={(event) => {
                event?.stopPropagation?.();
                if (casting) void cast.advance(false);
                else void next();
              }}
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: mix(tokens.label, "transparent", showTrack ? 8 : 4),
                borderWidth: 1,
                borderColor: showTrack ? tokens.panelRim : mix(tokens.panelRim, "transparent", 40),
              }}
            >
              <Text style={{ fontSize: 16, color: showTrack ? tokens.label : tokens.label3 }}>▶▶</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={{ flex: 1, gap: 10 }}>
          <Pressable
            testID="music-widget-open"
            accessibilityRole="button"
            accessibilityLabel={showTrack ? `Open music. ${current?.title} by ${current?.artist}` : "Open music"}
            onPress={open}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64 }}
          >
            <View
              testID="music-widget-art-chip"
              style={{
                width: artEdge,
                height: artEdge,
                borderRadius: tokens.artworkRadius,
                backgroundColor: tokens.panel,
                borderWidth: 1,
                borderColor: tokens.panelRim,
                overflow: "hidden",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {showTrack && current?.artworkUrl ? (
                <Image
                  testID="music-widget-art"
                  source={{ uri: current.artworkUrl }}
                  style={{ width: artEdge - 2, height: artEdge - 2 }}
                  resizeMode="cover"
                />
              ) : (
                <HomeWidgetIcon variant="music" size={40} />
              )}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                testID="music-widget-title"
                numberOfLines={1}
                style={{ color: tokens.label, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}
              >
                {showTrack ? current?.title : "Nothing playing"}
              </Text>
              <Text
                testID="music-widget-artist"
                numberOfLines={1}
                style={{ color: tokens.label3, fontSize: TYPOGRAPHY.label.fontSize }}
              >
                {showTrack ? current?.artist : "Search YouTube Music from the player"}
              </Text>
            </View>
          </Pressable>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Pressable
              testID="music-widget-play"
              accessibilityRole="button"
              accessibilityLabel={transportPlaying ? "Pause" : "Play"}
              accessibilityState={{ disabled: !showTrack }}
              disabled={!showTrack}
              hitSlop={12}
              onPress={(event) => {
                event?.stopPropagation?.();
                if (casting) void (cast.playing ? cast.pause() : cast.play());
                else toggle();
              }}
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: mix(tokens.label, "transparent", showTrack ? 8 : 4),
                borderWidth: 1,
                borderColor: showTrack ? tokens.panelRim : mix(tokens.panelRim, "transparent", 40),
              }}
            >
              <Text style={{ fontSize: 18, color: showTrack ? tokens.label : tokens.label3 }}>
                {transportPlaying ? "❚❚" : "▶"}
              </Text>
            </Pressable>
            <Pressable
              testID="music-widget-next"
              accessibilityRole="button"
              accessibilityLabel="Next track"
              accessibilityState={{ disabled: !showTrack }}
              disabled={!showTrack}
              hitSlop={12}
              onPress={(event) => {
                event?.stopPropagation?.();
                if (casting) void cast.advance(false);
                else void next();
              }}
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: mix(tokens.label, "transparent", showTrack ? 8 : 4),
                borderWidth: 1,
                borderColor: showTrack ? tokens.panelRim : mix(tokens.panelRim, "transparent", 40),
              }}
            >
              <Text style={{ fontSize: 16, color: showTrack ? tokens.label : tokens.label3 }}>▶▶</Text>
            </Pressable>
          </View>
        </View>
      )}
    </WidgetFrame>
  );
}

export default MusicWidget;
