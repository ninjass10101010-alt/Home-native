export type MediaSource = "youtube_music";

export interface MediaTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  durationSeconds: number | null;
  artworkUrl: string | null;
  explicit: boolean;
  source: MediaSource;
}

export interface ResolvedAudio {
  url: string;
  mimeType: string;
  contentLength: number | null;
  durationSeconds: number | null;
  expiresAt: number;
}