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
  connect: (id: string) => Promise<void>;
  startCast: (track: MediaTrack) => Promise<void>;
  disconnect: () => Promise<void>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  seek: (seconds: number) => Promise<void>;
  advance: (auto: boolean) => Promise<void>;
}

interface CastClient {
  loadMedia: (request: { mediaInfo: ReturnType<typeof castMediaInfo>; autoplay: boolean }) => Promise<void>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  seek: (options: { position: number }) => Promise<void>;
}

const CastContextValue = React.createContext<CastValue | null>(null);

export function CastProvider({ children }: { children: React.ReactNode }) {
  const playback = usePlayback();
  const rawState = useCastState();
  const deviceList = useDevices();
  const devices = React.useMemo(() => toTargets(deviceList), [deviceList]);
  const session = useCastSession();
  const position = useStreamPosition();
  const status = useMediaStatus();
  const playbackPolicy = playback.policy;
  const playbackPlaying = playback.playing;
  const togglePlayback = playback.toggle;

  const [target, setTarget] = React.useState<CastTarget | null>(null);
  const [track, setTrack] = React.useState<MediaTrack | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const clientRef = React.useRef<CastClient | null>(null);
  const targetRef = React.useRef<CastTarget | null>(null);

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
    async (id: string) => {
      const chosen = devices.find((device) => device.id === id) ?? null;
      if (!chosen) return;
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
      } catch {
        clientRef.current = null;
        targetRef.current = null;
        setTarget(null);
        setTrack(null);
        setError(castErrorCopy(chosen.name));
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

  const advance = React.useCallback(async () => {}, []);

  const playing = status?.playerState === "playing";

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
    ]
  );

  return <CastContextValue.Provider value={value}>{children}</CastContextValue.Provider>;
}

export function useCast(): CastValue {
  const value = React.useContext(CastContextValue);
  if (!value) throw new Error("useCast must be used inside CastProvider");
  return value;
}
