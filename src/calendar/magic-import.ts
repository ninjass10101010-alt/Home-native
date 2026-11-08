import { api } from "../api/client";
import { addDaysISO, isoToDate } from "./date-utils";

export interface ExtractedFlyerEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM (24h)
  endTime: string; // HH:MM (24h)
  allDay: boolean;
  member: string;
  location: string;
  notes: string;
  selected: boolean;
}

export const SAMPLE_FLYERS: { label: string; text: string }[] = [
  {
    label: "School Spirit Week",
    text: `Oakridge Elementary Spirit Week 2026!
Monday Oct 12: Pajama Day - All day (Aurora)
Tuesday Oct 13: Crazy Hair Day - 8:30 AM - 3:00 PM at Main Campus (Aurora)
Wednesday Oct 14: College Day - Wear your favorite jersey (Alex)
Thursday Oct 15: Science Fair & Open House - 5:30 PM - 7:30 PM @ School Gym
Friday Oct 16: Pep Rally & Pizza Party - 1:00 PM - 3:00 PM on the Football Field`,
  },
  {
    label: "Youth Soccer Schedule",
    text: `Strikers U10 Fall Soccer Schedule
Saturday Oct 17: Morning Practice 9:00 AM - 10:30 AM @ Community Park Field 3 (Alex)
Tuesday Oct 20: Team Photo Day 4:30 PM - 5:15 PM at North Field
Saturday Oct 24: Game vs Lightning 10:00 AM - 11:30 AM @ West Complex Field B (Alex)
Sunday Nov 01: End of Season Tournament 1:00 PM - 4:00 PM at Regional Sports Center`,
  },
  {
    label: "Family Appointments",
    text: `Upcoming Family Health & Dentist Schedule
Monday Oct 19: Annual Dental Cleaning 9:00 AM - 10:00 AM @ Smile Dental Care (Aurora)
Monday Oct 19: Orthodontist Checkup 10:30 AM - 11:15 AM @ Dr. Smith Ortho (Alex)
Wednesday Oct 21: Eye Exam & Glasses Fitting 3:30 PM - 4:30 PM at Family Vision Center (Rebecca (Mom))
Friday Oct 23: Flu Shot Clinic 2:00 PM - 3:00 PM @ Pediatric Health Clinic`,
  },
];

const MONTH_MAP: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

const WEEKDAY_MAP: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function parseTimeToHHMM(raw: string): string | null {
  const clean = raw.trim().toUpperCase();
  // 24-hour HH:MM
  const match24 = clean.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (match24) {
    return `${pad(Number(match24[1]))}:${match24[2]}`;
  }
  // 12-hour H:MM AM/PM or H AM/PM
  const match12 = clean.match(/^(\d{1,2})(?::([0-5]\d))?\s*(AM|PM)$/);
  if (match12) {
    const hour = Number(match12[1]);
    const minute = match12[2] ? Number(match12[2]) : 0;
    const period = match12[3];
    if (hour < 1 || hour > 12) return null;
    const h24 = (hour % 12) + (period === "PM" ? 12 : 0);
    return `${pad(h24)}:${pad(minute)}`;
  }
  return null;
}

