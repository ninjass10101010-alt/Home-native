/**
 * The Home-side idle rule that settles the wall into /screensaver (WS-8).
 * Pure decision functions so the wiring in app/index.tsx stays obvious
 * expressions, and the rules themselves are unit-tested without mounting the wall.
 *
 * Supports scheduled screensaver windows (e.g. night-only: 11:00 PM – 4:00 AM)
 * so the family dashboard widgets stay visible throughout the day and auto-wake
 * in the morning.
 */

import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

/** Quiet time before the Home wall hands over to the ambient board. */
export const SCREENSAVER_IDLE_MS = 90_000;
/** How often the Home route re-checks the quiet clock. */
export const IDLE_CHECK_MS = 5_000;

export const SCREENSAVER_PREFS_STORAGE_KEY = "consuela-screensaver-prefs";
export const LEGACY_SCREENSAVER_STORAGE_KEY = "consuela-screensaver-enabled";

export type ScreensaverMode = "always" | "night" | "off";

export interface ScreensaverPrefs {
  /** "always": idles anytime; "night": idles only during night window; "off": never */
  mode: ScreensaverMode;
  /** Start hour for night window (0-23), default 23 (11:00 PM) */
  startHour: number;
  /** End hour for night window (0-23), default 4 (4:00 AM) */
  endHour: number;
}

export const DEFAULT_SCREENSAVER_PREFS: ScreensaverPrefs = {
  mode: "always",
  startHour: 23, // 11:00 PM
  endHour: 4,   // 4:00 AM
};

type PrefsListener = (prefs: ScreensaverPrefs) => void;
const listeners = new Set<PrefsListener>();

let memoryCachedPrefs: ScreensaverPrefs = { ...DEFAULT_SCREENSAVER_PREFS };
let hydrated = false;

export function _resetScreensaverMemoryForTest(defaultPrefs?: Partial<ScreensaverPrefs>): void {
  memoryCachedPrefs = { ...DEFAULT_SCREENSAVER_PREFS, ...(defaultPrefs ?? {}) };
  hydrated = true;
  listeners.clear();
}

/** Formats an hour integer (0-23) into "11:00 PM", "4:00 AM", etc. */
export function formatHour(hour: number): string {
  const normalized = ((hour % 24) + 24) % 24;
  const h = normalized % 12 || 12;
  const ampm = normalized < 12 ? "AM" : "PM";
  return `${h}:00 ${ampm}`;
}

/** Checks whether a given hour falls inside a [startHour, endHour) window (supports spanning midnight). */
export function isHourInWindow(hour: number, startHour: number, endHour: number): boolean {
  const normHour = ((hour % 24) + 24) % 24;
  const normStart = ((startHour % 24) + 24) % 24;
  const normEnd = ((endHour % 24) + 24) % 24;

  if (normStart === normEnd) return true; // 24-hour window
  if (normStart < normEnd) {
    return normHour >= normStart && normHour < normEnd;
  }
  // Window spans midnight, e.g. 23 (11 PM) to 4 (4 AM)
  return normHour >= normStart || normHour < normEnd;
}

/** Determines whether the screensaver is permitted to trigger at the current date/time. */
export function isScreensaverDueNow(prefs: ScreensaverPrefs, date = new Date()): boolean {
  if (prefs.mode === "off") return false;
  if (prefs.mode === "always") return true;
  if (prefs.mode === "night") {
    return isHourInWindow(date.getHours(), prefs.startHour, prefs.endHour);
  }
  return true;
}

/**
 * Load screensaver preferences from AsyncStorage, migrating legacy keys if present.
 */
export async function loadScreensaverPrefs(): Promise<ScreensaverPrefs> {
  try {
    const raw = await AsyncStorage.getItem(SCREENSAVER_PREFS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ScreensaverPrefs>;
      const merged: ScreensaverPrefs = {
        mode:
          parsed.mode === "always" || parsed.mode === "night" || parsed.mode === "off"
            ? parsed.mode
            : DEFAULT_SCREENSAVER_PREFS.mode,
        startHour:
          typeof parsed.startHour === "number" && parsed.startHour >= 0 && parsed.startHour <= 23
            ? parsed.startHour
            : DEFAULT_SCREENSAVER_PREFS.startHour,
        endHour:
          typeof parsed.endHour === "number" && parsed.endHour >= 0 && parsed.endHour <= 23
            ? parsed.endHour
            : DEFAULT_SCREENSAVER_PREFS.endHour,
      };
      memoryCachedPrefs = merged;
      hydrated = true;
      return merged;
    }

    // Check legacy key
    const legacy = await AsyncStorage.getItem(LEGACY_SCREENSAVER_STORAGE_KEY);
    if (legacy !== null) {
      const isEnabled = legacy === "1" || legacy === "true";
      const merged: ScreensaverPrefs = {
        ...DEFAULT_SCREENSAVER_PREFS,
        mode: isEnabled ? "always" : "off",
      };
      memoryCachedPrefs = merged;
      hydrated = true;
      return merged;
    }

    memoryCachedPrefs = { ...DEFAULT_SCREENSAVER_PREFS };
    hydrated = true;
    return memoryCachedPrefs;
  } catch {
    memoryCachedPrefs = { ...DEFAULT_SCREENSAVER_PREFS };
    hydrated = true;
    return memoryCachedPrefs;
  }
}

