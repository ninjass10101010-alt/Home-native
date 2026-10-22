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
 * "N need approval" footer. Reads the SHARED /api/tasks/sync snapshot —
 * zero re-fetch (leaderboard parity); sync failure is the shared honest
 * error/stale vocabulary with a real retry.
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

  const visible = pending.slice(0, WALL_ROW_BUDGET);
  const hidden = pending.length - visible.length;

  // Guest model: /api/tasks/sync requires a live session (server-auth), so a
  // signed-out fetch can only 401 — guests get the PIN gate WITHOUT a doomed
  // poll (the web keeps the same rule: no signed-out gateway polling). The
  // CAPABILITY role decides: a cached profile has no live session either.
  const guest = hydrated && role === null;
  const hasData = !guest && snapshot !== null;
  // U5.1 taxonomy: transport down is OFFLINE ("unreachable"); a NAS that
  // answered and failed ("server") is an ERROR — never blame the family's
  // internet for a 502.
  const failure = guest
    ? "unauthorised"
    : syncError === "unreachable"
      ? "offline"
      : syncError === "unauthorized"
        ? "unauthorised"
        : syncError === "server"
          ? "error"
          : null;
  const status = guest || (syncError !== null && !hasData) ? "error" : hasData ? "ready" : "loading";

  // The card's second header line. It is DATA when the snapshot answered
  // ("3 pending for the family" — the reference's own copy) and a STATIC,
  // count-free line when it did not: the band under the title band is
  // bottom-aligned (WidgetFrame's constant header band), so a card with no
  // second line slides its title below its neighbours' and the row stops
  // sharing one baseline. The line never claims a count it could not read.
  const description = hasData
    ? `${pending.length} pending for the family`
    : guest
      ? "Sign in to see the family's tasks"
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
  React.useEffect(() => {
    if (hasData) publishWallStats({ openTasks: pending.length, openTasksStale: syncStale });
    else publishWallStatsUnknown("openTasks");
  }, [hasData, syncStale, pending.length]);

  return (
    <WidgetFrame
      id="tasks"
      icon="✅"
      title="Tasks"
      description={description}
      status={status}
      failure={failure}
      hasData={hasData}
      stale={!guest && syncStale}
      onRetry={refreshNow}
    >
      {visible.length === 0 ? (
        <EmptyState flat icon="🎉" title="All caught up" body="No pending tasks right now." style={{ flex: 1 }} />
      ) : (
        <View style={{ gap: 8 }}>
          {/* Web page.tsx:942: the bare rose clock band above the rows — the
              same rhythm Today's Events paints with its event markers. */}
          <DayLine testID="tasks-dayline" tone={colors["color-accent-rose"] ?? accentColor} marginBottom={0} />
          {visible.map((task) => {
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
              resolves them (page.tsx:933-935). */}
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
