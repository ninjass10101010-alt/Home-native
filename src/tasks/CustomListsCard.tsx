import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../theme/ThemeProvider";
import { ACCENTS, MIN_TARGET_DP, RADII, TYPOGRAPHY } from "../theme/tokens";
import { mix } from "../theme/mix";
import { Material } from "../theme/Material";
import { Modal } from "../ui/Modal";
import { SoftButton } from "../ui/SoftButton";
import {
  type ChecklistTone,
  type CustomChecklist,
  useCustomChecklists,
} from "./custom-lists";

export interface CustomListsCardProps {
  isParent?: boolean;
  canInteract?: boolean;
  memberName?: string;
}

const TONES: ChecklistTone[] = ["cyan", "mint", "amber", "lavender", "coral"];
const PRESET_EMOJIS = ["🎒", "⚽", "🏕️", "🏖️", "✈️", "🎨", "🚲", "🧳", "🧺", "📋"];

export function CustomListsCard({
  isParent = false,
  canInteract,
  memberName,
}: CustomListsCardProps) {
  const { colors, theme } = useTheme();
  const canAct = canInteract ?? Boolean(memberName || isParent);

  const {
    lists,
    toggleItem,
    resetChecks,
    addItem,
    deleteItem,
    createList,
    deleteList,
  } = useCustomChecklists();

  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newItemText, setNewItemText] = useState("");

  // Create modal state
  const [newTitle, setNewTitle] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState("🎒");
  const [selectedTone, setSelectedTone] = useState<ChecklistTone>("cyan");

  const activeList: CustomChecklist | null = useMemo(() => {
    if (!lists || lists.length === 0) return null;
    if (selectedListId) {
      const match = lists.find((l) => l.id === selectedListId);
      if (match) return match;
    }
    return lists[0];
  }, [lists, selectedListId]);

  const toneHex = useMemo(() => {
    const tone = activeList?.tone ?? "cyan";
    const themeKey = theme === "light" ? "light" : "dark";
    return ACCENTS[themeKey][tone] ?? colors["color-accent-cyan"] ?? colors["color-accent"];
  }, [activeList?.tone, theme, colors]);

  const checkedCount = activeList?.items.filter((i) => i.checked).length ?? 0;
  const totalCount = activeList?.items.length ?? 0;
  const progressPct = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;
  const isAllPacked = totalCount > 0 && checkedCount === totalCount;
  const statusSummary =
    totalCount === 0
      ? "No items yet"
      : isAllPacked
      ? "All packed! 🎉"
      : `${checkedCount} of ${totalCount} packed`;

  const handleAddItem = async () => {
    const trimmed = newItemText.trim();
    if (!trimmed || !activeList) return;
    await addItem(activeList.id, trimmed);
    setNewItemText("");
  };

  const handleCreateList = async () => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    const created = await createList({
      title: trimmed,
      emoji: selectedEmoji,
      tone: selectedTone,
    });
    setSelectedListId(created.id);
    setNewTitle("");
    setCreateModalOpen(false);
  };

  return (
    <Material
      tier="regular"
      testID="custom-lists-card"
      style={{
        borderRadius: RADII.xl,
        borderColor: mix(toneHex, "transparent", theme === "dark" ? 35 : 14),
        overflow: "hidden",
      }}
    >
      <LinearGradient
        colors={[
          mix(toneHex, "transparent", theme === "dark" ? 14 : 3),
          mix(toneHex, "transparent", theme === "dark" ? 4 : 1),
        ]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <View style={{ paddingHorizontal: 20, paddingVertical: 20, gap: 16 }}>
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            paddingBottom: 14,
            borderBottomWidth: 1,
            borderBottomColor: colors["color-border"] ?? mix(toneHex, "transparent", 20),
          }}
        >
          <View style={{ flex: 1, minWidth: 200 }}>
            <Text
              style={{
                color: colors["color-text-primary"],
                fontSize: TYPOGRAPHY.title.fontSize,
                fontWeight: "700",
              }}
            >
              📋 Reusable Family Checklists
            </Text>
            <Text
              style={{
                color: colors["color-text-secondary"],
                fontSize: TYPOGRAPHY.label.fontSize,
                marginTop: 2,
              }}
            >
              Packing lists, school bags, and prep lists
            </Text>
          </View>

          {isParent ? (
            <SoftButton
              variant="secondary"
              size="sm"
              testID="custom-list-new-open"
              onPress={() => setCreateModalOpen(true)}
              style={{ minHeight: MIN_TARGET_DP, minWidth: MIN_TARGET_DP }}
            >
              + New List
            </SoftButton>
          ) : null}
        </View>

        {/* Empty State when no lists exist */}
        {lists.length === 0 ? (
          <View
            style={{
              paddingVertical: 28,
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <Text style={{ fontSize: 32 }}>📋</Text>
            <Text
              style={{
                color: colors["color-text-primary"],
                fontSize: TYPOGRAPHY.body.fontSize,
                fontWeight: "600",
              }}
            >
              No checklists yet
            </Text>
            <Text
              style={{
                color: colors["color-text-secondary"],
                fontSize: TYPOGRAPHY.label.fontSize,
                textAlign: "center",
              }}
            >
              Create reusable packing lists, school bags, and prep routines.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 16 }}>
            {/* Horizontal selector tabs */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, paddingVertical: 4 }}
            >
              {lists.map((list) => {
                const isActive = activeList?.id === list.id;
                const themeKey = theme === "light" ? "light" : "dark";
                const listToneHex =
                  ACCENTS[themeKey][list.tone] ?? colors["color-accent-cyan"] ?? colors["color-accent"];
                const listChecked = list.items.filter((i) => i.checked).length;

                return (
                  <Pressable
                    key={list.id}
                    testID={`custom-list-tab-${list.id}`}
                    onPress={() => setSelectedListId(list.id)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: isActive }}
                    accessibilityLabel={`${list.title}, ${listChecked} of ${list.items.length} items`}
                    style={{
                      minHeight: MIN_TARGET_DP,
                      minWidth: MIN_TARGET_DP,
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: RADII.lg,
                      alignItems: "center",
                      justifyContent: "center",
                      flexDirection: "row",
                      gap: 8,
                      backgroundColor: isActive
                        ? mix(listToneHex, colors["color-surface-2"], theme === "light" ? 25 : 35)
                        : colors["color-surface-1"],
                      borderWidth: 1,
                      borderColor: isActive ? listToneHex : colors["color-border"],
                    }}
                  >
                    <Text style={{ fontSize: TYPOGRAPHY.body.fontSize }}>{list.emoji}</Text>
                    <Text
                      style={{
                        fontSize: TYPOGRAPHY.body.fontSize,
                        fontWeight: isActive ? "700" : "500",
                        color: isActive ? colors["color-text-primary"] : colors["color-text-secondary"],
                      }}
                    >
                      {list.title}
                    </Text>
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: RADII.full,
                        backgroundColor: isActive
                          ? mix(listToneHex, "transparent", 30)
                          : colors["color-surface-2"],
                      }}
                    >
                      <Text
                        style={{
                          fontSize: TYPOGRAPHY.label.fontSize,
                          fontWeight: "700",
                          color: isActive ? colors["color-text-primary"] : colors["color-text-secondary"],
                        }}
                      >
                        {listChecked}/{list.items.length}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Active Checklist Card */}
            {activeList ? (
              <View
                style={{
                  borderRadius: RADII.lg,
                  backgroundColor: colors["color-surface-1"],
                  borderWidth: 1,
                  borderColor: mix(toneHex, "transparent", 30),
                  padding: 16,
                  gap: 16,
                }}
              >
                {/* Progress bar + status summary */}
                <View style={{ gap: 8 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Text
                      testID="custom-list-progress"
                      style={{
                        color: colors["color-text-primary"],
                        fontSize: TYPOGRAPHY.body.fontSize,
                        fontWeight: "700",
                      }}
                    >
                      {statusSummary}
                    </Text>
                    <Text
                      style={{
                        color: colors["color-text-secondary"],
                        fontSize: TYPOGRAPHY.label.fontSize,
                        fontWeight: "600",
                      }}
                    >
                      {totalCount > 0 ? `${progressPct}%` : "0%"}
                    </Text>
                  </View>
                  <View
                    style={{
                      height: 10,
                      borderRadius: RADII.full,
                      backgroundColor: colors["color-surface-2"],
                      overflow: "hidden",
                    }}
                  >
                    <View
                      style={{
                        height: "100%",
                        width: `${progressPct}%`,
                        backgroundColor: toneHex,
                        borderRadius: RADII.full,
                      }}
                    />
                  </View>
                </View>

                {/* Action Bar */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 12,
                  }}
                >
                  <SoftButton
                    variant="secondary"
                    size="sm"
                    testID="custom-list-reset"
                    accessibilityLabel="Reset Checks"
                    onPress={() => {
                      if (canAct) {
                        void resetChecks(activeList.id);
                      }
                    }}
                    style={{ minHeight: MIN_TARGET_DP, minWidth: MIN_TARGET_DP }}
                  >
                    ↺ Reset Checks
                  </SoftButton>

                  {isParent ? (
                    <SoftButton
                      variant="ghost"
                      size="sm"
                      testID={`custom-list-delete-${activeList.id}`}
                      accessibilityLabel="Delete List"
                      onPress={() => {
                        void deleteList(activeList.id);
                      }}
                      style={{ minHeight: MIN_TARGET_DP, minWidth: MIN_TARGET_DP }}
                    >
                      Delete List
                    </SoftButton>
                  ) : null}
                </View>

                {/* Items list */}
                <View style={{ gap: 8 }}>
                  {activeList.items.length === 0 ? (
                    <Text
                      style={{
                        color: colors["color-text-secondary"],
                        fontSize: TYPOGRAPHY.label.fontSize,
                        fontStyle: "italic",
                        paddingVertical: 12,
                        textAlign: "center",
                      }}
                    >
                      No items yet. Add one below!
                    </Text>
                  ) : (
                    activeList.items.map((item) => (
                      <View
                        key={item.id}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          minHeight: MIN_TARGET_DP,
                          borderRadius: RADII.lg,
                          backgroundColor: item.checked
                            ? mix(colors["color-surface-2"], "transparent", 40)
                            : colors["color-surface-2"],
                          borderWidth: 1,
                          borderColor: item.checked
                            ? mix(colors["color-border"], "transparent", 30)
                            : colors["color-border"],
                          overflow: "hidden",
                        }}
                      >
                        <Pressable
                          testID={`custom-list-item-${item.id}`}
                          onPress={() => {
                            if (canAct) {
                              void toggleItem(activeList.id, item.id);
                            }
                          }}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: item.checked }}
                          accessibilityLabel={`${item.label}, ${item.checked ? "checked" : "not checked"}`}
                          style={{
                            flex: 1,
                            flexDirection: "row",
                            alignItems: "center",
                            minHeight: MIN_TARGET_DP,
                            minWidth: MIN_TARGET_DP,
                            paddingHorizontal: 16,
                            gap: 12,
                          }}
                        >
                          <View
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 8,
                              borderWidth: 2,
                              borderColor: item.checked ? toneHex : colors["color-border"],
                              backgroundColor: item.checked ? toneHex : "transparent",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {item.checked ? (
                              <Text
                                style={{
                                  color: colors["color-primary-foreground"] ?? colors["color-surface-1"],
                                  fontSize: TYPOGRAPHY.body.fontSize,
                                  fontWeight: "700",
                                }}
                              >
                                ✓
                              </Text>
                            ) : null}
                          </View>
                          <Text
                            style={{
                              flex: 1,
                              color: item.checked
                                ? colors["color-text-secondary"]
                                : colors["color-text-primary"],
                              fontSize: TYPOGRAPHY.body.fontSize,
                              fontWeight: item.checked ? "400" : "600",
                              textDecorationLine: item.checked ? "line-through" : "none",
                            }}
                          >
                            {item.label}
                          </Text>
                        </Pressable>

                        {isParent ? (
                          <Pressable
                            testID={`custom-list-item-remove-${item.id}`}
                            accessibilityRole="button"
                            accessibilityLabel={`Remove ${item.label}`}
                            onPress={() => {
                              void deleteItem(activeList.id, item.id);
                            }}
                            style={{
                              minWidth: MIN_TARGET_DP,
                              minHeight: MIN_TARGET_DP,
                              alignItems: "center",
                              justifyContent: "center",
                              paddingHorizontal: 12,
                            }}
                          >
                            <Text
                              style={{
                                color: colors["color-text-secondary"],
                                fontSize: TYPOGRAPHY.body.fontSize,
                                fontWeight: "700",
                              }}
                            >
                              ✕
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                    ))
                  )}
                </View>

                {/* Inline add-item row */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    marginTop: 4,
                  }}
                >
                  <TextInput
                    testID="custom-list-item-input"
                    placeholder="Add an item…"
                    placeholderTextColor={colors["color-text-secondary"]}
                    value={newItemText}
                    onChangeText={setNewItemText}
                    onSubmitEditing={() => void handleAddItem()}
                    style={{
                      flex: 1,
                      minHeight: MIN_TARGET_DP,
                      fontSize: TYPOGRAPHY.body.fontSize,
                      color: colors["color-text-primary"],
                      backgroundColor: colors["color-surface-2"],
                      borderRadius: RADII.lg,
                      paddingHorizontal: 16,
                      borderWidth: 1,
                      borderColor: colors["color-border"],
                    }}
                  />
                  <SoftButton
                    variant="secondary"
                    size="sm"
                    testID="custom-list-item-add"
                    accessibilityLabel="Add item"
                    onPress={() => void handleAddItem()}
                    style={{ minHeight: MIN_TARGET_DP, minWidth: MIN_TARGET_DP }}
                  >
                    Add +
                  </SoftButton>
                </View>
              </View>
            ) : null}
          </View>
        )}
      </View>

      {/* Modal for creating a new custom checklist */}
      <Modal
        visible={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create New Checklist"
        testID="custom-list-create-modal"
      >
        <View style={{ gap: 16 }}>
          <View style={{ gap: 8 }}>
            <Text
              style={{
                color: colors["color-text-secondary"],
                fontSize: TYPOGRAPHY.label.fontSize,
                fontWeight: "600",
              }}
            >
              List Title
            </Text>
            <TextInput
              testID="custom-list-title-input"
              placeholder="List title (e.g. Beach Trip)"
              placeholderTextColor={colors["color-text-secondary"]}
              value={newTitle}
              onChangeText={setNewTitle}
              style={{
                minHeight: MIN_TARGET_DP,
                fontSize: TYPOGRAPHY.body.fontSize,
                color: colors["color-text-primary"],
                backgroundColor: colors["color-surface-2"],
                borderRadius: RADII.lg,
                paddingHorizontal: 16,
                borderWidth: 1,
                borderColor: colors["color-border"],
              }}
            />
          </View>

          {/* Emoji Picker */}
          <View style={{ gap: 8 }}>
            <Text
              style={{
                color: colors["color-text-secondary"],
                fontSize: TYPOGRAPHY.label.fontSize,
                fontWeight: "600",
              }}
            >
              Choose Icon
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, paddingVertical: 4 }}
            >
              {PRESET_EMOJIS.map((emoji) => {
                const isSelected = selectedEmoji === emoji;
                return (
                  <Pressable
                    key={emoji}
                    testID={`custom-list-emoji-${emoji}`}
                    onPress={() => setSelectedEmoji(emoji)}
                    accessibilityLabel={`Emoji ${emoji}`}
                    style={{
                      minHeight: MIN_TARGET_DP,
                      minWidth: MIN_TARGET_DP,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: RADII.lg,
                      borderWidth: 1,
                      borderColor: isSelected ? toneHex : colors["color-border"],
                      backgroundColor: isSelected
                        ? mix(toneHex, "transparent", 30)
                        : colors["color-surface-2"],
                    }}
                  >
                    <Text style={{ fontSize: 24 }}>{emoji}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Tone Picker */}
          <View style={{ gap: 8 }}>
            <Text
              style={{
                color: colors["color-text-secondary"],
                fontSize: TYPOGRAPHY.label.fontSize,
                fontWeight: "600",
              }}
            >
              Accent Color
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {TONES.map((tone) => {
                const isSelected = selectedTone === tone;
                const themeKey = theme === "light" ? "light" : "dark";
                const tHex =
                  ACCENTS[themeKey][tone] ?? colors["color-accent-cyan"] ?? colors["color-accent"];
                return (
                  <Pressable
                    key={tone}
                    testID={`custom-list-tone-${tone}`}
                    onPress={() => setSelectedTone(tone)}
                    accessibilityLabel={`Tone ${tone}`}
                    style={{
                      minHeight: MIN_TARGET_DP,
                      minWidth: MIN_TARGET_DP,
                      paddingHorizontal: 16,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: RADII.lg,
                      borderWidth: 1,
                      borderColor: isSelected ? tHex : colors["color-border"],
                      backgroundColor: isSelected
                        ? mix(tHex, "transparent", 30)
                        : colors["color-surface-2"],
                    }}
                  >
                    <Text
                      style={{
                        color: colors["color-text-primary"],
                        fontSize: TYPOGRAPHY.label.fontSize,
                        fontWeight: "700",
                        textTransform: "capitalize",
                      }}
                    >
                      {tone}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Save Button */}
          <SoftButton
            variant="primary"
            size="md"
            testID="custom-list-create-save"
            accessibilityLabel="Create List"
            disabled={!newTitle.trim()}
            onPress={() => void handleCreateList()}
            style={{ minHeight: MIN_TARGET_DP, minWidth: MIN_TARGET_DP, width: "100%", marginTop: 8 }}
          >
            Create List
          </SoftButton>
        </View>
      </Modal>
    </Material>
  );
}
