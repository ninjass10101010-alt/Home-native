// Home-native/tests/weather-dress-advisor.test.tsx
/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { computeWeatherDressAdvice } from "../src/weather/dress-advisor";
import { DressAdvisorCard } from "../src/weather/DressAdvisorCard";
import { WeatherGallery } from "../src/weather/WidgetGallery";
import type { WeatherSnapshot } from "../src/weather/data";
import { mockWeatherFetch } from "./weather/fixtures";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));
jest.mock("../src/state/AuthProvider", () => ({
  useAuth: () => ({ member: null, role: null, hydrated: true, signIn: jest.fn(), signOut: jest.fn(), poke: jest.fn() }),
}));
jest.mock("../src/state/SyncManager", () => ({
  useSync: () => ({
    stale: false,
    syncError: null,
    snapshot: null,
    lastSyncAt: null,
    refreshNow: jest.fn(async () => {}),
    onPulse: () => () => {},
  }),
}));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));

const wrap = ({ children }: { children: React.ReactNode }) => <ThemeProvider>{children}</ThemeProvider>;

function makeSnapshot(overrides: Partial<WeatherSnapshot> = {}): WeatherSnapshot {
  return {
    place: "Holland, MI",
    tempF: 65,
    feelsLikeF: 65,
    highF: 70,
    lowF: 50,
    condition: "Partly cloudy",
    code: 2,
    isDay: true,
    updatedAt: Date.now(),
    hours: [],
    days: [],
    air: { aqi: 35, category: "good", pm25: 8 },
    moon: { phaseName: "Waxing Crescent", illuminationPct: 30, waxing: true, nextFullISO: null, nextNewISO: null },
    outlook: "Dry and pleasant",
    uvIndex: 2,
    windMph: 8,
    windDirDeg: 180,
    humidityPct: 50,
    precipTodayPct: 10,
    ...overrides,
  };
}

describe("computeWeatherDressAdvice", () => {
  it("recommends heavy winter coat & hat for freezing temperatures (28°F)", () => {
    const advice = computeWeatherDressAdvice(makeSnapshot({ feelsLikeF: 28, tempF: 32, highF: 35 }));
    expect(advice.headline).toBe("Bundle Up Warm");
    expect(advice.items[0]).toEqual({
      id: "heavy-coat",
      category: "outerwear",
      title: "Heavy Winter Coat & Hat",
      subtitle: "Bundle up warm — gloves & winter boots",
      emoji: "🧥",
      tone: "cyan",
    });
  });

  it("recommends hoodie or light jacket for cool temperatures (48°F)", () => {
    const advice = computeWeatherDressAdvice(makeSnapshot({ feelsLikeF: 48, tempF: 50 }));
    expect(advice.headline).toBe("Cool & Crisp");
    expect(advice.items[0]).toEqual({
      id: "hoodie-jacket",
      category: "outerwear",
      title: "Hoodie or Light Jacket",
      subtitle: "Great for layering this morning",
      emoji: "🧥",
      tone: "lavender",
    });
  });

  it("recommends t-shirt & comfy pants for mild temperatures (68°F)", () => {
    const advice = computeWeatherDressAdvice(makeSnapshot({ feelsLikeF: 68, tempF: 68 }));
    expect(advice.headline).toBe("Comfortable & Mild");
    expect(advice.items[0]).toEqual({
      id: "comfy-layers",
      category: "outfit",
      title: "T-Shirt & Comfy Pants",
      subtitle: "Mild & comfortable all day",
      emoji: "👕",
      tone: "mint",
    });
    expect(advice.items[1]).toEqual({
      id: "shoes-ready",
      category: "gear",
      title: "Sneakers Ready",
      subtitle: "Dry skies for walking & recess",
      emoji: "👟",
      tone: "mint",
    });
    expect(advice.items[2]).toEqual({
      id: "outdoor-play",
      category: "play",
      title: "Great for Recess & Park",
      subtitle: "Conditions look wonderful outside",
      emoji: "🛝",
      tone: "mint",
    });
  });

  it("recommends shorts & breathable tee with sunglasses for hot days (84°F, UV 8)", () => {
    const advice = computeWeatherDressAdvice(makeSnapshot({ feelsLikeF: 84, tempF: 82, uvIndex: 8 }));
    expect(advice.headline).toBe("Warm Day Ahead");
    expect(advice.items[0]).toEqual({
      id: "warm-weather",
      category: "outfit",
      title: "Shorts & Breathable Tee",
      subtitle: "Warm day — pack extra cold water",
      emoji: "🩳",
      tone: "amber",
    });
    expect(advice.items[1]).toEqual({
      id: "sun-gear",
      category: "gear",
      title: "Sunglasses & Sunscreen",
      subtitle: "UV index 8 — bright sun today",
      emoji: "🕶️",
      tone: "amber",
    });
  });

  it("recommends umbrella & rain boots when precipTodayPct >= 40 (75%)", () => {
    const advice = computeWeatherDressAdvice(makeSnapshot({ precipTodayPct: 75 }));
    expect(advice.items[1]).toEqual({
      id: "rain-gear",
      category: "gear",
      title: "Pack Umbrella & Rain Boots",
      subtitle: "75% chance of precipitation",
      emoji: "☂️",
      tone: "cyan",
    });
  });

  it("recommends umbrella & rain boots for wet WMO codes even if precipTodayPct is null", () => {
    const advice = computeWeatherDressAdvice(makeSnapshot({ code: 61, precipTodayPct: null }));
    expect(advice.items[1]).toEqual({
      id: "rain-gear",
      category: "gear",
      title: "Pack Umbrella & Rain Boots",
      subtitle: "50% chance of precipitation",
      emoji: "☂️",
      tone: "cyan",
    });
  });

  it("flags indoor play when air quality is unhealthy", () => {
    const advice = computeWeatherDressAdvice(
      makeSnapshot({
        air: { aqi: 165, category: "unhealthy", pm25: 50 },
      })
    );
    expect(advice.items[2]).toEqual({
      id: "indoor-play",
      category: "play",
      title: "Indoor Play Day",
      subtitle: "Air quality is unhealthy",
      emoji: "🏠",
      tone: "coral",
    });
  });

  it("flags indoor play when air quality is veryUnhealthy or hazardous", () => {
    const veryUnhealthy = computeWeatherDressAdvice(
      makeSnapshot({
        air: { aqi: 220, category: "veryUnhealthy", pm25: 110 },
      })
    );
    expect(veryUnhealthy.items[2].id).toBe("indoor-play");
    expect(veryUnhealthy.items[2].subtitle).toBe("Air quality is very unhealthy");

    const hazardous = computeWeatherDressAdvice(
      makeSnapshot({
        air: { aqi: 350, category: "hazardous", pm25: 220 },
      })
    );
    expect(hazardous.items[2].id).toBe("indoor-play");
    expect(hazardous.items[2].subtitle).toBe("Air quality is hazardous");
  });

  it("recommends breezy windy play advice when windMph >= 20", () => {
    const advice = computeWeatherDressAdvice(
      makeSnapshot({
        windMph: 24,
      })
    );
    expect(advice.items[2]).toEqual({
      id: "windy-play",
      category: "play",
      title: "Breezy Outside",
      subtitle: "24 mph wind — hold onto hats!",
      emoji: "💨",
      tone: "amber",
    });
  });

  it("falls back to default 65°F when temperatures are null", () => {
    const advice = computeWeatherDressAdvice(
      makeSnapshot({
        feelsLikeF: null,
        tempF: null,
        highF: null,
      })
    );
    expect(advice.items[0].id).toBe("comfy-layers");
  });
});

