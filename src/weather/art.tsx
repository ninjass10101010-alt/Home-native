import React from "react";
import { StyleSheet, Text, View, type DimensionValue } from "react-native";
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from "react-native-svg";

import { useTheme } from "../theme/ThemeProvider";
import { mix } from "../theme/mix";
import { moonLitPath } from "./astro";
import { useMonsterInk, type ConditionCode, type MonsterInkName } from "./language";

type Ink = Record<MonsterInkName, string>;

// ─── MonsterDigit — seven-segment digits, flat per-segment color, one eye ───
// Verbatim port of Home-ai src/components/ui/WxToys.tsx:887-1044 (Amendment B,
// 2026-10-02). Depth = segment color mixed 32% toward ink-blue (here:
// mix(color, inkBlue, 68)), offset +7/+9 SVG units, rx 12, glint stroke 6.
type DigitSegment = "top" | "upperRight" | "lowerRight" | "bottom" | "lowerLeft" | "upperLeft" | "middle";
type DigitSection = { segment: DigitSegment; color: MonsterInkName };

const DIGIT_VIEW_W = 200;
const DIGIT_BOX_Y = 28;
const DIGIT_BOX_H = 272;
export const DIGIT_ASPECT = DIGIT_VIEW_W / DIGIT_BOX_H;

const DIGIT_SEGMENT_RECTS: Record<DigitSegment, { x: number; y: number; width: number; height: number }> = {
  top: { x: 44, y: 34, width: 112, height: 44 },
  upperRight: { x: 136, y: 72, width: 40, height: 104 },
  lowerRight: { x: 136, y: 170, width: 40, height: 84 },
  bottom: { x: 44, y: 242, width: 112, height: 44 },
  lowerLeft: { x: 24, y: 170, width: 40, height: 84 },
  upperLeft: { x: 24, y: 72, width: 40, height: 104 },
  middle: { x: 44, y: 138, width: 112, height: 44 },
};

const DIGIT_SEGMENTS: Record<string, readonly DigitSection[]> = {
  "0": [
    { segment: "top", color: "orange" },
    { segment: "upperRight", color: "red" },
    { segment: "lowerRight", color: "teal" },
    { segment: "bottom", color: "blue" },
    { segment: "lowerLeft", color: "purple" },
    { segment: "upperLeft", color: "teal" },
  ],
  "1": [
    { segment: "upperRight", color: "teal" },
    { segment: "lowerRight", color: "orange" },
  ],
  "2": [
    { segment: "top", color: "orange" },
    { segment: "upperRight", color: "teal" },
    { segment: "middle", color: "purple" },
    { segment: "lowerLeft", color: "blue" },
    { segment: "bottom", color: "red" },
  ],
  "3": [
    { segment: "top", color: "orange" },
    { segment: "upperRight", color: "teal" },
    { segment: "middle", color: "purple" },
    { segment: "lowerRight", color: "red" },
    { segment: "bottom", color: "blue" },
  ],
  "4": [
    { segment: "upperLeft", color: "teal" },
    { segment: "upperRight", color: "orange" },
    { segment: "middle", color: "purple" },
    { segment: "lowerRight", color: "red" },
  ],
  "5": [
    { segment: "top", color: "orange" },
    { segment: "upperLeft", color: "teal" },
    { segment: "middle", color: "purple" },
    { segment: "lowerRight", color: "red" },
    { segment: "bottom", color: "blue" },
  ],
  "6": [
    { segment: "top", color: "orange" },
    { segment: "upperLeft", color: "teal" },
    { segment: "middle", color: "purple" },
    { segment: "lowerLeft", color: "blue" },
    { segment: "lowerRight", color: "red" },
    { segment: "bottom", color: "orange" },
  ],
  "7": [
    { segment: "top", color: "orange" },
    { segment: "upperRight", color: "teal" },
    { segment: "lowerRight", color: "red" },
  ],
  "8": [
    { segment: "top", color: "orange" },
    { segment: "upperRight", color: "teal" },
    { segment: "lowerRight", color: "red" },
    { segment: "bottom", color: "blue" },
    { segment: "lowerLeft", color: "purple" },
    { segment: "upperLeft", color: "red" },
    { segment: "middle", color: "orange" },
  ],
  "9": [
    { segment: "top", color: "orange" },
    { segment: "upperLeft", color: "teal" },
    { segment: "upperRight", color: "red" },
    { segment: "middle", color: "purple" },
    { segment: "lowerRight", color: "blue" },
    { segment: "bottom", color: "orange" },
  ],
  "-": [{ segment: "middle", color: "purple" }],
};

