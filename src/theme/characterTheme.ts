import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Disney & Character Theme Engine — Consuela's native kid-engagement layer
 * inspired by Skylight Calendar's Disney Mode collaboration.
 *
 * Provides:
 *   1. 16 curated characters across four franchises (Disney, Pixar, Marvel,
 *      Star Wars) with token-mapped accents, vector motif identifiers,
 *      chore & reward celebration cheers, and ambient screensaver scenes.
 *   2. Device-local persistence in AsyncStorage (`consuela-character-theme`)
 *      with synchronous in-memory broadcast so Tasks, Routines, Rewards,
 *      Settings, and Screensaver stay in lockstep.
 *   3. Deterministic fallback assignment so every kid has a companion ready
 *      even before picking a favorite.
 */

export const CHARACTER_THEME_STORAGE_KEY = "consuela-character-theme";

export type CharacterFranchise = "all" | "disney" | "pixar" | "marvel" | "starwars";

export type CharacterAccentKey =
  | "nori"
  | "violet"
  | "rose"
  | "cyan"
  | "mint"
  | "amber"
  | "coral"
  | "lavender"
  | "apricot"
  | "sage";

export type CharacterMotif =
  | "alien"
  | "snowflake"
  | "wave"
  | "ears"
  | "crown"
  | "rocket"
  | "sheriff"
  | "robot"
  | "sparkle"
  | "web"
  | "arc"
  | "leaf"
  | "shield"
  | "force"
  | "droid"
  | "helmet";

export interface CharacterProfile {
  id: string;
  name: string;
  franchise: Exclude<CharacterFranchise, "all">;
  franchiseLabel: string;
  accentKey: CharacterAccentKey;
  motif: CharacterMotif;
  badgeGlyph: string;
  choreCheer: string;
  rewardCheer: string;
  screensaverScene: {
    title: string;
    subtitle: string;
    quote: string;
  };
}

export interface CharacterThemePrefs {
  /** Master switch controlled by a parent in Settings. */
  enabled: boolean;
  /** Franchise pack filter ("all" | "disney" | "pixar" | "marvel" | "starwars"). */
  franchise: CharacterFranchise;
  /** Whether the ambient screensaver displays the rotating character spotlight. */
  screensaverSpotlight: boolean;
  /** Member name -> character id assignment map. */
  assignments: Record<string, string>;
}

export const FRANCHISE_OPTIONS: readonly { id: CharacterFranchise; label: string; badge: string }[] = [
  { id: "all", label: "All Worlds", badge: "✨" },
  { id: "disney", label: "Disney", badge: "🏰" },
  { id: "pixar", label: "Pixar", badge: "🚀" },
  { id: "marvel", label: "Marvel", badge: "🛡️" },
  { id: "starwars", label: "Star Wars", badge: "⚔️" },
] as const;

/**
 * The 16 iconic character profiles (4 Disney, 4 Pixar, 4 Marvel, 4 Star Wars —
 * matching the 16-avatar Skylight Disney Mode lineup).
 */
