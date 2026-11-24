/* eslint-disable @typescript-eslint/no-require-imports, import/first -- jest.mock factories */
import React from "react";
import { StyleSheet } from "react-native";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockRouter = { push: mockPush, replace: mockReplace };
jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  usePathname: () => "/",
}));

let mockMember: { id: string; name: string; role: string; emoji: string; color?: string } | null = null;
let mockRole: "parent" | "child" | "pet" | null = null;
let mockPinRequired = false;
const mockSignOut = jest.fn();
const mockPoke = jest.fn();
const mockPinFn = () => mockPinRequired;
jest.mock("../src/state/AuthProvider", () => ({
  pinRequiredFor: () => mockPinRequired,
  useAuth: () => ({
    member: mockMember,
    role: mockRole,
    sessionVerified: mockRole !== null,
    hydrated: true,
    pinRequiredFor: mockPinFn,
    signOut: mockSignOut,
    poke: mockPoke,
  }),
}));

let mockSnapshot: any = null;
const mockRefreshNow = jest.fn(async () => {});
const stableOnPulse = () => () => {};
const mockSyncValue = {
  stale: false,
  syncError: null,
  get snapshot() {
    return mockSnapshot;
  },
  lastSyncAt: 1,
  refreshNow: mockRefreshNow,
  onPulse: stableOnPulse,
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

jest.mock("../src/native/voiceCallouts", () => ({
  playNotificationAudio: jest.fn(async () => {}),
}));

import { ThemeProvider } from "../src/theme/ThemeProvider";
import { ToastProvider } from "../src/ui/Toast";
import { TodayEventsWidget } from "../src/home/widgets/TodayEventsWidget";
import { TasksWidget } from "../src/home/widgets/TasksWidget";
import { ScheduleWidget } from "../src/home/widgets/ScheduleWidget";
import { CurrentMealWidget } from "../src/home/widgets/CurrentMealWidget";
import { LeaderboardWidget } from "../src/home/widgets/LeaderboardWidget";
import { HomeClimateWidget } from "../src/home/widgets/HomeClimateWidget";
import { HomeLightsWidget } from "../src/home/widgets/HomeLightsWidget";
import { _resetHAStore } from "../src/home/widgets/ha-state";
import { clearWidgetMemoryCache, localTodayISO, weekStartMondayISO } from "../src/home/widgets/data";

const wrap = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>
    <ToastProvider>{children}</ToastProvider>
  </ThemeProvider>
);

const today = localTodayISO();
const parent = { id: "p1", name: "Rebecca (Mom)", role: "parent", emoji: "🐱", color: "green" };
const aurora = { id: "c1", name: "Aurora", role: "child", emoji: "🧚", color: "violet" };

const route = (handlers: Record<string, unknown>) =>
  api.mockImplementation((path: string, opts?: { method?: string; body?: unknown }) => {
    for (const key of Object.keys(handlers)) {
      if (path.startsWith(key)) {
        const v = handlers[key];
        if (typeof v === "function") return Promise.resolve((v as (p: string, o?: unknown) => unknown)(path, opts));
        return v instanceof Error ? Promise.reject(v) : Promise.resolve(v);
      }
    }
    return Promise.reject(new ApiError({ message: "unmapped path", status: 404, code: "not_found" }));
  });

beforeEach(() => {
  jest.clearAllMocks();
  clearWidgetMemoryCache();
  _resetHAStore();
  mockMember = parent;
  mockRole = "parent";
  mockPinRequired = false;
  mockSnapshot = null;
  api.mockReset();
});

