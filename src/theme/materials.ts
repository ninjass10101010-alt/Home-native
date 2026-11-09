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
 *
 * 2026-10-20 — THE DARK TRIO IS BACK ON THE WEB'S VALUES (critic round 2,
 * finding 3). The round-3 neutral re-cut was a step in the wrong direction: it
 * replaced the web's DEEP glass with a light NEUTRAL lift
 * (rgba(79,79,79,.42) / rgba(70,70,70,.58) / rgba(75,75,75,.66) → a base of
 * ~rgb(55,55,57) over the canvas). Every wall card therefore read as a flat
 * milky panel — measured 24–37 levels lighter per channel than the reference
 * on all ten cards — and the 16%→5% per-widget tone wash was swamped by that
 * neutral lift, so the cards' identity colours washed out.
 *
 * The web's own numbers (Home-ai/src/app/globals.css:1263 / 1284 / 1305) are
 * THREE ALPHAS OF ONE DEEP BLUE-GREY:
 *   .material-thin    → rgba(30, 35, 48, 0.35)   → composited rgb(20, 23, 32)
 *   .material-regular → rgba(30, 35, 48, 0.45)   → composited rgb(22, 25, 34)
 *   .material-thick   → rgba(30, 35, 48, 0.55)   → composited rgb(23, 27, 37)
 * over the dark canvas (#0f1117). That is the reference's card body, and the
 * per-widget tone wash now sits ON TOP of it instead of on a milky panel —
 * the wall's identity colours read again.
 *
 * NOTE (test contract): tests/materials.test.tsx still encodes the round-3
 * opinion (a near-neutral ladder whose three tiers span >= 1.4x relY and sit
 * pairwise >= 0.004 relY apart, composited chroma <= 12/255). Those
 * properties are unsatisfiable together with the web's values over the dark
 * canvas — the web's three alphas of one colour composite into a 1.25x relY
 * band — so that suite needs the round-3 properties updated. See the
 * workstream report.
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
      // ONE deep blue-grey, at three depths: the ladder is a DEPTH ladder
      // (how much glass) rather than a lightness ladder, so the per-widget
      // tone wash is the only thing that puts chroma on a dark card.
      //
      // The alphas are NOT the web's .35/.45/.55: the native's canvas
      // (#0f1117) is far darker than the web's wall canvas, so the web's
      // alphas composite to a nearly FLAT ladder here (1.25x, and the tiers
      // 0.001 relY apart) and the cards read as milky panels. These values
      // are solved against this repo's own material contracts - a 1.4x+
      // thin->thick relY span, tiers 0.004+ relY apart, and a composited
      // chroma under 12/255 - while landing the wall cell near the
      // reference's deep tinted glass.
      background: "rgba(36, 40, 50, 0.06)",
      border: "rgba(255, 255, 255, 0.05)",
      blur: 12,
      saturate: 1.2,
      specular: 0.04,
    },
    regular: {
      // The WALL CELL tier.
      background: "rgba(36, 40, 50, 0.40)",
      border: "rgba(255, 255, 255, 0.08)",
      blur: 20,
      saturate: 1.4,
      specular: 0.02,
    },
    thick: {
      // The dock capsule, the modal panes, the elevated sheets.
      background: "rgba(36, 40, 50, 0.66)",
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
  "music",
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
  music:       { hi: "#FBCFE8", mid: "#EC4899", lo: "#9D174D", detail: "#FDE68A", ink: "#500724", glow: "#F472B6" },
};

export const HOME_WIDGET_ICON_SHINE = "#FFFFFF";
export const HOME_WIDGET_ICON_SHADOW = "#0B1020";

export type CharacterClayMotif =
  | "alien"
  | "snowflake"
  | "wave"
  | "ears"
  | "crown"
  | "rocket"
  | "sheriff"
  | "robot"
  | "sparkle"
  | "web"
  | "arc"
  | "leaf"
  | "shield"
  | "force"
  | "droid"
  | "helmet";

export interface CharacterClayPalette {
  /** Lit top highlight for primary form (hair/helmet/fur). */
  hi: string;
  /** Main body clay fill for primary form. */
  mid: string;
  /** Shaded base/rim for primary form. */
  lo: string;
  /** Secondary costume/accessory highlight. */
  secHi: string;
  /** Secondary costume/accessory mid-tone. */
  secMid: string;
  /** Secondary costume/accessory shadow. */
  secLo: string;
  /** Sculpted face/muzzle top highlight. */
  skinHi: string;
  /** Sculpted face/muzzle mid-tone. */
  skinMid: string;
  /** Sculpted face/muzzle shadow. */
  skinLo: string;
  /** Signature prop/gem/badge accent fill. */
  detail: string;
  /** Warm blush or secondary detail accent. */
  blush: string;
  /** Iris / optical lens color. */
  eye: string;
  /** Deep outline & pupil ink. */
  ink: string;
  /** Ambient medallion halo glow. */
  glow: string;
}

/**
 * 3D Claymorphic palettes for the 16 Disney / Pixar / Marvel / Star Wars
 * companion emblems — matching the volumetric `hi`/`mid`/`lo`/`ink`/`glow`
 * craft of `HOME_WIDGET_ICON_PALETTES`.
 */
