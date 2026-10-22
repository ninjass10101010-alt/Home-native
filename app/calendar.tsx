import { usePathname, useRouter } from "expo-router";
import { Screen } from "../src/theme/Screen";
import { CalendarPage } from "../src/calendar/CalendarPage";
import { CapsuleDock } from "../src/nav/CapsuleDock";
import { useAuth } from "../src/state/AuthProvider";

/**
 * /calendar — the wall's Calendar surface (WS-5): the family week at a
 * glance, mounted on the manifest dock (Calendar is a primary cap for
 * every role — same Screen + CapsuleDock + MoreSheet pattern as app/tasks.tsx).
 */
export default function CalendarRoute() {
  const { role: capabilityRole, hydrated, poke } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  // The nav role follows the CAPABILITY (a live-verified session), never the
  // cached display profile: the manifest's signed-in-only and parent-only
  // destinations stay closed to a cached profile.
  const role = capabilityRole === "parent" ? "parent" : capabilityRole ? "child" : "guest";

  return (
    <Screen testID="calendar-route">
      <CalendarPage />
      <CapsuleDock
        role={role}
        hydrated={hydrated}
        pathname={pathname}
        onNavigate={(p) => { poke(); router.push(p as never); }}
      />
    </Screen>
  );
}