const DIGIT_EYE_POSITIONS: Record<string, { x: number; y: number }> = {
  "0": { x: 156, y: 110 }, "1": { x: 156, y: 110 }, "2": { x: 156, y: 110 },
  "3": { x: 156, y: 110 }, "4": { x: 156, y: 110 }, "5": { x: 44, y: 110 },
  "6": { x: 44, y: 110 }, "7": { x: 156, y: 110 }, "8": { x: 156, y: 110 },
  "9": { x: 156, y: 110 },
};

export function MonsterDigit({ digit, height }: { digit: string; height: number }) {
  const ink = useMonsterInk();
  const sections = DIGIT_SEGMENTS[digit];
  const eye = DIGIT_EYE_POSITIONS[digit];
  if (!sections) {
    // Unknown character: text fallback — never a blank glyph, never fake art.
    return <Text style={{ fontSize: height, lineHeight: height * 1.1, color: ink.inkBlue }}>{digit}</Text>;
  }
  return (
    <Svg
      testID={`wx-digit-${digit}`}
      width={height * DIGIT_ASPECT}
      height={height}
      viewBox={`0 ${DIGIT_BOX_Y} ${DIGIT_VIEW_W} ${DIGIT_BOX_H}`}
    >
      {sections.map(({ segment, color }) => {
        const rect = DIGIT_SEGMENT_RECTS[segment];
        const depth = mix(ink[color], ink.inkBlue, 68);
        return (
          <G key={segment}>
            <Rect
              testID={`wx-digit-depth-${segment}`}
              x={rect.x + 7}
              y={rect.y + 9}
              width={rect.width}
              height={rect.height}
              rx={12}
              fill={depth}
            />
            <Rect
              testID={`wx-digit-segment-${segment}`}
              x={rect.x}
              y={rect.y}
              width={rect.width}
              height={rect.height}
              rx={12}
              fill={ink[color]}
              stroke={ink.glint}
              strokeOpacity={0.85}
              strokeWidth={6}
            />
          </G>
        );
      })}
      {eye ? (
        <G testID="wx-digit-eye">
          <Circle cx={eye.x + 3} cy={eye.y + 5} r={17} fill={mix(ink.glint, ink.inkBlue, 78)} />
          <Circle cx={eye.x} cy={eye.y} r={17} fill={ink.glint} />
          <Circle cx={eye.x + 1} cy={eye.y + 1} r={8} fill={ink.pupil} />
        </G>
      ) : null}
    </Svg>
  );
}

// ─── Condition icon primitives (WxToys.tsx:633-824 verbatim) ───

function SunG({ ink }: { ink: Ink }) {
  const rays = Array.from({ length: 8 }, (_, i) => {
    const ang = (i * Math.PI) / 4;
    return {
      x1: 50 + Math.cos(ang) * 31,
      y1: 46 + Math.sin(ang) * 31,
      x2: 50 + Math.cos(ang) * 40,
      y2: 46 + Math.sin(ang) * 40,
    };
  });
  return (
    <>
      {/* Ink under-stroke: the sun body sits at ~1:1 on light washes, so the
          silhouette's 3:1 carrier is its ink outline (web parity). */}
      <G stroke={ink.inkBlue} strokeWidth={12} strokeLinecap="round">
        {rays.map((ray, i) => <Line key={i} {...ray} />)}
      </G>
      <G stroke={ink.orange} strokeWidth={7} strokeLinecap="round">
        {rays.map((ray, i) => <Line key={i} {...ray} />)}
      </G>
      <Circle cx={50} cy={46} r={24} fill={ink.inkBlue} stroke={ink.inkBlue} strokeWidth={8} />
      <Circle cx={50} cy={46} r={24} fill={ink.orange} />
      <Circle cx={67} cy={63} r={6} fill={ink.knotOrange} />
      <Ellipse cx={42} cy={37} rx={7} ry={4.5} fill={ink.glint} opacity={0.5} />
    </>
  );
}

function CloudBody({ fill }: { fill: string }) {
  return (
    <>
      <Circle cx={34} cy={42} r={16} fill={fill} />
      <Circle cx={55} cy={30} r={21} fill={fill} />
      <Circle cx={74} cy={44} r={14} fill={fill} />
      <Rect x={20} y={38} width={58} height={24} rx={12} fill={fill} />
    </>
  );
}

