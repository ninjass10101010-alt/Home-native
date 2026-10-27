import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, ApiError } from "../api/client";
import type { DbListEnvelope } from "../api/types";
import { mapMealRows, type MealRow, type MealSlotId, type ParsedMeal } from "./plan-grid";
import type { SlotScheduleRow } from "./slot";

/**
 * Kitchen API & Hybrid Local Persistence Layer.
 *
 * Bridges the LAN PocketBase db-gateway (`/api/db/meal_plan_entries`,
 * `/api/db/grocery_items`, `/api/db/pantry_items`, `/api/db/recipes`) with
 * local `AsyncStorage` durability so every planner edit, grocery check-off,
 * pantry adjustment, and tonight's attendance toggle works instantaneously
 * on the wall tablet — even if the backend gateway is read-only or offline.
 */

const LOCAL_MEALS_KEY = "@consuela/kitchen_meals_v1";
const LOCAL_DELETED_MEALS_KEY = "@consuela/kitchen_deleted_meals_v1";
const LOCAL_GROCERY_KEY = "@consuela/kitchen_grocery_v1";
const LOCAL_PANTRY_KEY = "@consuela/kitchen_pantry_v1";
const LOCAL_ATTENDANCE_KEY = "@consuela/kitchen_attendance_v1";

export type GroceryCategory = "Produce" | "Meat & Dairy" | "Pantry" | "Bakery" | "Frozen" | "Other";

export interface GroceryItem {
  id: string;
  name: string;
  category: GroceryCategory;
  quantity: string;
  checked: boolean;
  fromMeal?: string;
}

export type PantryStatus = "stocked" | "low" | "out";

export interface PantryItem {
  id: string;
  name: string;
  category: GroceryCategory;
  quantity: string;
  status: PantryStatus;
}

export interface MealDraft {
  id?: string | number;
  name: string;
  emoji: string;
  time: string; // "Mon".."Sun"
  mealType: MealSlotId;
  prepTime: string;
  servings: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  tags: string[];
  ingredients: string[];
  instructions?: string;
  weekOf: string;
}

export interface CuratedMealTemplate {
  name: string;
  emoji: string;
  mealType: MealSlotId;
  prepTime: string;
  servings: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  tags: string[];
  ingredients: string[];
  instructions: string;
}

