import React, { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { mix } from "../theme/mix";
import { MIN_TARGET_DP, TYPOGRAPHY } from "../theme/tokens";
import { useAuth } from "../state/AuthProvider";
import { useToast } from "../ui/Toast";
import { Chip } from "../ui/Chip";
import { EmptyState } from "../ui/EmptyState";
import { Modal } from "../ui/Modal";
import { PinPad } from "../ui/PinPad";
import { SoftButton } from "../ui/SoftButton";
import { Stepper } from "../ui/Stepper";
import { Toggle } from "../ui/Toggle";
import { Surface } from "../ui/Surface";
import { useHAState, entitiesByDomain, openSensors, alarmPanel, applyOptimisticHA, refreshHAState } from "../home/widgets/ha-state";
import { callHAService, triggerHAAlarm, haErrorToastMessage } from "./actions";
import { api } from "../api/client";

const PARENT_GATE_COPY = "Sign in as a parent to control the house.";
const OFFLINE_COPY = "Home Assistant is offline — changes won't apply.";
const HVAC_MODES = ["heat", "cool", "off"] as const;

function friendlyName(s: { entity_id: string; attributes: Record<string, unknown> }): string {
  const n = s.attributes?.friendly_name;
  if (typeof n === "string" && n.trim()) return n.trim();
  return s.entity_id.split(".")[1]?.replace(/_/g, " ") ?? s.entity_id;
}

export function HousePage() {
  const { colors, accentColor } = useTheme();
  const { member } = useAuth();
  const toast = useToast();
  const { states, error } = useHAState();
  const isParent = member?.role === "parent";

  const [health, setHealth] = useState<{ ok?: boolean; wsConnected?: boolean; configured?: boolean } | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [area, setArea] = useState<string>("all");
  const [pendingAlarm, setPendingAlarm] = useState<"arm_home" | "disarm" | null>(null);
  const [alarmPinError, setAlarmPinError] = useState<string | null>(null);
  const [alarmBusy, setAlarmBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const h = await api<{ ok?: boolean; wsConnected?: boolean; configured?: boolean }>("/api/ha/health");
        if (alive) setHealth(h);
      } catch {
        if (alive) setHealth({ ok: false, wsConnected: false });
      } finally {
        if (alive) setHealthLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const areas = React.useMemo(() => {
    const set = new Set<string>();
    for (const s of states) {
      const a = s.attributes?.area_id;
      set.add(typeof a === "string" && a.length > 0 ? a : "Other");
    }
    return Array.from(set).sort();
  }, [states]);

  const filtered = area === "all" ? states : states.filter((s) => {
    const a = s.attributes?.area_id;
    const areaName = typeof a === "string" && a.length > 0 ? a : "Other";
    return areaName === area;
  });

  const alarm = alarmPanel(filtered.length ? filtered : states);
  const alarmed = Boolean(alarm && alarm.state !== "disarmed");
  const climates = entitiesByDomain(filtered.length ? filtered : states, "climate");
  const climate = climates[0];
  const domainLights = (() => {
    const ls = entitiesByDomain(filtered.length ? filtered : states, "light");
    return ls.length > 0 ? ls : entitiesByDomain(filtered.length ? filtered : states, "switch");
  })();
  const allLightsDomain = entitiesByDomain(states, "light").length > 0 ? "light" : "switch";
  const allLights = entitiesByDomain(states, "light").length > 0 ? entitiesByDomain(states, "light") : entitiesByDomain(states, "switch");
  const people = entitiesByDomain(filtered.length ? filtered : states, "person");
  const sensors = openSensors(filtered.length ? filtered : states);

  const toggleLight = async (entityId: string) => {
    if (!isParent) return;
    const entity = allLights.find((l) => l.entity_id === entityId);
    const next = entity?.state === "on" ? "off" : "on";
    applyOptimisticHA(entityId, { state: next });
    try {
      await callHAService({ domain: entityId.split(".")[0] || "light", service: "toggle", entity_id: entityId });
    } catch (e) {
      toast.show(haErrorToastMessage(e), { intent: "error" });
    } finally {
      await refreshHAState();
    }
  };

  const turnAllOff = async () => {
    if (!isParent) return;
    const ids = allLights.filter((l) => l.state === "on").map((l) => l.entity_id);
    if (ids.length === 0) return;
    for (const id of ids) applyOptimisticHA(id, { state: "off" });
    try {
      await callHAService({ domain: allLightsDomain, service: "turn_off", service_data: { entity_id: ids } });
    } catch (e) {
      toast.show(haErrorToastMessage(e), { intent: "error" });
    } finally {
      await refreshHAState();
    }
  };

  const setClimateTarget = async (temperature: number) => {
    if (!isParent || !climate) return;
    applyOptimisticHA(climate.entity_id, { attributes: { ...climate.attributes, temperature } });
    try {
      await callHAService({ domain: "climate", service: "set_temperature", entity_id: climate.entity_id, service_data: { temperature } });
    } catch (e) {
      toast.show(haErrorToastMessage(e), { intent: "error" });
    } finally {
      await refreshHAState();
    }
  };

  const setClimateMode = async (mode: string) => {
    if (!isParent || !climate) return;
    applyOptimisticHA(climate.entity_id, { attributes: { ...climate.attributes, hvac_mode: mode }, state: mode });
    try {
      await callHAService({ domain: "climate", service: "set_hvac_mode", entity_id: climate.entity_id, service_data: { hvac_mode: mode } });
    } catch (e) {
      toast.show(haErrorToastMessage(e), { intent: "error" });
    } finally {
      await refreshHAState();
    }
  };

  const handleVerifiedPin = async (pin: string) => {
    if (!pendingAlarm || !alarm) return;
    setAlarmBusy(true);
    setAlarmPinError(null);
    try {
      await triggerHAAlarm({ action: pendingAlarm, pin, entity_id: alarm.entity_id });
      setPendingAlarm(null);
      await refreshHAState();
    } catch (e) {
      setAlarmPinError(haErrorToastMessage(e));
    } finally {
      setAlarmBusy(false);
    }
  };

  const connected = health?.wsConnected === true || health?.ok === true;
  const healthLabel = healthLoading ? "Checking…" : connected ? "Connected" : "Offline";
  const loaded = !healthLoading;

  const climateAttrs = climate?.attributes ?? {};
  const currentTemp = typeof climateAttrs.current_temperature === "number" ? (climateAttrs.current_temperature as number) : null;
  const targetTemp = typeof climateAttrs.temperature === "number" ? (climateAttrs.temperature as number) : (currentTemp ?? 70);
  const humidity = typeof climateAttrs.current_humidity === "number" ? (climateAttrs.current_humidity as number) : (typeof climateAttrs.humidity === "number" ? (climateAttrs.humidity as number) : null);
  const mode = typeof climateAttrs.hvac_mode === "string" ? (climateAttrs.hvac_mode as string) : (climate?.state ?? "");

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 220 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <View style={{ width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: mix(accentColor, "transparent", 18) }}>
            <Text style={{ fontSize: 24 }}>🏠</Text>
          </View>
          <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.title.fontSize, fontWeight: "700", fontFamily: "serif" }}>Home Controls</Text>
          <View style={{ flex: 1 }} />
          <View
            testID="ha-connection-pill"
            style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors["color-surface-2"] }}
          >
            <Text style={{ color: connected ? colors["color-accent-mint"] ?? accentColor : colors["color-accent-rose"] ?? accentColor, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
              {healthLabel}
            </Text>
          </View>
        </View>
        <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.body.fontSize, marginBottom: 12, marginLeft: 60 }}>
          Lights, climate, security & automations — live from Home Assistant
        </Text>

        {!isParent ? (
          <Surface variant="warm" radius="xl" padding="md" style={{ marginBottom: 12 }}>
            <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize }}>{PARENT_GATE_COPY}</Text>
          </Surface>
        ) : null}

        {loaded && Boolean(error) ? (
          <Surface variant="warm" radius="xl" padding="lg" style={{ marginBottom: 12 }}>
            <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>Home Assistant is offline</Text>
            <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, marginTop: 4 }}>{OFFLINE_COPY}</Text>
          </Surface>
        ) : null}

        {areas.length > 0 ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            <Chip
              as="button"
              size="md"
              tone="neutral"
              selected={area === "all"}
              onPress={() => setArea("all")}
              label="All"
            />
            {areas.map((a) => (
              <Chip
                key={a}
                as="button"
                size="md"
                tone="neutral"
                selected={area === a}
                onPress={() => setArea(a)}
                label={a}
              />
            ))}
          </View>
        ) : null}

        {/* Security & Alarm */}
        <Surface variant="warm" radius="xl" padding="lg" style={{ marginBottom: 12 }}>
          <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.title.fontSize, fontWeight: "700", marginBottom: 8 }}>Security & Alarm</Text>
          {alarm ? (
            <View style={{ gap: 8 }}>
              <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.body.fontSize }}>
                {friendlyName(alarm)} ·{" "}
                <Text style={{ color: alarm.state === "disarmed" ? (colors["color-accent-mint"] ?? accentColor) : (colors["color-accent-rose"] ?? accentColor), fontWeight: "700" }}>
                  {alarm.state === "disarmed" ? "Disarmed" : alarm.state === "armed_home" ? "Armed home" : alarm.state === "armed_away" ? "Armed away" : alarm.state}
                </Text>
              </Text>
              {isParent ? (
                <SoftButton
                  variant={alarmed ? "danger" : "primary"}
                  onPress={() => setPendingAlarm(alarmed ? "disarm" : "arm_home")}
                  testID="alarm-toggle"
                >
                  {alarmed ? "Disarm" : "Arm home"}
                </SoftButton>
              ) : null}
            </View>
          ) : (
            <EmptyState flat icon="🛡️" title="No alarm panel" body="Connect an alarm control panel to Home Assistant." />
          )}

        </Surface>

        {/* Climate */}
        <Surface variant="warm" radius="xl" padding="lg" style={{ marginBottom: 12 }}>
          <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.title.fontSize, fontWeight: "700", marginBottom: 8 }}>Climate</Text>
          {climate ? (
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                <Text style={{ color: colors["color-text-primary"], fontSize: 44, fontWeight: "800", fontVariant: ["tabular-nums"] }}>
                  {currentTemp !== null ? `${Math.round(currentTemp)}°` : "—"}
                </Text>
                <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.body.fontSize }}>
                  {friendlyName(climate)} · target {targetTemp !== null ? `${Math.round(targetTemp)}°` : "—"} · {mode}
                </Text>
              </View>
              {humidity !== null ? (
                <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize }}>Humidity {Math.round(humidity)}%</Text>
              ) : null}
              {isParent ? (
                <Stepper value={Math.round(targetTemp)} onChange={(v) => void setClimateTarget(v)} min={55} max={85} step={1} label="Target" />
              ) : null}
              {isParent ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                  {HVAC_MODES.map((m) => (
                    <Chip
                      key={m}
                      as="button"
                      size="md"
                      tone={mode === m ? "success" : "neutral"}
                      selected={mode === m}
                      onPress={() => void setClimateMode(m)}
                      label={m.charAt(0).toUpperCase() + m.slice(1)}
                      disabled={!isParent}
                    />
                  ))}
                </View>
              ) : null}
            </View>
          ) : (
            <EmptyState flat icon="🌡️" title="No climate data" body="Connect a thermostat to Home Assistant to see indoor conditions here." />
          )}
        </Surface>

        {/* Lights & Switches */}
        <Surface variant="warm" radius="xl" padding="lg" style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.title.fontSize, fontWeight: "700" }}>Lights & Switches</Text>
            {isParent && allLights.some((l) => l.state === "on") ? (
              <SoftButton size="sm" variant="secondary" onPress={() => void turnAllOff()} testID="all-lights-off">
                All Lights Off
              </SoftButton>
            ) : null}
          </View>
          {domainLights.length === 0 ? (
            <EmptyState flat icon="💡" title="No lights found" body="Connect lights to Home Assistant to control them here." />
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {domainLights.map((l) => (
                <View key={l.entity_id} style={{ width: "48%", minHeight: MIN_TARGET_DP, flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, borderRadius: 16, backgroundColor: colors["color-surface-2"] }}>
                  <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, flex: 1 }} numberOfLines={1}>
                    {friendlyName(l)}
                  </Text>
                  <Toggle
                    value={l.state === "on"}
                    onChange={() => { if (isParent) void toggleLight(l.entity_id); }}
                    disabled={!isParent}
                    accessibilityLabel={`Toggle ${friendlyName(l)}`}
                  />
                </View>
              ))}
            </View>
          )}
        </Surface>

        {/* Presence & Sensors */}
        <Surface variant="warm" radius="xl" padding="lg" style={{ marginBottom: 12 }}>
          <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.title.fontSize, fontWeight: "700", marginBottom: 8 }}>Presence & Sensors</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {people.length === 0 ? (
              <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize }}>No presence data yet</Text>
            ) : (
              people.map((p) => (
                <Chip key={p.entity_id} as="span" size="sm" tone={p.state === "home" ? "success" : "neutral"} label={`👤 ${friendlyName(p).split(" ")[0]} · ${p.state === "home" ? "home" : "away"}`} />
              ))
            )}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {sensors.length === 0 ? (
              <Chip as="span" size="sm" tone="success" label="Doors & windows closed" />
            ) : (
              sensors.map((s) => (
                <Chip key={s.entity_id} as="span" size="sm" tone="danger" label={friendlyName(s)} />
              ))
            )}
          </View>
        </Surface>
      </ScrollView>

      <Modal visible={pendingAlarm !== null} title={pendingAlarm === "disarm" ? "Disarm alarm" : "Arm alarm"} onClose={() => !alarmBusy && setPendingAlarm(null)} dismissable={!alarmBusy}>
        <PinPad
          member={{ name: "Parent", emoji: "🔐" }}
          onVerified={(pin) => void handleVerifiedPin(pin)}
          onCancel={() => setPendingAlarm(null)}
          busy={alarmBusy}
          error={alarmPinError}
        />
      </Modal>
    </View>
  );
}

export default HousePage;
