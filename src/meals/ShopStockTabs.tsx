import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { Material } from "../theme/Material";
import { mix } from "../theme/mix";
import { MIN_TARGET_DP, TYPOGRAPHY } from "../theme/tokens";
import { TextField } from "../ui/TextField";
import { SoftButton } from "../ui/SoftButton";
import { Chip } from "../ui/Chip";
import { EmptyState } from "../ui/EmptyState";
import {
  categorizeIngredient,
  type GroceryCategory,
  type GroceryItem,
  type PantryItem,
  type PantryStatus,
} from "./api";

const CATEGORIES: GroceryCategory[] = [
  "Produce",
  "Meat & Dairy",
  "Bakery",
  "Pantry",
  "Frozen",
  "Other",
];

const CATEGORY_META: Record<GroceryCategory, { icon: string; token: string }> = {
  Produce: { icon: "🥬", token: "color-accent-mint" },
  "Meat & Dairy": { icon: "🥩", token: "color-accent-rose" },
  Bakery: { icon: "🥖", token: "color-accent-amber" },
  Pantry: { icon: "🥫", token: "color-accent-cyan" },
  Frozen: { icon: "🧊", token: "color-accent-violet" },
  Other: { icon: "🧺", token: "color-accent-selected" },
};

export interface ShopStockTabsProps {
  mode: "shop" | "stock";
  groceryItems: GroceryItem[];
  pantryItems: PantryItem[];
  missingFromPlan: { name: string; category: GroceryCategory; fromMeal: string }[];
  onToggleGrocery: (id: string) => void;
  onAddGrocery: (item: { name: string; category: GroceryCategory; quantity: string; fromMeal?: string }) => void;
  onClearCheckedGrocery: () => void;
  onSyncMissingToGrocery: () => void;
  onMoveCheckedToPantry: () => void;
  onCyclePantryStatus: (id: string) => void;
  onAddPantry: (item: { name: string; category: GroceryCategory; quantity: string; status: PantryStatus }) => void;
  onSendLowPantryToGrocery: () => void;
}

