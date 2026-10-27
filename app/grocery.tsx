import React, { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { Screen } from "../src/theme/Screen";
import { useTheme } from "../src/theme/ThemeProvider";
import { FONTS, TYPOGRAPHY } from "../src/theme/tokens";
import { CapsuleDock, MoreButton } from "../src/nav/CapsuleDock";
import { MoreSheet } from "../src/nav/MoreSheet";
import { useAuth } from "../src/state/AuthProvider";
import { SegmentedControl } from "../src/ui/SegmentedControl";
import { SoftButton } from "../src/ui/SoftButton";
import { ShopStockTabs } from "../src/meals/ShopStockTabs";
import {
  computeMissingIngredients,
  loadKitchenBundle,
  readGroceryItems,
  readPantryItems,
  writeGroceryItems,
  writePantryItems,
  type GroceryCategory,
  type GroceryItem,
  type PantryItem,
  type PantryStatus,
} from "../src/meals/api";
import type { ParsedMeal } from "../src/meals/plan-grid";
import { weekStartMondayISO } from "../src/home/widgets/data";

/**
 * /grocery — Dedicated Grocery & Pantry destination on the More… sheet.
 * Shares the same live store as the Kitchen Shop & Stock tabs so checking off
 * items or restocking staples stays in sync across the entire tablet.
 */
export default function GroceryRoute() {
  const { colors } = useTheme();
  const { role: capabilityRole, hydrated, poke } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const [mode, setMode] = useState<"shop" | "stock">("shop");
  const [groceryItems, setGroceryItems] = useState<GroceryItem[]>([]);
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);
  const [weekMeals, setWeekMeals] = useState<ParsedMeal[]>([]);

  const role = capabilityRole === "parent" ? "parent" : capabilityRole ? "child" : "guest";

  useEffect(() => {
    let alive = true;
    void Promise.all([
      readGroceryItems(),
      readPantryItems(),
      loadKitchenBundle().catch(() => ({ meals: [] as ParsedMeal[], schedules: [] })),
    ]).then(([groc, pant, bundle]) => {
      if (!alive) return;
      setGroceryItems(groc);
      setPantryItems(pant);
      const wk = weekStartMondayISO(new Date());
      setWeekMeals(bundle.meals.filter((m) => (m.weekOf || wk) === wk));
    });
    return () => {
      alive = false;
    };
  }, []);

  const missingFromPlan = computeMissingIngredients(weekMeals, pantryItems);

  const handleToggleGrocery = (id: string) => {
    setGroceryItems((prev) => {
      const next = prev.map((g) => (g.id === id ? { ...g, checked: !g.checked } : g));
      void writeGroceryItems(next);
      return next;
    });
  };

  const handleAddGrocery = (item: { name: string; category: GroceryCategory; quantity: string; fromMeal?: string }) => {
    setGroceryItems((prev) => {
      const exists = prev.some((g) => g.name.trim().toLowerCase() === item.name.trim().toLowerCase());
      if (exists) return prev;
      const next: GroceryItem[] = [
        ...prev,
        {
          id: `g-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: item.name,
          category: item.category,
          quantity: item.quantity,
          checked: false,
          fromMeal: item.fromMeal,
        },
      ];
      void writeGroceryItems(next);
      return next;
    });
  };

  const handleClearCheckedGrocery = () => {
    setGroceryItems((prev) => {
      const next = prev.filter((g) => !g.checked);
      void writeGroceryItems(next);
      return next;
    });
  };

  const handleSyncMissingToGrocery = () => {
    setGroceryItems((prev) => {
      const existingNames = new Set(prev.map((g) => g.name.trim().toLowerCase()));
      const additions: GroceryItem[] = missingFromPlan
        .filter((m) => !existingNames.has(m.name.trim().toLowerCase()))
        .map((m, i) => ({
          id: `g-plan-${Date.now()}-${i}`,
          name: m.name,
          category: m.category,
          quantity: "1",
          checked: false,
          fromMeal: m.fromMeal,
        }));
      const next = [...prev, ...additions];
      void writeGroceryItems(next);
      return next;
    });
  };

  const handleMoveCheckedToPantry = () => {
    const checked = groceryItems.filter((g) => g.checked);
    if (checked.length === 0) return;

    setPantryItems((prev) => {
      const next = [...prev];
      for (const item of checked) {
        const idx = next.findIndex((p) => p.name.trim().toLowerCase() === item.name.trim().toLowerCase());
        if (idx >= 0) {
          next[idx] = { ...next[idx], status: "stocked", quantity: item.quantity || next[idx].quantity };
        } else {
          next.push({
            id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: item.name,
            category: item.category,
            quantity: item.quantity || "1",
            status: "stocked",
          });
        }
      }
      void writePantryItems(next);
      return next;
    });

    setGroceryItems((prev) => {
      const next = prev.filter((g) => !g.checked);
      void writeGroceryItems(next);
      return next;
    });
  };

  const handleCyclePantryStatus = (id: string) => {
    const order: PantryStatus[] = ["stocked", "low", "out"];
    setPantryItems((prev) => {
      const next = prev.map((p) => {
        if (p.id !== id) return p;
        const nextStatus = order[(order.indexOf(p.status) + 1) % order.length];
        return { ...p, status: nextStatus };
      });
      void writePantryItems(next);
      return next;
    });
  };

  const handleAddPantry = (item: { name: string; category: GroceryCategory; quantity: string; status: PantryStatus }) => {
    setPantryItems((prev) => {
      const next: PantryItem[] = [
        ...prev,
        {
          id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: item.name,
          category: item.category,
          quantity: item.quantity,
          status: item.status,
        },
      ];
      void writePantryItems(next);
      return next;
    });
  };

  const handleSendLowPantryToGrocery = () => {
    const lowItems = pantryItems.filter((p) => p.status === "low" || p.status === "out");
    if (lowItems.length === 0) return;
    setGroceryItems((prev) => {
      const existing = new Set(prev.map((g) => g.name.trim().toLowerCase()));
      const additions: GroceryItem[] = lowItems
        .filter((p) => !existing.has(p.name.trim().toLowerCase()))
        .map((p, i) => ({
          id: `g-low-${Date.now()}-${i}`,
          name: p.name,
          category: p.category,
          quantity: p.quantity || "1",
          checked: false,
          fromMeal: "Pantry restock",
        }));
      const next = [...prev, ...additions];
      void writeGroceryItems(next);
      return next;
    });
    setMode("shop");
  };

  return (
    <Screen testID="grocery-route">
      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 16 }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 180, gap: 16 }} showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View>
              <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700", letterSpacing: 2 }}>
                HOUSEHOLD KITCHEN
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 }}>
                <Text style={{ fontSize: 36 }}>🛒</Text>
                <Text style={{ color: colors["color-text-primary"], fontSize: 44, fontWeight: "400", fontFamily: FONTS.display }}>
                  Groceries & Pantry
                </Text>
              </View>
            </View>
            <SoftButton variant="secondary" size="sm" onPress={() => router.push("/meals" as never)}>
              🍽️ Meal Plan
            </SoftButton>
          </View>

          <View style={{ maxWidth: 360 }}>
            <SegmentedControl
              testID="grocery-mode-tabs"
              accessibilityLabel="Grocery mode"
              options={[
                { id: "shop", label: "Shopping List", icon: <Text style={{ fontSize: 16 }}>🛒</Text> },
                { id: "stock", label: "Pantry Stock", icon: <Text style={{ fontSize: 16 }}>🥫</Text> },
              ]}
              value={mode}
              onChange={(id) => setMode(id as "shop" | "stock")}
            />
          </View>

          <ShopStockTabs
            mode={mode}
            groceryItems={groceryItems}
            pantryItems={pantryItems}
            missingFromPlan={missingFromPlan}
            onToggleGrocery={handleToggleGrocery}
            onAddGrocery={handleAddGrocery}
            onClearCheckedGrocery={handleClearCheckedGrocery}
            onSyncMissingToGrocery={handleSyncMissingToGrocery}
            onMoveCheckedToPantry={handleMoveCheckedToPantry}
            onCyclePantryStatus={handleCyclePantryStatus}
            onAddPantry={handleAddPantry}
            onSendLowPantryToGrocery={handleSendLowPantryToGrocery}
          />
        </ScrollView>
      </View>

      <View style={{ position: "absolute", left: 0, right: 0, bottom: 116, alignItems: "center" }} pointerEvents="box-none">
        <MoreButton onPress={() => setMoreOpen(true)} />
      </View>
      <CapsuleDock
        role={role}
        hydrated={hydrated}
        pathname={pathname}
        onNavigate={(p) => {
          poke();
          router.push(p as never);
        }}
      />
      <MoreSheet
        visible={moreOpen}
        onClose={() => setMoreOpen(false)}
        role={role}
        onNavigate={(p) => {
          poke();
          router.push(p as never);
        }}
      />
    </Screen>
  );
}
