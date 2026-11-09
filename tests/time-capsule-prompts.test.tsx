/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { StyleSheet } from "react-native";
import { act, fireEvent, render } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ThemeProvider } from "../src/theme/ThemeProvider";
import { ToastProvider } from "../src/ui/Toast";
import { MIN_TARGET_DP } from "../src/theme/tokens";
import {
  _resetCharacterThemeMemoryForTest,
  saveCharacterThemePrefs,
} from "../src/theme/characterTheme";
import TimeCapsuleRoute, {
  CAPSULE_PROMPTS,
  CAPSULE_REACTIONS,
} from "../app/time-capsule";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

const mockRouterPush = jest.fn();
const mockRouterReplace = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: mockRouterReplace,
    canGoBack: () => false,
  }),
  usePathname: () => "/time-capsule",
  useLocalSearchParams: () => ({}),
}));

const mockParent = {
  id: "p1",
  name: "Rebecca (Mom)",
  role: "parent",
  emoji: "🐱",
  color: "green",
};

let mockAuthRole: "parent" | "child" | "pet" | null = "parent";
let mockAuthMember: typeof mockParent | null = mockParent;

jest.mock("../src/state/AuthProvider", () => ({
  useAuth: () => ({
    member: mockAuthMember,
    role: mockAuthRole,
    hydrated: true,
    signOut: jest.fn(),
    poke: jest.fn(),
    pinRequiredFor: () => false,
  }),
}));

