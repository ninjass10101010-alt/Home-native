/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";

import { ThemeProvider } from "../src/theme/ThemeProvider";
import { ToastProvider } from "../src/ui/Toast";
import { KidHome, POINTS_PER_LEVEL, kidLevel } from "../src/home/KidHome";
import { crewTaskIdsOf, kidEmoji, kidPoints, kidQuestsFor, kidStreak } from "../src/home/kid-quest";
import HomeRoute from "../app/index";

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
  usePathname: () => "/",
}));

const kidUnder10 = { id: "c1", name: "Aurora", role: "child", age: 8, emoji: "🧚", color: "violet" };
const kidOver10 = { id: "c2", name: "Alex", role: "child", age: 12, emoji: "🐻", color: "amber" };
const pet = { id: "p2", name: "Drogon", role: "pet", emoji: "🐕", color: "green" };
const adult = { id: "p1", name: "Rebecca (Mom)", role: "parent", emoji: "🐱", color: "green" };

let mockMember: any = adult;
const mockSignOut = jest.fn(async () => {});
jest.mock("../src/state/AuthProvider", () => {
  const real = jest.requireActual("../src/state/AuthProvider");
  return {
    useAuth: () => ({
      member: mockMember,
      hydrated: true,
      signOut: mockSignOut,
      poke: jest.fn(),
      pinRequiredFor: real.pinRequiredFor,
    }),
    pinRequiredFor: real.pinRequiredFor,
  };
});

let mockSnapshot: any = null;
let mockStale = false;
let mockLastSyncAt: number | null = null;
const mockRefreshNow = jest.fn(async () => {});
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
  onPulse: (l: () => void) => () => {},
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

jest.mock("../src/api/members", () => ({
  listMembersSmart: jest.fn(async () => ({
    members: [
      { name: "Rebecca (Mom)", role: "parent", emoji: "🐱", color: "green" },
      { name: "Aurora", role: "child", age: 8, emoji: "🧚", color: "violet" },
    ],
    source: "live",
  })),
}));

const wrap = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>
    <ToastProvider>{children}</ToastProvider>
  </ThemeProvider>
);

/** Path-prefix router for the mocked api() (tasks-page.test.tsx pattern). */
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

// Fixtures — the REAL server shapes (tasks-page.test.tsx parity): a queued kid
// tap lands as completed:true + pendingApproval; a crew chore carries crewSize.
const KID_TASKS = [
  { id: 1, title: "Make bed", assignee: "Aurora", assigneeEmoji: "🛏️", points: 5, completed: false },
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
  { id: 5, title: "Garage clean-out", assignee: "Aurora", assigneeEmoji: "🧹", points: 20, completed: false, crewSize: 3 },
];

const ALEX_TASKS = [
  { id: 3, title: "Empty trash", assignee: "Alex", assigneeEmoji: "🗑️", points: 5, completed: false },
];

const WEEK_DATA = {
  weekStart: "2026-10-05",
  points: { "Rebecca (Mom)": 40, Aurora: 108, Alex: 55, Drogon: 3 },
  streak: { Aurora: 3, Alex: 1 },
  lastActive: {},
};

const EMPTY_WEEK = { weekStart: "2026-10-05", points: {}, streak: {}, lastActive: {} };
const LOAD_ERROR_COPY = "Couldn't load your quests right now.";

const kidSnapshot = () => {
  mockSnapshot = { tasks: KID_TASKS, weekData: WEEK_DATA };
};

const CLAIM_OK = (extra: Record<string, unknown> = {}) => ({
  success: true,
  operationId: "op-1",
  action: "complete",
  task: { ...KID_TASKS[0], completed: true, pendingApproval: { byName: "Aurora", at: "2026-10-10T10:00:00Z", points: 5 } },
  pending: true,
  reconciled: true,
  ...extra,
});

const typePin = (getByLabelText: (id: string) => any, pin: string) => {
  for (const k of pin) fireEvent.press(getByLabelText(k));
};

const claimCalls = () => api.mock.calls.filter((c: any[]) => c[0] === "/api/tasks/claim");

beforeEach(() => {
  jest.clearAllMocks();
  mockMember = adult;
  mockSnapshot = null;
  mockStale = false;
  mockLastSyncAt = null;
  api.mockReset();
});

