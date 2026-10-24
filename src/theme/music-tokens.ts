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
  glassFill: "rgba(14,14,16,0.58)",
  glassRim: "#3C3C40",
  glassStrong: "#1C1C1F",
  scrimTop: "rgba(0,0,0,0.60)",
  scrimBottom: "rgba(0,0,0,0.68)",
  grain: "rgba(255,255,255,0.04)",
  shadow: "rgba(0,0,0,0.45)",
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
  glassFill: "rgba(255,255,255,0.62)",
  glassRim: "#D9D9DE",
  glassStrong: "#F7F7F9",
  scrimTop: "rgba(255,255,255,0.86)",
  scrimBottom: "rgba(255,255,255,0.76)",
  grain: "rgba(0,0,0,0.04)",
  shadow: "rgba(0,0,0,0.26)",
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
  // The glass family lifts with it: a denser fill, a brighter rim and a
  // deeper scrim — the same reason the tiers are lifted.
  glassFill: "rgba(10,10,12,0.68)",
  glassRim: "#4A4A4F",
  glassStrong: "#151517",
  scrimTop: "rgba(0,0,0,0.68)",
  scrimBottom: "rgba(0,0,0,0.74)",
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
