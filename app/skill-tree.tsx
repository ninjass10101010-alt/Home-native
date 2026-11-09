import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { usePathname, useRouter } from "expo-router";
import { Screen } from "../src/theme/Screen";
import { useTheme } from "../src/theme/ThemeProvider";
import { Material } from "../src/theme/Material";
import { ACCENTS, FONTS, MIN_TARGET_DP, RADII, SPACING, TYPOGRAPHY } from "../src/theme/tokens";
import { mix } from "../src/theme/mix";
import { CapsuleDock, MoreButton } from "../src/nav/CapsuleDock";
import { MoreSheet } from "../src/nav/MoreSheet";
import { useAuth } from "../src/state/AuthProvider";
import { useSync } from "../src/state/SyncManager";
import { SoftButton } from "../src/ui/SoftButton";
import { isPhotoUri } from "../src/ui/MemberRail";
import { useToast } from "../src/ui/Toast";
import { kidLevel, POINTS_PER_LEVEL } from "../src/home/KidHome";
import { resolveCharacterForMember, useCharacterTheme } from "../src/theme/characterTheme";
import { CelebrationOverlay, CharacterEmblem, type CelebrationEvent } from "../src/ui/CelebrationOverlay";

const SKILL_STORAGE_KEY = "@consuela/skill_tree_v1";

interface SkillNode {
  id: string;
  tier: 1 | 2 | 3;
  title: string;
  emoji: string;
  description: string;
  xpCost: number;
}

interface SkillBranch {
  id: string;
  title: string;
  emoji: string;
  toneKey: string;
  nodes: SkillNode[];
}

const SKILL_BRANCHES: SkillBranch[] = [
  {
    id: "kitchen",
    title: "Culinary Arts",
    emoji: "🍳",
    toneKey: "color-accent-amber",
    nodes: [
      { id: "k1", tier: 1, title: "Table Setter", emoji: "🍽️", description: "Set napkins & silverware before dinner", xpCost: 20 },
      { id: "k2", tier: 2, title: "Sous Chef", emoji: "🥗", description: "Wash produce & prep side dishes", xpCost: 50 },
      { id: "k3", tier: 3, title: "Family Chef", emoji: "👨‍🍳", description: "Lead a full family meal with a parent", xpCost: 100 },
    ],
  },
  {
    id: "home",
    title: "Home Steward",
    emoji: "🧹",
    toneKey: "color-accent-cyan",
    nodes: [
      { id: "h1", tier: 1, title: "Tidy Ranger", emoji: "🛏️", description: "Make bed & clear floor 5 days in a row", xpCost: 20 },
      { id: "h2", tier: 2, title: "Room Captain", emoji: "🧺", description: "Sort & put away folded laundry", xpCost: 50 },
      { id: "h3", tier: 3, title: "Castle Guardian", emoji: "🏰", description: "Complete a weekend power-hour reset", xpCost: 100 },
    ],
  },
  {
    id: "scholar",
    title: "Scholar & Craft",
    emoji: "📚",
    toneKey: "color-accent-violet",
    nodes: [
      { id: "s1", tier: 1, title: "Curious Reader", emoji: "📖", description: "Read 20 minutes after school", xpCost: 20 },
      { id: "s2", tier: 2, title: "Homework Hero", emoji: "✏️", description: "Finish assignments before dinner", xpCost: 50 },
      { id: "s3", tier: 3, title: "Grand Creator", emoji: "🎨", description: "Build or present a creative project", xpCost: 100 },
    ],
  },
  {
    id: "teamwork",
    title: "Family Spirit",
    emoji: "🤝",
    toneKey: "color-accent-mint",
    nodes: [
      { id: "t1", tier: 1, title: "Kind Helper", emoji: "💛", description: "Help a sibling or pet without being asked", xpCost: 20 },
      { id: "t2", tier: 2, title: "Crew Leader", emoji: "🙌", description: "Join & finish a multi-person crew chore", xpCost: 50 },
      { id: "t3", tier: 3, title: "Heart of the Home", emoji: "🌟", description: "Hit a 7-day family streak together", xpCost: 100 },
    ],
  },
];

const BADGES = [
  { id: "b-first", title: "First Quest", emoji: "🎯", req: "Unlock 1 skill node", minNodes: 1 },
  { id: "b-apprentice", title: "Rising Apprentice", emoji: "⚡", req: "Unlock 3 skill nodes", minNodes: 3 },
  { id: "b-scholar", title: "Well-Rounded", emoji: "🧭", req: "Unlock 6 skill nodes", minNodes: 6 },
  { id: "b-master", title: "Grand Master", emoji: "👑", req: "Unlock 10 skill nodes", minNodes: 10 },
];

