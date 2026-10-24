jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

import { googleCoversDay, familyEventsForDay, googleEventsForDay, mergeDayRows } from "../src/calendar/events-merge";

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
