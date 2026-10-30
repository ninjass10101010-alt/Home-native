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
   * - `true` — badged explicit (YouTube sent a `MUSIC_EXPLICIT_BADGE`).
   * - `false` — **not marked explicit**: YouTube's search response carries no
   *   `MUSIC_EXPLICIT_BADGE` on this row. The badge MARKS the explicit tracks;
   *   it does not certify the rest, so `false` is "not marked explicit", never
   *   "rated clean".
   * - `null` — UNKNOWN/unrated (the NewPipe fallback path, or a `related()`
   *   row). An unknown rating is no rating at all: kid roles fail closed on
   *   it (see `src/music/explicit.ts`).
   */
  explicit: boolean | null;
  source: MediaSource;
}

export type RepeatMode = "off" | "all" | "one";

/**
 * One entry of the family's own deny-list.
 *
 * This is NOT a content rating: the family decides what stays away from the
 * kids. It is the SECOND signal beside the one-sided YouTube badge — the
 * badge MARKS the explicit tracks but does not certify the rest, so an
 * unbadged explicit song can still reach a kid. A denied term hides the
 * matching tracks from the kid roles (child/pet/guest), never from a parent.
 */
export interface DenyEntry {
  /** The parent's typed term, kept as typed for display. */
  term: string;
  addedAt: number;
}

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
  /**
   * The track's rating at the time it was saved, TRI-STATE (the same
   * contract as `MediaTrack.explicit`): `true` = badged explicit, `false` =
   * not marked explicit, `null` = unknown. The tray is a track surface, so
   * a kid may only see a row that says "not marked explicit" — a download
   * written before this key existed loads as UNKNOWN and stays hidden.
   */
  explicit: boolean | null;
  fileUri: string;
  bytes: number;
  savedAt: number;
}

export interface FavoriteArtist {
  name: string;
  artworkUrl?: string | null;
  savedAt: number;
}

export interface RecommendedArtist {
  name: string;
  genre: string;
  reason: string;
  artworkUrl?: string | null;
}
