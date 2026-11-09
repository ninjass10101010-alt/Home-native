import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
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
import { useSync } from "../src/state/SyncManager";
import { Modal } from "../src/ui/Modal";
import { SoftButton } from "../src/ui/SoftButton";
import { TextField } from "../src/ui/TextField";
import { useToast } from "../src/ui/Toast";
import { CelebrationOverlay, type CelebrationEvent } from "../src/ui/CelebrationOverlay";
import { useCharacterTheme } from "../src/theme/characterTheme";
import {
  ALLOWANCE_JAR_META,
  useAllowanceJars,
  type AllowanceJarId,
} from "../src/rewards/allowance-jars";

const MOUNTAIN_STORAGE_KEY = "@consuela/money_mountain_v1";

interface SavingsGoal {
  id: string;
  title: string;
  emoji: string;
  saved: number;
  target: number;
  owner: string;
}

const DEFAULT_SAVINGS_GOALS: SavingsGoal[] = [
  { id: "mg-1", title: "Collector Building Set", emoji: "🧱", saved: 35, target: 60, owner: "Kids" },
  { id: "mg-2", title: "Mountain Bike Upgrade", emoji: "🚲", saved: 80, target: 150, owner: "Kids" },
  { id: "mg-3", title: "Family Adventure Day", emoji: "🎢", saved: 120, target: 200, owner: "Family" },
];

function altitudeLabel(pct: number): string {
  if (pct >= 100) return "🏔️ Summit Reached!";
  if (pct >= 75) return "☁️ High Camp (75%+)";
  if (pct >= 50) return "🌲 Timberline (50%+)";
  if (pct >= 25) return "⛺ Base Camp (25%+)";
  return "🥾 Trailhead";
}

