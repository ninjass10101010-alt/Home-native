import React from "react";
import { Text, View } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";
import { TYPOGRAPHY } from "../../theme/tokens";
import { useHAState, entitiesByDomain } from "./ha-state";
import { WidgetFrame } from "./WidgetFrame";

const EMPTY_CLIMATE = "No climate data yet.";

/** Wall climate tile (web HomeClimateWidget.tsx parity, read-only Wave 1). */
export function HomeClimateWidget() {
  const { colors } = useTheme();
  const { states, loaded, error, refresh } = useHAState();

  const climates = entitiesByDomain(states, "climate").slice(0, 3);

  return (
    <WidgetFrame
      id="homeClimate"
      icon="🌡️"
      title="Home Climate"
      status={loaded ? (error && states.length === 0 ? "error" : "ready") : "loading"}
      failure={error && states.length === 0 ? "error" : null}
      hasData={states.length > 0}
      stale={false}
      onRetry={refresh}
    >
      {states.length === 0 && loaded ? (
        <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, textAlign: "center" }}>
          {EMPTY_CLIMATE}
        </Text>
      ) : (
        <View style={{ gap: 6, alignItems: "flex-start" }}>
          {climates.length === 0 ? (
            <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }}>
              {EMPTY_CLIMATE}
            </Text>
          ) : (
            climates.map((c) => {
              const current = c.attributes?.current_temperature;
              const target = c.attributes?.temperature;
              const mode = typeof c.attributes?.hvac_mode === "string" ? c.attributes.hvac_mode : c.state;
              return (
                <Text
                  key={c.entity_id}
                  style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize }}
                >
                  🌡️ {typeof current === "number" ? `${Math.round(current)}°` : "—"} →{" "}
                  {typeof target === "number" ? `${Math.round(target)}°` : "—"}{" "}
                  <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }}>
                    {String(mode)}
                  </Text>
                </Text>
              );
            })
          )}
        </View>
      )}
    </WidgetFrame>
  );
}
