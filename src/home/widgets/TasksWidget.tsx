import React from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../state/AuthProvider";
import { useTheme } from "../../theme/ThemeProvider";
import { TYPOGRAPHY } from "../../theme/tokens";
import { mix } from "../../theme/mix";
import { EmptyState } from "../../ui/EmptyState";
import { ListRow } from "../../ui/ListRow";
import { Chip } from "../../ui/Chip";
import { useSync } from "../../state/SyncManager";
import { api } from "../../api/client";
import { classifyFailure, type ReadFailure } from "./data";
import { WidgetFrame } from "./WidgetFrame";
import { publishWallStats, publishWallStatsUnknown } from "../wall-stats";
import { DayLine } from "./DayLine";

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

const WALL_ROW_BUDGET = 2;

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
export function TasksWidget() {
  const { colors, accentColor } = useTheme();
  const router = useRouter();
  const { role, hydrated } = useAuth();
  // The CAPABILITY role, never the cached display profile: a stale cached
  // parent must not unlock the approval footer, and a cached profile has no
  // live session to read the family's tasks with.
  const isParent = role === "parent";
  const { snapshot, stale: syncStale, syncError, refreshNow } = useSync();

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
  const visible = (guest ? guestRows : pending).slice(0, WALL_ROW_BUDGET);
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
      } else {
        publishWallStatsUnknown("openTasks");
      }
      return;
    }
    if (hasData) publishWallStats({ openTasks: pending.length, openTasksStale: syncStale });
    else publishWallStatsUnknown("openTasks");
  }, [guest, guestRead.chores, guestPending.length, hasData, syncStale, pending.length]);

  return (
    <WidgetFrame
      id="tasks"
      icon="✅"
      title="Tasks"
      description={description}
      status={status}
      failure={failure}
      hasData={hasData}
      stale={guest ? guestRead.failure !== null && guestRead.chores !== null : !guest && syncStale}
      onRetry={guest ? () => { void readGuestChores(); } : refreshNow}
    >
      {visible.length === 0 ? (
        <EmptyState flat icon="🎉" title="All caught up" body="No pending tasks right now." style={{ flex: 1 }} />
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
                  style={{ minHeight: 52, paddingVertical: 8 }}
                  title={readableTitle(task.title)}
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
            return (
              <ListRow
                key={String(task.id)}
                style={{ minHeight: 52, paddingVertical: 8 }}
                title={readableTitle(task.title)}
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
                        paddingHorizontal: 10,
                        paddingVertical: 4,
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
              style={{ minHeight: 28, justifyContent: "center", marginTop: 2 }}
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
              style={{ minHeight: 28, justifyContent: "center", marginTop: 2 }}
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
