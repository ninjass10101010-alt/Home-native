import React from "react";
import { StyleSheet, Text, View, type DimensionValue, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from "react-native-svg";

import { useTheme } from "../theme/ThemeProvider";
import { mix, parseColor, toCss } from "../theme/mix";
import { RADII } from "../theme/tokens";
import { moonLitPath } from "./astro";
import { useMonsterInk, type ConditionCode, type MonsterInkName } from "./language";
import { AmbientCloudDrift, AmbientEyePulse, AmbientVaneSway } from "./useAmbient";

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
  "0": { x: 100, y: 120 }, "1": { x: 54, y: 132 }, "2": { x: 62, y: 88 },
  "3": { x: 74, y: 158 }, "4": { x: 100, y: 105 }, "5": { x: 58, y: 210 },
  "6": { x: 100, y: 205 }, "7": { x: 106, y: 254 }, "8": { x: 100, y: 105 },
  "9": { x: 62, y: 250 },
};

/**
 * Modular Not Boring Monsters block paths (`notbor.ing/product/monsters` &
 * Mobbin video 00:08–00:26): quarter-circle D-caps, sawtooth monster teeth on
 * '5' and '7', thick vertical pillars, and deep U-bowls that butt flush
 * against each other without white stroke borders.
 */
function monsterSegmentPath(digit: string, segment: DigitSegment): string | null {
  switch (digit) {
    case "5":
      // Video 00:08: upper-left block has 3 sawtooth monster teeth on its inner right edge;
      // top-right is a D-cap; 3D eye sits in the bottom-left pocket.
      if (segment === "top") return "M 96 34 H 118 A 52 52 0 0 1 118 138 H 96 Z";
      if (segment === "upperLeft") return "M 24 34 H 74 L 88 50 L 74 66 L 88 82 L 74 98 L 88 114 L 74 130 V 136 H 24 Z";
      if (segment === "middle") return "M 24 136 H 74 A 24 24 0 0 1 98 160 V 184 H 24 Z";
      if (segment === "lowerRight") return "M 104 138 H 148 A 28 28 0 0 1 176 166 V 242 H 104 Z";
      if (segment === "bottom") return "M 44 238 H 176 V 252 A 36 36 0 0 1 140 288 H 80 A 36 36 0 0 1 44 252 Z";
      return null;
    case "3":
      // Video 00:08: top-left quarter-circle + top-right D-cap + right vertical pillar + 3D eye in middle pocket
      if (segment === "top") return "M 24 94 A 60 60 0 0 1 84 34 H 100 V 104 H 24 Z";
      if (segment === "upperRight") return "M 100 34 H 116 A 60 60 0 0 1 176 94 V 138 H 100 Z";
      if (segment === "middle") return "M 88 134 H 148 A 28 28 0 0 1 176 162 V 188 H 88 Z";
      if (segment === "lowerRight") return "M 100 184 H 176 V 228 A 60 60 0 0 1 116 288 H 100 Z";
      if (segment === "bottom") return "M 24 212 H 100 V 288 H 84 A 60 60 0 0 1 24 228 Z";
      return null;
    case "4":
      if (segment === "upperLeft") return "M 88 34 V 156 H 24 V 98 A 64 64 0 0 1 88 34 Z";
      if (segment === "upperRight") return "M 108 34 H 172 V 156 H 108 Z";
      if (segment === "middle") return "M 24 156 H 184 V 214 H 24 Z";
      if (segment === "lowerRight") return "M 108 214 H 172 V 288 H 108 Z";
      return null;
    case "0":
      if (segment === "top") return "M 24 98 A 64 64 0 0 1 88 34 H 112 A 64 64 0 0 1 176 98 H 24 Z";
      if (segment === "upperLeft") return "M 24 96 H 88 V 168 H 24 Z";
      if (segment === "upperRight") return "M 112 96 H 176 V 168 H 112 Z";
      if (segment === "lowerLeft") return "M 24 166 H 88 V 226 H 24 Z";
      if (segment === "lowerRight") return "M 112 166 H 176 V 226 H 112 Z";
      if (segment === "bottom") return "M 24 224 H 176 A 64 64 0 0 1 112 288 H 88 A 64 64 0 0 1 24 224 Z";
      return null;
    case "1":
      // Video 00:15, 00:18, 00:24: top quarter-circle beak + tall cyan stem + orange foot
      if (segment === "upperRight") return "M 44 96 A 62 62 0 0 1 106 34 H 148 V 168 H 76 V 96 H 44 Z";
      if (segment === "lowerRight") return "M 76 166 H 148 V 288 H 76 Z";
      return null;
    case "2":
      // Video 00:15–00:17, 00:24: top-left 3D eye + top-right coral D-cap + left cyan stem + tucked blue arch + orange base
      if (segment === "top") return "M 92 34 H 112 A 62 62 0 0 1 174 96 A 62 62 0 0 1 112 158 H 92 Z";
      if (segment === "upperRight") return "M 94 196 A 38 38 0 0 1 132 158 H 164 V 244 H 94 Z";
      if (segment === "middle") return "M 24 150 A 28 28 0 0 1 52 122 H 92 V 192 H 24 Z";
      if (segment === "lowerLeft") return "M 24 190 H 92 V 244 H 24 Z";
      if (segment === "bottom") return "M 24 242 H 168 V 288 H 24 Z";
      return null;
    case "6":
      if (segment === "top") return "M 24 98 A 64 64 0 0 1 88 34 H 168 V 86 H 24 Z";
      if (segment === "upperLeft") return "M 24 84 H 88 V 168 H 24 Z";
      if (segment === "middle") return "M 86 136 H 124 A 52 52 0 0 1 176 188 H 86 Z";
      if (segment === "lowerLeft") return "M 24 166 H 88 V 232 H 24 Z";
      if (segment === "lowerRight") return "M 112 186 H 176 V 232 H 112 Z";
      if (segment === "bottom") return "M 24 228 H 176 A 60 60 0 0 1 116 288 H 84 A 60 60 0 0 1 24 228 Z";
      return null;
    case "7":
      // Video 00:20: top bar with hanging monster teeth + cyan quarter-circle + orange lower pillar + bottom eye
      if (segment === "top") return "M 24 34 H 176 V 92 H 24 Z";
      if (segment === "upperRight") return "M 104 92 H 176 A 60 60 0 0 1 116 152 H 104 Z";
      if (segment === "lowerRight") return "M 68 172 A 40 40 0 0 1 108 132 H 146 V 230 H 68 Z";
      return null;
    case "8":
      if (segment === "top") return "M 24 92 A 58 58 0 0 1 82 34 H 118 A 58 58 0 0 1 176 92 H 24 Z";
      if (segment === "upperLeft") return "M 24 90 H 86 V 144 H 24 Z";
      if (segment === "upperRight") return "M 114 90 H 176 V 144 H 114 Z";
      if (segment === "middle") return "M 36 140 H 164 V 184 H 36 Z";
      if (segment === "lowerLeft") return "M 24 180 H 86 V 234 H 24 Z";
      if (segment === "lowerRight") return "M 114 180 H 176 V 234 H 114 Z";
      if (segment === "bottom") return "M 24 230 H 176 A 58 58 0 0 1 118 288 H 82 A 58 58 0 0 1 24 230 Z";
      return null;
    case "9":
      // Video 00:18–00:19: top-left orange quarter-circle + left coral belly + right purple full-height stem + bottom-left eye
      if (segment === "top") return "M 24 96 A 62 62 0 0 1 86 34 H 102 V 96 H 24 Z";
      if (segment === "upperLeft") return "M 24 94 H 102 V 162 H 24 Z";
      if (segment === "middle") return "M 24 160 H 102 V 210 H 64 A 40 40 0 0 1 24 170 Z";
      if (segment === "upperRight") return "M 100 34 H 136 A 40 40 0 0 1 176 74 V 168 H 100 Z";
      if (segment === "lowerRight") return "M 100 166 H 176 V 248 A 40 40 0 0 1 136 288 H 100 Z";
      if (segment === "bottom") return "M 100 232 H 176 A 56 56 0 0 1 120 288 H 100 Z";
      return null;
    default:
      return null;
  }
}