function CloudG({ ink, tone }: { ink: Ink; tone: "day" | "night" | "snow" | "storm" }) {
  const main = tone === "night" ? ink.purple : tone === "snow" || tone === "storm" ? ink.glint : ink.blue;
  const outline = tone === "snow" ? ink.blue : ink.inkBlue;
  const shade = tone === "day" ? ink.teal : tone === "snow" ? ink.blue : tone === "night" ? ink.blue : ink.purple;
  return (
    <>
      <G fill={outline} stroke={outline} strokeWidth={8}>
        <CloudBody fill={outline} />
      </G>
      <CloudBody fill={main} />
      <Circle cx={38} cy={56} r={11} fill={shade} opacity={0.9} />
      <Circle cx={62} cy={58} r={8} fill={shade} opacity={0.75} />
      <Circle cx={48} cy={22} r={5} fill={ink.glint} opacity={0.5} />
    </>
  );
}

function DropsG({ ink }: { ink: Ink }) {
  const drops = [
    { x1: 36, y1: 60, x2: 36, y2: 74, stroke: ink.blue },
    { x1: 52, y1: 66, x2: 52, y2: 84, stroke: ink.teal },
    { x1: 68, y1: 60, x2: 68, y2: 74, stroke: ink.blue },
  ];
  return (
    <>
      <G stroke={ink.inkBlue} strokeWidth={14} strokeLinecap="round">
        {drops.map((drop, i) => <Line key={i} {...drop} />)}
      </G>
      <G strokeLinecap="round" strokeWidth={9}>
        {drops.map((drop, i) => <Line key={i} {...drop} stroke={drop.stroke} />)}
      </G>
    </>
  );
}

function BoltG({ ink }: { ink: Ink }) {
  return (
    <>
      <Path
        d="M55 50 L40 74 H52 L46 92 L67 66 H54 Z"
        fill={ink.orange}
        stroke={ink.orange}
        strokeWidth={5}
        strokeLinejoin="round"
      />
      <Circle cx={46} cy={90} r={4} fill={ink.knotOrange} />
      <Path d="M47 70 L51 64" stroke={ink.glint} strokeWidth={3.5} strokeLinecap="round" opacity={0.55} />
    </>
  );
}

function SnowflakeG({ ink, x, y, s = 9 }: { ink: Ink; x: number; y: number; s?: number }) {
  const spokes = [0, 60, 120].map((d) => {
    const rad = (d * Math.PI) / 180;
    return { x1: x - Math.cos(rad) * s, y1: y - Math.sin(rad) * s, x2: x + Math.cos(rad) * s, y2: y + Math.sin(rad) * s };
  });
  return (
    <>
      <G stroke={ink.blue} strokeWidth={8} strokeLinecap="round">
        {spokes.map((spoke, i) => <Line key={i} {...spoke} />)}
      </G>
      <G stroke={ink.glint} strokeWidth={3.5} strokeLinecap="round">
        {spokes.map((spoke, i) => <Line key={i} {...spoke} />)}
      </G>
      <Circle cx={x} cy={y} r={4.2} fill={ink.blue} />
      <Circle cx={x} cy={y} r={3.2} fill={ink.glint} />
    </>
  );
}

function FogG({ ink }: { ink: Ink }) {
  const bars = [
    { x1: 24, y1: 16, x2: 80, y2: 16, stroke: ink.purple },
    { x1: 32, y1: 34, x2: 76, y2: 34, stroke: ink.teal },
    { x1: 26, y1: 52, x2: 62, y2: 52, stroke: ink.blue },
  ];
  return (
    <>
      <G stroke={ink.inkBlue} strokeWidth={15} strokeLinecap="round">
        {bars.map((bar, i) => <Line key={i} {...bar} />)}
      </G>
      <G strokeLinecap="round" strokeWidth={12}>
        {bars.map((bar, i) => <Line key={i} {...bar} stroke={bar.stroke} />)}
      </G>
      <Rect x={32} y={12} width={14} height={5} rx={2.5} fill={ink.glint} opacity={0.5} />
      <Rect x={40} y={30} width={12} height={5} rx={2.5} fill={ink.glint} opacity={0.45} />
    </>
  );
}

// Night-star cream tones stay (web-parity tokens; grandfathered there, tokenized here).
const STAR_PATHS = [
  { d: "m18 6 2.4 7.2L28 16l-7.6 2.8L18 26l-2.4-7.2L8 16l7.6-2.8L18 6Z" },
  { d: "m34 23 1.6 4.8L41 30l-5.4 2.2L34 37l-1.6-4.8L27 30l5.4-2.2L34 23Z" },
];

