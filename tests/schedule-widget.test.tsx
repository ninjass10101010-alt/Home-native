/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factory */
import React from "react";
import { render } from "@testing-library/react-native";
import { ScheduleWidget } from "../src/home/widgets/ScheduleWidget";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { AuthProvider } from "../src/state/AuthProvider";
import * as client from "../src/api/client";

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
        title: "Early Breakfast",
        time: "00:01",
        days: "mon,tue,wed,thu,fri,sat,sun",
        icon: "🍳",
        color: "green",
      },
    ];

    // Mock Date to afternoon so 00:01 is in the past
    jest.spyOn(client, "api").mockResolvedValue({ items: pastSchedules } as any);

    const { findByText } = render(<ScheduleWidget />, { wrapper: wrap });
    expect(await findByText("All done")).toBeTruthy();
    expect(await findByText("All routines completed for today.")).toBeTruthy();
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
});
