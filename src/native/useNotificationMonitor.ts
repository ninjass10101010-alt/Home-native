import React, { useEffect, useRef } from "react";
import { api } from "../api/client";
import { dispatchNotification } from "./notifications";

export interface CalendarEventItem {
  id: string | number;
  title: string;
  start: string; // ISO string or time string
}

export interface RoutineScheduleItem {
  id: string | number;
  title: string;
  time?: string; // e.g. "17:30" or ISO
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

export function useNotificationMonitor({
  pollIntervalMs = 60_000,
  nowProvider = () => new Date(),
}: {
  pollIntervalMs?: number;
  nowProvider?: () => Date;
} = {}) {
  const alertedWeatherRef = useRef<string | null>(null);
  const alertedCalendarIds = useRef<Set<string>>(new Set());
  const alertedRoutineIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;

    const checkCycle = async () => {
      if (!alive) return;
      const now = nowProvider();
      const todayISO = now.toISOString().slice(0, 10);

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
          if (
            !alertedCalendarIds.current.has(key) &&
            isStartingSoon(ev.start, now, 15)
          ) {
            alertedCalendarIds.current.add(key);
            void dispatchNotification({
              category: "calendar",
              title: "📅 Upcoming Event",
              body: `${ev.title || "Event"} starts in 15 minutes.`,
              data: { eventId: ev.id },
            });
          }
        }
      } catch {
        // offline or unmapped
      }

      // 3. Check Routines
      try {
        const schedRes = (await api("/api/schedules")) as any;
        const routines: RoutineScheduleItem[] = Array.isArray(schedRes?.schedules)
          ? schedRes.schedules
          : Array.isArray(schedRes)
            ? schedRes
            : [];

        for (const rt of routines) {
          const key = `${todayISO}-${rt.id}`;
          if (
            !alertedRoutineIds.current.has(key) &&
            isStartingSoon(rt.time, now, 15)
          ) {
            alertedRoutineIds.current.add(key);
            void dispatchNotification({
              category: "routines",
              title: "⏰ Routine Reminder",
              body: `Family routine "${rt.title || "Scheduled routine"}" starts in 15 minutes.`,
              data: { routineId: rt.id },
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
