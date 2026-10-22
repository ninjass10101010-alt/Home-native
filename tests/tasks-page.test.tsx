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
    role: mockMember ? mockMember.role : null,
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
  it("guest gate: the full read-only board (web parity) with honest empty sections, zero doomed fetches", async () => {
    mockMember = null;
    const { findByText, getByText, getByTestId } = render(<TasksPage />, { wrapper: wrap });
    // the wall has NO saved copy — the banner never claims one (D1)
    expect(await findByText(/Signed out — the family's chores live on the family server/)).toBeTruthy();
    // the board renders with zero counts (no fabricated rows)
    expect(getByTestId("tasks-stat-pending")).toBeTruthy();
    expect(getByText("Nothing up for grabs")).toBeTruthy();
    expect(getByText("Tasks are synced to the family account")).toBeTruthy();
    // guest chips: All + Open only (no roster read, no doomed fetch)
    expect(getByTestId("tasks-filter-All")).toBeTruthy();
    expect(getByTestId("tasks-filter-Open")).toBeTruthy();
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
    expect(await findByText("Couldn't reach the family server")).toBeTruthy();
    await act(async () => {
      fireEvent.press(getByText("Try again"));
      await Promise.resolve();
    });
    expect(mockRefreshNow).toHaveBeenCalled();
  });

  it("LAN down (status 0): the syncError path reaches the error state — never a perpetual skeleton", async () => {
    // A transport failure throws inside SyncManager.refreshNow, so lastSyncAt
    // is never stamped. The board must NOT sit on the skeleton forever.
    mockMember = kidUnder10;
    (mockSyncValue as any).syncError = { kind: "unreachable", status: 0, at: Date.now() };
    const { findByText, queryByTestId } = render(<TasksPage />, { wrapper: wrap });
    expect(await findByText("Couldn't reach the family server")).toBeTruthy();
    expect(queryByTestId("tasks-loading")).toBeNull();
    (mockSyncValue as any).syncError = null;
  });

  it("stale badge on the header when the sync layer reports staleness", async () => {
    parentSnapshot();
    mockStale = true;
    const { getByTestId, getByText } = render(<TasksPage />, { wrapper: wrap });
    expect(getByTestId("tasks-stale")).toBeTruthy();
    expect(getByText("Couldn't refresh — showing the last board we read.")).toBeTruthy();
  });

  it("no stale badge when the last refresh succeeded", async () => {
    parentSnapshot();
    const { queryByTestId, findByText } = render(<TasksPage />, { wrapper: wrap });
    await findByText("Tasks");
    expect(queryByTestId("tasks-stale")).toBeNull();
  });

  it("the stat row reads server facts: pending count, this-week completions, the week ledger sum", async () => {
    parentSnapshot();
    const { findByText, getByText, getByTestId } = render(<TasksPage />, { wrapper: wrap });
    await findByText("Needs approval");
    // PARENT_TASKS: 2 open (Water plants, Walk dog), 1 waiting (Dishes)
    expect(getByTestId("tasks-stat-pending")).toBeTruthy();
    expect(getByText("Earned this week")).toBeTruthy();
    // the signed-in parent's default filter is My Tasks → the tile scopes to
    // Rebecca's own ledger row (web scopedEarned), not the family sum
    expect(getByText("40")).toBeTruthy();
  });
});

