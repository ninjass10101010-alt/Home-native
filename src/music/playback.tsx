import React from "react";
import { Directory, File, Paths } from "expo-file-system";
import { AudioModule, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { getBaseUrl } from "../api/config";
import { loadSessionCookie } from "../api/session";
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
import type { DownloadEntry, MediaTrack, QueueState, RepeatMode } from "./types";

export const MUSIC_DIR = `${Paths.document.uri}music/`;

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
  return new File(MUSIC_DIR, `${id}.m4a`);
}

export function PlaybackProvider({ children }: { children: React.ReactNode }) {
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);

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

  const current = queue.index >= 0 ? queue.tracks[queue.index] ?? null : null;
  const position = status?.currentTime ?? 0;
  const duration = status?.duration ?? current?.durationSeconds ?? 0;
  const playing = !!status?.playing;

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

  const startTrack = React.useCallback(
    async (track: MediaTrack) => {
      startingRef.current = true;
      finishedRef.current = null;
      setError(null);
      try {
        const cookie = await loadSessionCookie();
        const local = localFileFor(track.id);
        const source = local.exists
          ? { uri: local.uri }
          : {
              uri: `${getBaseUrl()}/api/media/stream?id=${encodeURIComponent(track.id)}`,
              headers: cookie ? { Cookie: `consuela_session=${cookie}` } : undefined,
            };

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
      const list = tracks && tracks.length > 0 ? tracks : [track];
      const index = Math.max(0, list.findIndex((item) => item.id === track.id));
      setQueue(createQueue(list, index, settings.repeat));
      await startTrack(list[index] ?? track);
    },
    [settings.repeat, startTrack]
  );

  const playQueueAt = React.useCallback(
    async (tracks: MediaTrack[], index: number) => {
      if (tracks.length === 0) return;
      const safe = Math.min(Math.max(index, 0), tracks.length - 1);
      setQueue(createQueue(tracks, safe, settings.repeat));
      await startTrack(tracks[safe]);
    },
    [settings.repeat, startTrack]
  );

  const goTo = React.useCallback(
    async (index: number) => {
      if (index < 0) return;
      const track = queue.tracks[index];
      if (!track) return;
      setQueue((q) => ({ ...q, index }));
      await startTrack(track);
    },
    [queue.tracks, startTrack]
  );

  const next = React.useCallback(async () => {
    const index = nextIndex(queue);
    if (index === queue.index) {
      await player.seekTo(0);
      player.play();
      return;
    }
    await goTo(index);
  }, [goTo, player, queue]);

  const previous = React.useCallback(async () => {
    if (position > 3) {
      await player.seekTo(0);
      return;
    }
    await goTo(previousIndex(queue));
  }, [goTo, player, position, queue]);

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
    queueMicrotask(() => { void goTo(index); });
  }, [current?.id, goTo, player, queue, status?.didJustFinish]);

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

  const addToQueue = React.useCallback((track: MediaTrack) => {
    setQueue((q) => {
      if (q.tracks.length === 0) return createQueue([track], 0, q.repeat);
      return { ...q, tracks: [...q.tracks, track], baseTracks: [...q.baseTracks, track] };
    });
  }, []);

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
      const directory = new Directory(MUSIC_DIR);
      if (!directory.exists) directory.create({ intermediates: true, idempotent: true });
      const cookie = await loadSessionCookie();
      if (!dest.exists) {
        if (totalDownloadBytes(downloads) >= DOWNLOAD_CAP_BYTES) {
          setError("Download limit reached (2 GB). Delete a track first.");
          return;
        }
        await File.downloadFileAsync(
          `${getBaseUrl()}/api/media/stream?id=${encodeURIComponent(current.id)}`,
          dest,
          { headers: cookie ? { Cookie: `consuela_session=${cookie}` } : undefined, idempotent: true }
        );
      }
      const entry: DownloadEntry = {
        id: current.id,
        title: current.title,
        artist: current.artist,
        album: current.album,
        durationSeconds: current.durationSeconds,
        artworkUrl: current.artworkUrl,
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
      downloads,
      downloadBytes: totalDownloadBytes(downloads),
      history,
      settings,
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
      addToQueue, current, cycleRepeatMode, downloadCurrent, downloads, duration, error, history,
      moveQueueItem, next, play, playQueueAt, playing, position, previous, queue.index,
      queue.repeat, queue.shuffle, queue.tracks, removeDownload, removeFromQueue, seek,
      setExplicitFilter, setRepeat, settings, status?.isBuffering, toggle, toggleShuffleMode,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlayback(): PlaybackValue {
  const value = React.useContext(Ctx);
  if (!value) throw new Error("usePlayback must be used inside PlaybackProvider");
  return value;
}
