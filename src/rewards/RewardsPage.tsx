import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { Material } from "../theme/Material";
import { FONTS, MIN_TARGET_DP, RADII, SPACING, TYPOGRAPHY } from "../theme/tokens";
import { mix } from "../theme/mix";
import { useAuth } from "../state/AuthProvider";
import { useSync } from "../state/SyncManager";
import { useToast } from "../ui/Toast";
import { Modal } from "../ui/Modal";
import { PinPad } from "../ui/PinPad";
import { SoftButton } from "../ui/SoftButton";
import { TextField } from "../ui/TextField";
import { EmptyState } from "../ui/EmptyState";
import { isPhotoUri } from "../ui/MemberRail";
import { readCachedMembers } from "../api/members";
import {
  celebrateHallOfFame,
  CURATED_REWARD_TEMPLATES,
  fetchAllTimeTotals,
  fetchDbCollection,
  loadCustomRewards,
  loadLocalFamilyGoals,
  loadRewardPasses,
  redeemReward,
  REWARD_CATEGORIES,
  saveCustomRewards,
  saveLocalFamilyGoals,
  saveRewardPasses,
  type CustomRewardItem,
  type LocalFamilyGoal,
  type RewardPass,
} from "./api";
import { newOperationId } from "../tasks/claim";

interface RewardRow {
  id: string | number;
  name?: string;
  title?: string;
  emoji?: string;
  cost?: number;
  points?: number;
  category?: string;
}

const EMOJI_CHOICES = ["🍦", "🎮", "🎬", "🌙", "🍕", "🛡️", "🕹️", "🎟️", "🧸", "🎨"];

