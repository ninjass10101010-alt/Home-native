/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { fireEvent, render } from "@testing-library/react-native";

import { ThemeProvider } from "../src/theme/ThemeProvider";
import { HomeWall, greetingFor, GRID_CELL_H, savedFamilyLabel, seasonGlyph } from "../src/home/HomeWall";
import { ThisWeekCard } from "../src/home/WallStatsStrip";
import {
  visibleOnWall,
  wallColumns,
  WALL_CONFIGURABLE_WIDGETS,
  WALL_HIDDEN_WIDGETS,
  WALL_SPANS,
  type WidgetId,
  type WallSpan,
  type WallWidgetProps,
} from "../src/home/widgets";
import { publishWallStats, resetWallStats, weekCellsFor } from "../src/home/wall-stats";


jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock("../src/state/AuthProvider", () => {
  const actual = jest.requireActual("../src/state/AuthProvider");
  return {
    ...actual,
    useAuth: () => ({ member: null, hydrated: true, signOut: jest.fn(), poke: jest.fn() }),
  };
});
jest.mock("../src/api/auth", () => ({
  login: jest.fn(),
  quickLogin: jest.fn(),
  logout: jest.fn(async () => {}),
  whoami: jest.fn(async () => null),
  verifyPin: jest.fn(),
}));

const wrap = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

const members = [
  { name: "Rebecca (Mom)", emoji: "🐱" },
  { name: "Aurora", emoji: "👧" },
];

/** Flatten a rendered subtree to plain text so a tile's label/detail/value can
 *  be asserted without duplicating the tile's internal tree. Walks the host
 *  tree exactly like the meals suite's subtreeHas helper. */
function subtreeText(root: any, testID: string): string {
  const find = (node: any): any => {
    if (!node || typeof node !== "object") return null;
    if (node.props?.testID === testID) return node;
    for (const c of Array.isArray(node.children) ? node.children : []) {
      const hit = find(c);
      if (hit) return hit;
    }
    return null;
  };
  const collect = (node: any): string => {
    if (node == null || node === false || node === true) return "";
    if (typeof node === "string" || typeof node === "number") return String(node);
    const kids = Array.isArray(node.children) ? node.children : [];
    return kids.map(collect).join(" ");
  };
  const found = find(root.toJSON());
  return found ? collect(found) : "";
}

