import React from "react";
import { Pressable, Text, View, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useTheme } from "../theme/ThemeProvider";
import { PRESS_IN_MS, SPRING, TYPOGRAPHY } from "../theme/tokens";
import { hapticSelect } from "../theme/haptics";

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
  const knobScaleX = useSharedValue(1);

  React.useEffect(() => {
    progress.value = reduceMotion ? (value ? 1 : 0) : withSpring(value ? 1 : 0, SPRING.settle);
  }, [value, reduceMotion, progress]);

  const fillStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  const knobStyle = useAnimatedStyle(() => ({
    // track 64 − knob 28 − 2×4dp insets = 28dp of travel… but the 1dp track
    // border eats 2dp, so 26 keeps symmetric 4dp knob margins at both ends.
    transform: [{ translateX: progress.value * 26 }, { scaleX: knobScaleX.value }],
  }));

  const track = (
    <View
      style={{
        width: 64,
        height: 36,
        borderRadius: 18,
        borderWidth: 1,
        justifyContent: "center",
        backgroundColor: colors["color-surface-3"],
        borderColor: value ? accentColor : colors["color-border"] ?? "transparent",
        opacity: disabled ? 0.5 : 1,
        paddingHorizontal: 4,
        overflow: "hidden",
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: 18,
            backgroundColor: accentColor,
          },
          fillStyle,
        ]}
      />
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
      onPress={() => {
        hapticSelect();
        onChange(!value);
      }}
      onPressIn={() => {
        if (!reduceMotion) {
          // eslint-disable-next-line react-hooks/immutability -- Reanimated shared-value write
          knobScaleX.value = withTiming(1.12, { duration: PRESS_IN_MS });
        }
      }}
      onPressOut={() => {
        // eslint-disable-next-line react-hooks/immutability -- Reanimated shared-value write
        knobScaleX.value = reduceMotion ? 1 : withSpring(1, SPRING.press);
      }}
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
