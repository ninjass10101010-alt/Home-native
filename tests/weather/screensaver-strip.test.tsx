/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { render } from "@testing-library/react-native";

import { Screensaver } from "../../src/screensaver/Screensaver";
import { ThemeProvider } from "../../src/theme/ThemeProvider";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
}));

jest.mock("../../src/api/client", () => ({
  api: jest.fn(),
  ApiError: jest.requireActual("../../src/api/client").ApiError,
}));
const { api } = jest.requireMock("../../src/api/client") as { api: jest.Mock };

const wrap = ({ children }: { children: React.ReactNode }) => <ThemeProvider>{children}</ThemeProvider>;

const PAYLOAD = {
  ok: true,
  generatedAt: "2026-10-11T11:04:00Z",
  date: "2026-10-11",
  events: [{ title: "Soccer practice", time: "4:00 PM", allDay: false }],
  dinner: { name: "Taco Night" },
  tasks: { done: 3, total: 5 },
  briefing: ["📅 1 event today"],
  weather: { tempF: 58, hiF: 70, loF: 48, condition: "Clear", weatherCode: 0, isDay: 1 },
};

beforeEach(() => {
  jest.clearAllMocks();
  api.mockReset();
});

describe("screensaver weather strip (monster restyle)", () => {
  it("renders the condition icon + monster digits from weatherCode/isDay", async () => {
    api.mockResolvedValue(PAYLOAD);
    const { findByTestId } = render(<Screensaver />, { wrapper: wrap });
    expect(await findByTestId("ss-weather-temp")).toBeTruthy();
    expect(await findByTestId("wx-icon-clear")).toBeTruthy();
    expect(await findByTestId("wx-digit-5")).toBeTruthy();
  });
});
