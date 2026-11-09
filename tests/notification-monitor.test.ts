jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

import {
  isSevereWeather,
  isStartingSoon,
  isDueNow,
  evaluateRoutineMealGate,
  loadAlertedKeys,
  markKeyAlerted,
  isKeyAlerted,
  resetAlertedKeysCache,
} from "../src/native/useNotificationMonitor";
import {
  isWithinQuietHours,
  resolveTimingPreference,
} from "../src/native/notificationPrefs";

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

  it("suppresses routine alerts at 4:35 AM and 4:50 AM due to quiet hours", () => {
    // 4:35 AM: advance due for 4:50 AM routine
    const advanceNow = new Date("2026-11-05T04:35:00");
    expect(isStartingSoon("04:50", advanceNow, 15)).toBe(true);
    expect(isWithinQuietHours(advanceNow)).toBe(true);

    // 4:50 AM: start due for 4:50 AM routine
    const startNow = new Date("2026-11-05T04:50:00");
    expect(isDueNow("04:50", startNow, 2)).toBe(true);
    expect(isWithinQuietHours(startNow)).toBe(true);
  });

  it("allows routine alerts after 5:00 AM (e.g. 5:40 AM Papa Leaving to work)", () => {
    // 5:25 AM: advance notice for 5:40 AM
    const advanceNow = new Date("2026-11-05T05:25:00");
    expect(isStartingSoon("05:40", advanceNow, 15)).toBe(true);
    expect(isWithinQuietHours(advanceNow)).toBe(false); // Quiet hours ended at 5:00 AM!

    // 5:40 AM: start due for 5:40 AM
    const startNow = new Date("2026-11-05T05:40:00");
    expect(isDueNow("05:40", startNow, 2)).toBe(true);
    expect(isWithinQuietHours(startNow)).toBe(false);
  });

  it("suppresses Dinner, Lunch, and Breakfast call-outs when no meal is scheduled for that slot today", () => {
    const friday = new Date(2026, 10, 6, 18, 0, 0); // Friday Nov 6, 2026
    const dinnerRoutine = { id: "d1", title: "Dinner", time: "18:15", icon: "🍽️" };
    const lunchRoutine = { id: "l1", title: "Lunch", time: "12:30", icon: "🥪" };
    const breakfastRoutine = { id: "b1", title: "Breakfast", time: "07:00", icon: "🍳" };
    const dogsRoutine = { id: "g1", title: "Take Dogs Out", time: "19:00", icon: "🐶" };

    // Empty meal plan -> meal routines suppressed, non-meal routine allowed
    expect(evaluateRoutineMealGate(dinnerRoutine, friday, []).shouldCallOut).toBe(false);
    expect(evaluateRoutineMealGate(lunchRoutine, friday, []).shouldCallOut).toBe(false);
    expect(evaluateRoutineMealGate(breakfastRoutine, friday, []).shouldCallOut).toBe(false);
    expect(evaluateRoutineMealGate(dogsRoutine, friday, []).shouldCallOut).toBe(true);
  });

  it("allows and enriches meal routine call-out when a meal IS scheduled for that slot today", () => {
    const friday = new Date(2026, 10, 6, 18, 0, 0); // Friday Nov 6, 2026 (weekOf 2026-11-02)
    const dinnerRoutine = { id: "d1", title: "Dinner", time: "18:15", icon: "🍽️" };
    const plannedMeals = [
      {
        id: "m1",
        name: "Lasagna",
        emoji: "🍝",
        time: "Fri",
        mealType: "dinner",
        weekOf: "2026-11-02",
      },
    ];

    const res = evaluateRoutineMealGate(dinnerRoutine, friday, plannedMeals);
    expect(res.shouldCallOut).toBe(true);
    expect(res.displayTitle).toBe("Dinner: Lasagna");
    expect(res.displayIcon).toBe("🍝");
  });

  describe("alerted keys registry & deduplication", () => {
    beforeEach(() => {
      resetAlertedKeysCache();
    });

    it("loads and persists alerted keys across check cycles", async () => {
      const todayISO = "2026-11-09";
      await loadAlertedKeys(todayISO);
      expect(isKeyAlerted(`${todayISO}:routines:r1:advance`)).toBe(false);

      await markKeyAlerted(todayISO, `${todayISO}:routines:r1:advance`);
      expect(isKeyAlerted(`${todayISO}:routines:r1:advance`)).toBe(true);

      // Emulate cache reload from storage
      resetAlertedKeysCache();
      await loadAlertedKeys(todayISO);
      expect(isKeyAlerted(`${todayISO}:routines:r1:advance`)).toBe(true);
    });

    it("clears cached keys when date rolls over to a new day", async () => {
      await loadAlertedKeys("2026-11-08");
      await markKeyAlerted("2026-11-08", "2026-11-08:routines:r1:advance");
      expect(isKeyAlerted("2026-11-08:routines:r1:advance")).toBe(true);

      // Tomorrow arrives
      await loadAlertedKeys("2026-11-09");
      expect(isKeyAlerted("2026-11-08:routines:r1:advance")).toBe(false);
    });
  });

  describe("timingMode resolution & filtering", () => {
    it("respects advance_only mode (15 min warning only)", () => {
      const config = {
        enabled: true,
        sound: "harp" as const,
        volume: 0.7,
        timingMode: "advance_only" as const,
        advanceEnabled: true,
        startEnabled: false,
      };

      const mode = resolveTimingPreference(config);
      expect(mode).toBe("advance_only");

      const advanceAllowed = mode !== "start_only" && config.advanceEnabled !== false;
      const startAllowed = mode !== "advance_only" && config.startEnabled !== false;

      expect(advanceAllowed).toBe(true);
      expect(startAllowed).toBe(false); // Start notification suppressed!
    });

    it("respects start_only mode (at start time only)", () => {
      const config = {
        enabled: true,
        sound: "harp" as const,
        volume: 0.7,
        timingMode: "start_only" as const,
        advanceEnabled: false,
        startEnabled: true,
      };

      const mode = resolveTimingPreference(config);
      expect(mode).toBe("start_only");

      const advanceAllowed = mode !== "start_only" && config.advanceEnabled !== false;
      const startAllowed = mode !== "advance_only" && config.startEnabled !== false;

      expect(advanceAllowed).toBe(false); // 15-min notification suppressed!
      expect(startAllowed).toBe(true);
    });

    it("respects both mode (both 15-min and start)", () => {
      const config = {
        enabled: true,
        sound: "harp" as const,
        volume: 0.7,
        timingMode: "both" as const,
        advanceEnabled: true,
        startEnabled: true,
      };

      const mode = resolveTimingPreference(config);
      expect(mode).toBe("both");

      const advanceAllowed = mode !== "start_only" && config.advanceEnabled !== false;
      const startAllowed = mode !== "advance_only" && config.startEnabled !== false;

      expect(advanceAllowed).toBe(true);
      expect(startAllowed).toBe(true);
    });
  });
});
