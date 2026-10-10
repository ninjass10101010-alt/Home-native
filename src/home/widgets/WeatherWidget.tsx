import React from "react";
import { Text, View } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";
import { TYPOGRAPHY } from "../../theme/tokens";
import { useWidgetData } from "./data";
import { WidgetFrame } from "./WidgetFrame";

/** WMO code → condition text (verbatim from Home-ai src/lib/weather-live.ts:8-19). */
const WMO_TEXT: Record<number, string> = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Fog", 48: "Freezing fog", 51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
  61: "Light rain", 63: "Rain", 65: "Heavy rain", 66: "Freezing rain", 67: "Heavy freezing rain",
  71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow grains",
  80: "Rain showers", 81: "Showers", 82: "Violent showers",
  85: "Snow showers", 86: "Heavy snow showers",
  95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Severe thunderstorm with hail",
};

/** WMO class → the house's emoji glyph language (no paid icon sets, per PRODUCT). */
function wmoEmoji(code: number | undefined, isDay: boolean): string {
  if (code == null) return "🌡️";
  if (code === 0 || code === 1) return isDay ? "☀️" : "🌙";
  if (code === 2) return isDay ? "⛅" : "☁️";
  if (code === 3) return "☁️";
  if (code === 45 || code === 48) return "🌫️";
  if (code >= 51 && code <= 57) return "🌦️";
  if (code >= 61 && code <= 67) return "🌧️";
  if (code >= 71 && code <= 77) return "🌨️";
  if (code >= 80 && code <= 82) return "🌦️";
  if (code >= 85 && code <= 86) return "🌨️";
  if (code >= 95) return "⛈️";
  return "🌡️";
}

const LAT = 42.7875; // Home-ai defaults (weather_location service registry; Holland, MI)
const LON = -86.1089;
const LOCATION_LABEL = "Holland, MI"; // web: src/lib/weather-config.ts:18

export interface WeatherSnapshot {
  tempF: number | null;
  feelsLikeF: number | null;
  highF: number | null;
  lowF: number | null;
  condition: string;
  emoji: string;
  isDay: boolean;
  updatedAt: number;
  /** Next ~6 hours from now: local-hour label, temp, precip%. */
  hours: { label: string; tempF: number; precip: number | null }[];
}

function fetchWeather(): Promise<WeatherSnapshot> {
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${LAT}&longitude=${LON}` +
    "&current=temperature_2m,apparent_temperature,weather_code,is_day" +
    "&hourly=temperature_2m,weather_code,precipitation_probability,is_day" +
    "&daily=temperature_2m_max,temperature_2m_min" +
    "&temperature_unit=fahrenheit&timezone=auto&forecast_days=2";
  return fetch(url, { signal: AbortSignal.timeout(12_000) }) // web parity: never hang the refresher (WeatherWidget.tsx:632)
    .then((r) => {
      if (!r.ok) throw new Error(`weather service ${r.status}`);
      return r.json();
    })
    .then((j: any) => {
      const c = j?.current;
      const d = j?.daily;
      const h = j?.hourly;
      if (!c || typeof c.temperature_2m !== "number") {
        throw new Error("weather service malformed"); // no fabricated 0° readings (weather-live.ts parity)
      }
      const nowMs = Date.now();
      const hours: WeatherSnapshot["hours"] = [];
      if (Array.isArray(h?.time)) {
        const start = h.time.findIndex((t: string) => new Date(t).getTime() >= nowMs - 59 * 60 * 1000);
        for (let i = start === -1 ? 0 : start; i < h.time.length && hours.length < 6; i++) {
          if (typeof h.temperature_2m?.[i] !== "number") continue; // a missing temp must not bend the strip
          const label = new Date(h.time[i]).toLocaleTimeString("en-US", { hour: "numeric" });
          hours.push({
            label,
            tempF: Math.round(h.temperature_2m[i]),
            precip: typeof h.precipitation_probability?.[i] === "number" ? h.precipitation_probability[i] : null,
          });
        }
      }
      const toFinite = (v: unknown): number | null => {
        const n = typeof v === "number" ? v : NaN;
        return Number.isFinite(n) ? Math.round(n) : null;
      };
      const code = typeof c.weather_code === "number" ? c.weather_code : undefined;
      return {
        tempF: toFinite(c.temperature_2m),
        feelsLikeF: toFinite(c.apparent_temperature),
        highF: toFinite(d?.temperature_2m_max?.[0]),
        lowF: toFinite(d?.temperature_2m_min?.[0]),
        condition: WMO_TEXT[code ?? -1] ?? `Conditions code ${code}`,
        emoji: wmoEmoji(code, c.is_day !== 0),
        isDay: c.is_day !== 0,
        updatedAt: Date.now(),
        hours,
      };
    });
}

/**
 * Wall weather hero (Wave 1 core): condition + big temp, H:/L: + feels note,
 * hourly strip, Updated footnote. The web's clay/monster artwork and Details
 * page are their own surfaces (Wave 2+); the Details affordance here is the
 * honest copy. Open-Meteo is called CLIENT-DIRECT — the same free API the web
 * widget uses (verified: docs/wave1-endpoints.md); no server proxy involved.
 */
export function WeatherWidget() {
  const { colors } = useTheme();
  const { status, data, failure, stale, retry } = useWidgetData<WeatherSnapshot>(fetchWeather, {
    guestVisible: true, // Open-Meteo is public; the guest wall sees weather (reference parity)
  });

  const updated = data ? new Date(data.updatedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : null;
  const feelsNote = data?.feelsLikeF != null ? `Feels like ${data.feelsLikeF}°` : "";

  return (
    <WidgetFrame
      id="weather"
      icon="⛅"
      title="Weather"
      status={status}
      failure={failure}
      hasData={data !== null}
      stale={stale}
      onRetry={retry}
    >
      {data ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "600" }}>
            📍 {LOCATION_LABEL}
          </Text>
          <Text style={{ fontSize: 52, lineHeight: 58 }}>{data.emoji}</Text>
          <Text
            testID="wx-hero-temp"
            style={{ color: colors["color-text-primary"], fontSize: 64, fontWeight: "900", lineHeight: 70 }}
          >
            {data.tempF ?? "—"}°
          </Text>
          <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "600" }}>
            {data.condition}
          </Text>
          <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }}>
            {data.highF != null ? `H:${data.highF}°` : ""} {data.lowF != null ? `L:${data.lowF}°` : ""}
            {feelsNote ? ` · ${feelsNote}` : ""}
          </Text>

          <View style={{ flexDirection: "row", gap: 12, marginTop: 10 }} testID="wx-hourly-strip">
            {data.hours.map((h, i) => (
              <View key={`${h.label}-${i}`} style={{ alignItems: "center", gap: 2 }}>
                <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }}>{h.label}</Text>
                <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
                  {h.tempF}°
                </Text>
                {h.precip != null && h.precip >= 30 ? (
                  <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }}>
                    💧{Math.round(h.precip)}%
                  </Text>
                ) : null}
              </View>
            ))}
          </View>

          {updated ? (
            <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize, marginTop: 6 }}>
              Updated {updated}
            </Text>
          ) : null}
        </View>
      ) : null}
    </WidgetFrame>
  );
}

export default WeatherWidget;
