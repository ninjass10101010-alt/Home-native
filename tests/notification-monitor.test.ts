jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

import {
  isSevereWeather,
  isStartingSoon,
  isDueNow,
} from "../src/native/useNotificationMonitor";

describe("useNotificationMonitor logic", () => {
  describe("isSevereWeather", () => {
    it("flags thunderstorms as severe (WMO >= 95)", () => {
      expect(isSevereWeather(95)).toBe(true);
      expect(isSevereWeather(96)).toBe(true);
      expect(isSevereWeather(99)).toBe(true);
    });

    it("flags heavy snow codes as severe (73, 75, 85, 86)", () => {
      expect(isSevereWeather(73)).toBe(true);
      expect(isSevereWeather(75)).toBe(true);
      expect(isSevereWeather(85)).toBe(true);
      expect(isSevereWeather(86)).toBe(true);
    });

    it("does not flag ordinary rain, clouds or clear conditions", () => {
      expect(isSevereWeather(0)).toBe(false); // clear
      expect(isSevereWeather(3)).toBe(false); // overcast
      expect(isSevereWeather(61)).toBe(false); // light rain
      expect(isSevereWeather(71)).toBe(false); // light snow
      expect(isSevereWeather(null)).toBe(false);
      expect(isSevereWeather(undefined)).toBe(false);
    });
  });

  describe("isStartingSoon", () => {
    it("returns true for an ISO time 10 minutes in the future", () => {
      const now = new Date("2026-10-26T14:00:00Z");
      const future10m = new Date("2026-10-26T14:10:00Z").toISOString();
      expect(isStartingSoon(future10m, now, 15)).toBe(true);
    });

    it("returns false for an event already started 5 minutes ago", () => {
      const now = new Date("2026-10-26T14:00:00Z");
      const past5m = new Date("2026-10-26T13:55:00Z").toISOString();
      expect(isStartingSoon(past5m, now, 15)).toBe(false);
    });

    it("returns false for an event 30 minutes in the future when lead is 15", () => {
      const now = new Date("2026-10-26T14:00:00Z");
      const future30m = new Date("2026-10-26T14:30:00Z").toISOString();
      expect(isStartingSoon(future30m, now, 15)).toBe(false);
    });

    it("handles HH:MM time strings", () => {
      const now = new Date(2026, 9, 26, 10, 0, 0);
      expect(isStartingSoon("10:12", now, 15)).toBe(true);
      expect(isStartingSoon("10:25", now, 15)).toBe(false);
      expect(isStartingSoon("09:50", now, 15)).toBe(false);
    });
  });

  describe("isDueNow", () => {
    it("returns true for an event starting right now or within 2 minutes", () => {
      const now = new Date("2026-10-26T14:00:00Z");
      const future1m = new Date("2026-10-26T14:01:00Z").toISOString();
      expect(isDueNow(future1m, now, 2)).toBe(true);
    });

    it("returns true for an event that started 30 seconds ago", () => {
      const now = new Date("2026-10-26T14:00:30Z");
      const past30s = new Date("2026-10-26T14:00:00Z").toISOString();
      expect(isDueNow(past30s, now, 2)).toBe(true);
    });

    it("returns false for an event starting in 10 minutes", () => {
      const now = new Date("2026-10-26T14:00:00Z");
      const future10m = new Date("2026-10-26T14:10:00Z").toISOString();
      expect(isDueNow(future10m, now, 2)).toBe(false);
    });
  });
});

describe("useNotificationMonitor routine integration", () => {
  it("recognizes a routine scheduled within 15 minutes", () => {
    const now = new Date(2026, 9, 26, 17, 0, 0); // 5:00 PM
    expect(isStartingSoon("17:10", now, 15)).toBe(true);
    expect(isStartingSoon("17:20", now, 15)).toBe(false);
  });
});
