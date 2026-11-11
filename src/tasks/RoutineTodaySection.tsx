import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ApiError } from "../api/client";
import { useTheme } from "../theme/ThemeProvider";
import { mix } from "../theme/mix";
import { MIN_TARGET_DP, RADII, TYPOGRAPHY } from "../theme/tokens";
import { Material } from "../theme/Material";
import { SoftButton } from "../ui/SoftButton";
import { EmptyState } from "../ui/EmptyState";
import { Chip } from "../ui/Chip";
import { HomeWidgetIcon } from "../ui/HomeWidgetIcon";
import { useToast } from "../ui/Toast";
import type { CelebrationEvent } from "../ui/CelebrationOverlay";
import {
  postRoutineProgressAction,
  ROUTINE_SLOT_META,
  type DailyRoutineProgress,
  type FamilyRoutine,
  type RoutineAccountabilityState,
  type RoutineSettings,
} from "./routines-api";
import {
  formatRoutineDaysLabel,
  getMemberCheckedSteps,
  getMemberCompletionMeta,
  isRoutineScheduledForDate,
  isSingleMemberRoutine,
  memberKey,
  resolveRoutineTargets,
  routineAppliesToMember,
  type RoutineRosterMember,
} from "./routine-rules";
import { FocusTimerModal } from "./FocusTimerModal";

export interface RoutineTodaySectionProps {
  title?: string;
  memberName: string;
  memberRole: "parent" | "child" | "pet";
  rosterMembers: RoutineRosterMember[];
  routines: FamilyRoutine[];
  settings: RoutineSettings;
  accountability: RoutineAccountabilityState;
  progress: DailyRoutineProgress;
  todayISO: string;
  loading?: boolean;
  offline?: boolean;
  showAllMissedForParent?: boolean;
  onDataUpdated: (next: {
    progress: DailyRoutineProgress;
    accountability: RoutineAccountabilityState;
  }) => void;
  onPointsChanged?: () => void;
  onCelebrate?: (event: CelebrationEvent) => void;
  onOpenComposer?: () => void;
  onOpenSettings?: () => void;
}

