import React, { useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { Material } from "../theme/Material";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useRouter } from "expo-router";
import { MIN_TARGET_DP, MOTION, TYPOGRAPHY } from "../theme/tokens";
import { accentInk, mix } from "../theme/mix";
import { memberAccentHex } from "../theme/memberColor";
import { useAuth } from "../state/AuthProvider";
import { useSync, type WeekData } from "../state/SyncManager";
import { readCachedMembers } from "../api/members";
import { api } from "../api/client";
import { Modal } from "../ui/Modal";
import { PinPad } from "../ui/PinPad";
import { mixAlpha, SoftButton } from "../ui/SoftButton";
import { EmptyState } from "../ui/EmptyState";
import { SegmentedControl } from "../ui/SegmentedControl";
import { useToast } from "../ui/Toast";
import { SignedOutBanner } from "../ui/SignedOutBanner";
import { localTodayISO } from "../home/widgets/data";
import {
  memberScoped,
  openBoard,
  pendingBoard,
  completedWaiting,
  completedByWeek,
  completedHistory,
  taskStats,
  filterOptions,
  isSnatchable,
  priorityColor,
  weekGroupLabel,
  isCrewTask,
  crewFull,
} from "./board";
import {
  normalizeSnapshotTasks,
  submitApproval,
  submitClaim,
  taskRefusalCopy,
  type TaskCommandOutcome,
  type WallTask,
  newOperationId,
} from "./claim";

/**
 * The wall's Tasks surface (WS-7). The board reads ONE shared SyncManager
 * snapshot (no page fetch) and renders the web page's full information
 * architecture: stat row, Tasks/Leaderboard switch, member filter, the Open
 * board, the Pending card and the Completed disclosure. Points are never
 * client-computed — a kid's tap shows the server's pendingApproval as
 * "⏳ Waiting for approval" until a parent approves.
 */

const LOADING_COPY = "Loading the family's chores…";
const KID_DONE_TOAST = "Nice work — sent for approval.";
const CLAIM_TOAST = "Claimed — good grab!";
const APPROVED_TOAST = "Approved — points added.";
const APPROVE_ALL_TOAST = "All approved — points added.";
const SENT_BACK_TOAST = "Sent back for a do-over.";
const SENT_CATCHING_UP = "Sent — the server will catch up.";
const IN_FLIGHT_COPY = "⏳ A change is on its way — the family board updates when it arrives.";
// The wall caches NOTHING (SyncManager is memory-only, and the guest banner
// refuses to claim a saved copy), so the stale line must not lie either.
const STALE_COPY = "Couldn't refresh — showing the last board we read.";
const WRONG_PIN_COPY = "Wrong PIN — try again.";
const WAITING_COPY = "⏳ Waiting for approval";
const UNDONE_TOAST = "Taken back — it's yours again.";
const RACE_TITLE = "This week's race";
const RACE_EMPTY = "Be the first!";
const SIGNED_OUT_BANNER = "🔐 Signed out — the family's chores live on the family server. Sign in with your PIN to see them.";

/** The ONE PIN-dialog intent (the web's PinIntent lesson: exactly one arm open). */
type PinIntent =
  | { kind: "kid-complete"; taskId: number }
  | { kind: "claim"; taskId: number }
  | { kind: "undo"; taskId: number }
  | { kind: "approve"; taskId: number }
  | { kind: "approve-all"; taskIds: number[] }
  | { kind: "send-back"; taskId: number };

/**
 * Honest, human copy for the two parent write paths. The server's `error`
 * field is a snake_case reason (unauthorized / unknown_assignee / …) — the
 * wall never renders codes at the family, and never pretends a refusal is a
 * success (AGENTS.md: honest, specific error copy).
 */
function manageErrorCopy(e: any): string {
  if (e?.status === 0) return "Couldn't reach Consuela — try again.";
  if (e?.code === "unknown_assignee") return "That name isn't a family member.";
  if (e?.code === "pet_assignee") return "Pets can't be assigned chores.";
  if (e?.status === 401) return "Sign in again to add chores.";
  if (e?.status === 403) return "Only a parent can add chores.";
  if (e?.status === 409) return "A change is already on its way — try again in a moment.";
  return "That didn't go through — try again.";
}

function ledgerErrorCopy(e: any): string {
  if (e?.status === 0) return "Couldn't reach Consuela — try again.";
  if (e?.status === 401 || e?.code === "unauthorized") return WRONG_PIN_COPY;
  if (e?.status === 403) return "Only a parent can move points.";
  if (e?.code === "unknown_member") return "That name isn't on the family roster.";
  if (e?.code === "insufficient_balance") return "That would put the balance below zero.";
  if (e?.status === 409) return "That change is already being processed.";
  if (e?.code === "invalid_body" || e?.code === "invalid_action" || e?.code === "invalid_task_state") {
    return "That amount didn't make sense — use a whole number of points.";
  }
  return "That didn't go through — try again.";
}

/**
 * Week race ranking (LeaderboardWidget parity) — display only, snapshot truth.
 * STANDARD COMPETITION (web page.tsx:2390-2410): tied members share a rank and
 * the next rank skips (25/25/60/60/10 → 1,1,3,3,5). A family week ties
 * constantly, and two tied rows must never both wear the gold medal.
 */
function rankWeek(weekData: WeekData | undefined): { name: string; points: number; rank: number }[] {
  const rows = Object.entries(weekData?.points ?? {})
    .map(([name, points]) => ({ name, points: Number(points) || 0 }))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  let rank = 0;
  let previous: number | null = null;
  return rows.map((r, i) => {
    if (previous === null || r.points !== previous) rank = i + 1;
    previous = r.points;
    return { name: r.name, points: r.points, rank };
  });
}

/** The rank glyph: ranks 1,2,3 are medals and every other rank prints its
 *  number. A tie means two rows SHARE a rank, so both tied rows wear that
 *  rank's glyph (40/25/25 → 🥇,🥈,🥈) exactly as the web ranks. */
const medal = (rank: number) => (rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `${rank}.`);

/** One stat tile — the web StatTile's compact formula: a tone GRADIENT wash
 *  (16%→5%) under the material tier, a tone border and the tone's AA ink on
 *  BOTH text lines (the web paints them at full opacity — 80% alpha measured
 *  below 4.5:1 in light). NOTE: `color-accent` is a neutral SURFACE in this
 *  system; the web's StatTile tone="accent" maps to --color-accent-selected. */
