import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "./ThemeProvider";
import { MATERIALS, MaterialTier, SPECULAR_AT, SPECULAR_CLEAR } from "./materials";
import { mix } from "./mix";
import { perfTier } from "./perf";

/** Parse "rgba(r,g,b,a)" channels; throws on anything else (materials are always rgba). */
function rgbaOf(s: string): [number, number, number, number] {
  const m = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/i);
  if (!m) throw new Error(`Material: unparseable color "${s}"`);
  return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : parseFloat(m[4])];
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
} {
  const outerLayoutStyle: Record<string, unknown> = {};
  const innerContentStyle: Record<string, unknown> = {};
  if (!flatStyle) return { outerLayoutStyle, innerContentStyle };
  for (const [key, value] of Object.entries(flatStyle)) {
    if (value === undefined || key === "overflow") continue;
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
  };
}

/**
 * Descriptor box-shadow → RN shadow props. Only the LEADING (outer) clause is
 * used; the trailing `inset …` highlight is a CSS-only concept (and iOS hides
 * shadows on clipping views anyway — the shell below keeps them honest).
 */
function shadowOf(css: string | undefined): ViewStyle | undefined {
  if (!css) return undefined;
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
   * background AND skips BlurView + specular — an opaque fill has nothing for
   * a blur to show through, and the wall's one-blur-per-surface budget is
   * not spent on invisible work.
   */
  background?: string;
  testID?: string;
}

/** css blur px → BlurView intensity (0–100). */
export function blurToIntensity(cssBlurPx: number): number {
  return Math.max(0, Math.min(100, Math.round(cssBlurPx * 2.5)));
}

/**
 * The ONE frosted-surface component. Contract: exactly one blur per surface
 * (RK3576 perf budget). Order: BlurView > tint > specular > border > content.
 * Reduced perf tier → baked tint (opaque-ized background), no BlurView.
 * Boost → thicker (1.5), lifted border. Tier box-shadow (where the web has
 * one) rides on an outer, non-clipping shell so iOS actually draws it.
 */
export function Material({ tier, children, style, background, testID }: MaterialProps) {
  const { colors, boost, theme } = useTheme();
  const d = MATERIALS[theme][tier];
  const border: ViewStyle = {
    borderWidth: boost ? 1.5 : 1,
    borderColor: boost ? mix(colors["color-text-primary"], "transparent", 30) : d.border,
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

  const shadow = shadowOf(d.shadow);
  const flatStyle = StyleSheet.flatten(style) as ViewStyle | undefined;
  const radius: ViewStyle =
    typeof flatStyle?.borderRadius === "number" ? { borderRadius: flatStyle.borderRadius } : {};

  let innerBaseStyle: StyleProp<ViewStyle>;
  let coreStyle: StyleProp<ViewStyle>;
  let layers: React.ReactNode;

  if (background) {
    // Solid state fill: no blur, no specular (see MaterialProps.background).
    innerBaseStyle = [{ backgroundColor: background, overflow: "hidden" }, border];
    coreStyle = [innerBaseStyle, style];
    layers = children;
  } else if (perfTier() === "reduced") {
    // Baked composite: raise the background alpha so text stays honest without blur.
    const [r, g, b, a] = rgbaOf(d.background);
    const baked = `rgba(${r},${g},${b},${Math.min(1, a + 0.35)})`;
    innerBaseStyle = [{ backgroundColor: baked, overflow: "hidden" }, border];
    coreStyle = [innerBaseStyle, style];
    layers = (
      <>
        {specularOverlay}
        {children}
      </>
    );
  } else {
    innerBaseStyle = [border, { overflow: "hidden" }];
    coreStyle = [innerBaseStyle, style];
    layers = (
      <>
        <BlurView intensity={blurToIntensity(d.blur)} tint={theme} style={ABS} />
        <View pointerEvents="none" style={[ABS, { backgroundColor: d.background }]} />
        {specularOverlay}
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
  // Shadow shell: NO overflow:hidden here (iOS drops shadows on clipping
  // views); radius mirrors the surface so the shadow follows its shape.
  //
  // Outer box sizing/positioning rides on the OUTER shell so it participates
  // in the parent's flex layout, while padding/border/content alignment stay
  // on the INNER view only (preventing double-padding and nested-border moats).
  const { outerLayoutStyle, innerContentStyle } = splitShadowStyles(flatStyle);
  return (
    <View testID={testID} style={[outerLayoutStyle, shadow, radius]}>
      <View style={[innerBaseStyle, innerContentStyle, { flex: 1 }]}>{layers}</View>
    </View>
  );
}
