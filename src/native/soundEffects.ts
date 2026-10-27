import { Platform } from "react-native";

export const NOTIFICATION_SOUNDS = [
  "chime",
  "radar",
  "harp",
  "bell",
  "marimba",
  "pulse",
] as const;

export type NotificationSound = (typeof NOTIFICATION_SOUNDS)[number];

export const SOUND_LABELS: Record<NotificationSound, string> = {
  chime: "Warm Chime",
  radar: "Radar Pulse",
  harp: "Gentle Harp",
  bell: "Service Bell",
  marimba: "Warm Marimba",
  pulse: "Double Pulse",
};

export const SOUND_ICONS: Record<NotificationSound, string> = {
  chime: "🔔",
  radar: "📡",
  harp: "🎵",
  bell: "🛎️",
  marimba: "🪵",
  pulse: "✨",
};

export const SOUND_ASSETS: Record<NotificationSound, number> = {
  chime: require("../../assets/sounds/chime.wav"),
  radar: require("../../assets/sounds/radar.wav"),
  harp: require("../../assets/sounds/harp.wav"),
  bell: require("../../assets/sounds/bell.wav"),
  marimba: require("../../assets/sounds/marimba.wav"),
  pulse: require("../../assets/sounds/pulse.wav"),
};

type AudioModuleType = typeof import("expo-audio");

let audioModuleCached: AudioModuleType | null = null;

function getAudioModule(): AudioModuleType | null {
  if (Platform.OS === "web") return null;
  if (!audioModuleCached) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      audioModuleCached = require("expo-audio") as AudioModuleType;
    } catch {
      return null;
    }
  }
  return audioModuleCached;
}

/**
 * Play a notification tone at the specified volume (0.0 to 1.0).
 * Cleans up player resource automatically.
 */
export async function playNotificationSound(
  sound: NotificationSound,
  volume = 0.8
): Promise<void> {
  const mod = getAudioModule();
  if (!mod || typeof mod.createAudioPlayer !== "function") return;

  const asset = SOUND_ASSETS[sound];
  if (!asset) return;

  try {
    const player = mod.createAudioPlayer(asset);
    const clampedVol = Math.max(0, Math.min(1, volume));
    (player as any).volume = clampedVol;
    player.play();

    // Auto cleanup after 2.5s (longest sound is 1.1s)
    setTimeout(() => {
      try {
        if (typeof player.remove === "function") {
          player.remove();
        }
      } catch {
        // ignore
      }
    }, 2500);
  } catch {
    // ignore
  }
}