function StatTile({
  icon,
  value,
  label,
  detail,
  tone,
  testID,
}: {
  icon: string;
  value: number;
  label: string;
  detail: string;
  tone: "warning" | "success" | "accent";
  testID: string;
}) {
  const { colors } = useTheme();
  const toneKey =
    tone === "warning" ? "color-accent-amber" : tone === "success" ? "color-accent-mint" : "color-accent-selected";
  const toneColor = colors[toneKey] ?? colors["color-accent-selected"] ?? colors["color-accent"];
  const ink = accentInk(toneColor, colors["color-text-primary"]);
  return (
    <Material
      tier="thin"
      testID={testID}
      style={{
        flex: 1,
        borderRadius: 24,
        borderColor: mix(toneColor, "transparent", 35),
        overflow: "hidden",
      }}
    >
      <LinearGradient
        colors={[mix(toneColor, "transparent", 16), mix(toneColor, "transparent", 5)]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <View style={{ paddingHorizontal: 20, paddingVertical: 18, gap: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: mix(toneColor, "transparent", 12),
              borderWidth: 1,
              borderColor: mix(toneColor, "transparent", 25),
            }}
          >
            <Text style={{ fontSize: 22 }}>{icon}</Text>
          </View>
          <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.stat.fontSize, fontWeight: "700" }}>
            {value}
          </Text>
        </View>
        <Text style={{ color: ink, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "600" }}>{label}</Text>
        <Text style={{ color: ink, fontSize: TYPOGRAPHY.label.fontSize }}>{detail}</Text>
      </View>
    </Material>
  );
}

/** One member filter tile — the web member-tile: an avatar over the name
 *  (MemberRail's 72dp Material disc), ≥64dp, accent ring when active. */
function MemberFilterTile({
  emoji,
  label,
  active,
  onPress,
  testID,
  memberColor,
}: {
  emoji: string;
  label: string;
  active: boolean;
  onPress: () => void;
  testID: string;
  /** The selected tile lights in THIS member's own colour (web: .member-tile
   *  is-active is driven per-tile by --chip-color from memberColors). */
  memberColor?: string;
}) {
  const { colors, accentColor, reduceMotion } = useTheme();
  const tileColor = memberColor ?? accentColor;
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={active ? `Showing ${label}'s chores` : `Show ${label}'s chores`}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      onPressIn={() => {
        // eslint-disable-next-line react-hooks/immutability -- Reanimated shared-value write is the idiom (SoftButton parity)
        scale.value = reduceMotion ? 1 : withTiming(0.97, { duration: MOTION.fast });
      }}
      onPressOut={() => {
        // eslint-disable-next-line react-hooks/immutability -- Reanimated shared-value write is the idiom (SoftButton parity)
        scale.value = reduceMotion ? 1 : withTiming(1, { duration: MOTION.fast });
      }}
      style={{ alignItems: "center", minWidth: 76, minHeight: MIN_TARGET_DP }}
    >
      <Animated.View style={[{ alignItems: "center", minWidth: 76 }, animStyle]}>
        {/* web .member-tile: a rounded RECT (radius-lg) with a 1px hairline at
            rest; the active tile swaps to a 22% tone wash + 38% tone border.
            Not a full-strength ring. */}
        <View
          style={{
            width: 76,
            height: 76,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: active ? mix(tileColor, "transparent", 38) : mix(colors["color-text-primary"] ?? accentColor, "transparent", 8),
            backgroundColor: active ? mix(tileColor, "transparent", 22) : mix(colors["color-text-primary"] ?? accentColor, "transparent", 5),
          }}
        >
          <Text style={{ fontSize: 30 }}>{emoji}</Text>
        </View>
        <Text
          numberOfLines={1}
          style={{
            marginTop: 4,
            maxWidth: 96,
            color: active ? colors["color-text-primary"] : colors["color-text-secondary"],
            fontSize: TYPOGRAPHY.label.fontSize,
            fontWeight: active ? "700" : "500",
          }}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}
/** The web's chip recipe: a tone-filled pill whose label is TEXT-PRIMARY.
 *  The reference deliberately does not use tone ink here — page.tsx:193
 *  ("sized so `text-primary` on it clears AA in both themes"). Tone ink on a
 *  tone fill measured 4.24–4.42:1 in dark once the atmosphere + card stack
 *  composites under it, so this composition exists locally rather than in the
 *  shared Chip (whose own ink contract other surfaces depend on). */
function ToneChip({
  label,
  toneKey,
  testID,
}: {
  label: string;
  toneKey: string;
  testID?: string;
}) {
  const { colors } = useTheme();
  const tone = colors[toneKey] ?? colors["color-accent"];
  const ink = colors["color-text-primary"];
  return (
    <Material
      tier="thin"
      testID={testID}
      style={{
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 8,
        minHeight: 36,
        alignItems: "center",
        justifyContent: "center",
        borderColor: mix(tone, "transparent", 40),
      }}
    >
      <LinearGradient
        colors={[mix(tone, "transparent", 22), mix(tone, "transparent", 10)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <Text style={{ color: ink, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "600" }}>{label}</Text>
    </Material>
  );
}

/** A row avatar — the web Avatar (size sm): the emoji seated in a
 *  member/board-coloured disc. A bare glyph loses the row's identity. */
function RowAvatar({ emoji, memberColor, fallbackRail }: { emoji: string; memberColor?: string; fallbackRail?: string }) {
  const { colors } = useTheme();
  // The web tints the disc with the assignee's OWN member colour
  // (page.tsx:3110: memberColors[task.assignee]); the priority/section colour
  // is only the fallback when the roster has no colour for that name.
  const tone = memberColor ?? fallbackRail ?? colors["color-accent-selected"] ?? colors["color-accent"];
  return (
    <View
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
        borderColor: mix(tone, "transparent", 45),
        backgroundColor: mix(tone, "transparent", 18),
      }}
    >
      <Text style={{ fontSize: 22 }}>{emoji}</Text>
    </View>
  );
}

/**
 * THE row recipe — ONE geometry for every family (web `.schedule-row
 * .liquid-glass`): a solid scrim under a 10%→4% tone gradient, radius 20,
 * `px-3 py-3`, a 2×32 centred rail with the tone's glow, and the family's
 * tone passed in by the caller (Open cyan, Pending priority, approval +
 * waiting amber, history mint). Five families, one look — and the scrim is
 * what keeps the wall's animated atmosphere from washing the tint to a
 * mid-tone (globals.css:991-999).
 */
