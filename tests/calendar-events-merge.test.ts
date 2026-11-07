jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

import {
  googleCoversDay,
  familyEventsForDay,
  googleEventsForDay,
  mergeDayRows,
  schedulesForDay,
  resolveRoutineMealSlot,
  findPlannedMealForSlot,
} from "../src/calendar/events-merge";

test("google all-day UTC buckets by date part", () => {
  const row = { google_id: "g", summary: "X", start_iso: "2026-10-21T00:00:00Z", all_day: true } as any;
  expect(googleCoversDay(row, "2026-10-21")).toBe(true);
  expect(googleCoversDay(row, "2026-10-20")).toBe(false);
});

test("family malformed time renders undefined", () => {
  const rows = [{ id: "1", title: "X", date: "2026-10-10", time: "nope" } as any];
  const out = familyEventsForDay(rows, "2026-10-10");
  expect(out[0].time).toBeUndefined();
});

test("merge dedupes mirrored google row", () => {
  const family = [{ id: "db_1", title: "X", time: undefined, sortMinutes: 0, icon: "📅", source: "family", googleId: "g1" } as any];
  const google = [{ id: "g_g1", title: "X", time: "All day", sortMinutes: -1, icon: "📅", source: "google", googleId: "g1" } as any];
  const out = mergeDayRows(family, google);
  expect(out).toHaveLength(1);
});

test("google events dedupe the same id repeated across calendars", () => {
  const rows = [
    { google_id: "g1", summary: "Bex — Pub on 8th shift", start_iso: "2026-10-23T18:15:00-04:00", calendar_id: "primary" },
    { google_id: "g1", summary: "Bex — Pub on 8th shift", start_iso: "2026-10-23T18:15:00-04:00", calendar_id: "ninjass10101010@gmail.com" },
  ] as any[];
  const out = googleEventsForDay(rows, "2026-10-23");
  expect(out).toHaveLength(1);
  expect(out[0].id).toBe("g_g1");
});

test("schedulesForDay deduplicates mom out of work and rebecca get home from work", () => {
  const wednesday = new Date("2026-10-21T12:00:00Z"); // Wednesday (weekday)
  const rows = [
    { id: "1", title: "MOM out of work ", time: "5:40 PM", days: "weekdays" },
    { id: "2", title: "Rebecca Gets Home From Work", time: "5:45 PM", days: "weekdays" },
    { id: "3", title: "Breakfast", time: "6:40 AM", days: "all" },
    { id: "4", title: "Breakfast!", time: "6:50 AM", days: "weekdays" },
    { id: "5", title: "Leaving to School", time: "7:05 AM", days: "weekdays" },
    { id: "6", title: "Leaving for School", time: "7:10 AM", days: "weekdays" },
  ] as any[];

  const result = schedulesForDay(rows, wednesday);
  // Expect 3 deduplicated items: Breakfast, Leaving for School, Rebecca Gets Home From Work
  expect(result).toHaveLength(3);
  expect(result.some((r) => r.title.includes("Rebecca") || r.title.includes("MOM"))).toBe(true);
  expect(result.filter((r) => r.title.includes("Rebecca") || r.title.includes("MOM"))).toHaveLength(1);
  expect(result.filter((r) => r.title.toLowerCase().includes("breakfast"))).toHaveLength(1);
  expect(result.filter((r) => r.title.toLowerCase().includes("school"))).toHaveLength(1);
});

test("resolveRoutineMealSlot detects breakfast, lunch, and dinner routines via mealType or title", () => {
  expect(resolveRoutineMealSlot({ title: "Dinner", mealType: "dinner" })).toBe("dinner");
  expect(resolveRoutineMealSlot({ title: "Family Dinner Time" })).toBe("dinner");
  expect(resolveRoutineMealSlot({ title: "Lunch Break" })).toBe("lunch");
  expect(resolveRoutineMealSlot({ title: "Morning Breakfast!" })).toBe("breakfast");
  expect(resolveRoutineMealSlot({ title: "Afternoon Snack" })).toBeNull();
  expect(resolveRoutineMealSlot({ title: "Take Dogs Out" })).toBeNull();
  expect(resolveRoutineMealSlot({ title: "Dinner", mealType: "none" })).toBeNull();
});

test("schedulesForDay hides meal routines (Breakfast, Lunch, Dinner) when no meal is planned and enriches them when planned", () => {
  // Friday Nov 6, 2026 (Monday of that week is 2026-11-02)
  const friday = new Date(2026, 10, 6, 12, 0, 0);
  const routines = [
    { id: "r1", title: "Breakfast", time: "07:00", days: "all", icon: "🍳" },
    { id: "r2", title: "Leaving for School", time: "07:30", days: "weekdays", icon: "🎒" },
    { id: "r3", title: "Lunch", time: "12:30", days: "all", icon: "🥪" },
    { id: "r4", title: "Dinner", time: "18:15", days: "all", icon: "🍽️" },
    { id: "r5", title: "Take Dogs Out", time: "19:00", days: "all", icon: "🐶" },
  ];

  // 1. When meals array is empty -> Breakfast, Lunch, Dinner are hidden; School & Dogs remain
  const emptyMealPlanResult = schedulesForDay(routines, friday, []);
  expect(emptyMealPlanResult.map((r) => r.title)).toEqual([
    "Leaving for School",
    "Take Dogs Out",
  ]);

  // 2. When Dinner is planned for Friday -> Dinner is included and enriched with the meal name & emoji
  const plannedMeals = [
    {
      id: "m1",
      name: "Chicken Fajitas",
      emoji: "🌮",
      time: "Fri",
      mealType: "dinner",
      weekOf: "2026-11-02",
    },
  ];
  expect(findPlannedMealForSlot(plannedMeals, friday, "dinner")?.name).toBe("Chicken Fajitas");
  expect(findPlannedMealForSlot(plannedMeals, friday, "breakfast")).toBeNull();

  const withDinnerResult = schedulesForDay(routines, friday, plannedMeals);
  expect(withDinnerResult.map((r) => r.title)).toEqual([
    "Leaving for School",
    "Dinner: Chicken Fajitas",
    "Take Dogs Out",
  ]);
  const dinnerRow = withDinnerResult.find((r) => r.id === "s_r4");
  expect(dinnerRow?.icon).toBe("🌮");
});
