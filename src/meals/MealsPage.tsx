import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { api } from "../api/client";
import type { DbListEnvelope } from "../api/types";
import { useTheme } from "../theme/ThemeProvider";
import { accentInk } from "../theme/mix";
import { TYPOGRAPHY } from "../theme/tokens";
import { useAuth } from "../state/AuthProvider";
import { useSync } from "../state/SyncManager";
import { Chip } from "../ui/Chip";
import { EmptyState } from "../ui/EmptyState";
import { Modal } from "../ui/Modal";
import { SegmentedControl } from "../ui/SegmentedControl";
import { SoftButton } from "../ui/SoftButton";
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
  currentSlotForHour,
  mapMealRows,
  mealForCell,
  weekHasMeals,
  type MealRow,
  type MealSlotId,
  type ParsedMeal,
} from "./plan-grid";

/**
 * The wall's Meals surface (WS-6): the Plan tab as a read-only week grid —
 * Mon–Sun columns × breakfast/lunch/snack/dinner slot rows, the current slot
 * chipped "Now", today's column accented. Cell selection semantics are the
 * CurrentMealWidget's (weekOf-Monday match, no cross-slot fallback) so the
 * Home cell and this page always agree. The web's Shop/Stock tabs and every
 * write flow are honest deferrals — the wall shows the family truth and says
 * so (no dead affordances).
 */

const GUEST_COPY = "Sign in with your PIN to see the family's meals.";
const LOADING_COPY = "Loading the family's meals…";
const EMPTY_WEEK_COPY = "No meals planned yet — Plan dinner in the Kitchen tab.";
const READONLY_COPY = "Adding meals from the wall arrives with the next wave — ask a parent on the phone.";
const SHOP_STOCK_COPY = "The grocery list and pantry arrive with the Groceries surface in the next wave.";

const CELL_MIN_DP = 96; // ≥ the 64dp tap-target floor for tappable meal cells

type KitchenTab = "plan" | "shop" | "stock";

