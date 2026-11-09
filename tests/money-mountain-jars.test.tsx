/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ThemeProvider } from "../src/theme/ThemeProvider";
import { ToastProvider } from "../src/ui/Toast";
import MoneyMountainRoute from "../app/money-mountain";
import {
  loadAllowanceJars,
  adjustAllowanceJar,
  _resetAllowanceJarsForTest,
  ALLOWANCE_JAR_META,
  DEFAULT_ALLOWANCE_JARS,
} from "../src/rewards/allowance-jars";
import { _resetCharacterThemeMemoryForTest } from "../src/theme/characterTheme";

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
  usePathname: () => "/money-mountain",
  useLocalSearchParams: () => ({}),
}));

const parent = { id: "p1", name: "Rebecca (Mom)", role: "parent", emoji: "🐱", color: "green" };

let mockMember: any = parent;
let mockRole: "parent" | "child" | "pet" | null = "parent";

jest.mock("../src/state/AuthProvider", () => ({
  useAuth: () => ({
    member: mockMember,
    role: mockRole,
    hydrated: true,
    signOut: jest.fn(),
    poke: jest.fn(),
    pinRequiredFor: () => false,
  }),
}));

const mockSnapshot = {
  tasks: [],
  weekData: { weekStart: "2026-10-26", points: { "Rebecca (Mom)": 85, Aurora: 65 }, history: [] },
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

describe("Allowance Jars — storage and balance unit tests", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    _resetAllowanceJarsForTest(null);
  });

  it("loads initial default balances (spend: 15, save: 40, give: 10)", async () => {
    expect(ALLOWANCE_JAR_META.length).toBe(3);
    expect(ALLOWANCE_JAR_META.map((m) => m.id)).toEqual(["spend", "save", "give"]);

    const jars = await loadAllowanceJars();
    expect(jars.spend).toBe(DEFAULT_ALLOWANCE_JARS.spend);
    expect(jars.save).toBe(DEFAULT_ALLOWANCE_JARS.save);
    expect(jars.give).toBe(DEFAULT_ALLOWANCE_JARS.give);
    expect(jars.history).toEqual([]);
  });

  it("adjustAllowanceJar increments and decrements balances and logs transaction history", async () => {
    const afterAdd = await adjustAllowanceJar("save", 5, "Chore reward transfer");
    expect(afterAdd.save).toBe(45);
    expect(afterAdd.history.length).toBe(1);
    expect(afterAdd.history[0].jar).toBe("save");
    expect(afterAdd.history[0].amount).toBe(5);
    expect(afterAdd.history[0].note).toBe("Chore reward transfer");
    expect(afterAdd.history[0].id).toBeTruthy();
    expect(afterAdd.history[0].createdAt).toBeTruthy();

    const afterSub = await adjustAllowanceJar("spend", -5);
    expect(afterSub.spend).toBe(10);
    expect(afterSub.history.length).toBe(2);
    expect(afterSub.history[0].jar).toBe("spend");
    expect(afterSub.history[0].amount).toBe(-5);
  });

  it("adjustAllowanceJar prevents balances from dropping below 0", async () => {
    const result = await adjustAllowanceJar("give", -100);
    expect(result.give).toBe(0);
  });

  it("supports _resetAllowanceJarsForTest with custom initial values", async () => {
    _resetAllowanceJarsForTest({
      spend: 50,
      save: 100,
      give: 25,
      history: [],
    });
    const state = await loadAllowanceJars();
    expect(state.spend).toBe(50);
    expect(state.save).toBe(100);
    expect(state.give).toBe(25);
  });
});

