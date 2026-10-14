// Home-native/src/weather/WidgetTimeline.tsx
import React from "react";
import { ScrollView, Text, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { RADII, TYPOGRAPHY } from "../theme/tokens";
import { MonsterDigit } from "./art";
import { conditionCode } from "./conditions";
import type { WeatherSnapshot } from "./data";
import { useMonsterInk, CONDITION_TONE, WX_LABEL } from "./language";

/** "NEXT 24 HOURS" — glanceable strip; the now-cell fills with the condition
 *  tone (the reference's cyan now-block, monster-mapped). No scrubbing: a
 *  10-foot UI reads, it doesn't drag. */
export function WeatherTimeline({ data }: { data: WeatherSnapshot }) {
  const { colors } = useTheme();
  const ink = useMonsterInk();
  const soft = colors["color-text-secondary"];
  const nowCode = conditionCode(data.code ?? undefined, data.isDay);
  const tone = ink[CONDITION_TONE[nowCode]];
  return (
    <View
      testID="wx-timeline-card"
      style={{ borderRadius: RADII.lg, padding: 18, gap: 12, backgroundColor: colors["color-surface-1"], borderWidth: 1, borderColor: colors["color-border"] ?? "transparent" }}
    >
      <Text style={[WX_LABEL, { color: soft, fontSize: TYPOGRAPHY.label.fontSize }]}>Next 24 hours</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 8 }}>
        {data.hours.map((h, i) => {
          const isNow = i === 0;
          return (
            <View
              key={`${h.label}-${i}`}
              testID={isNow ? "wx-timeline-now" : `wx-timeline-cell-${i}`}
              style={{
                alignItems: "center",
                gap: 4,
                minWidth: 76,
                paddingVertical: 10,
                borderRadius: RADII.md,
                paddingHorizontal: 8,
                backgroundColor: isNow ? tone : "transparent",
              }}
            >
              <Text style={{ color: isNow ? colors["color-surface-0"] : soft, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
                {isNow ? "NOW" : h.label}
              </Text>
              <View style={{ flexDirection: "row" }}>
                {String(h.tempF).split("").map((d, j) => (
                  <MonsterDigit key={j} digit={d} height={36} />
                ))}
              </View>
              <Text style={{ color: isNow ? colors["color-surface-0"] : soft, fontSize: TYPOGRAPHY.label.fontSize }}>
                {h.precipPct != null && h.precipPct >= 30 ? `${h.precipPct}%` : ""}
              </Text>
            </View>
          );
        })}
      </ScrollView>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: soft, fontSize: TYPOGRAPHY.label.fontSize }}>Rain chance under each hour</Text>
      </View>
    </View>
  );
}
