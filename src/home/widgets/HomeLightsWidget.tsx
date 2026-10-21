import React from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../../theme/ThemeProvider";
import { TYPOGRAPHY } from "../../theme/tokens";
import { EmptyState } from "../../ui/EmptyState";
import { useToast } from "../../ui/Toast";
import { useAuth } from "../../state/AuthProvider";
import { useHAState, entitiesByDomain, applyOptimisticHA, refreshHAState } from "./ha-state";
import { callHAService, haErrorToastMessage } from "../../ha/actions";
import { WidgetFrame } from "./WidgetFrame";

/**
 * The reference's empty lights cell: the glyph, then a BOLD headline, and
 * NOTHING else. The web shows no second helper line under it — the tile's
 * composition is the emoji + one bold line, with the rest of the card left as
 * air (reference/home/parent-dark.png, "Home Lights").
 *
 * The block is TOP-aligned (not centred): the reference seats the glyph ~22px
 * under the header rule and leaves the lower half of the card empty.
 */
function LightsEmpty() {
  return (
    <EmptyState
      flat
      icon="💡"
      title="No lights found"
      style={{ flex: 1, justifyContent: "flex-start", paddingTop: 0 }}
    />
  );
}

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
        <LightsEmpty />
      ) : (
        <View style={{ gap: 6, alignItems: "flex-start" }}>
          {lights.length === 0 ? (
            <LightsEmpty />
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
                  hitSlop={8}
                  style={{ minHeight: 36, paddingVertical: 4, justifyContent: "center", width: "100%" }}
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
