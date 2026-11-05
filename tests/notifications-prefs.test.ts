import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DEFAULT_NOTIFICATION_PREFS,
  DEFAULT_QUIET_HOURS,
  isWithinQuietHours,
  loadNotificationPreferences,
  saveNotificationPreferences,
  STORAGE_KEY_NOTIFICATION_PREFS,
} from "../src/native/notificationPrefs";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

describe("notificationPrefs", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("returns defaults when storage is empty", async () => {
    const prefs = await loadNotificationPreferences();
    expect(prefs).toEqual(DEFAULT_NOTIFICATION_PREFS);
    expect(prefs.weather.enabled).toBe(true);
    expect(prefs.weather.sound).toBe("radar");
    expect(prefs.weather.volume).toBe(0.8);
    expect(prefs.calendar.enabled).toBe(true);
    expect(prefs.calendar.sound).toBe("chime");
    expect(prefs.routines.enabled).toBe(true);
    expect(prefs.routines.sound).toBe("harp");
  });

  it("saves and loads custom preferences", async () => {
    const updated = {
      ...DEFAULT_NOTIFICATION_PREFS,
      weather: { enabled: false, sound: "bell" as const, volume: 0.5 },
      calendar: { enabled: true, sound: "pulse" as const, volume: 1.0 },
    };

    await saveNotificationPreferences(updated);
    const loaded = await loadNotificationPreferences();
    expect(loaded.weather.enabled).toBe(false);
    expect(loaded.weather.sound).toBe("bell");
    expect(loaded.weather.volume).toBe(0.5);
    expect(loaded.calendar.sound).toBe("pulse");
    expect(loaded.calendar.volume).toBe(1.0);
  });

  it("merges partial saved preferences with defaults", async () => {
    await AsyncStorage.setItem(
      STORAGE_KEY_NOTIFICATION_PREFS,
      JSON.stringify({
        weather: { enabled: false },
      })
    );

    const loaded = await loadNotificationPreferences();
    expect(loaded.weather.enabled).toBe(false);
    expect(loaded.weather.sound).toBe("radar"); // default kept
    expect(loaded.calendar.enabled).toBe(true); // default kept
    expect(loaded.quietHours.enabled).toBe(true); // default kept
    expect(loaded.quietHours.startHour).toBe(23);
    expect(loaded.quietHours.endHour).toBe(5);
  });

  describe("isWithinQuietHours", () => {
    it("identifies 11:00 PM to 5:00 AM as quiet hours by default", () => {
      // 11:00 PM (23:00)
      const at11pm = new Date("2026-11-05T23:00:00");
      expect(isWithinQuietHours(at11pm)).toBe(true);

      // 11:30 PM (23:30)
      const at1130pm = new Date("2026-11-05T23:30:00");
      expect(isWithinQuietHours(at1130pm)).toBe(true);

      // 4:35 AM (04:35) - when 15m advance wake up fired
      const at435am = new Date("2026-11-05T04:35:00");
      expect(isWithinQuietHours(at435am)).toBe(true);

      // 4:50 AM (04:50) - when wake up routine starts
      const at450am = new Date("2026-11-05T04:50:00");
      expect(isWithinQuietHours(at450am)).toBe(true);

      // 5:00 AM (05:00) - quiet hours end
      const at5am = new Date("2026-11-05T05:00:00");
      expect(isWithinQuietHours(at5am)).toBe(false);

      // 5:25 AM (05:25) - advance notice for 5:40 AM papa leave
      const at525am = new Date("2026-11-05T05:25:00");
      expect(isWithinQuietHours(at525am)).toBe(false);

      // 5:40 AM (05:40) - papa leaving for work
      const at540am = new Date("2026-11-05T05:40:00");
      expect(isWithinQuietHours(at540am)).toBe(false);

      // 2:15 PM (14:15) - daytime
      const at215pm = new Date("2026-11-05T14:15:00");
      expect(isWithinQuietHours(at215pm)).toBe(false);
    });

    it("returns false at all times when quiet hours is disabled", () => {
      const config = { ...DEFAULT_QUIET_HOURS, enabled: false };
      const at435am = new Date("2026-11-05T04:35:00");
      expect(isWithinQuietHours(at435am, config)).toBe(false);
    });
  });
});
