/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";

import { ThemeProvider } from "../src/theme/ThemeProvider";
import { MealsPage } from "../src/meals/MealsPage";
import { currentSlotForHour } from "../src/meals/plan-grid";
import MealsRoute from "../app/meals";

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
  usePathname: () => "/meals",
}));

const parent = { id: "p1", name: "Rebecca (Mom)", role: "parent", emoji: "🐱", color: "green" };

let mockMember: any = parent;
jest.mock("../src/state/AuthProvider", () => ({
  useAuth: () => ({
    member: mockMember,
    hydrated: true,
    signOut: jest.fn(),
    poke: jest.fn(),
    pinRequiredFor: jest.requireActual("../src/state/AuthProvider").pinRequiredFor,
  }),
}));

let mockStale = false;
const mockRefreshNow = jest.fn(async () => {});
const mockPulseListeners = new Set<() => void>();
// Stable value object — mirrors SyncManager's useMemo so effect deps settle.
const mockSyncValue = {
  get stale() {
    return mockStale;
  },
  syncError: null as null,
  lastSyncAt: null as null,
  refreshNow: mockRefreshNow,
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
const { ApiError } = jest.requireActual("../src/api/client") as { ApiError: any };

const wrap = ({ children }: { children: React.ReactNode }) => <ThemeProvider>{children}</ThemeProvider>;

/** Path-prefix router for the mocked api(). */
const route = (handlers: Record<string, unknown>) =>
  api.mockImplementation((path: string) => {
    for (const key of Object.keys(handlers)) {
      if (path.startsWith(key)) {
        const v = handlers[key];
        return v instanceof Error ? Promise.reject(v) : Promise.resolve(v);
      }
    }
    return Promise.reject(new ApiError({ message: "unmapped path", status: 404, code: "not_found" }));
  });

// ── Fixtures. NOW is pinned: Saturday 2026-10-10 09:00 local (hour 9 → the
// breakfast band). The Mon-start week runs 2026-10-05..2026-10-11, so
// weekOf-Monday is "2026-10-05" and last week's is "2026-09-28". ──
const NOW = new Date(2026, 9, 10, 9, 0);
const NOW_EVENING = new Date(2026, 9, 10, 18, 0);
const WEEK_MONDAY = "2026-10-05";
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const SLOTS = ["breakfast", "lunch", "snack", "dinner"] as const;

// PB delivers tags/ingredients JSON-STRINGIFIED (meal-rows.ts parses on read).
const MEALS = [
  {
    id: 1, name: "Taco Night", emoji: "🌮", time: "Sat", mealType: "dinner", prepTime: "20 min",
    tags: '["Family Fave","Quick"]', ingredients: '["Ground beef","Taco shells","Salsa"]',
    servings: 4, calories: 550, protein: 32, carbs: 41, fat: 18, weekOf: WEEK_MONDAY,
  },
  {
    id: 2, name: "Pancakes", emoji: "🥞", time: "Sat", mealType: "breakfast", prepTime: "20 min",
    tags: '["Kids Love"]', ingredients: '["Flour","Eggs","Milk"]',
    servings: 3, calories: 450, protein: 12, carbs: 60, fat: 15,
  },
  {
    id: 3, name: "Grilled Cheese", emoji: "🧀", time: "Mon", mealType: "lunch", prepTime: "10 min",
    tags: "[]", ingredients: "[]", servings: 2, calories: 380, weekOf: WEEK_MONDAY,
  },
  {
    id: 4, name: "Last Week Chili", emoji: "🍲", time: "Sat", mealType: "dinner", prepTime: "6 hr",
    tags: "[]", ingredients: "[]", servings: 6, calories: 500, weekOf: "2026-09-28",
  },
];

const fullRoute = () => route({ "/api/db/meal_plan_entries": { items: MEALS } });

/** Does the rendered subtree under rootTid contain needleTid? (Now-chip placement) */
const subtreeHas = (result: { toJSON: () => any }, rootTid: string, needleTid: string): boolean => {
  const find = (node: any): any => {
    if (!node || typeof node !== "object") return null;
    if (node.props?.testID === rootTid) return node;
    for (const c of Array.isArray(node.children) ? node.children : []) {
      const hit = find(c);
      if (hit) return hit;
    }
    return null;
  };
  const contains = (node: any): boolean => {
    if (!node || typeof node !== "object") return false;
    if (node.props?.testID === needleTid) return true;
    return (Array.isArray(node.children) ? node.children : []).some(contains);
  };
  const root = find(result.toJSON());
  return root ? contains(root) : false;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPulseListeners.clear();
  mockMember = parent;
  mockStale = false;
  api.mockReset();
});

