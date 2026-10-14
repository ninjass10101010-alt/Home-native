/** Shared Open-Meteo fixtures for the weather suites (hourly starts 1h back). */
const today = new Date();
export const hh = (offset: number) => {
  const d = new Date(today.getTime() + offset * 3600_000);
  return d.toISOString().slice(0, 16);
};
export const dayISO = (offset: number) => {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const hourRange = (n: number) => Array.from({ length: n }, (_, i) => i);

export const FORECAST_PAYLOAD = {
  current: {
    temperature_2m: 63.4, relative_humidity_2m: 62, apparent_temperature: 60.1,
    weather_code: 61, wind_speed_10m: 8.2, wind_direction_10m: 152, is_day: 1,
    uv_index: 3.2, cloud_cover: 80, visibility: 12000,
  },
  hourly: {
    time: [...hourRange(26).map((i) => hh(i - 1))],
    temperature_2m: [...hourRange(26).map((i) => 60 + (i % 5))],
    weather_code: [...hourRange(26).map((i) => (i % 4 === 0 ? 61 : 2))],
    precipitation_probability: [...hourRange(26).map((i) => (i === 2 ? 55 : i % 7 === 0 ? 40 : 5))],
    precipitation: [...hourRange(26).map((i) => (i === 2 ? 0.8 : 0))],
    is_day: [...hourRange(26).map(() => 1)],
  },
  daily: {
    time: [...hourRange(6).map((i) => dayISO(i))],
    weather_code: [61, 2, 0, 3, 71, 95],
    temperature_2m_max: [66, 68, 71, 64, 58, 55],
    temperature_2m_min: [45, 47, 50, 48, 42, 40],
    precipitation_probability_max: [80, 20, 0, 10, 60, 90],
    sunrise: [...hourRange(6).map(() => "2026-10-13T07:30")],
    sunset: [...hourRange(6).map(() => "2026-10-13T18:45")],
  },
};

export const AIR_PAYLOAD = { current: { us_aqi: 59, pm2_5: 12.4, pm10: 20.1 } };

/** fetch mock: routes by URL — air-quality returns AIR_PAYLOAD (or a failure). */
export function mockWeatherFetch(opts: { airFails?: boolean; airMissing?: boolean } = {}) {
  return jest.fn(async (url: string | URL | RequestInfo) => {
    const u = String(url);
    if (u.includes("air-quality")) {
      if (opts.airFails) return { ok: false, status: 503, json: async () => ({}) };
      if (opts.airMissing) return { ok: true, json: async () => ({ current: { pm2_5: 12.4 } }) };
      return { ok: true, json: async () => AIR_PAYLOAD };
    }
    return { ok: true, json: async () => FORECAST_PAYLOAD };
  });
}
