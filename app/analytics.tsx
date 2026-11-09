import React, { useEffect, useMemo, useState } from "react";
import { Image, ScrollView, Text, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { Screen } from "../src/theme/Screen";
import { useTheme } from "../src/theme/ThemeProvider";
import { Material } from "../src/theme/Material";
import { FONTS, MIN_TARGET_DP, RADII, SPACING, TYPOGRAPHY } from "../src/theme/tokens";
import { mix } from "../src/theme/mix";
import { CapsuleDock, MoreButton } from "../src/nav/CapsuleDock";
import { MoreSheet } from "../src/nav/MoreSheet";
import { useAuth } from "../src/state/AuthProvider";
import { useSync } from "../src/state/SyncManager";
import { SoftButton } from "../src/ui/SoftButton";
import { localTodayISO, weekStartMondayISO } from "../src/home/widgets/data";
import {
  DEFAULT_ROUTINES,
  loadRoutineProgress,
  loadRoutines,
  ROUTINE_SLOT_META,
  type DailyRoutineProgress,
  type FamilyRoutine,
} from "../src/tasks/routines-api";
import { loadKitchenBundle } from "../src/meals/api";
import { resolveMemberStreak, loadLocalStreaks } from "../src/tasks/streaks";
import { useKudosJar } from "../src/rewards/kudos-jar";
import { useCountdowns, computeCountdownDays } from "../src/calendar/countdowns";
import { useCustomChecklists } from "../src/tasks/custom-lists";
import { readCachedMembers, FALLBACK_MEMBERS } from "../src/api/members";
import { isPhotoUri } from "../src/ui/MemberRail";
import type { ServerMember } from "../src/api/types";

export default function AnalyticsRoute() {
  const { colors, accentColor } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const { role: capabilityRole, hydrated } = useAuth();
  const { snapshot } = useSync();
  const [moreOpen, setMoreOpen] = useState(false);

  const [routines, setRoutines] = useState<FamilyRoutine[]>(DEFAULT_ROUTINES);
  const [routineProg, setRoutineProg] = useState<DailyRoutineProgress>({
    checkedSteps: {},
    completedRoutines: {},
  });
  const [weekMealsCount, setWeekMealsCount] = useState<number>(0);

  const { entries: kudosEntries } = useKudosJar();
  const { countdowns } = useCountdowns();
  const { lists: customLists } = useCustomChecklists();

  const [rosterMembers, setRosterMembers] = useState<ServerMember[]>(FALLBACK_MEMBERS);
  const [localStreaks, setLocalStreaks] = useState<Record<string, number>>({});

  const navRole = capabilityRole === "parent" ? "parent" : capabilityRole ? "child" : "guest";
  const todayISO = useMemo(() => localTodayISO(), []);

  useEffect(() => {
    let alive = true;
    void Promise.all([
      loadRoutines(),
      loadRoutineProgress(todayISO),
      loadKitchenBundle().catch(() => ({ meals: [], schedules: [] })),
      readCachedMembers().catch(() => FALLBACK_MEMBERS),
      loadLocalStreaks().catch(() => ({})),
    ]).then(([rList, rProg, kitchen, cached, streaks]) => {
      if (!alive) return;
      setRoutines(rList);
      setRoutineProg(rProg);
      const wk = weekStartMondayISO(new Date());
      setWeekMealsCount(kitchen.meals.filter((m) => (m.weekOf || wk) === wk).length);
      if (cached && cached.length > 0) {
        setRosterMembers(cached);
      }
      if (streaks) {
        setLocalStreaks(streaks);
      }
    }).catch(() => {});
    return () => {
      alive = false;
    };
  }, [todayISO]);

  const taskMetrics = useMemo(() => {
    const rawTasks = Array.isArray(snapshot?.tasks) ? (snapshot.tasks as any[]) : [];
    const completed = rawTasks.filter((t) => t?.completed === true).length;
    const pending = rawTasks.filter((t) => !t?.completed).length;
    const total = completed + pending;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { completed, pending, total, completionRate };
  }, [snapshot]);

  const memberPoints = useMemo(() => {
    const pts = snapshot?.weekData?.points ?? {};
    const streaks = snapshot?.weekData?.streak ?? {};
    const names = new Set<string>([
      ...Object.keys(pts),
      ...Object.keys(streaks),
      ...Object.keys(localStreaks),
    ]);
    if (names.size === 0) return [];
    return Array.from(names)
      .map((name) => {
        const streakInfo = resolveMemberStreak(snapshot?.weekData, name, localStreaks);
        return {
          name,
          points: Number(pts[name]) || 0,
          streak: streakInfo.count,
          streakInfo,
        };
      })
      .sort((a, b) => b.points - a.points || b.streak - a.streak);
  }, [snapshot, localStreaks]);

  const totalFamilyPoints = useMemo(
    () => memberPoints.reduce((acc, m) => acc + m.points, 0),
    [memberPoints],
  );

  const routinesDoneToday = useMemo(
    () => routines.filter((r) => routineProg.completedRoutines[r.id]).length,
    [routines, routineProg],
  );

  const nextCountdownInfo = useMemo(() => {
    const upcoming = (countdowns || [])
      .map((c) => ({
        ...c,
        computed: computeCountdownDays(c.targetDate),
      }))
      .filter((c) => c.computed.status !== "past" && c.computed.daysLeft >= 0)
      .sort((a, b) => a.computed.daysLeft - b.computed.daysLeft);
    return upcoming[0] ?? null;
  }, [countdowns]);

  const checklistStats = useMemo(() => {
    let packed = 0;
    let total = 0;
    for (const list of customLists || []) {
      for (const item of list.items || []) {
        total++;
        if (item.checked) {
          packed++;
        }
      }
    }
    return { packedItems: packed, totalChecklistItems: total };
  }, [customLists]);

  return (
    <Screen testID="analytics-route">
      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 16 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 180, gap: 20 }} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View>
            <Text
              style={{
                color: colors["color-text-muted"],
                fontSize: TYPOGRAPHY.label.fontSize,
                fontWeight: "700",
                letterSpacing: 2,
              }}
            >
              SCHEDULE & ROUTINE PATTERNS
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
              📊 Family Insights
            </Text>
          </View>

          {/* 4-Up KPI Tiles */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm }}>
            <Material tier="regular" style={{ width: "48.8%", borderRadius: RADII.xl, padding: SPACING.md, gap: 4 }}>
              <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
                ✅ CHORES COMPLETED
              </Text>
              <Text testID="insights-chores-done" style={{ color: colors["color-text-primary"], fontSize: 32, fontWeight: "800" }}>
                {`${taskMetrics.completed} / ${taskMetrics.total}`}
              </Text>
              <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize }}>
                {`${taskMetrics.completionRate}% weekly completion rate`}
              </Text>
            </Material>

            <Material tier="regular" style={{ width: "48.8%", borderRadius: RADII.xl, padding: SPACING.md, gap: 4 }}>
              <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
                ⏰ DAILY ROUTINES
              </Text>
              <Text testID="insights-routines-done" style={{ color: colors["color-text-primary"], fontSize: 32, fontWeight: "800" }}>
                {`${routinesDoneToday} / ${routines.length}`}
              </Text>
              <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize }}>
                Completed today across slots
              </Text>
            </Material>

            <Material tier="regular" style={{ width: "48.8%", borderRadius: RADII.xl, padding: SPACING.md, gap: 4 }}>
              <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
                🍽️ KITCHEN PLANNER
              </Text>
              <Text testID="insights-meals-planned" style={{ color: colors["color-text-primary"], fontSize: 32, fontWeight: "800" }}>
                {`${weekMealsCount} meals`}
              </Text>
              <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize }}>
                Scheduled for this week
              </Text>
            </Material>

            <Material tier="regular" style={{ width: "48.8%", borderRadius: RADII.xl, padding: SPACING.md, gap: 4 }}>
              <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
                🏆 FAMILY POINTS
              </Text>
              <Text testID="insights-family-points" style={{ color: colors["color-text-primary"], fontSize: 32, fontWeight: "800" }}>
                {`${totalFamilyPoints} pts`}
              </Text>
              <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize }}>
                Combined weekly race total
              </Text>
            </Material>
          </View>

          {/* Family Pulse & Readiness Digest */}
          <Material tier="thin" testID="insights-family-pulse-card" style={{ borderRadius: RADII.xl, padding: SPACING.md, gap: SPACING.md }}>
            <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.cardTitle.fontSize, fontWeight: "700" }}>
              🌟 Family Pulse & Readiness Digest
            </Text>

            {/* Kindness Jar */}
            <View
              testID="insights-pulse-kudos"
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: SPACING.sm,
              }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
                  💖 KINDNESS JAR
                </Text>
                <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "600" }}>
                  {`${kudosEntries.length} Kindness Stars in the Kudos Jar`}
                </Text>
              </View>
              <SoftButton
                variant="ghost"
                size="sm"
                style={{ minHeight: MIN_TARGET_DP, minWidth: MIN_TARGET_DP }}
                onPress={() => router.replace("/rewards" as never)}
              >
                Open Rewards →
              </SoftButton>
            </View>

            {/* Next Big Countdown */}
            <View
              testID="insights-pulse-countdown"
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: SPACING.sm,
              }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
                  ⏳ NEXT BIG COUNTDOWN
                </Text>
                <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "600" }}>
                  {nextCountdownInfo
                    ? `${nextCountdownInfo.emoji} ${nextCountdownInfo.title} · ${nextCountdownInfo.computed.badgeLabel}`
                    : "No upcoming countdowns pinned"}
                </Text>
              </View>
              <SoftButton
                variant="ghost"
                size="sm"
                style={{ minHeight: MIN_TARGET_DP, minWidth: MIN_TARGET_DP }}
                onPress={() => router.replace("/calendar" as never)}
              >
                Open Calendar →
              </SoftButton>
            </View>

            {/* Checklist Readiness */}
            <View
              testID="insights-pulse-checklists"
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: SPACING.sm,
              }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
                  🎒 CHECKLIST READINESS
                </Text>
                <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "600" }}>
                  {`${checklistStats.packedItems}/${checklistStats.totalChecklistItems} checklist items ready across ${customLists.length} lists`}
                </Text>
              </View>
              <SoftButton
                variant="ghost"
                size="sm"
                style={{ minHeight: MIN_TARGET_DP, minWidth: MIN_TARGET_DP }}
                onPress={() => router.replace("/tasks" as never)}
              >
                Open Lists →
              </SoftButton>
            </View>
          </Material>

          {/* Routine Rhythm Card */}
          <Material tier="thin" testID="insights-routines-card" style={{ borderRadius: RADII.xl, padding: SPACING.md, gap: SPACING.sm }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.cardTitle.fontSize, fontWeight: "700" }}>
                ⏰ Routine Rhythm by Time of Day
              </Text>
              <SoftButton
                variant="ghost"
                size="sm"
                testID="insights-open-routines"
                style={{ minHeight: MIN_TARGET_DP, minWidth: MIN_TARGET_DP }}
                onPress={() => router.replace("/tasks" as never)}
              >
                Open Routines →
              </SoftButton>
            </View>
            {routines.map((rt) => {
              const meta = ROUTINE_SLOT_META[rt.slot] ?? ROUTINE_SLOT_META.morning;
              const checked = (routineProg.checkedSteps[rt.id] ?? []).length;
              const total = rt.steps.length || 1;
              const pct = Math.min(100, Math.round((checked / total) * 100));
              const toneColor = colors[meta.toneKey] ?? accentColor;
              return (
                <View key={rt.id} style={{ gap: 6 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "600" }}>
                      {`${rt.emoji} ${rt.title} (${rt.time})`}
                    </Text>
                    <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
                      {`${checked}/${total} steps (${pct}%)`}
                    </Text>
                  </View>
                  <View style={{ height: 8, borderRadius: 4, backgroundColor: colors["color-surface-2"], overflow: "hidden" }}>
                    <View style={{ width: `${pct}%`, height: 8, backgroundColor: toneColor }} />
                  </View>
                </View>
              );
            })}
          </Material>

          {/* Member Momentum Card */}
          <Material tier="thin" testID="insights-members-card" style={{ borderRadius: RADII.xl, padding: SPACING.md, gap: SPACING.sm }}>
            <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.cardTitle.fontSize, fontWeight: "700" }}>
              🔥 Weekly Member Momentum & Streaks
            </Text>
            {memberPoints.length === 0 ? (
              <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.body.fontSize }}>
                Complete chores and routines this week to see member momentum bars.
              </Text>
            ) : (
              memberPoints.map((m) => {
                const maxPts = Math.max(50, memberPoints[0]?.points ?? 50);
                const pct = Math.min(100, Math.round((m.points / maxPts) * 100));
                const rosterMember =
                  rosterMembers.find((r) => r.name.toLowerCase() === m.name.toLowerCase()) ||
                  rosterMembers.find(
                    (r) => r.name.split(" ")[0].toLowerCase() === m.name.split(" ")[0].toLowerCase()
                  ) ||
                  FALLBACK_MEMBERS.find((f) => f.name.toLowerCase() === m.name.toLowerCase()) ||
                  FALLBACK_MEMBERS.find(
                    (f) => f.name.split(" ")[0].toLowerCase() === m.name.split(" ")[0].toLowerCase()
                  );
                const avatar = rosterMember?.emoji || "👤";
                const isPhoto = isPhotoUri(avatar);
                const milestone = m.streakInfo.currentMilestone;

                return (
                  <View key={m.name} style={{ gap: 6 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1, flexWrap: "wrap" }}>
                        {isPhoto ? (
                          <Image
                            testID={`insights-member-img-${m.name}`}
                            source={{ uri: avatar }}
                            style={{ width: 24, height: 24, borderRadius: 12 }}
                          />
                        ) : (
                          <Text style={{ fontSize: 18 }}>{avatar}</Text>
                        )}
                        <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
                          {`${m.name}${m.streak > 0 ? ` · 🔥 ${m.streak}d streak` : ""}`}
                        </Text>
                        {milestone && (
                          <View
                            testID={`insights-member-badge-${m.name}`}
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              paddingHorizontal: 8,
                              paddingVertical: 2,
                              borderRadius: RADII.sm,
                              backgroundColor: colors["color-surface-2"],
                            }}
                          >
                            <Text
                              style={{
                                color: colors["color-text-secondary"],
                                fontSize: TYPOGRAPHY.label.fontSize,
                                fontWeight: "700",
                              }}
                            >
                              {`${milestone.badge} ${milestone.title}`}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
                        {`${m.points} pts`}
                      </Text>
                    </View>
                    <View style={{ height: 8, borderRadius: 4, backgroundColor: colors["color-surface-2"], overflow: "hidden" }}>
                      <View style={{ width: `${pct}%`, height: 8, backgroundColor: mix(accentColor, "transparent", 85) }} />
                    </View>
                  </View>
                );
              })
            )}
          </Material>

          {/* Consuela Smart Pattern Recommendations */}
          <Material tier="thin" style={{ borderRadius: RADII.xl, padding: SPACING.md, gap: SPACING.sm }}>
            <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.cardTitle.fontSize, fontWeight: "700" }}>
              ✨ Consuela Pattern Notes
            </Text>
            <View style={{ gap: SPACING.xs }}>
              <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.body.fontSize }}>
                • Morning routines finish fastest when checked off before 7:45 AM.
              </Text>
              <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.body.fontSize }}>
                {`• ${taskMetrics.pending} open chores are waiting on the board — claiming early earns speed bonuses.`}
              </Text>
              <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.body.fontSize }}>
                {`• ${weekMealsCount} meals are planned in the Kitchen this week — sync missing ingredients to Grocery in one tap.`}
              </Text>
            </View>
          </Material>
        </ScrollView>
      </View>

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
