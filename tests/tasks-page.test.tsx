/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";

import { ThemeProvider } from "../src/theme/ThemeProvider";
import { ToastProvider } from "../src/ui/Toast";
import { TasksPage } from "../src/tasks/TasksPage";
import { newOperationId } from "../src/tasks/claim";
import TasksRoute from "../app/tasks";

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
  usePathname: () => "/tasks",
}));

const parent = { id: "p1", name: "Rebecca (Mom)", role: "parent", emoji: "🐱", color: "green" };
const kidUnder10 = { id: "c1", name: "Aurora", role: "child", age: 8, emoji: "🧚", color: "violet" };
const kidOver10 = { id: "c1", name: "Aurora", role: "child", age: 12, emoji: "🧚", color: "violet" };

let mockMember: any = parent;
jest.mock("../src/state/AuthProvider", () => ({
  useAuth: () => ({
    member: mockMember,
    hydrated: true,
    signOut: jest.fn(),
    poke: jest.fn(),
    pinRequiredFor: jest.requireActual("../src/state/AuthProvider").pinRequiredFor,
  }),
}));

let mockSnapshot: any = null;
let mockStale = false;
let mockLastSyncAt: number | null = null;
const mockRefreshNow = jest.fn(async () => {});
const mockPulseListeners = new Set<() => void>();
// Stable value object — mirrors SyncManager's useMemo so effect deps settle.
const mockSyncValue = {
  get stale() {
    return mockStale;
  },
  get snapshot() {
    return mockSnapshot;
  },
  get lastSyncAt() {
    return mockLastSyncAt;
  },
  syncError: null as null,
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

const wrap = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>
    <ToastProvider>{children}</ToastProvider>
  </ThemeProvider>
);

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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ── Fixtures: snapshot tasks per Home-ai src/types/tasks.ts (subset).
// SERVER SHAPE (task-claim.ts completedFields + task-utils.ts:60): a queued
// kid tap lands as completed:true + pendingApproval — fixtures must encode
// the real shape, never an invented completed:false + pendingApproval. ──
const KID_TASKS = [
  { id: 1, title: "Make bed", assignee: "Aurora", assigneeEmoji: "🛏️", points: 5, completed: false, due: "2026-10-10" },
  {
    id: 2,
    title: "Dishes",
    assignee: "Aurora",
    assigneeEmoji: "🧼",
    points: 10,
    completed: true,
    pendingApproval: { byName: "Aurora", at: "2026-10-10T10:00:00Z", points: 10 },
  },
  { id: 3, title: "Empty trash", assignee: "Alex", assigneeEmoji: "🗑️", points: 5, completed: false },
  { id: 4, title: "Feed cat", assignee: "Aurora", assigneeEmoji: "🐱", points: 3, completed: true },
];

const PARENT_TASKS = [
  {
    id: 2,
    title: "Dishes",
    assignee: "Aurora",
    assigneeEmoji: "🧼",
    points: 10,
    completed: true,
    pendingApproval: { byName: "Aurora", at: "2026-10-10T10:00:00Z", points: 10 },
  },
  { id: 5, title: "Water plants", assignee: "Aurora", assigneeEmoji: "🪴", points: 8, completed: false },
  { id: 6, title: "Walk dog", assignee: "Alex", assigneeEmoji: "🐕", points: 6, completed: false },
];

const WEEK_DATA = {
  weekStart: "2026-10-05",
  points: { "Rebecca (Mom)": 40, Aurora: 25, Alex: 10 },
  streak: {},
  lastActive: {},
};

const kidSnapshot = () => {
  mockSnapshot = { tasks: KID_TASKS, weekData: WEEK_DATA };
};
const parentSnapshot = () => {
  mockSnapshot = { tasks: PARENT_TASKS, weekData: WEEK_DATA };
};

const CLAIM_OK = (extra: Record<string, unknown> = {}) => ({
  success: true,
  operationId: "op-1",
  action: "complete",
  task: { ...KID_TASKS[0], completed: true, pendingApproval: { byName: "Aurora", at: "2026-10-10T10:00:00Z", points: 5 } },
  pending: true,
  revision: { revision: "9", updatedAt: "" },
  reconciled: true,
  ...extra,
});

const APPROVE_OK = (extra: Record<string, unknown> = {}) => ({
  success: true,
  operationId: "op-2",
  action: "approve",
  weekData: WEEK_DATA,
  paid: 1,
  cleared: 1,
  reconciled: true,
  ...extra,
});

