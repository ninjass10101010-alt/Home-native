import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../../theme/ThemeProvider";
import { accentDeepened, accentInk, mix } from "../../theme/mix";
import { hapticTap } from "../../theme/haptics";
import { TYPOGRAPHY } from "../../theme/tokens";
import { EmptyState } from "../../ui/EmptyState";
import { useOptionalToast } from "../../ui/Toast";
import { useAuth } from "../../state/AuthProvider";
import {
  useHAState,
  controllableLights,
  sortLightsForDisplay,
  lightGlyphFor,
  resolveEntityArea,
  supportsBrightness,
  lightBrightnessPct,
  applyOptimisticHA,
  clearOptimisticHA,
  scheduleHASettleRefresh,
  refreshHAState,
  type HAState,
} from "./ha-state";
import { callHAService, haErrorToastMessage } from "../../ha/actions";
import type { WallWidgetProps } from "../widgets";
import { WidgetFrame } from "./WidgetFrame";

function lightDisplayName(l: HAState): string {
  const n = l.attributes?.friendly_name;
  if (typeof n === "string" && n.trim()) return n.trim();
  return l.entity_id.split(".")[1]?.replace(/_/g, " ") ?? l.entity_id;
}

function LightsEmpty({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      testID="homeLights-empty-open"
      accessibilityRole="button"
      accessibilityLabel="No lights found — open House controls"
      onPress={() => {
        hapticTap();
        onPress();
      }}
      style={({ pressed }) => ({ flex: 1, width: "100%", opacity: pressed ? 0.78 : 1 })}
    >
      <EmptyState
        flat
        icon="💡"
        title="No lights found"
        style={{ flex: 1, justifyContent: "flex-start", paddingTop: 0 }}
      />
    </Pressable>
  );
}

/** Wall lights tile in Warm Glass v3. Parent tap sends explicit turn_on/turn_off
 *  with TTL-protected optimistic state; guests/kids tap through to /ha. */
