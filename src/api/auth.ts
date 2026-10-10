import { api, ApiError } from "./client";
import { readSetCookie, saveSessionCookie, clearSessionCookie } from "./session";
import type { ServerMember } from "./types";

/** PIN-free quick login is rejected with this — callers fall back to PIN. */
export class PinRequired extends Error {
  constructor() {
    super("pin_required");
    this.name = "PinRequired";
  }
}

interface LoginResponse {
  success: boolean;
  member: ServerMember;
}

async function captureSession(res: Response): Promise<void> {
  const cookie = readSetCookie(res);
  if (cookie) await saveSessionCookie(cookie);
}

/** POST helper that keeps one transport (timeout/honest errors) AND captures the cookie. */
async function postAuth<T>(path: string, body: unknown): Promise<T> {
  return api<T>(path, { method: "POST", body, onResponse: (res) => void captureSession(res) });
}

/** POST /api/auth/login — {memberName, pin} → {success, member} + cookie. */
export async function login(memberName: string, pin: string): Promise<ServerMember> {
  const res = await postAuth<LoginResponse>("/api/auth/login", { memberName, pin });
  return res.member;
}

/**
 * POST /api/auth/quick-login — PIN-free under-10 path (server decides;
 * any 403 → PinRequired, callers fall back to the PIN pad).
 */
export async function quickLogin(memberName: string): Promise<ServerMember> {
  try {
    const res = await postAuth<LoginResponse>("/api/auth/quick-login", { memberName });
    return res.member;
  } catch (e: any) {
    if (e instanceof ApiError && e.status === 403) throw new PinRequired();
    throw e;
  }
}

/** POST /api/auth/logout — clears the server cookie; local cookie cleared too. */
export async function logout(): Promise<void> {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } finally {
    await clearSessionCookie();
  }
}

/**
 * GET /api/auth/whoami — { member } on a live session; 401 = signed out
 * (NOT an error state — returns null so callers can render family mode).
 */
export async function whoami(): Promise<ServerMember | null> {
  try {
    const res = await api<{ member: ServerMember }>("/api/auth/whoami");
    return res.member ?? null;
  } catch (e: any) {
    if (e instanceof ApiError && e.status === 401) return null;
    throw e;
  }
}

/** POST /api/members/verify — pure PIN check, NO cookie side effects. */
export async function verifyPin(memberName: string, pin: string): Promise<boolean> {
  try {
    const res = await api<{ success: boolean; member: ServerMember }>("/api/members/verify", {
      method: "POST",
      body: { memberName, pin },
    });
    return !!res.success;
  } catch (e: any) {
    if (e instanceof ApiError && e.status === 401) return false;
    throw e;
  }
}
