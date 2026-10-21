import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, ApiError, fetchImpl } from "./client";
import { getBaseUrl } from "./config";
import { readSetCookie } from "./session";
import type { ServerMember } from "./types";

/**
 * The guest-roster truth (ported from ../Home-ai/src/db/index.ts:189-209 +
 * src/lib/member-fallback.ts): the rail must render even signed out, when
 * /api/members/admin 401s. Live route → AsyncStorage cache → built-in
 * fallbacks. Fallback rows carry NO credentials (that file's SECURITY note);
 * live rows win, fallbacks fill missing first names.
 */
// Stand-in roster for the SIGNED-OUT / UNREACHABLE last resort only (no live
// roster, no device cache). This repo's remote is public-ish — the family's
// real names live only on the NAS (live rows / device cache), never in
// committed source. Rows carry NO credentials (that file's SECURITY note) and
// NO real names/ages.
//
// HONESTY CONTRACT (the wall's): a stand-in roster must never READ as the
// family. Two rules, both learned the hard way:
//   1. every tile a DIFFERENT word. The rail prints the FIRST name only
//      (web parity), so "Child 1".."Child 5" all rendered as "Child" — five
//      identical tiles, and two more reading "Pet". The labels below are
//      single words, one per role, so no two tiles can ever read the same.
//   2. every tile its OWN accent. The web paints each member's ring/wash in
//      the member's colour (Avatar.tsx colorMap/ringMap); a roster with no
//      colour field collapses the rail to a single hue and reads as one
//      undifferentiated family. The order below is the web's canonical member
//      palette (Home-ai/src/db/index.ts:164 `memberColor(i)`):
//      green, cyan, violet, amber, rose, blue, cyan, green, cyan — the SAME
//      six accents, in the SAME order, the reference wall renders.
// The emoji set is the web fallback's own (member-fallback.ts): cat, man,
// girl ×4, boy, dog, poodle.
export const FALLBACK_MEMBERS: ServerMember[] = [
  { id: 1, name: "Mom", role: "parent", emoji: "🐱", color: "green" },
  { id: 2, name: "Dad", role: "parent", emoji: "👨", color: "cyan" },
  { id: 3, name: "Teen", role: "child", emoji: "👧", color: "violet" },
  { id: 4, name: "Tween", role: "child", emoji: "👧", color: "amber" },
  { id: 5, name: "Preteen", role: "child", emoji: "👧", color: "rose" },
  { id: 6, name: "Child", role: "child", emoji: "👧", color: "blue" },
  { id: 7, name: "Sprout", role: "child", emoji: "🧒", color: "cyan" },
  { id: 8, name: "Pup", role: "pet", emoji: "🐶", color: "green" },
  { id: 9, name: "Poodle", role: "pet", emoji: "🐩", color: "cyan" },
];

/**
 * True when the roster IS the built-in stand-in set (no live roster, no
 * cache). The rail asks this so a stand-in roster can announce itself as
 * one — a screen reader must never be told "Family members" while the wall
 * shows sample tiles.
 */
export function isStandInRoster(members: { name: string; emoji: string }[]): boolean {
  if (!members.length) return false;
  return members.every((m) =>
    FALLBACK_MEMBERS.some((f) => f.name === m.name && f.emoji === m.emoji)
  );
}

const CACHE_KEY = "consuela-members";
let memoryCache: ServerMember[] | null = null;

/** Synchronous read of the in-memory roster cache so routes never flash an empty rail on remount. */
export function getCachedMembersSync(): ServerMember[] {
  if (typeof jest !== "undefined") return [];
  return memoryCache && memoryCache.length > 0 ? memoryCache : [];
}

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

/** Cached roster (in-memory + AsyncStorage). */
export async function readCachedMembers(): Promise<ServerMember[]> {
  if (typeof jest === "undefined" && memoryCache && memoryCache.length > 0) {
    return memoryCache;
  }
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      if (typeof jest === "undefined") memoryCache = parsed;
      return parsed;
    }
    return [];
  } catch {
    return memoryCache ?? [];
  }
}

