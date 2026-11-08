/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import * as ImagePicker from "expo-image-picker";

import { ThemeProvider } from "../src/theme/ThemeProvider";
import { CalendarPage } from "../src/calendar/CalendarPage";
import {
  parseScheduleFlyerText,
  extractFlyerEventsSmart,
  SAMPLE_FLYERS,
} from "../src/calendar/magic-import";
import { MagicImportModal } from "../src/calendar/MagicImportModal";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

const mockRouterPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockRouterPush, canGoBack: () => false }),
  usePathname: () => "/calendar",
}));

const parent = { id: "p1", name: "Rebecca (Mom)", role: "parent", emoji: "🐱", color: "green" };
const child = { id: "c1", name: "Aurora", role: "child", emoji: "🦄", color: "pink" };

let mockMember: any = parent;
jest.mock("../src/state/AuthProvider", () => ({
  useAuth: () => ({
    member: mockMember,
    role: mockMember ? mockMember.role : null,
    hydrated: true,
    signOut: jest.fn(),
    poke: jest.fn(),
    pinRequiredFor: jest.requireActual("../src/state/AuthProvider").pinRequiredFor,
  }),
}));

const mockSyncValue = {
  stale: false,
  syncError: null,
  lastSyncAt: null,
  refreshNow: jest.fn(async () => {}),
  onPulse: () => () => {},
};
jest.mock("../src/state/SyncManager", () => ({
  useSync: () => mockSyncValue,
}));

jest.mock("../src/api/client", () => ({
  api: jest.fn(),
  ApiError: jest.requireActual("../src/api/client").ApiError,
}));
const { api } = jest.requireMock("../src/api/client") as { api: jest.Mock };
const { ApiError } = jest.requireActual("../src/api/client") as { ApiError: any };

const wrap = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

const route = (handlers: Record<string, unknown>) =>
  api.mockImplementation((path: string) => {
    for (const key of Object.keys(handlers)) {
      if (path.startsWith(key)) {
        const v = handlers[key];
        return v instanceof Error ? Promise.reject(v) : Promise.resolve(v);
      }
    }
    return Promise.reject(new ApiError({ message: "unmapped path", status: 404, code: "not_found" }));
  });

const NOW = new Date(2026, 9, 10, 9, 0); // Saturday 2026-10-10
const BASE_DATE = "2026-10-10";

describe("magic-import: parseScheduleFlyerText", () => {
  const ROSTER = ["Aurora", "Alex", "Rebecca (Mom)", "Leo"];

  it("parses explicit ISO dates and time ranges", () => {
    const text = "2026-10-15: Science Fair 5:30 PM - 7:30 PM @ School Gym";
    const events = parseScheduleFlyerText(text, BASE_DATE, ROSTER);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      title: "Science Fair",
      date: "2026-10-15",
      startTime: "17:30",
      endTime: "19:30",
      allDay: false,
      location: "School Gym",
      member: "All",
      selected: true,
    });
  });

  it("parses US slash dates and single times", () => {
    const text = "10/18: Soccer practice 9:30am at Field B (Alex)";
    const events = parseScheduleFlyerText(text, BASE_DATE, ROSTER);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      title: "Soccer practice",
      date: "2026-10-18",
      startTime: "09:30",
      endTime: "10:30",
      allDay: false,
      location: "Field B",
      member: "Alex",
    });
  });

  it("parses month names and all-day events", () => {
    const text = "Oct 12: Pajama Day - All day (Aurora)";
    const events = parseScheduleFlyerText(text, BASE_DATE, ROSTER);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      title: "Pajama Day",
      date: "2026-10-12",
      allDay: true,
      member: "Aurora",
    });
  });

  it("resolves weekday names relative to baseDateISO when no month is present", () => {
    // BASE_DATE is 2026-10-10 (Saturday, day 6).
    // Tuesday (day 2) should be 3 days ahead -> 2026-10-13.
    const text = "Tuesday: Music Recital 4:00 PM - 5:00 PM @ Auditorium (Aurora)";
    const events = parseScheduleFlyerText(text, BASE_DATE, ROSTER);
    expect(events).toHaveLength(1);
    expect(events[0].date).toBe("2026-10-13");
    expect(events[0].title).toBe("Music Recital");
    expect(events[0].startTime).toBe("16:00");
    expect(events[0].endTime).toBe("17:00");
    expect(events[0].member).toBe("Aurora");
  });

  it("parses all 3 SAMPLE_FLYERS with rich extraction", () => {
    for (const sample of SAMPLE_FLYERS) {
      const events = parseScheduleFlyerText(sample.text, BASE_DATE, ROSTER);
      expect(events.length).toBeGreaterThanOrEqual(4);
      for (const ev of events) {
        expect(ev.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(ev.startTime).toMatch(/^\d{2}:\d{2}$/);
        expect(ev.endTime).toMatch(/^\d{2}:\d{2}$/);
        expect(ev.title.length).toBeGreaterThan(0);
        expect(ev.selected).toBe(true);
      }
    }
  });
});

