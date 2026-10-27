import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { Material } from "../theme/Material";
import { mix } from "../theme/mix";
import { MIN_TARGET_DP, TYPOGRAPHY } from "../theme/tokens";
import { Modal } from "../ui/Modal";
import { SoftButton } from "../ui/SoftButton";
import { Chip } from "../ui/Chip";
import {
  SLOT_META,
  WEEK_DAYS_SHORT,
  type MealSlotId,
  type ParsedMeal,
} from "./plan-grid";
import { CURATED_MEAL_TEMPLATES, type MealDraft } from "./api";

type SuggestMood = "balanced" | "quick" | "protein" | "kids";

const MOODS: { id: SuggestMood; label: string; icon: string; filterTag?: string }[] = [
  { id: "balanced", label: "Balanced Week", icon: "✨" },
  { id: "quick", label: "Under 25 Min", icon: "⚡", filterTag: "Quick" },
  { id: "protein", label: "High Protein", icon: "💪", filterTag: "High Protein" },
  { id: "kids", label: "Kids' Favorites", icon: "🎉", filterTag: "Kids Love" },
];

export interface AiSuggestModalProps {
  visible: boolean;
  weekMonday: string;
  selectedDay: string;
  existingMeals: ParsedMeal[];
  onClose: () => void;
  onApplyMeals: (drafts: MealDraft[]) => void;
}

export function AiSuggestModal({
  visible,
  weekMonday,
  selectedDay,
  existingMeals,
  onClose,
  onApplyMeals,
}: AiSuggestModalProps) {
  const { colors, accentColor } = useTheme();
  const [mood, setMood] = useState<SuggestMood>("balanced");

  const emptyDinnerDays = useMemo(() => {
    const existingSet = new Set(
      existingMeals
        .filter((m) => (m.weekOf || weekMonday) === weekMonday && m.mealType === "dinner")
        .map((m) => m.time)
    );
    return WEEK_DAYS_SHORT.filter((d) => !existingSet.has(d));
  }, [existingMeals, weekMonday]);

  const proposals = useMemo(() => {
    const activeMood = MOODS.find((m) => m.id === mood);
    const pool = CURATED_MEAL_TEMPLATES.filter((t) =>
      activeMood?.filterTag ? t.tags.includes(activeMood.filterTag) : true
    );
    const list = pool.length > 0 ? pool : CURATED_MEAL_TEMPLATES;
    const targetDays = emptyDinnerDays.length > 0 ? emptyDinnerDays : [selectedDay];

    return targetDays.map((day, idx) => {
      const tpl = list[idx % list.length];
      return {
        day,
        slot: "dinner" as MealSlotId,
        template: tpl,
      };
    });
  }, [mood, emptyDinnerDays, selectedDay]);

  const handleApplyAll = () => {
    const drafts: MealDraft[] = proposals.map((p) => ({
      name: p.template.name,
      emoji: p.template.emoji,
      time: p.day,
      mealType: p.slot,
      prepTime: p.template.prepTime,
      servings: p.template.servings,
      calories: p.template.calories,
      protein: p.template.protein,
      carbs: p.template.carbs,
      fat: p.template.fat,
      tags: [...p.template.tags],
      ingredients: [...p.template.ingredients],
      instructions: p.template.instructions,
      weekOf: weekMonday,
    }));
    onApplyMeals(drafts);
  };

  const handleApplySingle = (p: (typeof proposals)[number]) => {
    onApplyMeals([
      {
        name: p.template.name,
        emoji: p.template.emoji,
        time: p.day,
        mealType: p.slot,
        prepTime: p.template.prepTime,
        servings: p.template.servings,
        calories: p.template.calories,
        protein: p.template.protein,
        carbs: p.template.carbs,
        fat: p.template.fat,
        tags: [...p.template.tags],
        ingredients: [...p.template.ingredients],
        instructions: p.template.instructions,
        weekOf: weekMonday,
      },
    ]);
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title="✨ Consuela Meal Assistant"
      description={
        emptyDinnerDays.length > 0
          ? `Found ${emptyDinnerDays.length} open dinner slot${emptyDinnerDays.length === 1 ? "" : "s"} this week.`
          : `Suggestions tailored for ${selectedDay}.`
      }
      testID="meals-ai-modal"
      footer={
        <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 12, flex: 1 }}>
          <SoftButton variant="secondary" size="sm" onPress={onClose}>
            Close
          </SoftButton>
          <SoftButton
            variant="primary"
            size="sm"
            onPress={handleApplyAll}
            testID="meals-ai-apply-all"
          >
            {`✨ Fill ${proposals.length} Dinner${proposals.length === 1 ? "" : "s"}`}
          </SoftButton>
        </View>
      }
    >
      <View style={{ gap: 16 }}>
        {/* Mood Selector */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {MOODS.map((m) => (
            <Chip
              key={m.id}
              label={`${m.icon} ${m.label}`}
              selected={mood === m.id}
              onPress={() => setMood(m.id)}
              testID={`meals-ai-mood-${m.id}`}
            />
          ))}
        </View>

        {/* Proposed Meals */}
        <View style={{ gap: 10 }}>
          {proposals.map((p) => (
            <Material
              key={`${p.day}-${p.template.name}`}
              tier="thin"
              style={{
                borderRadius: 20,
                padding: 14,
                gap: 8,
                borderWidth: 1,
                borderColor: colors["color-border"] ?? "transparent",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 16,
                      backgroundColor: mix(accentColor, "transparent", 18),
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 24 }}>{p.template.emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
                      {`${p.day.toUpperCase()} · ${SLOT_META[p.slot].label.toUpperCase()}`}
                    </Text>
                    <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
                      {p.template.name}
                    </Text>
                    <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }}>
                      {`⏱️ ${p.template.prepTime} · 🔥 ${p.template.calories} kcal · 💪 ${p.template.protein}g protein`}
                    </Text>
                  </View>
                </View>
                <Pressable
                  testID={`meals-ai-pick-${p.day}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Plan ${p.template.name} on ${p.day}`}
                  onPress={() => handleApplySingle(p)}
                  style={{
                    minHeight: MIN_TARGET_DP,
                    paddingHorizontal: 16,
                    borderRadius: 16,
                    backgroundColor: colors["color-surface-2"],
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
                    + Use
                  </Text>
                </Pressable>
              </View>
            </Material>
          ))}
        </View>
      </View>
    </Modal>
  );
}

export default AiSuggestModal;
