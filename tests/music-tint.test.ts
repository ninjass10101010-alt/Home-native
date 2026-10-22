/**
 * The stage tint's contract (SP2 Task 2).
 *
 * The Now Playing stage tints itself from the artwork's own colour. That
 * colour is EXTRACTED on-device (AndroidX Palette, in the engine module) and
 * then BANDED here: the raw artwork colour can be anything, and body text
 * has to stay AA on whatever lands on the stage.
 *
 * The bands (WCAG relative luminance):
 *   dark  [0.06, 0.15]  — white body text stays >= 4.5:1 (worst case 5.25:1)
 *   light [0.75, 0.92]  — black body text stays >= 4.5:1 (worst case 16:1)
 *
 * The dark band stops at 0.15 so it leaves HEADROOM: the stage paints
 * translucent chrome over its ground, and the text has to clear 4.5:1 where
 * that chrome sits (see tests/music-stage-contrast.test.ts).
 *
 * `bandStageTint` is PURE: no theme import, no I/O, no clock. It is the one
 * piece of the tint pipeline that can be machine-checked, so it is checked
 * here — including for the adversarial colours (pure black, pure white, the
 * saturated hues that make a stage unreadable).
 */
import { bandStageTint } from "../src/music/tint";

/* ── WCAG 2.1 colour maths ─────────────────────────────────────────────── */

/** Red/green/blue channel of a #rrggbb string, offset by byte index. */
function channel(hex: string, i: number) {
  return parseInt(hex.slice(i, i + 2), 16) / 255;
}

/** Relative luminance (https://www.w3.org/TR/WCAG21/#dfn-relative-luminance). */
function luminance(hex: string) {
  const f = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return (
    0.2126 * f(channel(hex, 1)) +
    0.7152 * f(channel(hex, 3)) +
    0.0722 * f(channel(hex, 5))
  );
}

/** Contrast ratio between two opaque colours (the higher luminance on top). */
function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

type Rgba = { r: number; g: number; b: number; a: number };

function parseColor(c: string): Rgba {
  const v = c.trim();
  const hex = v.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (hex) {
    const s =
      hex[1].length === 3
        ? hex[1]
            .split("")
            .map((c) => c + c)
            .join("")
        : hex[1];
    return {
      r: parseInt(s.slice(0, 2), 16),
      g: parseInt(s.slice(2, 4), 16),
      b: parseInt(s.slice(4, 6), 16),
      a: 1,
    };
  }
  const m = v.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/i
  );
  if (m) {
    return {
      r: parseInt(m[1], 10),
      g: parseInt(m[2], 10),
      b: parseInt(m[3], 10),
      a: m[4] === undefined ? 1 : parseFloat(m[4]),
    };
  }
  throw new Error(`unparseable colour: "${c}"`);
}

/** Resolve an rgba() token over its ground so contrast is measured on the real pixel. */
function composite(fg: string, bg: string): string {
  const f = parseColor(fg);
  const b = parseColor(bg);
  if (b.a !== 1) {
    throw new Error(`composite(): the ground must be opaque, got "${bg}"`);
  }
  const blend = (top: number, bottom: number) =>
    Math.round(top * f.a + bottom * (1 - f.a));
  const byte = (n: number) => n.toString(16).padStart(2, "0");
  return `#${byte(blend(f.r, b.r))}${byte(blend(f.g, b.g))}${byte(blend(f.b, b.b))}`;
}

/* ── The contract under test ────────────────────────────────────────────── */

/**
 * The colours that break a naive tint: the two extremes, and the saturated
 * hues a cover can carry (the app's own accent, the system greens/blues, a
 * neon lime).
 */
const ADVERSARIAL = [
  "#FFFFFF",
  "#000000",
  "#FF2D55",
  "#FF375F",
  "#30D158",
  "#3B82F6",
  "#F59E0B",
  "#7C6FF7",
  "#F43F5E",
  "#84CC16",
  "#4ade80",
];

/** The dark band's luminance window. */
const DARK_BAND = { min: 0.06, max: 0.15 };
/** The light band's luminance window. */
const LIGHT_BAND = { min: 0.75, max: 0.92 };

/** The page ground the stage sits on — the tint is measured on the real pixel. */
const GROUND = { dark: "#000000", light: "#FFFFFF" };

