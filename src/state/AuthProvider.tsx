import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ServerMember } from "../api/types";
import * as authApi from "../api/auth";
import { loadSessionCookie } from "../api/session";

/**
 * Mode derivation from role (mirrors Home-ai's resolveMode/navModeForRole):
 * parent → adult, child/pet → kid, signed out → family.
 */
export type Mode = "family" | "adult" | "kid";
export function modeForMember(m: ServerMember | null): Mode {
  if (!m) return "family";
  return m.role === "parent" ? "adult" : "kid";
}

/** Web-parity constants (src/hooks/useAuth.tsx:12-18). */
export const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // parents
export const KID_INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // child/pet
export const SESSION_WARN_MS = 30 * 1000; // parents
export const KID_SESSION_WARN_MS = 5 * 60 * 1000; // kids get a longer runway

/** Under-10s sign in PIN-free (server is authoritative via quick-login;
 *  age missing → PIN required, never assume). */
export const PIN_FREE_MAX_AGE = 10;
export function pinRequiredFor(m: Pick<ServerMember, "role" | "age">): boolean {
  if (m.role !== "child") return true;
  if (typeof m.age !== "number") return true;
  return m.age >= PIN_FREE_MAX_AGE;
}

const PROFILE_KEY = "consuela-auth-user";

/** Idle/warning windows per role parent vs kid/pet (module-pure). */
function timeoutsFor(m: ServerMember | null) {
  const kid = !!m && m.role !== "parent";
  return {
    idle: kid ? KID_INACTIVITY_TIMEOUT_MS : INACTIVITY_TIMEOUT_MS,
    warn: kid ? KID_SESSION_WARN_MS : SESSION_WARN_MS,
  };
}

export interface AuthValue {
  member: ServerMember | null;
  mode: Mode;
  hydrated: boolean;
  /** True inside the warning window before idle expiry. */
  sessionWarn: boolean;
  pinRequiredFor: typeof pinRequiredFor;
  signIn: (name: string, pin?: string) => Promise<ServerMember>;
  signOut: () => Promise<void>;
  refreshIdentity: () => Promise<void>;
  /** Called by any user interaction to reset the idle clock. */
  poke: () => void;
}

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [member, setMember] = useState<ServerMember | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [sessionWarn, setSessionWarn] = useState(false);

  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (warnTimer.current) clearTimeout(warnTimer.current);
    idleTimer.current = null;
    warnTimer.current = null;
  }, []);

  /** Persist the signed-out-visible profile (display cache, never identity). */
  const persist = useCallback(async (m: ServerMember | null) => {
    if (m) await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(m)).catch(() => {});
    else await AsyncStorage.removeItem(PROFILE_KEY).catch(() => {});
  }, []);

  const signOut = useCallback(async () => {
    clearTimers();
    setSessionWarn(false);
    setMember(null);
    await persist(null);
    await authApi.logout().catch(() => {});
  }, [clearTimers, persist]);

  const armTimers = useCallback(
    (m: ServerMember | null) => {
      clearTimers();
      setSessionWarn(false);
      if (!m) return;
      const { idle, warn } = timeoutsFor(m);
      warnTimer.current = setTimeout(() => setSessionWarn(true), idle - warn);
      idleTimer.current = setTimeout(() => {
        void signOut();
      }, idle);
    },
    [clearTimers, signOut]
  );

  // Hydrate: a stored cookie means "maybe signed in" — the server truth is
  // whoami (401 → signed out). The cached profile only paints the rail while
  // the server answers; it never establishes identity. Hydrated members get
  // their idle timers armed just like a fresh sign-in (web parity).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const cookie = await loadSessionCookie();
        if (!cookie) {
          if (alive) setHydrated(true);
          return;
        }
        const live = await authApi.whoami();
        if (!alive) return;
        if (live) {
          setMember(live);
          armTimers(live);
          await persist(live);
        } else {
          await persist(null);
        }
      } catch {
        // unreachable server → keep whatever profile is cached for display; stay signed out
      } finally {
        if (alive) setHydrated(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [persist, armTimers]);

  // Wall presses ARE session activity: the web's idle clock re-arms on wall
  // interaction, so every touch on the panel re-arms it here too. Reads the
  // member from the closure — NO side effects inside a state updater (a
  // double-invoked updater would double-arm the timers).
  const poke = useCallback(() => {
    if (member) armTimers(member);
  }, [armTimers, member]);

  const signIn = useCallback(
    async (name: string, pin?: string) => {
      const m = pin ? await authApi.login(name, pin) : await authApi.quickLogin(name);
      setMember(m);
      await persist(m);
      armTimers(m);
      return m;
    },
    [armTimers, persist]
  );

  const refreshIdentity = useCallback(async () => {
    const m = await authApi.whoami();
    if (!m) {
      await signOut();
      return;
    }
    setMember(m);
    await persist(m);
    // A fresh identity read is itself activity (hydration parity) — re-arm
    // the idle clock so an actively-used panel never times out mid-session.
    armTimers(m);
  }, [armTimers, persist, signOut]);

  const value = useMemo<AuthValue>(
    () => ({
      member,
      mode: modeForMember(member),
      hydrated,
      sessionWarn,
      pinRequiredFor,
      signIn,
      signOut,
      refreshIdentity,
      poke,
    }),
    [member, hydrated, sessionWarn, signIn, signOut, refreshIdentity, poke]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
