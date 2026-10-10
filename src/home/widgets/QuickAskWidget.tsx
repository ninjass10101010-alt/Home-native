import React from "react";
import { Text, View } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";
import { TYPOGRAPHY } from "../../theme/tokens";
import { WidgetFrame } from "./WidgetFrame";

/**
 * Quick Ask tile — the honest v2 placeholder (chat ships in v2 per the spec's
 * scope lock). No dead affordance: the card tells the family exactly when Ask
 * arrives instead of faking an input.
 */
export function QuickAskWidget() {
  const { colors } = useTheme();
  return (
    <WidgetFrame
      id="aiQuickAsk"
      icon="💬"
      title="Ask Consuela"
      status="ready"
      failure={null}
      hasData
      stale={false}
      onRetry={() => {}}
    >
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 6 }}>
        <Text style={{ fontSize: 34 }}>💬</Text>
        <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "600" }}>
          Ask Consuela on the wall
        </Text>
        <Text
          style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, textAlign: "center" }}
        >
          Arrives with chat in the next wave — until then, the phone has the full Ask.
        </Text>
      </View>
    </WidgetFrame>
  );
}
