import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Image, ScrollView, Text, View } from "react-native";
import { ApiError } from "../api/client";
import { getCachedMembersSync, listMembersSmart } from "../api/members";
import type { ServerMember } from "../api/types";
import { useAuth } from "../state/AuthProvider";
import { useSync } from "../state/SyncManager";
import { useTheme } from "../theme/ThemeProvider";
import { Material } from "../theme/Material";
import { MIN_TARGET_DP, RADII, TYPOGRAPHY } from "../theme/tokens";
import { CelebrationOverlay, type CelebrationEvent } from "../ui/CelebrationOverlay";
import { isPhotoUri } from "../ui/MemberRail";
import { SoftButton } from "../ui/SoftButton";
import { useToast } from "../ui/Toast";
import { MoreButton } from "../nav/CapsuleDock";
import { EmergencyShield } from "./EmergencyShield";
import {
  DEFAULT_ACCOUNTABILITY_STATE,
  DEFAULT_ROUTINE_SETTINGS,
  loadRoutinesBundle,
  postRoutineAction,
  type DailyRoutineProgress,
  type FamilyRoutine,
  type RoutineAccountabilityState,
  type RoutineSettings,
} from "../tasks/routines-api";
import {
  getMemberCompletionMeta,
  isRoutineScheduledForDate,
  isSingleMemberRoutine,
  memberKey,
  routineAppliesToMember,
  type RoutineRosterMember,
} from "../tasks/routine-rules";
import { RoutineTodaySection } from "../tasks/RoutineTodaySection";
import {
  RoutineComposerModal,
  RoutineSettingsModal,
} from "../tasks/RoutineModals";

