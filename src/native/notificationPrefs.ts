import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { NotificationSound } from "./soundEffects";
import type { SoundMode } from "./voiceCallouts";

export type NotificationCategory = "weather" | "calendar" | "routines";

export type TimingPreference = "advance_only" | "start_only" | "both";

export interface CategoryNotificationConfig {
  enabled: boolean;
  sound: NotificationSound;
  volume: number; // 0.0 to 1.0
  soundMode?: SoundMode; // "tone_and_voice" | "voice_only" | "tone_only"
  // Timing preference: "both" (default), "advance_only" (15 min warning only), or "start_only"
  timingMode?: TimingPreference;
  // Advance (15-min) notice configuration
  advanceEnabled?: boolean;
  advanceSound?: NotificationSound;
  advanceVolume?: number;
  advanceSoundMode?: SoundMode;
  // Event start / routine due configuration
  startEnabled?: boolean;
  startSound?: NotificationSound;
  startVolume?: number;
  startSoundMode?: SoundMode;
}

export interface QuietHoursConfig {
  enabled: boolean;
  startHour: number; // 0-23 (default 23 = 11 PM)
  startMinute: number; // 0-59 (default 0)
  endHour: number; // 0-23 (default 5 = 5 AM)
  endMinute: number; // 0-59 (default 0)
}

export interface GentleHoursConfig {
  enabled: boolean;
  maxVolume: number; // 0.1 to 1.0 (default 0.4 = 40% or quieter)
  morningStartHour: number; // default 5 (5:00 AM, quiet hours end)
  morningEndHour: number; // default 8 (8:00 AM)
  eveningStartHour: number; // default 20 (8:00 PM)
  eveningEndHour: number; // default 23 (11:00 PM, quiet hours start)
}

export interface NotificationPreferences {
  weather: CategoryNotificationConfig;
  calendar: CategoryNotificationConfig;
  routines: CategoryNotificationConfig;
  quietHours: QuietHoursConfig;
  gentleHours: GentleHoursConfig;
}

export const NOTIFICATION_CATEGORIES: readonly NotificationCategory[] = [
  "weather",
  "calendar",
  "routines",
];

export const CATEGORY_META: Record<
  NotificationCategory,
  {
    title: string;
    subtitle: string;
    icon: string;
    defaultSound: NotificationSound;
    hasTimingStages?: boolean;
  }
> = {
  weather: {
    title: "Weather Advisories",
    subtitle: "Severe thunderstorms, heavy snow, and high-wind alerts",
    icon: "⛈️",
    defaultSound: "radar",
    hasTimingStages: false,
  },
  calendar: {
    title: "Calendar Reminders",
    subtitle: "Appointments, games, recitals, and timed family events",
    icon: "📅",
    defaultSound: "chime",
    hasTimingStages: true,
  },
  routines: {
    title: "Routine Reminders",
    subtitle: "Daily family schedules, morning/evening habits, and chores",
    icon: "⏰",
    defaultSound: "harp",
    hasTimingStages: true,
  },
};

export const DEFAULT_QUIET_HOURS: QuietHoursConfig = {
  enabled: true,
  startHour: 23, // 11:00 PM
  startMinute: 0,
  endHour: 5, // 5:00 AM
  endMinute: 0,
};

export const DEFAULT_GENTLE_HOURS: GentleHoursConfig = {
  enabled: true,
  maxVolume: 0.4, // 40% volume cap for soft morning & late evening notices
  morningStartHour: 5, // 5:00 AM (matches quiet hours morning end)
  morningEndHour: 8, // 8:00 AM (until full house wakes up)
  eveningStartHour: 20, // 8:00 PM (starts around kid wind-down / reading)
  eveningEndHour: 23, // 11:00 PM (until nighttime silent quiet hours begin)
};

/**
 * Returns true if the given date falls within the configured Gentle Hours window (mornings & evenings).
 */
