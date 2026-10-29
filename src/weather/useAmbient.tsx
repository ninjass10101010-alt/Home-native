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
 * Periodic monster eye blink + 2D pupil glance (Not Boring Monsters video 00:15–00:19, 00:28):
 * every ~3.8s the monster's eye performs a crisp 160ms squash blink and glances around in 2D.
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
        withTiming(0.12, { duration: 80, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 90, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 800 })
      ),
      -1,
      false
    );
    const lookXLoop = withRepeat(
      withSequence(
        withTiming(0, { duration: 2400 }),
        withTiming(2, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        withTiming(2, { duration: 1200 }),
        withTiming(-2, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        withTiming(-2, { duration: 1200 }),
        withTiming(0, { duration: 600, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
    scaleY.value = delayMs > 0 ? withDelay(delayMs, blinkLoop) : blinkLoop;
    shiftX.value = delayMs > 0 ? withDelay(delayMs, lookXLoop) : lookXLoop;
    return () => {
      cancelAnimation(scaleY);
      cancelAnimation(shiftX);
    };
  }, [delayMs, reduced, scaleY, shiftX]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: shiftX.value },
      { scaleY: scaleY.value },
    ],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

/**
 * Staggered per-digit organic monster idle motion: gentle breathing squish-and-stretch,
 * floating bob, and playful rock so multi-digit temperatures feel like living characters.
 */
export function AmbientMonsterIdle({
  children,
  index = 0,
}: {
  children: React.ReactNode;
  index?: number;
}) {
  const { reduceMotion } = useTheme();
  const reduced = !ambientAllowed(reduceMotion, perfTier());
  const breath = useSharedValue(0);
  const tilt = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    const delay = (index % 4) * 420;
    const breathLoop = withRepeat(
      withSequence(
        withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2200, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
    const tiltLoop = withRepeat(
      withSequence(
        withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
        withTiming(-1, { duration: 2800, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
    breath.value = delay > 0 ? withDelay(delay, breathLoop) : breathLoop;
    tilt.value = delay > 0 ? withDelay(delay, tiltLoop) : tiltLoop;
    return () => {
      cancelAnimation(breath);
      cancelAnimation(tilt);
    };
  }, [breath, index, reduced, tilt]);

  const dir = index % 2 === 0 ? 1 : -1;
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: (0.5 - breath.value) * 4.5 },
      { scaleX: 1 + (breath.value - 0.5) * 0.036 },
      { scaleY: 1 - (breath.value - 0.5) * 0.036 },
      { rotate: `${tilt.value * 1.6 * dir}deg` },
    ],
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
  const scaleX = useSharedValue(1);
  const scaleY = useSharedValue(1);

  useEffect(() => {
    if (reduced) return;
    scaleX.value = withSequence(
      withTiming(1.08, { duration: 65, easing: Easing.out(Easing.quad) }),
      withTiming(0.95, { duration: 120, easing: Easing.out(Easing.quad) }),
      withTiming(1.03, { duration: 110, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 100, easing: Easing.inOut(Easing.ease) })
    );
    scaleY.value = withSequence(
      withTiming(0.88, { duration: 65, easing: Easing.out(Easing.quad) }),
      withTiming(1.07, { duration: 120, easing: Easing.out(Easing.quad) }),
      withTiming(0.98, { duration: 110, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 100, easing: Easing.inOut(Easing.ease) })
    );
    return () => {
      cancelAnimation(scaleX);
      cancelAnimation(scaleY);
    };
  }, [reduced, scaleX, scaleY, triggerKey]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scaleX: scaleX.value }, { scaleY: scaleY.value }],
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
