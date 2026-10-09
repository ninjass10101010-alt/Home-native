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

/** Wall-scale type ramp (14sp floor — single-device contract, spec decision 7). */
export const TYPOGRAPHY = {
  label: { fontSize: 14, lineHeight: 20 },
  body: { fontSize: 16, lineHeight: 24 },
  title: { fontSize: 20, lineHeight: 28 },
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
