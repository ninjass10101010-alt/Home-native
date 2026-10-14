// Home-native/src/weather/useAmbient.tsx
import React, { useEffect } from "react";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
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
