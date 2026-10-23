/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { act, fireEvent, render, within } from "@testing-library/react-native";

import { ThemeProvider } from "../src/theme/ThemeProvider";
import { CalendarPage } from "../src/calendar/CalendarPage";
import { scheduleTimeMinutes } from "../src/calendar/events-merge";
import { localTodayISO } from "../src/home/widgets/data";
import CalendarRoute from "../app/calendar";

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

let mockStale = false;
const mockRefreshNow = jest.fn(async () => {});
const mockPulseListeners = new Set<() => void>();
// Stable value object — mirrors SyncManager's useMemo so effect deps settle.
const mockSyncValue = {
  get stale() {
    return mockStale;
  },
  syncError: null as null,
  lastSyncAt: null as null,
  refreshNow: mockRefreshNow,
  onPulse: (l: () => void) => {
    mockPulseListeners.add(l);
    return () => {
      mockPulseListeners.delete(l);
    };
  },
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

const wrap = ({ children }: { children: React.ReactNode }) => <ThemeProvider>{children}</ThemeProvider>;

/** Path-prefix router for the mocked api(). */
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

// ── Fixtures. NOW is pinned: Saturday 2026-10-10 09:00 local. The Mon-start
// week runs 2026-10-05..2026-10-11; the agenda window runs 10-10..10-16. ──
const NOW = new Date(2026, 9, 10, 9, 0);
const TODAY = "2026-10-10";

const DB_EVENTS = [
  { id: "e1", title: "Piano lesson", date: TODAY, time: "17:30", member: "Aurora", icon: "🎹" },
  { id: "e2", title: "Dentist", date: "2026-10-06", time: "09:00", member: "Alex", icon: "🦷" },
  { id: "e4", title: "School conference", date: "2026-10-13", time: "14:00", member: "Rebecca (Mom)", icon: "🏫" },
];

const GOOGLE_OK = (events: any[] = []) => ({
  ok: true,
  connected: true,
  events,
  calendar_colors: null,
});

const GOOGLE_EVENTS = [
  { google_id: "g1", summary: "Beach day", start_iso: TODAY, all_day: true, calendar_id: "primary" },
  { google_id: "g2", summary: "Soccer game", start_iso: `${TODAY}T15:00:00`, all_day: false, calendar_id: "primary" },
];

const SCHEDULES = [
  { id: "s1", title: "Wake up", time: "07:30", days: "weekdays", icon: "⏰", type: "routine", color: "amber", member: "Aurora" },
  { id: "s2", title: "Trash day", time: "08:00", days: "friday", icon: "🗑️", type: "routine", color: "green", member: "Alex" },
  { id: "s4", title: "Date night", time: "8:00 PM", days: "wed", icon: "🍷", type: "routine", color: "rose", member: "Rebecca (Mom)" },
];

const fullRoute = () =>
  route({
    "/api/db/events": { items: DB_EVENTS },
    "/api/google-calendar": GOOGLE_OK(GOOGLE_EVENTS),
    "/api/db/schedules": { items: SCHEDULES },
  });

/** Ordered row ids from the rendered tree (cal-row-* testIDs, document order). */
const rowOrder = (result: { toJSON: () => any }): string[] => {
  const out: string[] = [];
  const visit = (node: any) => {
    if (!node || typeof node !== "object") return;
    const tid = node.props?.testID;
    if (typeof tid === "string" && tid.startsWith("cal-row-")) out.push(tid.slice("cal-row-".length));
    if (Array.isArray(node.children)) node.children.forEach(visit);
  };
  visit(result.toJSON());
  return out;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPulseListeners.clear();
  mockMember = parent;
  mockStale = false;
  api.mockReset();
});

