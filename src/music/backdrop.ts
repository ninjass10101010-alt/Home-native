/**
 * The living artwork backdrop — the PURE half of the pipeline.
 *
 * The music surface's wallpaper is the TRACK'S OWN artwork: blurred on-device
 * (the engine module's `artworkBlurred`), tinted with the artwork's own
 * colour, drifting slowly under a static grain. This module is the part of
 * that pipeline that is a FUNCTION of the artwork and the clock — the drift's
 * maths, the tint's alpha, the grain's alpha — and it is the part that can
 * be machine-checked without a device.
 *
 * THREE CONTRACTS:
 *
 *   1. THE DRIFT IS SLOW, BOUNDED AND WRAPPING. A 20 s cycle: the artwork
 *      scales 1.00 → 1.06 and drifts a couple of percent. It WRAPS, so the
 *      same position always gives the same transform — and the wrap is the
 *      reason the drift can be a pure function of the PLAYBACK position
 *      (which is also why nothing animates while the wall is idle: a paused
 *      track's position does not advance, so the drift does not either).
 *
 *   2. THE TINT GUARANTEES THE TITLE. The artwork is a cover: its colour is
 *      UNKNOWN and can be anything — a white sleeve, a black sleeve, a neon
 *      lime. The label has to stay AA on whatever lands under it, so the
 *      tint is the artwork's own colour BANDED (the `bandStageTint` idea: the
 *      colour is moved into the theme's legibility band) and then VEILED at
 *      an alpha solved so the composited ground holds the label at 4.5:1.
 *      The alpha is measured on the COMPOSITED pixel, never on a flat colour.
 *
 *   3. THE GRAIN IS STATIC. A faint neutral overlay that never animates: the
 *      wall runs all day, and an animated grain is a battery bug, not a look.
 *
 * PURE by contract: no I/O, no clock, no randomness. The only import is the
 * token module (for the grain's alpha), so the same input always gives the
 * same output — that is what makes it testable.
 *
 * THE COLOUR MATHS LIVES HERE, NOT IN THE TOKENS: the band anchors are pure
 * black and pure white, written as CHANNEL NUMBERS rather than colour
 * literals, because this file is colour MATH and the token gate (which bans
 * literals outside the token modules) must stay clean.
 */

import { musicTokensFor } from "../theme/music-tokens";

/**
 * The drift's contract — the numbers the drift is built on.
 *
 * They live here as ONE record so the tests can pin the WORKLET's copy
 * against it. The worklet cannot read this module's scope (a worklet runs on
 * the UI thread, where a module constant is `undefined` — the panel's first
 * build crashed on exactly that), so its copy is a literal; a literal that
 * drifted from this record would be a silent change to the wallpaper.
 */
export const BACKDROP_DRIFT = {
  /** The cycle, in milliseconds. */
  periodMs: 20000,
  /** The scale the artwork starts at. */
  scaleFrom: 1.0,
  /** The scale it reaches at the end of the cycle. */
  scaleTo: 1.06,
  /** The drift's reach, as a fraction of the artwork's own size. */
  reach: 0.018,
} as const;

/**
 * The drift's cycle, in milliseconds (the wall's slow, endless breath).
 */
export const KEN_BURNS_PERIOD_MS = BACKDROP_DRIFT.periodMs;

/**
 * The ground's luminance ceiling in the dark theme (white label at AA).
 *
 * White on a ground of luminance L measures 1.05 / (L + 0.05), so the AA
 * floor of 4.5:1 sits at L = 0.183. The ceiling here is a little lower: the
 * label is measured on a ROUNDED pixel, and the margin absorbs that.
 */
const DARK_GROUND_MAX = 0.165;

/**
 * The ground's luminance floor in the light theme (black label at AA).
 *
 * Black on a ground of luminance L measures (L + 0.05) / 0.05, so the AA
 * floor of 4.5:1 sits at L = 0.175. The floor here is a little higher, for
 * the same rounding reason.
 */
const LIGHT_GROUND_MIN = 0.19;

/**
 * How far the artwork may stray from its own dominant colour.
 *
 * The dominant swatch is the cover's CENTRE, not its brightest patch: a dark
 * sleeve with a white word still has a dark dominant colour, and the blurred
 * artwork keeps that word's glow. The headroom covers the art's own
 * highlights (dark theme) and shadows (light theme), so the guarantee holds
 * for the artwork, not only for its swatch.
 */
const ART_HEADROOM = 0.25;

/** The least veil the artwork always wears — the tint is never absent. */
const MIN_ALPHA = 0.25;

type Rgb = { r: number; g: number; b: number };

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

/**
 * The band a ground must sit in, per theme.
 *
 * The dark theme's label is white, so the ground must stay DARK enough for
 * it; the light theme's label is black, so the ground must stay LIGHT enough
 * for it. These are the two ceilings/floors that hold the label at 4.5:1
 * (white on a ground of luminance L: 1.05 / (L + 0.05) >= 4.5 → L <= 0.183;
 * black: (L + 0.05) / 0.05 >= 4.5 → L >= 0.175).
 */
