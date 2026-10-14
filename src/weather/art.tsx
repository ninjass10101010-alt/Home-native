import React from "react";
import { Text, View } from "react-native";
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from "react-native-svg";

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

export function ConditionIcon({ code, size }: { code: ConditionCode; size: number }) {
  const ink = useMonsterInk();
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
          <View style={{ position: "absolute", top: 0, right: size * 0.1 }}>
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
          <View style={{ position: "absolute", top: 0, right: size * 0.15 }}>
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