describe("CalendarPage — week strip", () => {
  it("renders the 7 Mon–Sun chips with today highlighted and selected by default", async () => {
    fullRoute();
    const { getByTestId, findByText } = render(<CalendarPage now={NOW} />, { wrapper: wrap });
    await findByText("Piano lesson");
    for (const iso of ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"]) {
      expect(getByTestId(`cal-day-${iso}`)).toBeTruthy();
    }
    const today = getByTestId(`cal-day-${TODAY}`);
    expect(today.props.accessibilityLabel).toBe("Saturday, October 10, selected");
    expect(today.props.accessibilityState?.selected).toBe(true);
    expect(getByTestId("cal-day-2026-10-05").props.accessibilityState?.selected).toBe(false);
  });

  it("tapping a day chip selects it and swaps the list to that day", async () => {
    fullRoute();
    const { getByTestId, findByText, getByText } = render(<CalendarPage now={NOW} />, { wrapper: wrap });
    await findByText("Piano lesson");
    await act(async () => {
      fireEvent.press(getByTestId("cal-day-2026-10-06"));
      await Promise.resolve();
    });
    expect(getByTestId("cal-day-2026-10-06").props.accessibilityState?.selected).toBe(true);
    expect(getByTestId(`cal-day-${TODAY}`).props.accessibilityState?.selected).toBe(false);
    expect(await findByText("Dentist")).toBeTruthy();
    expect(getByText("9:00 AM")).toBeTruthy();
    expect(getByText("Tuesday, October 6")).toBeTruthy();
    expect(within(getByTestId("cal-selected-events")).queryByText("Piano lesson")).toBeNull();
  });
});

