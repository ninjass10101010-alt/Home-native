import React from "react";
import { usePathname, useRouter } from "expo-router";
import { Screen } from "../src/theme/Screen";
import { CalendarPage } from "../src/calendar/CalendarPage";
import { CapsuleDock } from "../src/nav/CapsuleDock";
import { MoreSheet } from "../src/nav/MoreSheet";
import { useAuth } from "../src/state/AuthProvider";

/**
 * /calendar — the wall's Calendar surface (WS-5): the family week at a
 * glance, mounted on the manifest dock (Calendar is a primary cap for
 * every role — same Screen + CapsuleDock + MoreSheet pattern as app/tasks.tsx).
 */
export default function CalendarRoute() {
  const { member, hydrated } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = React.useState(false);
  const role = member ? (member.role === "parent" ? "parent" : "child") : "guest";

  return (
    <Screen testID="calendar-route">
      <CalendarPage />
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
