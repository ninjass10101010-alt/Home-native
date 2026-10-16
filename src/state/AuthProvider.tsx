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
import { clearSessionCookie, loadSessionCookie } from "../api/session";

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
  // whoami. When whoami answers null (401) or throws (offline), the cached
  // consuela-auth-user paints the rail instead of being wiped (capture
  // harness + offline cold start); a cookie-less start paints it too. The
  // cache is a display fallback, never a credential.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const cookie = await loadSessionCookie();
        if (!cookie) {
          const cachedRaw = await AsyncStorage.getItem(PROFILE_KEY);
          if (alive && cachedRaw) {
            try {
              const parsed = JSON.parse(cachedRaw) as ServerMember;
              if (parsed && typeof parsed.name === "string" && parsed.role) {
                setMember(parsed);
              }
            } catch {
              // ignore malformed profile
            }
          }
          if (alive) setHydrated(true);
          return;
        }
        const who = await authApi.whoami();
        if (!alive) return;
        if (who) {
          setMember(who);
          armTimers(who);
          await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(who));
        } else {
          const cachedRaw = await AsyncStorage.getItem(PROFILE_KEY);
          let restored: ServerMember | null = null;
          if (cachedRaw) {
            try {
              const parsed = JSON.parse(cachedRaw) as ServerMember;
              if (parsed && typeof parsed.name === "string" && parsed.role) {
                restored = parsed;
              }
            } catch {
              restored = null;
            }
          }
          if (restored) {
            setMember(restored);
          } else {
            await clearSessionCookie();
            setMember(null);
          }
        }
      } catch {
        // Offline at cold start: fall back to cached profile if available.
        try {
          const cachedRaw = await AsyncStorage.getItem(PROFILE_KEY);
          if (alive && cachedRaw) {
            const parsed = JSON.parse(cachedRaw) as ServerMember;
            if (parsed && typeof parsed.name === "string" && parsed.role) {
              setMember(parsed);
            }
          }
        } catch {
          // ignore
        }
      } finally {
        if (alive) setHydrated(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [armTimers]);

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
  if (v) return v;
  // Fallback for kit surfaces (e.g. WidgetFrame) rendered outside an
  // AuthProvider — keeps them guest-neutral without a thrown hook and lets
  // callers gate on hydrated/!member without crashing in unit tests.
  return {
    member: null,
    mode: "family",
    hydrated: false,
    sessionWarn: false,
    pinRequiredFor,
    signIn: async () => { throw new Error("useAuth: no provider"); },
    signOut: async () => {},
    refreshIdentity: async () => {},
    poke: () => {},
  };
}