describe("magic-import: extractFlyerEventsSmart", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns AI results when /api/calendar/magic-import responds with 200 ok", async () => {
    api.mockResolvedValueOnce({
      ok: true,
      events: [
        {
          id: "ai-1",
          title: "Robotics Meet",
          date: "2026-10-22",
          startTime: "16:00",
          endTime: "18:00",
          allDay: false,
          member: "Aurora",
          location: "Lab 4",
        },
      ],
    });

    const result = await extractFlyerEventsSmart({
      text: "Robotics flyer",
      baseDateISO: BASE_DATE,
    });

    expect(result.source).toBe("ai");
    expect(result.events).toHaveLength(1);
    expect(result.events[0].title).toBe("Robotics Meet");
    expect(result.events[0].date).toBe("2026-10-22");
    expect(result.events[0].member).toBe("Aurora");
  });

  it("falls back cleanly to local natural-language parser when endpoint fails", async () => {
    api.mockRejectedValueOnce(new ApiError({ message: "404 not found", status: 404, code: "not_found" }));

    const text = "Monday Oct 12: Pajama Day - All day (Aurora)";
    const result = await extractFlyerEventsSmart({
      text,
      baseDateISO: BASE_DATE,
      rosterNames: ["Aurora"],
    });

    expect(result.source).toBe("local");
    expect(result.events).toHaveLength(1);
    expect(result.events[0].title).toBe("Pajama Day");
    expect(result.events[0].member).toBe("Aurora");
  });

  it("generates an editable draft from image filename when only imageUri is provided", async () => {
    api.mockRejectedValueOnce(new ApiError({ message: "Network error", status: 500, code: "error" }));

    const result = await extractFlyerEventsSmart({
      imageUri: "file:///var/mobile/soccer_camp_flyer.jpg",
      baseDateISO: BASE_DATE,
      rosterNames: ["Alex"],
    });

    expect(result.source).toBe("local");
    expect(result.events).toHaveLength(1);
    expect(result.events[0].title).toContain("Soccer camp flyer");
    expect(result.events[0].date).toBe(BASE_DATE);
    expect(result.events[0].member).toBe("Alex");
  });
});

