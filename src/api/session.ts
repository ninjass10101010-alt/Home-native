import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const KEY = "consuela_session"; // cookie NAME — value is an opaque server token

let inMemory: string | null = null;

/** The session cookie value for request injection (in-memory first). */
export function getSessionCookie(): string | null {
  return inMemory;
}

/** Persist only the session cookie value (SecureStore is encrypted, device-local). */
export async function saveSessionCookie(value: string): Promise<void> {
  inMemory = value;
  await SecureStore.setItemAsync(KEY, value).catch(() => {});
}

export async function loadSessionCookie(): Promise<string | null> {
  if (inMemory) return inMemory;
  try {
    inMemory = await SecureStore.getItemAsync(KEY);
  } catch {
    inMemory = null;
  }
  if (!inMemory && typeof __DEV__ !== "undefined" && __DEV__ && typeof jest === "undefined") {
    try {
      inMemory = await AsyncStorage.getItem(KEY);
    } catch {
      inMemory = null;
    }
  }
  return inMemory;
}

export async function clearSessionCookie(): Promise<void> {
  inMemory = null;
  await SecureStore.deleteItemAsync(KEY).catch(() => {});
  if (typeof __DEV__ !== "undefined" && __DEV__ && typeof jest === "undefined") {
    await AsyncStorage.removeItem(KEY).catch(() => {});
  }
}

/** Parse the consuela_session value out of a response's Set-Cookie header(s).
 *  RN exposes set-cookie via headers.get("set-cookie") (split on ", " before
 *  the cookie pair line where expires commas exist — we only need the pair). */
export function readSetCookie(res: {
  headers: { get(name: string): string | null };
}): string | null {
  const raw = res.headers.get("set-cookie");
  if (!raw) return null;
  const m = raw.match(/consuela_session=([^;]*)/);
  return m ? m[1] : null;
}

/** Test hook. */
export function _resetSessionCookieCache() {
  inMemory = null;
}