describe("MoneyMountainRoute — Allowance Jars & Summit Celebration Component Tests", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    _resetAllowanceJarsForTest(null);
    _resetCharacterThemeMemoryForTest({ enabled: true });
    mockMember = parent;
    mockRole = "parent";
  });

  it("renders 3-jar family allowance card with all 3 jars and balances", async () => {
    const { findByTestId, findByText } = render(<MoneyMountainRoute />, { wrapper: wrap });

    expect(await findByTestId("mountain-jars-card")).toBeTruthy();
    expect(await findByTestId("mountain-jar-spend")).toBeTruthy();
    expect(await findByTestId("mountain-jar-save")).toBeTruthy();
    expect(await findByTestId("mountain-jar-give")).toBeTruthy();

    expect(await findByText("Spend Jar")).toBeTruthy();
    expect(await findByText("Save Jar")).toBeTruthy();
    expect(await findByText("Give & Share Jar")).toBeTruthy();

    const spendBalance = await findByTestId("mountain-jar-balance-spend");
    expect(spendBalance.props.children).toBe("$15");
    expect(await findByText("$15")).toBeTruthy();

    const saveBalance = await findByTestId("mountain-jar-balance-save");
    expect(saveBalance.props.children).toBe("$40");
    expect(await findByText("$40")).toBeTruthy();

    const giveBalance = await findByTestId("mountain-jar-balance-give");
    expect(giveBalance.props.children).toBe("$10");
    expect(await findByText("$10")).toBeTruthy();
  });

  it("pressing mountain-jar-add5-save increments the Save Jar balance from 40 to 45", async () => {
    const { findByTestId, getByTestId, findByText } = render(<MoneyMountainRoute />, { wrapper: wrap });

    const saveBalance = await findByTestId("mountain-jar-balance-save");
    expect(saveBalance.props.children).toBe("$40");

    await act(async () => {
      fireEvent.press(getByTestId("mountain-jar-add5-save"));
    });

    expect(await findByText("$45")).toBeTruthy();
    expect(getByTestId("mountain-jar-balance-save").props.children).toBe("$45");
  });

  it("gates -5 button on isSignedIn (hidden for guest role, visible and operational for signed-in role)", async () => {
    // 1. Guest role -> isSignedIn is false -> sub5 button is null
    mockRole = null;
    const { findByTestId, queryByTestId, unmount } = render(<MoneyMountainRoute />, { wrapper: wrap });

    expect(await findByTestId("mountain-jars-card")).toBeTruthy();
    expect(queryByTestId("mountain-jar-sub5-save")).toBeNull();
    expect(queryByTestId("mountain-jar-sub5-spend")).toBeNull();
    expect(queryByTestId("mountain-jar-sub5-give")).toBeNull();

    unmount();

    // 2. Signed-in role -> sub5 button is visible and pressing it decrements
    mockRole = "parent";
    const signedInRender = render(<MoneyMountainRoute />, { wrapper: wrap });

    expect(await signedInRender.findByTestId("mountain-jar-sub5-spend")).toBeTruthy();
    expect(signedInRender.getByTestId("mountain-jar-balance-spend").props.children).toBe("$15");

    await act(async () => {
      fireEvent.press(signedInRender.getByTestId("mountain-jar-sub5-spend"));
    });

    expect(signedInRender.getByTestId("mountain-jar-balance-spend").props.children).toBe("$10");
  });

  it("reaching a goal summit triggers the celebration overlay and toast", async () => {
    const { findByTestId, getByTestId, findByText, queryByTestId } = render(<MoneyMountainRoute />, { wrapper: wrap });

    expect(await findByTestId("money-mountain-route")).toBeTruthy();
    // Initially mg-1 is 35 / 60
    expect(getByTestId("mountain-deposit-10-mg-1")).toBeTruthy();
    expect(queryByTestId("character-celebration-overlay")).toBeNull();

    // 1st deposit: 35 + 10 = 45 / 60
    await act(async () => {
      fireEvent.press(getByTestId("mountain-deposit-10-mg-1"));
    });
    expect(queryByTestId("character-celebration-overlay")).toBeNull();

    // 2nd deposit: 45 + 10 = 55 / 60
    await act(async () => {
      fireEvent.press(getByTestId("mountain-deposit-10-mg-1"));
    });
    expect(queryByTestId("character-celebration-overlay")).toBeNull();

    // 3rd deposit: 55 + 10 = 65 / 60 -> Summit reached!
    await act(async () => {
      fireEvent.press(getByTestId("mountain-deposit-10-mg-1"));
    });

    const celebration = await findByTestId("character-celebration-overlay");
    expect(celebration).toBeTruthy();
    expect(await findByText("Summit Reached: Collector Building Set!")).toBeTruthy();

    // Dismiss overlay
    await act(async () => {
      fireEvent.press(getByTestId("celebration-dismiss"));
    });

    expect(queryByTestId("character-celebration-overlay")).toBeNull();
  });
});
