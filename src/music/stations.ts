import { search as engineSearch, related as engineRelated } from "../../modules/youtube-engine";
import type { MediaTrack } from "./types";

export interface MusicStation {
  id: string;
  title: string;
  subtitle: string;
  emoji: string;
  query: string;
  badge?: string;
  category: "hits" | "mood" | "genre" | "family";
}

export interface FamilyMix {
  id: string;
  title: string;
  description: string;
  emoji: string;
  query: string;
}

/**
 * Curated Apple Music-style quick browse stations.
 */
export const MUSIC_STATIONS: readonly MusicStation[] = [
  {
    id: "reggaeton-fuego",
    title: "Reggaeton Fuego",
    subtitle: "Bad Bunny, Feid & Karol G",
    emoji: "🔥",
    query: "reggaeton exitos mix perreo",
    badge: "Top Latin",
    category: "genre",
  },
  {
    id: "cumbias-bailar",
    title: "Cumbias Pa' Bailar",
    subtitle: "Los Ángeles Azules & Selena",
    emoji: "🪗",
    query: "cumbias clasicas y sonideras mix para bailar",
    badge: "Fiesta",
    category: "genre",
  },
  {
    id: "cumbias-nortenas",
    title: "Cumbias & Norteñas",
    subtitle: "Grupo Frontera & Kumbia Kings",
    emoji: "🤠",
    query: "cumbias norteñas y tejanas mix",
    badge: "Tejano",
    category: "genre",
  },
  {
    id: "regional-mexicano",
    title: "Regional Mexicano",
    subtitle: "Carin León, Nodal & Frontera",
    emoji: "🎺",
    query: "regional mexicano exitos mix",
    badge: "Trending",
    category: "genre",
  },
  {
    id: "latin-fiesta",
    title: "Latin Pop & Hits",
    subtitle: "Shakira, Camilo & Enrique",
    emoji: "🌴",
    query: "latin pop exitos en espanol",
    category: "genre",
  },
  {
    id: "reggaeton-clasico",
    title: "Reggaeton Clásico",
    subtitle: "Daddy Yankee, Don Omar & Wisin",
    emoji: "📼",
    query: "clasicos del reggaeton viejitas perreo",
    badge: "Old School",
    category: "hits",
  },
  {
    id: "bachata-sensual",
    title: "Bachata Sensual",
    subtitle: "Romeo Santos & Aventura",
    emoji: "🌹",
    query: "bachata exitos romeo santos aventura",
    category: "genre",
  },
  {
    id: "salsa-tropical",
    title: "Salsa con Sabor",
    subtitle: "Marc Anthony & Celia Cruz",
    emoji: "💃",
    query: "salsa clasica para bailar exitos",
    category: "genre",
  },
  {
    id: "rock-en-espanol",
    title: "Rock en Español",
    subtitle: "Maná, Soda Stereo & Caifanes",
    emoji: "🎸",
    query: "rock en espanol clasicos esenciales",
    category: "genre",
  },
  {
    id: "todays-hits",
    title: "Today's Hits",
    subtitle: "Chart-topping singles",
    emoji: "🌟",
    query: "today's top hits",
    badge: "Top 50",
    category: "hits",
  },
  {
    id: "hiphop-rnb",
    title: "Hip-Hop & R&B",
    subtitle: "Heavy beats & smooth flow",
    emoji: "🎙️",
    query: "top hip hop and rnb hits",
    category: "genre",
  },
  {
    id: "acoustic-chill",
    title: "Acoustic & Chill",
    subtitle: "Laid-back acoustic vibes",
    emoji: "☕",
    query: "acoustic chill morning songs",
    category: "mood",
  },
  {
    id: "focus-flow",
    title: "Focus & Study",
    subtitle: "Ambient & lofi flow",
    emoji: "🧠",
    query: "lofi hip hop beats to study relax to",
    category: "mood",
  },
  {
    id: "workout-energy",
    title: "Workout Energy",
    subtitle: "High tempo motivation",
    emoji: "⚡",
    query: "workout energy motivation playlist",
    category: "mood",
  },
  {
    id: "family-singalong",
    title: "Family Sing-Along",
    subtitle: "Disney & family favorites",
    emoji: "🎈",
    query: "disney songs family sing along",
    badge: "All Ages",
    category: "family",
  },
  {
    id: "dance-party",
    title: "Dance & Club",
    subtitle: "Uplifting electronic beats",
    emoji: "🪩",
    query: "top dance pop edm hits",
    category: "genre",
  },
  {
    id: "throwbacks",
    title: "90s & 2000s",
    subtitle: "Golden era nostalgia",
    emoji: "📻",
    query: "90s and 2000s throwback hits",
    category: "hits",
  },
];

/**
 * Pre-configured household mixes for the Family Library.
 */
export const FAMILY_MIXES: readonly FamilyMix[] = [
  {
    id: "cumbias-fiesta",
    title: "Fiesta de Cumbias",
    description: "Para bailar toda la noche con la familia",
    emoji: "🪗",
    query: "cumbias para bailar en fiesta familiar",
  },
  {
    id: "reggaeton-noche",
    title: "Noche de Perreo",
    description: "Los mejores éxitos urbanos y reggaeton",
    emoji: "🔥",
    query: "reggaeton nuevo y clasico mix",
  },
  {
    id: "carne-asada",
    title: "Para la Carne Asada",
    description: "Norteñas, cumbias y banda para el asador",
    emoji: "🥩",
    query: "musica para carne asada norteñas y cumbias",
  },
  {
    id: "viejitas-bonitas",
    title: "Viejitas Pero Bonitas",
    description: "Baladas, clásicos y recuerdos del ayer",
    emoji: "📻",
    query: "viejitas pero bonitas baladas en espanol",
  },
  {
    id: "family-favorites",
    title: "Family Favorites",
    description: "The Garcia household's most-loved jams",
    emoji: "❤️",
    query: "family friendly pop hits",
  },
  {
    id: "weekend-party",
    title: "Weekend Dance Party",
    description: "High energy tracks to get the house moving",
    emoji: "🎉",
    query: "upbeat party hits clean",
  },
  {
    id: "road-trip",
    title: "Road Trip Anthems",
    description: "Sing-at-the-top-of-your-lungs classics",
    emoji: "🚗",
    query: "road trip sing along songs",
  },
  {
    id: "bedtime-chill",
    title: "Bedtime Wind Down",
    description: "Soft melodies and soothing sleep sounds",
    emoji: "🌙",
    query: "soothing sleep lullabies acoustic chill",
  },
];

/**
 * Fetches similar tracks using YouTube's algorithmic related tracks engine,
 * falling back to or combining with an artist radio search.
 */
export async function fetchSimilarTracks(track: MediaTrack, limit = 20): Promise<MediaTrack[]> {
  const seenIds = new Set<string>([track.id]);
  const results: MediaTrack[] = [];

  // 1. Try YouTube's native related stream engine
  try {
    const relatedTracks = await engineRelated(track.id);
    for (const t of relatedTracks) {
      if (!seenIds.has(t.id)) {
        seenIds.add(t.id);
        results.push(t);
      }
    }
  } catch {
    // Engine related lookup failed or not supported in environment
  }

  // 2. If fewer than 10 tracks, search for artist radio/mix on YouTube Music
  if (results.length < 10 && track.artist.trim()) {
    try {
      const outcome = await engineSearch(`${track.artist} radio`, 15);
      for (const t of outcome.tracks) {
        if (!seenIds.has(t.id)) {
          seenIds.add(t.id);
          results.push(t);
        }
      }
    } catch {
      // Search fallback failed
    }
  }

  return results.slice(0, limit);
}

