import type { MealSlotId } from "./plan-grid";

/**
 * The household meal-schedule → active slot rule (ported verbatim from
 * CurrentMealWidget.tsx:105-121 — the wave-1 widget, itself a verified port of
 * the web's current-meal selection). Shared by the wall cell AND the page:
 * one rule, one source, no band drift (critic finding, WS-6).
 *
 * Rule: sorted schedule rows with a mealType (skipping ""/"none"), the LAST
 * slot whose time has passed wins; a slot that started >60m ago is over →
 * roll forward to the next one; no schedules → "dinner" (the widget's
 * historical default, and the honest answer for a wall).
 */
export interface SlotScheduleRow {
  mealType?: string;
  /** Schedule title — the keyword fallback lane (web parity). */
  title?: string;
  time?: string; // "HH:MM"
}

const SLOTS: MealSlotId[] = ["breakfast", "lunch", "snack", "dinner"];

/** Web parity (CurrentMealWidget.tsx:100-109): a row with no mealType but a
 *  meal keyword in its TITLE still marks a slot ("Dinner" → dinner). */
function mealTypeFromTitle(title?: string): MealSlotId | null {
  const t = (title ?? "").toLowerCase();
  if (t.includes("breakfast")) return "breakfast";
  if (t.includes("lunch")) return "lunch";
  if (t.includes("dinner")) return "dinner";
  if (t.includes("snack")) return "snack";
  return null;
}

export function currentSlotFor(schedules: SlotScheduleRow[] | null | undefined, now: Date): MealSlotId {
  const typed = (schedules ?? [])
    .filter((s) => !!s.mealType && s.mealType !== "none" && SLOTS.includes(s.mealType as MealSlotId))
    .map((s) => ({ ...s, minutes: parseMinutes(s.time) }))
    .filter((s): s is SlotScheduleRow & { minutes: number } => s.minutes !== null)
    .sort((a, b) => a.minutes - b.minutes);

  // Title-keyword fallback: the family "Dinner" schedule with an empty
  // mealType field still drives the slot (the web never skipped it).
  const titled = typed.length === 0
    ? (schedules ?? [])
        .map((s) => {
          const mealType = mealTypeFromTitle(s.title);
          if (!mealType) return null;
          const minutes = parseMinutes(s.time);
          if (minutes === null) return null;
          return { ...s, mealType, minutes };
        })
        .filter((s): s is { mealType: MealSlotId; minutes: number; title?: string; time?: string } => s !== null)
        .sort((a, b) => a.minutes - b.minutes)
    : [];

  const rows = typed.length > 0 ? typed : titled;
  if (rows.length === 0) return "dinner";

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  let current: SlotScheduleRow & { minutes: number } = rows[0];
  for (const row of rows) {
    if (row.minutes <= nowMinutes) current = row;
  }
  // A slot that started >60m ago is over — roll forward to the next one.
  if (nowMinutes - current.minutes > 60) {
    const next = rows.find((r) => r.minutes > nowMinutes);
    if (next) current = next;
  }
  return (current.mealType as MealSlotId) ?? "dinner";
}

function parseMinutes(t?: string): number | null {
  const m = t?.match(/^(\d{1,2}):(\d{2})$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
