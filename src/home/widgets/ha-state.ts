import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type NativeEventSubscription } from "react-native";
import { api, ApiError } from "../../api/client";
import { getSessionCookie } from "../../api/session";

/**
 * Port of Home-ai src/hooks/useHAState.ts: ONE module-level fetcher/poller
 * serves every consumer — three wall widgets share a single /api/ha/sync
 * call instead of hammering it 3× per refresh. Honesty: shared error + the
 * honest empty states flow from one place.
 */
export interface HAState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_updated: string;
}

interface OptimisticOverride {
  state?: string;
  attributes?: Record<string, unknown>;
  expiresAt: number;
}

let sharedStates: HAState[] = [];
let sharedError: string | null = null;
let sharedLoaded = false;
let lastFetchAt = 0;
let fetchInFlight = false;

const subscribers = new Set<() => void>();
const pendingOptimistic = new Map<string, OptimisticOverride>();
const settleTimers = new Set<ReturnType<typeof setTimeout>>();

const MIN_REFETCH_GAP_MS = 5_000;
const POLL_INTERVAL_MS = 15_000;
const OPTIMISTIC_TTL_MS = 6_000;
const SETTLE_DELAYS_MS = [1_200, 3_000, 6_200] as const;

let pollTimer: ReturnType<typeof setInterval> | null = null;
let appStateSub: NativeEventSubscription | null = null;

function clearSettleTimers(): void {
  for (const t of Array.from(settleTimers)) {
    clearTimeout(t);
  }
  settleTimers.clear();
}

function attributesMatch(
  serverAttrs: Record<string, unknown> | undefined,
  expectedAttrs: Record<string, unknown>
): boolean {
  for (const [k, v] of Object.entries(expectedAttrs)) {
    if (serverAttrs?.[k] !== v) return false;
  }
  return true;
}

function reconcileIncomingStates(incoming: HAState[]): HAState[] {
  if (pendingOptimistic.size === 0) return incoming;
  const now = Date.now();
  return incoming.map((s) => {
    const pend = pendingOptimistic.get(s.entity_id);
    if (!pend) return s;
    const stateMatches = pend.state === undefined || s.state === pend.state;
    const attrsMatch = !pend.attributes || attributesMatch(s.attributes, pend.attributes);
    if (now >= pend.expiresAt || (stateMatches && attrsMatch)) {
      pendingOptimistic.delete(s.entity_id);
      return s;
    }
    const mergedAttrs = pend.attributes
      ? { ...s.attributes, ...pend.attributes }
      : s.attributes;
    return {
      ...s,
      ...(pend.state !== undefined ? { state: pend.state } : {}),
      attributes: mergedAttrs,
    };
  });
}

function ensureStoreLoop(): void {
  if (!pollTimer) {
    pollTimer = setInterval(() => {
      void fetchStates();
    }, POLL_INTERVAL_MS);
  }
  if (typeof jest === "undefined" && !appStateSub && typeof AppState?.addEventListener === "function") {
    appStateSub = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        void fetchStates(true);
      }
    });
  }
}

function teardownStoreLoopIfIdle(): void {
  if (subscribers.size > 0) return;
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  clearSettleTimers();
  if (appStateSub) {
    appStateSub.remove();
    appStateSub = null;
  }
}

function notifySubscribers(): void {
  for (const fn of Array.from(subscribers)) {
    try {
      fn();
    } catch {
      /* one bad subscriber must not break the rest */
    }
  }
}

