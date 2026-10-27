import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { mix } from "../theme/mix";
import { MIN_TARGET_DP, TYPOGRAPHY } from "../theme/tokens";
import { Modal } from "../ui/Modal";
import { TextField } from "../ui/TextField";
import { SoftButton } from "../ui/SoftButton";
import { Chip } from "../ui/Chip";
import { Stepper } from "../ui/Stepper";
import {
  DAY_FULL_NAMES,
  SLOT_META,
  SLOT_ORDER,
  WEEK_DAYS_SHORT,
  type MealSlotId,
  type ParsedMeal,
} from "./plan-grid";
import { CURATED_MEAL_TEMPLATES, type MealDraft } from "./api";

const MEAL_EMOJIS = [
  "🍽️", "🌮", "🍝", "🍣", "🍲", "🥗", "🍕", "🍔",
  "🥞", "🥑", "🥪", "🍎", "🥨", "🍜", "🍛", "🍗",
];

const PREP_OPTIONS = ["10 min", "15 min", "20 min", "30 min", "45 min", "60 min"];

const TAG_PRESETS = [
  "Family Fave",
  "Quick",
  "Kids Love",
  "High Protein",
  "One Pan",
  "Make Ahead",
  "Healthy",
  "Comfort Food",
];

export interface MealComposerProps {
  visible: boolean;
  initialDay: string;
  initialSlot: MealSlotId;
  weekMonday: string;
  editingMeal?: ParsedMeal | null;
  saving?: boolean;
  onClose: () => void;
  onSave: (draft: MealDraft) => void;
  onDelete?: (id: string | number) => void;
}

