import React from "react";
import { StyleProp, View, ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "./ThemeProvider";
import { MATERIALS, MaterialTier, SPECULAR_AT, SPECULAR_CLEAR } from "./materials";
import { perfTier } from "./perf";

/** Parse "rgba(r,g,b,a)" channels; throws on anything else (materials are always rgba). */
function rgbaOf(s: string): [number, number, number, number] {
  const m = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/i);
  if (!m) throw new Error(`Material: unparseable color "${s}"`);
  return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : parseFloat(m[4])];
}

export interface MaterialProps {
  tier: MaterialTier;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
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
 */
export function Material({ tier, children, style, testID }: MaterialProps) {
  const { theme } = useTheme();
  const d = MATERIALS[theme][tier];
  const border = { borderWidth: 1, borderColor: d.border };

  const specularOverlay = (
    <LinearGradient
      pointerEvents="none"
      colors={[SPECULAR_AT(d.specular), SPECULAR_CLEAR]}
      start={{ x: 0.2, y: 0 }}
      end={{ x: 0.6, y: 0.45 }}
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
    />
  );

  if (perfTier() === "reduced") {
    // Baked composite: raise the background alpha so text stays honest without blur.
    const [r, g, b, a] = rgbaOf(d.background);
    const baked = `rgba(${r},${g},${b},${Math.min(1, a + 0.35)})`;
    return (
      <View testID={testID} style={[{ backgroundColor: baked, overflow: "hidden" }, border, style]}>
        {specularOverlay}
        <View style={{ zIndex: 1 }}>{children}</View>
      </View>
    );
  }

  return (
    <View testID={testID} style={[border, { overflow: "hidden" }, style]}>
      <BlurView
        intensity={blurToIntensity(d.blur)}
        tint={theme}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: d.background,
        }}
      />
      {specularOverlay}
      <View style={{ zIndex: 1 }}>{children}</View>
    </View>
  );
}