export const CURATED_MEAL_TEMPLATES: CuratedMealTemplate[] = [
  {
    name: "Sheet Pan Fajitas",
    emoji: "🌮",
    mealType: "dinner",
    prepTime: "25 min",
    servings: 6,
    calories: 540,
    protein: 36,
    carbs: 44,
    fat: 20,
    tags: ["Family Fave", "Quick", "One Pan"],
    ingredients: ["Chicken breast", "Bell peppers", "Red onion", "Flour tortillas", "Lime", "Salsa"],
    instructions: "Slice chicken, peppers, and onions. Toss with olive oil and fajita seasoning on a sheet pan. Roast at 425°F for 20 minutes and serve warm in tortillas.",
  },
  {
    name: "Honey Garlic Salmon Bowls",
    emoji: "🍣",
    mealType: "dinner",
    prepTime: "20 min",
    servings: 6,
    calories: 610,
    protein: 42,
    carbs: 52,
    fat: 22,
    tags: ["High Protein", "Healthy", "Quick"],
    ingredients: ["Salmon fillets", "Jasmine rice", "Cucumber", "Avocado", "Soy sauce", "Honey", "Garlic"],
    instructions: "Sear salmon fillets skin-side down, glaze with honey-soy-garlic sauce, and serve over warm jasmine rice with sliced cucumber and avocado.",
  },
  {
    name: "Creamy Tuscan Pasta",
    emoji: "🍝",
    mealType: "dinner",
    prepTime: "30 min",
    servings: 7,
    calories: 640,
    protein: 28,
    carbs: 68,
    fat: 26,
    tags: ["Kids Love", "Comfort Food"],
    ingredients: ["Penne pasta", "Baby spinach", "Sun-dried tomatoes", "Garlic", "Parmesan cheese", "Heavy cream"],
    instructions: "Boil penne until al dente. Simmer garlic, sun-dried tomatoes, cream, and parmesan, wilt in fresh spinach, and toss pasta to coat.",
  },
  {
    name: "Slow Cooker Beef Chili",
    emoji: "🍲",
    mealType: "dinner",
    prepTime: "15 min",
    servings: 8,
    calories: 520,
    protein: 38,
    carbs: 42,
    fat: 18,
    tags: ["Make Ahead", "Cozy", "High Protein"],
    ingredients: ["Ground beef", "Kidney beans", "Black beans", "Crushed tomatoes", "Cheddar cheese", "Cornbread mix"],
    instructions: "Brown ground beef with onions and garlic, transfer to slow cooker with beans, tomatoes, and spices. Simmer 6 hours on low.",
  },
  {
    name: "Blueberry Protein Pancakes",
    emoji: "🥞",
    mealType: "breakfast",
    prepTime: "15 min",
    servings: 6,
    calories: 420,
    protein: 22,
    carbs: 54,
    fat: 12,
    tags: ["Kids Love", "Morning Fuel"],
    ingredients: ["Oat flour", "Eggs", "Greek yogurt", "Fresh blueberries", "Maple syrup", "Milk"],
    instructions: "Whisk oat flour, eggs, yogurt, and milk into a smooth batter. Fold in blueberries and cook on a buttered griddle until golden.",
  },
  {
    name: "Avocado & Egg Breakfast Tacos",
    emoji: "🥑",
    mealType: "breakfast",
    prepTime: "15 min",
    servings: 6,
    calories: 390,
    protein: 20,
    carbs: 28,
    fat: 21,
    tags: ["Quick", "High Protein"],
    ingredients: ["Eggs", "Corn tortillas", "Avocado", "Cotija cheese", "Salsa"],
    instructions: "Scramble eggs softly, warm corn tortillas, and top with sliced avocado, cheese, and salsa.",
  },
  {
    name: "Grilled Pesto Chicken Panini",
    emoji: "🥪",
    mealType: "lunch",
    prepTime: "15 min",
    servings: 4,
    calories: 480,
    protein: 32,
    carbs: 40,
    fat: 19,
    tags: ["Quick", "Lunchbox"],
    ingredients: ["Sourdough bread", "Rotisserie chicken", "Basil pesto", "Mozzarella", "Roma tomatoes"],
    instructions: "Spread pesto on sourdough slices, layer chicken, mozzarella, and tomato, and press on a warm skillet until crisp and melted.",
  },
  {
    name: "Apple Slices & Almond Butter Board",
    emoji: "🍎",
    mealType: "snack",
    prepTime: "5 min",
    servings: 6,
    calories: 240,
    protein: 7,
    carbs: 26,
    fat: 13,
    tags: ["No Cook", "Kids Love"],
    ingredients: ["Honeycrisp apples", "Almond butter", "Granola", "Dark chocolate chips"],
    instructions: "Core and slice apples, fan across a board, drizzle with warm almond butter, and sprinkle with granola.",
  },
];

export const DEFAULT_PANTRY_ITEMS: PantryItem[] = [
  { id: "p-olive-oil", name: "Extra Virgin Olive Oil", category: "Pantry", quantity: "1 bottle", status: "stocked" },
  { id: "p-rice", name: "Jasmine Rice", category: "Pantry", quantity: "4 lbs", status: "stocked" },
  { id: "p-eggs", name: "Pasture-Raised Eggs", category: "Meat & Dairy", quantity: "18 ct", status: "stocked" },
  { id: "p-milk", name: "Whole Milk", category: "Meat & Dairy", quantity: "1 gal", status: "low" },
  { id: "p-garlic", name: "Fresh Garlic", category: "Produce", quantity: "3 bulbs", status: "stocked" },
  { id: "p-pasta", name: "Penne Pasta", category: "Pantry", quantity: "2 boxes", status: "stocked" },
];

export function categorizeIngredient(name: string): GroceryCategory {
  const lower = name.toLowerCase();
  if (/(apple|banana|berry|blueberr|avocado|pepper|onion|garlic|tomato|spinach|cucumber|lime|lemon|lettuce|carrot|potato|broccoli|herb|cilantro|basil)/.test(lower)) {
    return "Produce";
  }
  if (/(chicken|beef|pork|salmon|fish|shrimp|steak|turkey|bacon|sausage|egg|milk|cream|yogurt|cheese|mozzarella|parmesan|cheddar|cotija|butter)/.test(lower)) {
    return "Meat & Dairy";
  }
  if (/(bread|sourdough|tortilla|bun|bagel|roll|pita|croissant)/.test(lower)) {
    return "Bakery";
  }
  if (/(frozen|ice cream|peas|waffle)/.test(lower)) {
    return "Frozen";
  }
  if (/(rice|pasta|penne|flour|oat|bean|salsa|sauce|soy|honey|syrup|oil|pesto|granola|chocolate|spice|salt|cornbread)/.test(lower)) {
    return "Pantry";
  }
  return "Other";
}

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
}

