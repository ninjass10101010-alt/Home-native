/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { ToastProvider } from "../src/ui/Toast";
import { RewardsPage } from "../src/rewards/RewardsPage";
import {
  addKudosEntry,
  deleteKudosEntry,
  loadKudosJar,
  _resetKudosJarForTest,
  KUDOS_BADGES,
  KUDOS_QUICK_MESSAGES,
} from "../src/rewards/kudos-jar";
import { isPhotoUri } from "../src/ui/MemberRail";

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

const photoDataUri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

const parent = { id: "p1", name: "Mom", role: "parent", emoji: "🐱", color: "green" };
const kidWithPhoto = { id: "c1", name: "Aurora", role: "child", emoji: photoDataUri, color: "violet" };

let mockMember: any = kidWithPhoto;
let mockRole: any = "child";

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
  tasks: [],
  weekData: { weekStart: "2026-10-05", points: { Aurora: 25 }, history: [] },
  rewards: [],
  penalties: [],
  family_goals: [],
  weekly_prizes: [],
  hall_of_fame: [],
};

const mockRefreshNow = jest.fn(async () => {});
let mockPulseListeners = new Set<() => void>();
const mockSyncValue: any = {
  get stale() { return false; },
  get snapshot() { return mockSnapshot; },
  syncError: null,
  refreshNow: mockRefreshNow,
  onPulse: (l: () => void) => {
    mockPulseListeners.add(l);
    return () => { mockPulseListeners.delete(l); };
  },
};

jest.mock("../src/state/SyncManager", () => ({
  useSync: () => mockSyncValue,
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

describe("kudos-jar — storage unit tests", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    _resetKudosJarForTest(null);
  });

  it("loads empty jar initially and defines standard badges and quick messages", async () => {
    expect(KUDOS_BADGES.length).toBe(4);
    expect(KUDOS_QUICK_MESSAGES.length).toBe(4);
    const list = await loadKudosJar();
    expect(list).toEqual([]);
  });

  it("adds entries and persists to cache and AsyncStorage", async () => {
    const entry = await addKudosEntry({
      fromName: "Mom",
      fromEmoji: "🐱",
      toName: "Aurora",
      toEmoji: "🧚",
      badgeId: "kind-heart",
      message: "Helped out without being asked!",
    });

    expect(entry.id).toBeTruthy();
    expect(entry.createdAt).toBeTruthy();
    expect(entry.message).toBe("Helped out without being asked!");

    const loaded = await loadKudosJar();
    expect(loaded.length).toBe(1);
    expect(loaded[0].id).toBe(entry.id);
    expect(loaded[0].toName).toBe("Aurora");
  });

  it("deletes entries by id and persists", async () => {
    const e1 = await addKudosEntry({
      fromName: "Mom",
      fromEmoji: "🐱",
      toName: "Aurora",
      toEmoji: "🧚",
      badgeId: "kind-heart",
      message: "First entry",
    });
    const e2 = await addKudosEntry({
      fromName: "Dad",
      fromEmoji: "👨",
      toName: "Aurora",
      toEmoji: "🧚",
      badgeId: "bright-spark",
      message: "Second entry",
    });

    let current = await loadKudosJar();
    expect(current.length).toBe(2);

    const deleted = await deleteKudosEntry(e1.id);
    expect(deleted).toBe(true);

    current = await loadKudosJar();
    expect(current.length).toBe(1);
    expect(current[0].id).toBe(e2.id);

    const deletedAgain = await deleteKudosEntry("non-existent");
    expect(deletedAgain).toBe(false);
  });
});

