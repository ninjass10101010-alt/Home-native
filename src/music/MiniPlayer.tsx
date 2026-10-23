import React from "react";
import { Image, Pressable, Text, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { useTheme } from "../theme/ThemeProvider";
import { TYPOGRAPHY } from "../theme/tokens";
import { mix } from "../theme/mix";
import { musicTokensFor } from "../theme/music-tokens";
import { usePlayback } from "./playback";
import { isContentHidden } from "./explicit";

/**
 * The bar's own glyph — the beamed note U+266B.
 *
 * A TEXT-presentation glyph, so it takes the ink it is painted with (the
 * 🎵 emoji is a NEAR-BLACK note in Android's Noto Color Emoji — see the
 * MusicWidget's badge note for the full story).
 */
const MUSIC_GLYPH = "♫";

/** The artwork's edge in the bar (dp). */
const ART = 48;

/**
 * The transport's disc (dp) — the 64dp wall floor, so the bar is operable
 * from across the room.
 */
const TRANSPORT = 64;

export function MiniPlayer() {
  const { theme, boost } = useTheme();
  // The music surface's OWN palette (Shiny's Liquid) — the same token module
  // the /music screens read. Never a literal.
  const tokens = React.useMemo(() => musicTokensFor(theme, boost), [theme, boost]);
  const pathname = usePathname();
  const router = useRouter();
  const { current, playing, toggle, next, policy } = usePlayback();

  if (!current) return null;
  if (pathname === "/music" || pathname === "/screensaver") return null;

  /**
   * The chrome is a track surface too: a track the viewer may not see is
   * never painted here (no artwork, no title) — the bar keeps its place on
   * the wall and says the neutral truth instead. Its TRANSPORT is disabled
   * for such a track, exactly like the wall card's: the viewer may not hear
   * it either.
   */
  const hidden = isContentHidden(current, policy);
  const title = hidden ? "Nothing playing" : current.title;
  const artist = hidden ? "Search YouTube Music from the player" : current.artist;

  /**
   * The transport disc — a ghost on the panel rim.
   *
   * The chrome RECEDES (Shiny's idea): the bar is not the Now Playing stage,
   * so its transport is not an accent-filled disc. It is a quiet ring on the
   * panel, and when the track is hidden the ring dims and the glyph drops
   * to the third tier — the disabled state is visible, not only announced.
   */
  const transport = {
    width: TRANSPORT,
    height: TRANSPORT,
    borderRadius: TRANSPORT / 2,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: mix(tokens.label, "transparent", hidden ? 4 : 8),
    borderWidth: 1,
    borderColor: hidden ? mix(tokens.panelRim, "transparent", 40) : tokens.panelRim,
  };

  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 16, right: 16, bottom: 120, alignItems: "center" }}>
      {/*
        THE CAPSULE — the bar above the dock, on the Liquid palette: the panel
        fill, the panel rim, the panel radius. It floats over the wall, so it
        carries its own ground rather than borrowing the wall's glass.
      */}
      <View
        testID="mini-player-capsule"
        style={{
          width: "100%",
          maxWidth: 760,
          backgroundColor: tokens.panel,
          borderRadius: tokens.panelRadius,
          borderWidth: 1,
          borderColor: tokens.panelRim,
          padding: 8,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable testID="mini-player" accessibilityRole="button" accessibilityLabel={hidden ? "Open music. Nothing playing" : `Open music. ${current.title} by ${current.artist}`} onPress={() => router.push("/music" as never)} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64 }}>
            {/*
              THE ARTWORK — a 48dp tile on the Liquid radius, on the grouped
              ground. A hidden track paints NO artwork: the tile wears the
              glyph, never the cover.
            */}
            <View
              testID="mini-player-art-tile"
              style={{
                width: ART,
                height: ART,
                borderRadius: tokens.artworkRadius,
                backgroundColor: tokens.grouped,
                overflow: "hidden",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {!hidden && current.artworkUrl ? (
                <Image testID="mini-player-art" source={{ uri: current.artworkUrl }} style={{ width: ART, height: ART }} resizeMode="cover" />
              ) : (
                <Text style={{ fontSize: 24, lineHeight: 28, color: tokens.label2 }}>{MUSIC_GLYPH}</Text>
              )}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text testID="mini-player-title" numberOfLines={1} style={{ color: tokens.label, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>{title}</Text>
              <Text testID="mini-player-artist" numberOfLines={1} style={{ color: tokens.label3, fontSize: TYPOGRAPHY.label.fontSize }}>{artist}</Text>
            </View>
          </Pressable>
          <Pressable testID="mini-player-play" accessibilityRole="button" accessibilityLabel={playing ? "Pause" : "Play"} accessibilityState={{ disabled: hidden }} disabled={hidden} hitSlop={10} onPress={toggle} style={transport}>
            <Text style={{ color: hidden ? tokens.label3 : tokens.label, fontSize: 20 }}>{playing ? "❚❚" : "▶"}</Text>
          </Pressable>
          <Pressable testID="mini-player-next" accessibilityRole="button" accessibilityLabel="Next track" accessibilityState={{ disabled: hidden }} disabled={hidden} hitSlop={10} onPress={() => void next()} style={transport}>
            <Text style={{ color: hidden ? tokens.label3 : tokens.label, fontSize: 18 }}>⏭</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default MiniPlayer;
