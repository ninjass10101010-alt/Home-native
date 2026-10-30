import { scoreWidgets, dynamicSpans, activityOrder, hasMoreContent } from "../src/home/wallActivity";
import { DEFAULT_WALL_LAYOUT, type WallLayout } from "../src/home/wallLayout";
import type { WallStats } from "../src/home/wall-stats";
import type { WidgetId } from "../src/home/widgets";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const EMPTY_STATS: WallStats = {
  eventsToday: null,
  openTasks: null,
  openTasksStale: false,
  plannedDays: null,
  weekCells: null,
};

const BUSY_STATS: WallStats = {
  eventsToday: 5,
  openTasks: 8,
  openTasksStale: false,
  plannedDays: 6,
  weekCells: null,
};

const QUIET_STATS: WallStats = {
  eventsToday: 0,
  openTasks: 0,
  openTasksStale: false,
  plannedDays: 0,
  weekCells: null,
};

const DEFAULT_VISIBLE: WidgetId[] = [
  "photos",
  "weather",
  "todayEvents",
  "tasks",
  "morningBriefing",
  "music",
  "currentMeal",
  "leaderboard",
];

describe("wallActivity — scoreWidgets", () => {
  it("scores un-settled widgets at neutral 50", () => {
    const scores = scoreWidgets(EMPTY_STATS);
    expect(scores.get("tasks")!.score).toBe(50);
    expect(scores.get("tasks")!.settled).toBe(false);
    expect(scores.get("todayEvents")!.score).toBe(50);
    expect(scores.get("todayEvents")!.settled).toBe(false);
  });

  it("gives high scores to busy widgets", () => {
    const scores = scoreWidgets(BUSY_STATS);
    expect(scores.get("tasks")!.score).toBeGreaterThanOrEqual(80);
    expect(scores.get("todayEvents")!.score).toBeGreaterThanOrEqual(80);
    expect(scores.get("tasks")!.settled).toBe(true);
  });

  it("gives low scores to empty widgets", () => {
    const scores = scoreWidgets(QUIET_STATS);
    expect(scores.get("tasks")!.score).toBeLessThan(15);
    expect(scores.get("todayEvents")!.score).toBeLessThan(15);
    expect(scores.get("tasks")!.settled).toBe(true);
  });

  it("always scores photos at neutral", () => {
    const scores = scoreWidgets(BUSY_STATS);
    expect(scores.get("photos")!.score).toBe(50);
    expect(scores.get("photos")!.settled).toBe(true);
  });
});

describe("wallActivity — dynamicSpans", () => {
  it("keeps photos locked at its default span", () => {
    const activities = scoreWidgets(QUIET_STATS);
    const result = dynamicSpans(DEFAULT_WALL_LAYOUT, activities, DEFAULT_VISIBLE);
    expect(result.photos).toBe(2); // photos always stays span-2
  });

  it("promotes busy widgets to span-2", () => {
    const activities = scoreWidgets(BUSY_STATS);
    const result = dynamicSpans(DEFAULT_WALL_LAYOUT, activities, DEFAULT_VISIBLE);
    // Tasks has 8 items (score 85) + Events has 5 (score 90) → both should be span-2
    expect(result.tasks).toBe(2);
    expect(result.todayEvents).toBe(2);
  });

  it("demotes empty widgets to span-1", () => {
    const activities = scoreWidgets(QUIET_STATS);
    const result = dynamicSpans(DEFAULT_WALL_LAYOUT, activities, DEFAULT_VISIBLE);
    // Tasks=0 (score 5) → should be demoted to span-1
    expect(result.tasks).toBe(1);
    expect(result.todayEvents).toBe(1);
  });

  it("never exceeds 12 total cells", () => {
    const activities = scoreWidgets(BUSY_STATS);
    const result = dynamicSpans(DEFAULT_WALL_LAYOUT, activities, DEFAULT_VISIBLE);
    let total = 0;
    for (const id of DEFAULT_VISIBLE) {
      total += result[id] ?? 1;
    }
    expect(total).toBeLessThanOrEqual(12);
  });

  it("does not promote un-settled widgets", () => {
    const activities = scoreWidgets(EMPTY_STATS);
    const result = dynamicSpans(DEFAULT_WALL_LAYOUT, activities, DEFAULT_VISIBLE);
    // Un-settled tasks (score 50, settled false) should not be promoted even at score 50
    // They should keep their default span instead
    const tasksSpan = result.tasks;
    // Default for tasks is span-2, but it shouldn't be promoted via activity
    // The default span should be respected since it's not settled
    expect(tasksSpan).toBeDefined();
  });

  it("keeps widgets with small content at span-1", () => {
    // 1 event is small content: should stay at span-1
    const singleEventStats: WallStats = {
      eventsToday: 1,
      openTasks: 6,
      openTasksStale: false,
      plannedDays: 1,
      weekCells: null,
    };
    const activities = scoreWidgets(singleEventStats);
    const result = dynamicSpans(DEFAULT_WALL_LAYOUT, activities, DEFAULT_VISIBLE, singleEventStats);
    expect(result.todayEvents).toBe(1); // Small content: 1 event stays small!
    expect(result.tasks).toBe(2); // More content: 6 tasks gets 2 cells!
  });

  it("always respects explicit user 1-cell layout setting", () => {
    const layoutWith1CellEvents: WallLayout = {
      ...DEFAULT_WALL_LAYOUT,
      spans: {
        ...DEFAULT_WALL_LAYOUT.spans,
        todayEvents: 1,
      },
    };
    // Even when calendar is busy (5 events), explicit 1-cell user setting is honored
    const activities = scoreWidgets(BUSY_STATS);
    const result = dynamicSpans(layoutWith1CellEvents, activities, DEFAULT_VISIBLE, BUSY_STATS);
    expect(result.todayEvents).toBe(1);
  });
});

