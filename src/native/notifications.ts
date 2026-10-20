import { Platform } from "react-native";

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

export async function scheduleLocalReminder(title: string, body: string, seconds = 60, data?: Record<string, unknown>) {
  if (typeof jest !== "undefined") return null;
  const Notifications = notifications();
  if (!Notifications) return null;
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return null;
    return await Notifications.scheduleNotificationAsync({
      content: { title, body, data: data ?? {} },
      trigger: { seconds, repeats: false } as any,
    });
  } catch {
    return null;
  }
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
