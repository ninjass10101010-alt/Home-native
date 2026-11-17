import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { mix } from "../theme/mix";
import { FONTS, MIN_TARGET_DP, TYPOGRAPHY } from "../theme/tokens";
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
import {
  useHAState,
  entitiesByDomain,
  controllableLights,
  doorWindowSensors,
  motionSensors,
  resolveEntityArea,
  supportsBrightness,
  supportsColorTemp,
  lightBrightnessPct,
  lightColorTempKelvin,
  openSensors,
  alarmPanel,
  applyOptimisticHA,
  refreshHAState,
  type HAState,
} from "../home/widgets/ha-state";
import { callHAService, triggerHAAlarm, haErrorToastMessage } from "./actions";
import { api } from "../api/client";

const PARENT_GATE_COPY = "Sign in as a parent to control the house.";
const OFFLINE_COPY = "Home Assistant is offline — changes won't apply.";
const HVAC_MODES = ["heat", "cool", "off"] as const;
const BRIGHTNESS_PRESETS = [25, 50, 75, 100] as const;
const COLOR_TEMP_PRESETS = [
  { label: "Cozy", kelvin: 2200, token: "color-accent-apricot" },
  { label: "Warm", kelvin: 2700, token: "color-accent-amber" },
  { label: "Neutral", kelvin: 3500, token: "color-text-primary" },
  { label: "Cool", kelvin: 4500, token: "color-accent-cyan" },
  { label: "Daylight", kelvin: 6000, token: "color-accent-nori" },
] as const;

const AREA_PRIORITY = [
  "Kitchen",
  "Living Room",
  "Bedroom",
  "Office",
  "Basement",
  "Hallway",
  "Bathroom",
  "Entry",
  "Outside",
  "Garage",
];

function friendlyName(s: { entity_id: string; attributes: Record<string, unknown> }): string {
  const n = s.attributes?.friendly_name;
  if (typeof n === "string" && n.trim()) return n.trim();
  return s.entity_id.split(".")[1]?.replace(/_/g, " ") ?? s.entity_id;
}

function findSimSwitch(sensor: HAState, allStates: HAState[]): string | null {
  const attrSim = sensor.attributes?.demo_sim_entity;
  if (typeof attrSim === "string" && attrSim.startsWith("switch.")) {
    return attrSim;
  }
  const slug = sensor.entity_id.split(".")[1];
  if (!slug) return null;
  const candidate = `switch.demo_sim_${slug}`;
  return allStates.some((st) => st.entity_id === candidate) ? candidate : null;
}

function compareAreas(a: string, b: string): number {
  if (a === "Other" && b !== "Other") return 1;
  if (b === "Other" && a !== "Other") return -1;
  const idxA = AREA_PRIORITY.indexOf(a);
  const idxB = AREA_PRIORITY.indexOf(b);
  if (idxA !== -1 && idxB !== -1) return idxA - idxB;
  if (idxA !== -1) return -1;
  if (idxB !== -1) return 1;
  return a.localeCompare(b);
}