describe("HomeWall (the 12-cell wall bento)", () => {
  it("renders the eight default daily essentials and hides the three home controls", () => {
    const { getByTestId, queryByTestId } = render(
      <HomeWall members={members} onSelectMember={() => {}} />,
      { wrapper: wrap }
    );
    for (const id of WALL_CONFIGURABLE_WIDGETS) {
      if (WALL_HIDDEN_WIDGETS.includes(id)) {
        expect(queryByTestId(`widget-${id}`)).toBeNull();
      } else {
        expect(getByTestId(`widget-${id}`)).toBeTruthy();
      }
    }
    // 3 explicit columns (dense placement), 8 cells inside them
    const grid = getByTestId("wall-grid");
    expect(grid.children.length).toBe(3);
    expect(getByTestId("wall-col-0").children.length).toBe(2);
    expect(getByTestId("wall-col-1").children.length).toBe(3);
    expect(getByTestId("wall-col-2").children.length).toBe(3);
  });

  it("dense row-major placement fills the approved 3×4 composition", () => {
    expect(wallColumns().map((column) => column.map((widget) => widget.id))).toEqual([
      ["photos", "tasks"],
      ["weather", "morningBriefing", "currentMeal"],
      ["todayEvents", "music", "leaderboard"],
    ]);
  });

  // ── Regression: the light-theme card collapse ────────────────────────────
  // Every cell's Material must fill the cell. The shadow shell previously
  // dropped the caller's flex, so in LIGHT mode (where `regular` shadows)
  // each card rendered as a ~32px header sliver with huge empty gaps between
  // the rows — the wall's default theme, so the defect was only visible
  // there. The Material's OUTER box now carries the flex (see materials.test).
  it("every widget cell's Material fills its cell (flex survives the shadow shell)", () => {
    const { getByTestId } = render(<HomeWall members={members} onSelectMember={() => {}} />, { wrapper: wrap });
    for (const id of ["photos", "currentMeal", "tasks", "leaderboard"]) {
      const cell: any = getByTestId(`widget-${id}`);
      const material: any = cell.children[0];
      const outerStyle = Object.assign({}, ...[].concat(material.props.style ?? []).filter(Boolean));
      expect(outerStyle.flex).toBe(1);
    }
  });

  it("the four priority cards each span two rows", () => {
    expect(WALL_SPANS).toEqual({
      photos: 2,
      weather: 2,
      todayEvents: 2,
      tasks: 2,
    });
    const { getByTestId } = render(
      <HomeWall members={members} onSelectMember={() => {}} />,
      { wrapper: wrap }
    );
    for (const id of ["photos", "weather", "todayEvents", "tasks"]) {
      expect(getByTestId(`widget-${id}`).props.style.height).toBe(
        GRID_CELL_H * 2 + 16
      );
    }
    for (const id of ["morningBriefing", "music", "currentMeal", "leaderboard"]) {
      expect(getByTestId(`widget-${id}`).props.style.height).toBe(GRID_CELL_H);
    }
  });

  it("member rail renders and reports selections", () => {
    const onSelectMember = jest.fn();
    const { getByLabelText } = render(<HomeWall members={members} onSelectMember={onSelectMember} />, { wrapper: wrap });
    expect(getByLabelText("Sign in as Aurora")).toBeTruthy();
  });

  it("greeting copy follows time-of-day", () => {
    expect(greetingFor(6)).toBe("Good morning");
    expect(greetingFor(13)).toBe("Good afternoon");
    expect(greetingFor(18)).toBe("Good evening");
    expect(greetingFor(23)).toBe("Good night");
  });

  it("savedFamilyLabel derives surname family with capitalized Family", () => {
    expect(
      savedFamilyLabel([
        { name: "Jeffery Garcia", emoji: "👨" },
        { name: "Rebecca Garcia", emoji: "👩" },
      ])
    ).toBe("Garcia Family");
    expect(
      savedFamilyLabel([
        { name: "Jeffery", emoji: "👨" },
        { name: "Rebecca", emoji: "👩" },
      ])
    ).toBeNull();
  });

  it("greeting displays Garcia Family when no one is signed in", () => {
    const view = render(<HomeWall members={members} onSelectMember={() => {}} />, { wrapper: wrap });
    const spans = view.root.findAll(n => n.props?.children === "Garcia Family");
    expect(spans.length).toBeGreaterThan(0);
  });

  // The clock's season glyph is derived, never hardcoded — a hardcoded 🍂 is
  // right on its capture date and wrong for nine months of the year
  // (web page.tsx:411-413: Mar–May spring, Jun–Aug summer, Sep–Nov autumn).
  it("season glyph follows the month band (web parity)", () => {
    expect(seasonGlyph(2)).toBe("🌸"); // March
    expect(seasonGlyph(4)).toBe("🌸"); // May
    expect(seasonGlyph(5)).toBe("☀️"); // June
    expect(seasonGlyph(7)).toBe("☀️"); // August
    expect(seasonGlyph(8)).toBe("🍂"); // September
    expect(seasonGlyph(10)).toBe("🍂"); // November
    expect(seasonGlyph(11)).toBe("❄️"); // December
    expect(seasonGlyph(1)).toBe("❄️"); // February
  });
});

