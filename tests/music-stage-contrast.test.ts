/**
 * THE STAGE'S GROUND — the glass panel over the tinted artwork (SP3-B task 3).
 *
 * The Now Playing stage has no field of its own any more. The BACKDROP paints
 * the artwork's own colour across the screen, veiled so the label clears 4.5:1
 * over the blurred art (the pure maths is `legibilityTint`, checked in
 * tests/music-backdrop.test.ts), and the stage is a GLASS PANEL on top of it.
 *
 * So the stage's ground is THREE layers deep, and the contract is measured on
 * the COMPOSITED pixel — the real one — never on a flat colour:
 *
 *     the cover's own colour
 *       → the backdrop's legibility veil   (the artwork's colour, banded)
 *         → the stage's glass panel         (translucent, toward its own ink)
 *           → the label                     (the FULL, opaque `label` token)
 *
 * WHY THE GLASS IS SAFE: it points at its OWN ink. The dark theme's glass is
 * near-black, so it DARKENS the ground the white label reads on; the light
 * theme's glass is white, so it LIGHTENS the ground the black label reads on.
 * The glass can therefore only ever IMPROVE the label's contrast over the
 * tinted artwork — never weaken it.
 *
 * AND THE PILL IS OPAQUE: the transport's glyphs sit on `glassStrong`, so
 * their contrast does not depend on the artwork at all.
 */
import { legibilityTint } from "../src/music/backdrop";
import { musicTokensFor } from "../src/theme/music-tokens";

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
  throw new Error(`unparseable colour: "${v}"`);
}

/** Resolve an rgba() token over an opaque ground so contrast is measured on the real pixel. */
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
 * The colours that break a naive ground: the two extremes, and the saturated
 * hues a cover can carry (the same adversarial set the banding contract uses).
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

/** The stage's text in the dark theme — the full tier, opaque. */
const DARK = musicTokensFor("dark", false);
/** The stage's text in the light theme — the full tier, opaque. */
const LIGHT = musicTokensFor("light", false);
/** The stage's text in the dark theme with boost — the tiers lift. */
const DARK_BOOST = musicTokensFor("dark", true);

/** The white page ink of the dark stage (the full label token). */
const WHITE_TEXT = "#FFFFFF";
/** The black page ink of the light stage (the full label token). */
const BLACK_TEXT = "#000000";

/**
 * The ground under one word on the stage: the cover, veiled by the backdrop
 * and then covered by the glass panel.
 */
function stageGround(hex: string, theme: "light" | "dark", glass: string): string {
  const veiled = composite(legibilityTint(hex, theme), hex);
  return composite(glass, veiled);
}

describe("the stage's ground — the glass panel over the tinted artwork", () => {
  it("white clears AA on every cover, through the glass, in the dark theme", () => {
    for (const hex of ADVERSARIAL) {
      const ground = stageGround(hex, "dark", DARK.glassFill);
      const ratio = contrast(ground, WHITE_TEXT);
      expect({ hex, ratio: ratio >= 4.5 }).toEqual({ hex, ratio: true });
    }
  });

  it("black clears AA on every cover, through the glass, in the light theme", () => {
    for (const hex of ADVERSARIAL) {
      const ground = stageGround(hex, "light", LIGHT.glassFill);
      const ratio = contrast(ground, BLACK_TEXT);
      expect({ hex, ratio: ratio >= 4.5 }).toEqual({ hex, ratio: true });
    }
  });

  it("the glass only ever pushes the ground toward its OWN ink", () => {
    // The dark theme's glass is near-black, so it DARKENS the ground the
    // white label reads on; the light theme's glass is white, so it LIGHTENS
    // the ground the black label reads on. The glass can only help.
    for (const hex of ADVERSARIAL) {
      const darkVeiled = composite(legibilityTint(hex, "dark"), hex);
      const darkGlass = stageGround(hex, "dark", DARK.glassFill);
      expect(luminance(darkGlass)).toBeLessThan(luminance(darkVeiled));

      const lightVeiled = composite(legibilityTint(hex, "light"), hex);
      const lightGlass = stageGround(hex, "light", LIGHT.glassFill);
      expect(luminance(lightGlass)).toBeGreaterThan(luminance(lightVeiled));
    }
  });

  it("the stage's own tier is the full, OPAQUE label token", () => {
    // Opaque is the point: the full tier composites to itself on ANY ground,
    // so the ground's luminance is the only variable the stage has to trust.
    expect(parseColor(DARK.label).a).toBe(1);
    expect(parseColor(LIGHT.label).a).toBe(1);
  });
});

/**
 * THE TOP SCRIM — the wallpaper's legibility gradient.
 *
 * The page's own chrome (the masthead, the search button) sits DIRECTLY on
 * the wallpaper, and the wallpaper's colour is unknown: a cover's BRIGHT
 * patches can wash the ground out. Measured on the panel, a white photo on a
 * dark sleeve left the white masthead on rgb(194,196,196) — **1.75:1**.
 *
 * The top gradient is the app's own scrim token, and it points at the theme's
 * ink (dark under a white label, light under a black one), so the ground it
 * paints is always the ground the label needs.
 */
