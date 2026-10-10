/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { render } from "@testing-library/react-native";

import { ThemeProvider } from "../src/theme/ThemeProvider";
import { WeatherWidget } from "../src/home/widgets/WeatherWidget";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

let mockMember: any = null;
jest.mock("../src/state/AuthProvider", () => ({
  useAuth: () => ({ member: mockMember, hydrated: true, signOut: jest.fn(), poke: jest.fn() }),
}));

const mockSyncValue = {
  stale: false,
  syncError: null,
  lastSyncAt: null,
  refreshNow: jest.fn(async () => {}),
  onPulse: () => () => {},
};
jest.mock("../src/state/SyncManager", () => ({
  useSync: () => mockSyncValue,
}));

const wrap = ({ children }: { children: React.ReactNode }) => <ThemeProvider>{children}</ThemeProvider>;

const today = new Date();
const hh = (offset: number) => {
  const d = new Date(today.getTime() + offset * 3600_000);
  return d.toISOString().slice(0, 16);
};

const openMeteoBody = {
  current: { temperature_2m: 63.4, apparent_temperature: 60.1, weather_code: 2, is_day: 1 },
  daily: { temperature_2m_max: [68], temperature_2m_min: [49] },
  hourly: {
    time: [hh(-1), hh(0), hh(1), hh(2), hh(3), hh(4), hh(5), hh(6)],
    temperature_2m: [61, 63, 64, 65, 64, 62, null, 60],
    precipitation_probability: [0, 10, 55, 70, 20, 0, 0, 5],
    weather_code: [1, 2, 2, 3, 3, 2, 2, 2],
    is_day: [1, 1, 1, 1, 1, 0, 0, 0],
  },
};

describe("WeatherWidget (client-direct Open-Meteo, web parity)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMember = null;
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => openMeteoBody,
    })) as any;
  });

  it("renders the hero: location, emoji, big temp, condition, H/L + feels, strip, Updated", async () => {
    const { findByText, getByTestId } = render(<WeatherWidget />, { wrapper: wrap });
    expect(await findByText("📍 Holland, MI")).toBeTruthy();
    expect(getByTestId("wx-hero-temp").props.children).toEqual([63, "°"]); // hero temp (rounded)
    expect(await findByText("Partly cloudy")).toBeTruthy();
    expect(await findByText("H:68° L:49° · Feels like 60°")).toBeTruthy();
    expect(await findByText(/Updated /)).toBeTruthy();
    // strip: 6 slots, null-temp hour skipped
    const strip = getByTestId("wx-hourly-strip");
    expect(strip.children.length).toBe(6);
    // precip% surfaces only at ≥30
    expect(await findByText("💧55%")).toBeTruthy();
  });

  it("unavailable weather renders the honest failure card, never fabricated numbers", async () => {
    global.fetch = jest.fn(async () => {
      throw new Error("network down");
    }) as any;
    const { findByText, queryByTestId } = render(<WeatherWidget />, { wrapper: wrap });
    expect(await findByText("Couldn't load this right now.")).toBeTruthy();
    expect(queryByTestId("wx-hero-temp")).toBeNull();
  });

  it("malformed payload (no temperature) is a failure, not 0°", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ current: {}, daily: {}, hourly: {} }),
    })) as any;
    const { findByText, queryByTestId } = render(<WeatherWidget />, { wrapper: wrap });
    expect(await findByText("Couldn't load this right now.")).toBeTruthy();
    expect(queryByTestId("wx-hero-temp")).toBeNull();
  });
});
