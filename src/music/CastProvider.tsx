import React from "react";
import {
  CastContext,
  useCastSession,
  useCastState,
  useDevices,
  useMediaStatus,
  useStreamPosition,
} from "react-native-google-cast";
import { resolveAudio } from "../../modules/youtube-engine";
import {
  castErrorCopy,
  castMediaInfo,
  castStatusAction,
  normalizeCastState,
  toTargets,
  type CastStateValue,
  type CastTarget,
} from "./cast";
import { isContentHidden } from "./explicit";
import { usePlayback } from "./playback";
import type { MediaTrack } from "./types";

export interface CastValue {
  state: CastStateValue;
  devices: CastTarget[];
  target: CastTarget | null;
  casting: boolean;
  playing: boolean;
  position: number;
  duration: number | null;
  busy: boolean;
  error: string | null;
  volume: number;
  muted: boolean;
  connect: (id: string) => Promise<boolean>;
  startCast: (track: MediaTrack) => Promise<void>;
  disconnect: () => Promise<void>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  seek: (seconds: number) => Promise<void>;
  advance: (auto: boolean) => Promise<void>;
  previous: () => Promise<void>;
  adjustVolume: (delta: number) => Promise<void>;
  toggleMute: () => Promise<void>;
}

interface CastClient {
  loadMedia: (request: { mediaInfo: ReturnType<typeof castMediaInfo>; autoplay: boolean }) => Promise<void>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  seek: (options: { position: number }) => Promise<void>;
}

interface CastSessionLike {
  client: CastClient;
  getCastDevice: () => Promise<{ deviceId?: string | null; friendlyName?: string | null } | null>;
  getVolume: () => Promise<number>;
  isMute: () => Promise<boolean>;
  setVolume: (volume: number) => void;
  setMute: (mute: boolean) => void;
}

/**
 * Wait for the SDK to report a session on `deviceId`.
 *
 * `startSession` resolves when the route has been selected — the actual
 * session arrives later through `onSessionStarted` (or fails through
 * `onSessionStartFailed`). Reading the session synchronously therefore sees
 * `null` on a first connect and the OLD device on a switch, so the wait is
 * bounded and only accepts a session whose device actually matches.
 */
function waitForSession(deviceId: string, timeoutMs = 6000): Promise<CastSessionLike | null> {
  const manager = CastContext.sessionManager;
  return new Promise((resolve) => {
    let settled = false;
    let startedSub: { remove: () => void } | null = null;
    let failedSub: { remove: () => void } | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const finish = (session: CastSessionLike | null) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      startedSub?.remove();
      failedSub?.remove();
      resolve(session);
    };

    const matches = async (candidate: CastSessionLike | null): Promise<boolean> => {
      if (!candidate) return false;
      try {
        const device = await candidate.getCastDevice();
        return device?.deviceId?.trim() === deviceId;
      } catch {
        return false;
      }
    };

    // Register BEFORE the read: the receiver can start between the two, and
    // an event that lands before the listener is attached would be lost.
    startedSub = manager.onSessionStarted((next) => {
      const cast = next as unknown as CastSessionLike;
      void matches(cast).then((ok) => { if (ok) finish(cast); });
    });
    failedSub = manager.onSessionStartFailed(() => finish(null));
    timer = setTimeout(() => finish(null), timeoutMs);

    void manager
      .getCurrentCastSession()
      .then(async (current) => {
        if (settled) return;
        const cast = current as unknown as CastSessionLike | null;
        if (await matches(cast)) finish(cast);
      })
      .catch(() => {
        // The lookup failed, but the receiver may still announce itself:
        // keep waiting for the event rather than failing the connect early.
      });
  });
}

const CastContextValue = React.createContext<CastValue | null>(null);

/**
 * The receiver's media-session id.
 *
 * react-native-google-cast 4.9.1 does not include it in its published
 * `MediaStatus` type (the Android bridge omits it), but it is the field that
 * makes a completion unique: a repeat-one reload creates a NEW session for
 * the SAME track. It is read defensively and the guard falls back to the
 * track id when the receiver does not report it.
 */
type CastMediaStatus = { mediaSessionId?: number | null };

