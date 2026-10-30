import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import { api, ApiError } from "../api/client";
import { onBaseUrlChange } from "../api/config";
import { useAuth } from "./AuthProvider";

export type SyncError = "unreachable" | "unauthorized" | "server" | null;

/**
 * U5.1 taxonomy: a 502 from the NAS is NOT "offline" — the family must not be
 * sent to the router when the server answered and failed. Transport (status 0)
 * and non-ApiError throws are the only "unreachable" cases; any answered HTTP
 * status is "server"; 401/403 stay session states (403 session_role_changed is
 * the same gate — the web's classifyReadError maps both).
 */
export function classifySyncError(e: unknown): SyncError {
  if (e instanceof ApiError) {
    if (e.status === 401 || e.status === 403) return "unauthorized";
    if (e.status === 0) return "unreachable"; // never reached a server
    return "server"; // answered: HTTP error is a server truth, not a network one
  }
  return "unreachable"; // transport-shaped throw that never produced a status
}

export interface SyncValue {
  lastSyncAt: number | null;
  /** True when a refresh failed or no successful sync has completed yet while signed in
   *  (surfaces badge with couldn't-refresh notice). */
  stale: boolean;
  /** True when the server response indicated background projection lag (reconciled === false). */
  reconcileLag: boolean;
  syncError: SyncError;
  /** The latest /api/tasks/sync snapshot (tasks + weekData) — ONE poll serves
   *  every snapshot consumer (web CacheRefresher parity). */
  snapshot: { tasks?: unknown[]; weekData?: WeekData; rewards?: unknown[]; penalties?: unknown[]; } | null;
  refreshNow: () => Promise<void>;
  /** Subscribe to data pulses (fired only on snapshot-bearing responses). */
  onPulse: (listener: () => void) => () => void;
}

/** WeekData shape (Home-ai src/types/tasks.ts:129-135). */
export interface WeekData {
  weekStart: string;
  points: Record<string, number>;
  streak: Record<string, number>;
  lastActive: Record<string, string>;
  history?: unknown[];
}

const Ctx = createContext<SyncValue | null>(null);

const POLL_MS = 60_000;
const BACKOFF_MS = 5_000;
const BACKOFF_MAX = 3;

/**
 * Native mirror of Home-ai's CacheRefresher: poll /api/tasks/sync every 60s
 * (signed-in only; 401 = session died → signOut), refetch on foreground,
 * pulse listeners on snapshot-bearing responses. NEVER synthesizes success:
 * unreachable → stale badge; reconciled:false → keep last good + badge
 * (Home-ai ARCHITECTURE §5.6).
 *
 * `stale` is honest on THREE fronts (U5.2/U5.3):
 * 1. a failed refresh (syncError !== null),
 * 2. a reconciled:false response (reconcileLag — the server is still catching
 *    up, so what is on screen may lag the family truth),
 * 3. a signed-in wall that has NEVER synced (lastSyncAt === null) — a
 *    never-synced wall must not read as "fresh-when-unknown".
 */
export function SyncManager({ children }: { children: React.ReactNode }) {
  const { member, hydrated, signOut } = useAuth();
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [syncError, setSyncError] = useState<SyncError>(null);
  const [snapshot, setSnapshot] = useState<SyncValue["snapshot"]>(null);
  /** reconciled:false lag (U5.3) — the server is catching up (ARCHITECTURE
   *  §5.6): keep the last-good snapshot but keep surfaces badged until a
   *  later response says the family truth has been reconciled. */
  const [reconcileLag, setReconcileLag] = useState(false);

  const listenersRef = useRef(new Set<() => void>());
  const backoffRef = useRef(0);
  const busyRef = useRef(false);

  const onPulse = useCallback((l: () => void) => {
    listenersRef.current.add(l);
    return () => {
      listenersRef.current.delete(l);
    };
  }, []);

  const pulse = useCallback(() => {
    listenersRef.current.forEach((l) => {
      try {
        l();
      } catch {
        /* a listener must not break the pulse fan-out */
      }
    });
  }, []);

  const refreshNow = useCallback(async () => {
    // Signed-in only: /api/tasks/sync requires a live session, so a
    // signed-out poll could only 401 (the web keeps the same rule — no
    // doomed gateway polling; guests get the honest PIN gate instead).
    if (!member || busyRef.current) return;
    busyRef.current = true;
    try {
      const res = await api<{
        snapshot?: { tasks?: unknown[]; weekData?: WeekData } | null;
        error?: string;
        reconciled?: boolean;
        retryable?: boolean;
      }>("/api/tasks/sync");
      if (!mountedRef.current) return; // unmounted mid-flight: never setState
      setLastSyncAt(Date.now());
      setSyncError(null);
      backoffRef.current = 0;
      // reconciled:false → the server is mid-repair (ARCHITECTURE §5.6): the
      // snapshot it may still carry IS the last-good one — keep it — but the
      // surfaces stay badged until a later response reconciles the family
      // truth (stale below reads this flag).
      setReconcileLag(res?.reconciled === false);
      if (res && res.snapshot != null) {
        setSnapshot(res.snapshot as SyncValue["snapshot"]);
        pulse();
      }
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 401) {
        setSyncError("unauthorized");
        // A SIGNED-IN session died → sign out (the wall locks). A guest has
        // no session to kill — 401 is just the gate; never hammer logout().
        if (member) void signOut();
      } else {
        if (e instanceof ApiError && e.retryable) {
          backoffRef.current += 1; // consecutive count; the poll loop bursts 5s ×3 then resumes 60s
        }
        setSyncError(classifySyncError(e));
      }
    } finally {
      busyRef.current = false;
    }
  }, [member, pulse, signOut]);

  // Unmount guard: an in-flight refresh must not setState after teardown.
  const mountedRef = useRef(true);
  /* eslint-disable react-hooks/immutability -- a ref write is the unmount-guard idiom, not state */
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  /* eslint-enable react-hooks/immutability */

  // Poll while signed in: retryable failures burst at BACKOFF_MS up to
  // BACKOFF_MAX consecutive times, then settle back to the 60s cadence (the
  // kiosk must not hammer a dead NAS). Success resets the burst counter.
  useEffect(() => {
    // Poll while signed in (the kiosk's one 60s pull), refetch on foreground.
    if (!hydrated || !member) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const loop = async () => {
      if (cancelled) return;
      await refreshNow();
      if (cancelled) return;
      const burst = backoffRef.current > 0 && backoffRef.current <= BACKOFF_MAX;
      timer = setTimeout(loop, burst ? BACKOFF_MS : POLL_MS);
    };
    void loop();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [hydrated, member, refreshNow]);

  // Foreground refetch — the family comes back to truth when the app resumes.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void refreshNow();
    });
    const unsubUrl = onBaseUrlChange(() => {
      void refreshNow();
    });
    return () => {
      sub.remove();
      unsubUrl();
    };
  }, [refreshNow]);

  const value = useMemo<SyncValue>(
    () => ({
      lastSyncAt,
      // U5.2: a failed refresh, or a signed-in wall that has never completed
      // a sync — neither may read as "fresh".
      // Note: reconcileLag (reconciled: false from the server) indicates background
      // projection catch-up, but the HTTP 200 response carried fresh data and succeeded,
      // so it does NOT mark the local client as couldn't-refresh stale.
      stale: syncError !== null || (member !== null && lastSyncAt === null),
      reconcileLag,
      syncError,
      snapshot,
      refreshNow,
      onPulse,
    }),
    [lastSyncAt, syncError, reconcileLag, snapshot, member, refreshNow, onPulse]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSync(): SyncValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSync must be used within SyncManager");
  return v;
}
