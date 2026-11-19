import React from "react";
import { Pressable, Text, View, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useTheme } from "../theme/ThemeProvider";
import { MIN_TARGET_DP, MOTION, PRESS_IN_MS, SPRING, TYPOGRAPHY } from "../theme/tokens";
import { hapticTap } from "../theme/haptics";
import { mixAlpha } from "./SoftButton";

export interface ListRowProps {
  leading?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
  /** Left rail accent (member color etc.) — a token-derived color string. */
  leftRailColor?: string;
  onPress?: () => void;
  showDisclosure?: boolean;
  style?: ViewStyle;
  testID?: string;
  accessibilityLabel?: string;
}

/** Icon-badge well (reference ui/ListRow.tsx: 44px at web scale — the wall
 *  keeps it at 44dp inside a ≥64dp row). */
const LEADING_BADGE_DP = 44;

/**
 * RN port of ui/ListRow.tsx at wall scale: row ≥64dp, title 16sp semibold,
 * subtitle at the 14sp floor. Pressable rows use a subtle tap response instead
 * of the web's hover fill.
 */
export function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  leftRailColor,
  onPress,
  showDisclosure = false,
  style,
  testID,
  accessibilityLabel,
}: ListRowProps) {
  const { colors, accentColor, reduceMotion } = useTheme();
  const scale = useSharedValue(1);
  const highlight = useSharedValue(0);
  const rowAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const highlightStyle = useAnimatedStyle(() => ({
    opacity: highlight.value,
  }));

  const inner = (
    <>
      {leftRailColor ? (
        <View
          style={{
            position: "absolute",
            // inset 6/14 so the row's borderRadius 20 never slices the rail
            // at an angle
            left: 6,
            top: 14,
            bottom: 14,
            width: 4,
            borderRadius: 2,
            backgroundColor: leftRailColor,
          }}
        />
      ) : null}
      {leading ? (
        React.isValidElement(leading) &&
        typeof (leading.props as { style?: { width?: unknown; backgroundColor?: unknown } })?.style === "object" &&
        (leading.props as { style?: { width?: unknown; backgroundColor?: unknown } })?.style !== null &&
        typeof (leading.props as { style?: { width?: unknown; backgroundColor?: unknown } }).style?.width === "number" &&
        typeof (leading.props as { style?: { width?: unknown; backgroundColor?: unknown } }).style?.backgroundColor === "string" ? (
          <View testID="listrow-leading-badge">{leading}</View>
        ) : (
          /* The reference seats `leading` in a 44dp tinted circle (badge fill +
             ring), not bare. A bare emoji glyph reads as text, not as an icon
             well — and a 28sp glyph with no plate crowds the row's rhythm. */
          <View
            style={{
              width: LEADING_BADGE_DP,
              height: LEADING_BADGE_DP,
              borderRadius: LEADING_BADGE_DP / 2,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: mixAlpha(leftRailColor ?? accentColor, 0.16),
              borderWidth: 1,
              borderColor: mixAlpha(leftRailColor ?? accentColor, 0.28),
            }}
            testID="listrow-leading-badge"
          >
            {leading}
          </View>
        )
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        {typeof title === "string" ? (
          <Text
            numberOfLines={1}
            style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "600" }}
          >
            {title}
          </Text>
        ) : (
          title
        )}
        {subtitle ? (
          typeof subtitle === "string" ? (
            <Text
              numberOfLines={1}
              style={{ marginTop: 2, color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize }}
            >
              {subtitle}
            </Text>
          ) : (
            subtitle
          )
        ) : null}
      </View>
      {trailing ? <View>{trailing}</View> : null}
      {showDisclosure ? (
        <Text style={{ color: colors["color-text-muted"], fontSize: 20 }}>›</Text>
      ) : null}
    </>
  );

  const base: ViewStyle = {
    minHeight: MIN_TARGET_DP,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors["color-border"] ?? "transparent",
    // web parity: bg-[var(--color-surface-0)]/30 — a wash, not a solid card
    backgroundColor: mixAlpha(colors["color-surface-0"], 0.3),
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    overflow: "hidden",
  };

  if (!onPress) {
    return (
      <View testID={testID} accessibilityLabel={accessibilityLabel} style={[base, style]}>
        {inner}
      </View>
    );
  }
  return (
    <Animated.View style={rowAnimStyle}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={() => {
          hapticTap();
          onPress();
        }}
        onPressIn={() => {
          if (reduceMotion) return;
          // eslint-disable-next-line react-hooks/immutability -- Reanimated shared-value write
          scale.value = withTiming(0.985, { duration: PRESS_IN_MS });
          // eslint-disable-next-line react-hooks/immutability -- Reanimated shared-value write
          highlight.value = withTiming(1, { duration: PRESS_IN_MS });
        }}
        onPressOut={() => {
          // eslint-disable-next-line react-hooks/immutability -- Reanimated shared-value write
          scale.value = reduceMotion ? 1 : withSpring(1, SPRING.press);
          // eslint-disable-next-line react-hooks/immutability -- Reanimated shared-value write
          highlight.value = reduceMotion ? 0 : withTiming(0, { duration: MOTION.fast });
        }}
        style={[base, style]}
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
              backgroundColor: mixAlpha(leftRailColor ?? accentColor, 0.08),
            },
            highlightStyle,
          ]}
        />
        {inner}
      </Pressable>
    </Animated.View>
  );
}

export default ListRow;
