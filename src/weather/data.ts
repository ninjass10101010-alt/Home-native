import { moonPhase, moonPhaseName, nextMoonEvents } from "./astro";

/** Home-ai weather_location service registry defaults (web parity). */
export const PLACE = { label: "Holland, MI", lat: 42.7875, lon: -86.1089 };

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

// ─── AQI (US EPA bands — the honest, standard ladder) ───
export type AqiCategory = "good" | "moderate" | "usg" | "unhealthy" | "veryUnhealthy" | "hazardous";

/** dotToken = existing accent tokens (no new tokens for EPA semantics). */
export const AQI_META: Record<AqiCategory, { label: string; dotToken: string; kidLine: string }> = {
  good: { label: "Good", dotToken: "color-accent-mint", kidLine: "Great for outdoor play" },
  moderate: { label: "Moderate", dotToken: "color-accent-amber", kidLine: "Usually fine — sensitive kids take it easy" },
  usg: { label: "Unhealthy for sensitive groups", dotToken: "color-accent-apricot", kidLine: "Sensitive groups take it easy" },
  unhealthy: { label: "Unhealthy", dotToken: "color-accent-coral", kidLine: "Everyone should take it easy" },
  veryUnhealthy: { label: "Very unhealthy", dotToken: "color-accent-violet", kidLine: "Stay inside today" },
  hazardous: { label: "Hazardous", dotToken: "color-monster-ink-red", kidLine: "Stay inside — keep windows shut" },
};

export function aqiCategory(aqi: number): AqiCategory {
  if (aqi <= 50) return "good";
  if (aqi <= 100) return "moderate";
  if (aqi <= 150) return "usg";
  if (aqi <= 200) return "unhealthy";
  if (aqi <= 300) return "veryUnhealthy";
  return "hazardous";
}

// ─── Snapshot shape (skin-agnostic; every field nullable/honest) ───
export interface HourCell { label: string; tempF: number; precipPct: number | null; precipIn: number | null; isDay: boolean }
export interface DayCell { key: string; label: string; highF: number | null; lowF: number | null; code: number | null }
export interface AirSnapshot { aqi: number; category: AqiCategory; pm25: number | null }
export interface MoonInfo { phaseName: string; illuminationPct: number; waxing: boolean; nextFullISO: string | null; nextNewISO: string | null }

export interface WeatherSnapshot {
  place: string;
  tempF: number | null; feelsLikeF: number | null; highF: number | null; lowF: number | null;
  condition: string; code: number | null; isDay: boolean;
  updatedAt: number;
  hours: HourCell[];
  days: DayCell[];
  air: AirSnapshot | null;
  moon: MoonInfo;
  outlook: string | null;
  uvIndex: number | null; windMph: number | null; windDirDeg: number | null;
  humidityPct: number | null; precipTodayPct: number | null;
}

const toFinite = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
};
const toFiniteRounded = (v: unknown): number | null => {
  const n = toFinite(v);
  return n === null ? null : Math.round(n);
};

// Outlook — verbatim port of Home-ai WeatherWidget.tsx:125 deriveOutlookInfo
// (already proven on the tablet's emoji widget; identical semantics).
const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);
const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);
const STORM_CODES = new Set([95, 96, 99]);

