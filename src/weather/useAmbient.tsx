// Home-native/src/weather/useAmbient.tsx
import React, { useEffect } from "react";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "../theme/ThemeProvider";
import { perfTier, type PerfTier } from "../theme/perf";

/** The ambient gate (spec §5): motion runs ONLY at full tier with no
 *  reduced-motion preference. Pure + test-pinned. */
export function ambientAllowed(reduceMotion: boolean, tier: PerfTier): boolean {
  return !reduceMotion && tier !== "reduced";
}

/** Gentle ±3dp vertical bob (MOTION.glide cadence). Pauses under
 *  reduced-motion or the reduced perf tier — a wall panel is always-on. */
export function AmbientBob({ children }: { children: React.ReactNode }) {
  const { reduceMotion } = useTheme();
  const reduced = !ambientAllowed(reduceMotion, perfTier());
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    t.value = withRepeat(withTiming(1, { duration: 6000 }), -1, true);
    return () => cancelAnimation(t);
  }, [reduced, t]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: (t.value - 0.5) * 6 }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

/**
 * Horizontal cloud drift (Not Boring Monsters video 00:14–00:23, 00:31–00:32):
 * foreground cloud clusters and floating cloud bubbles drift in gentle
 * counter-phase across the sun/moon sphere.
 */
export function AmbientCloudDrift({
  children,
  reverse = false,
  distance = 5,
  duration = 4800,
}: {
  children: React.ReactNode;
  reverse?: boolean;
  distance?: number;
  duration?: number;
}) {
  const { reduceMotion } = useTheme();
  const reduced = !ambientAllowed(reduceMotion, perfTier());
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    t.value = withRepeat(
      withTiming(1, { duration, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    return () => cancelAnimation(t);
  }, [duration, reduced, t]);
  const style = useAnimatedStyle(() => {
    const dir = reverse ? -1 : 1;
    return {
      transform: [
        { translateX: (t.value - 0.5) * 2 * distance * dir },
        { translateY: (t.value - 0.5) * 2 * (reverse ? -1.5 : 1) },
      ],
    };
  });
  return <Animated.View style={style}>{children}</Animated.View>;
}

/**
 * Periodic monster eye blink + pupil glance (Not Boring Monsters video 00:15–00:19, 00:28):
 * every ~3.8s the monster's eye performs a crisp 160ms squash blink and subtle glance.
 */
export function AmbientEyePulse({
  children,
  delayMs = 0,
}: {
  children: React.ReactNode;
  delayMs?: number;
}) {
  const { reduceMotion } = useTheme();
  const reduced = !ambientAllowed(reduceMotion, perfTier());
  const scaleY = useSharedValue(1);
  const shiftX = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    const blinkLoop = withRepeat(
      withSequence(
        withTiming(1, { duration: 3200 }),
        withTiming(0.12, { duration: 90, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 110, easing: Easing.in(Easing.quad) }),
        withTiming(1, { duration: 400 })
      ),
      -1,
      false
    );
    const lookLoop = withRepeat(
      withSequence(
        withTiming(0, { duration: 1400 }),
        withTiming(1.8, { duration: 500, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.8, { duration: 900 }),
        withTiming(-1.8, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        withTiming(-1.8, { duration: 900 }),
        withTiming(0, { duration: 500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
    scaleY.value = delayMs > 0 ? withDelay(delayMs, blinkLoop) : blinkLoop;
    shiftX.value = delayMs > 0 ? withDelay(delayMs, lookLoop) : lookLoop;
    return () => {
      cancelAnimation(scaleY);
      cancelAnimation(shiftX);
    };
  }, [delayMs, reduced, scaleY, shiftX]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: shiftX.value }, { scaleY: scaleY.value }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

/**
 * Bouncy spring-like pop transition when the displayed temperature or scrubbed
 * hour changes (Not Boring Monsters video 00:17–00:21).
 */
export function AmbientDigitPop({
  triggerKey,
  children,
}: {
  triggerKey: string | number;
  children: React.ReactNode;
}) {
  const { reduceMotion } = useTheme();
  const reduced = !ambientAllowed(reduceMotion, perfTier());
  const scale = useSharedValue(1);

  useEffect(() => {
    if (reduced) return;
    scale.value = withSequence(
      withTiming(0.9, { duration: 70, easing: Easing.out(Easing.quad) }),
      withTiming(1.04, { duration: 140, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 110, easing: Easing.inOut(Easing.ease) })
    );
    return () => cancelAnimation(scale);
  }, [reduced, scale, triggerKey]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

/**
 * Smooth oscillating weathervane sway for the 3D Air Anemometer monster
 * (Not Boring Monsters video 00:33–00:36).
 */
export function AmbientVaneSway({ children }: { children: React.ReactNode }) {
  const { reduceMotion } = useTheme();
  const reduced = !ambientAllowed(reduceMotion, perfTier());
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    t.value = withRepeat(
      withTiming(1, { duration: 3400, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    return () => cancelAnimation(t);
  }, [reduced, t]);
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: (t.value - 0.5) * 6 },
      { rotate: `${(t.value - 0.5) * 5}deg` },
    ],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}