describe("TodayEventsWidget interactions", () => {
  it("header, event rows, and empty state all navigate to /calendar", async () => {
    route({
      "/api/db/events": { items: [{ id: "e1", title: "Piano lesson", date: today, time: "17:30", member: "Aurora", icon: "🎹" }] },
      "/api/google-calendar": { ok: true, connected: true, events: [], calendar_colors: null },
    });
    const filled = render(<TodayEventsWidget />, { wrapper: wrap });
    await filled.findByText("Piano lesson");

    fireEvent.press(filled.getByTestId("todayEvents-header-press"));
    expect(mockPush).toHaveBeenCalledWith("/calendar");

    mockPush.mockClear();
    fireEvent.press(filled.getByTestId("todayEvents-row-db_e1"));
    expect(mockPush).toHaveBeenCalledWith("/calendar");
    filled.unmount();

    clearWidgetMemoryCache();
    mockPush.mockClear();
    route({
      "/api/db/events": { items: [] },
      "/api/google-calendar": { ok: true, connected: true, events: [], calendar_colors: null },
    });
    const empty = render(<TodayEventsWidget />, { wrapper: wrap });
    await empty.findByText("Quiet day");
    fireEvent.press(empty.getByTestId("todayEvents-empty-open"));
    expect(mockPush).toHaveBeenCalledWith("/calendar");
  });
});

