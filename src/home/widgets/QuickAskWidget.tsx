import React from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../../theme/ThemeProvider";
import { TYPOGRAPHY } from "../../theme/tokens";
import { WidgetFrame } from "./WidgetFrame";

const PROMPTS = ["🍽️ Tonight's dinner", "✅ Open chores", "📅 Today's schedule"] as const;

export function QuickAskWidget() {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <WidgetFrame
      id="aiQuickAsk"
      icon="💬"
      title="Quick ask"
      description="Send a question to Consuela"
      status="ready"
      failure={null}
      hasData
      stale={false}
      onRetry={() => {}}
    >
      <View style={{ flex: 1, justifyContent: "center", gap: 8 }}>
        {PROMPTS.map((p) => (
          <Pressable
            key={p}
            testID={`quickask-chip-${p}`}
            accessibilityRole="button"
            onPress={() => router.push(`/chat?prompt=${encodeURIComponent(p)}` as never)}
            style={{ minHeight: 64, borderRadius: 12, borderWidth: 1, borderColor: colors["color-border"] ?? "transparent", paddingHorizontal: 12, justifyContent: "center" }}
          >
            <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "600" }}>
              {p}
            </Text>
          </Pressable>
        ))}
        <Pressable
          testID="quickask-open"
          accessibilityRole="link"
          onPress={() => router.push("/chat" as never)}
          style={{ minHeight: 44, justifyContent: "center", alignItems: "center" }}
        >
          <Text style={{ color: colors["color-accent-selected"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
            Open Ask →
          </Text>
        </Pressable>
      </View>
    </WidgetFrame>
  );
}

export default QuickAskWidget;
