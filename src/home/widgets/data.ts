import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../../api/client";
import { useAuth } from "../../state/AuthProvider";
import { useSync } from "../../state/SyncManager";

/**
 * Shared honesty vocabulary for widget reads — mirrors Home-ai's
 * src/lib/read-state.ts copy verbatim (guest gate, offline, error, stale).
 */
export type ReadFailure = "offline" | "unauthorised" | "error";

export const READ_COPY: Record<ReadFailure, string> = {
  offline: "Offline — no saved copy on this device.",
  unauthorised: "Sign in with your PIN to see the family's data.",
  error: "Couldn't load this right now.",
};
/** Reference: READ_COPY_STALE (last good data still on screen). */
export const READ_COPY_STALE = "Showing your saved copy — couldn't refresh.";
export const READ_RETRY_LABEL = "Try again";

/** ApiError/transport → the shared read vocabulary (mirrors classifyReadError). */
export function classifyFailure(err: unknown): ReadFailure {
  if (err instanceof ApiError) {
    if (err.status === 401 || err.status === 403) return "unauthorised";
    if (err.status === 0) return "offline";
    return "error";
  }
  return "error";
}

/** Local YYYY-MM-DD (the panel lives in the family home — device zone = family zone). */
export function localTodayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Monday-start week key (mirrors Home-ai localWeekStartISO math). */
export function weekStartMondayISO(now: Date = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return localTodayISO(d);
}

/** "17:30" → "5:30 PM"; anything unparseable passes through unchanged. */
export function formatTime12h(time?: string | null): string | undefined {
  if (!time) return undefined;
  const m = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return time;
  const h24 = Number(m[1]);
  const mins = m[2];
  const period = h24 >= 12 ? "PM" : "AM";
  const h = h24 % 12 || 12;
  return `${h}:${mins} ${period}`;
}

export interface WidgetData<T> {
  status: "loading" | "ready" | "error";
  data: T | null;
  failure: ReadFailure | null;
  /** True when what's on screen may not be the family truth (sync down / last read failed). */
  stale: boolean;
  retry: () => void;
}

/**
 * The Wave 1 widget read contract: fetch on mount + on every SyncManager pulse,
 * classify failures honestly, keep last-good data badged instead of hiding it.
 * A signed-out wall short-circuits to the PIN gate WITHOUT firing doomed 401s.
 */
export function useWidgetData<T>(load: () => Promise<T>): WidgetData<T> {
  const { member, hydrated } = useAuth();
  const sync = useSync();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [data, setData] = useState<T | null>(null);
  const [failure, setFailure] = useState<ReadFailure | null>(null);

  const hasDataRef = useRef(false);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  const run = useCallback(async () => {
    try {
      const d = await loadRef.current();
      hasDataRef.current = true;
      setData(() => d);
      setFailure(null);
      setStatus("ready");
    } catch (e) {
      setFailure(classifyFailure(e));
      // A failed refresh keeps last-good data on screen (badged); only a
      // first-read failure becomes the widget's error state.
      if (!hasDataRef.current) setStatus("error");
    }
  }, []);

  useEffect(() => {
    if (!hydrated || !member) return; // the guest gate is derived below, not stored
    void run();
    return sync.onPulse(() => void run());
  }, [hydrated, member, run, sync]);

  const retry = useCallback(() => {
    void sync.refreshNow();
    void run();
  }, [sync, run]);

  // Signed-out wall: no doomed 401s — every widget lands on the PIN gate.
  const guest = hydrated && !member;
  return {
    status: guest ? "error" : status,
    data: guest ? null : data,
    failure: guest ? "unauthorised" : failure,
    stale: !guest && (sync.stale || (failure !== null && data !== null)),
    retry,
  };
}
