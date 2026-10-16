import React from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../../theme/ThemeProvider";
import { TYPOGRAPHY } from "../../theme/tokens";
import { mix } from "../../theme/mix";
import { WidgetFrame } from "./WidgetFrame";

const QUICK_PROMPTS = [
  "What's running low?",
  "Any calendar conflicts?",
  "What chores are pending?",
] as const;

export function QuickAskWidget() {
  const { colors, accentColor } = useTheme();
  const router = useRouter();
  const violet = colors["color-accent-violet"] ?? accentColor;

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
      <View style={{ flex: 1, justifyContent: "space-between", alignItems: "center", paddingVertical: 2 }}>
        <Pressable
          testID="quickask-open"
          accessibilityRole="link"
          accessibilityLabel="Open Ask: Add soccer practice for Thursday."
          onPress={() => router.push("/chat" as never)}
          style={{ alignItems: "center", paddingVertical: 4 }}
        >
          <Text
            style={{
              color: colors["color-text-primary"],
              fontSize: TYPOGRAPHY.body.fontSize,
              fontWeight: "700",
              textAlign: "center",
            }}
          >
            “Add soccer practice for Thursday.” →
          </Text>
          <Text
            style={{
              color: violet,
              fontSize: TYPOGRAPHY.label.fontSize,
              fontWeight: "700",
              marginTop: 2,
            }}
          >
            Open Ask →
          </Text>
        </Pressable>

        <View style={{ alignItems: "center", gap: 6, width: "100%" }}>
          {QUICK_PROMPTS.map((p) => (
            <Pressable
              key={p}
              testID={`quickask-chip-${p}`}
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => router.push(`/chat?prompt=${encodeURIComponent(p)}` as never)}
              style={{
                borderRadius: 999,
                minHeight: 36,
                paddingHorizontal: 14,
                paddingVertical: 6,
                backgroundColor: mix(violet, "transparent", 16),
                borderWidth: 1,
                borderColor: mix(violet, "transparent", 34),
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  color: colors["color-text-primary"],
                  fontSize: TYPOGRAPHY.label.fontSize,
                  fontWeight: "600",
                }}
              >
                {p}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </WidgetFrame>
  );
}

export default QuickAskWidget;
