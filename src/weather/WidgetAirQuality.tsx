// Home-native/src/weather/WidgetAirQuality.tsx
import React from "react";
import { Text, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { RADII, TYPOGRAPHY } from "../theme/tokens";
import { AirVaneMonster, MonsterDigit } from "./art";
import { AQI_META, type WeatherSnapshot } from "./data";
import { WX_LABEL } from "./language";

/** AIR QUALITY — MonsterDigit score, EPA category + dot, PM2.5, the honest
 *  kid line, and the 3D Air Anemometer & Weathervane Monster (Mobbin video
 *  00:33–00:36). Null air degrades inline; the rest of the gallery stays live. */
export function WeatherAirQuality({ data }: { data: WeatherSnapshot }) {
  const { colors } = useTheme();
  const primary = colors["color-text-primary"];
  const soft = colors["color-text-secondary"];
  const air = data.air;
  return (
    <View
      testID="wx-aqi-card"
      style={{ borderRadius: RADII.lg, padding: 18, gap: 10, backgroundColor: colors["color-surface-1"], borderWidth: 1, borderColor: colors["color-border"] ?? "transparent" }}
    >
      <Text style={[WX_LABEL, { color: soft, fontSize: TYPOGRAPHY.label.fontSize }]}>Air quality</Text>
      {air ? (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 16, flex: 1 }}>
              <View style={{ flexDirection: "row" }}>
                {String(air.aqi).split("").map((d, i) => (
                  <MonsterDigit key={i} digit={d} height={140} />
                ))}
              </View>
              <View style={{ gap: 4, flexShrink: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View testID="wx-aqi-dot" style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: colors[AQI_META[air.category].dotToken] ?? soft }} />
                  <Text style={{ color: primary, fontSize: TYPOGRAPHY.title.fontSize, fontWeight: "700" }}>{AQI_META[air.category].label}</Text>
                </View>
                {air.pm25 != null ? (
                  <Text style={{ color: soft, fontSize: TYPOGRAPHY.label.fontSize }}>PM2.5 {air.pm25}</Text>
                ) : null}
                {data.windMph != null ? (
                  <Text style={{ color: soft, fontSize: TYPOGRAPHY.label.fontSize }}>Wind {data.windMph} mph</Text>
                ) : null}
              </View>
            </View>
            <AirVaneMonster size={116} />
          </View>
          <Text style={{ color: primary, fontSize: TYPOGRAPHY.body.fontSize }}>{AQI_META[air.category].kidLine}</Text>
        </>
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <Text style={{ color: soft, fontSize: TYPOGRAPHY.body.fontSize, flex: 1 }}>{"Couldn't load air quality right now."}</Text>
          <AirVaneMonster size={96} />
        </View>
      )}
    </View>
  );
}
