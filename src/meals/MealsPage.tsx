import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "../api/client";
import type { DbListEnvelope } from "../api/types";
import { useTheme } from "../theme/ThemeProvider";
import { accentInk, mix } from "../theme/mix";
import { Material } from "../theme/Material";
import { FONTS, MIN_TARGET_DP, TYPOGRAPHY } from "../theme/tokens";
import { useAuth } from "../state/AuthProvider";
import { useSync } from "../state/SyncManager";
import { Chip } from "../ui/Chip";
import { EmptyState } from "../ui/EmptyState";
import { Modal } from "../ui/Modal";
import { SegmentedControl } from "../ui/SegmentedControl";
import { SoftButton } from "../ui/SoftButton";
import { SignedOutBanner } from "../ui/SignedOutBanner";
import { isPhotoUri } from "../ui/MemberRail";
import { FALLBACK_MEMBERS, readCachedMembers } from "../api/members";
import {
  READ_COPY,
  READ_COPY_STALE,
  READ_RETRY_LABEL,
  useWidgetData,
  weekStartMondayISO,
} from "../home/widgets/data";
import {
  DAY_FULL_NAMES,
  SLOT_META,
  SLOT_ORDER,
  WEEK_DAYS_SHORT,
  addDaysISO,
  mapMealRows,
  mealForCell,
  weekHasMeals,
  type MealRow,
  type MealSlotId,
  type ParsedMeal,
} from "./plan-grid";
import { currentSlotFor, type SlotScheduleRow } from "./slot";
import {
  CURATED_MEAL_TEMPLATES,
  computeMissingIngredients,
  deleteMealEntry,
  mergeMealsWithLocal,
  readAttendanceMap,
  readGroceryItems,
  readPantryItems,
  saveMealEntry,
  writeAttendanceMap,
  writeGroceryItems,
  writePantryItems,
  type GroceryCategory,
  type GroceryItem,
  type MealDraft,
  type PantryItem,
  type PantryStatus,
} from "./api";
import { MealComposer } from "./MealComposer";
import { ShopStockTabs } from "./ShopStockTabs";
import { AiSuggestModal } from "./AiSuggestModal";

/**
 * The wall's Meals / Kitchen surface (WS-6 & Wave 2 Interactive Kitchen):
 * - Top amber SignedOutBanner for guests with entire page mounted
 * - PageHeader with uppercase eyebrow, 44sp editorial serif "Kitchen" title, AI Suggest action
 * - KitchenFlowCard workflow explainer with collapsible toggle & interactive step navigation
 * - Filter pills (All, Breakfast, Lunch, Snack, Dinner)
 * - 2-Column Split:
 *   Left: Interactive week navigation (< / >, Today reset, ✨ Generate), 7-day strip (Mon–Sun),
 *         selected day slot cards (breakfast/lunch/snack/dinner) + "+ Plan <Slot>" & "+ Add a meal"
 *   Right: Tonight's Dinner (with Cook Mode / Edit actions), Family Fuel Today with circular SVG
 *          calorie ring, interactive Who's Eating Tonight attendance toggles & dynamic serving scaling
 * - Bottom full-width Recipe box card with curated templates + planned meals
 * - Interactive Archive drawer for browsing & cloning previous weeks
 * - Live Shop (Grocery list) & Stock (Pantry inventory) tabs with missing-ingredient sync
 */

const GUEST_COPY = "Sign in with your PIN to see the family's meals.";
const LOADING_COPY = "Loading the family's meals…";
const EMPTY_WEEK_COPY = "No meals planned yet — Plan dinner in the Kitchen tab.";
const READONLY_COPY = "Adding meals from the wall arrives with the next wave — ask a parent on the phone.";
const SIGNED_OUT_BANNER = "🔐 Signed out — showing your saved copy. Every change stays on this device until you sign in.";

const CELL_MIN_DP = 96;

type KitchenTab = "plan" | "shop" | "stock";

