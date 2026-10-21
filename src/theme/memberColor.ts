import { ACCENTS } from "./tokens";

/**
 * Member color NAMES → accent tokens (port of ui/Avatar.tsx:27-43).
 * ServerMember.color arrives as a NAME ("green"…) — never feed it to a color
 * mixer directly.
 *
 * The live roster carries NO colour at all: PocketBase's `members.color` is an
 * empty text field for every row, so the wall must resolve each member's
 * accent the way the WEB does — by INDEX, off the canonical member palette
 * (Home-ai/src/db/index.ts:164 `memberColor(i)`), which is exactly what the
 * reference wall renders (measured per member in reference/home/guest-dark.png:
 * Rebecca green, Jeffery cyan, Emily violet, Bailey amber, Jasmine rose,
 * Aurora nori, Caspian cyan, Rocco green, Rico teal).
 *
 * An unknown/absent name falls back the way the WEB's Avatar falls back:
 * GREEN (Avatar.tsx:28 `colorMap[color] ?? colorMap.green`, :38
 * `ringMap[color] ?? ringMap.green`) — NOT the theme's selected accent, which
 * would collapse the whole rail to one hue (every ring measured rgb(31,53,99),
 * i.e. accent-nori at 30%, when the rail carried nine people).
 */
const NAME_TO_ACCENT: Record<string, string> = {
  green: "mint",
  violet: "violet",
  amber: "amber",
  cyan: "cyan",
  rose: "rose",
  blue: "nori",
  // The native palette's own names — a roster row edited on the device can
  // carry one of them (the web's map has no "nori"; the house map calls it
  // "blue", the native calls it "nori").
  nori: "nori",
  mint: "mint",
  sage: "sage",
  coral: "coral",
  lavender: "lavender",
  apricot: "apricot",
};

/**
 * The web's Avatar fallback for a member whose colour cannot be resolved:
 * GREEN (mint). A rail that resolves every row to the theme's selected accent
 * reads as one hue, not one family.
 */
export const MEMBER_FALLBACK_ACCENT = "mint";

/**
 * The canonical member palette — the WEB's own order
 * (Home-ai/src/db/index.ts:164 `memberColor(i)`), which the reference wall
 * renders member for member: green, cyan, violet, amber, rose, blue, cyan,
 * green, cyan. The native's stand-in roster already carries the same six
 * accents in the same order (src/api/members.ts FALLBACK_MEMBERS), so the
 * built-in roster and the live roster read as the SAME family of nine.
 */
export const WEB_MEMBER_PALETTE = [
  "green",
  "cyan",
  "violet",
  "amber",
  "rose",
  "blue",
  "cyan",
  "green",
  "cyan",
] as const;

/**
 * The accent NAME a roster row actually carries, or null when it carries none
 * (absent, blank — the live roster's case — or a name this app does not know).
 * A literal `#rrggbb` passes through: it is a colour, not a name.
 */
export function normalizeMemberColorName(colorName: string | null | undefined): string | null {
  const raw = (colorName ?? "").trim().toLowerCase();
  if (!raw) return null;
  if (NAME_TO_ACCENT[raw]) return raw;
  if (/^#[0-9a-f]{3,8}$/.test(raw)) return raw;
  return null;
}

/**
 * The accent hex for a member colour name.
 *
 * `fallbackHex` is what an unresolvable name resolves to. The WEB's Avatar
 * falls back to GREEN (Avatar.tsx:28/38); the wall's rail therefore passes
 * {@link memberAvatarFallbackHex}, while the tasks surface keeps the theme's
 * selected accent (the web's own tasks fallback, tasks/page.tsx:167
 * `memberColorValues[colorName ?? "green"] ?? "var(--color-accent-selected)"`).
 */
export function memberAccentHex(
  colorName: string | undefined,
  theme: "dark" | "light",
  selectedAccentHex: string,
  fallbackHex?: string
): string {
  const key = colorName ? NAME_TO_ACCENT[colorName.trim().toLowerCase()] : undefined;
  if (key && ACCENTS[theme][key]) return ACCENTS[theme][key];
  if (colorName && /^#/.test(colorName.trim())) {
    // live roster rows may carry literal hex — pass through (token-authored upstream)
    return colorName.trim();
  }
  return fallbackHex ?? selectedAccentHex;
}

/** The WEB's Avatar fallback for an unresolvable member colour: GREEN. */
export function memberAvatarFallbackHex(theme: "dark" | "light"): string {
  return ACCENTS[theme][MEMBER_FALLBACK_ACCENT] ?? ACCENTS[theme].nori;
}
