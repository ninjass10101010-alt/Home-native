/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { render } from "@testing-library/react-native";

import { ThemeProvider } from "../src/theme/ThemeProvider";
import { HomeWall, greetingFor, GRID_CELL_H } from "../src/home/HomeWall";
import { visibleOnWall, WALL_SPANS, WALL_HIDDEN_WIDGETS, WALL_DEFAULT_WIDGETS } from "../src/home/widgets";


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

describe("HomeWall (the 12-cell wall bento)", () => {
  it("renders the 11 default widgets in wall order + hides the 4 ambient/finance ones", () => {
    const { getByTestId, queryByTestId } = render(
      <HomeWall members={members} onSelectMember={() => {}} />,
      { wrapper: wrap }
    );
    for (const id of WALL_DEFAULT_WIDGETS) {
      if (WALL_HIDDEN_WIDGETS.includes(id)) {
        expect(queryByTestId(`widget-${id}`)).toBeNull();
      } else {
        expect(getByTestId(`widget-${id}`)).toBeTruthy();
      }
    }
    // exactly 11 visible cells
    const grid = getByTestId("wall-grid");
    expect(grid.children.length).toBe(11);
  });

  it("photos spans 2 rows (the wall-hero contract)", () => {
    expect(WALL_SPANS.photos).toBe(2);
    const { getByTestId } = render(<HomeWall members={members} onSelectMember={() => {}} />, { wrapper: wrap });
    const photos = getByTestId("widget-photos");
    const tasks = getByTestId("widget-tasks");
    expect(photos.props.style.height).toBe(GRID_CELL_H * 2 + 16);
    expect(tasks.props.style.height).toBe(GRID_CELL_H);
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
});

describe("widget registry", () => {
  it("wall order matches layout-config TABLET order", () => {
    expect(visibleOnWall()[0].id).toBe("photos");
    const ids = visibleOnWall().map((w) => w.id);
    expect(ids).toEqual([
      "photos",
      "morningBriefing", "weather", "todayEvents", "tasks",
      "currentMeal", "aiQuickAsk", "leaderboard",
      "homeSecurity", "homeClimate", "homeLights",
    ]);
  });
});