export function HousePage() {
  const { colors, accentColor } = useTheme();
  const { role } = useAuth();
  const toast = useToast();
  const { states, error } = useHAState();
  // The CAPABILITY role — the house controls are parent-only, so a cached
  // parent profile must not unlock them.
  const isParent = role === "parent";

  const [health, setHealth] = useState<{ ok?: boolean; wsConnected?: boolean; configured?: boolean } | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [area, setArea] = useState<string>("all");
  const [expandedLights, setExpandedLights] = useState<Record<string, boolean>>({});
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

  const allLights = React.useMemo(() => controllableLights(states), [states]);
  const allDoors = React.useMemo(() => doorWindowSensors(states), [states]);
  const allMotion = React.useMemo(() => motionSensors(states), [states]);
  const allClimates = React.useMemo(() => entitiesByDomain(states, "climate"), [states]);
  const alarm = alarmPanel(states);

  const areas = React.useMemo(() => {
    const set = new Set<string>();
    const roomEntities = [...allLights, ...allDoors, ...allMotion, ...allClimates];
    for (const s of roomEntities) {
      set.add(resolveEntityArea(s));
    }
    return Array.from(set).sort(compareAreas);
  }, [allLights, allDoors, allMotion, allClimates]);

  const inSelectedArea = (s: HAState) => area === "all" || resolveEntityArea(s) === area;

  const domainLights = allLights.filter(inSelectedArea);
  const doorSensors = allDoors.filter(inSelectedArea);
  const motionList = allMotion.filter(inSelectedArea);
  const filteredClimates = allClimates.filter(inSelectedArea);
  const climate = filteredClimates[0] ?? allClimates[0];

  const alarmed = Boolean(alarm && alarm.state !== "disarmed");
  const people = entitiesByDomain(states, "person");
  const filteredStates = area === "all" ? states : states.filter(inSelectedArea);
  const activeOpenSensors = openSensors(filteredStates);

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

  const setLightBrightness = async (entity: HAState, pct: number) => {
    if (!isParent) return;
    const clamped = Math.max(0, Math.min(100, Math.round(pct)));
    const nextState = clamped > 0 ? "on" : "off";
    applyOptimisticHA(entity.entity_id, {
      state: nextState,
      attributes: {
        ...entity.attributes,
        brightness: Math.round((clamped / 100) * 255),
        brightness_pct: clamped,
      },
    });
    try {
      if (clamped === 0) {
        await callHAService({ domain: "light", service: "turn_off", entity_id: entity.entity_id });
      } else {
        await callHAService({
          domain: "light",
          service: "turn_on",
          entity_id: entity.entity_id,
          service_data: { brightness_pct: clamped },
        });
      }
    } catch (e) {
      toast.show(haErrorToastMessage(e), { intent: "error" });
    } finally {
      await refreshHAState();
    }
  };

  const setLightColorTemp = async (entity: HAState, kelvin: number) => {
    if (!isParent) return;
    applyOptimisticHA(entity.entity_id, {
      state: "on",
      attributes: {
        ...entity.attributes,
        color_temp_kelvin: kelvin,
        color_temp: Math.round(1_000_000 / kelvin),
      },
    });
    try {
      await callHAService({
        domain: "light",
        service: "turn_on",
        entity_id: entity.entity_id,
        service_data: { color_temp_kelvin: kelvin },
      });
    } catch (e) {
      toast.show(haErrorToastMessage(e), { intent: "error" });
    } finally {
      await refreshHAState();
    }
  };

  const turnAllOff = async () => {
    if (!isParent) return;
    const onEntities = domainLights.filter((l) => l.state === "on");
    if (onEntities.length === 0) return;
    const byDomain = new Map<string, string[]>();
    for (const item of onEntities) {
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
    } catch (e) {
      toast.show(haErrorToastMessage(e), { intent: "error" });
    } finally {
      await refreshHAState();
    }
  };

  const simulateSensor = async (sensor: HAState) => {
    if (!isParent) return;
    const simEntityId = findSimSwitch(sensor, states);
    if (!simEntityId) return;
    const next = sensor.state === "on" ? "off" : "on";
    applyOptimisticHA(sensor.entity_id, { state: next });
    applyOptimisticHA(simEntityId, { state: next });
    try {
      await callHAService({ domain: "switch", service: "toggle", entity_id: simEntityId });
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

  const onCount = domainLights.filter((l) => l.state === "on").length;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 220 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <View style={{ width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: mix(accentColor, "transparent", 18) }}>
            <Text style={{ fontSize: 24 }}>🏠</Text>
          </View>
          <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.title.fontSize, fontWeight: "700", fontFamily: FONTS.display }}>Home Controls</Text>
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
          Lights, climate, security & sensors — organized by room
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
              testID="area-chip-all"
              as="button"
              size="md"
              tone="neutral"
              selected={area === "all"}
              onPress={() => setArea("all")}
              label="All Rooms"
            />
            {areas.map((a) => (
              <Chip
                key={a}
                testID={`area-chip-${a}`}
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

        {/* Lights & Switches */}
        <Surface variant="warm" radius="xl" padding="lg" style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.title.fontSize, fontWeight: "700" }}>Lights & Switches</Text>
              {domainLights.length > 0 ? (
                <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, marginTop: 2 }}>
                  {onCount} on of {domainLights.length}{area !== "all" ? ` in ${area}` : ""}
                </Text>
              ) : null}
            </View>
            {isParent && onCount > 0 ? (
              <SoftButton size="sm" variant="secondary" onPress={() => void turnAllOff()} testID="all-lights-off">
                All Lights Off
              </SoftButton>
            ) : null}
          </View>
          {domainLights.length === 0 ? (
            <EmptyState flat icon="💡" title="No lights found" body="Connect lights or smart outlets to Home Assistant to control them here." />
          ) : (
            <View style={{ gap: 10 }}>
              {domainLights.map((l) => {
                const isOn = l.state === "on";
                const canDim = supportsBrightness(l);
                const canTemp = supportsColorTemp(l);
                const isTunable = canDim || canTemp;
                const showControls = isTunable && (isOn || Boolean(expandedLights[l.entity_id]));
                const pct = lightBrightnessPct(l);
                const kelvin = lightColorTempKelvin(l);
                const roomName = resolveEntityArea(l);
                const isOutlet = l.entity_id.startsWith("switch.");
                const metaParts = [roomName, isOn ? "On" : "Off"];
                if (isOn && canDim) metaParts.push(`${pct}%`);
                if (isOn && canTemp) metaParts.push(`${kelvin}K`);

                return (
                  <View
                    key={l.entity_id}
                    testID={`light-card-${l.entity_id}`}
                    style={{
                      padding: 14,
                      borderRadius: 18,
                      backgroundColor: colors["color-surface-2"],
                      borderWidth: 1,
                      borderColor: isOn ? mix(accentColor, "transparent", 65) : colors["color-border"],
                      gap: 12,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }} numberOfLines={1}>
                          {isOutlet ? "🔌 " : "💡 "}
                          {friendlyName(l)}
                        </Text>
                        <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, marginTop: 2 }} numberOfLines={1}>
                          {metaParts.join(" · ")}
                        </Text>
                      </View>
                      {isTunable && !isOn ? (
                        <Chip
                          as="button"
                          size="md"
                          tone="neutral"
                          selected={Boolean(expandedLights[l.entity_id])}
                          onPress={() =>
                            setExpandedLights((prev) => ({ ...prev, [l.entity_id]: !prev[l.entity_id] }))
                          }
                          label={expandedLights[l.entity_id] ? "Hide" : "Tune"}
                        />
                      ) : null}
                      <Toggle
                        value={isOn}
                        onChange={() => { if (isParent) void toggleLight(l.entity_id); }}
                        disabled={!isParent}
                        accessibilityLabel={`Toggle ${friendlyName(l)}`}
                      />
                    </View>

                    {showControls ? (
                      <View style={{ gap: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors["color-border"] }}>
                        {canDim ? (
                          <View style={{ gap: 8 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                              <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
                                Brightness · {pct}%
                              </Text>
                            </View>
                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                              <Pressable
                                testID={`brightness-dec-${l.entity_id}`}
                                accessibilityRole="button"
                                accessibilityLabel={`Decrease brightness for ${friendlyName(l)}`}
                                disabled={!isParent}
                                onPress={() => void setLightBrightness(l, Math.max(5, pct - 10))}
                                style={{
                                  minHeight: MIN_TARGET_DP,
                                  minWidth: MIN_TARGET_DP,
                                  paddingHorizontal: 14,
                                  borderRadius: 16,
                                  alignItems: "center",
                                  justifyContent: "center",
                                  backgroundColor: colors["color-surface-3"],
                                  opacity: isParent ? 1 : 0.5,
                                }}
                              >
                                <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>−10%</Text>
                              </Pressable>
                              {BRIGHTNESS_PRESETS.map((preset) => {
                                const active = isOn && Math.abs(pct - preset) <= 4;
                                return (
                                  <Chip
                                    key={preset}
                                    testID={`brightness-${l.entity_id}-${preset}`}
                                    as="button"
                                    size="md"
                                    tone="accent"
                                    selected={active}
                                    disabled={!isParent}
                                    onPress={() => void setLightBrightness(l, preset)}
                                    label={`${preset}%`}
                                  />
                                );
                              })}
                              <Pressable
                                testID={`brightness-inc-${l.entity_id}`}
                                accessibilityRole="button"
                                accessibilityLabel={`Increase brightness for ${friendlyName(l)}`}
                                disabled={!isParent}
                                onPress={() => void setLightBrightness(l, Math.min(100, pct + 10))}
                                style={{
                                  minHeight: MIN_TARGET_DP,
                                  minWidth: MIN_TARGET_DP,
                                  paddingHorizontal: 14,
                                  borderRadius: 16,
                                  alignItems: "center",
                                  justifyContent: "center",
                                  backgroundColor: colors["color-surface-3"],
                                  opacity: isParent ? 1 : 0.5,
                                }}
                              >
                                <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>+10%</Text>
                              </Pressable>
                            </View>
                          </View>
                        ) : null}

                        {canTemp ? (
                          <View style={{ gap: 8 }}>
                            <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
                              Color Temp · {kelvin}K
                            </Text>
                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                              {COLOR_TEMP_PRESETS.map((preset) => {
                                const active = isOn && Math.abs(kelvin - preset.kelvin) <= 220;
                                return (
                                  <Chip
                                    key={preset.kelvin}
                                    testID={`colortemp-${l.entity_id}-${preset.kelvin}`}
                                    as="button"
                                    size="md"
                                    tone="neutral"
                                    selected={active}
                                    disabled={!isParent}
                                    onPress={() => void setLightColorTemp(l, preset.kelvin)}
                                    icon={
                                      <View
                                        style={{
                                          width: 14,
                                          height: 14,
                                          borderRadius: 7,
                                          backgroundColor: colors[preset.token] ?? accentColor,
                                        }}
                                      />
                                    }
                                    label={`${preset.label} · ${preset.kelvin}K`}
                                  />
                                );
                              })}
                            </View>
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                );
              })}
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
            {activeOpenSensors.length === 0 ? (
              <Chip as="span" size="sm" tone="success" label="Doors & windows closed" />
            ) : (
              activeOpenSensors.map((s) => (
                <Chip key={s.entity_id} as="span" size="sm" tone="danger" label={friendlyName(s)} />
              ))
            )}
          </View>

          {doorSensors.length > 0 ? (
            <View style={{ marginTop: 14, gap: 8 }}>
              <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
                DOORS & WINDOWS ({doorSensors.length})
              </Text>
              {doorSensors.map((s) => {
                const isOpen = s.state === "on";
                const simSwitchId = findSimSwitch(s, states);
                const icon = s.attributes?.device_class === "window" ? "🪟 " : "🚪 ";
                return (
                  <View
                    key={s.entity_id}
                    testID={`sensor-row-${s.entity_id}`}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      padding: 12,
                      borderRadius: 16,
                      backgroundColor: colors["color-surface-2"],
                    }}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "600" }} numberOfLines={1}>
                        {icon}
                        {friendlyName(s)}
                      </Text>
                      <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize }}>
                        {resolveEntityArea(s)}
                      </Text>
                    </View>
                    <Chip
                      as="span"
                      size="sm"
                      tone={isOpen ? "danger" : "success"}
                      label={isOpen ? "Open" : "Closed"}
                    />
                    {isParent && simSwitchId ? (
                      <SoftButton
                        size="sm"
                        variant={isOpen ? "danger" : "secondary"}
                        testID={`sim-sensor-${s.entity_id}`}
                        onPress={() => void simulateSensor(s)}
                      >
                        {isOpen ? "Simulate Close" : "Simulate Open"}
                      </SoftButton>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : null}

          {motionList.length > 0 ? (
            <View style={{ marginTop: 14, gap: 8 }}>
              <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
                MOTION SENSORS ({motionList.length})
              </Text>
              {motionList.map((s) => {
                const isMotion = s.state === "on";
                const simSwitchId = findSimSwitch(s, states);
                return (
                  <View
                    key={s.entity_id}
                    testID={`sensor-row-${s.entity_id}`}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      padding: 12,
                      borderRadius: 16,
                      backgroundColor: colors["color-surface-2"],
                    }}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "600" }} numberOfLines={1}>
                        {isMotion ? "🏃 " : "🟢 "}
                        {friendlyName(s)}
                      </Text>
                      <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize }}>
                        {resolveEntityArea(s)}
                      </Text>
                    </View>
                    <Chip
                      as="span"
                      size="sm"
                      tone={isMotion ? "warning" : "neutral"}
                      label={isMotion ? "Motion" : "Clear"}
                    />
                    {isParent && simSwitchId ? (
                      <SoftButton
                        size="sm"
                        variant={isMotion ? "danger" : "secondary"}
                        testID={`sim-sensor-${s.entity_id}`}
                        onPress={() => void simulateSensor(s)}
                      >
                        {isMotion ? "Simulate Clear" : "Simulate Motion"}
                      </SoftButton>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : null}
        </Surface>

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