describe("RewardsPage — KudosJarCard integration", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    _resetKudosJarForTest(null);
    mockMember = kidWithPhoto;
    mockRole = "child";
    mockSnapshot = {
      tasks: [],
      weekData: { weekStart: "2026-10-05", points: { Aurora: 25 }, history: [] },
      rewards: [],
      penalties: [],
      family_goals: [],
      weekly_prizes: [],
      hall_of_fame: [],
    };
  });

  it("renders Kudos Jar card with initial empty state and Kindness Stars count", async () => {
    const { findByTestId, getByText } = render(<RewardsPage />, { wrapper: wrap });

    const card = await findByTestId("rewards-kudos-jar-card");
    expect(card).toBeTruthy();

    const countPill = await findByTestId("kudos-jar-count");
    expect(countPill).toBeTruthy();
    expect(getByText("0 Kindness Stars")).toBeTruthy();
    expect(getByText("The Kindness Jar is empty")).toBeTruthy();
  });

  it("opens modal, selects recipient, badge, preset, and submits kudos", async () => {
    const { findByTestId, getByTestId, findByText } = render(<RewardsPage />, { wrapper: wrap });

    // Open modal
    const openBtn = await findByTestId("kudos-send-open");
    await act(async () => {
      fireEvent.press(openBtn);
    });

    const modal = await findByTestId("kudos-send-modal");
    expect(modal).toBeTruthy();

    // Select recipient
    const recipientChip = await findByTestId("kudos-to-Mom");
    await act(async () => {
      fireEvent.press(recipientChip);
    });

    // Select badge
    const badgeChip = await findByTestId("kudos-badge-super-helper");
    await act(async () => {
      fireEvent.press(badgeChip);
    });

    // Select quick preset message
    const presetChip = await findByTestId("kudos-preset-0");
    await act(async () => {
      fireEvent.press(presetChip);
    });

    // Verify input contains preset message
    const input = getByTestId("kudos-message-input");
    expect(input.props.value).toBe(KUDOS_QUICK_MESSAGES[0]);

    // Submit
    const submitBtn = getByTestId("kudos-send-submit");
    await act(async () => {
      fireEvent.press(submitBtn);
    });

    // Verify star count updated
    expect(await findByText("1 Kindness Star")).toBeTruthy();

    // Verify entry displayed
    const list = await loadKudosJar();
    expect(list.length).toBe(1);
    const entryId = list[0].id;

    const entryCard = await findByTestId(`kudos-entry-${entryId}`);
    expect(entryCard).toBeTruthy();
    expect(await findByText(KUDOS_QUICK_MESSAGES[0])).toBeTruthy();
    expect(await findByText("Super Helper")).toBeTruthy();
  });

  it("safely handles photo-URI avatars with <Image> instead of crashing", async () => {
    expect(isPhotoUri(photoDataUri)).toBe(true);
    expect(isPhotoUri("🐱")).toBe(false);

    // Pre-populate with an entry containing a photo URI
    await addKudosEntry({
      fromName: "Aurora",
      fromEmoji: photoDataUri,
      toName: "Mom",
      toEmoji: "🐱",
      badgeId: "kind-heart",
      message: "Shared & took turns so kindly!",
    });

    const { findByTestId } = render(<RewardsPage />, { wrapper: wrap });

    const entries = await loadKudosJar();
    const entryId = entries[0].id;

    const fromAvatar = await findByTestId(`kudos-from-avatar-${entryId}`);
    expect(fromAvatar).toBeTruthy();
    // For a photo URI, it renders an Image with source={{ uri: photoDataUri }}
    expect(fromAvatar.props.source).toEqual({ uri: photoDataUri });
  });

  it("enforces parent capability gating for delete button", async () => {
    const entry = await addKudosEntry({
      fromName: "Mom",
      fromEmoji: "🐱",
      toName: "Aurora",
      toEmoji: "🧚",
      badgeId: "team-player",
      message: "Great teamwork today!",
    });

    // 1. As child (role !== 'parent') -> delete button does not exist
    mockRole = "child";
    mockMember = kidWithPhoto;
    const { findByTestId, queryByTestId, unmount } = render(<RewardsPage />, { wrapper: wrap });

    expect(await findByTestId(`kudos-entry-${entry.id}`)).toBeTruthy();
    expect(queryByTestId(`kudos-delete-${entry.id}`)).toBeNull();

    unmount();

    // 2. As parent (role === 'parent') -> delete button exists and works
    mockRole = "parent";
    mockMember = parent;
    const parentRender = render(<RewardsPage />, { wrapper: wrap });

    const deleteBtn = await parentRender.findByTestId(`kudos-delete-${entry.id}`);
    expect(deleteBtn).toBeTruthy();

    await act(async () => {
      fireEvent.press(deleteBtn);
    });

    expect(parentRender.queryByTestId(`kudos-entry-${entry.id}`)).toBeNull();
    const remaining = await loadKudosJar();
    expect(remaining.length).toBe(0);
  });
});