function StarClusterG({ ink }: { ink: Ink }) {
  return (
    <>
      <G fill={ink.inkBlue} stroke={ink.inkBlue} strokeWidth={3.5} strokeLinejoin="round">
        {STAR_PATHS.map((star) => <Path key={star.d} d={star.d} />)}
      </G>
      <Path d={STAR_PATHS[0].d} fill={ink.starCream} />
      <Path d={STAR_PATHS[1].d} fill={ink.starWarm} />
      <Circle cx={12} cy={34} r={2} fill={ink.inkBlue} stroke={ink.inkBlue} strokeWidth={3} />
      <Circle cx={12} cy={34} r={2} fill={ink.starCream} />
      <Circle cx={29} cy={10} r={1.5} fill={ink.inkBlue} stroke={ink.inkBlue} strokeWidth={3} />
      <Circle cx={29} cy={10} r={1.5} fill={ink.starCream} />
    </>
  );
}

// ─── ConditionIcon — one composition per ConditionCode (WxToys.tsx:1056-1130) ───
//
// The icon is a COMPOSITE, not a glyph: the web stacks a second character
// behind/above the cloud at fixed pixel offsets from the icon box
// (`right-1` = 4px for the sun, `right-2` = 8px for the night stars, at the
// wall size of 124). Those offsets are scaled with the box so the tablet keeps
// the web's composition at every size the timeline/screensaver ask for.

/** The web's wall-mode icon size — the reference scale (WxToys 1243: `wall ? 124 : 80`). */
export const CREATURE_SIZE = 124;

export function ConditionIcon({ code, size }: { code: ConditionCode; size: number }) {
  const ink = useMonsterInk();
  const k = size / CREATURE_SIZE; // the web's offsets are px at size 124
  switch (code) {
    case "clear":
      return (
        <Svg testID="wx-icon-clear" width={size * 0.8} height={size * 0.8} viewBox="0 0 100 100">
          <SunG ink={ink} />
        </Svg>
      );
    case "cloudy":
      return (
        <Svg testID="wx-icon-cloudy" width={size} height={size * 0.72} viewBox="0 0 100 72">
          <CloudG ink={ink} tone="day" />
        </Svg>
      );
    case "partly":
      return (
        <View testID="wx-icon-partly" style={{ width: size, height: size * 0.75 }}>
          <View style={{ position: "absolute", top: 0, right: 4 * k }}>
            <Svg width={size * 0.5} height={size * 0.5} viewBox="0 0 100 100">
              <SunG ink={ink} />
            </Svg>
          </View>
          <View style={{ position: "absolute", bottom: 0, left: 0 }}>
            <Svg width={size * 0.85} height={size * 0.85 * 0.72} viewBox="0 0 100 72">
              <CloudG ink={ink} tone="day" />
            </Svg>
          </View>
        </View>
      );
    case "partly-night":
      return (
        <View testID="wx-icon-partly-night" style={{ width: size, height: size * 0.75 }}>
          <View style={{ position: "absolute", top: 0, right: 8 * k }}>
            <Svg width={size * 0.5} height={size * 0.5} viewBox="0 0 48 48" fill="none">
              <StarClusterG ink={ink} />
            </Svg>
          </View>
          <View style={{ position: "absolute", bottom: 0, left: 0 }}>
            <Svg width={size * 0.85} height={size * 0.85 * 0.72} viewBox="0 0 100 72">
              <CloudG ink={ink} tone="night" />
            </Svg>
          </View>
        </View>
      );
    case "rain":
      return (
        <Svg testID="wx-icon-rain" width={size} height={size} viewBox="0 0 100 100">
          <G transform="translate(0,-4)">
            <CloudG ink={ink} tone="day" />
          </G>
          <DropsG ink={ink} />
        </Svg>
      );
    case "storm":
      return (
        <Svg testID="wx-icon-storm" width={size} height={size} viewBox="0 0 100 100">
          <G transform="translate(0,-4)">
            <CloudG ink={ink} tone="storm" />
          </G>
          <BoltG ink={ink} />
        </Svg>
      );
    case "snow":
      return (
        <Svg testID="wx-icon-snow" width={size} height={size} viewBox="0 0 100 100">
          <G transform="translate(0,-4)">
            <CloudG ink={ink} tone="snow" />
          </G>
          <SnowflakeG ink={ink} x={32} y={74} />
          <SnowflakeG ink={ink} x={52} y={84} />
          <SnowflakeG ink={ink} x={70} y={74} />
        </Svg>
      );
    case "fog":
      return (
        <Svg testID="wx-icon-fog" width={size} height={size * 0.6} viewBox="0 0 100 60">
          <FogG ink={ink} />
        </Svg>
      );
    case "night":
      return (
        <View testID="wx-icon-night">
          <Svg width={size * 0.8} height={size * 0.8} viewBox="0 0 48 48" fill="none">
            <StarClusterG ink={ink} />
          </Svg>
        </View>
      );
  }
}

// ─── MoonDisc — phase-lit limb on the ink disc ───