async function fetchStates(force = false): Promise<void> {
  if (fetchInFlight) return;
  if (!force && Date.now() - lastFetchAt < MIN_REFETCH_GAP_MS) return;
  fetchInFlight = true;
  try {
    const res = await api<{ success: boolean; count: number; states: HAState[] }>("/api/ha/sync", {
      method: "POST",
    });
    if (!res || res.success !== true) {
      sharedError = "Home Assistant sync failed";
    } else {
      const raw = Array.isArray(res.states) ? res.states : [];
      sharedStates = reconcileIncomingStates(raw);
      sharedError = null;
    }
  } catch (e) {
    if (
      (e instanceof ApiError && e.status === 401) ||
      (typeof jest === "undefined" && !getSessionCookie())
    ) {
      // Signed-out wall: /api/ha/* is session-gated. The VERIFIED reference
      // contract (docs/wave1-endpoints.md): a guest gets the honest EMPTY
      // states ("No presence data yet" / "No climate data" / "No lights
      // found"), never an error card that re-401s forever.
      sharedStates = [];
      sharedError = null;
    } else {
      sharedError = e instanceof ApiError ? e.message : String(e);
    }
  } finally {
    fetchInFlight = false;
    lastFetchAt = Date.now();
    sharedLoaded = true;
    notifySubscribers();
  }
}

export interface UseHAState {
  states: HAState[];
  loaded: boolean;
  error: string | null;
  refresh: () => void;
}

export function useHAState(): UseHAState {
  const [, force] = useState(0);
  const mounted = useRef(true);
  const onChange = useCallback(() => {
    if (mounted.current) force((n) => n + 1);
  }, []);

  useEffect(() => {
    mounted.current = true;
    subscribers.add(onChange);
    ensureStoreLoop(); // web store-loop parity: poll while anyone watches
    void fetchStates(); // mount: fetch if stale (gap guard applies)
    return () => {
      mounted.current = false;
      subscribers.delete(onChange);
      teardownStoreLoopIfIdle(); // the wall sleeps when no widget watches
    };
  }, [onChange]);

  return {
    states: sharedStates,
    loaded: sharedLoaded,
    error: sharedError,
    refresh: () => void fetchStates(true),
  };
}

/** Domain helpers (web useHAState parity). */
export function entitiesByDomain(states: HAState[], domain: string): HAState[] {
  return states.filter((s) => s.entity_id.startsWith(`${domain}.`));
}

const SYSTEM_SWITCH_PREFIXES = [
  "switch.demo_sim_",
  "switch.unifi_",
  "switch.usw_",
  "switch.cloud_gateway_",
  "switch.samba_share",
  "switch.mosquitto_broker",
  "switch.terminal_ssh",
  "switch.piper",
  "switch.whisper",
  "switch.ssh_",
];

const SYSTEM_SWITCH_PARTS = [
  "_poe",
  "_dns",
  "_enabled",
  "_pre_release",
  "_child_lock",
  "_nightlight",
  "_sync_send",
  "_sync_receive",
  "_audio_reactive",
  "_reverse",
  "_freeze",
];

/** True for real/demo lighting entities and household outlet/light switches (excludes UniFi/HA/sim switches). */
export function isControllableLightOrSwitch(s: HAState): boolean {
  const id = s.entity_id.toLowerCase();
  if (id.startsWith("light.")) return true;
  if (!id.startsWith("switch.")) return false;
  if (SYSTEM_SWITCH_PREFIXES.some((p) => id.startsWith(p))) return false;
  if (SYSTEM_SWITCH_PARTS.some((p) => id.includes(p))) return false;
  return true;
}

/** Controlled lights: all light.* entities + outlet/light switches (or all clean switches if zero light.* exist). */
export function controllableLights(states: HAState[]): HAState[] {
  const clean = states.filter(isControllableLightOrSwitch);
  const lights = clean.filter((s) => s.entity_id.startsWith("light."));
  const switches = clean.filter((s) => s.entity_id.startsWith("switch."));
  if (lights.length > 0) {
    const lightLikeSwitches = switches.filter((s) => {
      const id = s.entity_id.toLowerCase();
      return s.attributes?.device_class === "outlet" || id.includes("light") || id.includes("lamp");
    });
    return [...lights, ...lightLikeSwitches];
  }
  return switches;
}