/** A colour that already sits inside the dark band (luminance 0.069). */
const DARK_IN_BAND = "#3A4A6B";
/** A colour that already sits inside the light band (luminance 0.761). */
const LIGHT_IN_BAND = "#E2E2E2";

describe("bandStageTint", () => {
  it("dark band: white body text clears 4.5:1 on the banded tint, for every adversarial colour", () => {
    for (const hex of ADVERSARIAL) {
      const tint = bandStageTint(hex, "dark");
      const ratio = contrast(composite(tint, GROUND.dark), "#FFFFFF");
      expect({ hex, ratio: ratio >= 4.5 }).toEqual({ hex, ratio: true });
    }
  });

  it("light band: black body text clears 4.5:1 on the banded tint", () => {
    for (const hex of ADVERSARIAL) {
      const tint = bandStageTint(hex, "light");
      const ratio = contrast(composite(tint, GROUND.light), "#000000");
      expect({ hex, ratio: ratio >= 4.5 }).toEqual({ hex, ratio: true });
    }
  });

  it("dark band: the tint's luminance lands inside the dark band", () => {
    for (const hex of ADVERSARIAL) {
      const lum = luminance(bandStageTint(hex, "dark"));
      expect(lum).toBeGreaterThanOrEqual(DARK_BAND.min);
      expect(lum).toBeLessThanOrEqual(DARK_BAND.max);
    }
  });

  it("light band: the tint's luminance lands inside the light band", () => {
    for (const hex of ADVERSARIAL) {
      const lum = luminance(bandStageTint(hex, "light"));
      expect(lum).toBeGreaterThanOrEqual(LIGHT_BAND.min);
      expect(lum).toBeLessThanOrEqual(LIGHT_BAND.max);
    }
  });

  it("never returns the input unchanged when it is outside the band", () => {
    expect(bandStageTint("#FFFFFF", "dark")).not.toBe("#FFFFFF");
    expect(bandStageTint("#000000", "light")).not.toBe("#000000");
    expect(bandStageTint("#000000", "dark")).not.toBe("#000000");
    expect(bandStageTint("#FFFFFF", "light")).not.toBe("#FFFFFF");
  });

  it("leaves an in-band colour alone", () => {
    expect(bandStageTint(DARK_IN_BAND, "dark")).toBe(DARK_IN_BAND);
    expect(bandStageTint(LIGHT_IN_BAND, "light")).toBe(LIGHT_IN_BAND);
  });

  it("the neutral fallback lands INSIDE the band — it is a ground, not a guess", () => {
    // A colour that is not a colour at all still gets a readable ground: the
    // banded grey. It has to land INSIDE the band, or the ground it hands
    // back is exactly the ground the band exists to avoid.
    const dark = bandStageTint("not-a-colour", "dark");
    const light = bandStageTint("not-a-colour", "light");
    const darkLum = luminance(dark);
    const lightLum = luminance(light);
    expect(darkLum).toBeGreaterThanOrEqual(DARK_BAND.min);
    expect(darkLum).toBeLessThanOrEqual(DARK_BAND.max);
    expect(lightLum).toBeGreaterThanOrEqual(LIGHT_BAND.min);
    expect(lightLum).toBeLessThanOrEqual(LIGHT_BAND.max);
    // and it is a neutral, not a colour pretending to be the artwork's
    expect(dark).toMatch(/^#([0-9a-f]{2})\1\1$/);
  });

  it("answers with an opaque six-digit hex", () => {
    for (const hex of ADVERSARIAL) {
      expect(bandStageTint(hex, "dark")).toMatch(/^#[0-9a-f]{6}$/);
      expect(bandStageTint(hex, "light")).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("keeps the artwork's hue: the banded tint is the artwork, darkened or lifted", () => {
    // The tint must still BE the cover's colour — a stage that turns every
    // cover into the same grey has thrown the artwork away.
    const dark = bandStageTint("#FF2D55", "dark");
    const red = parseInt(dark.slice(1, 3), 16);
    const blue = parseInt(dark.slice(5, 7), 16);
    expect(red).toBeGreaterThan(blue);

    const light = bandStageTint("#3B82F6", "light");
    const lred = parseInt(light.slice(1, 3), 16);
    const lblue = parseInt(light.slice(5, 7), 16);
    expect(lblue).toBeGreaterThan(lred);
  });
});
