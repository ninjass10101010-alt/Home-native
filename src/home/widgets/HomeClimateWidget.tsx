import React from "react";
import { Text, View } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";
import { TYPOGRAPHY } from "../../theme/tokens";
import { EmptyState } from "../../ui/EmptyState";
import { useHAState, entitiesByDomain } from "./ha-state";
import { WidgetFrame } from "./WidgetFrame";

/**
 * The reference's empty climate cell: the glyph, then a BOLD headline, and
 * NOTHING else. The web shows no second helper line under it — the tile's
 * composition is the emoji + one bold line, with the rest of the card left as
 * air (reference/home/parent-dark.png, "Home Climate").
 *
 * The block is TOP-aligned (not centred): the reference seats the glyph ~22px
 * under the header rule and leaves the lower half of the card empty.
 */
function ClimateEmpty() {
  return (
    <EmptyState
      flat
      icon="🌡️"
      title="No climate data"
      style={{ flex: 1, justifyContent: "flex-start", paddingTop: 0 }}
    />
  );
}

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
        <ClimateEmpty />
      ) : (
        <View style={{ gap: 8, alignItems: "flex-start" }}>
          {climates.length === 0 ? (
            <ClimateEmpty />
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
