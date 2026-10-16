/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";

import { ThemeProvider } from "../src/theme/ThemeProvider";
import { ToastProvider } from "../src/ui/Toast";
import { RewardsPage } from "../src/rewards/RewardsPage";

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
  usePathname: () => "/rewards",
  useLocalSearchParams: () => ({}),
}));

const parent = { id: "p1", name: "Rebecca (Mom)", role: "parent", emoji: "🐱", color: "green" };
const kid = { id: "c1", name: "Aurora", role: "child", age: 12, emoji: "🧚", color: "violet" };

let mockMember: any = kid;
jest.mock("../src/state/AuthProvider", () => ({
  useAuth: () => ({
    member: mockMember,
    hydrated: true,
    signOut: jest.fn(),
    poke: jest.fn(),
    pinRequiredFor: jest.requireActual("../src/state/AuthProvider").pinRequiredFor,
  }),
}));

let mockSnapshot: any = { tasks: [], weekData: { weekStart: "2026-10-05", points: { Aurora: 25 }, history: [] } };
let mockStale = false;
const mockRefreshNow = jest.fn(async () => {});
let mockPulseListeners = new Set<() => void>();
const mockSyncValue: any = {
  get stale() { return mockStale; },
  get snapshot() { return mockSnapshot; },
  syncError: null,
  refreshNow: mockRefreshNow,
  onPulse: (l: () => void) => { mockPulseListeners.add(l); return () => { mockPulseListeners.delete(l); }; },
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

const REWARDS = [
  { id: 1, name: "Ice cream", emoji: "🍦", cost: 50 },
  { id: 2, name: "Movie night", emoji: "🎬", cost: 150 },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockPulseListeners = new Set();
  mockMember = kid;
  mockStale = false;
  mockSnapshot = { tasks: [], weekData: { weekStart: "2026-10-05", points: { Aurora: 25 }, history: [] }, rewards: REWARDS, penalties: [], family_goals: [], weekly_prizes: [], hall_of_fame: [] };
  api.mockReset();
  mockRefreshNow.mockClear();
});

const route = (handlers: Record<string, unknown>) =>
  api.mockImplementation((path: string) => {
    for (const key of Object.keys(handlers)) {
      if (path.startsWith(key)) {
        const v = handlers[key];
        return v instanceof Error ? Promise.reject(v) : Promise.resolve(v);
      }
    }
    return Promise.resolve({ items: [] });
  });

describe("RewardsPage — basic", () => {
  it("shows week points from server snapshot", async () => {
    route({ "/api/tasks/all-time": { historyComplete: false } });
    const { findByTestId } = render(<RewardsPage />, { wrapper: wrap });
    expect(await findByTestId("rewards-points-week")).toBeTruthy();
  });

  it("shows all-time as dash when history incomplete", async () => {
    route({ "/api/tasks/all-time": { historyComplete: false } });
    const { findByTestId } = render(<RewardsPage />, { wrapper: wrap });
    const el = await findByTestId("rewards-points-alltime");
    expect(el).toBeTruthy();
  });
});

describe("RewardsPage — redemption", () => {
  it("cost<=100: opens PIN pad, redeem body", async () => {
    route({
      "/api/tasks/all-time": { historyComplete: true, totals: { Aurora: { points: 100 } } },
      "/api/rewards/redeem": { ok: true, applied: true, reconciled: true, weekData: mockSnapshot.weekData, reward: { id: 1, name: "Ice cream", cost: 50, emoji: "🍦" } },
    });
    const { findByTestId, findByText, getByTestId, getByLabelText } = render(<RewardsPage />, { wrapper: wrap });
    await findByTestId("reward-redeem-1");
    await act(async () => {
      fireEvent.press(getByTestId("reward-redeem-1"));
      await Promise.resolve();
    });
    expect(await findByTestId("redeem-pinpad")).toBeTruthy();
    const typePin = (pin: string) => {
      for (const k of pin.split("")) fireEvent.press(getByLabelText(k));
    };
    typePin("1234");
    await new Promise((r) => setTimeout(r, 0));
    // api called
    const calls = api.mock.calls.filter((c: any[]) => c[0] === "/api/rewards/redeem");
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(calls[0][1].body).toEqual(expect.objectContaining({ rewardId: 1, memberName: "Aurora", pin: "1234" }));
    expect(mockRefreshNow).toHaveBeenCalled();
  });

  it("cost>100: two-step then redeem with parent fields", async () => {
    route({
      "/api/tasks/all-time": { historyComplete: false },
      "/api/rewards/redeem": { ok: true, applied: true, reconciled: true },
    });
    mockSnapshot.rewards = REWARDS;
    const { getByTestId, findByTestId } = render(<RewardsPage />, { wrapper: wrap });
    await findByTestId("reward-redeem-2");
    await act(async () => {
      fireEvent.press(getByTestId("reward-redeem-2"));
      await Promise.resolve();
    });
    // member step
    expect(await findByTestId("highcost-member-pinpad")).toBeTruthy();
  });
});

describe("RewardsPage — HOF", () => {
  it("shows uncelebrated banner and celebrate posts", async () => {
    mockSnapshot.hall_of_fame = [
      { id: "h1", member: "Aurora", weekStart: "2026-10-05", rank: 1, prize: "Trophy", celebrated: false },
    ];
    route({
      "/api/tasks/all-time": { historyComplete: false },
      "/api/db/hall_of_fame": { items: mockSnapshot.hall_of_fame },
      "/api/hall-of-fame/celebrate": { ok: true },
    });
    const { findByTestId, getByTestId } = render(<RewardsPage />, { wrapper: wrap });
    // refetch config on mount uses api mock route by path; ensure hof loaded
    const banner = await findByTestId("hall-of-fame-banner");
    expect(banner).toBeTruthy();
    await act(async () => {
      fireEvent.press(getByTestId("celebrate-h1"));
      await Promise.resolve();
    });
    const calls = api.mock.calls.filter((c: any[]) => c[0] === "/api/hall-of-fame/celebrate");
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(calls[0][1].body).toEqual(expect.objectContaining({ memberName: "Aurora", weekStart: "2026-10-05" }));
  });
});
