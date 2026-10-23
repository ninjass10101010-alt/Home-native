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
  connect: (id: string) => Promise<boolean>;
  startCast: (track: MediaTrack) => Promise<void>;
  disconnect: () => Promise<void>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  seek: (seconds: number) => Promise<void>;
  advance: (auto: boolean) => Promise<void>;
  previous: () => Promise<void>;
}

interface CastClient {
  loadMedia: (request: { mediaInfo: ReturnType<typeof castMediaInfo>; autoplay: boolean }) => Promise<void>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  seek: (options: { position: number }) => Promise<void>;
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
  const playbackPlaying = playback.playing;
  const togglePlayback = playback.toggle;
  const setCastSink = playback.setCastSink;

  const [target, setTarget] = React.useState<CastTarget | null>(null);
  const [track, setTrack] = React.useState<MediaTrack | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const castTrackId = track?.id ?? null;
  const clientRef = React.useRef<CastClient | null>(null);
  const targetRef = React.useRef<CastTarget | null>(null);
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

  React.useEffect(() => {
    mediaSessionIdRef.current = mediaSessionId;
  }, [mediaSessionId]);

  React.useEffect(() => {
    if (session) {
      clientRef.current = session.client as unknown as CastClient;
    } else {
      clientRef.current = null;
      targetRef.current = null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the native session is the source of truth; losing it must clear the cast surface
      setTarget(null);
      setTrack(null);
    }
  }, [session]);

  const connect = React.useCallback(
    async (id: string): Promise<boolean> => {
      const chosen = devices.find((device) => device.id === id) ?? null;
      if (!chosen) return false;
      setBusy(true);
      setError(null);
      try {
        const started = await CastContext.sessionManager.startSession(id);
        if (!started) throw new Error("session not started");
        const current = await CastContext.sessionManager.getCurrentCastSession();
        if (!current?.client) throw new Error("session unavailable");
        const switched = targetRef.current?.id !== chosen.id;
        clientRef.current = current.client as unknown as CastClient;
        targetRef.current = chosen;
        setTarget(chosen);
        if (switched) setTrack(null);
        return true;
      } catch {
        clientRef.current = null;
        targetRef.current = null;
        setTarget(null);
        setTrack(null);
        setError(castErrorCopy(chosen.name));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [devices]
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
      setBusy(true);
      setError(null);
      try {
        const resolved = await resolveAudio(next.id);
        await client.loadMedia({ mediaInfo: castMediaInfo(next, resolved), autoplay: true });
        // A load re-arms the completion guard: the finish that started this
        // advance is done, and the receiver's NEXT finish (even of the same
        // track, repeat one) is a new completion. Keyed to the track now
        // loading so the stale IDLE/FINISHED status cannot fire twice.
        lastFinishedRef.current = `${mediaSessionIdRef.current ?? "none"}:${next.id}`;
        setTrack(next);
        if (playbackPlaying) togglePlayback();
      } catch {
        setError(castErrorCopy(targetRef.current?.name ?? "that device"));
      } finally {
        setBusy(false);
      }
    },
    [playbackPolicy, playbackPlaying, togglePlayback]
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
      clientRef.current = null;
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
    try {
      await CastContext.sessionManager.endCurrentSession(true);
      clientRef.current = null;
      targetRef.current = null;
      setTarget(null);
      setTrack(null);
    } catch {
      setError("Couldn't stop casting. Try again.");
    } finally {
      setBusy(false);
    }
  }, []);

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
      connect,
      startCast,
      disconnect,
      play,
      pause,
      seek,
      advance,
      previous,
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
      connect,
      startCast,
      disconnect,
      play,
      pause,
      seek,
      advance,
      previous,
    ]
  );

  return <CastContextValue.Provider value={value}>{children}</CastContextValue.Provider>;
}

export function useCast(): CastValue {
  const value = React.useContext(CastContextValue);
  if (!value) throw new Error("useCast must be used inside CastProvider");
  return value;
}
