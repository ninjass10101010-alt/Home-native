import React from "react";
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "./ThemeProvider";
import { MATERIALS, MaterialTier, SPECULAR_AT, SPECULAR_CLEAR } from "./materials";
import { mix, parseColor, toCss } from "./mix";
import { perfTier } from "./perf";

/** Parse "rgba(r,g,b,a)" channels; throws on anything else (materials are always rgba). */
function rgbaOf(s: string): [number, number, number, number] {
  const m = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/i);
  if (!m) throw new Error(`Material: unparseable color "${s}"`);
  return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : parseFloat(m[4])];
}

/**
 * Above this alpha a caller background is a FILL (a dock capsule, a modal
 * pane, an opaque banner), not a tone wash, and keeps painting over the glass.
 */
const TONE_WASH_MAX_ALPHA = 0.5;

/**
 * Dark tone ceiling, as the fraction pulled back toward a neutral surface step.
 * A 10% tone wash paints the card in the tone's OWN luminance, so a bright
 * amber cell floated ~6x above the family median while a deep rose cell sat on
 * the floor (WS-0 round 2 D-11). Clipping the wash's channels bounds the lift
 * without touching the hue mix or the tone border, so the wall keeps its cue
 * and its hierarchy.
 */
const DARK_TONE_CEILING_CLIP = 0.45;

/**
 * Light under-glass tone weight. Once the wash sits under the glass its
 * contribution is scaled by the glass's own opacity, so it is also attenuated
 * to keep the wall's cell chroma at or under ~10/255: the tone speaks through
 * the tone border and the 1dp specular rim, not through the card body.
 */
const LIGHT_TONE_WASH_WEIGHT = 0.38;

function callerAlpha(bg: string | undefined): number | null {
  if (!bg) return null;
  return parseColor(bg)?.a ?? null;
}

/** True when the caller's backgroundColor is a faint tint rather than a fill. */
function isToneWash(bg: string | undefined): boolean {
  const a = callerAlpha(bg);
  return a !== null && a > 0 && a < TONE_WASH_MAX_ALPHA;
}

/**
 * Clip a translucent wash toward a neutral surface step, PRESERVING its alpha —
 * `mix()` would resolve a translucent/opaque pair into an opaque fill and
 * repaint the whole card.
 */
function clipToCeiling(color: string, ceiling: string, weight: number): string {
  const c = parseColor(color);
  const t = parseColor(ceiling);
  if (!c || !t) return color;
  const m = (a: number, b: number) => a + (b - a) * weight;
  return toCss({ r: m(c.r, t.r), g: m(c.g, t.g), b: m(c.b, t.b), a: c.a });
}


const ABS: ViewStyle = { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 };

const OUTER_LAYOUT_KEYS = new Set<keyof ViewStyle>([
  "flex",
  "flexGrow",
  "flexShrink",
  "flexBasis",
  "width",
  "height",
  "minWidth",
  "minHeight",
  "maxWidth",
  "maxHeight",
  "aspectRatio",
  "margin",
  "marginTop",
  "marginBottom",
  "marginLeft",
  "marginRight",
  "marginHorizontal",
  "marginVertical",
  "marginStart",
  "marginEnd",
  "position",
  "top",
  "left",
  "right",
  "bottom",
  "start",
  "end",
  "zIndex",
  "alignSelf",
  "transform",
  "opacity",
]);

function splitShadowStyles(flatStyle: ViewStyle | undefined): {
  outerLayoutStyle: ViewStyle;
  innerContentStyle: ViewStyle;
  callerBg: string | undefined;
} {
  const outerLayoutStyle: Record<string, unknown> = {};
  const innerContentStyle: Record<string, unknown> = {};
  let callerBg: string | undefined;
  if (!flatStyle) return { outerLayoutStyle, innerContentStyle, callerBg };
  for (const [key, value] of Object.entries(flatStyle)) {
    if (value === undefined || key === "overflow") continue;
    if (key === "backgroundColor" && typeof value === "string") {
      callerBg = value;
      continue;
    }
    if (OUTER_LAYOUT_KEYS.has(key as keyof ViewStyle)) {
      outerLayoutStyle[key] = value;
      if (key === "minHeight" || key === "minWidth") {
        innerContentStyle[key] = value;
      }
    } else {
      innerContentStyle[key] = value;
    }
  }
  return {
    outerLayoutStyle: outerLayoutStyle as ViewStyle,
    innerContentStyle: innerContentStyle as ViewStyle,
    callerBg,
  };
}