describe("CalendarPage — day list merge", () => {
  it("merges family + google + routines, all-day first, sorted by time", async () => {
    const schedules = [
      { id: "s3", title: "Family clean", time: "10:00", days: "all", icon: "🧹", type: "routine", color: "cyan", member: "Aurora" },
    ];
    route({
      "/api/db/events": { items: DB_EVENTS },
      "/api/google-calendar": GOOGLE_OK(GOOGLE_EVENTS),
      "/api/db/schedules": { items: schedules },
    });
    const { findByText, getByTestId, toJSON } = render(<CalendarPage now={NOW} />, { wrapper: wrap });
    await findByText("Piano lesson");
    const selected = within(getByTestId("cal-selected-events"));
    expect(selected.getByText("Beach day")).toBeTruthy();
    expect(selected.getByText("All day")).toBeTruthy();
    expect(selected.getByText("Family clean")).toBeTruthy();
    expect(selected.getByText("10:00 AM")).toBeTruthy();
    expect(selected.getByText("Soccer game")).toBeTruthy();
    expect(selected.getByText("3:00 PM")).toBeTruthy();
    expect(selected.getByText("5:30 PM")).toBeTruthy();
    expect(rowOrder({ toJSON })).toEqual(["g_g1", "s_s3", "g_g2", "db_e1"]);
  });

  it("google 502 partial keeps the server's surviving rows and admits the failure pill", async () => {
    route({
      "/api/db/events": { items: [DB_EVENTS[0]] },
      "/api/google-calendar": new ApiError({
        message: "calendar_partial_failure",
        status: 502,
        code: "http_502",
        retryable: true,
        body: {
          ok: false,
          partial: true,
          events: [{ google_id: "g9", summary: "Soccer game", start_iso: `${TODAY}T15:00:00`, all_day: false, calendar_id: "primary" }],
        },
      }),
      "/api/db/schedules": { items: [] },
    });
    const { findByTestId, findByText, getByText } = render(<CalendarPage now={NOW} />, { wrapper: wrap });
    expect(await findByTestId("calendar-google-pill")).toBeTruthy();
    expect(await findByText("Soccer game")).toBeTruthy();
    expect(getByText("3:00 PM")).toBeTruthy();
    expect(getByText("Piano lesson")).toBeTruthy();
    expect(getByText("Google Calendar couldn't load — family events may be incomplete.")).toBeTruthy();
  });

  it("google 200 {ok:false} (PB down) → honest pill, family rows stay", async () => {
    route({
      "/api/db/events": { items: [DB_EVENTS[0]] },
      "/api/google-calendar": { ok: false, events: [] },
      "/api/db/schedules": { items: [] },
    });
    const { findByTestId, findByText, getByText } = render(<CalendarPage now={NOW} />, { wrapper: wrap });
    expect(await findByTestId("calendar-google-pill")).toBeTruthy();
    expect(await findByText("Piano lesson")).toBeTruthy();
    expect(getByText(/Google Calendar couldn't load/)).toBeTruthy();
  });

  it("routines render only on the weekdays their days scope covers", async () => {
    fullRoute();
    const { getByTestId, findByText } = render(<CalendarPage now={NOW} />, { wrapper: wrap });
    await findByText("Piano lesson");
    // Friday: the "friday" token + the "weekdays" token both cover it.
    await act(async () => {
      fireEvent.press(getByTestId("cal-day-2026-10-09"));
      await Promise.resolve();
    });
    expect(within(getByTestId("cal-selected-events")).getByText("Trash day")).toBeTruthy();
    expect(within(getByTestId("cal-selected-events")).getByText("Wake up")).toBeTruthy();
    // Wednesday: legacy "wed" token + weekdays.
    await act(async () => {
      fireEvent.press(getByTestId("cal-day-2026-10-07"));
      await Promise.resolve();
    });
    expect(await findByText("Date night")).toBeTruthy();
    expect(within(getByTestId("cal-selected-events")).getByText("8:00 PM")).toBeTruthy();
    expect(within(getByTestId("cal-selected-events")).queryByText("Trash day")).toBeNull();
    // Sunday: neither "weekdays" nor "friday" nor "wed" covers it.
    await act(async () => {
      fireEvent.press(getByTestId("cal-day-2026-10-11"));
      await Promise.resolve();
    });
    expect(within(getByTestId("cal-selected-events")).queryByText("Wake up")).toBeNull();
    expect(within(getByTestId("cal-selected-events")).queryByText("Trash day")).toBeNull();
    expect(within(getByTestId("cal-selected-events")).queryByText("Date night")).toBeNull();
  });

  it("quiet days get the honest empty copy (today parity + generic day)", async () => {
    route({
      "/api/db/events": { items: [] },
      "/api/google-calendar": GOOGLE_OK([]),
      "/api/db/schedules": { items: [] },
    });
    const { findByText, getByText, getByTestId } = render(<CalendarPage now={NOW} />, { wrapper: wrap });
    expect(await findByText("Quiet day")).toBeTruthy();
    expect(getByText("No events are scheduled for today.")).toBeTruthy();
    await act(async () => {
      fireEvent.press(getByTestId("cal-day-2026-10-06"));
      await Promise.resolve();
    });
    expect(await findByText("No events are scheduled for this day.")).toBeTruthy();
  });

  it("shows the honest read-only note where the web has Add event", async () => {
    fullRoute();
    const { findByText } = render(<CalendarPage now={NOW} />, { wrapper: wrap });
    expect(
      await findByText("Adding events from the wall arrives with the next wave — ask a parent on the phone.")
    ).toBeTruthy();
  });
});

describe("CalendarPage — agenda view", () => {
  it("groups the next 7 days from today, omitting quiet days", async () => {
    fullRoute();
    const { findByText, getByText, queryByText, queryByTestId } = render(<CalendarPage now={NOW} />, { wrapper: wrap });
    await findByText("Piano lesson");
    await act(async () => {
      fireEvent.press(getByText("Agenda"));
      await Promise.resolve();
    });
    expect(await findByText("Today · Saturday, October 10")).toBeTruthy();
    expect(getByText("Tuesday, October 13")).toBeTruthy();
    expect(getByText("School conference")).toBeTruthy();
    // the week strip belongs to the Week tab only
    expect(queryByTestId("cal-day-2026-10-05")).toBeNull();
    // quiet days are omitted (noise, not information — web parity);
    // Sunday carries no fixture events nor routines → no heading.
    expect(queryByText("Sunday, October 11")).toBeNull();
    // routines extend the agenda past this week (weekdays "Wake up" covers Monday)
    expect(getByText("Monday, October 12")).toBeTruthy();
  });

  it("a fully quiet week gets the honest quiet-week copy", async () => {
    route({
      "/api/db/events": { items: [] },
      "/api/google-calendar": GOOGLE_OK([]),
      "/api/db/schedules": { items: [] },
    });
    const { findByText, getByText } = render(<CalendarPage now={NOW} />, { wrapper: wrap });
    await findByText("Quiet day");
    await act(async () => {
      fireEvent.press(getByText("Agenda"));
      await Promise.resolve();
    });
    expect(await findByText("Quiet week")).toBeTruthy();
    expect(getByText("Nothing scheduled in the next 7 days.")).toBeTruthy();
  });
});

describe("CalendarPage — states", () => {
  it("guest gate: honest PIN copy, no doomed fetches", async () => {
    mockMember = null;
    const { findByText } = render(<CalendarPage now={NOW} />, { wrapper: wrap });
    expect(await findByText("Sign in with your PIN to see the family's calendar.")).toBeTruthy();
    expect(api).not.toHaveBeenCalled();
  });

  it("stale badge when the sync layer reports staleness", async () => {
    fullRoute();
    mockStale = true;
    const { getByTestId, findByText } = render(<CalendarPage now={NOW} />, { wrapper: wrap });
    await findByText("Piano lesson");
    expect(getByTestId("calendar-stale")).toBeTruthy();
    expect(getByTestId("calendar-stale").props.children).toBe("Showing your saved copy — couldn't refresh.");
  });

  it("no stale badge when the last refresh succeeded", async () => {
    fullRoute();
    const { queryByTestId, findByText } = render(<CalendarPage now={NOW} />, { wrapper: wrap });
    await findByText("Piano lesson");
    expect(queryByTestId("calendar-stale")).toBeNull();
  });
});

describe("Calendar route", () => {
  it("app/calendar renders the page + the manifest dock with the Calendar cap active", async () => {
    fullRoute();
    const { getByTestId, findByTestId } = render(<CalendarRoute />, { wrapper: wrap });
    expect(getByTestId("calendar-route")).toBeTruthy();
    // The route renders the LOCAL-now week — never UTC (test ran across
    // 2026-10-11 midnight mid-session and proved UTC slices lie).
    const todayISO = localTodayISO(new Date());
    expect(await findByTestId(`cal-day-${todayISO}`)).toBeTruthy();
    expect(getByTestId("dock-calendar")).toBeTruthy();
    expect(getByTestId("dock-calendar").props.accessibilityState?.selected).toBe(true);
  });
});

describe("events-merge — ported schedule math", () => {
  it("scheduleTimeMinutes parses 12-hour and 24-hour routine times (web schedule-time.ts port)", () => {
    expect(scheduleTimeMinutes("07:30")).toBe(450);
    expect(scheduleTimeMinutes("8:00 AM")).toBe(480);
    expect(scheduleTimeMinutes("9:15 PM")).toBe(1275);
    expect(scheduleTimeMinutes("12:00 PM")).toBe(720);
    expect(scheduleTimeMinutes("12:30 AM")).toBe(30);
    expect(scheduleTimeMinutes("")).toBeNull();
    expect(scheduleTimeMinutes("bogus")).toBeNull();
  });
});

describe("CalendarPage — Google not-connected honesty (the web's fixed bug, twice-removed)", () => {
  it("200 {ok:true, connected:false} → the not-connected pill, never a silent empty", async () => {
    route({
      "/api/db/events": { items: DB_EVENTS },
      // The EXACT server shape for "no Google integration" (route.ts:16-23):
      "/api/google-calendar": { ok: true, connected: false, source: "none", events: [] },
      "/api/db/schedules": { items: SCHEDULES },
    });
    const { findByText, queryByText } = render(<CalendarPage now={NOW} />, { wrapper: wrap });
    expect(await findByText("Google Calendar isn't connected.")).toBeTruthy();
    // db events still show; the pill explains the google silence
    expect(await findByText("Piano lesson")).toBeTruthy();
    expect(queryByText(/couldn't load/i)).toBeNull();
  });
});

describe("CalendarPage — month-boundary week", () => {
  it("a week spanning two months renders November chips (strip rollover math)", async () => {
    fullRoute();
    // Thursday 2026-10-29 — the Mon-start week runs Oct 26 → Nov 1
    const EDGE = new Date(2026, 9, 29, 9, 0);
    const { findByTestId, getByTestId } = render(<CalendarPage now={EDGE} />, { wrapper: wrap });
    await findByTestId("cal-day-2026-10-26"); // strip settled
    expect(getByTestId("cal-day-2026-10-31")).toBeTruthy();
    expect(getByTestId("cal-day-2026-11-01")).toBeTruthy(); // rollover chip
  });
});

describe("CalendarPage — parent event creation", () => {
  it("opens the composer only for a parent", async () => {
    fullRoute();
    const { findByText, getByTestId } = render(<CalendarPage now={NOW} />, { wrapper: wrap });
    await findByText("Piano lesson");
    expect(getByTestId("add-event")).toBeTruthy();

    mockMember = { id: "c1", name: "Aurora", role: "child", emoji: "🧒", color: "violet" };
    const child = render(<CalendarPage now={NOW} />, { wrapper: wrap });
    expect(await child.findByText("Ask a parent to add or change events.")).toBeTruthy();
    expect(child.queryByTestId("add-event")).toBeNull();
  });

  it("saves through the parent route and shows the pending banner", async () => {
    route({
      "/api/db/events": { items: DB_EVENTS },
      "/api/google-calendar": GOOGLE_OK([]),
      "/api/db/schedules": { items: SCHEDULES },
      "/api/calendar/events": {
        ok: true,
        event: {
          id: "e_new", title: "Recital", date: TODAY, time: "12:00", endTime: "13:00",
          allDay: false, member: "All", source: "family", googleSyncStatus: "pending",
        },
        google: { status: "pending" },
      },
    });

    const { findByText, getByTestId, getByLabelText, queryByTestId } = render(
      <CalendarPage now={NOW} />,
      { wrapper: wrap },
    );
    await findByText("Piano lesson");
    fireEvent.press(getByTestId("add-event"));
    fireEvent.changeText(getByLabelText("Event title"), "Recital");
    fireEvent.press(getByTestId("composer-save"));
    await act(async () => { await Promise.resolve(); });

    expect(api).toHaveBeenCalledWith("/api/calendar/events", expect.objectContaining({
      method: "POST",
      body: expect.objectContaining({ title: "Recital", date: TODAY }),
    }));
    expect(await findByText("Saved here — Google not updated. Retry when Google is connected.")).toBeTruthy();
    expect(queryByTestId("event-composer")).toBeNull();
  });

  it("retries a pending mirror from the banner", async () => {
    route({
      "/api/db/events": { items: DB_EVENTS },
      "/api/google-calendar": GOOGLE_OK([]),
      "/api/db/schedules": { items: SCHEDULES },
      "/api/calendar/events": {
        ok: true,
        event: {
          id: "e_new", title: "Recital", date: TODAY, time: "12:00", endTime: "13:00",
          allDay: false, member: "All", source: "family", googleSyncStatus: "pending",
        },
        google: { status: "pending" },
      },
      "/api/calendar/events/e_new/retry-google": {
        ok: true,
        event: {
          id: "e_new", title: "Recital", date: TODAY, time: "12:00", endTime: "13:00",
          allDay: false, member: "All", source: "family", googleSyncStatus: "synced",
        },
        google: { status: "synced" },
      },
    });

    const { findByText, getByTestId, getByLabelText, getByText, queryByText } = render(
      <CalendarPage now={NOW} />,
      { wrapper: wrap },
    );
    await findByText("Piano lesson");
    fireEvent.press(getByTestId("add-event"));
    fireEvent.changeText(getByLabelText("Event title"), "Recital");
    fireEvent.press(getByTestId("composer-save"));
    await act(async () => { await Promise.resolve(); });
    fireEvent.press(getByText("Retry"));
    await act(async () => { await Promise.resolve(); });

    expect(api).toHaveBeenCalledWith(
      "/api/calendar/events/e_new/retry-google",
      expect.objectContaining({ method: "POST" }),
    );
    expect(queryByText("Saved here — Google not updated. Retry when Google is connected.")).toBeNull();
  });

  it("keeps the composer open and shows safe copy when the save fails", async () => {
    route({
      "/api/db/events": { items: DB_EVENTS },
      "/api/google-calendar": GOOGLE_OK([]),
      "/api/db/schedules": { items: SCHEDULES },
      "/api/calendar/events": new ApiError({
        message: "PocketBase down",
        status: 503,
        code: "http_503",
      }),
    });

    const { findByText, getByTestId, getByLabelText } = render(
      <CalendarPage now={NOW} />,
      { wrapper: wrap },
    );
    await findByText("Piano lesson");
    fireEvent.press(getByTestId("add-event"));
    fireEvent.changeText(getByLabelText("Event title"), "Recital");
    fireEvent.press(getByTestId("composer-save"));
    await act(async () => { await Promise.resolve(); });

    expect(getByTestId("event-composer")).toBeTruthy();
    expect(getByLabelText("Event title")).toBeTruthy();
    expect(getByTestId("composer-error")).toBeTruthy();
  });
});
