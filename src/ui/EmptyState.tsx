import React from "react";
import { Text, View, ViewStyle } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { TYPOGRAPHY } from "../theme/tokens";
import { Material } from "../theme/Material";
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
 * SoftButton. `flat` drops the bordered glass chrome for the nested case;
 * the chrome itself routes through Material (thin) — one frosted surface,
 * the same tier as the web's backdrop-blur-xl box.
 */
export function EmptyState({ icon = "✨", title, body, actionLabel, onAction, flat = false, style, testID }: EmptyStateProps) {
  const { colors } = useTheme();
  // `flat` = inside a bento cell (279dp) — compact rhythm so the empty state
  // fits the 185dp body; the standalone chrome keeps the roomier scale.
  const content = (
    <>
      <Text style={{ fontSize: 30, lineHeight: 36, marginBottom: flat ? 6 : 16 }}>{icon}</Text>
      <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.title.fontSize, fontWeight: "700" }}>
        {title}
      </Text>
      {body ? (
        <Text
          style={{
            marginTop: flat ? 4 : 8,
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
        <SoftButton onPress={onAction} size={flat ? "sm" : "md"} style={{ marginTop: flat ? 10 : 20 }}>
          {actionLabel}
        </SoftButton>
      ) : null}
    </>
  );

  if (flat) {
    return (
      <View
        testID={testID}
        style={[
          {
            alignItems: "center",
            justifyContent: "center",
            minHeight: 0,
            padding: 8,
            borderRadius: 20,
          },
          style,
        ]}
      >
        {content}
      </View>
    );
  }
  return (
    <Material
      tier="thin"
      testID={testID}
      style={[
        {
          alignItems: "center",
          justifyContent: "center",
          minHeight: 224,
          padding: 32,
          borderRadius: 20,
        },
        style,
      ]}
    >
      {content}
    </Material>
  );
}

export default EmptyState;
