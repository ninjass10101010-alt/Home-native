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
// Stand-in roster for the SIGNED-OUT last resort only (no live, no cache).
// This repo's remote is public-ish — the family's real names live only on the
// NAS (live rows / device cache), never in committed source. Rows carry NO
// credentials (that file's SECURITY note) and NO real names/ages.
export const FALLBACK_MEMBERS: ServerMember[] = [
  { id: 1, name: "Mom", role: "parent", emoji: "🐱" } as ServerMember,
  { id: 2, name: "Dad", role: "parent", emoji: "👨" } as ServerMember,
  { id: 3, name: "Child 1", role: "child", emoji: "👧" } as ServerMember,
  { id: 4, name: "Child 2", role: "child", emoji: "👧" } as ServerMember,
  { id: 5, name: "Child 3", role: "child", emoji: "👧" } as ServerMember,
  { id: 6, name: "Child 4", role: "child", emoji: "👧" } as ServerMember,
  { id: 7, name: "Child 5", role: "child", emoji: "🧒" } as ServerMember,
  { id: 8, name: "Pet 1", role: "pet", emoji: "🐶" } as ServerMember,
  { id: 9, name: "Pet 2", role: "pet", emoji: "🐩" } as ServerMember,
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
  /**
   * Why the live read failed, when it did. This is the ONE honest split the
   * rail needs: "signed-out" (the device is fine, the roster is the cache —
   * the family wall's normal state) must never be reported as "unreachable".
   * Undefined on the live path.
   */
  reason?: "signed-out" | "unreachable";
}

/** The roster for the rail: live → cache → stand-in fallbacks (never throws).
 *
 *  `reason` is what the catch branch actually saw — it is the ONLY place the
 *  app can tell a signed-out session (an EXPECTED 401 on this device) from an
 *  unreachable NAS. The signed-out wall must never claim to be offline: the
 *  rail reads its cache on purpose, and saying "offline" there asserts a
 *  network fault that does not exist (web parity: SyncStatusBanner shows the
 *  amber "Signed out" state and never an offline state for a 401). */
export async function listMembersSmart(): Promise<MembersResult> {
  try {
    const live = await listMembersLive();
    const cleaned = (live || [])
      .filter((m) => (m.name || "").trim())
      .map((m) => (typeof m.id === "string" && !m.pbId ? { ...m, pbId: m.id } : m));
    if (cleaned.length) await writeCachedMembers(cleaned);
    // Live rows win outright — stand-ins are the LAST resort and must never
    // be appended beside the real roster (their names can't match it).
    return { members: cleaned, source: "live" };
  } catch (e: any) {
    const reason: "signed-out" | "unreachable" =
      e instanceof ApiError && e.status === 401 ? "signed-out" : "unreachable";
    const cached = await readCachedMembers();
    if (cached.length) return { members: cached, source: "cache", reason };
    return { members: FALLBACK_MEMBERS.map((m) => ({ ...m })), source: "fallback", reason };
  }
}
