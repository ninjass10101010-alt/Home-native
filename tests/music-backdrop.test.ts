/**
 * The living artwork backdrop's contract (SP3-B Task 2).
 *
 * The backdrop is the music surface's wallpaper: the track's own artwork,
 * blurred on-device, tinted with its own colour and drifting slowly under a
 * static grain. The drift and the tint are the PURE half of that pipeline
 * (`src/music/backdrop.ts`), and they are the half that can be machine-checked
 * — so they are checked here.
 *
 * THREE RULES, in order of importance:
 *
 *   1. THE DRIFT IS SLOW AND BOUNDED. A 20 s cycle that scales the artwork
 *      1.00 → 1.06 and drifts it a couple of percent. It WRAPS (the same
 *      input always gives the same output) and it never leaves its bounds —
 *      a backdrop that slid off the screen would be a bug, not a style.
 *
 *   2. THE TINT GUARANTEES THE TITLE. The artwork is a cover: its colour is
 *      unknown and can be ANYTHING. The tint is that colour, banded (the
 *      `bandStageTint` idea) and veiled at an alpha that GUARANTEES the
 *      theme's label clears 4.5:1 over the tinted artwork — measured on the
 *      COMPOSITED pixel, never on a flat colour.
 *
 *   3. THE GRAIN IS STATIC. A ~4% neutral overlay that never animates: the
 *      wall runs all day, and an animated grain is a battery bug.
 */
import {
  BACKDROP_DRIFT,
  grainAlpha,
  kenBurnsScale,
  kenBurnsTranslate,
  legibilityTint,
  KEN_BURNS_PERIOD_MS,
} from "../src/music/backdrop";

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

/** The colours that break a naive tint: the two extremes and the saturated hues. */
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
  "#123456",
];

/** The theme's label — opaque white in dark, opaque black in light. */
const LABEL = { dark: "#FFFFFF", light: "#000000" } as const;

describe("the living artwork backdrop", () => {
  it("the drift wraps and stays inside its bounds", () => {
    expect(kenBurnsScale(0)).toBeCloseTo(1.0, 3);
    expect(kenBurnsScale(10000)).toBeCloseTo(1.03, 2);
    expect(kenBurnsScale(20000)).toBeCloseTo(kenBurnsScale(0), 5);
    const t = kenBurnsTranslate(20000);
    expect(Math.abs(t.x)).toBeLessThanOrEqual(0.02);
    expect(Math.abs(t.y)).toBeLessThanOrEqual(0.02);
  });

  it("the drift is a 20 s cycle: the same position always gives the same art", () => {
    // The wrap is the cycle's contract — a backdrop whose drift depended on
    // when it was asked would drift differently on every render.
    for (const ms of [0, 1, 5000, 10000, 19999, 20000, 45000, 123456]) {
      expect(kenBurnsScale(ms)).toBeCloseTo(kenBurnsScale(ms % 20000), 6);
      expect(kenBurnsTranslate(ms)).toEqual(kenBurnsTranslate(ms % 20000));
    }
  });

  it("the scale never leaves 1.00 … 1.06, across the whole cycle", () => {
    for (let ms = 0; ms < 20000; ms += 250) {
      const scale = kenBurnsScale(ms);
      expect(scale).toBeGreaterThanOrEqual(1.0);
      expect(scale).toBeLessThanOrEqual(1.06);
    }
  });

  it("the drift never leaves its two percent, across the whole cycle", () => {
    for (let ms = 0; ms < 20000; ms += 250) {
      const t = kenBurnsTranslate(ms);
      expect(Math.abs(t.x)).toBeLessThanOrEqual(0.02);
      expect(Math.abs(t.y)).toBeLessThanOrEqual(0.02);
    }
  });

  it("a negative or broken position is still a position (never NaN)", () => {
    for (const ms of [-1, -20000, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(Number.isFinite(kenBurnsScale(ms))).toBe(true);
      expect(Number.isFinite(kenBurnsTranslate(ms).x)).toBe(true);
      expect(Number.isFinite(kenBurnsTranslate(ms).y)).toBe(true);
    }
  });

  it("the drift's numbers are the ones the contract records", () => {
    // The drift's maths is a WORKLET: it runs on the UI thread, where the
    // module's scope does not exist, so its copy of the numbers is a
    // literal. This test pins that literal against the contract — a drift
    // that quietly changed its cycle or its reach would be a silent change
    // to the wallpaper, and the panel's first build already proved that a
    // worklet cannot read a module constant.
    expect(KEN_BURNS_PERIOD_MS).toBe(BACKDROP_DRIFT.periodMs);
    expect(kenBurnsScale(0)).toBeCloseTo(BACKDROP_DRIFT.scaleFrom, 5);
    expect(kenBurnsScale(BACKDROP_DRIFT.periodMs - 1)).toBeCloseTo(
      BACKDROP_DRIFT.scaleTo,
      2
    );
    // A quarter of the cycle is the drift's widest reach.
    expect(Math.abs(kenBurnsTranslate(BACKDROP_DRIFT.periodMs / 4).x)).toBeCloseTo(
      BACKDROP_DRIFT.reach,
      5
    );
  });

  it("the legibility tint keeps the title readable over the art", () => {
    const tint = legibilityTint("#123456", "dark");
    expect(tint).toMatch(/^rgba\(/);
    // The title is the OPAQUE label, so "the label over the ground" IS the
    // ground: the tint composited onto the artwork. (Compositing an opaque
    // label over anything would return the label itself, so the ratio is
    // taken against the tinted artwork.)
    const ground = composite(tint, "#123456");
    expect(contrast(ground, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
  });

  it("the tint keeps the label readable over ANY artwork, in both themes", () => {
    for (const hex of ADVERSARIAL) {
      const dark = composite(legibilityTint(hex, "dark"), hex);
      expect({ hex, ratio: contrast(dark, LABEL.dark) >= 4.5 }).toEqual({
        hex,
        ratio: true,
      });
      const light = composite(legibilityTint(hex, "light"), hex);
      expect({ hex, ratio: contrast(light, LABEL.light) >= 4.5 }).toEqual({
        hex,
        ratio: true,
      });
    }
  });

  it("the tint is the ARTWORK's own colour — the backdrop keeps the cover's hue", () => {
    // A tint that turned every cover into the same grey would have thrown
    // the artwork away: the backdrop IS the record's art.
    const tint = parseColor(legibilityTint("#FF2D55", "dark"));
    expect(tint.r).toBeGreaterThan(tint.b);
    const cool = parseColor(legibilityTint("#3B82F6", "dark"));
    expect(cool.b).toBeGreaterThan(cool.r);
  });

  it("the tint is translucent — the blurred art still reads through it", () => {
    const alpha = parseColor(legibilityTint("#123456", "dark")).a;
    expect(alpha).toBeGreaterThan(0);
    expect(alpha).toBeLessThanOrEqual(1);
  });

  it("a colour that is not a colour still gets a tint that holds the label", () => {
    const tint = legibilityTint("not-a-colour", "dark");
    expect(tint).toMatch(/^rgba\(/);
    const ground = composite(tint, "#FFFFFF");
    expect(contrast(ground, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
  });

  it("the grain is STATIC and faint — it never animates", () => {
    for (const theme of ["light", "dark"] as const) {
      const alpha = grainAlpha(theme);
      expect(alpha).toBeGreaterThanOrEqual(0.02);
      expect(alpha).toBeLessThanOrEqual(0.06);
      // the same value every time — a grain that moved would be a video
      expect(grainAlpha(theme)).toBe(alpha);
    }
  });
});
