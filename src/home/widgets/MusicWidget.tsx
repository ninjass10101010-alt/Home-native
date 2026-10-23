import React from "react";
import { Image, Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useAuth } from "../../state/AuthProvider";
import { useTheme } from "../../theme/ThemeProvider";
import { ACCENTS, TYPOGRAPHY } from "../../theme/tokens";
import { mix } from "../../theme/mix";
import { musicTokensFor } from "../../theme/music-tokens";
import { WidgetFrame, HEADER_BAND_H } from "./WidgetFrame";
import { usePlayback } from "../../music/playback";
import { useCast } from "../../music/CastProvider";
import { isContentHidden } from "../../music/explicit";

/**
 * The artwork's edge in the card (dp) — the artwork LEADS the interior.
 *
 * The card's geometry is the wall's contract (a fixed 3×4 board), so this
 * number only sizes the tile INSIDE the card; the cell, the header band and
 * the identity disc never move.
 */
const ART = 64;

/**
 * The badge geometry — the web's identity disc (a 56px glass disc with a
 * 64px artwork that overhangs the card's corner). Mirrors the shared frame's
 * disc so the Music card's badge sits on the same corner and scale as every
 * other wall card.
 */
const DISC_SIZE = 56;
const DISC_ART = 64;
const DISC_OFFSET = -10;

/**
 * The Music card's badge artwork.
 *
 * The 🎵 emoji is a NEAR-BLACK note in both the web's emoji font and Android's
 * Noto Color Emoji, so on the violet badge wash it read as a smudge (the
 * critic: "a near-black note on a violet ring — low contrast inside the
 * badge"). The beamed note U+266B is a TEXT-presentation glyph, so it takes
 * the ink it is painted with: the violet accent-ink token clears 5.1:1 on the
 * dark wash and 5.6:1 on the light one.
 */
const MUSIC_GLYPH = "♫";

function MusicBadge() {
  const { colors, theme, accentColor } = useTheme();
  const tone = ACCENTS[theme]?.violet ?? accentColor;
  const ink = colors["color-accent-ink-violet"] ?? colors["color-text-primary"];
  return (
    <View
      testID="music-icon-disc"
      style={{
        position: "absolute",
        top: DISC_OFFSET,
        left: DISC_OFFSET,
        width: DISC_ART,
        height: DISC_ART,
        alignItems: "center",
        justifyContent: "center",
        zIndex: 3,
      }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {/* The glass disc the artwork sits on (the frame's own badge chrome). */}
      <View
        style={{
          position: "absolute",
          top: (DISC_ART - DISC_SIZE) / 2,
          left: (DISC_ART - DISC_SIZE) / 2,
          width: DISC_SIZE,
          height: DISC_SIZE,
          borderRadius: DISC_SIZE / 2,
          borderWidth: 1,
          borderColor: mix(tone, "transparent", 42),
          overflow: "hidden",
        }}
      >
        <LinearGradient
          colors={[
            mix(tone, colors["color-surface-1"], 34),
            mix(tone, colors["color-surface-1"], 20),
            mix(tone, colors["color-surface-1"], 30),
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.35, y: 1 }}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
      </View>
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: "center",
          justifyContent: "center",
        }}
        pointerEvents="none"
      >
        <Text style={{ fontSize: 34, lineHeight: 40, color: ink }}>{MUSIC_GLYPH}</Text>
      </View>
    </View>
  );
}

