/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { Text } from "react-native";
import { act, fireEvent, render } from "@testing-library/react-native";

import { ThemeProvider } from "../src/theme/ThemeProvider";
import { TasksWidget } from "../src/home/widgets/TasksWidget";
import { TodayEventsWidget } from "../src/home/widgets/TodayEventsWidget";
import { CurrentMealWidget } from "../src/home/widgets/CurrentMealWidget";
import { BriefingWidget } from "../src/home/widgets/BriefingWidget";
import { localTodayISO, useWidgetData } from "../src/home/widgets/data";
import { WidgetFrame } from "../src/home/widgets/WidgetFrame";

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
  useAuth: () => ({ member: mockMember, role: mockMember ? mockMember.role : null, hydrated: true, signOut: jest.fn(), poke: jest.fn() }),
}));

let mockStale = false;
let mockSnapshot: any = null;
let mockSyncError: "unreachable" | "unauthorized" | "server" | null = null;
const mockRefreshNow = jest.fn(async () => {});
const mockPulseListeners = new Set<() => void>();
// Stable value object — mirrors SyncManager's useMemo so effect deps settle.
const mockSyncValue = {
  get stale() {
    return mockStale;
  },
  get syncError() {
    return mockSyncError;
  },
  get snapshot() {
    return mockSnapshot;
  },
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
  mockSnapshot = null;
  mockSyncError = null;
  api.mockReset();
});

