import React from "react";
import { Text, View } from "react-native";
import { useAuth } from "../../state/AuthProvider";
import { useTheme } from "../../theme/ThemeProvider";
import { TYPOGRAPHY } from "../../theme/tokens";
import { EmptyState } from "../../ui/EmptyState";
import { ListRow } from "../../ui/ListRow";
import { Chip } from "../../ui/Chip";
import { useSync } from "../../state/SyncManager";
import { WidgetFrame } from "./WidgetFrame";

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
 * Tasks cell — the wall's read-only mirror of the Home tasks widget
 * (Home-ai src/app/page.tsx "tasks" case): pending count, kid rows that admit
 * `pendingApproval` instead of promising points, and the parent-only
 * "N need approval" footer. Reads the SHARED /api/tasks/sync snapshot —
 * zero re-fetch (leaderboard parity); sync failure is the shared honest
 * error/stale vocabulary with a real retry.
 */
export function TasksWidget() {
  const { colors, accentColor } = useTheme();
  const { member, hydrated } = useAuth();
  const isParent = member?.role === "parent";
  const { snapshot, stale: syncStale, syncError, refreshNow } = useSync();

  const tasks = React.useMemo(
    () => ((snapshot?.tasks as WallTask[] | undefined) ?? []),
    [snapshot]
  );
  // Pending rows: uncompleted + a kid's LANDED tap (server shape:
  // completed:true+pendingApproval — task-utils.ts:60) still counts as
  // "waiting", not done; parents approve it on the Tasks page.
  const pending = React.useMemo(
    () => tasks.filter((t) => !t.completed || !!t.pendingApproval),
    [tasks]
  );
  const pendingApprovalCount = React.useMemo(
    () => tasks.filter((t) => !!t.pendingApproval).length,
    [tasks]
  );

  const visible = pending.slice(0, WALL_ROW_BUDGET);
  const hidden = pending.length - visible.length;

  const guest = hydrated && !member;
  const hasData = !guest && snapshot !== null;
  const failure = guest
    ? "unauthorised"
    : syncError === "unreachable"
      ? "offline"
      : syncError
        ? "error"
        : null;
  const status = guest || (syncError !== null && !hasData) ? "error" : hasData ? "ready" : "loading";

  const description = hasData ? `${pending.length} pending for the family` : undefined;

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
          {visible.map((task) => {
            const points = typeof task.points === "number" ? task.points : 0;
            const pointsColor =
              points > 15
                ? colors["color-accent-rose"] ?? accentColor
                : points > 10
                  ? colors["color-accent-amber"] ?? accentColor
                  : colors["color-accent-mint"] ?? accentColor;
            const awaiting = !!task.pendingApproval;
            const subtitle = [task.assignee, task.due].filter(Boolean).join(" · ");
            return (
              <ListRow
                key={String(task.id)}
                title={task.title}
                subtitle={awaiting ? `Waiting for approval${subtitle ? ` · ${subtitle}` : ""}` : subtitle || undefined}
                leftRailColor={pointsColor}
                trailing={
                  awaiting ? (
                    <Chip as="span" size="sm" tone="warning" label="⏳ approval" />
                  ) : (
                    <Chip as="span" size="sm" tone="neutral" label={`+${points} pts`} />
                  )
                }
              />
            );
          })}
          {isParent && pendingApprovalCount > 0 ? (
            <Text
              style={{
                color: colors["color-text-secondary"],
                fontSize: TYPOGRAPHY.label.fontSize,
                fontWeight: "600",
                textAlign: "center",
                marginTop: 2,
              }}
            >
              {pendingApprovalCount} {pendingApprovalCount === 1 ? "needs" : "need"} approval
            </Text>
          ) : hidden > 0 ? (
            <Text
              style={{
                color: colors["color-text-secondary"],
                fontSize: TYPOGRAPHY.label.fontSize,
                fontWeight: "600",
                textAlign: "center",
                marginTop: 2,
              }}
            >
              +{hidden} more
            </Text>
          ) : null}
        </View>
      )}
    </WidgetFrame>
  );
}

export default TasksWidget;
