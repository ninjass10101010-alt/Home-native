/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { ToastProvider } from "../src/ui/Toast";
import AnalyticsRoute from "../app/analytics";
import { computeCountdownDays } from "../src/calendar/countdowns";

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
  useRouter: () => ({ push: jest.fn(), replace: mockRouterReplace, canGoBack: () => false }),
  usePathname: () => "/analytics",
}));

const mockParent = {
  id: 1,
  name: "Dad",
  role: "parent" as const,
  emoji: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  color: "cyan",
};
const mockChild = {
  id: 2,
  name: "Aurora",
  role: "child" as const,
  emoji: "👧",
  color: "violet",
};

jest.mock("../src/state/AuthProvider", () => ({
  useAuth: () => ({
    member: mockParent,
    role: "parent",
    hydrated: true,
    signOut: jest.fn(),
    poke: jest.fn(),
    pinRequiredFor: () => false,
  }),
}));

const mockSnapshot = {
  tasks: [
    { id: 1, title: "Clean room", completed: true, points: 15 },
    { id: 2, title: "Walk dog", completed: false, points: 10 },
  ],
  weekData: {
    weekStart: "2026-10-26",
    points: {
      Dad: 120,
      Aurora: 85,
    },
    streak: {
      Aurora: 7, // 7-day streak => 7-Day Flame milestone!
      Dad: 1,
    },
    history: [],
  },
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

jest.mock("../src/api/members", () => {
  const actual = jest.requireActual("../src/api/members");
  return {
    ...actual,
    readCachedMembers: jest.fn(async () => [mockParent, mockChild]),
  };
});

const futureTarget = new Date();
futureTarget.setDate(futureTarget.getDate() + 5);
const futureTargetISO = `${futureTarget.getFullYear()}-${String(futureTarget.getMonth() + 1).padStart(2, "0")}-${String(futureTarget.getDate()).padStart(2, "0")}`;

let mockCountdownsData = [
  {
    id: "cd-1",
    title: "Disneyland Trip",
    targetDate: futureTargetISO,
    emoji: "🏰",
    tone: "cyan" as const,
    createdAt: "2026-10-01",
  },
];

jest.mock("../src/calendar/countdowns", () => {
  const actual = jest.requireActual("../src/calendar/countdowns");
  return {
    ...actual,
    useCountdowns: () => ({
      countdowns: mockCountdownsData,
      loading: false,
      addCountdown: jest.fn(),
      deleteCountdown: jest.fn(),
      refresh: jest.fn(),
    }),
  };
});

const mockKudosData = [
  {
    id: "k-1",
    fromName: "Mom",
    fromEmoji: "🐱",
    toName: "Aurora",
    toEmoji: "👧",
    message: "Helped clean up after dinner!",
    badgeId: "kind-heart" as const,
    createdAt: "2026-10-27T10:00:00Z",
  },
  {
    id: "k-2",
    fromName: "Dad",
    fromEmoji: "👨",
    toName: "Aurora",
    toEmoji: "👧",
    message: "Super helper with the groceries!",
    badgeId: "super-helper" as const,
    createdAt: "2026-10-28T10:00:00Z",
  },
];

jest.mock("../src/rewards/kudos-jar", () => {
  const actual = jest.requireActual("../src/rewards/kudos-jar");
  return {
    ...actual,
    useKudosJar: () => ({
      entries: mockKudosData,
      loaded: true,
      addEntry: jest.fn(),
      deleteEntry: jest.fn(),
      refresh: jest.fn(),
    }),
  };
});

const mockChecklistsData = [
  {
    id: "list-1",
    title: "School Backpack",
    emoji: "🎒",
    tone: "cyan" as const,
    items: [
      { id: "i1", label: "Folder", checked: true },
      { id: "i2", label: "Pencil case", checked: true },
      { id: "i3", label: "Water bottle", checked: false },
    ],
  },
  {
    id: "list-2",
    title: "Sports Gear",
    emoji: "⚽",
    tone: "mint" as const,
    items: [
      { id: "i4", label: "Cleats", checked: true },
      { id: "i5", label: "Jersey", checked: false },
    ],
  },
];

jest.mock("../src/tasks/custom-lists", () => {
  const actual = jest.requireActual("../src/tasks/custom-lists");
  return {
    ...actual,
    useCustomChecklists: () => ({
      lists: mockChecklistsData,
      loading: false,
      refresh: jest.fn(),
      toggleItem: jest.fn(),
      resetChecks: jest.fn(),
      addItem: jest.fn(),
      deleteItem: jest.fn(),
      createList: jest.fn(),
      deleteList: jest.fn(),
    }),
  };
});

const wrap = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>
    <ToastProvider>{children}</ToastProvider>
  </ThemeProvider>
);

describe("AnalyticsRoute — Family Insights Pulse & Digest", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders insights-family-pulse-card with Kindness Jar, Countdown, and Checklist summaries", async () => {
    const { findByTestId, findByText, getByText } = render(<AnalyticsRoute />, { wrapper: wrap });

    expect(await findByTestId("insights-family-pulse-card")).toBeTruthy();
    expect(await findByTestId("insights-pulse-kudos")).toBeTruthy();
    expect(await findByTestId("insights-pulse-countdown")).toBeTruthy();
    expect(await findByTestId("insights-pulse-checklists")).toBeTruthy();

    // Kindness Jar summary
    expect(await findByText("2 Kindness Stars in the Kudos Jar")).toBeTruthy();

    // Next countdown summary
    const expectedBadge = computeCountdownDays(futureTargetISO).badgeLabel;
    expect(await findByText(`🏰 Disneyland Trip · ${expectedBadge}`)).toBeTruthy();

    // Checklist readiness summary (3 packed out of 5 total across 2 lists)
    expect(await findByText("3/5 checklist items ready across 2 lists")).toBeTruthy();

    // Quick jump buttons
    await act(async () => {
      fireEvent.press(getByText("Open Rewards →"));
    });
    expect(mockRouterReplace).toHaveBeenCalledWith("/tasks?tab=leaderboard");

    await act(async () => {
      fireEvent.press(getByText("Open Calendar →"));
    });
    expect(mockRouterReplace).toHaveBeenCalledWith("/calendar");

    await act(async () => {
      fireEvent.press(getByText("Open Lists →"));
    });
    expect(mockRouterReplace).toHaveBeenCalledWith("/tasks");
  });

  it("renders earned habit milestone badge (7-Day Flame) and photo avatar safely", async () => {
    const { findByTestId, findByText, queryByTestId } = render(<AnalyticsRoute />, { wrapper: wrap });

    // Wait for member momentum card to render
    expect(await findByTestId("insights-members-card")).toBeTruthy();

    // Aurora has 7-day streak => 7-Day Flame badge
    expect(await findByTestId("insights-member-badge-Aurora")).toBeTruthy();
    expect(await findByText("🌟 7-Day Flame")).toBeTruthy();

    // Dad has a photo avatar (data:image/png;base64,...) => renders <Image testID="insights-member-img-Dad" />
    const dadImg = await findByTestId("insights-member-img-Dad");
    expect(dadImg).toBeTruthy();
    expect(dadImg.props.source).toEqual({ uri: mockParent.emoji });

    // Aurora has emoji avatar => no Image element rendered
    expect(queryByTestId("insights-member-img-Aurora")).toBeNull();
  });

  it("handles empty countdown gracefully with fallback prompt", async () => {
    mockCountdownsData = [];
    const { findByText } = render(<AnalyticsRoute />, { wrapper: wrap });

    expect(await findByText("No upcoming countdowns pinned")).toBeTruthy();
  });
});