export function formatAreaName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "Other";
  if (!trimmed.includes("_") && !trimmed.includes("-") && /[A-Z]/.test(trimmed[0])) {
    return trimmed;
  }
  return trimmed
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

const AREA_KEYWORDS: [string, string][] = [
  ["kitchen", "Kitchen"],
  ["living_room", "Living Room"],
  ["living room", "Living Room"],
  ["livingroom", "Living Room"],
  ["bedroom", "Bedroom"],
  ["office", "Office"],
  ["basement", "Basement"],
  ["bathroom", "Bathroom"],
  ["hallway", "Hallway"],
  ["hall", "Hallway"],
  ["front_door", "Living Room"],
  ["entry", "Entry"],
  ["porch", "Outside"],
  ["patio", "Outside"],
  ["garage", "Garage"],
];

/** Resolve a human-readable room name matching HA Areas. */
export function resolveEntityArea(s: HAState): string {
  const attrArea = s.attributes?.area_id;
  if (typeof attrArea === "string" && attrArea.trim().length > 0) {
    return formatAreaName(attrArea);
  }
  const idPart = (s.entity_id.split(".")[1] ?? "").toLowerCase();
  const friendly = typeof s.attributes?.friendly_name === "string" ? s.attributes.friendly_name.toLowerCase() : "";
  for (const [kw, label] of AREA_KEYWORDS) {
    if (idPart.includes(kw) || friendly.includes(kw)) {
      return label;
    }
  }
  return "Other";
}

export function doorWindowSensors(states: HAState[]): HAState[] {
  return states.filter(
    (s) =>
      s.entity_id.startsWith("binary_sensor.") &&
      (s.attributes?.device_class === "door" || s.attributes?.device_class === "window")
  );
}

export function motionSensors(states: HAState[]): HAState[] {
  return states.filter(
    (s) => s.entity_id.startsWith("binary_sensor.") && s.attributes?.device_class === "motion"
  );
}

const BRIGHTNESS_MODES = new Set(["brightness", "color_temp", "hs", "xy", "rgb", "rgbw", "rgbww"]);
const COLOR_TEMP_MODES = new Set(["color_temp", "rgbww"]);

export function supportsBrightness(s: HAState): boolean {
  if (!s.entity_id.startsWith("light.")) return false;
  if (typeof s.attributes?.brightness === "number") return true;
  const modes = s.attributes?.supported_color_modes;
  return Array.isArray(modes) && modes.some((m) => typeof m === "string" && BRIGHTNESS_MODES.has(m));
}

export function supportsColorTemp(s: HAState): boolean {
  if (!s.entity_id.startsWith("light.")) return false;
  if (typeof s.attributes?.color_temp_kelvin === "number" || typeof s.attributes?.color_temp === "number") {
    return true;
  }
  const modes = s.attributes?.supported_color_modes;
  return Array.isArray(modes) && modes.some((m) => typeof m === "string" && COLOR_TEMP_MODES.has(m));
}

export function lightBrightnessPct(s: HAState): number {
  if (typeof s.attributes?.brightness_pct === "number") {
    return Math.max(0, Math.min(100, Math.round(s.attributes.brightness_pct)));
  }
  if (typeof s.attributes?.brightness === "number") {
    return Math.max(0, Math.min(100, Math.round((s.attributes.brightness / 255) * 100)));
  }
  return s.state === "on" ? 100 : 0;
}

export function lightColorTempKelvin(s: HAState): number {
  if (typeof s.attributes?.color_temp_kelvin === "number") {
    return Math.round(s.attributes.color_temp_kelvin);
  }
  if (typeof s.attributes?.color_temp === "number" && s.attributes.color_temp > 0) {
    return Math.round(1_000_000 / s.attributes.color_temp);
  }
  return 3000;
}

/** Web OPEN_SENSOR_CLASSES (HomeSecurityWidget.tsx:7). */
const OPEN_SENSOR_CLASSES = new Set(["door", "window", "motion", "smoke", "gas", "moisture"]);

