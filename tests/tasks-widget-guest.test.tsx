/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
/**
 * SP1.7 Task 3 — the SIGNED-OUT wall shows the family's chores.
 *
 * The wall is a family display: the calendar, the meals, the photos and the
 * roster stay readable while signed out, because those server reads are
 * session-EXEMPT. The tasks card was the last surface that was not — the
 * shared /api/tasks/sync snapshot needs a live session, so a guest saw
 * "Sign in to see the family's tasks" while every other card stayed alive.
 *
 * The server now exposes ONE chores-only public read (Home-ai
 * /api/tasks/family: id, title, assignee, done — NO points, NO approvals, NO
 * ledger). This suite pins what the card does with it:
 *
 *   · a guest sees the family's CHORES and the count ("N pending for the
 *     family");
 *   · the "N need approval" footer stays hidden for a guest (a parent
 *     capability) and no points are painted (the route never carried them);
 *   · the KPI band publishes the count when the read SUCCEEDED and stays
 *     UNKNOWN when it did not — never a hard 0;
 *   · the failure taxonomy is honest: an unreachable NAS is "offline", a
 *     server error is "error", and neither ever becomes a fake count.
 */
import React from "react";
import { Text } from "react-native";
import { render, waitFor } from "@testing-library/react-native";

import { ThemeProvider } from "../src/theme/ThemeProvider";
import { TasksWidget } from "../src/home/widgets/TasksWidget";
import { resetWallStats, useWallStats } from "../src/home/wall-stats";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

/** The cached DISPLAY profile (never a capability). */
let mockMember: any = null;
/** The CAPABILITY role — null means "no live session". */
let mockRole: any = null;
jest.mock("../src/state/AuthProvider", () => ({
  useAuth: () => ({
    member: mockMember,
    role: mockRole,
    sessionVerified: mockRole !== null,
    hydrated: true,
    signOut: jest.fn(),
    poke: jest.fn(),
  }),
}));

