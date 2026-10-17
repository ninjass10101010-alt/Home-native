import * as Notifications from "expo-notifications";

let configured = false;

export function configureNotifications() {
  if (configured) return;
  configured = true;
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
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // ignore
  }
}
