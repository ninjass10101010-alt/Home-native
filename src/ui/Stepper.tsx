import React from "react";
import { Text, View, ViewStyle } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { TYPOGRAPHY } from "../theme/tokens";
import { IconButton } from "./IconButton";

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
 * RN port of ui/Stepper.tsx at wall scale: the −/+ controls are 64×64
 * IconButton "surface" circles (the web's 44px hit-44 is the 64dp wall floor),
 * value text at body size, disabled at the rails with the surface treatment.
 */
export function Stepper({ value, onChange, min = 0, max = 99, step = 1, label, style, testID }: StepperProps) {
  const { colors } = useTheme();
  const what = label || "value";
  const decDisabled = value <= min;
  const incDisabled = value >= max;
  return (
    <View testID={testID} style={[{ flexDirection: "row", alignItems: "center", gap: 12 }, style]}>
      {label ? (
        <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "600" }}>
          {label}
        </Text>
      ) : null}
      <IconButton
        variant="surface"
        size="sm"
        icon={<Text style={{ fontSize: 26, fontWeight: "600" }}>−</Text>}
        label={`Decrease ${what}`}
        disabled={decDisabled}
        onPress={() => onChange(Math.max(min, value - step))}
      />
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
      <IconButton
        variant="surface"
        size="sm"
        icon={<Text style={{ fontSize: 26, fontWeight: "600" }}>+</Text>}
        label={`Increase ${what}`}
        disabled={incDisabled}
        onPress={() => onChange(Math.min(max, value + step))}
      />
    </View>
  );
}

export default Stepper;
