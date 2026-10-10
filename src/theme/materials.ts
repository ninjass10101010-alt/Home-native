/**
 * Material descriptors — the Warm Glass frosted-surface tiers, transcribed
 * from ../Home-ai/src/app/globals.css (.material-thin / .material-regular /
 * .material-thick + light overrides; verified 2026-10-09). Values mirror the
 * tokens.generated.ts material-* keys where the generator emitted them; the
 * literal table below is the contract (tests pin it byte-exact).
 */

export type MaterialTier = "thin" | "regular" | "thick";

export interface MaterialDescriptor {
  /** CSS background color (translucent — composites over the atmosphere). */
  background: string;
  /** 1px border color. */
  border: string;
  /** CSS blur px (maps to BlurView intensity via blur * 2.5, clamped 0–100). */
  blur: number;
  /** CSS saturate multiplier (BlurView approximate tint handling in Material). */
  saturate: number;
  /** Specular top-light alpha (radial 120%×60% at 20%/0%). */
  specular: number;
  /** Optional box-shadow (CSS string) — Android approximates via elevation. */
  shadow?: string;
}

export const MATERIALS: Record<
  "dark" | "light",
  Record<MaterialTier, MaterialDescriptor>
> = {
  dark: {
    thin: {
      background: "rgba(30, 35, 48, 0.35)",
      border: "rgba(255, 255, 255, 0.05)",
      blur: 12,
      saturate: 1.2,
      specular: 0.04,
    },
    regular: {
      background: "rgba(30, 35, 48, 0.45)",
      border: "rgba(255, 255, 255, 0.08)",
      blur: 20,
      saturate: 1.4,
      specular: 0.02,
    },
    thick: {
      background: "rgba(30, 35, 48, 0.55)",
      border: "rgba(255, 255, 255, 0.12)",
      blur: 26,
      saturate: 1.6,
      specular: 0.07,
      shadow: "0 16px 48px rgba(0, 0, 0, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.08)",
    },
  },
  light: {
    thin: {
      background: "rgba(255, 255, 255, 0.4)",
      border: "rgba(0, 0, 0, 0.03)",
      blur: 12,
      saturate: 1.2,
      specular: 0.04,
      shadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
    },
    regular: {
      background: "rgba(255, 255, 255, 0.6)",
      border: "rgba(0, 0, 0, 0.06)",
      blur: 20,
      saturate: 1.4,
      specular: 0.02,
      shadow: "0 4px 16px rgba(0, 0, 0, 0.06)",
    },
    thick: {
      background: "rgba(255, 255, 255, 0.8)",
      border: "rgba(0, 0, 0, 0.08)",
      blur: 26,
      saturate: 1.6,
      specular: 0.07,
      shadow: "0 4px 16px rgba(0, 0, 0, 0.08)",
    },
  },
};

export function specularOpacity(
  theme: "dark" | "light",
  tier: MaterialTier
): number {
  return MATERIALS[theme][tier].specular;
}

/** Specular overlay stop colors (white at tier alpha → clear). Token-owned. */
export const SPECULAR_AT = (a: number) => `rgba(255,255,255,${a})`;
export const SPECULAR_CLEAR = "rgba(255,255,255,0)";
