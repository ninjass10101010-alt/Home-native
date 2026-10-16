import { View, ViewStyle } from "react-native";
import { Material } from "../theme/Material";
import { MaterialTier } from "../theme/materials";
import { RADII } from "../theme/tokens";
import { useTheme } from "../theme/ThemeProvider";
import { mix } from "../theme/mix";

export type SurfaceVariant =
  | "thin"
  | "regular"
  | "thick"
  | "glass"
  | "glass-strong"
  | "glass-subtle"
  | "material-regular"
  | "material-thick"
  | "material-thin"
  | "warm"
  | "flat";
export type SurfacePadding = "none" | "sm" | "md" | "lg" | "xl";
export type SurfaceRadius = "sm" | "md" | "lg" | "xl" | "2xl" | "pill" | "none";

export interface SurfaceProps {
  children?: React.ReactNode;
  variant?: SurfaceVariant;
  padding?: SurfacePadding;
  radius?: SurfaceRadius;
  glow?: boolean;
  interactive?: boolean;
  style?: ViewStyle;
  testID?: string;
  accessibilityLabel?: string;
}

/**
 * RN port of ui/Surface.tsx. The web's variant map (glass* kept as aliases of
 * material-* tiers, byte-identical render) is preserved; "warm" maps to the
 * THICK tier — warm-glass-card's blur 24 ≈ 26, border-frost-2 ≈ thick border,
 * strong-stop 0.78 ≈ thick's 0.8 tint, and its inset highlight rides thick's
 * shadow clause; "flat" to the neutral raised surface (token surface-2 +
 * border) — same semantics as the web contract.
 */
const variantTier: Record<SurfaceVariant, MaterialTier | null> = {
  thin: "thin",
  regular: "regular",
  thick: "thick",
  glass: "regular",
  "glass-strong": "thick",
  "glass-subtle": "thin",
  "material-regular": "regular",
  "material-thick": "thick",
  "material-thin": "thin",
  warm: "thick",
  flat: null,
};

const paddingMap: Record<SurfacePadding, number> = {
  none: 0,
  sm: 16, // wall-scale (web p-3=12 → wall 16)
  md: 24,
  lg: 32,
  xl: 40,
};

const radiusMap: Record<SurfaceRadius, number> = {
  none: 0,
  sm: RADII.sm,
  md: RADII.md,
  lg: RADII.lg,
  xl: RADII.xl,
  "2xl": RADII.xxl,
  pill: RADII.full,
};

export function Surface({
  children,
  variant = "warm",
  padding = "md",
  radius = "xl",
  glow = false,
  interactive = false,
  style,
  testID,
  accessibilityLabel,
}: SurfaceProps) {
  const { colors, accentColor } = useTheme();
  const pad = paddingMap[padding];
  const rad = radiusMap[radius];
  const glowShadow: ViewStyle = glow
    ? { shadowColor: mix(accentColor, "transparent", 25), shadowOpacity: 1, shadowRadius: 32, shadowOffset: { width: 0, height: 0 }, elevation: 8 }
    : {};

  const tier = variantTier[variant];
  const baseStyle: ViewStyle[] = [
    { borderRadius: rad, overflow: "hidden", padding: pad },
    glowShadow,
  ];
  if (style) baseStyle.push(style);

  if (tier === null) {
    return (
      <View
        testID={testID}
        accessibilityLabel={accessibilityLabel}
        style={[
          ...baseStyle,
          {
            backgroundColor: colors["color-surface-2"],
            borderWidth: 1,
            borderColor: colors["color-border"] ?? "transparent",
          },
        ]}
      >
        {children}
      </View>
    );
  }
  return (
    <Material tier={tier} style={baseStyle} testID={testID}>
      {children}
    </Material>
  );
}

export default Surface;
