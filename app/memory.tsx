import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { usePathname, useRouter } from "expo-router";
import { Screen } from "../src/theme/Screen";
import { useTheme } from "../src/theme/ThemeProvider";
import { Material } from "../src/theme/Material";
import { FONTS, MIN_TARGET_DP, RADII, SPACING, TYPOGRAPHY } from "../src/theme/tokens";
import { mix } from "../src/theme/mix";
import { CapsuleDock, MoreButton } from "../src/nav/CapsuleDock";
import { MoreSheet } from "../src/nav/MoreSheet";
import { useAuth } from "../src/state/AuthProvider";
import { Modal } from "../src/ui/Modal";
import { SoftButton } from "../src/ui/SoftButton";
import { TextField } from "../src/ui/TextField";
import { EmptyState } from "../src/ui/EmptyState";
import { useToast } from "../src/ui/Toast";

const MEMORY_STORAGE_KEY = "@consuela/family_memory_v1";

interface MemoryItem {
  id: string;
  title: string;
  category: string;
  emoji: string;
  detail: string;
}

const MEMORY_CATEGORIES = [
  "All",
  "Medical & Allergies",
  "Sizes & Gear",
  "Home & School",
  "Favorites",
] as const;

const DEFAULT_MEMORY_ITEMS: MemoryItem[] = [
  {
    id: "mem-1",
    title: "Allergies & Dietary Notes",
    category: "Medical & Allergies",
    emoji: "🩺",
    detail: "No tree nuts in school lunchboxes. Keep children's antihistamine in top hall cabinet.",
  },
  {
    id: "mem-2",
    title: "Pediatrician & Dentist Info",
    category: "Medical & Allergies",
    emoji: "🏥",
    detail: "Valley Family Pediatrics · Annual checkups in August · Dental cleanings every 6 months.",
  },
  {
    id: "mem-3",
    title: "Shoe & Clothing Sizes",
    category: "Sizes & Gear",
    emoji: "👟",
    detail: "Kids Youth M / Shoe size 4Y · Winter coat size 10-12.",
  },
  {
    id: "mem-4",
    title: "School & Bus Schedule",
    category: "Home & School",
    emoji: "🚌",
    detail: "Morning bus pickup 7:40 AM at corner · Early dismissal Wednesdays at 1:45 PM.",
  },
  {
    id: "mem-5",
    title: "Friday Pizza Order",
    category: "Favorites",
    emoji: "🍕",
    detail: "1 Large Half Cheese / Half Pepperoni + 1 Caesar Salad + Garlic Knots.",
  },
];

