import React from "react";
import { Platform, Pressable, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useTheme } from "../theme/ThemeProvider";
import { hapticSelect, hapticTap } from "../theme/haptics";
import { mix } from "../theme/mix";
import { musicTokensFor } from "../theme/music-tokens";
import { PRESS_IN_MS, SPRING } from "../theme/tokens";
import { MusicIcon } from "./MusicIcons";
import type { RepeatMode } from "./types";

/**
 * THE TRANSPORT PILL — the Now Playing transport as ONE Warm-Glass cluster.
 *
 * Shuffle · Previous · Play/Pause · Next · Repeat in a single opaque pill so
 * controls stay crisp over the living artwork backdrop, with tactile spring
 * press response and zero idle animation.
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

function SpringDisc({
  reduceMotion,
  children,
  scaleDown = 0.9,
  testID,
  accessibilityLabel,
  accessibilityState,
  onPress,
  onHaptic,
  style,
}: {
  reduceMotion: boolean;
  children: React.ReactNode;
  scaleDown?: number;
  testID: string;
  accessibilityLabel: string;
  accessibilityState?: { selected?: boolean };
  onPress: () => void;
  onHaptic: () => void;
  style: {
    width: number;
    height: number;
    borderRadius: number;
    alignItems: "center";
    justifyContent: "center";
    backgroundColor: string;
    borderWidth?: number;
    borderColor?: string;
  };
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animStyle}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={accessibilityState}
        onPressIn={() => {
          if (!reduceMotion) {
            // eslint-disable-next-line react-hooks/immutability -- Reanimated shared-value write
            scale.value = withTiming(scaleDown, { duration: PRESS_IN_MS });
          }
        }}
        onPressOut={() => {
          // eslint-disable-next-line react-hooks/immutability -- Reanimated shared-value write
          scale.value = reduceMotion ? 1 : withSpring(1, SPRING.press);
        }}
        onPress={() => {
          onHaptic();
          onPress();
        }}
        style={style}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

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
  const { theme, boost, reduceMotion } = useTheme();
  const tokens = React.useMemo(() => musicTokensFor(theme, boost), [theme, boost]);

  const disc = (size: number, active: boolean) => ({
    width: size,
    height: size,
    borderRadius: size / 2,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: active ? mix(tokens.accent, "transparent", 20) : "transparent",
    ...(active ? { borderWidth: 1, borderColor: tokens.accent } : {}),
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
        gap: 6,
        paddingVertical: 12,
        paddingHorizontal: 18,
        borderRadius: 999,
        backgroundColor: tokens.glassStrong,
        borderWidth: 1,
        borderColor: tokens.glassRim,
        shadowColor: tokens.shadow,
        shadowOpacity: 1,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
        boxShadow: Platform.OS === "android" ? `0 8 20 ${tokens.shadow}` : undefined,
      }}
    >
      <SpringDisc
        testID="np-shuffle"
        accessibilityLabel={`Shuffle ${shuffle ? "on" : "off"}`}
        accessibilityState={{ selected: shuffle }}
        reduceMotion={reduceMotion}
        onHaptic={hapticSelect}
        onPress={onToggleShuffle}
        style={disc(MODE_SIZE, shuffle)}
      >
        <MusicIcon name="shuffle" size={22} color={tokens.label} />
      </SpringDisc>

      <SpringDisc
        testID="np-prev"
        accessibilityLabel="Previous track"
        reduceMotion={reduceMotion}
        onHaptic={hapticTap}
        onPress={onPrevious}
        style={disc(SKIP_SIZE, false)}
      >
        <MusicIcon name="prev" size={26} color={tokens.label} filled />
      </SpringDisc>

      <SpringDisc
        testID="np-play"
        accessibilityLabel={playing ? "Pause" : "Play"}
        reduceMotion={reduceMotion}
        scaleDown={0.92}
        onHaptic={hapticTap}
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
        <MusicIcon
          name={playing ? "pause" : "play"}
          size={34}
          color={tokens.onAccent}
          filled
        />
      </SpringDisc>

      <SpringDisc
        testID="np-next"
        accessibilityLabel="Next track"
        reduceMotion={reduceMotion}
        onHaptic={hapticTap}
        onPress={onNext}
        style={disc(SKIP_SIZE, false)}
      >
        <MusicIcon name="next" size={26} color={tokens.label} filled />
      </SpringDisc>

      <SpringDisc
        testID="np-repeat"
        accessibilityLabel={`Repeat ${repeat}`}
        accessibilityState={{ selected: repeat !== "off" }}
        reduceMotion={reduceMotion}
        onHaptic={hapticSelect}
        onPress={onCycleRepeat}
        style={disc(MODE_SIZE, repeat !== "off")}
      >
        <MusicIcon
          name={repeat === "one" ? "repeatOne" : "repeat"}
          size={22}
          color={tokens.label}
        />
      </SpringDisc>
    </View>
  );
}

export default TransportPill;