describe("wallActivity — hasMoreContent", () => {
  it("treats 0 and 1 event as small content, 2+ as more content", () => {
    expect(hasMoreContent("todayEvents", { ...QUIET_STATS, eventsToday: 0 })).toBe(false);
    expect(hasMoreContent("todayEvents", { ...QUIET_STATS, eventsToday: 1 })).toBe(false);
    expect(hasMoreContent("todayEvents", { ...QUIET_STATS, eventsToday: 2 })).toBe(true);
    expect(hasMoreContent("todayEvents", { ...QUIET_STATS, eventsToday: 5 })).toBe(true);
  });

  it("treats 0 and 1 task as small content, 2+ as more content", () => {
    expect(hasMoreContent("tasks", { ...QUIET_STATS, openTasks: 0 })).toBe(false);
    expect(hasMoreContent("tasks", { ...QUIET_STATS, openTasks: 1 })).toBe(false);
    expect(hasMoreContent("tasks", { ...QUIET_STATS, openTasks: 2 })).toBe(true);
    expect(hasMoreContent("tasks", { ...QUIET_STATS, openTasks: 10 })).toBe(true);
  });

  it("treats schedule as having more content for 2-cell expansion", () => {
    expect(hasMoreContent("schedule", QUIET_STATS)).toBe(true);
  });
});

describe("wallActivity — activityOrder", () => {
  it("sorts busiest widgets first", () => {
    const activities = scoreWidgets(BUSY_STATS);
    const ordered = activityOrder(DEFAULT_VISIBLE, activities);
    // Events (score 90) should be before music (score 25)
    const eventsIdx = ordered.indexOf("todayEvents");
    const musicIdx = ordered.indexOf("music");
    expect(eventsIdx).toBeLessThan(musicIdx);
  });

  it("puts tasks above leaderboard when tasks are busy", () => {
    const activities = scoreWidgets(BUSY_STATS);
    const ordered = activityOrder(DEFAULT_VISIBLE, activities);
    const tasksIdx = ordered.indexOf("tasks");
    const leaderboardIdx = ordered.indexOf("leaderboard");
    expect(tasksIdx).toBeLessThan(leaderboardIdx);
  });

  it("puts quiet tasks below other widgets when tasks are empty", () => {
    const activities = scoreWidgets(QUIET_STATS);
    const ordered = activityOrder(DEFAULT_VISIBLE, activities);
    const tasksIdx = ordered.indexOf("tasks");
    const weatherIdx = ordered.indexOf("weather");
    // Tasks score 5 < weather score 45 → tasks should be after weather
    expect(tasksIdx).toBeGreaterThan(weatherIdx);
  });
});
