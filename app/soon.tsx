import React from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams, usePathname, useRouter } from "expo-router";
import { Screen } from "../src/theme/Screen";
import { useTheme } from "../src/theme/ThemeProvider";
import { TYPOGRAPHY } from "../src/theme/tokens";
import { EmptyState } from "../src/ui/EmptyState";
import { CapsuleDock, MoreButton } from "../src/nav/CapsuleDock";
import { MoreSheet } from "../src/nav/MoreSheet";
import { useAuth } from "../src/state/AuthProvider";

/**
 * The honest placeholder for manifest destinations whose surfaces ship in
 * Wave 2 (Ask / House / Rewards + the More… sheet's secondary pages).
 * resolveRoute() steers every not-yet-live path here so a dock or sheet
 * press NEVER dead-ends on expo-router's Unmatched view — the dock stays
 * alive and the family is told exactly what's coming.
 */
export default function Soon() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ label?: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const { role: capabilityRole, hydrated, poke } = useAuth();
  const [moreOpen, setMoreOpen] = React.useState(false);

  // The nav role follows the CAPABILITY (a live-verified session), never the
  // cached display profile: the manifest's signed-in-only and parent-only
  // destinations stay closed to a cached profile.
  const role = capabilityRole === "parent" ? "parent" : capabilityRole ? "child" : "guest";
  const label = typeof params.label === "string" && params.label ? params.label : "This surface";

  return (
    <Screen testID="soon-route">
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
        <EmptyState
          icon="🚧"
          title={`${label} arrives in the next wave`}
          body="The wall's core is live — this surface ships with Wave 2."
          actionLabel="Back to Home"
          onAction={() => router.push("/" as never)}
        />
        <Text
          style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize, marginTop: 12, textAlign: "center" }}
        >
          The dock below still works — nothing here is a dead end.
        </Text>
      </View>
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 116, alignItems: "center" }} pointerEvents="box-none">
        <MoreButton onPress={() => setMoreOpen(true)} />
      </View>
      <CapsuleDock
        role={role}
        hydrated={hydrated}
        pathname={pathname}
        onNavigate={(p) => {
          poke();
          router.push(p as never);
        }}
      />
      <MoreSheet
        visible={moreOpen}
        onClose={() => setMoreOpen(false)}
        role={role}
        onNavigate={(p) => {
          poke();
          router.push(p as never);
        }}
      />
    </Screen>
  );
}
