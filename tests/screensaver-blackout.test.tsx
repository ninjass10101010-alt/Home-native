/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { Screensaver } from "../src/screensaver/Screensaver";
import { HomeSection } from "../src/settings/HomeSection";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import {
  isBlackoutActiveNow,
  _resetScreensaverMemoryForTest,
  SCREENSAVER_PREFS_STORAGE_KEY,
  type ScreensaverPrefs,
} from "../src/home/idle";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

const mockRouterBack = jest.fn();
const mockRouterReplace = jest.fn();
const mockRouterPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockRouterPush,
    back: mockRouterBack,
    replace: mockRouterReplace,
    canGoBack: () => true,
  }),
}));

jest.mock("../src/api/client", () => ({
  api: jest.fn(),
  ApiError: jest.requireActual("../src/api/client").ApiError,
}));
const { api } = jest.requireMock("../src/api/client") as { api: jest.Mock };

const PAYLOAD = {
  ok: true,
  generatedAt: "2026-10-11T11:04:00Z",
  date: "2026-10-11",
  events: [
    { title: "Library books due", time: "All day", allDay: true },
    { title: "Soccer practice", time: "4:00 PM", allDay: false },
  ],
  dinner: { name: "Taco Night" },
  tasks: { done: 3, total: 5 },
  briefing: ["📅 2 events today", "✅ 2 chores still open"],
  weather: { tempF: 62, hiF: 70, loF: 48, condition: "Partly cloudy" },
};

const wrap = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

