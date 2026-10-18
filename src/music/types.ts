export type MediaSource = "youtube_music";

export interface MediaTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  durationSeconds: number | null;
  artworkUrl: string | null;
  /** YouTube explicit flag; the player hides these for child/pet roles. */
  explicit: boolean;
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
