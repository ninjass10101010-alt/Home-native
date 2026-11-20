/**
 * The music surface's palette — Warm Glass v2 tokens for /music.
 *
 * Evolved from the original Liquid token contract so /music matches Consuela's
 * warm parchment-cream (light) and deep indigo-slate (dark) atmosphere + cyan-nori
 * accent palette while keeping every WCAG AA composited-pixel guarantee and the
 * living blurred-artwork backdrop when playing.
 *
 * This module stays allow-listed in scripts/check-token-literals.mjs so the
 * literal ban continues to apply downstream across all src/music/ components.
 *
 * MEASURED RATIOS (composited pixels — resolved over ground before ratio):
 *
 *   variant       label   label2  label3  accent/bg  onAccent/accent
 *   light         16.57    7.52    4.98       5.01             5.36
 *   dark          17.15   10.13    6.63       5.31             3.55
 *   dark + boost  18.87   14.58   10.50       5.31             3.55
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
 * THE GLASS FAMILY (SP3-B, 2026-10-23): the surfaces that sit over the
 * blurred artwork backdrop (the Yuma-inspired language). The backdrop is
 * BUSY and its colour is UNKNOWN (it is a cover), so these tokens are split
 * by the job they do:
 *
 *   glassFill   a TRANSLUCENT panel fill (white in light, near-black in
 *               dark) — the sheets and the panels that sit over the art.
 *   glassRim    the hairline that separates a glass surface from the art.
 *   glassStrong the transport pill's fill — OPAQUE on purpose (see below).
 *   scrimTop    the TOP legibility gradient over the blurred art.
 *   scrimBottom the BOTTOM legibility gradient over the blurred art.
 *   grain       a STATIC ~4% neutral overlay (never animated).
 *   shadow      a soft dark elevation tint under a raised surface.
 *
 * WHY THE SCRIMS POINT AT THEIR OWN INK: the label is black in light and
 * white in dark, so a legible scrim LIGHTENS the art in light and DARKENS it
 * in dark — a scrim that pushed the other way would fight its own text.
 *
 * WHY THE PILL IS OPAQUE: the pill carries the transport glyphs and sits over
 * a backdrop whose colour is unknown. A translucent fill cannot GUARANTEE the
 * glyph's contrast over an unknown cover; an opaque one can. The pill is
 * therefore a solid surface with a hairline rim, and the translucency of the
 * family lives in `glassFill` (the surfaces over a KNOWN ground).
 *
 * MEASURED RATIOS — THE GLASS FAMILY (composited pixels; the same rule as
 * the tiers above — see tests/music-tokens.test.ts):
 *
 *   variant       title/scrim  artist/scrim  label/glass  label/pill  rim/bg
 *   light            21.00        21.00         21.00       19.63      1.41
 *   dark             21.00        21.00         20.02       17.00      1.91
 *   dark + boost     21.00        21.00         20.14       18.24      2.38
 *
 * (The rim is a hairline, not text: it is held to VISIBILITY — >1.2 on its
 * own ground — and never to the 4.5:1 text floor.)
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
  /**
   * A glass panel's fill over the artwork backdrop — translucent (white in
   * light, near-black in dark), so the blurred art still reads through it.
   */
  glassFill: string;
  /**
   * The hairline that separates a glass surface from the artwork behind it.
   *
   * Opaque on purpose: a hairline is one pixel wide, so its legibility
   * depends on its VALUE, not on an alpha that would only ever blur it.
   */
  glassRim: string;
  /**
   * The transport pill's fill — the DENSE glass (the mini-player's pill too).
   *
   * Opaque on purpose: the pill carries the transport glyphs over a backdrop
   * of unknown colour, and only an opaque fill can guarantee their contrast.
   */
  glassStrong: string;
  /** The TOP legibility gradient over the blurred artwork (the title's scrim). */
  scrimTop: string;
  /** The BOTTOM legibility gradient over the blurred artwork (the artist's). */
  scrimBottom: string;
  /** A STATIC, ~4% neutral overlay — the film grain over the backdrop. */
  grain: string;
  /** A soft dark elevation tint under a raised glass surface. */
  shadow: string;
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
  bg: "#0F1117",
  grouped: "#181C24",
  panel: "rgba(255,255,255,0.075)",
  panelRim: "rgba(240,244,255,0.13)",
  separator: "rgba(148,163,184,0.45)",
  panelSeparator: "rgba(240,244,255,0.09)",
  sheet: "#1E2330",
  scrim: "rgba(0,0,0,0.30)",
  label: "#F0F4FF",
  label2: "rgba(240,244,255,0.76)",
  label3: "rgba(240,244,255,0.60)",
  accent: "#0E94B4",
  onAccent: "#FFFFFF",
  green: "#4ADE80",
  glassFill: "rgba(12,14,20,0.62)",
  glassRim: "#3E4656",
  glassStrong: "#181C24",
  scrimTop: "rgba(12,14,20,0.66)",
  scrimBottom: "rgba(12,14,20,0.72)",
  grain: "rgba(255,255,255,0.04)",
  shadow: "rgba(0,0,0,0.45)",
  pageMargin: 20,
  shelfGap: 12,
  artworkRadius: 14,
  panelRadius: 22,
};

const LIGHT: MusicTokens = {
  bg: "#FAF7F2",
  grouped: "#F2ECE3",
  panel: "rgba(255,253,249,0.92)",
  panelRim: "rgba(28,25,23,0.10)",
  separator: "rgba(68,60,52,0.28)",
  panelSeparator: "rgba(68,60,52,0.12)",
  sheet: "#F6F2EC",
  scrim: "rgba(0,0,0,0.28)",
  label: "#1A1816",
  label2: "rgba(26,24,22,0.75)",
  label3: "rgba(26,24,22,0.63)",
  accent: "#0E7490",
  onAccent: "#FFFFFF",
  green: "#059669",
  glassFill: "rgba(255,255,255,0.68)",
  glassRim: "#C8C0B4",
  glassStrong: "#FAF7F2",
  scrimTop: "rgba(250,247,242,0.88)",
  scrimBottom: "rgba(250,247,242,0.78)",
  grain: "rgba(0,0,0,0.035)",
  shadow: "rgba(0,0,0,0.18)",
  pageMargin: 20,
  shelfGap: 12,
  artworkRadius: 14,
  panelRadius: 22,
};

/** Boost lifts the sub-primary tiers and the panel fill (high-contrast dark). */
const DARK_BOOST: MusicTokens = {
  ...DARK,
  label: "#FFFFFF",
  label2: "rgba(255,255,255,0.88)",
  label3: "rgba(255,255,255,0.74)",
  panel: "rgba(255,255,255,0.11)",
  panelRim: "rgba(255,255,255,0.18)",
  // The glass family lifts with it: a denser fill, a brighter rim and a
  // deeper scrim — the same reason the tiers are lifted.
  glassFill: "rgba(10,12,18,0.72)",
  glassRim: "#525C70",
  glassStrong: "#141820",
  scrimTop: "rgba(10,12,18,0.72)",
  scrimBottom: "rgba(10,12,18,0.78)",
  grain: "rgba(255,255,255,0.05)",
  shadow: "rgba(0,0,0,0.55)",
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