export function MoonDisc({ phase, size }: { phase: number; size: number }) {
  const ink = useMonsterInk();
  return (
    <Svg testID="wx-moon-disc" width={size} height={size} viewBox="0 0 200 200">
      <Circle cx={100} cy={100} r={92} fill={ink.inkBlue} />
      <G transform="translate(100,100)">
        <Path d={moonLitPath(phase, 88)} fill={ink.orange} />
      </G>
      <Circle cx={140} cy={62} r={10} fill={ink.glint} opacity={0.5} />
    </Svg>
  );
}

// ─── Poster atmosphere — the card is a SCENE, not a tint ──────────────
// Web parity: Home-ai src/components/ui/WxToys.tsx — PosterAccents (the
// night moon character), SceneLayers (the star field, the cloud puffs, the
// precipitation) and the widget's radial scrim. Every colour is a monster
// token or a mix() of monster tokens; every position is a percentage of the
// card, so the scene scales with the cell (wall) and the poster (gallery).

const pct = (n: number): DimensionValue => `${n}%` as DimensionValue;

/** Cloud-puff blob layouts (web CLOUD_VARIANTS, WxToys.tsx:56-60). */
const CLOUD_VARIANTS: [number, number, number][][] = [
  [[48, 78, 34], [92, 58, 44], [140, 74, 36], [110, 88, 30], [72, 90, 26]],
  [[40, 82, 30], [80, 62, 40], [124, 62, 38], [160, 84, 28], [100, 90, 32]],
  [[56, 80, 36], [104, 66, 46], [150, 82, 32], [80, 94, 28]],
];

export type SceneTone = "day" | "night" | "poster";

/** Cloud-puff tones (web CLOUD_TONES) expressed in monster tokens. */
function cloudTone(tone: SceneTone, ink: Ink): { hi: string; lo: string; shade: string } {
  if (tone === "night") {
    // web #E6E4FF / #7477A8 / rgba(69,72,111,.25)
    return {
      hi: mix(ink.purple, "white", 20),
      lo: mix(ink.purple, ink.inkBlue, 65),
      shade: mix(mix(ink.inkBlue, ink.purple, 65), "transparent", 25),
    };
  }
  if (tone === "poster") {
    // web #E9FFFC / #82D8D0 / rgba(42,166,164,.20)
    return {
      hi: mix(ink.teal, "white", 10),
      lo: mix(ink.inkBlue, ink.teal, 12),
      shade: mix(mix(ink.teal, ink.inkBlue, 60), "transparent", 20),
    };
  }
  // web #FFFFFF / #E8EDF7 / rgba(150,165,200,.35)
  return {
    hi: ink.glint,
    lo: mix(ink.inkBlue, "white", 12),
    shade: mix(mix(ink.inkBlue, "white", 40), "transparent", 35),
  };
}

/**
 * The soft background cloud (web CloudPuff, WxToys.tsx:62-102): a blob cluster
 * with a rounded base, a soft shade underneath and a top-light highlight.
 * Plain shapes only — the poster never depends on an SVG gradient def.
 */
export function SceneCloud({
  tone = "day",
  variant = 0,
  opacity = 0.4,
  style,
}: {
  tone?: SceneTone;
  variant?: number;
  opacity?: number;
  style?: object;
}) {
  const ink = useMonsterInk();
  const t = cloudTone(tone, ink);
  const blobs = CLOUD_VARIANTS[variant % CLOUD_VARIANTS.length];
  return (
    <Svg testID="wx-scene-cloud" width="100%" height="100%" viewBox="0 0 200 120" style={style}>
      <G fill={t.hi}>
        {blobs.map(([cx, cy, r], i) => (
          <Circle key={i} cx={cx} cy={cy} r={r} />
        ))}
        <Rect x={30} y={72} width={140} height={38} rx={19} />
      </G>
      <Ellipse cx={100} cy={106} rx={66} ry={7} fill={t.shade} />
      <Ellipse
        cx={blobs[1][0] - 8}
        cy={blobs[1][1] - blobs[1][2] * 0.45}
        rx={blobs[1][2] * 0.55}
        ry={blobs[1][2] * 0.28}
        fill={mix(ink.glint, "transparent", 65)}
      />
    </Svg>
  );
}

/**
 * The night moon character (web PosterAccents night group): the dark disc
 * always renders (a new moon leaves no hole in the poster), the lit limb
 * carries the real phase, and the craters sit inside the disc.
 *
 * The disc tone is the web's #242E56 — a deep navy that reads as a hole in the
 * lamplit field, not a second lit body.
 */