describe("MagicImportModal Component", () => {
  const members = ["Aurora", "Alex", "Rebecca (Mom)"];

  it("renders sample chips and populates extracted events on tap", async () => {
    const onImportEvents = jest.fn(async () => {});
    const onClose = jest.fn();

    const { getByTestId } = render(
      <MagicImportModal
        visible={true}
        defaultDate={BASE_DATE}
        members={members}
        onClose={onClose}
        onImportEvents={onImportEvents}
      />,
      { wrapper: wrap }
    );

    expect(getByTestId("magic-import-modal")).toBeTruthy();
    expect(getByTestId("magic-import-pick-image")).toBeTruthy();
    expect(getByTestId("magic-import-sample-0")).toBeTruthy();

    // Tap the first sample flyer ("School Spirit Week")
    await act(async () => {
      fireEvent.press(getByTestId("magic-import-sample-0"));
    });

    // Check that events got extracted and row 0 is rendered
    expect(getByTestId("magic-import-row-0")).toBeTruthy();
    expect(getByTestId("magic-import-check-0")).toBeTruthy();

    // Check submit button is enabled and has count
    const submitBtn = getByTestId("magic-import-submit");
    expect(submitBtn).toBeTruthy();

    // Toggle row 0 checkmark
    await act(async () => {
      fireEvent.press(getByTestId("magic-import-check-0"));
    });

    // Change member on row 1 to "Alex"
    if (getByTestId("magic-import-member-1-Alex")) {
      await act(async () => {
        fireEvent.press(getByTestId("magic-import-member-1-Alex"));
      });
    }

    // Submit import
    await act(async () => {
      fireEvent.press(submitBtn);
    });

    expect(onImportEvents).toHaveBeenCalledTimes(1);
    const drafts = (onImportEvents.mock.calls as any)[0][0];
    expect(drafts.length).toBeGreaterThan(0);
  });

  it("picks an image and shows the image attachment pill", async () => {
    const spy = jest
      .spyOn(ImagePicker, "launchImageLibraryAsync")
      .mockResolvedValueOnce({
        canceled: false,
        assets: [
          {
            uri: "file:///photos/volleyball_schedule.png",
            fileName: "volleyball_schedule.png",
            width: 800,
            height: 600,
          },
        ],
      } as any);

    const { getByTestId } = render(
      <MagicImportModal
        visible={true}
        defaultDate={BASE_DATE}
        members={members}
        onClose={jest.fn()}
        onImportEvents={jest.fn(async () => {})}
      />,
      { wrapper: wrap }
    );

    await act(async () => {
      fireEvent.press(getByTestId("magic-import-pick-image"));
    });

    expect(spy).toHaveBeenCalled();
    expect(getByTestId("magic-import-image-pill")).toBeTruthy();

    // Clear image
    const clearBtn = getByTestId("magic-import-clear-image");
    expect(clearBtn.props.style).toMatchObject({ minHeight: 64, minWidth: 64 });
    await act(async () => {
      fireEvent.press(clearBtn);
    });
  });

  it("ensures checkbox toggles meet the 64dp tap floor", async () => {
    const { getByTestId } = render(
      <MagicImportModal
        visible={true}
        defaultDate={BASE_DATE}
        members={members}
        onClose={jest.fn()}
        onImportEvents={jest.fn(async () => {})}
      />,
      { wrapper: wrap }
    );

    await act(async () => {
      fireEvent.press(getByTestId("magic-import-sample-0"));
    });

    const check0 = getByTestId("magic-import-check-0");
    expect(check0.props.style).toMatchObject({ minHeight: 64, minWidth: 64 });
  });
});

