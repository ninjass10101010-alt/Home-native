import { GENERATED } from "./tokens.generated";

/**
 * Typed facade over the generated token module — the ONLY legal color source
 * for the app (token-literal ban enforces: scripts/check-token-literals.mjs).
 *
 * TOKENS.dark / TOKENS.light are flat css-name (sans `--`) → resolved value
 * maps. TOKENS.boost.dark/light hold the high-contrast OVERRIDES only —
 * spread them over the theme's tokens.
 */
export const TOKENS = GENERATED.tokens as {
  dark: Record<string, string>;
  light: Record<string, string>;
  boost: { dark: Record<string, string>; light: Record<string, string> };
};

/** Verbatim pre-resolution CSS for every color-mix() token (GENERATED.raw). */
export const RAW_MIXES = GENERATED.raw;

const ACCENT_LEVELS = GENERATED.accents as {
  dark: Record<string, string>;
  light: Record<string, string>;
};

/**
 * ACCENTS carries the 10 palette names (nori…sage) as enumerable keys, each
 * `{ dark, light }`, plus NON-enumerable `.dark` / `.light` mirrors so both
 * `Object.keys(ACCENTS)` (10 names) and `ACCENTS.dark.nori` work — the
 * contract test pins both shapes. Use `.dark` / `.light` in app code.
 */
const accentsByName: Record<string, { dark: string; light: string }> = {};
for (const name of Object.keys(ACCENT_LEVELS.dark)) {
  accentsByName[name] = { dark: ACCENT_LEVELS.dark[name], light: ACCENT_LEVELS.light[name] };
}
export const ACCENTS = Object.defineProperties(accentsByName, {
  dark: { value: ACCENT_LEVELS.dark },
  light: { value: ACCENT_LEVELS.light },
}) as unknown as { dark: Record<string, string>; light: Record<string, string> };

/** `--color-accent-<n>` channels ("r, g, b") per theme, for alpha compositing. */
export const ACCENTS_RGB = GENERATED.accentsRgb as {
  dark: Record<string, string>;
  light: Record<string, string>;
};

export const RADII = { sm: 10, md: 16, lg: 20, xl: 28, xxl: 36, full: 9999 } as const;
export const MOTION = { fast: 150, base: 240, slow: 400, glide: 600 } as const;

/**
 * Bundled faces (assets/fonts/, loaded in app/_layout.tsx). `display` is the
 * web's `--font-display`: Instrument Serif 400 (Home-ai layout.tsx:28-33), the
 * editorial serif behind `.text-display` / the home greeting. `rounded` is the
 * weather label register. Never fall back to the generic "serif": on the wall
 * that is Noto Serif, and the reference set is set in Instrument.
 */
export const FONTS = { display: "Instrument Serif", rounded: "Fredoka" } as const;

/**
 * Wall-scale type ramp (14sp floor — single-device contract, spec decision 7).
 * Levels, strongest → weakest: `display` (serif masthead) → `sectionTitle`
 * (showcase section headers) → `title` (in-card headings) → `stat`/`body` →
 * `label` (14sp floor) → `eyebrow`/`fieldLabel` (tracked uppercase kickers).
 * `hero` stays as the raw 72sp display size for the wall greeting, which pairs
 * it with the same serif face (see FONTS.display).
 */
export const TYPOGRAPHY = {
  label: { fontSize: 14, lineHeight: 20 },
  body: { fontSize: 16, lineHeight: 24 },
  /** In-card heading level (component titles, dialog titles). */
  title: { fontSize: 20, lineHeight: 28 },
  /** Page/section masthead — web `.text-display` (serif, 400, -3% tracking)
   *  wall-scaled ~2.3× from the web's 2rem. */
  display: {
    fontSize: 72,
    lineHeight: 76,
    fontFamily: FONTS.display,
    fontWeight: "400",
    letterSpacing: -2.2,
  },
  /** Tracked uppercase kicker ABOVE a masthead — web `.text-eyebrow`
   *  (12px/600/.14em) wall-scaled to 24sp. */
  eyebrow: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "600",
    letterSpacing: 3.4,
    textTransform: "uppercase",
  },
  /** THE one field/control label system: TextField, Stepper, any form label. */
  fieldLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  /** Showcase/panel section headers — a level above in-card `title`. */
  sectionTitle: { fontSize: 28, lineHeight: 36, fontWeight: "700", letterSpacing: -0.2 },
  stat: { fontSize: 32, lineHeight: 40 },
  hero: { fontSize: 72, lineHeight: 80 },
} as const;

export const TYPE_FLOOR_SP = 14;
export const MIN_TARGET_DP = 64;

/** TitleCase aliases from the codegen interface contract — canonical names
    stay the uppercase consts above. */
export const Typography = TYPOGRAPHY;
export const Radii = RADII;
export const Motion = MOTION;
export const Accents = ACCENTS;