export function CastProvider({ children }: { children: React.ReactNode }) {
  const playback = usePlayback();
  const advanceForCast = playback.advanceForCast;
  const previousForCast = playback.previousForCast;
  const rawState = useCastState();
  const deviceList = useDevices();
  const devices = React.useMemo(() => toTargets(deviceList), [deviceList]);
  const session = useCastSession();
  const position = useStreamPosition();
  const status = useMediaStatus();
  const playerState = status?.playerState ?? null;
  const idleReason = status?.idleReason ?? null;
  const mediaSessionId = (status as CastMediaStatus | null)?.mediaSessionId ?? null;
  const playbackPolicy = playback.policy;
  const playbackCurrent = playback.current;
  const pauseLocal = playback.pauseLocal;
  const parkLocal = playback.parkLocal;
  const setCastSink = playback.setCastSink;
  const recordHistory = playback.recordHistory;

  const [target, setTarget] = React.useState<CastTarget | null>(null);
  const [track, setTrack] = React.useState<MediaTrack | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [volume, setVolume] = React.useState(0.5);
  const [muted, setMuted] = React.useState(false);
  const castTrackId = track?.id ?? null;
  const clientRef = React.useRef<CastClient | null>(null);
  const sessionRef = React.useRef<CastSessionLike | null>(null);
  const targetRef = React.useRef<CastTarget | null>(null);
  /** The last known receiver level, read by rapid nudges before a re-render. */
  const volumeRef = React.useRef(0.5);
  const mutedRef = React.useRef(false);
  /**
   * The generation of the audio hydration.
   *
   * A `getVolume`/`isMute` read can resolve long after the session it belongs
   * to is gone — or after the family has already nudged the new one. Every
   * session change and every user volume action bumps this epoch, so a stale
   * read is discarded instead of overwriting a newer level or the wrong
   * device's state.
   */
  const volumeEpochRef = React.useRef(0);
  /**
   * The completion the auto-advance has already handled.
   *
   * A receiver keeps reporting IDLE/FINISHED for the same completion until it
   * loads the next item, and React can re-run the effect for other reasons —
   * so the effect remembers the session + track it already advanced from.
   */
  const lastFinishedRef = React.useRef<string | null>(null);
  /** The session the next successful load belongs to (read by `startCast`). */
  const mediaSessionIdRef = React.useRef<number | null>(null);
  /**
   * Whether a cast session had been established before it disappeared.
   *
   * The session effect must park the local transport only when a LIVE session
   * ends with a cast track on the surface — never on mount, and never for a
   * provider that merely holds a track while no session ever existed.
   */
  const hadSessionRef = React.useRef(false);
  /** The latest cast track — read by the session-end effect. */
  const trackRef = React.useRef<MediaTrack | null>(null);
  /** The provider's latest current track — the park fallback when the cast track is gone. */
  const playbackCurrentRef = React.useRef<MediaTrack | null>(playbackCurrent);

  React.useEffect(() => {
    mediaSessionIdRef.current = mediaSessionId;
  }, [mediaSessionId]);

  React.useEffect(() => {
    trackRef.current = track;
  }, [track]);

  React.useEffect(() => {
    playbackCurrentRef.current = playbackCurrent;
  }, [playbackCurrent]);

  /**
   * The track the last teardown already parked.
   *
   * A normal Stop is seen twice — once by `disconnect` and once by the
   * session-end effect — and both would resolve/replace the same track. The
   * guard collapses them into one park; every new cast load clears it.
   */
  const lastParkedRef = React.useRef<string | null>(null);

  const parkOnce = React.useCallback(
    async (next: MediaTrack) => {
      if (lastParkedRef.current === next.id) return;
      lastParkedRef.current = next.id;
      await parkLocal(next);
    },
    [parkLocal]
  );

  /**
   * The receiver owns its own amplifier level: read it whenever a session
   * arrives so the sheet describes the device, not a stale default. A
   * receiver that cannot answer keeps the last known value.
   *
   * The read is only committed when it still belongs to the current session
   * AND no newer session change or user action happened while it was in
   * flight. `allSettled` keeps a failed `isMute` from discarding a good
   * `getVolume` (and vice versa).
   */
  const hydrateAudio = React.useCallback(async (active: CastSessionLike | null) => {
    if (!active) return;
    const epoch = volumeEpochRef.current;
    const [levelResult, muteResult] = await Promise.allSettled([
      Promise.resolve().then(() => active.getVolume()),
      Promise.resolve().then(() => active.isMute()),
    ]);
    if (volumeEpochRef.current !== epoch || sessionRef.current !== active) return;
    if (levelResult.status === "fulfilled") {
      const level = levelResult.value;
      if (typeof level === "number" && Number.isFinite(level)) {
        volumeRef.current = level;
        setVolume(level);
      }
    }
    if (muteResult.status === "fulfilled") {
      const mute = muteResult.value;
      mutedRef.current = mute;
      setMuted(mute);
    }
  }, []);

  React.useEffect(() => {
    if (session) {
      volumeEpochRef.current += 1;
      hadSessionRef.current = true;
      clientRef.current = session.client as unknown as CastClient;
      sessionRef.current = session as unknown as CastSessionLike;
      void hydrateAudio(sessionRef.current);
      // A session restored at mount (the app was backgrounded, the receiver
      // kept playing) never passed through `connect`: hydrate its target so
      // the sink is installed and the tablet is silent.
      if (targetRef.current) return;
      let cancelled = false;
      void (async () => {
        try {
          const device = await (session as unknown as CastSessionLike).getCastDevice();
          const id = device?.deviceId?.trim();
          const name = device?.friendlyName?.trim();
          if (cancelled || !id || !name || targetRef.current) return;
          const hydrated = { id, name };
          targetRef.current = hydrated;
          setTarget(hydrated);
          // The sink effect pauses local and drops the lock screen; pausing
          // here too means a restored session is silent immediately.
          pauseLocal();
        } catch {
          // A restored session that cannot name its device stays targetless;
          // the sheet can still connect again.
        }
      })();
      return () => { cancelled = true; };
    }
    clientRef.current = null;
    sessionRef.current = null;
    targetRef.current = null;
    volumeEpochRef.current += 1;
    // A session can end before its last load ever reached the surface (the
    // receiver rejected it), so the local `track` is not the only thing worth
    // parking: `playback.current` is where the family's chosen track lives.
    const ended = hadSessionRef.current
      ? playbackCurrentRef.current ?? trackRef.current
      : null;
    hadSessionRef.current = false;
    if (!ended) {
      setTarget(null);
      setTrack(null);
      return;
    }
    // A cast session ended with a track chosen: park the local player on that
    // track BEFORE the surface clears, so pressing Play after Stop resumes
    // the track the family was casting, not whatever the tablet held before
    // the cast began. Unmount cleanup never reaches here.
    let cancelled = false;
    void (async () => {
      await parkOnce(ended);
      if (cancelled) return;
      setTarget(null);
      setTrack(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrateAudio, parkOnce, pauseLocal, session]);

  const connect = React.useCallback(
    async (id: string): Promise<boolean> => {
      const chosen = devices.find((device) => device.id === id) ?? null;
      if (!chosen) return false;
      setBusy(true);
      setError(null);
      let opened = false;
      try {
        opened = await CastContext.sessionManager.startSession(id);
        if (!opened) throw new Error("session not started");
        // `startSession` resolves when the route is selected; the SDK session
        // arrives later. Wait for the session that names THIS device — never
        // accept the old one on a switch.
        const current = await waitForSession(chosen.id);
        if (!current?.client) throw new Error("session unavailable");
        // The receiver owns the sound from here: silence the tablet at once,
        // without waiting for the sink effect (and without `toggle`, which
        // would route through the sink and reload the receiver).
        pauseLocal();
        const switched = targetRef.current?.id !== chosen.id;
        // A newer session owns the amplifier now: invalidate any read still
        // in flight for the previous one, then hydrate without blocking the
        // sheet (the session effect covers a late arrival too).
        volumeEpochRef.current += 1;
        clientRef.current = current.client;
        sessionRef.current = current;
        targetRef.current = chosen;
        setTarget(chosen);
        void hydrateAudio(current);
        if (switched) setTrack(null);
        return true;
      } catch {
        // A failed SWITCH must not leave the previous receiver live, and a
        // FIRST connect that opened a session but could not reach its client
        // is just as live: end it before clearing, so it cannot keep playing
        // while local audio starts.
        if (opened || targetRef.current) {
          await CastContext.sessionManager.endCurrentSession(true).catch(() => {});
        }
        volumeEpochRef.current += 1;
        clientRef.current = null;
        sessionRef.current = null;
        targetRef.current = null;
        setTarget(null);
        setTrack(null);
        setError(castErrorCopy(chosen.name));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [devices, hydrateAudio, pauseLocal]
  );

  const startCast = React.useCallback(
    async (next: MediaTrack) => {
      const client = clientRef.current;
      if (!client) {
        setError("Choose a device to cast to.");
        return;
      }
      if (isContentHidden(next, playbackPolicy)) {
        setError("This track isn't available to cast.");
        return;
      }
      // A new cast load arms the park guard again: a later Stop must park
      // even when it lands on the same track id as the previous one.
      lastParkedRef.current = null;
      setBusy(true);
      setError(null);
      try {
        const resolved = await resolveAudio(next.id);
        await client.loadMedia({ mediaInfo: castMediaInfo(next, resolved), autoplay: true });
        // The tablet never plays this track, so its local start path cannot
        // record it. Record after the load actually landed, exactly once.
        await recordHistory(next).catch(() => {});
        // A load re-arms the completion guard: the finish that started this
        // advance is done, and the receiver's NEXT finish (even of the same
        // track, repeat one) is a new completion. Keyed to the track now
        // loading so the stale IDLE/FINISHED status cannot fire twice.
        lastFinishedRef.current = `${mediaSessionIdRef.current ?? "none"}:${next.id}`;
        setTrack(next);
      } catch {
        setError(castErrorCopy(targetRef.current?.name ?? "that device"));
      } finally {
        setBusy(false);
      }
    },
    [playbackPolicy, recordHistory]
  );

  /**
   * While a session is LIVE (connected, even if idle) every start path in
   * PlaybackProvider goes to the receiver. The sink is installed on `target`,
   * not `casting`, so a track started from search, the queue or the wall
   * widget reaches the TV before the first cast track exists.
   */
  React.useEffect(() => {
    setCastSink(target ? startCast : null);
    return () => setCastSink(null);
  }, [target, startCast, setCastSink]);

  const guarded = React.useCallback(async (run: () => Promise<void>) => {
    if (!clientRef.current) return;
    try {
      await run();
    } catch {
      setError("The cast stopped. Try again.");
    }
  }, []);

  React.useEffect(() => {
    const action = castStatusAction(
      status ? { playerState: status.playerState, idleReason: status.idleReason } : null
    );
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the media status is external; an idle error must surface
    if (action === "error") setError("The cast stopped. Try again.");
  }, [status]);

  React.useEffect(() => {
    if (!track) return;
    if (!isContentHidden(track, playbackPolicy)) return;
    let cancelled = false;
    void (async () => {
      try {
        await CastContext.sessionManager.endCurrentSession(true);
      } catch {
        if (!cancelled) {
          // The session may still be playing the hidden track: keep the cast
          // surface and say so instead of pretending the stop succeeded.
          setError("Couldn't stop casting. Try again.");
        }
        return;
      }
      if (cancelled) return;
      volumeEpochRef.current += 1;
      clientRef.current = null;
      sessionRef.current = null;
      targetRef.current = null;
      // Clear the surface only once the denial actually stopped the cast.
      setTrack(null);
      setTarget(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [playbackPolicy, track]);

  const disconnect = React.useCallback(async () => {
    setBusy(true);
    setError(null);
    volumeEpochRef.current += 1;
    try {
      await CastContext.sessionManager.endCurrentSession(true);
      // Park on the track the family chose even when the receiver load FAILED
      // and never reached the surface: `playback.current` is what the local
      // transport would resume, and it is B, not the pre-cast local track.
      const toPark = playbackCurrent ?? track;
      if (toPark) await parkOnce(toPark);
      clientRef.current = null;
      sessionRef.current = null;
      targetRef.current = null;
      setTarget(null);
      setTrack(null);
    } catch {
      setError("Couldn't stop casting. Try again.");
    } finally {
      setBusy(false);
    }
  }, [parkOnce, playbackCurrent, track]);

  const play = React.useCallback(
    () => guarded(async () => { await clientRef.current?.play(); }),
    [guarded]
  );

  const pause = React.useCallback(
    () => guarded(async () => { await clientRef.current?.pause(); }),
    [guarded]
  );

  const seek = React.useCallback(
    (seconds: number) => guarded(async () => { await clientRef.current?.seek({ position: seconds }); }),
    [guarded]
  );

  /**
   * The receiver's previous step.
   *
   * Past three seconds it restarts the current track on the receiver, exactly
   * like the local transport. Near the start it walks the queue backwards
   * through the SAME visibility gate and loads the previous visible track —
   * local audio is never touched.
   */
  const previous = React.useCallback(async () => {
    if ((position ?? 0) > 3) {
      await seek(0);
      return;
    }
    const next = previousForCast();
    if (!next) return;
    await startCast(next);
  }, [position, previousForCast, seek, startCast]);

  /**
   * The one transport's queue step: move the queue through the SAME
   * visibility gate as local playback, then load the chosen track on the
   * receiver with a FRESH resolve. Local audio is never touched here.
   */
  const advance = React.useCallback(
    async (auto: boolean) => {
      const next = advanceForCast(auto);
      if (!next) return;
      await startCast(next);
    },
    [advanceForCast, startCast]
  );

  /**
   * The receiver's own amplifier. `setVolume` is synchronous in the SDK, so
   * the state updates optimistically; a positive nudge also lifts a mute,
   * because a family reaching for Volume up expects to hear something.
   */
  const adjustVolume = React.useCallback(async (delta: number) => {
    volumeEpochRef.current += 1;
    const active = sessionRef.current;
    if (!active) return;
    const next = Math.round(Math.min(1, Math.max(0, volumeRef.current + delta)) * 100) / 100;
    active.setVolume(next);
    volumeRef.current = next;
    setVolume(next);
    if (mutedRef.current && delta > 0) {
      active.setMute(false);
      mutedRef.current = false;
      setMuted(false);
    }
  }, []);

  const toggleMute = React.useCallback(async () => {
    volumeEpochRef.current += 1;
    const active = sessionRef.current;
    if (!active) return;
    const next = !mutedRef.current;
    active.setMute(next);
    mutedRef.current = next;
    setMuted(next);
  }, []);

  const playing = status?.playerState === "playing";

  /**
   * A receiver that finishes a track advances the queue ONCE.
   *
   * The guard is keyed by the media session + track, so the repeated
   * IDLE/FINISHED status the receiver keeps sending for the same completion
   * cannot roll the queue twice. A successful load re-arms it, so repeat-one
   * can finish the same track again. The deps are primitives: a position tick
   * (`useStreamPosition`) never re-runs this effect.
   */
  React.useEffect(() => {
    const action = castStatusAction({ playerState, idleReason });
    if (action === "none") {
      // The receiver has moved on (loading/playing/paused): the next finish
      // is a new completion, even when the same track repeats.
      lastFinishedRef.current = null;
      return;
    }
    if (action !== "advance" || !castTrackId) return;
    const key = `${mediaSessionId ?? "none"}:${castTrackId}`;
    if (lastFinishedRef.current === key) return;
    lastFinishedRef.current = key;
    void advance(true);
  }, [advance, castTrackId, idleReason, mediaSessionId, playerState]);

  const value = React.useMemo<CastValue>(
    () => ({
      state: normalizeCastState(rawState),
      devices,
      target,
      casting: track !== null,
      playing,
      position: position ?? 0,
      duration: track?.durationSeconds ?? null,
      busy,
      error,
      volume,
      muted,
      connect,
      startCast,
      disconnect,
      play,
      pause,
      seek,
      advance,
      previous,
      adjustVolume,
      toggleMute,
    }),
    [
      rawState,
      devices,
      target,
      track,
      playing,
      position,
      busy,
      error,
      volume,
      muted,
      connect,
      startCast,
      disconnect,
      play,
      pause,
      seek,
      advance,
      previous,
      adjustVolume,
      toggleMute,
    ]
  );

  return <CastContextValue.Provider value={value}>{children}</CastContextValue.Provider>;
}

export function useCast(): CastValue {
  const value = React.useContext(CastContextValue);
  if (!value) throw new Error("useCast must be used inside CastProvider");
  return value;
}