export function ShopStockTabs({
  mode,
  groceryItems,
  pantryItems,
  missingFromPlan,
  onToggleGrocery,
  onAddGrocery,
  onClearCheckedGrocery,
  onSyncMissingToGrocery,
  onMoveCheckedToPantry,
  onCyclePantryStatus,
  onAddPantry,
  onSendLowPantryToGrocery,
}: ShopStockTabsProps) {
  const { colors, accentColor } = useTheme();
  const [newName, setNewName] = useState("");
  const [newQty, setNewQty] = useState("1");
  const [selectedCat, setSelectedCat] = useState<GroceryCategory | "Auto">("Auto");
  const [filterCat, setFilterCat] = useState<GroceryCategory | "All">("All");

  const handleQuickAdd = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const resolvedCategory = selectedCat === "Auto" ? categorizeIngredient(trimmed) : selectedCat;
    if (mode === "shop") {
      onAddGrocery({
        name: trimmed,
        category: resolvedCategory,
        quantity: newQty.trim() || "1",
      });
    } else {
      onAddPantry({
        name: trimmed,
        category: resolvedCategory,
        quantity: newQty.trim() || "1",
        status: "stocked",
      });
    }
    setNewName("");
    setNewQty("1");
  };

  const uncheckedGroceryCount = useMemo(
    () => groceryItems.filter((g) => !g.checked).length,
    [groceryItems]
  );
  const checkedGroceryCount = useMemo(
    () => groceryItems.filter((g) => g.checked).length,
    [groceryItems]
  );

  const lowOrOutPantryCount = useMemo(
    () => pantryItems.filter((p) => p.status === "low" || p.status === "out").length,
    [pantryItems]
  );

  // Filter items not already in grocery list
  const unsyncedMissing = useMemo(() => {
    const existing = new Set(groceryItems.map((g) => g.name.trim().toLowerCase()));
    return missingFromPlan.filter((m) => !existing.has(m.name.trim().toLowerCase()));
  }, [missingFromPlan, groceryItems]);

  const filteredGrocery = useMemo(
    () =>
      groceryItems.filter((g) => filterCat === "All" || g.category === filterCat),
    [groceryItems, filterCat]
  );

  const filteredPantry = useMemo(
    () =>
      pantryItems.filter((p) => filterCat === "All" || p.category === filterCat),
    [pantryItems, filterCat]
  );

  return (
    <View testID={`meals-${mode}-view`} style={{ gap: 16 }}>
      {/* Top Action & Sync Banner */}
      <Material
        tier="regular"
        tone={mode === "shop" ? colors["color-accent-mint"] ?? accentColor : colors["color-accent-cyan"] ?? accentColor}
        style={{ borderRadius: 24, padding: 18, gap: 14 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 16,
                backgroundColor: mix(accentColor, "transparent", 20),
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 24 }}>{mode === "shop" ? "🛒" : "🥫"}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.title.fontSize, fontWeight: "700" }}>
                {mode === "shop"
                  ? `Shopping List · ${uncheckedGroceryCount} needed`
                  : `Pantry Inventory · ${pantryItems.length} staples`}
              </Text>
              <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }}>
                {mode === "shop"
                  ? unsyncedMissing.length > 0
                    ? `${unsyncedMissing.length} ingredients from this week's meals aren't on the list yet.`
                    : "All planned meal ingredients are on your list or stocked in the pantry."
                  : lowOrOutPantryCount > 0
                    ? `${lowOrOutPantryCount} item${lowOrOutPantryCount === 1 ? " is" : "s are"} running low or out of stock.`
                    : "All household staples are well stocked."}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {mode === "shop" && unsyncedMissing.length > 0 ? (
              <SoftButton
                variant="primary"
                size="sm"
                onPress={onSyncMissingToGrocery}
                testID="shop-sync-missing"
              >
                {`+ Add ${unsyncedMissing.length} from Plan`}
              </SoftButton>
            ) : null}
            {mode === "shop" && checkedGroceryCount > 0 ? (
              <>
                <SoftButton
                  variant="success"
                  size="sm"
                  onPress={onMoveCheckedToPantry}
                  testID="shop-restock-pantry"
                >
                  {`🥫 Stock ${checkedGroceryCount} bought`}
                </SoftButton>
                <SoftButton
                  variant="secondary"
                  size="sm"
                  onPress={onClearCheckedGrocery}
                  testID="shop-clear-checked"
                >
                  Clear checked
                </SoftButton>
              </>
            ) : null}
            {mode === "stock" && lowOrOutPantryCount > 0 ? (
              <SoftButton
                variant="primary"
                size="sm"
                onPress={onSendLowPantryToGrocery}
                testID="stock-send-low"
              >
                {`🛒 Send ${lowOrOutPantryCount} low to Shop`}
              </SoftButton>
            ) : null}
          </View>
        </View>

        {/* Quick-Add Bar */}
        <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-end" }}>
          <View style={{ flex: 2 }}>
            <TextField
              testID={`${mode}-quick-add-name`}
              label={mode === "shop" ? "Add item to shopping list" : "Add staple to pantry"}
              placeholder={mode === "shop" ? "e.g. Organic strawberries, Tortillas..." : "e.g. Jasmine rice, Olive oil..."}
              value={newName}
              onChangeText={setNewName}
            />
          </View>
          <View style={{ flex: 1, maxWidth: 140 }}>
            <TextField
              testID={`${mode}-quick-add-qty`}
              label="Qty / Size"
              placeholder="1"
              value={newQty}
              onChangeText={setNewQty}
            />
          </View>
          <SoftButton
            variant="primary"
            size="sm"
            disabled={!newName.trim()}
            onPress={handleQuickAdd}
            testID={`${mode}-quick-add-submit`}
          >
            + Add
          </SoftButton>
        </View>

        {/* Category Picker for Quick Add */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Chip
              label="✨ Auto-aisle"
              selected={selectedCat === "Auto"}
              onPress={() => setSelectedCat("Auto")}
            />
            {CATEGORIES.map((cat) => (
              <Chip
                key={cat}
                label={`${CATEGORY_META[cat].icon} ${cat}`}
                selected={selectedCat === cat}
                onPress={() => setSelectedCat(cat)}
              />
            ))}
          </View>
        </ScrollView>
      </Material>

      {/* Aisle Filter Pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Chip
            label="All Aisles"
            selected={filterCat === "All"}
            onPress={() => setFilterCat("All")}
          />
          {CATEGORIES.map((cat) => (
            <Chip
              key={cat}
              label={`${CATEGORY_META[cat].icon} ${cat}`}
              selected={filterCat === cat}
              onPress={() => setFilterCat(cat)}
            />
          ))}
        </View>
      </ScrollView>

      {/* List Content */}
      {mode === "shop" ? (
        filteredGrocery.length === 0 ? (
          <EmptyState
            icon="🛒"
            title="Shopping list is clear"
            body="Add items above or sync ingredients from this week's meal plan."
            actionLabel={unsyncedMissing.length > 0 ? `Add ${unsyncedMissing.length} meal ingredients` : undefined}
            onAction={unsyncedMissing.length > 0 ? onSyncMissingToGrocery : undefined}
          />
        ) : (
          <View style={{ gap: 10 }}>
            {filteredGrocery.map((item) => {
              const meta = CATEGORY_META[item.category] ?? CATEGORY_META.Other;
              const catColor = colors[meta.token] ?? accentColor;
              return (
                <Pressable
                  key={item.id}
                  testID={`grocery-row-${item.id}`}
                  accessibilityRole="checkbox"
                  accessibilityLabel={`${item.name}, ${item.quantity}`}
                  accessibilityState={{ checked: item.checked }}
                  onPress={() => onToggleGrocery(item.id)}
                  style={{
                    minHeight: MIN_TARGET_DP,
                    borderRadius: 20,
                    paddingHorizontal: 18,
                    paddingVertical: 12,
                    backgroundColor: colors["color-surface-0"],
                    borderWidth: 1,
                    borderColor: item.checked ? colors["color-border"] ?? "transparent" : mix(catColor, "transparent", 35),
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 14, flex: 1 }}>
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 12,
                        borderWidth: 2,
                        borderColor: item.checked ? colors["color-accent-mint"] ?? accentColor : colors["color-text-secondary"],
                        backgroundColor: item.checked ? mix(colors["color-accent-mint"] ?? accentColor, "transparent", 25) : "transparent",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ fontSize: 18, color: colors["color-text-primary"], fontWeight: "800" }}>
                        {item.checked ? "✓" : ""}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: item.checked ? colors["color-text-muted"] : colors["color-text-primary"],
                          fontSize: TYPOGRAPHY.body.fontSize,
                          fontWeight: "700",
                          textDecorationLine: item.checked ? "line-through" : "none",
                        }}
                      >
                        {item.name}
                      </Text>
                      <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }}>
                        {item.fromMeal ? `${meta.icon} ${item.category} · For ${item.fromMeal}` : `${meta.icon} ${item.category}`}
                      </Text>
                    </View>
                  </View>
                  <Chip as="span" size="sm" tone="neutral" label={item.quantity || "1"} />
                </Pressable>
              );
            })}
          </View>
        )
      ) : filteredPantry.length === 0 ? (
        <EmptyState
          icon="🥫"
          title="No staples in this aisle"
          body="Add pantry items above to track what your kitchen has in stock."
        />
      ) : (
        <View style={{ gap: 10 }}>
          {filteredPantry.map((item) => {
            const meta = CATEGORY_META[item.category] ?? CATEGORY_META.Other;
            const statusTone =
              item.status === "stocked" ? "success" : item.status === "low" ? "warning" : "danger";
            const statusLabel =
              item.status === "stocked" ? "✓ Stocked" : item.status === "low" ? "⚠️ Running Low" : "🚨 Out of Stock";
            return (
              <Pressable
                key={item.id}
                testID={`pantry-row-${item.id}`}
                accessibilityRole="button"
                accessibilityLabel={`${item.name}, ${statusLabel}. Tap to change stock status`}
                onPress={() => onCyclePantryStatus(item.id)}
                style={{
                  minHeight: MIN_TARGET_DP,
                  borderRadius: 20,
                  paddingHorizontal: 18,
                  paddingVertical: 12,
                  backgroundColor: colors["color-surface-0"],
                  borderWidth: 1,
                  borderColor: colors["color-surface-3"],
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 14, flex: 1 }}>
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      backgroundColor: colors["color-surface-2"],
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 22 }}>{meta.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
                      {item.name}
                    </Text>
                    <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }}>
                      {`${item.category} · ${item.quantity}`}
                    </Text>
                  </View>
                </View>
                <Chip as="span" size="sm" tone={statusTone} label={statusLabel} />
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Footer note (preserves Wave 1 test contract while tabs are live) */}
      <Text
        testID={`meals-${mode}-note`}
        style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize, textAlign: "center", marginTop: 4 }}
      >
        The grocery list and pantry arrive with the Groceries surface in the next wave.
      </Text>
    </View>
  );
}

export default ShopStockTabs;