jest.mock("../src/state/SyncManager", () => ({
  useSync: () => ({
    stale: false,
    snapshot: { tasks: [], weekData: {}, rewards: [] },
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

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  _resetCharacterThemeMemoryForTest();
  mockAuthRole = "parent";
  mockAuthMember = mockParent;
});

describe("TimeCapsule — Guided Story Prompts & Keepsake Reactions", () => {
  it("renders the Guided Story Prompts Shelf with all 4 prompt cards adhering to tap target floors", async () => {
    const { findByTestId, getByTestId } = render(<TimeCapsuleRoute />, { wrapper: wrap });

    const shelf = await findByTestId("capsule-prompts-shelf");
    expect(shelf).toBeTruthy();

    expect(CAPSULE_PROMPTS).toHaveLength(4);

    for (const prompt of CAPSULE_PROMPTS) {
      const card = getByTestId(`capsule-prompt-${prompt.id}`);
      expect(card).toBeTruthy();
      const style = StyleSheet.flatten(card.props.style);
      expect(style.minHeight).toBeGreaterThanOrEqual(MIN_TARGET_DP);
      expect(style.minWidth).toBeGreaterThanOrEqual(MIN_TARGET_DP);
    }
  });

  it("pre-fills composer modal with prompt contents and seals birthday time capsule", async () => {
    const { findByTestId, getByTestId, findByText, findAllByText } = render(
      <TimeCapsuleRoute />,
      { wrapper: wrap }
    );

    // Tap Birthday Interview prompt
    await act(async () => {
      fireEvent.press(getByTestId("capsule-prompt-birthday"));
    });

    // Composer modal opens with prefilled title and prompt message
    const modal = await findByTestId("capsule-composer-modal");
    expect(modal).toBeTruthy();

    const titleInput = getByTestId("capsule-composer-title");
    expect(titleInput.props.value).toBe("Birthday Time Capsule");

    const messageInput = getByTestId("capsule-composer-message");
    expect(messageInput.props.value).toContain("My favorite song right now");

    // Save/seal capsule
    await act(async () => {
      fireEvent.press(getByTestId("capsule-composer-save"));
    });

    // Newly sealed capsule appears in list
    expect(await findByText("Birthday Time Capsule")).toBeTruthy();
    const cakeEmojis = await findAllByText("🎂");
    expect(cakeEmojis.length).toBeGreaterThanOrEqual(2);

    // Verify stored in AsyncStorage
    const stored = await AsyncStorage.getItem("@consuela/time_capsules_v1");
    expect(stored).toBeTruthy();
    expect(stored).toContain("Birthday Time Capsule");
  });

  it("tapping Proud Family Moment pre-fills 'Ready now' unlock and seals an unsealed capsule", async () => {
    const { findByTestId, getByTestId, findByText, findAllByText } = render(
      <TimeCapsuleRoute />,
      { wrapper: wrap }
    );

    await act(async () => {
      fireEvent.press(getByTestId("capsule-prompt-proud"));
    });

    expect(await findByTestId("capsule-composer-modal")).toBeTruthy();
    expect(getByTestId("capsule-composer-title").props.value).toBe("A Moment to Remember");

    await act(async () => {
      fireEvent.press(getByTestId("capsule-composer-save"));
    });

    expect(await findByText("A Moment to Remember")).toBeTruthy();
    // Since unlockLabel was "Ready now", it's unsealed immediately and displays Read button
    const readButtons = await findAllByText("📖 Read");
    expect(readButtons.length).toBeGreaterThanOrEqual(2);
  });

  it("renders 3 reaction pills on unlocked capsules with >= 64dp tap targets and increments reaction counts", async () => {
    const { findByTestId, getByTestId } = render(<TimeCapsuleRoute />, { wrapper: wrap });

    expect(await findByTestId("time-capsule-route")).toBeTruthy();

    // tc-2 is unlocked by default in DEFAULT_CAPSULES
    expect(getByTestId("capsule-card-tc-2")).toBeTruthy();

    expect(CAPSULE_REACTIONS).toHaveLength(3);

    for (const r of CAPSULE_REACTIONS) {
      const pill = getByTestId(`capsule-react-tc-2-${r.key}`);
      expect(pill).toBeTruthy();
      const style = StyleSheet.flatten(pill.props.style);
      expect(style.minHeight).toBeGreaterThanOrEqual(MIN_TARGET_DP);
      expect(style.minWidth).toBeGreaterThanOrEqual(MIN_TARGET_DP);
    }

    // Reaction pill initial counts: tc-2 has love: 2, touched: 1, party: 0
    expect(getByTestId("capsule-react-tc-2-love")).toBeTruthy();

    // Tap love reaction pill -> increments to 3
    await act(async () => {
      fireEvent.press(getByTestId("capsule-react-tc-2-love"));
    });

    const lovePillAfter = getByTestId("capsule-react-tc-2-love");
    expect(lovePillAfter.props.accessibilityLabel).toBe("Love reaction: 3");

    // Tap party reaction pill -> increments to 1
    await act(async () => {
      fireEvent.press(getByTestId("capsule-react-tc-2-party"));
    });

    const partyPillAfter = getByTestId("capsule-react-tc-2-party");
    expect(partyPillAfter.props.accessibilityLabel).toBe("Party reaction: 1");

    // Sealed capsule (tc-1) does NOT render reaction pills
    expect(() => getByTestId("capsule-react-tc-1-love")).toThrow();
  });

  it("triggers CelebrationOverlay on unsealing when character theme is enabled", async () => {
    await saveCharacterThemePrefs({ enabled: true, franchise: "all" });

    const { findByTestId, getByTestId, queryByTestId, findByText } = render(
      <TimeCapsuleRoute />,
      { wrapper: wrap }
    );

    expect(await findByTestId("time-capsule-route")).toBeTruthy();

    // Unseal tc-1 (sealed: true)
    await act(async () => {
      fireEvent.press(getByTestId("capsule-open-tc-1"));
    });

    // CelebrationOverlay triggers
    const celebration = await findByTestId("celebration-overlay");
    expect(celebration).toBeTruthy();
    expect(await findByText("Unsealed: School Year Predictions!")).toBeTruthy();

    // Dismiss celebration
    await act(async () => {
      fireEvent.press(getByTestId("celebration-dismiss"));
    });

    expect(queryByTestId("celebration-overlay")).toBeNull();

    // Now tc-1 is unsealed, so reactions are now visible on it
    expect(getByTestId("capsule-react-tc-1-love")).toBeTruthy();
  });

  it("does not trigger CelebrationOverlay on unsealing when character theme is disabled", async () => {
    // Character theme disabled
    await saveCharacterThemePrefs({ enabled: false });

    const { findByTestId, getByTestId, queryByTestId } = render(
      <TimeCapsuleRoute />,
      { wrapper: wrap }
    );

    expect(await findByTestId("time-capsule-route")).toBeTruthy();

    // Unseal tc-1
    await act(async () => {
      fireEvent.press(getByTestId("capsule-open-tc-1"));
    });

    // Celebration should NOT appear
    expect(queryByTestId("celebration-overlay")).toBeNull();

    // Reader modal opened for the unsealed capsule
    expect(await findByTestId("capsule-reader-modal")).toBeTruthy();
  });

  it("filters capsules by All, Sealed, and Opened", async () => {
    const { findByTestId, getByTestId, queryByTestId } = render(
      <TimeCapsuleRoute />,
      { wrapper: wrap }
    );

    expect(await findByTestId("time-capsule-route")).toBeTruthy();

    // Initially "all" shows both
    expect(getByTestId("capsule-card-tc-1")).toBeTruthy();
    expect(getByTestId("capsule-card-tc-2")).toBeTruthy();

    // Filter "sealed" -> shows tc-1, hides tc-2
    await act(async () => {
      fireEvent.press(getByTestId("capsule-filter-sealed"));
    });
    expect(getByTestId("capsule-card-tc-1")).toBeTruthy();
    expect(queryByTestId("capsule-card-tc-2")).toBeNull();

    // Filter "open" -> shows tc-2, hides tc-1
    await act(async () => {
      fireEvent.press(getByTestId("capsule-filter-open"));
    });
    expect(queryByTestId("capsule-card-tc-1")).toBeNull();
    expect(getByTestId("capsule-card-tc-2")).toBeTruthy();

    // Back to "all"
    await act(async () => {
      fireEvent.press(getByTestId("capsule-filter-all"));
    });
    expect(getByTestId("capsule-card-tc-1")).toBeTruthy();
    expect(getByTestId("capsule-card-tc-2")).toBeTruthy();
  });

  it("verifies interactive tap targets meet or exceed 64dp", async () => {
    const { findByTestId, getByTestId } = render(<TimeCapsuleRoute />, { wrapper: wrap });

    expect(await findByTestId("time-capsule-route")).toBeTruthy();

    // Add button: check inner button minHeight
    const addBtn = getByTestId("capsule-add-button");
    const addStyle = StyleSheet.flatten(addBtn.props.style);
    expect(addStyle.minHeight).toBeGreaterThanOrEqual(MIN_TARGET_DP);

    // Filter buttons
    for (const f of ["all", "sealed", "open"]) {
      const filterBtn = getByTestId(`capsule-filter-${f}`);
      const fStyle = StyleSheet.flatten(filterBtn.props.style);
      expect(fStyle.minHeight).toBeGreaterThanOrEqual(MIN_TARGET_DP);
      expect(fStyle.minWidth).toBeGreaterThanOrEqual(MIN_TARGET_DP);
    }

    // Open button
    const openBtn = getByTestId("capsule-open-tc-1");
    const openStyle = StyleSheet.flatten(openBtn.props.style);
    expect(openStyle.minHeight).toBeGreaterThanOrEqual(MIN_TARGET_DP);

    // Open composer to test preset buttons
    await act(async () => {
      fireEvent.press(addBtn);
    });

    for (const preset of ["Ready now", "In 1 Month", "In 6 Months", "In 1 Year"]) {
      const presetBtn = getByTestId(`capsule-preset-${preset}`);
      const pStyle = StyleSheet.flatten(presetBtn.props.style);
      expect(pStyle.minHeight).toBeGreaterThanOrEqual(MIN_TARGET_DP);
      expect(pStyle.minWidth).toBeGreaterThanOrEqual(MIN_TARGET_DP);
    }
  });
});