export function isWithinGentleHours(
  date: Date = new Date(),
  config: GentleHoursConfig = DEFAULT_GENTLE_HOURS
): boolean {
  if (!config.enabled) return false;
  const currentMinutes = date.getHours() * 60 + date.getMinutes();
  const mStart = config.morningStartHour * 60;
  const mEnd = config.morningEndHour * 60;
  const eStart = config.eveningStartHour * 60;
  const eEnd = config.eveningEndHour * 60;

  // Morning gentle window (e.g. 5:00 AM to 8:00 AM)
  if (mStart < mEnd && currentMinutes >= mStart && currentMinutes < mEnd) {
    return true;
  }

  // Evening gentle window (e.g. 8:00 PM to 11:00 PM)
  if (eStart < eEnd) {
    if (currentMinutes >= eStart && currentMinutes < eEnd) return true;
  } else if (eStart > eEnd) {
    if (currentMinutes >= eStart || currentMinutes < eEnd) return true;
  }

  return false;
}

/**
 * Calculates effective notification volume respecting Gentle Hours (caps at 40% or quieter).
 */
export function getEffectiveNotificationVolume(
  targetVolume: number,
  date: Date = new Date(),
  config: GentleHoursConfig = DEFAULT_GENTLE_HOURS
): { volume: number; isGentle: boolean } {
  if (isWithinGentleHours(date, config)) {
    const clamped = Math.min(targetVolume, config.maxVolume);
    return { volume: clamped, isGentle: true };
  }
  return { volume: targetVolume, isGentle: false };
}

/**
 * Returns true if the given date falls within the configured Quiet Hours window.
 * Handles crossing midnight cleanly (e.g. 11:00 PM to 5:00 AM).
 */
export function isWithinQuietHours(
  date: Date = new Date(),
  config: QuietHoursConfig = DEFAULT_QUIET_HOURS
): boolean {
  if (!config.enabled) return false;
  const currentMinutes = date.getHours() * 60 + date.getMinutes();
  const startMinutes = config.startHour * 60 + config.startMinute;
  const endMinutes = config.endHour * 60 + config.endMinute;

  if (startMinutes > endMinutes) {
    // Spans midnight, e.g. 23:00 (11 PM) to 05:00 (5 AM)
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  } else if (startMinutes < endMinutes) {
    // Same day window, e.g. 01:00 to 05:00
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }
  return false;
}

/**
 * Resolves the effective timing preference ("advance_only" | "start_only" | "both")
 * for a category configuration, handling legacy advanceEnabled/startEnabled flags.
 */
export function resolveTimingPreference(
  config?: CategoryNotificationConfig
): TimingPreference {
  if (!config) return "both";
  if (config.timingMode) return config.timingMode;
  if (config.startEnabled === false && config.advanceEnabled !== false) return "advance_only";
  if (config.advanceEnabled === false && config.startEnabled !== false) return "start_only";
  return "both";
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  weather: {
    enabled: true,
    sound: "radar",
    volume: 0.8,
    soundMode: "tone_and_voice",
  },
  calendar: {
    enabled: true,
    sound: "chime",
    volume: 0.7,
    soundMode: "tone_and_voice",
    timingMode: "both",
    advanceEnabled: true,
    advanceSound: "chime",
    advanceVolume: 0.7,
    advanceSoundMode: "tone_and_voice",
    startEnabled: true,
    startSound: "beacon",
    startVolume: 0.8,
    startSoundMode: "tone_and_voice",
  },
  routines: {
    enabled: true,
    sound: "harp",
    volume: 0.7,
    soundMode: "tone_and_voice",
    timingMode: "both",
    advanceEnabled: true,
    advanceSound: "harp",
    advanceVolume: 0.7,
    advanceSoundMode: "tone_and_voice",
    startEnabled: true,
    startSound: "bell",
    startVolume: 0.8,
    startSoundMode: "tone_and_voice",
  },
  quietHours: { ...DEFAULT_QUIET_HOURS },
  gentleHours: { ...DEFAULT_GENTLE_HOURS },
};

export const STORAGE_KEY_NOTIFICATION_PREFS = "@consuela/notification_preferences";

let memoryCachedPrefs: NotificationPreferences = { ...DEFAULT_NOTIFICATION_PREFS };
const listeners = new Set<(prefs: NotificationPreferences) => void>();

function notifyListeners(prefs: NotificationPreferences) {
  memoryCachedPrefs = prefs;
  for (const listener of listeners) {
    try {
      listener(prefs);
    } catch {
      // ignore
    }
  }
}

