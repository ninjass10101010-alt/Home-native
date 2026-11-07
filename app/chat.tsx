import React from "react";
import { usePathname, useRouter } from "expo-router";
import { Screen } from "../src/theme/Screen";
import { ChatPage } from "../src/chat/ChatPage";
import { CapsuleDock, MoreButton } from "../src/nav/CapsuleDock";
import { MoreSheet } from "../src/nav/MoreSheet";
import { useAuth } from "../src/state/AuthProvider";

export default function ChatRoute() {
  const { role: capabilityRole, hydrated } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = React.useState(false);
  // The nav role follows the CAPABILITY (a live-verified session), never the
  // cached display profile: the manifest's signed-in-only and parent-only
  // destinations stay closed to a cached profile.
  const role = capabilityRole === "parent" ? "parent" : capabilityRole ? "child" : "guest";

  return (
    <Screen testID="chat-route">
      <ChatPage headerRight={<MoreButton onPress={() => setMoreOpen(true)} />} />
      <CapsuleDock
        role={role}
        hydrated={hydrated}
        pathname={pathname}
        onNavigate={(p) => { router.replace(p as never); }}
      />
      <MoreSheet
        visible={moreOpen}
        onClose={() => setMoreOpen(false)}
        role={role}
        onNavigate={(p) => { router.replace(p as never); }}
      />
    </Screen>
  );
}
