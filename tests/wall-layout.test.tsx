import { act, renderHook, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  DEFAULT_WALL_LAYOUT,
  SMART_HOME_WALL_LAYOUT,
  WALL_LAYOUT_STORAGE_KEY,
  WALL_LAYOUT_VERSION,
  layoutCells,
  layoutFits,
  layoutShape,
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
  WALL_SHAPES,
  WALL_SPANS,
  expandTrailingRowGaps,
  wallColumns,
  wallPlacements,
  wallRowBudget,
  visibleOnWall,
  type WidgetId,
  type WallShape,
  type WallSpan,
} from "../src/home/widgets";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const L = (
  spans: Partial<Record<WidgetId, WallSpan>> = {},
  hidden: WidgetId[] = [],
  shapes?: Partial<Record<WidgetId, WallShape>>,
): WallLayout => ({
  version: WALL_LAYOUT_VERSION,
  spans,
  ...(shapes ? { shapes } : {}),
  hidden,
});

beforeEach(async () => {
  resetWallLayout();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await AsyncStorage.clear();
});

describe("wall manifest — v3 symmetrical bookends & wide strips", () => {
  it("uses the approved v3 configurable order and locks deferred widgets off", () => {
    expect(WALL_CONFIGURABLE_WIDGETS).toEqual([
      "photos",
      "todayEvents",
      "weather",
      "tasks",
      "schedule",
      "currentMeal",
      "leaderboard",
      "music",
      "morningBriefing",
      "homeSecurity",
      "homeClimate",
      "homeLights",
    ]);
    expect(WALL_DEFAULT_HIDDEN_WIDGETS).toEqual([
      "morningBriefing",
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

  it("gives Photos (1x2), Weather (1x2), Daily Schedule (2x1), and Music (2x1) two cells", () => {
    expect(WALL_SPANS).toEqual({
      photos: 2,
      weather: 2,
      schedule: 2,
      music: 2,
    });
    expect(WALL_SHAPES).toEqual({
      photos: "1x2",
      weather: "1x2",
      schedule: "2x1",
      music: "2x1",
    });
    expect(wallRowBudget(1)).toBe(2);
    expect(wallRowBudget(2)).toBe(4);
  });

  it("shows eight daily essentials and fills exactly twelve cells", () => {
    expect(visibleOnWall().map((widget) => widget.id)).toEqual([
      "photos",
      "todayEvents",
      "weather",
      "tasks",
      "schedule",
      "currentMeal",
      "leaderboard",
      "music",
    ]);
    expect(layoutCells(DEFAULT_WALL_LAYOUT)).toEqual({ used: 12, free: 0 });
    expect(layoutFits(DEFAULT_WALL_LAYOUT)).toBe(true);
  });

  it("places symmetrical Photos & Weather bookends, Today/Tasks center, and wide Schedule & Music strips", () => {
    const { placements, fitsAll } = wallPlacements();
    expect(fitsAll).toBe(true);
    expect(
      placements.map((p) => ({
        id: p.def.id,
        row: p.row,
        col: p.col,
        rowSpan: p.rowSpan,
        colSpan: p.colSpan,
        shape: p.shape,
      })),
    ).toEqual([
      { id: "photos", row: 0, col: 0, rowSpan: 2, colSpan: 1, shape: "1x2" },
      { id: "todayEvents", row: 0, col: 1, rowSpan: 1, colSpan: 1, shape: "1x1" },
      { id: "weather", row: 0, col: 2, rowSpan: 2, colSpan: 1, shape: "1x2" },
      { id: "tasks", row: 1, col: 1, rowSpan: 1, colSpan: 1, shape: "1x1" },
      { id: "schedule", row: 2, col: 0, rowSpan: 1, colSpan: 2, shape: "2x1" },
      { id: "currentMeal", row: 2, col: 2, rowSpan: 1, colSpan: 1, shape: "1x1" },
      { id: "leaderboard", row: 3, col: 0, rowSpan: 1, colSpan: 1, shape: "1x1" },
      { id: "music", row: 3, col: 1, rowSpan: 1, colSpan: 2, shape: "2x1" },
    ]);
    expect(wallColumns().map((column) => column.map((widget) => widget.id))).toEqual([
      ["photos", "schedule", "leaderboard"],
      ["todayEvents", "tasks", "music"],
      ["weather", "currentMeal"],
    ]);
  });
});

describe("wall layout — v1/v2 reset once and v3 customizations persist", () => {
  it("treats unversioned or v2 payloads as legacy and replaces them with the v3 default", () => {
    const v1 = { spans: { photos: 1 }, hidden: ["music"] };
    const v2 = { version: 2, spans: { photos: 2, weather: 2, todayEvents: 2, tasks: 2 }, hidden: ["schedule"] };
    expect(normalizeWallLayout(v1)).toEqual(DEFAULT_WALL_LAYOUT);
    expect(normalizeWallLayout(v2)).toEqual(DEFAULT_WALL_LAYOUT);
  });

  it("keeps a valid v3 custom layout including 2x1 wide shapes", () => {
    const custom = L(
      { weather: 1, schedule: 2, music: 2, photos: 2 },
      ["morningBriefing", "homeClimate", "homeLights"],
      { photos: "1x2", weather: "1x1", schedule: "2x1", music: "2x1" },
    );
    expect(normalizeWallLayout(custom)).toEqual(custom);
    expect(layoutWidgets(custom)).toContain("homeSecurity");
    expect(layoutShape(custom, "weather")).toBe("1x1");
  });

  it("makes the v3 hidden list authoritative for configurable default-off widgets", () => {
    const enabledSecurity = L(
      { weather: 1 },
      ["morningBriefing", "homeClimate", "homeLights"],
      { photos: "1x2", weather: "1x1", schedule: "2x1", music: "2x1" },
    );
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
      "morningBriefing",
      "homeSecurity",
      "homeClimate",
      "homeLights",
      "notAWidget",
    ] as unknown as WidgetId[];
    const repaired = normalizeWallLayout(L(invalidSpans, invalidHidden));
    expect(layoutSpan(repaired, "photos")).toBe(2);
    expect((repaired.spans as Record<string, unknown>).notAWidget).toBeUndefined();
    expect(repaired.hidden).toEqual([
      "morningBriefing",
      "homeSecurity",
      "homeClimate",
      "homeLights",
    ]);
  });

  it("keeps deferred widgets locked off", () => {
    const custom = L({}, ["morningBriefing", "homeClimate", "homeLights", "aiQuickAsk"]);
    expect(layoutWidgets(custom)).not.toContain("aiQuickAsk");
    expect(layoutWidgets(custom)).not.toContain("consuelaSuggestions");
    expect(layoutWidgets(custom)).not.toContain("financeLedger");
  });

  it("refuses a repaired layout over twelve cells or with unpackable 2D shapes", () => {
    const overBudget = L({ homeSecurity: 2 }, []);
    expect(layoutFits(overBudget)).toBe(false);
    expect(normalizeWallLayout(overBudget)).toEqual(DEFAULT_WALL_LAYOUT);
  });

  it("persists the one-time legacy v2 migration as v3", async () => {
    await AsyncStorage.setItem(
      WALL_LAYOUT_STORAGE_KEY,
      JSON.stringify({ version: 2, spans: { photos: 1 }, hidden: ["music"] }),
    );
    const { result } = renderHook(() => useWallLayout());
    await waitFor(() => expect(result.current.layout.version).toBe(3));
    const stored = JSON.parse(
      (await AsyncStorage.getItem(WALL_LAYOUT_STORAGE_KEY)) ?? "null",
    );
    expect(stored.version).toBe(3);
    expect(stored.hidden).toEqual(WALL_DEFAULT_HIDDEN_WIDGETS);
  });

  it("reloads a valid v3 custom layout without losing it", async () => {
    const custom = L(
      { weather: 1 },
      ["morningBriefing", "homeClimate", "homeLights"],
      { photos: "1x2", weather: "1x1", schedule: "2x1", music: "2x1" },
    );
    await AsyncStorage.setItem(WALL_LAYOUT_STORAGE_KEY, JSON.stringify(custom));
    const { result } = renderHook(() => useWallLayout());
    await waitFor(() => expect(result.current.layout.spans.weather).toBe(1));
    expect(result.current.layout.hidden).toEqual(custom.hidden);
    expect(layoutWidgets(result.current.layout)).toContain("homeSecurity");
  });

  it("returns false and keeps the current layout when a change exceeds twelve cells", async () => {
    const { result } = renderHook(() => useWallLayout());
    await waitFor(() => expect(result.current.layout.version).toBe(3));
    let accepted = false;
    act(() => {
      accepted = result.current.setLayout(L({ homeSecurity: 2 }, []));
    });
    expect(accepted).toBe(false);
    expect(result.current.layout).toEqual(DEFAULT_WALL_LAYOUT);
  });

  it("allows enabling morningBriefing when two cells are freed by resizing music & schedule", () => {
    const custom = L(
      { photos: 2, weather: 2, schedule: 1, music: 1 },
      ["homeSecurity", "homeClimate", "homeLights"],
      { photos: "1x2", weather: "1x2", schedule: "1x1", music: "1x1" },
    );
    expect(layoutFits(custom)).toBe(true);
    expect(layoutCells(custom)).toEqual({ used: 11, free: 1 });
    expect(normalizeWallLayout(custom)).toEqual(custom);
  });

  it("expands trailing empty row cells so partially filled rows sit flush across 3 columns", () => {
    const partial = L(
      { photos: 2, weather: 2, music: 2 },
      ["schedule", "morningBriefing", "homeSecurity", "homeClimate"],
      { photos: "1x2", weather: "1x2", music: "2x1" },
    );
    const defs = visibleOnWall([...partial.hidden, ...WALL_LOCKED_HIDDEN_WIDGETS]);
    const raw = wallPlacements(defs, partial.shapes ?? {});
    const filled = expandTrailingRowGaps(raw.placements);
    const music = filled.find((p) => p.def.id === "music");
    expect(music).toMatchObject({ row: 3, col: 0, rowSpan: 1, colSpan: 3 });

    // Full 12/12 default layout is completely unchanged
    const full = wallPlacements().placements;
    expect(expandTrailingRowGaps(full)).toEqual(full);
  });

  it("SMART_HOME_WALL_LAYOUT fills all 12 cells cleanly", () => {
    expect(layoutCells(SMART_HOME_WALL_LAYOUT)).toEqual({ used: 12, free: 0 });
    expect(layoutFits(SMART_HOME_WALL_LAYOUT)).toBe(true);
    expect(normalizeWallLayout(SMART_HOME_WALL_LAYOUT)).toEqual(SMART_HOME_WALL_LAYOUT);
  });
});