export function resetNotificationPreferencesCache(): void {
  memoryCachedPrefs = {
    weather: { ...DEFAULT_NOTIFICATION_PREFS.weather },
    calendar: { ...DEFAULT_NOTIFICATION_PREFS.calendar },
    routines: { ...DEFAULT_NOTIFICATION_PREFS.routines },
    quietHours: { ...DEFAULT_NOTIFICATION_PREFS.quietHours },
    gentleHours: { ...DEFAULT_NOTIFICATION_PREFS.gentleHours },
  };
}

/**
 * Load notification preferences from AsyncStorage, merging with defaults.
 */
export async function loadNotificationPreferences(): Promise<NotificationPreferences> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_NOTIFICATION_PREFS);
    if (!raw) {
      return memoryCachedPrefs;
    }
    const parsed = JSON.parse(raw);
    const merged: NotificationPreferences = {
      weather: {
        ...DEFAULT_NOTIFICATION_PREFS.weather,
        ...(parsed.weather ?? {}),
      },
      calendar: {
        ...DEFAULT_NOTIFICATION_PREFS.calendar,
        ...(parsed.calendar ?? {}),
        timingMode: resolveTimingPreference(parsed.calendar),
      },
      routines: {
        ...DEFAULT_NOTIFICATION_PREFS.routines,
        ...(parsed.routines ?? {}),
        timingMode: resolveTimingPreference(parsed.routines),
      },
      quietHours: {
        ...DEFAULT_NOTIFICATION_PREFS.quietHours,
        ...(parsed.quietHours ?? {}),
      },
      gentleHours: {
        ...DEFAULT_NOTIFICATION_PREFS.gentleHours,
        ...(parsed.gentleHours ?? {}),
      },
    };
    memoryCachedPrefs = merged;
    return merged;
  } catch {
    return { ...DEFAULT_NOTIFICATION_PREFS };
  }
}

/**
 * Save notification preferences to AsyncStorage and notify active hooks.
 */
export async function saveNotificationPreferences(
  prefs: NotificationPreferences
): Promise<void> {
  notifyListeners(prefs);
  try {
    await AsyncStorage.setItem(
      STORAGE_KEY_NOTIFICATION_PREFS,
      JSON.stringify(prefs)
    );
  } catch {
    // ignore
  }
}

/**
 * React hook for reading and editing notification preferences.
 */
export function useNotificationPreferences() {
  const [prefs, setPrefs] = useState<NotificationPreferences>(memoryCachedPrefs);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    void loadNotificationPreferences().then(() => {
      if (alive) {
        setPrefs({ ...memoryCachedPrefs });
        setLoading(false);
      }
    });

    const listener = (updated: NotificationPreferences) => {
      if (alive) setPrefs({ ...updated });
    };
    listeners.add(listener);
    return () => {
      alive = false;
      listeners.delete(listener);
    };
  }, []);

  const updateCategory = useCallback(
    (
      category: NotificationCategory,
      patch: Partial<CategoryNotificationConfig>
    ) => {
      const next: NotificationPreferences = {
        ...memoryCachedPrefs,
        [category]: {
          ...memoryCachedPrefs[category],
          ...patch,
        },
      };
      memoryCachedPrefs = next;
      setPrefs(next);
      void saveNotificationPreferences(next);
    },
    []
  );

  const updateQuietHours = useCallback(
    (patch: Partial<QuietHoursConfig>) => {
      const next: NotificationPreferences = {
        ...memoryCachedPrefs,
        quietHours: {
          ...memoryCachedPrefs.quietHours,
          ...patch,
        },
      };
      memoryCachedPrefs = next;
      setPrefs(next);
      void saveNotificationPreferences(next);
    },
    []
  );

  const updateGentleHours = useCallback(
    (patch: Partial<GentleHoursConfig>) => {
      const next: NotificationPreferences = {
        ...memoryCachedPrefs,
        gentleHours: {
          ...memoryCachedPrefs.gentleHours,
          ...patch,
        },
      };
      memoryCachedPrefs = next;
      setPrefs(next);
      void saveNotificationPreferences(next);
    },
    []
  );

  return { prefs, loading, updateCategory, updateQuietHours, updateGentleHours };
}
