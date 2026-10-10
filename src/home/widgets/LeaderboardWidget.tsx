import React from "react";
import { Text, View } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";
import { TYPOGRAPHY } from "../../theme/tokens";
import { useSync, type WeekData } from "../../state/SyncManager";
import { WidgetFrame } from "./WidgetFrame";

const EMPTY_LEADERBOARD = "Be the first!";

interface Ranked {
  name: string;
  points: number;
}

function rankWeek(weekData: WeekData | undefined, rosterNames: string[]): Ranked[] {
  if (!weekData?.points) return [];
  const ranked = Object.entries(weekData.points)
    .map(([name, points]) => ({ name, points: Number(points) || 0 }))
    .sort((a, b) => b.points - a.points);
  if (ranked.length === 0) return [];
  // Kid display uses emoji-first names — the roster feeds display names;
  // points move only on parent approval (server-authoritative snapshot).
  void rosterNames;
  return ranked;
}

/**
 * Wall leaderboard tile: this week's points race from the SHARED sync
 * snapshot (one /api/tasks/sync poll serves it — no widget re-fetch; the
 * web CacheRefresher parity). Points display only; the snapshot is the
 * server's truth, never client-computed.
 */
export function LeaderboardWidget() {
  const { colors } = useTheme();
  const { snapshot, stale, lastSyncAt } = useSync();

  const weekData = snapshot?.weekData as WeekData | undefined;
  const ranked = rankWeek(weekData, []);
  const hasWeek = !!weekData;

  const medal = (i: number) => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`);

  return (
    <WidgetFrame
      id="leaderboard"
      icon="🏆"
      title="Leaderboard"
      status={hasWeek ? "ready" : "loading"}
      failure={null}
      hasData={hasWeek}
      stale={stale}
      onRetry={() => {}}
    >
      {hasWeek ? (
        <View style={{ gap: 4, alignSelf: "stretch" }}>
          {ranked.length === 0 ? (
            <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.body.fontSize, textAlign: "center" }}>
              {EMPTY_LEADERBOARD}
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
        </View>
      ) : null}
    </WidgetFrame>
  );
}
