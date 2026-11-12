/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ThemeProvider } from "../src/theme/ThemeProvider";
import { ToastProvider } from "../src/ui/Toast";
import { RoutinesPanel } from "../src/tasks/RoutinesPanel";
import { ALL_ROUTINE_DAYS } from "../src/tasks/routines-api";
import { type RoutineRosterMember } from "../src/tasks/routine-rules";
import { api } from "../src/api/client";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), canGoBack: () => false }),
  usePathname: () => "/",
  useLocalSearchParams: () => ({}),
}));

const mockRefreshNow = jest.fn(async () => {});
let mockPulseListeners: Array<() => void> = [];
let mockSnapshot: {
  tasks: Array<{
    id: number;
    title: string;
    assignee: string;
    assigneeEmoji: string;
    points: number;
    completed: boolean;
  }>;
  weekData: {
    weekStart: string;
    points: Record<string, number>;
    streak: Record<string, number>;
    lastActive: Record<string, string>;
  };
} | null = null;

jest.mock("../src/state/SyncManager", () => ({
  useSync: () => ({
    snapshot: mockSnapshot,
    syncState: "synced",
    lastSyncedAt: Date.now(),
    refreshNow: mockRefreshNow,
    onPulse: (cb: () => void) => {
      mockPulseListeners.push(cb);
      return () => {
        mockPulseListeners = mockPulseListeners.filter((x) => x !== cb);
      };
    },
  }),
}));

let mockAuthMember: {
  id: string;
  name: string;
  role: "parent" | "child" | "pet";
  emoji: string;
  color: string;
} | null = null;
let mockAuthRole: "parent" | "child" | "pet" | null = null;
const mockSignOut = jest.fn(async () => {});

jest.mock("../src/state/AuthProvider", () => {
  const actual = jest.requireActual("../src/state/AuthProvider");
  return {
    ...actual,
    useAuth: () => ({
      member: mockAuthMember,
      role: mockAuthRole,
      hydrated: true,
      signOut: mockSignOut,
      poke: jest.fn(),
    }),
  };
});

jest.mock("../src/api/auth", () => ({
  login: jest.fn(),
  quickLogin: jest.fn(),
  logout: jest.fn(async () => {}),
  whoami: jest.fn(async () => null),
  verifyPin: jest.fn(),
}));

const rosterMembers: RoutineRosterMember[] = [
  { id: "p1", name: "Rebecca (Mom)", fullName: "Rebecca Garcia", role: "parent", emoji: "👩" },
  { id: "p2", name: "Dad", fullName: "Dad", role: "parent", emoji: "🧔" },
  { id: "k1", name: "Aurora", fullName: "Aurora", role: "child", emoji: "🦊" },
];

jest.mock("../src/api/members", () => {
  const actual = jest.requireActual("../src/api/members");
  return {
    ...actual,
    getCachedMembersSync: () => [
      { id: "p1", name: "Rebecca (Mom)", role: "parent", emoji: "👩", color: "violet", hasPin: true },
      { id: "p2", name: "Dad", role: "parent", emoji: "🧔", color: "blue", hasPin: true },
      { id: "k1", name: "Aurora", role: "child", emoji: "🦊", color: "amber", hasPin: false },
    ],
    listMembersSmart: jest.fn(async () => ({
      members: [
        { id: "p1", name: "Rebecca (Mom)", role: "parent", emoji: "👩", color: "violet", hasPin: true },
        { id: "p2", name: "Dad", role: "parent", emoji: "🧔", color: "blue", hasPin: true },
        { id: "k1", name: "Aurora", role: "child", emoji: "🦊", color: "amber", hasPin: false },
      ],
    })),
  };
});

jest.mock("../src/api/client", () => {
  class ApiError extends Error {
    status: number;
    code: string;
    constructor(opts: { message: string; status?: number; code?: string }) {
      super(opts.message);
      this.status = opts.status ?? 500;
      this.code = opts.code ?? "api_error";
    }
  }
  return { api: jest.fn(), ApiError };
});

const mockApi = api as jest.MockedFunction<typeof api>;

const wrap = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>
    <ToastProvider>{children}</ToastProvider>
  </ThemeProvider>
);

const kidRoutine = {
  id: "rt-kid",
  title: "Morning Kid Launch",
  slot: "morning" as const,
  emoji: "☀️",
  color: "color-accent-amber" as const,
  time: "7:30 AM",
  assignee: "Aurora",
  assigneeMemberIds: ["k1"],
  daysOfWeek: [...ALL_ROUTINE_DAYS],
  points: 10,
  missedPenalty: 5,
  requiresApproval: false,
  steps: [
    { id: "s1", title: "Brush teeth", emoji: "🪥", minutes: 3 },
    { id: "s2", title: "Pack bag", emoji: "🎒", minutes: 4 },
  ],
};

