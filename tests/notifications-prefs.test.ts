import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DEFAULT_NOTIFICATION_PREFS,
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
  });
});
