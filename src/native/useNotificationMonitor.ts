import React, { useEffect, useRef } from "react";
import { api } from "../api/client";
import { dispatchNotification } from "./notifications";
import {
  isWithinQuietHours,
  loadNotificationPreferences,
} from "./notificationPrefs";
import {
  type MealPlanEntryRow,
  type ScheduleRow,
  findPlannedMealForSlot,
  formatMealRoutineTitle,
  resolveRoutineMealSlot,
  scheduleCoversWeekday,
  scheduleTimeMinutes,
} from "../calendar/events-merge";

export interface CalendarEventItem {
  id: string | number;
  title: string;
  start: string; // ISO string or time string
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

export function useNotificationMonitor({
  pollIntervalMs = 60_000,
  nowProvider = () => new Date(),
}: {
  pollIntervalMs?: number;
  nowProvider?: () => Date;
} = {}) {
  const alertedWeatherRef = useRef<string | null>(null);
  const alertedCalendarAdvanceIds = useRef<Set<string>>(new Set());
  const alertedCalendarStartIds = useRef<Set<string>>(new Set());
  const alertedRoutineAdvanceIds = useRef<Set<string>>(new Set());
  const alertedRoutineStartIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;

    const checkCycle = async () => {
      if (!alive) return;
      const now = nowProvider();
      const todayISO = now.toISOString().slice(0, 10);

      let quiet = false;
      try {
        const prefs = await loadNotificationPreferences();
        quiet = isWithinQuietHours(now, prefs.quietHours);
      } catch {
        quiet = isWithinQuietHours(now);
      }

      // 1. Check Weather
      try {
        const weatherRes = (await api("/api/weather/live")) as any;
        const code = weatherRes?.code ?? weatherRes?.current?.weather_code;
        const condition = weatherRes?.condition ?? weatherRes?.current?.condition ?? "Severe Conditions";

        if (isSevereWeather(code)) {
          const episodeKey = `${todayISO}-${code}`;
          if (alertedWeatherRef.current !== episodeKey) {
            alertedWeatherRef.current = episodeKey;
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
        const calRes = (await api("/api/calendar/events")) as any;
        const events: CalendarEventItem[] = Array.isArray(calRes?.events)
          ? calRes.events
          : Array.isArray(calRes)
            ? calRes
            : [];

        for (const ev of events) {
          const key = String(ev.id);
          const advanceDue = isStartingSoon(ev.start, now, 15) && !isDueNow(ev.start, now, 2);
          const startDue = isDueNow(ev.start, now, 2);

          // During quiet hours (11 PM - 5 AM), suppress calendar alerts and mark handled
          if (quiet) {
            if (advanceDue) alertedCalendarAdvanceIds.current.add(key);
            if (startDue) alertedCalendarStartIds.current.add(key);
            continue;
          }

          // 15-min advance notification
          if (
            !alertedCalendarAdvanceIds.current.has(key) &&
            advanceDue
          ) {
            alertedCalendarAdvanceIds.current.add(key);
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
            !alertedCalendarStartIds.current.has(key) &&
            startDue
          ) {
            alertedCalendarStartIds.current.add(key);
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

          const key = `${todayISO}-${rt.id}`;
          const memberInfo = rt.member ? ` for ${rt.member.split(" ")[0]}` : "";

          // During quiet hours (11 PM - 5 AM), suppress routine alarms and mark handled for today
          if (quiet) {
            if (advanceDue) alertedRoutineAdvanceIds.current.add(key);
            if (startDue) alertedRoutineStartIds.current.add(key);
            continue;
          }

          // 15-min advance notification
          if (!alertedRoutineAdvanceIds.current.has(key) && advanceDue) {
            alertedRoutineAdvanceIds.current.add(key);
            void dispatchNotification({
              category: "routines",
              title: `${displayIcon} Routine Soon`,
              body: `"${displayTitle}"${memberInfo} starts in 15 minutes.`,
              data: { routineId: rt.id, member: rt.member },
              timing: "advance",
            });
          }

          // Routine starting now notification
          if (!alertedRoutineStartIds.current.has(key) && startDue) {
            alertedRoutineStartIds.current.add(key);
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