const DARK_BAND = { min: 0.06, max: 0.15 };
const LIGHT_BAND = { min: 0.75, max: 0.92 };

/** How far each step moves the colour toward the anchor (5%). */
const STEP = 0.05;

/** The most steps the walk takes before the exact solve takes over. */
const MAX_STEPS = 20;

/** How many times the exact solve bisects the mix fraction. */
const SOLVE_STEPS = 40;

/** True when the colour's PIXEL luminance sits inside the band. */
function insideBand(rgb: Rgb, band: { min: number; max: number }): boolean {
  const pixel = {
    r: Math.round(rgb.r),
    g: Math.round(rgb.g),
    b: Math.round(rgb.b),
  };
  const lum = luminanceOf(pixel);
  return lum >= band.min && lum <= band.max;
}

/**
 * The exact mix fraction that lands the colour in the middle of the band.
 *
 * The step walk is the nicer answer (it keeps the most of the artwork's
 * colour), but it can run out of steps before it lands. The solve is the
 * guarantee: the luminance moves monotonically with the mix fraction, so a
 * bisection finds the fraction that hits the band's middle.
 */
function solve(rgb: Rgb, anchor: Rgb, band: { min: number; max: number }): Rgb {
  const target = (band.min + band.max) / 2;
  const rising = anchor === WHITE;
  let low = 0;
  let high = 1;
  for (let i = 0; i < SOLVE_STEPS; i++) {
    const mid = (low + high) / 2;
    const lum = luminanceOf({
      r: Math.round(mix(rgb, anchor, mid).r),
      g: Math.round(mix(rgb, anchor, mid).g),
      b: Math.round(mix(rgb, anchor, mid).b),
    });
    if (rising ? lum < target : lum > target) low = mid;
    else high = mid;
  }
  return mix(rgb, anchor, (low + high) / 2);
}

/**
 * The artwork's colour, banded for the theme's ground.
 *
 * The same contract as the stage's `bandStageTint` (see src/music/tint.ts):
 * the colour is moved toward the theme's anchor until it lands inside the
 * theme's band, so the VEIL the backdrop paints is a legal ground by
 * construction. A colour that is already inside the band is left alone; a
 * colour that is not a colour at all gets the band's neutral — never a hue
 * that pretends to be the artwork's.
 */
function bandTint(hex: string, theme: "light" | "dark"): Rgb {
  const band = theme === "light" ? LIGHT_BAND : DARK_BAND;
  const rgb = parseHex(hex);
  if (!rgb) {
    const grey = (band.min + band.max) / 2;
    const c =
      grey <= 0.03928
        ? grey * 12.92
        : Math.pow(grey, 1 / 2.4) * 1.055 - 0.055;
    const value = Math.round(Math.min(255, Math.max(0, c * 255)));
    return { r: value, g: value, b: value };
  }
  if (insideBand(rgb, band)) return rgb;
  const anchor = luminanceOf(rgb) > band.max ? BLACK : WHITE;
  for (let step = 1; step <= MAX_STEPS; step++) {
    const candidate = mix(rgb, anchor, step * STEP);
    if (insideBand(candidate, band)) return candidate;
  }
  return solve(rgb, anchor, band);
}

/**
 * The position's place in the drift's cycle, as 0 … 1.
 *
 * The wrap is the contract: the same position always gives the same place
 * in the cycle, so the drift is a pure function of the playback clock (and a
 * paused track's backdrop holds still).
 *
 * A WORKLET: the drift is applied on the UI thread, so this runs there too.
 */
function cyclePhase(positionMs: number, periodMs: number): number {
  "worklet";
  if (!Number.isFinite(positionMs) || !Number.isFinite(periodMs) || periodMs <= 0) {
    return 0;
  }
  const wrapped = ((positionMs % periodMs) + periodMs) % periodMs;
  return wrapped / periodMs;
}

/**
 * The Ken-Burns scale at a position: 1.00 → 1.06 over the cycle.
 *
 * The ramp is LINEAR (the artwork grows at a constant, imperceptible rate) and
 * it WRAPS at the cycle's end — the wrap is the reset, and it is invisible
 * in practice because the artwork changes with the track.
 *
 * A WORKLET: the drift is applied on the UI thread. Its numbers are LITERALS
 * (the module's scope is not reachable from there — see BACKDROP_DRIFT).
 */
export function kenBurnsScale(
  positionMs: number,
  periodMs: number = 20000
): number {
  "worklet";
  const phase = cyclePhase(positionMs, periodMs);
  return 1.0 + 0.06 * phase;
}

/**
 * The Ken-Burns drift at a position, as a fraction of the artwork's size.
 *
 * A slow ellipse: the artwork breathes around its centre and never leaves its
 * two percent — a backdrop that slid off the screen would be a bug, not a
 * style. The drift is CONTINUOUS (it is a loop, not a ramp), so the only
 * discontinuity in the whole backdrop is the scale's wrap.
 *
 * A WORKLET: the drift is applied on the UI thread. Its numbers are LITERALS
 * (the module's scope is not reachable from there — see BACKDROP_DRIFT).
 */