async function writeJson<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore storage write error */
  }
}

export async function readLocalMeals(): Promise<ParsedMeal[]> {
  return readJson<ParsedMeal[]>(LOCAL_MEALS_KEY, []);
}

export async function writeLocalMeals(meals: ParsedMeal[]): Promise<void> {
  await writeJson(LOCAL_MEALS_KEY, meals);
}

export async function readDeletedMealIds(): Promise<string[]> {
  return readJson<string[]>(LOCAL_DELETED_MEALS_KEY, []);
}

export async function writeDeletedMealIds(ids: string[]): Promise<void> {
  await writeJson(LOCAL_DELETED_MEALS_KEY, ids);
}

/**
 * Merges server meal_plan_entries with local overrides and deletions.
 */
export async function mergeMealsWithLocal(serverRows: MealRow[]): Promise<ParsedMeal[]> {
  const serverParsed = mapMealRows(serverRows);
  const [localMeals, deletedIds] = await Promise.all([
    readLocalMeals(),
    readDeletedMealIds(),
  ]);
  const deletedSet = new Set(deletedIds.map(String));
  const localById = new Map<string, ParsedMeal>();
  for (const m of localMeals) {
    if (!deletedSet.has(String(m.id))) {
      localById.set(String(m.id), m);
    }
  }

  const merged: ParsedMeal[] = [];
  const seenIds = new Set<string>();

  for (const s of serverParsed) {
    const sid = String(s.id);
    if (deletedSet.has(sid)) continue;
    if (localById.has(sid)) {
      merged.push(localById.get(sid)!);
      seenIds.add(sid);
    } else {
      merged.push(s);
      seenIds.add(sid);
    }
  }

  for (const l of localMeals) {
    const lid = String(l.id);
    if (!deletedSet.has(lid) && !seenIds.has(lid)) {
      merged.push(l);
      seenIds.add(lid);
    }
  }

  return merged;
}

/**
 * Save or update a meal entry. Attempts server sync via `/api/db/meal_plan_entries`
 * and always persists locally so the wall is 100% responsive.
 */
