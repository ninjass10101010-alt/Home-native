/**
 * The stage's contrast contract — the text on the artwork-tinted field.
 *
 * The Now Playing stage is a field tinted from the ARTWORK's own colour, so
 * its ground luminance is NOT the page ground the Liquid tiers were checked
 * against (see tests/music-tokens.test.ts). A dim tier that clears 4.5:1 on
 * the page ground can be far under it on the tinted field: measured on the
 * dark band, the artist tier (label2) read ~3.4:1 and the time labels
 * (label3) ~2.6:1 — both under the 4.5:1 floor for 14sp+ body text.
 *
 * Dim tiers cannot be rescued on ANY tinted field without flattening the tint
 * to near-black, so this is a DESIGN decision, not a bigger scrim:
 *
 *   THE RULE (the repo's own): to add emphasis, change weight or size —
 *   never colour.
 *
 * So the stage does NOT dim its text. Every tier on the tinted field reads the
 * FULL `label` token (opaque white in dark, opaque black in light) and the
 * hierarchy comes from the stage's type steps (title 40sp > artist 17sp >
 * times 14sp) and weight. The tint itself stays the artwork's own colour.
 *
 * THE CONTRACT MEASURED HERE (the composited pixel — the real one):
 *   white on the dark band's WORST ground (its brightest)   >= 5:1 (headroom)
 *   black on the light band's WORST ground (its darkest)   >= 4.5:1
 *   the dim tiers may NOT be used on the tinted field        (they fail there)
 *
 * The band is PROBED here, never copied from the source: the contract is the
 * ground the band can actually hand back, so a band that drifts is caught.
 */
import { bandStageTint } from "../src/music/tint";
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

/** The white page ink of the dark stage (the full label token). */
const WHITE_TEXT = "#FFFFFF";
/** The black page ink of the light stage (the full label token). */
const BLACK_TEXT = "#000000";

/** A neutral grey at one byte value — the probe for the band's edges. */
function grey(byte: number): string {
  const hex = byte.toString(16).padStart(2, "0");
  return `#${hex}${hex}${hex}`;
}

/**
 * The BRIGHTEST ground the dark band can hand back — the band's upper edge,
 * found by probing the band with every grey and keeping the BANDED output.
 */
function brightestBandedGround(): string {
  let best = { hex: grey(0), luminance: -1 };
  for (let byte = 0; byte <= 255; byte++) {
    const hex = grey(byte);
    const banded = bandStageTint(hex, "dark");
    const lum = luminance(banded);
    if (lum > best.luminance) best = { hex: banded, luminance: lum };
  }
  return best.hex;
}

/**
 * The DARKEST ground the light band can hand back — the band's lower edge,
 * found the same way.
 */
function darkestBandedGround(): string {
  let best = { hex: grey(255), luminance: 2 };
  for (let byte = 0; byte <= 255; byte++) {
    const hex = grey(byte);
    const banded = bandStageTint(hex, "light");
    const lum = luminance(banded);
    if (lum < best.luminance) best = { hex: banded, luminance: lum };
  }
  return best.hex;
}

describe("the stage's tinted field — the text contract", () => {
  it("white clears AA on every banded dark ground", () => {
    for (const hex of ADVERSARIAL) {
      const tint = bandStageTint(hex, "dark");
      const ratio = contrast(tint, WHITE_TEXT);
      expect({ hex, ratio: ratio >= 4.5 }).toEqual({ hex, ratio: true });
    }
  });

  it("black clears AA on every banded light ground", () => {
    for (const hex of ADVERSARIAL) {
      const tint = bandStageTint(hex, "light");
      const ratio = contrast(tint, BLACK_TEXT);
      expect({ hex, ratio: ratio >= 4.5 }).toEqual({ hex, ratio: true });
    }
  });

  it("the dark band leaves headroom: white on the band's brightest ground clears 5:1", () => {
    // The band's UPPER edge is the worst case for white text (the higher the
    // ground's luminance, the lower the ratio). The floor is 5:1, not 4.5:1 —
    // the stage paints translucent chrome over its ground, so the band needs
    // headroom above the bare AA floor.
    const ground = brightestBandedGround();
    const ratio = contrast(ground, WHITE_TEXT);
    expect({ ground, clears: ratio >= 5.0 }).toEqual({ ground, clears: true });
  });

  it("the light band's darkest ground still clears AA for black", () => {
    const ground = darkestBandedGround();
    const ratio = contrast(ground, BLACK_TEXT);
    expect({ ground, clears: ratio >= 4.5 }).toEqual({ ground, clears: true });
  });

  it("the dim tiers FAIL on the tinted field — so the stage may not use them", () => {
    // The WHY behind the design decision: at the dark band's brightest ground
    // (the worst case for a dim tier) neither the second nor the third tier
    // clears 4.5:1. No scrim rescues them without flattening the tint.
    const ground = brightestBandedGround();
    const label2 = contrast(composite(DARK.label2, ground), ground);
    const label3 = contrast(composite(DARK.label3, ground), ground);
    expect({ ground, label2Fails: label2 < 4.5, label3Fails: label3 < 4.5 }).toEqual({
      ground,
      label2Fails: true,
      label3Fails: true,
    });
  });

  it("the stage's own tier is the full, OPAQUE label token", () => {
    // Opaque is the point: the full tier composites to itself on ANY ground,
    // so the tint's own luminance is the only variable the stage has to trust.
    expect(parseColor(DARK.label).a).toBe(1);
    expect(parseColor(LIGHT.label).a).toBe(1);
  });
});