export function SceneMoon({ phase, size }: { phase: number; size?: number | string }) {
  const ink = useMonsterInk();
  const crater = mix(ink.starCream, ink.inkBlue, 52);
  return (
    <Svg testID="wx-scene-moon" width={size ?? "100%"} height={size ?? "100%"} viewBox="0 0 48 48">
      <Circle cx={24} cy={24} r={22} fill={mix(ink.knotPurple, ink.inkBlue, 15)} opacity={0.88} />
      <G transform="translate(24,24)">
        <Path d={moonLitPath(phase, 21)} fill={ink.starCream} opacity={0.92} />
      </G>
      <G opacity={0.34}>
        <Circle cx={17} cy={18} r={3.8} fill={crater} />
        <Circle cx={29} cy={27} r={5} fill={crater} />
        <Circle cx={21} cy={33} r={2.4} fill={crater} />
        <Circle cx={34} cy={14} r={2} fill={crater} />
        <Circle cx={11} cy={28} r={1.8} fill={crater} />
      </G>
      <Circle cx={24} cy={24} r={21} fill="none" stroke={mix(ink.glint, "transparent", 25)} strokeWidth={1} />
    </Svg>
  );
}

// ─── Scene sky — the web's flat SKY washes ─────────────────────────────
// The wall card paints one FLAT wash per scene (web wx-tokens.ts:25-35): the
// three stops sit inside a single lightness step, so the card reads as a lit
// field rather than a gradient. The monster WASH tokens are the /weather PAGE
// poster skin (a diagonal gradient on a different surface), so the wall field
// is composed here from monster tokens — no literals, no second palette.
//
// Web targets (for the record):
//   clear  #55bce8 → #5bc4ec   cloudy #9cc9e2 → #a6d1e8
//   rain   #adb9d3 → #a5b2cf   snow   #f6f6fa → #f0eef6
//   storm  #656399 → #58568e   night  #8b90c6 → #9196cd

export type SceneKey = "clear" | "cloudy" | "rain" | "snow" | "storm" | "night";

/**
 * The scene the card paints — web parity with wmoToScene (WxToys.tsx:529):
 * after dark the clear/cloudy skies collapse to the lamplit night field, while
 * precipitation keeps its own mid-tone sky so rain/snow stay readable.
 */
export function sceneFor(code: ConditionCode, isDay: boolean): SceneKey {
  if (code === "storm") return "storm";
  if (code === "snow") return "snow";
  if (code === "rain") return "rain";
  if (!isDay) return "night";
  if (code === "cloudy" || code === "fog") return "cloudy";
  return "clear";
}

/** The scene's flat wash stops, composed from monster tokens. */
export function useSceneSky(scene: SceneKey): [string, string] {
  const { colors } = useTheme();
  const ink = useMonsterInk();
  const clearTop = colors["color-monster-wash-clear-top"] ?? ink.teal;
  const dayTop = colors["color-monster-wash-day-top"] ?? clearTop;
  if (scene === "night") {
    // the lamplit indigo — purple over blue, warmed a touch off pure blue
    const lamplit = mix(ink.purple, ink.blue, 50);
    const top = mix(mix(ink.starCream, lamplit, 22), ink.knotOrange, 95);
    return [top, mix("white", top, 3)];
  }
  if (scene === "clear") {
    const top = clearTop;
    return [top, mix("white", top, 5)];
  }
  if (scene === "cloudy") {
    const top = mix(dayTop, ink.inkBlue, 90);
    return [top, mix("white", top, 6)];
  }
  if (scene === "rain") {
    const top = mix(mix(ink.blue, "white", 42), ink.knotPurple, 88);
    return [top, mix(ink.blue, top, 8)];
  }
  if (scene === "snow") {
    const top = mix(ink.purple, "white", 5);
    return [top, mix(ink.purple, top, 3)];
  }
  // storm — the flat violet slate (the only dark field: it carries white ink)
  const top = mix(ink.inkBlue, ink.purple, 55);
  return [top, mix(ink.inkBlue, top, 30)];
}

/**
 * The star field (web SceneLayers night stars): 42 white dots in the top 45%
 * of the card, sized 2–4px. Static — the wall panel is always-on.
 */
export function StarField({ count = 42, color, opacity = 0.92 }: { count?: number; color: string; opacity?: number }) {
  const stars = Array.from({ length: count }, (_, i) => ({
    left: (i * 37) % 100,
    top: (i * 53) % 45,
    size: 2 + (i % 3),
  }));
  return (
    <View testID="wx-scene-stars" style={StyleSheet.absoluteFill} pointerEvents="none">
      {stars.map((s, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            left: pct(s.left),
            top: pct(s.top),
            width: s.size,
            height: s.size,
            borderRadius: s.size / 2,
            backgroundColor: color,
            opacity,
          }}
        />
      ))}
    </View>
  );
}

