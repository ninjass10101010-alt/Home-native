/**
 * The stage's type steps — the two sizes the Now Playing stage needs that the
 * shared ramp does not carry.
 *
 * WHY A STAGE RAMP: the stage's spec fixes the title at ~40sp in the display
 * serif and the artist at 17sp. The shared ramp (TYPOGRAPHY) jumps from
 * `stat` (32) straight to `display` (72) — the PAGE masthead, which the music
 * page already spends on its own "Music" heading. So the two stage steps live
 * here, beside the surface they belong to, instead of being invented at the
 * call site (or, worse, borrowed from the masthead and making the stage
 * shout).
 *
 * WHY THE ARTIST CARRIES A WEIGHT: every tier on the stage's tinted field
 * reads the SAME full label token — the dim tiers cannot clear 4.5:1 on a
 * tinted ground (tests/music-stage-contrast.test.ts) — so the hierarchy is
 * carried by SIZE and WEIGHT, never by colour. The artist is one step under
 * the title in size and a step heavier, so it still reads as secondary.
 *
 * The contract that binds every step is the 14sp floor (TYPE_FLOOR_SP) and
 * the app's type system (Instrument Serif display) — both honoured here.
 */
import { FONTS } from "../theme/tokens";

export const STAGE_TYPE = {
  /** The track title — the display serif, at the stage's big size. */
  title: {
    fontSize: 40,
    lineHeight: 46,
    fontFamily: FONTS.display,
    fontWeight: "400",
    letterSpacing: -0.8,
  },
  /** The artist — one step under the title, one step heavier. */
  artist: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "600",
  },
} as const;