describe("Bedtime Blackout — Zero-Nit Sleep Mode (Workstream 2)", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    _resetScreensaverMemoryForTest();
    api.mockReset();
    api.mockResolvedValue(PAYLOAD);
  });

  describe("isBlackoutActiveNow unit tests", () => {
    it("returns false when blackoutAtNight is false (even in night window)", () => {
      const prefs: ScreensaverPrefs = {
        mode: "always",
        startHour: 23,
        endHour: 4,
        blackoutAtNight: false,
      };

      expect(isBlackoutActiveNow(prefs, new Date(2026, 9, 11, 23, 0))).toBe(false);
      expect(isBlackoutActiveNow(prefs, new Date(2026, 9, 11, 23, 30))).toBe(false);
      expect(isBlackoutActiveNow(prefs, new Date(2026, 9, 12, 0, 0))).toBe(false);
      expect(isBlackoutActiveNow(prefs, new Date(2026, 9, 12, 2, 0))).toBe(false);
      expect(isBlackoutActiveNow(prefs, new Date(2026, 9, 12, 3, 59))).toBe(false);
    });

    it("returns false when mode is 'off' even if blackoutAtNight is true", () => {
      const prefs: ScreensaverPrefs = {
        mode: "off",
        startHour: 23,
        endHour: 4,
        blackoutAtNight: true,
      };

      expect(isBlackoutActiveNow(prefs, new Date(2026, 9, 11, 23, 30))).toBe(false);
      expect(isBlackoutActiveNow(prefs, new Date(2026, 9, 12, 2, 0))).toBe(false);
    });

    it("handles midnight-spanning night window (23:00 to 04:00) when blackoutAtNight is true", () => {
      const prefs: ScreensaverPrefs = {
        mode: "always",
        startHour: 23,
        endHour: 4,
        blackoutAtNight: true,
      };

      // Night hours inside window: true
      expect(isBlackoutActiveNow(prefs, new Date(2026, 9, 11, 23, 0))).toBe(true);
      expect(isBlackoutActiveNow(prefs, new Date(2026, 9, 11, 23, 30))).toBe(true);
      expect(isBlackoutActiveNow(prefs, new Date(2026, 9, 12, 0, 0))).toBe(true);
      expect(isBlackoutActiveNow(prefs, new Date(2026, 9, 12, 2, 15))).toBe(true);
      expect(isBlackoutActiveNow(prefs, new Date(2026, 9, 12, 3, 59))).toBe(true);

      // Day hours outside window: false
      expect(isBlackoutActiveNow(prefs, new Date(2026, 9, 12, 4, 0))).toBe(false);
      expect(isBlackoutActiveNow(prefs, new Date(2026, 9, 12, 7, 5))).toBe(false);
      expect(isBlackoutActiveNow(prefs, new Date(2026, 9, 12, 12, 0))).toBe(false);
      expect(isBlackoutActiveNow(prefs, new Date(2026, 9, 12, 22, 59))).toBe(false);
    });

    it("works with non-midnight night window (e.g. 1:00 to 5:00)", () => {
      const prefs: ScreensaverPrefs = {
        mode: "night",
        startHour: 1,
        endHour: 5,
        blackoutAtNight: true,
      };

      expect(isBlackoutActiveNow(prefs, new Date(2026, 9, 12, 0, 30))).toBe(false);
      expect(isBlackoutActiveNow(prefs, new Date(2026, 9, 12, 1, 0))).toBe(true);
      expect(isBlackoutActiveNow(prefs, new Date(2026, 9, 12, 3, 0))).toBe(true);
      expect(isBlackoutActiveNow(prefs, new Date(2026, 9, 12, 5, 0))).toBe(false);
    });
  });

  describe("Screensaver component blackout rendering", () => {
    it("renders ss-blackout-stage and ss-blackout-clock at 11:30 PM and hides dashboard cards", async () => {
      // Pin clock to 11:30 PM
      jest.useFakeTimers({ now: new Date(2026, 9, 11, 23, 30) });
      _resetScreensaverMemoryForTest({
        mode: "always",
        startHour: 23,
        endHour: 4,
        blackoutAtNight: true,
      });

      const onExit = jest.fn();
      const { findByTestId, queryByText, getByText, getByTestId } = render(
        <Screensaver onExit={onExit} />,
        { wrapper: wrap }
      );

      const stage = await findByTestId("ss-blackout-stage");
      expect(stage).toBeTruthy();

      const clock = getByTestId("ss-blackout-clock");
      expect(clock).toBeTruthy();
      expect(getByText("11:30 PM")).toBeTruthy();
      expect(getByText("🌙 Sleep Mode · Tap to wake")).toBeTruthy();

      // Ensure 3-column dashboard panels and bright weather are hidden
      expect(queryByText("TODAY")).toBeNull();
      expect(queryByText("TONIGHT")).toBeNull();
      expect(queryByText("CHORES")).toBeNull();
      expect(queryByText("CONSUELA")).toBeNull();

      // Tap to wake contract: tapping root exits back to dashboard
      fireEvent.press(getByTestId("screensaver-root"));
      expect(onExit).toHaveBeenCalledTimes(1);
    });

    it("renders the full ambient board at 7:05 AM (outside night window)", async () => {
      // Pin clock to 7:05 AM
      jest.useFakeTimers({ now: new Date(2026, 9, 11, 7, 5) });
      _resetScreensaverMemoryForTest({
        mode: "always",
        startHour: 23,
        endHour: 4,
        blackoutAtNight: true,
      });

      const { findByText, findByTestId, queryByTestId } = render(
        <Screensaver />,
        { wrapper: wrap }
      );

      // Blackout stage must NOT be rendered
      expect(queryByTestId("ss-blackout-stage")).toBeNull();
      expect(queryByTestId("ss-blackout-clock")).toBeNull();

      // Full ambient board is visible
      expect(await findByText("TODAY")).toBeTruthy();
      expect(await findByText("TONIGHT")).toBeTruthy();
      expect(await findByText("CHORES")).toBeTruthy();
      expect(await findByTestId("ss-clock")).toBeTruthy();
    });
  });

  describe("HomeSection settings toggle", () => {
    it("toggling screensaver-blackout-toggle persists blackoutAtNight: true to AsyncStorage", async () => {
      _resetScreensaverMemoryForTest({
        mode: "always",
        startHour: 23,
        endHour: 4,
        blackoutAtNight: false,
      });

      const { findByTestId } = render(<HomeSection />, { wrapper: wrap });

      const toggle = await findByTestId("screensaver-blackout-toggle");
      expect(toggle).toBeTruthy();
      expect(toggle.props.accessibilityState?.checked).toBe(false);

      // Press the toggle to enable bedtime blackout
      fireEvent.press(toggle);

      await waitFor(async () => {
        const raw = await AsyncStorage.getItem(SCREENSAVER_PREFS_STORAGE_KEY);
        expect(raw).toBeTruthy();
        const parsed = JSON.parse(raw!);
        expect(parsed.blackoutAtNight).toBe(true);
      });
    });

    it("displays schedule window controls and 64dp stepper buttons when blackoutAtNight is enabled in always mode", async () => {
      _resetScreensaverMemoryForTest({
        mode: "always",
        startHour: 23,
        endHour: 4,
        blackoutAtNight: true,
      });

      const { findByTestId, getByTestId } = render(<HomeSection />, { wrapper: wrap });

      // Preset buttons and steppers should be visible
      expect(await findByTestId("screensaver-preset-23-4")).toBeTruthy();
      const prevBtn = getByTestId("screensaver-start-prev");
      const nextBtn = getByTestId("screensaver-start-next");
      const endPrevBtn = getByTestId("screensaver-end-prev");
      const endNextBtn = getByTestId("screensaver-end-next");

      // Verify all 4 stepper buttons meet the 64dp tap target floor
      expect(prevBtn.props.style.minWidth).toBe(64);
      expect(prevBtn.props.style.minHeight).toBe(64);
      expect(nextBtn.props.style.minWidth).toBe(64);
      expect(nextBtn.props.style.minHeight).toBe(64);
      expect(endPrevBtn.props.style.minWidth).toBe(64);
      expect(endPrevBtn.props.style.minHeight).toBe(64);
      expect(endNextBtn.props.style.minWidth).toBe(64);
      expect(endNextBtn.props.style.minHeight).toBe(64);
    });
  });
});
