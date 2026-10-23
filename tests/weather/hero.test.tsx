// Home-native/tests/weather/hero.test.tsx
/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { render } from "@testing-library/react-native";

import { ThemeProvider } from "../../src/theme/ThemeProvider";
import { WeatherPoster, WeatherHeroCell, WeatherDetailsModal } from "../../src/weather/WidgetHero";
import { ambientAllowed } from "../../src/weather/useAmbient";
import type { WeatherSnapshot } from "../../src/weather/data";
import { mockWeatherFetch } from "./fixtures";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));

let mockMember: any = null;
jest.mock("../../src/state/AuthProvider", () => ({
  useAuth: () => ({ member: mockMember, role: mockMember ? mockMember.role : null, hydrated: true, signIn: jest.fn(), signOut: jest.fn(), poke: jest.fn() }),
}));
const mockRefreshNow = jest.fn(async () => {});
const mockPulseListeners = new Set<() => void>();
const mockSyncValue = {
  stale: false, syncError: null, snapshot: null, lastSyncAt: null,
  refreshNow: mockRefreshNow,
  onPulse: (l: () => void) => { mockPulseListeners.add(l); return () => { mockPulseListeners.delete(l); }; },
};
jest.mock("../../src/state/SyncManager", () => ({ useSync: () => mockSyncValue }));

const wrap = ({ children }: { children: React.ReactNode }) => <ThemeProvider>{children}</ThemeProvider>;

const SNAPSHOT: WeatherSnapshot = {
  place: "Holland, MI",
  tempF: 63, feelsLikeF: 60, highF: 66, lowF: 45,
  condition: "Light rain", code: 61, isDay: true,
  updatedAt: Date.now(),
  hours: [
    { label: "3 PM", tempF: 63, precipPct: 55, precipIn: 0.8, isDay: true },
    { label: "4 PM", tempF: 62, precipPct: 40, precipIn: 0, isDay: true },
  ],
  days: [
    { key: "2026-10-14", label: "Wed", highF: 68, lowF: 47, code: 2 },
  ],
  air: { aqi: 59, category: "moderate", pm25: 12 },
  moon: { phaseName: "Waxing Crescent", illuminationPct: 25, waxing: true, nextFullISO: "2026-10-24", nextNewISO: "2026-11-09" },
  outlook: "Rain likely around 3 PM",
  uvIndex: 3.2, windMph: 8, windDirDeg: 152, humidityPct: 62, precipTodayPct: 80,
};

describe("WeatherPoster (the monster hero)", () => {
  it("renders the wash, icon, digits, condition, outlook", () => {
    const { getByTestId, getByText } = render(<WeatherPoster size="full" data={SNAPSHOT} />, { wrapper: wrap });
    expect(getByTestId("wx-poster")).toBeTruthy();
    expect(getByTestId("wx-icon-rain")).toBeTruthy();
    expect(getByTestId("wx-digit-6")).toBeTruthy();
    expect(getByTestId("wx-digit-3")).toBeTruthy();
    expect(getByText("Light rain")).toBeTruthy();
    expect(getByText("Rain likely around 3 PM")).toBeTruthy();
    expect(getByText(/H:/)).toBeTruthy();
  });

  it("null temperature renders the honest em dash, never 0°", () => {
    const { getByTestId, queryByTestId } = render(
      <WeatherPoster size="cell" data={{ ...SNAPSHOT, tempF: null }} />, { wrapper: wrap });
    expect(getByTestId("wx-temp-empty")).toBeTruthy();
    expect(queryByTestId("wx-digit-0")).toBeNull();
  });

  it("cell size is a pressable that opens the gallery route", () => {
    const { getByTestId } = render(<WeatherPoster size="cell" data={SNAPSHOT} />, { wrapper: wrap });
    const card = getByTestId("wx-poster-press");
    expect(card.props.accessibilityRole).toBe("button");
    expect(card.props.accessibilityHint).toContain("gallery");
    expect(getByTestId("wx-poster")).toBeTruthy(); // the gradient carries wx-poster in cell mode too
  });
});

describe("WeatherDetailsModal (restocked snapshot, one source)", () => {
  it("shows the stat rows + 5-day strip", () => {
    const { getByText, getByTestId } = render(
      <WeatherDetailsModal visible={true} onClose={jest.fn()} data={SNAPSHOT} />, { wrapper: wrap });
    expect(getByText("Feels like")).toBeTruthy();
    expect(getByText("Humidity")).toBeTruthy();
    expect(getByText("Wind")).toBeTruthy();
    expect(getByText("UV index")).toBeTruthy();
    expect(getByText("Rain chance")).toBeTruthy();
    expect(getByText("Wed")).toBeTruthy();
  });
});

describe("ambient motion gate (spec §5 — static eye + one bob)", () => {
  it("runs only at full tier without reduced-motion", () => {
    expect(ambientAllowed(false, "full")).toBe(true);
    expect(ambientAllowed(true, "full")).toBe(false);
    expect(ambientAllowed(false, "reduced")).toBe(false);
  });
});

describe("WeatherHeroCell (self-fetching wall cell)", () => {
  it("fetches once and renders the poster", async () => {
    jest.spyOn(global, "fetch").mockImplementation(mockWeatherFetch() as never);
    const { findByTestId } = render(<WeatherHeroCell />, { wrapper: wrap });
    expect(await findByTestId("wx-poster")).toBeTruthy();
  });
});

describe("WeatherPoster — the roomy double-height rhythm", () => {
  it("uses the approved larger type and art scale at span two", () => {
    const { getByTestId } = render(
      <WeatherPoster size="cell" span={2} data={SNAPSHOT} />,
      { wrapper: wrap },
    );
    expect(getByTestId("wx-digit-6").props.height).toBe(128);
    expect(getByTestId("wx-icon-rain").props.width).toBe(160);
    expect(getByTestId("wx-condition").props.style.fontSize).toBe(20);
    expect(getByTestId("wx-outlook").props.style.fontSize).toBe(16);
    expect(getByTestId("wx-updated").props.style.fontSize).toBe(16);
  });

  it("preserves the compact scale at span one", () => {
    const { getByTestId } = render(
      <WeatherPoster size="cell" span={1} data={SNAPSHOT} />,
      { wrapper: wrap },
    );
    expect(getByTestId("wx-digit-6").props.height).toBe(96);
    expect(getByTestId("wx-icon-rain").props.width).toBe(124);
    expect(getByTestId("wx-condition").props.style.fontSize).toBe(16);
    expect(getByTestId("wx-outlook").props.style.fontSize).toBe(14);
    expect(getByTestId("wx-updated").props.style.fontSize).toBe(14);
  });
});
