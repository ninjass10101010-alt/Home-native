import { Platform } from "react-native";
import {
  loadNotificationPreferences,
  type NotificationCategory,
} from "./notificationPrefs";
import { playNotificationSound } from "./soundEffects";
import { TOKENS } from "../theme/tokens";

/**
 * expo-notifications is NATIVE-ONLY, and importing it on web is not free:
 * its web shim registers a push-token listener at module load and logs
 * "Listening to push token changes is not yet fully supported on web", which
 * the capture harness treats as a shipped-surface defect (a console warning
 * on the wall's web preview). The module is therefore resolved LAZILY, and
 * never on web.
 */
type NotificationsModule = typeof import("expo-notifications");

let cached: NotificationsModule | null = null;

function notifications(): NotificationsModule | null {
  if (Platform.OS === "web") return null;
  if (!cached) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- the native module must stay out of the web bundle
    cached = require("expo-notifications") as NotificationsModule;
  }
  return cached;
}

let configured = false;

const CHANNELS: Record<
  NotificationCategory | "emergency" | "general",
  { id: string; name: string; importance: number }
> = {
  weather: { id: "consuela-weather", name: "Weather Advisories", importance: 4 }, // HIGH
  calendar: { id: "consuela-calendar", name: "Calendar Reminders", importance: 3 }, // DEFAULT
  routines: { id: "consuela-routines", name: "Routine Reminders", importance: 3 }, // DEFAULT
  emergency: { id: "consuela-emergency", name: "Emergency Alerts", importance: 5 }, // MAX
  general: { id: "consuela-general", name: "General Reminders", importance: 3 }, // DEFAULT
};

export function configureNotifications() {
  if (configured) return;
  configured = true;
  const Notifications = notifications();
  if (!Notifications) return;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    if (Platform.OS === "android" && typeof Notifications.setNotificationChannelAsync === "function") {
      for (const ch of Object.values(CHANNELS)) {
        void Notifications.setNotificationChannelAsync(ch.id, {
          name: ch.name,
          importance: ch.importance as any,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: TOKENS.dark["color-accent-amber"],
        }).catch(() => {});
      }
    }
  } catch {
    // ignore
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof jest !== "undefined") return false;
  const Notifications = notifications();
  if (!Notifications) return false;
  try {
    const settings = await Notifications.getPermissionsAsync();
    if (settings.granted) return true;
    const req = await Notifications.requestPermissionsAsync();
    return req.granted;
  } catch {
    return false;
  }
}

export interface PostNotificationParams {
  category: NotificationCategory | "emergency" | "general";
  title: string;
  body: string;
  data?: Record<string, unknown>;
  timing?: "advance" | "start";
}

/**
 * Dispatches an immediate notification respecting the category's enabled toggle,
 * custom sound, and volume setting.
 */
export async function dispatchNotification({
  category,
  title,
  body,
  data,
  timing,
}: PostNotificationParams): Promise<string | null> {
  if (category !== "emergency" && category !== "general") {
    const prefs = await loadNotificationPreferences();
    const config = prefs[category];
    if (!config.enabled) {
      return null;
    }
    if (timing === "advance") {
      if (config.advanceEnabled === false) return null;
      const sound = config.advanceSound ?? config.sound;
      const volume = config.advanceVolume ?? config.volume;
      void playNotificationSound(sound, volume);
    } else if (timing === "start") {
      if (config.startEnabled === false) return null;
      const sound = config.startSound ?? config.sound;
      const volume = config.startVolume ?? config.volume;
      void playNotificationSound(sound, volume);
    } else {
      // Play default category audio tone at configured volume
      void playNotificationSound(config.sound, config.volume);
    }
  } else if (category === "emergency") {
    void playNotificationSound("radar", 1.0);
  }

  if (typeof jest !== "undefined") return "mock-id";
  const Notifications = notifications();
  if (!Notifications) return null;

  try {
    const granted = await requestNotificationPermission();
    if (!granted) return null;

    const channel = CHANNELS[category] ?? CHANNELS.general;
    return await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data ?? {},
        sound: true,
        ...(Platform.OS === "android" ? { channelId: channel.id } : {}),
      },
      trigger: null, // immediate
    });
  } catch {
    return null;
  }
}

/**
 * Schedules a local notification at a future delay in seconds.
 */
export async function scheduleCategoryReminder(
  category: NotificationCategory | "emergency" | "general",
  title: string,
  body: string,
  seconds = 60,
  data?: Record<string, unknown>
): Promise<string | null> {
  if (category !== "emergency" && category !== "general") {
    const prefs = await loadNotificationPreferences();
    if (!prefs[category].enabled) return null;
  }

  if (typeof jest !== "undefined") return "mock-id";
  const Notifications = notifications();
  if (!Notifications) return null;

  try {
    const granted = await requestNotificationPermission();
    if (!granted) return null;

    const channel = CHANNELS[category] ?? CHANNELS.general;
    return await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data ?? {},
        sound: true,
        ...(Platform.OS === "android" ? { channelId: channel.id } : {}),
      },
      trigger: { seconds, repeats: false } as any,
    });
  } catch {
    return null;
  }
}

/** Legacy signature for backward compatibility with settings & emergency */
export async function scheduleLocalReminder(
  title: string,
  body: string,
  seconds = 60,
  data?: Record<string, unknown>
) {
  return scheduleCategoryReminder("general", title, body, seconds, data);
}

export async function cancelAllNotifications() {
  if (typeof jest !== "undefined") return;
  const Notifications = notifications();
  if (!Notifications) return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // ignore
  }
}