export function MealComposer({
  visible,
  initialDay,
  initialSlot,
  weekMonday,
  editingMeal = null,
  saving = false,
  onClose,
  onSave,
  onDelete,
}: MealComposerProps) {
  const { colors, accentColor } = useTheme();

  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🍽️");
  const [day, setDay] = useState(initialDay);
  const [slot, setSlot] = useState<MealSlotId>(initialSlot);
  const [prepTime, setPrepTime] = useState("25 min");
  const [servings, setServings] = useState(6);
  const [calories, setCalories] = useState("520");
  const [protein, setProtein] = useState("30");
  const [carbs, setCarbs] = useState("45");
  const [fat, setFat] = useState("18");
  const [tags, setTags] = useState<string[]>([]);
  const [ingredientsText, setIngredientsText] = useState("");
  const [instructions, setInstructions] = useState("");
  const [nameTouched, setNameTouched] = useState(false);

  useEffect(() => {
    if (!visible) return;
    /* eslint-disable react-hooks/set-state-in-effect -- reset draft state when modal opens */
    if (editingMeal) {
      setName(editingMeal.name || "");
      setEmoji(editingMeal.emoji || "🍽️");
      setDay(editingMeal.time || initialDay);
      setSlot((editingMeal.mealType as MealSlotId) || initialSlot);
      setPrepTime(editingMeal.prepTime || "25 min");
      setServings(editingMeal.servings || 6);
      setCalories(String(editingMeal.calories || 0));
      setProtein(String(editingMeal.protein || 0));
      setCarbs(String(editingMeal.carbs || 0));
      setFat(String(editingMeal.fat || 0));
      setTags(Array.isArray(editingMeal.tags) ? editingMeal.tags : []);
      setIngredientsText(Array.isArray(editingMeal.ingredients) ? editingMeal.ingredients.join(", ") : "");
      setInstructions(editingMeal.instructions || "");
    } else {
      const slotIcon = SLOT_META[initialSlot]?.icon ?? "🍽️";
      setName("");
      setEmoji(slotIcon);
      setDay(initialDay);
      setSlot(initialSlot);
      setPrepTime("25 min");
      setServings(6);
      setCalories("500");
      setProtein("28");
      setCarbs("45");
      setFat("18");
      setTags([]);
      setIngredientsText("");
      setInstructions("");
    }
    setNameTouched(false);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [visible, editingMeal, initialDay, initialSlot]);

  const applyTemplate = (tpl: (typeof CURATED_MEAL_TEMPLATES)[number]) => {
    setName(tpl.name);
    setEmoji(tpl.emoji);
    setSlot(tpl.mealType);
    setPrepTime(tpl.prepTime);
    setServings(tpl.servings);
    setCalories(String(tpl.calories));
    setProtein(String(tpl.protein));
    setCarbs(String(tpl.carbs));
    setFat(String(tpl.fat));
    setTags([...tpl.tags]);
    setIngredientsText(tpl.ingredients.join(", "));
    setInstructions(tpl.instructions);
    setNameTouched(true);
  };

  const toggleTag = (tag: string) => {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const canSave = name.trim().length > 0;
  const nameError = nameTouched && !canSave ? "Enter a meal name." : undefined;

  const handleSave = () => {
    if (!canSave) {
      setNameTouched(true);
      return;
    }
    const parsedIngredients = ingredientsText
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);

    onSave({
      id: editingMeal?.id,
      name: name.trim(),
      emoji,
      time: day,
      mealType: slot,
      prepTime,
      servings,
      calories: Math.max(0, Number(calories) || 0),
      protein: Math.max(0, Number(protein) || 0),
      carbs: Math.max(0, Number(carbs) || 0),
      fat: Math.max(0, Number(fat) || 0),
      tags,
      ingredients: parsedIngredients,
      instructions: instructions.trim(),
      weekOf: weekMonday,
    });
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={editingMeal ? "Edit Meal" : "Plan a Meal"}
      description={`${DAY_FULL_NAMES[day] ?? day} · ${SLOT_META[slot].label} (${SLOT_META[slot].time})`}
      testID="meal-composer"
      footer={
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flex: 1, gap: 12 }}>
          {editingMeal && onDelete ? (
            <SoftButton
              variant="danger"
              size="sm"
              testID="meal-composer-delete"
              onPress={() => onDelete(editingMeal.id)}
            >
              Remove
            </SoftButton>
          ) : (
            <View />
          )}
          <View style={{ flexDirection: "row", gap: 12 }}>
            <SoftButton variant="secondary" size="sm" onPress={onClose} testID="meal-composer-cancel">
              Cancel
            </SoftButton>
            <SoftButton
              variant="primary"
              size="sm"
              loading={saving}
              disabled={!canSave}
              onPress={handleSave}
              testID="meal-composer-save"
            >
              {editingMeal ? "Save changes" : "Add to plan"}
            </SoftButton>
          </View>
        </View>
      }
    >
      <View style={{ gap: 16 }}>
        {/* Quick Recipe Starters */}
        <View style={{ gap: 8 }}>
          <Text style={{ color: colors["color-text-secondary"], ...TYPOGRAPHY.fieldLabel }}>
            Quick Family Favorites
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {CURATED_MEAL_TEMPLATES.map((tpl) => (
                <Chip
                  key={tpl.name}
                  label={`${tpl.emoji} ${tpl.name}`}
                  selected={name === tpl.name}
                  onPress={() => applyTemplate(tpl)}
                  testID={`meal-tpl-${tpl.name.toLowerCase().replace(/\s+/g, "-")}`}
                />
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Meal Name */}
        <TextField
          testID="meal-composer-name"
          label="Meal name"
          placeholder="e.g. Sheet Pan Chicken Fajitas"
          value={name}
          onChangeText={(v) => {
            setNameTouched(true);
            setName(v);
          }}
          errorText={nameError}
        />

        {/* Emoji Picker */}
        <View style={{ gap: 8 }}>
          <Text style={{ color: colors["color-text-secondary"], ...TYPOGRAPHY.fieldLabel }}>
            Icon
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {MEAL_EMOJIS.map((e) => {
                const active = emoji === e;
                return (
                  <Pressable
                    key={e}
                    accessibilityRole="button"
                    accessibilityLabel={`Choose icon ${e}`}
                    accessibilityState={{ selected: active }}
                    onPress={() => setEmoji(e)}
                    style={{
                      width: MIN_TARGET_DP,
                      height: MIN_TARGET_DP,
                      borderRadius: 18,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: active ? mix(accentColor, "transparent", 25) : colors["color-surface-2"],
                      borderWidth: active ? 2 : 1,
                      borderColor: active ? accentColor : colors["color-border"] ?? "transparent",
                    }}
                  >
                    <Text style={{ fontSize: 26 }}>{e}</Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {/* Day & Slot Selection */}
        <View style={{ gap: 8 }}>
          <Text style={{ color: colors["color-text-secondary"], ...TYPOGRAPHY.fieldLabel }}>
            Day of Week
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {WEEK_DAYS_SHORT.map((d) => (
                <Chip
                  key={d}
                  label={d}
                  selected={day === d}
                  onPress={() => setDay(d)}
                  testID={`meal-composer-day-${d}`}
                />
              ))}
            </View>
          </ScrollView>
        </View>

        <View style={{ gap: 8 }}>
          <Text style={{ color: colors["color-text-secondary"], ...TYPOGRAPHY.fieldLabel }}>
            Meal Slot
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {SLOT_ORDER.map((s) => (
                <Chip
                  key={s}
                  label={`${SLOT_META[s].icon} ${SLOT_META[s].label}`}
                  selected={slot === s}
                  onPress={() => setSlot(s)}
                  testID={`meal-composer-slot-${s}`}
                />
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Prep Time & Servings */}
        <View style={{ gap: 8 }}>
          <Text style={{ color: colors["color-text-secondary"], ...TYPOGRAPHY.fieldLabel }}>
            Prep Time
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {PREP_OPTIONS.map((p) => (
                <Chip
                  key={p}
                  label={`⏱️ ${p}`}
                  selected={prepTime === p}
                  onPress={() => setPrepTime(p)}
                />
              ))}
            </View>
          </ScrollView>
        </View>

        <Stepper
          label="Servings"
          value={servings}
          min={1}
          max={16}
          onChange={setServings}
          testID="meal-composer-servings"
        />

        {/* Nutrition Row */}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <TextField
              label="Calories"
              keyboardType="numeric"
              value={calories}
              onChangeText={setCalories}
              testID="meal-composer-calories"
            />
          </View>
          <View style={{ flex: 1 }}>
            <TextField
              label="Protein (g)"
              keyboardType="numeric"
              value={protein}
              onChangeText={setProtein}
              testID="meal-composer-protein"
            />
          </View>
          <View style={{ flex: 1 }}>
            <TextField
              label="Carbs (g)"
              keyboardType="numeric"
              value={carbs}
              onChangeText={setCarbs}
              testID="meal-composer-carbs"
            />
          </View>
          <View style={{ flex: 1 }}>
            <TextField
              label="Fat (g)"
              keyboardType="numeric"
              value={fat}
              onChangeText={setFat}
              testID="meal-composer-fat"
            />
          </View>
        </View>

        {/* Ingredients */}
        <TextField
          testID="meal-composer-ingredients"
          label="Ingredients (comma-separated)"
          placeholder="Chicken breast, Bell peppers, Tortillas, Salsa"
          value={ingredientsText}
          onChangeText={setIngredientsText}
          multiline
        />

        {/* Tags */}
        <View style={{ gap: 8 }}>
          <Text style={{ color: colors["color-text-secondary"], ...TYPOGRAPHY.fieldLabel }}>
            Tags
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {TAG_PRESETS.map((tag) => (
              <Chip
                key={tag}
                label={tag}
                selected={tags.includes(tag)}
                onPress={() => toggleTag(tag)}
              />
            ))}
          </View>
        </View>

        {/* Instructions */}
        <TextField
          testID="meal-composer-instructions"
          label="Cooking notes / steps"
          placeholder="Roast at 425°F for 20 minutes..."
          value={instructions}
          onChangeText={setInstructions}
          multiline
        />
      </View>
    </Modal>
  );
}

export default MealComposer;
