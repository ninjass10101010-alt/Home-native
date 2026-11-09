import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { ACCENTS, MIN_TARGET_DP, RADII, TYPOGRAPHY } from "../theme/tokens";
import { accentDeepened, mix } from "../theme/mix";
import { Material } from "../theme/Material";
import { computeWeatherDressAdvice } from "./dress-advisor";
import type { WeatherSnapshot } from "./data";

export interface DressAdvisorCardProps {
  data: WeatherSnapshot;
}

/**
 * Weather Dress & Gear Advisor Card.
 *
 * Translates current weather and forecast into actionable outfit, gear, and
 * outdoor play advice for kids and families. Provides interactive check-off
 * pills so kids can check off gear (coat, umbrella, shoes) as they get ready.
 */
export function DressAdvisorCard({ data }: DressAdvisorCardProps) {
  const { theme, colors, accentColor } = useTheme();
  const accents = ACCENTS[theme === "light" ? "light" : "dark"];
  const advice = useMemo(() => computeWeatherDressAdvice(data), [data]);
  const [checkedIds, setCheckedIds] = useState<Record<string, boolean>>({});

  const toggleItem = (id: string) => {
    setCheckedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const totalCount = advice.items.length;
  const readyCount = advice.items.filter((item) => checkedIds[item.id]).length;
  const allReady = totalCount > 0 && readyCount === totalCount;

  return (
    <Material
      testID="wx-dress-advisor"
      tier="regular"
      tone={accents.mint ?? accentColor}
      style={{
        borderRadius: RADII.lg,
        padding: 18,
        gap: 14,
      }}
    >
      {/* Header section */}
      <View style={{ gap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text
            style={{
              color: colors["color-text-secondary"],
              fontSize: TYPOGRAPHY.label.fontSize,
              fontWeight: "700",
              letterSpacing: 1.2,
              textTransform: "uppercase",
            }}
          >
            Weather Dress & Gear Advisor
          </Text>
          <View
            testID="wx-dress-progress"
            style={{
              paddingHorizontal: 12,
              paddingVertical: 4,
              borderRadius: RADII.pill,
              backgroundColor: mix(allReady ? accents.mint : accents.amber, "transparent", 20),
              borderWidth: 1,
              borderColor: mix(allReady ? accents.mint : accents.amber, "transparent", 40),
            }}
          >
            <Text
              style={{
                color: allReady ? accents.mint : accents.amber,
                fontSize: TYPOGRAPHY.label.fontSize,
                fontWeight: "700",
              }}
            >
              {allReady ? "All Set! 🎉" : `${readyCount} / ${totalCount} Ready`}
            </Text>
          </View>
        </View>
        <Text
          style={{
            color: colors["color-text-primary"],
            fontSize: TYPOGRAPHY.title.fontSize,
            fontWeight: "700",
          }}
        >
          {advice.headline}
        </Text>
        <Text
          style={{
            color: colors["color-text-secondary"],
            fontSize: TYPOGRAPHY.body.fontSize,
          }}
        >
          {advice.summaryLine}
        </Text>
      </View>

      {/* Interactive check-off items */}
      <View style={{ gap: 10 }}>
        {advice.items.map((item) => {
          const isChecked = !!checkedIds[item.id];
          const toneColor = accents[item.tone] ?? accentColor;
          const readyBg = accentDeepened(toneColor, 40);
          const readyText = colors["color-primary-foreground"] ?? colors["color-text-primary"];

          return (
            <Pressable
              key={item.id}
              testID={`wx-dress-item-${item.id}`}
              accessible={true}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isChecked }}
              accessibilityLabel={`${item.title}: ${isChecked ? "Ready" : item.subtitle}`}
              onPress={() => toggleItem(item.id)}
              style={({ pressed }) => ({
                minHeight: MIN_TARGET_DP,
                minWidth: MIN_TARGET_DP,
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderRadius: RADII.md,
                gap: 14,
                borderWidth: 1,
                borderColor: isChecked
                  ? mix(toneColor, "transparent", 65)
                  : mix(colors["color-border"] ?? colors["color-text-secondary"], "transparent", 40),
                backgroundColor: isChecked
                  ? mix(toneColor, "transparent", 18)
                  : mix(colors["color-surface-2"] ?? colors["color-surface-1"], "transparent", pressed ? 70 : 40),
                opacity: pressed ? 0.85 : 1,
              })}
            >
              {/* Emoji Badge */}
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: mix(toneColor, "transparent", isChecked ? 32 : 16),
                }}
              >
                <Text style={{ fontSize: 26 }}>{item.emoji}</Text>
              </View>

              {/* Title & Subtitle */}
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  style={{
                    color: colors["color-text-primary"],
                    fontSize: TYPOGRAPHY.body.fontSize,
                    fontWeight: "600",
                    textDecorationLine: isChecked ? "line-through" : "none",
                  }}
                >
                  {item.title}
                </Text>
                <Text
                  style={{
                    color: colors["color-text-secondary"],
                    fontSize: TYPOGRAPHY.label.fontSize,
                  }}
                >
                  {item.subtitle}
                </Text>
              </View>

              {/* Ready status pill */}
              <View
                testID={`wx-dress-status-${item.id}`}
                style={{
                  minHeight: 40,
                  paddingHorizontal: 14,
                  borderRadius: RADII.pill,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isChecked ? readyBg : mix(colors["color-text-primary"], "transparent", 8),
                  borderWidth: 1,
                  borderColor: isChecked ? mix(toneColor, "transparent", 80) : "transparent",
                }}
              >
                <Text
                  style={{
                    color: isChecked ? readyText : colors["color-text-secondary"],
                    fontSize: TYPOGRAPHY.label.fontSize,
                    fontWeight: "700",
                  }}
                >
                  {isChecked ? "✓ Ready!" : "Get ready"}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </Material>
  );
}
