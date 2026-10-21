export type MediaSource = "youtube_music";

export interface MediaTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  durationSeconds: number | null;
  artworkUrl: string | null;
  /**
   * YouTube's explicit rating, TRI-STATE:
   * - `true` — badged explicit.
   * - `false` — rated clean.
   * - `null` — UNKNOWN/unrated (the NewPipe fallback path, or a `related()`
   *   row). An unknown rating is not a clean rating: kid roles fail closed
   *   on it (see `src/music/explicit.ts`).
   */
  explicit: boolean | null;
  source: MediaSource;
}

export type RepeatMode = "off" | "all" | "one";

export interface QueueState {
  /** Playback order (shuffled or original). */
  tracks: MediaTrack[];
  /** Original order, used to unshuffle. */
  baseTracks: MediaTrack[];
  index: number;
  repeat: RepeatMode;
  shuffle: boolean;
}

export interface DownloadEntry {
  id: string;
  title: string;
  artist: string;
  album: string;
  durationSeconds: number | null;
  artworkUrl: string | null;
  fileUri: string;
  bytes: number;
  savedAt: number;
}
