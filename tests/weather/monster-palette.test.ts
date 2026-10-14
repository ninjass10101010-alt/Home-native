// Home-native/tests/weather/monster-palette.test.ts
import { TOKENS } from "../../src/theme/tokens";

/** Web parity pins — Home-ai src/components/ui/wx-tokens.ts:78-91 (MONSTER) +
 *  WeatherSkins.ts washes (summer day / WX_POSTER clear / NIGHT_SKIN, with the
 *  storm 62%-gray and snow 55%-slate severity mixes pre-computed). If either
 *  surface retunes a value, this table fails FIRST. */
const PINS: Record<string, string> = {
  "color-monster-red": "#EF4D6F",
  "color-monster-blue": "#2E6DB4",
  "color-monster-purple": "#A98BDC",
  "color-monster-orange": "#F6A83C",
  "color-monster-teal": "#7DCDE4",
  "color-monster-glint": "#FFFFFF",
  "color-monster-ink-blue": "#10284A",
  "color-monster-ink-red": "#5F1230",
  "color-monster-ink-orange": "#7A4A16",
  "color-monster-knot-red": "#C2304F",
  "color-monster-knot-orange": "#DE8F2E",
  "color-monster-knot-purple": "#8B6BC2",
  "color-monster-pupil": "#101418",
  "color-monster-star-cream": "#FFF9E6",
  "color-monster-star-warm": "#F6D7A8",
  "color-monster-ink-day": "#211310",
  "color-monster-wash-clear-top": "#55BCE8",
  "color-monster-wash-clear-bottom": "#D8F2F4",
  "color-monster-wash-day-top": "#A8DFF8",
  "color-monster-wash-day-bottom": "#E3F4FC",
  "color-monster-wash-storm-top": "#9FBACA",
  "color-monster-wash-storm-bottom": "#A4B0BC",
  "color-monster-wash-snow-top": "#98B8D3",
  "color-monster-wash-snow-bottom": "#AABACB",
  "color-monster-wash-night-top": "#1B1E33",
  "color-monster-wash-night-bottom": "#2A2440",
};

describe("monster surface tokens (web MONSTER parity)", () => {
  it.each(Object.entries(PINS))("dark pins %s", (k, v) => {
    expect(TOKENS.dark[k]).toBe(v);
  });
  it.each(Object.entries(PINS))("light pins %s", (k, v) => {
    expect(TOKENS.light[k]).toBe(v);
  });
});
