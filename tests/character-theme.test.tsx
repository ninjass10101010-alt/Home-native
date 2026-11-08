/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ThemeProvider } from "../src/theme/ThemeProvider";
import { ToastProvider } from "../src/ui/Toast";
import {
  _resetCharacterThemeMemoryForTest,
  assignCharacterToMember,
  CHARACTER_CATALOG,
  CHARACTER_THEME_STORAGE_KEY,
  charactersForFranchise,
  loadCharacterThemePrefs,
  resolveCharacterForMember,
  saveCharacterThemePrefs,
} from "../src/theme/characterTheme";
import { _resetScreensaverMemoryForTest } from "../src/home/idle";
import { CelebrationOverlay } from "../src/ui/CelebrationOverlay";
import { SettingsPage } from "../src/settings/SettingsPage";
import { TasksPage } from "../src/tasks/TasksPage";
import { RewardsPage } from "../src/rewards/RewardsPage";
import { Screensaver } from "../src/screensaver/Screensaver";

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
  useRouter: () => ({ push: mockRouterPush, replace: jest.fn(), back: jest.fn(), canGoBack: () => false }),
  usePathname: () => "/settings",
  useLocalSearchParams: () => ({}),
}));

const parentMember = { id: "p1", name: "Rebecca (Mom)", role: "parent", emoji: "🐱", color: "green" };
const kidUnder10 = { id: "c1", name: "Aurora", role: "child", age: 8, emoji: "🌸", color: "violet" };

let mockMember: any = parentMember;
let mockRole: "parent" | "child" | "pet" | null = "parent";
jest.mock("../src/state/AuthProvider", () => ({
  useAuth: () => ({
    member: mockMember,
    role: mockRole,
    hydrated: true,
    signOut: jest.fn(),
    poke: jest.fn(),
    pinRequiredFor: jest.requireActual("../src/state/AuthProvider").pinRequiredFor,
  }),
}));

let mockSnapshot: any = {
  tasks: [
    { id: 1, title: "Make bed", assignee: "Aurora", assigneeEmoji: "🛏️", points: 10, completed: false },
  ],
  weekData: { weekStart: "2026-10-05", points: { Aurora: 50 }, streak: {}, lastActive: {} },
  rewards: [{ id: 1, name: "Disney Movie Night", emoji: "🍿", cost: 40 }],
  penalties: [],
  family_goals: [],
  weekly_prizes: [],
  hall_of_fame: [],
};
const mockRefreshNow = jest.fn(async () => {});
const mockSyncValue = {
  stale: false,
  get snapshot() {
    return mockSnapshot;
  },
  lastSyncAt: Date.now(),
  syncError: null,
  refreshNow: mockRefreshNow,
  onPulse: () => () => {},
};
jest.mock("../src/state/SyncManager", () => ({
  useSync: () => mockSyncValue,
}));

jest.mock("../src/api/client", () => ({
  api: jest.fn(),
  ApiError: jest.requireActual("../src/api/client").ApiError,
}));
const { api } = jest.requireMock("../src/api/client") as { api: jest.Mock };

const wrap = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>
    <ToastProvider>{children}</ToastProvider>
  </ThemeProvider>
);

const flush = () => act(async () => {});

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  _resetScreensaverMemoryForTest();
  _resetCharacterThemeMemoryForTest();
  mockMember = parentMember;
  mockRole = "parent";
  api.mockReset();
});

describe("Character Theme Engine (Disney Mode)", () => {
  it("ships 16 iconic characters across Disney, Pixar, Marvel, and Star Wars", () => {
    expect(CHARACTER_CATALOG).toHaveLength(16);
    expect(charactersForFranchise("disney").length).toBeGreaterThanOrEqual(4);
    expect(charactersForFranchise("pixar").length).toBeGreaterThanOrEqual(4);
    expect(charactersForFranchise("marvel").length).toBeGreaterThanOrEqual(4);
    expect(charactersForFranchise("starwars").length).toBeGreaterThanOrEqual(3);
  });

  it("persists enabled state, franchise filter, and per-member character assignments", async () => {
    await saveCharacterThemePrefs({ enabled: true, franchise: "disney" });
    await assignCharacterToMember("Aurora", "elsa");

    const raw = await AsyncStorage.getItem(CHARACTER_THEME_STORAGE_KEY);
    expect(raw).toBeTruthy();

    const loaded = await loadCharacterThemePrefs();
    expect(loaded.enabled).toBe(true);
    expect(loaded.franchise).toBe("disney");
    const resolved = resolveCharacterForMember("Aurora", loaded);
    expect(resolved.id).toBe("elsa");
    expect(resolved.name).toBe("Queen Elsa");
  });
});

