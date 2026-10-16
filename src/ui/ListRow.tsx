import React from "react";
import { Pressable, Text, View, ViewStyle } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { TYPOGRAPHY, MIN_TARGET_DP } from "../theme/tokens";
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
  const { colors } = useTheme();

  const inner = (
    <>
      {leftRailColor ? (
        <View
          style={{
            position: "absolute",
            left: 0,
            top: 12,
            bottom: 12,
            width: 4,
            borderRadius: 2,
            backgroundColor: leftRailColor,
          }}
        />
      ) : null}
      {leading ? <View>{leading}</View> : null}
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
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [base, { opacity: pressed ? 0.85 : 1 }, style]}
    >
      {inner}
    </Pressable>
  );
}

export default ListRow;
