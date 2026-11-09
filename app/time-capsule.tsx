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
import { useToast } from "../src/ui/Toast";
import { resolveCharacterForMember, useCharacterTheme } from "../src/theme/characterTheme";
import { CelebrationOverlay, type CelebrationEvent } from "../src/ui/CelebrationOverlay";

const CAPSULE_STORAGE_KEY = "@consuela/time_capsules_v1";

export interface TimeCapsuleEntry {
  id: string;
  title: string;
  emoji: string;
  author: string;
  createdAt: string;
  unlockLabel: string;
  message: string;
  sealed: boolean;
  reactions?: Record<string, number>;
}

export interface CapsulePrompt {
  id: string;
  emoji: string;
  label: string;
  title: string;
  prompt: string;
  unlock: string;
}

export const CAPSULE_PROMPTS: CapsulePrompt[] = [
  {
    id: "birthday",
    emoji: "🎂",
    label: "Birthday Interview",
    title: "Birthday Time Capsule",
    prompt: "My favorite song right now, my best friend, what makes me laugh, and what I want to be when I grow up:",
    unlock: "In 1 Year",
  },
  {
    id: "school",
    emoji: "🎒",
    label: "First Day of School",
    title: "School Year Snapshot",
    prompt: "My teacher's name, the subject I'm most excited for, and one big goal for this semester:",
    unlock: "In 6 Months",
  },
  {
    id: "proud",
    emoji: "🌟",
    label: "Proud Family Moment",
    title: "A Moment to Remember",
    prompt: "Today our family accomplished something special together and we never want to forget:",
    unlock: "Ready now",
  },
  {
    id: "holiday",
    emoji: "🎄",
    label: "Holiday Wishes",
    title: "Next Year's Holiday Letter",
    prompt: "Our favorite family tradition this season and our wishes for next year:",
    unlock: "In 1 Year",
  },
];

export const CAPSULE_REACTIONS: { key: string; emoji: string; label: string }[] = [
  { key: "love", emoji: "❤️", label: "Love" },
  { key: "touched", emoji: "🥹", label: "Touched" },
  { key: "party", emoji: "🎉", label: "Party" },
];

const DEFAULT_CAPSULES: TimeCapsuleEntry[] = [
  {
    id: "tc-1",
    title: "School Year Predictions",
    emoji: "🎒",
    author: "Family",
    createdAt: "Sep 1, 2026",
    unlockLabel: "Jun 15, 2027",
    message: "Our favorite subjects this fall, the books we want to finish, and our biggest goals for the school year!",
    sealed: true,
  },
  {
    id: "tc-2",
    title: "Sunday Gratitude Note",
    emoji: "💌",
    author: "Mom & Dad",
    createdAt: "Oct 1, 2026",
    unlockLabel: "Ready now",
    message: "So proud of how everyone pitched in on the weekend reset and helped cook Friday tacos together.",
    sealed: false,
    reactions: { love: 2, touched: 1 },
  },
];

const UNLOCK_PRESETS = ["Ready now", "In 1 Month", "In 6 Months", "In 1 Year"];

