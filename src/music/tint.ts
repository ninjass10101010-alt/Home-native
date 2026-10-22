/**
 * The stage tint — the artwork's own colour, banded so body text stays AA.
 *
 * The Now Playing stage washes itself with the cover's colour. That colour is
 * EXTRACTED on-device (AndroidX Palette, in the engine module) and it can be
 * ANYTHING: a white sleeve, a black sleeve, a neon lime. Body text then sits
 * on it, so the raw colour cannot be used as it is.
 *
 * This module is the pure half of that pipeline: it parses the colour,
 * measures its WCAG relative luminance, and moves it into the band where body
 * text is still AA:
 *
 *   dark  [0.06, 0.17]  — white body text stays >= 4.5:1 (worst case 4.77:1)
 *   light [0.75, 0.92]  — black body text stays >= 4.5:1 (worst case 16:1)
 *
 * PURE by contract: no theme import, no I/O, no clock, no randomness. The
 * same input always gives the same tint — that is what makes it testable,
 * and what lets the stage's colour be a plain function of the artwork.
 *
 * The band anchors are pure black and pure white, written as CHANNEL NUMBERS
 * rather than colour literals: this file is colour MATH, and the token gate
 * (which bans literals outside the token modules) must stay clean.
 */

/** The luminance window a dark-theme stage tint may sit in. */
const DARK_BAND = { min: 0.06, max: 0.17 };

/** The luminance window a light-theme stage tint may sit in. */
const LIGHT_BAND = { min: 0.75, max: 0.92 };

/** How far each step moves the colour toward the anchor (5%). */
const STEP = 0.05;

/** The most steps the walk takes before the exact solve takes over. */
const MAX_STEPS = 20;

/** How many times the exact solve bisects the mix fraction. */
const SOLVE_STEPS = 40;

type Rgb = { r: number; g: number; b: number };

type Band = { min: number; max: number };

/** Pure black — the anchor a too-bright colour is mixed toward. */
const BLACK: Rgb = { r: 0, g: 0, b: 0 };

/** Pure white — the anchor a too-dark colour is mixed toward. */
const WHITE: Rgb = { r: 255, g: 255, b: 255 };

/** The channel value of an opaque colour's byte. */
function channel(value: number): number {
  return value / 255;
}

/** The WCAG linearisation of one channel (https://www.w3.org/TR/WCAG21/). */
function linearise(value: number): number {
  const c = channel(value);
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * Relative luminance (https://www.w3.org/TR/WCAG21/#dfn-relative-luminance).
 */
function luminanceOf(rgb: Rgb): number {
  return (
    0.2126 * linearise(rgb.r) +
    0.7152 * linearise(rgb.g) +
    0.0722 * linearise(rgb.b)
  );
}

/** The colour as the pixel it becomes — the byte the screen actually shows. */
function asPixel(rgb: Rgb): Rgb {
  return {
    r: Math.round(rgb.r),
    g: Math.round(rgb.g),
    b: Math.round(rgb.b),
  };
}

/** True when the colour's PIXEL luminance sits inside the band. */
function insideBand(rgb: Rgb, band: Band): boolean {
  const lum = luminanceOf(asPixel(rgb));
  return lum >= band.min && lum <= band.max;
}

/** Parse a #rgb / #rrggbb string. Null when it is not a colour. */
function parseHex(hex: string): Rgb | null {
  const match = hex.trim().match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!match) return null;
  const digits =
    match[1].length === 3
      ? match[1]
          .split("")
          .map((c) => c + c)
          .join("")
      : match[1];
  return {
    r: parseInt(digits.slice(0, 2), 16),
    g: parseInt(digits.slice(2, 4), 16),
    b: parseInt(digits.slice(4, 6), 16),
  };
}

/** The colour mixed `t` of the way toward the anchor. */
function mix(rgb: Rgb, anchor: Rgb, t: number): Rgb {
  return {
    r: rgb.r + (anchor.r - rgb.r) * t,
    g: rgb.g + (anchor.g - rgb.g) * t,
    b: rgb.b + (anchor.b - rgb.b) * t,
  };
}

/** The colour as a six-digit hex. */
function toHex(rgb: Rgb): string {
  const byte = (n: number) =>
    Math.round(n).toString(16).padStart(2, "0");
  return `#${byte(rgb.r)}${byte(rgb.g)}${byte(rgb.b)}`;
}

/**
 * The grey whose luminance is exactly `target`.
 *
 * Used for the neutral fallback: a stage that has no colour to band still
 * needs a readable ground, and a computed grey keeps this module free of
 * colour literals.
 */
function greyFor(target: number): Rgb {
  const c =
    target <= 0.03928
      ? target * 12.92
      : Math.pow((target + 0.055) / 1.055, 1 / 2.4);
  const value = Math.round(c * 255);
  return { r: value, g: value, b: value };
}

/**
 * The exact mix fraction that lands the colour in the middle of the band.
 *
 * The step walk is the nicer answer (it keeps the most of the artwork's
 * colour), but it can run out of steps before it lands — a near-black
 * cover needs a long walk toward white to reach the light band. The solve is
 * the guarantee: the luminance moves monotonically with the mix fraction, so
 * a bisection finds the fraction that hits the band's middle.
 */
function solve(rgb: Rgb, anchor: Rgb, band: Band): Rgb {
  const target = (band.min + band.max) / 2;
  const rising = anchor === WHITE;
  let low = 0;
  let high = 1;
  for (let i = 0; i < SOLVE_STEPS; i++) {
    const mid = (low + high) / 2;
    const lum = luminanceOf(asPixel(mix(rgb, anchor, mid)));
    if (rising ? lum < target : lum > target) low = mid;
    else high = mid;
  }
  return mix(rgb, anchor, (low + high) / 2);
}

/**
 * The stage tint for one artwork colour.
 *
 * The colour is banded so that body text stays AA on it: a tint that is too
 * bright (or too dark) for the theme's text colour is moved toward the
 * theme's anchor — black for a dark stage, white for a light one — until it
 * lands inside the band's luminance window. The first landing wins, so the
 * tint keeps as much of the artwork's own colour as the band allows.
 *
 * A colour that is already inside the band is returned untouched.
 */
export function bandStageTint(hex: string, theme: "light" | "dark"): string {
  const band = theme === "light" ? LIGHT_BAND : DARK_BAND;
  const rgb = parseHex(hex);
  // No colour to band: the stage still needs a readable ground, so it gets
  // the band's neutral — never a colour that pretends to be the artwork's.
  if (!rgb) return toHex(greyFor((band.min + band.max) / 2));
  if (insideBand(rgb, band)) return hex.trim();

  // Toward the anchor that moves the luminance INTO the band.
  const anchor = luminanceOf(rgb) > band.max ? BLACK : WHITE;
  for (let step = 1; step <= MAX_STEPS; step++) {
    const candidate = mix(rgb, anchor, step * STEP);
    if (insideBand(candidate, band)) return toHex(candidate);
  }
  return toHex(solve(rgb, anchor, band));
}