const typePin = (getByLabelText: (id: string) => any, pin: string) => {
  for (const k of pin) fireEvent.press(getByLabelText(k));
};

const claimCalls = () => api.mock.calls.filter((c: any[]) => c[0] === "/api/tasks/claim");
const approveCalls = () => api.mock.calls.filter((c: any[]) => c[0] === "/api/tasks/approve");

beforeEach(() => {
  jest.clearAllMocks();
  mockPulseListeners.clear();
  mockMember = parent;
  mockSnapshot = null;
  mockStale = false;
  mockLastSyncAt = null;
  api.mockReset();
});

describe("TasksPage — guest + sync states", () => {
  it("guest gate: honest PIN copy, no doomed fetches", async () => {
    mockMember = null;
    const { findByText } = render(<TasksPage />, { wrapper: wrap });
    expect(await findByText("Sign in with your PIN to see your chores.")).toBeTruthy();
    expect(api).not.toHaveBeenCalled();
  });

  it("first sync in flight → honest loading state", async () => {
    kidSnapshot();
    mockSnapshot = null;
    const { getByTestId } = render(<TasksPage />, { wrapper: wrap });
    expect(getByTestId("tasks-loading")).toBeTruthy();
  });

  it("sync answered with no snapshot → honest error state, Try again → refreshNow", async () => {
    mockMember = kidUnder10;
    mockLastSyncAt = Date.now();
    const { findByText, getByText } = render(<TasksPage />, { wrapper: wrap });
    expect(await findByText("Couldn't load the family's chores right now.")).toBeTruthy();
    await act(async () => {
      fireEvent.press(getByText("Try again"));
      await Promise.resolve();
    });
    expect(mockRefreshNow).toHaveBeenCalled();
  });

  it("stale badge on the header when the sync layer reports staleness", async () => {
    parentSnapshot();
    mockStale = true;
    const { getByTestId, getByText } = render(<TasksPage />, { wrapper: wrap });
    expect(getByTestId("tasks-stale")).toBeTruthy();
    expect(getByText("Showing your saved copy — couldn't refresh.")).toBeTruthy();
  });

  it("no stale badge when the last refresh succeeded", async () => {
    parentSnapshot();
    const { queryByTestId, findByText } = render(<TasksPage />, { wrapper: wrap });
    await findByText("Dishes");
    expect(queryByTestId("tasks-stale")).toBeNull();
  });
});