describe("TasksWidget (shared snapshot — no widget fetch)", () => {
  const syncSnapshot = (tasks: any[]) => ({ tasks });

  it("shows a loading skeleton until the shared snapshot lands", () => {
    const { getByTestId } = render(<TasksWidget />, { wrapper: wrap });
    expect(getByTestId("tasks-loading")).toBeTruthy();
  });

  it("renders pending count + rows, and marks pendingApproval honestly", async () => {
    mockSnapshot = syncSnapshot([
      { id: 1, title: "Make bed", assignee: "Aurora", due: "Today", points: 5, completed: false, assigneeEmoji: "👧" },
      { id: 2, title: "Dishes", assignee: "Alex", due: "", points: 10, completed: true, assigneeEmoji: "👦", pendingApproval: { byName: "Alex", at: "2026-10-10T10:00:00Z", points: 10 } },
      { id: 3, title: "Old done task", assignee: "", due: "", points: 5, completed: true, assigneeEmoji: "👤" },
    ]);
    const { findByText, getByText, queryByText } = render(<TasksWidget />, { wrapper: wrap });
    // Web parity: pending = OPEN rows only; a landed kid tap moves to the
    // approvals queue (footer count), never the pending total or the list.
    await findByText("1 pending for the family");
    expect(queryByText("Waiting for approval")).toBeNull();
    expect(getByText("1 needs approval →")).toBeTruthy(); // parent footer — now a link
    expect(queryByText("Old done task")).toBeNull();
    expect(api).not.toHaveBeenCalled(); // reads the SHARED snapshot, no fetch
  });

  it("renders the reference empty state", async () => {
    mockSnapshot = syncSnapshot([]);
    const { findByText } = render(<TasksWidget />, { wrapper: wrap });
    await findByText("All caught up");
    expect(await findByText("No pending tasks right now.")).toBeTruthy();
    expect(await findByText("0 pending for the family")).toBeTruthy();
  });

  it("sync down, no snapshot → honest offline copy; retry re-pulls via refreshNow", async () => {
    mockSyncError = "unreachable";
    const { findByText, getByText } = render(<TasksWidget />, { wrapper: wrap });
    await findByText(/Offline — no saved copy on this device/);
    await act(async () => {
      fireEvent.press(getByText("Try again"));
      await Promise.resolve();
    });
    expect(mockRefreshNow).toHaveBeenCalled();
  });

  it("syncError 'server' (the NAS answered and failed) reads as an error, never offline", async () => {
    mockSyncError = "server"; // U5.1: a 502 is not the family's internet
    const { findByText, queryByText } = render(<TasksWidget />, { wrapper: wrap });
    expect(await findByText(/Couldn't load this right now/)).toBeTruthy();
    expect(queryByText(/Offline/)).toBeNull();
  });

  it("guest gate: PIN copy, zero doomed fetches (the server requires a session)", async () => {
    mockMember = null;
    const { findByText } = render(<TasksWidget />, { wrapper: wrap });
    await findByText(/Sign in with your PIN to see the family's data/);
    expect(api).not.toHaveBeenCalled(); // reads the shared snapshot — never its own fetch
  });

  it("badges staleness when the sync layer reports a failed refresh", async () => {
    mockSnapshot = syncSnapshot([]);
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

  it("502 partial keeps the server's surviving Google rows (body on ApiError)", async () => {
    route({
      "/api/db/events": { items: [] },
      "/api/google-calendar": new ApiError({
        message: "calendar_partial_failure",
        status: 502,
        code: "http_502",
        retryable: true,
        body: {
          ok: false,
          partial: true,
          stale: true,
          error: "calendar_partial_failure",
          events: [{ google_id: "g9", summary: "Soccer game", start_iso: `${today}T15:00:00`, all_day: false, calendar_id: "primary" }],
        },
      }),
    });
    const { findByText, getByText, queryByText } = render(<TodayEventsWidget />, { wrapper: wrap });
    // the partial row still renders…
    expect(await findByText("Soccer game")).toBeTruthy();
    expect(getByText("3:00 PM")).toBeTruthy();
    // …the failure pill admits the partial honestly…
    expect(getByText(/couldn't load/i)).toBeTruthy();
    // …and the count includes the surviving row
    expect(getByText("1 event on the family calendar")).toBeTruthy();
    expect(queryByText("0 events")).toBeNull();
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

  it("collapsed by default (web model): teaser + item count, rows behind the badge", async () => {
    route({
      "/api/consuela/briefing": briefingBody({
        events: [{ icon: "📅", title: "Piano", time: "5:30 PM" }],
        tasks: [{ title: "Dishes", assignee: "Aurora" }],
        meals: [],
        suggestions: [],
      }),
    });
    const { findByText, getByTestId, queryByText } = render(<BriefingWidget />, { wrapper: wrap });
    await findByText("Morning Briefing");
    expect(await findByText("2 items")).toBeTruthy();
    expect(queryByText("Piano")).toBeNull(); // collapsed — no rows yet
    expect(await findByText("Tap the badge above to see today's plan.")).toBeTruthy();
    expect(api).toHaveBeenCalledWith(expect.stringContaining("/api/consuela/briefing?scopeDate="));
    // the badge opens the plan (web expand parity)
    fireEvent.press(getByTestId("briefing-toggle"));
    expect(await findByText("Piano")).toBeTruthy();
    expect(await findByText("Dishes")).toBeTruthy();
    // …and collapses again
    fireEvent.press(getByTestId("briefing-toggle"));
    expect(queryByText("Piano")).toBeNull();
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
    await findByText(/Sign in with your PIN to see the family's data/);
    expect(api).not.toHaveBeenCalled();
  });
});

describe("TodayEventsWidget — Google not-connected honesty (Wave-2 critic fix)", () => {
  it("200 {ok:true, connected:false} → the connected pill, never a silent empty", async () => {
    route({
      "/api/db/events": { items: [] },
      // The EXACT server shape for "no Google integration" (route.ts:16-23):
      "/api/google-calendar": { ok: true, connected: false, source: "none", events: [] },
    });
    const { findByText } = render(<TodayEventsWidget />, { wrapper: wrap });
    expect(await findByText("Google Calendar isn't connected.")).toBeTruthy();
    expect(await findByText("0 events on the family calendar")).toBeTruthy();
  });
});

/** Minimal WidgetFrame + useWidgetData consumer — the read contract probe (U5.4/5/9). */
function Probe({ load }: { load: () => Promise<unknown> }) {
  const { status, data, failure, stale, retry } = useWidgetData<unknown>(load);
  return (
    <WidgetFrame
      id="probe"
      icon="🧪"
      title="Probe"
      description="Read contract probe"
      status={status}
      failure={failure}
      hasData={data !== null}
      stale={stale}
      onRetry={retry}
    >
      <Text testID="probe-body">body</Text>
    </WidgetFrame>
  );
}

describe("useWidgetData read contract (U5.4/U5.5/U5.9)", () => {
  it("exactly ONE fetch on mount — the initial sync pulse racing the first read does not double-fetch", async () => {
    let settle: (v: unknown) => void = () => {};
    api.mockImplementation(() => new Promise((r) => { settle = r; }));
    const { findByText, getByTestId } = render(<Probe load={() => api("/api/probe")} />, { wrapper: wrap });
    expect(api).toHaveBeenCalledTimes(1); // the mount fetch
    expect(getByTestId("probe-loading")).toBeTruthy();

    // The initial SyncManager pulse lands while the mount read is in flight:
    // it must NOT fire a second (racing) fetch — pulses only trigger SUBSEQUENT runs.
    await act(async () => {
      mockPulseListeners.forEach((l) => l());
      await Promise.resolve();
    });
    expect(api).toHaveBeenCalledTimes(1);

    await act(async () => {
      settle({ ok: true });
      await Promise.resolve();
    });
    expect(await findByText("body")).toBeTruthy();

    // …and a later pulse does trigger a subsequent run.
    await act(async () => {
      mockPulseListeners.forEach((l) => l());
      await Promise.resolve();
    });
    expect(api).toHaveBeenCalledTimes(2);
  });

  it("an unmounted read never setStates — the awaited continuation is cancelled", async () => {
    let resolveLoad: (v: unknown) => void = () => {};
    const load = () => new Promise((r) => { resolveLoad = r; });

    // Observer: wrap every useState setter and count calls after `flagged`
    // flips — React 19 swallows post-unmount setState silently, so the guard
    // is only provable with an instrumented setter.
    let flagged = false;
    let postUnmountSetState = 0;
    const orig = React.useState;
    const spy = jest.spyOn(React, "useState").mockImplementation((init?: unknown) => {
      const [s, set] = (orig as any)(init);
      const wrapped = (...args: unknown[]) => {
        if (flagged) postUnmountSetState++;
        return (set as any)(...args);
      };
      return [s, wrapped] as any;
    });

    let capturedForce: React.Dispatch<React.SetStateAction<number>> | null = null;
    function SetterProbe() {
      const [, force] = React.useState(0);
      React.useEffect(() => {
        capturedForce = force;
      }, [force]);
      return null;
    }

    try {
      const { unmount } = render(
        <>
          <SetterProbe />
          <Probe load={load} />
        </>,
        { wrapper: wrap }
      );
      expect(api).not.toHaveBeenCalled(); // probe uses its own load

      // Control: prove the observer catches a setState while flagged — the
      // test can never pass vacuously if the spy stops intercepting.
      flagged = true;
      await act(async () => {
        capturedForce?.(1);
        await Promise.resolve();
      });
      expect(postUnmountSetState).toBe(1);
      postUnmountSetState = 0;

      unmount();
      await act(async () => {
        resolveLoad({ ok: true });
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(postUnmountSetState).toBe(0); // no setData/setStatus/setFailure after unmount
      flagged = false;
    } finally {
      spy.mockRestore();
    }
  });

  it("sync-layer stale does not leak into a widget's own-fresh read (scoped staleness)", async () => {
    route({ "/api/probe": { ok: true } });
    mockStale = true; // the tasks sync layer is down…
    const { findByTestId, queryByTestId } = render(<Probe load={() => api("/api/probe")} />, { wrapper: wrap });
    expect(await findByTestId("probe-body")).toBeTruthy();
    // …but THIS widget's own read path succeeded: its data is fresh, so it must
    // not wear the global "saved copy" badge (public widgets ride own-fetch truth).
    expect(queryByTestId("probe-stale")).toBeNull();
  });

  it("a failed refresh that kept last-good data DOES badge (widget-local staleness)", async () => {
    route({ "/api/probe": { ok: true } });
    const { findByTestId, getByTestId } = render(<Probe load={() => api("/api/probe")} />, { wrapper: wrap });
    expect(await findByTestId("probe-body")).toBeTruthy();

    route({
      "/api/probe": new ApiError({ message: "upstream 502", status: 502, code: "http_502", retryable: true }),
    });
    await act(async () => {
      mockPulseListeners.forEach((l) => l());
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(getByTestId("probe-body")).toBeTruthy(); // last-good stays on screen…
    expect(getByTestId("probe-stale")).toBeTruthy(); // …badged, never silently faked
  });
});