export function RoutineTodaySection({
  title = "Today's Routines",
  memberName,
  memberRole,
  rosterMembers,
  routines,
  settings,
  accountability,
  progress,
  todayISO,
  loading = false,
  offline = false,
  showAllMissedForParent = false,
  onDataUpdated,
  onPointsChanged,
  onCelebrate,
  onOpenComposer,
  onOpenSettings,
}: RoutineTodaySectionProps) {
  const { colors, accentColor } = useTheme();
  const toast = useToast();
  const isParent = memberRole === "parent";

  const [busyMap, setBusyMap] = useState<Record<string, boolean>>({});
  const [focusRoutine, setFocusRoutine] = useState<FamilyRoutine | null>(null);

  const setBusy = (key: string, val: boolean) => {
    setBusyMap((prev) => ({ ...prev, [key]: val }));
  };

  const myTodayRoutines = useMemo(() => {
    return routines.filter(
      (rt) =>
        isRoutineScheduledForDate(rt, todayISO) &&
        routineAppliesToMember(rt, { name: memberName, fullName: memberName, role: memberRole }, rosterMembers),
    );
  }, [routines, todayISO, memberName, memberRole, rosterMembers]);

  const unexcusedMissed = useMemo(() => {
    const all = accountability.missedEntries.filter((e) => !e.excused);
    if (isParent && showAllMissedForParent) return all;
    const myKey = memberKey(memberName);
    const myFirst = myKey.split(/\s+/)[0] || myKey;
    return all.filter(
      (e) =>
        e.memberKey === myKey ||
        memberKey(e.memberName).split(/\s+/)[0] === myFirst,
    );
  }, [accountability.missedEntries, isParent, showAllMissedForParent, memberName]);

  const pendingApprovals = useMemo(() => {
    if (!isParent) return [];
    const items: { key: string; routine: FamilyRoutine; memberName: string }[] = [];
    for (const rt of routines) {
      const targets = resolveRoutineTargets(rt, rosterMembers);
      for (const target of targets) {
        const meta = getMemberCompletionMeta(
          progress,
          rt.id,
          target.name,
          targets.length <= 1,
        );
        if (meta?.status === "pending_approval") {
          items.push({
            key: `${rt.id}::${target.name}`,
            routine: rt,
            memberName: target.name,
          });
        }
      }
    }
    return items;
  }, [isParent, routines, rosterMembers, progress]);

  const myStreak = accountability.streaks[memberKey(memberName)]?.current ?? 0;

  const doneCount = myTodayRoutines.filter((rt) => {
    const meta = getMemberCompletionMeta(
      progress,
      rt.id,
      memberName,
      isSingleMemberRoutine(rt, rosterMembers),
    );
    return meta?.status === "completed" || meta?.status === "approved";
  }).length;

  const runAction = async (
    busyKey: string,
    payload: Parameters<typeof postRoutineProgressAction>[0],
    onSuccess?: (res: Awaited<ReturnType<typeof postRoutineProgressAction>>) => void,
  ) => {
    if (busyMap[busyKey]) return;
    setBusy(busyKey, true);
    try {
      const res = await postRoutineProgressAction(payload);
      onDataUpdated({ progress: res.progress, accountability: res.accountability });
      if (res.pointsDelta && res.pointsDelta !== 0) {
        onPointsChanged?.();
      }
      onSuccess?.(res);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Offline — couldn't save routine check-off right now.";
      toast.show(msg, { intent: "error" });
    } finally {
      setBusy(busyKey, false);
    }
  };

  const handleToggleStep = (routine: FamilyRoutine, stepId: string) => {
    void runAction(
      `step:${routine.id}:${stepId}`,
      {
        action: "toggle_step",
        date: todayISO,
        routineId: routine.id,
        stepId,
        memberName,
      },
      (res) => {
        if (res.completion?.status === "pending_approval") {
          toast.show(`${routine.title} sent for parent approval!`, { intent: "info" });
        } else if (res.pointsDelta && res.pointsDelta > 0) {
          onCelebrate?.({
            kind: "routine",
            memberName,
            title: routine.title,
            points: res.pointsDelta,
          });
        }
      },
    );
  };

  const handleCompleteOrUndo = (routine: FamilyRoutine, isCompleteOrPending: boolean) => {
    void runAction(
      `routine:${routine.id}`,
      {
        action: isCompleteOrPending ? "uncomplete_routine" : "complete_routine",
        date: todayISO,
        routineId: routine.id,
        memberName,
      },
      (res) => {
        if (!isCompleteOrPending) {
          if (res.completion?.status === "pending_approval") {
            toast.show(`${routine.title} submitted for parent approval.`, { intent: "info" });
          } else if (res.pointsDelta && res.pointsDelta > 0) {
            onCelebrate?.({
              kind: "routine",
              memberName,
              title: routine.title,
              points: res.pointsDelta,
            });
          } else {
            toast.show(`Nice work — ${routine.title} checked off!`);
          }
        }
      },
    );
  };

  const roseBg = mix(colors["color-accent-rose"], colors["color-surface-1"], 14);
  const amberBg = mix(colors["color-accent-amber"], colors["color-surface-1"], 14);
  const mintBg = mix(colors["color-accent-mint"], colors["color-surface-1"], 14);

  return (
    <Material
      tier="regular"
      tone={accentColor}
      testID="routines-today-section"
      style={{
        borderRadius: 28,
        padding: 18,
        gap: 14,
      }}
    >
      {/* Header row */}
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <HomeWidgetIcon variant="tasks" size={28} title={title} />
          <View>
            <Text
              style={{
                color: colors["color-text-primary"],
                fontSize: TYPOGRAPHY.title.fontSize,
                fontWeight: "700",
              }}
            >
              ☀️ {title}
            </Text>
            <Text
              style={{
                color: colors["color-text-secondary"],
                fontSize: TYPOGRAPHY.label.fontSize,
              }}
            >
              {doneCount}/{myTodayRoutines.length} done today · {todayISO}
              {offline ? " · Offline cache" : ""}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          {myStreak > 0 ? (
            <Chip
              as="span"
              tone="warning"
              label={`🔥 ${myStreak}d streak`}
              testID="routine-streak-badge"
            />
          ) : null}
          {isParent && onOpenSettings ? (
            <SoftButton
              variant="secondary"
              size="sm"
              onPress={onOpenSettings}
              testID="today-routines-settings-btn"
            >
              ⚙️ Point Rules
            </SoftButton>
          ) : null}
          {isParent && onOpenComposer ? (
            <SoftButton
              variant="primary"
              size="sm"
              onPress={onOpenComposer}
              testID="today-routines-add-btn"
            >
              + Add Routine
            </SoftButton>
          ) : null}
        </View>
      </View>

      {/* Missed Yesterday Accountability Banner */}
      {unexcusedMissed.length > 0 ? (
        <View
          testID="today-missed-accountability"
          style={{
            borderRadius: RADII.lg,
            borderWidth: 1,
            borderColor: colors["color-accent-rose"],
            backgroundColor: roseBg,
            padding: 14,
            gap: 10,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text
              style={{
                color: colors["color-accent-ink-rose"],
                fontSize: TYPOGRAPHY.body.fontSize,
                fontWeight: "700",
              }}
            >
              ⚠️ Missed Yesterday · Daily Accountability
            </Text>
            <Text
              style={{
                color: colors["color-accent-ink-rose"],
                fontSize: TYPOGRAPHY.label.fontSize,
                fontWeight: "600",
              }}
            >
              {unexcusedMissed.length} missed
            </Text>
          </View>

          {unexcusedMissed.map((entry) => (
            <View
              key={entry.id}
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                borderRadius: RADII.md,
                backgroundColor: colors["color-surface-1"],
                borderWidth: 1,
                borderColor: colors["color-border-subtle"],
                padding: 12,
              }}
            >
              <View style={{ flex: 1, minWidth: 200 }}>
                <Text
                  style={{
                    color: colors["color-text-primary"],
                    fontSize: TYPOGRAPHY.body.fontSize,
                    fontWeight: "600",
                  }}
                >
                  {entry.routineEmoji} {entry.routineTitle}
                  {isParent && showAllMissedForParent ? ` · ${entry.memberName}` : ""}
                </Text>
                <Text
                  style={{
                    color: colors["color-text-secondary"],
                    fontSize: TYPOGRAPHY.label.fontSize,
                  }}
                >
                  {entry.date} · Streak reset
                  {entry.deductedPoints > 0
                    ? ` · -${entry.deductedPoints} pts deducted`
                    : ""}
                </Text>
              </View>
              {isParent ? (
                <SoftButton
                  variant="secondary"
                  size="sm"
                  loading={!!busyMap[`excuse:${entry.id}`]}
                  testID={`excuse-missed-${entry.id}`}
                  onPress={() =>
                    void runAction(`excuse:${entry.id}`, {
                      action: "excuse_missed",
                      entryId: entry.id,
                    }, () => {
                      toast.show(
                        `Excused ${entry.routineTitle}${
                          entry.deductedPoints > 0
                            ? ` (+${entry.deductedPoints} pts refunded)`
                            : ""
                        }.`,
                      );
                    })
                  }
                >
                  {entry.deductedPoints > 0
                    ? `Excuse +${entry.deductedPoints}`
                    : "Excuse"}
                </SoftButton>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {/* Pending Approvals for Parents */}
      {isParent && pendingApprovals.length > 0 ? (
        <View
          testID="today-pending-routine-approvals"
          style={{
            borderRadius: RADII.lg,
            borderWidth: 1,
            borderColor: colors["color-accent-amber"],
            backgroundColor: amberBg,
            padding: 14,
            gap: 10,
          }}
        >
          <Text
            style={{
              color: colors["color-accent-ink-amber"],
              fontSize: TYPOGRAPHY.body.fontSize,
              fontWeight: "700",
            }}
          >
            ⏳ Waiting Parent Approval ({pendingApprovals.length})
          </Text>
          {pendingApprovals.map((item) => (
            <View
              key={item.key}
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                borderRadius: RADII.md,
                backgroundColor: colors["color-surface-1"],
                borderWidth: 1,
                borderColor: colors["color-border-subtle"],
                padding: 12,
              }}
            >
              <View style={{ flex: 1, minWidth: 180 }}>
                <Text
                  style={{
                    color: colors["color-text-primary"],
                    fontSize: TYPOGRAPHY.body.fontSize,
                    fontWeight: "600",
                  }}
                >
                  {item.routine.emoji} {item.routine.title} · {item.memberName}
                </Text>
                <Text
                  style={{
                    color: colors["color-text-secondary"],
                    fontSize: TYPOGRAPHY.label.fontSize,
                  }}
                >
                  +{item.routine.points} pts upon approval
                </Text>
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <SoftButton
                  variant="ghost"
                  size="sm"
                  loading={!!busyMap[`sendback:${item.key}`]}
                  onPress={() =>
                    void runAction(`sendback:${item.key}`, {
                      action: "send_back_routine",
                      date: todayISO,
                      routineId: item.routine.id,
                      memberName: item.memberName,
                    })
                  }
                >
                  Send Back
                </SoftButton>
                <SoftButton
                  variant="primary"
                  size="sm"
                  loading={!!busyMap[`approve:${item.key}`]}
                  onPress={() =>
                    void runAction(
                      `approve:${item.key}`,
                      {
                        action: "approve_routine",
                        date: todayISO,
                        routineId: item.routine.id,
                        memberName: item.memberName,
                      },
                      (res) => {
                        onCelebrate?.({
                          kind: "routine",
                          memberName: item.memberName,
                          title: item.routine.title,
                          points: res.pointsDelta ?? item.routine.points,
                        });
                      },
                    )
                  }
                >
                  Approve +{item.routine.points}
                </SoftButton>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {/* Routine Cards */}
      {loading && routines.length === 0 ? (
        <View style={{ paddingVertical: 16 }}>
          <Text
            style={{
              color: colors["color-text-secondary"],
              fontSize: TYPOGRAPHY.body.fontSize,
            }}
          >
            Loading today&apos;s routines…
          </Text>
        </View>
      ) : myTodayRoutines.length === 0 ? (
        <EmptyState
          icon="✨"
          title="No routines scheduled today"
          body="You're all set for today's routine schedule."
        />
      ) : (
        <View style={{ gap: 12 }}>
          {myTodayRoutines.map((routine) => {
            const slotMeta = ROUTINE_SLOT_META[routine.slot] ?? ROUTINE_SLOT_META.morning;
            const allowLegacy = isSingleMemberRoutine(routine, rosterMembers);
            const checked = getMemberCheckedSteps(
              progress,
              routine.id,
              memberName,
              allowLegacy,
            );
            const meta = getMemberCompletionMeta(
              progress,
              routine.id,
              memberName,
              allowLegacy,
            );
            const isComplete =
              meta?.status === "completed" || meta?.status === "approved";
            const isPendingApproval = meta?.status === "pending_approval";
            const totalSteps = routine.steps.length || 1;
            const pct = isComplete
              ? 100
              : Math.min(100, Math.round((checked.length / totalSteps) * 100));
            const effectivePenalty =
              routine.missedPenalty !== undefined
                ? routine.missedPenalty
                : settings.accountabilityEnabled
                  ? settings.defaultMissedPenalty
                  : 0;
            const cardBg = isComplete
              ? mintBg
              : isPendingApproval
                ? amberBg
                : colors["color-surface-1"];
            const borderCol = isComplete
              ? colors["color-accent-mint"]
              : isPendingApproval
                ? colors["color-accent-amber"]
                : colors["color-border-subtle"];

            return (
              <View
                key={routine.id}
                testID={`today-routine-card-${routine.id}`}
                style={{
                  borderRadius: RADII.lg,
                  borderWidth: 1,
                  borderColor: borderCol,
                  backgroundColor: cardBg,
                  padding: 14,
                  gap: 12,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                    <Text style={{ fontSize: 28 }}>{routine.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: colors["color-text-primary"],
                          fontSize: TYPOGRAPHY.body.fontSize,
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
                        {slotMeta.label} · {routine.time} ·{" "}
                        {formatRoutineDaysLabel(routine.daysOfWeek, routine.slot)}
                        {effectivePenalty > 0 ? ` · Miss -${effectivePenalty}` : ""}
                      </Text>
                    </View>
                  </View>

                  <Chip
                    as="span"
                    tone={isComplete ? "success" : isPendingApproval ? "warning" : "accent"}
                    label={
                      isComplete
                        ? `✓ +${meta?.pointsAwarded ?? routine.points} pts`
                        : isPendingApproval
                          ? "⏳ Pending"
                          : `+${routine.points} pts`
                    }
                  />
                </View>

                {/* Progress bar */}
                <View
                  style={{
                    height: 8,
                    borderRadius: RADII.pill,
                    backgroundColor: colors["color-surface-2"],
                    overflow: "hidden",
                  }}
                >
                  <View
                    style={{
                      width: `${pct}%`,
                      height: "100%",
                      borderRadius: RADII.pill,
                      backgroundColor: isComplete
                        ? colors["color-accent-mint"]
                        : accentColor,
                    }}
                  />
                </View>

                {/* Checklist steps */}
                <View style={{ gap: 8 }}>
                  {routine.steps.map((step) => {
                    const isChecked = checked.includes(step.id);
                    return (
                      <Pressable
                        key={step.id}
                        testID={`today-routine-step-${routine.id}-${step.id}`}
                        accessibilityRole="checkbox"
                        accessibilityLabel={`${step.title} (${routine.title})`}
                        accessibilityState={{ checked: isChecked }}
                        onPress={() => handleToggleStep(routine, step.id)}
                        style={{
                          minHeight: MIN_TARGET_DP,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 12,
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                          borderRadius: RADII.md,
                          borderWidth: 1,
                          borderColor: isChecked
                            ? colors["color-accent-mint"]
                            : colors["color-border-subtle"],
                          backgroundColor: colors["color-surface-2"],
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 20,
                            fontWeight: "700",
                            color: isChecked
                              ? colors["color-accent-ink-mint"]
                              : colors["color-text-muted"],
                          }}
                        >
                          {isChecked ? "☑" : "☐"}
                        </Text>
                        <Text
                          style={{
                            flex: 1,
                            fontSize: TYPOGRAPHY.body.fontSize,
                            color: isChecked
                              ? colors["color-text-secondary"]
                              : colors["color-text-primary"],
                            textDecorationLine: isChecked ? "line-through" : "none",
                          }}
                        >
                          {step.emoji} {step.title}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Action buttons */}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                  <SoftButton
                    variant="secondary"
                    size="sm"
                    onPress={() => setFocusRoutine(routine)}
                    testID={`today-routine-focus-${routine.id}`}
                  >
                    ⏱️ Focus
                  </SoftButton>
                  <SoftButton
                    variant={isComplete || isPendingApproval ? "ghost" : "primary"}
                    size="sm"
                    loading={!!busyMap[`routine:${routine.id}`]}
                    onPress={() =>
                      handleCompleteOrUndo(routine, isComplete || isPendingApproval)
                    }
                    testID={`today-routine-complete-${routine.id}`}
                    style={{ flex: 1 }}
                  >
                    {isComplete
                      ? "✓ Completed (Undo)"
                      : isPendingApproval
                        ? "⏳ Submitted (Undo)"
                        : `✓ Complete (+${routine.points} pts)`}
                  </SoftButton>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <FocusTimerModal
        visible={focusRoutine !== null}
        onClose={() => setFocusRoutine(null)}
        activeRoutine={focusRoutine}
        onCompleteRoutine={(rt) => {
          setFocusRoutine(null);
          handleCompleteOrUndo(rt, false);
        }}
      />
    </Material>
  );
}
