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
  pinned?: boolean;
}

interface StarterTemplate {
  id: string;
  emoji: string;
  title: string;
  category: string;
  detail: string;
}

const MEMORY_CATEGORIES = [
  "All",
  "Medical & Allergies",
  "Sizes & Gear",
  "Home & School",
  "Favorites",
] as const;

const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: "sitters",
    emoji: "🚨",
    title: "Emergency Contacts & Neighbors",
    category: "Medical & Allergies",
    detail: "Mom & Dad cells · Trusted neighbor next door · Poison Control: 800-222-1222",
  },
  {
    id: "bedtime",
    emoji: "🌙",
    title: "Bedtime & House Rules",
    category: "Home & School",
    detail: "Pajamas & brush teeth at 7:30 PM · 2 stories · Nightlight on, screens off at 8:00 PM",
  },
  {
    id: "pets",
    emoji: "🐶",
    title: "Pet Feeding & Walk Guide",
    category: "Home & School",
    detail: "1 scoop kibble at 7 AM & 5 PM · Fresh water bowl in laundry room · Leash on mudroom hook",
  },
  {
    id: "wifi",
    emoji: "📶",
    title: "Guest Wi-Fi & TV Remote",
    category: "Favorites",
    detail: "Network: FamilyGuest · Apple TV remote in living room tray",
  },
];

const DEFAULT_MEMORY_ITEMS: MemoryItem[] = [
  {
    id: "mem-1",
    title: "Allergies & Dietary Notes",
    category: "Medical & Allergies",
    emoji: "🩺",
    detail: "No tree nuts in school lunchboxes. Keep children's antihistamine in top hall cabinet.",
    pinned: true,
  },
  {
    id: "mem-2",
    title: "Pediatrician & Dentist Info",
    category: "Medical & Allergies",
    emoji: "🏥",
    detail: "Valley Family Pediatrics · Annual checkups in August · Dental cleanings every 6 months.",
    pinned: true,
  },
  {
    id: "mem-3",
    title: "Shoe & Clothing Sizes",
    category: "Sizes & Gear",
    emoji: "👟",
    detail: "Kids Youth M / Shoe size 4Y · Winter coat size 10-12.",
    pinned: false,
  },
  {
    id: "mem-4",
    title: "School & Bus Schedule",
    category: "Home & School",
    emoji: "🚌",
    detail: "Morning bus pickup 7:40 AM at corner · Early dismissal Wednesdays at 1:45 PM.",
    pinned: false,
  },
  {
    id: "mem-5",
    title: "Friday Pizza Order",
    category: "Favorites",
    emoji: "🍕",
    detail: "1 Large Half Cheese / Half Pepperoni + 1 Caesar Salad + Garlic Knots.",
    pinned: false,
  },
];

