import React from "react";
import { Image, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth, pinRequiredFor as modulePinRequiredFor } from "../../state/AuthProvider";
import { useTheme } from "../../theme/ThemeProvider";
import { hapticError, hapticSuccess, hapticTap } from "../../theme/haptics";
import { TYPOGRAPHY, MIN_TARGET_DP } from "../../theme/tokens";
import { mix } from "../../theme/mix";
import { EmptyState } from "../../ui/EmptyState";
import { ListRow } from "../../ui/ListRow";
import { Chip } from "../../ui/Chip";
import { useOptionalToast } from "../../ui/Toast";
import { isPhotoUri } from "../../ui/MemberRail";
import { useSync } from "../../state/SyncManager";
import { api } from "../../api/client";
import { getCachedMembersSync, readCachedMembers } from "../../api/members";
import { rosterMemberFor } from "../../tasks/board";
import { displayEmoji, submitClaim, taskRefusalCopy } from "../../tasks/claim";
import { classifyFailure, type ReadFailure } from "./data";
import { WidgetFrame } from "./WidgetFrame";
import { publishWallStats, publishWallStatsUnknown } from "../wall-stats";
import { DayLine } from "./DayLine";
import { wallRowBudget, type WallSpan } from "../widgets";

/** Snapshot task row per Home-ai src/types/tasks.ts (subset read by the wall). */
interface WallTask {
  id: number | string;
  title: string;
  assignee?: string;
  due?: string;
  points?: number;
  completed?: boolean;
  /** Server-authoritative pending approval — displayed as-is, never computed. */
  pendingApproval?: { byName?: string; at?: string; points?: number } | null;
}

/**
 * One chore from the PUBLIC lane (Home-ai /api/tasks/family): id, title,
 * assignee, done — and NOTHING else. No points, no approvals, no ledger.
 */
interface GuestChore {
  id: number | string;
  title: string;
  assignee?: string;
  done?: boolean;
}

/**
 * The family's own task titles carry the household's shorthand — "Feeding
 * Rico&Rocco" arrives as one run-on token (critic round 4, L8). The copy is
 * the family's; only the typography is ours, so the ampersand gets the spaces
 * a reader expects ("Feeding Rico & Rocco"). Nothing else about the title is
 * touched.
 */
function readableTitle(title: string): string {
  return title.replace(/\s*&\s*/g, " & ").trim();
}

interface TasksRosterMember {
  name: string;
  emoji: string;
}

const GENERIC_ASSIGNEES = new Set(["open", "all", "everyone", "family", "crew"]);
const SHARED_FAMILY_ASSIGNEES = new Set(["all", "everyone", "family", "crew"]);

function belongsToMember(assignee?: string, memberName?: string): boolean {
  const a = (assignee ?? "").trim().toLowerCase();
  const m = (memberName ?? "").trim().toLowerCase();
  if (!a || !m || GENERIC_ASSIGNEES.has(a)) return false;
  if (a === m) return true;
  return a.split(/\s+/)[0] === m.split(/\s+/)[0];
}

/**
 * Leading badge for a Tasks wall row: roster-first photo-aware avatar when
 * the assignee resolves to a member (`data:image/...` URIs strictly via
 * `<Image>`, never `<Text>`), or a subtle shared/open glyph badge otherwise.
 * Plain-object style carries numeric `width` + string `backgroundColor` so
 * `ListRow` mounts it directly without double-wrapping in a 44dp well.
 */