describe("MealsPage — week grid", () => {
  it("renders the 7 Mon–Sun day columns × 4 slot rows (28 cells)", async () => {
    fullRoute();
    const { getByTestId, findByText } = render(<MealsPage now={NOW} />, { wrapper: wrap });
    await findByText("Taco Night");
    for (const day of DAYS) {
      expect(getByTestId(`meals-day-${day}`)).toBeTruthy();
      for (const slot of SLOTS) {
        expect(getByTestId(`meals-cell-${day}-${slot}`)).toBeTruthy();
      }
    }
  });

  it("marks today's column header as Today (accent highlight)", async () => {
    fullRoute();
    const { getByTestId, findByText } = render(<MealsPage now={NOW} />, { wrapper: wrap });
    await findByText("Taco Night");
    expect(getByTestId("meals-day-Sat").props.accessibilityLabel).toBe("Today");
    expect(getByTestId("meals-day-Mon").props.accessibilityLabel).toBe("Mon");
  });

  it("the current slot row carries the Now chip (9am → breakfast; 6pm → dinner)", async () => {
    fullRoute();
    const morning = render(<MealsPage now={NOW} />, { wrapper: wrap });
    await morning.findByText("Taco Night");
    expect(subtreeHas(morning, "meals-slot-breakfast", "meals-now-chip")).toBe(true);
    expect(subtreeHas(morning, "meals-slot-dinner", "meals-now-chip")).toBe(false);
    morning.unmount();

    const evening = render(<MealsPage now={NOW_EVENING} />, { wrapper: wrap });
    await evening.findByText("Taco Night");
    expect(subtreeHas(evening, "meals-slot-dinner", "meals-now-chip")).toBe(true);
    expect(subtreeHas(evening, "meals-slot-breakfast", "meals-now-chip")).toBe(false);
  });

  it("places a weekOf-matched meal in its day column and drops last week's", async () => {
    fullRoute();
    const { findByText, getByTestId, queryByText } = render(<MealsPage now={NOW} />, { wrapper: wrap });
    await findByText("Taco Night");
    // this Monday's Monday-lunch lands in the Mon column cell
    expect(getByTestId("meals-cell-Mon-lunch").props.accessibilityLabel).toBe("🧀 Grilled Cheese");
    // last week's Saturday dinner must NOT render anywhere
    expect(queryByText("Last Week Chili")).toBeNull();
  });

  it("a meal with no weekOf defaults to the current week (web parity)", async () => {
    fullRoute();
    const { findByText } = render(<MealsPage now={NOW} />, { wrapper: wrap });
    expect(await findByText("Pancakes")).toBeTruthy();
  });

  it("shows the honest read-only note where the web has add affordances", async () => {
    fullRoute();
    const { findByText, getByTestId } = render(<MealsPage now={NOW} />, { wrapper: wrap });
    await findByText("Taco Night");
    expect(getByTestId("meals-readonly-note")).toBeTruthy();
    expect(
      getByTestId("meals-readonly-note").props.children
    ).toBe("Adding meals from the wall arrives with the next wave — ask a parent on the phone.");
  });
});

describe("MealsPage — detail modal", () => {
  it("tapping a meal cell opens the read-only modal with parsed tags/ingredients and facts", async () => {
    fullRoute();
    const { getByTestId, findByTestId, findByText, getByText, queryAllByText } = render(
      <MealsPage now={NOW} />,
      { wrapper: wrap }
    );
    await findByText("Taco Night");
    await act(async () => {
      fireEvent.press(getByTestId("meals-cell-Sat-dinner"));
      await Promise.resolve();
    });
    expect(await findByTestId("meals-detail")).toBeTruthy();
    // title + description
    expect(getByText("Saturday Dinner · 6:30 PM")).toBeTruthy();
    // stringified → array parse (PB rows arrive JSON-encoded)
    expect(await findByText("Family Fave")).toBeTruthy();
    expect(getByText("Quick")).toBeTruthy();
    expect(getByText("Ground beef")).toBeTruthy();
    expect(getByText("Taco shells")).toBeTruthy();
    // facts: calories / prep / macros chips
    expect(getByText("🔥 550 kcal")).toBeTruthy();
    expect(getByText("⏱ 20 min")).toBeTruthy();
    expect(getByText("👨‍👩‍👧‍👦 4")).toBeTruthy();
    expect(getByText("💪 32g protein")).toBeTruthy();

    // read-only modal closes
    await act(async () => {
      fireEvent.press(getByText("Close"));
      await Promise.resolve();
    });
    expect(queryAllByText("Taco Night")).toHaveLength(1); // grid copy only — modal gone
  });

  it("empty cells are not tappable (no dead affordances)", async () => {
    fullRoute();
    const { getByTestId, findByText } = render(<MealsPage now={NOW} />, { wrapper: wrap });
    await findByText("Taco Night");
    const emptyCell = getByTestId("meals-cell-Tue-snack");
    expect(emptyCell.props.accessibilityRole).toBeUndefined();
  });
});

