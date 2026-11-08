import type { GroceryCategory } from "./api";

export interface StapleItem {
  id: string;
  name: string;
  emoji: string;
  category: GroceryCategory;
  defaultQty: string;
}

export const HOUSEHOLD_STAPLES: StapleItem[] = [
  { id: "milk", name: "Milk", emoji: "🥛", category: "Meat & Dairy", defaultQty: "1 gal" },
  { id: "eggs", name: "Eggs", emoji: "🥚", category: "Meat & Dairy", defaultQty: "1 doz" },
  { id: "bananas", name: "Bananas", emoji: "🍌", category: "Produce", defaultQty: "1 bunch" },
  { id: "bread", name: "Sourdough Bread", emoji: "🍞", category: "Bakery", defaultQty: "1 loaf" },
  { id: "berries", name: "Strawberries", emoji: "🍓", category: "Produce", defaultQty: "1 pack" },
  { id: "cheese", name: "Shredded Cheese", emoji: "🧀", category: "Meat & Dairy", defaultQty: "1 bag" },
  { id: "avocados", name: "Avocados", emoji: "🥑", category: "Produce", defaultQty: "3 ct" },
  { id: "chicken", name: "Chicken Breast", emoji: "🍗", category: "Meat & Dairy", defaultQty: "2 lbs" },
  { id: "pasta", name: "Penne Pasta", emoji: "🍝", category: "Pantry", defaultQty: "1 box" },
  { id: "butter", name: "Butter", emoji: "🧈", category: "Meat & Dairy", defaultQty: "1 pack" },
];

/**
 * Case-insensitive trimmed check to determine if a staple item is already on
 * the grocery list or pantry inventory.
 */
export function isStapleOnList(
  stapleName: string,
  items: { name: string }[]
): boolean {
  if (!stapleName || !items || !Array.isArray(items)) return false;
  const target = stapleName.trim().toLowerCase();
  return items.some((item) => (item?.name ? item.name.trim().toLowerCase() === target : false));
}