function renderAssigneeAvatar(opts: {
  taskId: number | string;
  assignee?: string;
  roster: readonly TasksRosterMember[];
  tone: string;
  surfaceBg?: string;
}): React.ReactElement {
  const testID = `tasks-avatar-${opts.taskId}`;
  const rawAssignee = (opts.assignee ?? "").trim();
  const memberMatch = rawAssignee ? rosterMemberFor(opts.roster, rawAssignee) : undefined;

  if (memberMatch) {
    const hasPhoto = memberMatch.emoji ? isPhotoUri(memberMatch.emoji) : false;
    return (
      <View
        testID={testID}
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: mix(opts.tone, opts.surfaceBg ?? "transparent", 20),
          borderWidth: 1,
          borderColor: mix(opts.tone, "transparent", 42),
          overflow: "hidden",
        }}
      >
        {hasPhoto ? (
          <Image
            testID={`${testID}-photo`}
            source={{ uri: memberMatch.emoji }}
            style={{ width: 30, height: 30, borderRadius: 15 }}
            resizeMode="cover"
          />
        ) : (
          <Text style={{ fontSize: 18 }}>{displayEmoji(memberMatch.emoji)}</Text>
        )}
      </View>
    );
  }

  const fallbackGlyph = SHARED_FAMILY_ASSIGNEES.has(rawAssignee.toLowerCase()) ? "👥" : "✨";
  return (
    <View
      testID={testID}
      style={{
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: mix(opts.tone, "transparent", 14),
        borderWidth: 1,
        borderColor: mix(opts.tone, "transparent", 34),
      }}
    >
      <Text style={{ fontSize: 16 }}>{fallbackGlyph}</Text>
    </View>
  );
}

/**
 * Tasks cell — the wall's read-only mirror of the Home tasks widget
 * (Home-ai src/app/page.tsx "tasks" case): pending count, kid rows that admit
 * `pendingApproval` instead of promising points, and the parent-only
 * "N need approval" footer.
 *
 * TWO LANES, one card:
 *   · SIGNED IN — reads the SHARED /api/tasks/sync snapshot (zero re-fetch,
 *     leaderboard parity). That snapshot is the only place points and
 *     approvals live, so this lane is the only one that may show them.
 *   · SIGNED OUT — reads the PUBLIC /api/tasks/family route (SP1.7): the
 *     family's chores and nothing else. The wall is a FAMILY DISPLAY, so the
 *     calendar, the meals, the photos and the roster are already readable
 *     without a session; the chores card was the last surface that was not.
 *     The guest lane NEVER paints points, NEVER an approval chip and NEVER
 *     the "N need approval" footer (a parent capability) — the route does
 *     not carry them, and the wall must not invent them.
 *
 * Sync failure keeps the shared honest error/stale vocabulary with a real
 * retry.
 */