describe("kid-quest helpers", () => {
  it("kidLevel ports the web math: floor(points / 50) + 1", () => {
    expect(POINTS_PER_LEVEL).toBe(50);
    expect(kidLevel(0)).toBe(1);
    expect(kidLevel(49)).toBe(1);
    expect(kidLevel(50)).toBe(2);
    expect(kidLevel(108)).toBe(3);
  });

  it("kidLevel honestly refuses non-finite input", () => {
    expect(kidLevel(NaN)).toBe(1);
    expect(kidLevel(Number.POSITIVE_INFINITY)).toBe(1);
    expect(kidLevel(-5)).toBe(1);
  });

  it("kidPoints reads the exact FULL name key — first names never collide (Alex ≠ Alexandra)", () => {
    expect(kidPoints(WEEK_DATA as any, "Alex")).toBe(55);
    expect(kidPoints(WEEK_DATA as any, "Aurora")).toBe(108);
    expect(kidPoints(WEEK_DATA as any, "Nobody")).toBe(0);
    expect(kidPoints(undefined, "Aurora")).toBe(0);
  });

  it("kidStreak reads the exact full-name key; missing → 0", () => {
    expect(kidStreak(WEEK_DATA as any, "Aurora")).toBe(3);
    expect(kidStreak(WEEK_DATA as any, "Alex")).toBe(1);
    expect(kidStreak(WEEK_DATA as any, "Rebecca (Mom)")).toBe(0);
  });

  it("kidQuestsFor keeps only the signed-in kid's rows: open or pendingApproval", () => {
    const quests = kidQuestsFor(KID_TASKS, "Aurora");
    expect(quests.map((q) => q.id)).toEqual([1, 2, 5]);
    // another kid's open chore and the plain-completed row never surface
    expect(quests.some((q) => q.id === 3)).toBe(false);
    expect(quests.some((q) => q.id === 4)).toBe(false);
  });

  it("crewTaskIdsOf flags crew chores by the web isCrewTask rule (crewSize >= 2)", () => {
    expect(crewTaskIdsOf(KID_TASKS).has(5)).toBe(true);
    expect(crewTaskIdsOf(KID_TASKS).has(1)).toBe(false);
  });

  it("hero emoji NEVER renders photo data URLs (the 1 MiB incident rule)", () => {
    expect(kidEmoji("data:image/jpeg;base64,AAAA")).toBe("👤");
    expect(kidEmoji("🧚")).toBe("🧚");
    expect(kidEmoji("")).toBe("👤");
  });
});

describe("KidHome — hero", () => {
  it("shows the member emoji, greeting, week points, streak and level chip", async () => {
    mockMember = kidUnder10;
    kidSnapshot();
    const { getByTestId, getByText, queryByTestId } = render(<KidHome />, { wrapper: wrap });

    expect(getByTestId("kid-home")).toBeTruthy();
    expect(getByTestId("kid-emoji")).toBeTruthy();
    expect(getByText("Hi Aurora 👋")).toBeTruthy();
    // week points for the EXACT full name key (108 → ⭐ Level 3 by the ported math)
    expect(getByText("108")).toBeTruthy();
    expect(getByText("⭐ Level 3 this week")).toBeTruthy();
    // 🔥3-day streak!
    expect(getByText(/3-day streak/)).toBeTruthy();
    expect(queryByTestId("kid-stale")).toBeNull();
  });

  it("data-URL roster emoji collapses to the silhouette in the hero", async () => {
    mockMember = { ...kidUnder10, emoji: "data:image/jpeg;base64,AAAA" };
    kidSnapshot();
    const { getByTestId } = render(<KidHome />, { wrapper: wrap });
    expect(getByTestId("kid-emoji").props.children).toBe("👤");
  });

  it("no points key yet → honest zero, level 1; no streak row when streak is 0", async () => {
    mockMember = kidUnder10;
    mockSnapshot = { tasks: [], weekData: EMPTY_WEEK };
    const { getByText, queryByText } = render(<KidHome />, { wrapper: wrap });
    expect(getByText("0")).toBeTruthy();
    expect(getByText("⭐ Level 1 this week")).toBeTruthy();
    expect(queryByText(/day streak/)).toBeNull();
  });

  it("stale honesty on the wall board when the sync layer reports staleness", async () => {
    mockMember = kidUnder10;
    kidSnapshot();
    mockStale = true;
    const { getByTestId, getByText } = render(<KidHome />, { wrapper: wrap });
    expect(getByTestId("kid-stale")).toBeTruthy();
    expect(getByText("Showing your saved copy — couldn't refresh.")).toBeTruthy();
  });
});

