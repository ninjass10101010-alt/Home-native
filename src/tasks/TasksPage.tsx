import React, { useMemo, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { Material } from "../theme/Material";
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
import { READ_COPY_STALE } from "../home/widgets/data";
import {
  normalizeSnapshotTasks,
  submitApproval,
  submitClaim,
  taskRefusalCopy,
  type TaskCommandOutcome,
  type WallTask,
} from "./claim";

/**
 * The wall's Tasks surface (WS-7): kid chores + parent approvals, all read
 * from the SHARED SyncManager snapshot (one poll serves every consumer — no
 * page fetch). Commands go through src/tasks/claim.ts; points are never
 * client-computed — a kid's tap shows the server's pendingApproval as
 * "⏳ Waiting for approval" until a parent approves.
 */

const GUEST_COPY = "Sign in with your PIN to see your chores.";
const LOADING_COPY = "Loading the family's chores…";
const LOAD_ERROR_COPY = "Couldn't load the family's chores right now.";
const KID_DONE_TOAST = "Nice work — sent for approval.";
const APPROVED_TOAST = "Approved — points added.";
const APPROVE_ALL_TOAST = "All approved — points added.";
const SENT_BACK_TOAST = "Sent back for a do-over.";
const SENT_CATCHING_UP = "Sent — the server will catch up.";
const WRONG_PIN_COPY = "Wrong PIN — try again.";
const WAITING_COPY = "⏳ Waiting for approval";
const KID_EMPTY_BODY = "No chores waiting for you right now.";
const PARENT_EMPTY_BODY = "No taps waiting for your OK right now.";
const RACE_TITLE = "This week's race";
const RACE_EMPTY = "Be the first!";

/** The ONE PIN-dialog intent, discriminated by kind (the web's PinIntent lesson: exactly one arm can be open). */
type PinIntent =
  | { kind: "kid-complete"; taskId: number }
  | { kind: "approve"; taskId: number }
  | { kind: "approve-all"; taskIds: number[] }
  | { kind: "send-back"; taskId: number };

/** Points-chip tone by value (TasksWidget convention: mint ≤10, amber >10, rose >15). */
function pointsTone(points: number): "success" | "warning" | "danger" {
  if (points > 15) return "danger";
  if (points > 10) return "warning";
  return "success";
}

/** Week race ranking (LeaderboardWidget parity) — display only, snapshot truth. */
function rankWeek(weekData: WeekData | undefined): { name: string; points: number }[] {
  if (!weekData?.points) return [];
  return Object.entries(weekData.points)
    .map(([name, points]) => ({ name, points: Number(points) || 0 }))
    .sort((a, b) => b.points - a.points);
}

const medal = (i: number) => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`);

export function TasksPage() {
  const { colors, accentColor } = useTheme();
  const toast = useToast();
  const { member, pinRequiredFor } = useAuth();
  const { snapshot, stale, lastSyncAt, refreshNow } = useSync();

  const tasks = useMemo(() => normalizeSnapshotTasks(snapshot?.tasks), [snapshot]);
  const weekData = (snapshot?.weekData ?? undefined) as WeekData | undefined;

  const [pinIntent, setPinIntent] = useState<PinIntent | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Synchronous double-tap guard for the PIN-free completion branch (web
  // pinFreeInFlightRef parity — the guard must fire before the next render).
  const inFlightRef = useRef<Set<number>>(new Set());

  const isKid = !!member && member.role !== "parent";
  const isParent = !!member && member.role === "parent";

  const myTasks = member ? tasks.filter((t) => t.assignee === member.name && !t.completed) : [];
  const queue = tasks.filter((t) => !!t.pendingApproval);

  const loading = !!member && snapshot === null && lastSyncAt === null;
  const loadFailed = !!member && snapshot === null && lastSyncAt !== null;

  /** Outcome → honest UI. Returns true when the intent's dialog (if any) should close. */
  const finish = (outcome: TaskCommandOutcome, appliedCopy: string): boolean => {
    if (outcome.kind === "applied") {
      toast.show(appliedCopy, { intent: "success" });
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
      // Stay in the pad — it shakes + clears; the family keeps their place.
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
      if (finish(outcome, KID_DONE_TOAST)) {
        setPinIntent(null);
        setPinError(null);
      }
    } finally {
      setBusy(false);
    }
  };

  const completeTask = (task: WallTask) => {
    if (!member || task.pendingApproval || busy) return;
    if (inFlightRef.current.has(task.id)) return;
    if (pinRequiredFor(member)) {
      // 10+ kids (and pets) verify with their PIN before the command sends.
      setPinIntent({ kind: "kid-complete", taskId: task.id });
      setPinError(null);
      return;
    }
    // Under-10: the signed-in session rides the claim — no PIN, no pad.
    inFlightRef.current.add(task.id);
    void runComplete(task.id).finally(() => inFlightRef.current.delete(task.id));
  };

  const runApproval = async (
    cmd: { action: "approve" | "approve-all" | "send-back"; taskId?: number; taskIds?: number[] },
    pin: string,
    appliedCopy: string
  ) => {
    if (!member || busy) return;
    setBusy(true);
    try {
      const outcome = await submitApproval({
        action: cmd.action,
        ...(cmd.taskId !== undefined ? { taskId: cmd.taskId } : {}),
        ...(cmd.taskIds !== undefined ? { taskIds: cmd.taskIds } : {}),
        memberName: member.name,
        pin,
      });
      // The server's own skipped count is more honest than a flat "approved".
      const copy =
        outcome.kind === "applied" && outcome.skipped
          ? `Approved — ${outcome.skipped} not eligible`
          : appliedCopy;
      if (finish(outcome, copy)) {
        setPinIntent(null);
        setPinError(null);
      }
    } finally {
      setBusy(false);
    }
  };

  const onPinVerified = (pin: string) => {
    if (!pinIntent) return;
    if (pinIntent.kind === "kid-complete") return void runComplete(pinIntent.taskId, pin);
    if (pinIntent.kind === "approve")
      return void runApproval({ action: "approve", taskId: pinIntent.taskId }, pin, APPROVED_TOAST);
    if (pinIntent.kind === "send-back")
      return void runApproval({ action: "send-back", taskId: pinIntent.taskId }, pin, SENT_BACK_TOAST);
    return void runApproval({ action: "approve-all", taskIds: pinIntent.taskIds }, pin, APPROVE_ALL_TOAST);
  };

  const openIntent = (intent: PinIntent) => {
    setPinIntent(intent);
    setPinError(null);
  };

  const padMember = member ? { name: member.name, emoji: member.emoji || "👤" } : null;
  const modalTitle =
    pinIntent?.kind === "kid-complete"
      ? "Check off a chore"
      : pinIntent?.kind === "approve"
        ? "Approve"
        : pinIntent?.kind === "approve-all"
          ? "Approve all"
          : "Send back";
  const modalDescription =
    pinIntent?.kind === "kid-complete"
      ? "Enter your PIN to check it off."
      : pinIntent?.kind === "approve"
        ? "Enter your PIN to approve this tap."
        : pinIntent?.kind === "approve-all"
          ? `Enter your PIN to approve all ${pinIntent.taskIds.length}.`
          : "Enter your PIN to send this back for a do-over.";

  const ranked = rankWeek(weekData);

  return (
    <View testID="tasks-page" style={{ flex: 1, paddingHorizontal: 24, paddingTop: 16 }}>
      {/* Page header (web hero parity) */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{ color: colors["color-text-primary"], fontSize: 54, fontWeight: "700" }}>Tasks</Text>
        <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.body.fontSize, marginTop: 4 }}>
          {isKid ? "Your chores — tap one to check it off" : isParent ? "Approvals and this week's race" : "The family chore board"}
        </Text>
        {stale && member ? (
          <Text
            testID="tasks-stale"
            style={{
              color: colors["color-accent-amber"] ?? accentColor,
              fontSize: TYPOGRAPHY.label.fontSize,
              fontWeight: "600",
              marginTop: 6,
            }}
          >
            {READ_COPY_STALE}
          </Text>
        ) : null}
      </View>

      {!member ? (
        <EmptyState icon="🔐" title="Tasks" body={GUEST_COPY} />
      ) : loading ? (
        <View testID="tasks-loading" accessibilityLabel={LOADING_COPY} style={{ gap: 12 }}>
          {[0, 1].map((i) => (
            <View key={i} style={{ height: 64, borderRadius: 20, backgroundColor: colors["color-surface-2"] }} />
          ))}
        </View>
      ) : loadFailed ? (
        <View testID="tasks-error">
          <EmptyState
            icon="✅"
            title="Tasks"
            body={LOAD_ERROR_COPY}
            actionLabel="Try again"
            onAction={() => void refreshNow()}
          />
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 180 }} showsVerticalScrollIndicator={false}>
          {isKid ? (
            <View style={{ gap: 12 }}>
              {myTasks.length === 0 ? (
                <EmptyState icon="🎉" title="All caught up" body={KID_EMPTY_BODY} />
              ) : (
                myTasks.map((t) => {
                  const awaiting = !!t.pendingApproval;
                  return (
                    <ListRow
                      key={t.id}
                      testID={`kid-task-${t.id}`}
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
                      onPress={awaiting ? undefined : () => completeTask(t)}
                    />
                  );
                })
              )}
            </View>
          ) : (
            <View style={{ gap: 24 }}>
              {/* Approval queue */}
              <View style={{ gap: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text
                    style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.title.fontSize, fontWeight: "700" }}
                  >
                    Waiting for approval{queue.length > 0 ? ` (${queue.length})` : ""}
                  </Text>
                  {queue.length > 1 ? (
                    <SoftButton
                      variant="secondary"
                      size="sm"
                      testID="tasks-approve-all"
                      disabled={busy}
                      onPress={() => openIntent({ kind: "approve-all", taskIds: queue.map((t) => t.id) })}
                    >
                      Approve all
                    </SoftButton>
                  ) : null}
                </View>
                {queue.length === 0 ? (
                  <EmptyState flat icon="🎉" title="All caught up" body={PARENT_EMPTY_BODY} />
                ) : (
                  queue.map((t) => {
                    const pendingBy = t.pendingApproval?.byName
                      ? t.pendingApproval.byName.split(" ")[0]
                      : null;
                    const pts = t.pendingApproval?.points || t.points;
                    return (
                      <View key={t.id} testID={`queue-row-${t.id}`} style={{ gap: 10 }}>
                        <ListRow
                          leading={<Text style={{ fontSize: 28 }}>{t.assigneeEmoji}</Text>}
                          title={t.title}
                          subtitle={pendingBy ? `By ${pendingBy} · waiting for your OK` : "Waiting for your OK"}
                          trailing={<Chip as="span" size="sm" tone={pointsTone(pts)} label={`+${pts} pts`} />}
                        />
                        <View style={{ flexDirection: "row", gap: 12 }}>
                          <SoftButton
                            variant="success"
                            size="sm"
                            style={{ flex: 1 }}
                            testID={`task-approve-${t.id}`}
                            disabled={busy}
                            onPress={() => openIntent({ kind: "approve", taskId: t.id })}
                          >
                            Approve ✓
                          </SoftButton>
                          <SoftButton
                            variant="ghost"
                            size="sm"
                            style={{ flex: 1 }}
                            testID={`task-sendback-${t.id}`}
                            disabled={busy}
                            onPress={() => openIntent({ kind: "send-back", taskId: t.id })}
                          >
                            Send back
                          </SoftButton>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>

              {/* Week race (LeaderboardWidget-style strip from the shared weekData) */}
              <View>
                <Text
                  style={{
                    color: colors["color-text-primary"],
                    fontSize: TYPOGRAPHY.title.fontSize,
                    fontWeight: "700",
                    marginBottom: 10,
                  }}
                >
                  {RACE_TITLE}
                </Text>
                <Material tier="thin" style={{ borderRadius: 20, paddingHorizontal: 20, paddingVertical: 16, gap: 4 }}>
                  {ranked.length === 0 ? (
                    <Text
                      style={{
                        color: colors["color-text-secondary"],
                        fontSize: TYPOGRAPHY.body.fontSize,
                        textAlign: "center",
                      }}
                    >
                      {RACE_EMPTY}
                    </Text>
                  ) : (
                    ranked.slice(0, 5).map((r, i) => (
                      <Text
                        key={r.name}
                        numberOfLines={1}
                        style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize }}
                      >
                        {medal(i)} {r.name.split(" ")[0]} — {r.points}
                      </Text>
                    ))
                  )}
                </Material>
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {/* The ONE PIN dialog — kid 10+ completes, parent approve/send-back/approve-all. */}
      <Modal
        visible={!!pinIntent}
        onClose={() => !busy && setPinIntent(null)}
        title={modalTitle}
        description={modalDescription}
        dismissable={!busy}
        testID="tasks-pin-modal"
      >
        {padMember ? (
          <PinPad
            testID="tasks-pinpad"
            member={padMember}
            onVerified={(pin) => onPinVerified(pin)}
            onCancel={() => !busy && setPinIntent(null)}
            busy={busy}
            error={pinError}
          />
        ) : null}
      </Modal>
    </View>
  );
}

export default TasksPage;