/**
 * Save screensaver preferences to AsyncStorage and notify listeners.
 */
export async function saveScreensaverPrefs(
  update: Partial<ScreensaverPrefs> | ((prev: ScreensaverPrefs) => ScreensaverPrefs)
): Promise<ScreensaverPrefs> {
  const next: ScreensaverPrefs =
    typeof update === "function" ? update(memoryCachedPrefs) : { ...memoryCachedPrefs, ...update };

  memoryCachedPrefs = next;
  hydrated = true;
  listeners.forEach((l) => l(next));

  try {
    await Promise.all([
      AsyncStorage.setItem(SCREENSAVER_PREFS_STORAGE_KEY, JSON.stringify(next)),
      AsyncStorage.setItem(
        LEGACY_SCREENSAVER_STORAGE_KEY,
        next.mode !== "off" ? "1" : "0"
      ),
    ]);
  } catch {
    // ignore
  }

  return next;
}

/** Hook for reading and updating full screensaver preferences. */
export function useScreensaverPrefs(): [
  ScreensaverPrefs,
  (update: Partial<ScreensaverPrefs> | ((prev: ScreensaverPrefs) => ScreensaverPrefs)) => void
] {
  const [prefs, setPrefsState] = useState<ScreensaverPrefs>(memoryCachedPrefs);

  useEffect(() => {
    let alive = true;
    if (!hydrated) {
      void loadScreensaverPrefs().then((v) => {
        if (alive) setPrefsState(v);
      });
    }

    const listener: PrefsListener = (v) => {
      if (alive) setPrefsState(v);
    };
    listeners.add(listener);
    return () => {
      alive = false;
      listeners.delete(listener);
    };
  }, []);

  const setPrefs = useCallback(
    (update: Partial<ScreensaverPrefs> | ((prev: ScreensaverPrefs) => ScreensaverPrefs)) => {
      void saveScreensaverPrefs(update);
    },
    []
  );

  return [prefs, setPrefs];
}

/** Backwards-compatible hook returning [enabled, setEnabled]. */
export function useScreensaverEnabled(): [boolean, (enabled: boolean) => void] {
  const [prefs, setPrefs] = useScreensaverPrefs();
  const enabled = prefs.mode !== "off";

  const setEnabled = useCallback(
    (next: boolean) => {
      setPrefs((prev) => ({
        ...prev,
        mode: next ? (prev.mode === "off" ? "always" : prev.mode) : "off",
      }));
    },
    [setPrefs]
  );

  return [enabled, setEnabled];
}

export async function loadScreensaverEnabled(): Promise<boolean> {
  const prefs = await loadScreensaverPrefs();
  return prefs.mode !== "off";
}

export async function setScreensaverEnabled(enabled: boolean): Promise<void> {
  await saveScreensaverPrefs((prev) => ({
    ...prev,
    mode: enabled ? (prev.mode === "off" ? "always" : prev.mode) : "off",
  }));
}

export interface IdleBoardArgs {
  /** Current route — the board only ever opens FROM Home. */
  pathname: string;
  /** Milliseconds since the family's last touch on the wall. */
  idleMs: number;
  /** True once the board has been pushed for this Home visit. */
  pushed: boolean;
  /** A modal flow is open (PIN pad, More… sheet): modal taps live in a
   *  separate window and the touch clock never sees them, so the wall MUST
   *  stand down instead of pushing the board mid-flow. */
  blocked: boolean;
  /** Whether the ambient screensaver is enabled/active at this moment (default: true). */
  enabled?: boolean;
}

export function idleBoardDue({
  pathname,
  idleMs,
  pushed,
  blocked,
  enabled = true,
}: IdleBoardArgs): boolean {
  return enabled && pathname === "/" && !pushed && !blocked && idleMs >= SCREENSAVER_IDLE_MS;
}