export default function SkillTreeRoute() {
  const { colors, theme, accentColor } = useTheme();
  const toast = useToast();
  const pathname = usePathname();
  const router = useRouter();
  const { member, role: capabilityRole, hydrated } = useAuth();
  const { snapshot } = useSync();
  const [characterPrefs] = useCharacterTheme();
  const [moreOpen, setMoreOpen] = useState(false);
  const [celebrationEvent, setCelebrationEvent] = useState<CelebrationEvent | null>(null);

  const [unlockedNodes, setUnlockedNodes] = useState<string[]>(["k1", "h1"]);
  const [bonusXp, setBonusXp] = useState<number>(30);
  const [selectedBranch, setSelectedBranch] = useState<string>("all");

  const navRole = capabilityRole === "parent" ? "parent" : capabilityRole ? "child" : "guest";
  const memberName = member?.name ?? "Explorer";

  const companion = useMemo(
    () => resolveCharacterForMember(member?.name, characterPrefs),
    [member?.name, characterPrefs]
  );
  const palette = ACCENTS[theme === "light" ? "light" : "dark"];
  const companionAccent = palette[companion.accentKey] ?? accentColor;
  const companionEmoji = (companion as any).emoji ?? companion.badgeGlyph;

  useEffect(() => {
    let alive = true;
    void AsyncStorage.getItem(SKILL_STORAGE_KEY)
      .then((raw) => {
        if (!alive || !raw) return;
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed?.unlockedNodes)) setUnlockedNodes(parsed.unlockedNodes);
          if (typeof parsed?.bonusXp === "number") setBonusXp(parsed.bonusXp);
        } catch {
          // ignore
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const persistState = useCallback(async (nextUnlocked: string[], nextBonus: number) => {
    try {
      await AsyncStorage.setItem(
        SKILL_STORAGE_KEY,
        JSON.stringify({ unlockedNodes: nextUnlocked, bonusXp: nextBonus }),
      );
    } catch {
      // ignore
    }
  }, []);

  const weekPoints = useMemo(() => {
    const pts = snapshot?.weekData?.points;
    if (!pts) return 0;
    if (member?.name && typeof pts[member.name] === "number") return pts[member.name];
    return Object.values(pts).reduce((acc, v) => acc + (Number(v) || 0), 0);
  }, [snapshot, member]);

  const totalXp = weekPoints + bonusXp + unlockedNodes.length * 15;
  const level = kidLevel(totalXp);
  const xpIntoLevel = totalXp % POINTS_PER_LEVEL;
  const levelPct = Math.min(100, Math.round((xpIntoLevel / POINTS_PER_LEVEL) * 100));

  const toggleNode = useCallback(
    async (node: SkillNode) => {
      const isUnlocked = unlockedNodes.includes(node.id);
      if (isUnlocked) {
        const nextBonus = bonusXp + 10;
        setBonusXp(nextBonus);
        await persistState(unlockedNodes, nextBonus);
        toast.show(`⚡ Practiced "${node.title}"! +10 XP`, { intent: "success" });
        return;
      }
      const nextUnlocked = [...unlockedNodes, node.id];
      setUnlockedNodes(nextUnlocked);
      await persistState(nextUnlocked, bonusXp);
      toast.show(`🎉 Unlocked "${node.title}"!`, { intent: "success" });
      if (characterPrefs.enabled) {
        setCelebrationEvent({
          kind: "reward",
          memberName,
          title: `Unlocked ${node.title}!`,
          points: node.xpCost,
        });
      }
    },
    [unlockedNodes, bonusXp, persistState, toast, characterPrefs.enabled, memberName],
  );

  const visibleBranches = useMemo(
    () => (selectedBranch === "all" ? SKILL_BRANCHES : SKILL_BRANCHES.filter((b) => b.id === selectedBranch)),
    [selectedBranch],
  );

  return (
    <Screen testID="skill-tree-route">
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
                QUESTS, LEVELS & BADGES
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
                🌳 Skill Tree
              </Text>
            </View>
            <SoftButton
              variant="secondary"
              size="sm"
              testID="skill-tree-to-tasks"
              accessibilityLabel="Go to Tasks and Routines"
              style={{ minHeight: MIN_TARGET_DP, minWidth: MIN_TARGET_DP }}
              onPress={() => router.replace("/tasks" as never)}
            >
              ✅ Go to Quests & Routines
            </SoftButton>
          </View>

          {/* Hero Level & XP Banner */}
          <Material tier="regular" style={{ borderRadius: RADII.xl, padding: SPACING.md, gap: SPACING.sm }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: SPACING.sm }}>
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: mix(accentColor, "transparent", 22),
                    borderWidth: 2,
                    borderColor: accentColor,
                  }}
                >
                  {member?.emoji && isPhotoUri(member.emoji) ? (
                    <Image
                      source={{ uri: member.emoji }}
                      style={{ width: 52, height: 52, borderRadius: 26 }}
                      resizeMode="cover"
                    />
                  ) : (
                    <Text style={{ fontSize: 28 }}>{member?.emoji || "🧙"}</Text>
                  )}
                </View>
                <View>
                  <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.cardTitle.fontSize, fontWeight: "700" }}>
                    {`${memberName} · Level ${level}`}
                  </Text>
                  <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }}>
                    {`${totalXp} Total XP · ${unlockedNodes.length} of 12 skills unlocked`}
                  </Text>
                </View>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text testID="skill-tree-level" style={{ color: colors["color-text-primary"], fontSize: 28, fontWeight: "800" }}>
                  {`Lv. ${level}`}
                </Text>
                <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize }}>
                  {`${xpIntoLevel}/${POINTS_PER_LEVEL} XP to next`}
                </Text>
              </View>
            </View>
            <View style={{ height: 10, borderRadius: 5, backgroundColor: colors["color-surface-2"], overflow: "hidden" }}>
              <View style={{ width: `${levelPct}%`, height: 10, backgroundColor: accentColor }} />
            </View>
          </Material>

          {/* ✨ Companion Mastery Spotlight Banner */}
          <Material
            tier="thin"
            testID="skill-companion-banner"
            style={{
              borderRadius: RADII.xl,
              padding: SPACING.md,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: SPACING.sm,
              borderWidth: 1,
              borderColor: mix(companionAccent, colors["color-border"] ?? colors["color-text-primary"], 35),
              backgroundColor: mix(companionAccent, "transparent", 10),
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: SPACING.sm, flex: 1 }}>
              <CharacterEmblem
                motif={companion.motif}
                accentHex={companionAccent}
                inkHex={colors["color-text-primary"]}
                size={52}
              />
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  testID="skill-companion-title"
                  style={{
                    color: colors["color-text-primary"],
                    fontSize: TYPOGRAPHY.cardTitle.fontSize,
                    fontWeight: "700",
                  }}
                >
                  {`${companionEmoji} ${companion.name} · Quest Companion`}
                </Text>
                <Text
                  testID="skill-companion-cheer"
                  style={{
                    color: colors["color-text-secondary"],
                    fontSize: TYPOGRAPHY.label.fontSize,
                  }}
                >
                  {companion.choreCheer}
                </Text>
              </View>
            </View>
            <SoftButton
              variant="secondary"
              size="sm"
              testID="skill-companion-peptalk"
              accessibilityLabel={`Pep talk from ${companion.name}`}
              style={{ minHeight: MIN_TARGET_DP, minWidth: MIN_TARGET_DP }}
              onPress={() => {
                setCelebrationEvent({
                  kind: "chore",
                  memberName,
                  title: `${companion.name} believes in your next skill!`,
                  points: 10,
                });
              }}
            >
              ✨ Pep Talk
            </SoftButton>
          </Material>

          {/* Branch Filter Strip */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACING.xs }}>
            <Pressable
              testID="skill-filter-all"
              accessibilityRole="button"
              accessibilityLabel="All skill branches"
              onPress={() => setSelectedBranch("all")}
              style={{
                minHeight: MIN_TARGET_DP,
                minWidth: MIN_TARGET_DP,
                paddingHorizontal: SPACING.md,
                borderRadius: RADII.pill,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: selectedBranch === "all" ? accentColor : colors["color-border-subtle"],
                backgroundColor: selectedBranch === "all" ? mix(accentColor, "transparent", 20) : colors["color-surface-1"],
              }}
            >
              <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
                All Branches (4)
              </Text>
            </Pressable>
            {SKILL_BRANCHES.map((b) => {
              const active = selectedBranch === b.id;
              return (
                <Pressable
                  key={b.id}
                  testID={`skill-filter-${b.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Filter by ${b.title}`}
                  onPress={() => setSelectedBranch(b.id)}
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
                    {b.emoji} {b.title}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Skill Branches */}
          {visibleBranches.map((branch) => {
            const toneColor = colors[branch.toneKey] ?? accentColor;
            const branchMastered = branch.nodes.every((n) => unlockedNodes.includes(n.id));
            const unlockedInBranch = branch.nodes.filter((n) => unlockedNodes.includes(n.id)).length;
            return (
              <Material
                key={branch.id}
                tier="thin"
                testID={`skill-branch-${branch.id}`}
                style={{ borderRadius: RADII.xl, padding: SPACING.md, gap: SPACING.sm }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: SPACING.xs }}>
                  <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.cardTitle.fontSize, fontWeight: "700" }}>
                    {branch.emoji} {branch.title}
                  </Text>
                  <View
                    testID={`skill-branch-mastery-${branch.id}`}
                    style={{
                      paddingHorizontal: SPACING.sm,
                      paddingVertical: 4,
                      borderRadius: RADII.pill,
                      borderWidth: 1,
                      borderColor: branchMastered ? mix(toneColor, "transparent", 45) : (colors["color-border"] ?? colors["color-text-primary"]),
                      backgroundColor: branchMastered ? mix(toneColor, "transparent", 18) : colors["color-surface-1"],
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{
                        color: branchMastered ? colors["color-text-primary"] : colors["color-text-secondary"],
                        fontSize: TYPOGRAPHY.label.fontSize,
                        fontWeight: branchMastered ? "700" : "600",
                      }}
                    >
                      {branchMastered ? "🏆 Branch Mastered!" : `${unlockedInBranch}/${branch.nodes.length} Mastered`}
                    </Text>
                  </View>
                </View>
                <View style={{ gap: SPACING.xs }}>
                  {branch.nodes.map((node) => {
                    const unlocked = unlockedNodes.includes(node.id);
                    return (
                      <View
                        key={node.id}
                        testID={`skill-node-${node.id}`}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: SPACING.sm,
                          borderRadius: RADII.lg,
                          borderWidth: 1,
                          borderColor: unlocked ? mix(toneColor, "transparent", 45) : colors["color-border-subtle"],
                          backgroundColor: unlocked ? mix(toneColor, "transparent", 14) : colors["color-surface-1"],
                          gap: SPACING.sm,
                        }}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: SPACING.sm, flex: 1 }}>
                          <Text style={{ fontSize: 26 }}>{node.emoji}</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
                              {`Tier ${node.tier}: ${node.title}`}
                            </Text>
                            <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }}>
                              {node.description}
                            </Text>
                          </View>
                        </View>
                        <SoftButton
                          variant={unlocked ? "success" : "secondary"}
                          size="sm"
                          testID={`skill-action-${node.id}`}
                          accessibilityLabel={unlocked ? `Practice ${node.title}` : `Unlock ${node.title}`}
                          style={{ minHeight: MIN_TARGET_DP, minWidth: MIN_TARGET_DP }}
                          onPress={() => void toggleNode(node)}
                        >
                          {unlocked ? "⚡ Practice (+10 XP)" : `Unlock (${node.xpCost} XP)`}
                        </SoftButton>
                      </View>
                    );
                  })}
                </View>
              </Material>
            );
          })}

          {/* Badge Showcase */}
          <Material tier="thin" testID="skill-badges-card" style={{ borderRadius: RADII.xl, padding: SPACING.md, gap: SPACING.sm }}>
            <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.cardTitle.fontSize, fontWeight: "700" }}>
              🏅 Family Badge Showcase
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm }}>
              {BADGES.map((badge) => {
                const earned = unlockedNodes.length >= badge.minNodes;
                return (
                  <View
                    key={badge.id}
                    testID={`skill-badge-${badge.id}`}
                    style={{
                      width: "48.5%",
                      padding: SPACING.md,
                      borderRadius: RADII.lg,
                      borderWidth: 1,
                      borderColor: earned ? mix(accentColor, "transparent", 45) : colors["color-border-subtle"],
                      backgroundColor: earned ? mix(accentColor, "transparent", 14) : colors["color-surface-1"],
                      gap: 4,
                    }}
                  >
                    <Text style={{ fontSize: 28 }}>{badge.emoji}</Text>
                    <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
                      {badge.title}
                    </Text>
                    <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }}>
                      {earned ? "✓ Earned!" : badge.req}
                    </Text>
                  </View>
                );
              })}
            </View>
          </Material>
        </ScrollView>
      </View>

      <CelebrationOverlay
        event={celebrationEvent}
        onDismiss={() => setCelebrationEvent(null)}
        characterOverride={companion}
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
