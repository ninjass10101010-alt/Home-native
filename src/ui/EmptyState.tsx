import React from "react";
import { Text, View, ViewStyle } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { TYPOGRAPHY } from "../theme/tokens";
import { SoftButton } from "./SoftButton";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Drop the chrome (border/fill/min-height) when nested inside a card body. */
  flat?: boolean;
  style?: ViewStyle;
  testID?: string;
}

/**
 * RN port of ui/EmptyState.tsx. 30px-scale emoji glyph above the title; the
 * caption sits at the 14sp floor in secondary ink; the action (if any) is a
 * SoftButton. `flat` drops the bordered glass chrome for the nested case.
 */
export function EmptyState({ icon = "✨", title, body, actionLabel, onAction, flat = false, style, testID }: EmptyStateProps) {
  const { colors } = useTheme();
  return (
    <View
      testID={testID}
      style={[
        {
          alignItems: "center",
          justifyContent: "center",
          minHeight: flat ? 0 : 224,
          padding: flat ? 8 : 32,
          borderRadius: 20,
        },
        !flat && {
          borderWidth: 1,
          borderColor: colors["color-border"] ?? "transparent",
          backgroundColor: colors["color-surface-0"],
        },
        style,
      ]}
    >
      <Text style={{ fontSize: 30, lineHeight: 36, marginBottom: 16 }}>{icon}</Text>
      <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.title.fontSize, fontWeight: "700" }}>
        {title}
      </Text>
      {body ? (
        <Text
          style={{
            marginTop: 8,
            maxWidth: 320,
            textAlign: "center",
            color: colors["color-text-secondary"],
            fontSize: TYPOGRAPHY.label.fontSize,
            lineHeight: TYPOGRAPHY.label.lineHeight,
          }}
        >
          {body}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <SoftButton onPress={onAction} size="md" style={{ marginTop: 20 }}>
          {actionLabel}
        </SoftButton>
      ) : null}
    </View>
  );
}

export default EmptyState;
