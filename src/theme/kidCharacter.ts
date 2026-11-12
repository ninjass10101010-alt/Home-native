import { useAuth } from "../state/AuthProvider";
import { useTheme } from "./ThemeProvider";
import { ACCENTS } from "./tokens";
import {
  resolveCharacterForMember,
  useCharacterTheme,
  type CharacterProfile,
} from "./characterTheme";

/**
 * The signed-in KID's character skin for the shared pages (Home + Tasks).
 *
 * Kids keep the SAME pages as everyone else — no separate kid home. When a
 * child or pet is signed in and Character Mode is on, those pages wear the
 * kid's chosen character: its accent color, a motif backdrop, and a hero.
 * Parents, guests, and a disabled Character Mode get `null` (pages unchanged).
 */
export interface KidCharacterSkin {
  memberName: string;
  character: CharacterProfile;
  /** ACCENTS key used to repaint the page via <AccentScope>. */
  accentKey: string;
  /** Resolved accent hex for the current light/dark theme. */
  accentHex: string;
}

export function isKidRole(role: string | null | undefined): boolean {
  return role === "child" || role === "pet";
}

export function useKidCharacter(): KidCharacterSkin | null {
  const { member, role } = useAuth();
  const { theme, accentColor } = useTheme();
  const [prefs] = useCharacterTheme();
  const memberName = member?.name?.trim();
  // `role` is the live capability; fall back to the cached member role so the
  // skin does not flash off while whoami re-confirms a kid's session.
  const effectiveRole = role ?? (member as { role?: string } | null)?.role ?? null;
  if (!prefs.enabled || !memberName || !isKidRole(effectiveRole)) return null;
  const character = resolveCharacterForMember(memberName, prefs);
  const palette = ACCENTS[theme === "light" ? "light" : "dark"];
  return {
    memberName,
    character,
    accentKey: character.accentKey,
    accentHex: palette[character.accentKey] ?? accentColor,
  };
}

