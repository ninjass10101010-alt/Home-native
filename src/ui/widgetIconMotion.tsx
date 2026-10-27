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
 * The web animates each disc with its own keyframe set: a slow spin for the
 * briefing/schedule dials, a twinkle for suggestions, a pop for events and
 * tasks, a breathe for security, a glow for lights, a steam for meals, a
 * settle for the ledger, a grow for the week, a mercury rise for climate, and
 * a sweep for the leaderboard. This table is the same list, expressed as
 * animation specs the Reanimated runtime can drive.
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
  /** One full cycle, in ms (the web's animation duration). */
  duration: number;
  /** The web's animation-delay (seconds → ms). */
  delay?: number;
}

export const WIDGET_ICON_MOTION: Partial<Record<HomeWidgetIconVariant, WidgetIconMotionSpec>> = {
  briefing: { kind: "spin", duration: 26_000 },
  schedule: { kind: "spin", duration: 14_000 },
  suggestions: { kind: "twinkle", duration: 3_600 },
  events: { kind: "pop", duration: 3_400 },
  tasks: { kind: "pop", duration: 4_200, delay: 600 },
  security: { kind: "breathe", duration: 4_600 },
  lights: { kind: "glow", duration: 3_800 },
  meal: { kind: "steam", duration: 2_800 },
  ledger: { kind: "settle", duration: 3_200 },
  week: { kind: "grow", duration: 3_600 },
  climate: { kind: "mercury", duration: 5_200 },
  leaderboard: { kind: "sweep", duration: 5_400 },
  ask: { kind: "type", duration: 1_500 },
  music: { kind: "pop", duration: 3_600 },
};

/**
 * Drives one widget-icon disc through its web-parity motion. The artwork is
 * untouched — the motion rides a wrapper so the SVG keeps its own paint.
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
    const { kind, duration, delay } = spec;
    const half = Math.max(1, Math.round(duration / 2));
    const ease = { easing: Easing.inOut(Easing.ease) };

    let loop: ReturnType<typeof withRepeat>;
    if (kind === "spin") {
      loop = withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false);
    } else {
      loop = withRepeat(
        withSequence(withTiming(0, { duration: half, ...ease }), withTiming(1, { duration: half, ...ease })),
        -1,
        false
      );
    }
    t.value = delay ? withDelay(delay, loop) : loop;
    return () => cancelAnimation(t);
  }, [spec, reduceMotion, t]);

  const animatedStyle = useAnimatedStyle(() => {
    if (!spec) return {};
    const p = t.value;
    switch (spec.kind) {
      case "spin":
        return { transform: [{ rotate: `${p * 360}deg` }] };
      case "twinkle":
        // scale 0.82→1.08, rotate -6°→4°, opacity 0.72→1 (the web's range)
        return {
          transform: [{ scale: 0.82 + 0.26 * p }, { rotate: `${-6 + 10 * p}deg` }],
          opacity: 0.72 + 0.28 * p,
        };
      case "pop":
        return { transform: [{ scale: 1 + 0.14 * Math.sin(p * Math.PI) }] };
      case "breathe":
        return { transform: [{ scale: 1 + 0.05 * p }] };
      case "glow":
        return { transform: [{ scale: 0.9 + 0.2 * p }], opacity: 0.6 + 0.4 * p };
      case "steam":
        // The web animates only the steam strokes (`.hwi-steam` rides the
        // icon's opacity); fading the WHOLE disc would drop the painted
        // range under the paint audit's floor, so the motion here is the
        // lift only.
        return { transform: [{ translateY: 1 - 4 * p }] };
      case "grow":
        return { transform: [{ scaleY: 0.72 + 0.28 * p }] };
      case "mercury":
        return { transform: [{ scaleY: 0.58 + 0.42 * p }] };
      case "settle":
        return { transform: [{ translateY: -2.5 + 4 * p }] };
      case "sweep":
        return {
          transform: [{ translateX: -16 + 36 * p }],
          opacity: p < 0.12 ? p / 0.12 : p > 0.62 ? Math.max(0, (1 - p) / 0.38) : 0.85,
        };
      default:
        return {};
    }
  });

  if (!spec) return <View style={style}>{children}</View>;
  return (
    <Animated.View style={[style, animatedStyle]}>
      {children}
    </Animated.View>
  );
}
