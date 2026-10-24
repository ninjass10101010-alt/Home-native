/**
 * THE LYRICS SHEET'S GROUND — the karaoke words over the wall panel (SP3-B
 * task 4).
 *
 * The lyrics pane sits on the WALLPAPER (the blurred artwork backdrop), and a
 * cover's bright patches wash the ground out: measured on the panel, the dim
 * tiers fell to 2.4:1 and the accent to 1.4:1 straight on the artwork. So the
 * words get their OWN ground — the DENSE glass sheet (`glassStrong`), which is
 * OPAQUE on purpose (the same reason the transport pill is): only an opaque
 * fill can GUARANTEE a word's contrast over a cover whose colour is unknown.
 *
 * The contract is therefore measured on the FLAT sheet pixel — no artwork can
 * reach a word through an opaque sheet:
 *
 *     the sheet ground (`glassStrong`, opaque)
 *       → the word (an accent FILL when it is sung, the second tier while it
 *         is still to come, the third for a line that is not being sung)
 *
 * The KARAOKE FILL only ever paints a token the contract holds: the accent is
 * a LARGE-TEXT colour (the lyric line is 22sp bold — large copy), so the light
 * theme's 3.41:1 clears the 3:1 large-text floor, exactly as the Now Playing
 * title's light accent does; the script tiers all clear the 4.5:1 text floor.
 */
import { musicTokensFor } from "../src/theme/music-tokens";

/* ── WCAG 2.1 colour maths (the same maths the stage's contract uses) ───── */

function channel(hex: string, i: number) {
  return parseInt(hex.slice(i, i + 2), 16) / 255;
}

function luminance(hex: string) {
  const f = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return (
    0.2126 * f(channel(hex, 1)) +
    0.7152 * f(channel(hex, 3)) +
    0.0722 * f(channel(hex, 5))
  );
}

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

/** Resolve an rgba() tier over the OPAQUE sheet so the ratio is the real pixel. */
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

/* ── The variants under contract ────────────────────────────────────────── */

/** The accent's floor: the light accent is LARGE-ONLY (22sp bold lyric line). */
const VARIANTS = [
  { name: "light", theme: "light" as const, boost: false, accentFloor: 3.0 },
  { name: "dark", theme: "dark" as const, boost: false, accentFloor: 4.5 },
  { name: "dark + boost", theme: "dark" as const, boost: true, accentFloor: 4.5 },
];

describe.each(VARIANTS)("the lyrics sheet — $name", (v) => {
  const tokens = musicTokensFor(v.theme, v.boost);
  const sheet = tokens.glassStrong;
  const on = (color: string) => contrast(composite(color, sheet), sheet);

  it("the sheet is OPAQUE — nothing of the artwork reaches a word", () => {
    expect(parseColor(sheet).a).toBe(1);
  });

  it("the label tier clears AA for body copy on the sheet", () => {
    expect(on(tokens.label)).toBeGreaterThanOrEqual(4.5);
  });

  it("the second tier clears AA on the sheet", () => {
    expect(on(tokens.label2)).toBeGreaterThanOrEqual(4.5);
  });

  it("the third tier clears AA on the sheet", () => {
    expect(on(tokens.label3)).toBeGreaterThanOrEqual(4.5);
  });

  it("the accent clears its floor on the sheet (large-text in light)", () => {
    expect(on(tokens.accent)).toBeGreaterThanOrEqual(v.accentFloor);
  });

  it("the rim is a hairline, not text — it only has to be VISIBLE", () => {
    // The sheet's own border is one pixel: held to visibility (>1.2), never
    // to the 4.5:1 text floor (the same rule the glass family uses).
    expect(contrast(tokens.glassRim, sheet)).toBeGreaterThan(1.2);
  });
});

/**
 * The measured pixels — pinned so a token that drifts away from the numbers
 * the pane's own comment quotes is caught here, not on the panel.
 */
describe("the measured pixels over the sheet", () => {
  it("the dark sheet's words hold the ratios the pane claims", () => {
    const t = musicTokensFor("dark", false);
    const on = (c: string) => contrast(composite(c, t.glassStrong), t.glassStrong);
    expect(on(t.label)).toBeCloseTo(17.0, 0);
    expect(on(t.label2)).toBeCloseTo(9.25, 1);
    expect(on(t.label3)).toBeCloseTo(5.97, 1);
    expect(on(t.accent)).toBeCloseTo(4.83, 1);
  });

  it("the light sheet's words hold the ratios the pane claims", () => {
    const t = musicTokensFor("light", false);
    const on = (c: string) => contrast(composite(c, t.glassStrong), t.glassStrong);
    expect(on(t.label)).toBeCloseTo(19.63, 1);
    expect(on(t.label2)).toBeCloseTo(8.95, 1);
    expect(on(t.label3)).toBeCloseTo(4.69, 1);
    expect(on(t.accent)).toBeCloseTo(3.41, 1);
  });
});
