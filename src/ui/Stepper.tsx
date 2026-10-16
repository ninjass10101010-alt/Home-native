import React from "react";
import { Pressable, Text, View, ViewStyle } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { MIN_TARGET_DP, RADII, TYPOGRAPHY } from "../theme/tokens";

export interface StepperProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  style?: ViewStyle;
  testID?: string;
}

/**
 * RN port of ui/Stepper.tsx at wall scale: the −/+ controls are 64dp FLAT
 * squares (web: rounded-2xl bg-surface-2 — deliberately not a glass circle;
 * a stepper rail is a dense utility, not a frosted surface), value text at
 * body size, disabled rail dimmed to opacity 0.4 (web disabled:opacity-40),
 * press scale 0.96 skipped under reduceMotion.
 */
export function Stepper({ value, onChange, min = 0, max = 99, step = 1, label, style, testID }: StepperProps) {
  const { colors, reduceMotion } = useTheme();
  const what = label || "value";
  const decDisabled = value <= min;
  const incDisabled = value >= max;

  const railButton = (sign: "−" | "+", disabled: boolean, a11y: string, onPress: () => void) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          width: MIN_TARGET_DP,
          height: MIN_TARGET_DP,
          borderRadius: RADII.md,
          backgroundColor: colors["color-surface-2"],
          alignItems: "center",
          justifyContent: "center",
          opacity: disabled ? 0.4 : 1,
        },
        pressed && !reduceMotion ? { transform: [{ scale: 0.96 }] } : null,
      ]}
    >
      <Text style={{ fontSize: 26, fontWeight: "600", color: colors["color-text-primary"] }}>{sign}</Text>
    </Pressable>
  );

  return (
    <View testID={testID} style={[{ flexDirection: "row", alignItems: "center", gap: 12 }, style]}>
      {label ? (
        <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "600" }}>
          {label}
        </Text>
      ) : null}
      {railButton("−", decDisabled, `Decrease ${what}`, () => onChange(Math.max(min, value - step)))}
      <Text
        style={{
          minWidth: 48,
          textAlign: "center",
          color: colors["color-text-primary"],
          fontSize: TYPOGRAPHY.title.fontSize,
          fontWeight: "600",
          fontVariant: ["tabular-nums"],
        }}
      >
        {value}
      </Text>
      {railButton("+", incDisabled, `Increase ${what}`, () => onChange(Math.min(max, value + step)))}
    </View>
  );
}

export default Stepper;
