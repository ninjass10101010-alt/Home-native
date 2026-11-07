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
  mealType?: string;
}

/** Meal plan entry row subset for linking meal routines to planned meals. */
export interface MealPlanEntryRow {
  id?: string | number;
  name?: string;
  emoji?: string;
  time?: string; // Weekday short: "Mon".."Sun"
  mealType?: string; // "breakfast" | "lunch" | "snack" | "dinner"
  weekOf?: string; // "YYYY-MM-DD" (Monday of the week)
}

export type MealRoutineSlot = "breakfast" | "lunch" | "dinner";

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
export const SCHEDULE_RAIL_TOKENS: Record<string, string> = {
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

/**
 * Maps routine titles to a semantic family routine key for deduplication.
 * Resolves legacy database duplicates (e.g. "MOM out of work" vs "Rebecca Gets Home From Work",
 * duplicate breakfasts, duplicate school departures).
 */
export function normalizeRoutineSemanticKey(title: string): string {
  const t = title.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
  if ((t.includes("rebecca") || t.includes("mom")) && (t.includes("work") || t.includes("home"))) {
    return "mom_work";
  }
  if ((t.includes("papa") || t.includes("dad")) && (t.includes("work") || t.includes("home") || t.includes("wake"))) {
    if (t.includes("wake")) return "papa_wake";
    if (t.includes("leav") || t.includes("to work")) return "papa_leave";
    return "papa_home";
  }
  if (t.includes("school")) {
    if (t.includes("leav") || t.includes("to school") || t.includes("for school")) return "school_leave";
    if (t.includes("get ready") || t.includes("ready")) {
      return t.includes("little") ? "school_prep_littles" : "school_prep_bigs";
    }
    if (t.includes("kid") || t.includes("pick up") || t.includes("recoger")) return "school_pickup";
  }
  if (t.includes("breakfast") || t.includes("desayuno")) return "breakfast";
  if (t.includes("lunch") || t.includes("almuerzo")) return "lunch";
  if (t.includes("dinner") || t.includes("cena")) return "dinner";
  if (t.includes("snack") || t.includes("merienda")) return "snack";
  if (t.includes("dog") || t.includes("perro")) return "dogs";
  if (t.includes("bed") || t.includes("cama")) {
    if (t.includes("little")) return "bed_littles";
    if (t.includes("big")) return "bed_bigs";
  }
  if (t.includes("lights out")) return "lights_out";
  return t;
}

/**
 * Deduplicates routines that land in the same 20-minute window with the same semantic meaning,
 * or identical title records.
 */
export function deduplicateScheduleEvents(events: WallEvent[]): WallEvent[] {
  const sorted = [...events].sort((a, b) => a.sortMinutes - b.sortMinutes);
  const result: WallEvent[] = [];

  for (const item of sorted) {
    const key = normalizeRoutineSemanticKey(item.title);
    const existingIndex = result.findIndex((r) => {
      const rKey = normalizeRoutineSemanticKey(r.title);
      if (rKey === key && key.length > 2) {
        // Same semantic routine within 20 minutes of each other
        return Math.abs(r.sortMinutes - item.sortMinutes) <= 20;
      }
      // Exact title match at exact same time
      return r.title.toLowerCase().trim() === item.title.toLowerCase().trim() && r.sortMinutes === item.sortMinutes;
    });

    if (existingIndex === -1) {
      result.push(item);
    } else {
      // If the duplicate has a title with Rebecca/Mom and is more descriptive, prefer it
      const existing = result[existingIndex];
      const prefersItem =
        (item.title.toLowerCase().includes("rebecca") && !existing.title.toLowerCase().includes("rebecca")) ||
        (item.title.length > existing.title.length && !item.title.endsWith("!"));
      if (prefersItem) {
        result[existingIndex] = item;
      }
    }
  }

  return result;
}

/**
 * Resolves whether a schedule routine corresponds to a primary meal slot
 * ("breakfast" | "lunch" | "dinner") via explicit mealType or title keywords.
 */
export function resolveRoutineMealSlot(
  row: { mealType?: string; title?: string } | null | undefined
): MealRoutineSlot | null {
  if (!row) return null;
  const mt = String(row.mealType ?? "").trim().toLowerCase();
  if (mt === "none") return null;
  if (mt === "breakfast" || mt === "lunch" || mt === "dinner") {
    return mt;
  }
  const semantic = normalizeRoutineSemanticKey(row.title ?? "");
  if (semantic === "breakfast" || semantic === "lunch" || semantic === "dinner") {
    return semantic;
  }
  return null;
}

function weekMondayISO(date: Date): string {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dow = copy.getDay(); // 0 = Sun .. 6 = Sat
  const offset = dow === 0 ? -6 : 1 - dow;
  copy.setDate(copy.getDate() + offset);
  return localTodayISO(copy);
}

/**
 * Finds the planned meal entry for a given date and meal slot ("breakfast" | "lunch" | "dinner").
 * Returns null if no meal is planned for that slot on that date's weekday in that week.
 */
export function findPlannedMealForSlot(
  meals: MealPlanEntryRow[] | null | undefined,
  date: Date,
  slot: MealRoutineSlot
): MealPlanEntryRow | null {
  if (!Array.isArray(meals) || meals.length === 0) return null;
  const weekMonday = weekMondayISO(date);
  const weekdayShort = date.toLocaleDateString("en-US", { weekday: "short" }).toLowerCase();

  const match = meals.find((m) => {
    const name = typeof m?.name === "string" ? m.name.trim() : "";
    if (!name) return false;
    const rowWeek = typeof m.weekOf === "string" && m.weekOf.trim() ? m.weekOf.trim() : weekMonday;
    if (rowWeek !== weekMonday) return false;
    if (String(m.time ?? "").trim().toLowerCase() !== weekdayShort) return false;
    if (String(m.mealType ?? "").trim().toLowerCase() !== slot) return false;
    return true;
  });

  return match ?? null;
}

/**
 * Formats a meal routine title with the planned meal name when available.
 */
export function formatMealRoutineTitle(baseTitle: string | undefined, mealName: string | undefined): string {
  const cleanBase = (baseTitle || "Meal").trim();
  const cleanMeal = (mealName || "").trim();
  if (!cleanMeal) return cleanBase;
  if (cleanBase.toLowerCase().includes(cleanMeal.toLowerCase())) return cleanBase;
  return `${cleanBase}: ${cleanMeal}`;
}

/**
 * Routines that land on the given calendar day (weekday scope + time sort + smart deduplication).
 * When `meals` is provided (an array of MealPlanEntryRow), meal routines (Breakfast, Lunch, Dinner)
 * are only included if a meal is actually scheduled for that slot on `date`, and their title/icon
 * are enriched with the planned meal.
 */
export function schedulesForDay(
  rows: ScheduleRow[],
  date: Date,
  meals?: MealPlanEntryRow[] | null
): WallEvent[] {
  const weekdayShort = date.toLocaleDateString("en-US", { weekday: "short" }).toLowerCase();
  const weekdayIndex = date.getDay();
  const checkMeals = Array.isArray(meals);

  const rawList: WallEvent[] = [];
  rows.forEach((s, i) => {
    if (!scheduleCoversWeekday(s.days, weekdayShort, weekdayIndex)) return;

    const mealSlot = resolveRoutineMealSlot(s);
    let title = s.title || "Untitled routine";
    let icon = s.icon || "⏰";

    if (checkMeals && mealSlot !== null) {
      const planned = findPlannedMealForSlot(meals, date, mealSlot);
      if (!planned) {
        // Nothing scheduled for this meal slot today — omit from the schedule
        return;
      }
      title = formatMealRoutineTitle(s.title, planned.name);
      icon = planned.emoji || s.icon || "🍽️";
    }

    const display = formatScheduleTime12h(s.time);
    rawList.push({
      id: `s_${String(s.id ?? i)}`,
      title,
      time: display || undefined,
      sortMinutes: scheduleTimeMinutes(s.time) ?? UNKNOWN_SORT_MINUTES,
      icon,
      member: s.member || undefined,
      railToken: s.color ? SCHEDULE_RAIL_TOKENS[s.color] : undefined,
      isRoutine: true,
    });
  });

  return deduplicateScheduleEvents(rawList);
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
  dayISO: string,
  meals?: MealPlanEntryRow[] | null
): WallEvent[] {
  const [y, m, d] = dayISO.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return mergeDayRows(
    familyEventsForDay(dbEvents, dayISO),
    googleEventsForDay(googleRows, dayISO),
    schedulesForDay(schedules, date, meals)
  );
}

