import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ApiError } from "../api/client";
import { getCachedMembersSync, listMembersSmart } from "../api/members";
import type { ServerMember } from "../api/types";
import { useAuth } from "../state/AuthProvider";
import { useSync } from "../state/SyncManager";
import { useTheme } from "../theme/ThemeProvider";
import { Material } from "../theme/Material";
import { mix } from "../theme/mix";
import { MIN_TARGET_DP, RADII, TYPOGRAPHY } from "../theme/tokens";
import { CelebrationOverlay, type CelebrationEvent } from "../ui/CelebrationOverlay";
import { Chip } from "../ui/Chip";
import { EmptyState } from "../ui/EmptyState";
import { SoftButton } from "../ui/SoftButton";
import { useToast } from "../ui/Toast";
import { FocusTimerModal } from "./FocusTimerModal";
import {
  DEFAULT_ACCOUNTABILITY_STATE,
  DEFAULT_ROUTINE_SETTINGS,
  loadRoutinesBundle,
  postRoutineAction,
  postRoutineProgressAction,
  ROUTINE_SLOT_META,
  type DailyRoutineProgress,
  type FamilyRoutine,
  type RoutineAccountabilityState,
  type RoutineSettings,
  type RoutineSlot,
} from "./routines-api";
import {
  findRosterMember,
  formatRoutineDaysLabel,
  formatRoutineTargetsLabel,
  getMemberCheckedSteps,
  getMemberCompletionMeta,
  isRoutineScheduledForDate,
  isSingleMemberRoutine,
  memberKey,
  resolveRoutineTargets,
  routineAppliesToMember,
  type RoutineRosterMember,
} from "./routine-rules";
import {
  RoutineComposerModal,
  RoutineParentPinModal,
  RoutineSettingsModal,
} from "./RoutineModals";

const SLOTS: RoutineSlot[] = ["morning", "afternoon", "evening", "weekend"];

function localTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export interface RoutinesPanelProps {
  activeMemberFilter?: string;
  rosterNames?: string[];
  rosterMembers?: RoutineRosterMember[];
  isParent?: boolean;
  onPointsUpdated?: () => void;
}

type PendingParentAction =
  | { kind: "upsert_routine"; routine: FamilyRoutine }
  | { kind: "delete_routine"; routineId: string; title: string }
  | { kind: "update_settings"; settings: RoutineSettings }
  | { kind: "approve_routine"; routineId: string; memberName: string }
  | { kind: "send_back_routine"; routineId: string; memberName: string }
  | { kind: "excuse_missed"; entryId: string };

function toRoutineRoster(
  serverMembers: ServerMember[],
  rosterNames?: string[],
): RoutineRosterMember[] {
  if (serverMembers.length > 0) {
    return serverMembers.map((m) => ({
      id: m.id,
      name: m.name,
      fullName: m.name,
      role: m.role,
      emoji: m.emoji,
    }));
  }
  return (rosterNames ?? [])
    .filter((n) => n && n !== "All")
    .map((n) => ({ name: n, fullName: n }));
}

