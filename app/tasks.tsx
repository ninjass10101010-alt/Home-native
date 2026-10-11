import React from "react";
import { usePathname, useRouter } from "expo-router";
import { Screen } from "../src/theme/Screen";
import { TasksPage } from "../src/tasks/TasksPage";
import { CapsuleDock } from "../src/nav/CapsuleDock";
import { MoreSheet } from "../src/nav/MoreSheet";
import { useAuth } from "../src/state/AuthProvider";

/**
 * /tasks — the wall's Tasks surface (WS-7): kid chores + parent approvals,
 * mounted on the manifest dock (Tasks is a primary cap for every role —
 * same Screen + CapsuleDock + MoreSheet pattern as app/index.tsx).
 */
export default function TasksRoute() {
  const { member, hydrated } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = React.useState(false);
  const role = member ? (member.role === "parent" ? "parent" : "child") : "guest";

  return (
    <Screen testID="tasks-route">
      <TasksPage />
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
