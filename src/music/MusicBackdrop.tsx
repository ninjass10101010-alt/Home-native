import React from "react";
import { Image, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "../theme/ThemeProvider";
import { musicTokensFor } from "../theme/music-tokens";
import { kenBurnsScale, kenBurnsTranslate, legibilityTint } from "./backdrop";

/**
 * THE LIVING ARTWORK BACKDROP — the music surface's wallpaper.
 *
 * Three layers, in order:
 *
 *   1. THE ARTWORK, blurred on-device (the engine module's `artworkBlurred`)
 *      and scaled/drifting by the Ken-Burns maths. The drift is a pure
 *      function of the PLAYBACK POSITION, so it stops when the music stops —
 *      the wall never animates while it is idle.
 *   2. THE TINT — the artwork's own colour, banded and veiled so the title
 *      clears 4.5:1 over it (the maths lives in `src/music/backdrop.ts` and
 *      is machine-checked there).
 *   3. THE GRAIN — a STATIC, faint overlay. It never animates: the panel
 *      runs all day.
 *
 * THE COMPONENT RENDERS NOTHING WITHOUT AN ARTWORK: no track, no cover, no
 * wallpaper — and no cost either (the layers are not even mounted).
 *
 * THE FALLBACK IS THE UNBLURRED ART: when the native blur fails (or is too
 * slow), the caller passes the cover's own URL instead of the blurred file,
 * and the tint scrim still holds the title. The blur is an enhancement, never
 * a blocker.
 */
export interface MusicBackdropProps {
  /** The artwork to paint — the blurred `file://` URI, or the cover itself. */
  uri: string | null;
  /**
   * The artwork's own dominant colour.
   *
   * The tint's source: the backdrop is the RECORD's colour, not the app's.
   */
  dominantHex: string | null;
  theme: "light" | "dark";
  boost: boolean;
  /**
   * The playback position, in milliseconds — the drift's clock.
   *
   * A position that does not advance is a wall at rest: the drift holds
   * still, and nothing on the screen moves.
   */
  positionMs: number;
}

/**
 * How long the drift takes to reach the position it was given.
 *
 * The position arrives a few times a second; the drift CHASES it, so the
 * artwork glides instead of stepping (and the scale's wrap — the cycle's
 * reset — arrives as a soft settle instead of a snap).
 */
const DRIFT_TICK_MS = 400;

export function MusicBackdrop({
  uri,
  dominantHex,
  theme,
  boost,
  positionMs,
}: MusicBackdropProps) {
  // The app's own reduced-motion authority (the Android a11y setting): a
  // reduced-motion wall gets a still backdrop — no drift, no movement.
  const { reduceMotion } = useTheme();
  const tokens = React.useMemo(() => musicTokensFor(theme, boost), [theme, boost]);

  /**
   * The tint — the artwork's own colour, veiled so the label holds.
   *
   * A track with no colour (no cover, a failed extraction) gets the neutral
   * veil: a readable ground, never a hue that pretends to be the artwork's.
   */
  const tint = React.useMemo(
    () => legibilityTint(dominantHex ?? "", theme),
    [dominantHex, theme]
  );

  // The drift's clock. It is the position, chased (see DRIFT_TICK_MS).
  const phase = useSharedValue(positionMs);
  // The app's own reduced-motion authority, as a shared value: a reduced-motion
  // wall gets a STILL backdrop — the artwork holds its own framing.
  const still = useSharedValue(reduceMotion ? 1 : 0);

  React.useEffect(() => {
    still.value = reduceMotion ? 1 : 0;
  }, [reduceMotion, still]);

  React.useEffect(() => {
    if (reduceMotion) {
      // No motion at all: the backdrop holds the artwork's own framing.
      phase.value = positionMs;
      return;
    }
    phase.value = withTiming(positionMs, {
      duration: DRIFT_TICK_MS,
      easing: Easing.linear,
    });
  }, [positionMs, reduceMotion, phase]);

  // The artwork's own size, so the drift is a fraction of the artwork (and
  // not of the screen).
  const [size, setSize] = React.useState({ width: 0, height: 0 });

  const drift = useAnimatedStyle(() => {
    "worklet";
    if (still.value > 0.5) {
      // REDUCED MOTION: no drift, no scale, no movement.
      return { transform: [{ scale: 1 }, { translateX: 0 }, { translateY: 0 }] };
    }
    const at = phase.value;
    const move = kenBurnsTranslate(at);
    return {
      transform: [
        { scale: kenBurnsScale(at) },
        { translateX: move.x * size.width },
        { translateY: move.y * size.height },
      ],
    };
  });

  if (!uri) return null;

  return (
    <View
      testID="music-backdrop"
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setSize((previous) =>
          previous.width === width && previous.height === height
            ? previous
            : { width, height }
        );
      }}
    >
      {/* 1. The artwork, blurred, drifting. */}
      <Animated.View
        testID="music-backdrop-art"
        style={[StyleSheet.absoluteFill, drift]}
      >
        <Image
          source={{ uri }}
          resizeMode="cover"
          style={StyleSheet.absoluteFill}
          accessibilityIgnoresInvertColors
        />
      </Animated.View>

      {/* 2. The tint: the artwork's own colour, holding the label. */}
      <View
        testID="music-backdrop-tint"
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: tint }]}
      />

      {/* 3. The grain: STATIC. A still overlay, never an animation. */}
      <View
        testID="music-backdrop-grain"
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: tokens.grain }]}
      />
    </View>
  );
}

export default MusicBackdrop;
