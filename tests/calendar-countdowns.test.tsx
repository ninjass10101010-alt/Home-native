/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { CalendarPage } from "../src/calendar/CalendarPage";
import {
  computeCountdownDays,
  loadCountdowns,
  addCountdown,
  deleteCountdown,
  _resetCountdownsForTest,
  COUNTDOWN_PRESETS,
} from "../src/calendar/countdowns";

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
  usePathname: () => "/calendar",
}));

let mockMember: any = { id: "p1", name: "Rebecca (Mom)", role: "parent", emoji: "🐱" };
jest.mock("../src/state/AuthProvider", () => ({
  useAuth: () => ({
    member: mockMember,
    role: mockMember ? mockMember.role : null,
    hydrated: true,
    signOut: jest.fn(),
    poke: jest.fn(),
    pinRequiredFor: () => false,
  }),
}));

const mockPulseListeners = new Set<() => void>();
const mockSyncValue = {
  stale: false,
  syncError: null,
  lastSyncAt: null,
  refreshNow: jest.fn(async () => {}),
  onPulse: (l: () => void) => {
    mockPulseListeners.add(l);
    return () => {
      mockPulseListeners.delete(l);
    };
  },
};
jest.mock("../src/state/SyncManager", () => ({
  useSync: () => mockSyncValue,
}));

jest.mock("../src/api/client", () => ({
  api: jest.fn(),
  ApiError: jest.requireActual("../src/api/client").ApiError,
}));
const { api } = jest.requireMock("../src/api/client") as { api: jest.Mock };

const wrap = ({ children }: { children: React.ReactNode }) => <ThemeProvider>{children}</ThemeProvider>;

const NOW = new Date(2026, 9, 10, 9, 0); // Saturday 2026-10-10

const mockApiRoute = () => {
  api.mockImplementation((path: string) => {
    if (path.startsWith("/api/db/events")) return Promise.resolve({ items: [] });
    if (path.startsWith("/api/google-calendar")) return Promise.resolve({ ok: true, connected: true, events: [] });
    if (path.startsWith("/api/db/schedules")) return Promise.resolve({ items: [] });
    if (path.startsWith("/api/db/meal_plan_entries")) return Promise.resolve({ items: [] });
    return Promise.resolve({ ok: true });
  });
};

beforeEach(async () => {
  jest.clearAllMocks();
  mockPulseListeners.clear();
  mockMember = { id: "p1", name: "Rebecca (Mom)", role: "parent", emoji: "🐱" };
  mockApiRoute();
  await _resetCountdownsForTest();
});

afterEach(async () => {
  await _resetCountdownsForTest();
});

describe("countdowns.ts — computeCountdownDays unit tests", () => {
  it("computes today (0 days) correctly", () => {
    const res = computeCountdownDays("2026-10-10", NOW);
    expect(res.daysLeft).toBe(0);
    expect(res.badgeLabel).toBe("Today! 🎉");
    expect(res.status).toBe("today");
  });

  it("computes tomorrow (1 day) correctly", () => {
    const res = computeCountdownDays("2026-10-11", NOW);
    expect(res.daysLeft).toBe(1);
    expect(res.badgeLabel).toBe("Tomorrow! ✨");
    expect(res.status).toBe("tomorrow");
  });

  it("computes upcoming (14 days) correctly", () => {
    const res = computeCountdownDays("2026-10-24", NOW);
    expect(res.daysLeft).toBe(14);
    expect(res.badgeLabel).toBe("14 days");
    expect(res.status).toBe("upcoming");
  });

  it("computes past (-3 days) correctly", () => {
    const res = computeCountdownDays("2026-10-07", NOW);
    expect(res.daysLeft).toBe(-3);
    expect(res.badgeLabel).toBe("3d ago");
    expect(res.status).toBe("past");
  });
});

describe("countdowns.ts — storage unit tests", () => {
  it("starts empty, adds an event, loads it, and deletes it", async () => {
    const initial = await loadCountdowns();
    expect(initial).toEqual([]);

    const created = await addCountdown({
      title: "Family Vacation",
      targetDate: "2026-10-24",
      emoji: "🏰",
      tone: "cyan",
    });

    expect(created.id).toBeTruthy();
    expect(created.title).toBe("Family Vacation");
    expect(created.targetDate).toBe("2026-10-24");
    expect(created.emoji).toBe("🏰");
    expect(created.tone).toBe("cyan");

    const loaded = await loadCountdowns();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe(created.id);
    expect(loaded[0].title).toBe("Family Vacation");

    const afterDelete = await deleteCountdown(created.id);
    expect(afterDelete).toEqual([]);

    const reloaded = await loadCountdowns();
    expect(reloaded).toEqual([]);
  });

  it("exports valid preset definitions", () => {
    expect(COUNTDOWN_PRESETS).toHaveLength(5);
    expect(COUNTDOWN_PRESETS[0]).toEqual({
      title: "Family Vacation",
      emoji: "🏰",
      tone: "cyan",
      daysOut: 14,
    });
    expect(COUNTDOWN_PRESETS[1].title).toBe("Birthday Party");
    expect(COUNTDOWN_PRESETS[2].title).toBe("Summer Break");
    expect(COUNTDOWN_PRESETS[3].title).toBe("Grandma Visits");
    expect(COUNTDOWN_PRESETS[4].title).toBe("Holiday Gathering");
  });
});

