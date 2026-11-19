import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

/**
 * Tactile feedback helpers for wall interactions.
 * Safe no-op on web and silently swallowed on Android panels lacking a vibrator motor.
 */
export function hapticTap(): void {
  if (Platform.OS === "web") return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function hapticSelect(): void {
  if (Platform.OS === "web") return;
  void Haptics.selectionAsync().catch(() => {});
}

export function hapticSuccess(): void {
  if (Platform.OS === "web") return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function hapticError(): void {
  if (Platform.OS === "web") return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}