export function HomeLightsWidget({ shape }: Partial<WallWidgetProps> = {}) {
  const { colors, theme, accentColor } = useTheme();
  const { role } = useAuth();
  const router = useRouter();
  const toast = useOptionalToast();
  const { states, loaded, error, refresh } = useHAState();
  const [inFlight, setInFlight] = useState<Record<string, boolean>>({});

  const isParent = role === "parent";
  const amber = colors["color-accent-amber"] ?? accentColor;
  const amberInk = theme === "light" ? accentDeepened(amber, 32) : amber;
  const linkInk = accentInk(accentColor, colors["color-text-primary"]);

  const lights = sortLightsForDisplay(controllableLights(states));
  const on = lights.filter((l) => l.state === "on");

  const isWide = shape === "2x1";
  const isTall = shape === "1x2";
  const limit = isWide ? 4 : isTall ? 5 : 3;
  const visible = lights.slice(0, limit);

  const toggle = async (entityId: string) => {
    const entity = lights.find((l) => l.entity_id === entityId);
    if (!entity || inFlight[entityId]) return;
    const domain = entityId.split(".")[0] || "light";
    const next = entity.state === "on" ? "off" : "on";
    const service = next === "on" ? "turn_on" : "turn_off";
    hapticTap();
    setInFlight((prev) => ({ ...prev, [entityId]: true }));
    applyOptimisticHA(entityId, { state: next });
    try {
      await callHAService({ domain, service, entity_id: entityId });
      scheduleHASettleRefresh();
    } catch (e) {
      clearOptimisticHA(entityId);
      toast?.show(haErrorToastMessage(e), { intent: "error" });
      await refreshHAState();
    } finally {
      setInFlight((prev) => ({ ...prev, [entityId]: false }));
    }
  };

  const turnAllOff = async () => {
    if (!isParent || on.length === 0) return;
    hapticTap();
    const byDomain = new Map<string, string[]>();
    for (const item of on) {
      applyOptimisticHA(item.entity_id, { state: "off" });
      const dom = item.entity_id.split(".")[0] || "light";
      const list = byDomain.get(dom) ?? [];
      list.push(item.entity_id);
      byDomain.set(dom, list);
    }
    try {
      for (const [dom, ids] of byDomain.entries()) {
        await callHAService({ domain: dom, service: "turn_off", service_data: { entity_id: ids } });
      }
      scheduleHASettleRefresh();
    } catch (e) {
      for (const item of on) clearOptimisticHA(item.entity_id);
      toast?.show(haErrorToastMessage(e), { intent: "error" });
      await refreshHAState();
    }
  };

  return (
    <WidgetFrame
      id="homeLights"
      icon="💡"
      title="Home Lights"
      onHeaderPress={() => router.push("/ha" as never)}
      headerPressLabel="Open Home controls"
      status={loaded ? (error && states.length === 0 ? "error" : "ready") : "loading"}
      failure={error && states.length === 0 ? "error" : null}
      hasData={states.length > 0}
      stale={!!error && states.length > 0}
      onRetry={refresh}
    >
      {states.length === 0 && loaded ? (
        <LightsEmpty onPress={() => router.push("/ha" as never)} />
      ) : lights.length === 0 ? (
        <LightsEmpty onPress={() => router.push("/ha" as never)} />
      ) : (
        <View style={{ flex: 1, justifyContent: "space-between", gap: 6 }}>
          <View style={{ gap: 6 }}>
            {/* Status header + parent All off pill */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: on.length > 0 ? amber : colors["color-text-muted"],
                  }}
                />
                <Text
                  style={{
                    color: colors["color-text-primary"],
                    fontSize: TYPOGRAPHY.label.fontSize,
                    fontWeight: "700",
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {on.length} on of {lights.length}
                </Text>
              </View>
              {isParent && on.length > 0 ? (
                <Pressable
                  testID="homeLights-all-off"
                  accessibilityRole="button"
                  accessibilityLabel="Turn all lights off"
                  onPress={() => void turnAllOff()}
                  hitSlop={14}
                  style={({ pressed }) => ({
                    minHeight: 36,
                    paddingHorizontal: 10,
                    borderRadius: 999,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: mix(amber, colors["color-surface-2"], 20),
                    borderWidth: 1,
                    borderColor: mix(amber, "transparent", 45),
                    opacity: pressed ? 0.78 : 1,
                  })}
                >
                  <Text style={{ color: amberInk, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
                    All off
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {/* Illuminated Warm Glass tiles */}
            <View
              style={
                isWide
                  ? { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8 }
                  : { gap: 6 }
              }
            >
              {visible.map((l) => {
                const isOn = l.state === "on";
                const dimmable = supportsBrightness(l);
                const pct = lightBrightnessPct(l);
                const name = lightDisplayName(l);
                const statusLabel = isOn ? (dimmable ? `${pct}%` : "On") : "Off";
                const pending = Boolean(inFlight[l.entity_id]);

                return (
                  <Pressable
                    key={l.entity_id}
                    testID={`homeLights-tile-${l.entity_id}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Toggle ${name}`}
                    onPress={() => {
                      if (isParent) void toggle(l.entity_id);
                      else router.push("/ha" as never);
                    }}
                    hitSlop={isWide ? 4 : 9}
                    style={({ pressed }) => ({
                      width: isWide ? "48.5%" : "100%",
                      minHeight: isWide ? 64 : isTall ? 58 : 46,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 16,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      borderWidth: 1,
                      borderColor: isOn ? mix(amber, "transparent", 55) : colors["color-border"] ?? "transparent",
                      backgroundColor: isOn
                        ? mix(amber, colors["color-surface-2"], theme === "dark" ? 24 : 18)
                        : colors["color-surface-2"],
                      opacity: pressed ? 0.8 : pending ? 0.88 : 1,
                    })}
                  >
                    <View
                      style={{
                        width: isWide || isTall ? 34 : 28,
                        height: isWide || isTall ? 34 : 28,
                        borderRadius: 999,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: isOn
                          ? mix(amber, colors["color-surface-1"], 34)
                          : colors["color-surface-3"],
                        borderWidth: 1,
                        borderColor: isOn ? mix(amber, "transparent", 55) : colors["color-border"] ?? "transparent",
                      }}
                    >
                      <Text style={{ fontSize: isWide || isTall ? 16 : 14 }}>{lightGlyphFor(l)}</Text>
                    </View>

                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        numberOfLines={1}
                        style={{
                          color: colors["color-text-primary"],
                          fontSize: TYPOGRAPHY.label.fontSize,
                          fontWeight: "600",
                        }}
                      >
                        {name}
                      </Text>
                      {isWide || isTall ? (
                        <Text
                          numberOfLines={1}
                          style={{
                            color: colors["color-text-muted"],
                            fontSize: TYPOGRAPHY.label.fontSize,
                          }}
                        >
                          {resolveEntityArea(l)}
                        </Text>
                      ) : null}
                    </View>

                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 999,
                        backgroundColor: isOn
                          ? mix(amber, colors["color-surface-1"], 24)
                          : colors["color-surface-3"],
                        borderWidth: 1,
                        borderColor: isOn ? mix(amber, "transparent", 45) : colors["color-border"] ?? "transparent",
                      }}
                    >
                      <Text
                        style={{
                          color: isOn ? amberInk : colors["color-text-secondary"],
                          fontSize: TYPOGRAPHY.label.fontSize,
                          fontWeight: "700",
                          fontVariant: ["tabular-nums"],
                        }}
                      >
                        {statusLabel}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {lights.length > limit ? (
            <Pressable
              testID="homeLights-more-open"
              accessibilityRole="button"
              onPress={() => {
                hapticTap();
                router.push("/ha" as never);
              }}
              hitSlop={14}
              style={{ minHeight: 36, justifyContent: "center" }}
            >
              <Text style={{ color: linkInk, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
                +{lights.length - limit} more · House →
              </Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </WidgetFrame>
  );
}

export default HomeLightsWidget;