describe("DressAdvisorCard component", () => {
  it("renders advice card and allows toggling items to ✓ Ready!", () => {
    const data = makeSnapshot({ feelsLikeF: 28, precipTodayPct: 60, windMph: 10 });
    const { getByTestId, getByText, queryByText } = render(<DressAdvisorCard data={data} />, {
      wrapper: wrap,
    });

    expect(getByTestId("wx-dress-advisor")).toBeTruthy();
    expect(getByText("Bundle Up Warm")).toBeTruthy();

    const coatItem = getByTestId("wx-dress-item-heavy-coat");
    const rainItem = getByTestId("wx-dress-item-rain-gear");
    const playItem = getByTestId("wx-dress-item-outdoor-play");

    expect(coatItem).toBeTruthy();
    expect(rainItem).toBeTruthy();
    expect(playItem).toBeTruthy();

    // Initial state: not ready
    expect(getByText("0 / 3 Ready")).toBeTruthy();
    expect(queryByText("✓ Ready!")).toBeNull();

    // Tap heavy coat
    fireEvent.press(coatItem);
    expect(getByText("1 / 3 Ready")).toBeTruthy();
    expect(getByText("✓ Ready!")).toBeTruthy();

    // Tap rain gear and outdoor play
    fireEvent.press(rainItem);
    fireEvent.press(playItem);
    expect(getByText("All Set! 🎉")).toBeTruthy();

    // Untap heavy coat
    fireEvent.press(coatItem);
    expect(getByText("2 / 3 Ready")).toBeTruthy();
  });
});

describe("WeatherGallery with DressAdvisorCard", () => {
  it("renders DressAdvisorCard in WeatherGallery below hero", async () => {
    jest.spyOn(global, "fetch").mockImplementation(mockWeatherFetch() as never);
    const { findByTestId } = render(<WeatherGallery />, { wrapper: wrap });

    expect(await findByTestId("wx-poster")).toBeTruthy();
    expect(await findByTestId("wx-dress-advisor")).toBeTruthy();
    expect(await findByTestId("wx-timeline-card")).toBeTruthy();
    expect(await findByTestId("wx-aqi-card")).toBeTruthy();
    expect(await findByTestId("wx-moon-card")).toBeTruthy();
  }, 15000);
});