export function MealsPage({ now = new Date() }: { now?: Date }) {
  const { colors, accentColor } = useTheme();
  const { member } = useAuth();
  const { stale: syncStale } = useSync();

  const [tab, setTab] = useState<KitchenTab>("plan");
  const [detail, setDetail] = useState<{ meal: ParsedMeal; slot: MealSlotId } | null>(null);

  const { status, data, failure, retry } = useWidgetData<ParsedMeal[]>(async () => {
    const res = await api<DbListEnvelope<MealRow>>("/api/db/meal_plan_entries");
    return mapMealRows(Array.isArray(res?.items) ? res.items : []);
  });

  const meals = useMemo(() => data ?? [], [data]);
  const weekMonday = weekStartMondayISO(now);
  const days = useMemo(
    () => WEEK_DAYS_SHORT.map((short, i) => ({ short, iso: addDaysISO(weekMonday, i) })),
    [weekMonday]
  );
  const todayShort = WEEK_DAYS_SHORT[(now.getDay() + 6) % 7];
  const currentSlot = currentSlotForHour(now.getHours());

  const renderCell = (day: (typeof days)[number], slot: MealSlotId) => {
    const meal = mealForCell(meals, day.short, slot, weekMonday);
    const isToday = day.short === todayShort;
    const slotAccent = colors[SLOT_META[slot].accentToken] ?? accentColor;
    const testID = `meals-cell-${day.short}-${slot}`;

    if (!meal) {
      // Empty slot: a plain surface, NOT a button — the web's "Plan X" here is
      // an add affordance this read-only port must not fake.
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

  return (
    <View testID="meals-page" style={{ flex: 1, paddingHorizontal: 24, paddingTop: 16 }}>
      {/* Page header */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{ color: colors["color-text-primary"], fontSize: 54, fontWeight: "700" }}>Kitchen</Text>
        <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.body.fontSize, marginTop: 4 }}>
          This week
        </Text>
        {syncStale && member ? (
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

      {!member ? (
        <EmptyState icon="🍽️" title="Meals" body={GUEST_COPY} />
      ) : status === "loading" ? (
        <View testID="meals-loading" accessibilityLabel={LOADING_COPY} style={{ gap: 12 }}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ height: 64, borderRadius: 20, backgroundColor: colors["color-surface-2"] }} />
          ))}
        </View>
      ) : status === "error" ? (
        <View testID="meals-error">
          <EmptyState
            icon="🍽️"
            title="Meals"
            body={READ_COPY[failure ?? "error"]}
            actionLabel={READ_RETRY_LABEL}
            onAction={retry}
          />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
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
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 180 }} showsVerticalScrollIndicator={false}>
            {tab === "plan" ? (
              <View style={{ marginTop: 16, gap: 14 }}>
                {weekHasMeals(meals, weekMonday) ? (
                  <View style={{ gap: 14 }}>
                    {/* Day header row: Mon–Sun, today accented */}
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      {days.map((day) => {
                        const isToday = day.short === todayShort;
                        return (
                          <View
                            key={day.short}
                            testID={`meals-day-${day.short}`}
                            accessibilityLabel={isToday ? "Today" : day.short}
                            style={{ flex: 1, alignItems: "center", paddingVertical: 6 }}
                          >
                            <Text
                              style={{
                                color: isToday
                                  ? accentInk(accentColor, colors["color-text-primary"])
                                  : colors["color-text-secondary"],
                                fontSize: TYPOGRAPHY.body.fontSize,
                                fontWeight: isToday ? "800" : "700",
                              }}
                            >
                              {day.short}
                            </Text>
                          </View>
                        );
                      })}
                    </View>

                    {/* Slot rows: breakfast / lunch / snack / dinner */}
                    {SLOT_ORDER.map((slot) => {
                      const meta = SLOT_META[slot];
                      const slotAccent = colors[meta.accentToken] ?? accentColor;
                      const isCurrent = slot === currentSlot;
                      return (
                        <View key={slot} testID={`meals-slot-${slot}`} style={{ gap: 6 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <Text
                              style={{
                                color: accentInk(slotAccent, colors["color-text-primary"]),
                                fontSize: TYPOGRAPHY.body.fontSize,
                                fontWeight: "700",
                              }}
                            >
                              {`${meta.icon} ${meta.label}`}
                            </Text>
                            <Text
                              style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize }}
                            >
                              {`· ${meta.time}`}
                            </Text>
                            {isCurrent ? (
                              <Chip as="span" size="sm" tone="accent" label="Now" testID="meals-now-chip" />
                            ) : null}
                          </View>
                          <View style={{ flexDirection: "row", gap: 6 }}>
                            {days.map((day) => renderCell(day, slot))}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <EmptyState flat icon="🍽️" title="Meals" body={EMPTY_WEEK_COPY} />
                )}

                <Text
                  testID="meals-readonly-note"
                  style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize, textAlign: "center" }}
                >
                  {READONLY_COPY}
                </Text>
              </View>
            ) : (
              <View style={{ marginTop: 16 }}>
                <EmptyState
                  icon={tab === "shop" ? "🛒" : "🥫"}
                  title={tab === "shop" ? "Shop" : "Stock"}
                  body={SHOP_STOCK_COPY}
                />
              </View>
            )}
          </ScrollView>
        </View>
      )}

      {/* Read-only meal detail */}
      <Modal
        visible={detail !== null}
        onClose={() => setDetail(null)}
        title={detail?.meal.name ?? ""}
        description={
          detail && detailSlot ? `${DAY_FULL_NAMES[detail.meal.time] ?? detail.meal.time} ${detailSlot.label} · ${detailSlot.time}` : undefined
        }
        testID="meals-detail"
        footer={<SoftButton onPress={() => setDetail(null)}>Close</SoftButton>}
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
                <Text
                  style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}
                >
                  Ingredients
                </Text>
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
          </View>
        ) : null}
      </Modal>
    </View>
  );
}

export default MealsPage;
