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
import { listMembersSmart, type MembersResult } from "../src/api/members";
import { ApiError } from "../src/api/client";
import { PinRequired } from "../src/api/auth";
import { idleBoardDue, IDLE_CHECK_MS } from "../src/home/idle";
import type { WidgetId } from "../src/home/widgets";
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
import { QuickAskWidget } from "../src/home/widgets/QuickAskWidget";

/** Wave 1 live widgets — the full 11-cell wall is live as of Task 5/6. */
const WALL_WIDGETS: Partial<Record<WidgetId, React.ComponentType>> = {
  tasks: TasksWidget,
  todayEvents: TodayEventsWidget,
  currentMeal: CurrentMealWidget,
  morningBriefing: BriefingWidget,
  weather: WeatherHeroCell,
  photos: PhotosWidget,
  homeSecurity: HomeSecurityWidget,
  homeClimate: HomeClimateWidget,
  homeLights: HomeLightsWidget,
  leaderboard: LeaderboardWidget,
  aiQuickAsk: QuickAskWidget,
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
  const { member, hydrated, signIn, signOut, poke } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = React.useState(false);
  const [roster, setRoster] = React.useState<MembersResult>({ members: [], source: "fallback" });
  /** True while the mount roster read is in flight — the badge must not claim
   *  a cause (signed-out / offline) before the read has actually answered. */
  const [rosterLoading, setRosterLoading] = React.useState(true);
  // The wall registry, with the leaderboard bound to the live roster so its
  // top-3 rows can show member avatars (web HomeLeaderboardWidget parity).
  const wallWidgets = React.useMemo<Partial<Record<WidgetId, React.ComponentType>>>(
    () => {
      return ({
      ...WALL_WIDGETS,
      leaderboard: () => (
        <LeaderboardWidget members={roster.members.map((m) => ({ name: m.name, emoji: m.emoji }))} />
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
    [roster.members, router]
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
      if (
        idleBoardDue({
          pathname,
          idleMs: Date.now() - lastTouchRef.current,
          pushed: boardPushedRef.current,
          // The sign-in modal + More sheet live in separate windows — their
          // taps never reach the touch clock, and pushing the board mid-PIN
          // is the exact failure the critic caught (modal-aware idle).
          blocked: !!pinTarget || moreOpen,
        })
      ) {
        boardPushedRef.current = true;
        router.push("/screensaver" as never);
      }
    }, IDLE_CHECK_MS);
    return () => clearInterval(t);
  }, [pathname, router, pinTarget, moreOpen]);

  // The roster read waits for auth hydration. Without the guard it fired a
  // doomed /api/members/admin 401 the moment the route mounted — before we
  // knew whether a session exists — and the wall mistook the 401's cache for
  // an offline device (web parity: the signed-out wall is a supported state).
  React.useEffect(() => {
    if (!hydrated) return;
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- starting the in-flight marker before the read, so the badge can't claim a cause it doesn't know yet
    setRosterLoading(true);
    listMembersSmart()
      .then((r) => alive && setRoster(r))
      .catch(() => {})
      .finally(() => alive && setRosterLoading(false));
    return () => {
      alive = false;
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
          INSTEAD of the family bento; family (guest) and adult keep HomeWall. */}
      {member && member.role !== "parent" ? (
        <KidHome onOpenMore={() => setMoreOpen(true)} />
      ) : (
        <HomeWall
          members={roster.members}
          onSelectMember={(m) => void onSelect(m)}
          onSignOut={member ? () => void signOut() : undefined}
          widgets={wallWidgets}
          onSelectDay={(dayId) => router.push(`/meals?day=${dayId}` as never)}
          onOpenMore={() => setMoreOpen(true)}
        />
      )}
      {/* The roster badge tells the truth about WHY the rail isn't live, and
          the two causes are not the same failure. A signed-out session reads
          the cache BY DESIGN (the rail is the family wall's sign-in surface) —
          calling that "offline" asserts a network fault that does not exist.
          A genuinely unreachable NAS is the only offline claim the wall makes. */}
      {rosterLoading ? null : roster.source !== "live" || railError ? (
        <View
          style={{
            position: "absolute",
            top: 4,
            left: 24,
            right: 100,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: mix(colors["color-accent-amber"], "transparent", 40),
            backgroundColor: mix(colors["color-accent-amber"], "transparent", 15),
            paddingHorizontal: 12,
            paddingVertical: 6,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {railError ? (
            <Text
              accessibilityLiveRegion="polite"
              style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, textAlign: "center" }}
            >
              {railError}
            </Text>
          ) : roster.reason === "unreachable" ? (
            <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize }}>
              offline roster (cached)
            </Text>
          ) : hydrated && roster.source !== "live" ? (
            <Text
              testID="rail-signed-out"
              style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize }}
            >
              Signed out — tap your picture to sign in
            </Text>
          ) : null}
        </View>
      ) : null}

      <CapsuleDock
        role={member ? (member.role === "parent" ? "parent" : "child") : "guest"}
        hydrated={hydrated}
        pathname={pathname}
        onNavigate={(p) => router.push(p as never)}
      />
      <MoreSheet
        visible={moreOpen}
        onClose={() => setMoreOpen(false)}
        role={member ? (member.role === "parent" ? "parent" : "child") : "guest"}
        onNavigate={(p) => router.push(p as never)}
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
