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
   * - `null` — UNKNOWN/unrated (the NewPipe fallback search, or a
   *   `related()` row). Kid roles fail closed on an unknown rating.
   */
  explicit: boolean | null;
  source: MediaSource;
}

export interface ResolvedAudio {
  url: string;
  mimeType: string;
  contentLength: number | null;
  durationSeconds: number | null;
  expiresAt: number;
}