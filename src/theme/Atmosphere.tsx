import React from "react";
import { View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "./ThemeProvider";

export type AtmospherePhase = "dawn" | "day" | "dusk" | "night";

/** Local hour → phase (dawn 5–11, day 11–17, dusk 17–21, night 21–5). */
export function phaseForHour(hour: number): AtmospherePhase {
  if (hour >= 5 && hour < 11) return "dawn";
  if (hour >= 11 && hour < 17) return "day";
  if (hour >= 17 && hour < 21) return "dusk";
  return "night";
}

export function useAtmospherePhase(now: Date = new Date()): AtmospherePhase {
  return phaseForHour(now.getHours());
}

/** Parse "linear-gradient(160deg, rgba(…), rgba(…), rgba(…))" (token value)
 *  into stop colors. Returns null when the token is missing/malformed. */
export function stopsFromToken(css: string | undefined): [string, string, string] | null {
  if (!css) return null;
  const stops = css.match(/rgba?\([^)]*\)/g);
  return stops && stops.length >= 3 ? [stops[0], stops[1], stops[2]] : null;
}

/**
 * Full-bleed time-of-day atmosphere behind everything. Colors come from the
 * tokens (gradient-canvas-<phase> per theme — codegen keeps them in lockstep
 * with Home-ai's globals.css; drift fails tokens:check LOUD). One gradient
 * layer only — the RK3576 perf budget spends blur on surfaces, not backdrops.
 */
export function Atmosphere() {
  const { colors } = useTheme();
  const phase = useAtmospherePhase();
  const stops =
    stopsFromToken(colors[`gradient-canvas-${phase}`]) ??
    stopsFromToken(colors["gradient-canvas-day"]);
  if (!stops) return <View style={StyleSheet.absoluteFill} />;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} testID="atmosphere">
      <LinearGradient
        colors={stops}
        locations={[0, 0.55, 1]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

export default Atmosphere;
