import React from "react";
import { Text, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { Screen } from "../src/theme/Screen";
import { HomeWall } from "../src/home/HomeWall";
import { KidHome } from "../src/home/KidHome";
import { CapsuleDock } from "../src/nav/CapsuleDock";
import { resolveRoute } from "../src/nav/nav-items";
import { MoreSheet } from "../src/nav/MoreSheet";
import { useTheme } from "../src/theme/ThemeProvider";
import { mix } from "../src/theme/mix";
import { TYPOGRAPHY } from "../src/theme/tokens";
import { type RailMember } from "../src/ui/MemberRail";
import { PinPad } from "../src/ui/PinPad";
import { Modal } from "../src/ui/Modal";
import { useAuth, pinRequiredFor } from "../src/state/AuthProvider";
import { getCachedMembersSync, listMembersSmart, type MembersResult } from "../src/api/members";
import { onBaseUrlChange } from "../src/api/config";
import { ApiError } from "../src/api/client";
import { PinRequired } from "../src/api/auth";
import {
  idleBoardDue,
  IDLE_CHECK_MS,
  isScreensaverDueNow,
  useScreensaverPrefs,
} from "../src/home/idle";
import type { WidgetId, WallWidgetProps } from "../src/home/widgets";
import { TasksWidget } from "../src/home/widgets/TasksWidget";
import { TodayEventsWidget } from "../src/home/widgets/TodayEventsWidget";
import { CurrentMealWidget } from "../src/home/widgets/CurrentMealWidget";
import { BriefingWidget } from "../src/home/widgets/BriefingWidget";
import { WeatherHeroCell } from "../src/weather/WidgetHero";
import { PhotosWidget } from "../src/home/widgets/PhotosWidget";
import { HomeSecurityWidget } from "../src/home/widgets/HomeSecurityWidget";
import { HomeClimateWidget } from "../src/home/widgets/HomeClimateWidget";
import { HomeLightsWidget } from "../src/home/widgets/HomeLightsWidget";
import { LeaderboardWidget } from "../src/home/widgets/LeaderboardWidget";
import { MusicWidget } from "../src/home/widgets/MusicWidget";

/** Wave 1 live widgets — the full 11-cell wall is live as of Task 5/6. */
const WALL_WIDGETS: Partial<
  Record<WidgetId, React.ComponentType<WallWidgetProps>>
> = {
  tasks: TasksWidget,
  todayEvents: TodayEventsWidget,
  currentMeal: () => <CurrentMealWidget />,
  morningBriefing: BriefingWidget,
  weather: WeatherHeroCell,
  photos: PhotosWidget,
  homeSecurity: () => <HomeSecurityWidget />,
  homeClimate: HomeClimateWidget,
  homeLights: HomeLightsWidget,
  leaderboard: LeaderboardWidget,
  music: MusicWidget,
};

const WRONG_PIN_COPY = "Wrong PIN — try again.";
const UNREACHABLE_COPY = "Couldn't reach Consuela — check the connection and try again.";

/**
 * PLACEHOLDER Home — replaced by the Wave 1 pilot (family-mode Home at wall
 * scale). Live today: the wall member rail (rail → PIN/quick sign-in) and the
 * dock + atmosphere wiring, mounted on the real auth provider.
 */
export default function HomePlaceholder() {
  const { colors } = useTheme();
  const { member, role, hydrated, signIn, signOut, poke } = useAuth();
  /**
   * The navigation role — it follows the CAPABILITY, never the cached
   * profile: the manifest's signed-in-only and parent-only destinations
   * (Music, Photos, Family Memory) must stay closed to a cached profile.
   */
  const navRole = role === "parent" ? "parent" : role ? "child" : "guest";
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = React.useState(false);
  const [roster, setRoster] = React.useState<MembersResult>(() => {
    const syncCached = typeof getCachedMembersSync === "function" ? getCachedMembersSync() : [];
    return syncCached.length > 0
      ? { members: syncCached, source: "cache", reason: "signed-out" }
      : { members: [], source: "fallback" };
  });
  /**
   * True once a roster read has ANSWERED. The badge's disclosure does not
   * blink out while a LATER read (the session changed, the base URL changed)
   * is in flight: the roster it describes has not changed, so the truth about
   * it has not changed either. Before the first answer the badge stays dark —
   * it must not claim a cause (signed-out / offline) the read has not
   * confirmed.
   */
  const [rosterSettled, setRosterSettled] = React.useState(false);
  /**
   * The roster the wall may present AS the family.
   *
   * The stand-in roster (src/api/members.ts's FALLBACK_MEMBERS — "Mom", "Dad",
   * "Child 1…5", "Pet 1…2") is the LAST resort for a device with neither a
   * live roster nor a cache. Painting it on the wall as if it were the family
   * is a lie the banner above it ("showing your saved copy") cannot survive,
   * so the wall shows NO roster in that state and the badge below says why.
   */
  const wallRoster = React.useMemo(
    () => (roster.source === "fallback" ? [] : roster.members),
    [roster.source, roster.members]
  );
  /** True when the device really holds a copy of the family (cache or live). */
  const hasSavedRoster = roster.source === "cache" || roster.source === "live";
  /** The wall is signed out — the badge then sits BELOW the banner strip. */
  const signedOut = hydrated && !member;

  // The wall registry, with the leaderboard bound to the live roster so its
  // top-3 rows can show member avatars (web HomeLeaderboardWidget parity).
  const wallWidgets = React.useMemo<
    Partial<Record<WidgetId, React.ComponentType<WallWidgetProps>>>
  >(
    () => {
      return ({
      ...WALL_WIDGETS,
      leaderboard: ({ span }: WallWidgetProps) => (
        <LeaderboardWidget span={span} members={wallRoster.map((m) => ({ name: m.name, emoji: m.emoji }))} />
      ),
      // House's own footer route: resolveRoute keeps the manifest's honest
      // /soon fallback (dock alive) instead of a toast dead end.
      homeSecurity: () => (
        <HomeSecurityWidget
          onOpenHomeControls={() => router.push(resolveRoute("/ha", "House") as never)}
        />
      ),
      });
    },
    [wallRoster, router]
  );
  const [pinTarget, setPinTarget] = React.useState<RailMember | null>(null);
  const [pinError, setPinError] = React.useState<string | null>(null);
  const [railError, setRailError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  // Wall idle → ambient board (WS-8): Home is the only route that settles
  // into /screensaver; any touch here resets the quiet clock, and the board
  // only opens once per Home visit (src/home/idle.ts holds the rule).
  // lastTouch starts 0 ("no touch yet") and is armed in the effect below —
  // Date.now() in render would be an impure read (react-hooks/purity).
  const [screensaverPrefs] = useScreensaverPrefs();
  const lastTouchRef = React.useRef(0);
  const boardPushedRef = React.useRef(false);

  React.useEffect(() => {
    if (pathname === "/") {
      // mounted or returned-to: the family is at the wall — clock restarts
      lastTouchRef.current = Date.now();
      boardPushedRef.current = false;
    }
  }, [pathname]);

  React.useEffect(() => {
    const t = setInterval(() => {
      const activeNow = isScreensaverDueNow(screensaverPrefs, new Date());
      if (
        idleBoardDue({
          pathname,
          idleMs: Date.now() - lastTouchRef.current,
          pushed: boardPushedRef.current,
          // The sign-in modal + More sheet live in separate windows — their
          // taps never reach the touch clock, and pushing the board mid-PIN
          // is the exact failure the critic caught (modal-aware idle).
          blocked: !!pinTarget || moreOpen,
          enabled: activeNow,
        })
      ) {
        boardPushedRef.current = true;
        router.push("/screensaver" as never);
      }
    }, IDLE_CHECK_MS);
    return () => clearInterval(t);
  }, [pathname, router, pinTarget, moreOpen, screensaverPrefs]);

  // The roster read waits for auth hydration. Without the guard it fired a
  // doomed /api/members/admin 401 the moment the route mounted — before we
  // knew whether a session exists — and the wall mistook the 401's cache for
  // an offline device (web parity: the signed-out wall is a supported state).
  React.useEffect(() => {
    if (!hydrated) return;
    let alive = true;
    const loadRoster = () => {
      listMembersSmart()
        .then((r) => {
          if (!alive) return;
          setRoster(r);
          setRosterSettled(true);
        })
        .catch(() => {});
    };
    loadRoster();
    const unsub = onBaseUrlChange(() => {
      if (alive) loadRoster();
    });
    return () => {
      alive = false;
      unsub();
    };
  }, [member, hydrated]);

  const onSelect = async (m: RailMember) => {
    if (member?.name === m.name) return;
    const asMember = roster.members.find((r) => r.name === m.name) ?? (m as any);
    if (!pinRequiredFor(asMember)) {
      setBusy(true);
      setRailError(null);
      try {
        await signIn(m.name);
      } catch (e: any) {
        if (e instanceof PinRequired) {
          setPinTarget(m);
          setPinError(null);
        } else {
          // honest failure at the RAIL — the tap visibly failed, the copy stays calm
          setRailError(UNREACHABLE_COPY);
        }
      } finally {
        setBusy(false);
      }
      return;
    }
    setRailError(null);
    setPinTarget(m);
    setPinError(null);
  };

  const onVerified = async (pin: string) => {
    if (!pinTarget) return;
    setBusy(true);
    try {
      await signIn(pinTarget.name, pin);
      setPinTarget(null);
      setPinError(null);
    } catch (e: any) {
      setPinError(e instanceof ApiError && e.code === "unreachable" ? UNREACHABLE_COPY : WRONG_PIN_COPY);
    } finally {
      setBusy(false);
    }
  };

  /**
   * The roster badge — the app's own disclosure of WHY the rail is not live,
   * and the ONLY thing that says so out loud. It has to be TRUE: a badge that
   * claims "cached" when there is no cache, or that talks about a saved copy
   * the device never had, is worse than no badge at all.
   *
   *   live        → nothing to say (the rail IS live)
   *   cache       → the device's saved copy; the NAS is down
   *   fallback    → no live roster AND no cache: nothing to show
   *
   * SIGNED OUT it does not render at all. The wall's signed-out strip is the
   * one notice the band carries — the reference's guest capture leaves y
   * 78-105 as EMPTY canvas, and a second amber-rimmed pill there (2px above
   * the rail, repeating the strip's message) crowded the band. The strip
   * itself says when the copy could not be refreshed (the wall's
   * `rosterUnreachable` copy), so nothing is lost.
   */
  const badgeText = railError
    ? railError
    : roster.source === "live"
      ? null
      : roster.source === "fallback"
        ? roster.reason === "unreachable"
          ? "Couldn't reach Consuela — no saved roster on this device"
          : "No saved roster on this device — sign in to load your family"
        : roster.reason === "unreachable"
          ? "offline roster (cached)"
          : "saved roster — not the live one";

  return (
    <Screen>
      {/* Wall-touch activity resets the screensaver quiet clock. */}
      {/* Wall-touch activity resets the screensaver quiet clock AND re-arms the
          session idle clock (auth poke — a press is activity on the wall). */}
      <View
        style={{ flex: 1 }}
        onTouchStart={() => {
          lastTouchRef.current = Date.now();
          poke();
        }}
      >
      {/* Mode switch (WS-4): a signed-in child/pet gets the gamified kid wall
          INSTEAD of the family bento; family (guest) and adult keep HomeWall.

          The LAYOUT follows the CAPABILITY role, never the cached display
          profile: a remembered kid (with no live session) must not drop the
          panel into a kid's personal layout. */}
      {role !== null && role !== "parent" ? (
        <KidHome onOpenMore={() => setMoreOpen(true)} />
      ) : (
        <HomeWall
          members={wallRoster}
          onSelectMember={(m) => void onSelect(m)}
          onSignOut={member ? () => void signOut() : undefined}
          widgets={wallWidgets}
          onSelectDay={(dayId) => router.push(`/meals?day=${dayId}` as never)}
          onOpenMore={() => setMoreOpen(true)}
          hasSavedRoster={hasSavedRoster}
          rosterUnreachable={roster.reason === "unreachable"}
        />
      )}
      {/* The roster badge tells the truth about WHY the rail isn't live, and
          the two causes are not the same failure. A signed-out session reads
          the cache BY DESIGN (the rail is the family wall's sign-in surface) —
          calling that "offline" asserts a network fault that does not exist.
          A genuinely unreachable NAS is the only offline claim the wall makes.

          It is a SIBLING of the wall's frame, and the wall paints its own
          z-indexed chrome over that same corner — so the badge carries a
          z-index of its own. SIGNED OUT it does not render at all: the
          wall's own signed-out strip is the one notice the band carries (the
          reference leaves that band empty canvas), and the strip says so when
          the copy could not be refreshed. */}
      {rosterSettled && badgeText !== null && !signedOut ? (
        <View
          testID="roster-badge"
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 24,
            right: 104,
            zIndex: 40,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: mix(colors["color-accent-amber"], "transparent", 40),
            backgroundColor: mix(colors["color-accent-amber"], "transparent", 15),
            paddingHorizontal: 16,
            paddingVertical: 3,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            accessibilityLiveRegion="polite"
            style={{
              color: colors["color-text-muted"],
              fontSize: TYPOGRAPHY.label.fontSize,
              lineHeight: TYPOGRAPHY.label.lineHeight,
              textAlign: "center",
            }}
          >
            {badgeText}
          </Text>
        </View>
      ) : null}

      <CapsuleDock
        role={navRole}
        hydrated={hydrated}
        pathname={pathname}
        onNavigate={(p) => { poke(); router.push(p as never); }}
      />
      <MoreSheet
        visible={moreOpen}
        onClose={() => setMoreOpen(false)}
        role={navRole}
        onNavigate={(p) => { poke(); router.push(p as never); }}
      />

      <Modal visible={!!pinTarget} onClose={() => !busy && setPinTarget(null)} title="Sign in" dismissable={!busy}>
        {pinTarget ? (
          <PinPad member={pinTarget} onVerified={(pin) => void onVerified(pin)} onCancel={() => setPinTarget(null)} busy={busy} error={pinError} />
        ) : null}
      </Modal>
      </View>
    </Screen>
  );
}
