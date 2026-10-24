import { localTodayISO } from "../home/widgets/data";

/**
 * The calendar's shared merge vocabulary (WS-5). The Google/day math is the
 * TodayEventsWidget port — extracted here so the wall page and the widget
 * read ONE implementation (never a fork). Routines math ports Home-ai's
 * src/lib/schedule-time.ts verbatim (12-hour "8:00 AM" + legacy 24-hour
 * "08:00", "weekdays"/"weekends"/"friday" day-scope tokens).
 */

/** db events row (Home-ai src/db/index.ts:108-126 reads these raw fields). */
export interface DbEventRow {
  id?: string | number;
  title?: string;
  date?: string; // "YYYY-MM-DD"
  time?: string; // "HH:MM"
  endTime?: string;
  allDay?: boolean;
  member?: string;
  icon?: string;
  /** Member/routine color name (db-gateway row) — the web's member color. */
  color?: string;
  location?: string;
  notes?: string;
  source?: string;
  googleEventId?: string;
  googleCalendarId?: string;
  googleSyncStatus?: string;
  googleSyncError?: string;
}

/** Google row per docs/wave1-endpoints.md + lib/calendar/google-mapping.ts. */
export interface GoogleEventRow {
  google_id?: string;
  summary?: string;
  start_iso?: string;
  end_iso?: string;
  all_day?: boolean;
  calendar_id?: string;
}

/** Routine row per docs/wave1-endpoints.md (schedules read path). */
export interface ScheduleRow {
  id?: string | number;
  title?: string;
  time?: string; // "HH:MM" legacy or "H:MM AM/PM" (calendar form)
  icon?: string;
  type?: string;
  color?: string;
  member?: string;
  days?: string;
}

export interface WallEvent {
  id: string;
  title: string;
  time?: string; // "5:30 PM" | "All day" | undefined
  sortMinutes: number;
  icon: string;
  member?: string;
  /** Theme token key for the row's left rail + member-chip tint. Family rows
   *  default to nori, Google rows to cyan (web eventLineColor); a routine's
   *  own colour (when set) wins. */
  railToken?: string;
  /** "s_"-prefixed ids are routines (schedules) — counts must not call them events. */
  isRoutine?: boolean;
  source?: "family" | "google" | "routine";
  sourceId?: string;
  googleId?: string;
  googleSyncStatus?: string;
  googleSyncError?: string;
}

export const ALL_DAY_TIME = "All day";
export const ALL_DAY_SORT_MINUTES = -1;
export const UNKNOWN_SORT_MINUTES = 24 * 60; // unparseable sorts last, never midnight

/** Web eventLineColor parity (Home-ai page.tsx:549): a family event with no
 *  explicit colour paints the house nori rail; every Google row paints cyan. */
export const FAMILY_RAIL_TOKEN = "color-accent-nori";
export const GOOGLE_RAIL_TOKEN = "color-accent-cyan";

function isDateOnly(iso: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso);
}