function SchedRow({
  toneKey,
  toneHex,
  leading,
  title,
  subtitle,
  trailing,
  onPress,
  testID,
  accessibilityLabel,
  testIdPrefix,
}: {
  toneKey?: string;
  toneHex?: string;
  leading?: React.ReactNode;
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
  testID?: string;
  accessibilityLabel?: string;
  testIdPrefix?: string;
}) {
  const { colors, theme } = useTheme();
  const tone = toneHex ?? colors[toneKey ?? "color-accent-selected"] ?? colors["color-accent"];
  // Solid scrim: the surface at ~72% (dark) / ~75% (light), as the web does.
  const scrim = mixAlpha(colors["color-surface-0"], theme === "dark" ? 0.72 : 0.75);
  return (
    <Pressable
      testID={testID}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 20,
        borderColor: mix(tone, "transparent", 20),
        backgroundColor: scrim,
        overflow: "hidden",
        minHeight: 64,
      }}
    >
      <LinearGradient
        pointerEvents="none"
        colors={[mix(tone, "transparent", 10), mix(tone, "transparent", 4)]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />
      {/* 2×32 centred rail with the tone glow (web h-8 w-0.5) */}
      <View
        style={{
          width: 2,
          height: 32,
          borderRadius: 1,
          backgroundColor: tone,
          shadowColor: tone,
          shadowOpacity: 0.8,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 0 },
          elevation: 4,
        }}
        pointerEvents="none"
      />
      {leading}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text
          numberOfLines={2}
          testID={testIdPrefix ? `${testIdPrefix}-title` : undefined}
          style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "600" }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            numberOfLines={2}
            style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
    </Pressable>
  );
}

/**
 * A section card: the web SectionCard, which IS the WidgetCard (the tone
 * gradient + 35% tone border + glow the StatTile uses) with the icon seated in
 * a tone disc that straddles the card's top-left corner, the title indented
 * past it, and a hairline under the header. The shared Material tier alone is a
 * neutral box with no glow — the card that holds the whole surface needs the
 * real recipe.
 */
function SectionCard({
  icon,
  title,
  description,
  children,
  testID,
}: {
  icon: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  testID: string;
}) {
  const { colors } = useTheme();
  // ONE card family, ONE tone: the web's WidgetCard defaults
  // --widget-tone to --color-accent-selected and no /tasks SectionCard
  // passes a tone (page.tsx:2924, 2995, 3168, 3327, 3568, 3691); the
  // reference confirms it — identical blue border on every card.
  const tone = colors["color-accent-selected"] ?? colors["color-accent"];
  return (
    <Material
      tier="regular"
      testID={testID}
      style={{
        borderRadius: 24,
        borderColor: mix(tone, "transparent", 35),
        overflow: "hidden",
      }}
    >
      <LinearGradient
        colors={[mix(tone, "transparent", 16), mix(tone, "transparent", 5)]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <View style={{ paddingHorizontal: 20, paddingVertical: 20, gap: 16 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingBottom: 14,
            paddingLeft: 72,
            borderBottomWidth: 1,
            borderBottomColor: mix(tone, "transparent", 20),
          }}
        >
          {/* corner-straddling badge (web WidgetCard: absolute -top-1 -left-1,
              h-14 w-14, 30px glyph, SectionCard reserves pl-[72px]) */}
          <View
            style={{
              position: "absolute",
              top: -4,
              left: -4,
              width: 56,
              height: 56,
              borderRadius: 28,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: mix(tone, "transparent", 22),
              borderWidth: 1,
              borderColor: mix(tone, "transparent", 42),
              shadowColor: tone,
              shadowOpacity: 0.35,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 0 },
              elevation: 6,
              zIndex: 3,
            }}
          >
            <Text style={{ fontSize: 30 }}>{icon}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.title.fontSize, fontWeight: "700" }}>
              {title}
            </Text>
            {description ? (
              <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, marginTop: 2 }}>
                {description}
              </Text>
            ) : null}
          </View>
        </View>
        {children}
      </View>
    </Material>
  );
}