export default function FamilyMemoryRoute() {
  const { colors, accentColor } = useTheme();
  const toast = useToast();
  const pathname = usePathname();
  const router = useRouter();
  const { role: capabilityRole, hydrated, poke } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);

  const [items, setItems] = useState<MemoryItem[]>(DEFAULT_MEMORY_ITEMS);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);

  const [draftTitle, setDraftTitle] = useState("");
  const [draftCategory, setDraftCategory] = useState("Home & School");
  const [draftDetail, setDraftDetail] = useState("");

  const navRole = capabilityRole === "parent" ? "parent" : capabilityRole ? "child" : "guest";

  useEffect(() => {
    let alive = true;
    void AsyncStorage.getItem(MEMORY_STORAGE_KEY).then((raw) => {
      if (!alive || !raw) return;
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) setItems(parsed);
      } catch {
        // ignore
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const persistItems = useCallback(async (next: MemoryItem[]) => {
    setItems(next);
    try {
      await AsyncStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }, []);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((m) => {
      if (selectedCategory !== "All" && m.category !== selectedCategory) return false;
      if (q && !m.title.toLowerCase().includes(q) && !m.detail.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, selectedCategory, searchQuery]);

  const handleAddMemory = useCallback(async () => {
    if (!draftTitle.trim()) return;
    const emojiMap: Record<string, string> = {
      "Medical & Allergies": "🩺",
      "Sizes & Gear": "👕",
      "Home & School": "🏠",
      Favorites: "🍕",
    };
    const entry: MemoryItem = {
      id: `mem-${Date.now()}`,
      title: draftTitle.trim(),
      category: draftCategory,
      emoji: emojiMap[draftCategory] ?? "📌",
      detail: draftDetail.trim() || "Saved in Family Memory.",
    };
    await persistItems([entry, ...items]);
    setComposerOpen(false);
    setDraftTitle("");
    setDraftDetail("");
    toast.show(`Saved "${entry.title}" to Family Memory`, { intent: "success" });
  }, [draftTitle, draftCategory, draftDetail, items, persistItems, toast]);

  const handleDeleteMemory = useCallback(
    async (id: string) => {
      const next = items.filter((m) => m.id !== id);
      await persistItems(next);
      toast.show("Removed memory card", { intent: "info" });
    },
    [items, persistItems, toast],
  );

  return (
    <Screen testID="memory-route">
      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 16 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 180, gap: 20 }} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <View>
              <Text
                style={{
                  color: colors["color-text-muted"],
                  fontSize: TYPOGRAPHY.label.fontSize,
                  fontWeight: "700",
                  letterSpacing: 2,
                }}
              >
                ADDRESSES, ALLERGIES & PREFERENCES
              </Text>
              <Text
                style={{
                  color: colors["color-text-primary"],
                  fontSize: 44,
                  fontWeight: "400",
                  fontFamily: FONTS.display,
                  marginTop: 4,
                }}
              >
                🧠 Family Memory
              </Text>
            </View>
            <SoftButton
              variant="primary"
              size="sm"
              testID="memory-add-button"
              accessibilityLabel="Add new family memory note"
              onPress={() => setComposerOpen(true)}
            >
              + Add Memory
            </SoftButton>
          </View>

          <TextField
            testID="memory-search-input"
            label="Quick Search"
            placeholder="Search allergies, sizes, schedules, or favorites..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />

          {/* Category Filter Strip */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACING.xs }}>
            {MEMORY_CATEGORIES.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <Pressable
                  key={cat}
                  testID={`memory-filter-${cat}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Filter by ${cat}`}
                  onPress={() => setSelectedCategory(cat)}
                  style={{
                    minHeight: MIN_TARGET_DP,
                    paddingHorizontal: SPACING.md,
                    borderRadius: RADII.pill,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: active ? accentColor : colors["color-border-subtle"],
                    backgroundColor: active ? mix(accentColor, "transparent", 20) : colors["color-surface-1"],
                  }}
                >
                  <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: active ? "700" : "600" }}>
                    {cat}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Memory Cards */}
          {filteredItems.length === 0 ? (
            <EmptyState
              icon="🧠"
              title="No matching memory notes"
              body="Try clearing the search filter or tap + Add Memory to store a household note."
            />
          ) : (
            <View style={{ gap: SPACING.md }}>
              {filteredItems.map((item) => (
                <Material
                  key={item.id}
                  tier="regular"
                  testID={`memory-card-${item.id}`}
                  style={{
                    borderRadius: RADII.xl,
                    padding: SPACING.md,
                    gap: SPACING.xs,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SPACING.sm }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: SPACING.sm, flex: 1 }}>
                      <Text style={{ fontSize: 28 }}>{item.emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.cardTitle.fontSize, fontWeight: "700" }}>
                          {item.title}
                        </Text>
                        <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }}>
                          {item.category}
                        </Text>
                      </View>
                    </View>
                    <SoftButton
                      variant="ghost"
                      size="sm"
                      testID={`memory-delete-${item.id}`}
                      accessibilityLabel={`Remove ${item.title}`}
                      onPress={() => void handleDeleteMemory(item.id)}
                    >
                      Remove
                    </SoftButton>
                  </View>
                  <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, lineHeight: 22 }}>
                    {item.detail}
                  </Text>
                </Material>
              ))}
            </View>
          )}
        </ScrollView>
      </View>

      <Modal
        visible={composerOpen}
        onClose={() => setComposerOpen(false)}
        title="Add Family Memory"
        description="Store household preferences, sizes, allergies, or key contacts"
        testID="memory-composer-modal"
      >
        <View style={{ gap: SPACING.md }}>
          <TextField
            testID="memory-composer-title"
            label="Title"
            placeholder="e.g. Gate & Garage Info, Pediatrician, Sizes"
            value={draftTitle}
            onChangeText={setDraftTitle}
          />
          <View style={{ gap: SPACING.xs }}>
            <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
              Category
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACING.xs }}>
              {MEMORY_CATEGORIES.filter((c) => c !== "All").map((cat) => {
                const active = draftCategory === cat;
                return (
                  <Pressable
                    key={cat}
                    testID={`memory-composer-cat-${cat}`}
                    accessibilityRole="button"
                    accessibilityLabel={cat}
                    onPress={() => setDraftCategory(cat)}
                    style={{
                      minHeight: MIN_TARGET_DP,
                      paddingHorizontal: SPACING.md,
                      borderRadius: RADII.pill,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 1,
                      borderColor: active ? accentColor : colors["color-border-subtle"],
                      backgroundColor: active ? mix(accentColor, "transparent", 20) : colors["color-surface-1"],
                    }}
                  >
                    <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: active ? "700" : "500" }}>
                      {cat}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
          <TextField
            testID="memory-composer-detail"
            label="Details"
            placeholder="Write the details Consuela and the family should remember..."
            value={draftDetail}
            onChangeText={setDraftDetail}
            multiline
          />
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: SPACING.sm }}>
            <SoftButton variant="ghost" onPress={() => setComposerOpen(false)}>
              Cancel
            </SoftButton>
            <SoftButton
              variant="primary"
              testID="memory-composer-save"
              disabled={!draftTitle.trim()}
              onPress={() => void handleAddMemory()}
            >
              Save Memory
            </SoftButton>
          </View>
        </View>
      </Modal>

      <View style={{ position: "absolute", left: 0, right: 0, bottom: 116, alignItems: "center" }} pointerEvents="box-none">
        <MoreButton onPress={() => setMoreOpen(true)} />
      </View>
      <CapsuleDock
        role={navRole}
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
        role={navRole}
        onNavigate={(p) => {
          poke();
          router.push(p as never);
        }}
      />
    </Screen>
  );
}