function rewardTitle(r: RewardRow): string {
  const v = r.name ?? r.title;
  return typeof v === "string" && v.trim() ? v.trim() : "Reward";
}
function rewardCost(r: RewardRow): number {
  const v = r.cost ?? r.points;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function rewardEmoji(r: RewardRow): string {
  return typeof r.emoji === "string" && r.emoji.trim() ? r.emoji.trim() : "🎁";
}

function readRewards(snapshot: any): RewardRow[] {
  const raw = snapshot?.rewards;
  return Array.isArray(raw) ? (raw as RewardRow[]) : [];
}

export function RewardsPage() {
  const { colors, accentColor } = useTheme();
  const toast = useToast();
  const { member } = useAuth();
  const { snapshot, stale, refreshNow, onPulse } = useSync();

  const serverRewards = useMemo(() => readRewards(snapshot), [snapshot]);
  const weekData = (snapshot?.weekData ?? undefined) as any;

  const [customRewards, setCustomRewards] = useState<CustomRewardItem[]>([]);
  const [passes, setPasses] = useState<RewardPass[]>([]);
  const [localGoals, setLocalGoals] = useState<LocalFamilyGoal[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  // Add Reward composer state
  const [composerOpen, setComposerOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftEmoji, setDraftEmoji] = useState("🍦");
  const [draftCost, setDraftCost] = useState("50");
  const [draftCategory, setDraftCategory] = useState("Treats");

  // Add Family Goal modal state
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalEmoji, setGoalEmoji] = useState("🍕");
  const [goalTarget, setGoalTarget] = useState("250");

  const [allTimePoints, setAllTimePoints] = useState<number | null>(null);
  const [historyComplete, setHistoryComplete] = useState<boolean>(false);
  const [allTimeLoaded, setAllTimeLoaded] = useState(false);

  const [goals, setGoals] = useState<any[]>([]);
  const [prizes, setPrizes] = useState<any[]>([]);
  const [hof, setHof] = useState<any[]>([]);
  const [cachedParents, setCachedParents] = useState<{ name: string; emoji?: string }[]>([]);

  const [busy, setBusy] = useState(false);
  const [redeemRewardState, setRedeemRewardState] = useState<RewardRow | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinAttempt, setPinAttempt] = useState(0);

  const [highCostReward, setHighCostReward] = useState<RewardRow | null>(null);
  const [memberPin, setMemberPin] = useState<string | null>(null);
  const [parentName, setParentName] = useState("");
  const [parentPin, setParentPin] = useState("");
  const [parentError, setParentError] = useState<string | null>(null);

  const [purchasing, setPurchasing] = useState<RewardRow | null>(null);

  const loadConfig = useCallback(async () => {
    const [g, p, h, cRewards, savedPasses, savedGoals] = await Promise.all([
      fetchDbCollection("family_goals"),
      fetchDbCollection("weekly_prizes"),
      fetchDbCollection("hall_of_fame"),
      loadCustomRewards(),
      loadRewardPasses(),
      loadLocalFamilyGoals(),
    ]);
    setGoals(g);
    setPrizes(p);
    setHof(h);
    setCustomRewards(cRewards);
    setPasses(savedPasses);
    setLocalGoals(savedGoals);
  }, []);

  const loadAllTime = useCallback(async () => {
    setAllTimeLoaded(false);
    const payload: any = await fetchAllTimeTotals();
    if (payload && payload.historyComplete === true) {
      setHistoryComplete(true);
      let pts: number | null = null;
      if (payload.totals && member) {
        const t = payload.totals[member.name];
        if (t && typeof t === "object" && typeof t.points === "number") pts = t.points;
        else if (typeof t === "number") pts = t;
      }
      if (pts === null && payload.points && member) {
        const v = (payload.points as any)[member.name];
        if (typeof v === "number") pts = v;
      }
      setAllTimePoints(pts);
    } else {
      setHistoryComplete(false);
      setAllTimePoints(null);
    }
    setAllTimeLoaded(true);
  }, [member]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount fetch seam: loadConfig's state lands async (cache read then fetch)
    void loadConfig();
    void loadAllTime();
    let alive = true;
    void readCachedMembers().then((rows) => {
      if (!alive) return;
      setCachedParents(
        rows
          .filter((r: any) => String(r?.role ?? "").toLowerCase() === "parent" && (r.name || "").trim())
          .map((r: any) => ({ name: r.name, emoji: r.emoji })),
      );
    });
    return () => {
      alive = false;
    };
  }, [loadConfig, loadAllTime]);

  useEffect(() => onPulse(() => void loadConfig()), [onPulse, loadConfig]);

  const weekPoints = useMemo(() => {
    if (!member) return 0;
    const pts = weekData?.points;
    const v = pts?.[member.name];
    return typeof v === "number" ? v : 0;
  }, [member, weekData]);

  const availablePoints = useMemo(() => {
    if (historyComplete && typeof allTimePoints === "number") {
      return Math.max(weekPoints, allTimePoints);
    }
    return weekPoints;
  }, [historyComplete, allTimePoints, weekPoints]);

  const rewards = useMemo<RewardRow[]>(() => {
    return [...serverRewards, ...customRewards];
  }, [serverRewards, customRewards]);

  const filteredRewards = useMemo(() => {
    return rewards.filter((r) => {
      if (selectedCategory === "All") return true;
      if (selectedCategory === "⭐ Affordable") {
        return rewardCost(r) <= availablePoints;
      }
      return (r.category ?? "Treats").toLowerCase() === selectedCategory.toLowerCase();
    });
  }, [rewards, selectedCategory, availablePoints]);

  const combinedGoals = useMemo(() => {
    return [...goals, ...localGoals];
  }, [goals, localGoals]);

  const closeRedeem = useCallback(() => {
    setRedeemRewardState(null);
    setPinError(null);
  }, []);

  const recordRedeemedPass = useCallback(
    (reward: RewardRow, ownerName: string) => {
      const pass: RewardPass = {
        id: `pass-${Date.now()}`,
        rewardId: reward.id,
        rewardName: rewardTitle(reward),
        emoji: rewardEmoji(reward),
        cost: rewardCost(reward),
        memberName: ownerName,
        redeemedAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        used: false,
      };
      const next = [pass, ...passes];
      setPasses(next);
      void saveRewardPasses(next);
    },
    [passes],
  );

  const runRedeem = useCallback(
    async (reward: RewardRow, pin: string, parent?: { name: string; pin: string }) => {
      if (!member || busy) return;
      setBusy(true);
      try {
        await redeemReward({
          rewardId: reward.id,
          rewardName: rewardTitle(reward),
          memberName: member.name,
          pin,
          ...(parent ? { parentName: parent.name, parentPin: parent.pin } : {}),
        });
        recordRedeemedPass(reward, member.name);
        setPurchasing(reward);
        closeRedeem();
        setHighCostReward(null);
        setMemberPin(null);
        setParentName("");
        setParentPin("");
        setParentError(null);
        await refreshNow();
        toast.show("Redeemed! Added to your passes 🎟️", { intent: "success" });
      } catch (e: any) {
        if (e?.status === 401 && e?.code === "unauthorized") {
          setPinError("Wrong PIN — try again.");
          setPinAttempt((n) => n + 1);
        } else if (highCostReward) {
          setParentError("Parent approval failed — try again.");
        } else {
          toast.show("That didn't go through — try again.", { intent: "error" });
        }
      } finally {
        setBusy(false);
      }
      void newOperationId;
    },
    [member, busy, recordRedeemedPass, closeRedeem, highCostReward, refreshNow, toast],
  );

  const openRedeem = useCallback(
    (reward: RewardRow) => {
      const cost = rewardCost(reward);
      if (cost > 100) {
        setHighCostReward(reward);
        setMemberPin(null);
        setParentName(cachedParents[0]?.name ?? (member?.role === "parent" ? member.name : ""));
        setParentPin("");
        setParentError(null);
      } else {
        setRedeemRewardState(reward);
        setPinError(null);
      }
    },
    [cachedParents, member],
  );

  const onMemberVerified = useCallback(
    (pin: string) => {
      if (!highCostReward) return;
      setMemberPin(pin);
    },
    [highCostReward],
  );

  const uncelebratedHof = useMemo(() => {
    return (hof || []).filter((r: any) => {
      const rank = Number(r?.rank);
      const prize = r?.prize;
      const celebrated = r?.celebrated === true;
      return Number.isFinite(rank) && rank >= 1 && rank <= 3 && typeof prize === "string" && prize.length > 0 && !celebrated;
    });
  }, [hof]);

  const handleCelebrate = useCallback(
    async (entry: any) => {
      try {
        await celebrateHallOfFame({
          id: entry?.id,
          memberName: entry?.member,
          weekStart: entry?.weekStart,
        });
        toast.show("Celebrated! 🎉", { intent: "success" });
        await refreshNow();
        setHof((prev) =>
          prev.map((r: any) => (r?.id === entry?.id ? { ...r, celebrated: true } : r)),
        );
      } catch {
        toast.show("Couldn't celebrate — try again.", { intent: "error" });
      }
    },
    [refreshNow, toast],
  );

  const handleSaveCustomReward = useCallback(async () => {
    if (!draftName.trim()) return;
    const costNum = Math.max(5, Math.round(Number(draftCost) || 50));
    const entry: CustomRewardItem = {
      id: `custom-${Date.now()}`,
      name: draftName.trim(),
      emoji: draftEmoji || "🎁",
      cost: costNum,
      category: draftCategory || "Treats",
    };
    const next = [...customRewards, entry];
    setCustomRewards(next);
    await saveCustomRewards(next);
    setComposerOpen(false);
    setDraftName("");
    toast.show(`Added "${entry.name}" to the Reward Shop`, { intent: "success" });
  }, [draftName, draftCost, draftEmoji, draftCategory, customRewards, toast]);

  const handleDeleteCustomReward = useCallback(
    async (id: string | number) => {
      const next = customRewards.filter((r) => String(r.id) !== String(id));
      setCustomRewards(next);
      await saveCustomRewards(next);
      toast.show("Removed reward", { intent: "info" });
    },
    [customRewards, toast],
  );

  const handleLoadStarterPack = useCallback(async () => {
    const starter: CustomRewardItem[] = CURATED_REWARD_TEMPLATES.map((tpl, idx) => ({
      ...tpl,
      id: `custom-starter-${idx + 1}`,
    }));
    setCustomRewards(starter);
    await saveCustomRewards(starter);
    toast.show("Loaded 7 family starter rewards! 🛍️", { intent: "success" });
  }, [toast]);

  const handleTogglePassUsed = useCallback(
    async (passId: string) => {
      const next = passes.map((p) => (p.id === passId ? { ...p, used: !p.used } : p));
      setPasses(next);
      await saveRewardPasses(next);
      toast.show("Updated reward pass status", { intent: "success" });
    },
    [passes, toast],
  );

  const handleAddFamilyGoal = useCallback(async () => {
    if (!goalTitle.trim()) return;
    const entry: LocalFamilyGoal = {
      id: `goal-${Date.now()}`,
      title: goalTitle.trim(),
      emoji: goalEmoji || "🎯",
      targetPoints: Math.max(25, Math.round(Number(goalTarget) || 200)),
    };
    const next = [...localGoals, entry];
    setLocalGoals(next);
    await saveLocalFamilyGoals(next);
    setGoalModalOpen(false);
    setGoalTitle("");
    toast.show(`Added family goal "${entry.title}"`, { intent: "success" });
  }, [goalTitle, goalEmoji, goalTarget, localGoals, toast]);

  const allTimeLabel = !allTimeLoaded
    ? "…"
    : historyComplete && typeof allTimePoints === "number"
      ? String(allTimePoints)
      : "—";

  const firstParent = cachedParents[0];

  return (
    <View testID="rewards-page" style={{ flex: 1, paddingHorizontal: 24, paddingTop: 16 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 180, gap: 20 }} showsVerticalScrollIndicator={false}>
        {/* Header: uppercase REWARD SHOP eyebrow + 44sp editorial serif Rewards title */}
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
              REWARD SHOP
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
              🏪 Rewards
            </Text>
            {stale && member ? (
              <Text style={{ color: colors["color-accent-amber"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "600", marginTop: 6 }}>
                {"Couldn't refresh — showing the last board we read."}
              </Text>
            ) : null}
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: SPACING.xs }}>
            <SoftButton
              variant="secondary"
              size="sm"
              testID="rewards-add-goal-button"
              accessibilityLabel="Add family goal"
              onPress={() => setGoalModalOpen(true)}
            >
              🎯 + Family Goal
            </SoftButton>
            <SoftButton
              variant="primary"
              size="sm"
              testID="rewards-add-button"
              accessibilityLabel="Add reward to shop"
              onPress={() => setComposerOpen(true)}
            >
              + Add Reward
            </SoftButton>
          </View>
        </View>

        {/* Upgraded StatTiles: Material regular tier with tabular-nums */}
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Material
            tier="regular"
            tone={colors["color-accent-amber"] ?? accentColor}
            style={{
              flex: 1,
              height: 96,
              borderRadius: 24,
              paddingHorizontal: 18,
              paddingVertical: 14,
              justifyContent: "center",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    backgroundColor: mix(colors["color-accent-amber"] ?? accentColor, "transparent", 20),
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontSize: 22 }}>⭐</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
                  <Text
                    testID="rewards-points-week"
                    style={{
                      color: colors["color-text-primary"],
                      fontSize: 34,
                      fontWeight: "800",
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {weekPoints}
                  </Text>
                  <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "600" }}>
                    pts
                  </Text>
                </View>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
                  This week
                </Text>
                <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize }}>
                  Current race
                </Text>
              </View>
            </View>
          </Material>

          <Material
            tier="regular"
            tone={colors["color-accent-violet"] ?? accentColor}
            style={{
              flex: 1,
              height: 96,
              borderRadius: 24,
              paddingHorizontal: 18,
              paddingVertical: 14,
              justifyContent: "center",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    backgroundColor: mix(colors["color-accent-violet"] ?? accentColor, "transparent", 20),
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontSize: 22 }}>🏆</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
                  <Text
                    testID="rewards-points-alltime"
                    style={{
                      color: colors["color-text-primary"],
                      fontSize: 34,
                      fontWeight: "800",
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {allTimeLabel}
                  </Text>
                  <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "600" }}>
                    pts
                  </Text>
                </View>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
                  All time
                </Text>
                <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize }}>
                  Yours to keep
                </Text>
              </View>
            </View>
          </Material>
        </View>

        {uncelebratedHof.length > 0 ? (
          <Material
            tier="thin"
            testID="hall-of-fame-banner"
            style={{ borderRadius: 20, padding: 16, gap: 8, borderWidth: 1, borderColor: mix(colors["color-accent-amber"], "transparent", 40) }}
          >
            {uncelebratedHof.map((entry: any, i: number) => (
              <View key={String(entry?.id ?? i)} style={{ gap: 8 }}>
                <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
                  🏆 Weekly win — {entry?.member} ({entry?.prize})
                </Text>
                <SoftButton
                  variant="success"
                  testID={`celebrate-${entry?.id ?? i}`}
                  onPress={() => void handleCelebrate(entry)}
                >
                  🎉 Celebrate
                </SoftButton>
              </View>
            ))}
          </Material>
        ) : null}

        {/* Category & Affordability Filter Strip */}
        {rewards.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACING.xs }}>
            {REWARD_CATEGORIES.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <Pressable
                  key={cat}
                  testID={`rewards-filter-${cat}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Filter rewards by ${cat}`}
                  accessibilityState={{ selected: active }}
                  onPress={() => setSelectedCategory(cat)}
                  style={{
                    minHeight: MIN_TARGET_DP,
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
                      fontWeight: active ? "700" : "600",
                    }}
                  >
                    {cat}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {/* Upgraded Reward Cards in Material regular tier */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {rewards.length === 0 ? (
            <View style={{ width: "100%" }}>
              <EmptyState
                icon="🛍️"
                title="No rewards yet"
                body="Ask a parent to add rewards in Settings."
                actionLabel="✨ Load Family Starter Pack"
                onAction={() => void handleLoadStarterPack()}
              />
            </View>
          ) : filteredRewards.length === 0 ? (
            <View style={{ width: "100%" }}>
              <EmptyState
                icon="🔍"
                title="No rewards in this filter"
                body="Switch back to All to browse every reward in the shop."
              />
            </View>
          ) : (
            filteredRewards.map((r) => {
              const cost = rewardCost(r);
              const id = r.id;
              const isCustom = String(id).startsWith("custom-");
              const progressPct = cost > 0 ? Math.min(100, Math.round((availablePoints / cost) * 100)) : 100;
              const canAfford = availablePoints >= cost;
              return (
                <Material
                  key={String(id)}
                  testID={`reward-card-${id}`}
                  tier="regular"
                  tone={accentColor}
                  style={{
                    width: "48.8%",
                    minHeight: 176,
                    borderRadius: 24,
                    padding: 16,
                    justifyContent: "space-between",
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 16,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: mix(accentColor, "transparent", 22),
                        borderWidth: 1,
                        borderColor: mix(accentColor, "transparent", 40),
                      }}
                    >
                      <Text style={{ fontSize: 28 }}>{rewardEmoji(r)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: colors["color-text-primary"],
                          fontSize: TYPOGRAPHY.body.fontSize,
                          fontWeight: "700",
                        }}
                        numberOfLines={2}
                      >
                        {rewardTitle(r)}
                      </Text>
                      {r.category ? (
                        <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize, marginTop: 2 }}>
                          {r.category}
                        </Text>
                      ) : null}
                    </View>
                    {isCustom ? (
                      <Pressable
                        testID={`reward-delete-${id}`}
                        accessibilityRole="button"
                        accessibilityLabel={`Delete ${rewardTitle(r)}`}
                        onPress={() => void handleDeleteCustomReward(id)}
                        style={{
                          minWidth: MIN_TARGET_DP,
                          minHeight: MIN_TARGET_DP,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.body.fontSize }}>✕</Text>
                      </Pressable>
                    ) : null}
                  </View>

                  {/* Progress toward reward */}
                  <View style={{ gap: 4, marginTop: 10 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text
                        style={{
                          color: canAfford ? colors["color-accent-mint"] ?? accentColor : colors["color-text-secondary"],
                          fontSize: TYPOGRAPHY.label.fontSize,
                          fontWeight: "600",
                        }}
                      >
                        {canAfford ? "✓ Ready to redeem" : `${Math.max(0, cost - availablePoints)} pts to go`}
                      </Text>
                      <Text
                        style={{
                          color: colors["color-text-muted"],
                          fontSize: TYPOGRAPHY.label.fontSize,
                          fontWeight: "600",
                        }}
                      >
                        {`${progressPct}%`}
                      </Text>
                    </View>
                    <View style={{ height: 6, borderRadius: 3, backgroundColor: colors["color-surface-2"], overflow: "hidden" }}>
                      <View
                        style={{
                          width: `${progressPct}%`,
                          height: 6,
                          backgroundColor: canAfford
                            ? colors["color-accent-mint"] ?? accentColor
                            : accentColor,
                        }}
                      />
                    </View>
                  </View>

                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
                    <View
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 999,
                        backgroundColor: mix(colors["color-surface-2"], accentColor, 12),
                        borderWidth: 1,
                        borderColor: mix(accentColor, "transparent", 30),
                      }}
                    >
                      <Text
                        testID={`reward-cost-${id}`}
                        style={{
                          color: colors["color-text-primary"],
                          fontSize: TYPOGRAPHY.label.fontSize,
                          fontWeight: "700",
                          fontVariant: ["tabular-nums"],
                        }}
                      >
                        {cost} pts
                      </Text>
                    </View>
                    <SoftButton
                      variant="secondary"
                      size="sm"
                      testID={`reward-redeem-${id}`}
                      disabled={busy || !member}
                      onPress={() => openRedeem(r)}
                      style={{ minHeight: MIN_TARGET_DP, paddingHorizontal: 16 }}
                    >
                      Redeem
                    </SoftButton>
                  </View>
                </Material>
              );
            })
          )}
        </View>

        {/* Active Reward Passes Wallet */}
        {passes.length > 0 ? (
          <Material tier="thin" testID="rewards-passes-card" style={{ borderRadius: 20, padding: 16, gap: 12 }}>
            <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
              🎟️ My Reward Passes ({passes.filter((p) => !p.used).length} active)
            </Text>
            {passes.map((pass) => (
              <View
                key={pass.id}
                testID={`reward-pass-${pass.id}`}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: 12,
                  borderRadius: 16,
                  backgroundColor: colors["color-surface-1"],
                  borderWidth: 1,
                  borderColor: pass.used ? colors["color-border-subtle"] : mix(accentColor, "transparent", 40),
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                  <Text style={{ fontSize: 24 }}>{pass.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: pass.used ? colors["color-text-muted"] : colors["color-text-primary"],
                        fontSize: TYPOGRAPHY.body.fontSize,
                        fontWeight: "700",
                        textDecorationLine: pass.used ? "line-through" : "none",
                      }}
                    >
                      {pass.rewardName}
                    </Text>
                    <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }}>
                      {`${pass.memberName} · Redeemed ${pass.redeemedAt} · ${pass.cost} pts`}
                    </Text>
                  </View>
                </View>
                <SoftButton
                  variant={pass.used ? "ghost" : "success"}
                  size="sm"
                  testID={`reward-pass-use-${pass.id}`}
                  accessibilityLabel={pass.used ? `Mark ${pass.rewardName} unused` : `Mark ${pass.rewardName} used`}
                  onPress={() => void handleTogglePassUsed(pass.id)}
                >
                  {pass.used ? "Used ✓" : "Use Pass"}
                </SoftButton>
              </View>
            ))}
          </Material>
        ) : null}

        {combinedGoals.length > 0 ? (
          <Material tier="thin" style={{ borderRadius: 20, padding: 16, gap: 12 }}>
            <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
              🎯 Family goals
            </Text>
            {combinedGoals.map((g: any, i: number) => {
              const target = Number(g?.targetPoints ?? g?.target ?? 0) || 1;
              const earned = weekPoints;
              const pct = Math.min(100, Math.max(0, (earned / target) * 100));
              return (
                <View key={String(g?.id ?? i)} testID={`family-goal-${g?.id ?? i}`} style={{ gap: 6 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "600" }}>
                      {g?.emoji ? `${g.emoji} ` : ""}{g?.title ?? g?.name ?? "Goal"}
                    </Text>
                    <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }}>
                      {earned}/{target}
                    </Text>
                  </View>
                  <View style={{ height: 8, borderRadius: 4, backgroundColor: colors["color-surface-2"], overflow: "hidden" }}>
                    <View style={{ width: `${pct}%`, height: 8, backgroundColor: colors["color-accent-mint"] ?? accentColor }} />
                  </View>
                </View>
              );
            })}
          </Material>
        ) : null}

        {prizes.length > 0 ? (
          <Material tier="thin" style={{ borderRadius: 20, padding: 16, gap: 12 }}>
            <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
              🏆 Weekly prizes
            </Text>
            <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
              {prizes
                .slice()
                .sort((a: any, b: any) => Number(a?.rank ?? 99) - Number(b?.rank ?? 99))
                .map((p: any, i: number) => (
                  <View key={String(p?.id ?? i)} testID={`weekly-prize-${p?.rank ?? i}`} style={{ alignItems: "center", gap: 4 }}>
                    <Text style={{ fontSize: 28 }}>{p?.emoji ?? "🏅"}</Text>
                    <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "600" }}>
                      #{p?.rank ?? i + 1}
                    </Text>
                    <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.label.fontSize }} numberOfLines={2}>
                      {p?.text ?? ""}
                    </Text>
                  </View>
                ))}
            </View>
          </Material>
        ) : null}
      </ScrollView>

      {/* Add Reward Modal */}
      <Modal
        visible={composerOpen}
        onClose={() => setComposerOpen(false)}
        title="Add Reward to Shop"
        description="Pick a starter template or create a custom family reward"
        testID="rewards-composer-modal"
      >
        <ScrollView style={{ maxHeight: 560 }} contentContainerStyle={{ gap: SPACING.md }}>
          <View style={{ gap: SPACING.xs }}>
            <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
              Quick Templates
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACING.xs }}>
              {CURATED_REWARD_TEMPLATES.map((tpl) => (
                <Pressable
                  key={tpl.id}
                  testID={`rewards-tpl-${tpl.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Use template ${tpl.name}`}
                  onPress={() => {
                    setDraftName(tpl.name);
                    setDraftEmoji(tpl.emoji);
                    setDraftCost(String(tpl.cost));
                    setDraftCategory(tpl.category ?? "Treats");
                  }}
                  style={{
                    minHeight: MIN_TARGET_DP,
                    paddingHorizontal: SPACING.md,
                    borderRadius: RADII.pill,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: SPACING.xs,
                    borderWidth: 1,
                    borderColor: colors["color-border-subtle"],
                    backgroundColor: colors["color-surface-1"],
                  }}
                >
                  <Text style={{ fontSize: 18 }}>{tpl.emoji}</Text>
                  <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "600" }}>
                    {tpl.name} ({tpl.cost})
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <TextField
            testID="rewards-composer-name"
            label="Reward Name"
            placeholder="e.g. Ice Cream Trip"
            value={draftName}
            onChangeText={setDraftName}
          />

          <View style={{ flexDirection: "row", gap: SPACING.sm }}>
            <View style={{ flex: 1 }}>
              <TextField
                testID="rewards-composer-cost"
                label="Point Cost"
                placeholder="50"
                value={draftCost}
                onChangeText={setDraftCost}
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1 }}>
              <TextField
                testID="rewards-composer-category"
                label="Category"
                placeholder="Treats, Privileges..."
                value={draftCategory}
                onChangeText={setDraftCategory}
              />
            </View>
          </View>

          <View style={{ gap: SPACING.xs }}>
            <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
              Icon
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACING.xs }}>
              {EMOJI_CHOICES.map((em) => {
                const selected = draftEmoji === em;
                return (
                  <Pressable
                    key={em}
                    accessibilityRole="button"
                    accessibilityLabel={`Choose icon ${em}`}
                    onPress={() => setDraftEmoji(em)}
                    style={{
                      minWidth: MIN_TARGET_DP,
                      minHeight: MIN_TARGET_DP,
                      borderRadius: RADII.md,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 2,
                      borderColor: selected ? accentColor : colors["color-border-subtle"],
                      backgroundColor: selected ? mix(accentColor, "transparent", 20) : colors["color-surface-1"],
                    }}
                  >
                    <Text style={{ fontSize: 24 }}>{em}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: SPACING.sm }}>
            <SoftButton variant="ghost" onPress={() => setComposerOpen(false)}>
              Cancel
            </SoftButton>
            <SoftButton
              variant="primary"
              testID="rewards-composer-save"
              disabled={!draftName.trim()}
              onPress={() => void handleSaveCustomReward()}
            >
              Save Reward
            </SoftButton>
          </View>
        </ScrollView>
      </Modal>

      {/* Add Family Goal Modal */}
      <Modal
        visible={goalModalOpen}
        onClose={() => setGoalModalOpen(false)}
        title="Add Family Goal"
        description="Set a shared milestone for the family to work toward together"
        testID="rewards-goal-modal"
      >
        <View style={{ gap: SPACING.md }}>
          <TextField
            testID="rewards-goal-title"
            label="Goal Title"
            placeholder="e.g. Family Pizza & Movie Night"
            value={goalTitle}
            onChangeText={setGoalTitle}
          />
          <View style={{ flexDirection: "row", gap: SPACING.sm }}>
            <View style={{ flex: 1 }}>
              <TextField
                testID="rewards-goal-emoji"
                label="Emoji"
                placeholder="🍕"
                value={goalEmoji}
                onChangeText={setGoalEmoji}
              />
            </View>
            <View style={{ flex: 2 }}>
              <TextField
                testID="rewards-goal-target"
                label="Target Points"
                placeholder="250"
                value={goalTarget}
                onChangeText={setGoalTarget}
                keyboardType="numeric"
              />
            </View>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: SPACING.sm }}>
            <SoftButton variant="ghost" onPress={() => setGoalModalOpen(false)}>
              Cancel
            </SoftButton>
            <SoftButton
              variant="primary"
              testID="rewards-goal-save"
              disabled={!goalTitle.trim()}
              onPress={() => void handleAddFamilyGoal()}
            >
              Save Goal
            </SoftButton>
          </View>
        </View>
      </Modal>

      {/* Redeem modal for <=100 */}
      <Modal
        visible={redeemRewardState !== null}
        onClose={() => !busy && closeRedeem()}
        title="Redeem with your PIN"
        description={redeemRewardState ? `Redeem "${rewardTitle(redeemRewardState)}" for ${rewardCost(redeemRewardState)} points` : ""}
        dismissable={!busy}
        testID="redeem-modal"
      >
        {member ? (
          <PinPad
            key={`redeem-pad-${pinAttempt}`}
            testID="redeem-pinpad"
            member={{ name: member.name, emoji: member.emoji || "👤" }}
            onVerified={(pin) => {
              if (redeemRewardState) void runRedeem(redeemRewardState, pin);
            }}
            onCancel={() => !busy && closeRedeem()}
            busy={busy}
            error={pinError}
          />
        ) : null}
      </Modal>

      {/* Two-step for >100: member verify, then parent PIN */}
      <Modal
        visible={highCostReward !== null && memberPin === null}
        onClose={() => {
          if (busy) return;
          setHighCostReward(null);
        }}
        title="Verify it's you"
        description={highCostReward ? `Enter your PIN to start redeeming "${rewardTitle(highCostReward)}"` : ""}
        dismissable={!busy}
        testID="highcost-member-modal"
      >
        {member ? (
          <PinPad
            key={`highcost-member-${pinAttempt}`}
            testID="highcost-member-pinpad"
            member={{ name: member.name, emoji: member.emoji || "👤" }}
            onVerified={(pin) => onMemberVerified(pin)}
            onCancel={() => {
              if (!busy) setHighCostReward(null);
            }}
            busy={busy}
            error={null}
          />
        ) : null}
      </Modal>

      <Modal
        visible={highCostReward !== null && memberPin !== null}
        onClose={() => {
          if (busy) return;
          setHighCostReward(null);
          setMemberPin(null);
          setParentPin("");
          setParentName("");
          setParentError(null);
        }}
        title="Parent approval required"
        description={highCostReward ? `"${rewardTitle(highCostReward)}" costs ${rewardCost(highCostReward)}pts — parent PIN needed.` : ""}
        dismissable={!busy}
        testID="highcost-parent-modal"
      >
        <View style={{ gap: 14 }}>
          {/* Selectable Parent Chips */}
          {cachedParents.length > 0 ? (
            <View style={{ gap: 8 }}>
              <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "600" }}>
                Select parent:
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {cachedParents.map((p) => {
                  const isSelected = parentName.trim().toLowerCase() === p.name.trim().toLowerCase();
                  return (
                    <Pressable
                      key={p.name}
                      onPress={() => setParentName(p.name)}
                      accessibilityRole="button"
                      accessibilityLabel={`Select parent ${p.name}`}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 999,
                        backgroundColor: isSelected
                          ? mix(accentColor, "transparent", 35)
                          : colors["color-surface-2"],
                        borderWidth: 1,
                        borderColor: isSelected ? accentColor : colors["color-surface-3"],
                      }}
                    >
                      {p.emoji && isPhotoUri(p.emoji) ? (
                        <Image source={{ uri: p.emoji }} style={{ width: 20, height: 20, borderRadius: 10 }} resizeMode="cover" />
                      ) : (
                        <Text style={{ fontSize: 16 }}>{p.emoji || "👤"}</Text>
                      )}
                      <Text
                        style={{
                          color: isSelected ? colors["color-text-primary"] : colors["color-text-secondary"],
                          fontSize: TYPOGRAPHY.label.fontSize,
                          fontWeight: isSelected ? "700" : "600",
                        }}
                      >
                        {p.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          <TextInput
            testID="parent-name-input"
            placeholder="Parent name"
            value={parentName}
            onChangeText={setParentName}
            style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, padding: 12, borderRadius: 12, backgroundColor: colors["color-surface-2"] }}
          />
          <TextInput
            testID="parent-pin-input"
            placeholder="Parent PIN"
            value={parentPin}
            onChangeText={setParentPin}
            secureTextEntry
            keyboardType="numeric"
            style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, padding: 12, borderRadius: 12, backgroundColor: colors["color-surface-2"] }}
          />
          {parentError ? (
            <Text style={{ color: colors["color-accent-rose"], fontSize: TYPOGRAPHY.label.fontSize }} role="alert">
              {parentError}
            </Text>
          ) : null}
          <SoftButton
            variant="success"
            disabled={busy || !memberPin || !parentPin}
            onPress={() => {
              if (highCostReward && memberPin) {
                void runRedeem(highCostReward, memberPin, { name: parentName || firstParent?.name || "", pin: parentPin });
              }
            }}
            testID="highcost-submit"
            style={{ minHeight: MIN_TARGET_DP }}
          >
            Redeem
          </SoftButton>
          {firstParent && !parentName ? (
            <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }}>
              Suggested parent: {firstParent.name}
            </Text>
          ) : null}
        </View>
      </Modal>

      {purchasing ? (
        <View style={{ position: "absolute", top: "40%", left: 0, right: 0, alignItems: "center" }} pointerEvents="none">
          <Text style={{ color: colors["color-text-primary"], fontSize: 32, fontWeight: "700" }}>🎉 {rewardTitle(purchasing)} redeemed!</Text>
        </View>
      ) : null}
    </View>
  );
}

export default RewardsPage;