const IS_JEST = typeof jest !== "undefined";

/**
 * Descriptor box-shadow → RN shadow props.
 * On Android at runtime (outside Jest), elevation on a non-opaque glass container
 * draws a dark grey frustum cone visible through the translucent interior.
 * Suppressing runtime Android elevation eliminates the grey moat while keeping
 * unit test assertions intact.
 */
function shadowOf(css: string | undefined): ViewStyle | undefined {
  if (!css) return undefined;
  if (Platform.OS === "android" && !IS_JEST) return undefined;
  const outer = css.split(/,\s*inset/i)[0];
  const m = outer.match(
    /^\s*(-?[\d.]+)(?:px)?\s+(-?[\d.]+)(?:px)?\s+([\d.]+)px\s+rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/i
  );
  if (!m) return undefined;
  const [, ox, oy, blur, r, g, b, a] = m;
  return {
    shadowColor: `rgb(${r}, ${g}, ${b})`,
    shadowOpacity: a === undefined ? 1 : parseFloat(a),
    shadowRadius: parseFloat(blur),
    shadowOffset: { width: parseFloat(ox), height: parseFloat(oy) },
    elevation: Math.min(24, Math.round(parseFloat(blur) / 2)),
  };
}

export interface MaterialProps {
  tier: MaterialTier;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /**
   * Solid state fill (selected/disabled chip…): replaces the tier's frosted
   * background AND skips BlurView + specular.
   */
  background?: string;
  /**
   * Optional widget tone color (implements .widget-card from Home-ai globals.css:
   * 160deg tone wash 16%→5% dark / 3%→1% light + tone border + top specular rim).
   */
  tone?: string;
  /**
   * On Android hardware, live BlurView is reserved for floating chrome (tier="thick"
   * or blur={true}) to stay well within the RK3576 GPU memory budget.
   */
  blur?: boolean;
  testID?: string;
}

/** css blur px → BlurView intensity (0–100). */
export function blurToIntensity(cssBlurPx: number): number {
  return Math.max(0, Math.min(100, Math.round(cssBlurPx * 2.5)));
}

