// Home-native/tests/weather/gallery.test.tsx
/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { render } from "@testing-library/react-native";
import { ThemeProvider } from "../../src/theme/ThemeProvider";
import { WeatherGallery, WeatherTimeline, WeatherAirQuality, WeatherMoon } from "../../src/weather/WidgetGallery";
import type { WeatherSnapshot } from "../../src/weather/data";
import { AIR_PAYLOAD, FORECAST_PAYLOAD, mockWeatherFetch } from "./fixtures";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));
jest.mock("../../src/state/AuthProvider", () => ({
  useAuth: () => ({ member: null, hydrated: true, signIn: jest.fn(), signOut: jest.fn(), poke: jest.fn() }),
}));
const mockRefreshNow = jest.fn(async () => {});
jest.mock("../../src/state/SyncManager", () => ({
  useSync: () => ({
    stale: false, syncError: null, snapshot: null, lastSyncAt: null,
    refreshNow: mockRefreshNow,
    onPulse: (l: () => void) => () => { void l; },
  }),
}));
// WeatherPoster calls useRouter() unconditionally (cell branch navigates);
// the gallery renders the full poster, so the mock must exist here too.
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));

const wrap = ({ children }: { children: React.ReactNode }) => <ThemeProvider>{children}</ThemeProvider>;

const withAir = (air: WeatherSnapshot["air"]): WeatherSnapshot => ({
  place: "Holland, MI", tempF: 63, feelsLikeF: 60, highF: 66, lowF: 45,
  condition: "Light rain", code: 61, isDay: true, updatedAt: Date.now(),
  hours: Array.from({ length: 4 }, (_, i) => ({ label: `${3 + i} PM`, tempF: 63 - i, precipPct: i === 0 ? 55 : 5, precipIn: 0, isDay: true })),
  days: [], air,
  moon: { phaseName: "Waxing Crescent", illuminationPct: 25, waxing: true, nextFullISO: "2026-10-24", nextNewISO: "2026-11-09" },
  outlook: "Rain likely around 3 PM",
  uvIndex: 3.2, windMph: 8, windDirDeg: 152, humidityPct: 62, precipTodayPct: 80,
});

describe("WeatherGallery (one fetch, honest states)", () => {
  it("renders hero + the three cards from one fetch", async () => {
    jest.spyOn(global, "fetch").mockImplementation(mockWeatherFetch() as never);
    const { findByTestId } = render(<WeatherGallery />, { wrapper: wrap });
    expect(await findByTestId("wx-poster")).toBeTruthy();
    expect(await findByTestId("wx-timeline-card")).toBeTruthy();
    expect(await findByTestId("wx-aqi-card")).toBeTruthy();
    expect(await findByTestId("wx-moon-card")).toBeTruthy();
  });
});

describe("cards (pure, data non-null)", () => {
  it("timeline: now-cell is tone-filled, cells carry hour labels", () => {
    const { getByTestId, getByText } = render(<WeatherTimeline data={withAir(null)} />, { wrapper: wrap });
    // NOTE (brief deviation): the brief asserts root.findAll(testID).toHaveLength(1),
    // but react-test-renderer counts the composite View + its host element (2 nodes
    // for one rendered cell). getByTestId queries host elements only and still throws
    // on zero/multiple matches, so the exactly-one-now-cell intent is preserved.
    expect(getByTestId("wx-timeline-now")).toBeTruthy();
    // NOTE (brief deviation): the brief asserts getByText("3 PM"), but the brief's
    // own implementation renders "NOW" for hours[0] (label "3 PM"), so "3 PM" never
    // appears. "4 PM" (hours[1]) proves non-now cells carry their hour labels.
    expect(getByText("4 PM")).toBeTruthy();
  });
  it("AQI: digits + EPA label + kid line from AIR_PAYLOAD", () => {
    const data = withAir({ aqi: AIR_PAYLOAD.current.us_aqi, category: "moderate" as const, pm25: 12 });
    const { getByText, getByTestId } = render(<WeatherAirQuality data={data} />, { wrapper: wrap });
    expect(getByTestId("wx-digit-5")).toBeTruthy();
    expect(getByTestId("wx-digit-9")).toBeTruthy();
    expect(getByText("Moderate")).toBeTruthy();
    expect(getByText(/sensitive kids take it easy/i)).toBeTruthy();
  });
  it("AQI: null air renders the honest degradation line", () => {
    const { getByText } = render(<WeatherAirQuality data={withAir(null)} />, { wrapper: wrap });
    expect(getByText(/Couldn't load air quality/i)).toBeTruthy();
  });
  it("moon: phase, illumination, next full/new dates", () => {
    const { getByText, getByTestId } = render(<WeatherMoon data={withAir(null)} />, { wrapper: wrap });
    expect(getByTestId("wx-moon-disc")).toBeTruthy();
    expect(getByText("Waxing Crescent")).toBeTruthy();
    expect(getByText(/25%/)).toBeTruthy();
    expect(getByText("Oct 24")).toBeTruthy();
    expect(getByText("Nov 9")).toBeTruthy();
  });
});
