import React from "react";
import { View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { Screen } from "../src/theme/Screen";
import { RewardsPage } from "../src/rewards/RewardsPage";
import { CapsuleDock, MoreButton } from "../src/nav/CapsuleDock";
import { MoreSheet } from "../src/nav/MoreSheet";
import { useAuth } from "../src/state/AuthProvider";

export default function RewardsRoute() {
  const { role: capabilityRole, hydrated, poke } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = React.useState(false);
  // The nav role follows the CAPABILITY (a live-verified session), never the
  // cached display profile: the manifest's signed-in-only and parent-only
  // destinations stay closed to a cached profile.
  const role = capabilityRole === "parent" ? "parent" : capabilityRole ? "child" : "guest";

  return (
    <Screen testID="rewards-route">
      <RewardsPage />
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
