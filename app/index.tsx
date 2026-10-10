import React from "react";
import { Text, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { Screen } from "../src/theme/Screen";
import { CapsuleDock } from "../src/nav/CapsuleDock";
import { MoreSheet } from "../src/nav/MoreSheet";
import { useTheme } from "../src/theme/ThemeProvider";
import { TYPOGRAPHY } from "../src/theme/tokens";
import { MemberRail, type RailMember } from "../src/ui/MemberRail";
import { PinPad } from "../src/ui/PinPad";
import { Modal } from "../src/ui/Modal";
import { useAuth, pinRequiredFor } from "../src/state/AuthProvider";
import { listMembersSmart, type MembersResult } from "../src/api/members";
import { ApiError } from "../src/api/client";
import { PinRequired } from "../src/api/auth";

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
      try {
        await signIn(m.name);
      } catch (e: any) {
        if (e instanceof PinRequired) {
          setPinTarget(m);
          setPinError(null);
        } else if (e instanceof ApiError && e.code === "unreachable") {
          setPinError(UNREACHABLE_COPY);
        } else {
          setPinError(UNREACHABLE_COPY);
        }
      } finally {
        setBusy(false);
      }
      return;
    }
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
      <View style={{ paddingTop: 16, paddingHorizontal: 24 }}>
        <MemberRail
          members={roster.members}
          currentName={member?.name ?? null}
          onSelect={(m) => void onSelect(m)}
          onSignOut={member ? () => void signOut() : undefined}
        />
      </View>

      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
        <Text style={{ fontSize: 40 }}>🏠</Text>
        <Text
          style={{
            color: colors["color-text-primary"],
            fontSize: TYPOGRAPHY.title.fontSize,
            fontWeight: "700",
          }}
        >
          Consuela
        </Text>
        <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.body.fontSize }}>
          {member ? `Hi ${member.name.split(" ")[0]} — Home builds in Wave 1.` : "Home builds in Wave 1 — tap your picture to sign in."}
        </Text>
        {roster.source !== "live" ? (
          <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize }}>
            offline roster (cached)
          </Text>
        ) : null}
      </View>

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
