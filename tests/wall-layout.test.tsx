import { act, renderHook, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  DEFAULT_WALL_LAYOUT,
  WALL_LAYOUT_STORAGE_KEY,
  WALL_LAYOUT_VERSION,
  layoutCells,
  layoutFits,
  layoutSpan,
  layoutWidgets,
  normalizeWallLayout,
  resetWallLayout,
  useWallLayout,
  type WallLayout,
} from "../src/home/wallLayout";
import {
  WALL_CONFIGURABLE_WIDGETS,
  WALL_DEFAULT_HIDDEN_WIDGETS,
  WALL_LOCKED_HIDDEN_WIDGETS,
  WALL_SPANS,
  wallColumns,
  wallRowBudget,
  visibleOnWall,
  type WidgetId,
  type WallSpan,
} from "../src/home/widgets";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const L = (
  spans: Partial<Record<WidgetId, WallSpan>> = {},
  hidden: WidgetId[] = [],
): WallLayout => ({ version: WALL_LAYOUT_VERSION, spans, hidden });

beforeEach(async () => {
  resetWallLayout();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await AsyncStorage.clear();
});

describe("wall manifest — the balanced reading order", () => {
  it("uses the approved configurable order and locks deferred widgets off", () => {
    expect(WALL_CONFIGURABLE_WIDGETS).toEqual([
      "photos",
      "weather",
      "todayEvents",
      "tasks",
      "morningBriefing",
      "music",
      "currentMeal",
      "leaderboard",
      "schedule",
      "homeSecurity",
      "homeClimate",
      "homeLights",
    ]);
    expect(WALL_DEFAULT_HIDDEN_WIDGETS).toEqual([
      "schedule",
      "homeSecurity",
      "homeClimate",
      "homeLights",
    ]);
    expect(WALL_LOCKED_HIDDEN_WIDGETS).toEqual([
      "aiQuickAsk",
      "consuelaSuggestions",
      "financeLedger",
    ]);
  });

  it("gives Photos, Weather, Today, and Tasks two cells", () => {
    expect(WALL_SPANS).toEqual({
      photos: 2,
      weather: 2,
      todayEvents: 2,
      tasks: 2,
    });
    expect(wallRowBudget(1)).toBe(2);
    expect(wallRowBudget(2)).toBe(4);
  });

  it("shows eight daily essentials and fills exactly twelve cells", () => {
    expect(visibleOnWall().map((widget) => widget.id)).toEqual([
      "photos",
      "weather",
      "todayEvents",
      "tasks",
      "morningBriefing",
      "music",
      "currentMeal",
      "leaderboard",
    ]);
    expect(layoutCells(DEFAULT_WALL_LAYOUT)).toEqual({ used: 12, free: 0 });
    expect(layoutFits(DEFAULT_WALL_LAYOUT)).toBe(true);
  });

  it("places the four anchors across the top and the compact block lower right", () => {
    expect(wallColumns().map((column) => column.map((widget) => widget.id))).toEqual([
      ["photos", "tasks"],
      ["weather", "morningBriefing", "currentMeal"],
      ["todayEvents", "music", "leaderboard"],
    ]);
  });
});