export default function MoneyMountainRoute() {
  const { colors, accentColor } = useTheme();
  const toast = useToast();
  const pathname = usePathname();
  const router = useRouter();
  const { member, role: capabilityRole, hydrated } = useAuth();
  const { snapshot } = useSync();
  const [moreOpen, setMoreOpen] = useState(false);

  const isSignedIn = capabilityRole !== null;
  const [characterPrefs] = useCharacterTheme();
  const [celebrationEvent, setCelebrationEvent] = useState<CelebrationEvent | null>(null);
  const { jars, adjustJar } = useAllowanceJars();

  const [goals, setGoals] = useState<SavingsGoal[]>(DEFAULT_SAVINGS_GOALS);
  const [modalOpen, setModalOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftEmoji, setDraftEmoji] = useState("🎯");
  const [draftTarget, setDraftTarget] = useState("100");

  const navRole = capabilityRole === "parent" ? "parent" : capabilityRole ? "child" : "guest";

  useEffect(() => {
    let alive = true;
    void AsyncStorage.getItem(MOUNTAIN_STORAGE_KEY)
      .then((raw) => {
        if (!alive || !raw) return;
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) setGoals(parsed);
        } catch {
          // ignore
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const persistGoals = useCallback(async (next: SavingsGoal[]) => {
    setGoals(next);
    try {
      await AsyncStorage.setItem(MOUNTAIN_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }, []);

  const totalSaved = useMemo(() => goals.reduce((acc, g) => acc + g.saved, 0), [goals]);
  const totalTarget = useMemo(() => goals.reduce((acc, g) => acc + g.target, 0), [goals]);
  const overallPct = totalTarget > 0 ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : 0;

  const weekPoints = useMemo(() => {
    const pts = snapshot?.weekData?.points;
    if (!pts) return 0;
    if (member?.name && typeof pts[member.name] === "number") return pts[member.name];
    return Object.values(pts).reduce((acc, v) => acc + (Number(v) || 0), 0);
  }, [snapshot, member]);

  const jarToneColor = useCallback(
    (tone: string) => {
      switch (tone) {
        case "cyan":
          return colors["color-accent-cyan"] ?? accentColor;
        case "mint":
          return colors["color-accent-mint"] ?? accentColor;
        case "coral":
          return colors["color-accent-coral"] ?? accentColor;
        default:
          return accentColor;
      }
    },
    [colors, accentColor],
  );

  const handleJarAdjust = useCallback(
    async (jarId: AllowanceJarId, amount: number) => {
      const nextState = await adjustJar(jarId, amount);
      const meta = ALLOWANCE_JAR_META.find((m) => m.id === jarId);
      const sign = amount >= 0 ? `+${amount}` : `${amount}`;
      toast.show(`${sign} to ${meta?.title ?? jarId}!`, { intent: "success" });
      return nextState;
    },
    [adjustJar, toast],
  );

  const handleDeposit = useCallback(
    async (goalId: string, amount: number) => {
      const next = goals.map((g) =>
        g.id === goalId ? { ...g, saved: Math.min(g.target * 2, Math.max(0, g.saved + amount)) } : g,
      );
      await persistGoals(next);
      const targetGoal = next.find((g) => g.id === goalId);
      if (targetGoal && targetGoal.saved >= targetGoal.target) {
        toast.show(`🏔️ Summit reached for "${targetGoal.title}"!`, { intent: "success" });
        if (characterPrefs.enabled) {
          setCelebrationEvent({
            kind: "reward",
            memberName: member?.name || "Family",
            title: `Summit Reached: ${targetGoal.title}!`,
            points: targetGoal.target,
          });
        }
      } else {
        toast.show(`Added +${amount} to "${targetGoal?.title ?? "Goal"}"!`, { intent: "success" });
      }
    },
    [goals, persistGoals, toast, characterPrefs.enabled, member],
  );

  const handleAddGoal = useCallback(async () => {
    if (!draftTitle.trim()) return;
    const entry: SavingsGoal = {
      id: `mg-${Date.now()}`,
      title: draftTitle.trim(),
      emoji: draftEmoji.trim() || "🏔️",
      saved: 0,
      target: Math.max(10, Math.round(Number(draftTarget) || 100)),
      owner: member?.name ?? "Family",
    };
    await persistGoals([...goals, entry]);
    setModalOpen(false);
    setDraftTitle("");
    toast.show(`Created "${entry.title}" climb!`, { intent: "success" });
  }, [draftTitle, draftEmoji, draftTarget, member, goals, persistGoals, toast]);

  return (
    <Screen testID="money-mountain-route">
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
                SAVINGS GOALS & ALLOWANCE
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
                ⛰️ Money Mountain
              </Text>
            </View>
            <SoftButton
              variant="primary"
              size="sm"
              testID="mountain-add-goal"
              accessibilityLabel="Add new savings goal"
              style={{ minHeight: MIN_TARGET_DP, minWidth: MIN_TARGET_DP }}
              onPress={() => setModalOpen(true)}
            >
              + New Climb Goal
            </SoftButton>
          </View>

          {/* Summit Overview Banner */}
          <Material tier="regular" style={{ borderRadius: RADII.xl, padding: SPACING.md, gap: SPACING.sm }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ gap: 4 }}>
                <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
                  TOTAL MOUNTAIN ALTITUDE
                </Text>
                <Text testID="mountain-total-saved" style={{ color: colors["color-text-primary"], fontSize: 34, fontWeight: "800" }}>
                  {`${totalSaved} / ${totalTarget} saved (${overallPct}%)`}
                </Text>
                <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize }}>
                  {`${altitudeLabel(overallPct)} · ${weekPoints} chore pts earned this week`}
                </Text>
              </View>
              <Text style={{ fontSize: 40 }}>🏔️</Text>
            </View>
            <View style={{ height: 10, borderRadius: 5, backgroundColor: colors["color-surface-2"], overflow: "hidden" }}>
              <View style={{ width: `${overallPct}%`, height: 10, backgroundColor: colors["color-accent-mint"] ?? accentColor }} />
            </View>
          </Material>

          {/* 3-Jar Family Allowance Split (Spend · Save · Give) */}
          <Material tier="regular" testID="mountain-jars-card" style={{ borderRadius: RADII.xl, padding: SPACING.md, gap: SPACING.md }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ gap: 4 }}>
                <Text
                  style={{
                    color: colors["color-text-secondary"],
                    fontSize: TYPOGRAPHY.label.fontSize,
                    fontWeight: "700",
                    letterSpacing: 1.5,
                  }}
                >
                  3-JAR FAMILY ALLOWANCE SPLIT
                </Text>
                <Text
                  style={{
                    color: colors["color-text-primary"],
                    fontSize: TYPOGRAPHY.cardTitle.fontSize,
                    fontWeight: "800",
                  }}
                >
                  🏦 Spend · Save · Give Jars
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: SPACING.md }}>
              {ALLOWANCE_JAR_META.map((meta) => {
                const toneColor = jarToneColor(meta.tone);
                const balance = jars[meta.id] ?? 0;
                return (
                  <Material
                    key={meta.id}
                    tier="thin"
                    testID={`mountain-jar-${meta.id}`}
                    style={{
                      flex: 1,
                      borderRadius: RADII.lg,
                      padding: SPACING.md,
                      gap: SPACING.sm,
                      borderWidth: 1,
                      borderColor: colors["color-border-subtle"],
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: SPACING.xs }}>
                      <Text style={{ fontSize: 28 }}>{meta.emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            color: colors["color-text-primary"],
                            fontSize: TYPOGRAPHY.body.fontSize,
                            fontWeight: "700",
                          }}
                        >
                          {meta.title}
                        </Text>
                        <Text
                          style={{
                            color: colors["color-text-muted"],
                            fontSize: TYPOGRAPHY.label.fontSize,
                          }}
                          numberOfLines={1}
                        >
                          {meta.subtitle}
                        </Text>
                      </View>
                    </View>

                    <Text
                      testID={`mountain-jar-balance-${meta.id}`}
                      style={{
                        color: toneColor,
                        fontSize: 32,
                        fontWeight: "800",
                        marginVertical: 4,
                      }}
                    >
                      {`$${balance}`}
                    </Text>

                    <View style={{ flexDirection: "row", gap: SPACING.xs, flexWrap: "wrap" }}>
                      <SoftButton
                        variant="primary"
                        size="sm"
                        testID={`mountain-jar-add5-${meta.id}`}
                        accessibilityLabel={`Add 5 to ${meta.title}`}
                        style={{ minHeight: MIN_TARGET_DP, minWidth: MIN_TARGET_DP }}
                        onPress={() => void handleJarAdjust(meta.id, 5)}
                      >
                        +5
                      </SoftButton>
                      {isSignedIn ? (
                        <SoftButton
                          variant="secondary"
                          size="sm"
                          testID={`mountain-jar-sub5-${meta.id}`}
                          accessibilityLabel={`Subtract 5 from ${meta.title}`}
                          style={{ minHeight: MIN_TARGET_DP, minWidth: MIN_TARGET_DP }}
                          onPress={() => void handleJarAdjust(meta.id, -5)}
                        >
                          -5
                        </SoftButton>
                      ) : null}
                    </View>
                  </Material>
                );
              })}
            </View>
          </Material>

          {/* Individual Climb Goal Cards */}
          <View style={{ gap: SPACING.md }}>
            {goals.map((goal) => {
              const pct = goal.target > 0 ? Math.min(100, Math.round((goal.saved / goal.target) * 100)) : 0;
              const done = pct >= 100;
              return (
                <Material
                  key={goal.id}
                  tier="thin"
                  testID={`mountain-goal-${goal.id}`}
                  style={{
                    borderRadius: RADII.xl,
                    padding: SPACING.md,
                    gap: SPACING.sm,
                    borderWidth: 1,
                    borderColor: done ? mix(colors["color-accent-mint"] ?? accentColor, "transparent", 45) : colors["color-border-subtle"],
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SPACING.sm }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: SPACING.sm, flex: 1 }}>
                      <Text style={{ fontSize: 30 }}>{goal.emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.cardTitle.fontSize, fontWeight: "700" }}>
                          {goal.title}
                        </Text>
                        <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }}>
                          {`${altitudeLabel(pct)} · ${goal.owner}`}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.cardTitle.fontSize, fontWeight: "800" }}>
                      {`${goal.saved} / ${goal.target}`}
                    </Text>
                  </View>

                  <View style={{ height: 10, borderRadius: 5, backgroundColor: colors["color-surface-2"], overflow: "hidden" }}>
                    <View
                      style={{
                        width: `${pct}%`,
                        height: 10,
                        backgroundColor: done ? colors["color-accent-mint"] ?? accentColor : accentColor,
                      }}
                    />
                  </View>

                  <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: SPACING.xs }}>
                    <SoftButton
                      variant="secondary"
                      size="sm"
                      testID={`mountain-deposit-5-${goal.id}`}
                      accessibilityLabel={`Add 5 to ${goal.title}`}
                      style={{ minHeight: MIN_TARGET_DP, minWidth: MIN_TARGET_DP }}
                      onPress={() => void handleDeposit(goal.id, 5)}
                    >
                      + Add 5
                    </SoftButton>
                    <SoftButton
                      variant="primary"
                      size="sm"
                      testID={`mountain-deposit-10-${goal.id}`}
                      accessibilityLabel={`Add 10 to ${goal.title}`}
                      style={{ minHeight: MIN_TARGET_DP, minWidth: MIN_TARGET_DP }}
                      onPress={() => void handleDeposit(goal.id, 10)}
                    >
                      ⛰️ Climb +10
                    </SoftButton>
                  </View>
                </Material>
              );
            })}
          </View>
        </ScrollView>
      </View>

      <Modal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New Mountain Climb Goal"
        description="Set a savings target to climb toward"
        testID="mountain-goal-modal"
      >
        <View style={{ gap: SPACING.md }}>
          <TextField
            testID="mountain-goal-title"
            label="Goal Name"
            placeholder="e.g. New Skateboard"
            value={draftTitle}
            onChangeText={setDraftTitle}
          />
          <View style={{ flexDirection: "row", gap: SPACING.sm }}>
            <View style={{ flex: 1 }}>
              <TextField
                testID="mountain-goal-emoji"
                label="Emoji"
                placeholder="🛹"
                value={draftEmoji}
                onChangeText={setDraftEmoji}
              />
            </View>
            <View style={{ flex: 2 }}>
              <TextField
                testID="mountain-goal-target"
                label="Target Amount"
                placeholder="100"
                value={draftTarget}
                onChangeText={setDraftTarget}
                keyboardType="numeric"
              />
            </View>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: SPACING.sm }}>
            <SoftButton
              variant="ghost"
              style={{ minHeight: MIN_TARGET_DP, minWidth: MIN_TARGET_DP }}
              onPress={() => setModalOpen(false)}
            >
              Cancel
            </SoftButton>
            <SoftButton
              variant="primary"
              testID="mountain-goal-save"
              style={{ minHeight: MIN_TARGET_DP, minWidth: MIN_TARGET_DP }}
              disabled={!draftTitle.trim()}
              onPress={() => void handleAddGoal()}
            >
              Start Climb
            </SoftButton>
          </View>
        </View>
      </Modal>

      <CelebrationOverlay
        event={celebrationEvent}
        onDismiss={() => setCelebrationEvent(null)}
      />

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
