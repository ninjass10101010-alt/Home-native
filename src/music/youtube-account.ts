import { api } from "../api/client";
import { getSessionCookie } from "../api/session";
import type {
  MediaTrack,
  YouTubeAccountPlaylist,
  YouTubeAccountStatus,
} from "./types";

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

export interface YouTubeConnectStartResult {
  authUrl: string;
  connectedAccountId: string;
  expiresAt: string | null;
}

export async function fetchYouTubeAccountState(): Promise<YouTubeAccountStatus> {
  if (!getSessionCookie()) {
    return { connected: false, pending: false, status: null, accountEmail: null };
  }
  try {
    const res = await api<{
      ok?: boolean;
      connected?: boolean;
      pending?: boolean;
      status?: string | null;
      accountEmail?: string | null;
    }>("/api/youtube/state");
    return {
      connected: res?.ok === true && res?.connected === true,
      pending: res?.pending === true,
      status: typeof res?.status === "string" ? res.status : null,
      accountEmail: typeof res?.accountEmail === "string" ? res.accountEmail : null,
    };
  } catch {
    return { connected: false, pending: false, status: null, accountEmail: null };
  }
}

export async function startYouTubeConnect(): Promise<YouTubeConnectStartResult> {
  const res = await api<{
    ok?: boolean;
    auth_url?: string;
    connected_account_id?: string;
    expires_at?: string | null;
    error?: string;
  }>("/api/google/composio/setup", {
    method: "POST",
    body: { toolkit: "youtube" },
  });
  if (!res?.ok || !res.auth_url || !res.connected_account_id) {
    throw new Error(res?.error ?? "Could not start YouTube account link.");
  }
  return {
    authUrl: res.auth_url,
    connectedAccountId: res.connected_account_id,
    expiresAt: res.expires_at ?? null,
  };
}

export async function checkYouTubeConnectStatus(): Promise<YouTubeAccountStatus> {
  const res = await api<{
    ok?: boolean;
    connected?: boolean;
    status?: string | null;
    account_email?: string | null;
  }>("/api/google/composio/status?toolkit=youtube");
  const status = typeof res?.status === "string" ? res.status : null;
  return {
    connected: res?.ok === true && res?.connected === true,
    pending:
      res?.connected !== true && (status === "INITIALIZING" || status === "INITIATED"),
    status,
    accountEmail: typeof res?.account_email === "string" ? res.account_email : null,
  };
}

export async function disconnectYouTubeAccount(): Promise<boolean> {
  const res = await api<{ ok?: boolean }>("/api/google/composio/disconnect", {
    method: "POST",
    body: { toolkit: "youtube" },
  });
  return res?.ok === true;
}

export async function fetchYouTubePlaylists(): Promise<YouTubeAccountPlaylist[]> {
  try {
    const res = await api<{ ok?: boolean; playlists?: YouTubeAccountPlaylist[] }>(
      "/api/youtube/playlists"
    );
    return res?.ok === true && Array.isArray(res.playlists) ? res.playlists : [];
  } catch {
    return [];
  }
}

export interface YouTubeRemoteTrack extends MediaTrack {
  playlistItemId: string;
}

export async function fetchYouTubePlaylistItems(
  playlistId: string
): Promise<YouTubeRemoteTrack[]> {
  const res = await api<{
    ok?: boolean;
    items?: {
      playlistItemId?: string;
      videoId?: string;
      title?: string;
      artist?: string;
      artworkUrl?: string | null;
    }[];
  }>(`/api/youtube/playlists/${encodeURIComponent(playlistId)}/items`);
  if (res?.ok !== true || !Array.isArray(res.items)) return [];
  const out: YouTubeRemoteTrack[] = [];
  for (const row of res.items) {
    const id = typeof row?.videoId === "string" ? row.videoId.trim() : "";
    const title = typeof row?.title === "string" ? row.title.trim() : "";
    if (!VIDEO_ID_RE.test(id) || !title) continue;
    out.push({
      playlistItemId: typeof row.playlistItemId === "string" ? row.playlistItemId : id,
      id,
      title,
      artist: typeof row.artist === "string" ? row.artist : "",
      album: "",
      durationSeconds: null,
      artworkUrl: typeof row.artworkUrl === "string" ? row.artworkUrl : null,
      // Fail-closed: YouTube Data API v3 playlistItems carry no YTM explicit badge.
      explicit: null,
      source: "youtube_music",
    });
  }
  return out;
}

export async function createRemoteYouTubePlaylist(
  title: string,
  privacyStatus: "private" | "unlisted" | "public" = "private"
): Promise<YouTubeAccountPlaylist> {
  const res = await api<{ ok?: boolean; playlist?: YouTubeAccountPlaylist; error?: string }>(
    "/api/youtube/playlists",
    {
      method: "POST",
      body: { title, privacyStatus },
    }
  );
  if (!res?.ok || !res.playlist) {
    throw new Error(res?.error ?? "Could not create YouTube playlist.");
  }
  return res.playlist;
}

export async function addTrackToRemoteYouTubePlaylist(
  playlistId: string,
  videoId: string
): Promise<{ playlistItemId: string; playlistId: string; videoId: string }> {
  const res = await api<{
    ok?: boolean;
    item?: { playlistItemId: string; playlistId: string; videoId: string };
    error?: string;
  }>(`/api/youtube/playlists/${encodeURIComponent(playlistId)}/items`, {
    method: "POST",
    body: { videoId },
  });
  if (!res?.ok || !res.item) {
    throw new Error(res?.error ?? "Could not add song to YouTube playlist.");
  }
  return res.item;
}

export async function removeTrackFromRemoteYouTubePlaylist(
  playlistId: string,
  playlistItemId: string
): Promise<boolean> {
  const res = await api<{ ok?: boolean; error?: string }>(
    `/api/youtube/playlists/${encodeURIComponent(playlistId)}/items?playlistItemId=${encodeURIComponent(playlistItemId)}`,
    { method: "DELETE" }
  );
  if (!res?.ok) {
    throw new Error(res?.error ?? "Could not remove song from YouTube playlist.");
  }
  return true;
}

export async function fetchYouTubeLikedTracks(): Promise<MediaTrack[]> {
  try {
    const res = await api<{
      ok?: boolean;
      tracks?: {
        videoId?: string;
        title?: string;
        artist?: string;
        artworkUrl?: string | null;
      }[];
    }>("/api/youtube/likes");
    if (res?.ok !== true || !Array.isArray(res.tracks)) return [];
    const out: MediaTrack[] = [];
    for (const row of res.tracks) {
      const id = typeof row?.videoId === "string" ? row.videoId.trim() : "";
      const title = typeof row?.title === "string" ? row.title.trim() : "";
      if (!VIDEO_ID_RE.test(id) || !title) continue;
      out.push({
        id,
        title,
        artist: typeof row.artist === "string" ? row.artist : "",
        album: "",
        durationSeconds: null,
        artworkUrl: typeof row.artworkUrl === "string" ? row.artworkUrl : null,
        explicit: null,
        source: "youtube_music",
      });
    }
    return out;
  } catch {
    return [];
  }
}

export async function syncYouTubeTrackLike(
  videoId: string,
  liked: boolean
): Promise<void> {
  if (!VIDEO_ID_RE.test(videoId.trim())) return;
  try {
    await api("/api/youtube/likes", {
      method: "POST",
      body: { videoId: videoId.trim(), rating: liked ? "like" : "none" },
    });
  } catch {
    // Best-effort mirror to connected YouTube account; local like state stands.
  }
}
