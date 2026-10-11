import React from "react";
import { usePathname, useRouter } from "expo-router";
import { Screen } from "../src/theme/Screen";
import { SettingsPage } from "../src/settings/SettingsPage";
import { CapsuleDock } from "../src/nav/CapsuleDock";
import { MoreSheet } from "../src/nav/MoreSheet";
import { useAuth } from "../src/state/AuthProvider";

/**
 * /settings — the wall's Settings surface (WS-10): parent essentials (Me,
 * Safety, Appearance) plus honest deferrals, on the manifest dock (Settings is
 * a primary cap for every role — same Screen + CapsuleDock + MoreSheet
 * pattern as app/meals.tsx / app/calendar.tsx).
 */
export default function SettingsRoute() {
  const { member, hydrated } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = React.useState(false);
  const role = member ? (member.role === "parent" ? "parent" : "child") : "guest";

  return (
    <Screen testID="settings-route">
      <SettingsPage />
      <CapsuleDock
        role={role}
        hydrated={hydrated}
        pathname={pathname}
        onNavigate={(p) => router.push(p as never)}
        onOpenMore={() => setMoreOpen(true)}
      />
      <MoreSheet
        visible={moreOpen}
        onClose={() => setMoreOpen(false)}
        role={role}
        onNavigate={(p) => router.push(p as never)}
      />
    </Screen>
  );
}