export function kenBurnsTranslate(
  positionMs: number,
  periodMs: number = 20000
): { x: number; y: number } {
  "worklet";
  const phase = cyclePhase(positionMs, periodMs);
  const angle = phase * 2 * Math.PI;
  const reach = 0.018;
  return {
    x: reach * Math.sin(angle),
    y: reach * Math.sin(angle * 2) * 0.5,
  };
}

/**
 * The composited pixel's luminance — the veil over the artwork.
 *
 * THE COMPOSITE HAPPENS IN sRGB, NOT IN LUMINANCE. Alpha compositing blends
 * the CHANNELS (that is what the screen does), and the luminance of the
 * result is then measured on the blended pixel. Solving in luminance space
 * instead would put a black cover's light veil a full step short of the AA
 * floor — the maths has to happen where the pixels happen.
 *
 * The channels are ROUNDED exactly as the tests round them, so the alpha this
 * module picks is the alpha that is measured.
 */
function compositeLuminance(veil: Rgb, art: Rgb, alpha: number): number {
  const blend = (top: number, bottom: number) =>
    Math.round(top * alpha + bottom * (1 - alpha));
  return luminanceOf({
    r: blend(veil.r, art.r),
    g: blend(veil.g, art.g),
    b: blend(veil.b, art.b),
  });
}

/**
 * The veil's alpha for one artwork and one theme.
 *
 * The veil's COLOUR is the artwork's own banded colour (so the backdrop keeps
 * the cover's hue); the alpha is the SMALLEST one that keeps the composited
 * ground legal for the theme's label:
 *
 *   dark  the ground's luminance must fall to DARK_GROUND_MAX
 *   light the ground's luminance must rise to LIGHT_GROUND_MIN
 *
 * The scan starts at MIN_ALPHA (the backdrop always wears the artwork's
 * colour) and steps up until the composited ground is legal. The veil alone
 * is always legal — it sits inside the theme's band — so the scan ends.
 *
 * The steps are multiples of 0.005 and the alpha is written with three
 * decimals, so the value the app paints is exactly the value that was
 * measured (no rounding drift between the solve and the screen).
 */
function solveAlpha(veil: Rgb, art: Rgb, theme: "light" | "dark"): number {
  const legal = (alpha: number) => {
    const lum = compositeLuminance(veil, art, alpha);
    return theme === "dark" ? lum <= DARK_GROUND_MAX : lum >= LIGHT_GROUND_MIN;
  };
  if (legal(MIN_ALPHA)) return MIN_ALPHA;
  for (let step = 1; step <= 200; step++) {
    const alpha = MIN_ALPHA + step * 0.005;
    if (alpha > 1) break;
    if (legal(alpha)) return alpha;
  }
  return 1;
}

/**
 * The legibility tint for one artwork — an rgba() veil over the blurred art.
 *
 * The veil is the artwork's own colour, banded, at an alpha that GUARANTEES
 * the theme's label clears 4.5:1 over the tinted artwork. The guarantee is
 * measured on the composited pixel (see tests/music-backdrop.test.ts) — the
 * backdrop's colour is unknown, so it cannot be taken on faith.
 *
 * THE ARTWORK IS TAKEN AT ITS WORST: the dominant swatch is the cover's
 * CENTRE, not its brightest patch, so the swatch is moved toward the
 * theme's "too bright for the label" direction (white in dark, black in
 * light) by the headroom before the alpha is solved. In the dark theme a
 * darker artwork only makes the guarantee easier; in the light theme a
 * brighter one does.
 *
 * A colour that is not a colour gets the band's neutral veil at the alpha
 * that holds the label over the WORST artwork (a white cover in the dark
 * theme, a black one in the light theme): an unknown cover must never make
 * the title unreadable.
 */
export function legibilityTint(hex: string, theme: "light" | "dark"): string {
  const veil = bandTint(hex, theme);
  const art = parseHex(hex);
  const swatch = art ?? (theme === "dark" ? WHITE : BLACK);
  const worst =
    theme === "dark"
      ? mix(swatch, WHITE, ART_HEADROOM)
      : mix(swatch, BLACK, ART_HEADROOM);
  const alpha = solveAlpha(veil, worst, theme);
  const byte = (n: number) => Math.round(n);
  return `rgba(${byte(veil.r)}, ${byte(veil.g)}, ${byte(veil.b)}, ${alpha.toFixed(3)})`;
}

/**
 * The grain's alpha for a theme — STATIC, never animated.
 *
 * The value comes from the theme's own grain token, so the pure module and
 * the painted overlay can never disagree about how much grain there is.
 */
export function grainAlpha(theme: "light" | "dark"): number {
  const grain = musicTokensFor(theme, false).grain;
  const match = grain.match(
    /rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\s*\)/i
  );
  return match ? parseFloat(match[1]) : 0;
}