describe("TasksPage — kid view", () => {
  it("under-10 kid: my-tasks rows, session complete body exact, calm toast + refresh", async () => {
    mockMember = kidUnder10;
    kidSnapshot();
    route({ "/api/tasks/claim": CLAIM_OK() });
    const { findByText, getByTestId, getByText, queryByText } = render(<TasksPage />, { wrapper: wrap });

    await findByText("Make bed");
    expect(getByText("+5 pts")).toBeTruthy();
    // only MY open rows: someone else's chore and my completed row are absent
    expect(queryByText("Empty trash")).toBeNull();
    expect(queryByText("Feed cat")).toBeNull();

    await act(async () => {
      fireEvent.press(getByTestId("kid-task-1"));
      await Promise.resolve();
    });
    const calls = claimCalls();
    expect(calls).toHaveLength(1);
    const body = calls[0][1].body;
    expect(calls[0][1].method).toBe("POST");
    expect(body).toEqual({ operationId: expect.any(String), action: "complete", taskId: 1 });
    expect(body.operationId).toMatch(UUID_RE);
    expect(await findByText("Nice work — sent for approval.")).toBeTruthy();
    expect(mockRefreshNow).toHaveBeenCalled();
  });

  it("pendingApproval rows display the waiting state honestly and are not completable", async () => {
    mockMember = kidUnder10;
    kidSnapshot();
    const { findByText, getByTestId, getByText, queryByText } = render(<TasksPage />, { wrapper: wrap });

    await findByText("Dishes");
    expect(getByText("⏳ Waiting for approval")).toBeTruthy();
    // points are never promised for a pending tap
    expect(queryByText("+10 pts")).toBeNull();
    await act(async () => {
      fireEvent.press(getByTestId("kid-task-2"));
      await Promise.resolve();
    });
    expect(api).not.toHaveBeenCalled();
  });

  it("kid empty state: honest nothing-waiting copy", async () => {
    mockMember = kidUnder10;
    mockSnapshot = { tasks: [], weekData: WEEK_DATA };
    const { findByText, getByText } = render(<TasksPage />, { wrapper: wrap });
    expect(await findByText("All caught up")).toBeTruthy();
    expect(getByText("No chores waiting for you right now.")).toBeTruthy();
  });

  it("10+ kid: PIN pad first, then claim body carries memberName + pin", async () => {
    mockMember = kidOver10;
    kidSnapshot();
    route({ "/api/tasks/claim": CLAIM_OK() });
    const { getByTestId, getByLabelText, findByTestId, findByText, getByText } = render(<TasksPage />, { wrapper: wrap });

    await findByText("Make bed");
    await act(async () => {
      fireEvent.press(getByTestId("kid-task-1"));
      await Promise.resolve();
    });
    expect(await findByTestId("tasks-pinpad")).toBeTruthy();
    expect(getByText("Hi Aurora 👋")).toBeTruthy();
    typePin(getByLabelText, "1234");
    expect(await findByText("Nice work — sent for approval.")).toBeTruthy();
    const calls = claimCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0][1].body).toEqual({
      operationId: expect.any(String),
      action: "complete",
      taskId: 1,
      memberName: "Aurora",
      pin: "1234",
    });
    expect(mockRefreshNow).toHaveBeenCalled();
  });

  it("wrong PIN → pad error, no success state, no refresh; the pad clears for the next try", async () => {
    mockMember = kidOver10;
    kidSnapshot();
    api.mockImplementation((path: string, init?: any) => {
      if (path !== "/api/tasks/claim") return Promise.reject(new ApiError({ message: "unmapped", status: 404, code: "not_found" }));
      if (init?.body?.pin === "2222") return Promise.resolve(CLAIM_OK());
      return Promise.reject(
        new ApiError({ message: "unauthorized", status: 401, code: "unauthorized", body: { success: false, reason: "unauthorized" } })
      );
    });
    const { getByTestId, getByLabelText, findByText, queryByText, findByTestId } = render(<TasksPage />, { wrapper: wrap });

    await findByText("Make bed");
    await act(async () => {
      fireEvent.press(getByTestId("kid-task-1"));
      await Promise.resolve();
    });
    await findByTestId("tasks-pinpad");
    typePin(getByLabelText, "1111");
    expect(await findByText("Wrong PIN — try again.")).toBeTruthy();
    expect(queryByText(/Nice work/)).toBeNull();
    expect(mockRefreshNow).not.toHaveBeenCalled();
    // the failed entry cleared: "2222" verifies as a complete fresh code
    typePin(getByLabelText, "2222");
    expect(await findByText("Nice work — sent for approval.")).toBeTruthy();
    const calls = claimCalls();
    expect(calls[0][1].body.pin).toBe("1111");
    expect(calls[1][1].body.pin).toBe("2222");
  });

  it("202 durably queued → honest catching-up copy + refreshNow, never an instant-apply claim", async () => {
    mockMember = kidUnder10;
    kidSnapshot();
    route({
      "/api/tasks/claim": {
        success: false,
        queued: true,
        operationId: "op-q",
        action: "complete",
        reason: "task_store_unavailable",
        retryable: true,
      },
    });
    const { getByTestId, findByText, queryByTestId } = render(<TasksPage />, { wrapper: wrap });

    await findByText("Make bed");
    await act(async () => {
      fireEvent.press(getByTestId("kid-task-1"));
      await Promise.resolve();
    });
    expect(await findByText("Sent — the server will catch up.")).toBeTruthy();
    expect(mockRefreshNow).toHaveBeenCalled();
    expect(queryByTestId("tasks-pinpad")).toBeNull(); // no pad ever opened
  });

  it("202 applied-but-unreconciled → the same honest catching-up copy", async () => {
    mockMember = kidUnder10;
    kidSnapshot();
    route({ "/api/tasks/claim": CLAIM_OK({ reconciled: false }) });
    const { getByTestId, findByText } = render(<TasksPage />, { wrapper: wrap });

    await findByText("Make bed");
    await act(async () => {
      fireEvent.press(getByTestId("kid-task-1"));
      await Promise.resolve();
    });
    expect(await findByText("Sent — the server will catch up.")).toBeTruthy();
    expect(mockRefreshNow).toHaveBeenCalled();
  });

  it("409 already_completed → honest already-done copy + refresh (the snapshot caught up)", async () => {
    mockMember = kidUnder10;
    kidSnapshot();
    route({
      "/api/tasks/claim": new ApiError({
        message: "already_completed",
        status: 409,
        code: "already_completed",
        body: { success: false, reason: "already_completed", error: "already_completed" },
      }),
    });
    const { getByTestId, findByText } = render(<TasksPage />, { wrapper: wrap });

    await findByText("Make bed");
    await act(async () => {
      fireEvent.press(getByTestId("kid-task-1"));
      await Promise.resolve();
    });
    expect(await findByText("That one's already done.")).toBeTruthy();
    expect(mockRefreshNow).toHaveBeenCalled();
  });

  it("LAN down → honest unreachable copy, no refresh hammer", async () => {
    mockMember = kidUnder10;
    kidSnapshot();
    route({
      "/api/tasks/claim": new ApiError({
        message: "Couldn't reach Consuela — check the connection",
        status: 0,
        code: "unreachable",
        retryable: true,
      }),
    });
    const { getByTestId, findByText } = render(<TasksPage />, { wrapper: wrap });

    await findByText("Make bed");
    await act(async () => {
      fireEvent.press(getByTestId("kid-task-1"));
      await Promise.resolve();
    });
    expect(await findByText("Couldn't reach Consuela — check the connection and try again.")).toBeTruthy();
    expect(mockRefreshNow).not.toHaveBeenCalled();
  });
});

