import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, ApiError } from "./client";
import type { ServerMember } from "./types";

/**
 * The guest-roster truth (ported from ../Home-ai/src/db/index.ts:189-209 +
 * src/lib/member-fallback.ts): the rail must render even signed out, when
 * /api/members/admin 401s. Live route → AsyncStorage cache → built-in
 * fallbacks. Fallback rows carry NO credentials (that file's SECURITY note);
 * live rows win, fallbacks fill missing first names.
 */
// Verbatim port of ../Home-ai/src/lib/member-fallback.ts (no credentials; live
// rows win by first name). Fallback rows intentionally carry NO color — the
// rail resolves member colors via memberAccentHex (name → accent token).
export const FALLBACK_MEMBERS: ServerMember[] = [
  { id: 1, name: "Rebecca (Mom)", role: "parent", emoji: "🐱", age: 38 } as ServerMember,
  { id: 2, name: "Jeffery (Dad)", role: "parent", emoji: "👨", age: 40 } as ServerMember,
  { id: 3, name: "Emily", role: "child", emoji: "👧", age: 14 } as ServerMember,
  { id: 4, name: "Bailey", role: "child", emoji: "👧", age: 12 } as ServerMember,
  { id: 5, name: "Jasmine", role: "child", emoji: "👧", age: 10 } as ServerMember,
  { id: 6, name: "Aurora", role: "child", emoji: "👧", age: 7 } as ServerMember,
  { id: 7, name: "Caspian", role: "child", emoji: "🧒", age: 5 } as ServerMember,
  { id: 8, name: "Rocco", role: "pet", emoji: "🐶", age: 3 } as ServerMember,
  { id: 9, name: "Rico", role: "pet", emoji: "🐩", age: 5 } as ServerMember,
].map((m) => m);

const CACHE_KEY = "consuela-members";

/** Live rows win; fallbacks fill missing first names; blank-name rows dropped. */
export function mergeMemberFallbacks(live: ServerMember[]): ServerMember[] {
  const cleaned = (live || [])
    .filter((m) => (m.name || "").trim())
    .map((m) =>
      typeof m.id === "string" && !m.pbId ? { ...m, pbId: m.id } : m
    );
  const liveFirst = new Set(cleaned.map((m) => m.name.split(" ")[0].toLowerCase()));
  const missing = FALLBACK_MEMBERS.filter(
    (f) => !liveFirst.has(f.name.split(" ")[0].toLowerCase())
  );
  return [...cleaned, ...missing];
}

/** GET /api/members/admin?source=live → members (401 when signed out is EXPECTED). */
export async function listMembersLive(): Promise<ServerMember[]> {
  const res = await api<{ members: ServerMember[] }>("/api/members/admin?source=live");
  return Array.isArray(res.members) ? res.members : [];
}

/** Cached roster (AsyncStorage). */
export async function readCachedMembers(): Promise<ServerMember[]> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function writeCachedMembers(members: ServerMember[]): Promise<void> {
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(members)).catch(() => {});
}

export interface MembersResult {
  members: ServerMember[];
  /** "live" | "cache" | "fallback" — the rail badges anything that isn't live. */
  source: "live" | "cache" | "fallback";
}

/** The roster for the rail: live → cache → fallback (never throws). */
export async function listMembersSmart(): Promise<MembersResult> {
  try {
    const live = await listMembersLive();
    const merged = mergeMemberFallbacks(live);
    await writeCachedMembers(merged);
    return { members: merged, source: "live" };
  } catch (e: any) {
    if (e instanceof ApiError && e.status === 401) {
      // signed out — cache/fallback is the EXPECTED path, not an error
    } // unreachable also lands here; the badge covers both honestly
    const cached = await readCachedMembers();
    if (cached.length) return { members: mergeMemberFallbacks(cached), source: "cache" };
    return { members: FALLBACK_MEMBERS.map((m) => ({ ...m })), source: "fallback" };
  }
}
