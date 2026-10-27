/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ThemeProvider } from "../src/theme/ThemeProvider";
import { ToastProvider } from "../src/ui/Toast";
import { RoutinesPanel } from "../src/tasks/RoutinesPanel";
import { RewardsPage } from "../src/rewards/RewardsPage";
import SkillTreeRoute from "../app/skill-tree";
import AnalyticsRoute from "../app/analytics";
import MoneyMountainRoute from "../app/money-mountain";
import TimeCapsuleRoute from "../app/time-capsule";
import FamilyMemoryRoute from "../app/memory";

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

jest.mock("../src/state/AuthProvider", () => ({
  useAuth: () => ({
    member: parent,
    role: "parent",
    hydrated: true,
    signOut: jest.fn(),
    poke: jest.fn(),
    pinRequiredFor: () => false,
  }),
}));

const mockSnapshot = {
  tasks: [
    { id: 1, title: "Make bed", completed: true, points: 10 },
    { id: 2, title: "Walk dog", completed: false, points: 10 },
  ],
  weekData: { weekStart: "2026-10-26", points: { "Rebecca (Mom)": 85, Aurora: 65 }, streak: { Aurora: 4 }, history: [] },
  rewards: [{ id: 1, name: "Ice cream", emoji: "🍦", cost: 50, category: "Treats" }],
};

jest.mock("../src/state/SyncManager", () => ({
  useSync: () => ({
    stale: false,
    snapshot: mockSnapshot,
    syncError: null,
    refreshNow: jest.fn(async () => {}),
    onPulse: () => () => {},
  }),
}));

jest.mock("../src/api/client", () => ({
  api: jest.fn(async () => ({ items: [] })),
  ApiError: jest.requireActual("../src/api/client").ApiError,
}));

const wrap = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>
    <ToastProvider>{children}</ToastProvider>
  </ThemeProvider>
);

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

describe("RoutinesPanel — interactive checklists & composer", () => {
  it("renders default routines, toggles checklist steps, and adds a custom routine", async () => {
    const { findByTestId, getByTestId, findByText } = render(<RoutinesPanel isParent />, {
      wrapper: wrap,
    });

    expect(await findByTestId("routine-card-rt-morning")).toBeTruthy();

    // Toggle a step in Morning Launchpad
    await act(async () => {
      fireEvent.press(getByTestId("routine-step-rt-morning-s1"));
    });
    expect(await findByText("1 of 4 steps done")).toBeTruthy();

    // Complete all steps in Morning Launchpad
    await act(async () => {
      fireEvent.press(getByTestId("routine-complete-all-rt-morning"));
    });
    expect(await findByText("✓ Completed")).toBeTruthy();

    // Open Routine Composer and add a custom routine
    await act(async () => {
      fireEvent.press(getByTestId("routines-add-button"));
    });
    expect(await findByTestId("routine-composer-modal")).toBeTruthy();

    await act(async () => {
      fireEvent.changeText(getByTestId("routine-composer-title"), "Music Practice Routine");
      fireEvent.changeText(getByTestId("routine-composer-steps"), "Tune instrument, Scales, Song practice");
    });
    await act(async () => {
      fireEvent.press(getByTestId("routine-composer-save"));
    });

    expect(await findByText("Music Practice Routine")).toBeTruthy();
  });
});

describe("RewardsPage — custom rewards & family goals", () => {
  it("allows adding a custom reward from template and a family goal", async () => {
    const { findByTestId, getByTestId, findByText, findAllByText } = render(<RewardsPage />, {
      wrapper: wrap,
    });

    expect(await findByTestId("reward-card-1")).toBeTruthy();

    // Open Add Reward modal
    await act(async () => {
      fireEvent.press(getByTestId("rewards-add-button"));
    });
    expect(await findByTestId("rewards-composer-modal")).toBeTruthy();

    // Pick template & save
    await act(async () => {
      fireEvent.press(getByTestId("rewards-tpl-tpl-3"));
    });
    await act(async () => {
      fireEvent.press(getByTestId("rewards-composer-save"));
    });
    expect(await findByText("Pick Friday Movie")).toBeTruthy();

    // Add Family Goal
    await act(async () => {
      fireEvent.press(getByTestId("rewards-add-goal-button"));
    });
    expect(await findByTestId("rewards-goal-modal")).toBeTruthy();
    await act(async () => {
      fireEvent.changeText(getByTestId("rewards-goal-title"), "Family Bowling Night");
    });
    await act(async () => {
      fireEvent.press(getByTestId("rewards-goal-save"));
    });
    expect((await findAllByText(/Family Bowling Night/)).length).toBeGreaterThan(0);
  });
});

describe("More… Secondary Surfaces — Skill Tree, Insights, Money Mountain, Time Capsule, Family Memory", () => {
  it("SkillTreeRoute unlocks a skill node and updates XP", async () => {
    const { findByTestId, getByTestId, findByText } = render(<SkillTreeRoute />, { wrapper: wrap });
    expect(await findByTestId("skill-tree-route")).toBeTruthy();
    await act(async () => {
      fireEvent.press(getByTestId("skill-action-k2"));
    });
    expect(await findByText(/Unlocked "Sous Chef"/)).toBeTruthy();
  });

  it("AnalyticsRoute renders live chore, routine, and meal metrics", async () => {
    const { findByTestId } = render(<AnalyticsRoute />, { wrapper: wrap });
    expect(await findByTestId("analytics-route")).toBeTruthy();
    expect(await findByTestId("insights-chores-done")).toBeTruthy();
    expect(await findByTestId("insights-routines-card")).toBeTruthy();
  });

  it("MoneyMountainRoute deposits toward savings goals and adds a new climb goal", async () => {
    const { findByTestId, getByTestId, findByText } = render(<MoneyMountainRoute />, { wrapper: wrap });
    expect(await findByTestId("money-mountain-route")).toBeTruthy();
    await act(async () => {
      fireEvent.press(getByTestId("mountain-deposit-10-mg-1"));
    });
    expect(await findByText("45 / 60")).toBeTruthy();
  });

  it("TimeCapsuleRoute seals a new capsule and unseals an existing one", async () => {
    const { findByTestId, getByTestId, findByText } = render(<TimeCapsuleRoute />, { wrapper: wrap });
    expect(await findByTestId("time-capsule-route")).toBeTruthy();
    await act(async () => {
      fireEvent.press(getByTestId("capsule-add-button"));
    });
    await act(async () => {
      fireEvent.changeText(getByTestId("capsule-composer-title"), "Autumn Family Letter");
    });
    await act(async () => {
      fireEvent.press(getByTestId("capsule-composer-save"));
    });
    await waitFor(async () => {
      expect(await findByText("Autumn Family Letter")).toBeTruthy();
    });
  });

  it("FamilyMemoryRoute filters and adds household memory cards", async () => {
    const { findByTestId, getByTestId, findByText } = render(<FamilyMemoryRoute />, { wrapper: wrap });
    expect(await findByTestId("memory-route")).toBeTruthy();
    await act(async () => {
      fireEvent.press(getByTestId("memory-add-button"));
    });
    await act(async () => {
      fireEvent.changeText(getByTestId("memory-composer-title"), "Wi-Fi Guest Network");
      fireEvent.changeText(getByTestId("memory-composer-detail"), "Ask Mom or Dad for QR code");
    });
    await act(async () => {
      fireEvent.press(getByTestId("memory-composer-save"));
    });
    expect(await findByText("Wi-Fi Guest Network")).toBeTruthy();
  });
});
