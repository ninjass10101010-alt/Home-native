import React from "react";
import { Image, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { api } from "../../api/client";
import { readCachedMembers } from "../../api/members";
import type { DbListEnvelope } from "../../api/types";
import { useAuth } from "../../state/AuthProvider";
import { useTheme } from "../../theme/ThemeProvider";
import { TYPOGRAPHY } from "../../theme/tokens";
import { mix } from "../../theme/mix";
import { useSync, type WeekData } from "../../state/SyncManager";
import { displayEmoji } from "../../tasks/claim";
import { isPhotoUri } from "../../ui/MemberRail";
import { classifyFailure, weekStartMondayISO, type ReadFailure } from "./data";
import { WidgetFrame } from "./WidgetFrame";
import { AnimatedEmoji } from "../../ui/AnimatedEmoji";
import { EmptyState } from "../../ui/EmptyState";
import type { WallSpan } from "../widgets";

const EMPTY_LEADERBOARD = "Be the first!";
const EMPTY_PRIZES = "New week — prizes up for grabs 🥇🥈🥉";
const VISIBLE_RANKS = 3;

/**
 * The leaderboard's header band, measured against the reference card
 * (reference/home/parent-dark.png, "This Week's Leaderboard").
 *
 * The web's leaderboard is the ONE wall card whose heading does NOT run
 * centred: the trophy disc sits in the card's top-left corner and the title
 * is a SINGLE line that starts immediately to its right. The frame's default
 * band centres the title and wraps it onto two lines, so the card read as a
 * stacked heading instead of the reference's one-liner.
 *
 * The band is rebuilt here (the frame has no left-heading variant) at the
 * reference's geometry:
 *   - the title's ink lands 26px under the card's top edge (the web's own
 *     heading offset — the frame's centred band seats it 41px down);
 *   - the header rule lands 57px under the card's top edge (the web's rule
 *     for a card with NO description line);
 *   - the title clears the 64px identity disc that overhangs the corner.
 */
const LEADERBOARD_HEADER_H = 46; // card_top → the header rule
const LEADERBOARD_TITLE_PAD_TOP = 7; // the ink lands 12px under the band's top
const LEADERBOARD_TITLE_PAD_LEFT = 54; // clears the 64px identity disc
const CARD_TITLE_SIZE = 18; // the web's wall card heading (globals.css wall rule)

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
export function LeaderboardWidget({
  members = [],
  span = 1,
}: {
  members?: LeaderboardMember[];
  span?: WallSpan;
}) {
  const { colors, accentColor } = useTheme();
  const router = useRouter();
  const { member, hydrated } = useAuth();
  const { snapshot, stale: syncStale, syncError, refreshNow, onPulse } = useSync();

  const isGuest = hydrated && !member;
  const snapshotWeek = snapshot?.weekData as WeekData | undefined;

  // Guest lane: fetch public week_data if no snapshot is available
  const [guestWeek, setGuestWeek] = React.useState<{
    data: WeekData | null;
    failure: ReadFailure | null;
    status: "loading" | "ready" | "error";
  }>({
    data: null,
    failure: null,
    status: "loading",
  });
  const guestAliveRef = React.useRef(true);
  const guestRequestRef = React.useRef(0);

  React.useEffect(() => {
    guestAliveRef.current = true;
    return () => {
      guestAliveRef.current = false;
    };
  }, []);

  const readGuestWeek = React.useCallback(async () => {
    const requestId = guestRequestRef.current + 1;
    guestRequestRef.current = requestId;
    try {
      const res = await api<DbListEnvelope<{ weekStart: string; points: Record<string, number> }>>("/api/db/week_data");
      if (!guestAliveRef.current || guestRequestRef.current !== requestId) return;
      const items = Array.isArray(res?.items) ? res.items : [];
      const monday = weekStartMondayISO();
      const current = items.find((r) => r.weekStart === monday) ?? items[0];
      const parsed: WeekData = current
        ? { weekStart: current.weekStart, points: current.points ?? {}, streak: {}, lastActive: {} }
        : { weekStart: monday, points: {}, streak: {}, lastActive: {} };
      setGuestWeek({ data: parsed, failure: null, status: "ready" });
    } catch (e) {
      if (!guestAliveRef.current || guestRequestRef.current !== requestId) return;
      setGuestWeek((prev) => ({
        data: prev.data,
        failure: classifyFailure(e),
        status: prev.data ? "ready" : "error",
      }));
    }
  }, []);

  React.useEffect(() => {
    if (!hydrated || !isGuest || snapshotWeek) return;
    void readGuestWeek();
  }, [hydrated, isGuest, snapshotWeek, readGuestWeek]);

  React.useEffect(() => {
    if (!isGuest || snapshotWeek) return;
    return onPulse(() => {
      void readGuestWeek();
    });
  }, [isGuest, snapshotWeek, onPulse, readGuestWeek]);

  const weekData = snapshotWeek ?? (isGuest ? guestWeek.data ?? undefined : undefined);
  const ranked = rankWeek(weekData);
  const visibleLimit = span === 2 ? 5 : VISIBLE_RANKS;

  const [rosterMembers, setRosterMembers] = React.useState<LeaderboardMember[]>(members);
  React.useEffect(() => {
    if (members.length > 0) {
      setRosterMembers(members);
      return;
    }
    let alive = true;
    void readCachedMembers().then((cached) => {
      if (!alive) return;
      if (cached.length > 0) {
        setRosterMembers(cached.map((c) => ({ name: c.name, emoji: c.emoji })));
      }
    });
    return () => {
      alive = false;
    };
  }, [members]);

  // Roster row by first name (the rail's matching convention)
  const memberFor = (fullName: string): LeaderboardMember | undefined => {
    const first = fullName.split(" ")[0].toLowerCase();
    return rosterMembers.find((m) => m.name.split(" ")[0].toLowerCase() === first);
  };

  const hasData = isGuest
    ? (snapshotWeek ? true : guestWeek.data !== null)
    : !!snapshotWeek;

  const failure: ReadFailure | null = isGuest
    ? snapshotWeek
      ? null
      : guestWeek.failure
    : syncError === "unreachable"
      ? "offline"
      : syncError === "unauthorized"
        ? "unauthorised"
        : syncError === "server"
          ? "error"
          : null;

  const status: "loading" | "ready" | "error" = isGuest
    ? snapshotWeek
      ? "ready"
      : guestWeek.status
    : syncError !== null && !hasData
      ? "error"
      : hasData
        ? "ready"
        : "loading";

  const isStale = isGuest
    ? (snapshotWeek ? syncStale : guestWeek.failure !== null && guestWeek.data !== null)
    : syncStale;

  const onRetry = isGuest && !snapshotWeek ? () => void readGuestWeek() : refreshNow;

  /**
   * The reference's heading: ONE line, LEFT-aligned, starting immediately to
   * the right of the identity disc (the web's leaderboard card is the one
   * wall card with a left heading). The frame's default band centres the
   * title and wrapped it onto two centred lines, which is not what the
   * reference shows.
   */
  const header = (
    <View
      style={{
        height: LEADERBOARD_HEADER_H,
        paddingTop: LEADERBOARD_TITLE_PAD_TOP,
        paddingLeft: LEADERBOARD_TITLE_PAD_LEFT,
        paddingRight: 4,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottomWidth: 1,
        borderBottomColor: colors["color-border"],
      }}
    >
      <Text
        numberOfLines={1}
        accessibilityRole="header"
        style={{
          flex: 1,
          color: colors["color-text-primary"],
          fontSize: CARD_TITLE_SIZE,
          fontWeight: "700",
          lineHeight: 28,
          textAlign: "left",
        }}
      >
        This Week&apos;s Leaderboard
      </Text>
      <Pressable
        testID="leaderboard-see-all"
        accessibilityRole="link"
        accessibilityLabel="Open leaderboard in tasks"
        hitSlop={{ top: 18, bottom: 18, left: 12, right: 12 }}
        onPress={() => router.push("/tasks" as never)}
        style={{ paddingHorizontal: 6, paddingVertical: 4 }}
      >
        <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "600" }}>
          See all →
        </Text>
      </Pressable>
    </View>
  );

  return (
    <WidgetFrame
      id="leaderboard"
      icon="🏆"
      title="This Week's Leaderboard"
      header={header}
      showDisc
      status={status}
      failure={failure}
      hasData={hasData}
      stale={isStale}
      onRetry={onRetry}
    >
      {hasData ? (
        ranked.length === 0 ? (
          // The reference's empty week: crown + the prizes line, NO countdown.
          <RaceState title={EMPTY_LEADERBOARD} />
        ) : (
          <View style={{ gap: 4, alignSelf: "stretch" }}>
            {ranked.slice(0, visibleLimit).map((r) => {
              const m = memberFor(r.name);
              const photo = m?.emoji ? isPhotoUri(m.emoji) : false;
              const podiumTone =
                r.rank === 0
                  ? colors["color-accent-amber"] ?? accentColor
                  : r.rank === 1
                    ? colors["color-accent-cyan"] ?? accentColor
                    : colors["color-accent-rose"] ?? accentColor;
              return (
                <View key={r.name} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: mix(podiumTone, colors["color-surface-2"] ?? "", 22),
                      borderWidth: 1,
                      borderColor: mix(podiumTone, "transparent", 45),
                      overflow: "hidden",
                    }}
                  >
                    {photo && m ? (
                      <Image source={{ uri: m.emoji }} style={{ width: 36, height: 36, borderRadius: 18 }} />
                    ) : (
                      <AnimatedEmoji emoji={displayEmoji(m?.emoji)} size={20} />
                    )}
                  </View>
                  <Text
                    numberOfLines={1}
                    style={{ flex: 1, color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "600" }}
                  >
                    {medal(r.rank)} {r.name.split(" ")[0]}
                  </Text>
                  <View
                    style={{
                      borderRadius: 999,
                      paddingHorizontal: 9,
                      paddingVertical: 2,
                      backgroundColor: mix(podiumTone, "transparent", 18),
                      borderWidth: 1,
                      borderColor: mix(podiumTone, "transparent", 36),
                    }}
                  >
                    <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
                      {r.points} pts
                    </Text>
                  </View>
                </View>
              );
            })}
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
        )
      ) : null}
    </WidgetFrame>
  );
}