export async function saveMealEntry(draft: MealDraft): Promise<ParsedMeal> {
  const isUpdate = draft.id !== undefined && String(draft.id).trim() !== "";
  const id = isUpdate ? draft.id! : `local-meal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const payload = {
    name: draft.name.trim() || "Untitled meal",
    emoji: draft.emoji.trim() || "🍽️",
    time: draft.time,
    mealType: draft.mealType,
    prepTime: draft.prepTime.trim() || "25 min",
    servings: Number(draft.servings) || 4,
    calories: Number(draft.calories) || 0,
    protein: Number(draft.protein) || 0,
    carbs: Number(draft.carbs) || 0,
    fat: Number(draft.fat) || 0,
    tags: JSON.stringify(draft.tags),
    ingredients: JSON.stringify(draft.ingredients),
    instructions: draft.instructions?.trim() || "",
    weekOf: draft.weekOf,
  };

  let savedId: string | number = id;
  try {
    if (isUpdate && !String(id).startsWith("local-")) {
      const res = await api<{ id?: string | number }>(`/api/db/meal_plan_entries/${encodeURIComponent(String(id))}`, {
        method: "PATCH",
        body: payload,
      });
      if (res?.id) savedId = res.id;
    } else {
      const res = await api<{ id?: string | number }>("/api/db/meal_plan_entries", {
        method: "POST",
        body: payload,
      });
      if (res?.id) savedId = res.id;
    }
  } catch {
    /* Server write optional/fallback — local store guarantees durability */
  }

  const parsed: ParsedMeal = {
    id: savedId,
    name: payload.name,
    emoji: payload.emoji,
    time: payload.time,
    mealType: payload.mealType,
    prepTime: payload.prepTime,
    servings: payload.servings,
    calories: payload.calories,
    protein: payload.protein,
    carbs: payload.carbs,
    fat: payload.fat,
    tags: draft.tags,
    ingredients: draft.ingredients,
    instructions: payload.instructions,
    weekOf: payload.weekOf,
  };

  const local = await readLocalMeals();
  // Remove any existing slot collision in local meals for the same week, day, and mealType
  const filtered = local.filter(
    (m) =>
      String(m.id) !== String(id) &&
      String(m.id) !== String(savedId) &&
      !((m.weekOf || draft.weekOf) === draft.weekOf && m.time === draft.time && m.mealType === draft.mealType)
  );
  filtered.push(parsed);
  await writeLocalMeals(filtered);

  return parsed;
}

export async function deleteMealEntry(id: string | number): Promise<void> {
  const sid = String(id);
  try {
    if (!sid.startsWith("local-")) {
      await api(`/api/db/meal_plan_entries/${encodeURIComponent(sid)}`, {
        method: "DELETE",
      });
    }
  } catch {
    /* fallback to local tombstones */
  }

  const [local, deleted] = await Promise.all([readLocalMeals(), readDeletedMealIds()]);
  await Promise.all([
    writeLocalMeals(local.filter((m) => String(m.id) !== sid)),
    writeDeletedMealIds(Array.from(new Set([...deleted, sid]))),
  ]);
}

export async function readGroceryItems(): Promise<GroceryItem[]> {
  return readJson<GroceryItem[]>(LOCAL_GROCERY_KEY, []);
}

export async function writeGroceryItems(items: GroceryItem[]): Promise<void> {
  await writeJson(LOCAL_GROCERY_KEY, items);
}

export async function readPantryItems(): Promise<PantryItem[]> {
  const stored = await readJson<PantryItem[] | null>(LOCAL_PANTRY_KEY, null);
  if (stored === null) {
    await writeJson(LOCAL_PANTRY_KEY, DEFAULT_PANTRY_ITEMS);
    return DEFAULT_PANTRY_ITEMS;
  }
  return stored;
}

export async function writePantryItems(items: PantryItem[]): Promise<void> {
  await writeJson(LOCAL_PANTRY_KEY, items);
}

export async function readAttendanceMap(): Promise<Record<string, boolean>> {
  return readJson<Record<string, boolean>>(LOCAL_ATTENDANCE_KEY, {});
}

export async function writeAttendanceMap(map: Record<string, boolean>): Promise<void> {
  await writeJson(LOCAL_ATTENDANCE_KEY, map);
}

/**
 * Computes which ingredients across a week's meals are missing from the stocked pantry.
 */
export function computeMissingIngredients(
  weekMeals: ParsedMeal[],
  pantry: PantryItem[]
): { name: string; category: GroceryCategory; fromMeal: string }[] {
  const stockedNames = new Set(
    pantry
      .filter((p) => p.status === "stocked")
      .map((p) => p.name.trim().toLowerCase())
  );

  const missing: { name: string; category: GroceryCategory; fromMeal: string }[] = [];
  const seen = new Set<string>();

  for (const meal of weekMeals) {
    for (const rawIng of meal.ingredients ?? []) {
      const cleaned = rawIng.trim();
      if (!cleaned) continue;
      const key = cleaned.toLowerCase();
      if (seen.has(key)) continue;
      const isStocked = Array.from(stockedNames).some(
        (s) => s.includes(key) || key.includes(s)
      );
      if (!isStocked) {
        seen.add(key);
        missing.push({
          name: cleaned,
          category: categorizeIngredient(cleaned),
          fromMeal: meal.name,
        });
      }
    }
  }

  return missing;
}

export interface KitchenLoadBundle {
  meals: ParsedMeal[];
  schedules: SlotScheduleRow[];
}

export async function loadKitchenBundle(): Promise<KitchenLoadBundle> {
  const [mealsRes, schedulesRes] = await Promise.all([
    api<DbListEnvelope<MealRow>>("/api/db/meal_plan_entries"),
    api<DbListEnvelope<SlotScheduleRow>>("/api/db/schedules").catch(() => null),
  ]);
  const rawMeals = Array.isArray(mealsRes?.items) ? mealsRes.items : [];
  const mergedMeals = await mergeMealsWithLocal(rawMeals);
  return {
    meals: mergedMeals,
    schedules: Array.isArray(schedulesRes?.items) ? schedulesRes.items : [],
  };
}

export { ApiError };