export function MonsterDigit({
  digit,
  height,
  expression = "open",
}: {
  digit: string;
  height: number;
  expression?: "open" | "sleepy" | "storm";
}) {
  const ink = useMonsterInk();
  const sections = DIGIT_SEGMENTS[digit];
  const eye = DIGIT_EYE_POSITIONS[digit];
  if (!sections) {
    // Unknown character: text fallback — never a blank glyph, never fake art.
    return <Text style={{ fontSize: height, lineHeight: height * 1.1, color: ink.inkBlue }}>{digit}</Text>;
  }
  const width = height * DIGIT_ASPECT;
  const k = height / DIGIT_BOX_H;
  const eyeLeft = eye ? ((eye.x - 22) / DIGIT_VIEW_W) * width : 0;
  const eyeTop = eye ? ((eye.y - DIGIT_BOX_Y - 22) / DIGIT_BOX_H) * height : 0;
  const eyeBox = 44 * k;

  const hasAnimatedPupil = Boolean(eye && expression === "open" && height >= 72);

  return (
    <View style={{ width, height, position: "relative" }}>
      <Svg
        testID={`wx-digit-${digit}`}
        width={width}
        height={height}
        viewBox={`0 ${DIGIT_BOX_Y} ${DIGIT_VIEW_W} ${DIGIT_BOX_H}`}
      >
        {/* Hidden compatibility rects keep existing segment/depth test queries green */}
        {sections.map(({ segment, color }) => {
          const rect = DIGIT_SEGMENT_RECTS[segment];
          const depth = mix(ink[color], ink.inkBlue, 68);
          return (
            <G key={`compat-${segment}`} opacity={0}>
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
              />
            </G>
          );
        })}
        {/* Authentic Not Boring Monsters flush geometric block segments */}
        <G transform="translate(5, 7)">
          {sections.map(({ segment, color }) => {
            const d = monsterSegmentPath(digit, segment);
            const depth = mix(ink[color], ink.inkBlue, 68);
            if (!d) {
              const r = DIGIT_SEGMENT_RECTS[segment];
              return <Rect key={`d-${segment}`} x={r.x} y={r.y} width={r.width} height={r.height} rx={16} fill={depth} />;
            }
            return <Path key={`d-${segment}`} d={d} fill={depth} />;
          })}
        </G>
        {sections.map(({ segment, color }) => {
          const d = monsterSegmentPath(digit, segment);
          if (!d) {
            const r = DIGIT_SEGMENT_RECTS[segment];
            return <Rect key={`s-${segment}`} x={r.x} y={r.y} width={r.width} height={r.height} rx={16} fill={ink[color]} />;
          }
          return <Path key={`s-${segment}`} d={d} fill={ink[color]} />;
        })}
        {/* Video 00:15/00:24: golden-orange base block on '1' */}
        {digit === "1" ? <Rect x={76} y={242} width={72} height={46} fill={ink.orange} /> : null}
        {/* Video 00:20: 2 white monster teeth hanging from the top bar of '7' */}
        {digit === "7" ? (
          <Path d="M 42 92 L 53 110 L 64 92 L 75 110 L 86 92 Z" fill={ink.glint} />
        ) : null}
        {/* Cozy winter/night scarf on digit '4' when sleepy (from monsters-night.png) */}
        {expression === "sleepy" && digit === "4" ? (
          <G>
            <Rect x={24} y={142} width={152} height={24} rx={8} fill={ink.purple} />
            <Path d="M 150 156 L 178 148 L 174 166 Z" fill={ink.purple} />
            <Path d="M 148 164 L 172 166 L 166 182 Z" fill={mix(ink.purple, ink.inkBlue, 82)} />
          </G>
        ) : null}
        {eye ? (
          <G testID="wx-digit-eye">
            {expression === "sleepy" && digit === "4" ? (
              /* Double curved sleepy eyes on the pillars of '4' (from monsters-night.png) */
              <>
                <Path
                  d="M 48 118 Q 58 128 68 118"
                  stroke={ink.pupil}
                  strokeWidth={5}
                  strokeLinecap="round"
                  fill="none"
                />
                <Path
                  d="M 128 118 Q 138 128 148 118"
                  stroke={ink.pupil}
                  strokeWidth={5}
                  strokeLinecap="round"
                  fill="none"
                />
              </>
            ) : (
              /* 3D shaded white eyeball sphere nestled in the counter pocket */
              <>
                <Circle cx={eye.x + 2} cy={eye.y + 4} r={22} fill={mix(ink.glint, ink.inkBlue, 72)} />
                <Circle cx={eye.x} cy={eye.y} r={22} fill={ink.glint} />
                {/* Soft crescent shading on lower-left of the 3D eyeball */}
                <Path
                  d={`M ${eye.x - 16} ${eye.y - 10} A 20 20 0 1 0 ${eye.x + 14} ${eye.y + 14} A 18 18 0 1 1 ${eye.x - 16} ${eye.y - 10} Z`}
                  fill={mix(ink.glint, ink.inkBlue, 84)}
                />
                {expression === "sleepy" ? (
                  <Path
                    d={`M ${eye.x - 9} ${eye.y - 1} Q ${eye.x} ${eye.y + 9} ${eye.x + 9} ${eye.y - 1}`}
                    stroke={ink.pupil}
                    strokeWidth={4.5}
                    strokeLinecap="round"
                    fill="none"
                  />
                ) : expression === "storm" ? (
                  <Path
                    d={`M ${eye.x - 7} ${eye.y - 7} L ${eye.x + 7} ${eye.y + 7} M ${eye.x + 7} ${eye.y - 7} L ${eye.x - 7} ${eye.y + 7}`}
                    stroke={ink.pupil}
                    strokeWidth={4.5}
                    strokeLinecap="round"
                  />
                ) : !hasAnimatedPupil ? (
                  <Circle cx={eye.x + 3} cy={eye.y + 2} r={10.5} fill={ink.pupil} />
                ) : null}
              </>
            )}
          </G>
        ) : null}
      </Svg>
      {/* Animated blinking & pupil-glancing overlay on open hero digits (Mobbin video 00:15–00:19) */}
      {hasAnimatedPupil ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: eyeLeft + 3 * k,
            top: eyeTop + 2 * k,
            width: eyeBox,
            height: eyeBox,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <AmbientEyePulse delayMs={0}>
            <View
              style={{
                width: Math.max(6, Math.round(21 * k)),
                height: Math.max(6, Math.round(21 * k)),
                borderRadius: Math.max(3, Math.round(11 * k)),
                backgroundColor: ink.pupil,
              }}
            />
          </AmbientEyePulse>
        </View>
      ) : null}
    </View>
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
      {/* Video 00:08, 00:27–00:29: crisp white upper hemisphere on the Sun Monster */}
      <Path d="M 26 44 A 24 24 0 0 1 74 44 Z" fill={ink.glint} />
      {/* Cute Monsters face on the golden lower hemisphere: playful ✕ ◡ ✕ */}
      <Path
        d="M 38 49 L 44 55 M 44 49 L 38 55 M 56 49 L 62 55 M 62 49 L 56 55"
        stroke={ink.inkBlue}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <Path
        d="M 46 56 Q 50 61 54 56"
        stroke={ink.knotRed}
        strokeWidth={3.5}
        strokeLinecap="round"
        fill="none"
      />
      <Circle cx={67} cy={63} r={6} fill={ink.knotOrange} />
      <Ellipse cx={42} cy={35} rx={7} ry={4.5} fill={ink.glint} opacity={0.5} />
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
  const main = tone === "night" ? ink.teal : tone === "snow" || tone === "storm" ? ink.glint : ink.blue;
  const outline = tone === "snow" ? ink.blue : ink.inkBlue;
  const shade = tone === "day" ? ink.teal : tone === "snow" ? ink.blue : tone === "night" ? ink.blue : ink.purple;
  return (
    <>
      <G fill={outline} stroke={outline} strokeWidth={8}>
        <CloudBody fill={outline} />
      </G>
      <CloudBody fill={main} />
      {/* Multi-layered puffy cloud bubbles (from Not Boring Monsters product renders) */}
      <Circle cx={14} cy={46} r={9} fill={main} />
      <Circle cx={88} cy={42} r={10} fill={main} />
      <Circle cx={95} cy={28} r={4.5} fill={main} />
      <Circle cx={10} cy={30} r={3.5} fill={main} />
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
        <View testID="wx-icon-partly" style={{ width: size, height: size * 0.78, position: "relative" }}>
          {/* Back layer: Two-tone Sun Monster sphere + wind streaks (Mobbin video 00:08, 00:14–00:17, 00:21–00:23) */}
          <Svg width={size} height={size * 0.78} viewBox="0 0 120 94" style={StyleSheet.absoluteFill}>
            <Circle cx={58} cy={44} r={34} fill={ink.orange} />
            <Path d="M 24 42 A 34 34 0 0 1 92 42 Z" fill={ink.glint} />
            {/* Cute Monsters face: ✕ ◡ ✕ */}
            <Path
              d="M 44 47 L 50 53 M 50 47 L 44 53 M 66 47 L 72 53 M 72 47 L 66 53"
              stroke={ink.inkBlue}
              strokeWidth={3.2}
              strokeLinecap="round"
            />
            <Path
              d="M 54 54 Q 58 60 62 54"
              stroke={ink.red}
              strokeWidth={3.5}
              strokeLinecap="round"
              fill="none"
            />
            {/* Thin curved blue wind arcs across the white dome */}
            <Path d="M 38 18 Q 58 14 78 20 M 46 25 Q 62 22 76 26" stroke={ink.blue} strokeWidth={2} strokeLinecap="round" fill="none" />
          </Svg>
          {/* Drifting foreground royal-blue cloud bank */}
          <AmbientCloudDrift distance={4.5} duration={4600}>
            <Svg width={size} height={size * 0.78} viewBox="0 0 120 94">
              <Circle cx={20} cy={62} r={12} fill={ink.blue} />
              <Circle cx={38} cy={52} r={16} fill={ink.blue} />
              <Circle cx={58} cy={58} r={15} fill={ink.blue} />
              <Circle cx={80} cy={46} r={20} fill={ink.blue} />
              <Circle cx={98} cy={60} r={14} fill={ink.blue} />
              <Rect x={16} y={56} width={92} height={18} rx={9} fill={ink.blue} />
            </Svg>
          </AmbientCloudDrift>
          {/* Counter-drifting floating cloud bubbles & wind swoosh */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <AmbientCloudDrift reverse distance={3.5} duration={3600}>
              <Svg width={size} height={size * 0.78} viewBox="0 0 120 94">
                <Path d="M 10 34 Q 14 26 20 24" stroke={ink.blue} strokeWidth={2.5} strokeLinecap="round" fill="none" />
                <Circle cx={14} cy={44} r={5} fill={ink.blue} />
                <Circle cx={106} cy={44} r={6} fill={ink.blue} />
                <Circle cx={96} cy={30} r={3.5} fill={ink.blue} />
              </Svg>
            </AmbientCloudDrift>
          </View>
        </View>
      );
    case "partly-night":
      return (
        <View testID="wx-icon-partly-night" style={{ width: size, height: size * 0.78, position: "relative" }}>
          {/* Back layer: Two-tone Moon sphere with crisp white crescent rim (Mobbin video 00:18–00:20) */}
          <Svg width={size} height={size * 0.78} viewBox="0 0 120 94" style={StyleSheet.absoluteFill}>
            <Circle cx={58} cy={44} r={34} fill={ink.glint} />
            <Path
              d="M 44 12 A 34 34 0 1 0 66 76 A 30 30 0 1 1 44 12 Z"
              fill={ink.blue}
              opacity={0.92}
            />
            <Circle cx={68} cy={38} r={2.8} fill={ink.pupil} />
            <Circle cx={78} cy={38} r={2.8} fill={ink.pupil} />
          </Svg>
          {/* Drifting foreground turquoise/cyan billowy cloud puffs */}
          <AmbientCloudDrift distance={4.5} duration={4800}>
            <Svg width={size} height={size * 0.78} viewBox="0 0 120 94">
              <Circle cx={24} cy={62} r={12} fill={ink.blue} />
              <Circle cx={38} cy={46} r={18} fill={ink.teal} />
              <Circle cx={64} cy={52} r={20} fill={ink.teal} />
              <Circle cx={88} cy={50} r={17} fill={ink.teal} />
              <Circle cx={102} cy={64} r={11} fill={ink.teal} />
              <Rect x={20} y={54} width={86} height={20} rx={10} fill={ink.teal} />
            </Svg>
          </AmbientCloudDrift>
          {/* Counter-drifting floating cloud orbs */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <AmbientCloudDrift reverse distance={3.5} duration={3600}>
              <Svg width={size} height={size * 0.78} viewBox="0 0 120 94">
                <Circle cx={14} cy={48} r={6} fill={ink.blue} />
                <Circle cx={24} cy={34} r={4.5} fill={ink.teal} />
                <Circle cx={106} cy={42} r={7} fill={ink.teal} />
                <Circle cx={96} cy={28} r={3.5} fill={ink.teal} />
              </Svg>
            </AmbientCloudDrift>
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

// ─── MoonDisc — phase-lit limb on the royal-blue Moon sphere (Mobbin video 00:37–00:40) ───

export function MoonDisc({ phase, size }: { phase: number; size: number }) {
  const ink = useMonsterInk();
  return (
    <Svg testID="wx-moon-disc" width={size} height={size} viewBox="0 0 200 200">
      <Circle cx={100} cy={100} r={92} fill={ink.inkBlue} />
      <Circle cx={100} cy={100} r={88} fill={ink.blue} />
      <G transform="translate(100,100)">
        <Path d={moonLitPath(phase, 88)} fill={ink.glint} />
      </G>
      <Circle cx={136} cy={66} r={10} fill={ink.glint} opacity={0.28} />
    </Svg>
  );
}

/**
 * 3D Air Anemometer & Weathervane Monster (Mobbin video 00:33–00:36):
 * vertical cyan mast, spinning purple 3-cup anemometer rotor at top,
 * royal-blue orbital ring, and coral-pink 'N' arrow + polygonal tail fin.
 */
export function AirVaneMonster({ size = 140 }: { size?: number }) {
  const ink = useMonsterInk();
  return (
    <View testID="wx-air-vane" style={{ width: size, height: size, position: "relative" }}>
      {/* Vertical cyan mast */}
      <Svg width={size} height={size} viewBox="0 0 160 160" style={StyleSheet.absoluteFill}>
        <Line x1={80} y1={16} x2={80} y2={148} stroke={ink.teal} strokeWidth={5} strokeLinecap="round" />
      </Svg>
      {/* Top spinning purple anemometer cups */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <AmbientCloudDrift distance={5} duration={2200}>
          <Svg width={size} height={size} viewBox="0 0 160 160">
            <Line x1={54} y1={36} x2={98} y2={36} stroke={ink.purple} strokeWidth={3.5} strokeLinecap="round" />
            <Circle cx={52} cy={36} r={11} fill={ink.purple} />
            <Path d="M 94 22 C 106 22 108 50 94 50 L 86 36 Z" fill={ink.purple} />
          </Svg>
        </AmbientCloudDrift>
      </View>
      {/* Swaying directional N arrow, tail fin & orbital ring */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <AmbientVaneSway>
          <Svg width={size} height={size} viewBox="0 0 160 160">
            {/* Back half of orbital ring */}
            <Path d="M 14 96 A 66 15 0 0 1 146 96" stroke={ink.blue} strokeWidth={3.5} fill="none" />
            {/* Horizontal vane cross-bar */}
            <Line x1={30} y1={94} x2={126} y2={94} stroke={ink.blue} strokeWidth={4} strokeLinecap="round" />
            {/* Left coral-pink arrowhead + 'N' block */}
            <Path d="M 22 94 L 54 74 V 114 Z" fill={ink.red} />
            <Path
              d="M 52 56 V 88 H 58 V 68 L 66 88 H 72 V 56 H 66 V 74 L 58 56 Z"
              fill={ink.red}
              opacity={0.85}
            />
            {/* Right coral-pink hexagonal tail fin */}
            <Path d="M 98 70 H 126 L 136 94 L 126 118 H 98 L 90 94 Z" fill={ink.red} />
            {/* Front half of orbital ring */}
            <Path d="M 14 96 A 66 15 0 0 0 146 96" stroke={ink.blue} strokeWidth={4} fill="none" />
          </Svg>
        </AmbientVaneSway>
      </View>
    </View>
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

// ─── NightMoon — the moon, placed by the CARD's box ────────────────
//
// The reference capture (1080×1920, wall mode) pins the disc: its centre sits
// just OFF the card's right edge (101.8% of the card's width) and 23.9% down
// the card, with a radius of 12.1% of the card's height. The web derives
// that from its 320×180 poster plane sliced to the card, so it slides with the
// card's aspect — on a short, wide wall cell the lit limb landed under the
// Details chip and painted over it. Placing the disc from the card's own box
// keeps the reference's geometry at ANY cell height.
//
// The scene layer stays UNDER the content layer (the chips paint over the
// disc, as in the web), so the disc never eats the affordance.

/** The disc's centre, as a fraction of the card's width / height. */
const MOON_CX = 1.018;
const MOON_CY = 0.239;
/** The disc's radius, as a fraction of the card's height. */
const MOON_R = 0.121;
/** The disc is 44 of the 48-unit viewBox — the box is a touch bigger. */
const MOON_BOX = (MOON_R * 2) * (48 / 44);

export function NightMoon({ width, height, phase }: { width: number; height: number; phase: number }) {
  if (width <= 0 || height <= 0) return null;
  const box = MOON_BOX * height;
  return (
    <View
      testID="wx-night-moon"
      pointerEvents="none"
      style={{
        position: "absolute",
        left: width * MOON_CX - box / 2,
        top: height * MOON_CY - box / 2,
        width: box,
        height: box,
      }}
    >
      <SceneMoon phase={phase} size={box} />
    </View>
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
    const lamplit = mix(ink.purple, ink.blue, 50);
    const top = mix(mix(ink.starCream, lamplit, 15), ink.knotOrange, 95);
    const bottom = mix(mix(ink.glint, lamplit, 19), ink.knotOrange, 95);
    return [top, bottom];
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
  // storm — flat deep violet-slate
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
 *
 * The night moon is NOT here: it moved to {@link NightMoon}, which places the
 * disc from the CARD's own box instead of the poster plane. The slice
 * geometry moves the disc with the card's aspect, and on a wide, short wall
 * cell that dragged the lit limb straight under the Details chip. The
 * reference capture pins the disc where it belongs instead.
 */
export function PosterAccents({ scene }: { scene: SceneKey }) {
  const ink = useMonsterInk();
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

// ─── GlassChip — the ONE glass recipe (web GLASS) ──────────────────
//
// Home-ai wx-tokens.ts:57 — "Monster beast-glass": a 135° white gradient
// (26% → 8%) over a white hairline, PLUS the chip's specular top-half
// sheen (`before:from-white/40 before:to-transparent before:to-50%`) and
// the backdrop's saturation (`backdrop-saturate-[1.6]`).
//
// The sheen is the half that was missing here: without it the chip is a
// 17%-white wash that barely lifts the sky (and the corner-to-corner
// gradient leaves the pill's far corner DARKER than the field), so the
// chip reads as a hole cut into the poster instead of a pane of glass
// floating above it. With it the pane measures ≈ +40 dL over the sky —
// the web's own lift.
//
// The saturation is the other half: the reference's pane over the lamplit
// sky measures +38/+39/+37 — a NEUTRAL lift, which a white overlay alone
// cannot produce (a white overlay lifts blue far less than red). It is the
// backdrop's chroma pushed to 1.6×, and the native reproduces it by
// painting the saturated sky under the pane instead of the raw sky.

/** The web's glass stops (wx-tokens.ts GLASS). */
const GLASS_TOP = 26;
const GLASS_BOTTOM = 8;
const GLASS_SHEEN = 40;
/** The web's GLASS_NIGHT lift (+0.10 on both stops) — the storm/night skin. */
const GLASS_NIGHT_TOP = 36;
const GLASS_NIGHT_BOTTOM = 18;
/** The web's `backdrop-saturate-[1.6]`. */
const GLASS_SATURATE = 1.6;
/**
 * How much of the saturated backdrop the pane carries (the rest shows through).
 */
const GLASS_BACKDROP = 95;
/**
 * The backdrop the pane saturates is the sky PLUS the card's own sheen and
 * scrim bloom (both white); the native approximates that lift with a flat
 * white wash on the sky before saturating it. 6% is the value that lands the
 * pane on the reference capture's measured interior.
 */
const GLASS_BACKDROP_LIFT = 6;

/**
 * The CSS `saturate(k)` filter over a backdrop: the chroma around the
 * luminance is scaled by k.
 *
 * The reference's pane measures +38/+39/+37 over the lamplit sky — a NEUTRAL
 * lift, which a white overlay alone cannot produce (white lifts blue far
 * less than red). The neutrality IS the saturation: the sky's chroma is
 * pushed to 1.6×, so the pane over the sky lands on a lavender the native
 * can reproduce only by painting the saturated sky underneath itself.
 */
export function saturateColor(color: string, k: number): string {
  const c = parseColor(color);
  if (!c) return color;
  const lum = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(lum + k * (v - lum))));
  return toCss({ r: ch(c.r), g: ch(c.g), b: ch(c.b), a: c.a });
}

export interface GlassChipProps {
  children: React.ReactNode;
  /** The chip's own box: radius, hairline, size. */
  style?: ViewStyle;
  /** The chip's CONTENT box: padding, gap, alignment. */
  contentStyle?: ViewStyle;
  /** The storm/night skin's stronger lift (web GLASS_NIGHT). */
  night?: boolean;
  /** High contrast: the pane lifts a touch further so the hairline survives. */
  boost?: boolean;
  /** The sky behind the chip — the pane saturates it (web backdrop-saturate). */
  backdropTop?: string;
  backdropBottom?: string;
  testID?: string;
}

export function GlassChip({
  children,
  style,
  contentStyle,
  night = false,
  boost = false,
  backdropTop,
  backdropBottom,
  testID,
}: GlassChipProps) {
  const ink = useMonsterInk();
  const white = ink.glint;
  const top = night ? GLASS_NIGHT_TOP : GLASS_TOP + (boost ? 3 : 0);
  const bottom = night ? GLASS_NIGHT_BOTTOM : GLASS_BOTTOM + (boost ? 1 : 0);
  const base: [string, string] = [mix(white, "transparent", top), mix(white, "transparent", bottom)];
  // The sheen fades to (almost) nothing at the chip's half height, exactly
  // like the web's `to-50%` stop — it never reaches zero alpha, so the
  // native gradient never fades through a grey.
  const sheen: [string, string] = [mix(white, "transparent", GLASS_SHEEN), mix(white, "transparent", 0.5)];
  const backdrop: [string, string] | null =
    backdropTop && backdropBottom
      ? [
          mix(
            saturateColor(mix(white, backdropTop, GLASS_BACKDROP_LIFT), GLASS_SATURATE),
            "transparent",
            GLASS_BACKDROP
          ),
          mix(
            saturateColor(mix(white, backdropBottom, GLASS_BACKDROP_LIFT), GLASS_SATURATE),
            "transparent",
            GLASS_BACKDROP
          ),
        ]
      : null;
  return (
    <View
      testID={testID}
      style={[
        {
          borderRadius: RADII.full,
          borderWidth: 1,
          borderColor: mix(white, "transparent", night ? 40 : 28),
          // The web's inset top highlight (`inset 0 1px 0 rgba(255,255,255,.52)`).
          borderTopColor: mix(white, "transparent", night ? 60 : 52),
          overflow: "hidden",
        },
        style,
      ]}
    >
      {backdrop ? (
        <LinearGradient
          colors={backdrop}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}
      <LinearGradient
        colors={base}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <LinearGradient
        colors={sheen}
        locations={[0, 0.5]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={[{ flexDirection: "row", alignItems: "center" }, contentStyle]}>{children}</View>
    </View>
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
  /** The card's measured box — the night moon is placed from it. */
  cardW?: number;
  cardH?: number;
}

/**
 * The whole poster atmosphere in one absolutely-filled layer: the star field
 * and the moon character at night, the soft cloud puffs behind the hero, and
 * the precipitation when the sky is actually wet.
 */
export function WeatherScene({ code, isDay, precipPct, moonPhase, cardW = 0, cardH = 0 }: WeatherSceneProps) {
  const ink = useMonsterInk();
  const scene = sceneFor(code, isDay);
  const night = scene === "night";
  const clear = code === "clear" || code === "night";
  const partly = code === "partly" || code === "partly-night";
  const tone: SceneTone = night ? "night" : clear ? "poster" : "day";
  // The web's scene layers paint a cloud at NIGHT too (the reference's
  // lamplit card carries one soft puff along its left edge, behind the
  // digits) — a clear sky only drops the puff by day.
  const puffs = night ? 1 : clear ? 0 : partly ? 1 : 2;

  return (
    <View testID="wx-scene" style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* web order: poster accents → stars → night moon → cloud puffs → precipitation */}
      <PosterAccents scene={scene} />
      {night ? <StarField color={ink.glint} /> : null}
      {night ? <NightMoon width={cardW} height={cardH} phase={moonPhase} /> : null}
      {puffs > 0 ? (
        <View style={{ position: "absolute", left: pct(-4), top: pct(night ? 10 : 13), width: pct(38), height: pct(23), opacity: night ? 0.24 : partly ? 0.34 : 0.44, transform: [{ rotate: "-6deg" }] }}>
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
