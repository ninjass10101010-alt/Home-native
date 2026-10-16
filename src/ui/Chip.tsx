import React from "react";
import { Pressable, Text, View, ViewStyle } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { MIN_TARGET_DP } from "../theme/tokens";
import { accentDeepened, accentInk } from "../theme/mix";
import { Material } from "../theme/Material";
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
 * RN port of ui/Chip.tsx with the wall contract. Chrome routes through
 * Material (thin): resting = the tier's frosted surface, selected/disabled =
 * solid state fills (background prop — blur skipped under an opaque fill).
 * Tone inks: accent/violet/cyan use the 55% accent→body-ink mix (the measured
 * AA convention). success/warning/danger follow the web's per-tone guards
 * (globals.css chip-tone): LIGHT = accent at 72% (28% toward black — the
 * measured light fix, worst case 5.00:1 on surface-2); DARK keeps the vivid
 * raw accent where AA holds (mint/amber ≥7.3:1 on every chip surface) and
 * lifts danger via accentInk (raw rose lands 4.27–4.28:1 on Material-
 * composited chip surfaces; accentInk clears 6.96:1). Selected = accent
 * deepened 40% toward black (web color-mix(accent 60%, black)) with white ink
 * — and the tone ink is OMITTED (not overridden), mirroring the web fix.
 * Disabled = neutral surface + secondary ink (never an opacity fade).
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
  const { colors, accentColor, reduceMotion, theme } = useTheme();
  const ON_ACCENT = colors["color-primary-foreground"];
  const s = sizeMap[size];

  if (s.height < MIN_TARGET_DP && as === "button") {
    // Wall contract: no sub-64 tappable control. Degrade to a static label
    // instead of lying about a target.
    as = "span";
  }

  const mint = colors["color-accent-mint"] ?? accentColor;
  const rose = colors["color-accent-rose"] ?? accentColor;
  const amber = colors["color-accent-amber"] ?? accentColor;

  const toneInk = (t: ChipTone): string => {
    switch (t) {
      case "neutral":
        return colors["color-text-secondary"];
      case "accent":
        return accentInk(accentColor, colors["color-text-primary"]);
      case "success":
        return theme === "light" ? accentDeepened(mint, 28) : mint;
      case "danger":
        return theme === "light" ? accentDeepened(rose, 28) : accentInk(rose, colors["color-text-primary"]);
      case "warning":
        return theme === "light" ? accentDeepened(amber, 28) : amber;
      case "violet":
        return accentInk(colors["color-accent-violet"] ?? accentColor, colors["color-text-primary"]);
      case "cyan":
        return accentInk(colors["color-accent-cyan"] ?? accentColor, colors["color-text-primary"]);
    }
  };

  // Solid state fill for Material (undefined = keep the frosted tier surface).
  const solidFill = disabled
    ? colors["color-surface-2"]
    : selected
      ? accentDeepened(accentColor, 40)
      : undefined;
  const resolvedInk = disabled
    ? colors["color-text-secondary"]
    : selected
      ? ON_ACCENT
      : toneInk(tone);
  const resolvedBorder = disabled
    ? colors["color-border"] ?? "transparent"
    : selected
      ? "transparent"
      : tone === "neutral"
        ? colors["color-border"] ?? "transparent"
        : mixAlpha(accentColor, 0.25);

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

  const chrome: ViewStyle = {
    height: s.height,
    minHeight: as === "button" ? MIN_TARGET_DP : s.height,
    paddingHorizontal: s.px,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    borderWidth: 1,
    borderColor: resolvedBorder,
  };

  if (as === "span") {
    return (
      <View testID={testID} accessibilityLabel={accessibilityLabel}>
        <Material tier="thin" background={solidFill} style={[chrome, style]}>
          {content}
        </Material>
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
      style={
        ({ pressed }) =>
          pressed && !reduceMotion ? { transform: [{ scale: 0.96 }] } : null
      }
    >
      <Material tier="thin" background={solidFill} style={[chrome, style]}>
        {content}
      </Material>
    </Pressable>
  );
}

export default Chip;
