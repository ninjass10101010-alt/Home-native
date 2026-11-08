/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ThemeProvider } from "../src/theme/ThemeProvider";
import { ToastProvider } from "../src/ui/Toast";
import { RoutinesPanel } from "../src/tasks/RoutinesPanel";
import {
  computeTimerProgress,
  formatTimerMMSS,
} from "../src/tasks/focus-timer";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

const mockRouterPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockRouterPush, canGoBack: () => false }),
  usePathname: () => "/tasks",
  useLocalSearchParams: () => ({}),
}));

const parent = { id: "p1", name: "Rebecca (Mom)", role: "parent", emoji: "🐱", color: "green" };

jest.mock("../src/state/AuthProvider", () => ({
  useAuth: () => ({
    member: parent,
    role: "parent",
    hydrated: true,
    signOut: jest.fn(),
    poke: jest.fn(),
    pinRequiredFor: () => false,
  }),
}));

const mockSnapshot = {
  tasks: [],
  weekData: { weekStart: "2026-10-26", points: { "Rebecca (Mom)": 85 }, streak: {}, history: [] },
  rewards: [],
};

jest.mock("../src/state/SyncManager", () => ({
  useSync: () => ({
    stale: false,
    snapshot: mockSnapshot,
    syncError: null,
    refreshNow: jest.fn(async () => {}),
    onPulse: () => () => {},
  }),
}));

jest.mock("../src/api/client", () => ({
  api: jest.fn(async () => ({ items: [] })),
  ApiError: jest.requireActual("../src/api/client").ApiError,
}));

const wrap = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>
    <ToastProvider>{children}</ToastProvider>
  </ThemeProvider>
);

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

describe("Focus Timer Utilities", () => {
  describe("formatTimerMMSS", () => {
    it("formats seconds into MM:SS correctly", () => {
      expect(formatTimerMMSS(120)).toBe("02:00");
      expect(formatTimerMMSS(65)).toBe("01:05");
      expect(formatTimerMMSS(0)).toBe("00:00");
      expect(formatTimerMMSS(-10)).toBe("00:00");
      expect(formatTimerMMSS(300)).toBe("05:00");
      expect(formatTimerMMSS(360)).toBe("06:00");
      expect(formatTimerMMSS(900)).toBe("15:00");
      expect(formatTimerMMSS(1200)).toBe("20:00");
    });

    it("handles non-finite or edge numbers cleanly", () => {
      expect(formatTimerMMSS(NaN)).toBe("00:00");
      expect(formatTimerMMSS(-Infinity)).toBe("00:00");
    });
  });

  describe("computeTimerProgress", () => {
    it("returns complete phase when remaining is zero or negative", () => {
      expect(computeTimerProgress(0, 120)).toEqual({
        pct: 100,
        phaseLabel: "Sprint Complete! 🎉",
      });
      expect(computeTimerProgress(-5, 120)).toEqual({
        pct: 100,
        phaseLabel: "Sprint Complete! 🎉",
      });
      expect(computeTimerProgress(5, 0)).toEqual({
        pct: 100,
        phaseLabel: "Sprint Complete! 🎉",
      });
    });

    it("returns rolling phase when progress is under 50%", () => {
      expect(computeTimerProgress(120, 120)).toEqual({
        pct: 0,
        phaseLabel: "Focused & rolling! 💪",
      });
      expect(computeTimerProgress(80, 120)).toEqual({
        pct: 33,
        phaseLabel: "Focused & rolling! 💪",
      });
    });

    it("returns halfway phase when progress is 50% or more", () => {
      expect(computeTimerProgress(60, 120)).toEqual({
        pct: 50,
        phaseLabel: "Halfway there — keep going! 🌟",
      });
      expect(computeTimerProgress(20, 120)).toEqual({
        pct: 83,
        phaseLabel: "Halfway there — keep going! 🌟",
      });
    });
  });
});

describe("Focus Timer Component in RoutinesPanel", () => {
  it("opens focus timer from header, switches preset, adds 1 min, and controls timer", async () => {
    const { findByTestId, getByTestId, findByText } = render(<RoutinesPanel isParent />, {
      wrapper: wrap,
    });

    // 1. Open focus timer from header
    const openBtn = await findByTestId("routine-focus-timer-open");
    expect(openBtn).toBeTruthy();

    await act(async () => {
      fireEvent.press(openBtn);
    });

    // Modal is opened
    expect(await findByTestId("focus-timer-modal")).toBeTruthy();
    expect(await findByTestId("focus-timer-clock")).toBeTruthy();

    // 2. Switch preset to cleanup
    await act(async () => {
      fireEvent.press(getByTestId("focus-preset-cleanup"));
    });
    expect(getByTestId("focus-timer-clock").props.children).toBe("05:00");

    // 3. Press +1 Min
    await act(async () => {
      fireEvent.press(getByTestId("focus-timer-plus1"));
    });
    expect(getByTestId("focus-timer-clock").props.children).toBe("06:00");

    // 4. Start / pause / reset
    // Start timer
    await act(async () => {
      fireEvent.press(getByTestId("focus-timer-toggle"));
    });
    // Toggle button should now show Pause
    expect(await findByText("⏸️ Pause")).toBeTruthy();

    // Pause timer
    await act(async () => {
      fireEvent.press(getByTestId("focus-timer-toggle"));
    });
    // Toggle button shows Start again
    expect(await findByText("▶️ Start")).toBeTruthy();

    // Reset timer
    await act(async () => {
      fireEvent.press(getByTestId("focus-timer-reset"));
    });
    // After reset, clock returns to preset time
    expect(getByTestId("focus-timer-clock").props.children).toBe("05:00");
  });

  it("opens timer from routine card and finishes routine via finish-routine button", async () => {
    const { findByTestId, getByTestId, findByText } = render(<RoutinesPanel isParent />, {
      wrapper: wrap,
    });

    // Find Morning Launchpad routine card
    expect(await findByTestId("routine-card-rt-morning")).toBeTruthy();

    // Click timer on the routine card
    const cardTimerBtn = getByTestId("routine-card-timer-rt-morning");
    expect(cardTimerBtn).toBeTruthy();

    await act(async () => {
      fireEvent.press(cardTimerBtn);
    });

    // Modal should be open
    expect(await findByTestId("focus-timer-modal")).toBeTruthy();

    // Coach cheer or active routine title is displayed
    const cheerBanner = getByTestId("focus-timer-cheer");
    expect(cheerBanner).toBeTruthy();

    // Finish routine button is available
    const finishBtn = await findByTestId("focus-timer-finish-routine");
    expect(finishBtn).toBeTruthy();

    // Press Finish routine
    await act(async () => {
      fireEvent.press(finishBtn);
    });

    // Routine should now be completed
    expect(await findByText("✓ Completed")).toBeTruthy();
  });
});
