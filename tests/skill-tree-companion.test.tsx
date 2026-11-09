/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ThemeProvider } from "../src/theme/ThemeProvider";
import { ToastProvider } from "../src/ui/Toast";
import SkillTreeRoute from "../app/skill-tree";
import {
  _resetCharacterThemeMemoryForTest,
  resolveCharacterForMember,
} from "../src/theme/characterTheme";
import { MIN_TARGET_DP } from "../src/theme/tokens";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

const mockRouterReplace = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockRouterReplace, push: jest.fn(), canGoBack: () => false }),
  usePathname: () => "/skill-tree",
  useLocalSearchParams: () => ({}),
}));

const mockMember = { id: "c1", name: "Aurora", role: "child", emoji: "🌸", color: "violet" };

jest.mock("../src/state/AuthProvider", () => ({
  useAuth: () => ({
    member: mockMember,
    role: "child",
    hydrated: true,
    signOut: jest.fn(),
    poke: jest.fn(),
    pinRequiredFor: () => false,
  }),
}));

const mockSnapshot = {
  tasks: [],
  weekData: { weekStart: "2026-10-26", points: { Aurora: 45 }, streak: { Aurora: 3 }, history: [] },
  rewards: [],
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

const wrap = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>
    <ToastProvider>{children}</ToastProvider>
  </ThemeProvider>
);

function getPropInHierarchy(node: any, prop: string): number | undefined {
  let cur = node;
  while (cur) {
    const s = cur.props?.style;
    if (s) {
      const flat = Array.isArray(s) ? Object.assign({}, ...s.flat(5)) : s;
      if (flat && typeof flat[prop] === "number") {
        return flat[prop];
      }
    }
    cur = cur.parent;
  }
  return undefined;
}

