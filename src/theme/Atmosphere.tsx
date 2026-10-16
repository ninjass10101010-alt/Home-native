import React from "react";
import { View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useTheme } from "./ThemeProvider";
import { mix } from "./mix";
import { MOTION } from "./tokens";

export type AtmospherePhase = "dawn" | "day" | "dusk" | "night";

/** Local hour → phase (dawn 5–11, day 11–17, dusk 17–21, night 21–5). */
export function phaseForHour(hour: number): AtmospherePhase {
  if (hour >= 5 && hour < 11) return "dawn";
  if (hour >= 11 && hour < 17) return "day";
  if (hour >= 17 && hour < 21) return "dusk";
  return "night";
}

/** Milliseconds until the next phase boundary (boundaries at 5/11/17/21). */
export function msToNextBoundary(now: Date = new Date()): number {
  const next = new Date(now);
  for (const h of [5, 11, 17, 21]) {
    const cand = new Date(now);
    cand.setHours(h, 0, 0, 0);
    if (cand.getTime() > now.getTime()) {
      next.setTime(cand.getTime());
      return next.getTime() - now.getTime();
    }
  }
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(5, 0, 0, 0);
  return tomorrow.getTime() - now.getTime();
}

export function useAtmospherePhase(): AtmospherePhase {
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const timer = setTimeout(() => setNow(new Date()), msToNextBoundary(now));
    return () => clearTimeout(timer);
  }, [now]);
  return phaseForHour(now.getHours());
}

/** Parse "linear-gradient(160deg, rgba(…), rgba(…), rgba(…))" (token value)
 *  into stop colors. Returns null when the token is missing/malformed. */
export function stopsFromToken(css: string | undefined): [string, string, string] | null {
  if (!css) return null;
  const stops = css.match(/rgba?\([^)]*\)/g);
  return stops && stops.length >= 3 ? [stops[0], stops[1], stops[2]] : null;
}

function GradientLayer({ stops }: { stops: [string, string, string] | null }) {
  if (!stops) return null;
  return (
    <LinearGradient
      colors={stops}
      locations={[0, 0.55, 1]}
      start={{ x: 0.15, y: 0 }}
      end={{ x: 0.85, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
  );
}

/**
 * Full-bleed time-of-day atmosphere. Colors come from tokens; the phase ticks
 * at real boundaries (a 24/7 wall panel must not show a stale sky) and
 * crossfades over 600ms (instant under reduced motion). One gradient layer per
 * phase — the perf budget spends blur on surfaces, not backdrops.
 */
function resolveCanvasToken(
  theme: "light" | "dark",
  phase: AtmospherePhase,
  colors: Record<string, string>
): string | undefined {
  if (theme === "dark") {
    return colors["gradient-canvas-night"] ?? colors["gradient-canvas-day"];
  }
  if (phase === "night") {
    return colors["gradient-canvas-day"];
  }
  return colors[`gradient-canvas-${phase}`] ?? colors["gradient-canvas-day"];
}

export function Atmosphere() {
  const { theme, colors, accentColor, reduceMotion } = useTheme();
  const phase = useAtmospherePhase();
  const lastPhase = React.useRef<AtmospherePhase>(phase);
  const [prevPhase, setPrevPhase] = React.useState<AtmospherePhase | null>(null);
  const fade = useSharedValue(1);

  React.useEffect(() => {
    if (lastPhase.current === phase) return;
    const outgoing = lastPhase.current;
    lastPhase.current = phase;
    const dur = reduceMotion ? 0 : MOTION.glide;
    setPrevPhase(dur === 0 ? null : outgoing);
    if (dur === 0) {
      fade.value = 1;
      return;
    }
    fade.value = 0;
    fade.value = withTiming(1, { duration: dur });
    const t = setTimeout(() => setPrevPhase(null), dur + 50);
    return () => clearTimeout(t);
  }, [phase, reduceMotion, fade]);

  const currentStops =
    stopsFromToken(resolveCanvasToken(theme, phase, colors)) ??
    stopsFromToken(colors["gradient-canvas-day"]);
  const prevStops = prevPhase
    ? stopsFromToken(resolveCanvasToken(theme, prevPhase, colors))
    : null;
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  const bloomColors: [string, string, ...string[]] =
    theme === "dark"
      ? [
          mix(accentColor, "transparent", 18),
          mix(colors["color-accent-violet"] ?? accentColor, "transparent", 8),
          "transparent",
        ]
      : [mix(accentColor, "transparent", 12), "transparent"];

  // Secondary violet bloom, top-right — .warm-glass-canvas's second radial
  // (ellipse 60% 40% at 85% 0%, violet 14% dark / 10% light → transparent 50%).
  const violetBloomColors: [string, string] = [
    mix(colors["color-accent-violet"] ?? accentColor, "transparent", theme === "dark" ? 14 : 10),
    "transparent",
  ];

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} testID="atmosphere">
      {prevStops ? <GradientLayer stops={prevStops} /> : null}
      <Animated.View style={[StyleSheet.absoluteFill, fadeStyle]}>
        <GradientLayer stops={currentStops} />
      </Animated.View>
      <LinearGradient
        colors={bloomColors}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.75, y: 0.55 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={violetBloomColors}
        start={{ x: 0.85, y: 0 }}
        end={{ x: 0.25, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

export default Atmosphere;