describe("the top scrim", () => {
  it("holds the white label over the WORST artwork in the dark theme", () => {
    // the worst artwork is a white one: the scrim's own alpha is what keeps
    // the label legal over it.
    const ground = composite(DARK.scrimTop, "#FFFFFF");
    const ratio = contrast(ground, DARK.label);
    expect({ ground, ratio: ratio >= 4.5 }).toEqual({ ground, ratio: true });
  });

  it("holds the black label over the WORST artwork in the light theme", () => {
    const ground = composite(LIGHT.scrimTop, "#000000");
    const ratio = contrast(ground, LIGHT.label);
    expect({ ground, ratio: ratio >= 4.5 }).toEqual({ ground, ratio: true });
  });
});

/**
 * THE PILL — the transport's own surface.
 *
 * The pill carries the transport glyphs over a backdrop whose colour is
 * UNKNOWN (it is a cover), so it is OPAQUE: its contrast does not depend on
 * the artwork at all. That is why the token family has `glassStrong` for it.
 */
describe("the transport pill", () => {
  it("the glyphs clear AA on the pill in every variant", () => {
    for (const tokens of [LIGHT, DARK, DARK_BOOST]) {
      const ratio = contrast(tokens.glassStrong, tokens.label);
      expect({ variant: tokens.glassStrong, clears: ratio >= 4.5 }).toEqual({
        variant: tokens.glassStrong,
        clears: true,
      });
    }
  });

  it("the pill is OPAQUE — nothing of the artwork reaches its glyphs", () => {
    expect(parseColor(DARK.glassStrong).a).toBe(1);
    expect(parseColor(LIGHT.glassStrong).a).toBe(1);
    expect(parseColor(DARK_BOOST.glassStrong).a).toBe(1);
  });
});

/**
 * THE CODEC CHIP — the glass chip above the pill.
 *
 * The chip is a second glass layer on the panel, so its ground is the glass
 * over the glass over the veiled artwork. It reads the FULL label token, and
 * it clears AA over every cover in both themes.
 */
describe("the codec chip", () => {
  it("clears AA over every cover, in both themes", () => {
    for (const hex of ADVERSARIAL) {
      const panel = stageGround(hex, "dark", DARK.glassFill);
      const darkChip = composite(DARK.glassFill, panel);
      expect({ hex, dark: contrast(darkChip, DARK.label) >= 4.5 }).toEqual({
        hex,
        dark: true,
      });

      const lightPanel = stageGround(hex, "light", LIGHT.glassFill);
      const lightChip = composite(LIGHT.glassFill, lightPanel);
      expect({ hex, light: contrast(lightChip, LIGHT.label) >= 4.5 }).toEqual({
        hex,
        light: true,
      });
    }
  });
});

/**
 * THE CAST VOLUME'S MUTE BUTTON — the one control on the stage that still
 * wears the dark scrim.
 *
 * The scrim is a DARK translucent wash in BOTH themes, so it darkens the
 * ground under its own label: the white label gains in the dark theme, and
 * the black label keeps its contrast in the light one (the ground under a
 * dark scrim is never near-black in the light theme — the glass panel is
 * light, and the scrim only takes 28% of it away).
 */
describe("the cast volume's mute button on the glass", () => {
  it("the scrim keeps the label AA over every cover, in both themes", () => {
    for (const hex of ADVERSARIAL) {
      const darkPanel = stageGround(hex, "dark", DARK.glassFill);
      const darkButton = composite(DARK.scrim, darkPanel);
      expect({ hex, dark: contrast(darkButton, DARK.label) >= 4.5 }).toEqual({
        hex,
        dark: true,
      });

      const lightPanel = stageGround(hex, "light", LIGHT.glassFill);
      const lightButton = composite(LIGHT.scrim, lightPanel);
      expect({ hex, light: contrast(lightButton, LIGHT.label) >= 4.5 }).toEqual({
        hex,
        light: true,
      });
    }
  });
});

/**
 * THE QUEUE SHEET — the glass list over the tinted artwork (SP3-B Task 5).
 *
 * The queue is a listening surface on the SAME ground as the stage: the
 * backdrop's legibility veil, then the glass sheet on top. It follows the
 * SAME rule the stage documents — its text reads the FULL, opaque `label`
 * token, because the dim tiers fall under AA over the blurred art (~2.5:1
 * worst case). Hierarchy stays in size and weight, never in a sub-AA colour.
 */
describe("the queue sheet — the glass list over the tinted artwork", () => {
  it("the full label clears AA on every cover, through the glass, in both themes", () => {
    for (const hex of ADVERSARIAL) {
      const darkGround = stageGround(hex, "dark", DARK.glassFill);
      expect({ hex, dark: contrast(darkGround, DARK.label) >= 4.5 }).toEqual({ hex, dark: true });

      const lightGround = stageGround(hex, "light", LIGHT.glassFill);
      expect({ hex, light: contrast(lightGround, LIGHT.label) >= 4.5 }).toEqual({ hex, light: true });
    }
  });
});