export function RoutinesPanel({
  activeMemberFilter = "All",
  rosterNames,
  rosterMembers: rosterMembersProp,
  onPointsUpdated,
}: RoutinesPanelProps) {
  const { colors, accentColor } = useTheme();
  const toast = useToast();
  const { member: authMember, role } = useAuth();
  const { refreshNow, onPulse } = useSync();

  const isChildSession = role !== null && role !== "parent";

  const [cachedServerMembers, setCachedServerMembers] = useState<ServerMember[]>(() =>
    getCachedMembersSync(),
  );
  const rosterMembers = useMemo(
    () =>
      rosterMembersProp && rosterMembersProp.length > 0
        ? rosterMembersProp
        : toRoutineRoster(cachedServerMembers, rosterNames),
    [rosterMembersProp, cachedServerMembers, rosterNames],
  );

  const deviceToday = useMemo(() => localTodayISO(), []);
  const [todayISO, setTodayISO] = useState(deviceToday);
  const [routines, setRoutines] = useState<FamilyRoutine[]>([]);
  const [settings, setSettings] = useState<RoutineSettings>(DEFAULT_ROUTINE_SETTINGS);
  const [accountability, setAccountability] = useState<RoutineAccountabilityState>(
    DEFAULT_ACCOUNTABILITY_STATE,
  );
  const [progress, setProgress] = useState<DailyRoutineProgress>({
    checkedSteps: {},
    completedRoutines: {},
    memberCheckedSteps: {},
    memberCompleted: {},
  });
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  const [scheduleScope, setScheduleScope] = useState<"today" | "all">("today");
  const [slotFilter, setSlotFilter] = useState<RoutineSlot | "all">("all");
  const [actorByRoutine, setActorByRoutine] = useState<Record<string, string>>({});
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});

  const [composerOpen, setComposerOpen] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<FamilyRoutine | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const modalSaving = pinBusy;
  const [modalError, setModalError] = useState<string | null>(null);

  const [pendingPinAction, setPendingPinAction] = useState<PendingParentAction | null>(
    null,
  );
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinBusy, setPinBusy] = useState(false);

  const [focusModalOpen, setFocusModalOpen] = useState(false);
  const [focusRoutine, setFocusRoutine] = useState<FamilyRoutine | null>(null);
  const [celebrationEvent, setCelebrationEvent] = useState<CelebrationEvent | null>(null);

  const reloadBundle = useCallback(async () => {
    try {
      const bundle = await loadRoutinesBundle(deviceToday);
      setRoutines(bundle.routines);
      setSettings(bundle.settings);
      setAccountability(bundle.accountability);
      setProgress(bundle.progress);
      setTodayISO(bundle.todayISO || deviceToday);
      setOffline(bundle.offline);
    } finally {
      setLoading(false);
    }
  }, [deviceToday]);

  useEffect(() => {
    void reloadBundle();
    void listMembersSmart()
      .then((res) => {
        if (res.members.length > 0) setCachedServerMembers(res.members);
      })
      .catch(() => {});
  }, [reloadBundle]);

  useEffect(() => {
    return onPulse(() => {
      void reloadBundle();
    });
  }, [onPulse, reloadBundle]);

  const setBusy = (key: string, val: boolean) => {
    setBusyIds((prev) => ({ ...prev, [key]: val }));
  };

  const notifyPointsChanged = () => {
    onPointsUpdated?.();
    void refreshNow();
  };

  const executeParentAction = async (
    action: PendingParentAction,
    pin?: string,
  ): Promise<boolean> => {
    try {
      if (action.kind === "upsert_routine") {
        const res = await postRoutineAction({
          action: "upsert_routine",
          routine: action.routine,
          pin,
        });
        setRoutines(res.routines);
        setSettings(res.settings);
        setAccountability(res.accountability);
        setComposerOpen(false);
        setEditingRoutine(null);
        toast.show(`Saved "${action.routine.title}"`);
        return true;
      }

      if (action.kind === "delete_routine") {
        const res = await postRoutineAction({
          action: "delete_routine",
          routineId: action.routineId,
          pin,
        });
        setRoutines(res.routines);
        setSettings(res.settings);
        setAccountability(res.accountability);
        toast.show(`Deleted "${action.title}"`);
        return true;
      }

      if (action.kind === "update_settings") {
        const res = await postRoutineAction({
          action: "update_settings",
          settings: action.settings,
          pin,
        });
        setRoutines(res.routines);
        setSettings(res.settings);
        setAccountability(res.accountability);
        setSettingsOpen(false);
        toast.show("Routine point rules saved!");
        return true;
      }

      if (action.kind === "approve_routine") {
        const res = await postRoutineProgressAction({
          action: "approve_routine",
          date: todayISO,
          routineId: action.routineId,
          memberName: action.memberName,
          pin,
        });
        setProgress(res.progress);
        setAccountability(res.accountability);
        notifyPointsChanged();
        toast.show(`Approved for ${action.memberName}!`);
        return true;
      }

      if (action.kind === "send_back_routine") {
        const res = await postRoutineProgressAction({
          action: "send_back_routine",
          date: todayISO,
          routineId: action.routineId,
          memberName: action.memberName,
          pin,
        });
        setProgress(res.progress);
        setAccountability(res.accountability);
        toast.show(`Sent back to ${action.memberName}.`);
        return true;
      }

      if (action.kind === "excuse_missed") {
        const res = await postRoutineProgressAction({
          action: "excuse_missed",
          entryId: action.entryId,
          pin,
        });
        setProgress(res.progress);
        setAccountability(res.accountability);
        notifyPointsChanged();
        toast.show("Missed routine excused & points refunded!");
        return true;
      }
      return true;
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Couldn't complete parent action right now.";
      if (err instanceof ApiError && err.status === 401 && !pin) {
        setPinError(null);
        setPendingPinAction(action);
        return false;
      }
      if (pendingPinAction) {
        setPinError(msg);
      } else if (composerOpen || settingsOpen) {
        setModalError(msg);
      } else {
        toast.show(msg, { intent: "error" });
      }
      return false;
    }
  };

  const dispatchParentAction = async (action: PendingParentAction) => {
    setModalError(null);
    setPinError(null);
    setPendingPinAction(action);
  };

  const matchedFilterMember = useMemo(() => {
    if (!activeMemberFilter || activeMemberFilter === "All") return null;
    return (
      findRosterMember(activeMemberFilter, rosterMembers) ?? {
        name: activeMemberFilter,
        fullName: activeMemberFilter,
      }
    );
  }, [activeMemberFilter, rosterMembers]);

  const resolveActiveActor = useCallback(
    (routine: FamilyRoutine): string => {
      if (isChildSession && authMember) return authMember.name;
      if (matchedFilterMember) {
        return matchedFilterMember.fullName || matchedFilterMember.name;
      }
      const picked = actorByRoutine[routine.id];
      if (picked) return picked;
      if (authMember && routineAppliesToMember(routine, authMember, rosterMembers)) {
        return authMember.name;
      }
      const targets = resolveRoutineTargets(routine, rosterMembers);
      if (targets.length > 0) return targets[0].name;
      return authMember?.name || "Family";
    },
    [isChildSession, authMember, matchedFilterMember, actorByRoutine, rosterMembers],
  );

  const filteredRoutines = useMemo(() => {
    return routines.filter((rt) => {
      if (slotFilter !== "all" && rt.slot !== slotFilter) return false;
      if (scheduleScope === "today" && !isRoutineScheduledForDate(rt, todayISO)) {
        return false;
      }
      if (matchedFilterMember) {
        return routineAppliesToMember(rt, matchedFilterMember, rosterMembers);
      }
      return true;
    });
  }, [routines, slotFilter, scheduleScope, todayISO, matchedFilterMember, rosterMembers]);

  const unexcusedMissed = useMemo(() => {
    const all = accountability.missedEntries.filter((e) => !e.excused);
    if (isChildSession && authMember) {
      const k = memberKey(authMember.name);
      return all.filter((e) => e.memberKey === k);
    }
    if (matchedFilterMember) {
      const k = memberKey(matchedFilterMember.fullName || matchedFilterMember.name);
      return all.filter((e) => e.memberKey === k);
    }
    return all;
  }, [accountability.missedEntries, isChildSession, authMember, matchedFilterMember]);

  const pendingApprovals = useMemo(() => {
    if (isChildSession) return [];
    const list: { key: string; routine: FamilyRoutine; memberName: string }[] = [];
    for (const rt of routines) {
      const targets = resolveRoutineTargets(rt, rosterMembers);
      for (const t of targets) {
        const meta = getMemberCompletionMeta(
          progress,
          rt.id,
          t.name,
          targets.length <= 1,
        );
        if (meta?.status === "pending_approval") {
          list.push({
            key: `${rt.id}::${t.name}`,
            routine: rt,
            memberName: t.name,
          });
        }
      }
    }
    return list;
  }, [isChildSession, routines, rosterMembers, progress]);

  const handleToggleStep = async (
    routine: FamilyRoutine,
    stepId: string,
    actorName: string,
  ) => {
    const bKey = `step:${routine.id}:${stepId}:${actorName}`;
    if (busyIds[bKey]) return;
    setBusy(bKey, true);
    try {
      const res = await postRoutineProgressAction({
        action: "toggle_step",
        date: todayISO,
        routineId: routine.id,
        stepId,
        memberName: actorName,
      });
      setProgress(res.progress);
      setAccountability(res.accountability);
      if (res.pointsDelta && res.pointsDelta !== 0) {
        notifyPointsChanged();
      }
      if (res.completion?.status === "pending_approval") {
        toast.show(`${routine.title} sent for parent approval!`);
      } else if (res.pointsDelta && res.pointsDelta > 0) {
        setCelebrationEvent({
          kind: "routine",
          memberName: actorName,
          title: routine.title,
          points: res.pointsDelta,
        });
      }
    } catch (err) {
      toast.show(
        err instanceof ApiError
          ? err.message
          : "Couldn't save routine check-off right now.",
        { intent: "error" },
      );
    } finally {
      setBusy(bKey, false);
    }
  };

  const handleCompleteOrUndo = async (
    routine: FamilyRoutine,
    actorName: string,
    isCompleteOrPending: boolean,
  ) => {
    const bKey = `complete:${routine.id}:${actorName}`;
    if (busyIds[bKey]) return;
    setBusy(bKey, true);
    try {
      const res = await postRoutineProgressAction({
        action: isCompleteOrPending ? "uncomplete_routine" : "complete_routine",
        date: todayISO,
        routineId: routine.id,
        memberName: actorName,
      });
      setProgress(res.progress);
      setAccountability(res.accountability);
      if (res.pointsDelta && res.pointsDelta !== 0) {
        notifyPointsChanged();
      }
      if (!isCompleteOrPending) {
        if (res.completion?.status === "pending_approval") {
          toast.show(`${routine.title} sent for parent approval.`);
        } else if (res.pointsDelta && res.pointsDelta > 0) {
          setCelebrationEvent({
            kind: "routine",
            memberName: actorName,
            title: routine.title,
            points: res.pointsDelta,
          });
        } else {
          toast.show(`${routine.title} complete!`);
        }
      }
    } catch (err) {
      toast.show(
        err instanceof ApiError ? err.message : "Couldn't update routine right now.",
        { intent: "error" },
      );
    } finally {
      setBusy(bKey, false);
    }
  };

  const roseBg = mix(colors["color-accent-rose"], colors["color-surface-1"], 14);
  const amberBg = mix(colors["color-accent-amber"], colors["color-surface-1"], 14);
  const chipSelectedBg = mix(accentColor, colors["color-surface-2"], 22);

  return (
    <View testID="routines-panel" style={{ gap: 16 }}>
      {/* Header Controls */}
      <Material
        tier="regular"
        style={{
          borderRadius: 28,
          padding: 18,
          gap: 14,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <View style={{ flex: 1, minWidth: 220 }}>
            <Text
              style={{
                color: colors["color-text-primary"],
                fontSize: TYPOGRAPHY.title.fontSize,
                fontWeight: "700",
              }}
            >
              ⏰ Daily Routines
            </Text>
            <Text
              style={{
                color: colors["color-text-secondary"],
                fontSize: TYPOGRAPHY.label.fontSize,
              }}
            >
              Synced schedule · Default +{settings.defaultPoints} pts
              {settings.accountabilityEnabled
                ? ` · Miss -${settings.defaultMissedPenalty} pts`
                : ""}
              {offline ? " · Offline cache" : ""}
            </Text>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <SoftButton
              variant="secondary"
              size="sm"
              testID="routine-focus-timer-open"
              onPress={() => {
                setFocusRoutine(null);
                setFocusModalOpen(true);
              }}
            >
              ⏱️ Focus Timer
            </SoftButton>
            {!isChildSession ? (
              <>
                <SoftButton
                  variant="secondary"
                  size="sm"
                  testID="routines-settings-button"
                  onPress={() => {
                    setModalError(null);
                    setSettingsOpen(true);
                  }}
                >
                  ⚙️ Point Rules
                </SoftButton>
                <SoftButton
                  variant="primary"
                  size="sm"
                  testID="routines-add-button"
                  onPress={() => {
                    setModalError(null);
                    setEditingRoutine(null);
                    setComposerOpen(true);
                  }}
                >
                  + Add Routine
                </SoftButton>
              </>
            ) : null}
          </View>
        </View>

        {/* Scope & Slot Filters */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {(["today", "all"] as const).map((scope) => {
            const active = scheduleScope === scope;
            return (
              <Pressable
                key={scope}
                testID={`routine-scope-${scope}`}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setScheduleScope(scope)}
                style={{
                  minHeight: MIN_TARGET_DP,
                  paddingHorizontal: 16,
                  borderRadius: RADII.pill,
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: active ? accentColor : colors["color-border-subtle"],
                  backgroundColor: active ? chipSelectedBg : colors["color-surface-2"],
                }}
              >
                <Text
                  style={{
                    color: colors["color-text-primary"],
                    fontSize: TYPOGRAPHY.label.fontSize,
                    fontWeight: active ? "700" : "600",
                  }}
                >
                  {scope === "today" ? "Scheduled Today" : "Full Schedule"}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Pressable
            testID="routine-filter-all"
            accessibilityRole="button"
            accessibilityState={{ selected: slotFilter === "all" }}
            onPress={() => setSlotFilter("all")}
            style={{
              minHeight: MIN_TARGET_DP,
              paddingHorizontal: 16,
              borderRadius: RADII.pill,
              justifyContent: "center",
              borderWidth: 1,
              borderColor: slotFilter === "all" ? accentColor : colors["color-border-subtle"],
              backgroundColor: slotFilter === "all" ? chipSelectedBg : colors["color-surface-2"],
            }}
          >
            <Text
              style={{
                color: colors["color-text-primary"],
                fontSize: TYPOGRAPHY.label.fontSize,
                fontWeight: slotFilter === "all" ? "700" : "600",
              }}
            >
              All Slots
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
                  paddingHorizontal: 14,
                  borderRadius: RADII.pill,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  borderWidth: 1,
                  borderColor: active ? accentColor : colors["color-border-subtle"],
                  backgroundColor: active ? chipSelectedBg : colors["color-surface-2"],
                }}
              >
                <Text style={{ fontSize: 18 }}>{meta.emoji}</Text>
                <Text
                  style={{
                    color: colors["color-text-primary"],
                    fontSize: TYPOGRAPHY.label.fontSize,
                    fontWeight: active ? "700" : "600",
                  }}
                >
                  {meta.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Material>

      {/* Missed Yesterday Accountability Banner */}
      {unexcusedMissed.length > 0 ? (
        <View
          testID="panel-missed-accountability"
          style={{
            borderRadius: 24,
            borderWidth: 1,
            borderColor: colors["color-accent-rose"],
            backgroundColor: roseBg,
            padding: 16,
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
              {unexcusedMissed.length} unexcused
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
                  {entry.routineEmoji} {entry.routineTitle} · {entry.memberName}
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
              {!isChildSession ? (
                <SoftButton
                  variant="secondary"
                  size="sm"
                  testID={`panel-excuse-${entry.id}`}
                  onPress={() =>
                    void dispatchParentAction({
                      kind: "excuse_missed",
                      entryId: entry.id,
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

      {/* Pending Approvals Queue */}
      {!isChildSession && pendingApprovals.length > 0 ? (
        <View
          testID="panel-pending-approvals"
          style={{
            borderRadius: 24,
            borderWidth: 1,
            borderColor: colors["color-accent-amber"],
            backgroundColor: amberBg,
            padding: 16,
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
                  onPress={() =>
                    void dispatchParentAction({
                      kind: "send_back_routine",
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
                  onPress={() =>
                    void dispatchParentAction({
                      kind: "approve_routine",
                      routineId: item.routine.id,
                      memberName: item.memberName,
                    })
                  }
                >
                  Approve +{item.routine.points}
                </SoftButton>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {/* Routine Cards List */}
      {loading && routines.length === 0 ? (
        <View style={{ paddingVertical: 20 }}>
          <Text
            style={{
              color: colors["color-text-secondary"],
              fontSize: TYPOGRAPHY.body.fontSize,
            }}
          >
            Loading routines…
          </Text>
        </View>
      ) : filteredRoutines.length === 0 ? (
        <EmptyState
          icon="⏰"
          title="No routines match this filter"
          body={
            scheduleScope === "today"
              ? "Switch to 'Full Schedule' to view routines for other days (e.g., Sunday trash)."
              : "Tap '+ Add Routine' to create one."
          }
        />
      ) : (
        <View style={{ gap: 14 }}>
          {filteredRoutines.map((routine) => {
            const meta = ROUTINE_SLOT_META[routine.slot] ?? ROUTINE_SLOT_META.morning;
            const toneColor = colors[meta.toneKey] ?? accentColor;
            const targets = resolveRoutineTargets(routine, rosterMembers);
            const activeActor = resolveActiveActor(routine);
            const allowLegacy = isSingleMemberRoutine(routine, rosterMembers);
            const checkedIds = getMemberCheckedSteps(
              progress,
              routine.id,
              activeActor,
              allowLegacy,
            );
            const completionMeta = getMemberCompletionMeta(
              progress,
              routine.id,
              activeActor,
              allowLegacy,
            );
            const isComplete =
              completionMeta?.status === "completed" ||
              completionMeta?.status === "approved";
            const isPending = completionMeta?.status === "pending_approval";
            const doneCount = checkedIds.length;
            const totalCount = routine.steps.length;
            const pct = isComplete
              ? 100
              : totalCount > 0
                ? Math.round((doneCount / totalCount) * 100)
                : 0;
            const actorStreak =
              accountability.streaks[memberKey(activeActor)]?.current ?? 0;
            const effectivePenalty =
              routine.missedPenalty !== undefined
                ? routine.missedPenalty
                : settings.accountabilityEnabled
                  ? settings.defaultMissedPenalty
                  : 0;

            return (
              <Material
                key={routine.id}
                tier="thin"
                tone={toneColor}
                testID={`routine-card-${routine.id}`}
                style={{
                  borderRadius: 24,
                  padding: 18,
                  gap: 14,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                    <Text style={{ fontSize: 32 }}>{routine.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: colors["color-text-primary"],
                          fontSize: TYPOGRAPHY.title.fontSize,
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
                        {meta.label} · {routine.time} ·{" "}
                        {formatRoutineTargetsLabel(routine)} ·{" "}
                        {formatRoutineDaysLabel(routine.daysOfWeek, routine.slot)}
                        {effectivePenalty > 0 ? ` · Miss -${effectivePenalty}` : ""}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {actorStreak > 0 ? (
                      <Chip as="span" tone="warning" label={`🔥 ${actorStreak}d`} />
                    ) : null}
                    <Chip
                      as="span"
                      tone={isComplete ? "success" : isPending ? "warning" : "accent"}
                      label={
                        isComplete
                          ? "✓ Completed"
                          : isPending
                            ? "⏳ Pending"
                            : `+${routine.points} pts`
                      }
                    />
                  </View>
                </View>

                {/* Member switcher on multi-target cards when unfiltered */}
                {!isChildSession && !matchedFilterMember && targets.length > 1 ? (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {targets.map((t) => {
                      const active = memberKey(activeActor) === memberKey(t.name);
                      const first = t.name.split(/\s+/)[0] || t.name;
                      return (
                        <Pressable
                          key={t.name}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          onPress={() =>
                            setActorByRoutine((prev) => ({
                              ...prev,
                              [routine.id]: t.name,
                            }))
                          }
                          style={{
                            minHeight: MIN_TARGET_DP,
                            paddingHorizontal: 14,
                            borderRadius: RADII.pill,
                            justifyContent: "center",
                            borderWidth: 1,
                            borderColor: active
                              ? accentColor
                              : colors["color-border-subtle"],
                            backgroundColor: active
                              ? chipSelectedBg
                              : colors["color-surface-2"],
                          }}
                        >
                          <Text
                            style={{
                              color: colors["color-text-primary"],
                              fontSize: TYPOGRAPHY.label.fontSize,
                              fontWeight: active ? "700" : "600",
                            }}
                          >
                            {first}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}

                {/* Step Counter + Progress Bar */}
                <View style={{ gap: 6 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        color: colors["color-text-secondary"],
                        fontSize: TYPOGRAPHY.label.fontSize,
                      }}
                    >
                      {doneCount} of {totalCount} steps done
                    </Text>
                    <Text
                      style={{
                        color: colors["color-text-secondary"],
                        fontSize: TYPOGRAPHY.label.fontSize,
                        fontWeight: "600",
                      }}
                    >
                      {pct}%
                    </Text>
                  </View>
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
                          : toneColor,
                      }}
                    />
                  </View>
                </View>

                {/* Checklist Steps */}
                <View style={{ gap: 8 }}>
                  {routine.steps.map((step) => {
                    const checked = checkedIds.includes(step.id);
                    return (
                      <Pressable
                        key={step.id}
                        testID={`routine-step-${routine.id}-${step.id}`}
                        accessibilityRole="checkbox"
                        accessibilityLabel={`${step.title} (${routine.title})`}
                        accessibilityState={{ checked }}
                        onPress={() => void handleToggleStep(routine, step.id, activeActor)}
                        style={{
                          minHeight: MIN_TARGET_DP,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 12,
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                          borderRadius: RADII.md,
                          borderWidth: 1,
                          borderColor: checked
                            ? colors["color-accent-mint"]
                            : colors["color-border-subtle"],
                          backgroundColor: colors["color-surface-2"],
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 20,
                            fontWeight: "700",
                            color: checked
                              ? colors["color-accent-ink-mint"]
                              : colors["color-text-muted"],
                          }}
                        >
                          {checked ? "☑" : "☐"}
                        </Text>
                        <Text
                          style={{
                            flex: 1,
                            fontSize: TYPOGRAPHY.body.fontSize,
                            color: checked
                              ? colors["color-text-secondary"]
                              : colors["color-text-primary"],
                            textDecorationLine: checked ? "line-through" : "none",
                          }}
                        >
                          {step.emoji} {step.title}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Actions Row */}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                  <SoftButton
                    variant="secondary"
                    size="sm"
                    testID={`routine-card-timer-${routine.id}`}
                    onPress={() => {
                      setFocusRoutine(routine);
                      setFocusModalOpen(true);
                    }}
                  >
                    ⏱️ Focus
                  </SoftButton>

                  <SoftButton
                    variant={isComplete || isPending ? "ghost" : "primary"}
                    size="sm"
                    testID={`routine-complete-all-${routine.id}`}
                    onPress={() =>
                      void handleCompleteOrUndo(
                        routine,
                        activeActor,
                        isComplete || isPending,
                      )
                    }
                    style={{ flex: 1 }}
                  >
                    {isComplete
                      ? "Undo Complete"
                      : isPending
                        ? "Undo Submission"
                        : `Complete (+${routine.points} pts)`}
                  </SoftButton>

                  {!isChildSession ? (
                    <>
                      <SoftButton
                        variant="secondary"
                        size="sm"
                        testID={`routine-edit-${routine.id}`}
                        onPress={() => {
                          setModalError(null);
                          setEditingRoutine(routine);
                          setComposerOpen(true);
                        }}
                      >
                        Edit
                      </SoftButton>
                      <SoftButton
                        variant="danger"
                        size="sm"
                        testID={`routine-delete-${routine.id}`}
                        onPress={() =>
                          void dispatchParentAction({
                            kind: "delete_routine",
                            routineId: routine.id,
                            title: routine.title,
                          })
                        }
                      >
                        Delete
                      </SoftButton>
                    </>
                  ) : null}
                </View>
              </Material>
            );
          })}
        </View>
      )}

      {/* Modals */}
      <FocusTimerModal
        visible={focusModalOpen}
        onClose={() => {
          setFocusModalOpen(false);
          setFocusRoutine(null);
        }}
        activeRoutine={focusRoutine}
        onCompleteRoutine={(rt) => {
          const actor = resolveActiveActor(rt);
          setFocusModalOpen(false);
          setFocusRoutine(null);
          void handleCompleteOrUndo(rt, actor, false);
        }}
      />

      <RoutineComposerModal
        open={composerOpen && pendingPinAction === null}
        onClose={() => {
          setComposerOpen(false);
          setEditingRoutine(null);
        }}
        editingRoutine={editingRoutine}
        rosterMembers={rosterMembers}
        settings={settings}
        onSave={(rt) => dispatchParentAction({ kind: "upsert_routine", routine: rt })}
        saving={modalSaving}
        error={modalError}
      />

      <RoutineSettingsModal
        open={settingsOpen && pendingPinAction === null}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSave={(next) => dispatchParentAction({ kind: "update_settings", settings: next })}
        saving={modalSaving}
        error={modalError}
      />

      <RoutineParentPinModal
        open={pendingPinAction !== null}
        onClose={() => {
          if (!pinBusy) {
            setPendingPinAction(null);
            setPinError(null);
          }
        }}
        busy={pinBusy}
        error={pinError}
        onVerified={async (pin) => {
          if (!pendingPinAction) return;
          setPinBusy(true);
          setPinError(null);
          try {
            const ok = await executeParentAction(pendingPinAction, pin);
            if (ok) {
              setPendingPinAction(null);
            }
          } finally {
            setPinBusy(false);
          }
        }}
      />

      <CelebrationOverlay
        event={celebrationEvent}
        onDismiss={() => setCelebrationEvent(null)}
      />
    </View>
  );
}

export default RoutinesPanel;