function addOneHour(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = Math.min((h + 1) * 60 + m, 23 * 60 + 59);
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

export function parseScheduleFlyerText(
  rawText: string,
  baseDateISO: string,
  rosterNames?: string[]
): ExtractedFlyerEvent[] {
  const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);
  const events: ExtractedFlyerEvent[] = [];
  const baseDate = isoToDate(baseDateISO);
  const baseYear = baseDate.getFullYear();

  let eventIdx = 0;

  for (const rawLine of lines) {
    let line = rawLine;

    // Check if line looks like pure header (no date, no time, short title only)
    const hasIsoDate = /\b\d{4}-\d{2}-\d{2}\b/.test(line);
    const hasSlashDate = /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/.test(line);
    const hasMonthName = /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[.,]?\s+\d{1,2}\b/i.test(line);
    const hasWeekday = /\b(?:mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b/i.test(line);
    const hasTimeSignal = /\b(?:\d{1,2}(?::\d{2})?\s*(?:am|pm)|all[- ]day|\d{1,2}:\d{2})\b/i.test(line);

    // Skip lines that have neither any date nor time signal (e.g. "Oakridge Elementary Spirit Week 2026!")
    if (!hasIsoDate && !hasSlashDate && !hasMonthName && !hasWeekday && !hasTimeSignal) {
      continue;
    }

    // 1. Extract Date
    let parsedDate = baseDateISO;

    // 1a. Explicit ISO YYYY-MM-DD
    const isoMatch = line.match(/\b(\d{4}-\d{2}-\d{2})\b/);
    if (isoMatch) {
      parsedDate = isoMatch[1];
      line = line.replace(isoMatch[0], "");
    } else {
      // 1b. Slash date MM/DD or MM/DD/YYYY
      const slashMatch = line.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
      if (slashMatch) {
        const m = Number(slashMatch[1]);
        const d = Number(slashMatch[2]);
        let y = slashMatch[3] ? Number(slashMatch[3]) : baseYear;
        if (y < 100) y += 2000;
        if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
          parsedDate = `${y}-${pad(m)}-${pad(d)}`;
          line = line.replace(slashMatch[0], "");
        }
      } else {
        // 1c. Month name + Day (e.g. Oct 12, October 15th, Nov 01)
        const monthMatch = line.match(
          /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[.,]?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/i
        );
        if (monthMatch) {
          const mKey = monthMatch[1].toLowerCase().replace(/\./g, "");
          const m = MONTH_MAP[mKey] ?? 10;
          const d = Number(monthMatch[2]);
          const y = monthMatch[3] ? Number(monthMatch[3]) : baseYear;
          parsedDate = `${y}-${pad(m)}-${pad(d)}`;
          line = line.replace(monthMatch[0], "");
        } else {
          // 1d. Weekday relative resolution
          const weekMatch = line.match(/\b(mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b/i);
          if (weekMatch) {
            const wKey = weekMatch[1].toLowerCase();
            const targetDay = WEEKDAY_MAP[wKey];
            if (targetDay !== undefined) {
              const currentDay = baseDate.getDay();
              let diff = targetDay - currentDay;
              if (diff < 0) diff += 7;
              parsedDate = addDaysISO(baseDateISO, diff);
              line = line.replace(weekMatch[0], "");
            }
          }
        }
      }
    }

    // Strip leftover weekday word if date was also matched by month (e.g., "Monday Oct 12" had Oct 12 matched, remove Monday)
    line = line.replace(/\b(mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b/gi, "");

    // 2. Extract Member
    let assignedMember = "All";
    // Check parentheses first e.g. (Aurora)
    const parenMemberMatch = line.match(/\(([^)]+)\)/);
    if (parenMemberMatch) {
      const inside = parenMemberMatch[1].trim();
      if (rosterNames && rosterNames.length > 0) {
        const found = rosterNames.find(
          (rn) =>
            rn.toLowerCase() === inside.toLowerCase() ||
            rn.toLowerCase().includes(inside.toLowerCase()) ||
            inside.toLowerCase().includes(rn.toLowerCase())
        );
        if (found) {
          assignedMember = found;
          line = line.replace(parenMemberMatch[0], "");
        } else if (inside.length > 0) {
          assignedMember = inside;
          line = line.replace(parenMemberMatch[0], "");
        }
      } else if (inside.length > 0) {
        assignedMember = inside;
        line = line.replace(parenMemberMatch[0], "");
      }
    } else if (rosterNames && rosterNames.length > 0) {
      // Check if any roster name appears as a whole word in the text
      for (const rn of rosterNames) {
        const regex = new RegExp(`\\b${rn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
        if (regex.test(line)) {
          assignedMember = rn;
          line = line.replace(regex, "");
          break;
        }
      }
    }

    // 3. Extract Location
    let location = "";
    // e.g. "@ Community Park Field 3" or "@ School Gym"
    const atSignMatch = line.match(/@\s*([^,\-;\n]+)/);
    if (atSignMatch) {
      location = atSignMatch[1].trim();
      line = line.replace(atSignMatch[0], "");
    } else {
      // e.g. "at Main Campus" or "at Regional Sports Center"
      const atWordMatch = line.match(/\bat\s+([A-Z0-9][^,\-;\n]+)/);
      if (atWordMatch) {
        location = atWordMatch[1].trim();
        line = line.replace(atWordMatch[0], "");
      } else {
        // e.g. "on the Football Field"
        const onWordMatch = line.match(/\bon\s+(?:the\s+)?([A-Z0-9][^,\-;\n]+)/);
        if (onWordMatch) {
          location = onWordMatch[1].trim();
          line = line.replace(onWordMatch[0], "");
        }
      }
    }

    // 4. Extract Times & All-Day
    let allDay = false;
    let startTime = "09:00";
    let endTime = "10:00";

    if (/\ball[- ]day\b/i.test(line)) {
      allDay = true;
      line = line.replace(/\ball[- ]day\b/gi, "");
    } else {
      // Check for time range: e.g. "8:30 AM - 3:00 PM" or "9:00 AM - 10:30 AM" or "1:00 PM - 3:00 PM"
      const rangeMatch = line.match(
        /(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:-|–|—|to)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i
      );
      if (rangeMatch) {
        let t1 = parseTimeToHHMM(rangeMatch[1]);
        const t2 = parseTimeToHHMM(rangeMatch[2]);
        // If t1 had no AM/PM specified (e.g. 8:30 - 3:00 PM), inherit PM or AM from t2 if appropriate
        if (!t1 && /^\d{1,2}(?::\d{2})?$/.test(rangeMatch[1].trim()) && t2) {
          const p2 = rangeMatch[2].toUpperCase().includes("PM") ? "PM" : "AM";
          t1 = parseTimeToHHMM(`${rangeMatch[1].trim()} ${p2}`);
        }
        if (t1 && t2) {
          startTime = t1;
          endTime = t2;
          allDay = false;
          line = line.replace(rangeMatch[0], "");
        }
      } else {
        // Single time: e.g. "9:30am", "4:30 PM", "11:00 AM"
        const singleMatch = line.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i);
        if (singleMatch) {
          const t1 = parseTimeToHHMM(singleMatch[1]);
          if (t1) {
            startTime = t1;
            endTime = addOneHour(t1);
            allDay = false;
            line = line.replace(singleMatch[0], "");
          }
        } else {
          // No time found -> default to all day
          allDay = true;
        }
      }
    }

    // 5. Clean Title and Notes
    // Clean leading/trailing punctuation like colons, dashes, spaces
    let cleaned = line
      .replace(/^[:\-\s,]+/, "")
      .replace(/[:\-\s,]+$/, "")
      .trim();

    // Check if there are notes separated by hyphen or semicolon: e.g. "College Day - Wear your favorite jersey"
    let title = cleaned;
    let notes = "";
    if (cleaned.includes(" - ")) {
      const parts = cleaned.split(" - ");
      title = parts[0].trim();
      notes = parts.slice(1).join(" - ").trim();
    } else if (cleaned.includes("; ")) {
      const parts = cleaned.split("; ");
      title = parts[0].trim();
      notes = parts.slice(1).join("; ").trim();
    }

    // Clean up any double spaces or orphan punctuation
    title = title.replace(/\s+/g, " ").trim();
    notes = notes.replace(/\s+/g, " ").trim();

    if (!title) {
      title = "Scheduled Event";
    }

    events.push({
      id: `magic-parsed-${eventIdx++}-${Date.now()}`,
      title,
      date: parsedDate,
      startTime,
      endTime,
      allDay,
      member: assignedMember,
      location,
      notes,
      selected: true,
    });
  }

  return events;
}

export async function extractFlyerEventsSmart(input: {
  text?: string;
  imageUri?: string;
  baseDateISO: string;
  rosterNames?: string[];
}): Promise<{ events: ExtractedFlyerEvent[]; source: "ai" | "local" }> {
  // First attempt POST /api/calendar/magic-import
  if (input.text || input.imageUri) {
    try {
      const res = await api<{ ok?: boolean; events?: any[] }>("/api/calendar/magic-import", {
        method: "POST",
        body: {
          text: input.text,
          imageUri: input.imageUri,
          baseDate: input.baseDateISO,
          members: input.rosterNames,
        },
      });
      if (res?.ok && Array.isArray(res.events) && res.events.length > 0) {
        const events: ExtractedFlyerEvent[] = res.events.map((e, idx) => ({
          id: e.id || `magic-ai-${idx}-${Date.now()}`,
          title: String(e.title || "Untitled Event").trim(),
          date: e.date || input.baseDateISO,
          startTime: e.startTime || "09:00",
          endTime: e.endTime || "10:00",
          allDay: Boolean(e.allDay),
          member: e.member || "All",
          location: e.location || "",
          notes: e.notes || "",
          selected: e.selected !== undefined ? Boolean(e.selected) : true,
        }));
        return { events, source: "ai" };
      }
    } catch {
      // Endpoint 404s or fails (offline / not yet deployed) — cleanly fall back
    }
  }

  // Local fallback: natural language parser
  if (input.text && input.text.trim()) {
    const localEvents = parseScheduleFlyerText(input.text, input.baseDateISO, input.rosterNames);
    if (localEvents.length > 0) {
      return { events: localEvents, source: "local" };
    }
  }

  // If only image was provided without text (or text yielded no lines):
  if (input.imageUri) {
    const rawName = input.imageUri.split("/").pop()?.replace(/\.[^/.]+$/, "") ?? "Flyer Event";
    const cleanTitle =
      rawName
        .replace(/[-_]/g, " ")
        .replace(/^photo\s*/i, "")
        .replace(/^image\s*/i, "")
        .trim() || "Scanned Flyer Event";
    const title = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);

    const fallbackEvent: ExtractedFlyerEvent = {
      id: `magic-img-${Date.now()}`,
      title,
      date: input.baseDateISO,
      startTime: "09:00",
      endTime: "10:00",
      allDay: true,
      member: input.rosterNames?.[0] ?? "All",
      location: "",
      notes: "Extracted from flyer photo",
      selected: true,
    };
    return { events: [fallbackEvent], source: "local" };
  }

  return { events: [], source: "local" };
}
