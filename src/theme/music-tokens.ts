/**
 * The music surface's palette — Shiny's LIQUID palette, as a token module.
 *
 * SP2 (2026-10-21, human decision): the /music surface adopts Shiny's Liquid
 * palette — artwork-led, neutral grounds, recessive chrome — instead of the
 * app's Warm-Glass tokens. This module is the colour SOURCE for that surface:
 * it is ALLOW-listed in scripts/check-token-literals.mjs exactly like
 * materials.ts, so the literal ban applies DOWNSTREAM of it (every music
 * screen reads these tokens; no colour literals in components).
 *
 * WHY THE TIERS ARE LIFTED (honesty note): Shiny's own label tiers (white at
 * 60% / 30% alpha) FAIL strict AA on Shiny's grounds. This app's contract
 * wins — the tiers below are lifted until they clear 4.5:1, and hierarchy is
 * carried by WEIGHT and SIZE, never by sub-AA colour. Shiny's LOOK survives
 * (a lifted tier is still a translucent tier); the accessibility maths does
 * not get a waiver.
 *
 * MEASURED RATIOS (composited pixels — the rgba() token resolved over its
 * ground before the ratio is taken; see tests/music-tokens.test.ts):
 *
 *   variant       label   label2  label3  label/panel  accent  onAccent/accent
 *   light         21.00    9.29    4.74         21.00    3.65            3.65
 *   dark          21.00   10.59    6.25         18.58    5.96            3.52
 *   dark + boost  21.00   14.88   10.02         17.40    5.96            3.52
 *
 * The LIGHT accent (3.65:1 on the white ground) is deliberately LARGE-ONLY:
 * it may carry the big Now Playing title and accent FILLS, never body copy
 * at 14sp — that is why its floor is 3:1 and not 4.5:1. The dark accent
 * clears 4.5:1 outright, so it is never constrained.
 *
 * The SCRIM (a dark translucent fill for a control that sits ON a tinted
 * field) is measured where it is used, not here: its contract is the label
 * over the scrim over the band's worst-case tint (see
 * tests/music-stage-contrast.test.ts).
 *
 * Geometry (pageMargin 20 / shelfGap 12 / artworkRadius 14 / panelRadius 22)
 * is part of the same contract: the Liquid layout is a constant, not a
 * per-screen improvisation.
 */

export interface MusicTokens {
  /** The screen ground (the surface behind everything). */
  bg: string;
  /** A grouped/section ground (sheets, grouped rows). */
  grouped: string;
  /** A raised panel fill — translucent, composited over its ground. */
  panel: string;
  /** A panel's rim (hairline border) — translucent. */
  panelRim: string;
  /** A separator on the page ground. */
  separator: string;
  /** A separator INSIDE a panel. */
  panelSeparator: string;
  /** A bottom sheet / modal ground. */
  sheet: string;
  /**
   * A dark translucent scrim — the fill of a control that sits ON a tinted
   * field (the stage's chips).
   *
   * WHY DARK: such a control's fill is part of the ground its OWN label is
   * measured against. A white fill LIFTS that ground (the dark band's
   * brightest edge + white@12% measured 4.06:1 — under the 4.5:1 floor);
   * a dark scrim DARKENS it, in BOTH themes: the dark band's white label
   * gains contrast and the light band's black label keeps it. Shiny's poster
   * does the same over its artwork (see tests/music-stage-contrast.test.ts).
   */
  scrim: string;
  /** Primary text tier (body-eligible, 14sp+). */
  label: string;
  /** Secondary text tier (body-eligible, 14sp+). */
  label2: string;
  /** Tertiary text tier (body-eligible, 14sp+). */
  label3: string;
  /** The accent (playhead, active chip, transport fill). */
  accent: string;
  /** Ink ON the accent (the transport glyphs). */
  onAccent: string;
  /** The "playing"/success green. */
  green: string;
  /** Page side margin (dp). */
  pageMargin: number;
  /** Vertical gap between shelves (dp). */
  shelfGap: number;
  /** Artwork corner radius (dp). */
  artworkRadius: number;
  /** Panel corner radius (dp). */
  panelRadius: number;
}

const DARK: MusicTokens = {
  bg: "#000000",
  grouped: "#131315",
  panel: "rgba(255,255,255,0.075)",
  panelRim: "rgba(255,255,255,0.13)",
  separator: "rgba(140,140,150,0.55)",
  panelSeparator: "rgba(255,255,255,0.09)",
  sheet: "#131315",
  scrim: "rgba(0,0,0,0.28)",
  label: "#FFFFFF",
  label2: "rgba(255,255,255,0.72)",
  label3: "rgba(255,255,255,0.55)",
  accent: "#FF375F",
  onAccent: "#FFFFFF",
  green: "#30D158",
  pageMargin: 20,
  shelfGap: 12,
  artworkRadius: 14,
  panelRadius: 22,
};

const LIGHT: MusicTokens = {
  bg: "#FFFFFF",
  grouped: "#F2F2F7",
  panel: "#FFFFFF",
  panelRim: "rgba(0,0,0,0.08)",
  separator: "rgba(60,60,67,0.29)",
  panelSeparator: "rgba(60,60,67,0.12)",
  sheet: "#F2F2F7",
  scrim: "rgba(0,0,0,0.28)",
  label: "#000000",
  label2: "rgba(0,0,0,0.72)",
  label3: "rgba(0,0,0,0.55)",
  accent: "#FF2D55",
  onAccent: "#FFFFFF",
  green: "#34C759",
  pageMargin: 20,
  shelfGap: 12,
  artworkRadius: 14,
  panelRadius: 22,
};

/** Boost lifts the sub-primary tiers and the panel fill (high-contrast dark). */
const DARK_BOOST: MusicTokens = {
  ...DARK,
  label2: "rgba(255,255,255,0.85)",
  label3: "rgba(255,255,255,0.70)",
  panel: "rgba(255,255,255,0.10)",
  panelRim: "rgba(255,255,255,0.16)",
};

/**
 * The music surface's tokens for a theme/boost pair.
 *
 * Light ignores boost: the light Liquid palette is already AA on its own
 * grounds (its tiers are lifted), so there is nothing to lift further.
 */
export function musicTokensFor(
  theme: "light" | "dark",
  boost: boolean
): MusicTokens {
  if (theme === "light") return LIGHT;
  return boost ? DARK_BOOST : DARK;
}
