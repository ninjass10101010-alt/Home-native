/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { Screensaver } from "../src/screensaver/Screensaver";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import ScreensaverRoute from "../app/screensaver";
import { idleBoardDue, SCREENSAVER_IDLE_MS } from "../src/home/idle";

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
let mockCanGoBack = true;
jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockRouterPush,
    back: mockRouterBack,
    replace: mockRouterReplace,
    canGoBack: () => mockCanGoBack,
  }),
}));

jest.mock("../src/api/client", () => ({
  api: jest.fn(),
  ApiError: jest.requireActual("../src/api/client").ApiError,
}));
const { api } = jest.requireMock("../src/api/client") as { api: jest.Mock };
const { ApiError } = jest.requireActual("../src/api/client") as { ApiError: any };

// Pinned wall clock: Sunday 2026-10-11, 7:05 AM.
jest.useFakeTimers({ now: new Date(2026, 9, 11, 7, 5) });

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

const good = () => api.mockResolvedValue(PAYLOAD);

// The weather strip renders monster art, which resolves ink through the theme.
const wrap = ({ children }: { children: React.ReactNode }) => <ThemeProvider>{children}</ThemeProvider>;

/** Flush the mount-time fetch + interval effects. */
const settle = async (ms = 0) =>
  act(async () => {
    if (ms > 0) jest.advanceTimersByTime(ms);
    await Promise.resolve();
    await Promise.resolve();
  });

beforeEach(() => {
  jest.clearAllMocks();
  mockCanGoBack = true;
  api.mockReset();
});

describe("Screensaver — the ambient board", () => {
  it("renders the big clock and date from the wall clock", async () => {
    good();
    const { findByTestId } = render(<Screensaver />, { wrapper: wrap });
    const clock = await findByTestId("ss-clock");
    expect(clock.props.children).toBe("7:05");
    expect((await findByTestId("ss-date")).props.children).toBe("Sunday, October 11");
  });

  it("renders events, dinner, chores progress, briefing lines and weather", async () => {
    good();
    const { findByText, findByTestId } = render(<Screensaver />, { wrapper: wrap });
    expect(await findByText("Soccer practice")).toBeTruthy();
    expect(await findByText("4:00 PM")).toBeTruthy();
    expect(await findByText("Library books due")).toBeTruthy();
    expect(await findByText("Taco Night")).toBeTruthy();
    expect((await findByTestId("ss-chores")).props.children).toBe("3 of 5 done");
    expect(await findByText("📅 2 events today")).toBeTruthy();
    expect(await findByText("✅ 2 chores still open")).toBeTruthy();
    expect((await findByTestId("ss-weather-temp")).props.testID).toBe("ss-weather-temp");
    expect(await findByTestId("wx-digit-6")).toBeTruthy();
    expect(await findByTestId("wx-digit-2")).toBeTruthy();
    expect(await findByText("Partly cloudy")).toBeTruthy();
    expect(await findByText("H 70° · L 48°")).toBeTruthy();
  });

  it("polls the family server every 60s", async () => {
    good();
    const { findByTestId } = render(<Screensaver />, { wrapper: wrap });
    await findByTestId("ss-clock");
    expect(api).toHaveBeenCalledTimes(1);
    expect(api.mock.calls[0][0]).toBe("/api/consuela/screensaver");
    await settle(60_000);
    expect(api).toHaveBeenCalledTimes(2);
    await settle(60_000);
    expect(api).toHaveBeenCalledTimes(3);
  });

  it("dims after 60s idle (the wall dims)", async () => {
    good();
    const { findByTestId, getByTestId } = render(<Screensaver />, { wrapper: wrap });
    await findByTestId("ss-clock");
    expect(StyleSheet.flatten(getByTestId("ss-content").props.style)?.opacity).toBe(1);
    await settle(61_000);
    expect(StyleSheet.flatten(getByTestId("ss-content").props.style)?.opacity).toBeLessThan(1);
  });

  it("keeps the last-good board on failure and dims the clock honestly after 5min stale", async () => {
    good();
    const { findByText, getByTestId, queryByTestId } = render(<Screensaver />, { wrapper: wrap });
    expect(await findByText("Taco Night")).toBeTruthy();
    expect(queryByTestId("ss-stale")).toBeNull();
    // network dies — the board never lies, it just gets quiet about freshness
    api.mockRejectedValue(new ApiError({ message: "db_unreachable", status: 503, code: "db_unreachable", retryable: true }));
    await settle(60_000); // a failed poll: board content stays
    expect(await findByText("Taco Night")).toBeTruthy();
    expect(queryByTestId("ss-stale")).toBeNull(); // 60s < 5min — no badge yet
    await settle(300_000); // 6min since last success — past the 5min honest-stale horizon
    expect(getByTestId("ss-stale")).toBeTruthy();
    expect(StyleSheet.flatten(getByTestId("ss-clock").props.style)?.opacity).toBeLessThan(1);
  });

  it("a payload server that never answered shows honest waiting copy (no fake family data)", async () => {
    api.mockRejectedValue(new ApiError({ message: "db_unreachable", status: 503, code: "db_unreachable", retryable: true }));
    const { findByText } = render(<Screensaver />, { wrapper: wrap });
    expect(await findByText("Waiting for the family server…")).toBeTruthy();
  });

  it("malformed ok payloads are ignored — the last-good board stays", async () => {
    api.mockResolvedValueOnce({ ok: true, events: null, tasks: null, briefing: "nope" });
    const { findByText } = render(<Screensaver />, { wrapper: wrap });
    expect(await findByText("Waiting for the family server…")).toBeTruthy();
    good();
    await settle(60_000);
    expect(await findByText("Taco Night")).toBeTruthy();
  });

  it("wake-on-tap exits the board", async () => {
    good();
    const onExit = jest.fn();
    const { findByTestId, getByTestId } = render(<Screensaver onExit={onExit} />, { wrapper: wrap });
    await findByTestId("ss-clock");
    fireEvent.press(getByTestId("screensaver-root"));
    expect(onExit).toHaveBeenCalledTimes(1);

  });
});

