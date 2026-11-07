/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factory */
import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { ScheduleWidget } from "../src/home/widgets/ScheduleWidget";
import { clearWidgetMemoryCache } from "../src/home/widgets/data";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { AuthProvider } from "../src/state/AuthProvider";
import * as client from "../src/api/client";
import * as notificationFeed from "../src/native/notificationFeed";
import * as voiceCallouts from "../src/native/voiceCallouts";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const mockPulseListeners = new Set<() => void>();
const mockSyncValue = {
  lastSyncAt: Date.now(),
  stale: false,
  error: null,
  refreshing: false,
  refreshNow: jest.fn(),
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

function wrap({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ThemeProvider>{children}</ThemeProvider>
    </AuthProvider>
  );
}

describe("ScheduleWidget", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    clearWidgetMemoryCache();
  });

  it("renders empty state when no routines exist", async () => {
    jest.spyOn(client, "api").mockResolvedValue({ items: [] } as any);

    const { findByText } = render(<ScheduleWidget />, { wrapper: wrap });
    expect(await findByText("No routines")).toBeTruthy();
    expect(await findByText("No routines are scheduled for today.")).toBeTruthy();
  });

  it("renders today's upcoming routines", async () => {
    const mockSchedules = [
      {
        id: "1",
        title: "Morning Routine",
        time: "23:59", // Guaranteed upcoming relative to test run
        days: "mon,tue,wed,thu,fri,sat,sun",
        icon: "🌅",
        color: "amber",
        member: "Aurora Garcia",
      },
      {
        id: "2",
        title: "Bedtime Reading",
        time: "23:59",
        days: "mon,tue,wed,thu,fri,sat,sun",
        icon: "📚",
        color: "cyan",
        member: "Crew Garcia",
      },
    ];

    jest.spyOn(client, "api").mockResolvedValue({ items: mockSchedules } as any);

    const { findByText, findByTestId } = render(<ScheduleWidget />, { wrapper: wrap });
    expect(await findByText("Daily Schedule")).toBeTruthy();
    expect(await findByText("Morning Routine")).toBeTruthy();
    expect(await findByText("Bedtime Reading")).toBeTruthy();
    expect(await findByText("Aurora")).toBeTruthy();
    expect(await findByText("Crew")).toBeTruthy();
    expect(await findByTestId("schedule-row-s_1")).toBeTruthy();
    expect(await findByTestId("schedule-row-s_2")).toBeTruthy();
  });

  it("renders completed state when all routines are in the past", async () => {
    const pastSchedules = [
      {
        id: "p1",
        title: "Early Morning Walk",
        time: "00:01",
        days: "mon,tue,wed,thu,fri,sat,sun",
        icon: "🌅",
        color: "green",
      },
    ];

    // Mock Date to afternoon so 00:01 is in the past
    jest.spyOn(client, "api").mockResolvedValue({ items: pastSchedules } as any);

    const { findByText } = render(<ScheduleWidget />, { wrapper: wrap });
    expect(await findByText("All done")).toBeTruthy();
    expect(await findByText("All routines completed for today.")).toBeTruthy();
    expect(await findByText("See today's schedule →")).toBeTruthy();
  });

  it("renders up to 6 routines when span is 2 (bigger widget)", async () => {
    const sixSchedules = Array.from({ length: 6 }, (_, i) => ({
      id: `sched_${i}`,
      title: `Routine ${i + 1}`,
      time: "23:59",
      days: "mon,tue,wed,thu,fri,sat,sun",
      icon: "⏰",
      color: "cyan",
    }));

    jest.spyOn(client, "api").mockResolvedValue({ items: sixSchedules } as any);

    const { findByText, findByTestId } = render(<ScheduleWidget span={2} />, { wrapper: wrap });
    expect(await findByText("Daily Schedule")).toBeTruthy();
    for (let i = 0; i < 6; i++) {
      expect(await findByText(`Routine ${i + 1}`)).toBeTruthy();
      expect(await findByTestId(`schedule-row-s_sched_${i}`)).toBeTruthy();
    }
  });

  it("hides Dinner/Lunch/Breakfast routines when no meal is scheduled for that slot today", async () => {
    // Friday Nov 6, 2026 at 10:00 AM
    const now = new Date(2026, 10, 6, 10, 0, 0);
    const schedules = [
      { id: "lunch1", title: "Lunch", time: "12:30", days: "all", icon: "🥪" },
      { id: "din1", title: "Dinner", time: "18:15", days: "all", icon: "🍽️" },
      { id: "dogs1", title: "Take Dogs Out", time: "19:00", days: "all", icon: "🐶" },
    ];

    jest.spyOn(client, "api").mockImplementation(async (path: string) => {
      if (path.includes("meal_plan_entries")) {
        return { items: [] } as any;
      }
      return { items: schedules } as any;
    });

    const postSpy = jest.spyOn(notificationFeed, "postActiveNotification");
    const audioSpy = jest.spyOn(voiceCallouts, "playNotificationAudio").mockResolvedValue();

    const { findByText, queryByText, getByTestId } = render(
      <ScheduleWidget span={2} now={now} />,
      { wrapper: wrap }
    );
    expect(await findByText("Take Dogs Out")).toBeTruthy();
    expect(queryByText(/Dinner/)).toBeNull();
    expect(queryByText(/Lunch/)).toBeNull();

    // Tapping Speak only announces the scheduled non-empty routines
    fireEvent.press(getByTestId("schedule-announce-btn"));
    expect(postSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        body: "7:00 PM: Take Dogs Out",
      })
    );
    expect(audioSpy).toHaveBeenCalled();
  });

  it("includes Dinner routine with the planned meal name when dinner IS scheduled today", async () => {
    // Friday Nov 6, 2026 at 10:00 AM (week Monday = 2026-11-02)
    const now = new Date(2026, 10, 6, 10, 0, 0);
    const schedules = [
      { id: "din1", title: "Dinner", time: "18:15", days: "all", icon: "🍽️" },
      { id: "dogs1", title: "Take Dogs Out", time: "19:00", days: "all", icon: "🐶" },
    ];
    const meals = [
      {
        id: "m1",
        name: "Tacos al Pastor",
        emoji: "🌮",
        time: "Fri",
        mealType: "dinner",
        weekOf: "2026-11-02",
      },
    ];

    jest.spyOn(client, "api").mockImplementation(async (path: string) => {
      if (path.includes("meal_plan_entries")) {
        return { items: meals } as any;
      }
      return { items: schedules } as any;
    });

    const { findByText } = render(<ScheduleWidget span={2} now={now} />, {
      wrapper: wrap,
    });
    expect(await findByText("Dinner: Tacos al Pastor")).toBeTruthy();
    expect(await findByText("Take Dogs Out")).toBeTruthy();
  });
});
