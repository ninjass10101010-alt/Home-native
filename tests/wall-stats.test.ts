import { renderHook, act } from "@testing-library/react-native";
import {
  publishWallStats,
  publishWallStatsUnknown,
  useWallStats,
  resetWallStats,
} from "../src/home/wall-stats";

describe("wall-stats store", () => {
  beforeEach(() => {
    resetWallStats();
  });

  it("returns initial unknown state on fresh mount", () => {
    const { result } = renderHook(() => useWallStats());
    expect(result.current.openTasks).toBeNull();
    expect(result.current.eventsToday).toBeNull();
    expect(result.current.plannedDays).toBeNull();
    expect(result.current.openTasksStale).toBe(false);
  });

  it("updates state and notifies hook when stats change", () => {
    const { result } = renderHook(() => useWallStats());

    act(() => {
      publishWallStats({ openTasks: 15, openTasksStale: false });
    });

    expect(result.current.openTasks).toBe(15);
    expect(result.current.openTasksStale).toBe(false);
  });

  it("skips notifying listeners when values are identical (no-op duplicate publish)", () => {
    const { result } = renderHook(() => useWallStats());

    act(() => {
      publishWallStats({ eventsToday: 3 });
    });
    expect(result.current.eventsToday).toBe(3);

    const prevSnapshot = result.current;

    act(() => {
      publishWallStats({ eventsToday: 3 });
    });

    // Object identity should remain identical because no change occurred
    expect(result.current).toBe(prevSnapshot);
  });

  it("handles publishWallStatsUnknown correctly", () => {
    const { result } = renderHook(() => useWallStats());

    act(() => {
      publishWallStats({ openTasks: 12 });
    });
    expect(result.current.openTasks).toBe(12);

    act(() => {
      publishWallStatsUnknown("openTasks");
    });
    expect(result.current.openTasks).toBeNull();
    expect(result.current.openTasksStale).toBe(false);
  });
});
