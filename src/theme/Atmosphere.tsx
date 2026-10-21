import React from "react";
import { View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useTheme } from "./ThemeProvider";
import { mix, parseColor, toCss } from "./mix";
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

/**
 * The measured atmosphere budget (WS-0 harsh-critic round 2, 2026-10-16).
 *
 * The web paints `.warm-glass-canvas` with `background-blend-mode: screen,
 * screen, normal` — its blooms LIGHTEN whatever is under them, and the night
 * gradient sits on a near-black `#0f1117` canvas where 42% of a navy tint is
 * still almost nothing. RN has no blend modes: the same alphas composite as a
 * veil and lifted the wall canvas to L* 18.6 — BRIGHTER than the glass plates
 * on it (L* 15.2), inverting the figure/ground the whole system rests on
 * (reference/home/parent-dark.png: canvas L* 5.5–9.2, cards L* 19–21).
 *
 * So the budget scales the token alphas (hue + stop intent unchanged) to the
 * hierarchy the measured reference actually has:
 *   dark  gradient ×0.30 → night 0.126/0.09/0.126, accent bloom 3%, violet 2%
 *   light gradient ×0.45 → day 0.315/0.225/0.189, and NO blooms at all:
 *         screen-blending a light base is a no-op lift, alpha-compositing it
 *         is a muddy pastel — so the honest RN equivalent is to omit them.
 * Every number here is pinned by tests/atmosphere.test.tsx (canvas L* ≤ 8
 * dark, chroma < 6 + within ~4 L* of glass light) AND re-measured on the
 * captures — do not re-tune from memory.
 */
export const ATMOSPHERE_BUDGET = {
  dark: { gradient: 0.3, accent: 3, violet: 2 },
  light: { gradient: 0.45, accent: 0, violet: 0 },
} as const;

/**
 * THE LIGHT WARM WASH (critic round 4 — HIGH 1).
 *
 * The web's light wall is NOT the neutral canvas the token implies. The web
 * paints a seasonal fog OVER the canvas (globals.css:753-796: the
 * `FogBackground` canvas at `opacity: .1` with `filter: saturate(2.2)`), and
 * that fog is a WARM champagne cast — the reference's light canvas measures
 * (239,225,217) / (242,231,225), i.e. R>G>B at hue ≈21-25, while the bare
 * `--gradient-canvas-day` stack composites to a cool blue-white
 * (236,242,250) / (240,245,251) (B>G>R, hue ≈213).
 *
 * The two frames read as different products side by side, so the native
 * reproduces the wash: a warm overlay over the light canvas. It is LIGHT
 * ONLY — the dark canvas's luminance delta is a recorded, accepted artefact
 * (see the budget note above), and the fog's dark leg is a near-black sky
 * that the dark canvas already is.
 *
 * The wash's colour is the app's own warm accent (amber + apricot) pulled
 * 65% toward the page white, so it is a warm SAND rather than a saturated
 * orange — a saturated disc on the light wall is exactly the defect this
 * fixes (the burnt-orange meal well).
 *
 * MEASURED on the captures after this change (canvas pixels):
 *   native light (239,228,221) / (241,230,221) / (240,229,221) / (242,231,221)
 *   reference   (239,225,217) / (242,231,225) / (242,231,225) / (242,228,223)
 * i.e. within 4/255 per channel of the reference, R>G>B, hue ≈25.
 *
 * The wash is NOT part of `canvasComposite` below: that helper models the
 * atmosphere BUDGET (the gradient stack), and the budget's own contract —
 * canvas L*, chroma and the glass delta — is pinned by tests/atmosphere.test.tsx
 * against the gradient stack alone. The wash is a separate layer over it, and
 * the light canvas it produces is measured here.
 */
export const LIGHT_WARM_WASH_ALPHA = 36;

/**
 * The light wash's colour: the warm accent (amber 60% / apricot 40%) washed
 * 65% toward the page white. Returns null when the ramp does not carry the
 * tokens (a wash is atmosphere, never a requirement).
 */