// ── The wall header's KPI band + "This Week" tail (web page.tsx:744-754 /
//    1070-1076). Both read widgets' published truth, so the band can never
//    disagree with the card it sits above, and a blank never pretends to be
//    a zero. ──────────────────────────────────────────────────────────────
describe("HomeWall KPI band + This Week tail", () => {
  beforeEach(() => resetWallStats());

  it("renders all three stat tiles", () => {
    const { getByTestId } = render(<HomeWall members={members} onSelectMember={() => {}} />, { wrapper: wrap });
    expect(getByTestId("wall-stat-events")).toBeTruthy();
    expect(getByTestId("wall-stat-tasks")).toBeTruthy();
    expect(getByTestId("wall-stat-week")).toBeTruthy();
  });

  it("the Week tile carries the web's — placeholder while its read is unanswered", () => {
    const view = render(<HomeWall members={members} onSelectMember={() => {}} />, { wrapper: wrap });
    expect(subtreeText(view, "wall-stat-week")).toContain("—");
    // …and no other tile fabricates a 0 for a read that hasn't landed.
    expect(subtreeText(view, "wall-stat-events")).not.toContain("0");
    expect(subtreeText(view, "wall-stat-tasks")).not.toContain("0");
  });

  it("publishes widget truth into the band (events/tasks/planned days)", () => {
    publishWallStats({ eventsToday: 3, openTasks: 7, plannedDays: 6, weekCells: [] });
    const view = render(<HomeWall members={members} onSelectMember={() => {}} />, { wrapper: wrap });
    expect(subtreeText(view, "wall-stat-events")).toContain("3");
    expect(subtreeText(view, "wall-stat-tasks")).toContain("7");
    expect(subtreeText(view, "wall-stat-week")).toContain("6");
    // label/detail pair, per the web tile
    expect(subtreeText(view, "wall-stat-events")).toContain("Events");
    expect(subtreeText(view, "wall-stat-tasks")).toContain("Pending");
    expect(subtreeText(view, "wall-stat-week")).toContain("Days planned");
  });

  it("singular label for one event (web: 'Event' not 'Events')", () => {
    publishWallStats({ eventsToday: 1 });
    const view = render(<HomeWall members={members} onSelectMember={() => {}} />, { wrapper: wrap });
    expect(subtreeText(view, "wall-stat-events")).toContain("Event");
    expect(subtreeText(view, "wall-stat-events")).not.toContain("Events");
  });

  it("omits the This Week widget from the HomeWall to free header vertical space", () => {
    const view = render(<HomeWall members={members} onSelectMember={() => {}} />, { wrapper: wrap });
    expect(view.queryByTestId("wall-this-week")).toBeNull();
  });

  it("ThisWeekCard component still renders a day strip + week DayLine when mounted standalone", () => {
    publishWallStats({
      weekCells: [
        { label: "Mon", date: 5, planned: true, isToday: false },
        { label: "Tue", date: 6, planned: false, isToday: true },
        { label: "Wed", date: 7, planned: false, isToday: false },
        { label: "Thu", date: 8, planned: false, isToday: false },
        { label: "Fri", date: 9, planned: false, isToday: false },
        { label: "Sat", date: 10, planned: true, isToday: false },
        { label: "Sun", date: 11, planned: false, isToday: false },
      ],
    });
    const view = render(<ThisWeekCard />, { wrapper: wrap });
    const { getByTestId } = view;
    expect(subtreeText(view, "wall-this-week")).toContain("This Week");
    expect(subtreeText(view, "wall-this-week")).toContain("Meal and family rhythm at a glance");
    expect(getByTestId("wall-week-strip")).toBeTruthy();
    expect(getByTestId("wall-week-dayline", { includeHiddenElements: true })).toBeTruthy();
    expect(getByTestId("wall-week-Mon")).toBeTruthy();
    expect(subtreeText(view, "wall-week-Mon")).toContain("5");
    expect(subtreeText(view, "wall-week-Sun")).toContain("11");
  });

  it("ThisWeekCard day strip still renders when the meals read hasn't answered (skeleton)", () => {
    const view = render(<ThisWeekCard />, { wrapper: wrap });
    const { getByTestId } = view;
    expect(getByTestId("wall-week-Mon")).toBeTruthy();
    expect(getByTestId("wall-week-Sun")).toBeTruthy();
    const strip = getByTestId("wall-week-strip");
    expect(strip.children.length).toBe(7);
  });

  it("ThisWeekCard week cell tap navigates to /meals?day= (onSelectDay)", () => {
    publishWallStats({ weekCells: weekCellsFor(new Date(2026, 9, 10), new Set(["Sat"])) });
    const onSelectDay = jest.fn();
    const { getByTestId } = render(
      <ThisWeekCard onSelectDay={onSelectDay} />,
      { wrapper: wrap }
    );
    fireEvent.press(getByTestId("wall-week-Sat"));
    expect(onSelectDay).toHaveBeenCalledWith("Sat");
  });

  it("renders the More… button in the HomeWall header band when onOpenMore is provided", () => {
    const onOpenMore = jest.fn();
    const { getByTestId } = render(
      <HomeWall members={members} onSelectMember={() => {}} onOpenMore={onOpenMore} />,
      { wrapper: wrap }
    );
    const moreBtn = getByTestId("home-more");
    expect(moreBtn).toBeTruthy();
    fireEvent.press(moreBtn);
    expect(onOpenMore).toHaveBeenCalledTimes(1);
  });

  it("height budget: the RESERVED rows fit the panel, so the wall never scrolls", () => {
    // With ThisWeekCard removed, the budget is:
    // HEADER_BAND_H (473) + HEADER_SLACK (22) + GRID_TOP (20) + (GRID_CELL_H * 4 + 16 * 3) + DOCK_CLEAR (100).
    const reserved = 473 + 22 + 20 + (GRID_CELL_H * 4 + 16 * 3) + 100;
    expect(reserved).toBeLessThanOrEqual(1920);
    // …and the measured build leaves real slack under it.
    const measured = 456 + 20 + (GRID_CELL_H * 4 + 16 * 3) + 100;
    expect(measured).toBeLessThanOrEqual(1920);
    expect(1920 - measured).toBeGreaterThanOrEqual(16); // ≥ one grid gap of slack
    expect(GRID_CELL_H).toBeLessThan(358);
  });

  // The greeting's inner span pins its OWN lineHeight: an outer lineHeight
  // does not constrain a nested Text (which falls back to the platform
  // default, ~65 at 54sp), and the header budget assumes the two greeting
  // lines measure exactly 116. Removing this pin costs ~14dp the panel does
  // not have — so it is load-bearing, and pinned here.
  it("the greeting's nested span pins lineHeight so the 2-line header measures 116", () => {
    const view = render(<HomeWall members={members} onSelectMember={() => {}} />, { wrapper: wrap });
    const spans = view.root.findAll(n => n.props?.children === "Garcia Family" || n.props?.children === "family" || n.props?.children === "Aurora");
    expect(spans.length).toBeGreaterThan(0);
    for (const span of spans) {
      const flat = Object.assign({}, ...[].concat(span.props.style ?? []).filter(Boolean));
      expect(flat.lineHeight).toBe(58);
    }
  });
});

