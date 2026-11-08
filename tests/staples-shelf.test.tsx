/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { HOUSEHOLD_STAPLES, isStapleOnList } from "../src/meals/staples-shelf";
import { ShopStockTabs } from "../src/meals/ShopStockTabs";
import type { GroceryItem, PantryItem } from "../src/meals/api";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

const wrap = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

describe("staples-shelf — HOUSEHOLD_STAPLES & isStapleOnList unit tests", () => {
  it("exports exactly 10 curated household staples with valid fields", () => {
    expect(HOUSEHOLD_STAPLES).toHaveLength(10);
    expect(HOUSEHOLD_STAPLES.map((s) => s.id)).toEqual([
      "milk",
      "eggs",
      "bananas",
      "bread",
      "berries",
      "cheese",
      "avocados",
      "chicken",
      "pasta",
      "butter",
    ]);

    for (const staple of HOUSEHOLD_STAPLES) {
      expect(staple.id).toBeTruthy();
      expect(staple.name).toBeTruthy();
      expect(staple.emoji).toBeTruthy();
      expect(staple.category).toBeTruthy();
      expect(staple.defaultQty).toBeTruthy();
    }

    const milk = HOUSEHOLD_STAPLES.find((s) => s.id === "milk");
    expect(milk).toEqual({
      id: "milk",
      name: "Milk",
      emoji: "🥛",
      category: "Meat & Dairy",
      defaultQty: "1 gal",
    });

    const eggs = HOUSEHOLD_STAPLES.find((s) => s.id === "eggs");
    expect(eggs).toEqual({
      id: "eggs",
      name: "Eggs",
      emoji: "🥚",
      category: "Meat & Dairy",
      defaultQty: "1 doz",
    });
  });

  describe("isStapleOnList", () => {
    const list = [
      { name: "Milk" },
      { name: "Sourdough Bread" },
      { name: "Strawberries" },
    ];

    it("matches exact name", () => {
      expect(isStapleOnList("Milk", list)).toBe(true);
      expect(isStapleOnList("Sourdough Bread", list)).toBe(true);
    });

    it("matches case-insensitively and handles whitespace trimming", () => {
      expect(isStapleOnList("milk", list)).toBe(true);
      expect(isStapleOnList("  MILK  ", list)).toBe(true);
      expect(isStapleOnList("sourdough bread", list)).toBe(true);
      expect(isStapleOnList("  Strawberries  ", list)).toBe(true);
    });

    it("returns false for staples not on the list", () => {
      expect(isStapleOnList("Eggs", list)).toBe(false);
      expect(isStapleOnList("Bananas", list)).toBe(false);
      expect(isStapleOnList("Butter", list)).toBe(false);
    });

    it("handles empty lists or empty inputs gracefully without throwing", () => {
      expect(isStapleOnList("", list)).toBe(false);
      expect(isStapleOnList("   ", list)).toBe(false);
      expect(isStapleOnList("Milk", [])).toBe(false);
      // @ts-expect-error test malformed inputs
      expect(isStapleOnList("Milk", null)).toBe(false);
      // @ts-expect-error test malformed inputs
      expect(isStapleOnList(null, list)).toBe(false);
      expect(isStapleOnList("Milk", [{ name: "" }, { name: "Eggs" }])).toBe(false);
    });
  });
});