export function lightWarmWashColor(colors: Record<string, string | undefined>): string | null {
  const amber = colors["color-accent-amber"];
  const apricot = colors["color-accent-apricot"];
  const page = colors["color-surface-0"];
  if (!amber || !apricot || !page) return null;
  return mix(mix(amber, apricot, 60), page, 35);
}

/** Layer footprints (normalized). The canvas gradient, then the two blooms. */
const GRADIENT_AXIS: [[number, number], [number, number]] = [
  [0.15, 0],
  [0.85, 1],
];
const ACCENT_BLOOM_AXIS: [[number, number], [number, number]] = [
  [0.15, 0],
  [0.75, 0.55],
];
const VIOLET_BLOOM_AXIS: [[number, number], [number, number]] = [
  [0.85, 0],
  [0.25, 0.5],
];
const GRADIENT_LOCATIONS = [0, 0.55, 1];

/** Where a point sits along a layer's gradient vector, 0 at start → 1 at end. */
function axisT(p: [number, number], axis: [[number, number], [number, number]]): number {
  const dx = axis[1][0] - axis[0][0];
  const dy = axis[1][1] - axis[0][1];
  const t = ((p[0] - axis[0][0]) * dx + (p[1] - axis[0][1]) * dy) / (dx * dx + dy * dy);
  return Math.max(0, Math.min(1, t));
}

function stopAt(stops: { r: number; g: number; b: number; a: number }[], t: number) {
  for (let i = 0; i < GRADIENT_LOCATIONS.length - 1; i++) {
    const [a, b] = [GRADIENT_LOCATIONS[i], GRADIENT_LOCATIONS[i + 1]];
    if (t >= a && t <= b) {
      const k = (t - a) / (b - a || 1);
      const s = stops[i];
      const e = stops[i + 1];
      return {
        r: s.r + (e.r - s.r) * k,
        g: s.g + (e.g - s.g) * k,
        b: s.b + (e.b - s.b) * k,
        a: s.a + (e.a - s.a) * k,
      };
    }
  }
  return stops[stops.length - 1];
}

function relLum(c: { r: number; g: number; b: number }): number {
  const ch = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
}

/**
 * The BRIGHTEST canvas pixel the atmosphere can paint, as an opaque hex — the
 * pixel maths the budget is tuned against, in one place, so tests measure the
 * same composition the layers paint instead of re-deriving it. Grid-samples
 * every layer's own footprint (a gradient stop is interpolated along its axis,
 * never stacked on another) and composites in sRGB, exactly as RN and CSS do.
 */
export function canvasComposite(
  theme: "light" | "dark",
  colors: Record<string, string>,
  phase: AtmospherePhase = theme === "dark" ? "night" : "day"
): string {
  const budget = ATMOSPHERE_BUDGET[theme];
  const css = resolveCanvasToken(theme, phase, colors) ?? colors["gradient-canvas-day"];
  const stops = (budgetStops(stopsFromToken(css), budget.gradient) ?? [])
    .map((s) => parseColor(s))
    .filter((s): s is { r: number; g: number; b: number; a: number } => !!s);
  const base = parseColor(colors["color-canvas"]) ?? { r: 0, g: 0, b: 0, a: 1 };
  const accent = parseColor(colors["color-accent-selected"]);
  const violet = parseColor(colors["color-accent-violet"]);
  const lay = (acc: { r: number; g: number; b: number }, c: { r: number; g: number; b: number } | null, a: number) =>
    !c || a <= 0
      ? acc
      : { r: c.r * a + acc.r * (1 - a), g: c.g * a + acc.g * (1 - a), b: c.b * a + acc.b * (1 - a) };

  let worst = { r: base.r, g: base.g, b: base.b };
  const COLS = 18;
  const ROWS = 32;
  for (let iy = 0; iy < ROWS; iy++) {
    for (let ix = 0; ix < COLS; ix++) {
      const p: [number, number] = [(ix + 0.5) / COLS, (iy + 0.5) / ROWS];
      const s = stopAt(stops, axisT(p, GRADIENT_AXIS));
      let c = lay({ r: base.r, g: base.g, b: base.b }, s, s.a * budget.gradient);
      c = lay(c, accent, (budget.accent / 100) * (1 - axisT(p, ACCENT_BLOOM_AXIS)));
      c = lay(c, violet, (budget.violet / 100) * (1 - axisT(p, VIOLET_BLOOM_AXIS)));
      if (relLum(c) > relLum(worst)) worst = c;
    }
  }
  return toCss({ ...worst, a: 1 });
}