function formatHourLabel(iso: string): string {
  const h = new Date(iso).getHours();
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12} ${h >= 12 ? "PM" : "AM"}`;
}

function deriveOutlookInfo(hourly: any, condition: string, nowMs: number): string | null {
  const times = hourly?.time;
  const codes = hourly?.weather_code;
  const precip = hourly?.precipitation_probability;
  if (!Array.isArray(times) || !Array.isArray(codes) || !Array.isArray(precip)) return null;
  const start = times.findIndex((t: string) => new Date(t).getTime() >= nowMs - 59 * 60 * 1000);
  if (start === -1) return null;
  const end = Math.min(start + 12, times.length - 1);
  const isPrecipCode = (code: unknown) => typeof code === "number" && (RAIN_CODES.has(code) || SNOW_CODES.has(code));
  let hit = -1;
  for (let i = start + 1; i <= end && hit === -1; i++) {
    if (typeof precip[i] === "number" && (precip[i] as number) >= 50) hit = i;
  }
  for (let i = start + 1; i <= end && hit === -1; i++) {
    if (typeof precip[i] === "number" && (precip[i] as number) >= 30 && isPrecipCode(codes[i])) hit = i;
  }
  for (let i = start + 1; i <= end && hit === -1; i++) {
    if (isPrecipCode(codes[i])) hit = i;
  }
  if (hit !== -1) {
    const when = formatHourLabel(times[hit]);
    if (STORM_CODES.has(codes[hit] as number)) return `Thunderstorms expected around ${when}`;
    if (SNOW_CODES.has(codes[hit] as number)) return `Snow expected around ${when}`;
    return `Rain likely around ${when}`;
  }
  const c = condition.toLowerCase();
  if (c.includes("rain") || c.includes("snow") || c.includes("drizzle") || c.includes("shower") || c.includes("thunder")) {
    return `${condition.charAt(0)}${condition.slice(1).toLowerCase()} for the rest of the day`;
  }
  return "No rain expected today";
}

/**
 * One snapshot per surface mount: forecast + air-quality in parallel.
 * Forecast failure REJECTS (the widget shows the honest failure card);
 * air failure degrades to `air: null` (only the AQI card degrades).
 */
export async function fetchWeather(): Promise<WeatherSnapshot> {
  const forecastUrl =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${PLACE.lat}&longitude=${PLACE.lon}` +
    "&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,is_day,uv_index,cloud_cover,visibility" +
    "&hourly=temperature_2m,weather_code,precipitation_probability,precipitation,is_day" +
    "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset" +
    "&temperature_unit=fahrenheit&timezone=auto&forecast_days=6";
  const airUrl =
    "https://air-quality-api.open-meteo.com/v1/air-quality" +
    `?latitude=${PLACE.lat}&longitude=${PLACE.lon}` +
    "&current=us_aqi,pm2_5,pm10&timezone=auto";

  const [forecast, air] = await Promise.all([
    fetch(forecastUrl, { signal: AbortSignal.timeout(12_000) }).then((r) => {
      if (!r.ok) throw new Error(`weather service ${r.status}`);
      return r.json();
    }),
    fetch(airUrl, { signal: AbortSignal.timeout(12_000) })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
  ]);

  const c = forecast?.current;
  const d = forecast?.daily;
  const h = forecast?.hourly;
  // A missing current temperature is a malformed payload — never a fabricated 0°.
  if (!c || typeof c.temperature_2m !== "number") throw new Error("weather service malformed");

  const nowMs = Date.now();
  const hours: HourCell[] = [];
  if (Array.isArray(h?.time)) {
    const start = h.time.findIndex((t: string) => new Date(t).getTime() >= nowMs - 59 * 60 * 1000);
    for (let i = start === -1 ? 0 : start; i < h.time.length && hours.length < 24; i++) {
      const tempF = toFiniteRounded(h.temperature_2m?.[i]);
      if (tempF === null) continue; // a missing temp must not bend the strip
      hours.push({
        label: new Date(h.time[i]).toLocaleTimeString("en-US", { hour: "numeric" }),
        tempF,
        precipPct: toFiniteRounded(h.precipitation_probability?.[i]),
        precipIn: toFinite(h.precipitation?.[i]),
        isDay: h.is_day?.[i] !== 0,
      });
    }
  }

  const days: DayCell[] = [];
  if (Array.isArray(d?.time)) {
    for (let i = 1; i < d.time.length && days.length < 5; i++) {
      days.push({
        key: String(d.time[i]),
        label: new Date(`${d.time[i]}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" }),
        highF: toFiniteRounded(d.temperature_2m_max?.[i]),
        lowF: toFiniteRounded(d.temperature_2m_min?.[i]),
        code: toFinite(d.weather_code?.[i]),
      });
    }
  }

  const airAqi = toFiniteRounded(air?.current?.us_aqi);
  const airSnapshot: AirSnapshot | null =
    airAqi === null ? null : { aqi: airAqi, category: aqiCategory(airAqi), pm25: toFiniteRounded(air?.current?.pm2_5) };

  const code = toFinite(c.weather_code);
  const condition = (code !== null && WMO_TEXT[code]) || `Conditions code ${code}`;
  const { phase, illumination, waxing } = moonPhase(nowMs);
  const nextEvents = nextMoonEvents(nowMs);

  return {
    place: PLACE.label,
    tempF: toFiniteRounded(c.temperature_2m),
    feelsLikeF: toFiniteRounded(c.apparent_temperature),
    highF: toFiniteRounded(d?.temperature_2m_max?.[0]),
    lowF: toFiniteRounded(d?.temperature_2m_min?.[0]),
    condition,
    code,
    isDay: c.is_day !== 0,
    updatedAt: nowMs,
    hours,
    days,
    air: airSnapshot,
    moon: {
      phaseName: moonPhaseName(phase),
      illuminationPct: Math.round(illumination * 100),
      waxing,
      nextFullISO: nextEvents.nextFullISO,
      nextNewISO: nextEvents.nextNewISO,
    },
    outlook: deriveOutlookInfo(h, condition, nowMs),
    uvIndex: toFinite(c.uv_index),
    windMph: toFiniteRounded(c.wind_speed_10m),
    windDirDeg: toFiniteRounded(c.wind_direction_10m),
    humidityPct: toFiniteRounded(c.relative_humidity_2m),
    precipTodayPct: toFiniteRounded(d?.precipitation_probability_max?.[0]),
  };
}
