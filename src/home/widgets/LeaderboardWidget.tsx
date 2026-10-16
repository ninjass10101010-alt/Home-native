import React from "react";
import { Text, View } from "react-native";
import { useAuth } from "../../state/AuthProvider";
import { useTheme } from "../../theme/ThemeProvider";
import { TYPOGRAPHY } from "../../theme/tokens";
import { useSync, type WeekData } from "../../state/SyncManager";
import { displayEmoji } from "../../tasks/claim";
import { weekStartMondayISO } from "./data";
import { WidgetFrame } from "./WidgetFrame";

const EMPTY_LEADERBOARD = "Be the first!";
const EMPTY_PRIZES = "New week — prizes up for grabs 🥇🥈🥉";
const VISIBLE_RANKS = 3;

interface Ranked {
  name: string;
  points: number;
  /** Competition rank (0-based): ties share the rank (web parity). */
  rank: number;
}

/** Roster row subset — the wall passes its rail members for avatar emojis. */
export interface LeaderboardMember {
  name: string;
  emoji: string;
}

/**
 * Web parity (useLeaderboardData.ts:174-200): standard competition ranking —
 * ties share a rank (10/10/4 → two 🥇), and a week with no positive points is
 * NOT a podium (renders the empty state, never "🥇 Name 0 pts").
 */
export function rankWeek(weekData: WeekData | undefined): Ranked[] {
  if (!weekData?.points) return [];
  const positive = Object.entries(weekData.points)
    .map(([name, points]) => ({ name, points: Number(points) || 0 }))
    .filter((r) => r.points > 0)
    .sort((a, b) => b.points - a.points);
  const out: Ranked[] = [];
  for (let i = 0; i < positive.length; i++) {
    const tie = i > 0 && positive[i - 1].points === positive[i].points;
    out.push({ ...positive[i], rank: tie ? out[i - 1].rank : i });
  }
  return out;
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
 * web CacheRefresher parity). Top 3 with roster-emoji avatars + the honest
 * week-reset line (populated weeks only); sync failure surfaces the shared
 * read copy with a real retry (refreshNow).
 */
export function LeaderboardWidget({ members = [] }: { members?: LeaderboardMember[] }) {
  const { colors } = useTheme();
  const { member, hydrated } = useAuth();
  const { snapshot, stale: syncStale, syncError, refreshNow } = useSync();

  const weekData = snapshot?.weekData as WeekData | undefined;
  const ranked = rankWeek(weekData);

  // Roster emoji by first name (the rail's matching convention); the
  // displayEmoji guard keeps a photo data URL out of a Text glyph (1 MiB rule).
  const emojiFor = (fullName: string): string => {
    const first = fullName.split(" ")[0].toLowerCase();
    const row = members.find((m) => m.name.split(" ")[0].toLowerCase() === first);
    return displayEmoji(row?.emoji);
  };

  // Guest model: /api/tasks/sync requires a live session (server-auth), so a
  // signed-out fetch can only 401 — guests get the PIN gate WITHOUT a doomed
  // poll (the web keeps the same rule: no signed-out gateway polling).
  const guest = hydrated && !member;
  const hasData = !guest && !!weekData;
  // U5.1 taxonomy: "unreachable" is the family's connection; "server" is the
  // NAS answering and failing — an error, not offline.
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
            // The reference's empty week: crown + the prizes line, NO countdown.
            <View style={{ alignItems: "center", gap: 4 }}>
              <Text style={{ fontSize: 32 }}>👑</Text>
              <Text
                style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}
              >
                {EMPTY_LEADERBOARD}
              </Text>
              <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }}>
                {EMPTY_PRIZES}
              </Text>
            </View>
          ) : (
            ranked.slice(0, VISIBLE_RANKS).map((r) => (
              <View key={r.name} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colors["color-surface-2"],
                  }}
                >
                  <Text style={{ fontSize: 20 }}>{emojiFor(r.name)}</Text>
                </View>
                <Text
                  numberOfLines={1}
                  style={{ flex: 1, color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "600" }}
                >
                  {medal(r.rank)} {r.name.split(" ")[0]}
                </Text>
                <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
                  {r.points} pts
                </Text>
              </View>
            ))
          )}
          {ranked.length > 0 ? (
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
          ) : null}
        </View>
      ) : null}
    </WidgetFrame>
  );
}

function medal(rank: number): string {
  return rank === 0 ? "🥇" : rank === 1 ? "🥈" : rank === 2 ? "🥉" : `${rank + 1}.`;
}

export default LeaderboardWidget;
