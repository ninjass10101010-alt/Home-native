/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factory */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { aqiCategory, fetchWeather, PLACE, WEATHER_STORAGE_KEY, type WeatherSnapshot } from "../../src/weather/data";
import { FORECAST_PAYLOAD, mockWeatherFetch } from "./fixtures";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

describe("aqiCategory (EPA bands)", () => {
  it("pins the boundaries", () => {
    expect(aqiCategory(0)).toBe("good");
    expect(aqiCategory(50)).toBe("good");
    expect(aqiCategory(51)).toBe("moderate");
    expect(aqiCategory(100)).toBe("moderate");
    expect(aqiCategory(101)).toBe("usg");
    expect(aqiCategory(150)).toBe("usg");
    expect(aqiCategory(151)).toBe("unhealthy");
    expect(aqiCategory(200)).toBe("unhealthy");
    expect(aqiCategory(201)).toBe("veryUnhealthy");
    expect(aqiCategory(300)).toBe("veryUnhealthy");
    expect(aqiCategory(301)).toBe("hazardous");
  });
});

describe("fetchWeather (honest mapping)", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  afterEach(() => {
    (global.fetch as unknown as jest.Mock)?.mockRestore?.();
  });

  it("maps the full snapshot", async () => {
    const fetchMock = mockWeatherFetch();
    jest.spyOn(global, "fetch").mockImplementation(fetchMock as never);
    const s: WeatherSnapshot = await fetchWeather();
    expect(s.place).toBe(PLACE.label);
    expect(s.tempF).toBe(63);
    expect(s.condition).toBe("Light rain");
    expect(s.code).toBe(61);
    expect(s.isDay).toBe(true);
    expect(s.feelsLikeF).toBe(60);
    expect(s.highF).toBe(66);
    expect(s.lowF).toBe(45);
    expect(s.humidityPct).toBe(62);
    expect(s.uvIndex).toBe(3.2);
    expect(s.hours.length).toBe(24);
    expect(s.days.length).toBe(5);
    expect(s.days[0].label).toBe(new Date(`${FORECAST_PAYLOAD.daily.time[1]}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" }));
    expect(s.air).toEqual({ aqi: 59, category: "moderate", pm25: 12 });
    expect(s.moon.phaseName).toBeTruthy();
    expect(typeof s.moon.illuminationPct).toBe("number");
    expect(s.outlook).toBeTruthy();
  });

  it("air failure degrades to air:null — the rest stays live", async () => {
    jest.spyOn(global, "fetch").mockImplementation(mockWeatherFetch({ airFails: true }) as never);
    const s = await fetchWeather();
    expect(s.air).toBeNull();
    expect(s.tempF).toBe(63);
  });

  it("missing us_aqi is air:null, never a fabricated score", async () => {
    jest.spyOn(global, "fetch").mockImplementation(mockWeatherFetch({ airMissing: true }) as never);
    const s = await fetchWeather();
    expect(s.air).toBeNull();
  });

  it("a forecast without a current temperature REJECTS (no fabricated 0°)", async () => {
    jest.spyOn(global, "fetch").mockImplementation(jest.fn(async (url: string | URL | RequestInfo) => {
      const u = String(url);
      if (u.includes("air-quality")) return { ok: true, json: async () => ({ current: { us_aqi: 10 } }) };
      return { ok: true, json: async () => ({ current: { weather_code: 0 }, hourly: {}, daily: {} }) };
    }) as never);
    await expect(fetchWeather()).rejects.toThrow("malformed");
  });

  it("outlook: precip 55% two hours out reads 'Rain likely around'", async () => {
    jest.spyOn(global, "fetch").mockImplementation(mockWeatherFetch() as never);
    const s = await fetchWeather();
    expect(s.outlook).toMatch(/^Rain likely around \d+ (AM|PM)/);
  });

  it("falls back to cached snapshot when network fetch fails", async () => {
    jest.spyOn(global, "fetch").mockImplementation(mockWeatherFetch() as never);
    const s = await fetchWeather();
    expect(s.tempF).toBe(63);

    // Verify it was stored in AsyncStorage
    const stored = await AsyncStorage.getItem(WEATHER_STORAGE_KEY);
    expect(stored).toBeTruthy();

    // Now make network reject
    jest.spyOn(global, "fetch").mockImplementation(() => Promise.reject(new Error("Network failed")));
    const fallback = await fetchWeather();
    expect(fallback.tempF).toBe(63);
    expect(fallback.place).toBe(PLACE.label);
  });
});
