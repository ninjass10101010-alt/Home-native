import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "consuela-base-url";
export const DEFAULT_BASE_URL = "http://nas.local:3000";

/**
 * Candidate LAN base URLs tried automatically at runtime when the default
 * mDNS hostname (`nas.local`) cannot be resolved by Android's DNS resolver.
 */
export const LAN_BASE_URLS: readonly string[] = [
  "http://192.168.0.28:3000",
  "http://nas.local:3000",
  "http://192.168.0.12:3000",
];

let cached: string | null = null;
const listeners = new Set<(url: string) => void>();

function notifyListeners(url: string) {
  listeners.forEach((fn) => {
    try {
      fn(url);
    } catch {
      /* ignore listener errors */
    }
  });
}

export function onBaseUrlChange(listener: (url: string) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The LAN base URL of the Home-ai API server (NAS). */
export function getBaseUrl(): string {
  if (cached) return cached;
  return typeof jest !== "undefined" ? DEFAULT_BASE_URL : LAN_BASE_URLS[0];
}

async function probeReachable(baseUrl: string, timeoutMs = 1500): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}/api/auth/whoami`, {
      method: "GET",
      signal: ctrl.signal,
    });
    return res.status > 0;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function hydrateBaseUrl(): Promise<void> {
  let stored: string | null = null;
  try {
    const v = await AsyncStorage.getItem(KEY);
    if (v) {
      const cleaned = v.replace(/\/+$/, "");
      const isLoopback =
        typeof jest === "undefined" &&
        (cleaned.includes("10.0.2.2") || cleaned.includes("localhost") || cleaned.includes("127.0.0.1"));
      if (!isLoopback) {
        stored = cleaned;
        cached = stored;
      }
    }
  } catch {
    /* unreadable prefs → default */
  }

  if (typeof jest !== "undefined") return;

  const candidates = stored
    ? [stored, ...LAN_BASE_URLS.filter((u) => u !== stored)]
    : [...LAN_BASE_URLS];

  for (const candidate of candidates) {
    if (await probeReachable(candidate)) {
      const prev = getBaseUrl();
      cached = candidate;
      await AsyncStorage.setItem(KEY, candidate).catch(() => {});
      if (candidate !== prev) notifyListeners(candidate);
      return;
    }
  }
}

export async function setBaseUrl(url: string): Promise<void> {
  const normalized = url.trim().replace(/\/+$/, "") || DEFAULT_BASE_URL;
  const prev = cached;
  cached = normalized;
  await AsyncStorage.setItem(KEY, normalized).catch(() => {});
  if (normalized !== prev) notifyListeners(normalized);
}

/** Test hook: reset the in-memory cache (then hydrateBaseUrl()). */
export function _resetBaseUrlCache() {
  cached = null;
}
