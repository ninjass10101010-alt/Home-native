import React, { useMemo, useRef, useState } from "react";
import { Image, ScrollView, Text, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { TYPOGRAPHY } from "../theme/tokens";
import { Material } from "../theme/Material";
import { mix } from "../theme/mix";
import { useAuth } from "../state/AuthProvider";
import { useSync, type WeekData } from "../state/SyncManager";
import { Modal } from "../ui/Modal";
import { PinPad } from "../ui/PinPad";
import { SoftButton } from "../ui/SoftButton";
import { Chip } from "../ui/Chip";
import { MoreButton } from "../nav/CapsuleDock";
import { EmptyState } from "../ui/EmptyState";
import { ListRow } from "../ui/ListRow";
import { useToast } from "../ui/Toast";
import { EmergencyShield } from "./EmergencyShield";
import { HomeWidgetIcon } from "../ui/HomeWidgetIcon";
import { AnimatedEmoji } from "../ui/AnimatedEmoji";
import { isPhotoUri } from "../ui/MemberRail";
import { READ_COPY_STALE } from "./widgets/data";
import {
  submitClaim,
  taskRefusalCopy,
  type TaskCommandOutcome,
  type WallTask,
} from "../tasks/claim";
import {
  crewTaskIdsOf,
  kidEmoji,
  kidPoints,
  kidQuestsFor,
  kidStreak,
} from "./kid-quest";

/**
 * Kid Home (WS-4 / WS-5) — the gamified wall a signed-in child/pet gets INSTEAD
 * of the family bento (the mode switch lives in app/index.tsx). Ported from the
 * web's modes/kid/KidHome.tsx hero + quest structure:
 * - Center hero with 120×120dp glowing circular avatar disc supporting real photos
 * - Toned hero card with level XP progress bar and switch member affordance
 * - Toned regular-tier .widget-card wrapping "🎯 Your Quests" with HomeWidgetIcon
 * - Emergency shield top-right across all modes
 * - MoreButton in top header row
 */

const KID_DONE_TOAST = "Nice work — sent for approval.";
const SENT_CATCHING_UP = "Sent — the server will catch up.";
const WRONG_PIN_COPY = "Wrong PIN — try again.";
const WAITING_COPY = "⏳ Waiting for approval";
const CREW_REFERRAL = "See the Tasks page";
const LOADING_LABEL_TEXT = "Loading your quests…";
const LOAD_ERROR_COPY = "Couldn't load your quests right now.";

/** POINTS_PER_LEVEL: web parity (Home-ai src/modes/kid/KidHome.tsx). */
export const POINTS_PER_LEVEL = 50;

/** The web kid home's leveling math, ported: floor(points / 50) + 1. Non-finite
 *  points honestly refuse to pretend (NaN/∞ → level 1, the starting level). */
export function kidLevel(points: number): number {
  if (!Number.isFinite(points) || points < 0) return 1;
  return Math.floor(points / POINTS_PER_LEVEL) + 1;
}

/** Points-chip tone (web QuestCard/TasksWidget convention: mint ≤10, amber >10, rose >15). */
function pointsTone(points: number): "success" | "warning" | "danger" {
  if (points > 15) return "danger";
  if (points > 10) return "warning";
  return "success";
}

export interface KidHomeProps { onOpenMore?: () => void; }
export function KidHome({ onOpenMore }: KidHomeProps = {}) {
  const { colors, accentColor } = useTheme();
  const toast = useToast();
  const { member, signOut, pinRequiredFor } = useAuth();
  const { snapshot, stale, lastSyncAt, refreshNow } = useSync();

  // KidHome is mounted only for a signed-in kid/pet (app/index.tsx) — but the
  // component stays honest even mid-sign-out (member flips null same render).
  const name = member?.name ?? "";
  const first = name.split(" ")[0] || "Buddy";

  const weekData = (snapshot?.weekData ?? undefined) as WeekData | undefined;
  const quests = useMemo(() => kidQuestsFor(snapshot?.tasks, name), [snapshot, name]);
  const crewIds = useMemo(() => crewTaskIdsOf(snapshot?.tasks), [snapshot]);

  const points = kidPoints(weekData, name);
  const streak = kidStreak(weekData, name);
  // This week's reset horizon: weekStart (Mon) + 7 days, in whole days. The
  // web shows "Resets in N days"; native shows it only when it's knowable.
  // Render-time Date.now() trips the purity rule — treat the current render's
  // clock as state (initialised once per mount; the horizon moves daily).
  const [mountNow] = useState(() => new Date());
  const resetsIn = weekData?.weekStart
    ? (() => {
        const end = new Date(`${weekData.weekStart}T00:00:00`);
        end.setDate(end.getDate() + 7);
        const days = Math.ceil((end.getTime() - mountNow.getTime()) / 86_400_000);
        return days > 1 ? `in ${days} days` : days === 1 ? "tomorrow" : null;
      })()
    : null;
  const level = kidLevel(points);
  const xpInLevel = points >= 0 ? points % POINTS_PER_LEVEL : 0;
  const xpProgress = xpInLevel / POINTS_PER_LEVEL;

  const hasPhoto = member?.emoji ? isPhotoUri(member.emoji) : false;

  // Sync-state honesty (TasksPage parity): no snapshot before the first poll
  // landed = loading; no snapshot after a failed poll = a visible error with a
  // way back. Never fake "All quests complete!" on unknown data.
  const loading = !!member && snapshot === null && lastSyncAt === null;
  const loadFailed = !!member && snapshot === null && lastSyncAt !== null;

  const [pinTaskId, setPinTaskId] = useState<number | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Synchronous double-tap guard for the PIN-free branch (TasksPage parity:
  // the ref fires before the next render ever could).
  const inFlightRef = useRef<Set<number>>(new Set());

  /** Outcome → honest UI. Returns true when the quest pad (if open) should close. */
  const finish = (outcome: TaskCommandOutcome): boolean => {
    if (outcome.kind === "applied") {
      toast.show(KID_DONE_TOAST, { intent: "success" });
      void refreshNow();
      return true;
    }
    if (outcome.kind === "sending") {
      // 202 either way (durably queued or applied-but-unreconciled): NEVER
      // assume instant apply — the shared snapshot poll owns the truth.
      toast.show(outcome.notice ?? SENT_CATCHING_UP, { intent: "info" });
      void refreshNow();
      return true;
    }
    if (outcome.wrongPin) {
      if (pinTaskId === null) {
        // Under-10 PIN-free path: a 401 here is a DEAD SESSION, not a typo —
        // silent no-ops are dishonest (TasksPage parity).
        toast.show(taskRefusalCopy("session_required"), { intent: "error" });
        return true;
      }
      // Stay in the pad — it shakes + clears; the kid keeps their place.
      setPinError(WRONG_PIN_COPY);
      return false;
    }
    toast.show(taskRefusalCopy(outcome.reason), { intent: "error" });
    if (outcome.refreshes) void refreshNow(); // 404/409: the row provably moved on
    return true;
  };

  const runComplete = async (taskId: number, pin?: string) => {
    if (!member || busy) return;
    setBusy(true);
    try {
      const outcome = await submitClaim({
        action: "complete",
        taskId,
        ...(pin ? { memberName: member.name, pin } : {}),
      });
      if (finish(outcome)) {
        setPinTaskId(null);
        setPinError(null);
      }
    } finally {
      setBusy(false);
    }
  };

  const completeQuest = (task: WallTask) => {
    if (!member || task.pendingApproval || busy) return;
    if (inFlightRef.current.has(task.id)) return;
    if (pinRequiredFor(member)) {
      // 10+ kids (and pets) verify with their PIN before the command sends.
      setPinTaskId(task.id);
      setPinError(null);
      return;
    }
    // Under-10: the signed-in session rides the claim — no PIN, no pad.
    inFlightRef.current.add(task.id);
    void runComplete(task.id).finally(() => inFlightRef.current.delete(task.id));
  };

  const padMember = member ? { name: member.name, emoji: kidEmoji(member.emoji) } : null;

  return (
    <View testID="kid-home" style={{ flex: 1, paddingHorizontal: 24, paddingTop: 24 }}>
      {/* Emergency shield: always mounted top-right across all modes */}
      <EmergencyShield style={{ zIndex: 10 }} />

      {/* Top action row: clears floating shield column (paddingRight: 88) */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "flex-end",
          alignItems: "center",
          paddingRight: 88,
          minHeight: 48,
          marginBottom: 8,
        }}
      >
        {onOpenMore ? <MoreButton onPress={onOpenMore} /> : null}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 180, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Centered Hero: glowing avatar disc supporting real photos */}
        <View style={{ alignItems: "center", marginTop: 4, marginBottom: 8 }}>
          <View
            style={{
              width: 120,
              height: 120,
              borderRadius: 60,
              borderWidth: 3,
              borderColor: mix(accentColor, "transparent", 55),
              backgroundColor: mix(accentColor, "transparent", 18),
              alignItems: "center",
              justifyContent: "center",
              shadowColor: accentColor,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.35,
              shadowRadius: 20,
              elevation: 6,
            }}
          >
            {hasPhoto ? (
              <Image
                source={{ uri: member!.emoji }}
                style={{ width: 114, height: 114, borderRadius: 57 }}
                resizeMode="cover"
              />
            ) : null}
            <AnimatedEmoji
              emoji={kidEmoji(member?.emoji)}
              size={64}
              style={hasPhoto ? { position: "absolute", width: 0, height: 0, opacity: 0 } : undefined}
              testID="kid-emoji"
            />
          </View>
          <Text
            style={{
              color: colors["color-text-primary"],
              fontSize: TYPOGRAPHY.stat.fontSize,
              fontWeight: "700",
              marginTop: 10,
            }}
          >
            Hey {first}! 👋
          </Text>
        </View>

        {/* Hero Card: XP progress bar, points, level chip, streak & switch member */}
        <Material
          tier="regular"
          tone={accentColor}
          style={{
            borderRadius: 28,
            padding: 20,
            gap: 14,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
              <Text
                style={{
                  color: colors["color-text-primary"],
                  fontSize: 40,
                  fontWeight: "800",
                  fontVariant: ["tabular-nums"],
                }}
              >
                {points}
              </Text>
              <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.body.fontSize }}>
                pts this week
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Chip as="span" size="sm" tone="accent" label={`⭐ Level ${level} this week`} />
              <Text
                style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize }}
                testID="kid-hero-reset"
              >
                {resetsIn ? `Resets ${resetsIn}` : null}
              </Text>
            </View>
          </View>

          {/* XP Progress Bar */}
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "600" }}>
                Level {level} Progress
              </Text>
              <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize, fontVariant: ["tabular-nums"] }}>
                {xpInLevel} / {POINTS_PER_LEVEL} XP
              </Text>
            </View>
            <View
              style={{
                height: 12,
                borderRadius: 6,
                backgroundColor: colors["color-surface-2"],
                overflow: "hidden",
                width: "100%",
              }}
            >
              <View
                style={{
                  width: `${Math.min(100, Math.max(4, Math.round(xpProgress * 100)))}%`,
                  height: 12,
                  borderRadius: 6,
                  backgroundColor: accentColor,
                }}
              />
            </View>
          </View>

          {/* Bottom row: Switch member & streak */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
            <SoftButton
              variant="secondary"
              size="sm"
              testID="kid-switch"
              onPress={() => void signOut()}
              accessibilityLabel="Switch member"
            >
              🔄 Switch member
            </SoftButton>
            {streak > 0 ? (
              <Chip as="span" size="sm" tone="warning" label={`🔥${streak}-day streak!`} />
            ) : null}
          </View>
        </Material>

        {stale ? (
          <Text
            testID="kid-stale"
            style={{
              color: colors["color-accent-amber"] ?? accentColor,
              fontSize: TYPOGRAPHY.label.fontSize,
              fontWeight: "600",
              marginBottom: 4,
            }}
          >
            {READ_COPY_STALE}
          </Text>
        ) : null}

        {/* Quests Widget Card */}
        <Material
          tier="regular"
          tone={accentColor}
          style={{
            borderRadius: 28,
            padding: 18,
            gap: 14,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <HomeWidgetIcon variant="tasks" size={28} title="Your Quests" />
            <Text
              style={{
                color: colors["color-text-primary"],
                fontSize: TYPOGRAPHY.title.fontSize,
                fontWeight: "700",
              }}
            >
              🎯 Your Quests
            </Text>
          </View>

          <View style={{ gap: 12 }}>
            {loading ? (
              <View testID="kid-loading" accessibilityLabel={LOADING_LABEL_TEXT} style={{ gap: 12 }}>
                {[0, 1].map((i) => (
                  <View key={i} style={{ height: 64, borderRadius: 20, backgroundColor: colors["color-surface-2"] }} />
                ))}
              </View>
            ) : loadFailed ? (
              <EmptyState
                icon="🎯"
                title="Your Quests"
                body={LOAD_ERROR_COPY}
                actionLabel="Try again"
                onAction={() => void refreshNow()}
              />
            ) : quests.length === 0 ? (
              <EmptyState
                icon="🎉"
                title="All quests complete!"
                body="You're a superstar! Check back later for new ones."
              />
            ) : (
              quests.map((t) => {
                if (crewIds.has(t.id)) {
                  // Crew chores are a Tasks-page surface: read-only here, with an
                  // honest referral instead of a fake ✓ (spec §6 crews exclusion).
                  return (
                    <View
                      key={t.id}
                      testID={`kid-crew-${t.id}`}
                      accessibilityLabel={`${t.title} — a crew quest`}
                      style={{
                        minHeight: 64,
                        borderRadius: 20,
                        backgroundColor: colors["color-surface-2"],
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                      }}
                    >
                      <Text style={{ fontSize: 28 }}>{t.assigneeEmoji}</Text>
                      <Text
                        numberOfLines={2}
                        style={{ flex: 1, color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "600" }}
                      >
                        {t.title}
                      </Text>
                      <Chip as="span" size="sm" tone="violet" label={CREW_REFERRAL} />
                    </View>
                  );
                }
                const awaiting = !!t.pendingApproval;
                return (
                  <ListRow
                    key={t.id}
                    testID={`kid-quest-${t.id}`}
                    accessibilityLabel={awaiting ? `${t.title} — waiting for approval` : `Complete ${t.title}`}
                    leading={<Text style={{ fontSize: 28 }}>{t.assigneeEmoji}</Text>}
                    title={t.title}
                    subtitle={awaiting ? WAITING_COPY : undefined}
                    trailing={
                      awaiting ? (
                        <Chip as="span" size="sm" tone="warning" label="⏳ approval" />
                      ) : (
                        <Chip as="span" size="sm" tone={pointsTone(t.points)} label={`+${t.points} pts`} />
                      )
                    }
                    onPress={awaiting ? undefined : () => completeQuest(t)}
                  />
                );
              })
            )}
          </View>
        </Material>
      </ScrollView>

      {/* The quest PIN gate (10+ kids / pets) — same modal shape the wall
          Tasks page uses; the pad's onVerified rides the same claim seam. */}
      <Modal
        visible={pinTaskId !== null}
        onClose={() => !busy && setPinTaskId(null)}
        title="Check off a chore"
        description="Enter your PIN to check it off."
        dismissable={!busy}
        testID="kid-quest-pin-modal"
      >
        {padMember ? (
          <PinPad
            testID="kid-pinpad"
            member={padMember}
            onVerified={(pin) => pinTaskId !== null && void runComplete(pinTaskId, pin)}
            onCancel={() => !busy && setPinTaskId(null)}
            busy={busy}
            error={pinError}
          />
        ) : null}
      </Modal>
    </View>
  );
}

export default KidHome;
