import React from "react";
import { Text, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { Screen } from "../src/theme/Screen";
import { HomeWall } from "../src/home/HomeWall";
import { CapsuleDock } from "../src/nav/CapsuleDock";
import { MoreSheet } from "../src/nav/MoreSheet";
import { useTheme } from "../src/theme/ThemeProvider";
import { TYPOGRAPHY } from "../src/theme/tokens";
import { type RailMember } from "../src/ui/MemberRail";
import { PinPad } from "../src/ui/PinPad";
import { Modal } from "../src/ui/Modal";
import { useAuth, pinRequiredFor } from "../src/state/AuthProvider";
import { listMembersSmart, type MembersResult } from "../src/api/members";
import { ApiError } from "../src/api/client";
import { PinRequired } from "../src/api/auth";
import type { WidgetId } from "../src/home/widgets";
import { TasksWidget } from "../src/home/widgets/TasksWidget";
import { TodayEventsWidget } from "../src/home/widgets/TodayEventsWidget";
import { CurrentMealWidget } from "../src/home/widgets/CurrentMealWidget";
import { BriefingWidget } from "../src/home/widgets/BriefingWidget";
import { WeatherWidget } from "../src/home/widgets/WeatherWidget";
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
  weather: WeatherWidget,
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
  const { member, hydrated, signIn, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = React.useState(false);
  const [roster, setRoster] = React.useState<MembersResult>({ members: [], source: "fallback" });
  const [pinTarget, setPinTarget] = React.useState<RailMember | null>(null);
  const [pinError, setPinError] = React.useState<string | null>(null);
  const [railError, setRailError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    listMembersSmart().then((r) => alive && setRoster(r)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [member]);

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
      <HomeWall
        members={roster.members}
        onSelectMember={(m) => void onSelect(m)}
        onSignOut={member ? () => void signOut() : undefined}
        widgets={WALL_WIDGETS}
      />
      {roster.source !== "live" || railError ? (
        <View style={{ position: "absolute", top: 12, left: 24, right: 24, alignItems: "center" }}>
          {railError ? (
            <Text
              accessibilityLiveRegion="polite"
              style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, textAlign: "center" }}
            >
              {railError}
            </Text>
          ) : (
            <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize }}>
              offline roster (cached)
            </Text>
          )}
        </View>
      ) : null}

      <CapsuleDock
        role={member ? (member.role === "parent" ? "parent" : "child") : "guest"}
        hydrated={hydrated}
        pathname={pathname}
        onNavigate={(p) => router.push(p as never)}
        onOpenMore={() => setMoreOpen(true)}
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
    </Screen>
  );
}