describe("TasksPage — kid view", () => {
  it("under-10 kid: my-tasks rows, session complete body exact, calm toast + refresh", async () => {
    mockMember = kidUnder10;
    kidSnapshot();
    route({ "/api/tasks/claim": CLAIM_OK() });
    const { findByText, getByTestId, getByText, queryByText, queryByTestId } = render(<TasksPage />, { wrapper: wrap });

    // default signed-in filter is My Tasks (web parity)
    expect(await findByText("Make bed")).toBeTruthy();
    expect(getByText("+5pts")).toBeTruthy();
    // only MY open rows: someone else's chore is absent
    expect(queryByText("Empty trash")).toBeNull();
    // the completed row is not in Pending — it lives behind the disclosure
    expect(queryByTestId("pending-row-4")).toBeNull();

    await act(async () => {
      fireEvent.press(getByTestId("pending-row-1"));
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

  it("pendingApproval rows display the waiting state honestly in the Completed card and are not completable", async () => {
    mockMember = kidUnder10;
    kidSnapshot();
    const { findByText, getByTestId, getByText, queryByText } = render(<TasksPage />, { wrapper: wrap });

    await findByText("Make bed");
    // the disclosure starts collapsed (reference parity)
    expect(queryByText("Waiting on approval")).toBeNull();
    await act(async () => {
      fireEvent.press(getByTestId("tasks-completed-toggle"));
      await Promise.resolve();
    });
    expect(await findByText("Waiting on approval · 1 chore")).toBeTruthy();
    expect(getByText("Aurora · tapped Oct 10 · ⏳ Waiting for approval")).toBeTruthy();
    // no claim call fired from the waiting group (press-inert)
    expect(api).not.toHaveBeenCalled();
  });

  it("kid empty state: honest nothing-waiting copy", async () => {
    mockMember = kidUnder10;
    mockSnapshot = { tasks: [], weekData: WEEK_DATA };
    const { findByText, getByText, getByTestId } = render(<TasksPage />, { wrapper: wrap });
    await findByText("Tasks");
    expect(getByTestId("tasks-pending-card")).toBeTruthy();
    // My Tasks empty copy is the web's own (page.tsx:3079-3080)
    expect(getByText("All caught up")).toBeTruthy();
    expect(getByText("Nothing on your plate right now.")).toBeTruthy();
  });

  it("10+ kid: PIN pad first, then claim body carries memberName + pin", async () => {
    mockMember = kidOver10;
    kidSnapshot();
    route({ "/api/tasks/claim": CLAIM_OK() });
    const { getByTestId, getByLabelText, findByTestId, findByText, getByText } = render(<TasksPage />, { wrapper: wrap });

    await findByText("Make bed");
    await act(async () => {
      fireEvent.press(getByTestId("pending-row-1"));
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
      fireEvent.press(getByTestId("pending-row-1"));
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

  it("a SECOND consecutive wrong PIN clears the pad — the family is never stuck re-sending the failed code", async () => {
    mockMember = kidOver10;
    kidSnapshot();
    api.mockImplementation((path: string, init?: any) => {
      if (path !== "/api/tasks/claim") return Promise.reject(new ApiError({ message: "unmapped", status: 404, code: "not_found" }));
      if (init?.body?.pin === "3333") return Promise.resolve(CLAIM_OK());
      return Promise.reject(
        new ApiError({ message: "unauthorized", status: 401, code: "unauthorized", body: { success: false, reason: "unauthorized" } })
      );
    });
    const { getByTestId, getByLabelText, findByText, findByTestId } = render(<TasksPage />, { wrapper: wrap });

    await findByText("Make bed");
    await act(async () => {
      fireEvent.press(getByTestId("pending-row-1"));
      await Promise.resolve();
    });
    await findByTestId("tasks-pinpad");
    // wrong #1 (1111) — the pad shakes and clears
    typePin(getByLabelText, "1111");
    expect(await findByText("Wrong PIN — try again.")).toBeTruthy();
    // wrong #2 (2222) — the SAME copy must still clear the pad, so attempt #3
    // submits "3333" and not a re-send of "2222"
    typePin(getByLabelText, "2222");
    expect(await findByText("Wrong PIN — try again.")).toBeTruthy();
    typePin(getByLabelText, "3333");
    expect(await findByText("Nice work — sent for approval.")).toBeTruthy();
    const pins = claimCalls().map((c: any[]) => c[1].body.pin);
    expect(pins).toEqual(["1111", "2222", "3333"]);
  });

  it("PIN-free path with a DEAD SESSION (401 without a pad) → honest 'Sign in again' toast, never a silent no-op", async () => {
    mockMember = kidUnder10; // pinRequiredFor === false → no pad on this path
    kidSnapshot();
    api.mockImplementation((path: string) => {
      if (path !== "/api/tasks/claim") return Promise.reject(new ApiError({ message: "unmapped", status: 404, code: "not_found" }));
      // The session cookie died between sync polls — the server answers 401.
      return Promise.reject(
        new ApiError({ message: "unauthorized", status: 401, code: "unauthorized", body: { success: false, reason: "unauthorized" } })
      );
    });
    const { getByTestId, findByText, queryByText } = render(<TasksPage />, { wrapper: wrap });
    await findByText("Make bed");
    await act(async () => {
      fireEvent.press(getByTestId("pending-row-1"));
      await Promise.resolve();
    });
    // No pad opened, and the failure was VISIBLE — honest copy, not silence
    expect(await findByText("Sign in again to finish that.")).toBeTruthy();
    expect(queryByText(/Nice work/)).toBeNull();
    expect(queryByText(/tasks-pinpad/)).toBeNull();
  });

  it("202 durably queued → honest catching-up copy + refreshNow, never an instant-apply claim", async () => {    mockMember = kidUnder10;
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
      fireEvent.press(getByTestId("pending-row-1"));
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
      fireEvent.press(getByTestId("pending-row-1"));
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
      fireEvent.press(getByTestId("pending-row-1"));
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
      fireEvent.press(getByTestId("pending-row-1"));
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
    expect(await findByText("Needs approval")).toBeTruthy();
    expect(getByTestId("queue-row-2")).toBeTruthy();
    expect(getByText("+10pts")).toBeTruthy();
    // open chores are not in the queue
    expect(queryByText("Water plants")).toBeNull();
    expect(queryByText("Walk dog")).toBeNull();
  });

  it("parent empty queue: the Needs approval card is simply absent (no dead affordance)", async () => {
    mockSnapshot = { tasks: PARENT_TASKS.filter((t) => !t.pendingApproval), weekData: WEEK_DATA };
    const { findByText, queryByTestId } = render(<TasksPage />, { wrapper: wrap });
    await findByText("Tasks");
    expect(queryByTestId("tasks-approvals-card")).toBeNull();
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
      // newest tap first (web approvalQueue parity): Homework tapped at 11:00 leads
      taskIds: [7, 2],
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

  it("week race uses standard competition: tied members share a rank and the next rank skips", async () => {
    parentSnapshot();
    mockSnapshot = {
      tasks: PARENT_TASKS,
      weekData: { weekStart: "2026-10-05", points: { "Rebecca (Mom)": 40, Aurora: 25, Alex: 25 }, streak: {}, lastActive: {} },
    };
    const { getByText, findByTestId, queryByText } = render(<TasksPage />, { wrapper: wrap });
    await act(async () => {
      fireEvent.press(getByText("Leaderboard"));
      await Promise.resolve();
    });
    expect(await findByTestId("tasks-leaderboard")).toBeTruthy();
    // 40 → gold alone; the 25/25 tie share rank 2 and NOBODY gets the bronze
    expect(getByText("🥇 Rebecca (Mom)")).toBeTruthy();
    // both tied members share rank 2 and BOTH wear the silver; no bronze
    expect(getByText("🥈 Alex")).toBeTruthy();
    expect(getByText("🥈 Aurora")).toBeTruthy();
    expect(queryByText("🥉 Alex")).toBeNull();
  });

  it("crew chores read as crew chores on the Pending board (the normalized crew data renders)", async () => {
    mockMember = kidUnder10;
    mockSnapshot = {
      tasks: [
        {
          id: 20,
          title: "Wash the car",
          assignee: "Aurora",
          assigneeEmoji: "🧚",
          points: 12,
          due: "2026-10-20",
          category: "Chores",
          crewSize: 3,
          crew: { members: [{ name: "Aurora", emoji: "🧚", joinedAt: "x", checkedInAt: "y" }, { name: "Bailey", emoji: "🙂", joinedAt: "z" }] },
        },
      ],
      weekData: WEEK_DATA,
    };
    const { findByText, getByText } = render(<TasksPage />, { wrapper: wrap });
    expect(await findByText("Wash the car")).toBeTruthy();
    // checked-in/total, joined count and the per-member award (web page.tsx:3117)
    expect(getByText("🤝 Crew 1/3 checked in · 2 joined · +12 pts each")).toBeTruthy();
  });

  it("the Open filter's completed stat reads the FAMILY rows, not the completed-free Open scope", async () => {
    mockMember = kidUnder10;
    mockSnapshot = {
      tasks: [
        { id: 1, title: "Clean the steps", assignee: "", assigneeEmoji: "🫳", points: 7, universal: true, completed: true, completedBy: "Aurora", completedInWeek: "2026-10-05" },
        { id: 2, title: "Water plants", assignee: "Aurora", assigneeEmoji: "🪴", points: 8, due: "2026-10-20" },
      ],
      weekData: WEEK_DATA,
    };
    const { findByText, getByTestId } = render(<TasksPage />, { wrapper: wrap });
    await findByText("Tasks");
    // the stat tile reads the COMPLETION count, and Open scope (which contains
    // no completed rows) must not zero it
    expect(getByTestId("tasks-stat-completed")).toBeTruthy();
    await act(async () => {
      fireEvent.press(getByTestId("tasks-filter-Open"));
      await Promise.resolve();
    });
    expect(getByTestId("tasks-stat-completed")).toBeTruthy();
  });

  it("the Completed card is gated: a filter with nothing done shows no empty card", async () => {
    mockMember = kidUnder10;
    mockSnapshot = {
      tasks: [{ id: 1, title: "Make bed", assignee: "Aurora", assigneeEmoji: "🧚", points: 5, due: "2026-10-20" }],
      weekData: WEEK_DATA,
    };
    const { findByText, queryByTestId } = render(<TasksPage />, { wrapper: wrap });
    await findByText("Make bed");
    // nothing completed anywhere → no "Completed / 0 done" card (web gate)
    expect(queryByTestId("tasks-completed-card")).toBeNull();
  });

  it("week race strip ranks the family from the shared weekData", async () => {
    parentSnapshot();
    const { getByText, findByTestId, getByTestId } = render(<TasksPage />, { wrapper: wrap });
    // the race lives on the Leaderboard tab (web view-switch parity)
    expect(getByTestId("tasks-tabs")).toBeTruthy();
    await act(async () => {
      fireEvent.press(getByText("Leaderboard"));
      await Promise.resolve();
    });
    expect(await findByTestId("tasks-leaderboard")).toBeTruthy();
    expect(getByText("🥇 Rebecca (Mom)")).toBeTruthy();
    expect(getByText("🥈 Aurora")).toBeTruthy();
    expect(getByText("🥉 Alex")).toBeTruthy();
    // full names, never first-name-only (the ledgerKey lesson)
    expect(getByText("40pts")).toBeTruthy();
  });

  it("empty week → honest be-the-first race copy", async () => {
    mockSnapshot = { tasks: PARENT_TASKS, weekData: { weekStart: "2026-10-05", points: {}, streak: {}, lastActive: {} } };
    const { findByText, getByText } = render(<TasksPage />, { wrapper: wrap });
    await act(async () => {
      fireEvent.press(getByText("Leaderboard"));
      await Promise.resolve();
    });
    expect(await findByText("Be the first!")).toBeTruthy();
  });
});

describe("TasksPage — open board", () => {
  const OPEN_TASKS = [
    { id: 11, title: "Clean the steps", assignee: "", assigneeEmoji: "🫳", points: 7, universal: true, speedBonus: 2, due: "2026-10-02", category: "Chores" },
    { id: 12, title: "Water plants", assignee: "Aurora", assigneeEmoji: "🪴", points: 8, universal: false, due: "2026-10-20" },
  ];

  it("open rows claim with a PIN: the memberName the row lands on is the PIN's owner", async () => {
    mockMember = kidOver10;
    mockSnapshot = { tasks: OPEN_TASKS, weekData: WEEK_DATA };
    route({ "/api/tasks/claim": CLAIM_OK() });
    const { findAllByText, findByText, getByText, getByTestId, getByLabelText, findByTestId } = render(<TasksPage />, { wrapper: wrap });

    expect((await findAllByText("Clean the steps")).length).toBeGreaterThan(0);
    // the web's Claim +N carries the row points + speed bonus
    expect(getByText("🫳 Claim +9")).toBeTruthy();
    await act(async () => {
      fireEvent.press(getByTestId("task-claim-11"));
      await Promise.resolve();
    });
    expect(await findByTestId("tasks-pinpad")).toBeTruthy();
    typePin(getByLabelText, "1234");
    const calls = claimCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0][1].body).toEqual({
      operationId: expect.any(String),
      action: "claim",
      taskId: 11,
      memberName: "Aurora",
      pin: "1234",
    });
    expect(await findByText("Claimed — good grab!")).toBeTruthy();
  });

  it("an empty board says nothing is up for grabs — never a fabricated row", async () => {
    mockMember = kidUnder10;
    mockSnapshot = { tasks: OPEN_TASKS.filter((t) => t.id === 12), weekData: WEEK_DATA };
    const { findByText, queryByTestId } = render(<TasksPage />, { wrapper: wrap });
    expect(await findByText("Nothing up for grabs")).toBeTruthy();
    expect(queryByTestId("task-claim-11")).toBeNull();
  });

  it("a member chip collapses the Open board to its empty state (web openBoard parity)", async () => {
    mockMember = kidUnder10;
    mockSnapshot = {
      tasks: [
        { id: 11, title: "Clean the steps", assignee: "", assigneeEmoji: "🫳", points: 7, universal: true, speedBonus: 2, due: "2026-10-02", category: "Chores" },
        { id: 12, title: "Water plants", assignee: "Aurora", assigneeEmoji: "🪴", points: 8, due: "2026-10-20" },
      ],
      weekData: WEEK_DATA,
    };
    const { findAllByText, getByTestId, queryByText, queryByTestId } = render(<TasksPage />, { wrapper: wrap });

    // the Open filter shows the claimable row
    expect((await findAllByText("Clean the steps")).length).toBeGreaterThan(0);
    await act(async () => {
      fireEvent.press(getByTestId("tasks-filter-Open"));
      await Promise.resolve();
    });
    expect(getByTestId("task-claim-11")).toBeTruthy();
    // a specific member collapses it (web: openBoard returns [] off All/My Tasks/Open)
    await act(async () => {
      fireEvent.press(getByTestId("tasks-filter-Aurora"));
      await Promise.resolve();
    });
    expect(queryByText("Nothing up for grabs")).toBeTruthy();
    expect(queryByTestId("task-claim-11")).toBeNull();
  });

  it("undo takes a completion back through the claim seam (↩ affordance)", async () => {
    mockMember = kidUnder10;
    mockSnapshot = {
      tasks: [
        { id: 2, title: "Dishes", assignee: "Aurora", assigneeEmoji: "🧼", points: 10, completed: true, completedBy: "Aurora", completedInWeek: "2026-10-05", pendingApproval: { byName: "Aurora", at: "2026-10-10T10:00:00Z", points: 10 } },
      ],
      weekData: WEEK_DATA,
    };
    route({ "/api/tasks/claim": CLAIM_OK() });
    const { findByText, getByTestId, getByLabelText, findByTestId } = render(<TasksPage />, { wrapper: wrap });

    await act(async () => {
      fireEvent.press(getByTestId("tasks-completed-toggle"));
      await Promise.resolve();
    });
    await findByText("Waiting on approval · 1 chore");
    // the kid who completed it may take it back (a mistaken tap is never permanent)
    await act(async () => {
      fireEvent.press(getByTestId("task-undo-2"));
      await Promise.resolve();
    });
    expect(await findByTestId("tasks-pinpad")).toBeTruthy();
    typePin(getByLabelText, "1234");
    const calls = claimCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0][1].body).toEqual({
      operationId: expect.any(String),
      action: "undo",
      taskId: 2,
      memberName: "Aurora",
      pin: "1234",
    });
    expect(await findByText("Taken back — it's yours again.")).toBeTruthy();
  });

  it("the completed disclosure shows 'Done' chips and the COMPLETER, never the points tone", async () => {
    mockMember = kidUnder10;
    mockSnapshot = {
      tasks: [
        { id: 4, title: "Feed cat", assignee: "Aurora", assigneeEmoji: "🐱", points: 3, completed: true, completedBy: "Aurora", completedInWeek: "2026-10-05" },
      ],
      weekData: WEEK_DATA,
    };
    const { findAllByText, getByTestId } = render(<TasksPage />, { wrapper: wrap });
    await act(async () => {
      fireEvent.press(getByTestId("tasks-completed-toggle"));
      await Promise.resolve();
    });
    expect((await findAllByText("Done")).length).toBeGreaterThan(0);
    // the COMPLETER is the meta line (web completedByMeta), not the category
    expect((await findAllByText("Aurora")).length).toBeGreaterThan(0);
  });

  it("a 202 leaves a DURABLE in-flight marker until the sync pulse returns fresh rows", async () => {
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
      fireEvent.press(getByTestId("pending-row-1"));
      await Promise.resolve();
    });
    // the toast AND the marker (a transient toast next to an unmoved row is dishonest)
    expect(await findByText("Sent — the server will catch up.")).toBeTruthy();
    expect(getByTestId("tasks-in-flight")).toBeTruthy();
    expect(queryByTestId("tasks-in-flight")).not.toBeNull();
  });

  it("the completed stat follows BOTH sides of a completion under a member filter", async () => {
    mockMember = kidUnder10;
    // Bailey completed a chore assigned to Aurora: it belongs to both rows
    mockSnapshot = {
      tasks: [
        { id: 1, title: "Make bed", assignee: "Aurora", assigneeEmoji: "🧚", points: 5, completed: true, completedBy: "Bailey", completedInWeek: "2026-10-05" },
      ],
      weekData: WEEK_DATA,
    };
    const { getByTestId, getByText } = render(<TasksPage />, { wrapper: wrap });
    expect(getByTestId("tasks-stat-completed")).toBeTruthy();
    // My Tasks → Aurora: the row is hers by ASSIGNEE, so it counts
    await act(async () => {
      fireEvent.press(getByTestId("tasks-filter-Aurora"));
      await Promise.resolve();
    });
    expect(getByText("1")).toBeTruthy();
  });

  it("the guest banner never claims a saved copy and links to the Home rail", async () => {
    mockMember = null;
    const { findByText, getByTestId } = render(<TasksPage />, { wrapper: wrap });
    expect(await findByText(/Signed out — the family's chores live on the family server/)).toBeTruthy();
    await act(async () => {
      fireEvent.press(getByTestId("tasks-guest-banner"));
      await Promise.resolve();
    });
    expect(mockRouterPush).toHaveBeenCalledWith("/");
  });

  it("member chips scope the Pending board (My Tasks → the member → back)", async () => {
    mockMember = kidUnder10;
    kidSnapshot();
    const { findByText, getByTestId, queryByTestId } = render(<TasksPage />, { wrapper: wrap });

    await findByText("Make bed");
    expect(getByTestId("pending-row-1")).toBeTruthy();
    // signed-in default is My Tasks: Alex's row is not mine
    expect(queryByTestId("pending-row-3")).toBeNull();
    await act(async () => {
      fireEvent.press(getByTestId("tasks-filter-Alex"));
      await Promise.resolve();
    });
    expect(getByTestId("pending-row-3")).toBeTruthy();
    expect(queryByTestId("pending-row-1")).toBeNull();
    await act(async () => {
      fireEvent.press(getByTestId("tasks-filter-My Tasks"));
      await Promise.resolve();
    });
    expect(getByTestId("pending-row-1")).toBeTruthy();
    expect(queryByTestId("pending-row-3")).toBeNull();
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

describe("TasksPage — parent controls (WS-5)", () => {
  it("parent sees add chore and submits manage with an explicit assignee", async () => {
    mockMember = parent;
    parentSnapshot();
    route({
      "/api/tasks/manage": { success: true, operationId: "op-m", action: "add", reconciled: true },
      "/api/tasks/queue": { ok: true, rows: [] },
    });
    const { findByTestId, getByTestId, getByText } = render(<TasksPage />, { wrapper: wrap });
    await findByTestId("tasks-add-chore");
    fireEvent.press(getByTestId("tasks-add-chore"));
    expect(await findByTestId("add-chore-modal")).toBeTruthy();
    const title = getByTestId("add-chore-title");
    fireEvent.changeText(title, "Water plants");
    fireEvent.changeText(getByTestId("add-chore-assignee"), "Aurora");
    await act(async () => {
      fireEvent.press(getByTestId("add-chore-submit"));
      await Promise.resolve();
    });
    const calls = api.mock.calls.filter((c: any[]) => c[0] === "/api/tasks/manage");
    expect(calls).toHaveLength(1);
    expect(calls[0][1].body).toEqual(expect.objectContaining({ action: "add", task: expect.objectContaining({ title: "Water plants", assignee: "Aurora" }) }));
    expect(mockRefreshNow).toHaveBeenCalled();
  });

  it("add chore with a blank assignee never fires a write (no fabricated default)", async () => {
    mockMember = parent;
    parentSnapshot();
    route({
      "/api/tasks/manage": { success: true, operationId: "op-m", action: "add", reconciled: true },
      "/api/tasks/queue": { ok: true, rows: [] },
    });
    const { findByTestId, getByTestId } = render(<TasksPage />, { wrapper: wrap });
    await findByTestId("tasks-add-chore");
    fireEvent.press(getByTestId("tasks-add-chore"));
    expect(await findByTestId("add-chore-modal")).toBeTruthy();
    fireEvent.changeText(getByTestId("add-chore-title"), "Water plants");
    expect(getByTestId("add-chore-submit").props.accessibilityState?.disabled).toBe(true);
    await act(async () => {
      fireEvent.press(getByTestId("add-chore-submit"));
      await Promise.resolve();
    });
    expect(api.mock.calls.filter((c: any[]) => c[0] === "/api/tasks/manage")).toHaveLength(0);
  });

  it("parent submits a bonus to ledger — adjust with signed amount, PIN carried verbatim", async () => {
    mockMember = parent;
    parentSnapshot();
    route({
      "/api/tasks/ledger": { success: true, operationId: "op-l", action: "adjust", reconciled: true, weekData: WEEK_DATA, member: "Aurora", points: 10 },
      "/api/tasks/queue": { ok: true, rows: [] },
    });
    const { findByTestId, getByTestId } = render(<TasksPage />, { wrapper: wrap });
    await findByTestId("tasks-bonus-penalty");
    fireEvent.press(getByTestId("tasks-bonus-penalty"));
    expect(await findByTestId("bonus-modal")).toBeTruthy();
    fireEvent.changeText(getByTestId("bonus-target"), "Aurora");
    fireEvent.changeText(getByTestId("bonus-delta"), "5");
    fireEvent.changeText(getByTestId("bonus-reason"), "bonus");
    fireEvent.changeText(getByTestId("bonus-pin"), "1234");
    await act(async () => {
      fireEvent.press(getByTestId("bonus-submit"));
      await Promise.resolve();
    });
    const calls = api.mock.calls.filter((c: any[]) => c[0] === "/api/tasks/ledger");
    expect(calls).toHaveLength(1);
    // The server contract: ONE action ("adjust" takes a SIGNED amount — the
    // catalog "penalty" action requires an itemId the wall never has), the
    // PIN verbatim (never a guessed default), and no client-invented keys
    // (actorName/delta are not part of the parser's shape).
    expect(calls[0][1].body).toEqual({
      operationId: expect.any(String),
      action: "adjust",
      memberName: parent.name,
      targetMemberName: "Aurora",
      pin: "1234",
      amount: 5,
      reason: "bonus",
    });
    expect(mockRefreshNow).toHaveBeenCalled();
  });

  it("a negative delta still rides adjust — never the catalog penalty action", async () => {
    mockMember = parent;
    parentSnapshot();
    route({
      "/api/tasks/ledger": { success: true, operationId: "op-l", action: "adjust", reconciled: true, weekData: WEEK_DATA, member: "Aurora", points: 5 },
      "/api/tasks/queue": { ok: true, rows: [] },
    });
    const { findByTestId, getByTestId } = render(<TasksPage />, { wrapper: wrap });
    await findByTestId("tasks-bonus-penalty");
    fireEvent.press(getByTestId("tasks-bonus-penalty"));
    expect(await findByTestId("bonus-modal")).toBeTruthy();
    fireEvent.changeText(getByTestId("bonus-target"), "Aurora");
    fireEvent.changeText(getByTestId("bonus-delta"), "-5");
    fireEvent.changeText(getByTestId("bonus-pin"), "1234");
    await act(async () => {
      fireEvent.press(getByTestId("bonus-submit"));
      await Promise.resolve();
    });
    const calls = api.mock.calls.filter((c: any[]) => c[0] === "/api/tasks/ledger");
    expect(calls).toHaveLength(1);
    expect(calls[0][1].body).toEqual(expect.objectContaining({ action: "adjust", amount: -5 }));
    expect(calls[0][1].body).not.toHaveProperty("itemId");
  });

  it("an empty PIN never fires a ledger write (no guessed default)", async () => {
    mockMember = parent;
    parentSnapshot();
    route({
      "/api/tasks/ledger": { success: true, operationId: "op-l", action: "adjust", reconciled: true },
      "/api/tasks/queue": { ok: true, rows: [] },
    });
    const { findByTestId, getByTestId } = render(<TasksPage />, { wrapper: wrap });
    await findByTestId("tasks-bonus-penalty");
    fireEvent.press(getByTestId("tasks-bonus-penalty"));
    expect(await findByTestId("bonus-modal")).toBeTruthy();
    fireEvent.changeText(getByTestId("bonus-target"), "Aurora");
    fireEvent.changeText(getByTestId("bonus-delta"), "5");
    expect(getByTestId("bonus-submit").props.accessibilityState?.disabled).toBe(true);
    await act(async () => {
      fireEvent.press(getByTestId("bonus-submit"));
      await Promise.resolve();
    });
    expect(api.mock.calls.filter((c: any[]) => c[0] === "/api/tasks/ledger")).toHaveLength(0);
  });

  it("queued banner shows and cancel calls delete", async () => {
    mockMember = parent;
    parentSnapshot();
    route({
      "/api/tasks/queue": { ok: true, rows: [{ operationId: "op-q", action: "add", displayTarget: { title: "Queued chore" } }] },
    });
    const { findByTestId, getByTestId } = render(<TasksPage />, { wrapper: wrap });
    const banner = await findByTestId("tasks-queued-commands-banner");
    expect(banner).toBeTruthy();
    const cancel = await findByTestId("tasks-queue-cancel-op-q");
    await act(async () => {
      fireEvent.press(cancel);
      await Promise.resolve();
    });
    const calls = api.mock.calls.filter((c: any[]) => c[0] === "/api/tasks/queue" && c[1]?.method === "DELETE");
    expect(calls).toHaveLength(1);
    expect(calls[0][1].body).toEqual({ operationId: "op-q" });
  });
});
