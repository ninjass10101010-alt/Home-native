import React from "react";
import { Directory, File, Paths } from "expo-file-system";
import { AudioModule, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { resolveAudio } from "../../modules/youtube-engine";
import { useAuth } from "../state/AuthProvider";
import {
  appendHistory,
  DOWNLOAD_CAP_BYTES,
  loadDownloads,
  loadHistory,
  loadMusicSettings,
  removeDownloadEntry,
  saveDownloads,
  saveMusicSettings,
  totalDownloadBytes,
  upsertDownload,
  type MusicSettings,
} from "./library";
import {
  createQueue,
  cycleRepeat,
  moveInQueue,
  nextIndex,
  previousIndex,
  removeAt,
  toggleShuffle,
} from "./queue";
import {
  findVisibleIndex,
  isExplicitHidden,
  visibleTracks,
  type ExplicitPolicy,
} from "./explicit";
import type { DownloadEntry, MediaTrack, QueueState, RepeatMode } from "./types";

/**
 * The downloads directory — resolved LAZILY, not at module load.
 * `Paths.document` throws on web (expo-file-system is native-only), and a
 * module-scope read of it broke the whole app tree on the web preview
 * (the music provider is mounted in the root layout, so the throw took the
 * entire wall down — including the paint audit's web probe).
 */
export function musicDir(): string {
  try {
    return `${Paths.document.uri}music/`;
  } catch {
    return "";
  }
}

export interface PlaybackValue {
  current: MediaTrack | null;
  queue: MediaTrack[];
  index: number;
  playing: boolean;
  position: number;
  duration: number;
  buffering: boolean;
  repeat: RepeatMode;
  shuffle: boolean;
  error: string | null;
  downloads: DownloadEntry[];
  downloadBytes: number;
  history: MediaTrack[];
  settings: MusicSettings;
  /**
   * The role-aware explicit policy the viewer is under RIGHT NOW.
   *
   * The provider owns it (it knows who is watching) and every surface reads
   * it from here, so the rule can never drift between the queue, the
   * history, the downloads tray and the chrome.
   */
  policy: ExplicitPolicy;
  play: (track: MediaTrack, queue?: MediaTrack[]) => Promise<void>;
  playQueueAt: (tracks: MediaTrack[], index: number) => Promise<void>;
  toggle: () => void;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  seek: (seconds: number) => Promise<void>;
  setRepeat: (mode: RepeatMode) => void;
  cycleRepeatMode: () => void;
  toggleShuffleMode: () => void;
  addToQueue: (track: MediaTrack) => void;
  removeFromQueue: (index: number) => void;
  moveQueueItem: (from: number, to: number) => void;
  downloadCurrent: () => Promise<void>;
  removeDownload: (id: string) => Promise<void>;
  setExplicitFilter: (enabled: boolean) => void;
}

const Ctx = React.createContext<PlaybackValue | null>(null);

function localFileFor(id: string): File {
  return new File(musicDir(), `${id}.m4a`);
}

/**
 * Resolve the playable URL on-device. Engine failures surface as the stable
 * JS-land code `resolve_failed`; the raw message is only for other errors.
 */
async function resolveStreamUrl(id: string): Promise<string> {
  try {
    return (await resolveAudio(id)).url;
  } catch {
    throw new Error("resolve_failed");
  }
}

export function PlaybackProvider({ children }: { children: React.ReactNode }) {
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);

  /**
   * WHO IS WATCHING.
   *
   * The viewer comes from the auth layer (the AuthProvider sits ABOVE this
   * one in `app/_layout.tsx`), so the explicit policy is role-aware: a parent
   * sees everything, and every other role — a kid, a pet, and a signed-out
   * guest (whose member is null) — FAILS CLOSED. See `src/music/explicit.ts`.
   */
  const { member } = useAuth();
  const isParent = member?.role === "parent";

  const [queue, setQueue] = React.useState<QueueState>(() => createQueue([], -1));
  const [error, setError] = React.useState<string | null>(null);
  const [downloads, setDownloads] = React.useState<DownloadEntry[]>([]);
  const [history, setHistory] = React.useState<MediaTrack[]>([]);
  const [settings, setSettings] = React.useState<MusicSettings>({
    repeat: "off",
    shuffle: false,
    explicitFilter: true,
  });
  const finishedRef = React.useRef<string | null>(null);
  const startingRef = React.useRef(false);
  const playerRef = React.useRef(player);
  const queueRef = React.useRef(queue);

  // The filter FAILS CLOSED: only an explicit `false` turns it off, so a
  // persisted payload written before the key existed can never disable the
  // family filter.
  const policy = React.useMemo<ExplicitPolicy>(
    () => ({ isParent, filterOn: settings.explicitFilter !== false }),
    [isParent, settings.explicitFilter]
  );

  const current = queue.index >= 0 ? queue.tracks[queue.index] ?? null : null;
  const position = status?.currentTime ?? 0;
  const duration = status?.duration ?? current?.durationSeconds ?? 0;
  const playing = !!status?.playing;

  React.useEffect(() => { playerRef.current = player; }, [player]);
  React.useEffect(() => { queueRef.current = queue; }, [queue]);

  React.useEffect(() => {
    void AudioModule.setAudioModeAsync({
      shouldPlayInBackground: true,
      interruptionMode: "doNotMix",
      playsInSilentMode: true,
    }).catch(() => {});
    void Promise.all([loadDownloads(), loadMusicSettings(), loadHistory()]).then(([list, saved, recent]) => {
      setDownloads(list);
      setSettings(saved);
      setHistory(recent);
      setQueue((q) => ({ ...q, repeat: saved.repeat, shuffle: saved.shuffle }));
    });
  }, []);

  const persistSettings = React.useCallback((next: MusicSettings) => {
    setSettings(next);
    void saveMusicSettings(next);
  }, []);

  /**
   * THE VIEWER CHANGED (a parent signed out and a kid signed in, or the
   * family toggled the filter): the queue the new viewer may not see is
   * DROPPED, and a current track the new viewer may not see STOPS the
   * playback.
   *
   * This is the reachable hole the search-results filter could not close: a
   * parent queues an explicit track, the kid signs in, and the track must
   * not keep playing with its title on the wall, in the MiniPlayer, in the
   * queue list or in "Recently played".
   */
  React.useEffect(() => {
    const state = queueRef.current;
    const currentTrack = state.index >= 0 ? state.tracks[state.index] : undefined;
    const hiddenCurrent = !!currentTrack && isExplicitHidden(currentTrack, policy);
    const tracks = visibleTracks(state.tracks, policy);
    const baseTracks = visibleTracks(state.baseTracks, policy);
    const index = hiddenCurrent
      ? -1
      : currentTrack
        ? tracks.findIndex((track) => track.id === currentTrack.id)
        : state.index;
    const changed =
      hiddenCurrent ||
      tracks.length !== state.tracks.length ||
      baseTracks.length !== state.baseTracks.length ||
      index !== state.index;
    if (!changed) return;
    if (hiddenCurrent) {
      // Stop the sound AND clear the lock screen: the title must not survive
      // on the panel (or on the lock screen) for a viewer who may not see it.
      playerRef.current.pause();
      playerRef.current.setActiveForLockScreen?.(false);
    }
    setQueue({ ...state, tracks, baseTracks, index });
  }, [policy]);

  const startTrack = React.useCallback(
    async (track: MediaTrack) => {
      startingRef.current = true;
      finishedRef.current = null;
      setError(null);
      try {
        const local = localFileFor(track.id);
        const source = local.exists
          ? { uri: local.uri }
          : { uri: await resolveStreamUrl(track.id) };

        player.replace(source);
        player.play();
        player.setActiveForLockScreen?.(true, {
          title: track.title,
          artist: track.artist,
          albumTitle: track.album,
          artworkUrl: track.artworkUrl ?? undefined,
        });
        void appendHistory(track).then(setHistory).catch(() => {});
      } catch (e) {
        setError(e instanceof Error ? e.message : "play_failed");
      } finally {
        startingRef.current = false;
      }
    },
    [player]
  );

  const play = React.useCallback(
    async (track: MediaTrack, tracks?: MediaTrack[]) => {
      // Fail closed: a track the viewer may not see never plays, and it
      // never joins the queue the transport walks.
      if (isExplicitHidden(track, policy)) return;
      const source = tracks && tracks.length > 0 ? tracks : [track];
      const list = visibleTracks(source, policy);
      if (list.length === 0) return;
      const index = Math.max(0, list.findIndex((item) => item.id === track.id));
      setQueue(createQueue(list, index, settings.repeat));
      await startTrack(list[index] ?? track);
    },
    [policy, settings.repeat, startTrack]
  );

  const playQueueAt = React.useCallback(
    async (tracks: MediaTrack[], index: number) => {
      const target = tracks[index];
      if (!target) return;
      // Fail closed: the row the caller picked is played only when the
      // viewer may see it.
      if (isExplicitHidden(target, policy)) return;
      const list = visibleTracks(tracks, policy);
      if (list.length === 0) return;
      const safe = Math.max(0, list.findIndex((track) => track.id === target.id));
      setQueue(createQueue(list, safe, settings.repeat));
      await startTrack(list[safe]);
    },
    [policy, settings.repeat, startTrack]
  );

  const goTo = React.useCallback(
    async (index: number) => {
      if (index < 0) return;
      // The transport SKIPS what the viewer may not see.
      const target = findVisibleIndex(queue.tracks, index, policy, 1, false);
      if (target < 0) return;
      const track = queue.tracks[target];
      if (!track) return;
      setQueue((q) => ({ ...q, index: target }));
      await startTrack(track);
    },
    [policy, queue.tracks, startTrack]
  );

  const next = React.useCallback(async () => {
    if (queue.tracks.length === 0) return;
    const index = nextIndex(queue);
    if (index === queue.index) {
      await player.seekTo(0);
      player.play();
      return;
    }
    const target = findVisibleIndex(queue.tracks, index, policy, 1, queue.repeat === "all");
    if (target < 0) {
      player.pause();
      return;
    }
    await goTo(target);
  }, [goTo, player, policy, queue]);

  const previous = React.useCallback(async () => {
    if (position > 3) {
      await player.seekTo(0);
      return;
    }
    if (queue.tracks.length === 0) return;
    const index = previousIndex(queue);
    const target = findVisibleIndex(queue.tracks, index, policy, -1, queue.repeat === "all");
    if (target < 0) {
      player.pause();
      return;
    }
    await goTo(target);
  }, [goTo, player, policy, position, queue]);

  React.useEffect(() => {
    if (!status?.didJustFinish) return;
    if (startingRef.current) return;
    const key = current?.id ?? "none";
    if (finishedRef.current === key) return;
    finishedRef.current = key;
    const index = nextIndex(queue, { auto: true });
    if (index < 0) {
      player.pause();
      return;
    }
    // NEVER roll into a track the viewer may not see: the queue the effect
    // still holds can predate the viewer's change, so the gate is checked
    // here too, not only where the queue is built.
    const target = findVisibleIndex(queue.tracks, index, policy, 1, queue.repeat === "all");
    if (target < 0) {
      player.pause();
      return;
    }
    queueMicrotask(() => { void goTo(target); });
  }, [current?.id, goTo, player, policy, queue, status?.didJustFinish]);

  const toggle = React.useCallback(() => {
    if (playing) player.pause();
    else player.play();
  }, [player, playing]);

  const seek = React.useCallback(
    async (seconds: number) => {
      const target = Math.min(Math.max(seconds, 0), duration || seconds);
      await player.seekTo(target);
    },
    [duration, player]
  );

  const setRepeat = React.useCallback(
    (mode: RepeatMode) => {
      setQueue((q) => ({ ...q, repeat: mode }));
      persistSettings({ ...settings, repeat: mode });
    },
    [persistSettings, settings]
  );

  const cycleRepeatMode = React.useCallback(() => {
    setRepeat(cycleRepeat(queue.repeat));
  }, [queue.repeat, setRepeat]);

  const toggleShuffleMode = React.useCallback(() => {
    setQueue((q) => toggleShuffle(q));
    persistSettings({ ...settings, shuffle: !settings.shuffle });
  }, [persistSettings, settings]);

  const addToQueue = React.useCallback(
    (track: MediaTrack) => {
      // Fail closed: a track the viewer may not see never joins the queue.
      if (isExplicitHidden(track, policy)) return;
      setQueue((q) => {
        if (q.tracks.length === 0) return createQueue([track], 0, q.repeat);
        return { ...q, tracks: [...q.tracks, track], baseTracks: [...q.baseTracks, track] };
      });
    },
    [policy]
  );

  const removeFromQueue = React.useCallback((index: number) => {
    setQueue((q) => removeAt(q, index));
  }, []);

  const moveQueueItem = React.useCallback((from: number, to: number) => {
    setQueue((q) => moveInQueue(q, from, to));
  }, []);

  const downloadCurrent = React.useCallback(async () => {
    if (!current) return;
    const dest = localFileFor(current.id);
    try {
      const directory = new Directory(musicDir());
      if (!directory.exists) directory.create({ intermediates: true, idempotent: true });
      if (!dest.exists) {
        if (totalDownloadBytes(downloads) >= DOWNLOAD_CAP_BYTES) {
          setError("Download limit reached (2 GB). Delete a track first.");
          return;
        }
        const url = await resolveStreamUrl(current.id);
        await File.downloadFileAsync(url, dest, { idempotent: true });
      }
      const entry: DownloadEntry = {
        id: current.id,
        title: current.title,
        artist: current.artist,
        album: current.album,
        durationSeconds: current.durationSeconds,
        artworkUrl: current.artworkUrl,
        // The rating travels WITH the download: the tray is a track surface,
        // so a kid may only see a row that says "not marked explicit".
        explicit: current.explicit,
        fileUri: dest.uri,
        bytes: dest.size ?? 0,
        savedAt: Date.now(),
      };
      const list = upsertDownload(downloads, entry);
      setDownloads(list);
      await saveDownloads(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "download_failed");
    }
  }, [current, downloads]);

  const removeDownload = React.useCallback(
    async (id: string) => {
      const file = localFileFor(id);
      try {
        if (file.exists) file.delete();
      } catch {
        // A missing file is already the desired end state.
      }
      const list = removeDownloadEntry(downloads, id);
      setDownloads(list);
      await saveDownloads(list);
    },
    [downloads]
  );

  const setExplicitFilter = React.useCallback(
    (enabled: boolean) => persistSettings({ ...settings, explicitFilter: enabled }),
    [persistSettings, settings]
  );

  /**
   * What the provider HANDS OUT is what the viewer may see: the downloads
   * tray and the history are device-global, so they are filtered against
   * the policy here — a kid never receives a row they may not see.
   */
  const visibleDownloads = React.useMemo(
    () => visibleTracks(downloads, policy),
    [downloads, policy]
  );
  const visibleHistory = React.useMemo(
    () => visibleTracks(history, policy),
    [history, policy]
  );

  const value = React.useMemo<PlaybackValue>(
    () => ({
      current,
      queue: queue.tracks,
      index: queue.index,
      playing,
      position,
      duration,
      buffering: !!status?.isBuffering,
      repeat: queue.repeat,
      shuffle: queue.shuffle,
      error,
      downloads: visibleDownloads,
      downloadBytes: totalDownloadBytes(visibleDownloads),
      history: visibleHistory,
      settings,
      policy,
      play,
      playQueueAt,
      toggle,
      next,
      previous,
      seek,
      setRepeat,
      cycleRepeatMode,
      toggleShuffleMode,
      addToQueue,
      removeFromQueue,
      moveQueueItem,
      downloadCurrent,
      removeDownload,
      setExplicitFilter,
    }),
    [
      addToQueue, current, cycleRepeatMode, downloadCurrent, duration, error,
      moveQueueItem, next, play, playQueueAt, playing, policy, position, previous, queue.index,
      queue.repeat, queue.shuffle, queue.tracks, removeDownload, removeFromQueue, seek,
      setExplicitFilter, setRepeat, settings, status?.isBuffering, toggle, toggleShuffleMode,
      visibleDownloads, visibleHistory,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlayback(): PlaybackValue {
  const value = React.useContext(Ctx);
  if (!value) throw new Error("usePlayback must be used inside PlaybackProvider");
  return value;
}