/** Alpha-rebudgeted stops: same hues, the alpha the measured hierarchy needs. */
export function budgetStops(
  stops: [string, string, string] | null,
  scale: number
): [string, string, string] | null {
  if (!stops) return null;
  return stops.map((stop) => {
    const c = parseColor(stop);
    return c ? toCss({ ...c, a: c.a * scale }) : stop;
  }) as [string, string, string];
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
 * Canvas gradient per theme+phase. LIGHT is clock-independent by contract: the
 * web's light warm-glass canvas is `--gradient-canvas-day` only
 * (globals.css:744-752) — switching light to dawn/dusk was native-only drift
 * that made a review surface change colour with the time of day (the 08:42
 * capture was a pink/peach #d7c0eb block).
 */
export function resolveCanvasToken(
  theme: "light" | "dark",
  phase: AtmospherePhase,
  colors: Record<string, string>
): string | undefined {
  if (theme === "dark") {
    return colors["gradient-canvas-night"] ?? colors["gradient-canvas-day"];
  }
  return colors["gradient-canvas-day"];
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

  const budget = ATMOSPHERE_BUDGET[theme];
  const currentStops =
    budgetStops(
      stopsFromToken(resolveCanvasToken(theme, phase, colors)) ??
        stopsFromToken(colors["gradient-canvas-day"]),
      budget.gradient
    ) ?? null;
  const prevStops = prevPhase
    ? budgetStops(stopsFromToken(resolveCanvasToken(theme, prevPhase, colors)), budget.gradient)
    : null;
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  // Blooms are NULL (layer not mounted) whenever the budget is 0 — in light
  // the web SCREEN-blends its radials, and alpha-compositing them over a light
  // canvas is what turned the wall into a muddy pastel (see the budget note).
  const bloomColors: [string, string, ...string[]] | null =
    budget.accent <= 0
      ? null
      : [
          mix(accentColor, "transparent", budget.accent),
          mix(colors["color-accent-violet"] ?? accentColor, "transparent", Math.max(budget.accent - 2, 1)),
          "transparent",
        ];

  // Secondary violet bloom, top-right — .warm-glass-canvas's second radial
  // (ellipse 60% 40% at 85% 0%, violet → transparent 50%).
  const violetBloomColors: [string, string] | null =
    budget.violet <= 0
      ? null
      : [mix(colors["color-accent-violet"] ?? accentColor, "transparent", budget.violet), "transparent"];

  // The LIGHT warm wash (see LIGHT_WARM_WASH_ALPHA): the web's seasonal fog
  // cast, reproduced as a warm overlay over the light canvas. Dark never
  // paints it — its canvas delta is a recorded, accepted artefact.
  const warmWash =
    theme === "light" ? lightWarmWashColor(colors) : null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} testID="atmosphere">
      {prevStops ? <GradientLayer stops={prevStops} /> : null}
      <Animated.View style={[StyleSheet.absoluteFill, fadeStyle]}>
        <GradientLayer stops={currentStops} />
      </Animated.View>
      {bloomColors ? (
        <LinearGradient
          colors={bloomColors}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.75, y: 0.55 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {violetBloomColors ? (
        <LinearGradient
          colors={violetBloomColors}
          start={{ x: 0.85, y: 0 }}
          end={{ x: 0.25, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {warmWash ? (
        <View
          testID="atmosphere-warm-wash"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: mix(warmWash, "transparent", LIGHT_WARM_WASH_ALPHA) },
          ]}
        />
      ) : null}
    </View>
  );
}

export default Atmosphere;
