jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

import {
  DEFAULT_WALL_LAYOUT,
  layoutCells,
  layoutFits,
  layoutSpan,
  layoutWidgets,
  normalizeWallLayout,
  resetWallLayout,
  WALL_CELLS,
  type WallLayout,
} from "../src/home/wallLayout";
import { wallColumns, visibleOnWall, WALL_DEFAULT_WIDGETS } from "../src/home/widgets";

const L = (patch: Partial<WallLayout>): WallLayout => ({ ...DEFAULT_WALL_LAYOUT, ...patch });

describe("wall layout — the board's cell budget", () => {
  it("the default layout fills the board exactly", () => {
    const cells = layoutCells(DEFAULT_WALL_LAYOUT);
    expect(cells.used).toBe(WALL_CELLS);
    expect(cells.free).toBe(0);
  });

  it("a widget's size is the family's choice, defaulting to the board's own", () => {
    expect(layoutSpan(DEFAULT_WALL_LAYOUT, "photos")).toBe(2);
    expect(layoutSpan(DEFAULT_WALL_LAYOUT, "tasks")).toBe(1);
  });

  it("enlarging a widget frees nothing and can overflow the board", () => {
    const grown = L({ spans: { ...DEFAULT_WALL_LAYOUT.spans, tasks: 2 } });
    expect(layoutCells(grown).used).toBe(WALL_CELLS + 1);
    expect(layoutFits(grown)).toBe(false);
  });

  it("hiding a widget frees its cells so another can take them", () => {
    const swapped = L({
      hidden: [...DEFAULT_WALL_LAYOUT.hidden, "homeLights"],
      spans: { ...DEFAULT_WALL_LAYOUT.spans, weather: 2 },
    });
    const cells = layoutCells(swapped);
    expect(cells.used).toBe(WALL_CELLS);
    expect(cells.free).toBe(0);
    expect(layoutFits(swapped)).toBe(true);
  });

  it("the visible set follows the board's order, minus the hidden widgets", () => {
    const shown = layoutWidgets(L({ hidden: [...DEFAULT_WALL_LAYOUT.hidden, "music"] }));
    expect(shown).not.toContain("music");
    // the order is the board's own order, not the layout's
    const order = WALL_DEFAULT_WIDGETS.filter((id) => shown.includes(id));
    expect(layoutWidgets(L({ hidden: [...DEFAULT_WALL_LAYOUT.hidden, "music"] }))).toEqual(order);
  });
});

describe("wall layout — a stored layout is repaired, never trusted", () => {
  it("rejects a junk span, an unknown widget and a duplicate hide", () => {
    const out = normalizeWallLayout({
      spans: { photos: 7, notAWidget: 2, tasks: 2 },
      hidden: ["music", "music", "nope"],
    });
    // a junk span falls back to the board's own size, an unknown widget is dropped
    expect(out.spans.photos).toBe(2);
    expect((out.spans as Record<string, unknown>).notAWidget).toBeUndefined();
    expect(out.spans.tasks).toBe(2);
    // a duplicate hide is collapsed, and the board's shipped-off widgets stay off
    expect(out.hidden).toEqual([...DEFAULT_WALL_LAYOUT.hidden, "music"]);
  });

  it("a non-object store falls back to the default", () => {
    expect(normalizeWallLayout("nope").spans.photos).toBe(2);
    expect(normalizeWallLayout(null).hidden).toEqual(DEFAULT_WALL_LAYOUT.hidden);
  });
});

describe("the grid honours the layout's sizes", () => {
  afterEach(() => resetWallLayout());

  it("a two-cell widget occupies two rows of one column", () => {
    const spans = { photos: 2, tasks: 1 };
    const cols = wallColumns(visibleOnWall(), spans);
    const flat = cols.flat();
    // every widget is placed exactly once
    expect(flat.length).toBe(visibleOnWall().length);
    // the photo hero is the first widget of the first column and takes two rows
    expect(cols[0][0].id).toBe("photos");
  });

  it("a widget the family turned off is not on the board", () => {
    const hidden = new Set([...DEFAULT_WALL_LAYOUT.hidden, "music"]);
    const shown = visibleOnWall().filter((w) => !hidden.has(w.id));
    const cols = wallColumns(shown, {});
    expect(cols.flat().map((c) => c.id)).not.toContain("music");
  });
});
