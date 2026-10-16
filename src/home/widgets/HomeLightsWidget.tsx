import React from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../../theme/ThemeProvider";
import { MIN_TARGET_DP, TYPOGRAPHY } from "../../theme/tokens";
import { EmptyState } from "../../ui/EmptyState";
import { useToast } from "../../ui/Toast";
import { useAuth } from "../../state/AuthProvider";
import { useHAState, entitiesByDomain, applyOptimisticHA, refreshHAState } from "./ha-state";
import { callHAService, haErrorToastMessage } from "../../ha/actions";
import { WidgetFrame } from "./WidgetFrame";

/** Wall lights tile (web HomeLightsWidget.tsx parity). Parent tap toggles a
 *  light optimistically; guests/kids tap through to /ha. */
export function HomeLightsWidget() {
  const { colors } = useTheme();
  const { member } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { states, loaded, error, refresh } = useHAState();

  const isParent = member?.role === "parent";

  const lightEntities = entitiesByDomain(states, "light");
  const lights = lightEntities.length > 0 ? lightEntities : entitiesByDomain(states, "switch");
  const on = lights.filter((l) => l.state === "on");

  const toggle = async (entityId: string) => {
    const entity = lights.find((l) => l.entity_id === entityId);
    if (!entity) return;
    const domain = entityId.split(".")[0] || "light";
    const next = entity.state === "on" ? "off" : "on";
    applyOptimisticHA(entityId, { state: next });
    try {
      await callHAService({ domain, service: "toggle", entity_id: entityId });
    } catch (e) {
      toast.show(haErrorToastMessage(e), { intent: "error" });
    } finally {
      await refreshHAState();
    }
  };

  return (
    <WidgetFrame
      id="homeLights"
      icon="💡"
      title="Home Lights"
      status={loaded ? (error && states.length === 0 ? "error" : "ready") : "loading"}
      failure={error && states.length === 0 ? "error" : null}
      hasData={states.length > 0}
      stale={!!error && states.length > 0}
      onRetry={refresh}
    >
      {states.length === 0 && loaded ? (
        <EmptyState
          flat
          icon="💡"
          title="No lights found"
          body="Connect lights to Home Assistant to control them here."
          style={{ flex: 1 }}
        />
      ) : (
        <View style={{ gap: 6, alignItems: "flex-start" }}>
          {lights.length === 0 ? (
            <EmptyState
              flat
              icon="💡"
              title="No lights found"
              body="Connect lights to Home Assistant to control them here."
              style={{ flex: 1 }}
            />
          ) : (
            <>
              <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "600" }}>
                💡 {on.length} on of {lights.length}
              </Text>
              {lights.slice(0, 3).map((l) => (
                <Pressable
                  key={l.entity_id}
                  accessibilityRole="button"
                  accessibilityLabel={`Toggle ${String(l.attributes?.friendly_name ?? l.entity_id)}`}
                  onPress={() => {
                    if (isParent) void toggle(l.entity_id);
                    else router.push("/ha");
                  }}
                  style={{ minHeight: MIN_TARGET_DP, justifyContent: "center", width: "100%" }}
                >
                  <Text
                    style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }}
                    numberOfLines={1}
                  >
                    · {String(l.attributes?.friendly_name ?? l.entity_id.split(".")[1]?.replace(/_/g, " ") ?? l.entity_id)}
                    {l.state === "on" ? "" : " (off)"}
                  </Text>
                </Pressable>
              ))}
              {lights.length > 3 ? (
                <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize }}>
                  +{lights.length - 3} more
                </Text>
              ) : null}
            </>
          )}
        </View>
      )}
    </WidgetFrame>
  );
}

export default HomeLightsWidget;