describe("TasksWidget interactions and quick-complete gates", () => {
  it("header, guest row, signed-in row, and empty state navigate to /tasks", async () => {
    mockMember = null;
    mockRole = null;
    route({
      "/api/tasks/family": {
        ok: true,
        chores: [{ id: 1, title: "Dishes", assignee: "Aurora", done: false }],
      },
    });
    const guestView = render(<TasksWidget />, { wrapper: wrap });
    await guestView.findByText("Dishes");

    fireEvent.press(guestView.getByTestId("tasks-header-press"));
    expect(mockPush).toHaveBeenCalledWith("/tasks");
    mockPush.mockClear();

    fireEvent.press(guestView.getByTestId("tasks-chore-1"));
    expect(mockPush).toHaveBeenCalledWith("/tasks");
    guestView.unmount();

    mockPush.mockClear();
    mockMember = parent;
    mockRole = "parent";
    mockPinRequired = true;
    mockSnapshot = {
      tasks: [{ id: 1, title: "Dishes", assignee: "Aurora", due: "Today", points: 10, completed: false }],
    };
    const signedIn = render(<TasksWidget />, { wrapper: wrap });
    await signedIn.findByText("Dishes");
    fireEvent.press(signedIn.getByTestId("tasks-row-1"));
    expect(mockPush).toHaveBeenCalledWith("/tasks");
    signedIn.unmount();

    mockPush.mockClear();
    mockSnapshot = { tasks: [] };
    const empty = render(<TasksWidget />, { wrapper: wrap });
    await empty.findByText("All caught up");
    fireEvent.press(empty.getByTestId("tasks-empty-open"));
    expect(mockPush).toHaveBeenCalledWith("/tasks");
  });

  it("lets a signed-in non-PIN kid quick-complete their own chore without navigating", async () => {
    mockMember = aurora;
    mockRole = "child";
    mockPinRequired = false;
    mockSnapshot = {
      tasks: [
        { id: 1, title: "Make bed", assignee: "Aurora", due: "Today", points: 10, completed: false },
        { id: 2, title: "Clean room", assignee: "Caspian", due: "Today", points: 10, completed: false },
        { id: 3, title: "Take out trash", assignee: "Open", due: "Today", points: 15, completed: false },
      ],
    };
    route({
      "/api/tasks/claim": { success: true, reconciled: true },
    });

    const { getByTestId, queryByTestId, findByText } = render(
      <TasksWidget
        span={2}
        members={[
          { name: "Aurora", emoji: "data:image/png;base64,iVBORw0KGgo=" },
          { name: "Caspian", emoji: "🦕" },
        ]}
      />,
      { wrapper: wrap }
    );
    const checkBtn = getByTestId("tasks-quick-check-1");
    expect(checkBtn).toBeTruthy();
    expect(StyleSheet.flatten(checkBtn.props.style).width).toBe(36);
    expect(checkBtn.props.hitSlop).toBe(14); // 36 + 14*2 = 64dp floor
    expect(queryByTestId("tasks-quick-check-2")).toBeNull();
    expect(queryByTestId("tasks-quick-check-3")).toBeNull();
    // Other assignees render roster-first avatars rather than quick-check
    expect(getByTestId("tasks-avatar-2")).toBeTruthy();
    expect(getByTestId("tasks-avatar-3")).toBeTruthy();

    await act(async () => {
      fireEvent.press(checkBtn);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(api).toHaveBeenCalledWith(
      "/api/tasks/claim",
      expect.objectContaining({
        method: "POST",
        body: expect.objectContaining({ action: "complete", taskId: 1 }),
      })
    );
    expect(mockRefreshNow).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
    expect(await findByText("Marked done!")).toBeTruthy();
  });

  it("never renders quick-check for guest, PIN-protected parent, or cached profile without live role", async () => {
    // 1. PIN-protected parent
    mockMember = parent;
    mockRole = "parent";
    mockPinRequired = true;
    mockSnapshot = {
      tasks: [{ id: 1, title: "Parent task", assignee: "Rebecca", due: "Today", points: 10, completed: false }],
    };
    const parentView = render(<TasksWidget />, { wrapper: wrap });
    expect(parentView.queryByTestId("tasks-quick-check-1")).toBeNull();
    parentView.unmount();

    // 2. Cached profile (member set, live role null) -> guest lane
    mockMember = aurora;
    mockRole = null;
    mockPinRequired = false;
    route({
      "/api/tasks/family": {
        ok: true,
        chores: [{ id: 1, title: "Make bed", assignee: "Aurora", done: false }],
      },
    });
    const cachedView = render(<TasksWidget />, { wrapper: wrap });
    await cachedView.findByText("Make bed");
    expect(cachedView.queryByTestId("tasks-quick-check-1")).toBeNull();
  });
});

describe("ScheduleWidget interactions", () => {
  it("header, rows, and empty state open /calendar while Speak stays independent", async () => {
    const now = new Date(2026, 10, 20, 10, 0, 0);
    route({
      "/api/db/schedules": {
        items: [{ id: "1", title: "Bedtime", time: "23:00", days: "all", icon: "🌙", color: "violet" }],
      },
      "/api/db/meal_plan_entries": { items: [] },
    });

    const view = render(<ScheduleWidget span={2} shape="2x1" now={now} />, { wrapper: wrap });
    await view.findByText("Bedtime");

    fireEvent.press(view.getByTestId("schedule-header-press"));
    expect(mockPush).toHaveBeenCalledWith("/calendar");
    mockPush.mockClear();

    fireEvent.press(view.getByTestId("schedule-row-s_1"));
    expect(mockPush).toHaveBeenCalledWith("/calendar");
    mockPush.mockClear();

    await act(async () => {
      fireEvent.press(view.getByTestId("schedule-announce-btn"));
      await Promise.resolve();
    });
    expect(mockPush).not.toHaveBeenCalled();
    view.unmount();

    clearWidgetMemoryCache();
    route({
      "/api/db/schedules": { items: [] },
      "/api/db/meal_plan_entries": { items: [] },
    });
    const empty = render(<ScheduleWidget span={2} shape="2x1" now={now} />, { wrapper: wrap });
    await empty.findByText("No routines");
    fireEvent.press(empty.getByTestId("schedule-empty-open"));
    expect(mockPush).toHaveBeenCalledWith("/calendar");
  });
});

describe("CurrentMealWidget interactions", () => {
  const now = new Date(2026, 9, 10, 18, 0);
  const schedules = {
    items: [{ id: "s2", title: "Dinner", time: "17:30", mealType: "dinner" }],
  };

  it("header and plate card open /meals for both empty and planned meals", async () => {
    route({ "/api/db/schedules": schedules, "/api/db/meal_plan_entries": { items: [] } });
    const empty = render(<CurrentMealWidget now={now} />, { wrapper: wrap });
    await empty.findByText("No meal planned yet");

    fireEvent.press(empty.getByTestId("currentMeal-header-press"));
    expect(mockPush).toHaveBeenCalledWith("/meals");
    mockPush.mockClear();

    fireEvent.press(empty.getByTestId("currentMeal-open"));
    expect(mockPush).toHaveBeenCalledWith("/meals");
    empty.unmount();

    clearWidgetMemoryCache();
    mockPush.mockClear();
    const weekMon = weekStartMondayISO(now);
    route({
      "/api/db/schedules": schedules,
      "/api/db/meal_plan_entries": {
        items: [{ id: "m1", name: "Taco night", emoji: "🌮", time: "Sat", mealType: "dinner", weekOf: weekMon }],
      },
    });
    const planned = render(<CurrentMealWidget now={now} />, { wrapper: wrap });
    await planned.findByText("Taco night");
    fireEvent.press(planned.getByTestId("currentMeal-open"));
    expect(mockPush).toHaveBeenCalledWith("/meals");
  });
});

describe("LeaderboardWidget and HA widget interactions", () => {
  it("Leaderboard header and body open /tasks", () => {
    mockSnapshot = {
      weekData: { weekStart: "2026-10-05", points: { Aurora: 20 } },
    };
    const { getByTestId } = render(<LeaderboardWidget />, { wrapper: wrap });
    fireEvent.press(getByTestId("leaderboard-header-press"));
    expect(mockPush).toHaveBeenCalledWith("/tasks");
    mockPush.mockClear();

    fireEvent.press(getByTestId("leaderboard-body-open"));
    expect(mockPush).toHaveBeenCalledWith("/tasks");
  });

  it("HomeClimateWidget and HomeLightsWidget headers and empty states open /ha", async () => {
    route({ "/api/ha/sync": { success: true, count: 0, states: [] } });
    const climate = render(<HomeClimateWidget />, { wrapper: wrap });
    await waitFor(() => expect(climate.getByTestId("homeClimate-empty-open")).toBeTruthy());
    fireEvent.press(climate.getByTestId("homeClimate-header-press"));
    expect(mockPush).toHaveBeenCalledWith("/ha");
    mockPush.mockClear();
    fireEvent.press(climate.getByTestId("homeClimate-empty-open"));
    expect(mockPush).toHaveBeenCalledWith("/ha");
    climate.unmount();

    mockPush.mockClear();
    const lights = render(<HomeLightsWidget />, { wrapper: wrap });
    await waitFor(() => expect(lights.getByTestId("homeLights-empty-open")).toBeTruthy());
    fireEvent.press(lights.getByTestId("homeLights-header-press"));
    expect(mockPush).toHaveBeenCalledWith("/ha");
    mockPush.mockClear();
    fireEvent.press(lights.getByTestId("homeLights-empty-open"));
    expect(mockPush).toHaveBeenCalledWith("/ha");
  });

  it("HomeLightsWidget renders tactile tiles, toggles with explicit turn_on/turn_off, supports All off, and adapts to 2x1", async () => {
    route({
      "/api/ha/sync": {
        success: true,
        count: 2,
        states: [
          {
            entity_id: "switch.plant_light_socket",
            state: "off",
            attributes: { device_class: "outlet", friendly_name: "Living Room Plant Light", area_id: "Living Room" },
            last_updated: "",
          },
          {
            entity_id: "light.kitchen_main_light",
            state: "on",
            attributes: { friendly_name: "Kitchen Main Light", area_id: "Kitchen", supported_color_modes: ["color_temp"], brightness: 191 },
            last_updated: "",
          },
        ],
      },
      "/api/ha/call-service": { success: true },
    });

    const view = render(<HomeLightsWidget shape="2x1" />, { wrapper: wrap });
    await view.findByText("Living Room Plant Light");
    expect(view.getByText("1 on of 2")).toBeTruthy();
    expect(view.getByTestId("homeLights-all-off")).toBeTruthy();

    await act(async () => {
      fireEvent.press(view.getByTestId("homeLights-tile-switch.plant_light_socket"));
      await Promise.resolve();
    });

    expect(api).toHaveBeenCalledWith(
      "/api/ha/call-service",
      expect.objectContaining({
        method: "POST",
        body: expect.objectContaining({
          domain: "switch",
          service: "turn_on",
          entity_id: "switch.plant_light_socket",
        }),
      })
    );
    expect(view.getByText("2 on of 2")).toBeTruthy();

    await act(async () => {
      fireEvent.press(view.getByTestId("homeLights-all-off"));
      await Promise.resolve();
    });
    expect(view.getByText("0 on of 2")).toBeTruthy();
  });
});
