import React, { useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../api/client";
import { dispatchNotification } from "./notifications";
import {
  isWithinQuietHours,
  loadNotificationPreferences,
  resolveTimingPreference,
} from "./notificationPrefs";
import {
  type DbEventRow,
  type MealPlanEntryRow,
  type ScheduleRow,
  findPlannedMealForSlot,
  formatMealRoutineTitle,
  normalizeRoutineSemanticKey,
  resolveRoutineMealSlot,
  scheduleCoversWeekday,
  scheduleTimeMinutes,
} from "../calendar/events-merge";

export interface CalendarEventItem {
  id: string | number;
  title: string;
  start: string; // ISO string or time string
}

const ALERTED_STORAGE_KEY_PREFIX = "@consuela/alerted_notifications:";

// In-memory module cache for high-speed checks across renders & component lifecycles
const inMemoryAlertedKeys = new Set<string>();
let activeAlertDate = "";
let storageLoaded = false;

export async function loadAlertedKeys(todayISO: string): Promise<Set<string>> {
  if (activeAlertDate !== todayISO) {
    inMemoryAlertedKeys.clear();
    activeAlertDate = todayISO;
    storageLoaded = false;
  }
  if (!storageLoaded) {
    try {
      const raw = await AsyncStorage.getItem(`${ALERTED_STORAGE_KEY_PREFIX}${todayISO}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const k of parsed) inMemoryAlertedKeys.add(k);
        }
      }
    } catch {
      // ignore
    }
    storageLoaded = true;
  }
  return inMemoryAlertedKeys;
}

export function isKeyAlerted(key: string): boolean {
  return inMemoryAlertedKeys.has(key);
}

export async function markKeyAlerted(todayISO: string, key: string): Promise<void> {
  inMemoryAlertedKeys.add(key);
  try {
    await AsyncStorage.setItem(
      `${ALERTED_STORAGE_KEY_PREFIX}${todayISO}`,
      JSON.stringify(Array.from(inMemoryAlertedKeys))
    );
  } catch {
    // ignore
  }
}

export function resetAlertedKeysCache(): void {
  inMemoryAlertedKeys.clear();
  activeAlertDate = "";
  storageLoaded = false;
}

/**
 * Severe weather decision: WMO >= 95 (thunderstorm/hail) or 73, 75, 85, 86 (heavy snow).
 */
export function isSevereWeather(code: number | null | undefined): boolean {
  if (code == null) return false;
  if (code >= 95) return true;
  if (code === 73 || code === 75 || code === 85 || code === 86) return true;
  return false;
}

/**
 * Checks if a time string is within 15 minutes in the future from now.
 */
export function isStartingSoon(
  timeStr: string | undefined,
  now: Date,
  leadMinutes = 15
): boolean {
  if (!timeStr) return false;

  let eventTime: Date;
  if (timeStr.includes("T") || timeStr.includes("-")) {
    eventTime = new Date(timeStr);
  } else if (timeStr.includes(":")) {
    const [hh, mm] = timeStr.split(":").map(Number);
    eventTime = new Date(now);
    eventTime.setHours(hh, mm, 0, 0);
  } else {
    return false;
  }

  if (isNaN(eventTime.getTime())) return false;

  const diffMs = eventTime.getTime() - now.getTime();
  const diffMinutes = diffMs / (60 * 1000);
  return diffMinutes >= 0 && diffMinutes <= leadMinutes;
}

/**
 * Checks if a time string is starting right now (from 1 min ago up to windowMinutes ahead).
 */
export function isDueNow(
  timeStr: string | undefined,
  now: Date,
  windowMinutes = 2
): boolean {
  if (!timeStr) return false;

  let eventTime: Date;
  if (timeStr.includes("T") || timeStr.includes("-")) {
    eventTime = new Date(timeStr);
  } else if (timeStr.includes(":")) {
    const [hh, mm] = timeStr.split(":").map(Number);
    eventTime = new Date(now);
    eventTime.setHours(hh, mm, 0, 0);
  } else {
    return false;
  }

  if (isNaN(eventTime.getTime())) return false;

  const diffMs = eventTime.getTime() - now.getTime();
  const diffMinutes = diffMs / (60 * 1000);
  return diffMinutes >= -1 && diffMinutes <= windowMinutes;
}

/**
 * Evaluates whether a routine should be called out based on the family's meal plan.
 * If the routine is a meal routine (breakfast, lunch, or dinner) and `meals` is loaded,
 * it only calls out the schedule when a meal is actually planned for that slot today.
 */
export function evaluateRoutineMealGate(
  rt: ScheduleRow,
  now: Date,
  meals?: MealPlanEntryRow[] | null
): { shouldCallOut: boolean; displayTitle: string; displayIcon: string } {
  const defaultTitle = rt.title || "Daily routine";
  const defaultIcon = rt.icon || "⏰";
  const mealSlot = resolveRoutineMealSlot(rt);

  if (mealSlot !== null && Array.isArray(meals)) {
    const planned = findPlannedMealForSlot(meals, now, mealSlot);
    if (!planned) {
      return {
        shouldCallOut: false,
        displayTitle: defaultTitle,
        displayIcon: defaultIcon,
      };
    }
    return {
      shouldCallOut: true,
      displayTitle: formatMealRoutineTitle(rt.title, planned.name),
      displayIcon: planned.emoji || rt.icon || "🍽️",
    };
  }

  return {
    shouldCallOut: true,
    displayTitle: defaultTitle,
    displayIcon: defaultIcon,
  };
}

const defaultNowProvider = () => new Date();

export function isCalendarEventScheduledForToday(
  ev: { date?: string | null },
  todayISO: string
): boolean {
  if (!ev.date) return false;
  return ev.date.slice(0, 10) === todayISO;
}

export function useNotificationMonitor({
  pollIntervalMs = 60_000,
  nowProvider = defaultNowProvider,
}: {
  pollIntervalMs?: number;
  nowProvider?: () => Date;
} = {}) {
  useEffect(() => {
    let alive = true;

    const checkCycle = async () => {
      if (!alive) return;
      const now = nowProvider();
      const todayISO = now.toISOString().slice(0, 10);
      await loadAlertedKeys(todayISO);

      let quiet = false;
      let prefs = await loadNotificationPreferences().catch(() => null);
      if (!prefs) {
        quiet = isWithinQuietHours(now);
      } else {
        quiet = isWithinQuietHours(now, prefs.quietHours);
      }

      // 1. Check Weather
      try {
        const weatherRes = (await api("/api/weather/live")) as any;
        const code = weatherRes?.code ?? weatherRes?.current?.weather_code;
        const condition = weatherRes?.condition ?? weatherRes?.current?.condition ?? "Severe Conditions";

        if (isSevereWeather(code)) {
          const episodeKey = `${todayISO}:weather:${code}`;
          if (!isKeyAlerted(episodeKey)) {
            await markKeyAlerted(todayISO, episodeKey);
            void dispatchNotification({
              category: "weather",
              title: "⛈️ Weather Advisory",
              body: `Severe weather alert: ${condition}. Take precautions.`,
              data: { code, condition },
            });
          }
        }
      } catch {
        // network or unmapped path in dev/offline
      }

      // 2. Check Calendar
      try {
        const calRes = (await api("/api/db/events")) as any;
        const events: DbEventRow[] = Array.isArray(calRes?.items)
          ? calRes.items
          : Array.isArray(calRes?.events)
            ? calRes.events
            : Array.isArray(calRes)
              ? calRes
              : [];

        const calConfig = prefs?.calendar;
        const calTimingMode = resolveTimingPreference(calConfig);
        const calAdvanceAllowed =
          calTimingMode !== "start_only" && calConfig?.advanceEnabled !== false;
        const calStartAllowed =
          calTimingMode !== "advance_only" && calConfig?.startEnabled !== false;

        const nowMins = now.getHours() * 60 + now.getMinutes();

        for (const ev of events) {
          // STRICT MATCH: Only calendar events explicitly scheduled for today
          if (!isCalendarEventScheduledForToday(ev, todayISO)) continue;
          if (ev.allDay) continue;

          const targetMinutes = scheduleTimeMinutes(ev.time);
          const advanceDue =
            targetMinutes !== null
              ? targetMinutes - nowMins > 2 && targetMinutes - nowMins <= 15
              : isStartingSoon(ev.time, now, 15) && !isDueNow(ev.time, now, 2);
          const startDue =
            targetMinutes !== null
              ? nowMins - targetMinutes >= -1 && nowMins - targetMinutes <= 2
              : isDueNow(ev.time, now, 2);

          const eventId = String(ev.id ?? ev.googleEventId ?? ev.title);
          const semantic = normalizeRoutineSemanticKey(ev.title ?? "");
          const timeSlot = targetMinutes !== null ? String(targetMinutes) : (ev.time ?? "any");

          const advanceKey = `${todayISO}:calendar:${eventId}:advance`;
          const advanceSemanticKey = `${todayISO}:calendar:sem_${semantic}:${timeSlot}:advance`;
          const startKey = `${todayISO}:calendar:${eventId}:start`;
          const startSemanticKey = `${todayISO}:calendar:sem_${semantic}:${timeSlot}:start`;

          // During quiet hours (11 PM - 5 AM), suppress calendar alerts and mark handled
          if (quiet) {
            if (advanceDue) {
              await markKeyAlerted(todayISO, advanceKey);
              await markKeyAlerted(todayISO, advanceSemanticKey);
            }
            if (startDue) {
              await markKeyAlerted(todayISO, startKey);
              await markKeyAlerted(todayISO, startSemanticKey);
            }
            continue;
          }

          // 15-min advance notification
          if (
            calAdvanceAllowed &&
            advanceDue &&
            !isKeyAlerted(advanceKey) &&
            !isKeyAlerted(advanceSemanticKey)
          ) {
            await markKeyAlerted(todayISO, advanceKey);
            await markKeyAlerted(todayISO, advanceSemanticKey);
            void dispatchNotification({
              category: "calendar",
              title: "📅 Upcoming Event",
              body: `${ev.title || "Event"} starts in 15 minutes.`,
              data: { eventId: ev.id },
              timing: "advance",
            });
          }

          // Event starting now notification
          if (
            calStartAllowed &&
            startDue &&
            !isKeyAlerted(startKey) &&
            !isKeyAlerted(startSemanticKey)
          ) {
            await markKeyAlerted(todayISO, startKey);
            await markKeyAlerted(todayISO, startSemanticKey);
            void dispatchNotification({
              category: "calendar",
              title: "🔔 Event Starting Now",
              body: `${ev.title || "Event"} is starting now.`,
              data: { eventId: ev.id },
              timing: "start",
            });
          }
        }
      } catch {
        // offline or unmapped
      }

      // 3. Check Routines & Daily Schedules (cross-checked with Meal Plan)
      try {
        const [schedRes, mealsRes] = await Promise.all([
          api("/api/db/schedules") as Promise<any>,
          (api("/api/db/meal_plan_entries") as Promise<any>).catch(() => null),
        ]);
        const routines: ScheduleRow[] = Array.isArray(schedRes?.items)
          ? schedRes.items
          : Array.isArray(schedRes?.schedules)
            ? schedRes.schedules
            : Array.isArray(schedRes)
              ? schedRes
              : [];
        const meals: MealPlanEntryRow[] | null = Array.isArray(mealsRes?.items)
          ? mealsRes.items
          : Array.isArray(mealsRes?.meals)
            ? mealsRes.meals
            : Array.isArray(mealsRes)
              ? mealsRes
              : null;

        const weekdayShort = now.toLocaleDateString("en-US", { weekday: "short" }).toLowerCase();
        const weekdayIndex = now.getDay();
        const nowMins = now.getHours() * 60 + now.getMinutes();

        const routinesConfig = prefs?.routines;
        const routineTimingMode = resolveTimingPreference(routinesConfig);
        const advanceAllowed =
          routineTimingMode !== "start_only" && routinesConfig?.advanceEnabled !== false;
        const startAllowed =
          routineTimingMode !== "advance_only" && routinesConfig?.startEnabled !== false;

        for (const rt of routines) {
          if (!scheduleCoversWeekday(rt.days, weekdayShort, weekdayIndex)) {
            continue;
          }

          const { shouldCallOut, displayTitle, displayIcon } = evaluateRoutineMealGate(
            rt,
            now,
            meals
          );
          if (!shouldCallOut) {
            continue;
          }

          const targetMinutes = scheduleTimeMinutes(rt.time);
          const advanceDue =
            targetMinutes !== null
              ? targetMinutes - nowMins > 2 && targetMinutes - nowMins <= 15
              : isStartingSoon(rt.time, now, 15) && !isDueNow(rt.time, now, 2);
          const startDue =
            targetMinutes !== null
              ? nowMins - targetMinutes >= -1 && nowMins - targetMinutes <= 2
              : isDueNow(rt.time, now, 2);

          const memberInfo = rt.member ? ` for ${rt.member.split(" ")[0]}` : "";
          const semantic = normalizeRoutineSemanticKey(rt.title ?? "");
          const timeSlot = targetMinutes !== null ? String(targetMinutes) : (rt.time ?? "any");

          const advanceKey = `${todayISO}:routines:${rt.id}:advance`;
          const advanceSemanticKey = `${todayISO}:routines:sem_${semantic}:${timeSlot}:advance`;
          const startKey = `${todayISO}:routines:${rt.id}:start`;
          const startSemanticKey = `${todayISO}:routines:sem_${semantic}:${timeSlot}:start`;

          // During quiet hours (11 PM - 5 AM), suppress routine alarms and mark handled for today
          if (quiet) {
            if (advanceDue) {
              await markKeyAlerted(todayISO, advanceKey);
              await markKeyAlerted(todayISO, advanceSemanticKey);
            }
            if (startDue) {
              await markKeyAlerted(todayISO, startKey);
              await markKeyAlerted(todayISO, startSemanticKey);
            }
            continue;
          }

          // 15-min advance notification
          if (
            advanceAllowed &&
            advanceDue &&
            !isKeyAlerted(advanceKey) &&
            !isKeyAlerted(advanceSemanticKey)
          ) {
            await markKeyAlerted(todayISO, advanceKey);
            await markKeyAlerted(todayISO, advanceSemanticKey);
            void dispatchNotification({
              category: "routines",
              title: `${displayIcon} Routine Soon`,
              body: `"${displayTitle}"${memberInfo} starts in 15 minutes.`,
              data: { routineId: rt.id, member: rt.member },
              timing: "advance",
            });
          }

          // Routine starting now notification
          if (
            startAllowed &&
            startDue &&
            !isKeyAlerted(startKey) &&
            !isKeyAlerted(startSemanticKey)
          ) {
            await markKeyAlerted(todayISO, startKey);
            await markKeyAlerted(todayISO, startSemanticKey);
            void dispatchNotification({
              category: "routines",
              title: "🔔 Routine Starting",
              body: `"${displayTitle}"${memberInfo} is starting now.`,
              data: { routineId: rt.id, member: rt.member },
              timing: "start",
            });
          }
        }
      } catch {
        // offline or unmapped
      }
    };

    // Run first check after brief delay so app boot isn't slowed down
    const initialTimer = setTimeout(() => {
      void checkCycle();
    }, 3000);

    const interval = setInterval(() => {
      void checkCycle();
    }, pollIntervalMs);

    return () => {
      alive = false;
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [pollIntervalMs, nowProvider]);
}

export function NotificationMonitor(): React.ReactNode {
  useNotificationMonitor();
  return null;
}
