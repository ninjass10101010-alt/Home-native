import React from "react";
import { Text, View } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";
import { TYPOGRAPHY } from "../../theme/tokens";
import { useHAState, entitiesByDomain } from "./ha-state";
import { WidgetFrame } from "./WidgetFrame";

const EMPTY_LIGHTS = "No lights found.";

/** Wall lights tile (web HomeLightsWidget.tsx parity, read-only Wave 1). */
export function HomeLightsWidget() {
  const { colors } = useTheme();
  const { states, loaded, error, refresh } = useHAState();

  const lights = entitiesByDomain(states, "light");
  const on = lights.filter((l) => l.state === "on");

  return (
    <WidgetFrame
      id="homeLights"
      icon="💡"
      title="Home Lights"
      status={loaded ? (error && states.length === 0 ? "error" : "ready") : "loading"}
      failure={error && states.length === 0 ? "error" : null}
      hasData={states.length > 0}
      stale={false}
      onRetry={refresh}
    >
      {states.length === 0 && loaded ? (
        <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, textAlign: "center" }}>
          {EMPTY_LIGHTS}
        </Text>
      ) : (
        <View style={{ gap: 6, alignItems: "flex-start" }}>
          <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "600" }}>
            💡 {on.length} on{lights.length > 0 ? ` of ${lights.length}` : ""}
          </Text>
          {on.slice(0, 3).map((l) => (
            <Text key={l.entity_id} style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }} numberOfLines={1}>
              · {String(l.attributes?.friendly_name ?? l.entity_id)}
            </Text>
          ))}
          {on.length > 3 ? (
            <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize }}>
              +{on.length - 3} more
            </Text>
          ) : null}
        </View>
      )}
    </WidgetFrame>
  );
}
