import React from "react";
import { View } from "react-native";
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
import type { HomeWidgetIconVariant } from "../theme/materials";

/**
 * Per-variant widget-icon motion — the native port of the web's
 * `hwi-m-*` CSS keyframes (Home-ai src/app/globals.css:4222-4293).
 *
 * Each widget icon disc is given a calm, tactile floating glide (a subtle ±1.2dp
 * vertical breath and micro-scale response) that respects the warm-glass v2 design,
 * while detailed micro-animations live inside each icon's artwork (steam wisps rising,
 * sun rays rotating, music notes dancing, clock hands sweeping).
 */

export type WidgetIconMotionKind =
  | "spin"
  | "twinkle"
  | "pop"
  | "breathe"
  | "glow"
  | "steam"
  | "grow"
  | "mercury"
  | "settle"
  | "sweep"
  | "type";

export interface WidgetIconMotionSpec {
  kind: WidgetIconMotionKind;
  /** One full cycle, in ms. */
  duration: number;
  /** Delay in ms. */
  delay?: number;
}

export const WIDGET_ICON_MOTION: Partial<Record<HomeWidgetIconVariant, WidgetIconMotionSpec>> = {
  briefing: { kind: "spin", duration: 6_000 },
  schedule: { kind: "spin", duration: 5_200 },
  suggestions: { kind: "twinkle", duration: 4_400 },
  events: { kind: "pop", duration: 4_600 },
  tasks: { kind: "pop", duration: 4_800, delay: 400 },
  security: { kind: "breathe", duration: 5_000 },
  lights: { kind: "glow", duration: 4_200 },
  meal: { kind: "steam", duration: 4_400 },
  ledger: { kind: "settle", duration: 4_800 },
  week: { kind: "grow", duration: 5_200 },
  climate: { kind: "mercury", duration: 5_400 },
  leaderboard: { kind: "sweep", duration: 5_400 },
  ask: { kind: "type", duration: 4_200 },
  music: { kind: "pop", duration: 4_200 },
};

/**
 * Drives one widget-icon disc through its warm-glass ambient float.
 * The artwork stays crisp and stable, gently breathing with tactile presence.
 */
export function WidgetIconMotion({
  variant,
  children,
  style,
}: {
  variant: HomeWidgetIconVariant;
  children: React.ReactNode;
  style?: any;
}) {
  const { reduceMotion } = useTheme();
  const spec = WIDGET_ICON_MOTION[variant];
  const t = useSharedValue(0);

  React.useEffect(() => {
    if (!spec || reduceMotion) {
      cancelAnimation(t);
      t.value = 0;
      return;
    }
    const duration = spec.duration || 4800;
    const delay = spec.delay || 0;
    const half = Math.max(1, Math.round(duration / 2));
    const ease = { easing: Easing.inOut(Easing.sin) };

    const loop = withRepeat(
      withSequence(
        withTiming(1, { duration: half, ...ease }),
        withTiming(0, { duration: half, ...ease })
      ),
      -1,
      true
    );
    t.value = delay ? withDelay(delay, loop) : loop;
    return () => cancelAnimation(t);
  }, [spec, reduceMotion, t]);

  const animatedStyle = useAnimatedStyle(() => {
    if (!spec) return {};
    const p = t.value;
    // Calm, tactile floating glide for the icon container:
    return {
      transform: [
        { translateY: (0.5 - p) * 2.2 },
        { scale: 1 + (p - 0.5) * 0.02 },
      ],
    };
  });

  if (!spec) return <View style={style}>{children}</View>;
  return (
    <Animated.View style={[style, animatedStyle]}>
      {children}
    </Animated.View>
  );
}