describe("TasksPage — parent view", () => {
  it("approval queue shows only pending rows, with the server-stated points", async () => {
    parentSnapshot();
    const { findByText, queryByText, getByTestId, getByText } = render(<TasksPage />, { wrapper: wrap });
    expect(await findByText("Dishes")).toBeTruthy();
    expect(getByTestId("queue-row-2")).toBeTruthy();
    expect(getByText("+10 pts")).toBeTruthy();
    // open chores are not in the queue
    expect(queryByText("Water plants")).toBeNull();
    expect(queryByText("Walk dog")).toBeNull();
  });

  it("parent empty queue: honest nothing-waiting copy", async () => {
    mockSnapshot = { tasks: PARENT_TASKS.filter((t) => !t.pendingApproval), weekData: WEEK_DATA };
    const { findByText, getByText } = render(<TasksPage />, { wrapper: wrap });
    expect(await findByText("All caught up")).toBeTruthy();
    expect(getByText("No taps waiting for your OK right now.")).toBeTruthy();
  });

  it("approve via PIN: exact approve body (memberName+pin are the parent's), calm toast + refresh", async () => {
    parentSnapshot();
    route({ "/api/tasks/approve": APPROVE_OK() });
    const { getByTestId, getByLabelText, findByTestId, findByText, getByText } = render(<TasksPage />, { wrapper: wrap });

    await findByTestId("queue-row-2");
    await act(async () => {
      fireEvent.press(getByTestId("task-approve-2"));
      await Promise.resolve();
    });
    expect(await findByTestId("tasks-pinpad")).toBeTruthy();
    expect(getByText("Hi Rebecca 👋")).toBeTruthy();
    typePin(getByLabelText, "1234");
    const calls = approveCalls();
    expect(calls).toHaveLength(1);
    const body = calls[0][1].body;
    expect(calls[0][1].method).toBe("POST");
    expect(body).toEqual({
      operationId: expect.any(String),
      action: "approve",
      taskId: 2,
      memberName: "Rebecca (Mom)",
      pin: "1234",
    });
    expect(body.operationId).toMatch(UUID_RE);
    expect(await findByText("Approved — points added.")).toBeTruthy();
    expect(mockRefreshNow).toHaveBeenCalled();
  });

  it("parent wrong PIN → pad error, no success state, no refresh", async () => {
    parentSnapshot();
    api.mockImplementation((path: string, init?: any) => {
      if (path !== "/api/tasks/approve") return Promise.reject(new ApiError({ message: "unmapped", status: 404, code: "not_found" }));
      return Promise.reject(
        new ApiError({ message: "unauthorized", status: 401, code: "unauthorized", body: { success: false, reason: "unauthorized" } })
      );
    });
    const { getByTestId, getByLabelText, findByTestId, findByText, queryByText } = render(<TasksPage />, { wrapper: wrap });

    await findByTestId("queue-row-2");
    await act(async () => {
      fireEvent.press(getByTestId("task-approve-2"));
      await Promise.resolve();
    });
    await findByTestId("tasks-pinpad");
    typePin(getByLabelText, "9999");
    expect(await findByText("Wrong PIN — try again.")).toBeTruthy();
    expect(queryByText(/Approved/)).toBeNull();
    expect(mockRefreshNow).not.toHaveBeenCalled();
  });

  it("send-back via PIN: exact send-back body, do-over toast", async () => {
    parentSnapshot();
    route({ "/api/tasks/approve": APPROVE_OK({ action: "send-back" }) });
    const { getByTestId, getByLabelText, findByTestId, findByText } = render(<TasksPage />, { wrapper: wrap });

    await findByTestId("queue-row-2");
    await act(async () => {
      fireEvent.press(getByTestId("task-sendback-2"));
      await Promise.resolve();
    });
    await findByTestId("tasks-pinpad");
    typePin(getByLabelText, "1234");
    const calls = approveCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0][1].body).toEqual({
      operationId: expect.any(String),
      action: "send-back",
      taskId: 2,
      memberName: "Rebecca (Mom)",
      pin: "1234",
    });
    expect(await findByText("Sent back for a do-over.")).toBeTruthy();
  });

  it("approve-all via PIN: taskIds array, no taskId field", async () => {
    parentSnapshot();
    // a second pending tap so approve-all is offered
    mockSnapshot = {
      tasks: [
        ...PARENT_TASKS,
        {
          id: 7,
          title: "Homework",
          assignee: "Alex",
          assigneeEmoji: "📚",
          points: 12,
          completed: true,
          pendingApproval: { byName: "Alex", at: "2026-10-10T11:00:00Z", points: 12 },
        },
      ],
      weekData: WEEK_DATA,
    };
    route({ "/api/tasks/approve": APPROVE_OK({ action: "approve-all" }) });
    const { getByTestId, getByLabelText, findByTestId, findByText } = render(<TasksPage />, { wrapper: wrap });

    await findByTestId("queue-row-7");
    await act(async () => {
      fireEvent.press(getByTestId("tasks-approve-all"));
      await Promise.resolve();
    });
    await findByTestId("tasks-pinpad");
    typePin(getByLabelText, "1234");
    const calls = approveCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0][1].body).toEqual({
      operationId: expect.any(String),
      action: "approve-all",
      taskIds: [2, 7],
      memberName: "Rebecca (Mom)",
      pin: "1234",
    });
    expect(await findByText("All approved — points added.")).toBeTruthy();
  });

  it("approve with skipped rows → honest 'N not eligible' toast", async () => {
    parentSnapshot();
    route({ "/api/tasks/approve": APPROVE_OK({ skipped: 2 }) });
    const { getByTestId, getByLabelText, findByTestId, findByText } = render(<TasksPage />, { wrapper: wrap });

    await findByTestId("queue-row-2");
    await act(async () => {
      fireEvent.press(getByTestId("task-approve-2"));
      await Promise.resolve();
    });
    await findByTestId("tasks-pinpad");
    typePin(getByLabelText, "1234");
    expect(await findByText("Approved — 2 not eligible")).toBeTruthy();
  });

  it("week race strip ranks the family from the shared weekData", async () => {
    parentSnapshot();
    const { findByText, getByText } = render(<TasksPage />, { wrapper: wrap });
    expect(await findByText("This week's race")).toBeTruthy();
    expect(getByText("🥇 Rebecca — 40")).toBeTruthy();
    expect(getByText("🥈 Aurora — 25")).toBeTruthy();
    expect(getByText("🥉 Alex — 10")).toBeTruthy();
  });

  it("empty week → honest be-the-first race copy", async () => {
    mockSnapshot = { tasks: PARENT_TASKS, weekData: { weekStart: "2026-10-05", points: {}, streak: {}, lastActive: {} } };
    const { findByText } = render(<TasksPage />, { wrapper: wrap });
    expect(await findByText("Be the first!")).toBeTruthy();
  });
});

describe("Tasks route + operation ids", () => {
  it("app/tasks renders the page + the manifest dock with the Tasks cap active", async () => {
    parentSnapshot();
    const { getByTestId, findByTestId } = render(<TasksRoute />, { wrapper: wrap });
    expect(getByTestId("tasks-route")).toBeTruthy();
    expect(await findByTestId("queue-row-2")).toBeTruthy();
    expect(getByTestId("dock-tasks")).toBeTruthy();
    expect(getByTestId("dock-tasks").props.accessibilityState?.selected).toBe(true);
  });

  it("newOperationId mints unique RFC-4122 v4 ids", () => {
    const a = newOperationId();
    const b = newOperationId();
    expect(a).toMatch(UUID_RE);
    expect(b).toMatch(UUID_RE);
    expect(a).not.toBe(b);
  });
});