/** Port of google-mapping.parseGoogleStart: date-only is LOCAL midnight (never UTC). */
function parseStart(startIso: string, allDay: boolean): Date | null {
  if (!startIso) return null;
  if (allDay) {
    const datePart = startIso.slice(0, 10);
    if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(datePart)) return null;
    const [y, m, d] = datePart.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const parsed = new Date(startIso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const localMidnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Port of googleEventCoveredDays (all-day end is EXCLUSIVE; capped at 366). */
export function googleCoversDay(row: GoogleEventRow, dayISO: string): boolean {
  const startIso = row.start_iso || "";
  const allDay = Boolean(row.all_day) || isDateOnly(startIso);
  const start = parseStart(startIso, allDay);
  if (!start) return false;
  const first = localMidnight(start);

  let last: Date;
  if (allDay) {
    const endDate = /^[0-9]{4}-[0-9]{2}-[0-9]{2}/.test(row.end_iso || "")      ? parseStart(String(row.end_iso).slice(0, 10), true)
      : null;
    last = !endDate || localMidnight(endDate) <= first
      ? first
      : new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate() - 1);
  } else {
    const end = row.end_iso ? new Date(row.end_iso) : null;
    if (!end || Number.isNaN(end.getTime()) || end <= start) {
      last = first;
    } else {
      const midnightEnd =
        end.getHours() === 0 && end.getMinutes() === 0 && end.getSeconds() === 0 && end.getMilliseconds() === 0;
      last = localMidnight(midnightEnd ? new Date(end.getTime() - 1) : end);
    }
  }

  const cur = new Date(first);
  let guard = 0;
  while (cur <= last && guard < 366) {
    if (localTodayISO(cur) === dayISO) return true;
    cur.setDate(cur.getDate() + 1);
    guard += 1;
  }
  return false;
}

/** Port of googleEventClockTime: device zone == family zone on the wall panel. */
export function googleClock(row: GoogleEventRow): { time?: string; sortMinutes: number } {
  const iso = (row.start_iso ?? "").trim();
  if (!iso) return { time: undefined, sortMinutes: UNKNOWN_SORT_MINUTES };
  if (row.all_day || isDateOnly(iso)) return { time: ALL_DAY_TIME, sortMinutes: ALL_DAY_SORT_MINUTES };
  const start = parseStart(iso, false);
  if (!start) return { time: undefined, sortMinutes: UNKNOWN_SORT_MINUTES };
  return {
    time: start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
    sortMinutes: start.getHours() * 60 + start.getMinutes(),
  };
}

/** "17:30" → minutes since midnight; unparseable sorts last (never midnight). */
export function hhmmToMinutes(time?: string): number {
  const m = time?.match(/^(\d{1,2}):(\d{2})$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : UNKNOWN_SORT_MINUTES;
}

/** Family db events for one day (the TodayEventsWidget mapping, any day). */
export function familyEventsForDay(rows: DbEventRow[], dayISO: string): WallEvent[] {
  return rows
    .filter((e) => e?.date === dayISO)
    .map((e, i) => {
      const minutes = e.allDay ? ALL_DAY_SORT_MINUTES : scheduleTimeMinutes(e.time);
      return {
        id: `db_${String(e.id ?? i)}`,
        title: e.title || "Untitled event",
        time: e.allDay ? ALL_DAY_TIME : minutes === null ? undefined : formatScheduleTime12h(e.time),
        sortMinutes: e.allDay ? ALL_DAY_SORT_MINUTES : minutes ?? UNKNOWN_SORT_MINUTES,
        icon: e.icon || "📅",
        member: e.member || undefined,
        railToken: (e.color && SCHEDULE_RAIL_TOKENS[e.color.toLowerCase()]) || "color-accent-amber",
        source: "family",
        sourceId: e.id == null ? undefined : String(e.id),
        googleId: e.googleEventId || undefined,
        googleSyncStatus: e.googleSyncStatus || undefined,
        googleSyncError: e.googleSyncError || undefined,
      };
    });
}

/** Google events covering one day (all-day spans included via googleCoversDay). */
export function googleEventsForDay(rows: GoogleEventRow[], dayISO: string): WallEvent[] {
  const seenGoogleIds = new Set<string>();
  return rows
    .filter((row) => googleCoversDay(row, dayISO))
    .filter((row) => {
      const googleId = row.google_id || "";
      if (!googleId) return true;
      if (seenGoogleIds.has(googleId)) return false;
      seenGoogleIds.add(googleId);
      return true;
    })
    .map((row, i) => {
      const clock = googleClock(row);
      return {
        id: `g_${row.google_id ?? i}`,
        title: row.summary || "(no title)",
        time: clock.time ?? ALL_DAY_TIME,
        sortMinutes: clock.sortMinutes,
        icon: "📅",
        member: "Google",
        railToken: GOOGLE_RAIL_TOKEN,
        source: "google",
        googleId: row.google_id || undefined,
      };
    });
}

// ── Routine math — verbatim ports of Home-ai src/lib/schedule-time.ts. ──

const TIME_12H = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i;
const TIME_24H = /^(\d{1,2}):(\d{2})$/;

/** Minutes since midnight, or null when the string is not a known format. */
export function scheduleTimeMinutes(time: unknown): number | null {
  const s = String(time ?? "").trim();
  if (!s) return null;
  const m12 = s.match(TIME_12H);
  if (m12) {
    const h = parseInt(m12[1], 10);
    const m = parseInt(m12[2], 10);
    if (h < 1 || h > 12 || m > 59) return null;
    let hh = h % 12;
    if (m12[3].toUpperCase() === "PM") hh += 12;
    return hh * 60 + m;
  }
  const m24 = s.match(TIME_24H);
  if (m24) {
    const h = parseInt(m24[1], 10);
    const m = parseInt(m24[2], 10);
    if (h > 23 || m > 59) return null;
    return h * 60 + m;
  }
  return null;
}

/** Canonical "H:MM AM/PM" display string; unparseable input passes through. */
export function formatScheduleTime12h(time: unknown): string {
  const s = String(time ?? "").trim();
  const minutes = scheduleTimeMinutes(s);
  if (minutes === null) return s || "";
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

/**
 * Does a routine's `days` scope cover a given weekday? Ports the web's
 * token handling ("all"/"weekdays"/"weekends"/"friday" + legacy "mon".."sun").
 */
export function scheduleCoversWeekday(days: unknown, weekdayShort: string, weekdayIndex: number): boolean {
  const d = String(days ?? "").trim().toLowerCase();
  if (!d) return true;
  if (d === "all") return true;
  if (d === "weekdays") return weekdayIndex >= 1 && weekdayIndex <= 5;
  if (d === "weekends") return weekdayIndex === 0 || weekdayIndex === 6;
  if (d === "friday") return weekdayIndex === 5;
  return d.includes(weekdayShort.toLowerCase());
}

/** Routine color name → theme token (the web's scheduleColorValues map). */
const SCHEDULE_RAIL_TOKENS: Record<string, string> = {
  green: "color-accent-selected",
  amber: "color-accent-amber",
  cyan: "color-accent-cyan",
  violet: "color-accent-violet",
  rose: "color-accent-rose",
  blue: "color-accent-nori",
  indigo: "color-accent-violet",
  pink: "color-accent-rose",
  teal: "color-accent-cyan",
};

/** Routines that land on the given calendar day (weekday scope + time sort). */
export function schedulesForDay(rows: ScheduleRow[], date: Date): WallEvent[] {
  const weekdayShort = date.toLocaleDateString("en-US", { weekday: "short" }).toLowerCase();
  const weekdayIndex = date.getDay();
  return rows
    .filter((s) => scheduleCoversWeekday(s.days, weekdayShort, weekdayIndex))
    .map((s, i) => {
      const display = formatScheduleTime12h(s.time);
      return {
        id: `s_${String(s.id ?? i)}`,
        title: s.title || "Untitled routine",
        time: display || undefined,
        sortMinutes: scheduleTimeMinutes(s.time) ?? UNKNOWN_SORT_MINUTES,
        icon: s.icon || "⏰",
        member: s.member || undefined,
        railToken: s.color ? SCHEDULE_RAIL_TOKENS[s.color] : undefined,
        isRoutine: true,
      };
    });
}

/** One day's merged timeline: all-day first (−1), then by clock, unknown last. */
export function mergeDayRows(...groups: WallEvent[][]): WallEvent[] {
  const rows = groups.flat();
  const mirroredGoogleIds = new Set(
    rows
      .filter((row) => row.source !== "google" && row.googleId)
      .map((row) => String(row.googleId)),
  );
  return rows
    .filter((row) => row.source !== "google" || !row.googleId || !mirroredGoogleIds.has(String(row.googleId)))
    .sort((a, b) => a.sortMinutes - b.sortMinutes);
}

/** Merged events + routines for a specific day string (YYYY-MM-DD). */
export function mergedEventsForDay(
  dbEvents: DbEventRow[],
  googleRows: GoogleEventRow[],
  schedules: ScheduleRow[],
  dayISO: string
): WallEvent[] {
  const [y, m, d] = dayISO.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return mergeDayRows(
    familyEventsForDay(dbEvents, dayISO),
    googleEventsForDay(googleRows, dayISO),
    schedulesForDay(schedules, date)
  );
}