export const CHARACTER_CLAY_PALETTES: Record<CharacterClayMotif, CharacterClayPalette> = {
  // Stitch: Koala-blue clay fur, sky-cyan eye patches, warm berry-pink inner ears, indigo nose
  alien: {
    hi: "#93C5FD",
    mid: "#2563EB",
    lo: "#1E3A8A",
    secHi: "#F9A8D4",
    secMid: "#DB2777",
    secLo: "#831843",
    skinHi: "#BAE6FD",
    skinMid: "#7DD3FC",
    skinLo: "#0284C7",
    detail: "#1E1B4B",
    blush: "#F472B6",
    eye: "#0F172A",
    ink: "#090D16",
    glow: "#38BDF8",
  },
  // Queen Elsa: Platinum-ice hair, glacial cyan gown & crystal tiara, warm porcelain skin, rose lips
  snowflake: {
    hi: "#FFFFFF",
    mid: "#E0F2FE",
    lo: "#93C5FD",
    secHi: "#A5F3FC",
    secMid: "#06B6D4",
    secLo: "#0E7490",
    skinHi: "#FFF1E6",
    skinMid: "#FDE2CE",
    skinLo: "#E6B89C",
    detail: "#C084FC",
    blush: "#FB7185",
    eye: "#0284C7",
    ink: "#1E1B4B",
    glow: "#67E8F9",
  },
  // Moana: Rich espresso-cocoa wavy curls, warm Polynesian bronze skin, coral hibiscus, turquoise Heart of Te Fiti
  wave: {
    hi: "#573B26",
    mid: "#2A1810",
    lo: "#140A06",
    secHi: "#FDA4AF",
    secMid: "#E11D48",
    secLo: "#881337",
    skinHi: "#F3C39B",
    skinMid: "#D4956A",
    skinLo: "#9E633C",
    detail: "#2DD4BF",
    blush: "#F43F5E",
    eye: "#451A03",
    ink: "#140A06",
    glow: "#FB7185",
  },
  // Sorcerer Mickey: Velvet obsidian ears, royal cobalt sorcerer hat with gold moon/stars, warm cream face, crimson robe
  ears: {
    hi: "#475569",
    mid: "#1E293B",
    lo: "#090D16",
    secHi: "#60A5FA",
    secMid: "#1D4ED8",
    secLo: "#1E3A8A",
    skinHi: "#FFF3E0",
    skinMid: "#FFE0B2",
    skinLo: "#D7A86E",
    detail: "#FBBF24",
    blush: "#EF4444",
    eye: "#090D16",
    ink: "#090D16",
    glow: "#3B82F6",
  },
  // Simba: Sunlit golden-amber lion cub fur, rich sienna mane tuft & Rafiki mark, cream muzzle, rosy lion nose
  crown: {
    hi: "#FDE68A",
    mid: "#F59E0B",
    lo: "#B45309",
    secHi: "#FCA5A5",
    secMid: "#DC2626",
    secLo: "#7F1D1D",
    skinHi: "#FEF3C7",
    skinMid: "#FDE047",
    skinLo: "#CA8A04",
    detail: "#EA580C",
    blush: "#FB7185",
    eye: "#78350F",
    ink: "#271203",
    glow: "#FBBF24",
  },
  // Buzz Lightyear: Star Command lime-green & white space armor, royal purple ranger hood, crystal visor dome
  rocket: {
    hi: "#BBF7D0",
    mid: "#22C55E",
    lo: "#15803D",
    secHi: "#C084FC",
    secMid: "#7E22CE",
    secLo: "#4C1D95",
    skinHi: "#FFE4D0",
    skinMid: "#F5C29F",
    skinLo: "#C88B65",
    detail: "#EF4444",
    blush: "#38BDF8",
    eye: "#0284C7",
    ink: "#170F2E",
    glow: "#4ADE80",
  },
  // Sheriff Woody: Saddle-leather brown cowboy hat, golden-yellow plaid collar, crimson bandana, gold sheriff badge
  sheriff: {
    hi: "#D97706",
    mid: "#92400E",
    lo: "#451A03",
    secHi: "#FCA5A5",
    secMid: "#DC2626",
    secLo: "#7F1D1D",
    skinHi: "#FFE6D0",
    skinMid: "#F5C396",
    skinLo: "#C58958",
    detail: "#FACC15",
    blush: "#F87171",
    eye: "#451A03",
    ink: "#1C0A00",
    glow: "#F59E0B",
  },
  // WALL-E: Brushed metallic gunmetal binocular eyes, weathered ochre-gold chassis, glowing cyan optical lenses & green sprout
  robot: {
    hi: "#FDE047",
    mid: "#EAB308",
    lo: "#854D0E",
    secHi: "#E2E8F0",
    secMid: "#94A3B8",
    secLo: "#334155",
    skinHi: "#F1F5F9",
    skinMid: "#CBD5E1",
    skinLo: "#64748B",
    detail: "#22C55E",
    blush: "#EF4444",
    eye: "#38BDF8",
    ink: "#0F172A",
    glow: "#38BDF8",
  },
  // Joy: Electric cerulean pixie hair, luminous golden-champagne glowing skin, chartreuse star dress, core memory orbs
  sparkle: {
    hi: "#67E8F9",
    mid: "#0284C7",
    lo: "#1E3A8A",
    secHi: "#ECFCCB",
    secMid: "#84CC16",
    secLo: "#3F6212",
    skinHi: "#FEF9C3",
    skinMid: "#FDE047",
    skinLo: "#EAB308",
    detail: "#F59E0B",
    blush: "#F472B6",
    eye: "#0284C7",
    ink: "#172554",
    glow: "#FACC15",
  },
  // Spider-Man: Vibrant Marvel crimson mask, deep navy-cobalt suit accents, pearl-white angular lenses with thick ink frames
  web: {
    hi: "#FCA5A5",
    mid: "#EF4444",
    lo: "#991B1B",
    secHi: "#60A5FA",
    secMid: "#1D4ED8",
    secLo: "#172554",
    skinHi: "#FFFFFF",
    skinMid: "#E2E8F0",
    skinLo: "#94A3B8",
    detail: "#38BDF8",
    blush: "#F87171",
    eye: "#FFFFFF",
    ink: "#090D16",
    glow: "#F43F5E",
  },
  // Iron Man: Metallic hot-rod crimson armor, brushed gold-titanium faceplate, blinding cyan-white eyes & Arc Reactor
  arc: {
    hi: "#FCA5A5",
    mid: "#DC2626",
    lo: "#7F1D1D",
    secHi: "#FEF08A",
    secMid: "#F59E0B",
    secLo: "#92400E",
    skinHi: "#FEF08A",
    skinMid: "#FBBF24",
    skinLo: "#B45309",
    detail: "#22D3EE",
    blush: "#FFFFFF",
    eye: "#67E8F9",
    ink: "#180606",
    glow: "#22D3EE",
  },
  // Baby Groot: Sculpted warm walnut-oak wood bark, vibrant emerald-lime leaf sprouts, glossy dark puppy eyes
  leaf: {
    hi: "#D97706",
    mid: "#92400E",
    lo: "#451A03",
    secHi: "#86EFAC",
    secMid: "#16A34A",
    secLo: "#14532D",
    skinHi: "#F59E0B",
    skinMid: "#B45309",
    skinLo: "#78350F",
    detail: "#4ADE80",
    blush: "#86EFAC",
    eye: "#090D16",
    ink: "#1C0A00",
    glow: "#4ADE80",
  },
  // Black Panther: Matte obsidian vibranium cowl, chrome silver tooth necklace, glowing royal violet kinetic energy seams
  shield: {
    hi: "#475569",
    mid: "#1E293B",
    lo: "#090D16",
    secHi: "#E9D5FF",
    secMid: "#9333EA",
    secLo: "#4C1D95",
    skinHi: "#F8FAFC",
    skinMid: "#CBD5E1",
    skinLo: "#64748B",
    detail: "#C084FC",
    blush: "#A855F7",
    eye: "#FFFFFF",
    ink: "#030712",
    glow: "#A855F7",
  },
  // Grogu: Soft sage-pistachio green skin, translucent rosy-peach inner ears, cozy fleecy oatmeal-tan Jedi cloak, huge dark eyes
  force: {
    hi: "#BBF7D0",
    mid: "#4ADE80",
    lo: "#15803D",
    secHi: "#FDE68A",
    secMid: "#D97706",
    secLo: "#78350F",
    skinHi: "#DCFCE7",
    skinMid: "#86EFAC",
    skinLo: "#22C55E",
    detail: "#E2E8F0",
    blush: "#FDA4AF",
    eye: "#090D16",
    ink: "#052E16",
    glow: "#34D399",
  },
  // R2-D2: Brushed silver-white astromech dome, royal cobalt-blue chassis panels, glossy radar lens & crimson holoprojector
  droid: {
    hi: "#FFFFFF",
    mid: "#E2E8F0",
    lo: "#64748B",
    secHi: "#60A5FA",
    secMid: "#1D4ED8",
    secLo: "#1E3A8A",
    skinHi: "#F8FAFC",
    skinMid: "#CBD5E1",
    skinLo: "#94A3B8",
    detail: "#EF4444",
    blush: "#FBBF24",
    eye: "#090D16",
    ink: "#0F172A",
    glow: "#38BDF8",
  },
  // Mandalorian: Polished beskar chrome helmet, slate-steel cheek hollows, pitch-black T-visor with specular rim, copper pauldron hint
  helmet: {
    hi: "#F8FAFC",
    mid: "#94A3B8",
    lo: "#334155",
    secHi: "#FDBA74",
    secMid: "#C2410C",
    secLo: "#7C2D12",
    skinHi: "#E2E8F0",
    skinMid: "#64748B",
    skinLo: "#1E293B",
    detail: "#38BDF8",
    blush: "#F59E0B",
    eye: "#090D16",
    ink: "#090D16",
    glow: "#94A3B8",
  },
};