const mockSnapshot: any = null;
const mockSyncError: "unreachable" | "unauthorized" | "server" | null = null;
const mockRefreshNow = jest.fn(async () => {});
jest.mock("../src/state/SyncManager", () => ({
  useSync: () => ({
    stale: false,
    syncError: mockSyncError,
    snapshot: mockSnapshot,
    lastSyncAt: null,
    refreshNow: mockRefreshNow,
    onPulse: () => () => {},
  }),
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

/** The KPI band's own tile value — the band must never contradict the card. */
function BandProbe() {
  const stats = useWallStats();
  return <Text testID="band-open-tasks">{stats.openTasks === null ? "unknown" : String(stats.openTasks)}</Text>;
}

const CHORES = {
  ok: true,
  chores: [
    { id: 1, title: "Dishes", assignee: "Aurora", done: false },
    { id: 2, title: "Feed Rico & Rocco", assignee: "Caspian", done: false },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  resetWallStats();
  mockMember = null;
  mockRole = null;
  api.mockReset();
});

describe("TasksWidget — the signed-out wall reads the family's chores", () => {
  it("a guest sees the family's chores and the count", async () => {
    route({ "/api/tasks/family": CHORES });
    const { findByText, getByText } = render(<TasksWidget />, { wrapper: wrap });

    await findByText("2 pending for the family");
    expect(getByText("Dishes")).toBeTruthy();
    expect(getByText("Feed Rico & Rocco")).toBeTruthy(); // the family's own copy, readable
    expect(getByText("Aurora")).toBeTruthy();
  });

  it("the guest read is the PUBLIC chores route — one fetch, no session", async () => {
    route({ "/api/tasks/family": CHORES });
    const { findByText } = render(<TasksWidget />, { wrapper: wrap });

    await findByText("2 pending for the family");
    expect(api).toHaveBeenCalledTimes(1);
    expect(api).toHaveBeenCalledWith("/api/tasks/family");
  });

  it("the approval footer stays hidden for a guest (a parent capability)", async () => {
    route({ "/api/tasks/family": CHORES });
    const { findByText, queryByTestId, queryByText } = render(<TasksWidget />, { wrapper: wrap });

    await findByText("2 pending for the family");
    expect(queryByTestId("tasks-approval-footer")).toBeNull();
    expect(queryByText(/approval/i)).toBeNull();
  });

  it("no points are painted for a guest — the route never carried them", async () => {
    route({ "/api/tasks/family": CHORES });
    const { findByText, queryByText } = render(<TasksWidget />, { wrapper: wrap });

    await findByText("2 pending for the family");
    expect(queryByText(/pts/)).toBeNull();
  });

  it("the KPI band publishes the count when the read succeeded", async () => {
    route({ "/api/tasks/family": CHORES });
    const { findByText, getByTestId } = render(
      <>
        <TasksWidget />
        <BandProbe />
      </>,
      { wrapper: wrap }
    );

    await findByText("2 pending for the family");
    await waitFor(() => {
      expect(getByTestId("band-open-tasks").props.children).toBe("2");
    });
  });

  it("the KPI band stays UNKNOWN when the read did not answer — never a hard 0", async () => {
    route({
      "/api/tasks/family": new ApiError({ message: "unreachable", status: 0, code: "unreachable", retryable: true }),
    });
    const { findByText, getByTestId, queryByText } = render(
      <>
        <TasksWidget />
        <BandProbe />
      </>,
      { wrapper: wrap }
    );

    await findByText(/Sign in with your PIN to see the family's data/);
    await waitFor(() => {
      expect(getByTestId("band-open-tasks").props.children).toBe("unknown");
    });
    expect(queryByText("0 pending for the family")).toBeNull();
  });

  it("a guest with no data shows the honest 'Sign in…' state, never a fake count", async () => {
    route({
      "/api/tasks/family": new ApiError({ message: "http_503", status: 503, code: "http_503", retryable: true }),
    });
    const { findByText, queryByText } = render(<TasksWidget />, { wrapper: wrap });

    await findByText(/Sign in with your PIN to see the family's data/);
    expect(queryByText(/pending for the family/)).toBeNull();
  });

  // The wall's real signed-out state is a CACHED profile with NO live session
  // (the kitchen display auto-logs-out after 30 min and keeps the profile).
  // There the frame does not force the PIN gate, so the widget's OWN failure
  // taxonomy is what the family reads: unreachable = OFFLINE (never their
  // internet), a server error = ERROR.
  it("an unreachable NAS reads as OFFLINE for a cached-profile guest", async () => {
    mockMember = { id: "p1", name: "Rebecca (Mom)", role: "parent", emoji: "🐱", color: "green" };
    mockRole = null; // a cached profile is NOT a capability
    route({
      "/api/tasks/family": new ApiError({ message: "unreachable", status: 0, code: "unreachable", retryable: true }),
    });
    const { findByText, queryByText } = render(<TasksWidget />, { wrapper: wrap });

    await findByText(/Offline — no saved copy on this device/);
    expect(queryByText(/Couldn't load this right now/)).toBeNull();
    expect(queryByText("0 pending for the family")).toBeNull();
  });

  it("a server error reads as an ERROR for a cached-profile guest — never as offline", async () => {
    mockMember = { id: "p1", name: "Rebecca (Mom)", role: "parent", emoji: "🐱", color: "green" };
    mockRole = null;
    route({
      "/api/tasks/family": new ApiError({ message: "http_503", status: 503, code: "http_503", retryable: true }),
    });
    const { findByText, queryByText } = render(<TasksWidget />, { wrapper: wrap });

    await findByText(/Couldn't load this right now/);
    expect(queryByText(/Offline/)).toBeNull();
  });

  it("a guest retries the PUBLIC read — never the session-gated sync poll", async () => {
    route({
      "/api/tasks/family": new ApiError({ message: "http_503", status: 503, code: "http_503", retryable: true }),
    });
    const { findByText } = render(<TasksWidget />, { wrapper: wrap });

    await findByText(/Sign in with your PIN to see the family's data/);
    expect(mockRefreshNow).not.toHaveBeenCalled();
  });

  it("a double cell shows up to four public chores and still shows no private data", async () => {
    route({
      "/api/tasks/family": {
        ok: true,
        chores: [
          { id: 1, title: "Dishes", assignee: "Aurora", done: false },
          { id: 2, title: "Feed Rico & Rocco", assignee: "Caspian", done: false },
          { id: 3, title: "Take bins out", assignee: "Aurora", done: false },
          { id: 4, title: "Water plants", assignee: "Caspian", done: false },
          { id: 5, title: "Fold laundry", assignee: "Aurora", done: false },
        ],
      },
    });
    const { findByText, getByText, queryByText, queryByTestId } = render(
      <TasksWidget span={2} />,
      { wrapper: wrap },
    );
    await findByText("5 pending for the family");
    expect(getByText("Dishes")).toBeTruthy();
    expect(getByText("Feed Rico & Rocco")).toBeTruthy();
    expect(getByText("Take bins out")).toBeTruthy();
    expect(getByText("Water plants")).toBeTruthy();
    expect(queryByText("Fold laundry")).toBeNull();
    expect(queryByText(/pts/)).toBeNull();
    expect(queryByTestId("tasks-approval-footer")).toBeNull();
  });
});