export function openSensors(states: HAState[]): HAState[] {
  return states.filter(
    (s) =>
      s.entity_id.startsWith("binary_sensor.") &&
      s.state === "on" &&
      typeof s.attributes?.device_class === "string" &&
      OPEN_SENSOR_CLASSES.has(s.attributes.device_class as string)
  );
}

export function alarmPanel(states: HAState[]): HAState | undefined {
  return states.find((s) => s.entity_id.startsWith("alarm_control_panel."));
}

export function lightGlyphFor(s: HAState): string {
  const id = s.entity_id.toLowerCase();
  const friendly =
    typeof s.attributes?.friendly_name === "string" ? s.attributes.friendly_name.toLowerCase() : "";
  if (id.includes("plant") || friendly.includes("plant")) return "🪴";
  if (id.includes("wled") || friendly.includes("wled") || id.includes("strip") || friendly.includes("led")) {
    return "✨";
  }
  if (id.startsWith("switch.")) return "🔌";
  return "💡";
}

export function sortLightsForDisplay(lights: HAState[]): HAState[] {
  return lights
    .map((item, idx) => ({ item, idx }))
    .sort((a, b) => {
      const aTest = a.item.entity_id === "light.test_light_delete_me";
      const bTest = b.item.entity_id === "light.test_light_delete_me";
      if (aTest !== bTest) return aTest ? 1 : -1;
      const aOn = a.item.state === "on";
      const bOn = b.item.state === "on";
      if (aOn !== bOn) return aOn ? -1 : 1;
      return a.idx - b.idx;
    })
    .map((entry) => entry.item);
}

/** Immutably apply an optimistic patch to one entity's state with a protective TTL
 *  so cloud-backed switches (e.g. Tuya) don't snap back on early refreshes. */
export function applyOptimisticHA(
  entityId: string,
  patch: Partial<HAState>,
  ttlMs = OPTIMISTIC_TTL_MS
): void {
  const prev = pendingOptimistic.get(entityId);
  const patchAttrs =
    patch && patch.attributes && typeof patch.attributes === "object" && !Array.isArray(patch.attributes)
      ? (patch.attributes as Record<string, unknown>)
      : undefined;
  pendingOptimistic.set(entityId, {
    state: patch.state !== undefined ? patch.state : prev?.state,
    attributes: patchAttrs ? { ...(prev?.attributes ?? {}), ...patchAttrs } : prev?.attributes,
    expiresAt: Date.now() + ttlMs,
  });

  sharedStates = sharedStates.map((s) => {
    if (s.entity_id !== entityId) return s;
    const mergedAttrs = patchAttrs ? { ...s.attributes, ...patchAttrs } : s.attributes;
    return { ...s, ...patch, attributes: mergedAttrs };
  });
  notifySubscribers();
}

export function clearOptimisticHA(entityId: string): void {
  pendingOptimistic.delete(entityId);
}

export function scheduleHASettleRefresh(): void {
  clearSettleTimers();
  for (const delay of SETTLE_DELAYS_MS) {
    const t = setTimeout(() => {
      settleTimers.delete(t);
      if (pendingOptimistic.size === 0 || subscribers.size === 0) return;
      void fetchStates(true);
    }, delay);
    settleTimers.add(t);
  }
}

/** Re-fetch the HA states (force) and emit the result to subscribers. */
export async function refreshHAState(): Promise<void> {
  await fetchStates(true);
}

/** Test hook: reset the module store. */
export function _resetHAStore() {
  sharedStates = [];
  sharedError = null;
  sharedLoaded = false;
  lastFetchAt = 0;
  fetchInFlight = false;
  pendingOptimistic.clear();
  clearSettleTimers();
  subscribers.clear();
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (appStateSub) {
    appStateSub.remove();
    appStateSub = null;
  }
}