function localTodayISO(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function greetingPhrase(now = new Date()): string {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function toRoutineRoster(list: ServerMember[]): RoutineRosterMember[] {
  return list.map((m) => ({
    id: m.id,
    name: m.name,
    fullName: m.name,
    role: m.role,
    emoji: m.emoji,
  }));
}

export interface AdultRoutinesHomeProps {
  onSwitchToWall: () => void;
  onOpenMore?: () => void;
}

/**
 * Adult Routine Hub — shown when a parent signs in so adults share the same
 * daily check-off, points, and streak accountability loop as kids, while
 * offering a 1-tap toggle back to the fixed 3×4 Family Wall.
 */
export function AdultRoutinesHome({
  onSwitchToWall,
  onOpenMore,
}: AdultRoutinesHomeProps) {
  const { member, signOut } = useAuth();
  const { snapshot, refreshNow, onPulse } = useSync();
  const { colors, accentColor } = useTheme();
  const toast = useToast();

  const deviceToday = useMemo(() => localTodayISO(), []);
  const [serverTodayISO, setServerTodayISO] = useState(deviceToday);
  const [roster, setRoster] = useState<ServerMember[]>(() => getCachedMembersSync());
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

  const [composerOpen, setComposerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [celebrationEvent, setCelebrationEvent] = useState<CelebrationEvent | null>(null);

  const reloadBundle = useCallback(async () => {
    try {
      const bundle = await loadRoutinesBundle(deviceToday);
      setRoutines(bundle.routines);
      setSettings(bundle.settings);
      setAccountability(bundle.accountability);
      setProgress(bundle.progress);
      setServerTodayISO(bundle.todayISO || deviceToday);
      setOffline(bundle.offline);
    } finally {
      setLoading(false);
    }
  }, [deviceToday]);

  useEffect(() => {
    void reloadBundle();
    void listMembersSmart()
      .then((res) => {
        if (res.members.length > 0) setRoster(res.members);
      })
      .catch(() => {});
  }, [reloadBundle]);

  useEffect(() => {
    return onPulse(() => {
      void reloadBundle();
    });
  }, [onPulse, reloadBundle]);

  const canonicalName = member?.name ?? "Parent";
  const firstName = canonicalName.split(/\s+/)[0] || canonicalName;
  const rosterMembers = useMemo(() => toRoutineRoster(roster), [roster]);

  const weekPointsMap = snapshot?.weekData?.points ?? {};
  const myPoints =
    weekPointsMap[canonicalName] ??
    weekPointsMap[firstName] ??
    0;
  const myStreak = accountability.streaks[memberKey(canonicalName)]?.current ?? 0;

  const memberSummary = useMemo(() => {
    const activeRoster = rosterMembers.filter((m) => m.role !== "pet");
    return activeRoster.map((m) => {
      const cname = m.fullName || m.name;
      const scheduled = routines.filter(
        (rt) =>
          isRoutineScheduledForDate(rt, serverTodayISO) &&
          routineAppliesToMember(rt, m, activeRoster),
      );
      const done = scheduled.filter((rt) => {
        const meta = getMemberCompletionMeta(
          progress,
          rt.id,
          cname,
          isSingleMemberRoutine(rt, activeRoster),
        );
        return meta?.status === "completed" || meta?.status === "approved";
      }).length;
      const streak = accountability.streaks[memberKey(cname)]?.current ?? 0;
      return { member: m, cname, done, total: scheduled.length, streak };
    });
  }, [rosterMembers, routines, serverTodayISO, progress, accountability.streaks]);

  const handleSaveRoutine = async (routine: FamilyRoutine) => {
    setSaving(true);
    setModalError(null);
    try {
      const res = await postRoutineAction({ action: "upsert_routine", routine });
      setRoutines(res.routines);
      setSettings(res.settings);
      setAccountability(res.accountability);
      setComposerOpen(false);
      toast.show(`Saved routine "${routine.title}"!`);
    } catch (err) {
      setModalError(
        err instanceof ApiError
          ? err.message
          : "Couldn't reach the server to save routine.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSettings = async (next: RoutineSettings) => {
    setSaving(true);
    setModalError(null);
    try {
      const res = await postRoutineAction({
        action: "update_settings",
        settings: next,
      });
      setRoutines(res.routines);
      setSettings(res.settings);
      setAccountability(res.accountability);
      setSettingsOpen(false);
      toast.show("Routine point rules updated!");
    } catch (err) {
      setModalError(
        err instanceof ApiError
          ? err.message
          : "Couldn't reach the server to update point rules.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <View testID="adult-routines-home" style={{ flex: 1, paddingHorizontal: 24, paddingTop: 24 }}>
      <EmergencyShield style={{ zIndex: 10 }} />

      {/* Top action bar */}
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          paddingRight: 88,
          minHeight: MIN_TARGET_DP,
          marginBottom: 12,
          gap: 10,
        }}
      >
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          <SoftButton
            variant="primary"
            size="sm"
            testID="adult-switch-to-wall"
            onPress={onSwitchToWall}
            accessibilityLabel="Switch to Family Wall"
          >
            🏠 Family Wall
          </SoftButton>
          <SoftButton
            variant="secondary"
            size="sm"
            testID="adult-logout"
            onPress={() => void signOut()}
            accessibilityLabel="Sign out of parent hub"
          >
            🚪 Sign Out
          </SoftButton>
        </View>
        {onOpenMore ? <MoreButton onPress={onOpenMore} /> : null}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 180, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Card */}
        <Material
          tier="regular"
          tone={accentColor}
          style={{
            borderRadius: 28,
            padding: 20,
            gap: 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            <View
              style={{
                width: 84,
                height: 84,
                borderRadius: 42,
                backgroundColor: colors["color-surface-2"],
                borderWidth: 2,
                borderColor: accentColor,
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {isPhotoUri(member?.emoji ?? "") ? (
                <Image
                  source={{ uri: member?.emoji ?? "" }}
                  style={{ width: 84, height: 84 }}
                  accessibilityLabel={`${canonicalName} avatar`}
                />
              ) : (
                <Text style={{ fontSize: 42 }}>{member?.emoji || "🧑"}</Text>
              )}
            </View>

            <View style={{ flex: 1, gap: 4 }}>
              <Text
                style={{
                  color: colors["color-text-secondary"],
                  fontSize: TYPOGRAPHY.label.fontSize,
                  fontWeight: "700",
                  letterSpacing: 1.4,
                  textTransform: "uppercase",
                }}
              >
                Adult Routine Hub
              </Text>
              <Text
                style={{
                  color: colors["color-text-primary"],
                  fontSize: TYPOGRAPHY.sectionTitle.fontSize,
                  fontWeight: "700",
                }}
              >
                {greetingPhrase()}, {firstName}
              </Text>
              <Text
                style={{
                  color: colors["color-text-secondary"],
                  fontSize: TYPOGRAPHY.body.fontSize,
                }}
              >
                {myPoints} weekly pts
                {myStreak > 0 ? ` · 🔥 ${myStreak}d streak` : ""}
                {" · "}
                {settings.parentCountsTowardRace
                  ? "In family race"
                  : "Personal mode"}
              </Text>
            </View>
          </View>
        </Material>

        {/* My Routines & Daily Accountability */}
        <RoutineTodaySection
          title="My Routines Today"
          memberName={canonicalName}
          memberRole="parent"
          rosterMembers={rosterMembers}
          routines={routines}
          settings={settings}
          accountability={accountability}
          progress={progress}
          todayISO={serverTodayISO}
          loading={loading}
          offline={offline}
          showAllMissedForParent={true}
          onDataUpdated={({ progress: nextProg, accountability: nextAcc }) => {
            setProgress(nextProg);
            setAccountability(nextAcc);
          }}
          onPointsChanged={() => void refreshNow()}
          onCelebrate={setCelebrationEvent}
          onOpenComposer={() => {
            setModalError(null);
            setComposerOpen(true);
          }}
          onOpenSettings={() => {
            setModalError(null);
            setSettingsOpen(true);
          }}
        />

        {/* Family Routine Progress Snapshot */}
        <Material
          tier="thin"
          style={{
            borderRadius: 28,
            padding: 18,
            gap: 12,
          }}
        >
          <Text
            style={{
              color: colors["color-text-primary"],
              fontSize: TYPOGRAPHY.title.fontSize,
              fontWeight: "700",
            }}
          >
            👨‍👩‍👧‍👦 Family Routine Progress Today
          </Text>
          {memberSummary.length === 0 ? (
            <Text
              style={{
                color: colors["color-text-secondary"],
                fontSize: TYPOGRAPHY.body.fontSize,
              }}
            >
              No family members loaded yet.
            </Text>
          ) : (
            <View style={{ gap: 12 }}>
              {memberSummary.map((row) => {
                const pct =
                  row.total > 0 ? Math.round((row.done / row.total) * 100) : 100;
                return (
                  <View key={row.cname} style={{ gap: 6 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        {isPhotoUri(row.member.emoji ?? "") ? (
                          <Image
                            source={{ uri: row.member.emoji ?? "" }}
                            style={{ width: 24, height: 24, borderRadius: 12 }}
                            accessibilityLabel={`${row.cname} avatar`}
                          />
                        ) : (
                          <Text style={{ fontSize: 18 }}>
                            {row.member.emoji || "👤"}
                          </Text>
                        )}
                        <Text
                          style={{
                            color: colors["color-text-primary"],
                            fontSize: TYPOGRAPHY.body.fontSize,
                            fontWeight: "600",
                          }}
                        >
                          {row.cname}
                        </Text>
                      </View>
                      <Text
                        style={{
                          color: colors["color-text-secondary"],
                          fontSize: TYPOGRAPHY.label.fontSize,
                        }}
                      >
                        {row.done}/{row.total} done
                        {row.streak > 0 ? ` · 🔥 ${row.streak}d` : ""}
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
                          backgroundColor:
                            pct >= 100 ? colors["color-accent-mint"] : accentColor,
                        }}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </Material>
      </ScrollView>

      <RoutineComposerModal
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        editingRoutine={null}
        rosterMembers={rosterMembers}
        settings={settings}
        onSave={handleSaveRoutine}
        saving={saving}
        error={modalError}
      />

      <RoutineSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
        saving={saving}
        error={modalError}
      />

      <CelebrationOverlay
        event={celebrationEvent}
        onDismiss={() => setCelebrationEvent(null)}
      />
    </View>
  );
}

export default AdultRoutinesHome;