describe("KidHome — quests", () => {
  it("first sync in flight (no snapshot yet) → honest loading, never a fake celebration", async () => {
    mockMember = kidUnder10;
    mockSnapshot = null; // no snapshot AND no sync attempt has landed yet
    const { getByTestId, queryByText } = render(<KidHome />, { wrapper: wrap });
    expect(getByTestId("kid-loading")).toBeTruthy();
    expect(queryByText("All quests complete!")).toBeNull();
  });

  it("sync answered with no snapshot → honest error + Try again refreshes", async () => {
    mockMember = kidUnder10;
    mockSnapshot = null;
    mockLastSyncAt = Date.now();
    const { findByText, getByText } = render(<KidHome />, { wrapper: wrap });
    expect(await findByText(LOAD_ERROR_COPY)).toBeTruthy();
    await act(async () => {
      fireEvent.press(getByText("Try again"));
      await Promise.resolve();
    });
    expect(mockRefreshNow).toHaveBeenCalled();
  });

  it("lists only the kid's own quests (open + waiting), never siblings' or plain-completed rows", async () => {
    mockMember = kidUnder10;
    kidSnapshot();
    const { findByText, queryByText } = render(<KidHome />, { wrapper: wrap });

    await findByText("Make bed");
    expect(await findByText("Dishes")).toBeTruthy(); // pendingApproval stays visible
    expect(queryByText("Empty trash")).toBeNull();
    expect(queryByText("Feed cat")).toBeNull();
  });

  it("empty quest list → the all-quests-complete celebration state", async () => {
    mockMember = kidUnder10;
    mockSnapshot = { tasks: [], weekData: WEEK_DATA };
    const { findByText, getByText } = render(<KidHome />, { wrapper: wrap });
    expect(await findByText("All quests complete!")).toBeTruthy();
    expect(getByText("You're a superstar! Check back later for new ones.")).toBeTruthy();
  });

  it("under-10 kid: ✓ tap sends the session-claim body exactly (operationId/action/taskId, NO pin)", async () => {
    mockMember = kidUnder10;
    kidSnapshot();
    route({ "/api/tasks/claim": CLAIM_OK() });
    const { findByText, getByTestId } = render(<KidHome />, { wrapper: wrap });

    await findByText("Make bed");
    await act(async () => {
      fireEvent.press(getByTestId("kid-quest-1"));
      await Promise.resolve();
    });
    const calls = claimCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0][1].method).toBe("POST");
    expect(calls[0][1].body).toEqual({ operationId: expect.any(String), action: "complete", taskId: 1 });
    expect(calls[0][1].body.operationId).toMatch(UUID_RE);
    expect("pin" in calls[0][1].body).toBe(false);
    expect(await findByText("Nice work — sent for approval.")).toBeTruthy();
    expect(mockRefreshNow).toHaveBeenCalled();
  });

  it("10+ kid: ✓ opens the quest PIN pad first, then the claim carries memberName + pin", async () => {
    mockMember = kidOver10;
    mockSnapshot = { tasks: ALEX_TASKS, weekData: WEEK_DATA };
    route({
      "/api/tasks/claim": {
        success: true,
        reconciled: true,
        task: { ...ALEX_TASKS[0], completed: true, pendingApproval: { byName: "Alex", at: "", points: 5 } },
      },
    });
    const { findByText, getByTestId, getByLabelText } = render(<KidHome />, { wrapper: wrap });

    await findByText("Empty trash");
    await act(async () => {
      fireEvent.press(getByTestId("kid-quest-3"));
      await Promise.resolve();
    });
    expect(getByTestId("kid-pinpad")).toBeTruthy();
    expect(claimCalls()).toHaveLength(0); // nothing sends before the PIN lands
    typePin(getByLabelText, "1234");
    expect(await findByText("Nice work — sent for approval.")).toBeTruthy();
    const calls = claimCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0][1].body).toEqual({
      operationId: expect.any(String),
      action: "complete",
      taskId: 3,
      memberName: "Alex",
      pin: "1234",
    });
    expect(mockRefreshNow).toHaveBeenCalled();
  });

  it("pendingApproval rows show the waiting state and CANNOT be completed (press → no claim, no pad)", async () => {
    mockMember = kidUnder10;
    kidSnapshot();
    const { findByText, getByText, getAllByText, getByTestId, queryByTestId } = render(<KidHome />, {
      wrapper: wrap,
    });

    await findByText("Dishes");
    expect(getAllByText("⏳ Waiting for approval").length).toBeGreaterThan(0);
    expect(getByText("⏳ approval")).toBeTruthy();
    fireEvent.press(getByTestId("kid-quest-2"));
    expect(api).not.toHaveBeenCalled();
    expect(queryByTestId("kid-pinpad")).toBeNull();
  });

  it("crew chores render read-only with the Tasks-page referral, never completable here", async () => {
    mockMember = kidUnder10;
    kidSnapshot();
    const { findByText, getByText, getByTestId, queryByTestId } = render(<KidHome />, { wrapper: wrap });

    await findByText("Garage clean-out");
    expect(getByText("See the Tasks page")).toBeTruthy();
    expect(queryByTestId("kid-quest-5")).toBeNull(); // no ✓ affordance on a crew row
    fireEvent.press(getByTestId("kid-crew-5"));
    expect(api).not.toHaveBeenCalled();
  });

  it("202 durably queued → honest catching-up toast, never an instant-apply claim", async () => {
    mockMember = kidUnder10;
    kidSnapshot();
    route({
      "/api/tasks/claim": {
        success: false,
        queued: true,
        operationId: "op-q",
        action: "complete",
        reason: "task_store_unavailable",
      },
    });
    const { findByText, getByTestId } = render(<KidHome />, { wrapper: wrap });

    await findByText("Make bed");
    await act(async () => {
      fireEvent.press(getByTestId("kid-quest-1"));
      await Promise.resolve();
    });
    expect(await findByText("Sent — the server will catch up.")).toBeTruthy();
    expect(mockRefreshNow).toHaveBeenCalled();
  });

  it("wrong PIN (10+) → pad stays with the honest error; the claim did not apply", async () => {
    mockMember = kidOver10;
    mockSnapshot = { tasks: ALEX_TASKS, weekData: WEEK_DATA };
    api.mockImplementation((path: string) => {
      if (path !== "/api/tasks/claim")
        return Promise.reject(new ApiError({ message: "unmapped", status: 404, code: "not_found" }));
      return Promise.reject(
        new ApiError({ message: "unauthorized", status: 401, code: "unauthorized", body: { success: false, reason: "unauthorized" } })
      );
    });
    const { findByText, getByTestId, getByLabelText, queryByText } = render(<KidHome />, { wrapper: wrap });

    await findByText("Empty trash");
    await act(async () => {
      fireEvent.press(getByTestId("kid-quest-3"));
      await Promise.resolve();
    });
    getByTestId("kid-pinpad");
    typePin(getByLabelText, "9999");
    expect(await findByText("Wrong PIN — try again.")).toBeTruthy();
    expect(queryByText(/Nice work/)).toBeNull();
    expect(mockRefreshNow).not.toHaveBeenCalled();
  });

  it("a dead under-10 session (401, no pad path) → honest 'Sign in again' toast, never silence", async () => {
    mockMember = kidUnder10;
    kidSnapshot();
    route({
      "/api/tasks/claim": new ApiError({
        message: "unauthorized",
        status: 401,
        code: "unauthorized",
        body: { success: false, reason: "unauthorized" },
      }),
    });
    const { findByText, getByTestId } = render(<KidHome />, { wrapper: wrap });

    await findByText("Make bed");
    await act(async () => {
      fireEvent.press(getByTestId("kid-quest-1"));
      await Promise.resolve();
    });
    expect(await findByText("Sign in again to finish that.")).toBeTruthy();
  });
});

