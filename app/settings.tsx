import React from "react";
import { View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { Screen } from "../src/theme/Screen";
import { SettingsPage } from "../src/settings/SettingsPage";
import { CapsuleDock, MoreButton } from "../src/nav/CapsuleDock";
import { MoreSheet } from "../src/nav/MoreSheet";
import { useAuth } from "../src/state/AuthProvider";

/**
 * /settings — the wall's Settings surface (WS-10): parent essentials (Me,
 * Safety, Appearance) plus honest deferrals, on the manifest dock (Settings is
 * a primary cap for every role — same Screen + CapsuleDock + MoreSheet
 * pattern as app/meals.tsx / app/calendar.tsx).
 */
export default function SettingsRoute() {
  const { role: capabilityRole, hydrated, poke } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = React.useState(false);
  // The nav role follows the CAPABILITY (a live-verified session), never the
  // cached display profile: the manifest's signed-in-only and parent-only
  // destinations stay closed to a cached profile.
  const role = capabilityRole === "parent" ? "parent" : capabilityRole ? "child" : "guest";

  return (
    <Screen testID="settings-route">
      <SettingsPage />
      {/* Above-dock More trigger — the dock is the 7 primary caps only (web parity). */}
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 116, alignItems: "center" }} pointerEvents="box-none">
        <MoreButton onPress={() => setMoreOpen(true)} />
      </View>
      <CapsuleDock
        role={role}
        hydrated={hydrated}
        pathname={pathname}
        onNavigate={(p) => { poke(); router.push(p as never); }}
      />
      <MoreSheet
        visible={moreOpen}
        onClose={() => setMoreOpen(false)}
        role={role}
        onNavigate={(p) => { poke(); router.push(p as never); }}
      />
    </Screen>
  );
}