export function TasksPage() {
  const router = useRouter();
  const { colors, accentColor, theme } = useTheme();
  const toast = useToast();
  const { member, pinRequiredFor } = useAuth();
  const { snapshot, stale, lastSyncAt, syncError, refreshNow, onPulse } = useSync();

  const tasks = useMemo(() => normalizeSnapshotTasks(snapshot?.tasks), [snapshot]);
  const weekData = (snapshot?.weekData ?? undefined) as WeekData | undefined;

  const [activeTab, setActiveTab] = useState<"tasks" | "leaderboard">("tasks");
  const [showCompleted, setShowCompleted] = useState(false);
  const [pinIntent, setPinIntent] = useState<PinIntent | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  // The pad remounts per failed attempt: React bails out of a state update to
  // an equal string, so the SAME "Wrong PIN" copy would otherwise not re-fire
  // the clear-on-error effect and the family would be stuck re-sending the
  // failed code (PinPad keeps its entry in local state).
  const [pinAttempt, setPinAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  // Durable in-flight marker (web task-command-queue banner): a 202 means the
  // server holds the change, so the family must keep SEEING it after the
  // transient toast dismisses — silence next to an unmoved row is dishonest.
  const [inFlight, setInFlight] = useState(0);
  // Synchronous double-tap guard for the PIN-free completion branch (web
  // pinFreeInFlightRef parity — the guard must fire before the next render).
  const inFlightRef = useRef<Set<number>>(new Set());

  const [addChoreOpen, setAddChoreOpen] = useState(false);
  const [newChoreTitle, setNewChoreTitle] = useState("");
  const [newChorePoints, setNewChorePoints] = useState("5");
  const [newChoreAssignee, setNewChoreAssignee] = useState("");
  const [bonusOpen, setBonusOpen] = useState(false);
  const [bonusTarget, setBonusTarget] = useState("");
  const [bonusDelta, setBonusDelta] = useState("0");
  const [bonusReason, setBonusReason] = useState("");
  const [bonusPin, setBonusPin] = useState("");
  const [queueRows, setQueueRows] = useState<any[]>([]);

  const isParent = !!member && member.role === "parent";
  const me = member?.name ?? "";
  // The filter's roster comes from the DEVICE CACHE (never a fetch: a guest
  // read would only 401, and the snapshot poll already owns the signed-in
  // read path). Assignees in the snapshot fill any gap — a chip is only ever
  // offered for a name the board can actually show.
  const [cachedRoster, setCachedRoster] = useState<{ name: string; emoji: string; color?: string }[]>([]);
  React.useEffect(() => {
    let alive = true;
    void readCachedMembers().then((rows) => {
      if (!alive) return;
      setCachedRoster(
        rows
          .filter((r) => (r.name || "").trim())
          .map((r) => ({ name: r.name, emoji: (r as { emoji?: string }).emoji || "👤", color: (r as { color?: string }).color }))
      );
    });
    return () => {
      alive = false;
    };
  }, []);
  // name → the member's own identity colour (web memberColors), resolved
  // through the theme so the avatar disc carries the wall's per-member idiom.
  const memberColorOf = (name: string): string | undefined => {
    const row = cachedRoster.find((m) => m.name === name);
    return row?.color ? memberAccentHex(row.color, theme, accentColor) : undefined;
  };
  const options = filterOptions(tasks, {
    signedIn: !!member,
    roster: cachedRoster,
    me,
    // the My Tasks tile carries the SESSION member's own emoji (web parity)
    meEmoji: member ? member.emoji || "👤" : "👥",
  });
  const [filterMember, setFilterMember] = useState<string | null>(null);
  const activeFilter = filterMember ?? options[0]?.id ?? "All";

  const scoped = memberScoped(tasks, activeFilter, me, { myTasksLabel: "My Tasks" });
  const openRows = openBoard(tasks, me, activeFilter);
  const pendingRows = pendingBoard(scoped);
  // The stats follow the member filter (web: the three StatTiles are scoped).
  // The UNFILTERED array still rides along for the "Open" filter, whose scope
  // contains no completed rows at all (web reads getThisWeeksCompletedTasks off
  // the unfiltered rows — a scoped length there is a structural zero).
  const stats = taskStats(scoped, weekData?.points, weekData?.weekStart, activeFilter, me, tasks);
  const scopedCompleted = scoped.filter((t) => t.completed).length;
  // The approval queue is FAMILY-WIDE (web `pendingApprovals` — never member
  // scoped): a parent approves whatever tap landed, whoever tapped it.
  const approvalQueue = completedWaiting(tasks);
  const waitingRows = completedWaiting(scoped);
  const historyRows = completedHistory(scoped);
  const weekGroups = completedByWeek(scoped);
  const ranked = rankWeek(weekData);

  // Honest sync states (web syncRead parity): SyncManager only stamps
  // lastSyncAt AFTER a successful read, so a LAN-down/503 leaves it null with
  // syncError set — that is the ERROR state, never a perpetual skeleton.
  const syncFailed = !!member && snapshot === null && lastSyncAt === null && syncError !== null;
  // The poll pulled the family truth again — whatever was in flight has had
  // its chance to land on screen, so the marker retires. Subscribing to the
  // sync pulse (not an effect on `snapshot`) is the external-system pattern.
  React.useEffect(() => onPulse(() => setInFlight(0)), [onPulse]);

  const loadQueue = React.useCallback(async () => {
    if (!member || !isParent) { setQueueRows([]); return; }
    try {
      const res = await api<{ rows?: any[] }>("/api/tasks/queue");
      setQueueRows(Array.isArray(res?.rows) ? res.rows : []);
    } catch {
      setQueueRows([]);
    }
  }, [member, isParent]);

  React.useEffect(() => { void loadQueue(); }, [loadQueue]); // eslint-disable-line react-hooks/set-state-in-effect
  // refresh queue on pulse
  React.useEffect(() => onPulse(() => void loadQueue()), [onPulse, loadQueue]);

  const loading = !!member && snapshot === null && lastSyncAt === null && syncError === null;
  const loadFailed = syncFailed || (!!member && snapshot === null && lastSyncAt !== null);

  /** Outcome → honest UI. Returns true when the intent's dialog (if any) should close. */
  const finish = (outcome: TaskCommandOutcome, appliedCopy: string): boolean => {
    if (outcome.kind === "applied") {
      toast.show(appliedCopy, { intent: "success" });
      void refreshNow();
      return true;
    }
    if (outcome.kind === "sending") {
      // 202 either way (durably queued or applied-but-unreconciled): NEVER
      // assume instant apply — the shared snapshot poll owns the truth, and
      // the marker stays until that poll returns fresh rows.
      setInFlight((n) => n + 1);
      toast.show(outcome.notice ?? SENT_CATCHING_UP, { intent: "info" });
      void refreshNow();
      return true;
    }
    if (outcome.wrongPin) {
      // Stay in the pad — it shakes + clears; the family keeps their place.
      if (!pinIntent) {
        // No pad on this path (under-10 session claim): a wrong-PIN here is a
        // DEAD SESSION, not a typo — silent no-ops are dishonest.
        toast.show(taskRefusalCopy("session_required"), { intent: "error" });
        return true;
      }
      setPinError(WRONG_PIN_COPY);
      setPinAttempt((n) => n + 1);
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

  const runClaim = async (taskId: number, pin: string) => {
    if (!member || busy) return;
    setBusy(true);
    try {
      // Claim is ALWAYS credentialed (web openPinEntry parity): the member the
      // row gets assigned to is whoever proved themselves at the pad.
      const outcome = await submitClaim({ action: "claim", taskId, memberName: member.name, pin });
      if (finish(outcome, CLAIM_TOAST)) {
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

  const runUndo = async (taskId: number, pin?: string) => {
    if (!member || busy) return;
    setBusy(true);
    try {
      const outcome = await submitClaim({
        action: "undo",
        taskId,
        ...(pin ? { memberName: member.name, pin } : {}),
      });
      if (finish(outcome, UNDONE_TOAST)) {
        setPinIntent(null);
        setPinError(null);
      }
    } finally {
      setBusy(false);
    }
  };

  /** The web's ↩ affordance: a completion can always be taken back by the
   *  person who made it, and by a parent. A shared panel's mistaken tap is
   *  never permanent. */
  const canUndo = (t: WallTask): boolean => {
    if (!member || !t.completed) return false;
    return isParent || (!!t.completedBy && t.completedBy === member.name);
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

  const submitAddChore = async () => {
    if (!member || !isParent || busy) return;
    const title = newChoreTitle.trim();
    const assignee = newChoreAssignee.trim();
    // No fabricated assignee: the server refuses unknown members, and a silent
    // default would put a chore on somebody the parent never chose.
    if (!title || !assignee) return;
    setBusy(true);
    try {
      await api("/api/tasks/manage", {
        method: "POST",
        body: {
          operationId: newOperationId(),
          action: "add",
          task: {
            title,
            points: Number(newChorePoints) || 0,
            assignee,
          },
        },
      });
      setAddChoreOpen(false);
      setNewChoreTitle("");
      setNewChorePoints("");
      setNewChoreAssignee("");
      await refreshNow();
      toast.show("Chore added", { intent: "success" });
    } catch (e: any) {
      toast.show(manageErrorCopy(e), { intent: "error" });
    } finally {
      setBusy(false);
    }
  };

  const submitBonus = async () => {
    if (!member || !isParent || busy) return;
    const pin = bonusPin.trim();
    const delta = Math.trunc(Number(bonusDelta) || 0);
    // The PIN is never guessed (no default body value) and a no-op write is
    // never sent — the web's adjust dialog gates both the same way.
    if (!pin || delta === 0) return;
    setBusy(true);
    try {
      const target = bonusTarget.trim();
      await api("/api/tasks/ledger", {
        method: "POST",
        body: {
          operationId: newOperationId(),
          // ONE action: "adjust" takes a SIGNED amount (the server's own
          // contract — "a deduction is an adjust too"). The catalog "penalty"
          // action requires an itemId the wall never has, so a negative delta
          // must never route there (it would 400 every time).
          action: "adjust",
          memberName: member.name,
          ...(target && target !== member.name ? { targetMemberName: target } : {}),
          pin,
          amount: delta,
          reason: bonusReason.trim(),
        },
      });
      setBonusOpen(false);
      setBonusPin("");
      await refreshNow();
      toast.show(delta < 0 ? "Penalty applied" : "Bonus applied", { intent: "success" });
    } catch (e: any) {
      if (e?.status === 401 || e?.code === "unauthorized") setBonusPin("");
      toast.show(ledgerErrorCopy(e), { intent: "error" });
    } finally {
      setBusy(false);
    }
  };

  const cancelQueueRow = async (operationId: string) => {
    if (!member || !isParent) return;
    try {
      await api("/api/tasks/queue", { method: "DELETE", body: { operationId } });
      await loadQueue();
    } catch {
      toast.show("Couldn't cancel — try again.", { intent: "error" });
    }
  };

  const onPinVerified = (pin: string) => {
    if (!pinIntent) return;
    if (pinIntent.kind === "kid-complete") return void runComplete(pinIntent.taskId, pin);
    if (pinIntent.kind === "claim") return void runClaim(pinIntent.taskId, pin);
    if (pinIntent.kind === "undo") return void runUndo(pinIntent.taskId, pin);
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
      : pinIntent?.kind === "claim"
        ? "Claim this chore"
        : pinIntent?.kind === "undo"
          ? "Take it back"
        : pinIntent?.kind === "approve"
          ? "Approve"
          : pinIntent?.kind === "approve-all"
            ? "Approve all"
            : "Send back";
  const modalDescription =
    pinIntent?.kind === "kid-complete"
      ? "Enter your PIN to check it off."
      : pinIntent?.kind === "claim"
        ? "Enter your PIN to take this one."
        : pinIntent?.kind === "undo"
          ? "Enter your PIN to take this one back."
        : pinIntent?.kind === "approve"
          ? "Enter your PIN to approve this tap."
          : pinIntent?.kind === "approve-all"
            ? `Enter your PIN to approve all ${pinIntent.taskIds.length}.`
            : "Enter your PIN to send this back for a do-over.";

  const body = () => {
    if (!member) {
      return (
        <View style={{ gap: 16 }}>
          <SectionCard icon="🫳" title="Open" description="Nobody's claimed these — fastest fingers earn the bonus." testID="tasks-open-card">
            <EmptyState flat icon="🤝" title="Nothing up for grabs" body="Nothing is open right now — chores show up here once they're late." />
          </SectionCard>
          <SectionCard icon="📋" title="Pending" description="0 open tasks" testID="tasks-pending-card">
            <EmptyState
              flat
              icon="🔐"
              title="Tasks are synced to the family account"
              body="Sign in with your PIN to see everyone's tasks. Your chores aren't gone — they're waiting on the family server."
            />
          </SectionCard>
        </View>
      );
    }

    if (loading) {
      return (
        <View testID="tasks-loading" accessibilityLabel={LOADING_COPY} style={{ gap: 16 }}>
          <View style={{ flexDirection: "row", gap: 12 }}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={{ flex: 1, height: 104, borderRadius: 20, backgroundColor: colors["color-surface-2"] }} />
            ))}
          </View>
          {[0, 1, 2].map((i) => (
            <View key={`s${i}`} style={{ height: 132, borderRadius: 24, backgroundColor: colors["color-surface-2"] }} />
          ))}
        </View>
      );
    }

    if (loadFailed) {
      return (
        <View testID="tasks-error">
          <EmptyState
            icon="📡"
            title="Couldn't reach the family server"
            body="We couldn't read the chore list, so this board may be out of date — it refreshes on its own, or check the NAS is awake."
            actionLabel="Try again"
            onAction={() => void refreshNow()}
          />
        </View>
      );
    }

     if (activeTab === "leaderboard") {
       return (
         <SectionCard icon="🏆" title={RACE_TITLE} description="This week's race — resets Monday" testID="tasks-leaderboard">
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
               ranked.map((r) => (
                 <View
                   key={r.name}
                   style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 48 }}
                 >
                   <Text numberOfLines={1} style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, flex: 1 }}>
                     {medal(r.rank)} {r.name}
                   </Text>
                   <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "600" }}>
                     {r.points}pts
                   </Text>
                 </View>
               ))
             )}
           </Material>
         </SectionCard>
       );
     }

    return (
      <View style={{ gap: 20 }}>
        {/* ── Open board (web SectionCard: 🫳 Open) ─────────────────────── */}
        <SectionCard icon="🫳" title="Open" description="Nobody's claimed these — fastest fingers earn the bonus." testID="tasks-open-card">
          {openRows.length === 0 ? (
            <EmptyState flat icon="🤝" title="Nothing up for grabs" body="Nothing is open right now — chores show up here once they're late." />
          ) : (
            <View style={{ gap: 12 }}>
              {openRows.map((t) => {
                const crew = isCrewTask(t);
                const joined = t.crewMembers.length;
                const full = crewFull(t);
                const claimValue = t.points + t.speedBonus;
                return (
                  <SchedRow
                    key={t.id}
                    testID={`open-row-${t.id}`}
                    testIdPrefix={`open-row-${t.id}`}
                    toneKey="color-accent-cyan"
                    accessibilityLabel={crew ? `Join crew for ${t.title}` : `Claim ${t.title}`}
                    leading={
                      <RowAvatar
                        emoji={crew ? "🤝" : "🫳"}
                        memberColor={memberColorOf(t.assignee)}
                        fallbackRail={colors["color-accent-cyan"]}
                      />
                    }
                    title={t.title}
                    subtitle={
                      crew
                        ? `Crew ${joined}/${t.crewSize} joined${full ? " — full" : ""} · +${t.points} pts each`
                        : `Unclaimed${t.speedBonus > 0 ? ` · first grab earns +${t.speedBonus}` : ""}`
                    }
                    trailing={
                      <SoftButton
                        variant="secondary"
                        size="sm"
                        testID={`task-claim-${t.id}`}
                        accessibilityLabel={crew ? `Join crew for ${t.title}` : `Claim ${t.title}`}
                        disabled={busy || (crew && full) || !member}
                        onPress={() => member && openIntent({ kind: "claim", taskId: t.id })}
                      >
                        {crew ? (full ? "Full" : "Join crew") : `🫳 Claim +${claimValue}`}
                      </SoftButton>
                    }
                  />
                );
              })}
            </View>
          )}
        </SectionCard>

        {/* ── Pending board (web SectionCard: 📋 Pending) ───────────────── */}
        <SectionCard icon="📋" title="Pending" description={`${stats.pending} open tasks`} testID="tasks-pending-card">
          {pendingRows.length === 0 ? (
            <EmptyState
              flat
              icon={activeFilter === "Open" ? "🤝" : "🎉"}
              title={activeFilter === "Open" ? "All quiet" : "All caught up"}
              body={
                activeFilter === "Open"
                  ? "Nothing is up for grabs right now."
                  : activeFilter === "My Tasks"
                    ? "Nothing on your plate right now."
                    : activeFilter === "All"
                      ? "No pending tasks right now."
                      : `Nothing pending for ${activeFilter.split(" ")[0]} right now.`
              }
            />
          ) : (
            <View style={{ gap: 12 }}>
              {pendingRows.map((t) => {
                const awaiting = !!t.pendingApproval;
                const rail = priorityColor(t.priority, colors);
                // The web's rowTint: a low-alpha wash of the PRIORITY colour
                // under the row; the chip is filled by the same priority
                // (never by the points value).
                // crew chores carry their own meta (web page.tsx:3117) — a crew
                // row must never read like a plain assigned chore.
                const crew = isCrewTask(t);
                const subtitleParts = crew
                  ? [
                      `🤝 Crew ${t.crewMembers.filter((m) => m.checkedIn).length}/${t.crewSize} checked in`,
                      `${t.crewMembers.length} joined`,
                      `+${t.points} pts each`,
                    ]
                  : [
                      t.assignee ? t.assignee.split(" ")[0] : "",
                      t.due ? (isSnatchable(t) ? `was due ${formatDay(t.due)}` : formatDay(t.due)) : "",
                      t.category,
                    ].filter(Boolean);
                return (
                  <SchedRow
                    key={t.id}
                    testID={`pending-row-${t.id}`}
                    toneHex={rail}
                    accessibilityLabel={awaiting ? `${t.title} — waiting for approval` : `Complete ${t.title}`}
                    leading={<RowAvatar emoji={t.assigneeEmoji} memberColor={memberColorOf(t.assignee)} fallbackRail={rail} />}
                    title={t.title}
                    subtitle={subtitleParts.join(" · ")}
                    trailing={
                      <ToneChip
                        testID={`pending-points-${t.id}`}
                        label={`+${t.points}pts`}
                        toneKey={t.priority === "high" ? "color-accent-rose" : t.priority === "low" ? "color-accent-mint" : "color-accent-amber"}
                      />
                    }
                    onPress={awaiting ? undefined : () => completeTask(t)}
                  />
                );
              })}
            </View>
          )}
        </SectionCard>

        {/* ── Needs approval (web SectionCard: ⏳ — the parent lane) ────── */}
        {isParent && approvalQueue.length > 0 ? (
          <SectionCard
            icon="⏳"
            title="Needs approval"
            description={`${approvalQueue.length} tapped — review to award points`}
            testID="tasks-approvals-card"
          >
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }}>
                  {`${approvalQueue.length} chore${approvalQueue.length === 1 ? "" : "s"}`}
                </Text>
                {approvalQueue.length > 1 ? (
                  <SoftButton
                    variant="secondary"
                    size="sm"
                    testID="tasks-approve-all"
                    disabled={busy}
                    onPress={() => openIntent({ kind: "approve-all", taskIds: approvalQueue.map((t) => t.id) })}
                  >
                    {`Approve all (${approvalQueue.length})`}
                  </SoftButton>
                ) : null}
              </View>
              {approvalQueue.map((t) => {
                const byName = t.pendingApproval?.byName ? t.pendingApproval.byName.split(" ")[0] : "";
                const award = t.pendingApproval?.points ?? t.points;
                return (
                  <View key={t.id} style={{ gap: 10 }}>
                    <SchedRow
                      testID={`queue-row-${t.id}`}
                      toneKey="color-accent-amber"
                      leading={<RowAvatar emoji={t.assigneeEmoji} memberColor={memberColorOf(t.assignee)} fallbackRail={colors["color-accent-amber"]} />}
                      title={t.title}
                      subtitle={[byName, tappedLabel(t), WAITING_COPY].filter(Boolean).join(" · ")}
                      trailing={<ToneChip label={`+${award}pts`} toneKey="color-accent-amber" />}
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
              })}
            </View>
          </SectionCard>
        ) : null}

        {/* ── Completed disclosure (web: ✅ Completed / "Show completed").
            The card is GATED (web page.tsx:3325): a filter with nothing done
            must not render an empty "Completed / 0 done" card. */}
        {scopedCompleted > 0 || showCompleted ? (
        <SectionCard icon="✅" title="Completed" description={`${scopedCompleted} done`} testID="tasks-completed-card">
          <SoftButton
            variant="ghost"
            size="sm"
            testID="tasks-completed-toggle"
            onPress={() => setShowCompleted((v) => !v)}
          >
            {showCompleted ? "Hide completed ⌃" : "Show completed ⌄"}
          </SoftButton>
          {showCompleted ? (
            <View testID="tasks-completed-list" style={{ gap: 12, marginTop: 8 }}>
              {waitingRows.length > 0 ? (
                <View style={{ gap: 8 }}>
                  <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
                    Waiting on approval · {waitingRows.length} chore{waitingRows.length === 1 ? "" : "s"}
                  </Text>
                  {waitingRows.map((t) => (
                    <View key={t.id} style={{ gap: 8 }}>
                      <SchedRow
                        testID={`completed-row-${t.id}`}
                        toneKey="color-accent-amber"
                        leading={<RowAvatar emoji={t.assigneeEmoji} memberColor={memberColorOf(t.assignee)} fallbackRail={colors["color-accent-mint"]} />}
                        title={t.title}
                        subtitle={`${waiterName(t)} · ${tappedLabel(t)} · ${WAITING_COPY}`}
                        trailing={
                          <ToneChip
                            label={`+${t.pendingApproval?.points ?? t.points}pts`}
                            toneKey="color-accent-amber"
                          />
                        }
                      />
                      {canUndo(t) ? (
                        <SoftButton
                          variant="ghost"
                          size="sm"
                          testID={`task-undo-${t.id}`}
                          disabled={busy}
                          onPress={() => openIntent({ kind: "undo", taskId: t.id })}
                        >
                          ↩ Take it back
                        </SoftButton>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : null}
              {/* One header per week (web groupCompletedTasksByWeek): the
                  label comes from the row's OWN server week key, so an older
                  week is never labelled "This week". */}
              {weekGroups.map((group) => (
                <View key={group.weekKey || "unattributed"} style={{ gap: 8 }}>
                  {group.weekKey ? (
                    <Text
                      style={{
                        color: colors["color-text-primary"],
                        fontSize: TYPOGRAPHY.label.fontSize,
                        fontWeight: "700",
                      }}
                    >
                      {`${weekGroupLabel(group.weekKey, weekData?.weekStart)} · ${group.rows.length} chore${group.rows.length === 1 ? "" : "s"}`}
                    </Text>
                  ) : (
                    <Text
                      style={{
                        color: colors["color-text-secondary"],
                        fontSize: TYPOGRAPHY.label.fontSize,
                      }}
                    >
                      Earlier — the family server never recorded a day for these.
                    </Text>
                  )}
                  {group.rows.map((t) => (
                    <View key={t.id} style={{ gap: 8 }}>
                      <SchedRow
                        testID={`completed-row-${t.id}`}
                        toneKey="color-accent-mint"
                        leading={<RowAvatar emoji={t.assigneeEmoji} memberColor={memberColorOf(t.assignee)} fallbackRail={colors["color-accent-mint"]} />}
                        title={t.title}
                        subtitle={completerMeta(t)}
                        trailing={<ToneChip label="Done" toneKey="color-accent-mint" />}
                      />
                      {canUndo(t) ? (
                        <SoftButton
                          variant="ghost"
                          size="sm"
                          testID={`task-undo-${t.id}`}
                          disabled={busy}
                          onPress={() => openIntent({ kind: "undo", taskId: t.id })}
                        >
                          ↩ Take it back
                        </SoftButton>
                      ) : null}
                    </View>
                  ))}
                </View>
              ))}
              {waitingRows.length === 0 && historyRows.length === 0 ? (
                <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.body.fontSize }}>
                  Nothing completed yet this week.
                </Text>
              ) : null}
            </View>
          ) : null}
        </SectionCard>
        ) : null}
      </View>
    );
  };

  /** A due-day label with the web's window: a weekday ("Fri") for a due
   *  2–7 days out, else the calendar date ("Oct 2"). */
  function formatDay(iso: string, today: string = localTodayISO()): string {
    const d = new Date(`${iso}T12:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    const days = Math.round((d.getTime() - new Date(`${today}T12:00:00`).getTime()) / 86_400_000);
    if (days >= 2 && days <= 7) return d.toLocaleDateString("en-US", { weekday: "short" });
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  /** The TAPPER, not the assignee (web page.tsx:3409) — a parent scanning the
   *  queue must see whose tap is waiting, which is not always whose chore it is. */
  function waiterName(t: WallTask): string {
    return t.pendingApproval?.byName ? t.pendingApproval.byName.split(" ")[0] : t.assignee.split(" ")[0];
  }

  /** "tapped Oct 10" — the server's own tap instant (web page.tsx:3305). */
  function tappedLabel(t: WallTask): string {
    const at = t.pendingApproval?.at;
    if (!at) return "";
    const d = new Date(`${at.slice(0, 10)}T12:00:00`);
    return Number.isNaN(d.getTime()) ? "" : `tapped ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  }

  /** The web's completedByMeta: the assignee first, and the completer only
   *  when it is a different member. Never an invented filler string. */
  function completerMeta(t: WallTask): string {
    const assignee = t.assignee ? t.assignee.split(" ")[0] : "";
    const completer = t.completedBy ? t.completedBy.split(" ")[0] : "";
    if (assignee && completer && completer !== assignee) return `${assignee} · ${completer}`;
    return assignee || completer;
  }

  return (
    <View testID="tasks-page" style={{ flex: 1, paddingHorizontal: 24, paddingTop: 16 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 180, gap: 20 }} showsVerticalScrollIndicator={false}>
      {/* Signed-out banner (web SyncStatusBanner parity): the reference banner
          is a plain surface-0 pill with a tone border and NO wash — Material
          paints its own layers above any backgroundColor we pass, so the
          honest port carries the border alone. */}
      {!member ? (
        <SignedOutBanner
          testID="tasks-guest-banner"
          accessibilityLabel="Sign in with your PIN"
          onPress={() => router.push("/")}
          style={{ paddingHorizontal: 20, paddingVertical: 14, minHeight: MIN_TARGET_DP, justifyContent: "center" }}
          title={SIGNED_OUT_BANNER}
        />
      ) : null}

        {/* Header (web hero parity) */}
        <View>
          <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700", letterSpacing: 2 }}>
            {`${stats.pending} PENDING`}
          </Text>
          <Text style={{ color: colors["color-text-primary"], fontSize: 54, fontWeight: "700", marginTop: 4 }}>✅ Tasks</Text>
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
              {STALE_COPY}
            </Text>
          ) : null}
        </View>

        {/* In-flight marker: honest while a change is still travelling. */}
        {inFlight > 0 ? (
          <Material
            tier="thin"
            testID="tasks-in-flight"
            style={{
              borderRadius: 16,
              borderWidth: 1,
              borderColor: mix(colors["color-accent-amber"] ?? colors["color-accent"], "transparent", 40),
              paddingHorizontal: 18,
              paddingVertical: 12,
              minHeight: MIN_TARGET_DP,
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            <LinearGradient
              colors={[
                mix(colors["color-accent-amber"] ?? colors["color-accent"], "transparent", 10),
                mix(colors["color-accent-amber"] ?? colors["color-accent"], "transparent", 10),
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
            />
            <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "600" }}>
              {IN_FLIGHT_COPY}
            </Text>
          </Material>
        ) : null}

        {/* Stat row (web StatTile compact 3-up) */}
        <View style={{ flexDirection: "row", gap: 12 }}>
          <StatTile testID="tasks-stat-pending" icon="📋" value={stats.pending} label="Pending" detail="Open tasks" tone="warning" />
          <StatTile testID="tasks-stat-completed" icon="🎉" value={stats.completedThisWeek} label="Completed" detail="This week" tone="success" />
          <StatTile testID="tasks-stat-earned" icon="🏆" value={stats.earnedThisWeek} label="Earned this week" detail="All-time unavailable" tone="accent" />
        </View>

        {isParent ? (
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <SoftButton variant="secondary" testID="tasks-add-chore" onPress={() => setAddChoreOpen(true)} style={{ flex: 1, minHeight: MIN_TARGET_DP }}>
                + Add Chore
              </SoftButton>
              <SoftButton variant="secondary" testID="tasks-bonus-penalty" onPress={() => setBonusOpen(true)} style={{ flex: 1, minHeight: MIN_TARGET_DP }}>
                ± Bonus/Penalty
              </SoftButton>
            </View>
            {queueRows.length > 0 ? (
              <Material tier="thin" testID="tasks-queued-commands-banner" style={{ borderRadius: 16, padding: 12, gap: 8, borderWidth: 1, borderColor: mix(colors["color-accent-amber"], "transparent", 40) }}>
                <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
                  Queued commands
                </Text>
                {queueRows.map((q: any, i: number) => (
                  <View key={String(q?.operationId ?? i)} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, flex: 1 }} numberOfLines={1}>
                      {q?.action ?? "command"} · {q?.displayTarget?.title ?? q?.operationId ?? ""}
                    </Text>
                    <SoftButton variant="ghost" size="sm" testID={`tasks-queue-cancel-${q?.operationId ?? i}`} onPress={() => void cancelQueueRow(String(q?.operationId ?? ""))}>
                      Cancel
                    </SoftButton>
                  </View>
                ))}
              </Material>
            ) : null}
          </View>
        ) : null}

        {/* View switch (web SegmentedControl) */}
        <SegmentedControl
          testID="tasks-tabs"
          accessibilityLabel="Tasks view"
          emphasize
          value={activeTab}
          onChange={(id) => setActiveTab(id as "tasks" | "leaderboard")}
          options={[
            { id: "tasks", label: "Tasks" },
            { id: "leaderboard", label: "Leaderboard" },
          ]}
        />

        {/* Member filter tiles (web member-tile row — Tasks tab only) */}
        {activeTab === "tasks" ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 16, paddingVertical: 4 }}
            accessibilityLabel="Filter chores by family member"
          >
            {options.map((o) => (
              <MemberFilterTile
                key={o.id}
                testID={`tasks-filter-${o.id}`}
                emoji={o.emoji}
                label={o.label}
                active={o.id === activeFilter}
                onPress={() => setFilterMember(o.id)}
                memberColor={
                  o.id === "My Tasks" ? memberColorOf(me) : o.id === "All" || o.id === "Open" ? undefined : memberColorOf(o.id)
                }
              />
            ))}
          </ScrollView>
        ) : null}

        {body()}
      </ScrollView>

      {/* Parent chore management modals */}
      <Modal visible={addChoreOpen} onClose={() => setAddChoreOpen(false)} title="Add chore" testID="add-chore-modal" dismissable={!busy}>
        <View style={{ gap: 12 }}>
          <TextInput
            testID="add-chore-title"
            placeholder="Chore title"
            value={newChoreTitle}
            onChangeText={setNewChoreTitle}
            style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, padding: 12, borderRadius: 12, backgroundColor: colors["color-surface-2"] }}
          />
          <TextInput
            testID="add-chore-points"
            placeholder="Points"
            value={newChorePoints}
            onChangeText={setNewChorePoints}
            keyboardType="numeric"
            style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, padding: 12, borderRadius: 12, backgroundColor: colors["color-surface-2"] }}
          />
          <TextInput
            testID="add-chore-assignee"
            placeholder="Assignee"
            value={newChoreAssignee}
            onChangeText={setNewChoreAssignee}
            style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, padding: 12, borderRadius: 12, backgroundColor: colors["color-surface-2"] }}
          />
          <SoftButton variant="success" onPress={() => void submitAddChore()} disabled={busy || !newChoreTitle.trim() || !newChoreAssignee.trim()} testID="add-chore-submit" style={{ minHeight: MIN_TARGET_DP }}>
            Save
          </SoftButton>
        </View>
      </Modal>

      <Modal visible={bonusOpen} onClose={() => setBonusOpen(false)} title="Bonus / penalty" testID="bonus-modal" dismissable={!busy}>
        <View style={{ gap: 12 }}>
          <TextInput
            testID="bonus-target"
            placeholder="Target member"
            value={bonusTarget}
            onChangeText={setBonusTarget}
            style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, padding: 12, borderRadius: 12, backgroundColor: colors["color-surface-2"] }}
          />
          <TextInput
            testID="bonus-delta"
            placeholder="Delta (amount)"
            value={bonusDelta}
            onChangeText={setBonusDelta}
            keyboardType="numeric"
            style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, padding: 12, borderRadius: 12, backgroundColor: colors["color-surface-2"] }}
          />
          <TextInput
            testID="bonus-reason"
            placeholder="Reason"
            value={bonusReason}
            onChangeText={setBonusReason}
            style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, padding: 12, borderRadius: 12, backgroundColor: colors["color-surface-2"] }}
          />
          <TextInput
            testID="bonus-pin"
            placeholder="Parent PIN"
            value={bonusPin}
            onChangeText={setBonusPin}
            secureTextEntry
            keyboardType="numeric"
            style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, padding: 12, borderRadius: 12, backgroundColor: colors["color-surface-2"] }}
          />
          <SoftButton variant="success" onPress={() => void submitBonus()} disabled={busy || !bonusPin.trim() || Math.trunc(Number(bonusDelta) || 0) === 0} testID="bonus-submit" style={{ minHeight: MIN_TARGET_DP }}>
            Apply
          </SoftButton>
        </View>
      </Modal>

      {/* The ONE PIN dialog — kid completes, open-task claims, parent approve/send-back. */}
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
            key={`pad-${pinAttempt}`}
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
