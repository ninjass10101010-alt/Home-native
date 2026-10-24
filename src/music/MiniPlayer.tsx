import React from "react";
import { Image, Pressable, Text, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { useTheme } from "../theme/ThemeProvider";
import { TYPOGRAPHY } from "../theme/tokens";
import { mix } from "../theme/mix";
import { musicTokensFor } from "../theme/music-tokens";
import { usePlayback } from "./playback";
import { useCast } from "./CastProvider";
import { isContentHidden } from "./explicit";
import { DOCK_TOP_OFFSET } from "../nav/CapsuleDock";

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
  const cast = useCast();

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
  // While casting, the bar is a remote for the receiver: its transport reads
  // the cast's clock and drives the session, never the tablet's local audio.
  const casting = cast.casting;
  const transportPlaying = casting ? cast.playing : playing;

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
    <View
      testID="mini-player-floating"
      pointerEvents="box-none"
      // The floating chrome clears the dock by design: the pill sits ABOVE the
      // dock's reserved band (DOCK_TOP_OFFSET), so the two never overlap.
      style={{ position: "absolute", left: 16, right: 16, bottom: DOCK_TOP_OFFSET + 12, alignItems: "center" }}
    >
      {/*
        THE FLOATING GLASS PILL — the bar above the dock, on the Yuma glass
        language: the DENSE glass fill (opaque on purpose — it carries the
        transport glyphs over content whose colour is unknown), the glass
        hairline, the pill radius and a soft shadow.

        It is the same family as the transport pill: glassStrong fill,
        glassRim hairline, shadow. It floats over the page, so it carries its
        own ground rather than borrowing the wall's glass.
      */}
      <View
        testID="mini-player-capsule"
        style={{
          width: "100%",
          maxWidth: 760,
          backgroundColor: tokens.glassStrong,
          borderRadius: 9999,
          borderWidth: 1,
          borderColor: tokens.glassRim,
          padding: 8,
          shadowColor: tokens.shadow,
          shadowOpacity: 1,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 8 },
          elevation: 6,
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
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text testID="mini-player-artist" numberOfLines={1} style={{ flexShrink: 1, color: tokens.label3, fontSize: TYPOGRAPHY.label.fontSize }}>{artist}</Text>
                {cast.casting ? (
                  <Text testID="mini-player-cast" style={{ color: tokens.label2, fontSize: TYPOGRAPHY.label.fontSize }}>Casting</Text>
                ) : null}
              </View>
            </View>
          </Pressable>
          <Pressable
            testID="mini-player-play"
            accessibilityRole="button"
            accessibilityLabel={transportPlaying ? "Pause" : "Play"}
            accessibilityState={{ disabled: hidden }}
            disabled={hidden}
            hitSlop={10}
            onPress={casting ? () => void (cast.playing ? cast.pause() : cast.play()) : toggle}
            style={transport}
          >
            <Text style={{ color: hidden ? tokens.label3 : tokens.label, fontSize: 20 }}>{transportPlaying ? "❚❚" : "▶"}</Text>
          </Pressable>
          <Pressable
            testID="mini-player-next"
            accessibilityRole="button"
            accessibilityLabel="Next track"
            accessibilityState={{ disabled: hidden }}
            disabled={hidden}
            hitSlop={10}
            onPress={casting ? () => void cast.advance(false) : () => void next()}
            style={transport}
          >
            <Text style={{ color: hidden ? tokens.label3 : tokens.label, fontSize: 18 }}>⏭</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default MiniPlayer;
