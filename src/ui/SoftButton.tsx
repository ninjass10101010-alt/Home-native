import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useTheme } from "../theme/ThemeProvider";
import { MOTION, MIN_TARGET_DP } from "../theme/tokens";
import { accentDeepened, accentInk } from "../theme/mix";

export type SoftButtonVariant = "primary" | "secondary" | "ghost" | "destructive" | "danger" | "success";
export type SoftButtonSize = "sm" | "md" | "lg" | "icon";

export interface SoftButtonProps {
  variant?: SoftButtonVariant;
  size?: SoftButtonSize;
  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  children: React.ReactNode;
  style?: ViewStyle;
  testID?: string;
  accessibilityLabel?: string;
}

/**
 * RN port of ui/SoftButton.tsx with the wall-scale contract (≥64dp, ≥14sp;
 * plan Task 6). Variant semantics ported verbatim, with the token formulas
 * computed at runtime per theme+accent (src/theme/mix.ts — pct is the percent
 * TOWARD BLACK, so web color-mix(accent X%, black) ⇒ pct = 100 − X):
 *   primary   = accent 40% toward black + white label (was the measured AA
 *               fix: 4.60–8.33:1 dark / 7.12–12.52:1 light)
 *   secondary = surface-2 fill + 55%-accent ink (6.96–10.85:1 / 6.03–10.23:1)
 *   danger    = rose deepened 25% toward black + white (alias "destructive")
 *   success   = mint deepened 45% toward black + white
 *   ghost     = transparent + secondary ink
 *   disabled  = neutral raised surface + secondary ink, accent fully gone
 *               (the web's "disabled is a SURFACE change, not a fade")
 */
const sizeMap: Record<SoftButtonSize, { height: number; px: number; font: number; radius: number }> = {
  sm: { height: 64, px: 20, font: 16, radius: 20 },
  md: { height: 72, px: 24, font: 18, radius: 24 },
  lg: { height: 88, px: 28, font: 20, radius: 28 },
  icon: { height: 72, px: 0, font: 18, radius: 24 },
};

export function SoftButton({
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  onPress,
  children,
  style,
  testID,
  accessibilityLabel,
}: SoftButtonProps) {
  const { colors, accentColor, reduceMotion } = useTheme();
  const ON_ACCENT = colors["color-primary-foreground"];
  const isDisabled = disabled || loading;

  const rose = colors["color-accent-rose"] ?? accentColor;
  const mint = colors["color-accent-mint"] ?? accentColor;

  const resolved = (() => {
    if (isDisabled) {
      return { bg: colors["color-surface-2"], fg: colors["color-text-secondary"], border: colors["color-border"] ?? "transparent", shadow: false };
    }
    switch (variant) {
      case "primary":
        return { bg: accentDeepened(accentColor, 40), fg: ON_ACCENT, border: mixAlpha(accentColor, 0.2), shadow: true };
      case "secondary":
        return { bg: colors["color-surface-2"], fg: accentInk(accentColor, colors["color-text-primary"]), border: mixAlpha(accentColor, 0.25), shadow: false };
      case "danger":
      case "destructive":
        return { bg: accentDeepened(rose, 25), fg: ON_ACCENT, border: mixAlpha(rose, 0.2), shadow: true };
      case "success":
        return { bg: accentDeepened(mint, 45), fg: ON_ACCENT, border: mixAlpha(mint, 0.2), shadow: true };
      case "ghost":
        return { bg: "transparent", fg: colors["color-text-secondary"], border: "transparent", shadow: false };
    }
  })();

  const sizes = sizeMap[size];
  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[aStyle, style]}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        disabled={isDisabled}
        onPress={onPress}
        onPressIn={() => { // eslint-disable-next-line react-hooks/immutability -- Reanimated shared-value write is the idiom
        if (!reduceMotion) scale.value = withTiming(0.96, { duration: MOTION.fast }); }}
        onPressOut={() => { // eslint-disable-next-line react-hooks/immutability -- Reanimated shared-value write is the idiom
        scale.value = withTiming(1, { duration: MOTION.fast }); }}
        style={[
          styles.base,
          {
            minHeight: Math.max(sizes.height, MIN_TARGET_DP),
            minWidth: size === "icon" ? Math.max(sizes.height, MIN_TARGET_DP) : undefined,
            paddingHorizontal: sizes.px,
            backgroundColor: resolved.bg,
            borderColor: resolved.border,
            borderRadius: sizes.radius,
          },
        ]}
      >
        {loading && <ActivityIndicator color={resolved.fg} style={{ marginRight: 10 }} />}
        {typeof children === "string" ? (
          <Text style={{ color: resolved.fg, fontSize: sizes.font, fontWeight: "600" }}>{children}</Text>
        ) : (
          children
        )}
      </Pressable>
    </Animated.View>
  );
}

/** "#rrggbb"/"rgba(...)" → same color at alpha a (for borders). */
export function mixAlpha(color: string, a: number): string {
  const m = color.trim().match(/^#([0-9a-f]{6})$/i);
  if (m) {
    const h = m[1];
    return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`;
  }
  return color;
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    borderWidth: 1,
  },
});

export default SoftButton;
