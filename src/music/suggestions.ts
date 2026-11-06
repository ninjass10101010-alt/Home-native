import AsyncStorage from "@react-native-async-storage/async-storage";
import { CURATED_ARTISTS } from "./library";
import { FAMILY_MIXES, MUSIC_STATIONS } from "./stations";
import type { FavoriteArtist, MediaTrack } from "./types";

export const RECENT_SEARCHES_KEY = "music.search.recent";
export const RECENT_SEARCHES_CAP = 8;

export type SearchSuggestionKind = "recent" | "artist" | "station" | "mix" | "track";

export interface SearchSuggestion {
  id: string;
  label: string;
  query: string;
  subtitle: string;
  kind: SearchSuggestionKind;
}

export async function loadRecentSearches(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .slice(0, RECENT_SEARCHES_CAP);
  } catch {
    return [];
  }
}

export async function saveRecentSearch(
  term: string,
  current?: string[]
): Promise<string[]> {
  const cleaned = term.trim();
  if (!cleaned) return current ?? [];
  const base = current ?? (await loadRecentSearches());
  const lower = cleaned.toLowerCase();
  const next = [
    cleaned,
    ...base.filter((item) => item.trim().toLowerCase() !== lower),
  ].slice(0, RECENT_SEARCHES_CAP);
  try {
    await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
  } catch {
    // Storage write failures are non-fatal; return in-memory list.
  }
  return next;
}

export async function removeRecentSearch(
  term: string,
  current?: string[]
): Promise<string[]> {
  const lower = term.trim().toLowerCase();
  const base = current ?? (await loadRecentSearches());
  const next = base.filter((item) => item.trim().toLowerCase() !== lower);
  try {
    await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage error
  }
  return next;
}

export async function clearRecentSearches(): Promise<void> {
  try {
    await AsyncStorage.removeItem(RECENT_SEARCHES_KEY);
  } catch {
    // Ignore storage error
  }
}

export interface SuggestionContext {
  recentSearches: string[];
  favoriteArtists: FavoriteArtist[];
  history: MediaTrack[];
  limit?: number;
}

/**
 * Computes instant (0ms) search suggestions & auto-complete pills.
 *
 * - When `query` is empty: surfaces recent searches followed by favorite
 *   artists, stations, and family mixes for one-tap discovery.
 * - When `query` is non-empty: ranks prefix matches ahead of substring matches
 *   across recent queries, artists, stations, family mixes, and visible
 *   playback history.
 */
export function buildSearchSuggestions(
  query: string,
  ctx: SuggestionContext
): SearchSuggestion[] {
  const limit = ctx.limit ?? 8;
  const q = query.trim().toLowerCase();
  const seenQueries = new Set<string>();
  const addUnique = (list: SearchSuggestion[], item: SearchSuggestion) => {
    const key = item.query.trim().toLowerCase();
    if (!key || seenQueries.has(key)) return;
    seenQueries.add(key);
    list.push(item);
  };

  // Merge favorite artists + curated artists without duplicates
  const allArtists: { id: string; name: string; genre: string }[] = [];
  const seenArtists = new Set<string>();
  for (const a of ctx.favoriteArtists) {
    const k = a.name.trim().toLowerCase();
    if (!k || seenArtists.has(k)) continue;
    seenArtists.add(k);
    allArtists.push({
      id: k.replace(/[^a-z0-9]+/g, "-"),
      name: a.name,
      genre: "Favorite Artist",
    });
  }
  for (const a of CURATED_ARTISTS) {
    const k = a.name.trim().toLowerCase();
    if (!k || seenArtists.has(k)) continue;
    seenArtists.add(k);
    allArtists.push({
      id: k.replace(/[^a-z0-9]+/g, "-"),
      name: a.name,
      genre: a.genre,
    });
  }

  if (!q) {
    const out: SearchSuggestion[] = [];
    for (const recent of ctx.recentSearches.slice(0, 4)) {
      addUnique(out, {
        id: `recent-${recent.toLowerCase().replace(/\s+/g, "-")}`,
        label: recent,
        query: recent,
        subtitle: "Recent",
        kind: "recent",
      });
    }
    for (const artist of allArtists) {
      if (out.length >= limit) break;
      addUnique(out, {
        id: `artist-${artist.id}`,
        label: artist.name,
        query: artist.name,
        subtitle: artist.genre,
        kind: "artist",
      });
    }
    for (const station of MUSIC_STATIONS) {
      if (out.length >= limit) break;
      addUnique(out, {
        id: `station-${station.id}`,
        label: station.title,
        query: station.query,
        subtitle: "Station",
        kind: "station",
      });
    }
    return out.slice(0, limit);
  }

  const prefixMatches: SearchSuggestion[] = [];
  const substringMatches: SearchSuggestion[] = [];

  const consider = (item: SearchSuggestion, matchTarget?: string) => {
    const target = (matchTarget ?? item.label).toLowerCase();
    if (target === q) {
      // Exact match still useful as a quick-confirm pill if it comes from a station/artist/recent
      prefixMatches.unshift(item);
    } else if (target.startsWith(q)) {
      prefixMatches.push(item);
    } else if (
      target.includes(q) ||
      item.query.toLowerCase().includes(q) ||
      item.subtitle.toLowerCase().includes(q)
    ) {
      substringMatches.push(item);
    }
  };

  for (const recent of ctx.recentSearches) {
    consider({
      id: `recent-${recent.toLowerCase().replace(/\s+/g, "-")}`,
      label: recent,
      query: recent,
      subtitle: "Recent",
      kind: "recent",
    });
  }

  for (const artist of allArtists) {
    consider(
      {
        id: `artist-${artist.id}`,
        label: artist.name,
        query: artist.name,
        subtitle: artist.genre,
        kind: "artist",
      },
      `${artist.name} ${artist.genre}`
    );
  }

  for (const station of MUSIC_STATIONS) {
    consider(
      {
        id: `station-${station.id}`,
        label: station.title,
        query: station.query,
        subtitle: "Station",
        kind: "station",
      },
      `${station.title} ${station.subtitle}`
    );
  }

  for (const mix of FAMILY_MIXES) {
    consider(
      {
        id: `mix-${mix.id}`,
        label: mix.title,
        query: mix.query,
        subtitle: "Family Mix",
        kind: "mix",
      },
      `${mix.title} ${mix.description}`
    );
  }

  for (const track of ctx.history) {
    consider(
      {
        id: `track-${track.id}`,
        label: track.title,
        query: `${track.title} ${track.artist}`.trim(),
        subtitle: track.artist || "Song",
        kind: "track",
      },
      `${track.title} ${track.artist}`
    );
  }

  const combined: SearchSuggestion[] = [];
  for (const item of [...prefixMatches, ...substringMatches]) {
    if (combined.length >= limit) break;
    addUnique(combined, item);
  }
  return combined;
}
