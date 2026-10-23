import {
  addDaysISO,
  monthGridCells,
  parseClockToHHMM,
  selectedWeekISO,
} from "../src/calendar/date-utils";

describe("calendar date utils", () => {
  it("builds a Sunday-first six-week grid", () => {
    const cells = monthGridCells(2026, 9);
    expect(cells).toHaveLength(42);
    expect(cells[0].iso).toBe("2026-09-27");
    expect(cells[4].iso).toBe("2026-10-01");
    expect(cells[41].iso).toBe("2026-11-07");
  });

  it("finds the Sunday of the selected week", () => {
    expect(selectedWeekISO("2026-10-10")).toBe("2026-10-04");
  });

  it("advances dates across DST and month boundaries", () => {
    expect(addDaysISO("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDaysISO("2026-03-07", 1)).toBe("2026-03-08");
  });

  it("normalizes 12-hour and 24-hour clocks", () => {
    expect(parseClockToHHMM("7:05 PM")).toBe("19:05");
    expect(parseClockToHHMM("07:05")).toBe("07:05");
    expect(parseClockToHHMM("25:00")).toBeNull();
  });
});
