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
 *
 * The destructive disc carries `color-primary-foreground`, which clears 5.98:1
 * (dark) / 7.37:1 (light) on the rose fill — but only for a glyph `color` can
 * actually reach. A COLOUR emoji ignores `color`: the 🗑️ specimen's own light
 * metal measured L 0.4948 against `#b72f47` = 3.10:1 no matter what ink this
 * resolver returned, so destructive controls take a solid/monochrome glyph.
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

  // ONE ink resolution for every branch. Consumers pass a glyph WITHOUT a
  // colour far more often than not, and an unstyled <Text> resolves to RN
  // Web's #000000 — pure black on dark glass (1.47:1, WCAG 1.4.11 fail). The
  // accent/danger/ghost inks stay exactly as they were; glass/surface gain the
  // body-ink default the web gets from its `text-text-primary` class.
  const inkFor = (v: IconButtonVariant): string => {
    switch (v) {
      case "accent":
        return accentInk(accentColor, colors["color-text-primary"]);
      case "danger":
        return ON_ACCENT;
      case "ghost":
        return colors["color-text-secondary"];
      default:
        return colors["color-text-primary"];
    }
  };

  /** Tint the glyph unless the caller already named an ink (its style wins). */
  const withInk = (fg: string) =>
    React.isValidElement(icon)
      ? React.cloneElement(icon as React.ReactElement<any>, {
          style: [{ color: fg }, (icon.props as any).style],
        })
      : icon;

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
            {withInk(inkFor(variant))}
          </Pressable>
        </Material>
      </Animated.View>
    );
  }

  const resolved: Record<Exclude<IconButtonVariant, "glass" | "surface">, { bg: string; fg: string; border: string }> = {
    accent: {
      bg: mixAlpha(accentColor, 0.15),
      fg: inkFor("accent"),
      border: mixAlpha(accentColor, 0.25),
    },
    danger: {
      // Web parity: bg color-mix(rose, #000 25%) — 25% TOWARD black (naming the
      // web recipe so the value is never re-derived by memory).
      bg: accentDeepened(rose, 25),
      fg: inkFor("danger"),
      border: mixAlpha(rose, 0.2),
    },
    ghost: {
      bg: "transparent",
      fg: inkFor("ghost"),
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
        {/* glyph ink rides the SAME resolver as glass/surface (see withInk) */}
        {withInk(v.fg)}
      </Pressable>
    </Animated.View>
  );
}

export default IconButton;