export default function FamilyMemoryRoute() {
  const { colors, accentColor } = useTheme();
  const toast = useToast();
  const pathname = usePathname();
  const router = useRouter();
  const { role: capabilityRole, hydrated } = useAuth();
  const isParent = capabilityRole === "parent";
  const [moreOpen, setMoreOpen] = useState(false);

  const [items, setItems] = useState<MemoryItem[]>(DEFAULT_MEMORY_ITEMS);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);

  const [draftTitle, setDraftTitle] = useState("");
  const [draftCategory, setDraftCategory] = useState("Home & School");
  const [draftDetail, setDraftDetail] = useState("");

  const navRole = capabilityRole === "parent" ? "parent" : capabilityRole ? "child" : "guest";

  useEffect(() => {
    let alive = true;
    void AsyncStorage.getItem(MEMORY_STORAGE_KEY)
      .then((raw) => {
        if (!alive || !raw) return;
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) setItems(parsed);
        } catch {
          // ignore
        }
      })
      .catch(() => {});
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

  const pinnedCount = useMemo(() => items.filter((m) => Boolean(m.pinned)).length, [items]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const result = items.filter((m) => {
      if (pinnedOnly && !m.pinned) return false;
      if (selectedCategory !== "All" && m.category !== selectedCategory) return false;
      if (q && !m.title.toLowerCase().includes(q) && !m.detail.toLowerCase().includes(q)) return false;
      return true;
    });
    return [...result].sort((a, b) => {
      const aPin = a.pinned ? 1 : 0;
      const bPin = b.pinned ? 1 : 0;
      return bPin - aPin;
    });
  }, [items, pinnedOnly, selectedCategory, searchQuery]);

  const handleAddMemory = useCallback(async () => {
    if (!draftTitle.trim()) return;
    const emojiMap: Record<string, string> = {
      "Medical & Allergies": "🩺",
      "Sizes & Gear": "👕",
      "Home & School": "🏠",
      Favorites: "🍕",
    };
    const matchedTpl = STARTER_TEMPLATES.find((t) => t.title === draftTitle.trim());
    const entry: MemoryItem = {
      id: `mem-${Date.now()}`,
      title: draftTitle.trim(),
      category: draftCategory,
      emoji: matchedTpl?.emoji ?? emojiMap[draftCategory] ?? "📌",
      detail: draftDetail.trim() || "Saved in Family Memory.",
      pinned: false,
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

  const handleTogglePin = useCallback(
    async (id: string) => {
      const next = items.map((m) => (m.id === id ? { ...m, pinned: !m.pinned } : m));
      await persistItems(next);
      const target = next.find((m) => m.id === id);
      toast.show(target?.pinned ? `Pinned "${target.title}" to VIP list` : `Unpinned "${target?.title ?? "card"}"`, {
        intent: "info",
      });
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
              style={{ minHeight: MIN_TARGET_DP, minWidth: MIN_TARGET_DP }}
              onPress={() => setComposerOpen(true)}
            >
              + Add Memory
            </SoftButton>
          </View>

          {/* 🚨 Babysitter & Emergency Quick-Sheet Banner */}
          <Material
            tier="regular"
            testID="memory-emergency-banner"
            style={{
              borderRadius: RADII.xl,
              padding: SPACING.md,
              gap: SPACING.sm,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: SPACING.sm }}>
              <View style={{ flex: 1, minWidth: 200, gap: 4 }}>
                <Text
                  style={{
                    color: colors["color-text-primary"],
                    fontSize: TYPOGRAPHY.cardTitle.fontSize,
                    fontWeight: "700",
                  }}
                >
                  🚨 Babysitter & Emergency Quick-Sheet
                </Text>
                <Text
                  testID="memory-pinned-count"
                  style={{
                    color: colors["color-text-secondary"],
                    fontSize: TYPOGRAPHY.label.fontSize,
                    lineHeight: TYPOGRAPHY.label.lineHeight,
                  }}
                >
                  {`${pinnedCount} Pinned VIP cards ready for sitters, grandparents & guests`}
                </Text>
              </View>
              <Pressable
                testID="memory-pinned-toggle"
                accessibilityRole="button"
                accessibilityLabel={pinnedOnly ? "Showing Pinned Only" : "Filter Pinned VIP"}
                onPress={() => setPinnedOnly((prev) => !prev)}
                style={{
                  minHeight: MIN_TARGET_DP,
                  minWidth: MIN_TARGET_DP,
                  paddingHorizontal: SPACING.md,
                  borderRadius: RADII.pill,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: pinnedOnly ? accentColor : colors["color-surface-2"],
                  borderWidth: 1,
                  borderColor: pinnedOnly ? accentColor : colors["color-border-subtle"],
                }}
              >
                <Text
                  style={{
                    color: pinnedOnly ? colors["color-primary-foreground"] : colors["color-text-primary"],
                    fontSize: TYPOGRAPHY.label.fontSize,
                    fontWeight: "700",
                  }}
                >
                  {pinnedOnly ? "📌 Showing Pinned Only" : "📌 Filter Pinned VIP"}
                </Text>
              </Pressable>
            </View>
          </Material>

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
                    minWidth: MIN_TARGET_DP,
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
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SPACING.sm, flexWrap: "wrap" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: SPACING.sm, flex: 1, minWidth: 200 }}>
                      <Text style={{ fontSize: 28 }}>{item.emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: SPACING.xs }}>
                          <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.cardTitle.fontSize, fontWeight: "700" }}>
                            {item.title}
                          </Text>
                          {item.pinned ? (
                            <Text style={{ fontSize: 16 }}>📌</Text>
                          ) : null}
                        </View>
                        <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }}>
                          {item.category}
                        </Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: SPACING.xs }}>
                      <Pressable
                        testID={`memory-pin-${item.id}`}
                        accessibilityRole="button"
                        accessibilityLabel={item.pinned ? `Unpin ${item.title}` : `Pin ${item.title}`}
                        onPress={() => void handleTogglePin(item.id)}
                        style={{
                          minHeight: MIN_TARGET_DP,
                          minWidth: MIN_TARGET_DP,
                          paddingHorizontal: SPACING.md,
                          borderRadius: RADII.pill,
                          alignItems: "center",
                          justifyContent: "center",
                          borderWidth: 1,
                          borderColor: item.pinned ? accentColor : colors["color-border-subtle"],
                          backgroundColor: item.pinned ? mix(accentColor, "transparent", 20) : colors["color-surface-2"],
                        }}
                      >
                        <Text
                          style={{
                            color: item.pinned ? colors["color-text-primary"] : colors["color-text-secondary"],
                            fontSize: TYPOGRAPHY.label.fontSize,
                            fontWeight: item.pinned ? "700" : "600",
                          }}
                        >
                          {item.pinned ? "📌 Pinned" : "📍 Pin"}
                        </Text>
                      </Pressable>
                      {isParent ? (
                        <SoftButton
                          variant="ghost"
                          size="sm"
                          testID={`memory-delete-${item.id}`}
                          accessibilityLabel={`Remove ${item.title}`}
                          style={{ minHeight: MIN_TARGET_DP, minWidth: MIN_TARGET_DP }}
                          onPress={() => void handleDeleteMemory(item.id)}
                        >
                          Remove
                        </SoftButton>
                      ) : null}
                    </View>
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
          {/* Quick Starter Templates */}
          <View style={{ gap: SPACING.xs }}>
            <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
              Quick Templates
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACING.xs }}>
              {STARTER_TEMPLATES.map((tpl) => (
                <Pressable
                  key={tpl.id}
                  testID={`memory-tpl-${tpl.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Template: ${tpl.title}`}
                  onPress={() => {
                    setDraftTitle(tpl.title);
                    setDraftCategory(tpl.category);
                    setDraftDetail(tpl.detail);
                  }}
                  style={{
                    minHeight: MIN_TARGET_DP,
                    minWidth: MIN_TARGET_DP,
                    paddingHorizontal: SPACING.md,
                    paddingVertical: SPACING.xs,
                    borderRadius: RADII.lg,
                    borderWidth: 1,
                    borderColor: colors["color-border-subtle"],
                    backgroundColor: colors["color-surface-2"],
                    flexDirection: "row",
                    alignItems: "center",
                    gap: SPACING.xs,
                  }}
                >
                  <Text style={{ fontSize: 22 }}>{tpl.emoji}</Text>
                  <View style={{ gap: 2 }}>
                    <Text
                      style={{
                        color: colors["color-text-primary"],
                        fontSize: TYPOGRAPHY.label.fontSize,
                        fontWeight: "700",
                      }}
                    >
                      {tpl.title}
                    </Text>
                    <Text
                      style={{
                        color: colors["color-text-muted"],
                        fontSize: TYPOGRAPHY.label.fontSize,
                      }}
                    >
                      {tpl.category}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>

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
                      minWidth: MIN_TARGET_DP,
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
            <SoftButton
              variant="ghost"
              style={{ minHeight: MIN_TARGET_DP, minWidth: MIN_TARGET_DP }}
              onPress={() => setComposerOpen(false)}
            >
              Cancel
            </SoftButton>
            <SoftButton
              variant="primary"
              testID="memory-composer-save"
              style={{ minHeight: MIN_TARGET_DP, minWidth: MIN_TARGET_DP }}
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
          router.replace(p as never);
        }}
      />
      <MoreSheet
        visible={moreOpen}
        onClose={() => setMoreOpen(false)}
        role={navRole}
        onNavigate={(p) => {
          router.replace(p as never);
        }}
      />
    </Screen>
  );
}
