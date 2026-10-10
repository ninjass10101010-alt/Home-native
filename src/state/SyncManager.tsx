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
import { useAuth } from "./AuthProvider";

export type SyncError = "unreachable" | "unauthorized" | null;

export interface SyncValue {
  lastSyncAt: number | null;
  /** True when the last refresh failed — surfaces MUST badge or hide stale data. */
  stale: boolean;
  syncError: SyncError;
  refreshNow: () => Promise<void>;
  /** Subscribe to data pulses (fired only on snapshot-bearing responses). */
  onPulse: (listener: () => void) => () => void;
}

const Ctx = createContext<SyncValue | null>(null);

const POLL_MS = 60_000;
const BACKOFF_MS = 5_000;
const BACKOFF_MAX = 3;

/**
 * Native mirror of Home-ai's CacheRefresher: poll /api/tasks/sync every 60s
 * (signed-in only; 401 = session died → signOut), refetch on foreground,
 * pulse listeners on snapshot-bearing responses. NEVER synthesizes success:
 * unreachable → stale badge; reconciled:false → keep last good + backoff.
 */
export function SyncManager({ children }: { children: React.ReactNode }) {
  const { member, hydrated, signOut } = useAuth();
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [syncError, setSyncError] = useState<SyncError>(null);

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
    if (!member || busyRef.current) return;
    busyRef.current = true;
    try {
      const res = await api<{
        snapshot?: unknown | null;
        error?: string;
        reconciled?: boolean;
        retryable?: boolean;
      }>("/api/tasks/sync");
      setLastSyncAt(Date.now());
      setSyncError(null);
      backoffRef.current = 0;
      if (res && res.snapshot != null) pulse();
      // reconciled:false → server is catching up; snapshot may still be present
      // and is already the last-good one — keep it (see Home-ai ARCHITECTURE §5.6).
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 401) {
        setSyncError("unauthorized");
        void signOut();
      } else if (e instanceof ApiError && e.retryable) {
        backoffRef.current += 1; // consecutive count; the poll loop bursts 5s ×3 then resumes 60s
        setSyncError("unreachable");
      } else if (e instanceof ApiError) {
        setSyncError("unreachable");
      } else {
        setSyncError("unreachable");
      }
    } finally {
      busyRef.current = false;
    }
  }, [member, pulse, signOut]);

  // Poll while signed in: retryable failures burst at BACKOFF_MS up to
  // BACKOFF_MAX consecutive times, then settle back to the 60s cadence (the
  // kiosk must not hammer a dead NAS). Success resets the burst counter.
  useEffect(() => {
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
    return () => sub.remove();
  }, [member, refreshNow]);

  const value = useMemo<SyncValue>(
    () => ({
      lastSyncAt,
      stale: syncError !== null,
      syncError,
      refreshNow,
      onPulse,
    }),
    [lastSyncAt, syncError, refreshNow, onPulse]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSync(): SyncValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSync must be used within SyncManager");
  return v;
}
