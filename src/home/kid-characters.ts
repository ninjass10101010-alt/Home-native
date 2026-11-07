import AsyncStorage from "@react-native-async-storage/async-storage";

export type KidCharacterRarity = "Starter" | "Rare" | "Epic" | "Legendary";

export type KidCharacterToneKey =
  | "color-accent-mint"
  | "color-accent-amber"
  | "color-accent-violet"
  | "color-accent-cyan"
  | "color-accent-rose";

export interface KidCharacter {
  id: string;
  name: string;
  title: string;
  emoji: string;
  rarity: KidCharacterRarity;
  unlockPoints: number;
  toneKey: KidCharacterToneKey;
  chipTone: "success" | "warning" | "violet" | "accent" | "danger";
  specialty: string;
  catchphrases: readonly string[];
}

export const KID_CHARACTERS: readonly KidCharacter[] = [
  {
    id: "captain-crisp",
    name: "Captain Crisp",
    title: "Kingdom Scout",
    emoji: "🍪",
    rarity: "Starter",
    unlockPoints: 0,
    toneKey: "color-accent-amber",
    chipTone: "warning",
    specialty: "First-quest trailblazer",
    catchphrases: [
      "Crumbs of courage! Let's crush a quest together!",
      "Every star jelly starts with one tidy room!",
      "Ready for adventure, Kingdom Hero!",
    ],
  },
  {
    id: "sprout-berry",
    name: "Sproutberry Knight",
    title: "Garden Guardian",
    emoji: "🍓",
    rarity: "Rare",
    unlockPoints: 25,
    toneKey: "color-accent-mint",
    chipTone: "success",
    specialty: "Berry Shield protector",
    catchphrases: [
      "By the Strawberry Shield, you're unstoppable!",
      "Sweet victory is blooming in the Kingdom today!",
      "One more quest and our castle levels up!",
    ],
  },
  {
    id: "boba-blaze",
    name: "Boba Blaze",
    title: "Tapioca Alchemist",
    emoji: "🧋",
    rarity: "Rare",
    unlockPoints: 50,
    toneKey: "color-accent-cyan",
    chipTone: "accent",
    specialty: "Streak potion brewer",
    catchphrases: [
      "Pop, fizz, hooray! Your quest power is bubbling!",
      "Stirring up some epic Kingdom magic!",
      "High-five! That's how a true champion rolls!",
    ],
  },
  {
    id: "sir-cinnamon",
    name: "Sir Cinnamon Shield",
    title: "Royal Defender",
    emoji: "🥨",
    rarity: "Epic",
    unlockPoints: 100,
    toneKey: "color-accent-violet",
    chipTone: "violet",
    specialty: "Starlight Castle captain",
    catchphrases: [
      "Honor and cinnamon swirls! The castle salutes you!",
      "No mess can stand against our Kingdom!",
      "Your points shine brighter than the Royal Crown!",
    ],
  },
  {
    id: "princess-mochi",
    name: "Princess Cloud Mochi",
    title: "Starlight Healer",
    emoji: "🍡",
    rarity: "Epic",
    unlockPoints: 150,
    toneKey: "color-accent-rose",
    chipTone: "danger",
    specialty: "Marshmallow sky guardian",
    catchphrases: [
      "Bouncy, bright, and totally legendary!",
      "The Starlight Kingdom is throwing a parade for you!",
      "Keep shining — we're almost at the top of the Kingdom!",
    ],
  },
  {
    id: "dragonberry-rex",
    name: "Dragonberry Rex",
    title: "Ancient Kingdom Dragon",
    emoji: "🐲",
    rarity: "Legendary",
    unlockPoints: 250,
    toneKey: "color-accent-amber",
    chipTone: "warning",
    specialty: "Grand Champion companion",
    catchphrases: [
      "ROAR-some work! You awakened the Ancient Dragon!",
      "Bow before the Grand Champion of the Kingdom!",
      "Sugar flames and golden stars — nothing can stop us!",
    ],
  },
];

export interface KidKingdomState {
  selectedId: string;
  highestPoints: number;
  cheers: Record<string, number>;
}

const STORAGE_PREFIX = "@consuela/kid_kingdom_v1:";

export function defaultKingdomState(points = 0): KidKingdomState {
  const safePts = Number.isFinite(points) && points > 0 ? points : 0;
  const unlocked = unlockedCharactersFor(safePts);
  const highestUnlocked = unlocked[unlocked.length - 1] ?? KID_CHARACTERS[0];
  return {
    selectedId: highestUnlocked.id,
    highestPoints: safePts,
    cheers: {},
  };
}

export function effectiveUnlockPoints(livePoints: number, storedHighest = 0): number {
  const a = Number.isFinite(livePoints) && livePoints > 0 ? livePoints : 0;
  const b = Number.isFinite(storedHighest) && storedHighest > 0 ? storedHighest : 0;
  return Math.max(a, b);
}

export function isCharacterUnlocked(character: KidCharacter, effectivePoints: number): boolean {
  const pts = Number.isFinite(effectivePoints) && effectivePoints > 0 ? effectivePoints : 0;
  return pts >= character.unlockPoints;
}

export function unlockedCharactersFor(effectivePoints: number): KidCharacter[] {
  return KID_CHARACTERS.filter((c) => isCharacterUnlocked(c, effectivePoints));
}

export function nextLockedCharacterFor(effectivePoints: number): KidCharacter | null {
  return KID_CHARACTERS.find((c) => !isCharacterUnlocked(c, effectivePoints)) ?? null;
}

export function resolveActiveCharacter(
  selectedId: string | undefined,
  effectivePoints: number
): KidCharacter {
  const unlocked = unlockedCharactersFor(effectivePoints);
  if (selectedId) {
    const match = unlocked.find((c) => c.id === selectedId);
    if (match) return match;
  }
  return unlocked[unlocked.length - 1] ?? KID_CHARACTERS[0];
}

export async function loadKingdomState(memberName: string): Promise<KidKingdomState | null> {
  if (!memberName) return null;
  try {
    const raw = await AsyncStorage.getItem(`${STORAGE_PREFIX}${memberName}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<KidKingdomState>;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      selectedId: typeof parsed.selectedId === "string" ? parsed.selectedId : KID_CHARACTERS[0].id,
      highestPoints:
        typeof parsed.highestPoints === "number" && Number.isFinite(parsed.highestPoints)
          ? Math.max(0, parsed.highestPoints)
          : 0,
      cheers:
        parsed.cheers && typeof parsed.cheers === "object"
          ? (parsed.cheers as Record<string, number>)
          : {},
    };
  } catch {
    return null;
  }
}

export async function saveKingdomState(
  memberName: string,
  state: KidKingdomState
): Promise<void> {
  if (!memberName) return;
  try {
    await AsyncStorage.setItem(`${STORAGE_PREFIX}${memberName}`, JSON.stringify(state));
  } catch {
    // Best-effort device persistence
  }
}