export default function TimeCapsuleRoute() {
  const { colors, accentColor } = useTheme();
  const toast = useToast();
  const pathname = usePathname();
  const router = useRouter();
  const { member, role: capabilityRole, hydrated } = useAuth();
  const [characterPrefs] = useCharacterTheme();
  const [celebrationEvent, setCelebrationEvent] = useState<CelebrationEvent | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  const [capsules, setCapsules] = useState<TimeCapsuleEntry[]>(DEFAULT_CAPSULES);
  const [filter, setFilter] = useState<"all" | "sealed" | "open">("all");
  const [composerOpen, setComposerOpen] = useState(false);
  const [readingCapsule, setReadingCapsule] = useState<TimeCapsuleEntry | null>(null);

  const [draftTitle, setDraftTitle] = useState("");
  const [draftMessage, setDraftMessage] = useState("");
  const [draftEmoji, setDraftEmoji] = useState("⏳");
  const [draftUnlock, setDraftUnlock] = useState("In 6 Months");

  const navRole = capabilityRole === "parent" ? "parent" : capabilityRole ? "child" : "guest";
  const companion = useMemo(
    () => resolveCharacterForMember(member?.name, characterPrefs),
    [member?.name, characterPrefs],
  );

  useEffect(() => {
    let alive = true;
    void AsyncStorage.getItem(CAPSULE_STORAGE_KEY)
      .then((raw) => {
        if (!alive || !raw) return;
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) setCapsules(parsed);
        } catch {
          // ignore
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const persistCapsules = useCallback(async (next: TimeCapsuleEntry[]) => {
    setCapsules(next);
    try {
      await AsyncStorage.setItem(CAPSULE_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }, []);

  const visibleCapsules = useMemo(() => {
    return capsules.filter((c) => {
      if (filter === "sealed") return c.sealed;
      if (filter === "open") return !c.sealed;
      return true;
    });
  }, [capsules, filter]);

  const handleSealCapsule = useCallback(async () => {
    if (!draftTitle.trim()) return;
    const entry: TimeCapsuleEntry = {
      id: `tc-${Date.now()}`,
      title: draftTitle.trim(),
      emoji: draftEmoji || "⏳",
      author: member?.name ?? "Family",
      createdAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      unlockLabel: draftUnlock,
      message: draftMessage.trim() || "A special memory saved for the future.",
      sealed: draftUnlock !== "Ready now",
      reactions: {},
    };
    await persistCapsules([entry, ...capsules]);
    setComposerOpen(false);
    setDraftTitle("");
    setDraftMessage("");
    setDraftEmoji("⏳");
    setDraftUnlock("In 6 Months");
    toast.show(`🔒 Sealed "${entry.title}" in the Time Capsule!`, { intent: "success" });
  }, [draftTitle, draftEmoji, member, draftUnlock, draftMessage, capsules, persistCapsules, toast]);

  const handleOpenCapsule = useCallback(
    async (entry: TimeCapsuleEntry) => {
      if (entry.sealed) {
        const next = capsules.map((c) => (c.id === entry.id ? { ...c, sealed: false } : c));
        await persistCapsules(next);
        toast.show(`🔓 Unsealed "${entry.title}"!`, { intent: "success" });
        if (characterPrefs.enabled) {
          setCelebrationEvent({
            kind: "reward",
            memberName: member?.name ?? "Family",
            title: `Unsealed: ${entry.title}!`,
          });
        }
        setReadingCapsule({ ...entry, sealed: false });
      } else {
        setReadingCapsule(entry);
      }
    },
    [capsules, persistCapsules, toast, characterPrefs.enabled, member],
  );

  const handleReact = useCallback(
    async (entryId: string, reactionKey: string) => {
      const next = capsules.map((c) => {
        if (c.id !== entryId) return c;
        const currentCount = c.reactions?.[reactionKey] ?? 0;
        return {
          ...c,
          reactions: {
            ...(c.reactions ?? {}),
            [reactionKey]: currentCount + 1,
          },
        };
      });
      await persistCapsules(next);
      if (readingCapsule && readingCapsule.id === entryId) {
        const updated = next.find((c) => c.id === entryId);
        if (updated) setReadingCapsule(updated);
      }
    },
    [capsules, persistCapsules, readingCapsule],
  );

  const handleOpenComposer = useCallback(() => {
    setDraftTitle("");
    setDraftMessage("");
    setDraftEmoji("⏳");
    setDraftUnlock("In 6 Months");
    setComposerOpen(true);
  }, []);

  const handleSelectPrompt = useCallback((prompt: CapsulePrompt) => {
    setDraftTitle(prompt.title);
    setDraftMessage(prompt.prompt);
    setDraftEmoji(prompt.emoji);
    setDraftUnlock(prompt.unlock);
    setComposerOpen(true);
  }, []);

  return (
    <Screen testID="time-capsule-route">
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
                LETTERS & MEMORIES FOR LATER
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
                ⏳ Time Capsule
              </Text>
            </View>
            <SoftButton
              variant="primary"
              size="sm"
              testID="capsule-add-button"
              accessibilityLabel="Seal a new time capsule"
              style={{ minHeight: MIN_TARGET_DP, minWidth: MIN_TARGET_DP }}
              onPress={handleOpenComposer}
            >
              + Seal Memory
            </SoftButton>
          </View>

          {/* Guided Story Prompts Shelf */}
          <Material
            tier="thin"
            testID="capsule-prompts-shelf"
            style={{
              borderRadius: RADII.xl,
              padding: SPACING.md,
              gap: SPACING.sm,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text
                style={{
                  color: colors["color-text-muted"],
                  fontSize: TYPOGRAPHY.fieldLabel.fontSize,
                  fontWeight: "700",
                  letterSpacing: 1.2,
                  textTransform: "uppercase",
                }}
              >
                ✨ Guided Story Prompts
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: SPACING.sm }}
            >
              {CAPSULE_PROMPTS.map((p) => (
                <Pressable
                  key={p.id}
                  testID={`capsule-prompt-${p.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${p.label}: ${p.title}`}
                  onPress={() => handleSelectPrompt(p)}
                  style={{
                    minHeight: MIN_TARGET_DP,
                    minWidth: MIN_TARGET_DP,
                    paddingHorizontal: SPACING.md,
                    paddingVertical: SPACING.sm,
                    borderRadius: RADII.lg,
                    borderWidth: 1,
                    borderColor: colors["color-border-subtle"],
                    backgroundColor: colors["color-surface-2"],
                    flexDirection: "row",
                    alignItems: "center",
                    gap: SPACING.sm,
                  }}
                >
                  <Text style={{ fontSize: 26 }}>{p.emoji}</Text>
                  <View>
                    <Text
                      style={{
                        color: colors["color-text-primary"],
                        fontSize: TYPOGRAPHY.body.fontSize,
                        fontWeight: "700",
                      }}
                    >
                      {p.label}
                    </Text>
                    <Text
                      style={{
                        color: colors["color-text-secondary"],
                        fontSize: TYPOGRAPHY.label.fontSize,
                      }}
                    >
                      {`Opens ${p.unlock}`}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </Material>

          {/* Filter Pills */}
          <View style={{ flexDirection: "row", gap: SPACING.xs }}>
            {(
              [
                { id: "all", label: `All (${capsules.length})` },
                { id: "sealed", label: `🔒 Sealed (${capsules.filter((c) => c.sealed).length})` },
                { id: "open", label: `🔓 Opened (${capsules.filter((c) => !c.sealed).length})` },
              ] as const
            ).map((tab) => {
              const active = filter === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  testID={`capsule-filter-${tab.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={tab.label}
                  onPress={() => setFilter(tab.id)}
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
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Capsule List */}
          <View style={{ gap: SPACING.md }}>
            {visibleCapsules.map((item) => (
              <Material
                key={item.id}
                tier="regular"
                testID={`capsule-card-${item.id}`}
                style={{
                  borderRadius: RADII.xl,
                  padding: SPACING.md,
                  gap: SPACING.sm,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SPACING.sm }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: SPACING.sm, flex: 1 }}>
                    <Text style={{ fontSize: 30 }}>{item.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.cardTitle.fontSize, fontWeight: "700" }}>
                        {item.title}
                      </Text>
                      <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }}>
                        {`By ${item.author} · Saved ${item.createdAt} · ${item.sealed ? `🔒 Opens ${item.unlockLabel}` : "🔓 Unlocked"}`}
                      </Text>
                    </View>
                  </View>
                  <SoftButton
                    variant={item.sealed ? "secondary" : "primary"}
                    size="sm"
                    testID={`capsule-open-${item.id}`}
                    accessibilityLabel={item.sealed ? `Unseal ${item.title}` : `Read ${item.title}`}
                    style={{ minHeight: MIN_TARGET_DP, minWidth: MIN_TARGET_DP }}
                    onPress={() => void handleOpenCapsule(item)}
                  >
                    {item.sealed ? "🔓 Unseal" : "📖 Read"}
                  </SoftButton>
                </View>

                <Text
                  style={{
                    color: item.sealed ? colors["color-text-muted"] : colors["color-text-primary"],
                    fontSize: TYPOGRAPHY.body.fontSize,
                    fontStyle: item.sealed ? "italic" : "normal",
                  }}
                >
                  {item.sealed ? "🔒 This letter is sealed inside the family vault. Tap Unseal to open it." : item.message}
                </Text>

                {/* Keepsake Reactions on Unlocked Capsules */}
                {!item.sealed && (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACING.xs, marginTop: SPACING.xs }}>
                    {CAPSULE_REACTIONS.map((r) => {
                      const count = item.reactions?.[r.key] ?? 0;
                      return (
                        <Pressable
                          key={r.key}
                          testID={`capsule-react-${item.id}-${r.key}`}
                          accessibilityRole="button"
                          accessibilityLabel={`${r.label} reaction: ${count}`}
                          onPress={() => void handleReact(item.id, r.key)}
                          style={{
                            minHeight: MIN_TARGET_DP,
                            minWidth: MIN_TARGET_DP,
                            paddingHorizontal: SPACING.md,
                            borderRadius: RADII.pill,
                            alignItems: "center",
                            justifyContent: "center",
                            flexDirection: "row",
                            gap: SPACING.xs,
                            borderWidth: 1,
                            borderColor: count > 0 ? accentColor : colors["color-border-subtle"],
                            backgroundColor: count > 0 ? mix(accentColor, "transparent", 20) : colors["color-surface-2"],
                          }}
                        >
                          <Text style={{ fontSize: 20 }}>{r.emoji}</Text>
                          <Text
                            style={{
                              color: colors["color-text-primary"],
                              fontSize: TYPOGRAPHY.label.fontSize,
                              fontWeight: count > 0 ? "700" : "500",
                            }}
                          >
                            {count}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </Material>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Seal New Capsule Modal */}
      <Modal
        visible={composerOpen}
        onClose={() => setComposerOpen(false)}
        title="Seal a Family Time Capsule"
        description="Save a letter, prediction, or milestone for a future date"
        testID="capsule-composer-modal"
      >
        <View style={{ gap: SPACING.md }}>
          <TextField
            testID="capsule-composer-title"
            label="Memory Title"
            placeholder="e.g. Summer Vacation Wishes"
            value={draftTitle}
            onChangeText={setDraftTitle}
          />
          <TextField
            testID="capsule-composer-message"
            label="Letter or Note"
            placeholder="Write a message for the family to read in the future..."
            value={draftMessage}
            onChangeText={setDraftMessage}
            multiline
          />
          <View style={{ gap: SPACING.xs }}>
            <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
              When should it open?
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACING.xs }}>
              {UNLOCK_PRESETS.map((preset) => {
                const active = draftUnlock === preset;
                return (
                  <Pressable
                    key={preset}
                    testID={`capsule-preset-${preset}`}
                    accessibilityRole="button"
                    accessibilityLabel={preset}
                    onPress={() => setDraftUnlock(preset)}
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
                      {preset}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
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
              testID="capsule-composer-save"
              disabled={!draftTitle.trim()}
              style={{ minHeight: MIN_TARGET_DP, minWidth: MIN_TARGET_DP }}
              onPress={() => void handleSealCapsule()}
            >
              🔒 Seal Capsule
            </SoftButton>
          </View>
        </View>
      </Modal>

      {/* Read Capsule Modal */}
      <Modal
        visible={readingCapsule !== null}
        onClose={() => setReadingCapsule(null)}
        title={readingCapsule ? `${readingCapsule.emoji} ${readingCapsule.title}` : "Time Capsule"}
        description={readingCapsule ? `Written by ${readingCapsule.author} on ${readingCapsule.createdAt}` : ""}
        testID="capsule-reader-modal"
      >
        <View style={{ gap: SPACING.md }}>
          <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, lineHeight: 24 }}>
            {readingCapsule?.message}
          </Text>
          <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
            <SoftButton
              variant="primary"
              style={{ minHeight: MIN_TARGET_DP, minWidth: MIN_TARGET_DP }}
              onPress={() => setReadingCapsule(null)}
            >
              Done Reading
            </SoftButton>
          </View>
        </View>
      </Modal>

      <CelebrationOverlay
        testID="celebration-overlay"
        event={celebrationEvent}
        characterOverride={companion}
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