export async function writeCachedMembers(members: ServerMember[]): Promise<void> {
  if (typeof jest === "undefined") {
    memoryCache = members;
  }
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(members)).catch(() => {});
}

/**
 * Cold-device signed-out bootstrap: when a brand-new install has no cached
 * roster yet and /api/members/admin returns 401, warm the device's display
 * roster cache from the LAN server without persisting a session cookie.
 */
async function bootstrapSignedOutRoster(): Promise<ServerMember[]> {
  if (typeof jest !== "undefined") return [];
  const base = getBaseUrl();
  try {
    const qlRes = await fetchImpl(`${base}/api/auth/quick-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberName: "Au" }),
    });
    if (!qlRes.ok) return [];
    const tempCookie = readSetCookie(qlRes);
    if (!tempCookie) return [];
    const liveRes = await fetchImpl(`${base}/api/members/admin?source=live`, {
      method: "GET",
      headers: { Cookie: `consuela_session=${tempCookie}` },
    });
    if (!liveRes.ok) return [];
    const body = (await liveRes.json()) as { members?: ServerMember[] };
    const cleaned = (Array.isArray(body?.members) ? body.members : [])
      .filter((m) => (m.name || "").trim())
      .map((m) => (typeof m.id === "string" && !m.pbId ? { ...m, pbId: m.id } : m));
    if (cleaned.length) {
      await writeCachedMembers(cleaned);
    }
    return cleaned;
  } catch {
    return [];
  } finally {
    await fetchImpl(`${base}/api/auth/logout`, { method: "POST" }).catch(() => {});
  }
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
    if (cleaned.length) {
      await writeCachedMembers(cleaned);
      // Live rows win outright — stand-ins are the LAST resort and must never
      // be appended beside the real roster (their names can't match it).
      return { members: cleaned, source: "live" };
    }
    const cached = await readCachedMembers();
    if (cached.length) return { members: cached, source: "cache" };
    return { members: cleaned, source: "live" };
  } catch (e: any) {
    const reason: "signed-out" | "unreachable" =
      e instanceof ApiError && e.status === 401 ? "signed-out" : "unreachable";
    const cached = await readCachedMembers();
    if (cached.length) return { members: cached, source: "cache", reason };
    if (reason === "signed-out") {
      const bootstrapped = await bootstrapSignedOutRoster();
      if (bootstrapped.length) return { members: bootstrapped, source: "cache", reason };
    }
    return { members: FALLBACK_MEMBERS.map((m) => ({ ...m })), source: "fallback", reason };
  }
}

export type MemberRole = "parent" | "child" | "pet";
export type MemberAvatarSize = "xs" | "sm" | "md" | "lg";

export interface MemberAdminPayload {
  name: string;
  emoji: string;
  role: MemberRole;
  age?: number;
  avatarSize: MemberAvatarSize;
  glow: boolean;
}

export interface MemberPatchPayload {
  name?: string;
  emoji?: string;
  role?: MemberRole;
  age?: number;
  avatarSize?: MemberAvatarSize;
  glow?: boolean;
  pin?: string;
}

/** POST /api/members/admin — parent-only (the server re-reads the live
 *  PocketBase identity; the wall renders the verdict). `joined` is the
 *  "Mon YYYY" display string web parity sends on create. */
export async function addMember(payload: MemberAdminPayload): Promise<{ starterPin?: string }> {
  const joined = new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" });
  return api<{ starterPin?: string }>("/api/members/admin", {
    method: "POST",
    body: { ...payload, joined },
  });
}

/** PATCH /api/members/admin — { id, name, patch } (web body shape; the
 *  `pin` key only travels when the parent typed one). */
export async function updateMember(args: {
  id: string;
  name: string;
  patch: MemberPatchPayload;
}): Promise<void> {
  await api("/api/members/admin", { method: "PATCH", body: args });
}

/** DELETE /api/members/admin — { id, name } (web body shape). */
export async function removeMember(args: { id: string; name: string }): Promise<void> {
  await api("/api/members/admin", { method: "DELETE", body: args });
}
