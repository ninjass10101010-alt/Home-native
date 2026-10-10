import { ACCENTS } from "./tokens";

/**
 * Member color NAMES → accent tokens (port of ui/Avatar.tsx:27-43).
 * ServerMember.color arrives as a NAME ("green"…) — never feed it to a color
 * mixer directly. Unknown/absent → accent-selected of the theme.
 */
const NAME_TO_ACCENT: Record<string, string> = {
  green: "mint",
  violet: "violet",
  amber: "amber",
  cyan: "cyan",
  rose: "rose",
  blue: "nori",
};

export function memberAccentHex(
  colorName: string | undefined,
  theme: "dark" | "light",
  selectedAccentHex: string
): string {
  const key = colorName ? NAME_TO_ACCENT[colorName] : undefined;
  if (key && ACCENTS[theme][key]) return ACCENTS[theme][key];
  if (colorName && /^#/.test(colorName)) {
    // live roster rows may carry literal hex — pass through (token-authored upstream)
    return colorName;
  }
  return selectedAccentHex;
}
