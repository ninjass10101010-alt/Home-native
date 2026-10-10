import React from "react";
import { Pressable, Text, View, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useTheme } from "../theme/ThemeProvider";
import { MOTION, TYPOGRAPHY } from "../theme/tokens";

export interface ToggleProps {
  value: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
  accessibilityLabel?: string;
}

/**
 * RN port of ui/Toggle.tsx at wall scale (track 64×36, knob 28, 64dp hit
 * floor via the row's press). Knob position animates with withTiming; reduced
 * motion zeroes the duration. "label"/"description" follow the web's copy
 * layout (title semibold body-size, description muted at the 14sp floor).
 */
export function Toggle({
  value,
  onChange,
  label,
  description,
  disabled = false,
  style,
  testID,
  accessibilityLabel,
}: ToggleProps) {
  const { colors, accentColor, reduceMotion } = useTheme();
  const ON_ACCENT = colors["color-primary-foreground"];
  const progress = useSharedValue(value ? 1 : 0);

  React.useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, { duration: reduceMotion ? 0 : MOTION.base });
  }, [value, reduceMotion, progress]);

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * 28 }],
  }));

  const track = (
    <View
      style={{
        width: 64,
        height: 36,
        borderRadius: 18,
        borderWidth: 1,
        justifyContent: "center",
        backgroundColor: value ? accentColor : colors["color-surface-3"],
        borderColor: value ? accentColor : colors["color-border"] ?? "transparent",
        opacity: disabled ? 0.5 : 1,
        paddingHorizontal: 4,
      }}
    >
      <Animated.View
        style={[
          {
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: ON_ACCENT,
          },
          knobStyle,
        ]}
      />
    </View>
  );

  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onChange(!value)}
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          minHeight: 64,
        },
        style,
      ]}
    >
      {label || description ? (
        <View style={{ flexShrink: 1 }}>
          {label ? (
            <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "600" }}>
              {label}
            </Text>
          ) : null}
          {description ? (
            <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize, marginTop: 2 }}>
              {description}
            </Text>
          ) : null}
        </View>
      ) : null}
      {track}
    </Pressable>
  );
}

export default Toggle;
