import { Platform } from "react-native";
import { playNotificationSound, type NotificationSound } from "./soundEffects";

export const VOICE_CALLOUT_KEYS = [
  "dinner_ready",
  "routine_lunch",
  "routine_breakfast",
  "routine_papa",
  "routine_papa_leave",
  "routine_school",
  "routine_school_leave",
  "routine_school_prep",
  "routine_dogs",
  "routine_snack",
  "routine_mom",
  "routine_bedtime",
  "routine_schedule_summary",
  "task_dishwasher",
  "task_bed",
  "task_generic",
  "calendar_event",
  "weather_alert",
] as const;

export type VoiceCalloutKey = (typeof VOICE_CALLOUT_KEYS)[number];

export const VOICE_CALLOUT_ASSETS: Record<VoiceCalloutKey, number> = {
  dinner_ready: require("../../assets/sounds/voices/dinner_ready.mp3"),
  routine_lunch: require("../../assets/sounds/voices/routine_lunch.mp3"),
  routine_breakfast: require("../../assets/sounds/voices/routine_breakfast.mp3"),
  routine_papa: require("../../assets/sounds/voices/routine_papa.mp3"),
  routine_papa_leave: require("../../assets/sounds/voices/routine_papa_leave.mp3"),
  routine_school: require("../../assets/sounds/voices/routine_school.mp3"),
  routine_school_leave: require("../../assets/sounds/voices/routine_school_leave.mp3"),
  routine_school_prep: require("../../assets/sounds/voices/routine_school_prep.mp3"),
  routine_dogs: require("../../assets/sounds/voices/routine_dogs.mp3"),
  routine_snack: require("../../assets/sounds/voices/routine_snack.mp3"),
  routine_mom: require("../../assets/sounds/voices/routine_mom.mp3"),
  routine_bedtime: require("../../assets/sounds/voices/routine_bedtime.mp3"),
  routine_schedule_summary: require("../../assets/sounds/voices/routine_schedule_summary.mp3"),
  task_dishwasher: require("../../assets/sounds/voices/task_dishwasher.mp3"),
  task_bed: require("../../assets/sounds/voices/task_bed.mp3"),
  task_generic: require("../../assets/sounds/voices/task_generic.mp3"),
  calendar_event: require("../../assets/sounds/voices/calendar_event.mp3"),
  weather_alert: require("../../assets/sounds/voices/weather_alert.mp3"),
};

