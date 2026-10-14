// Home-native/src/weather/language.ts
import type { TextStyle } from "react-native";
import { useTheme } from "../theme/ThemeProvider";

/**
 * The Monster weather skin seam (spec 2026-10-13). Exactly one material ships;
 * the base/clay skin arrives later as a second entry. Widgets read the skin,
 * they never branch on its id.
 */
export type WeatherMaterial = "monster";
export const WEATHER_MATERIAL: WeatherMaterial = "monster";

/** WMO code → the condition family the art, washes, and copy all share. */
export type ConditionCode =
  | "clear" | "partly" | "partly-night" | "cloudy"
  | "rain" | "storm" | "snow" | "fog" | "night";

/** Monster palette token names — the only legal color source for the skin
 *  (values pinned in tests/weather/monster-palette.test.ts). */
export const MONSTER_TOKEN_NAMES = {
  red: "color-monster-red",
  blue: "color-monster-blue",
  purple: "color-monster-purple",
  orange: "color-monster-orange",
  teal: "color-monster-teal",
  glint: "color-monster-glint",
  inkBlue: "color-monster-ink-blue",
  inkRed: "color-monster-ink-red",
  inkOrange: "color-monster-ink-orange",
  knotRed: "color-monster-knot-red",
  knotOrange: "color-monster-knot-orange",
  knotPurple: "color-monster-knot-purple",
  pupil: "color-monster-pupil",
  starCream: "color-monster-star-cream",
  starWarm: "color-monster-star-warm",
} as const;
export type MonsterInkName = keyof typeof MONSTER_TOKEN_NAMES;

/** Resolve the palette through the theme (token-only; a missing token falls
 *  back to body ink so a retune can never render a blank glyph). */
export function useMonsterInk(): Record<MonsterInkName, string> {
  const { colors } = useTheme();
  const out = {} as Record<MonsterInkName, string>;
  for (const name of Object.keys(MONSTER_TOKEN_NAMES) as MonsterInkName[]) {
    out[name] = colors[MONSTER_TOKEN_NAMES[name]] ?? colors["color-text-primary"];
  }
  return out;
}

export type WashKey = "clear" | "day" | "storm" | "snow" | "night";
export const WASH_TOKENS: Record<WashKey, [string, string]> = {
  clear: ["color-monster-wash-clear-top", "color-monster-wash-clear-bottom"],
  day: ["color-monster-wash-day-top", "color-monster-wash-day-bottom"],
  storm: ["color-monster-wash-storm-top", "color-monster-wash-storm-bottom"],
  snow: ["color-monster-wash-snow-top", "color-monster-wash-snow-bottom"],
  night: ["color-monster-wash-night-top", "color-monster-wash-night-bottom"],
};

/** Condition → wash family (web parity: WeatherSkins.getWeatherSkin bands). */
export function washPair(code: ConditionCode): WashKey {
  if (code === "night" || code === "partly-night") return "night";
  if (code === "storm") return "storm";
  if (code === "snow") return "snow";
  if (code === "clear" || code === "partly") return "clear";
  return "day";
}

/** Wash ink: white on the night field, warm dark ink on every light wash. */
export function washInkToken(code: ConditionCode): string {
  return washPair(code) === "night" ? "color-monster-glint" : "color-monster-ink-day";
}

/** Condition → the one saturated block that fills the "now" cell. */
export const CONDITION_TONE: Record<ConditionCode, MonsterInkName> = {
  clear: "orange",
  partly: "orange",
  "partly-night": "purple",
  cloudy: "blue",
  rain: "blue",
  storm: "orange",
  snow: "teal",
  fog: "purple",
  night: "purple",
};

/** The rounded-geometric label register (Fredoka loads in app/_layout.tsx). */
export const WX_LABEL: TextStyle = {
  fontFamily: "Fredoka",
  fontWeight: "700",
  textTransform: "uppercase",
  letterSpacing: 1.5,
};
