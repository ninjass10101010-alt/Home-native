import { AppState, Platform } from "react-native";
import { api } from "../api/client";
import {
  getEffectiveNotificationVolume,
  isWithinQuietHours,
  loadNotificationPreferences,
  resolveTimingPreference,
  type NotificationCategory,
} from "./notificationPrefs";
import { playNotificationAudio, resolveVoiceCallout } from "./voiceCallouts";
import { postActiveNotification } from "./notificationFeed";
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

export function resetNotificationsConfiguredForTests(): void {
  configured = false;
}

export function configureNotifications() {
  if (configured) return;
  configured = true;
  const Notifications = notifications();
  if (!Notifications) return;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: false,
        shouldShowList: false,
      }),
    });

    if (Platform.OS === "android" && typeof Notifications.setNotificationChannelAsync === "function") {
      for (const ch of Object.values(CHANNELS)) {
        void Notifications.setNotificationChannelAsync(ch.id, {
          name: ch.name,
          importance: ch.importance as any,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: TOKENS.dark["color-accent-amber"],
          sound: null, // silent channel - custom in-app audio engine plays the selected tone & volume
        }).catch(() => {});
      }
    }
  } catch {
    // ignore
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
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

const recentDispatches = new Map<string, number>();

export function resetRecentDispatchesCache(): void {
  recentDispatches.clear();
}

/**
 * Forwards an alert to Home-ai so configured Google speakers announce it too.
 * Never throws or blocks local tablet delivery.
 */
export async function forwardNotificationToSpeakers(params: {
  category: PostNotificationParams["category"];
  title: string;
  body: string;
  volume?: number;
}): Promise<void> {
  try {
    await api("/api/broadcast", {
      method: "POST",
      body: {
        message: params.body || params.title,
        title: params.title,
        category: params.category,
        voiceKey: resolveVoiceCallout(params.category, params.title, params.body),
        volume: params.volume,
        skipTablet: true,
      },
    });
  } catch {
    // Speaker broadcast is best-effort; never fail local tablet delivery
  }
}

/**
 * Dispatches an immediate notification respecting the category's enabled toggle,
 * custom sound, and volume setting. Suppresses OS shade delivery while Consuela
 * is in the foreground so alerts only appear in the in-app dashboard banner.
 */
export async function dispatchNotification({
  category,
  title,
  body,
  data,
  timing,
}: PostNotificationParams): Promise<string | null> {
  // Deduplicate rapid identical dispatches (e.g. within 2000ms)
  const dedupeKey = `${category}:${title}:${body}:${timing ?? ""}`;
  const now = Date.now();
  const lastTime = recentDispatches.get(dedupeKey);
  if (lastTime && now - lastTime < 2000) {
    return null;
  }
  recentDispatches.set(dedupeKey, now);
  if (recentDispatches.size > 50) {
    for (const [k, t] of recentDispatches.entries()) {
      if (now - t > 10_000) recentDispatches.delete(k);
    }
  }

  let isQuiet = false;
  let effectiveVolume: number | undefined;
  if (category !== "emergency" && category !== "general") {
    const prefs = await loadNotificationPreferences();
    const config = prefs[category];
    if (!config.enabled) {
      return null;
    }
    isQuiet = category !== "weather" && isWithinQuietHours(new Date(), prefs.quietHours);
    if (!isQuiet) {
      const timingMode = resolveTimingPreference(config);
      const targetVolume =
        timing === "advance"
          ? config.advanceVolume ?? config.volume
          : timing === "start"
            ? config.startVolume ?? config.volume
            : config.volume;

      // Automatically cap notification volume to 40% (or quieter) during gentle morning and evening hours
      const { volume } = getEffectiveNotificationVolume(
        targetVolume,
        new Date(),
        prefs.gentleHours
      );
      effectiveVolume = volume;

      if (timing === "advance") {
        if (config.advanceEnabled === false || timingMode === "start_only") return null;
        const sound = config.advanceSound ?? config.sound;
        const soundMode = config.advanceSoundMode ?? config.soundMode ?? "tone_and_voice";
        void playNotificationAudio({ sound, volume, soundMode, category, title, body });
      } else if (timing === "start") {
        if (config.startEnabled === false || timingMode === "advance_only") return null;
        const sound = config.startSound ?? config.sound;
        const soundMode = config.startSoundMode ?? config.soundMode ?? "tone_and_voice";
        void playNotificationAudio({ sound, volume, soundMode, category, title, body });
      } else {
        // Play category audio respecting soundMode (tone + Sarah voice call-out)
        const soundMode = config.soundMode ?? "tone_and_voice";
        void playNotificationAudio({ sound: config.sound, volume, soundMode, category, title, body });
      }
    }
  } else if (category === "emergency") {
    effectiveVolume = 1.0;
    void playNotificationAudio({
      sound: "radar",
      volume: 1.0,
      soundMode: "tone_and_voice",
      category: "emergency",
      title,
      body,
    });
  }

  const notifId = `notif-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  postActiveNotification({
    id: notifId,
    category,
    title,
    body,
    data,
    timing,
    timestamp: Date.now(),
  });

  if (!isQuiet && data?.skipSpeakers !== true && typeof jest === "undefined") {
    void forwardNotificationToSpeakers({
      category,
      title,
      body,
      volume: effectiveVolume,
    });
  }

  if (AppState.currentState === "active") {
    return notifId;
  }

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
        sound: false,
      },
      trigger: Platform.OS === "android" ? { channelId: channel.id } : null,
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
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes?.TIME_INTERVAL ?? "timeInterval",
        seconds,
        repeats: false,
        ...(Platform.OS === "android" ? { channelId: channel.id } : {}),
      } as any,
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
  const Notifications = notifications();
  if (!Notifications) return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // ignore
  }
}