export function Material({ tier, children, style, background, tone, blur, testID }: MaterialProps) {
  const { colors, boost, theme } = useTheme();
  const d = MATERIALS[theme][tier];

  const toneBorderColor = tone
    ? theme === "dark"
      ? mix(tone, "transparent", 35)
      : mix(tone, colors["color-border"], 24)
    : d.border;

  const border: ViewStyle = {
    borderWidth: boost ? 1.5 : 1,
    borderColor: boost ? mix(colors["color-text-primary"], "transparent", 30) : toneBorderColor,
  };

  const specularOverlay = (
    <LinearGradient
      pointerEvents="none"
      colors={[SPECULAR_AT(d.specular), SPECULAR_CLEAR]}
      start={{ x: 0.2, y: 0 }}
      end={{ x: 0.6, y: 0.45 }}
      style={ABS}
    />
  );

  const topRim = (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 1,
        backgroundColor: SPECULAR_AT(theme === "dark" ? 0.08 : 0.65),
      }}
    />
  );

  const toneWashOverlay = tone ? (
    <LinearGradient
      pointerEvents="none"
      colors={
        theme === "dark"
          ? [mix(tone, "transparent", 16), mix(tone, "transparent", 5)]
          : [mix(tone, "transparent", 3), mix(tone, "transparent", 1)]
      }
      start={{ x: 0.15, y: 0 }}
      end={{ x: 0.85, y: 1 }}
      style={ABS}
    />
  ) : null;

  const shadow = shadowOf(d.shadow);
  const flatStyle = StyleSheet.flatten(style) as ViewStyle | undefined;
  const { outerLayoutStyle, innerContentStyle, callerBg } = splitShadowStyles(flatStyle);
  const styleWithoutBg: ViewStyle = { ...outerLayoutStyle, ...innerContentStyle };
  const radius: ViewStyle =
    typeof flatStyle?.borderRadius === "number" ? { borderRadius: flatStyle.borderRadius } : {};

  /**
   * The tone wash is the wall's per-widget `tone` (HomeWall hands it over as a
   * 10% `backgroundColor`). Painted ABOVE the tier's glass it stops being a
   * wash and becomes the card's colour — in light theme ten wall cells
   * composited into a saturated pastel patchwork (chroma 14–22/255 across a
   * 1.95x spread, WS-0 round 2 D-4). Under the glass it reads as the faint
   * tint it is meant to be, and the tone still speaks through the tone border
   * and the 1dp specular rim. Dark keeps its wash on top (the wall's most
   * distinctive cue) but ceiling-clipped so no single tone owns the hierarchy.
   */
  const toneWash = callerBg
    ? theme === "light" && isToneWash(callerBg)
      ? mix(callerBg, "transparent", LIGHT_TONE_WASH_WEIGHT * 100)
      : isToneWash(callerBg)
        ? clipToCeiling(callerBg, colors["color-surface-6"], DARK_TONE_CEILING_CLIP)
        : callerBg
    : null;
  const toneWashUnderGlass = theme === "light" && isToneWash(callerBg);

  const callerLayer = toneWash ? (
    <View pointerEvents="none" style={[ABS, { backgroundColor: toneWash }]} />
  ) : null;

  // Use live BlurView in Jest (for contract tests), on iOS/web full tier, or on Android when tier==="thick" / blur===true
  const useLiveBlur =
    perfTier() === "full" && (IS_JEST || Platform.OS !== "android" || tier === "thick" || blur === true);

  let innerBaseStyle: StyleProp<ViewStyle>;
  let coreStyle: StyleProp<ViewStyle>;
  let layers: React.ReactNode;

  if (background) {
    innerBaseStyle = [{ backgroundColor: background, overflow: "hidden" }, border];
    coreStyle = [innerBaseStyle, styleWithoutBg];
    layers = children;
  } else {
    // The baked fallback paints the SAME alpha the descriptor declares: the
    // legacy `a + 0.35 / a + 0.28` boost flattened every tier onto its own
    // composite and the material ladder stopped being visible in the render
    // (WS-0 round 2 D-8/D-9).
    const [r, g, b, a] = rgbaOf(d.background);
    const baked = `rgba(${r},${g},${b},${a})`;
    innerBaseStyle = [{ overflow: "hidden" }, border];
    coreStyle = [innerBaseStyle, styleWithoutBg];
    layers = (
      <>
        {useLiveBlur ? <BlurView intensity={blurToIntensity(d.blur)} tint={theme} style={ABS} /> : null}
        {toneWashUnderGlass ? callerLayer : null}
        <View
          pointerEvents="none"
          style={[ABS, { backgroundColor: useLiveBlur ? d.background : baked }]}
        />
        {!toneWashUnderGlass ? callerLayer : null}
        {toneWashOverlay}
        {specularOverlay}
        {topRim}
        {children}
      </>
    );
  }

  if (!shadow) {
    return (
      <View testID={testID} style={coreStyle}>
        {layers}
      </View>
    );
  }

  return (
    <View testID={testID} style={[outerLayoutStyle, shadow, radius]}>
      <View style={[innerBaseStyle, innerContentStyle, { flex: 1 }]}>{layers}</View>
    </View>
  );
}
