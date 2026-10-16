/**
 * Material descriptors — the Warm Glass frosted-surface tiers, transcribed
 * from ../Home-ai/src/app/globals.css (.material-thin / .material-regular /
 * .material-thick + light overrides; verified 2026-10-09).
 *
 * WS-0 round 2 RE-STEPPED the fills (D-8/D-9): the web's three tiers were
 * transcribed as three ALPHAS of ONE color (rgb(30 35 48) dark /
 * #ffffff light). Rendered, that is not a ladder at all —
 *   dark : the composited base already sits at rgb(30 35 48), so no alpha can
 *          lift a card more than ~1.5 levels; thin→thick measured 0.0017 relY
 *          and was NON-monotonic (regular darker than thin).
 *   light: white-on-near-white collapsed all three to literal #ffffff.
 * Each tier is now a real SURFACE STEP off the theme's own ramp, with the
 * alpha carrying only the translucency. Borders, blur, saturate and specular
 * are unchanged — the rim/border ladder stays exactly as transcribed.
 *
 * WS-0 round 3 RE-CUT the dark trio again (finding 4a): the round-2 steps were
 * still blue surface values, so every dark card wore a permanent chroma-27
 * tint that competed with the wall's per-widget tone. Dark is now three
 * opacity steps of one NEUTRAL — the ladder is carried entirely by the
 * composite against the canvas, which is what the wall actually shows.
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
      // Near-NEUTRAL glass (WS-0 round 3, finding 4a). The round-2 fills were
      // blue surface values (chroma 23–29/255) which handed every dark wall
      // cell a permanent chroma-27 blue that competed with the per-widget tone:
      // the reference wall's per-widget chroma spans 0→52/255, ours had
      // collapsed to 8–32. These are three OPACITY steps of ONE neutral, each
      // composited over `color-canvas` onto the measured ladder
      // relY 0.0242 / 0.0293 / 0.0386 (monotonic, gaps 0.0051 / 0.0093,
      // thin→thick 1.59×) with a composited chroma of 2.7–4.6/255. The tone
      // wash is the only thing allowed to put chroma on a dark card.
      background: "rgba(79, 79, 79, 0.42)",
      border: "rgba(255, 255, 255, 0.05)",
      blur: 12,
      saturate: 1.2,
      specular: 0.04,
    },
    regular: {
      background: "rgba(70, 70, 70, 0.58)",
      border: "rgba(255, 255, 255, 0.08)",
      blur: 20,
      saturate: 1.4,
      specular: 0.02,
    },
    thick: {
      background: "rgba(75, 75, 75, 0.66)",
      border: "rgba(255, 255, 255, 0.12)",
      blur: 26,
      saturate: 1.6,
      specular: 0.07,
      shadow: "0 16px 48px rgba(0, 0, 0, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.08)",
    },
  },
  light: {
    thin: {
      background: "rgba(253, 254, 255, 0.58)",
      border: "rgba(0, 0, 0, 0.03)",
      blur: 12,
      saturate: 1.2,
      specular: 0.04,
      shadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
    },
    regular: {
      background: "rgba(250, 252, 255, 0.64)",
      border: "rgba(0, 0, 0, 0.06)",
      blur: 20,
      saturate: 1.4,
      specular: 0.02,
      shadow: "0 4px 16px rgba(0, 0, 0, 0.06)",
    },
    thick: {
      background: "rgba(245, 248, 253, 0.72)",
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

export const HOME_WIDGET_ICON_VARIANTS = [
  "briefing",
  "ask",
  "suggestions",
  "leaderboard",
  "events",
  "schedule",
  "meal",
  "tasks",
  "week",
  "security",
  "climate",
  "lights",
  "ledger",
] as const;

export type HomeWidgetIconVariant = (typeof HOME_WIDGET_ICON_VARIANTS)[number];

export interface HomeWidgetIconPalette {
  hi: string;
  mid: string;
  lo: string;
  detail: string;
  ink: string;
  glow: string;
}

/**
 * Clay icon palettes transcribed from Home-ai/src/components/ui/HomeWidgetIcon.tsx.
 * Each widget owns an opaque, saturated family (hi = lit top, mid = body,
 * lo = shaded base, detail = tone accent, ink = line work, glow = halo).
 */
export const HOME_WIDGET_ICON_PALETTES: Record<HomeWidgetIconVariant, HomeWidgetIconPalette> = {
  briefing:    { hi: "#FFE9A8", mid: "#FB923C", lo: "#DB5A1E", detail: "#34D399", ink: "#5B2A0F", glow: "#FDBA74" },
  ask:         { hi: "#D9CCFF", mid: "#8B5CF6", lo: "#5B21B6", detail: "#FDE68A", ink: "#2E1065", glow: "#C4B5FD" },
  suggestions: { hi: "#FFF3B0", mid: "#FBBF24", lo: "#B45309", detail: "#F472B6", ink: "#5F3A06", glow: "#FDE68A" },
  leaderboard: { hi: "#FFE49A", mid: "#F59E0B", lo: "#B45309", detail: "#FFF7ED", ink: "#5F3A06", glow: "#FCD34D" },
  events:      { hi: "#BFE0FF", mid: "#3B82F6", lo: "#1D4ED8", detail: "#FB7185", ink: "#0B2A66", glow: "#93C5FD" },
  schedule:    { hi: "#B8F5EA", mid: "#14B8A6", lo: "#0F766E", detail: "#FDE68A", ink: "#0A3A36", glow: "#5EEAD4" },
  meal:        { hi: "#FFD5CB", mid: "#F1654D", lo: "#B3261E", detail: "#FDE68A", ink: "#5A150F", glow: "#FCA5A5" },
  tasks:       { hi: "#BFF3DC", mid: "#10B981", lo: "#047857", detail: "#FDE68A", ink: "#064E3B", glow: "#6EE7B7" },
  week:        { hi: "#CDD8FF", mid: "#6366F1", lo: "#3730A3", detail: "#F59E0B", ink: "#1E1B4B", glow: "#A5B4FC" },
  security:    { hi: "#C9E6FF", mid: "#2C7BE5", lo: "#123E8B", detail: "#FBBF24", ink: "#0A2A5E", glow: "#93C5FD" },
  climate:     { hi: "#DFF3FF", mid: "#60A5FA", lo: "#1E40AF", detail: "#F87171", ink: "#0C2A52", glow: "#BFDBFE" },
  lights:      { hi: "#FFF6CC", mid: "#FBBF24", lo: "#B45309", detail: "#FDE68A", ink: "#5F3A06", glow: "#FDE68A" },
  ledger:      { hi: "#C6F3D6", mid: "#22A55E", lo: "#14663A", detail: "#FBBF24", ink: "#0B3D22", glow: "#86EFAC" },
};

export const HOME_WIDGET_ICON_SHINE = "#FFFFFF";
export const HOME_WIDGET_ICON_SHADOW = "#0B1020";