describe("MealsPage — tabs", () => {
  it("Shop and Stock tabs show the honest Groceries-surface deferral copy", async () => {
    fullRoute();
    const { findByText, getByText, queryByTestId } = render(<MealsPage now={NOW} />, { wrapper: wrap });
    await findByText("Taco Night");
    await act(async () => {
      fireEvent.press(getByText("Shop"));
      await Promise.resolve();
    });
    expect(
      await findByText("The grocery list and pantry arrive with the Groceries surface in the next wave.")
    ).toBeTruthy();
    expect(queryByTestId("meals-cell-Sat-dinner")).toBeNull();

    await act(async () => {
      fireEvent.press(getByText("Stock"));
      await Promise.resolve();
    });
    expect(
      await findByText("The grocery list and pantry arrive with the Groceries surface in the next wave.")
    ).toBeTruthy();
    // Plan returns the grid
    await act(async () => {
      fireEvent.press(getByText("Plan"));
      await Promise.resolve();
    });
    expect(queryByTestId("meals-cell-Sat-dinner")).toBeTruthy();
  });
});

describe("MealsPage — states", () => {
  it("empty week: honest Wave 1 copy", async () => {
    route({ "/api/db/meal_plan_entries": { items: [] } });
    const { findByText } = render(<MealsPage now={NOW} />, { wrapper: wrap });
    expect(await findByText("No meals planned yet — Plan dinner in the Kitchen tab.")).toBeTruthy();
  });

  it("guest gate: honest PIN copy, no doomed fetches", async () => {
    mockMember = null;
    const { findByText } = render(<MealsPage now={NOW} />, { wrapper: wrap });
    expect(await findByText("Sign in with your PIN to see the family's meals.")).toBeTruthy();
    expect(api).not.toHaveBeenCalled();
  });

  it("stale badge when the sync layer reports staleness", async () => {
    fullRoute();
    mockStale = true;
    const { getByTestId, findByText } = render(<MealsPage now={NOW} />, { wrapper: wrap });
    await findByText("Taco Night");
    expect(getByTestId("meals-stale")).toBeTruthy();
    expect(getByTestId("meals-stale").props.children).toBe("Showing your saved copy — couldn't refresh.");
  });

  it("no stale badge when the last refresh succeeded", async () => {
    fullRoute();
    const { queryByTestId, findByText } = render(<MealsPage now={NOW} />, { wrapper: wrap });
    await findByText("Taco Night");
    expect(queryByTestId("meals-stale")).toBeNull();
  });

  it("read failure: honest error copy with retry", async () => {
    route({
      "/api/db/meal_plan_entries": new ApiError({
        message: "db_error",
        status: 502,
        code: "http_502",
        retryable: true,
      }),
    });
    const { findByText, getByText } = render(<MealsPage now={NOW} />, { wrapper: wrap });
    expect(await findByText("Couldn't load this right now.")).toBeTruthy();
    expect(getByText("Try again")).toBeTruthy();
  });
});

describe("plan-grid — ported slot math", () => {
  it("currentSlotForHour follows the PlanTab time-of-day bands", () => {
    expect(currentSlotForHour(0)).toBe("breakfast");
    expect(currentSlotForHour(9)).toBe("breakfast");
    expect(currentSlotForHour(10)).toBe("lunch"); // <10 breakfast band ends
    expect(currentSlotForHour(13)).toBe("lunch");
    expect(currentSlotForHour(14)).toBe("snack"); // <14 lunch band ends
    expect(currentSlotForHour(16)).toBe("snack");
    expect(currentSlotForHour(17)).toBe("dinner"); // <17 snack band ends
    expect(currentSlotForHour(23)).toBe("dinner");
  });
});

describe("Meals route", () => {
  it("app/meals renders the page + the manifest dock with the Meals cap active", async () => {
    fullRoute();
    const { getByTestId, findByTestId } = render(<MealsRoute />, { wrapper: wrap });
    expect(getByTestId("meals-route")).toBeTruthy();
    const todayShort = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][(new Date().getDay() + 6) % 7];
    expect(await findByTestId(`meals-day-${todayShort}`)).toBeTruthy();
    expect(getByTestId("dock-meals")).toBeTruthy();
    expect(getByTestId("dock-meals").props.accessibilityState?.selected).toBe(true);
  });
});
