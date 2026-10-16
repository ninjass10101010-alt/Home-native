import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../../api/client";
import { useAuth } from "../../state/AuthProvider";
import { useSync } from "../../state/SyncManager";

/**
 * Shared honesty vocabulary for widget reads — mirrors Home-ai's
 * src/lib/read-state.ts copy verbatim (guest gate, offline, error, stale).
 */
export type ReadFailure = "offline" | "unauthorised" | "error" | "not_connected";

export const READ_COPY: Record<ReadFailure, string> = {
  offline: "Offline — no saved copy on this device.",
  unauthorised: "Sign in with your PIN to see the family's data.",
  error: "Couldn't load this right now.",
  /** 200 {ok:true, connected:false} — a silent empty calendar is the web's
   *  fixed bug (calendar page.tsx:313-348); it must not ship twice. */
  not_connected: "Google Calendar isn't connected.",
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
  /** True when THIS widget's own read path may be lying: the last read failed
   *  and last-good data is still on screen (U5.9 scoped staleness — the global
   *  sync-layer stale flag does not leak into own-fetch widgets). */
  stale: boolean;
  retry: () => void;
}

export interface WidgetDataOptions {
  /**
   * Public widgets (weather — client-direct Open-Meteo) render for the
   * signed-out wall too; every session-backed widget keeps the PIN gate.
   * The reference guest capture shows the weather card live.
   */
  guestVisible?: boolean;
}

/**
 * The Wave 1 widget read contract: fetch on mount + on every SyncManager pulse,
 * classify failures honestly, keep last-good data badged instead of hiding it.
 * A signed-out wall short-circuits to the PIN gate WITHOUT firing doomed 401s
 * (unless the data source is public — guestVisible).
 *
 * Read-timing contract (U5.4/U5.5):
 * - exactly ONE fetch fires on mount — a sync pulse that lands while the first
 *   read is still in flight is dropped (it races the same truth); every LATER
 *   pulse triggers a subsequent run;
 * - an unmounted widget never setStates: the awaited continuation is cancelled.
 */
export function useWidgetData<T>(load: () => Promise<T>, opts: WidgetDataOptions = {}): WidgetData<T> {
  const { member, hydrated } = useAuth();
  const sync = useSync();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [data, setData] = useState<T | null>(null);
  const [failure, setFailure] = useState<ReadFailure | null>(null);

  const hasDataRef = useRef(false);
  const loadRef = useRef(load);
  /** U5.5 unmount guard — false between cleanup and the next mount. */
  const aliveRef = useRef(false);
  /** U5.4 — pulses are ignored until the mount read has settled. */
  const firstRunSettledRef = useRef(false);
  useEffect(() => {
    loadRef.current = load;
  });

  // Declared BEFORE the fetch effect so `alive` is true when `run` starts and
  // false the moment the widget unmounts (cleanups run in declaration order).
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const run = useCallback(async () => {
    try {
      const d = await loadRef.current();
      if (!aliveRef.current) return; // unmounted mid-read — never setState (U5.5)
      hasDataRef.current = true;
      setData(() => d);
      setFailure(null);
      setStatus("ready");
    } catch (e) {
      if (!aliveRef.current) return; // a cancelled read is not a failure to report (U5.5)
      setFailure(classifyFailure(e));
      // A failed refresh keeps last-good data on screen (badged); only a
      // first-read failure becomes the widget's error state.
      if (!hasDataRef.current) setStatus("error");
    } finally {
      firstRunSettledRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!member && !opts.guestVisible) return; // session widgets: no doomed 401s for guests
    void run();
    return sync.onPulse(() => {
      // U5.4: on a fresh wall the mount fetch and the initial SyncManager
      // pulse race each other; a pulse before the first read settles is the
      // same truth in flight — drop it (the next pulse/poll re-reads).
      if (!firstRunSettledRef.current) return;
      void run();
    });
    // U5.4b: depend on the STABLE pulse seam, never the whole sync object —
    // its identity changes on every poll (lastSyncAt), which re-ran this
    // effect AND fired the pulse → every widget read twice per 60s.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync.onPulse is the stable dep; the object identity is the bug
  }, [hydrated, member, run, sync.onPulse, opts.guestVisible]);

  const retry = useCallback(() => {
    // A signed-in retry ALSO nudges the shared poll (session surfaces); a
    // guest re-reads only the widget's own public lane — never a doomed sync.
    if (member) void sync.refreshNow();
    void run();
  }, [member, sync, run]);

  // Signed-out wall: session widgets land on the PIN gate; guestVisible ones render.
  const guest = hydrated && !member && !opts.guestVisible;
  return {
    status: guest ? "error" : status,
    data: guest ? null : data,
    failure: guest ? "unauthorised" : failure,
    // U5.9 scoped staleness: this hook owns ONLY its own read path — it badges
    // when the last read failed and last-good data is still on screen. The
    // global sync-layer stale flag stays with the surfaces that ride the
    // shared snapshot (Tasks/Leaderboard pass useSync().stale directly), so
    // public/own-fetch widgets (weather, photos) can no longer wear a
    // "saved copy" badge while their own data is fresh.
    stale: !guest && failure !== null && data !== null,
    retry,
  };
}