export function MusicWidget() {
  const { colors, theme, boost } = useTheme();
  // The music surface's OWN palette (Shiny's Liquid) — the interior reads
  // these tokens; the wall's frame, badge and empty state keep theirs.
  const tokens = React.useMemo(() => musicTokensFor(theme, boost), [theme, boost]);
  const router = useRouter();
  const { member, hydrated } = useAuth();
  const { current, playing, toggle, next, policy } = usePlayback();
  const cast = useCast();
  const guest = hydrated && !member;
  const open = () => router.push("/music" as never);

  /**
   * The wall card is a track surface too: a track the viewer may not see is
   * never painted here (no artwork, no title). The card keeps its place on
   * the 12-cell board and says the neutral truth instead.
   */
  const hidden = !!current && isContentHidden(current, policy);
  const showTrack = !!current && !hidden;
  // While casting, the card is a remote for the receiver: its transport reads
  // the cast's clock and drives the session, never the tablet's local audio
  // (the sink is load-only, so a "toggle" would restart the track).
  const casting = cast.casting;
  const transportPlaying = casting ? cast.playing : playing;

  /**
   * The header band — the frame's default band plus the Music badge. The
   * badge is painted HERE (instead of the frame's emoji disc) so the glyph's
   * ink is the contrast-safe accent ink rather than a near-black emoji.
   *
   * The band mirrors the shared frame's default band exactly (same height,
   * same paddings, same rule) so the Music card's heading sits on its row's
   * title baseline. The badge lives in a padding-free wrapper so its
   * absolute seat (the card's top-left corner) is the frame's own.
   */
  const header = (
    <View>
      <MusicBadge />
      <View
        testID="music-widget-header"
        style={{
          alignItems: "center",
          paddingLeft: 48,
          paddingRight: 48,
          paddingBottom: 8,
          minHeight: HEADER_BAND_H,
          justifyContent: "flex-start",
          borderBottomWidth: 1,
          borderBottomColor: colors["color-border"],
        }}
      >
        <Text
          accessibilityRole="header"
          style={{
            color: colors["color-text-primary"],
            fontSize: 18,
            fontWeight: "700",
            lineHeight: 28,
            textAlign: "center",
          }}
        >
          Music
        </Text>
        <Text
          numberOfLines={1}
          style={{
            color: colors["color-text-secondary"],
            fontSize: TYPOGRAPHY.label.fontSize,
            lineHeight: TYPOGRAPHY.label.lineHeight,
            marginTop: 2,
            textAlign: "center",
          }}
        >
          Ad-free YouTube Music
        </Text>
      </View>
    </View>
  );

  return (
    <WidgetFrame
      id="music"
      icon={MUSIC_GLYPH}
      title="Music"
      header={header}
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
          style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 6 }}
        >
          {/* The shared empty-state contract: the glyph, a BOLD headline and a
              supporting line (the reference's empty cells are emoji + one bold
              line, never a lone lock with a caption). */}
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
            accessibilityLabel={showTrack ? `Open music. ${current?.title} by ${current?.artist}` : "Open music"}
            onPress={open}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64 }}
          >
            {/*
              THE TINT CHIP — the artwork's tile, on the Liquid language: the
              panel fill, the panel rim, the artwork radius. The cover leads;
              a track the viewer may not see paints NO cover (the chip wears
              the glyph instead), exactly like the MiniPlayer's tile.
            */}
            <View
              testID="music-widget-art-chip"
              style={{
                width: ART,
                height: ART,
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
                <Image testID="music-widget-art" source={{ uri: current.artworkUrl }} style={{ width: ART - 2, height: ART - 2 }} resizeMode="cover" />
              ) : (
                <Text style={{ fontSize: 26, lineHeight: 30, color: tokens.label2 }}>
                  {MUSIC_GLYPH}
                </Text>
              )}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text testID="music-widget-title" numberOfLines={1} style={{ color: tokens.label, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
                {showTrack ? current?.title : "Nothing playing"}
              </Text>
              <Text testID="music-widget-artist" numberOfLines={1} style={{ color: tokens.label3, fontSize: TYPOGRAPHY.label.fontSize }}>
                {showTrack ? current?.artist : "Search YouTube Music from the player"}
              </Text>
            </View>
          </Pressable>

          {/*
            THE TRANSPORT — quiet rings on the panel rim (the chrome recedes;
            the accent disc belongs to the Now Playing stage). A track the
            viewer may not see keeps the transport DISABLED, and the rings
            dim so the state is visible, not only announced.
          */}
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
                width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center",
                backgroundColor: mix(tokens.label, "transparent", showTrack ? 8 : 4),
                borderWidth: 1, borderColor: showTrack ? tokens.panelRim : mix(tokens.panelRim, "transparent", 40),
              }}
            >
              <Text style={{ fontSize: 18, color: showTrack ? tokens.label : tokens.label3 }}>{transportPlaying ? "❚❚" : "▶"}</Text>
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
                width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center",
                backgroundColor: mix(tokens.label, "transparent", showTrack ? 8 : 4),
                borderWidth: 1, borderColor: showTrack ? tokens.panelRim : mix(tokens.panelRim, "transparent", 40),
              }}
            >
              <Text style={{ fontSize: 16, color: showTrack ? tokens.label : tokens.label3 }}>▶▶</Text>
            </Pressable>
            <Pressable
              testID="music-widget-open-link"
              accessibilityRole="button"
              accessibilityLabel="Open music"
              onPress={open}
              // The link's own row is 48 tall; the hit slop carries it to the
              // 64dp wall floor without moving the card's layout.
              hitSlop={8}
              style={{ marginLeft: "auto", minHeight: 48, justifyContent: "center" }}
            >
              <Text style={{ color: tokens.label2, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "600" }}>
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