export const CHARACTER_CATALOG: readonly CharacterProfile[] = [
  // ── Disney ──
  {
    id: "stitch",
    name: "Stitch",
    franchise: "disney",
    franchiseLabel: "Disney",
    accentKey: "cyan",
    motif: "alien",
    badgeGlyph: "🛸",
    choreCheer: "Ohana means no chore gets left behind!",
    rewardCheer: "Cosmic Galactic Treasure unlocked!",
    screensaverScene: {
      title: "Hawaiian Starlight",
      subtitle: "Disney · Lilo & Stitch",
      quote: "Ohana means family — nobody gets left behind.",
    },
  },
  {
    id: "elsa",
    name: "Queen Elsa",
    franchise: "disney",
    franchiseLabel: "Disney",
    accentKey: "lavender",
    motif: "snowflake",
    badgeGlyph: "❄️",
    choreCheer: "Let it glow — chore sparkling clean!",
    rewardCheer: "Royal Arendelle Crystal unlocked!",
    screensaverScene: {
      title: "Arendelle Northern Lights",
      subtitle: "Disney · Frozen",
      quote: "Step into your power and shine bright today.",
    },
  },
  {
    id: "moana",
    name: "Moana",
    franchise: "disney",
    franchiseLabel: "Disney",
    accentKey: "coral",
    motif: "wave",
    badgeGlyph: "🌊",
    choreCheer: "Wayfinder victory across the reef!",
    rewardCheer: "Heart of Te Fiti Reward unlocked!",
    screensaverScene: {
      title: "Motunui Horizon",
      subtitle: "Disney · Moana",
      quote: "There is nowhere you cannot sail when the ocean calls.",
    },
  },
  {
    id: "mickey",
    name: "Sorcerer Mickey",
    franchise: "disney",
    franchiseLabel: "Disney",
    accentKey: "nori",
    motif: "ears",
    badgeGlyph: "✨",
    choreCheer: "Hot dog! Pure magic on the chore board!",
    rewardCheer: "Fantasia Starlight Prize unlocked!",
    screensaverScene: {
      title: "Fantasia Starlight",
      subtitle: "Disney Classics",
      quote: "A little bit of magic makes every day an adventure.",
    },
  },
  // ── Pixar ──
  {
    id: "buzz",
    name: "Buzz Lightyear",
    franchise: "pixar",
    franchiseLabel: "Pixar",
    accentKey: "mint",
    motif: "rocket",
    badgeGlyph: "🚀",
    choreCheer: "To infinity and beyond — mission complete!",
    rewardCheer: "Star Command Honor Pass unlocked!",
    screensaverScene: {
      title: "Star Command Sector 4",
      subtitle: "Pixar · Toy Story",
      quote: "To infinity and beyond!",
    },
  },
  {
    id: "woody",
    name: "Sheriff Woody",
    franchise: "pixar",
    franchiseLabel: "Pixar",
    accentKey: "apricot",
    motif: "sheriff",
    badgeGlyph: "⭐",
    choreCheer: "You've got a friend in clean!",
    rewardCheer: "Golden Sheriff Star unlocked!",
    screensaverScene: {
      title: "Roundup Sunset",
      subtitle: "Pixar · Toy Story",
      quote: "You've got a friend in me.",
    },
  },
  {
    id: "walle",
    name: "WALL·E",
    franchise: "pixar",
    franchiseLabel: "Pixar",
    accentKey: "sage",
    motif: "robot",
    badgeGlyph: "🌱",
    choreCheer: "Directive complete — everything is tidy!",
    rewardCheer: "Solar Sprout Treasure unlocked!",
    screensaverScene: {
      title: "Starlight Orbit",
      subtitle: "Pixar · WALL·E",
      quote: "Every small care grows into something extraordinary.",
    },
  },
  {
    id: "joy",
    name: "Joy",
    franchise: "pixar",
    franchiseLabel: "Pixar",
    accentKey: "amber",
    motif: "sparkle",
    badgeGlyph: "💛",
    choreCheer: "New golden core memory created!",
    rewardCheer: "Radiant Core Memory Prize unlocked!",
    screensaverScene: {
      title: "Headquarters Glow",
      subtitle: "Pixar · Inside Out",
      quote: "Today is full of bright new memories waiting to happen.",
    },
  },
  // ── Marvel ──
  {
    id: "spiderman",
    name: "Spider-Man",
    franchise: "marvel",
    franchiseLabel: "Marvel",
    accentKey: "rose",
    motif: "web",
    badgeGlyph: "🕸️",
    choreCheer: "Thwip! Friendly neighborhood helper strikes again!",
    rewardCheer: "Web-Slinger Hero Pass unlocked!",
    screensaverScene: {
      title: "Queens Skyline Swing",
      subtitle: "Marvel · Spider-Man",
      quote: "With great power comes great teamwork.",
    },
  },
  {
    id: "ironman",
    name: "Iron Man",
    franchise: "marvel",
    franchiseLabel: "Marvel",
    accentKey: "coral",
    motif: "arc",
    badgeGlyph: "⚡",
    choreCheer: "J.A.R.V.I.S. confirms: Chore 100% complete!",
    rewardCheer: "Stark Arc Reactor Prize unlocked!",
    screensaverScene: {
      title: "Stark Workshop",
      subtitle: "Marvel · Avengers",
      quote: "Part of the journey is building a better tomorrow.",
    },
  },
  {
    id: "groot",
    name: "Baby Groot",
    franchise: "marvel",
    franchiseLabel: "Marvel",
    accentKey: "sage",
    motif: "leaf",
    badgeGlyph: "🌿",
    choreCheer: "I am Groot! (Translation: Awesome job!)",
    rewardCheer: "Guardians Awesome Mix Pass unlocked!",
    screensaverScene: {
      title: "Knowhere Lanterns",
      subtitle: "Marvel · Guardians",
      quote: "We are Groot.",
    },
  },
  {
    id: "panther",
    name: "Black Panther",
    franchise: "marvel",
    franchiseLabel: "Marvel",
    accentKey: "violet",
    motif: "shield",
    badgeGlyph: "🐾",
    choreCheer: "Wakanda Forever — task mastered!",
    rewardCheer: "Vibranium Royal Seal unlocked!",
    screensaverScene: {
      title: "Golden City of Wakanda",
      subtitle: "Marvel · Black Panther",
      quote: "In times of challenge, the wise build bridges.",
    },
  },
  // ── Star Wars ──
  {
    id: "grogu",
    name: "Grogu",
    franchise: "starwars",
    franchiseLabel: "Star Wars",
    accentKey: "mint",
    motif: "force",
    badgeGlyph: "🐸",
    choreCheer: "The Force is strong with this helper!",
    rewardCheer: "Beskar Silver Sphere unlocked!",
    screensaverScene: {
      title: "Twin Suns Horizon",
      subtitle: "Star Wars · The Mandalorian",
      quote: "Wherever I go, he goes.",
    },
  },
  {
    id: "r2d2",
    name: "R2-D2",
    franchise: "starwars",
    franchiseLabel: "Star Wars",
    accentKey: "nori",
    motif: "droid",
    badgeGlyph: "🤖",
    choreCheer: "Happy beeps & whistles — mission accomplished!",
    rewardCheer: "Rebel Alliance Medal unlocked!",
    screensaverScene: {
      title: "Hyperspace Jump",
      subtitle: "Star Wars · Galaxy",
      quote: "Loyal astromech standing by for the next adventure.",
    },
  },
  {
    id: "mandalorian",
    name: "Mandalorian",
    franchise: "starwars",
    franchiseLabel: "Star Wars",
    accentKey: "cyan",
    motif: "helmet",
    badgeGlyph: "🛡️",
    choreCheer: "This is the Way — bounty completed!",
    rewardCheer: "Guild Signet Reward unlocked!",
    screensaverScene: {
      title: "Nevarro Starfield",
      subtitle: "Star Wars · The Mandalorian",
      quote: "This is the Way.",
    },
  },
  {
    id: "simba",
    name: "Simba",
    franchise: "disney",
    franchiseLabel: "Disney",
    accentKey: "amber",
    motif: "crown",
    badgeGlyph: "🦁",
    choreCheer: "Hakuna Matata — chore conquered!",
    rewardCheer: "Pride Rock Royal Reward unlocked!",
    screensaverScene: {
      title: "Pride Rock Sunrise",
      subtitle: "Disney · The Lion King",
      quote: "Remember who you are — the circle of life shines on.",
    },
  },
] as const;