describe("ShopStockTabs — ⚡ 1-Tap Household Staples Shelf component tests", () => {
  const defaultProps = {
    mode: "shop" as const,
    groceryItems: [] as GroceryItem[],
    pantryItems: [] as PantryItem[],
    missingFromPlan: [],
    onToggleGrocery: jest.fn(),
    onAddGrocery: jest.fn(),
    onClearCheckedGrocery: jest.fn(),
    onSyncMissingToGrocery: jest.fn(),
    onMoveCheckedToPantry: jest.fn(),
    onCyclePantryStatus: jest.fn(),
    onAddPantry: jest.fn(),
    onSendLowPantryToGrocery: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("in 'shop' mode", () => {
    it("renders grocery-staples-shelf with correct headers and all 10 staple pills", () => {
      const { getByTestId, getByText } = render(
        <ShopStockTabs {...defaultProps} mode="shop" />,
        { wrapper: wrap }
      );

      expect(getByTestId("grocery-staples-shelf")).toBeTruthy();
      expect(getByText("⚡ 1-Tap Household Staples")).toBeTruthy();
      expect(
        getByText("Tap any staple to drop it straight onto the shopping list")
      ).toBeTruthy();

      for (const staple of HOUSEHOLD_STAPLES) {
        expect(getByTestId(`staple-quick-${staple.id}`)).toBeTruthy();
        expect(getByText(staple.name)).toBeTruthy();
      }
    });

    it("tapping staple-quick-milk calls onAddGrocery with defaultQty and category", () => {
      const onAddGrocery = jest.fn();
      const { getByTestId } = render(
        <ShopStockTabs {...defaultProps} mode="shop" onAddGrocery={onAddGrocery} />,
        { wrapper: wrap }
      );

      const milkPill = getByTestId("staple-quick-milk");
      fireEvent.press(milkPill);

      expect(onAddGrocery).toHaveBeenCalledTimes(1);
      expect(onAddGrocery).toHaveBeenCalledWith({
        name: "Milk",
        category: "Meat & Dairy",
        quantity: "1 gal",
      });
    });

    it("when Milk is already in groceryItems, displays '✓ Added' and ignores taps", () => {
      const onAddGrocery = jest.fn();
      const groceryItems: GroceryItem[] = [
        {
          id: "g1",
          name: "Milk",
          category: "Meat & Dairy",
          quantity: "1 gal",
          checked: false,
        },
      ];

      const { getByTestId, getByText } = render(
        <ShopStockTabs
          {...defaultProps}
          mode="shop"
          groceryItems={groceryItems}
          onAddGrocery={onAddGrocery}
        />,
        { wrapper: wrap }
      );

      const milkPill = getByTestId("staple-quick-milk");
      expect(getByText("✓ Added")).toBeTruthy();

      fireEvent.press(milkPill);
      expect(onAddGrocery).not.toHaveBeenCalled();
    });
  });

  describe("in 'stock' mode", () => {
    it("renders grocery-staples-shelf with pantry subtitle", () => {
      const { getByTestId, getByText } = render(
        <ShopStockTabs {...defaultProps} mode="stock" />,
        { wrapper: wrap }
      );

      expect(getByTestId("grocery-staples-shelf")).toBeTruthy();
      expect(getByText("⚡ 1-Tap Household Staples")).toBeTruthy();
      expect(
        getByText("Tap any staple to add it to your pantry inventory")
      ).toBeTruthy();
    });

    it("tapping staple-quick-milk calls onAddPantry with status 'stocked'", () => {
      const onAddPantry = jest.fn();
      const { getByTestId } = render(
        <ShopStockTabs {...defaultProps} mode="stock" onAddPantry={onAddPantry} />,
        { wrapper: wrap }
      );

      const milkPill = getByTestId("staple-quick-milk");
      fireEvent.press(milkPill);

      expect(onAddPantry).toHaveBeenCalledTimes(1);
      expect(onAddPantry).toHaveBeenCalledWith({
        name: "Milk",
        category: "Meat & Dairy",
        quantity: "1 gal",
        status: "stocked",
      });
    });

    it("when Milk is already in pantryItems, displays '✓ Added' and ignores taps", () => {
      const onAddPantry = jest.fn();
      const pantryItems: PantryItem[] = [
        {
          id: "p1",
          name: "milk",
          category: "Meat & Dairy",
          quantity: "1 gal",
          status: "stocked",
        },
      ];

      const { getByTestId, getByText } = render(
        <ShopStockTabs
          {...defaultProps}
          mode="stock"
          pantryItems={pantryItems}
          onAddPantry={onAddPantry}
        />,
        { wrapper: wrap }
      );

      const milkPill = getByTestId("staple-quick-milk");
      expect(getByText("✓ Added")).toBeTruthy();

      fireEvent.press(milkPill);
      expect(onAddPantry).not.toHaveBeenCalled();
    });
  });
});
