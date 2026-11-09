import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DEFAULT_GENTLE_HOURS,
  DEFAULT_NOTIFICATION_PREFS,
  DEFAULT_QUIET_HOURS,
  getEffectiveNotificationVolume,
  isWithinGentleHours,
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

  describe("isWithinGentleHours", () => {
    it("identifies 5:00 AM to 8:00 AM and 8:00 PM to 11:00 PM as gentle hours by default", () => {
      // 5:00 AM (05:00) - start of morning gentle hours
      const at5am = new Date("2026-11-05T05:00:00");
      expect(isWithinGentleHours(at5am)).toBe(true);

      // 5:25 AM (05:25) - advance reminder for 5:40 AM papa leave
      const at525am = new Date("2026-11-05T05:25:00");
      expect(isWithinGentleHours(at525am)).toBe(true);

      // 5:40 AM (05:40) - papa leaving for work
      const at540am = new Date("2026-11-05T05:40:00");
      expect(isWithinGentleHours(at540am)).toBe(true);

      // 7:59 AM (07:59) - right before morning gentle hours end
      const at759am = new Date("2026-11-05T07:59:59");
      expect(isWithinGentleHours(at759am)).toBe(true);

      // 8:00 AM (08:00) - normal daytime starts
      const at8am = new Date("2026-11-05T08:00:00");
      expect(isWithinGentleHours(at8am)).toBe(false);

      // 2:15 PM (14:15) - midday
      const at215pm = new Date("2026-11-05T14:15:00");
      expect(isWithinGentleHours(at215pm)).toBe(false);

      // 7:59 PM (19:59) - right before evening gentle hours start
      const at759pm = new Date("2026-11-05T19:59:59");
      expect(isWithinGentleHours(at759pm)).toBe(false);

      // 8:00 PM (20:00) - evening gentle hours begin
      const at8pm = new Date("2026-11-05T20:00:00");
      expect(isWithinGentleHours(at8pm)).toBe(true);

      // 9:30 PM (21:30) - kid bedtime routines
      const at930pm = new Date("2026-11-05T21:30:00");
      expect(isWithinGentleHours(at930pm)).toBe(true);

      // 10:59 PM (22:59) - right before night quiet hours
      const at1059pm = new Date("2026-11-05T22:59:59");
      expect(isWithinGentleHours(at1059pm)).toBe(true);

      // 11:00 PM (23:00) - quiet hours take over (muted, not gentle)
      const at11pm = new Date("2026-11-05T23:00:00");
      expect(isWithinGentleHours(at11pm)).toBe(false);
    });

    it("returns false at all times when gentle hours is disabled", () => {
      const config = { ...DEFAULT_GENTLE_HOURS, enabled: false };
      const at540am = new Date("2026-11-05T05:40:00");
      expect(isWithinGentleHours(at540am, config)).toBe(false);
      const at830pm = new Date("2026-11-05T20:30:00");
      expect(isWithinGentleHours(at830pm, config)).toBe(false);
    });
  });

  describe("getEffectiveNotificationVolume", () => {
    it("caps loud volumes at maxVolume (default 0.40) during gentle hours", () => {
      const at540am = new Date("2026-11-05T05:40:00");
      // 80% volume capped to 40%
      expect(getEffectiveNotificationVolume(0.8, at540am)).toEqual({
        volume: 0.4,
        isGentle: true,
      });
      // 100% volume capped to 40%
      expect(getEffectiveNotificationVolume(1.0, at540am)).toEqual({
        volume: 0.4,
        isGentle: true,
      });
    });

    it("leaves already quiet volumes untouched during gentle hours", () => {
      const at540am = new Date("2026-11-05T05:40:00");
      // 25% is softer than 40% cap, remains 25%
      expect(getEffectiveNotificationVolume(0.25, at540am)).toEqual({
        volume: 0.25,
        isGentle: true,
      });
      expect(getEffectiveNotificationVolume(0.3, at540am)).toEqual({
        volume: 0.3,
        isGentle: true,
      });
    });

    it("leaves volumes unchanged during regular daytime hours", () => {
      const at215pm = new Date("2026-11-05T14:15:00");
      expect(getEffectiveNotificationVolume(0.8, at215pm)).toEqual({
        volume: 0.8,
        isGentle: false,
      });
      expect(getEffectiveNotificationVolume(1.0, at215pm)).toEqual({
        volume: 1.0,
        isGentle: false,
      });
    });

    it("leaves volumes unchanged when gentle hours is disabled", () => {
      const config = { ...DEFAULT_GENTLE_HOURS, enabled: false };
      const at540am = new Date("2026-11-05T05:40:00");
      expect(getEffectiveNotificationVolume(0.8, at540am, config)).toEqual({
        volume: 0.8,
        isGentle: false,
      });
    });
  });
});
