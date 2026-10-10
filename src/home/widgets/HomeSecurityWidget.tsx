import React from "react";
import { Text, View } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";
import { TYPOGRAPHY } from "../../theme/tokens";
import { useHAState, entitiesByDomain, openSensors, alarmPanel } from "./ha-state";
import { WidgetFrame } from "./WidgetFrame";

const EMPTY_SECURITY = "No presence data yet.";

/** Wall security tile (web HomeSecurityWidget.tsx parity, read-only Wave 1). */
export function HomeSecurityWidget() {
  const { colors } = useTheme();
  const { states, loaded, error, refresh } = useHAState();

  const people = entitiesByDomain(states, "person");
  const home = people.filter((p) => p.state === "home");
  const sensors = openSensors(states);
  const alarm = alarmPanel(states);
  const alarmState = alarm?.state ?? "unavailable";

  return (
    <WidgetFrame
      id="homeSecurity"
      icon="🛡️"
      title="Home Security"
      status={loaded ? (error && states.length === 0 ? "error" : "ready") : "loading"}
      failure={error && states.length === 0 ? "error" : null}
      hasData={states.length > 0}
      stale={false}
      onRetry={refresh}
    >
      {states.length === 0 && loaded ? (
        <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, textAlign: "center" }}>
          {EMPTY_SECURITY}
        </Text>
      ) : (
        <View style={{ gap: 6, alignItems: "flex-start" }}>
          <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "600" }}>
            👥 {home.length} home{people.length > 0 ? ` of ${people.length}` : ""}
          </Text>
          <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize }}>
            {sensors.length === 0 ? "🚪 All secure" : `🚨 ${sensors.length} open sensor${sensors.length === 1 ? "" : "s"}`}
          </Text>
          <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }}>
            ⏰ Alarm: {alarmState}
          </Text>
        </View>
      )}
    </WidgetFrame>
  );
}
