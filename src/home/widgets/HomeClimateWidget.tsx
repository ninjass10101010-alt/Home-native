import React from "react";
import { Text, View } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";
import { TYPOGRAPHY } from "../../theme/tokens";
import { EmptyState } from "../../ui/EmptyState";
import { useHAState, entitiesByDomain } from "./ha-state";
import { WidgetFrame } from "./WidgetFrame";

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
      stale={!!error && states.length > 0}
      onRetry={refresh}
    >
      {states.length === 0 && loaded ? (
        <EmptyState
          flat
          icon="🌡️"
          title="No climate data"
          body="Connect a thermostat to Home Assistant to see indoor conditions here."
          style={{ flex: 1 }}
        />
      ) : (
        <View style={{ gap: 8, alignItems: "flex-start" }}>
          {climates.length === 0 ? (
            <EmptyState
              flat
              icon="🌡️"
              title="No climate data"
              body="Connect a thermostat to Home Assistant to see indoor conditions here."
              style={{ flex: 1 }}
            />
          ) : (
            climates.map((c) => {
              const attrs = c.attributes ?? {};
              const current = attrs.current_temperature;
              const target = attrs.temperature;
              const humidity = attrs.current_humidity;
              const mode = typeof attrs.hvac_mode === "string" ? attrs.hvac_mode : c.state;
              return (
                <View key={c.entity_id} style={{ gap: 2 }}>
                  <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize }}>
                    🌡️ {typeof current === "number" ? `${Math.round(current)}°` : "—"} →{" "}
                    {typeof target === "number" ? `${Math.round(target)}°` : "—"}{" "}
                    <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }}>
                      {String(mode)}
                    </Text>
                  </Text>
                  {typeof humidity === "number" ? (
                    <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize }}>
                      Humidity {Math.round(humidity)}%
                    </Text>
                  ) : null}
                </View>
              );
            })
          )}
        </View>
      )}
    </WidgetFrame>
  );
}

export default HomeClimateWidget;
