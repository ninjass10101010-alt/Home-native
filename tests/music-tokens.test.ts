/**
 * The music surface's palette contract (SP2 Task 1).
 *
 * Shiny's Liquid palette, shipped as a TOKEN MODULE — the colour SOURCE for
 * /music, ALLOW-listed in the token-literal gate exactly like materials.ts.
 * AA is machine-checked HERE, on the COMPOSITED pixel: a contrast measured
 * through an rgba() token is meaningless, so every translucent token is
 * resolved over its ground before the ratio is taken.
 *
 * The floors:
 *   label / label2 / label3 on bg      >= 4.5  (all three tiers are body-eligible)
 *   label on panel-over-bg             >= 4.5
 *   accent on bg                       >= 4.5 dark/boost, >= 3.0 light (large-only)
 *   onAccent on accent                 >= 3.0  (the transport glyphs are large)
 *
 * NOTE on the tier alphas: Shiny's own 60%/30% label tiers FAIL strict AA on
 * Shiny's grounds. This app's contract wins — the tiers are lifted until they
 * clear 4.5:1 and hierarchy comes from weight and size, never sub-AA colour.
 */
import { musicTokensFor, type MusicTokens } from "../src/theme/music-tokens";

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

/* ── The variants under contract ───────────────────────────────────────── */

type Variant = {
  name: string;
  theme: "light" | "dark";
  boost: boolean;
  /** The accent floor for this variant (light accent is large-only). */
  accentFloor: number;
};

const VARIANTS: Variant[] = [
  { name: "light", theme: "light", boost: false, accentFloor: 3.0 },
  { name: "dark", theme: "dark", boost: false, accentFloor: 4.5 },
  { name: "dark + boost", theme: "dark", boost: true, accentFloor: 4.5 },
];

const COLOR_KEYS = [
  "bg",
  "grouped",
  "panel",
  "panelRim",
  "separator",
  "panelSeparator",
  "sheet",
  "scrim",
  "label",
  "label2",
  "label3",
  "accent",
  "onAccent",
  "green",
] as const;

const GEOMETRY = {
  pageMargin: 20,
  shelfGap: 12,
  artworkRadius: 14,
  panelRadius: 22,
} as const;

function measure(t: MusicTokens) {
  const bg = t.bg;
  const panelOverBg = composite(t.panel, bg);
  // The rows of the recently played shelf sit on a panel INSIDE the grouped
  // ground — the shelf's own section ground.
  const panelOverGrouped = composite(t.panel, t.grouped);
  return {
    label: contrast(composite(t.label, bg), bg),
    label2: contrast(composite(t.label2, bg), bg),
    label3: contrast(composite(t.label3, bg), bg),
    labelOnPanel: contrast(composite(t.label, panelOverBg), panelOverBg),
    label2OnPanel: contrast(composite(t.label2, panelOverBg), panelOverBg),
    label3OnPanel: contrast(composite(t.label3, panelOverBg), panelOverBg),
    labelOnShelf: contrast(composite(t.label, panelOverGrouped), panelOverGrouped),
    label2OnShelf: contrast(composite(t.label2, panelOverGrouped), panelOverGrouped),
    label3OnShelf: contrast(composite(t.label3, panelOverGrouped), panelOverGrouped),
    labelOnSheet: contrast(composite(t.label, t.sheet), t.sheet),
    label2OnSheet: contrast(composite(t.label2, t.sheet), t.sheet),
    accent: contrast(composite(t.accent, bg), bg),
    onAccent: contrast(composite(t.onAccent, t.accent), t.accent),
  };
}

describe.each(VARIANTS)("the Liquid palette — $name", (v) => {
  const tokens = musicTokensFor(v.theme, v.boost);
  const m = measure(tokens);

  it("label on bg clears AA (4.5:1)", () => {
    expect(m.label).toBeGreaterThanOrEqual(4.5);
  });

  it("label2 on bg clears AA (4.5:1)", () => {
    expect(m.label2).toBeGreaterThanOrEqual(4.5);
  });

  it("label3 on bg clears AA (4.5:1)", () => {
    expect(m.label3).toBeGreaterThanOrEqual(4.5);
  });

  it("label on the panel (composited over bg) clears AA (4.5:1)", () => {
    expect(m.labelOnPanel).toBeGreaterThanOrEqual(4.5);
  });

  it("the second tier on the panel clears AA (4.5:1)", () => {
    expect(m.label2OnPanel).toBeGreaterThanOrEqual(4.5);
  });

  it("the third tier on the panel clears AA (4.5:1)", () => {
    expect(m.label3OnPanel).toBeGreaterThanOrEqual(4.5);
  });

  it("every tier on the shelf (panel over the grouped ground) clears AA (4.5:1)", () => {
    expect(m.labelOnShelf).toBeGreaterThanOrEqual(4.5);
    expect(m.label2OnShelf).toBeGreaterThanOrEqual(4.5);
    expect(m.label3OnShelf).toBeGreaterThanOrEqual(4.5);
  });

  it("the search field's sheet ground carries the tiers at AA (4.5:1)", () => {
    expect(m.labelOnSheet).toBeGreaterThanOrEqual(4.5);
    expect(m.label2OnSheet).toBeGreaterThanOrEqual(4.5);
  });

  it("accent on bg clears its floor", () => {
    expect(m.accent).toBeGreaterThanOrEqual(v.accentFloor);
  });

  it("onAccent on accent clears the large-text floor (3:1)", () => {
    expect(m.onAccent).toBeGreaterThanOrEqual(3.0);
  });

  it("every colour token is a #hex or rgba() string", () => {
    for (const key of COLOR_KEYS) {
      expect(tokens[key]).toMatch(
        /^(#[0-9a-fA-F]{3,8}|rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*[\d.]+\s*)?\))$/
      );
    }
  });

  it("carries the spec'd geometry constants", () => {
    expect(tokens.pageMargin).toBe(GEOMETRY.pageMargin);
    expect(tokens.shelfGap).toBe(GEOMETRY.shelfGap);
    expect(tokens.artworkRadius).toBe(GEOMETRY.artworkRadius);
    expect(tokens.panelRadius).toBe(GEOMETRY.panelRadius);
  });

  it("exposes exactly the contracted token keys", () => {
    expect(Object.keys(tokens).sort()).toEqual(
      [...COLOR_KEYS, ...Object.keys(GEOMETRY)].sort()
    );
  });
});

describe("the Liquid palette — measured ratios", () => {
  it("reports the measured contrast for every variant", () => {
    const rows = VARIANTS.map((v) => {
      const m = measure(musicTokensFor(v.theme, v.boost));
      return { variant: v.name, ...m };
    });
    for (const r of rows) {
      const line = [
        r.variant.padEnd(13),
        `label ${r.label.toFixed(2)}`,
        `label2 ${r.label2.toFixed(2)}`,
        `label3 ${r.label3.toFixed(2)}`,
        `label/panel ${r.labelOnPanel.toFixed(2)}`,
        `accent ${r.accent.toFixed(2)}`,
        `onAccent/accent ${r.onAccent.toFixed(2)}`,
      ].join("  ");
      // The measured ratios are pasted into the token file's comment block.
      console.log(line);
    }
    expect(rows).toHaveLength(3);
  });
});