/**
 * Precipitation (web SceneLayers rain/snow layers): the drop count follows the
 * REAL precipitation probability the API reported — a dry card never draws
 * rain it cannot justify.
 */
function Precipitation({ code, precipPct }: { code: ConditionCode; precipPct: number | null }) {
  const ink = useMonsterInk();
  const wet = code === "rain" || code === "storm";
  const snowy = code === "snow";
  if (!wet && !snowy) return null;
  const probability = precipPct == null ? 0 : Math.max(0, Math.min(100, precipPct));
  if (probability <= 0) return null;
  const count = Math.max(1, Math.round((probability / 100) * (wet ? 22 : 18)));
  const drops = Array.from({ length: count }, (_, i) => ({
    left: (i * 41) % 100,
    top: (i * 29) % 100,
    height: 14 + ((i * 7) % 3) * 6,
    opacity: 0.35 + ((i * 13) % 40) / 100,
    size: 3 + ((i * 5) % 5),
  }));
  return (
    <View testID="wx-scene-precip" style={StyleSheet.absoluteFill} pointerEvents="none">
      {drops.map((d, i) =>
        wet ? (
          <View
            key={i}
            style={{
              position: "absolute",
              left: pct(d.left),
              top: pct(d.top),
              width: 2,
              height: d.height,
              borderRadius: 1,
              backgroundColor: mix(ink.blue, "transparent", 100 - d.opacity),
            }}
          />
        ) : (
          <View
            key={i}
            style={{
              position: "absolute",
              left: pct(d.left),
              top: pct(d.top),
              width: d.size,
              height: d.size,
              borderRadius: d.size / 2,
              backgroundColor: mix(ink.glint, "transparent", 100 - d.opacity),
            }}
          />
        )
      )}
    </View>
  );
}

/**
 * The poster accents (web PosterAccents, WxToys.tsx:200-305): ONE svg on the
 * web's 320×180 poster plane, sliced to cover the card (`xMidYMid slice`).
 * The slice is what puts the night moon half off the card's right edge in the
 * reference — the geometry is the web's, so the native lands in the same place
 * at any card size.
 */
export function PosterAccents({ scene, moonPhase }: { scene: SceneKey; moonPhase: number }) {
  const ink = useMonsterInk();
  // the web's deep navy disc tone and its cool-grey crater tone
  const disc = mix(ink.knotPurple, ink.inkBlue, 15);
  const crater = mix(ink.starCream, ink.inkBlue, 52);
  return (
    <Svg
      testID="wx-poster-accents"
      width="100%"
      height="100%"
      viewBox="0 0 320 180"
      preserveAspectRatio="xMidYMid slice"
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      {scene === "night" ? (
        <G testID="wx-poster-moon" transform="translate(253 42)">
          {/* the dark disc always renders — a new moon leaves no hole in the poster */}
          <Circle r={22} fill={disc} opacity={0.88} />
          <Path d={moonLitPath(moonPhase, 21)} fill={ink.starCream} opacity={0.92} />
          <G opacity={0.35}>
            <Circle cx={-7} cy={-6} r={3.8} fill={crater} />
            <Circle cx={5} cy={3} r={5} fill={crater} />
            <Circle cx={-3} cy={9} r={2.4} fill={crater} />
            <Circle cx={10} cy={-10} r={2} fill={crater} />
            <Circle cx={-13} cy={4} r={1.8} fill={crater} />
          </G>
          <Circle r={21} fill="none" stroke={mix(ink.glint, "transparent", 25)} strokeWidth={1} />
        </G>
      ) : null}
      {scene === "rain" ? (
        <G stroke={mix(ink.blue, ink.inkBlue, 70)} strokeWidth={4} strokeLinecap="round" opacity={0.55}>
          <Path d="M34 18l-8 20" />
          <Path d="M82 52l-8 20" />
          <Path d="M260 24l-8 20" />
          <Path d="M294 82l-8 20" />
        </G>
      ) : null}
      {scene === "snow" ? (
        <G fill="none" stroke={mix(ink.purple, ink.inkBlue, 45)} strokeWidth={3} strokeLinecap="round" opacity={0.55}>
          <Path d="m34 22 8 8-8 8-8-8Z" />
          <Path d="m92 64 7 7-7 7-7-7Z" />
          <Path d="m266 24 8 8-8 8-8-8Z" />
          <Path d="m294 92 6 6-6 6-6-6Z" />
        </G>
      ) : null}
      {scene === "storm" ? (
        <G opacity={0.68}>
          <Path d="m266 14-18 34h17l-5 30 25-40h-17Z" fill={ink.orange} />
        </G>
      ) : null}
    </Svg>
  );
}

