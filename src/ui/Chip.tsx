import React from "react";
import { Pressable, Text, View, ViewStyle } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { MIN_TARGET_DP } from "../theme/tokens";
import { accentDeepened, accentInk } from "../theme/mix";
import { mixAlpha } from "./SoftButton";

export type ChipTone = "neutral" | "accent" | "success" | "danger" | "warning" | "violet" | "cyan";
export type ChipSize = "sm" | "md" | "lg";

export interface ChipProps {
  label: React.ReactNode;
  icon?: React.ReactNode;
  tone?: ChipTone;
  size?: ChipSize;
  selected?: boolean;
  /** "span" = static label (no control semantics); "button" = tappable. */
  as?: "button" | "span";
  onPress?: () => void;
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
  accessibilityLabel?: string;
}

/**
 * RN port of ui/Chip.tsx with the wall contract. Tone inks: accent/violet/cyan
 * use the 55% accent→body-ink mix (the measured AA convention). Selected =
 * accent deepened 60% toward black with white ink — and the tone ink is
 * OMITTED (not overridden), mirroring the web fix. Disabled = neutral surface
 * + secondary ink (never an opacity fade).
 */
const sizeMap: Record<ChipSize, { height: number; px: number; font: number }> = {
  sm: { height: 48, px: 16, font: 14 },   // span-only (see runtime guard)
  md: { height: 64, px: 20, font: 16 },
  lg: { height: 72, px: 24, font: 18 },
};

export function Chip({
  label,
  icon,
  tone = "neutral",
  size = "md",
  selected = false,
  as = "button",
  onPress,
  disabled = false,
  style,
  testID,
  accessibilityLabel,
}: ChipProps) {
  const { colors, accentColor } = useTheme();
  const ON_ACCENT = colors["color-primary-foreground"];
  const s = sizeMap[size];

  if (s.height < MIN_TARGET_DP && as === "button") {
    // Wall contract: no sub-64 tappable control. Degrade to a static label
    // instead of lying about a target.
    as = "span";
  }

  const toneInk = (t: ChipTone): string => {
    switch (t) {
      case "neutral":
        return colors["color-text-secondary"];
      case "accent":
        return accentInk(accentColor, colors["color-text-primary"]);
      case "success":
        return colors["color-accent-mint"] ?? accentColor;
      case "danger":
        return colors["color-accent-rose"] ?? accentColor;
      case "warning":
        return colors["color-accent-amber"] ?? accentColor;
      case "violet":
        return accentInk(colors["color-accent-violet"] ?? accentColor, colors["color-text-primary"]);
      case "cyan":
        return accentInk(colors["color-accent-cyan"] ?? accentColor, colors["color-text-primary"]);
    }
  };

  const resolvedBg = disabled
    ? colors["color-surface-2"]
    : selected
      ? accentDeepened(accentColor, 60)
      : mixAlpha(colors["color-surface-0"] ?? accentColor, 0.2);
  const resolvedInk = disabled
    ? colors["color-text-secondary"]
    : selected
      ? ON_ACCENT
      : toneInk(tone);
  const resolvedBorder = disabled
    ? colors["color-border"] ?? "transparent"
    : selected
      ? "transparent"
      : mixAlpha(accentColor, tone === "neutral" ? 0.0 : 0.25);

  const content = (
    <>
      {icon}
      {typeof label === "string" ? (
        <Text style={{ color: resolvedInk, fontSize: s.font, fontWeight: "600" }}>{label}</Text>
      ) : (
        label
      )}
    </>
  );

  const base: ViewStyle = {
    height: s.height,
    minHeight: as === "button" ? MIN_TARGET_DP : s.height,
    paddingHorizontal: s.px,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    borderWidth: 1,
    backgroundColor: resolvedBg,
    borderColor: resolvedBorder,
  };

  if (as === "span") {
    return (
      <View testID={testID} style={[base, style]} accessibilityLabel={accessibilityLabel}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={[base, style]}
    >
      {content}
    </Pressable>
  );
}

export default Chip;