const dadRoutine = {
  id: "rt-adult",
  title: "Parent Evening Reset",
  slot: "evening" as const,
  emoji: "🌙",
  color: "color-accent-violet" as const,
  time: "8:30 PM",
  assignee: "Adults",
  daysOfWeek: [...ALL_ROUTINE_DAYS],
  points: 15,
  missedPenalty: 10,
  requiresApproval: false,
  steps: [{ id: "st-a1", title: "Lock doors & tidy", emoji: "🔐", minutes: 5 }],
};

const defaultSettings = {
  defaultPoints: 10,
  defaultMissedPenalty: 5,
  accountabilityEnabled: true,
  parentCountsTowardRace: true,
  defaultRequiresApproval: false,
  streakBonusEveryDays: 5,
  streakBonusPoints: 15,
};

const baseAccountability = {
  lastEvaluatedDate: "2026-11-10",
  streaks: {
    aurora: { current: 2, longest: 4, lastCompletedDate: "2026-11-10" },
    "rebecca (mom)": { current: 3, longest: 5, lastCompletedDate: "2026-11-10" },
  },
  missedEntries: [
    {
      id: "miss-1",
      date: "2026-11-10",
      routineId: "rt-adult",
      routineTitle: "Parent Evening Reset",
      routineEmoji: "🌙",
      memberKey: "dad",
      memberName: "Dad",
      deductedPoints: 10,
      excused: false,
    },
  ],
};

beforeEach(async () => {
  jest.clearAllMocks();
  mockPulseListeners = [];
  await AsyncStorage.clear();
  mockSnapshot = {
    tasks: [
      { id: 1, title: "Make bed", assignee: "Aurora", assigneeEmoji: "🛏️", points: 5, completed: false },
    ],
    weekData: {
      weekStart: "2026-11-09",
      points: { "Rebecca (Mom)": 40, Dad: 20, Aurora: 50 },
      streak: { Aurora: 2 },
      lastActive: {},
    },
  };
});

describe("Routines home loops & cross-device sync contracts", () => {
  it("Guest view gates RoutineSettingsModal behind RoutineParentPinModal and sends x-admin-pin on PIN entry", async () => {
    mockAuthMember = null;
    mockAuthRole = null;

    mockApi.mockImplementation(async (path: string, opts?: { method?: string }) => {
      if (path === "/api/routines" && (!opts?.method || opts.method === "GET")) {
        return {
          ok: true,
          routines: [dadRoutine],
          settings: defaultSettings,
          accountability: { ...baseAccountability, missedEntries: [] },
          todayISO: "2026-11-11",
        };
      }
      if (path.startsWith("/api/routines/progress") && (!opts?.method || opts.method === "GET")) {
        return {
          ok: true,
          date: "2026-11-11",
          progress: { checkedSteps: {}, completedRoutines: {}, memberCheckedSteps: {}, memberCompleted: {} },
          settings: defaultSettings,
          accountability: { ...baseAccountability, missedEntries: [] },
          todayISO: "2026-11-11",
        };
      }
      return {
        ok: true,
        routines: [dadRoutine],
        settings: defaultSettings,
        accountability: { ...baseAccountability, missedEntries: [] },
      };
    });

    const { findByTestId, getByTestId, getByLabelText, queryByTestId } = render(
      <RoutinesPanel rosterMembers={rosterMembers} isParent={false} />,
      { wrapper: wrap },
    );

    expect(await findByTestId("routines-settings-button")).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId("routines-settings-button"));
    });
    await act(async () => {
      fireEvent.press(getByTestId("routine-settings-save"));
    });

    expect(await findByTestId("routine-parent-pin-modal")).toBeTruthy();
    expect(mockApi).not.toHaveBeenCalledWith(
      "/api/routines",
      expect.objectContaining({ method: "POST" }),
    );

    for (const digit of ["1", "2", "3", "4"]) {
      await act(async () => {
        fireEvent.press(getByLabelText(digit));
      });
    }

    expect(mockApi).toHaveBeenCalledWith(
      "/api/routines",
      expect.objectContaining({
        method: "POST",
        headers: { "x-admin-pin": "1234" },
        body: expect.objectContaining({ action: "update_settings" }),
      }),
    );
    expect(queryByTestId("routine-parent-pinpad")).toBeNull();
  });
});