describe("CelebrationOverlay component", () => {
  it("renders vector emblem, character cheer, and points, then dismisses on button press", async () => {
    _resetCharacterThemeMemoryForTest({
      enabled: true,
      assignments: { aurora: "stitch" },
    });
    const onDismiss = jest.fn();
    const { getByTestId, getByText } = render(
      <CelebrationOverlay
        event={{ kind: "chore", memberName: "Aurora", title: "Clean playroom", points: 15 }}
        onDismiss={onDismiss}
        autoDismissMs={0}
      />,
      { wrapper: wrap }
    );
    await flush();

    expect(getByTestId("character-celebration-overlay")).toBeTruthy();
    expect(getByTestId("character-emblem-stitch")).toBeTruthy();
    expect(getByTestId("celebration-character-name").props.children).toBe("Disney · Stitch");
    expect(getByText("Clean playroom")).toBeTruthy();
    expect(getByTestId("celebration-points").props.children).toContain("+15 pts for Aurora");

    fireEvent.press(getByTestId("celebration-dismiss"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe("SettingsPage — Disney & Character Mode capability gating", () => {
  it("parent can toggle Disney & Character Mode on, filter by franchise, and pick a companion", async () => {
    mockMember = parentMember;
    mockRole = "parent";
    const { getByTestId, findByTestId } = render(<SettingsPage />, { wrapper: wrap });
    await flush();

    fireEvent.press(getByTestId("settings-section-appearance"));
    expect(await findByTestId("settings-character-mode-card")).toBeTruthy();

    // Parent toggles Character Mode ON
    fireEvent.press(getByTestId("settings-character-mode-toggle"));
    await flush();

    expect(getByTestId("settings-character-pack-disney")).toBeTruthy();
    expect(getByTestId("settings-character-screensaver-toggle")).toBeTruthy();

    // Pick Moana and open live celebration preview
    fireEvent.press(getByTestId("settings-character-pick-moana"));
    await flush();
    fireEvent.press(getByTestId("settings-character-preview"));
    expect(await findByTestId("settings-celebration-preview-overlay")).toBeTruthy();
  });

  it("kid cannot toggle master switch (parent capability gate), but can pick their own companion when enabled", async () => {
    _resetCharacterThemeMemoryForTest({ enabled: true });
    mockMember = kidUnder10;
    mockRole = "child";
    const { getByTestId, queryByTestId, findByTestId } = render(<SettingsPage />, { wrapper: wrap });
    await flush();

    fireEvent.press(getByTestId("settings-section-appearance"));
    expect(await findByTestId("settings-character-mode-card")).toBeTruthy();

    // Master switch is parent-only
    expect(queryByTestId("settings-character-mode-toggle")).toBeNull();
    expect(getByTestId("settings-character-mode-status")).toBeTruthy();

    // Kid can still choose their personal character companion
    fireEvent.press(getByTestId("settings-character-pick-grogu"));
    await waitFor(async () => {
      const loaded = await loadCharacterThemePrefs();
      expect(resolveCharacterForMember("Aurora", loaded).id).toBe("grogu");
    });
  });
});

describe("TasksPage & RewardsPage & Screensaver — Disney Mode touchpoints", () => {
  it("TasksPage shows companion banner and fires celebration overlay when kid completes a chore", async () => {
    _resetCharacterThemeMemoryForTest({
      enabled: true,
      assignments: { aurora: "elsa" },
    });
    mockMember = kidUnder10;
    mockRole = "child";
    api.mockResolvedValue({
      success: true,
      operationId: "op-disney-1",
      action: "complete",
      task: { ...mockSnapshot.tasks[0], completed: true },
      pending: true,
      reconciled: true,
    });

    const { findByTestId, getByTestId } = render(<TasksPage />, { wrapper: wrap });
    expect(await findByTestId("tasks-character-companion")).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId("pending-row-1"));
      await Promise.resolve();
    });

    expect(await findByTestId("character-celebration-overlay")).toBeTruthy();
    expect(getByTestId("character-emblem-elsa")).toBeTruthy();
  });

  it("RewardsPage fires character reward celebration when a kid redeems a reward", async () => {
    _resetCharacterThemeMemoryForTest({
      enabled: true,
      assignments: { aurora: "spiderman" },
    });
    mockMember = { ...kidUnder10, age: 12 };
    mockRole = "child";
    api.mockImplementation((path: string) => {
      if (path.startsWith("/api/tasks/all-time")) {
        return Promise.resolve({ historyComplete: true, totals: { Aurora: { points: 100 } } });
      }
      if (path.startsWith("/api/rewards/redeem")) {
        return Promise.resolve({
          ok: true,
          applied: true,
          reconciled: true,
          weekData: mockSnapshot.weekData,
          reward: mockSnapshot.rewards[0],
        });
      }
      return Promise.resolve({ items: [] });
    });

    const { findByTestId, getByTestId, getByLabelText } = render(<RewardsPage />, { wrapper: wrap });
    await findByTestId("reward-redeem-1");

    await act(async () => {
      fireEvent.press(getByTestId("reward-redeem-1"));
      await Promise.resolve();
    });

    await findByTestId("redeem-pinpad");
    for (const digit of ["1", "2", "3", "4"]) {
      fireEvent.press(getByLabelText(digit));
    }

    expect(await findByTestId("character-celebration-overlay")).toBeTruthy();
    expect(getByTestId("character-emblem-spiderman")).toBeTruthy();
  });

  it("Screensaver displays the ambient Character Spotlight when enabled", async () => {
    _resetCharacterThemeMemoryForTest({
      enabled: true,
      franchise: "disney",
      screensaverSpotlight: true,
    });
    api.mockResolvedValue({
      ok: true,
      generatedAt: "2026-10-11T11:04:00Z",
      date: "2026-10-11",
      events: [],
      dinner: { name: "Pizza Night" },
      tasks: { done: 2, total: 3 },
      briefing: ["All quiet"],
      weather: null,
    });

    const { findByTestId } = render(<Screensaver />, { wrapper: wrap });
    expect(await findByTestId("ss-character-spotlight")).toBeTruthy();
    expect(await findByTestId("ss-character-spotlight-title")).toBeTruthy();
    expect(await findByTestId("ss-character-spotlight-quote")).toBeTruthy();
  });
});