describe("CalendarPage & CountdownsCard — component tests", () => {
  it("renders calendar-countdowns-card with empty state prompt initially", async () => {
    const { findByTestId, findByText } = render(<CalendarPage now={NOW} />, { wrapper: wrap });

    expect(await findByTestId("calendar-countdowns-card")).toBeTruthy();
    expect(
      await findByText("No countdowns pinned yet — parents can add upcoming trips, birthdays, or holidays.")
    ).toBeTruthy();
    expect(await findByText("⏳ Event Countdowns")).toBeTruthy();
  });

  it("parent can open modal, tap a preset, save it, see 14 days badge, and delete it", async () => {
    const { findByTestId, findByText, getByTestId, queryByTestId } = render(
      <CalendarPage now={NOW} />,
      { wrapper: wrap }
    );

    expect(await findByTestId("calendar-countdowns-card")).toBeTruthy();

    // 1. Parent sees + Add Countdown button
    const openBtn = await findByTestId("countdown-add-open");
    expect(openBtn).toBeTruthy();

    // 2. Open modal
    await act(async () => {
      fireEvent.press(openBtn);
    });

    expect(await findByTestId("countdown-add-modal")).toBeTruthy();

    // 3. Tap preset 0 (Family Vacation - 14 days)
    const preset0 = getByTestId("countdown-preset-0");
    await act(async () => {
      fireEvent.press(preset0);
    });

    const titleInput = getByTestId("countdown-title-input");
    const dateInput = getByTestId("countdown-date-input");
    expect(titleInput.props.value).toBe("Family Vacation");
    expect(dateInput.props.value).toBe("2026-10-24");

    // 4. Save countdown
    const saveBtn = getByTestId("countdown-save-btn");
    await act(async () => {
      fireEvent.press(saveBtn);
    });

    // Modal closes
    await waitFor(() => {
      expect(queryByTestId("countdown-add-modal")).toBeNull();
    });

    // 5. See tile and 14 days badge
    expect(await findByText("Family Vacation")).toBeTruthy();
    expect(await findByText("14 days")).toBeTruthy();
    expect(await findByText("🏰")).toBeTruthy();

    const countdowns = await loadCountdowns();
    expect(countdowns).toHaveLength(1);
    const eventId = countdowns[0].id;

    expect(getByTestId(`countdown-tile-${eventId}`)).toBeTruthy();
    expect(getByTestId(`countdown-badge-${eventId}`)).toBeTruthy();

    // 6. Delete the countdown
    const deleteBtn = getByTestId(`countdown-delete-${eventId}`);
    await act(async () => {
      fireEvent.press(deleteBtn);
    });

    await waitFor(async () => {
      expect(queryByTestId(`countdown-tile-${eventId}`)).toBeNull();
    });

    expect(
      await findByText("No countdowns pinned yet — parents can add upcoming trips, birthdays, or holidays.")
    ).toBeTruthy();
  });

  it("parent can type a custom countdown with custom emoji and tone", async () => {
    const { findByTestId, findByText, getByTestId, queryByTestId } = render(
      <CalendarPage now={NOW} />,
      { wrapper: wrap }
    );

    expect(await findByTestId("calendar-countdowns-card")).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId("countdown-add-open"));
    });

    // Enter custom details
    fireEvent.changeText(getByTestId("countdown-title-input"), "Aurora's Graduation");
    fireEvent.changeText(getByTestId("countdown-date-input"), "2026-10-11"); // tomorrow
    fireEvent.press(getByTestId("countdown-emoji-🎓"));
    fireEvent.press(getByTestId("countdown-tone-mint"));

    await act(async () => {
      fireEvent.press(getByTestId("countdown-save-btn"));
    });

    await waitFor(() => {
      expect(queryByTestId("countdown-add-modal")).toBeNull();
    });

    expect(await findByText("Aurora's Graduation")).toBeTruthy();
    expect(await findByText("Tomorrow! ✨")).toBeTruthy();
    expect(await findByText("🎓")).toBeTruthy();
  });

  it("child role can read countdowns on the wall but does not see add or delete buttons", async () => {
    // Pre-seed a countdown
    const seeded = await addCountdown({
      title: "Summer Break",
      targetDate: "2026-10-24",
      emoji: "🏖️",
      tone: "amber",
    });

    mockMember = { id: "c1", name: "Aurora", role: "child", emoji: "🧚" };

    const { findByTestId, findByText, queryByTestId } = render(
      <CalendarPage now={NOW} />,
      { wrapper: wrap }
    );

    expect(await findByTestId("calendar-countdowns-card")).toBeTruthy();
    expect(await findByText("Summer Break")).toBeTruthy();
    expect(await findByText("14 days")).toBeTruthy();
    expect(await findByText("🏖️")).toBeTruthy();

    // Child does NOT see Add Countdown button
    expect(queryByTestId("countdown-add-open")).toBeNull();

    // Child does NOT see Delete button
    expect(queryByTestId(`countdown-delete-${seeded.id}`)).toBeNull();
  });

  it("guest (null role) can read countdowns on the wall but does not see add or delete buttons", async () => {
    const seeded = await addCountdown({
      title: "Family Vacation",
      targetDate: "2026-10-10",
      emoji: "🏰",
      tone: "cyan",
    });

    mockMember = null; // guest / signed out

    const { findByTestId, findByText, queryByTestId } = render(
      <CalendarPage now={NOW} />,
      { wrapper: wrap }
    );

    expect(await findByTestId("calendar-countdowns-card")).toBeTruthy();
    expect(await findByText("Family Vacation")).toBeTruthy();
    expect(await findByText("Today! 🎉")).toBeTruthy();

    // Guest does NOT see Add Countdown button
    expect(queryByTestId("countdown-add-open")).toBeNull();

    // Guest does NOT see Delete button
    expect(queryByTestId(`countdown-delete-${seeded.id}`)).toBeNull();
  });
});
