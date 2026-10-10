import { api, ApiError, fetchImpl } from "./client";
import { getBaseUrl } from "./config";
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

async function captureSession(res: unknown): Promise<void> {
  const cookie = readSetCookie(res as { headers: { get(n: string): string | null } });
  if (cookie) await saveSessionCookie(cookie);
}

// api() hides the raw Response — for cookie capture we need headers, so the two
// login flows call fetch through the same path but keep the response object.
async function postWithResponse<T>(path: string, body: unknown): Promise<T> {
  // Uses the injectable fetchImpl so tests intercept one place.
  const res = await fetchImpl(`${getBaseUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let parsed: any = null;
  try {
    parsed = await res.json();
  } catch {
    parsed = null;
  }
  if (!res.ok) {
    throw new ApiError({
      message: parsed?.error ?? `http_${res.status}`,
      status: res.status,
      code: typeof parsed?.error === "string" ? parsed.error : `http_${res.status}`,
      retryable: res.status >= 500 || parsed?.retryable === true,
      queued: parsed?.queued === true,
    });
  }
  await captureSession(res);
  return parsed as T;
}

/** POST /api/auth/login — {memberName, pin} → {success, member} + cookie. */
export async function login(memberName: string, pin: string): Promise<ServerMember> {
  const res = await postWithResponse<LoginResponse>("/api/auth/login", { memberName, pin });
  return res.member;
}

/**
 * POST /api/auth/quick-login — PIN-free under-10 path (server decides;
 * any non-200 → PinRequired, callers fall back to the PIN pad).
 */
export async function quickLogin(memberName: string): Promise<ServerMember> {
  try {
    const res = await postWithResponse<LoginResponse>("/api/auth/quick-login", { memberName });
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