function medal(rank: number): string {
  return rank === 0 ? "🥇" : rank === 1 ? "🥈" : rank === 2 ? "🥉" : `${rank + 1}.`;
}

/**
 * The reference's leaderboard empty state, in the native's house shape:
 * the crown above a bold line, then the prizes line (the web's EmptyState
 * + the prize-race paragraph — HomeLeaderboardWidget.tsx:231-250).
 *
 * The block is TOP-aligned on purpose: in the reference the crown sits ~26px
 * under the card's rule and the card's lower half is left as air (the
 * reference capture measures the crown's top at 26px below the rule, the
 * title 56px below it, and the prizes line 95px below it). Centring the
 * block in the body instead left the tile reading as a void.
 */
function RaceState({ title }: { title: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "stretch" }}>
      <EmptyState
        flat
        icon={<AnimatedEmoji emoji="👑" size={30} />}
        title={title}
        style={{ justifyContent: "flex-start", paddingTop: 8 }}
      />
      <Text
        style={{
          color: colors["color-text-secondary"],
          fontSize: TYPOGRAPHY.label.fontSize,
          lineHeight: TYPOGRAPHY.label.lineHeight,
          textAlign: "center",
          marginTop: 12,
        }}
      >
        {EMPTY_PRIZES}
      </Text>
    </View>
  );
}

export default LeaderboardWidget;