export const VOICE_CALLOUT_DESCRIPTIONS: Record<VoiceCalloutKey, { label: string; text: string }> = {
  dinner_ready: {
    label: "Dinner Ready",
    text: "Attention Garcia Family! Dinner is ready. ¡La cena está lista, a comer!",
  },
  routine_lunch: {
    label: "Lunch Time",
    text: "Attention Garcia Family! Lunch time. ¡Hora del almuerzo!",
  },
  routine_breakfast: {
    label: "Breakfast Time",
    text: "Good morning Garcia Family! Breakfast is ready. ¡El desayuno está listo, a comer!",
  },
  routine_papa: {
    label: "Papá Coming Home",
    text: "Attention! Papá is on his way home. ¡Papá ya viene en camino!",
  },
  routine_papa_leave: {
    label: "Papá Leaving to Work",
    text: "Papá is heading out to work. ¡Papá ya sale para el trabajo!",
  },
  routine_school: {
    label: "Kids From School",
    text: "Reminder: Time to pick up the kids from school. ¡Hora de recoger a las niñas!",
  },
  routine_school_leave: {
    label: "Leaving for School",
    text: "Attention Garcia Family! Time to leave for school. ¡Hora de salir para la escuela!",
  },
  routine_school_prep: {
    label: "School Prep",
    text: "Time to get ready for school! ¡A prepararse para la escuela!",
  },
  routine_dogs: {
    label: "Take Dogs Out",
    text: "Time to take the dogs out! ¡A sacar a pasear a los perritos!",
  },
  routine_snack: {
    label: "Snack Time",
    text: "Snack time! ¡Hora de la merienda para todos!",
  },
  routine_mom: {
    label: "Mom / Rebecca Home",
    text: "Attention Garcia Family! Mom is on her way home from work. ¡Mamá ya viene en camino del trabajo!",
  },
  routine_bedtime: {
    label: "Bedtime Wind Down",
    text: "Goodnight Garcia Family! Time to wind down. ¡Hora de descansar!",
  },
  routine_schedule_summary: {
    label: "Daily Schedule Summary",
    text: "Attention Garcia Family! Here is today's daily schedule. ¡Atención familia Garcia! Este es el horario de hoy.",
  },
  task_dishwasher: {
    label: "Unload Dishwasher",
    text: "Task reminder: Time to unload the dishwasher. ¡A vaciar el lavavajillas!",
  },
  task_bed: {
    label: "Make Bed",
    text: "Task reminder: Time to make your bed. ¡A tender la cama!",
  },
  task_generic: {
    label: "Family Chore",
    text: "Family reminder: You have a task on the board. ¡Tienes una tarea pendiente!",
  },
  calendar_event: {
    label: "Calendar Event",
    text: "Calendar reminder: You have an event on the schedule. ¡Tienes un evento en el calendario!",
  },
  weather_alert: {
    label: "Weather Alert",
    text: "Weather advisory for the Garcia Family. ¡Aviso importante del clima!",
  },
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
 * Maps notification details to a Sarah bilingual voice call-out key.
 */
export function resolveVoiceCallout(
  category: string,
  title: string,
  body: string
): VoiceCalloutKey | null {
  const text = `${title} ${body}`.toLowerCase();

  // 1. Weather alerts
  if (
    category === "weather" ||
    text.includes("weather") ||
    text.includes("clima") ||
    text.includes("snow") ||
    text.includes("storm") ||
    (!text.includes("wind-down") && !text.includes("wind down") && /\b(wind|winds|windy|viento)\b/i.test(text))
  ) {
    return "weather_alert";
  }

  // 2. Daily Schedule Summary ("Speak Schedule")
  if (
    text.includes("daily schedule") ||
    text.includes("schedule summary") ||
    text.includes("today's schedule") ||
    text.includes("horario") ||
    text.includes("agenda")
  ) {
    return "routine_schedule_summary";
  }

  // 3. Meals: Breakfast, Lunch, Dinner, Snack
  if (text.includes("breakfast") || text.includes("desayuno") || text.includes("desayunar")) {
    return "routine_breakfast";
  }

  if (text.includes("lunch") || text.includes("almuerzo") || text.includes("comida")) {
    return "routine_lunch";
  }

  if (text.includes("dinner") || text.includes("cena") || text.includes("cenar")) {
    return "dinner_ready";
  }

  if (text.includes("snack") || text.includes("merienda")) {
    return "routine_snack";
  }

  // 4. Family Commute & Work: Mom/Rebecca, Papá
  if (
    text.includes("mom") ||
    text.includes("mamá") ||
    text.includes("mama") ||
    text.includes("rebecca")
  ) {
    return "routine_mom";
  }

  if (
    (text.includes("papá") || text.includes("papa") || text.includes("dad")) &&
    (text.includes("leave") || text.includes("leaving") || text.includes("sale") || text.includes("to work") || text.includes("trabajo"))
  ) {
    return "routine_papa_leave";
  }

  if (
    (text.includes("papá") || text.includes("papa") || text.includes("dad")) &&
    (text.includes("home") || text.includes("casa") || text.includes("camino") || text.includes("lleg") || text.includes("arriving") || text.includes("gets home")) &&
    !text.includes("wake") &&
    !text.includes("despertar")
  ) {
    return "routine_papa";
  }

  // 5. School routines: Leaving vs Getting Ready vs Pick up
  if (
    (text.includes("leave") || text.includes("leaving") || text.includes("salir")) &&
    (text.includes("school") || text.includes("escuela"))
  ) {
    return "routine_school_leave";
  }

  if (
    (text.includes("ready") || text.includes("preparar") || text.includes("prep")) &&
    (text.includes("school") || text.includes("escuela"))
  ) {
    return "routine_school_prep";
  }

  if (
    text.includes("school") ||
    text.includes("escuela") ||
    text.includes("kids") ||
    text.includes("niñas")
  ) {
    return "routine_school";
  }

  // 6. Pets / Dogs
  if (
    text.includes("dog") ||
    text.includes("dogs") ||
    text.includes("perro") ||
    text.includes("perros") ||
    text.includes("pasear")
  ) {
    return "routine_dogs";
  }

  // 7. Bedtime & Sleep
  if (
    text.includes("bedtime") ||
    text.includes("reading") ||
    text.includes("wind-down") ||
    text.includes("wind down") ||
    text.includes("dormir") ||
    text.includes("descansar") ||
    text.includes("lights out") ||
    text.includes("bed!") ||
    text.includes("in bed")
  ) {
    return "routine_bedtime";
  }

  // 8. Chores & Tasks
  if (
    text.includes("dishwasher") ||
    text.includes("lavavajillas") ||
    text.includes("platos")
  ) {
    return "task_dishwasher";
  }

  if (text.includes("bed") || text.includes("cama")) {
    return "task_bed";
  }

  if (
    category === "calendar" ||
    text.includes("calendar") ||
    text.includes("calendario") ||
    text.includes("evento") ||
    text.includes("event") ||
    text.includes("gymnastics") ||
    text.includes("soccer") ||
    text.includes("practice")
  ) {
    return "calendar_event";
  }

  if (
    category === "tasks" ||
    text.includes("task") ||
    text.includes("tarea") ||
    text.includes("chore") ||
    text.includes("pending")
  ) {
    return "task_generic";
  }

  return null;
}

/**
 * Plays a bilingual voice call-out by key.
 */
export async function playVoiceCallout(
  calloutKey: VoiceCalloutKey,
  volume = 0.85
): Promise<void> {
  const mod = getAudioModule();
  if (!mod || typeof mod.createAudioPlayer !== "function") return;

  const asset = VOICE_CALLOUT_ASSETS[calloutKey];
  if (!asset) return;

  try {
    const player = mod.createAudioPlayer(asset);
    const clampedVol = Math.max(0, Math.min(1, volume));
    (player as any).volume = clampedVol;
    player.play();

    // Auto cleanup after 6.5s
    setTimeout(() => {
      try {
        if (typeof player.remove === "function") {
          player.remove();
        }
      } catch {
        // ignore
      }
    }, 6500);
  } catch {
    // ignore
  }
}

export type SoundMode = "tone_and_voice" | "voice_only" | "tone_only";

export interface PlayNotificationAudioParams {
  sound: NotificationSound;
  volume: number;
  soundMode?: SoundMode;
  category: string;
  title: string;
  body: string;
}

let activeVoiceTimeout: ReturnType<typeof setTimeout> | null = null;

export const voiceCalloutPlayer = {
  playVoiceCallout,
};

/**
 * Dispatches notification audio respecting the user's preferred SoundMode:
 * - "tone_and_voice": Plays the gentle alert chime first, followed 750ms later by Sarah's voice announcement if matched.
 * - "voice_only": Plays Sarah's voice announcement immediately (or chime if no voice is available).
 * - "tone_only": Plays the traditional alert chime only.
 */
export async function playNotificationAudio({
  sound,
  volume,
  soundMode = "tone_and_voice",
  category,
  title,
  body,
}: PlayNotificationAudioParams): Promise<void> {
  const calloutKey = resolveVoiceCallout(category, title, body);

  if (soundMode === "voice_only") {
    if (calloutKey) {
      await voiceCalloutPlayer.playVoiceCallout(calloutKey, volume);
    } else {
      await playNotificationSound(sound, volume);
    }
    return;
  }

  if (soundMode === "tone_only") {
    await playNotificationSound(sound, volume);
    return;
  }

  // Default: Tone + Voice Announcement
  // 1. Play the alert tone so no one gets spooked by unexpected voices
  await playNotificationSound(sound, volume);

  // 2. Follow up after 750ms with Sarah's warm bilingual spoken announcement if matched
  if (calloutKey) {
    if (activeVoiceTimeout) {
      clearTimeout(activeVoiceTimeout);
      activeVoiceTimeout = null;
    }
    activeVoiceTimeout = setTimeout(() => {
      activeVoiceTimeout = null;
      void voiceCalloutPlayer.playVoiceCallout(calloutKey, volume);
    }, 750);
  }
}
