import React, { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "../../api/client";

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

let sharedStates: HAState[] = [];
let sharedError: string | null = null;
let sharedLoaded = false;
let lastFetchAt = 0;
let fetchInFlight = false;

const subscribers = new Set<() => void>();
const MIN_REFETCH_GAP_MS = 5_000;

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
      sharedStates = Array.isArray(res.states) ? res.states : [];
      sharedError = null;
    }
  } catch (e) {
    sharedError = e instanceof ApiError ? e.message : String(e);
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
    void fetchStates(); // mount: fetch if stale (gap guard applies)
    return () => {
      mounted.current = false;
      subscribers.delete(onChange);
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

/** Test hook: reset the module store. */
export function _resetHAStore() {
  sharedStates = [];
  sharedError = null;
  sharedLoaded = false;
  lastFetchAt = 0;
  fetchInFlight = false;
  subscribers.clear();
}