export function TasksWidget({
  span = 1,
  members = [],
}: {
  span?: WallSpan;
  members?: readonly TasksRosterMember[];
}) {
  const { colors, accentColor } = useTheme();
  const router = useRouter();
  const toast = useOptionalToast();
  const { member, role, hydrated, pinRequiredFor } = useAuth();
  const rowBudget = wallRowBudget(span);
  const [cachedRoster, setCachedRoster] = React.useState<TasksRosterMember[]>(() => {
    const syncCached = typeof getCachedMembersSync === "function" ? getCachedMembersSync() : [];
    return syncCached.map((c) => ({ name: c.name, emoji: c.emoji }));
  });
  React.useEffect(() => {
    if (members.length > 0) return;
    let alive = true;
    void readCachedMembers()
      .then((cached) => {
        if (!alive || !Array.isArray(cached) || cached.length === 0) return;
        setCachedRoster(cached.map((c) => ({ name: c.name, emoji: c.emoji })));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [members.length]);
  const rosterMembers = members.length > 0 ? members : cachedRoster;
  // The CAPABILITY role, never the cached display profile: a stale cached
  // parent must not unlock the approval footer, and a cached profile has no
  // live session to read the family's tasks with.
  const isParent = role === "parent";
  const { snapshot, stale: syncStale, syncError, refreshNow } = useSync();
  const [completingIds, setCompletingIds] = React.useState<ReadonlySet<number>>(() => new Set());
  const inFlightRef = React.useRef<Set<number>>(new Set());
  const aliveRef = React.useRef(true);
  React.useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);
  const openTasks = React.useCallback(() => router.push("/tasks" as never), [router]);
  const pinCheck =
    typeof pinRequiredFor === "function"
      ? pinRequiredFor
      : typeof modulePinRequiredFor === "function"
        ? modulePinRequiredFor
        : (m: unknown) => !m;
  const isPinProtected = pinCheck(member as Parameters<typeof modulePinRequiredFor>[0]);
  const canQuickComplete = (task: WallTask): boolean =>
    role !== null &&
    Boolean(member) &&
    !isPinProtected &&
    !task.completed &&
    !task.pendingApproval &&
    typeof task.id === "number" &&
    Number.isSafeInteger(task.id) &&
    task.id > 0 &&
    belongsToMember(task.assignee, member?.name);

  const handleQuickComplete = async (task: WallTask) => {
    const taskId = Number(task.id);
    if (!Number.isSafeInteger(taskId) || taskId <= 0 || inFlightRef.current.has(taskId)) return;
    inFlightRef.current.add(taskId);
    setCompletingIds((prev) => new Set(prev).add(taskId));
    try {
      const outcome = await submitClaim({ action: "complete", taskId });
      if (!aliveRef.current) return;
      if (outcome.kind === "applied" || outcome.kind === "sending") {
        hapticSuccess();
        toast?.show(
          outcome.kind === "sending" ? "Sent — waiting for sync…" : "Marked done!",
          { intent: "success" }
        );
        void refreshNow();
      } else {
        hapticError();
        toast?.show(taskRefusalCopy(outcome.reason), { intent: "error" });
        if (outcome.refreshes) void refreshNow();
      }
    } finally {
      inFlightRef.current.delete(taskId);
      if (aliveRef.current) {
        setCompletingIds((prev) => {
          if (!prev.has(taskId)) return prev;
          const next = new Set(prev);
          next.delete(taskId);
          return next;
        });
      }
    }
  };

  // The GUEST model: no live session → no capability. The wall is still a
  // family display, so the chores come from the PUBLIC route.
  const guest = hydrated && role === null;

  // ── THE GUEST LANE ───────────────────────────────────────────────────────
  // The chores-only public read. The state is deliberately separate from the
  // shared snapshot: the snapshot is a session read (points + approvals), the
  // public route is not, and the two must never be mixed.
  const [guestRead, setGuestRead] = React.useState<{
    chores: GuestChore[] | null;
    failure: ReadFailure | null;
  }>({ chores: null, failure: null });
  const guestAliveRef = React.useRef(true);
  const guestRequestRef = React.useRef(0);

  // The unmount guard: an in-flight read must never setState after teardown.
  React.useEffect(() => {
    guestAliveRef.current = true;
    return () => {
      guestAliveRef.current = false;
    };
  }, []);

  const readGuestChores = React.useCallback(async () => {
    const requestId = guestRequestRef.current + 1;
    guestRequestRef.current = requestId;
    try {
      const res = await api<{ ok?: boolean; chores?: GuestChore[] }>("/api/tasks/family");
      // A newer read has landed (or the widget is gone): never setState.
      if (!guestAliveRef.current || guestRequestRef.current !== requestId) return;
      if (!Array.isArray(res?.chores)) {
        // The route answered with something that is not a chore list. That is
        // NOT "the family has no chores" — it is a read we cannot trust, and
        // it must never become a count (the kit bans the silent empty).
        throw new Error("invalid_chore_payload");
      }
      setGuestRead({ chores: res.chores, failure: null });
    } catch (e) {
      if (!guestAliveRef.current || guestRequestRef.current !== requestId) return;
      // U5.1 taxonomy, unchanged: an unreachable NAS is "offline", a server
      // that answered and failed is "error" — never the family's internet and
      // never a fake 0. A failed refresh keeps the last-good list on screen
      // (the frame badges it); the FIRST failure is the error state.
      setGuestRead((prev) => ({ chores: prev.chores, failure: classifyFailure(e) }));
    }
  }, []);

  React.useEffect(() => {
    if (!hydrated || !guest) return;
    void readGuestChores();
  }, [hydrated, guest, readGuestChores]);

  const tasks = React.useMemo(
    () => ((snapshot?.tasks as WallTask[] | undefined) ?? []),
    [snapshot]
  );
  // Web parity (page.tsx:451-457): the PENDING list is OPEN rows only — a
  // completed row awaiting approval moves to the approvals queue, never the
  // pending count (kid taps surface honestly via the parent footer instead).
  const pending = React.useMemo(() => tasks.filter((t) => !t.completed), [tasks]);
  // The authoritative predicate, ported from Home-ai/src/lib/task-utils.ts
  // (isPendingApproval): a row awaits approval only when it is completed AND
  // carries the marker. Dropping the `completed` half would count a row the
  // parent finds nothing to approve — the marker's `completed` half is the
  // guard the web wrote deliberately against cross-device snapshot merges.
  const pendingApprovalCount = React.useMemo(
    () => tasks.filter((t) => !!t.completed && !!t.pendingApproval).length,
    [tasks]
  );

  // The guest's chores: the OPEN ones only (the route publishes only those —
  // `done` is filtered defensively so a done row can never reach the wall's
  // pending list).
  const guestPending = React.useMemo(
    () => (guestRead.chores ?? []).filter((chore) => chore.done !== true),
    [guestRead.chores]
  );
  const guestRows: WallTask[] = React.useMemo(
    () => guestPending.map((chore) => ({ id: chore.id, title: chore.title, assignee: chore.assignee })),
    [guestPending]
  );

  const rowCount = guest ? guestRows.length : pending.length;
  const visible = (guest ? guestRows : pending).slice(0, rowBudget);
  const hidden = rowCount - visible.length;

  // U5.1 taxonomy: transport down is OFFLINE ("unreachable"); a NAS that
  // answered and failed ("server") is an ERROR — never blame the family's
  // internet for a 502. The guest lane keeps the same vocabulary.
  const hasData = guest ? guestRead.chores !== null : snapshot !== null;
  const failure: ReadFailure | null = guest
    ? guestRead.failure
    : syncError === "unreachable"
      ? "offline"
      : syncError === "unauthorized"
        ? "unauthorised"
        : syncError === "server"
          ? "error"
          : null;
  const status = guest
    ? guestRead.chores !== null
      ? "ready"
      : guestRead.failure
        ? "error"
        : "loading"
    : syncError !== null && !hasData
      ? "error"
      : hasData
        ? "ready"
        : "loading";

  // The card's second header line. It is DATA when the read answered
  // ("3 pending for the family" — the reference's own copy) and a STATIC,
  // count-free line when it did not: the band under the title band is
  // bottom-aligned (WidgetFrame's constant header band), so a card with no
  // second line slides its title below its neighbours' and the row stops
  // sharing one baseline. The line never claims a count it could not read.
  const description = guest
    ? guestRead.chores !== null
      ? `${guestPending.length} pending for the family`
      : "Pending for the family"
    : hasData
      ? `${pending.length} pending for the family`
      : "Pending for the family";

  // The KPI band's "Tasks · Pending" tile reads the same list this card reads
  // (src/home/wall-stats.ts) — one snapshot, two surfaces.
  //
  // The band must never disagree with the card it sits above (critic round 4,
  // HIGH 5). Two rules, both about the SAME number:
  //
  //   1. NO read at all → the band is told the count is UNKNOWN: the tile
  //      wears the same placeholder its siblings wear, so the band cannot
  //      contradict the PIN gate (or the offline notice) this card is
  //      showing. Publishing a hard 0 here would assert "nothing is pending"
  //      on a wall that never read the family's tasks.
  //   2. A STALE read → the card shows the last-good copy and says so
  //      ("Showing your saved copy — couldn't refresh."). The band publishes
  //      that SAME copy, marked stale, so the tile carries the staleness
  //      itself. The previous round published it as UNKNOWN, which put "—"
  //      in the band while the card asserted "17 pending for the family" —
  //      two contradictory claims in the same frame, 380px apart.
  //
  // The guest lane publishes ITS OWN truth: the count when the public read
  // answered, UNKNOWN when it did not (never a hard 0).
  React.useEffect(() => {
    if (guest) {
      if (guestRead.chores !== null) {
        publishWallStats({ openTasks: guestPending.length, openTasksStale: false });
      } else if (guestRead.failure !== null) {
        publishWallStatsUnknown("openTasks");
      }
      return;
    }
    if (hasData) publishWallStats({ openTasks: pending.length, openTasksStale: syncStale });
    else if (syncError !== null) publishWallStatsUnknown("openTasks");
  }, [guest, guestRead.chores, guestPending.length, guestRead.failure, hasData, syncStale, pending.length, syncError]);

  return (
    <WidgetFrame
      id="tasks"
      icon="✅"
      title="Tasks"
      description={description}
      onHeaderPress={openTasks}
      headerPressLabel="Open tasks"
      status={status}
      failure={failure}
      hasData={hasData}
      stale={guest ? guestRead.failure !== null && guestRead.chores !== null : !guest && syncStale}
      onRetry={guest ? () => { void readGuestChores(); } : refreshNow}
    >
      {visible.length === 0 ? (
        <Pressable
          testID="tasks-empty-open"
          accessibilityRole="button"
          accessibilityLabel="All caught up — open tasks"
          onPress={() => {
            hapticTap();
            openTasks();
          }}
          style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.78 : 1 })}
        >
          <EmptyState flat icon="🎉" title="All caught up" body="No pending tasks right now." style={{ flex: 1 }} />
        </Pressable>
      ) : (
        <View style={{ gap: 8 }}>
          {/* Web page.tsx:942: the bare rose clock band above the rows — the
              same rhythm Today's Events paints with its event markers. */}
          <DayLine testID="tasks-dayline" tone={colors["color-accent-rose"] ?? accentColor} marginBottom={0} />
          {visible.map((task) => {
            // The guest lane paints the chore and WHO it belongs to — nothing
            // else. The public route carries no points and no approvals, so
            // there is no point chip and no approval chip to draw (and the
            // wall must never invent them).
            if (guest) {
              return (
                <ListRow
                  key={String(task.id)}
                  testID={`tasks-chore-${task.id}`}
                  accessibilityLabel={`${readableTitle(task.title)}. Open tasks`}
                  onPress={openTasks}
                  style={{ minHeight: 56, paddingVertical: 8, paddingLeft: 18, paddingRight: 10, gap: 10 }}
                  leading={renderAssigneeAvatar({
                    taskId: task.id,
                    assignee: task.assignee,
                    roster: rosterMembers,
                    tone: accentColor,
                    surfaceBg: colors["color-surface-2"],
                  })}
                  title={
                    <Text
                      numberOfLines={2}
                      style={{
                        color: colors["color-text-primary"],
                        fontSize: TYPOGRAPHY.body.fontSize,
                        lineHeight: 20,
                        fontWeight: "600",
                      }}
                    >
                      {readableTitle(task.title)}
                    </Text>
                  }
                  subtitle={task.assignee || undefined}
                  leftRailColor={accentColor}
                />
              );
            }
            const points = typeof task.points === "number" ? task.points : 0;
            const pointsColor =
              points > 15
                ? colors["color-accent-rose"] ?? accentColor
                : points > 10
                  ? colors["color-accent-amber"] ?? accentColor
                  : colors["color-accent-mint"] ?? accentColor;
            const awaiting = !!task.completed && !!task.pendingApproval;
            const subtitle = [task.assignee, task.due].filter(Boolean).join(" · ");
            const quickCheck = canQuickComplete(task) ? (
              <Pressable
                testID={`tasks-quick-check-${task.id}`}
                accessibilityRole="button"
                accessibilityLabel={`Mark ${readableTitle(task.title)} done`}
                disabled={completingIds.has(Number(task.id))}
                hitSlop={14}
                onPress={(e) => {
                  e?.stopPropagation?.();
                  void handleQuickComplete(task);
                }}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: mix(pointsColor, "transparent", 16),
                  borderWidth: 1.5,
                  borderColor: mix(pointsColor, "transparent", 55),
                  opacity: completingIds.has(Number(task.id)) ? 0.5 : 1,
                }}
              >
                <Text
                  accessibilityElementsHidden
                  style={{
                    color: colors["color-text-primary"],
                    fontSize: 16,
                    fontWeight: "700",
                  }}
                >
                  {completingIds.has(Number(task.id)) ? "…" : "✓"}
                </Text>
              </Pressable>
            ) : undefined;
            const avatarLeading = renderAssigneeAvatar({
              taskId: task.id,
              assignee: task.assignee,
              roster: rosterMembers,
              tone: pointsColor,
              surfaceBg: colors["color-surface-2"],
            });
            return (
              <ListRow
                key={String(task.id)}
                testID={`tasks-row-${task.id}`}
                accessibilityLabel={`${readableTitle(task.title)}. Open tasks`}
                onPress={openTasks}
                style={{
                  minHeight: 56,
                  paddingVertical: 8,
                  paddingLeft: 18,
                  paddingRight: 10,
                  gap: 10,
                  borderColor: mix(pointsColor, colors["color-border"] ?? "transparent", 34),
                }}
                leading={quickCheck ?? avatarLeading}
                title={
                  <Text
                    numberOfLines={2}
                    style={{
                      color: colors["color-text-primary"],
                      fontSize: TYPOGRAPHY.body.fontSize,
                      lineHeight: 20,
                      fontWeight: "600",
                    }}
                  >
                    {readableTitle(task.title)}
                  </Text>
                }
                subtitle={awaiting ? `Waiting for approval${subtitle ? ` · ${subtitle}` : ""}` : subtitle || undefined}
                leftRailColor={pointsColor}
                trailing={
                  awaiting ? (
                    <Chip as="span" size="sm" tone="warning" label="⏳ approval" />
                  ) : (
                    <View
                      style={{
                        minHeight: 28,
                        borderRadius: 999,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        backgroundColor: mix(pointsColor, "transparent", 20),
                        borderWidth: 1,
                        borderColor: mix(pointsColor, "transparent", 40),
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          color: colors["color-text-primary"],
                          fontSize: TYPOGRAPHY.label.fontSize,
                          fontWeight: "700",
                        }}
                      >
                        +{points} pts
                      </Text>
                    </View>
                  )
                }
              />
            );
          })}
          {/* Web footer parity: a LINK to /tasks, not dead text — the parent's
              approval count and the "+N more" row both open the page that
              resolves them (page.tsx:933-935). The APPROVAL footer is a parent
              capability, so a guest never sees it — and a guest's route
              carries no approvals to count anyway. */}
          {isParent && pendingApprovalCount > 0 ? (
            <Pressable
              testID="tasks-approval-footer"
              accessibilityRole="link"
              accessibilityLabel={`${pendingApprovalCount} need approval. Open tasks`}
              hitSlop={16}
              onPress={() => router.push("/tasks")}
              style={{ minHeight: MIN_TARGET_DP, justifyContent: "center", marginTop: 2 }}
            >
              <Text
                style={{
                  color: colors["color-text-secondary"],
                  fontSize: TYPOGRAPHY.label.fontSize,
                  fontWeight: "600",
                  textAlign: "center",
                }}
              >
                {`${pendingApprovalCount} ${pendingApprovalCount === 1 ? "needs" : "need"} approval →`}
              </Text>
            </Pressable>
          ) : hidden > 0 ? (
            <Pressable
              testID="tasks-more-footer"
              accessibilityRole="link"
              accessibilityLabel={`${hidden} more tasks. Open tasks`}
              hitSlop={16}
              onPress={() => router.push("/tasks")}
              style={{ minHeight: MIN_TARGET_DP, justifyContent: "center", marginTop: 2 }}
            >
              <Text
                style={{
                  color: colors["color-text-secondary"],
                  fontSize: TYPOGRAPHY.label.fontSize,
                  fontWeight: "600",
                  textAlign: "center",
                }}
              >
                {`+${hidden} more · See all →`}
              </Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </WidgetFrame>
  );
}

export default TasksWidget;