describe("wall layout — v1 resets once and v2 customizations persist", () => {
  it("treats an unversioned payload as v1 and replaces it with the v2 default", () => {
    const v1 = { spans: { photos: 1 }, hidden: ["music"] };
    expect(normalizeWallLayout(v1)).toEqual(DEFAULT_WALL_LAYOUT);
  });

  it("keeps a valid v2 custom layout", () => {
    const custom = L({ weather: 1 }, ["music", "homeClimate", "homeLights"]);
    expect(normalizeWallLayout(custom)).toEqual(custom);
    expect(layoutWidgets(custom)).toContain("homeSecurity");
  });

  it("makes the v2 hidden list authoritative for configurable default-off widgets", () => {
    const enabledSecurity = L({}, ["music", "homeClimate", "homeLights"]);
    expect(layoutWidgets(enabledSecurity)).toContain("homeSecurity");
    expect(layoutWidgets(enabledSecurity)).not.toContain("homeClimate");
    expect(layoutWidgets(enabledSecurity)).not.toContain("homeLights");
  });

  it("repairs unknown ids, invalid spans, and duplicate hides", () => {
    const invalidSpans = {
      photos: 3,
      notAWidget: 2,
    } as unknown as Partial<Record<WidgetId, WallSpan>>;
    const invalidHidden = [
      "music",
      "homeSecurity",
      "homeClimate",
      "homeLights",
      "notAWidget",
    ] as unknown as WidgetId[];
    const repaired = normalizeWallLayout(L(invalidSpans, invalidHidden));
    expect(layoutSpan(repaired, "photos")).toBe(2);
    expect((repaired.spans as Record<string, unknown>).notAWidget).toBeUndefined();
    expect(repaired.hidden).toEqual([
      "music",
      "homeSecurity",
      "homeClimate",
      "homeLights",
    ]);
  });

  it("keeps deferred widgets locked off", () => {
    const custom = L({}, ["music", "homeClimate", "homeLights", "aiQuickAsk"]);
    expect(layoutWidgets(custom)).not.toContain("aiQuickAsk");
    expect(layoutWidgets(custom)).not.toContain("consuelaSuggestions");
    expect(layoutWidgets(custom)).not.toContain("financeLedger");
  });

  it("refuses a repaired layout over twelve cells", () => {
    const overBudget = L({ homeSecurity: 2 }, []);
    expect(layoutFits(overBudget)).toBe(false);
    expect(normalizeWallLayout(overBudget)).toEqual(DEFAULT_WALL_LAYOUT);
  });

  it("persists the one-time v1 migration as v2", async () => {
    await AsyncStorage.setItem(
      WALL_LAYOUT_STORAGE_KEY,
      JSON.stringify({ spans: { photos: 1 }, hidden: ["music"] }),
    );
    const { result } = renderHook(() => useWallLayout());
    await waitFor(() => expect(result.current.layout.version).toBe(2));
    const stored = JSON.parse(
      (await AsyncStorage.getItem(WALL_LAYOUT_STORAGE_KEY)) ?? "null",
    );
    expect(stored.version).toBe(2);
    expect(stored.hidden).toEqual(WALL_DEFAULT_HIDDEN_WIDGETS);
  });

  it("reloads a valid v2 custom layout without losing it", async () => {
    const custom = L({ weather: 1 }, ["music", "homeClimate", "homeLights"]);
    await AsyncStorage.setItem(WALL_LAYOUT_STORAGE_KEY, JSON.stringify(custom));
    const { result } = renderHook(() => useWallLayout());
    await waitFor(() => expect(result.current.layout.spans.weather).toBe(1));
    expect(result.current.layout.hidden).toEqual(custom.hidden);
    expect(layoutWidgets(result.current.layout)).toContain("homeSecurity");
  });

  it("returns false and keeps the current layout when a change exceeds twelve cells", async () => {
    const { result } = renderHook(() => useWallLayout());
    await waitFor(() => expect(result.current.layout.version).toBe(2));
    let accepted = false;
    act(() => {
      accepted = result.current.setLayout(L({ homeSecurity: 2 }, []));
    });
    expect(accepted).toBe(false);
    expect(result.current.layout).toEqual(DEFAULT_WALL_LAYOUT);
  });

  it("allows schedule to have span 2 when room is available", () => {
    // Hide currentMeal and leaderboard to free 2 cells:
    // photos (2) + weather (2) + todayEvents (2) + tasks (2) + morningBriefing (1) + music (1) = 10 cells
    // schedule with span 2 = 12 cells
    const custom = L({ schedule: 2 }, ["currentMeal", "leaderboard", "homeSecurity", "homeClimate", "homeLights"]);
    expect(layoutFits(custom)).toBe(true);
    expect(layoutCells(custom)).toEqual({ used: 12, free: 0 });
    expect(layoutSpan(custom, "schedule")).toBe(2);
    expect(normalizeWallLayout(custom)).toEqual(custom);
  });
});