export const DEFAULT_CHARACTER_THEME_PREFS: CharacterThemePrefs = {
  enabled: false,
  franchise: "all",
  screensaverSpotlight: true,
  assignments: {},
};

const VALID_FRANCHISES = new Set<CharacterFranchise>(["all", "disney", "pixar", "marvel", "starwars"]);

type ThemeListener = (prefs: CharacterThemePrefs) => void;
const listeners = new Set<ThemeListener>();

let memoryCachedPrefs: CharacterThemePrefs = { ...DEFAULT_CHARACTER_THEME_PREFS };
let hydrated = false;

export function _resetCharacterThemeMemoryForTest(defaultPrefs?: Partial<CharacterThemePrefs>): void {
  memoryCachedPrefs = {
    ...DEFAULT_CHARACTER_THEME_PREFS,
    ...(defaultPrefs ?? {}),
    assignments: { ...(defaultPrefs?.assignments ?? {}) },
  };
  hydrated = true;
  listeners.clear();
}

export function charactersForFranchise(franchise: CharacterFranchise): readonly CharacterProfile[] {
  if (franchise === "all") return CHARACTER_CATALOG;
  const filtered = CHARACTER_CATALOG.filter((c) => c.franchise === franchise);
  return filtered.length > 0 ? filtered : CHARACTER_CATALOG;
}

export function characterById(id?: string | null): CharacterProfile | null {
  if (!id) return null;
  return CHARACTER_CATALOG.find((c) => c.id === id) ?? null;
}

function normalizeMemberKey(name?: string | null): string {
  return (name ?? "").trim().toLowerCase();
}