describe("/skill-tree — Companion Mastery & Branch Progress", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    _resetCharacterThemeMemoryForTest({
      enabled: false,
      franchise: "all",
      assignments: { aurora: "stitch" },
    });
  });

  it("renders the Companion Mastery Spotlight Banner with resolved companion", async () => {
    const { findByTestId, getByTestId } = render(<SkillTreeRoute />, { wrapper: wrap });

    expect(await findByTestId("skill-companion-banner")).toBeTruthy();

    const titleEl = getByTestId("skill-companion-title");
    expect(titleEl.props.children).toContain("Stitch");
    expect(titleEl.props.children).toContain("Quest Companion");

    const cheerEl = getByTestId("skill-companion-cheer");
    const stitch = resolveCharacterForMember("Aurora");
    expect(cheerEl.props.children).toBe(stitch.choreCheer);

    const peptalkBtn = getByTestId("skill-companion-peptalk");
    expect(peptalkBtn).toBeTruthy();
  });

  it("triggers CelebrationOverlay when Pep Talk is tapped and dismisses cleanly", async () => {
    const { findByTestId, getByTestId, queryByTestId } = render(<SkillTreeRoute />, { wrapper: wrap });

    expect(await findByTestId("skill-companion-peptalk")).toBeTruthy();
    expect(queryByTestId("character-celebration-overlay")).toBeNull();

    await act(async () => {
      fireEvent.press(getByTestId("skill-companion-peptalk"));
    });

    const overlay = await findByTestId("character-celebration-overlay");
    expect(overlay).toBeTruthy();

    const celebrationTitle = getByTestId("celebration-title");
    expect(celebrationTitle.props.children).toContain("Stitch believes in your next skill!");

    // Dismiss
    await act(async () => {
      fireEvent.press(getByTestId("celebration-dismiss"));
    });

    expect(queryByTestId("character-celebration-overlay")).toBeNull();
  });

  it("shows branch mastery pills and updates to '🏆 Branch Mastered!' when all nodes unlocked", async () => {
    const { findByTestId, getByTestId, getAllByText, findByText } = render(<SkillTreeRoute />, { wrapper: wrap });

    // Initial state: k1 and h1 are unlocked by default
    const kitchenMastery = await findByTestId("skill-branch-mastery-kitchen");
    expect(kitchenMastery).toBeTruthy();
    // Kitchen has 3 nodes, k1 is unlocked => "1/3 Mastered"
    // Home has 3 nodes, h1 is unlocked => "1/3 Mastered"
    expect(getAllByText("1/3 Mastered").length).toBe(2);
    expect(getAllByText("0/3 Mastered").length).toBe(2);

    // Unlock k2 ("Sous Chef")
    await act(async () => {
      fireEvent.press(getByTestId("skill-action-k2"));
    });
    expect(await findByText("2/3 Mastered")).toBeTruthy();

    // Unlock k3 ("Family Chef")
    await act(async () => {
      fireEvent.press(getByTestId("skill-action-k3"));
    });

    // Now all 3 nodes in kitchen are unlocked
    expect(await findByText("🏆 Branch Mastered!")).toBeTruthy();
    expect(getByTestId("skill-branch-mastery-kitchen")).toBeTruthy();
  });

  it("triggers CelebrationOverlay on skill unlock when character theme is enabled", async () => {
    _resetCharacterThemeMemoryForTest({
      enabled: true,
      franchise: "all",
      assignments: { aurora: "stitch" },
    });

    const { findByTestId, getByTestId } = render(<SkillTreeRoute />, { wrapper: wrap });

    expect(await findByTestId("skill-tree-route")).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId("skill-action-s1"));
    });

    // Unlocking Curious Reader triggers celebration overlay
    const overlay = await findByTestId("character-celebration-overlay");
    expect(overlay).toBeTruthy();
    const celebrationTitle = getByTestId("celebration-title");
    expect(celebrationTitle.props.children).toBe("Unlocked Curious Reader!");
  });

  it("does NOT trigger CelebrationOverlay on skill unlock when character theme is disabled", async () => {
    _resetCharacterThemeMemoryForTest({
      enabled: false,
      franchise: "all",
      assignments: { aurora: "stitch" },
    });

    const { findByTestId, getByTestId, queryByTestId } = render(<SkillTreeRoute />, { wrapper: wrap });

    expect(await findByTestId("skill-tree-route")).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId("skill-action-s1"));
    });

    expect(queryByTestId("character-celebration-overlay")).toBeNull();
  });

  it("practicing an already unlocked node gives XP without triggering celebration overlay", async () => {
    _resetCharacterThemeMemoryForTest({
      enabled: true,
      franchise: "all",
      assignments: { aurora: "stitch" },
    });

    const { findByTestId, getByTestId, queryByTestId, findByText } = render(<SkillTreeRoute />, {
      wrapper: wrap,
    });

    expect(await findByTestId("skill-tree-route")).toBeTruthy();

    // k1 is already unlocked
    await act(async () => {
      fireEvent.press(getByTestId("skill-action-k1"));
    });

    expect(queryByTestId("character-celebration-overlay")).toBeNull();
    expect(await findByText(/⚡ Practiced "Table Setter"! \+10 XP/)).toBeTruthy();
  });

  it("filters branches with branch filter pills and navigates to tasks", async () => {
    const { findByTestId, getByTestId, queryByTestId } = render(<SkillTreeRoute />, { wrapper: wrap });

    expect(await findByTestId("skill-branch-kitchen")).toBeTruthy();
    expect(getByTestId("skill-branch-home")).toBeTruthy();

    // Filter to kitchen only
    await act(async () => {
      fireEvent.press(getByTestId("skill-filter-kitchen"));
    });

    expect(getByTestId("skill-branch-kitchen")).toBeTruthy();
    expect(queryByTestId("skill-branch-home")).toBeNull();
    expect(queryByTestId("skill-branch-scholar")).toBeNull();
    expect(queryByTestId("skill-branch-teamwork")).toBeNull();

    // Filter back to all
    await act(async () => {
      fireEvent.press(getByTestId("skill-filter-all"));
    });

    expect(getByTestId("skill-branch-kitchen")).toBeTruthy();
    expect(getByTestId("skill-branch-home")).toBeTruthy();
    expect(getByTestId("skill-branch-scholar")).toBeTruthy();
    expect(getByTestId("skill-branch-teamwork")).toBeTruthy();

    // Navigate to tasks
    await act(async () => {
      fireEvent.press(getByTestId("skill-tree-to-tasks"));
    });
    expect(mockRouterReplace).toHaveBeenCalledWith("/tasks");
  });

  it("complies with the >= 64dp tap target floor for all interactive elements", async () => {
    const { findByTestId, getByTestId } = render(<SkillTreeRoute />, { wrapper: wrap });

    await findByTestId("skill-tree-route");

    const toTasks = getByTestId("skill-tree-to-tasks");
    expect(getPropInHierarchy(toTasks, "minHeight")).toBeGreaterThanOrEqual(MIN_TARGET_DP);
    expect(getPropInHierarchy(toTasks, "minWidth")).toBeGreaterThanOrEqual(MIN_TARGET_DP);

    const peptalk = getByTestId("skill-companion-peptalk");
    expect(getPropInHierarchy(peptalk, "minHeight")).toBeGreaterThanOrEqual(MIN_TARGET_DP);
    expect(getPropInHierarchy(peptalk, "minWidth")).toBeGreaterThanOrEqual(MIN_TARGET_DP);

    const nodeAction = getByTestId("skill-action-k1");
    expect(getPropInHierarchy(nodeAction, "minHeight")).toBeGreaterThanOrEqual(MIN_TARGET_DP);
    expect(getPropInHierarchy(nodeAction, "minWidth")).toBeGreaterThanOrEqual(MIN_TARGET_DP);

    const filterAll = getByTestId("skill-filter-all");
    expect(getPropInHierarchy(filterAll, "minHeight")).toBeGreaterThanOrEqual(MIN_TARGET_DP);
    expect(getPropInHierarchy(filterAll, "minWidth")).toBeGreaterThanOrEqual(MIN_TARGET_DP);

    const filterKitchen = getByTestId("skill-filter-kitchen");
    expect(getPropInHierarchy(filterKitchen, "minHeight")).toBeGreaterThanOrEqual(MIN_TARGET_DP);
    expect(getPropInHierarchy(filterKitchen, "minWidth")).toBeGreaterThanOrEqual(MIN_TARGET_DP);
  });
});
