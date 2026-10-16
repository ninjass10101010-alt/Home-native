import React from "react";
import { Pressable, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useTheme } from "../theme/ThemeProvider";
import { MOTION, MIN_TARGET_DP } from "../theme/tokens";
import { accentDeepened, accentInk } from "../theme/mix";
import { Material } from "../theme/Material";
import { mixAlpha } from "./SoftButton";

export type IconButtonVariant = "glass" | "surface" | "accent" | "danger" | "ghost";
export type IconButtonSize = "sm" | "md" | "lg";

export interface IconButtonProps {
  /** The glyph (emoji/text/SVG node). */
  icon: React.ReactNode;
  /** Mandatory a11y label — glyph-only controls must be announced. */
  label: string;
  onPress?: () => void;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
}

/**
 * RN port of ui/IconButton.tsx (wall-scale: 64/72/80 — the web's 44px floor
 * becomes 64dp on the wall per contract). Ink uses the 55% accent → body-ink
 * mix (the measured-AA accent-ink convention shared with Chip/Toast/Avatar).
 */
const sizeMap: Record<IconButtonSize, number> = { sm: 64, md: 72, lg: 80 };

export function IconButton({
  icon,
  label,
  onPress,
  variant = "glass",
  size = "md",
  disabled = false,
  style,
  testID,
}: IconButtonProps) {
  const { colors, accentColor, reduceMotion } = useTheme();
  const ON_ACCENT = colors["color-primary-foreground"];
  const dim = sizeMap[size];
  const rose = colors["color-accent-rose"] ?? accentColor;

  const circle: ViewStyle = {
    width: dim,
    height: dim,
    borderRadius: dim / 2,
    minWidth: MIN_TARGET_DP,
    minHeight: MIN_TARGET_DP,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  };

  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  if (variant === "glass" || variant === "surface") {
    return (
      <Animated.View style={aStyle}>
        <Material tier="thin" style={[circle, style]}>
          {/* the Pressable FILLS the circle — the whole 64/72/80dp disc is the
              tap target, not the glyph inside it (wall contract ≥64dp) */}
          <Pressable
            testID={testID}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={onPress}
            onPressIn={() => { // eslint-disable-next-line react-hooks/immutability -- Reanimated shared-value write is the idiom
              if (!reduceMotion) scale.value = withTiming(0.92, { duration: MOTION.fast }); }}
            onPressOut={() => { // eslint-disable-next-line react-hooks/immutability -- Reanimated shared-value write is the idiom
              scale.value = withTiming(1, { duration: MOTION.fast }); }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: "center",
              justifyContent: "center",
              opacity: disabled ? 0.5 : 1,
            }}
          >
            {icon}
          </Pressable>
        </Material>
      </Animated.View>
    );
  }

  const resolved: Record<Exclude<IconButtonVariant, "glass" | "surface">, { bg: string; fg: string; border: string }> = {
    accent: {
      bg: mixAlpha(accentColor, 0.15),
      fg: accentInk(accentColor, colors["color-text-primary"]),
      border: mixAlpha(accentColor, 0.25),
    },
    danger: {
      // Web parity: bg color-mix(rose, #000 25%) — 25% TOWARD black (naming the
      // web recipe so the value is never re-derived by memory).
      bg: accentDeepened(rose, 25),
      fg: ON_ACCENT,
      border: mixAlpha(rose, 0.2),
    },
    ghost: {
      bg: "transparent",
      fg: colors["color-text-secondary"],
      border: "transparent",
    },
  };
  const v = resolved[variant];
  return (
    <Animated.View style={[aStyle, style]}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        onPressIn={() => {
          // eslint-disable-next-line react-hooks/immutability -- Reanimated shared-value write is the idiom
          if (!reduceMotion) scale.value = withTiming(0.92, { duration: MOTION.fast });
        }}
        onPressOut={() => {
          // eslint-disable-next-line react-hooks/immutability -- Reanimated shared-value write is the idiom
          scale.value = withTiming(1, { duration: MOTION.fast });
        }}
        style={[circle, { backgroundColor: v.bg, borderColor: v.border, opacity: disabled ? 0.5 : 1 }]}
      >
        {/* tint glyph text color via context-less wrapper: consumers pass Text with their own color; accent ink applies when they don't */}
        {React.isValidElement(icon)
          ? React.cloneElement(icon as React.ReactElement<any>, {
              style: [{ color: v.fg }, (icon.props as any).style],
            })
          : icon}
      </Pressable>
    </Animated.View>
  );
}

export default IconButton;
