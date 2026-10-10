import React from "react";
import { useRouter } from "expo-router";
import { Screen } from "../src/theme/Screen";
import { EmergencyFlow } from "../src/emergency/EmergencyFlow";
import { SoftButton } from "../src/ui/SoftButton";

/**
 * /emergency — the wall's dedicated emergency surface (WS-9). Reached from
 * the always-visible Home shield; back returns to Home (or replaces with it
 * when opened with no history, so the route is never a dead end).
 */
export default function EmergencyRoute() {
  const router = useRouter();
  return (
    <Screen testID="emergency-route">
      <SoftButton
        variant="ghost"
        size="sm"
        accessibilityLabel="Back to Home"
        onPress={() => {
          if (router.canGoBack()) router.back();
          else router.replace("/" as never);
        }}
        style={{ alignSelf: "flex-start", marginLeft: 24, marginTop: 8 }}
      >
        ← Back
      </SoftButton>
      <EmergencyFlow />
    </Screen>
  );
}
