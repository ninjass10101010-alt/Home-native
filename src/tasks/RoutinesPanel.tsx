import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { Material } from "../theme/Material";
import { MIN_TARGET_DP, RADII, SPACING, TYPOGRAPHY } from "../theme/tokens";
import { mix } from "../theme/mix";
import { Modal } from "../ui/Modal";
import { SoftButton } from "../ui/SoftButton";
import { TextField } from "../ui/TextField";
import { EmptyState } from "../ui/EmptyState";
import { useToast } from "../ui/Toast";
import { localTodayISO } from "../home/widgets/data";
import {
  DEFAULT_ROUTINES,
  loadRoutineProgress,
  loadRoutines,
  ROUTINE_SLOT_META,
  saveRoutineProgress,
  saveRoutines,
  type DailyRoutineProgress,
  type FamilyRoutine,
  type RoutineSlot,
} from "./routines-api";

const SLOTS: RoutineSlot[] = ["morning", "afternoon", "evening", "weekend"];
const POINT_OPTIONS = [10, 15, 20, 30];

export interface RoutinesPanelProps {
  activeMemberFilter?: string;
  rosterNames?: string[];
  isParent?: boolean;
}

export function RoutinesPanel({
  activeMemberFilter = "All",
  rosterNames = [],
  isParent = false,
}: RoutinesPanelProps) {
  const { colors, accentColor } = useTheme();
  const toast = useToast();
  const todayISO = useMemo(() => localTodayISO(), []);

  const [routines, setRoutines] = useState<FamilyRoutine[]>(DEFAULT_ROUTINES);
  const [progress, setProgress] = useState<DailyRoutineProgress>({
    checkedSteps: {},
    completedRoutines: {},
  });
  const [slotFilter, setSlotFilter] = useState<"all" | RoutineSlot>("all");

  // Composer modal state
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<FamilyRoutine | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftEmoji, setDraftEmoji] = useState("☀️");
  const [draftSlot, setDraftSlot] = useState<RoutineSlot>("morning");
  const [draftTime, setDraftTime] = useState("07:30");
  const [draftAssignee, setDraftAssignee] = useState("All");
  const [draftPoints, setDraftPoints] = useState<number>(15);
  const [draftStepsText, setDraftStepsText] = useState("");

  useEffect(() => {
    let alive = true;
    void Promise.all([loadRoutines(), loadRoutineProgress(todayISO)]).then(([loadedRoutines, loadedProg]) => {
      if (!alive) return;
      setRoutines(loadedRoutines);
      setProgress(loadedProg);
    });
    return () => {
      alive = false;
    };
  }, [todayISO]);

  const filteredRoutines = useMemo(() => {
    return routines.filter((r) => {
      if (slotFilter !== "all" && r.slot !== slotFilter) return false;
      if (
        activeMemberFilter &&
        activeMemberFilter !== "All" &&
        activeMemberFilter !== "Open" &&
        activeMemberFilter !== "My Tasks" &&
        r.assignee !== "All" &&
        r.assignee.toLowerCase() !== activeMemberFilter.toLowerCase()
      ) {
        return false;
      }
      return true;
    });
  }, [routines, slotFilter, activeMemberFilter]);

  const toggleStep = useCallback(
    async (routine: FamilyRoutine, stepId: string) => {
      const current = progress.checkedSteps[routine.id] ?? [];
      const exists = current.includes(stepId);
      const nextSteps = exists ? current.filter((id) => id !== stepId) : [...current, stepId];
      const allDone = routine.steps.length > 0 && nextSteps.length >= routine.steps.length;
      const nextProgress: DailyRoutineProgress = {
        checkedSteps: {
          ...progress.checkedSteps,
          [routine.id]: nextSteps,
        },
        completedRoutines: {
          ...progress.completedRoutines,
          [routine.id]: allDone,
        },
      };
      setProgress(nextProgress);
      await saveRoutineProgress(todayISO, nextProgress);
      if (allDone && !progress.completedRoutines[routine.id]) {
        toast.show(`🎉 ${routine.title} complete! +${routine.points} routine pts`, { intent: "success" });
      }
    },
    [progress, todayISO, toast],
  );

  const checkAllSteps = useCallback(
    async (routine: FamilyRoutine) => {
      const allIds = routine.steps.map((s) => s.id);
      const alreadyDone = !!progress.completedRoutines[routine.id];
      const nextProgress: DailyRoutineProgress = {
        checkedSteps: {
          ...progress.checkedSteps,
          [routine.id]: alreadyDone ? [] : allIds,
        },
        completedRoutines: {
          ...progress.completedRoutines,
          [routine.id]: !alreadyDone,
        },
      };
      setProgress(nextProgress);
      await saveRoutineProgress(todayISO, nextProgress);
      if (!alreadyDone) {
        toast.show(`🎉 ${routine.title} complete! +${routine.points} routine pts`, { intent: "success" });
      } else {
        toast.show(`Reset ${routine.title} for today`, { intent: "info" });
      }
    },
    [progress, todayISO, toast],
  );

  const openNewComposer = useCallback(() => {
    setEditingRoutine(null);
    setDraftTitle("");
    setDraftEmoji("☀️");
    setDraftSlot("morning");
    setDraftTime("07:30");
    setDraftAssignee("All");
    setDraftPoints(15);
    setDraftStepsText("Brush teeth, Make bed, Get dressed");
    setComposerOpen(true);
  }, []);

  const openEditComposer = useCallback((r: FamilyRoutine) => {
    setEditingRoutine(r);
    setDraftTitle(r.title);
    setDraftEmoji(r.emoji);
    setDraftSlot(r.slot);
    setDraftTime(r.time);
    setDraftAssignee(r.assignee);
    setDraftPoints(r.points);
    setDraftStepsText(r.steps.map((s) => s.title).join(", "));
    setComposerOpen(true);
  }, []);

  const handleSaveRoutine = useCallback(async () => {
    if (!draftTitle.trim()) return;
    const rawSteps = draftStepsText
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const steps =
      rawSteps.length > 0
        ? rawSteps.map((title, idx) => ({
            id: `s-${idx + 1}`,
            title,
            emoji: "✨",
          }))
        : [{ id: "s-1", title: "Complete routine", emoji: "✨" }];

    const entry: FamilyRoutine = {
      id: editingRoutine ? editingRoutine.id : `rt-${Date.now()}`,
      title: draftTitle.trim(),
      emoji: draftEmoji || ROUTINE_SLOT_META[draftSlot].emoji,
      slot: draftSlot,
      time: draftTime.trim() || ROUTINE_SLOT_META[draftSlot].timeDefault,
      assignee: draftAssignee || "All",
      points: draftPoints,
      steps,
    };

    const next = editingRoutine
      ? routines.map((item) => (item.id === editingRoutine.id ? entry : item))
      : [...routines, entry];
    setRoutines(next);
    await saveRoutines(next);
    setComposerOpen(false);
    toast.show(editingRoutine ? `Updated "${entry.title}"` : `Added "${entry.title}"`, {
      intent: "success",
    });
  }, [
    draftTitle,
    draftStepsText,
    editingRoutine,
    draftEmoji,
    draftSlot,
    draftTime,
    draftAssignee,
    draftPoints,
    routines,
    toast,
  ]);

  const handleDeleteRoutine = useCallback(
    async (id: string) => {
      const next = routines.filter((r) => r.id !== id);
      setRoutines(next);
      await saveRoutines(next);
      setComposerOpen(false);
      toast.show("Routine removed", { intent: "info" });
    },
    [routines, toast],
  );

  const completedTodayCount = useMemo(
    () => routines.filter((r) => progress.completedRoutines[r.id]).length,
    [routines, progress.completedRoutines],
  );

  return (
    <View testID="tasks-routines-panel" style={{ gap: SPACING.md }}>
      {/* Summary & Action Header */}
      <Material
        tier="regular"
        style={{
          borderRadius: RADII.xl,
          padding: SPACING.md,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: SPACING.md,
        }}
      >
        <View style={{ flex: 1, gap: 4 }}>
          <Text
            style={{
              color: colors["color-text-primary"],
              fontSize: TYPOGRAPHY.cardTitle.fontSize,
              fontWeight: "700",
            }}
          >
            ⏰ Daily Family Routines
          </Text>
          <Text
            style={{
              color: colors["color-text-secondary"],
              fontSize: TYPOGRAPHY.body.fontSize,
            }}
          >
            {`${completedTodayCount} of ${routines.length} routines finished today · tap each step as you go`}
          </Text>
        </View>
        <SoftButton
          variant="primary"
          size="sm"
          testID="routines-add-button"
          accessibilityLabel="Add new family routine"
          onPress={openNewComposer}
        >
          + Add Routine
        </SoftButton>
      </Material>

      {/* Time-of-day filter strip */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: SPACING.xs }}
      >
        <Pressable
          testID="routine-filter-all"
          accessibilityRole="button"
          accessibilityLabel="Show all routines"
          accessibilityState={{ selected: slotFilter === "all" }}
          onPress={() => setSlotFilter("all")}
          style={{
            minHeight: MIN_TARGET_DP,
            paddingHorizontal: SPACING.md,
            borderRadius: RADII.pill,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: slotFilter === "all" ? accentColor : colors["color-border-subtle"],
            backgroundColor:
              slotFilter === "all" ? mix(accentColor, "transparent", 20) : colors["color-surface-1"],
          }}
        >
          <Text
            style={{
              color: colors["color-text-primary"],
              fontSize: TYPOGRAPHY.label.fontSize,
              fontWeight: slotFilter === "all" ? "700" : "600",
            }}
          >
            All Routines ({routines.length})
          </Text>
        </Pressable>

        {SLOTS.map((slot) => {
          const meta = ROUTINE_SLOT_META[slot];
          const active = slotFilter === slot;
          return (
            <Pressable
              key={slot}
              testID={`routine-filter-${slot}`}
              accessibilityRole="button"
              accessibilityLabel={`Filter by ${meta.label} routines`}
              accessibilityState={{ selected: active }}
              onPress={() => setSlotFilter(slot)}
              style={{
                minHeight: MIN_TARGET_DP,
                paddingHorizontal: SPACING.md,
                borderRadius: RADII.pill,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: active ? accentColor : colors["color-border-subtle"],
                backgroundColor: active
                  ? mix(accentColor, "transparent", 20)
                  : colors["color-surface-1"],
              }}
            >
              <Text
                style={{
                  color: colors["color-text-primary"],
                  fontSize: TYPOGRAPHY.label.fontSize,
                  fontWeight: active ? "700" : "600",
                }}
              >
                {meta.emoji} {meta.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Routine Cards */}
      {filteredRoutines.length === 0 ? (
        <EmptyState
          icon="⏰"
          title="No routines in this view"
          body="Switch the time-of-day filter or tap + Add Routine to create one."
        />
      ) : (
        <View style={{ gap: SPACING.md }}>
          {filteredRoutines.map((routine) => {
            const meta = ROUTINE_SLOT_META[routine.slot] ?? ROUTINE_SLOT_META.morning;
            const toneColor = colors[meta.toneKey] ?? accentColor;
            const checkedIds = progress.checkedSteps[routine.id] ?? [];
            const doneCount = checkedIds.length;
            const totalCount = routine.steps.length;
            const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
            const isComplete = !!progress.completedRoutines[routine.id];

            return (
              <Material
                key={routine.id}
                tier="thin"
                testID={`routine-card-${routine.id}`}
                style={{
                  borderRadius: RADII.xl,
                  padding: SPACING.md,
                  gap: SPACING.sm,
                  borderWidth: 1,
                  borderColor: isComplete
                    ? mix(colors["color-accent-mint"] ?? accentColor, "transparent", 45)
                    : mix(toneColor, "transparent", 30),
                }}
              >
                {/* Card Header */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: SPACING.sm,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: SPACING.sm, flex: 1 }}>
                    <View
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 16,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: mix(toneColor, "transparent", 20),
                        borderWidth: 1,
                        borderColor: mix(toneColor, "transparent", 40),
                      }}
                    >
                      <Text style={{ fontSize: 24 }}>{routine.emoji}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: colors["color-text-primary"],
                          fontSize: TYPOGRAPHY.cardTitle.fontSize,
                          fontWeight: "700",
                        }}
                      >
                        {routine.title}
                      </Text>
                      <Text
                        style={{
                          color: colors["color-text-secondary"],
                          fontSize: TYPOGRAPHY.label.fontSize,
                        }}
                      >
                        {`${meta.label} · ⏰ ${routine.time} · 👤 ${routine.assignee} · +${routine.points} pts`}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: "row", alignItems: "center", gap: SPACING.xs }}>
                    <SoftButton
                      variant={isComplete ? "success" : "secondary"}
                      size="sm"
                      testID={`routine-complete-all-${routine.id}`}
                      accessibilityLabel={
                        isComplete ? `Reset ${routine.title}` : `Complete all steps in ${routine.title}`
                      }
                      onPress={() => void checkAllSteps(routine)}
                    >
                      {isComplete ? "✓ Completed" : `Finish (+${routine.points})`}
                    </SoftButton>
                    {isParent ? (
                      <SoftButton
                        variant="ghost"
                        size="sm"
                        testID={`routine-edit-${routine.id}`}
                        accessibilityLabel={`Edit ${routine.title}`}
                        onPress={() => openEditComposer(routine)}
                      >
                        ✏️
                      </SoftButton>
                    ) : null}
                  </View>
                </View>

                {/* Progress Bar */}
                <View style={{ gap: 4 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text
                      style={{
                        color: colors["color-text-secondary"],
                        fontSize: TYPOGRAPHY.label.fontSize,
                        fontWeight: "600",
                      }}
                    >
                      {`${doneCount} of ${totalCount} steps done`}
                    </Text>
                    <Text
                      style={{
                        color: colors["color-text-primary"],
                        fontSize: TYPOGRAPHY.label.fontSize,
                        fontWeight: "700",
                      }}
                    >
                      {`${pct}%`}
                    </Text>
                  </View>
                  <View
                    style={{
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: colors["color-surface-2"],
                      overflow: "hidden",
                    }}
                  >
                    <View
                      style={{
                        width: `${pct}%`,
                        height: 8,
                        backgroundColor: isComplete
                          ? colors["color-accent-mint"] ?? accentColor
                          : toneColor,
                      }}
                    />
                  </View>
                </View>

                {/* Step Checklist Rows */}
                <View style={{ gap: SPACING.xs, marginTop: 4 }}>
                  {routine.steps.map((step) => {
                    const checked = checkedIds.includes(step.id);
                    return (
                      <Pressable
                        key={step.id}
                        testID={`routine-step-${routine.id}-${step.id}`}
                        accessibilityRole="checkbox"
                        accessibilityLabel={`${step.title} in ${routine.title}`}
                        accessibilityState={{ checked }}
                        onPress={() => void toggleStep(routine, step.id)}
                        style={{
                          minHeight: MIN_TARGET_DP,
                          paddingHorizontal: SPACING.md,
                          paddingVertical: SPACING.xs,
                          borderRadius: RADII.lg,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          borderWidth: 1,
                          borderColor: checked
                            ? mix(colors["color-accent-mint"] ?? accentColor, "transparent", 40)
                            : colors["color-border-subtle"],
                          backgroundColor: checked
                            ? mix(colors["color-accent-mint"] ?? accentColor, "transparent", 12)
                            : colors["color-surface-1"],
                        }}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: SPACING.sm, flex: 1 }}>
                          <View
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 8,
                              alignItems: "center",
                              justifyContent: "center",
                              borderWidth: 2,
                              borderColor: checked
                                ? colors["color-accent-mint"] ?? accentColor
                                : colors["color-text-muted"],
                              backgroundColor: checked
                                ? colors["color-accent-mint"] ?? accentColor
                                : "transparent",
                            }}
                          >
                            <Text
                              style={{
                                color: colors["color-text-primary"],
                                fontSize: TYPOGRAPHY.label.fontSize,
                                fontWeight: "700",
                              }}
                            >
                              {checked ? "✓" : ""}
                            </Text>
                          </View>
                          <Text style={{ fontSize: 18 }}>{step.emoji}</Text>
                          <Text
                            style={{
                              color: checked
                                ? colors["color-text-secondary"]
                                : colors["color-text-primary"],
                              fontSize: TYPOGRAPHY.body.fontSize,
                              fontWeight: checked ? "500" : "600",
                              textDecorationLine: checked ? "line-through" : "none",
                              flex: 1,
                            }}
                          >
                            {step.title}
                          </Text>
                        </View>
                        <Text
                          style={{
                            color: checked
                              ? colors["color-accent-mint"] ?? accentColor
                              : colors["color-text-muted"],
                            fontSize: TYPOGRAPHY.label.fontSize,
                            fontWeight: "600",
                          }}
                        >
                          {checked ? "Done ✓" : "Tap"}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Material>
            );
          })}
        </View>
      )}

      {/* Routine Composer Modal */}
      <Modal
        visible={composerOpen}
        onClose={() => setComposerOpen(false)}
        title={editingRoutine ? `Edit ${editingRoutine.title}` : "New Family Routine"}
        description="Set a time-of-day checklist for the family wall"
        testID="routine-composer-modal"
      >
        <ScrollView style={{ maxHeight: 580 }} contentContainerStyle={{ gap: SPACING.md }}>
          <TextField
            testID="routine-composer-title"
            label="Routine Name"
            placeholder="e.g. Morning Launchpad"
            value={draftTitle}
            onChangeText={setDraftTitle}
          />

          {/* Time of day slot selector */}
          <View style={{ gap: SPACING.xs }}>
            <Text
              style={{
                color: colors["color-text-secondary"],
                fontSize: TYPOGRAPHY.label.fontSize,
                fontWeight: "700",
              }}
            >
              Time of Day
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACING.xs }}>
              {SLOTS.map((slot) => {
                const meta = ROUTINE_SLOT_META[slot];
                const active = draftSlot === slot;
                return (
                  <Pressable
                    key={slot}
                    testID={`routine-composer-slot-${slot}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${meta.label}`}
                    accessibilityState={{ selected: active }}
                    onPress={() => {
                      setDraftSlot(slot);
                      setDraftEmoji(meta.emoji);
                      setDraftTime(meta.timeDefault);
                    }}
                    style={{
                      minHeight: MIN_TARGET_DP,
                      paddingHorizontal: SPACING.md,
                      borderRadius: RADII.md,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 1,
                      borderColor: active ? accentColor : colors["color-border-subtle"],
                      backgroundColor: active
                        ? mix(accentColor, "transparent", 22)
                        : colors["color-surface-1"],
                    }}
                  >
                    <Text
                      style={{
                        color: colors["color-text-primary"],
                        fontSize: TYPOGRAPHY.label.fontSize,
                        fontWeight: active ? "700" : "500",
                      }}
                    >
                      {meta.emoji} {meta.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: SPACING.sm }}>
            <View style={{ flex: 1 }}>
              <TextField
                testID="routine-composer-time"
                label="Scheduled Time (24h)"
                placeholder="07:30"
                value={draftTime}
                onChangeText={setDraftTime}
              />
            </View>
            <View style={{ flex: 1 }}>
              <TextField
                testID="routine-composer-assignee"
                label="Assigned To"
                placeholder="All or Member Name"
                value={draftAssignee}
                onChangeText={setDraftAssignee}
              />
            </View>
          </View>

          {rosterNames.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACING.xs }}>
              {["All", ...rosterNames].map((name) => {
                const selected = draftAssignee === name;
                return (
                  <Pressable
                    key={name}
                    accessibilityRole="button"
                    accessibilityLabel={`Assign routine to ${name}`}
                    onPress={() => setDraftAssignee(name)}
                    style={{
                      minHeight: MIN_TARGET_DP,
                      paddingHorizontal: SPACING.md,
                      borderRadius: RADII.pill,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 1,
                      borderColor: selected ? accentColor : colors["color-border-subtle"],
                      backgroundColor: selected
                        ? mix(accentColor, "transparent", 20)
                        : colors["color-surface-1"],
                    }}
                  >
                    <Text
                      style={{
                        color: colors["color-text-primary"],
                        fontSize: TYPOGRAPHY.label.fontSize,
                        fontWeight: selected ? "700" : "500",
                      }}
                    >
                      {name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          {/* Points selector */}
          <View style={{ gap: SPACING.xs }}>
            <Text
              style={{
                color: colors["color-text-secondary"],
                fontSize: TYPOGRAPHY.label.fontSize,
                fontWeight: "700",
              }}
            >
              Completion Bonus Points
            </Text>
            <View style={{ flexDirection: "row", gap: SPACING.xs }}>
              {POINT_OPTIONS.map((pts) => {
                const active = draftPoints === pts;
                return (
                  <Pressable
                    key={pts}
                    testID={`routine-composer-pts-${pts}`}
                    accessibilityRole="button"
                    accessibilityLabel={`${pts} points`}
                    onPress={() => setDraftPoints(pts)}
                    style={{
                      minHeight: MIN_TARGET_DP,
                      minWidth: MIN_TARGET_DP,
                      paddingHorizontal: SPACING.md,
                      borderRadius: RADII.pill,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 1,
                      borderColor: active ? accentColor : colors["color-border-subtle"],
                      backgroundColor: active
                        ? mix(accentColor, "transparent", 22)
                        : colors["color-surface-1"],
                    }}
                  >
                    <Text
                      style={{
                        color: colors["color-text-primary"],
                        fontSize: TYPOGRAPHY.label.fontSize,
                        fontWeight: active ? "700" : "500",
                      }}
                    >
                      +{pts} pts
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <TextField
            testID="routine-composer-steps"
            label="Checklist Steps (comma-separated)"
            placeholder="Brush teeth, Make bed, Pack backpack"
            value={draftStepsText}
            onChangeText={setDraftStepsText}
            multiline
          />

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              gap: SPACING.sm,
            }}
          >
            {editingRoutine ? (
              <SoftButton
                variant="danger"
                testID="routine-composer-delete"
                accessibilityLabel="Delete routine"
                onPress={() => void handleDeleteRoutine(editingRoutine.id)}
              >
                Delete
              </SoftButton>
            ) : (
              <View />
            )}
            <View style={{ flexDirection: "row", gap: SPACING.sm }}>
              <SoftButton
                variant="ghost"
                testID="routine-composer-cancel"
                accessibilityLabel="Cancel routine edit"
                onPress={() => setComposerOpen(false)}
              >
                Cancel
              </SoftButton>
              <SoftButton
                variant="primary"
                testID="routine-composer-save"
                accessibilityLabel="Save routine"
                disabled={!draftTitle.trim()}
                onPress={() => void handleSaveRoutine()}
              >
                Save Routine
              </SoftButton>
            </View>
          </View>
        </ScrollView>
      </Modal>
    </View>
  );
}
