import React from "react";
import { Text, View } from "react-native";
import { useAuth } from "../../state/AuthProvider";
import { useTheme } from "../../theme/ThemeProvider";
import { TYPOGRAPHY } from "../../theme/tokens";
import { useSync, type WeekData } from "../../state/SyncManager";
import { weekStartMondayISO } from "./data";
import { WidgetFrame } from "./WidgetFrame";

const EMPTY_LEADERBOARD = "Be the first!";
const VISIBLE_RANKS = 3;

interface Ranked {
  name: string;
  points: number;
}

function rankWeek(weekData: WeekData | undefined): Ranked[] {
  if (!weekData?.points) return [];
  return Object.entries(weekData.points)
    .map(([name, points]) => ({ name, points: Number(points) || 0 }))
    .sort((a, b) => b.points - a.points);
}

/** Days until next Monday ("Resets in N days": Monday itself = 7, Sunday = 1). */
export function daysUntilReset(now: Date = new Date()): number {
  const monday = new Date(`${weekStartMondayISO(now)}T00:00:00`);
  const next = new Date(monday);
  next.setDate(next.getDate() + 7);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((next.getTime() - today.getTime()) / 86_400_000);
  return Math.min(7, Math.max(1, days));
}

/**
 * Wall leaderboard tile: this week's points race from the SHARED sync
 * snapshot (one /api/tasks/sync poll serves it — no widget re-fetch; the
 * web CacheRefresher parity). Top 3 + the honest week-reset line; sync
 * failure surfaces the shared read copy with a real retry (refreshNow).
 */
export function LeaderboardWidget() {
  const { colors } = useTheme();
  const { member, hydrated } = useAuth();
  const { snapshot, stale: syncStale, syncError, refreshNow } = useSync();

  const weekData = snapshot?.weekData as WeekData | undefined;
  const ranked = rankWeek(weekData);

  const guest = hydrated && !member;
  const hasData = !guest && !!weekData;
  const failure = guest
    ? "unauthorised"
    : syncError === "unreachable"
      ? "offline"
      : syncError
        ? "error"
        : null;
  const status = guest || (syncError !== null && !hasData) ? "error" : hasData ? "ready" : "loading";

  const medal = (i: number) => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`);

  return (
    <WidgetFrame
      id="leaderboard"
      icon="🏆"
      title="This Week's Leaderboard"
      status={status}
      failure={failure}
      hasData={hasData}
      stale={!guest && syncStale}
      onRetry={refreshNow}
    >
      {hasData ? (
        <View style={{ gap: 4, alignSelf: "stretch" }}>
          {ranked.length === 0 ? (
            <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.body.fontSize, textAlign: "center" }}>
              {EMPTY_LEADERBOARD}
            </Text>
          ) : (
            ranked.slice(0, VISIBLE_RANKS).map((r, i) => (
              <Text
                key={r.name}
                numberOfLines={1}
                style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize }}
              >
                {medal(i)} {r.name.split(" ")[0]} — {r.points} pts
              </Text>
            ))
          )}
          <Text
            style={{
              color: colors["color-text-secondary"],
              fontSize: TYPOGRAPHY.label.fontSize,
              textAlign: "center",
              marginTop: 2,
            }}
          >
            Resets in {daysUntilReset()} days
          </Text>
        </View>
      ) : null}
    </WidgetFrame>
  );
}

export default LeaderboardWidget;