/**
 * The radial scrim the web lays over the scene (WeatherWidget.tsx:1154-1161):
 * `radial-gradient(70% 55% at 50% 42%, <bloom> 0%, transparent 72%)` — a soft
 * light bloom that lifts the hero out of the sky. The storm field inverts it
 * (a dark bloom, so the white ink keeps its contrast).
 *
 * The bloom is drawn as nested ellipses (no SVG gradient def — the poster
 * must render on every surface, including the test renderer): the outermost
 * ellipse is the web's 72% fade end, and each ring carries an equal slice of
 * the bloom's alpha, so the falloff reads as one soft cone.
 */
const SCRIM_RINGS = 20;
const SCRIM_CENTER = { cx: 50, cy: 42 };
const SCRIM_EXTENT = { rx: 50.4, ry: 39.6 }; // 72% of the web's 70% / 55% ellipse

export function PosterScrim({ scene }: { scene: SceneKey }) {
  const ink = useMonsterInk();
  const dark = scene === "storm";
  const color = dark ? mix(ink.inkBlue, "black", 60) : ink.glint;
  const target = dark ? 0.4 : scene === "night" ? 0.45 : scene === "clear" ? 0.12 : 0.24;
  // Equal slices compose source-over into the target alpha at the centre.
  const slice = 1 - Math.pow(1 - target, 1 / SCRIM_RINGS);
  return (
    <Svg
      testID="wx-scene-scrim"
      width="100%"
      height="100%"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      {Array.from({ length: SCRIM_RINGS }, (_, i) => {
        const k = (i + 1) / SCRIM_RINGS;
        return (
          <Ellipse
            key={k}
            cx={SCRIM_CENTER.cx}
            cy={SCRIM_CENTER.cy}
            rx={SCRIM_EXTENT.rx * k}
            ry={SCRIM_EXTENT.ry * k}
            fill={color}
            opacity={slice}
          />
        );
      })}
    </Svg>
  );
}

/**
 * The location pin (web WeatherWidget.tsx:1174-1178): an outlined map pin in
 * the accent colour — the chip's one warm mark.
 */
export function MapPinGlyph({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <Svg testID="wx-pin" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2}>
      <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <Circle cx={12} cy={10} r={3} />
    </Svg>
  );
}

/** The chevron on the Details affordance (web WeatherWidget.tsx:1201-1203). */
export function ChevronGlyph({ color, size = 14 }: { color: string; size?: number }) {
  return (
    <Svg testID="wx-chevron" width={size} height={size} viewBox="0 0 20 20" fill={color} opacity={0.6}>
      <Path
        fillRule="evenodd"
        d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
        clipRule="evenodd"
      />
    </Svg>
  );
}

export interface WeatherSceneProps {
  /** The condition the scene dresses. */
  code: ConditionCode;
  /** Daylight from the API — the scene is a night sky only when it really is. */
  isDay: boolean;
  /** Real precipitation probability (0–100) or null when the API gave none. */
  precipPct: number | null;
  /** Moon phase 0–1 (0 = new) from the snapshot timestamp. */
  moonPhase: number;
}

/**
 * The whole poster atmosphere in one absolutely-filled layer: the star field
 * and the moon character at night, the soft cloud puffs behind the hero, and
 * the precipitation when the sky is actually wet.
 */
export function WeatherScene({ code, isDay, precipPct, moonPhase }: WeatherSceneProps) {
  const ink = useMonsterInk();
  const scene = sceneFor(code, isDay);
  const night = scene === "night";
  const clear = code === "clear" || code === "night";
  const partly = code === "partly" || code === "partly-night";
  const tone: SceneTone = night ? "night" : clear ? "poster" : "day";
  const puffs = clear ? 0 : partly ? 1 : 2;

  return (
    <View testID="wx-scene" style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* web order: poster accents → stars → cloud puffs → precipitation */}
      <PosterAccents scene={scene} moonPhase={moonPhase} />
      {night ? <StarField color={ink.glint} /> : null}
      {puffs > 0 ? (
        <View style={{ position: "absolute", left: pct(-4), top: pct(13), width: pct(38), height: pct(23), opacity: partly ? 0.34 : 0.44, transform: [{ rotate: "-6deg" }] }}>
          <SceneCloud tone={tone} variant={0} />
        </View>
      ) : null}
      {puffs > 1 ? (
        <View style={{ position: "absolute", right: pct(-5), top: pct(27), width: pct(32), height: pct(19), opacity: 0.2, transform: [{ rotate: "3deg" }] }}>
          <SceneCloud tone={tone} variant={1} />
        </View>
      ) : null}
      <Precipitation code={code} precipPct={precipPct} />
    </View>
  );
}
