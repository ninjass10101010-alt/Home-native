import React from "react";
import { View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { Screen } from "../src/theme/Screen";
import { PhotosPage } from "../src/photos/PhotosPage";
import { CapsuleDock, MoreButton } from "../src/nav/CapsuleDock";
import { MoreSheet } from "../src/nav/MoreSheet";
import { useAuth } from "../src/state/AuthProvider";

/**
 * /photos — the wall's Photos surface (WS-8): the shared library grid with
 * parent moderation. Photos is a More… sheet destination for signed-in roles
 * (nav manifest) — the dock still mounts here exactly like every surface.
 */
export default function PhotosRoute() {
  const { member, hydrated, poke } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = React.useState(false);
  const role = member ? (member.role === "parent" ? "parent" : "child") : "guest";

  return (
    <Screen testID="photos-route">
      <PhotosPage />
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