describe("KidHome — Switch member", () => {
  it("the Switch member control signs out to the family rail", async () => {
    mockMember = kidUnder10;
    kidSnapshot();
    const { findByText, getByTestId } = render(<KidHome />, { wrapper: wrap });
    await findByText("Make bed");
    await act(async () => {
      fireEvent.press(getByTestId("kid-switch"));
      await Promise.resolve();
    });
    expect(mockSignOut).toHaveBeenCalled();
  });
});

describe("app/index — home mode switch", () => {
  it("a signed-in child renders KidHome, NOT the family bento wall", async () => {
    mockMember = kidUnder10;
    kidSnapshot();
    const screen = render(<HomeRoute />, { wrapper: wrap });
    expect(screen.getByTestId("kid-home")).toBeTruthy();
    expect(screen.queryByTestId("wall-grid")).toBeNull();
  });

  it("a signed-in pet renders KidHome too (child/pet → kid mode)", async () => {
    mockMember = pet;
    mockSnapshot = { tasks: [], weekData: WEEK_DATA };
    const screen = render(<HomeRoute />, { wrapper: wrap });
    expect(screen.getByTestId("kid-home")).toBeTruthy();
    expect(screen.queryByTestId("wall-grid")).toBeNull();
  });

  it("an adult keeps the family bento HomeWall", async () => {
    mockMember = adult;
    mockSnapshot = { tasks: [], weekData: WEEK_DATA };
    const screen = render(<HomeRoute />, { wrapper: wrap });
    expect(await screen.findByTestId("wall-grid")).toBeTruthy();
    expect(screen.queryByTestId("kid-home")).toBeNull();
  });

  it("guest (signed out) keeps the family bento — kid mode never gates a guest", async () => {
    mockMember = null;
    const screen = render(<HomeRoute />, { wrapper: wrap });
    expect(await screen.findByTestId("wall-grid")).toBeTruthy();
    expect(screen.queryByTestId("kid-home")).toBeNull();
  });
});