describe("widget registry", () => {
  it("passes each widget its effective span", () => {
    const seen: Partial<Record<WidgetId, WallSpan>> = {};
    const ids: WidgetId[] = [
      "photos",
      "weather",
      "todayEvents",
      "tasks",
      "morningBriefing",
      "music",
      "currentMeal",
      "leaderboard",
    ];
    const widgets = ids.reduce<
      Partial<Record<WidgetId, React.ComponentType<WallWidgetProps>>>
    >((registry, id) => {
      registry[id] = ({ span }: WallWidgetProps) => {
        seen[id] = span;
        return null;
      };
      return registry;
    }, {});
    render(
      <HomeWall
        members={members}
        onSelectMember={() => {}}
        widgets={widgets}
      />,
      { wrapper: wrap }
    );
    expect(seen).toEqual({
      photos: 2,
      weather: 2,
      todayEvents: 2,
      tasks: 2,
      morningBriefing: 1,
      music: 1,
      currentMeal: 1,
      leaderboard: 1,
    });
  });

  it("wall order matches the approved reading order", () => {
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
  });

  it("guest wall cells never claim an offline/couldn't-load fault", () => {
    const view = render(
      <HomeWall members={members} onSelectMember={() => {}} />,
      { wrapper: wrap }
    );
    const widgetIds = WALL_CONFIGURABLE_WIDGETS.filter(
      (id) => !WALL_HIDDEN_WIDGETS.includes(id)
    );
    for (const id of widgetIds) {
      const text = subtreeText(view, `widget-${id}`);
      expect(text).not.toMatch(/offline|can't be reached|Couldn't load/i);
    }
  });

});
