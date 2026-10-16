import React from "react";
import { Screen } from "../src/theme/Screen";
import { EmergencyFlow } from "../src/emergency/EmergencyFlow";

/**
 * /emergency — the wall's dedicated emergency surface (WS-9). Reached from
 * the always-visible Home shield; the alarm header's back returns to Home
 * (or replaces with it when opened with no history, so the route is never
 * a dead end).
 */
export default function EmergencyRoute() {
  return (
    <Screen testID="emergency-route">
      <EmergencyFlow />
    </Screen>
  );
}