describe("CalendarPage Integration with Magic Import", () => {
  beforeEach(() => {
    mockMember = parent;
    route({
      "/api/db/events": { items: [] },
      "/api/google-calendar": { ok: true, connected: true, events: [] },
      "/api/db/schedules": { items: [] },
      "/api/db/meal_plan_entries": { items: [] },
      "/api/members": { items: [{ name: "Aurora" }, { name: "Alex" }] },
    });
  });

  it("shows magic-import-open for a parent", async () => {
    mockMember = parent;
    const { getByTestId } = render(<CalendarPage now={NOW} />, { wrapper: wrap });

    await waitFor(() => {
      expect(getByTestId("magic-import-open")).toBeTruthy();
    });
  });

  it("does NOT show magic-import-open for child, pet, or guest", async () => {
    mockMember = child;
    const { queryByTestId } = render(<CalendarPage now={NOW} />, { wrapper: wrap });

    await waitFor(() => {
      expect(queryByTestId("magic-import-open")).toBeNull();
    });
  });

  it("parent opens Magic Import, imports sample events, and saves via /api/calendar/events", async () => {
    mockMember = parent;
    const postCalls: any[] = [];
    api.mockImplementation((path: string, init?: any) => {
      if (path === "/api/calendar/events" && init?.method === "POST") {
        postCalls.push(init.body);
        return Promise.resolve({
          ok: true,
          event: {
            id: `server-ev-${postCalls.length}`,
            title: init.body.title,
            date: init.body.date,
            time: init.body.allDay ? undefined : init.body.startTime,
            member: init.body.member,
            all_day: init.body.allDay,
          },
        });
      }
      if (path.startsWith("/api/db/events")) return Promise.resolve({ items: [] });
      if (path.startsWith("/api/google-calendar")) return Promise.resolve({ ok: true, connected: true, events: [] });
      if (path.startsWith("/api/db/schedules")) return Promise.resolve({ items: [] });
      if (path.startsWith("/api/db/meal_plan_entries")) return Promise.resolve({ items: [] });
      if (path.startsWith("/api/members")) return Promise.resolve({ items: [{ name: "Aurora" }, { name: "Alex" }] });
      return Promise.reject(new ApiError({ message: "404", status: 404, code: "not_found" }));
    });

    const { getByTestId, queryByTestId } = render(<CalendarPage now={NOW} />, { wrapper: wrap });

    await waitFor(() => {
      expect(getByTestId("magic-import-open")).toBeTruthy();
    });

    // Open Magic Import modal
    await act(async () => {
      fireEvent.press(getByTestId("magic-import-open"));
    });

    expect(getByTestId("magic-import-modal")).toBeTruthy();

    // Select Sample 0 ("School Spirit Week")
    await act(async () => {
      fireEvent.press(getByTestId("magic-import-sample-0"));
    });

    expect(getByTestId("magic-import-row-0")).toBeTruthy();

    // Click Import Events
    await act(async () => {
      fireEvent.press(getByTestId("magic-import-submit"));
    });

    // Check that /api/calendar/events was called for each selected event
    await waitFor(() => {
      expect(postCalls.length).toBeGreaterThan(0);
    });

    // Modal should close
    await waitFor(() => {
      expect(queryByTestId("magic-import-modal")).toBeNull();
    });
  });

  it("ensures CalendarPage interactive buttons meet the 64dp tap floor", async () => {
    mockMember = parent;
    const { getByTestId, getByLabelText } = render(<CalendarPage now={NOW} />, { wrapper: wrap });

    await waitFor(() => {
      expect(getByTestId("cal-add-event")).toBeTruthy();
    });

    expect(getByTestId("cal-add-event").props.style).toMatchObject({ minHeight: 64 });
    expect(getByLabelText("Filter all family members").props.style).toMatchObject({ minHeight: 64 });
    expect(getByLabelText("Jump to today").props.style).toMatchObject({ minHeight: 64 });
  });

  it("filters restOfWeekDays by selectedMember and excludes routines", async () => {
    mockMember = parent;
    route({
      "/api/db/events": {
        items: [
          { id: "e1", title: "Dad Soccer", date: "2026-10-06", time: "16:00", member: "Dad" },
          { id: "e2", title: "Mom Ballet", date: "2026-10-07", time: "17:00", member: "Mom" },
        ],
      },
      "/api/google-calendar": { ok: true, connected: true, events: [] },
      "/api/db/schedules": {
        items: [
          { id: "s1", title: "Bedtime Routine", days: [1, 2, 3, 4, 5, 6, 7], time: "20:00" },
        ],
      },
      "/api/db/meal_plan_entries": { items: [] },
      "/api/members": { items: [{ name: "Mom" }, { name: "Dad" }] },
    });

    const { getByLabelText, queryByLabelText } = render(<CalendarPage now={NOW} />, { wrapper: wrap });

    // With All selected, Tuesday (Oct 06) and Wednesday (Oct 07) appear in Rest of this Week
    await waitFor(() => {
      expect(getByLabelText("View events on TUE 6")).toBeTruthy();
      expect(getByLabelText("View events on WED 7")).toBeTruthy();
    });

    // Filter by Mom: Dad's Tuesday event disappears from Rest of this Week
    await act(async () => {
      fireEvent.press(getByLabelText("Filter by Mom"));
    });

    await waitFor(() => {
      expect(queryByLabelText("View events on TUE 6")).toBeNull();
      expect(getByLabelText("View events on WED 7")).toBeTruthy();
    });
  });
});