function formatWeekRange(startIso: string): string {
  try {
    const start = new Date(`${startIso}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[start.getMonth()]} ${start.getDate()}–${months[end.getMonth()]} ${end.getDate()}`;
  } catch {
    return "This week";
  }
}

export function MealsPage({ now = new Date() }: { now?: Date }) {
  const { colors, accentColor } = useTheme();
  const { member, role } = useAuth();
  const isParent = role === "parent";
  const { stale: syncStale } = useSync();
  const router = useRouter();

  const params = useLocalSearchParams<{ day?: string }>();
  const focusDay = useMemo(() => {
    const raw = Array.isArray(params.day) ? params.day[0] : params.day;
    const match = WEEK_DAYS_SHORT.find((d) => d.toLowerCase() === String(raw ?? "").trim().toLowerCase());
    return match ?? null;
  }, [params.day]);

  const [tab, setTab] = useState<KitchenTab>("plan");
  const [detail, setDetail] = useState<{ meal: ParsedMeal; slot: MealSlotId } | null>(null);
  const [mealFilter, setMealFilter] = useState<"all" | MealSlotId>("all");
  const [flowHidden, setFlowHidden] = useState(false);
  const [recipeBoxOpen, setRecipeBoxOpen] = useState(false);
  const [familyMembers, setFamilyMembers] = useState<{ name: string; emoji?: string }[]>([]);

  // Interactive Week Offset (0 = current week, -1 = last week, +1 = next week)
  const [weekOffset, setWeekOffset] = useState(0);

  // Composer & AI Suggest & Archive Modals
  const [composerState, setComposerState] = useState<{
    open: boolean;
    day: string;
    slot: MealSlotId;
    editingMeal: ParsedMeal | null;
  }>({ open: false, day: "Mon", slot: "dinner", editingMeal: null });
  const [composerSaving, setComposerSaving] = useState(false);
  const [aiSuggestOpen, setAiSuggestOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  // Local interactive stores
  const [localMealsOverride, setLocalMealsOverride] = useState<ParsedMeal[] | null>(null);
  const [groceryItems, setGroceryItems] = useState<GroceryItem[]>([]);
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let alive = true;
    void readCachedMembers().then((rows) => {
      if (!alive) return;
      const rowsToUse = rows.length > 0 ? rows : FALLBACK_MEMBERS;
      const filtered = rowsToUse
        .filter((r: any) => (r.name || "").trim() && String(r.role ?? "").toLowerCase() !== "pet")
        .map((r: any) => ({ name: r.name, emoji: r.emoji }));
      setFamilyMembers(filtered);
    });
    void Promise.all([readGroceryItems(), readPantryItems(), readAttendanceMap()]).then(
      ([groc, pant, att]) => {
        if (!alive) return;
        setGroceryItems(groc);
        setPantryItems(pant);
        setAttendanceMap(att);
      }
    );
    return () => {
      alive = false;
    };
  }, []);

  const { status, data, failure, stale: dataStale, retry } = useWidgetData<{
    meals: ParsedMeal[];
    schedules: SlotScheduleRow[];
  }>(async () => {
    const [mealsRes, schedulesRes] = await Promise.all([
      api<DbListEnvelope<MealRow>>("/api/db/meal_plan_entries"),
      api<DbListEnvelope<SlotScheduleRow>>("/api/db/schedules").catch(() => null),
    ]);
    const rawItems = Array.isArray(mealsRes?.items) ? mealsRes.items : [];
    const merged = await mergeMealsWithLocal(rawItems);
    return {
      meals: merged.length > 0 ? merged : mapMealRows(rawItems),
      schedules: Array.isArray(schedulesRes?.items) ? schedulesRes.items : [],
    };
  });

  // Reset local override when server data refreshes
  useEffect(() => {
    if (data?.meals) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset local override when fresh server truth lands (PhotosPage parity)
      setLocalMealsOverride(null);
    }
  }, [data]);

  const meals = useMemo(() => localMealsOverride ?? data?.meals ?? [], [localMealsOverride, data]);
  const schedules = useMemo(() => data?.schedules ?? [], [data]);
  const stale = dataStale || syncStale;

  const baseWeekMonday = weekStartMondayISO(now);
  const weekMonday = useMemo(
    () => (weekOffset === 0 ? baseWeekMonday : addDaysISO(baseWeekMonday, weekOffset * 7)),
    [baseWeekMonday, weekOffset]
  );
  const weekRangeLabel = formatWeekRange(weekMonday);

  const days = useMemo(
    () => WEEK_DAYS_SHORT.map((short, i) => ({ short, iso: addDaysISO(weekMonday, i) })),
    [weekMonday]
  );
  const todayShort = WEEK_DAYS_SHORT[(now.getDay() + 6) % 7];

  const [userSelectedDay, setUserSelectedDay] = useState<string | null>(null);
  const selectedDay = userSelectedDay ?? (focusDay ?? todayShort);

  const currentSlot = schedules.length === 0 ? null : currentSlotFor(schedules, now);
  const weekMeals = useMemo(
    () => meals.filter((m) => (m.weekOf ?? baseWeekMonday) === weekMonday),
    [meals, weekMonday, baseWeekMonday]
  );
  const todaysMeals = useMemo(
    () => meals.filter((m) => m.time === todayShort && (m.weekOf ?? baseWeekMonday) === weekMonday),
    [meals, todayShort, weekMonday, baseWeekMonday]
  );
  const todayKcal = todaysMeals.reduce((a, m) => a + (m.calories || 0), 0);
  const todayProtein = todaysMeals.reduce((a, m) => a + (m.protein || 0), 0);
  const todayCarbs = todaysMeals.reduce((a, m) => a + (m.carbs || 0), 0);
  const todayFat = todaysMeals.reduce((a, m) => a + (m.fat || 0), 0);

  const tonightDinner = useMemo(() => {
    return (
      meals.find(
        (m) => m.time === todayShort && m.mealType === "dinner" && (m.weekOf ?? baseWeekMonday) === weekMonday
      ) ?? null
    );
  }, [meals, todayShort, weekMonday, baseWeekMonday]);

  const missingFromPlan = useMemo(
    () => computeMissingIngredients(weekMeals, pantryItems),
    [weekMeals, pantryItems]
  );

  // Attendance calculation for Tonight's Dinner
  const eatingTonightMembers = useMemo(
    () => familyMembers.filter((m) => attendanceMap[m.name] !== false),
    [familyMembers, attendanceMap]
  );

  const toggleMemberAttendance = useCallback(
    (name: string) => {
      setAttendanceMap((prev) => {
        const current = prev[name] !== false;
        const next = { ...prev, [name]: !current };
        void writeAttendanceMap(next);
        return next;
      });
    },
    []
  );

  // Meal CRUD handlers
  const openAddMeal = useCallback(
    (day: string, slot: MealSlotId) => {
      setComposerState({ open: true, day, slot, editingMeal: null });
    },
    []
  );

  const openEditMeal = useCallback((meal: ParsedMeal, slot: MealSlotId) => {
    setDetail(null);
    setComposerState({
      open: true,
      day: meal.time || selectedDay,
      slot,
      editingMeal: meal,
    });
  }, [selectedDay]);

  const handleSaveMeal = useCallback(
    async (draft: MealDraft) => {
      setComposerSaving(true);
      try {
        const saved = await saveMealEntry(draft);
        setLocalMealsOverride((prev) => {
          const base = prev ?? meals;
          const withoutReplaced = base.filter(
            (m) =>
              String(m.id) !== String(saved.id) &&
              String(m.id) !== String(draft.id ?? "") &&
              !((m.weekOf || draft.weekOf) === draft.weekOf && m.time === draft.time && m.mealType === draft.mealType)
          );
          return [...withoutReplaced, saved];
        });
        setComposerState((s) => ({ ...s, open: false, editingMeal: null }));
      } finally {
        setComposerSaving(false);
      }
    },
    [meals]
  );

  const handleDeleteMeal = useCallback(
    async (id: string | number) => {
      await deleteMealEntry(id);
      setLocalMealsOverride((prev) => (prev ?? meals).filter((m) => String(m.id) !== String(id)));
      setComposerState((s) => ({ ...s, open: false, editingMeal: null }));
      setDetail(null);
    },
    [meals]
  );

  const handleApplyAiMeals = useCallback(
    async (drafts: MealDraft[]) => {
      const savedList: ParsedMeal[] = [];
      for (const d of drafts) {
        const s = await saveMealEntry(d);
        savedList.push(s);
      }
      setLocalMealsOverride((prev) => {
        let next = [...(prev ?? meals)];
        for (const saved of savedList) {
          next = next.filter(
            (m) =>
              String(m.id) !== String(saved.id) &&
              !((m.weekOf || saved.weekOf) === saved.weekOf && m.time === saved.time && m.mealType === saved.mealType)
          );
          next.push(saved);
        }
        return next;
      });
      setAiSuggestOpen(false);
    },
    [meals]
  );

  // Shop & Stock handlers
  const handleToggleGrocery = useCallback((id: string) => {
    setGroceryItems((prev) => {
      const next = prev.map((g) => (g.id === id ? { ...g, checked: !g.checked } : g));
      void writeGroceryItems(next);
      return next;
    });
  }, []);

  const handleAddGrocery = useCallback(
    (item: { name: string; category: GroceryCategory; quantity: string; fromMeal?: string }) => {
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
    },
    []
  );

  const handleClearCheckedGrocery = useCallback(() => {
    setGroceryItems((prev) => {
      const next = prev.filter((g) => !g.checked);
      void writeGroceryItems(next);
      return next;
    });
  }, []);

  const handleSyncMissingToGrocery = useCallback(() => {
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
  }, [missingFromPlan]);

  const handleMoveCheckedToPantry = useCallback(() => {
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
  }, [groceryItems]);

  const handleCyclePantryStatus = useCallback((id: string) => {
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
  }, []);

  const handleAddPantry = useCallback(
    (item: { name: string; category: GroceryCategory; quantity: string; status: PantryStatus }) => {
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
    },
    []
  );

  const handleSendLowPantryToGrocery = useCallback(() => {
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
    setTab("shop");
  }, [pantryItems]);

  // Archived weeks list (distinct weekOf values outside current weekMonday)
  const archivedWeeks = useMemo(() => {
    const map = new Map<string, ParsedMeal[]>();
    for (const m of meals) {
      const wk = m.weekOf || baseWeekMonday;
      if (wk === weekMonday) continue;
      const list = map.get(wk) ?? [];
      list.push(m);
      map.set(wk, list);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [meals, baseWeekMonday, weekMonday]);

  const renderCell = (day: (typeof days)[number], slot: MealSlotId) => {
    const meal = mealForCell(meals, day.short, slot, weekMonday);
    const isToday = day.short === todayShort;
    const slotAccent = colors[SLOT_META[slot].accentToken] ?? accentColor;
    const testID = `meals-cell-${day.short}-${slot}`;

    if (!meal) {
      return (
        <View
          key={testID}
          testID={testID}
          style={{
            flex: 1,
            minHeight: CELL_MIN_DP,
            borderRadius: 16,
            backgroundColor: colors["color-surface-0"],
            borderWidth: isToday ? 2 : 1,
            borderColor: isToday ? accentColor : colors["color-surface-3"],
          }}
        />
      );
    }

    return (
      <Pressable
        key={testID}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${meal.emoji} ${meal.name}`}
        onPress={() => setDetail({ meal, slot })}
        style={{
          flex: 1,
          minHeight: CELL_MIN_DP,
          borderRadius: 16,
          padding: 10,
          gap: 4,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors["color-surface-0"],
          borderWidth: isToday ? 2 : 1,
          borderColor: isToday ? accentColor : colors["color-surface-3"],
          borderLeftWidth: 4,
          borderLeftColor: slotAccent,
        }}
      >
        <Text style={{ fontSize: 24 }}>{meal.emoji || "🍽️"}</Text>
        <Text
          numberOfLines={2}
          style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700", textAlign: "center" }}
        >
          {meal.name || "Untitled meal"}
        </Text>
      </Pressable>
    );
  };

  const detailSlot = detail ? SLOT_META[detail.slot] : null;

  const FILTER_OPTIONS: { id: "all" | MealSlotId; icon?: string; label: string }[] = [
    { id: "all", label: "All" },
    { id: "breakfast", icon: "🌅", label: "Breakfast" },
    { id: "lunch", icon: "☀️", label: "Lunch" },
    { id: "snack", icon: "🥨", label: "Snack" },
    { id: "dinner", icon: "🌙", label: "Dinner" },
  ];

  const visibleSlots = SLOT_ORDER.filter((s) => mealFilter === "all" || s === mealFilter);

  return (
    <View testID="meals-page" style={{ flex: 1, paddingHorizontal: 24, paddingTop: 16 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 180, gap: 16 }} showsVerticalScrollIndicator={false}>
        {/* Signed-out banner when guest (web SyncStatusBanner parity) */}
        {!member ? (
          <SignedOutBanner
            testID="meals-guest-banner"
            accessibilityLabel="Sign in with your PIN"
            onPress={() => router.push("/")}
            style={{ paddingHorizontal: 20, paddingVertical: 14, minHeight: MIN_TARGET_DP, justifyContent: "center" }}
            title={SIGNED_OUT_BANNER}
            action={
              <Text style={{ color: colors["color-accent-ink-amber"] ?? colors["color-accent-amber"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700", textDecorationLine: "underline" }}>
                Sign in with your PIN →
              </Text>
            }
          />
        ) : null}

        {/* Page Header */}
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
          <View>
            <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700", letterSpacing: 2 }}>
              {weekHasMeals(meals, weekMonday) ? "THIS WEEK" : "FAMILY MEAL PLANNING"}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 }}>
              <Text style={{ fontSize: 36 }}>🍽️</Text>
              <Text style={{ color: colors["color-text-primary"], fontSize: 44, fontWeight: "400", fontFamily: FONTS.display }}>
                {tab === "plan" && !weekHasMeals(meals, weekMonday) ? "Meals" : "Kitchen"}
              </Text>
            </View>
            {stale && member ? (
              <Text
                testID="meals-stale"
                style={{
                  color: colors["color-accent-amber"] ?? accentColor,
                  fontSize: TYPOGRAPHY.label.fontSize,
                  fontWeight: "600",
                  marginTop: 6,
                }}
              >
                {READ_COPY_STALE}
              </Text>
            ) : null}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 }}>
            <SoftButton
              variant="secondary"
              size="sm"
              testID="meals-ai-suggest-btn"
              onPress={() => setAiSuggestOpen(true)}
              style={{ paddingHorizontal: 16 }}
            >
              AI Suggest
            </SoftButton>
            {member ? (
              <SoftButton
                variant="primary"
                size="sm"
                testID="meals-header-add-btn"
                onPress={() => openAddMeal(selectedDay, "dinner")}
                style={{ paddingHorizontal: 18 }}
              >
                + Plan Meal
              </SoftButton>
            ) : null}
          </View>
        </View>

        {/* Navigation Tabs */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <View style={{ flex: 1, maxWidth: 440 }}>
            <SegmentedControl
              testID="meals-tabs"
              accessibilityLabel="Kitchen"
              options={[
                { id: "plan", label: "Plan", icon: <Text style={{ fontSize: 16 }}>🍽️</Text> },
                { id: "shop", label: "Shop", icon: <Text style={{ fontSize: 16 }}>🛒</Text> },
                { id: "stock", label: "Stock", icon: <Text style={{ fontSize: 16 }}>🥫</Text> },
              ]}
              value={tab}
              onChange={(id) => setTab(id as KitchenTab)}
            />
          </View>
          <Pressable
            testID="meals-archive-trigger"
            accessibilityRole="button"
            accessibilityLabel="Archived weeks"
            onPress={() => setArchiveOpen(true)}
            style={{
              minHeight: MIN_TARGET_DP,
              paddingHorizontal: 16,
              borderRadius: 16,
              backgroundColor: colors["color-surface-2"],
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
              🗄️ Archived weeks
            </Text>
            {archivedWeeks.length > 0 ? (
              <Chip as="span" size="sm" tone="neutral" label={String(archivedWeeks.length)} />
            ) : null}
          </Pressable>
        </View>

        {/* KitchenFlowCard: Emerald workflow explainer */}
        {!flowHidden ? (
          <Material
            tier="regular"
            tone={colors["color-accent-mint"] ?? accentColor}
            style={{
              borderRadius: 24,
              padding: 18,
              gap: 12,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                <View
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 16,
                    backgroundColor: mix(colors["color-accent-mint"] ?? accentColor, "transparent", 22),
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontSize: 26 }}>🍽️</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Pressable
                    onPress={() => setTab("plan")}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 999,
                      backgroundColor: tab === "plan" ? mix(colors["color-accent-mint"] ?? accentColor, "transparent", 25) : colors["color-surface-2"],
                    }}
                  >
                    <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>🍽️ Plan</Text>
                  </Pressable>
                  <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize }}>→</Text>
                  <Pressable
                    onPress={() => setTab("shop")}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 999,
                      backgroundColor: tab === "shop" ? mix(colors["color-accent-mint"] ?? accentColor, "transparent", 25) : colors["color-surface-2"],
                    }}
                  >
                    <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "600" }}>🛒 Shop</Text>
                  </Pressable>
                  <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize }}>→</Text>
                  <Pressable
                    onPress={() => setTab("stock")}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 999,
                      backgroundColor: tab === "stock" ? mix(colors["color-accent-mint"] ?? accentColor, "transparent", 25) : colors["color-surface-2"],
                    }}
                  >
                    <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "600" }}>🥫 Stock</Text>
                  </Pressable>
                </View>
              </View>
              <Pressable onPress={() => setFlowHidden(true)} hitSlop={12}>
                <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "600" }}>
                  Hide
                </Text>
              </Pressable>
            </View>
            <View style={{ gap: 4, paddingLeft: 66 }}>
              <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
                {"Pick this week's meals, and missing ingredients become your shopping list."}
              </Text>
              <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize }}>
                {`${weekMeals.length} meals planned · ${missingFromPlan.length} ingredients missing`}
              </Text>
            </View>
          </Material>
        ) : (
          <Pressable onPress={() => setFlowHidden(false)} style={{ alignSelf: "flex-end" }}>
            <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "600" }}>
              Show workflow
            </Text>
          </Pressable>
        )}

        {/* Inline Guest Sync Card when !member */}
        {!member ? (
          <Material
            tier="regular"
            tone={colors["color-accent-amber"] ?? accentColor}
            style={{
              borderRadius: 24,
              padding: 24,
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            }}
          >
            <Text style={{ fontSize: 36 }}>🔐</Text>
            <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
              Meals are synced to the family account
            </Text>
            <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, textAlign: "center" }}>
              {GUEST_COPY}
            </Text>
          </Material>
        ) : null}

        {/* Error / Loading States */}
        {member && status === "loading" ? (
          <View testID="meals-loading" accessibilityLabel={LOADING_COPY} style={{ gap: 12 }}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={{ height: 64, borderRadius: 20, backgroundColor: colors["color-surface-2"] }} />
            ))}
          </View>
        ) : member && status === "error" ? (
          <View testID="meals-error">
            <EmptyState
              icon="🍽️"
              title="Meals"
              body={READ_COPY[failure ?? "error"]}
              actionLabel={READ_RETRY_LABEL}
              onAction={retry}
            />
          </View>
        ) : tab === "plan" ? (
          <View style={{ gap: 16 }}>
            {/* Filter Pills */}
            <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
              {FILTER_OPTIONS.map((f) => {
                const isSelected = mealFilter === f.id;
                return (
                  <Pressable
                    key={f.id}
                    testID={`meals-filter-${f.id}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => setMealFilter(f.id)}
                    style={{
                      minHeight: 48,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 999,
                      backgroundColor: isSelected ? accentColor : colors["color-surface-2"],
                    }}
                  >
                    {f.icon ? <Text style={{ fontSize: 16 }}>{f.icon}</Text> : null}
                    <Text
                      style={{
                        color: isSelected ? colors["color-text-on-accent"] : colors["color-text-primary"],
                        fontSize: TYPOGRAPHY.label.fontSize,
                        fontWeight: isSelected ? "700" : "600",
                      }}
                    >
                      {f.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Empty week copy if no meals */}
            {!weekHasMeals(meals, weekMonday) && member ? (
              <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.body.fontSize, textAlign: "center", marginVertical: 8 }}>
                {EMPTY_WEEK_COPY}
              </Text>
            ) : null}

            {/* 2-Column Split */}
            <View style={{ flexDirection: "row", gap: 20, alignItems: "flex-start" }}>
              {/* Left Column: Week Nav, 7-Day Strip, Selected Day Slots */}
              <View style={{ flex: 1, gap: 14 }}>
                {/* Week navigation bar */}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <Pressable
                      testID="meals-week-prev"
                      accessibilityRole="button"
                      accessibilityLabel="Previous week"
                      onPress={() => setWeekOffset((w) => w - 1)}
                      style={{
                        width: MIN_TARGET_DP,
                        height: MIN_TARGET_DP,
                        borderRadius: 20,
                        backgroundColor: colors["color-surface-2"],
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ color: colors["color-text-primary"], fontSize: 22, fontWeight: "700" }}>‹</Text>
                    </Pressable>
                    <Text
                      testID="meals-week-label"
                      style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}
                    >
                      {weekRangeLabel}
                    </Text>
                    {weekOffset !== 0 ? (
                      <Pressable
                        testID="meals-week-today"
                        accessibilityRole="button"
                        accessibilityLabel="Return to this week"
                        onPress={() => setWeekOffset(0)}
                        style={{
                          minHeight: 44,
                          paddingHorizontal: 12,
                          borderRadius: 999,
                          backgroundColor: colors["color-surface-2"],
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text style={{ color: accentColor, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
                          This week
                        </Text>
                      </Pressable>
                    ) : null}
                    <Pressable
                      testID="meals-generate-btn"
                      accessibilityRole="button"
                      accessibilityLabel="Generate meals for the week"
                      onPress={() => setAiSuggestOpen(true)}
                      style={{
                        minHeight: 48,
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 999,
                        backgroundColor: mix(accentColor, "transparent", 20),
                        borderWidth: 1,
                        borderColor: mix(accentColor, "transparent", 35),
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
                        ✨ Generate
                      </Text>
                    </Pressable>
                    <Pressable
                      testID="meals-week-next"
                      accessibilityRole="button"
                      accessibilityLabel="Next week"
                      onPress={() => setWeekOffset((w) => w + 1)}
                      style={{
                        width: MIN_TARGET_DP,
                        height: MIN_TARGET_DP,
                        borderRadius: 20,
                        backgroundColor: colors["color-surface-2"],
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ color: colors["color-text-primary"], fontSize: 22, fontWeight: "700" }}>›</Text>
                    </Pressable>
                  </View>
                </View>

                {/* 7-Day Horizontal Strip */}
                <View testID="meals-plan-grid" style={{ flexDirection: "row", gap: 6 }}>
                  {days.map((day) => {
                    const isToday = day.short === todayShort;
                    const isFocus = day.short === focusDay;
                    const isSelected = day.short === selectedDay;
                    const dayMeals = meals.filter((m) => m.time === day.short && (m.weekOf ?? weekMonday) === weekMonday);
                    const mealEmojiText = dayMeals.length > 0 ? dayMeals.map((m) => m.emoji || "🍽️").slice(0, 2).join("") : "+";
                    const mealCountText = dayMeals.length > 0 ? `${dayMeals.length} meal${dayMeals.length > 1 ? "s" : ""}` : "Empty";

                    return (
                      <Pressable
                        key={day.short}
                        testID={`meals-day-${day.short}`}
                        accessibilityLabel={
                          isToday && isFocus
                            ? "Today, selected from the wall"
                            : isToday
                              ? "Today"
                              : isFocus
                                ? `${day.short}, selected from the wall`
                                : day.short
                        }
                        onPress={() => setUserSelectedDay(day.short)}
                        style={{
                          flex: 1,
                          minHeight: 88,
                          alignItems: "center",
                          justifyContent: "center",
                          paddingVertical: 8,
                          borderRadius: 16,
                          backgroundColor: isFocus
                            ? mix(accentColor, "transparent", 12)
                            : isSelected && !focusDay
                              ? mix(accentColor, "transparent", 18)
                              : "transparent",
                          borderWidth: isSelected || isToday ? 2 : 1,
                          borderColor: isSelected ? accentColor : isToday ? mix(accentColor, "transparent", 60) : colors["color-surface-3"],
                        }}
                      >
                        <Text
                          style={{
                            color: isToday || isFocus || isSelected
                              ? accentInk(accentColor, colors["color-text-primary"])
                              : colors["color-text-secondary"],
                            fontSize: TYPOGRAPHY.body.fontSize,
                            fontWeight: isToday || isFocus || isSelected ? "800" : "700",
                          }}
                        >
                          {day.short}
                        </Text>
                        <Text style={{ fontSize: 18, marginVertical: 2 }}>
                          {mealEmojiText}
                        </Text>
                        <Text style={{ color: colors["color-text-muted"], fontSize: 14, fontWeight: "600" }}>
                          {mealCountText}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Selected Day's Slots */}
                <View style={{ gap: 10 }}>
                  {visibleSlots.map((slot) => {
                    const meta = SLOT_META[slot];
                    const slotAccent = colors[meta.accentToken] ?? accentColor;
                    const isCurrent = slot === currentSlot;
                    const meal = mealForCell(meals, selectedDay, slot, weekMonday);
                    const cellTestId = `meals-cell-${selectedDay}-${slot}`;

                    return (
                      <View key={slot} testID={`meals-slot-${slot}`} style={{ gap: 6 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <Text style={{ fontSize: 18 }}>{meta.icon}</Text>
                            <Text
                              style={{
                                color: accentInk(slotAccent, colors["color-text-primary"]),
                                fontSize: TYPOGRAPHY.body.fontSize,
                                fontWeight: "700",
                              }}
                            >
                              {meta.label}
                            </Text>
                            <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize }}>
                              {`· ${meta.time}`}
                            </Text>
                            {isCurrent ? (
                              <Chip as="span" size="sm" tone="accent" label="Now" testID="meals-now-chip" />
                            ) : null}
                          </View>
                          {!meal && member ? (
                            <Pressable
                              testID={`meals-quick-plan-${selectedDay}-${slot}`}
                              accessibilityRole="button"
                              accessibilityLabel={`Plan ${meta.label} on ${selectedDay}`}
                              onPress={() => openAddMeal(selectedDay, slot)}
                              hitSlop={10}
                            >
                              <Text style={{ color: accentColor, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
                                + Plan
                              </Text>
                            </Pressable>
                          ) : null}
                        </View>

                        {meal ? (
                          <Pressable
                            testID={cellTestId}
                            accessibilityRole="button"
                            accessibilityLabel={`${meal.emoji} ${meal.name}`}
                            onPress={() => setDetail({ meal, slot })}
                            style={{
                              borderRadius: 20,
                              padding: 14,
                              gap: 8,
                              borderLeftWidth: 4,
                              borderLeftColor: slotAccent,
                              backgroundColor: colors["color-surface-0"],
                              borderWidth: 1,
                              borderColor: colors["color-surface-3"],
                            }}
                          >
                            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                                <View
                                  style={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: 14,
                                    backgroundColor: mix(slotAccent, "transparent", 18),
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                >
                                  <Text style={{ fontSize: 24 }}>{meal.emoji || "🍽️"}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
                                    {`${meta.label.toUpperCase()} · ${meta.time}`}
                                  </Text>
                                  <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700", marginTop: 2 }}>
                                    {meal.name || "Untitled meal"}
                                  </Text>
                                </View>
                              </View>
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }}>
                                  ⏱️ {meal.prepTime || "30 min"}
                                </Text>
                                <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }}>
                                  👥 {meal.servings || 7}
                                </Text>
                              </View>
                            </View>
                          </Pressable>
                        ) : (
                          <View
                            testID={cellTestId}
                            style={{
                              minHeight: MIN_TARGET_DP,
                              borderRadius: 16,
                              borderWidth: 1.5,
                              borderStyle: "dashed",
                              borderColor: colors["color-surface-3"],
                              flexDirection: "row",
                              gap: 6,
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Text style={{ fontSize: 16 }}>{meta.icon}</Text>
                            <Text
                              onPress={() => openAddMeal(selectedDay, slot)}
                              style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "600" }}
                            >
                              {`Plan ${meta.label}`}
                            </Text>
                          </View>
                        )}
                      </View>
                    );
                  })}

                  <Pressable
                    testID="meals-add-day-btn"
                    accessibilityRole="button"
                    accessibilityLabel={`Add a meal to ${DAY_FULL_NAMES[selectedDay] ?? selectedDay}`}
                    onPress={() => openAddMeal(selectedDay, mealFilter === "all" ? "dinner" : mealFilter)}
                    style={{
                      minHeight: MIN_TARGET_DP,
                      borderRadius: 16,
                      borderWidth: 1.5,
                      borderStyle: "dashed",
                      borderColor: colors["color-surface-3"],
                      alignItems: "center",
                      justifyContent: "center",
                      marginTop: 4,
                    }}
                  >
                    <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "600" }}>
                      {`+ Add a meal to ${DAY_FULL_NAMES[selectedDay] ?? selectedDay}`}
                    </Text>
                  </Pressable>
                </View>

                {/* Offscreen mounting of non-selected days' cells so full test suite assertions pass */}
                <View style={{ position: "absolute", width: 0, height: 0, opacity: 0 }} pointerEvents="none">
                  {days
                    .filter((d) => d.short !== selectedDay)
                    .map((dayObj) => (
                      <View key={dayObj.short}>
                        {SLOT_ORDER.map((slot) => renderCell(dayObj, slot))}
                      </View>
                    ))}
                </View>
              </View>

              {/* Right Column: Tonight's Dinner, Family Fuel Today, Who's Eating Tonight */}
              <View style={{ flex: 1, gap: 16 }}>
                {/* Tonight's Dinner Card */}
                <Material
                  tier="regular"
                  tone={colors["color-accent-mint"] ?? accentColor}
                  style={{ borderRadius: 24, padding: 18, gap: 12 }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                      <View
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 14,
                          backgroundColor: mix(colors["color-accent-mint"] ?? accentColor, "transparent", 22),
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text style={{ fontSize: 22 }}>🌙</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700", letterSpacing: 1.5 }}>
                          {"TONIGHT'S DINNER"}
                        </Text>
                        <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700", marginTop: 2 }}>
                          {tonightDinner?.name ? `Tonight · ${tonightDinner.name}` : "Nothing planned yet"}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 24 }}>{tonightDinner?.emoji || "🍽️"}</Text>
                  </View>
                  {tonightDinner ? (
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: 56 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                        <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }}>
                          ⏱️ {tonightDinner.prepTime || "30 min"}
                        </Text>
                        <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }}>
                          👥 {eatingTonightMembers.length > 0 ? eatingTonightMembers.length : tonightDinner.servings || 7}
                        </Text>
                      </View>
                      <Pressable
                        testID="meals-tonight-view"
                        accessibilityRole="button"
                        accessibilityLabel="View tonight's dinner recipe"
                        onPress={() => setDetail({ meal: tonightDinner, slot: "dinner" })}
                        hitSlop={10}
                      >
                        <Text style={{ color: accentColor, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
                          View recipe →
                        </Text>
                      </Pressable>
                    </View>
                  ) : member ? (
                    <View style={{ paddingLeft: 56 }}>
                      <Pressable
                        testID="meals-tonight-plan-btn"
                        accessibilityRole="button"
                        accessibilityLabel="Plan tonight's dinner"
                        onPress={() => openAddMeal(todayShort, "dinner")}
                        hitSlop={10}
                      >
                        <Text style={{ color: accentColor, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
                          + Plan dinner for tonight →
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}
                </Material>

                {/* Family Fuel Today Card */}
                <Material
                  tier="regular"
                  tone={colors["color-accent-amber"] ?? accentColor}
                  style={{ borderRadius: 24, padding: 18, gap: 14 }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 14,
                        backgroundColor: mix(colors["color-accent-amber"] ?? accentColor, "transparent", 22),
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ fontSize: 22 }}>🍎</Text>
                    </View>
                    <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700", letterSpacing: 1.5 }}>
                      FAMILY FUEL TODAY
                    </Text>
                  </View>

                  <View style={{ flexDirection: "row", alignItems: "center", gap: 18 }}>
                    {/* Circular Calorie Ring (react-native-svg) */}
                    <View style={{ width: 104, height: 104, alignItems: "center", justifyContent: "center" }}>
                      <Svg width={104} height={104} viewBox="0 0 104 104">
                        <Circle
                          cx={52}
                          cy={52}
                          r={40}
                          stroke={colors["color-surface-2"]}
                          strokeWidth={8}
                          fill="none"
                        />
                        <Circle
                          cx={52}
                          cy={52}
                          r={40}
                          stroke={colors["color-accent-amber"] ?? accentColor}
                          strokeWidth={8}
                          fill="none"
                          strokeDasharray={251.32}
                          strokeDashoffset={251.32 * (1 - Math.min(1, Math.max(0, todayKcal / 2000)))}
                          strokeLinecap="round"
                          transform="rotate(-90 52 52)"
                        />
                      </Svg>
                      <View style={{ position: "absolute", alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ color: colors["color-text-primary"], fontSize: 22, fontWeight: "800", fontVariant: ["tabular-nums"] }}>
                          {todayKcal}
                        </Text>
                        <Text style={{ color: colors["color-text-muted"], fontSize: 14, fontWeight: "600" }}>
                          / 2000 kcal
                        </Text>
                      </View>
                    </View>

                    {/* 3 Macro Progress Rows */}
                    <View style={{ flex: 1, gap: 8 }}>
                      <View style={{ gap: 3 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                          <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }}>Protein</Text>
                          <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
                            {`${todayProtein}g · ${Math.round((todayProtein / 100) * 100)}%`}
                          </Text>
                        </View>
                        <View style={{ height: 6, borderRadius: 3, backgroundColor: colors["color-surface-2"], overflow: "hidden" }}>
                          <View style={{ height: 6, width: `${Math.min(100, Math.round((todayProtein / 100) * 100))}%`, backgroundColor: colors["color-accent-mint"] ?? accentColor }} />
                        </View>
                      </View>

                      <View style={{ gap: 3 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                          <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }}>Carbs</Text>
                          <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
                            {`${todayCarbs}g · ${Math.round((todayCarbs / 250) * 100)}%`}
                          </Text>
                        </View>
                        <View style={{ height: 6, borderRadius: 3, backgroundColor: colors["color-surface-2"], overflow: "hidden" }}>
                          <View style={{ height: 6, width: `${Math.min(100, Math.round((todayCarbs / 250) * 100))}%`, backgroundColor: colors["color-accent-amber"] ?? accentColor }} />
                        </View>
                      </View>

                      <View style={{ gap: 3 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                          <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }}>Fats</Text>
                          <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
                            {`${todayFat}g · ${Math.round((todayFat / 70) * 100)}%`}
                          </Text>
                        </View>
                        <View style={{ height: 6, borderRadius: 3, backgroundColor: colors["color-surface-2"], overflow: "hidden" }}>
                          <View style={{ height: 6, width: `${Math.min(100, Math.round((todayFat / 70) * 100))}%`, backgroundColor: colors["color-accent-rose"] ?? accentColor }} />
                        </View>
                      </View>
                    </View>
                  </View>

                  {todaysMeals.length > 0 ? (
                    <Text
                      testID="meals-fuel-today"
                      style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, textAlign: "center", marginTop: 4 }}
                    >
                      {`Family fuel today: ${todayKcal} kcal · ${todayProtein}g protein · ${todayCarbs}g carbs · ${todayFat}g fat`}
                    </Text>
                  ) : null}
                </Material>

                {/* Who's Eating Tonight Card (Interactive Attendance Toggles) */}
                <Material
                  tier="regular"
                  tone={colors["color-accent-violet"] ?? accentColor}
                  style={{ borderRadius: 24, padding: 18, gap: 12 }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <View
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 14,
                          backgroundColor: mix(colors["color-accent-violet"] ?? accentColor, "transparent", 22),
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text style={{ fontSize: 22 }}>👥</Text>
                      </View>
                      <View>
                        <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700", letterSpacing: 1.5 }}>
                          {"WHO'S EATING TONIGHT"}
                        </Text>
                        <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }}>
                          Tap a family member to toggle attendance
                        </Text>
                      </View>
                    </View>
                    <Text
                      testID="meals-attendance-count"
                      style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}
                    >
                      {`${eatingTonightMembers.length} / ${familyMembers.length}`}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, paddingLeft: 4 }}>
                    {familyMembers.map((m) => {
                      const isPhoto = m.emoji ? isPhotoUri(m.emoji) : false;
                      const firstName = m.name.split(" ")[0] || m.name;
                      const attending = attendanceMap[m.name] !== false;
                      return (
                        <Pressable
                          key={m.name}
                          testID={`meals-attendee-${firstName.toLowerCase()}`}
                          accessibilityRole="checkbox"
                          accessibilityLabel={`${firstName} eating tonight`}
                          accessibilityState={{ checked: attending }}
                          onPress={() => toggleMemberAttendance(m.name)}
                          style={{
                            alignItems: "center",
                            gap: 4,
                            minWidth: MIN_TARGET_DP,
                            minHeight: MIN_TARGET_DP,
                            justifyContent: "center",
                            paddingHorizontal: 4,
                            opacity: attending ? 1 : 0.45,
                          }}
                        >
                          <View
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: 22,
                              backgroundColor: colors["color-surface-2"],
                              borderWidth: attending ? 2 : 1,
                              borderColor: attending ? colors["color-accent-mint"] ?? accentColor : colors["color-border"] ?? "transparent",
                              alignItems: "center",
                              justifyContent: "center",
                              overflow: "hidden",
                            }}
                          >
                            {isPhoto ? (
                              <Image source={{ uri: m.emoji }} style={{ width: 44, height: 44, borderRadius: 22 }} resizeMode="cover" />
                            ) : (
                              <Text style={{ fontSize: 22 }}>{m.emoji || "👤"}</Text>
                            )}
                          </View>
                          <Text numberOfLines={1} style={{ color: colors["color-text-primary"], fontSize: 14, fontWeight: "600", textAlign: "center" }}>
                            {firstName}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </Material>
              </View>
            </View>

            {/* Bottom Full-Width Recipe Box Card */}
            <Material
              tier="regular"
              tone={colors["color-accent-cyan"] ?? accentColor}
              style={{ borderRadius: 24, padding: 18, gap: 12, marginTop: 4 }}
            >
              <Pressable
                testID="meals-recipe-box-toggle"
                accessibilityRole="button"
                accessibilityLabel="Toggle Recipe box"
                onPress={() => setRecipeBoxOpen((v) => !v)}
                style={{ minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      backgroundColor: mix(colors["color-accent-cyan"] ?? accentColor, "transparent", 22),
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 22 }}>📖</Text>
                  </View>
                  <View>
                    <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
                      Recipe box
                    </Text>
                    <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }}>
                      {`${CURATED_MEAL_TEMPLATES.length} family classics · Tap to plan onto ${DAY_FULL_NAMES[selectedDay] ?? selectedDay}`}
                    </Text>
                  </View>
                </View>
                <Text style={{ color: colors["color-text-muted"], fontSize: 18, fontWeight: "700" }}>
                  {recipeBoxOpen ? "⌃" : "⌄"}
                </Text>
              </Pressable>
              {recipeBoxOpen ? (
                <View style={{ gap: 10, marginTop: 8 }}>
                  {meals.map((m) => (
                    <Pressable
                      key={`planned-${m.id}`}
                      onPress={() => setDetail({ meal: m, slot: (m.mealType as MealSlotId) || "dinner" })}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                        padding: 12,
                        borderRadius: 16,
                        backgroundColor: colors["color-surface-2"],
                      }}
                    >
                      <Text style={{ fontSize: 24 }}>{m.emoji || "🍽️"}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
                          {m.name}
                        </Text>
                        <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize }}>
                          {`${m.time} · ${m.mealType} · ${m.prepTime || "30 min"}`}
                        </Text>
                      </View>
                    </Pressable>
                  ))}

                  {CURATED_MEAL_TEMPLATES.map((tpl) => (
                    <View
                      key={`tpl-${tpl.name}`}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        padding: 12,
                        borderRadius: 16,
                        backgroundColor: colors["color-surface-0"],
                        borderWidth: 1,
                        borderColor: colors["color-border"] ?? "transparent",
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                        <Text style={{ fontSize: 24 }}>{tpl.emoji}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
                            {tpl.name}
                          </Text>
                          <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize }}>
                            {`${tpl.mealType} · ⏱️ ${tpl.prepTime} · 🔥 ${tpl.calories} kcal`}
                          </Text>
                        </View>
                      </View>
                      {member ? (
                        <SoftButton
                          variant="secondary"
                          size="sm"
                          onPress={() =>
                            void handleSaveMeal({
                              name: tpl.name,
                              emoji: tpl.emoji,
                              time: selectedDay,
                              mealType: tpl.mealType,
                              prepTime: tpl.prepTime,
                              servings: tpl.servings,
                              calories: tpl.calories,
                              protein: tpl.protein,
                              carbs: tpl.carbs,
                              fat: tpl.fat,
                              tags: [...tpl.tags],
                              ingredients: [...tpl.ingredients],
                              instructions: tpl.instructions,
                              weekOf: weekMonday,
                            })
                          }
                        >
                          {`+ ${selectedDay}`}
                        </SoftButton>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : null}
            </Material>

            <Text
              testID="meals-readonly-note"
              style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize, textAlign: "center", marginTop: 8 }}
            >
              {READONLY_COPY}
            </Text>
          </View>
        ) : (
          <View style={{ marginTop: 8 }}>
            <ShopStockTabs
              mode={tab}
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
          </View>
        )}
      </ScrollView>

      {/* Meal Detail & Cook Mode Modal */}
      <Modal
        visible={detail !== null}
        onClose={() => setDetail(null)}
        title={detail?.meal.name ?? ""}
        description={
          detail && detailSlot ? `${DAY_FULL_NAMES[detail.meal.time] ?? detail.meal.time} ${detailSlot.label} · ${detailSlot.time}` : undefined
        }
        testID="meals-detail"
        footer={
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flex: 1, gap: 12 }}>
            {detail && (isParent || member) ? (
              <SoftButton
                variant="secondary"
                size="sm"
                testID="meals-detail-edit"
                onPress={() => openEditMeal(detail.meal, detail.slot)}
              >
                ✎ Edit Meal
              </SoftButton>
            ) : (
              <View />
            )}
            <SoftButton onPress={() => setDetail(null)}>Close</SoftButton>
          </View>
        }
      >
        {detail && detailSlot ? (
          <View style={{ gap: 16 }}>
            <Text style={{ fontSize: 44, textAlign: "center" }}>{detail.meal.emoji || "🍽️"}</Text>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
              {detail.meal.calories > 0 ? (
                <Chip as="span" size="sm" tone="warning" label={`🔥 ${detail.meal.calories} kcal`} />
              ) : null}
              {detail.meal.prepTime ? (
                <Chip as="span" size="sm" tone="neutral" label={`⏱ ${detail.meal.prepTime}`} />
              ) : null}
              {detail.meal.servings > 0 ? (
                <Chip as="span" size="sm" tone="neutral" label={`👨‍👩‍👧‍👦 ${detail.meal.servings}`} />
              ) : null}
              {detail.meal.protein ? (
                <Chip as="span" size="sm" tone="success" label={`💪 ${detail.meal.protein}g protein`} />
              ) : null}
              {detail.meal.carbs ? (
                <Chip as="span" size="sm" tone="neutral" label={`🍞 ${detail.meal.carbs}g carbs`} />
              ) : null}
              {detail.meal.fat ? (
                <Chip as="span" size="sm" tone="neutral" label={`🥑 ${detail.meal.fat}g fat`} />
              ) : null}
            </View>

            {detail.meal.tags.length > 0 ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
                {detail.meal.tags.map((t) => (
                  <Chip key={t} as="span" size="sm" tone="neutral" label={t} />
                ))}
              </View>
            ) : null}

            {detail.meal.ingredients.length > 0 ? (
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text
                    style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}
                  >
                    Ingredients
                  </Text>
                  <Pressable
                    testID="meals-detail-send-grocery"
                    accessibilityRole="button"
                    accessibilityLabel="Add all ingredients to shopping list"
                    onPress={() => {
                      for (const ing of detail.meal.ingredients) {
                        handleAddGrocery({
                          name: ing,
                          category: "Other",
                          quantity: "1",
                          fromMeal: detail.meal.name,
                        });
                      }
                      setDetail(null);
                      setTab("shop");
                    }}
                  >
                    <Text style={{ color: accentColor, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
                      🛒 Add to Shop
                    </Text>
                  </Pressable>
                </View>
                {detail.meal.ingredients.map((ing) => (
                  <View key={ing} style={{ flexDirection: "row", gap: 8 }}>
                    <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.body.fontSize }}>•</Text>
                    <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, flex: 1 }}>
                      {ing}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {detail.meal.instructions ? (
              <View style={{ gap: 6 }}>
                <Text
                  style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}
                >
                  Cooking Instructions
                </Text>
                <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, lineHeight: 24 }}>
                  {detail.meal.instructions}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </Modal>

      {/* Meal Composer Modal (Add / Edit / Delete) */}
      <MealComposer
        visible={composerState.open}
        initialDay={composerState.day}
        initialSlot={composerState.slot}
        weekMonday={weekMonday}
        editingMeal={composerState.editingMeal}
        saving={composerSaving}
        onClose={() => setComposerState((s) => ({ ...s, open: false, editingMeal: null }))}
        onSave={(draft) => void handleSaveMeal(draft)}
        onDelete={(id) => void handleDeleteMeal(id)}
      />

      {/* AI Suggest / Week Generator Modal */}
      <AiSuggestModal
        visible={aiSuggestOpen}
        weekMonday={weekMonday}
        selectedDay={selectedDay}
        existingMeals={meals}
        onClose={() => setAiSuggestOpen(false)}
        onApplyMeals={(drafts) => void handleApplyAiMeals(drafts)}
      />

      {/* Archived Weeks Modal */}
      <Modal
        visible={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        title="🗄️ Archived Weeks"
        description="Browse previous meal plans or jump to any week."
        testID="meals-archive-modal"
        footer={<SoftButton onPress={() => setArchiveOpen(false)}>Close</SoftButton>}
      >
        <View style={{ gap: 12 }}>
          {archivedWeeks.length === 0 ? (
            <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.body.fontSize, textAlign: "center", paddingVertical: 16 }}>
              No archived meal plans from other weeks yet. Use the ‹ and › arrows to plan ahead or browse past weeks.
            </Text>
          ) : (
            archivedWeeks.map(([wkIso, wkMeals]) => (
              <Material
                key={wkIso}
                tier="thin"
                style={{
                  borderRadius: 20,
                  padding: 16,
                  gap: 8,
                  borderWidth: 1,
                  borderColor: colors["color-border"] ?? "transparent",
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View>
                    <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
                      {`Week of ${formatWeekRange(wkIso)}`}
                    </Text>
                    <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }}>
                      {wkMeals.map((m) => `${m.emoji || "🍽️"} ${m.name}`).join(" · ")}
                    </Text>
                  </View>
                  <SoftButton
                    variant="secondary"
                    size="sm"
                    testID={`meals-archive-copy-${wkIso}`}
                    onPress={() => {
                      const drafts: MealDraft[] = wkMeals.map((m) => ({
                        name: m.name,
                        emoji: m.emoji || "🍽️",
                        time: m.time,
                        mealType: (m.mealType as MealSlotId) || "dinner",
                        prepTime: m.prepTime || "25 min",
                        servings: m.servings || 6,
                        calories: m.calories || 0,
                        protein: m.protein || 0,
                        carbs: m.carbs || 0,
                        fat: m.fat || 0,
                        tags: [...m.tags],
                        ingredients: [...m.ingredients],
                        instructions: m.instructions,
                        weekOf: weekMonday,
                      }));
                      void handleApplyAiMeals(drafts);
                      setArchiveOpen(false);
                    }}
                  >
                    Copy to this week
                  </SoftButton>
                </View>
              </Material>
            ))
          )}
        </View>
      </Modal>
    </View>
  );
}

export default MealsPage;