/**
 * Resolves the active character for a family member.
 * 1. If the member has an explicit assignment in `prefs.assignments`, returns it.
 * 2. Otherwise deterministically hashes the member's name into the active franchise pool.
 */
export function resolveCharacterForMember(
  memberName: string | undefined | null,
  prefs: CharacterThemePrefs = memoryCachedPrefs
): CharacterProfile {
  const key = normalizeMemberKey(memberName);
  if (key) {
    const directId = prefs.assignments[key] ?? prefs.assignments[(memberName ?? "").trim()];
    const direct = characterById(directId);
    if (direct) return direct;
  }
  const pool = charactersForFranchise(prefs.franchise);
  if (!key) return pool[0] ?? CHARACTER_CATALOG[0];
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return pool[hash % pool.length] ?? CHARACTER_CATALOG[0];
}

function sanitizePrefs(raw: unknown): CharacterThemePrefs {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_CHARACTER_THEME_PREFS, assignments: {} };
  }
  const obj = raw as Partial<CharacterThemePrefs>;
  const assignments: Record<string, string> = {};
  if (obj.assignments && typeof obj.assignments === "object") {
    for (const [k, v] of Object.entries(obj.assignments)) {
      if (typeof v === "string" && characterById(v)) {
        assignments[normalizeMemberKey(k)] = v;
      }
    }
  }
  return {
    enabled: Boolean(obj.enabled),
    franchise:
      typeof obj.franchise === "string" && VALID_FRANCHISES.has(obj.franchise as CharacterFranchise)
        ? (obj.franchise as CharacterFranchise)
        : DEFAULT_CHARACTER_THEME_PREFS.franchise,
    screensaverSpotlight:
      typeof obj.screensaverSpotlight === "boolean"
        ? obj.screensaverSpotlight
        : DEFAULT_CHARACTER_THEME_PREFS.screensaverSpotlight,
    assignments,
  };
}

export async function loadCharacterThemePrefs(): Promise<CharacterThemePrefs> {
  try {
    const raw = await AsyncStorage.getItem(CHARACTER_THEME_STORAGE_KEY);
    if (raw) {
      const parsed = sanitizePrefs(JSON.parse(raw));
      memoryCachedPrefs = parsed;
      hydrated = true;
      return parsed;
    }
  } catch {
    // ignore corrupt storage
  }
  memoryCachedPrefs = { ...DEFAULT_CHARACTER_THEME_PREFS, assignments: {} };
  hydrated = true;
  return memoryCachedPrefs;
}

export async function saveCharacterThemePrefs(
  update: Partial<CharacterThemePrefs> | ((prev: CharacterThemePrefs) => CharacterThemePrefs)
): Promise<CharacterThemePrefs> {
  const nextRaw =
    typeof update === "function" ? update(memoryCachedPrefs) : { ...memoryCachedPrefs, ...update };
  const next = sanitizePrefs(nextRaw);
  memoryCachedPrefs = next;
  hydrated = true;
  listeners.forEach((l) => l(next));
  try {
    await AsyncStorage.setItem(CHARACTER_THEME_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage write failures
  }
  return next;
}

export async function assignCharacterToMember(
  memberName: string,
  characterId: string
): Promise<CharacterThemePrefs> {
  const key = normalizeMemberKey(memberName);
  if (!key || !characterById(characterId)) return memoryCachedPrefs;
  return saveCharacterThemePrefs((prev) => ({
    ...prev,
    assignments: {
      ...prev.assignments,
      [key]: characterId,
    },
  }));
}

export function useCharacterTheme(): [
  CharacterThemePrefs,
  (update: Partial<CharacterThemePrefs> | ((prev: CharacterThemePrefs) => CharacterThemePrefs)) => void
] {
  const [prefs, setPrefsState] = useState<CharacterThemePrefs>(memoryCachedPrefs);

  useEffect(() => {
    let alive = true;
    if (!hydrated) {
      void loadCharacterThemePrefs().then((loaded) => {
        if (alive) setPrefsState(loaded);
      });
    }
    const listener: ThemeListener = (next) => {
      if (alive) setPrefsState(next);
    };
    listeners.add(listener);
    return () => {
      alive = false;
      listeners.delete(listener);
    };
  }, []);

  const setPrefs = useCallback(
    (update: Partial<CharacterThemePrefs> | ((prev: CharacterThemePrefs) => CharacterThemePrefs)) => {
      void saveCharacterThemePrefs(update);
    },
    []
  );

  return [prefs, setPrefs];
}

