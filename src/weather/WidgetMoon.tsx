// Home-native/src/weather/WidgetMoon.tsx
import React from "react";
import { Text, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { mix } from "../theme/mix";
import { RADII, TYPOGRAPHY } from "../theme/tokens";
import { MoonDisc } from "./art";
import { moonPhase } from "./astro";
import type { WeatherSnapshot } from "./data";
import { WX_LABEL } from "./language";

const prettyDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** Leader row: label left, hairline fill, value right (the reference's
 *  leader-dot grammar; a solid hairline because RN dotted borders are
 *  unreliable on Android — an honest simplification, noted here). */
function LeaderRow({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 }}>
      <Text style={[WX_LABEL, { color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }]}>{label}</Text>
      <View style={{ flex: 1, height: 2, backgroundColor: mix(colors["color-text-primary"], "transparent", 22) }} />
      <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>{value}</Text>
    </View>
  );
}

/** Moon phase card — lit-limb disc, phase name + illumination, next full/new. */
export function WeatherMoon({ data }: { data: WeatherSnapshot }) {
  const { colors } = useTheme();
  const { phase } = moonPhase(data.updatedAt);
  return (
    <View
      testID="wx-moon-card"
      style={{ borderRadius: RADII.lg, padding: 18, gap: 12, backgroundColor: colors["color-surface-1"], borderWidth: 1, borderColor: colors["color-border"] ?? "transparent" }}
    >
      <Text style={[WX_LABEL, { color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }]}>Moon</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 20 }}>
        <MoonDisc phase={phase} size={160} />
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.stat.fontSize, fontWeight: "700" }}>
            {data.moon.phaseName}
          </Text>
          <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.body.fontSize }}>
            {data.moon.illuminationPct}% illuminated · {data.moon.waxing ? "Waxing" : "Waning"}
          </Text>
        </View>
      </View>
      {data.moon.nextFullISO ? <LeaderRow label="Next full moon" value={prettyDate(data.moon.nextFullISO)} /> : null}
      {data.moon.nextNewISO ? <LeaderRow label="Next new moon" value={prettyDate(data.moon.nextNewISO)} /> : null}
    </View>
  );
}
