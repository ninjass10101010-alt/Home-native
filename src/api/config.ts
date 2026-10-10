import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "consuela-base-url";
export const DEFAULT_BASE_URL = "http://nas.local:3000";

let cached: string | null = null;

/** The LAN base URL of the Home-ai API server (NAS). */
export function getBaseUrl(): string {
  return cached ?? DEFAULT_BASE_URL;
}

export async function hydrateBaseUrl(): Promise<void> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    if (v) cached = v;
  } catch {
    /* unreadable prefs → default */
  }
}

export async function setBaseUrl(url: string): Promise<void> {
  cached = url.replace(/\/+$/, "");
  await AsyncStorage.setItem(KEY, cached).catch(() => {});
}

/** Test hook: reset the in-memory cache (then hydrateBaseUrl()). */
export function _resetBaseUrlCache() {
  cached = null;
}
