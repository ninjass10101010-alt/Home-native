import React from "react";
import { usePathname, useRouter } from "expo-router";
import { Screen } from "../src/theme/Screen";
import { MealsPage } from "../src/meals/MealsPage";
import { CapsuleDock } from "../src/nav/CapsuleDock";
import { MoreSheet } from "../src/nav/MoreSheet";
import { useAuth } from "../src/state/AuthProvider";

/**
 * /meals — the wall's Meals surface (WS-6): the read-only week planner on the
 * manifest dock (Meals is a primary cap for every role — same Screen +
 * CapsuleDock + MoreSheet pattern as app/tasks.tsx / app/calendar.tsx).
 */
export default function MealsRoute() {
  const { member, hydrated } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = React.useState(false);
  const role = member ? (member.role === "parent" ? "parent" : "child") : "guest";

  return (
    <Screen testID="meals-route">
      <MealsPage />
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
