import React from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { mix } from "../theme/mix";
import { musicTokensFor } from "../theme/music-tokens";
import type { RepeatMode } from "./types";

/**
 * THE TRANSPORT PILL — the Now Playing transport as ONE glass cluster.
 *
 * The Yuma-inspired grammar: shuffle · previous · a BIG circular play/pause ·
 * next · repeat, in a single pill, so the transport reads as one object
 * instead of three loose rows scattered down the screen.
 *
 * FOUR RULES:
 *
 *   1. THE ACTIONS ARE THE OLD ONES. This is a RESTYLE, not a rewrite: every
 *      control fires the handler it always fired, under the testID it always
 *      had (`np-shuffle`, `np-prev`, `np-play`, `np-next`, `np-repeat`). The
 *      copy, the labels and the sizes are the contract.
 *   2. THE PILL IS OPAQUE. It sits over a backdrop whose colour is UNKNOWN
 *      (it is a cover), so only an opaque fill can guarantee the glyphs'
 *      contrast over it — which is why the token family has `glassStrong` for
 *      exactly this surface. The translucency lives in `glassFill`, for the
 *      surfaces over a KNOWN ground.
 *   3. THE STATE IS NEVER COLOUR-ONLY. Shuffle and repeat read the FULL
 *      label token and signal their state with an accent wash AND an
 *      `accessibilityState` — the accent is a LARGE-text colour (3.65:1 on
 *      the light ground), so it may never carry a 20sp glyph by itself.
 *   4. NOTHING HERE ANIMATES. A wall at rest must not move.
 */

export interface TransportPillProps {
  /** Is the track playing (the play disc's glyph follows it)? */
  playing: boolean;
  /** Is shuffle on? */
  shuffle: boolean;
  /** The repeat mode ("off" · "all" · "one"). */
  repeat: RepeatMode;
  onToggle: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
}

/** The play disc's edge (dp) — the big one in the middle of the pill. */
const PLAY_SIZE = 88;
/** The skip discs' edge (dp). */
const SKIP_SIZE = 72;
/** The shuffle and repeat discs' edge (dp) — the 64dp wall floor. */
const MODE_SIZE = 64;

export function TransportPill({
  playing,
  shuffle,
  repeat,
  onToggle,
  onNext,
  onPrevious,
  onToggleShuffle,
  onCycleRepeat,
}: TransportPillProps) {
  const { theme, boost } = useTheme();
  const tokens = React.useMemo(() => musicTokensFor(theme, boost), [theme, boost]);

  /**
   * A disc inside the pill.
   *
   * The pill is already the surface, so a disc carries NO fill of its own —
   * except when it is ACTIVE, and then it wears a faint accent wash (the
   * state's only colour signal, beside the accessibility state).
   */
  const disc = (size: number, active: boolean) => ({
    width: size,
    height: size,
    borderRadius: size / 2,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: active ? mix(tokens.accent, "transparent", 18) : "transparent",
  });

  return (
    <View
      testID="np-transport-pill"
      accessibilityRole="toolbar"
      accessibilityLabel="Playback controls"
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 999,
        backgroundColor: tokens.glassStrong,
        borderWidth: 1,
        borderColor: tokens.glassRim,
        shadowColor: tokens.shadow,
        shadowOpacity: 1,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
        elevation: 6,
      }}
    >
      <Pressable
        testID="np-shuffle"
        accessibilityRole="button"
        accessibilityLabel={`Shuffle ${shuffle ? "on" : "off"}`}
        accessibilityState={{ selected: shuffle }}
        onPress={onToggleShuffle}
        style={disc(MODE_SIZE, shuffle)}
      >
        <Text style={{ color: tokens.label, fontSize: 20 }}>🔀</Text>
      </Pressable>

      <Pressable
        testID="np-prev"
        accessibilityRole="button"
        accessibilityLabel="Previous track"
        onPress={onPrevious}
        style={disc(SKIP_SIZE, false)}
      >
        <Text style={{ color: tokens.label, fontSize: 26 }}>⏮</Text>
      </Pressable>

      {/*
        THE PLAY DISC — the big one, in the middle, on the accent.
      */}
      <Pressable
        testID="np-play"
        accessibilityRole="button"
        accessibilityLabel={playing ? "Pause" : "Play"}
        onPress={onToggle}
        style={{
          width: PLAY_SIZE,
          height: PLAY_SIZE,
          borderRadius: PLAY_SIZE / 2,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: tokens.accent,
        }}
      >
        <Text style={{ color: tokens.onAccent, fontSize: 32 }}>{playing ? "❚❚" : "▶"}</Text>
      </Pressable>

      <Pressable
        testID="np-next"
        accessibilityRole="button"
        accessibilityLabel="Next track"
        onPress={onNext}
        style={disc(SKIP_SIZE, false)}
      >
        <Text style={{ color: tokens.label, fontSize: 26 }}>⏭</Text>
      </Pressable>

      <Pressable
        testID="np-repeat"
        accessibilityRole="button"
        accessibilityLabel={`Repeat ${repeat}`}
        accessibilityState={{ selected: repeat !== "off" }}
        onPress={onCycleRepeat}
        style={disc(MODE_SIZE, repeat !== "off")}
      >
        <Text style={{ color: tokens.label, fontSize: 20 }}>
          {repeat === "one" ? "🔂" : "🔁"}
        </Text>
      </Pressable>
    </View>
  );
}

export default TransportPill;
