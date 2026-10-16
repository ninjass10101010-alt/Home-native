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
  const { colors, accentColor } = useTheme();

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
