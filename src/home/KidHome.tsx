import React, { useMemo, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { TYPOGRAPHY } from "../theme/tokens";
import { useAuth } from "../state/AuthProvider";
import { useSync, type WeekData } from "../state/SyncManager";
import { Modal } from "../ui/Modal";
import { PinPad } from "../ui/PinPad";
import { SoftButton } from "../ui/SoftButton";
import { Chip } from "../ui/Chip";
import { EmptyState } from "../ui/EmptyState";
import { ListRow } from "../ui/ListRow";
import { useToast } from "../ui/Toast";
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
 * Kid Home (WS-4) — the gamified wall a signed-in child/pet gets INSTEAD of
 * the family bento (the mode switch lives in app/index.tsx). Ported from the
 * web's modes/kid/KidHome.tsx hero + quest structure, minus the out-of-scope
 * machinery: no bedtime view (that's the reminder surface), no FogBackground
 * (the kit's atmosphere), no client outbox (the claim route carries the
 * durability contract), no crew quests (a Tasks-page surface — crew rows here
 * are read-only with an honest referral).
 *
 * Data truth: reads the SHARED SyncManager snapshot only (tasks + weekData —
 * leaderboard parity: reads, never re-fetches). Points/streak display what
 * the server sends under the exact full-name key. Completions ride the SAME
 * claim seam as the wall Tasks page (src/tasks/claim.ts): under-10 session
 * completions carry no pin; 10+ (and pets) verify in the quest PinPad first.
 * pendingApproval is the server's marker — never client-computed points.
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

export function KidHome() {
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
    <View testID="kid-home" style={{ flex: 1, paddingHorizontal: 24, paddingTop: 16 }}>
      {/* Hero — roster emoji (never a photo data URL), greeting, week points,
          level chip, streak; Switch member signs out to the family rail. */}
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <View style={{ flexShrink: 1 }}>
          <Text testID="kid-emoji" style={{ fontSize: 72, lineHeight: 80 }}>
            {kidEmoji(member?.emoji)}
          </Text>
          <Text
            style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.stat.fontSize, fontWeight: "700", marginTop: 4 }}
          >
            Hi {first} 👋
          </Text>
          <View style={{ flexDirection: "row", alignItems: "baseline", marginTop: 4, gap: 8 }}>
            <Text
              style={{ color: colors["color-text-primary"], fontSize: 40, fontWeight: "800", fontVariant: ["tabular-nums"] }}
            >
              {points}
            </Text>
            <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.body.fontSize }}>pts this week</Text>
          </View>
          {/* The web splits "This Week" from the all-time "Forever" level —
              the native snapshot only carries this week's figures, so the
              scope is LABELED instead of lying about permanence
              (sort-of-forever levels would evaporate every Monday reset). */}
          <View style={{ marginTop: 8, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Chip as="span" size="sm" tone="accent" label={`⭐ Level ${level} this week`} />
            <Text
              style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize }}
              testID="kid-hero-reset"
            >
              {resetsIn ? `Resets ${resetsIn}` : null}
            </Text>
          </View>
        </View>
        <View style={{ alignItems: "flex-end", gap: 10 }}>
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
      </View>
      {stale ? (
        <Text
          testID="kid-stale"
          style={{
            color: colors["color-accent-amber"] ?? accentColor,
            fontSize: TYPOGRAPHY.label.fontSize,
            fontWeight: "600",
            marginBottom: 8,
          }}
        >
          {READ_COPY_STALE}
        </Text>
      ) : null}

      <Text
        style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.title.fontSize, fontWeight: "700", marginBottom: 10 }}
      >
        🎯 Your Quests
      </Text>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 180 }} showsVerticalScrollIndicator={false}>
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
