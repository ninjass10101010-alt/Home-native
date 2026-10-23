import React from "react";
import { Directory, File, Paths } from "expo-file-system";
import { AudioModule, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { resolveAudio } from "../../modules/youtube-engine";
import { useAuth } from "../state/AuthProvider";
import {
  appendHistory,
  DOWNLOAD_CAP_BYTES,
  loadDenylist,
  loadDownloads,
  loadHistory,
  loadMusicSettings,
  removeDownloadEntry,
  saveDenylist,
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
  isContentHidden,
  normalizeTerm,
  visibleTracks,
  type ContentPolicy,
} from "./explicit";
import type { DenyEntry, DownloadEntry, MediaTrack, QueueState, RepeatMode } from "./types";

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
   * The family's own deny-list, as stored.
   *
   * The terms are kept AS TYPED (for display); the POLICY below carries them
   * normalized, so the rule matches the way the family expects.
   */
  denylist: DenyEntry[];
  /**
   * The role-aware CONTENT policy the viewer is under RIGHT NOW.
   *
   * The provider owns it (it knows who is watching, what the family setting
   * says and what the family has blocked) and every surface reads it from
   * here, so the rule can never drift between the queue, the history, the
   * downloads tray and the chrome.
   */
  policy: ContentPolicy;
  play: (track: MediaTrack, queue?: MediaTrack[]) => Promise<void>;
  playQueueAt: (tracks: MediaTrack[], index: number) => Promise<void>;
  toggle: () => void;
  next: () => Promise<void>;
  /**
   * The cast transport's queue step.
   *
   * It moves `index` through the SAME visibility gate as `next`, and returns
   * the track the receiver should load — WITHOUT touching expo-audio. Local
   * playback must stay out of the cast path: the sound is on the TV, not on
   * the tablet.
   */
  advanceForCast: (auto: boolean) => MediaTrack | null;
  /**
   * The cast transport's backward queue step.
   *
   * Mirrors `previous`'s queue semantics through the SAME visibility gate,
   * returns the track the receiver should load, and NEVER touches expo-audio.
   */
  previousForCast: () => MediaTrack | null;
  /**
   * Installs the live cast session's loader as the destination for every
   * start path, or clears it (`null`) when no session is live.
   *
   * While it is installed, `play`, `playQueueAt`, `next`, `previous` and the
   * auto-advance all hand the track to the receiver and NEVER touch
   * expo-audio. Installing it also stops whatever the local player was doing,
   * so a session that goes live mid-track leaves no local sound behind.
   */
  setCastSink: (sink: ((track: MediaTrack) => Promise<void>) | null) => void;
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
  /** Adds a term to the family's deny-list (persisted; live at once). */
  addDenied: (term: string) => Promise<void>;
  /** Removes every entry whose term matches (persisted; live at once). */
  removeDenied: (term: string) => Promise<void>;
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
   * guest — FAILS CLOSED. See `src/music/explicit.ts`.
   *
   * The parent's flag comes from the CAPABILITY role (`role`), never from the
   * cached display profile (`member`): the device may remember a parent while
   * no live session confirmed it, and a stale cached parent must not unlock
   * explicit content or the family's blocked artists.
   */
  const { role } = useAuth();
  const isParent = role === "parent";

  const [queue, setQueue] = React.useState<QueueState>(() => createQueue([], -1));
  const [error, setError] = React.useState<string | null>(null);
  const [downloads, setDownloads] = React.useState<DownloadEntry[]>([]);
  const [history, setHistory] = React.useState<MediaTrack[]>([]);
  const [denylist, setDenylist] = React.useState<DenyEntry[]>([]);
  const [settings, setSettings] = React.useState<MusicSettings>({
    repeat: "off",
    shuffle: false,
    explicitFilter: true,
  });
  const playerRef = React.useRef(player);
  /**
   * The live cast session's track loader.
   *
   * It is a REF, not state: the transport callbacks read it at the moment
   * they run, and installing one must not re-render the whole music tree.
   */
  const castSinkRef = React.useRef<((track: MediaTrack) => Promise<void>) | null>(null);
  /**
   * The queue as it stands RIGHT NOW.
   *
   * The viewer-change effect below runs when the POLICY changes, which may
   * be long after the queue was last written — so it reads the queue from
   * here instead of from the render that changed the policy. It is read
   * inside that effect, never during render.
   */
  const queueRef = React.useRef(queue);
  /**
   * The auto-advance effect's view of "a start is in flight".
   *
   * An effect must read the LATEST committed value at the moment it runs, so
   * this is a REF — but it is written from an EFFECT (never during render)
   * and it is never touched by the callbacks the provider hands out.
   */
  const startingRef = React.useRef(false);
  /**
   * The track whose finish the auto-advance has already handled.
   *
   * The auto-advance effect owns it: it writes it there and in the start
   * bookkeeping below — never in a callback the provider hands out.
   */
  const finishedRef = React.useRef<string | null>(null);
  /**
   * The START bookkeeping, in state.
   *
   * Two facts the auto-advance needs, and neither of them may live in a ref
   * the render-visible callbacks touch:
   *
   * - `inFlight`: a track start is running (the stream is being resolved).
   *   The finish flag that is still on screen then belongs to the PREVIOUS
   *   track, so the transport must not roll forward while a start is in
   *   flight.
   * - `seq`: every start bumps it, so the "this finish was already handled"
   *   memory can be cleared on EVERY start — the same track may finish
   *   again (repeat one), and the next track's finish must not be swallowed
   *   by the previous one's key.
   */
  const [start, setStart] = React.useState({ seq: 0, inFlight: false });
  /**
   * Whether the family's own list has been READ from the store yet.
   *
   * The persist effect is gated on it: until the store has answered, the
   * list in state may still be empty, and writing that back would wipe what
   * the family already blocked.
   */
  const [denylistLoaded, setDenylistLoaded] = React.useState(false);

  // The filter FAILS CLOSED: only an explicit `false` turns it off, so a
  // persisted payload written before the key existed can never disable the
  // family filter.
  //
  // The policy carries the family's own list NORMALIZED, so a term added a
  // moment ago applies at once — no restart, no reload.
  const policy = React.useMemo<ContentPolicy>(
    () => ({
      isParent,
      filterOn: settings.explicitFilter !== false,
      denied: denylist.map((entry) => normalizeTerm(entry.term)),
    }),
    [isParent, settings.explicitFilter, denylist]
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
    // The family's own list is read with the other stores. It MERGES into the
    // list as it stands: a term the parent added before the store answered
    // is kept — and it wins over the stored copy of the SAME term, because
    // the parent typed it a moment ago — so it is never lost and never
    // written twice.
    void loadDenylist().then((blocked) => {
      setDenylist((prev) => {
        const kept = blocked.filter(
          (entry) => !prev.some((early) => normalizeTerm(early.term) === normalizeTerm(entry.term))
        );
        return [...kept, ...prev];
      });
      setDenylistLoaded(true);
    });
    void Promise.all([loadDownloads(), loadMusicSettings(), loadHistory()]).then(([list, saved, recent]) => {
      setDownloads(list);
      setSettings(saved);
      setHistory(recent);
      setQueue((q) => ({ ...q, repeat: saved.repeat, shuffle: saved.shuffle }));
    });
  }, []);

  /**
   * The family's own list is PERSISTED from here, not from the callbacks.
   *
   * The callbacks only change the state; the write happens in an effect, so
   * it is gated on `denylistLoaded` — the initial empty state can never wipe
   * what the family already blocked, and a term added before the store
   * answered is written out together with the stored terms.
   */
  React.useEffect(() => {
    if (!denylistLoaded) return;
    void saveDenylist(denylist);
  }, [denylist, denylistLoaded]);

  const persistSettings = React.useCallback((next: MusicSettings) => {
    setSettings(next);
    void saveMusicSettings(next);
  }, []);

  /**
   * THE VIEWER CHANGED (a parent signed out and a kid signed in, the family
   * toggled the filter, or a term was blocked): the queue the new viewer may
   * not see is DROPPED, and a current track the new viewer may not see STOPS
   * the playback.
   *
   * This is the reachable hole the search-results filter could not close: a
   * parent queues an explicit track, the kid signs in, and the track must
   * not keep playing with its title on the wall, in the MiniPlayer, in the
   * queue list or in "Recently played".
   *
   * The SAME policy object carries both rules, so a track the family blocked
   * is dropped and stopped exactly like a badged one.
   *
   * The queue is read from a REF — the effect runs when the POLICY changes,
   * which may be long after the queue itself was last written, so it needs
   * the queue as it stands RIGHT NOW, not the one the render that changed
   * the policy happened to hold. The ref is read here, inside an effect, and
   * never during render.
   */
  React.useEffect(() => {
    const state = queueRef.current;
    const currentTrack = state.index >= 0 ? state.tracks[state.index] : undefined;
    const hiddenCurrent = !!currentTrack && isContentHidden(currentTrack, policy);
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

  /**
   * Installs/clears the cast sink. Stable by design: CastProvider puts it in
   * an effect's dependency list, and a changing identity would make that
   * effect churn. Installing a sink stops the local player at once.
   */
  const setCastSink = React.useCallback(
    (sink: ((track: MediaTrack) => Promise<void>) | null) => {
      castSinkRef.current = sink;
      if (sink) playerRef.current.pause();
    },
    []
  );

  const startTrack = React.useCallback(
    async (track: MediaTrack) => {
      // A start is IN FLIGHT from here on: the finish flag that is still on
      // the screen belongs to the PREVIOUS track, so the transport must not
      // roll forward while the stream is being resolved.
      //
      // The bookkeeping is STATE, not a ref — the callbacks the provider
      // hands out never touch a ref, and the auto-advance effect reads the
      // committed value through its own ref view (see below).
      setStart((s) => ({ seq: s.seq + 1, inFlight: true }));
      setError(null);
      try {
        const sink = castSinkRef.current;
        if (sink) {
          // A cast session is live: the sound is on the receiver, so the
          // local player is never replaced, started or given lock-screen
          // metadata. Every start path funnels through here.
          await sink(track);
        } else {
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
        }
        void appendHistory(track).then(setHistory).catch(() => {});
      } catch (e) {
        setError(e instanceof Error ? e.message : "play_failed");
      } finally {
        setStart((s) => (s.inFlight ? { ...s, inFlight: false } : s));
      }
    },
    [player]
  );

  const play = React.useCallback(
    async (track: MediaTrack, tracks?: MediaTrack[]) => {
      // Fail closed: a track the viewer may not see never plays, and it
      // never joins the queue the transport walks.
      if (isContentHidden(track, policy)) return;
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
      if (isContentHidden(target, policy)) return;
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
      // A manual "next" at the end (or in repeat-one) restarts the current
      // track. While casting, that restart happens ON the receiver.
      const sink = castSinkRef.current;
      if (sink) {
        const track = queue.tracks[queue.index];
        if (track) await sink(track);
        return;
      }
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

  /**
   * The cast-safe step: choose the next visible track and move the queue's
   * index, but NEVER start local audio. The caller (CastProvider) loads the
   * returned track on the receiver.
   *
   * It mirrors `next`'s semantics exactly:
   * - repeat-one with `auto` stays on the same index (the same track is
   *   loaded again on the receiver);
   * - a repeat-off queue at the end: an AUTO advance returns null (nothing
   *   to advance to), while a MANUAL advance restarts the current track —
   *   exactly what `next()` does when there is no next index;
   * - a hidden row is SKIPPED, and a direction with nothing visible returns
   *   null, never a hidden fallback.
   */
  const advanceForCast = React.useCallback(
    (auto: boolean): MediaTrack | null => {
      if (queue.tracks.length === 0) return null;
      const index = nextIndex(queue, { auto });
      if (index < 0) return null;
      // NEVER move into a track the viewer may not see: the queue closure can
      // predate the policy change, so the gate is checked HERE too.
      const target = findVisibleIndex(queue.tracks, index, policy, 1, queue.repeat === "all");
      if (target < 0) return null;
      const track = queue.tracks[target];
      if (!track) return null;
      setQueue((q) => ({ ...q, index: target }));
      return track;
    },
    [policy, queue]
  );

  /**
   * The cast-safe backward step: choose the previous visible track and move
   * the queue's index, but NEVER start local audio. The caller (CastProvider)
   * loads the returned track on the receiver.
   */
  const previousForCast = React.useCallback((): MediaTrack | null => {
    if (queue.tracks.length === 0) return null;
    const index = previousIndex(queue);
    if (index < 0) return null;
    const target = findVisibleIndex(queue.tracks, index, policy, -1, queue.repeat === "all");
    if (target < 0) return null;
    const track = queue.tracks[target];
    if (!track) return null;
    setQueue((q) => ({ ...q, index: target }));
    return track;
  }, [policy, queue]);

  const previous = React.useCallback(async () => {
    if (position > 3) {
      // Past three seconds "previous" restarts. While casting, the receiver
      // gets the reload, never the paused local player.
      const sink = castSinkRef.current;
      if (sink) {
        const track = queue.index >= 0 ? queue.tracks[queue.index] : null;
        if (track) await sink(track);
        return;
      }
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

  /**
   * The auto-advance effect's REF VIEW of "a start is in flight".
   *
   * The state is the truth; the ref is what the effect reads, because an
   * effect must read the LATEST committed value at the moment it runs — a
   * state captured in the render scope can be one commit behind. It is
   * written HERE, from an effect, and never during render.
   */
  React.useEffect(() => {
    startingRef.current = start.inFlight;
  }, [start.inFlight]);

  /**
   * Every start clears the "this finish was already handled" memory.
   *
   * The same track may finish again (repeat one), and the next track's
   * finish must not be swallowed by the previous one's key — so the memory
   * is cleared on EVERY start, not only when the track changes.
   */
  React.useEffect(() => {
    finishedRef.current = null;
  }, [start.seq]);

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
    // A live cast owns the sound: a surface that only knows `toggle` (the
    // wall widget) must start the receiver, never the paused local player.
    const sink = castSinkRef.current;
    if (sink) {
      const track = queue.index >= 0 ? queue.tracks[queue.index] : null;
      if (track) void sink(track).catch(() => {});
      return;
    }
    if (playing) player.pause();
    else player.play();
  }, [player, playing, queue.index, queue.tracks]);

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
      if (isContentHidden(track, policy)) return;
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
   * The family's own list — the SECOND signal beside the badge.
   *
   * A term the parent types is kept AS TYPED (so the editor can show it
   * back), and the POLICY carries it normalized, so the rule applies at once:
   * a term added a moment ago blocks the next track the kid asks for, with
   * no restart and no reload.
   *
   * A blank term is ignored (an empty term must never match anything) and a
   * duplicate is ignored too — the same term twice is still one rule, so the
   * list stays the family's, not the app's.
   *
   * The list is changed with a FUNCTIONAL update, so the callback always
   * works on the list as it stands — the state may still be filling up from
   * the store when the parent types the first term. The write itself is the
   * persist effect's job (see above): it waits for the store, so a term
   * added in the first moments can never overwrite what the family already
   * blocked.
   */
  const addDenied = React.useCallback(async (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    const normalized = normalizeTerm(trimmed);
    setDenylist((prev) => {
      if (prev.some((entry) => normalizeTerm(entry.term) === normalized)) return prev;
      return [...prev, { term: trimmed, addedAt: Date.now() }];
    });
  }, []);

  /**
   * Removes EVERY entry whose term matches — the family may have added the
   * same word twice, and unblocking must unblock it completely.
   */
  const removeDenied = React.useCallback(async (term: string) => {
    const normalized = normalizeTerm(term);
    if (!normalized) return;
    setDenylist((prev) => {
      const next = prev.filter((entry) => normalizeTerm(entry.term) !== normalized);
      return next.length === prev.length ? prev : next;
    });
  }, []);

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

  /* eslint-disable react-hooks/refs -- the transport callbacks read the player/cast refs only when a user action invokes them, never during render */
  const value = React.useMemo<PlaybackValue>(
    () => ({
      current,
      queue: visibleTracks(queue.tracks, policy),
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
      denylist,
      policy,
      play,
      playQueueAt,
      toggle,
      next,
      advanceForCast,
      previousForCast,
      setCastSink,
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
      addDenied,
      removeDenied,
    }),
    [
      addDenied, addToQueue, advanceForCast, current, cycleRepeatMode, downloadCurrent, duration,
      error, denylist, moveQueueItem, next, play, playQueueAt, playing, policy, position, previous,
      previousForCast,
      queue.index,
      queue.repeat, queue.shuffle, queue.tracks, removeDenied, removeDownload, removeFromQueue, seek,
      setCastSink, setExplicitFilter, setRepeat, settings, status?.isBuffering, toggle, toggleShuffleMode,
      visibleDownloads, visibleHistory,
    ]
  );
  /* eslint-enable react-hooks/refs */

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlayback(): PlaybackValue {
  const value = React.useContext(Ctx);
  if (!value) throw new Error("usePlayback must be used inside PlaybackProvider");
  return value;
}
