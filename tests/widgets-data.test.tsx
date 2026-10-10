/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";

import { ThemeProvider } from "../src/theme/ThemeProvider";
import { TasksWidget } from "../src/home/widgets/TasksWidget";
import { TodayEventsWidget } from "../src/home/widgets/TodayEventsWidget";
import { CurrentMealWidget } from "../src/home/widgets/CurrentMealWidget";
import { BriefingWidget } from "../src/home/widgets/BriefingWidget";
import { localTodayISO } from "../src/home/widgets/data";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

let mockMember: any = { id: "p1", name: "Rebecca (Mom)", role: "parent", emoji: "🐱", color: "green" };
jest.mock("../src/state/AuthProvider", () => ({
  useAuth: () => ({ member: mockMember, hydrated: true, signOut: jest.fn(), poke: jest.fn() }),
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

const parent = { id: "p1", name: "Rebecca (Mom)", role: "parent", emoji: "🐱", color: "green" };

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

beforeEach(() => {
  jest.clearAllMocks();
  mockPulseListeners.clear();
  mockMember = parent;
  mockStale = false;
  api.mockReset();
});

describe("TasksWidget", () => {
  const syncBody = (tasks: any[]) => ({ ok: true, reconciled: true, snapshot: { tasks } });

  it("shows a loading skeleton while the first read is in flight", () => {
    api.mockReturnValue(new Promise(() => {}));
    const { getByTestId } = render(<TasksWidget />, { wrapper: wrap });
    expect(getByTestId("tasks-loading")).toBeTruthy();
  });

  it("renders pending count + rows, and marks pendingApproval honestly", async () => {
    route({
      "/api/tasks/sync": syncBody([
        { id: 1, title: "Make bed", assignee: "Aurora", due: "Today", points: 5, completed: false, assigneeEmoji: "👧" },
        { id: 2, title: "Dishes", assignee: "Alex", due: "", points: 10, completed: false, assigneeEmoji: "👦", pendingApproval: { byName: "Alex", at: "2026-10-10T10:00:00Z", points: 10 } },
        { id: 3, title: "Old done task", assignee: "", due: "", points: 5, completed: true, assigneeEmoji: "👤" },
      ]),
    });
    const { findByText, getByText, queryByText } = render(<TasksWidget />, { wrapper: wrap });
    await findByText("2 pending for the family");
    expect(getByText(/Waiting for approval/)).toBeTruthy(); // kid row is honest
    expect(queryByText(/\+10 pts/)).toBeNull(); // points NOT promised for a pending tap
    expect(getByText("1 needs approval")).toBeTruthy(); // parent footer
    expect(queryByText("Old done task")).toBeNull();
  });

  it("renders the reference empty state", async () => {
    route({ "/api/tasks/sync": syncBody([]) });
    const { findByText } = render(<TasksWidget />, { wrapper: wrap });
    await findByText("All caught up");
    expect(await findByText("No pending tasks right now.")).toBeTruthy();
    expect(await findByText("0 pending for the family")).toBeTruthy();
  });

  it("renders calm error copy and retry re-pulls via refreshNow", async () => {
    route({ "/api/tasks/sync": new ApiError({ message: "db_error", status: 502, code: "db_error", retryable: true }) });
    const { findByText, getByText } = render(<TasksWidget />, { wrapper: wrap });
    await findByText("Couldn't load this right now.");
    await act(async () => {
      fireEvent.press(getByText("Try again"));
      await Promise.resolve();
    });
    expect(mockRefreshNow).toHaveBeenCalled();
    expect(api.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("guest gate: no fetch, PIN copy", async () => {
    mockMember = null;
    const { findByText } = render(<TasksWidget />, { wrapper: wrap });
    await findByText("Sign in with your PIN to see the family's data.");
    expect(api).not.toHaveBeenCalled();
  });

  it("re-reads on a sync pulse", async () => {
    route({ "/api/tasks/sync": syncBody([]) });
    const { findByText } = render(<TasksWidget />, { wrapper: wrap });
    await findByText("All caught up");
    expect(api).toHaveBeenCalledTimes(1);
    await act(async () => {
      mockPulseListeners.forEach((l) => l());
      await Promise.resolve();
    });
    expect(api).toHaveBeenCalledTimes(2);
  });

  it("badges staleness when the sync layer reports a failed refresh", async () => {
    route({ "/api/tasks/sync": syncBody([]) });
    mockStale = true;
    const { findByText, getByText } = render(<TasksWidget />, { wrapper: wrap });
    await findByText("All caught up");
    expect(getByText(/saved copy/i)).toBeTruthy();
  });
});

describe("TodayEventsWidget", () => {
  const today = localTodayISO();

  it("merges family + Google rows with the all-day-first treatment", async () => {
    route({
      "/api/db/events": { items: [{ id: "e1", title: "Piano lesson", date: today, time: "17:30", member: "Aurora", icon: "🎹" }] },
      "/api/google-calendar": {
        ok: true,
        connected: true,
        events: [{ google_id: "g1", summary: "Beach day", start_iso: today, all_day: true, calendar_id: "primary" }],
        calendar_colors: null,
      },
    });
    const { findByText } = render(<TodayEventsWidget />, { wrapper: wrap });
    await findByText("2 events on the family calendar");
    expect(await findByText("Piano lesson")).toBeTruthy();
    expect(await findByText("5:30 PM")).toBeTruthy();
    expect(await findByText("Beach day")).toBeTruthy();
    expect(await findByText("All day")).toBeTruthy();
  });

  it("empty day copy matches the reference", async () => {
    route({
      "/api/db/events": { items: [] },
      "/api/google-calendar": { ok: true, connected: true, events: [], calendar_colors: null },
    });
    const { findByText } = render(<TodayEventsWidget />, { wrapper: wrap });
    await findByText("0 events on the family calendar");
    expect(await findByText("Quiet day")).toBeTruthy();
    expect(await findByText("No events are scheduled for today.")).toBeTruthy();
  });

  it("admits a Google failure while family events still show", async () => {
    route({
      "/api/db/events": { items: [{ id: "e1", title: "Piano lesson", date: today, time: "17:30", member: "Aurora", icon: "🎹" }] },
      "/api/google-calendar": new ApiError({ message: "google upstream 502", status: 502, code: "http_502", retryable: true }),
    });
    const { findByText, getByText } = render(<TodayEventsWidget />, { wrapper: wrap });
    await findByText("Piano lesson");
    expect(getByText(/Google Calendar/)).toBeTruthy();
    expect(getByText(/couldn't load/i)).toBeTruthy();
  });
});

describe("CurrentMealWidget", () => {
  // Saturday 2026-10-10 18:00 local — dinner territory; weekOf Monday 2026-10-05.
  const now = new Date(2026, 9, 10, 18, 0);
  const schedules = {
    items: [
      { id: "s1", title: "Lunch", time: "12:00", mealType: "lunch" },
      { id: "s2", title: "Dinner", time: "17:30", mealType: "dinner" },
    ],
  };

  it("shows today's planned meal for the active slot", async () => {
    route({
      "/api/db/schedules": schedules,
      "/api/db/meal_plan_entries": {
        items: [{ id: "m1", name: "Taco night", emoji: "🌮", time: "Sat", mealType: "dinner", tags: ["beef", "family favorite"], weekOf: "2026-10-05" }],
      },
    });
    const { findByText } = render(<CurrentMealWidget now={now} />, { wrapper: wrap });
    await findByText(/Dinner Time/);
    expect(await findByText("Taco night")).toBeTruthy();
    expect(await findByText("beef")).toBeTruthy();
  });

  it("no plan for the slot → honest empty copy", async () => {
    route({ "/api/db/schedules": schedules, "/api/db/meal_plan_entries": { items: [] } });
    const { findByText } = render(<CurrentMealWidget now={now} />, { wrapper: wrap });
    await findByText("No meal planned yet");
    expect(await findByText("Plan dinner in the Kitchen tab")).toBeTruthy();
  });
});

describe("BriefingWidget", () => {
  const briefingBody = (summary: any, acknowledged = false) => ({
    ok: true,
    briefing: { id: "b1", scopeDate: localTodayISO(), acknowledged, summary },
  });

  it("renders briefing sections from the verified shape", async () => {
    route({
      "/api/consuela/briefing": briefingBody({
        events: [{ icon: "📅", title: "Piano", time: "5:30 PM" }],
        tasks: [{ title: "Dishes", assignee: "Aurora" }],
        meals: [],
        suggestions: [],
      }),
    });
    const { findByText } = render(<BriefingWidget />, { wrapper: wrap });
    await findByText("Morning Briefing");
    expect(await findByText("2 items")).toBeTruthy();
    expect(await findByText("Piano")).toBeTruthy();
    expect(await findByText("Dishes")).toBeTruthy();
    expect(api).toHaveBeenCalledWith(expect.stringContaining("/api/consuela/briefing?scopeDate="));
  });

  it("acknowledged briefing → seen-today card", async () => {
    route({
      "/api/consuela/briefing": briefingBody({ events: [], tasks: [], meals: [], suggestions: [] }, true),
    });
    const { findByText } = render(<BriefingWidget />, { wrapper: wrap });
    await findByText("Seen for today — Consuela will refresh it tomorrow");
    expect(await findByText("Acknowledged ✓")).toBeTruthy();
  });

  it("briefing exists with empty sections → honest nothing-lined-up state", async () => {
    route({
      "/api/consuela/briefing": briefingBody({ events: [], tasks: [], meals: [], suggestions: [] }),
    });
    const { findByText } = render(<BriefingWidget />, { wrapper: wrap });
    await findByText("Nothing lined up for today yet.");
  });

  it("guest gate: no fetch, PIN copy", async () => {
    mockMember = null;
    const { findByText } = render(<BriefingWidget />, { wrapper: wrap });
    await findByText("Sign in with your PIN to see the family's data.");
    expect(api).not.toHaveBeenCalled();
  });
});