describe("Screensaver route", () => {
  it("tap exits back; with no history it replaces with Home (never a dead end)", async () => {
    good();
    const first = render(<ScreensaverRoute />, { wrapper: wrap });
    await first.findByTestId("screensaver-root");
    fireEvent.press(first.getByTestId("screensaver-root"));
    expect(mockRouterBack).toHaveBeenCalledTimes(1);
    expect(mockRouterReplace).not.toHaveBeenCalled();
    first.unmount();

    mockCanGoBack = false;
    const second = render(<ScreensaverRoute />, { wrapper: wrap });
    await second.findByTestId("screensaver-root");
    fireEvent.press(second.getByTestId("screensaver-root"));
    expect(mockRouterReplace).toHaveBeenCalledWith("/");
  });
});

describe("home idle rule — the wall idles into the board", () => {
  it("a modal flow stands the clock down (mid-PIN taps never idle into the board)", () => {
    expect(
      idleBoardDue({ pathname: "/", idleMs: SCREENSAVER_IDLE_MS, pushed: false, blocked: true })
    ).toBe(false);
  });
  it("fires only from Home, only when quiet long enough, only once", () => {
    // just shy of the threshold: no
    expect(
      idleBoardDue({ pathname: "/", idleMs: SCREENSAVER_IDLE_MS - 1, pushed: false, blocked: false })
    ).toBe(false);
    // quiet long enough at Home: yes
    expect(idleBoardDue({ pathname: "/", idleMs: SCREENSAVER_IDLE_MS, pushed: false, blocked: false })).toBe(true);
    // already pushed (home stays mounted under the board): never re-fire
    expect(idleBoardDue({ pathname: "/", idleMs: SCREENSAVER_IDLE_MS * 2, pushed: true, blocked: false })).toBe(false);
    // any other route: no
    expect(
      idleBoardDue({ pathname: "/meals", idleMs: SCREENSAVER_IDLE_MS * 2, pushed: false, blocked: false })
    ).toBe(false);
  });
});
