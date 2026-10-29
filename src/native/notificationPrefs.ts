import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { NotificationSound } from "./soundEffects";

export type NotificationCategory = "weather" | "calendar" | "routines";

export interface CategoryNotificationConfig {
  enabled: boolean;
  sound: NotificationSound;
  volume: number; // 0.0 to 1.0
  // Advance (15-min) notice configuration
  advanceEnabled?: boolean;
  advanceSound?: NotificationSound;
  advanceVolume?: number;
  // Event start / routine due configuration
  startEnabled?: boolean;
  startSound?: NotificationSound;
  startVolume?: number;
}

export interface NotificationPreferences {
  weather: CategoryNotificationConfig;
  calendar: CategoryNotificationConfig;
  routines: CategoryNotificationConfig;
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

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  weather: {
    enabled: true,
    sound: "radar",
    volume: 0.8,
  },
  calendar: {
    enabled: true,
    sound: "chime",
    volume: 0.7,
    advanceEnabled: true,
    advanceSound: "chime",
    advanceVolume: 0.7,
    startEnabled: true,
    startSound: "beacon",
    startVolume: 0.8,
  },
  routines: {
    enabled: true,
    sound: "harp",
    volume: 0.7,
    advanceEnabled: true,
    advanceSound: "harp",
    advanceVolume: 0.7,
    startEnabled: true,
    startSound: "bell",
    startVolume: 0.8,
  },
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
      },
      routines: {
        ...DEFAULT_NOTIFICATION_PREFS.routines,
        ...(parsed.routines ?? {}),
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

  return { prefs, loading, updateCategory };
}
