import React from "react";
import { Pressable, Text, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { mixAlpha } from "./SoftButton";
import { useTheme } from "../theme/ThemeProvider";
import { MOTION, TYPOGRAPHY } from "../theme/tokens";
import { accentDeepened } from "../theme/mix";

export interface SegmentedOption {
  id: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
}

export interface SegmentedControlProps {
  options: SegmentedOption[];
  value: string;
  onChange: (id: string) => void;
  /** Active option gets the accent-gradient pill with white text + glow. */
  emphasize?: boolean;
  compact?: boolean;
  style?: ViewStyle;
  testID?: string;
  accessibilityLabel?: string;
}

/**
 * RN port of ui/SegmentedControl.tsx. The sliding pill is measured per-option
 * (onLayout, like the web's getBoundingClientRect path) and animated with
 * withTiming(MOTION.base); reduced-motion zeroes the animation. Emphasize uses
 * the accent at 40%/54% toward black (web color-mix 60%/46% — the measured AA
 * pill); inactive labels read text-secondary (the 6.16:1 light fix); segments
 * scale 0.96 on press (tap-sm parity, skipped under reduceMotion).
 */
export function SegmentedControl({
  options,
  value,
  onChange,
  emphasize = false,
  compact = false,
  style,
  testID,
  accessibilityLabel,
}: SegmentedControlProps) {
  const { colors, accentColor, reduceMotion } = useTheme();
  const activeIndex = Math.max(options.findIndex((o) => o.id === value), 0);

  const [boxes, setBoxes] = React.useState<{ x: number; w: number }[]>([]);
  // pill origin sits at the container's 6dp padding until measurement lands
  const pillX = useSharedValue(6);
  const pillW = useSharedValue(0);

  React.useEffect(() => {
    const b = boxes[activeIndex];
    if (!b) return;
    const dur = reduceMotion ? 0 : MOTION.base;
    pillX.value = withTiming(b.x, { duration: dur });
    pillW.value = withTiming(b.w, { duration: dur });
  }, [activeIndex, boxes, reduceMotion, pillX, pillW]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }],
    width: pillW.value,
    opacity: pillW.value > 0 ? 1 : 0,
  }));

  const pillBg = emphasize
    ? ([accentDeepened(accentColor, 40), accentDeepened(accentColor, 54)] as const)
    : null;

  return (
    <View
      testID={testID}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[
        {
          flexDirection: "row",
          flexWrap: "wrap",
          borderRadius: 999,
          backgroundColor: colors["color-surface-2"],
          padding: 6,
          maxWidth: 640,
        },
        style,
      ]}
    >
      {/* Non-layout ring: same 1dp capsule edge, but never shifts the child
          coordinates the sliding pill aligns to (border on the container
          made the pill land 1dp right of its segment). */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: colors["color-border"],
        }}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            top: 6,
            bottom: 6,
            left: 0,
            borderRadius: 999,
            overflow: "hidden",
            // Web EMPHASIZE_PILL: glow 0 6px 18px accent/35% + inset highlight.
            // (shadow only — Android elevation double-draws the pill under the
            // segments and reads as a grey slab.)
            shadowColor: accentColor,
            shadowOpacity: emphasize ? 0.35 : 0,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 6 },
          },
          pillStyle,
        ]}
      >
        {pillBg ? (
          <>
            <LinearGradient
              colors={pillBg as unknown as [string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
            />
            {/* inset top highlight (web inset 0 1px 0 white 22%) */}
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 1,
                backgroundColor: mixAlpha(colors["color-primary-foreground"], 0.22),
              }}
            />
          </>
        ) : (
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: colors["color-surface-0"],
            }}
          />
        )}
      </Animated.View>
      {options.map((option, index) => {
        const active = option.id === value;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.id)}
            onLayout={(e) => {
              const { x, width } = e.nativeEvent.layout;
              setBoxes((prev) => {
                const next = [...prev];
                // Raw x (padding included) — the container carries no layout
                // border (the ring is an overlay), so the absolutely positioned
                // pill measures from the same origin, no -6 correction.
                next[index] = { x, w: width };
                return next;
              });
            }}
            style={({ pressed }) => [
              {
                flex: 1,
                minWidth: compact ? 0 : 96,
                minHeight: 64,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: 6,
                paddingHorizontal: compact ? 8 : 16,
                paddingVertical: 12,
                borderRadius: 16,
                zIndex: 1,
              },
              pressed && !reduceMotion ? { transform: [{ scale: 0.96 }] } : null,
            ]}
          >
            {option.icon}
            {typeof option.label === "string" ? (
              <Text
                numberOfLines={1}
                style={{
                  color: active
                    ? emphasize
                      ? colors["color-primary-foreground"]
                      : colors["color-text-primary"]
                    : colors["color-text-secondary"],
                  fontSize: compact ? TYPOGRAPHY.label.fontSize : TYPOGRAPHY.body.fontSize,
                  fontWeight: "600",
                }}
              >
                {option.label}
              </Text>
            ) : (
              option.label
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

export default SegmentedControl;
