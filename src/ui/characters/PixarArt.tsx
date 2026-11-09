import React from "react";
import {
  Circle,
  Ellipse,
  G,
  Line,
  Path,
  Polygon,
  Rect,
} from "react-native-svg";
import {
  CHARACTER_CLAY_PALETTES,
  HOME_WIDGET_ICON_SHADOW,
  HOME_WIDGET_ICON_SHINE,
  type CharacterClayPalette,
} from "../../theme/materials";
import { mix } from "../../theme/mix";

export type PixarMotif = "rocket" | "sheriff" | "robot" | "sparkle";

/**
 * Buzz Lightyear (`rocket`):
 * 3D claymorphic Space Ranger bust with crystal visor dome, purple wing tips,
 * white & lime-green Star Command chest armor, royal-purple hood, sculpted
 * peach-tan heroic jaw with cleft chin swirl, and raised eyebrow grin.
 */
export function BuzzArt({
  p = CHARACTER_CLAY_PALETTES.rocket,
}: {
  p?: CharacterClayPalette;
}) {
  const armorWhite = mix(HOME_WIDGET_ICON_SHINE, p.hi, 12);
  const armorShade = mix(HOME_WIDGET_ICON_SHINE, p.secLo, 18);

  return (
    <G>
      {/* Ambient Space Command halo & ground drop shadow */}
      <Circle cx="50" cy="48" r="41" fill={p.glow} opacity={0.18} />
      <Ellipse
        cx="50"
        cy="88"
        rx="34"
        ry="7"
        fill={HOME_WIDGET_ICON_SHADOW}
        opacity={0.28}
      />

      {/* Left & Right retractable purple wing tips peeking behind shoulders */}
      <Polygon
        points="6,56 22,50 22,68 9,70"
        fill={p.secLo}
        stroke={p.ink}
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <Polygon points="8,57 20,52 20,63 10,65" fill={p.secMid} />
      <Polygon points="8,57 14,54.5 14,64 9.5,64.8" fill={p.detail} />
      <Polygon
        points="94,56 78,50 78,68 91,70"
        fill={p.secLo}
        stroke={p.ink}
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <Polygon points="92,57 80,52 80,63 90,65" fill={p.secMid} />
      <Polygon points="92,57 86,54.5 86,64 90.5,64.8" fill={p.detail} />

      {/* Outer crystal Space Ranger bubble helmet dome (back fill) */}
      <Circle
        cx="50"
        cy="42"
        r="34"
        fill={p.blush}
        opacity={0.14}
        stroke={p.blush}
        strokeWidth="1.8"
      />
      <Path
        d="M18 42 A32 32 0 0 1 82 42"
        stroke={HOME_WIDGET_ICON_SHINE}
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
        opacity={0.55}
      />

      {/* White & lime-green 3D Star Command chest armor */}
      <Path
        d="M15 76 C15 60 28 54 50 54 C72 54 85 60 85 76 L82 88 C68 93 32 93 18 88 Z"
        fill={armorShade}
        stroke={p.ink}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <Path
        d="M17 75 C17 61 29 55.5 50 55.5 C71 55.5 83 61 83 75 L80 86 C66 90.5 34 90.5 20 86 Z"
        fill={armorWhite}
      />

      {/* Lime-green sculpted shoulder & chest yoke plates */}
      <Path
        d="M17 73 C18 61 29 55.5 50 55.5 C71 55.5 82 61 83 73 C74 76 63 78 50 78 C37 78 26 76 17 73 Z"
        fill={p.lo}
        stroke={p.ink}
        strokeWidth="2"
      />
      <Path
        d="M19 71 C20 61.5 30 56.5 50 56.5 C70 56.5 80 61.5 81 71 C72 74 62 75.5 50 75.5 C38 75.5 28 74 19 71 Z"
        fill={p.mid}
      />
      <Path
        d="M24 62 C33 58 67 58 76 62 C68 64.5 32 64.5 24 62 Z"
        fill={p.hi}
        opacity={0.88}
      />

      {/* Purple neck collar ring & center chest trapezoid */}
      <Ellipse
        cx="50"
        cy="58"
        rx="18.5"
        ry="5.5"
        fill={p.secLo}
        stroke={p.ink}
        strokeWidth="2"
      />
      <Ellipse cx="50" cy="57.2" rx="16.5" ry="4.2" fill={p.secMid} />
      <Polygon
        points="44,63 56,63 53.5,87 46.5,87"
        fill={armorShade}
        stroke={p.ink}
        strokeWidth="1.6"
      />

      {/* Left chest blue Star Command insignia & red Laser button */}
      <Circle
        cx="31"
        cy="69"
        r="5.2"
        fill={p.eye}
        stroke={p.ink}
        strokeWidth="1.5"
      />
      <Polygon
        points="31,65 32.5,68 35.5,69 32.5,70.5 31,73.5 29.5,70.5 26.5,69 29.5,68"
        fill={HOME_WIDGET_ICON_SHINE}
      />
      <Circle
        cx="33"
        cy="81"
        r="3.2"
        fill={p.detail}
        stroke={p.ink}
        strokeWidth="1.4"
      />

      {/* Right chest oval voice-sampler buttons (red, green, blue) */}
      <Ellipse
        cx="64"
        cy="67.5"
        rx="3.8"
        ry="2.1"
        fill={p.detail}
        stroke={p.ink}
        strokeWidth="1.3"
      />
      <Ellipse
        cx="66.5"
        cy="73"
        rx="3.8"
        ry="2.1"
        fill={p.mid}
        stroke={p.ink}
        strokeWidth="1.3"
      />
      <Ellipse
        cx="64.5"
        cy="78.5"
        rx="3.8"
        ry="2.1"
        fill={p.blush}
        stroke={p.ink}
        strokeWidth="1.3"
      />

      {/* Sculpted royal-purple Space Ranger cowl / hood */}
      <Path
        d="M27 38 C27 20 36 13 50 13 C64 13 73 20 73 38 C73 51 64 59 50 59 C36 59 27 51 27 38 Z"
        fill={p.secLo}
        stroke={p.ink}
        strokeWidth="2.4"
      />
      <Path
        d="M29 37 C29 21 37 14.5 50 14.5 C63 14.5 71 21 71 37 C71 49.5 63 57 50 57 C37 57 29 49.5 29 37 Z"
        fill={p.secMid}
      />
      <Path
        d="M35 20.5 C42 16 58 16 65 20.5 C59 18.5 41 18.5 35 20.5 Z"
        fill={p.secHi}
        opacity={0.9}
      />

      {/* Buzz's strong 3D peach-tan face & heroic square jawline */}
      <Path
        d="M32.5 36 C32.5 25 39 20.5 50 20.5 C61 20.5 67.5 25 67.5 36 C67.5 48.5 61.5 55.5 50 55.5 C38.5 55.5 32.5 48.5 32.5 36 Z"
        fill={p.skinLo}
        stroke={p.ink}
        strokeWidth="2"
      />
      <Path
        d="M34 35.5 C34 26 40 22 50 22 C60 22 66 26 66 35.5 C66 47 60.5 53.8 50 53.8 C39.5 53.8 34 47 34 35.5 Z"
        fill={p.skinMid}
      />
      <Path
        d="M38 26.5 C43 23.5 57 23.5 62 26.5 C57 25.2 43 25.2 38 26.5 Z"
        fill={p.skinHi}
        opacity={0.85}
      />
      {/* Rosy cheek warmth */}
      <Ellipse cx="38.5" cy="41.5" rx="3.8" ry="2.2" fill={p.detail} opacity={0.22} />
      <Ellipse cx="61.5" cy="41.5" rx="3.8" ry="2.2" fill={p.detail} opacity={0.22} />

      {/* Expressive Space Ranger eyebrows (one arched heroically) */}
      <Path
        d="M36.5 30.5 Q41.5 28.5 46 30.5"
        stroke={p.ink}
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M54 29.5 Q59 26.2 63.8 29.2"
        stroke={p.ink}
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />

      {/* Left & Right 3D eyes with bright blue irises and dual catchlights */}
      <Ellipse
        cx="41.5"
        cy="35.5"
        rx="4.5"
        ry="4.8"
        fill={HOME_WIDGET_ICON_SHINE}
        stroke={p.ink}
        strokeWidth="1.6"
      />
      <Circle cx="42" cy="35.8" r="2.9" fill={p.eye} />
      <Circle cx="42" cy="35.8" r="1.5" fill={p.ink} />
      <Circle cx="40.8" cy="34.4" r="1.1" fill={HOME_WIDGET_ICON_SHINE} />
      <Circle cx="43.1" cy="36.9" r="0.55" fill={HOME_WIDGET_ICON_SHINE} />

      <Ellipse
        cx="58.5"
        cy="35.5"
        rx="4.5"
        ry="4.8"
        fill={HOME_WIDGET_ICON_SHINE}
        stroke={p.ink}
        strokeWidth="1.6"
      />
      <Circle cx="58" cy="35.8" r="2.9" fill={p.eye} />
      <Circle cx="58" cy="35.8" r="1.5" fill={p.ink} />
      <Circle cx="56.8" cy="34.4" r="1.1" fill={HOME_WIDGET_ICON_SHINE} />
      <Circle cx="59.1" cy="36.9" r="0.55" fill={HOME_WIDGET_ICON_SHINE} />

      {/* Sculpted 3D nose */}
      <Path
        d="M48.5 36.5 L47.2 41.5 Q50 42.8 52.8 41.5 Z"
        fill={p.skinLo}
      />
      <Circle cx="49.5" cy="40.2" r="1.1" fill={p.skinHi} opacity={0.85} />

      {/* Confident pearly-white Space Ranger grin */}
      <Path
        d="M41.5 44.5 Q50 49.5 59 44 C58.2 48.8 54.5 50.5 50 50.5 C45.5 50.5 42.2 48.5 41.5 44.5 Z"
        fill={HOME_WIDGET_ICON_SHINE}
        stroke={p.ink}
        strokeWidth="1.7"
        strokeLinejoin="round"
      />

      {/* Iconic Buzz Lightyear cleft chin swirl */}
      <Path
        d="M48.5 52.5 C49.2 51.2 51.4 51.2 51.6 52.8 C51.8 54.2 49.5 54.5 49.2 53.4"
        stroke={p.ink}
        strokeWidth="1.7"
        strokeLinecap="round"
        fill="none"
      />

      {/* Curved glass helmet dome foreground specular highlights */}
      <Path
        d="M23 28 A29 29 0 0 1 45 11.5"
        stroke={HOME_WIDGET_ICON_SHINE}
        strokeWidth="3.2"
        strokeLinecap="round"
        fill="none"
        opacity={0.72}
      />
      <Circle
        cx="72"
        cy="25"
        r="2.6"
        fill={HOME_WIDGET_ICON_SHINE}
        opacity={0.65}
      />
    </G>
  );
}

/**
 * Sheriff Woody (`sheriff`):
 * 3D claymorphic cowboy bust with wide-brimmed saddle-leather hat, braided band,
 * chestnut sideburns, warm peach face, crimson knotted bandana, cow-print vest,
 * yellow plaid shirt, and gleaming 5-point gold Sheriff Star badge.
 */
export function WoodyArt({
  p = CHARACTER_CLAY_PALETTES.sheriff,
}: {
  p?: CharacterClayPalette;
}) {
  const vestCream = mix(HOME_WIDGET_ICON_SHINE, p.skinHi, 18);

  return (
    <G>
      {/* Warm frontier sun halo & ground shadow */}
      <Circle cx="50" cy="50" r="41" fill={p.glow} opacity={0.18} />
      <Ellipse
        cx="50"
        cy="89"
        rx="32"
        ry="6.5"
        fill={HOME_WIDGET_ICON_SHADOW}
        opacity={0.28}
      />

      {/* Yellow western plaid shirt & cow-print vest shoulders */}
      <Path
        d="M20 87 C21 71 31 64 50 64 C69 64 79 71 80 87 C66 92 34 92 20 87 Z"
        fill={p.detail}
        stroke={p.ink}
        strokeWidth="2.3"
        strokeLinejoin="round"
      />
      {/* Red plaid shirt grid lines */}
      <Line x1="42" y1="68" x2="42" y2="90" stroke={p.secMid} strokeWidth="1.4" opacity={0.55} />
      <Line x1="58" y1="68" x2="58" y2="90" stroke={p.secMid} strokeWidth="1.4" opacity={0.55} />
      <Line x1="26" y1="79" x2="74" y2="79" stroke={p.secMid} strokeWidth="1.4" opacity={0.55} />

      {/* Left & Right cow-print vest panels */}
      <Path
        d="M20 87 C21 73 28 66.5 39 65.5 L41 89.5 C32 89.5 25 88.5 20 87 Z"
        fill={vestCream}
        stroke={p.ink}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <Path
        d="M80 87 C79 73 72 66.5 61 65.5 L59 89.5 C68 89.5 75 88.5 80 87 Z"
        fill={vestCream}
        stroke={p.ink}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Cow-print black spots */}
      <Ellipse cx="29" cy="75" rx="4.2" ry="2.8" fill={p.ink} />
      <Circle cx="35" cy="83" r="2.6" fill={p.ink} />
      <Ellipse cx="71" cy="76" rx="4" ry="2.7" fill={p.ink} />
      <Circle cx="64.5" cy="83.5" r="2.5" fill={p.ink} />

      {/* Bright crimson knotted cowboy bandana neckerchief */}
      <Path
        d="M31 61 C36 58 64 58 69 61 L58 76 L50 81 L42 76 Z"
        fill={p.secLo}
        stroke={p.ink}
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <Path
        d="M33 61.5 C38 59 62 59 67 61.5 L56.5 74.5 L50 78.5 L43.5 74.5 Z"
        fill={p.secMid}
      />
      <Circle
        cx="50"
        cy="66.5"
        r="5.2"
        fill={p.secLo}
        stroke={p.ink}
        strokeWidth="1.8"
      />
      <Circle cx="50" cy="65.8" r="3.8" fill={p.secHi} opacity={0.85} />

      {/* Gleaming 5-point gold Sheriff Star badge with ball tips on vest */}
      <Polygon
        points="70,71 71.8,74.8 76,75.2 72.8,78 73.8,82 70,79.8 66.2,82 67.2,78 64,75.2 68.2,74.8"
        fill={p.detail}
        stroke={p.ink}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <Circle cx="70" cy="70.6" r="1.1" fill={p.detail} stroke={p.ink} strokeWidth="0.9" />
      <Circle cx="76.3" cy="75" r="1.1" fill={p.detail} stroke={p.ink} strokeWidth="0.9" />
      <Circle cx="74" cy="82.3" r="1.1" fill={p.detail} stroke={p.ink} strokeWidth="0.9" />
      <Circle cx="66" cy="82.3" r="1.1" fill={p.detail} stroke={p.ink} strokeWidth="0.9" />
      <Circle cx="63.7" cy="75" r="1.1" fill={p.detail} stroke={p.ink} strokeWidth="0.9" />
      <Circle cx="69.2" cy="75.8" r="1.3" fill={HOME_WIDGET_ICON_SHINE} opacity={0.85} />

      {/* Sculpted ears & warm peach 3D face */}
      <Ellipse
        cx="28.5"
        cy="45"
        rx="4.5"
        ry="6"
        fill={p.skinLo}
        stroke={p.ink}
        strokeWidth="2"
      />
      <Ellipse
        cx="71.5"
        cy="45"
        rx="4.5"
        ry="6"
        fill={p.skinLo}
        stroke={p.ink}
        strokeWidth="2"
      />
      <Path
        d="M31 36 C31 26 39 22 50 22 C61 22 69 26 69 36 C69 51 61 62 50 62 C39 62 31 51 31 36 Z"
        fill={p.skinLo}
        stroke={p.ink}
        strokeWidth="2.3"
      />
      <Path
        d="M32.8 36 C32.8 27.5 40 23.5 50 23.5 C60 23.5 67.2 27.5 67.2 36 C67.2 49.5 60 60 50 60 C40 60 32.8 49.5 32.8 36 Z"
        fill={p.skinMid}
      />
      <Path
        d="M38 30 C44 27.5 56 27.5 62 30 C56 29 44 29 38 30 Z"
        fill={p.skinHi}
        opacity={0.85}
      />

      {/* Chestnut-brown sculpted hair & sideburns under hat */}
      <Path
        d="M30.5 32 C30.5 27 36 25 43 26.5 L34 39 L30.8 39 Z"
        fill={p.mid}
        stroke={p.ink}
        strokeWidth="1.6"
      />
      <Path
        d="M69.5 32 C69.5 27 64 25 57 26.5 L66 39 L69.2 39 Z"
        fill={p.mid}
        stroke={p.ink}
        strokeWidth="1.6"
      />

      {/* Rosy cowboy cheeks */}
      <Ellipse cx="37.5" cy="47.5" rx="4.2" ry="2.5" fill={p.blush} opacity={0.38} />
      <Ellipse cx="62.5" cy="47.5" rx="4.2" ry="2.5" fill={p.blush} opacity={0.38} />

      {/* Friendly arched eyebrows & warm brown eyes */}
      <Path
        d="M36.5 35.2 Q41.5 32.5 46 34.8"
        stroke={p.lo}
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M54 34.8 Q58.5 32.2 63.5 35.2"
        stroke={p.lo}
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
      />

      <Ellipse
        cx="41.5"
        cy="41"
        rx="4.4"
        ry="4.8"
        fill={HOME_WIDGET_ICON_SHINE}
        stroke={p.ink}
        strokeWidth="1.6"
      />
      <Circle cx="41.8" cy="41.2" r="2.9" fill={p.eye} />
      <Circle cx="41.8" cy="41.2" r="1.5" fill={p.ink} />
      <Circle cx="40.6" cy="39.8" r="1.1" fill={HOME_WIDGET_ICON_SHINE} />
      <Circle cx="42.9" cy="42.2" r="0.55" fill={HOME_WIDGET_ICON_SHINE} />

      <Ellipse
        cx="58.5"
        cy="41"
        rx="4.4"
        ry="4.8"
        fill={HOME_WIDGET_ICON_SHINE}
        stroke={p.ink}
        strokeWidth="1.6"
      />
      <Circle cx="58.2" cy="41.2" r="2.9" fill={p.eye} />
      <Circle cx="58.2" cy="41.2" r="1.5" fill={p.ink} />
      <Circle cx="57" cy="39.8" r="1.1" fill={HOME_WIDGET_ICON_SHINE} />
      <Circle cx="59.3" cy="42.2" r="0.55" fill={HOME_WIDGET_ICON_SHINE} />

      {/* Sculpted nose & cheerful wide cowboy smile */}
      <Path
        d="M48.5 41.5 L47 46.8 Q50 48.4 53 46.8 Z"
        fill={p.skinLo}
      />
      <Circle cx="49.6" cy="45.4" r="1.2" fill={p.skinHi} />
      <Path
        d="M40.5 50.2 Q50 56 59.5 50.2 C58.5 55.5 54.5 57.5 50 57.5 C45.5 57.5 41.5 55.5 40.5 50.2 Z"
        fill={HOME_WIDGET_ICON_SHINE}
        stroke={p.ink}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />

      {/* Iconic wide-brimmed 3D saddle-leather cowboy hat */}
      {/* Sculpted crown with center crease */}
      <Path
        d="M27 25 C28 11 36 7 43 10.5 Q50 13.5 57 10.5 C64 7 72 11 73 25 Z"
        fill={p.lo}
        stroke={p.ink}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <Path
        d="M29 24.5 C30 12.5 37 9 43.5 12 Q50 15 56.5 12 C63 9 70 12.5 71 24.5 Z"
        fill={p.mid}
      />
      <Path
        d="M33 15 C37 11.5 42 12 45 14 M55 14 C58 12 63 11.5 67 15"
        stroke={p.hi}
        strokeWidth="2.6"
        strokeLinecap="round"
        fill="none"
      />
      {/* Dark braided leather hatband */}
      <Path
        d="M26.5 23.5 Q50 27.5 73.5 23.5 L74 27.5 Q50 31.5 26 27.5 Z"
        fill={p.lo}
        stroke={p.ink}
        strokeWidth="1.8"
      />

      {/* Wide curved 3D cowboy hat brim with stitched rim dashes */}
      <Path
        d="M9 24 C16 33.5 33 35.5 50 35.5 C67 35.5 84 33.5 91 24 C84 18.5 73 22 50 23.5 C27 22 16 18.5 9 24 Z"
        fill={p.lo}
        stroke={p.ink}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <Path
        d="M12 24.2 C19 31.8 34 33.5 50 33.5 C66 33.5 81 31.8 88 24.2 C81 20.5 71 23 50 24.2 C29 23 19 20.5 12 24.2 Z"
        fill={p.mid}
      />
      <Path
        d="M18 26.5 Q50 33.5 82 26.5"
        stroke={p.hi}
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
        opacity={0.9}
      />
      <Path
        d="M16 24.8 Q50 31.8 84 24.8"
        stroke={p.skinHi}
        strokeWidth="1.3"
        strokeDasharray="3 3.5"
        strokeLinecap="round"
        fill="none"
        opacity={0.75}
      />
    </G>
  );
}

/**
 * WALL-E (`robot`):
 * 3D claymorphic robot with tilted twin binocular camera eyes, glowing sky-cyan
 * optical lenses, articulated neck, weathered ochre-gold compactor body, solar
 * charge bars, and green boot-plant sprout.
 */
export function WalleArt({
  p = CHARACTER_CLAY_PALETTES.robot,
}: {
  p?: CharacterClayPalette;
}) {
  return (
    <G>
      {/* Ambient cyan optical glow & ground shadow */}
      <Circle cx="50" cy="48" r="41" fill={p.glow} opacity={0.18} />
      <Ellipse
        cx="50"
        cy="89"
        rx="35"
        ry="6.5"
        fill={HOME_WIDGET_ICON_SHADOW}
        opacity={0.3}
      />

      {/* Left & Right heavy caterpillar treads */}
      <Rect
        x="12"
        y="65"
        width="11"
        height="22"
        rx="4"
        fill={p.secLo}
        stroke={p.ink}
        strokeWidth="2.2"
      />
      <Line x1="13.5" y1="71" x2="21.5" y2="71" stroke={p.ink} strokeWidth="2" />
      <Line x1="13.5" y1="76" x2="21.5" y2="76" stroke={p.ink} strokeWidth="2" />
      <Line x1="13.5" y1="81" x2="21.5" y2="81" stroke={p.ink} strokeWidth="2" />

      <Rect
        x="77"
        y="65"
        width="11"
        height="22"
        rx="4"
        fill={p.secLo}
        stroke={p.ink}
        strokeWidth="2.2"
      />
      <Line x1="78.5" y1="71" x2="86.5" y2="71" stroke={p.ink} strokeWidth="2" />
      <Line x1="78.5" y1="76" x2="86.5" y2="76" stroke={p.ink} strokeWidth="2" />
      <Line x1="78.5" y1="81" x2="86.5" y2="81" stroke={p.ink} strokeWidth="2" />

      {/* Weathered ochre-gold cubed compactor chest body */}
      <Rect
        x="21"
        y="55"
        width="58"
        height="32"
        rx="6"
        fill={p.lo}
        stroke={p.ink}
        strokeWidth="2.4"
      />
      <Rect x="23" y="57" width="54" height="27" rx="4.5" fill={p.mid} />
      <Rect x="25" y="58" width="50" height="4" rx="2" fill={p.hi} opacity={0.88} />

      {/* Metallic grey upper chest control plate */}
      <Rect
        x="25"
        y="60"
        width="50"
        height="11"
        rx="2.8"
        fill={p.secLo}
        stroke={p.ink}
        strokeWidth="1.8"
      />
      <Rect x="26.5" y="61.2" width="47" height="8.2" rx="2" fill={p.secMid} />
      {/* Red warning status indicator + golden solar charge level bars */}
      <Circle
        cx="33"
        cy="65.3"
        r="2.6"
        fill={p.blush}
        stroke={p.ink}
        strokeWidth="1.2"
      />
      <Circle cx="32.2" cy="64.5" r="0.8" fill={HOME_WIDGET_ICON_SHINE} />
      <Rect
        x="61"
        y="62.2"
        width="10"
        height="6.2"
        rx="1.2"
        fill={p.ink}
      />
      <Line x1="63" y1="63.8" x2="69" y2="63.8" stroke={p.hi} strokeWidth="1.3" />
      <Line x1="63" y1="65.5" x2="69" y2="65.5" stroke={p.hi} strokeWidth="1.3" />
      <Line x1="63" y1="67.2" x2="67" y2="67.2" stroke={p.detail} strokeWidth="1.3" />

      {/* Lower chest compactor door seam & WALL-E badge */}
      <Line x1="25" y1="76" x2="75" y2="76" stroke={p.lo} strokeWidth="1.8" />
      <Rect x="44" y="78.5" width="20" height="5.5" rx="1.5" fill={p.secHi} stroke={p.ink} strokeWidth="1.2" />
      <Circle cx="61" cy="81.2" r="1.9" fill={p.blush} />

      {/* Iconic green boot-plant sprout tucked at front left */}
      <Path
        d="M31 85 L31 76"
        stroke={p.detail}
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <Path
        d="M31 78 C25 76 24 71 29 72 C31 72.5 31 76 31 78 Z"
        fill={p.detail}
        stroke={p.ink}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <Path
        d="M31 76 C37 74 38 69 33 70 C31 70.5 31 74 31 76 Z"
        fill={p.hi}
        stroke={p.ink}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* Articulated mechanical neck post with servo rings */}
      <Rect
        x="44"
        y="40"
        width="12"
        height="17"
        rx="3"
        fill={p.secLo}
        stroke={p.ink}
        strokeWidth="2"
      />
      <Rect x="45.8" y="42" width="8.4" height="13" rx="2" fill={p.secMid} />
      <Line x1="44.5" y1="45.5" x2="55.5" y2="45.5" stroke={p.ink} strokeWidth="1.8" />
      <Line x1="44.5" y1="50.5" x2="55.5" y2="50.5" stroke={p.ink} strokeWidth="1.8" />

      {/* Twin tilted binocular camera eyes (sweet curious tilt) */}
      {/* Left binocular housing (tilted down-left) */}
      <Path
        d="M14 29 C14 20 22 16 33 17 L48 20 C49.5 24 49.5 34 47 39 L31 42 C20 43 14 38 14 29 Z"
        fill={p.secLo}
        stroke={p.ink}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <Path
        d="M16 29 C16 21.5 23 18 33 19 L46.5 21.5 C47.8 25 47.8 33.5 45.5 37.5 L31 40 C21.5 41 16 36.5 16 29 Z"
        fill={p.secMid}
      />
      <Path
        d="M20 22 L44 23.5"
        stroke={p.secHi}
        strokeWidth="2.4"
        strokeLinecap="round"
      />

      {/* Right binocular housing (tilted down-right) */}
      <Path
        d="M86 29 C86 20 78 16 67 17 L52 20 C50.5 24 50.5 34 53 39 L69 42 C80 43 86 38 86 29 Z"
        fill={p.secLo}
        stroke={p.ink}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <Path
        d="M84 29 C84 21.5 77 18 67 19 L53.5 21.5 C52.2 25 52.2 33.5 54.5 37.5 L69 40 C78.5 41 84 36.5 84 29 Z"
        fill={p.secMid}
      />
      <Path
        d="M80 22 L56 23.5"
        stroke={p.secHi}
        strokeWidth="2.4"
        strokeLinecap="round"
      />

      {/* Left multi-layered optical camera lens */}
      <Circle
        cx="32"
        cy="30"
        r="10.2"
        fill={p.skinHi}
        stroke={p.ink}
        strokeWidth="2"
      />
      <Circle cx="32" cy="30" r="8.2" fill={p.ink} />
      <Circle cx="32" cy="30" r="6.2" fill={p.eye} opacity={0.85} />
      <Circle cx="32" cy="30" r="3.6" fill={p.ink} />
      <Circle cx="28.8" cy="26.8" r="2.6" fill={HOME_WIDGET_ICON_SHINE} opacity={0.95} />
      <Circle cx="34.8" cy="33" r="1.2" fill={HOME_WIDGET_ICON_SHINE} opacity={0.85} />

      {/* Right multi-layered optical camera lens */}
      <Circle
        cx="68"
        cy="30"
        r="10.2"
        fill={p.skinHi}
        stroke={p.ink}
        strokeWidth="2"
      />
      <Circle cx="68" cy="30" r="8.2" fill={p.ink} />
      <Circle cx="68" cy="30" r="6.2" fill={p.eye} opacity={0.85} />
      <Circle cx="68" cy="30" r="3.6" fill={p.ink} />
      <Circle cx="64.8" cy="26.8" r="2.6" fill={HOME_WIDGET_ICON_SHINE} opacity={0.95} />
      <Circle cx="70.8" cy="33" r="1.2" fill={HOME_WIDGET_ICON_SHINE} opacity={0.85} />

      {/* Expressive mechanical eyebrow flaps tilted sympathetically */}
      <Path
        d="M18 16.5 L45 20.5"
        stroke={p.ink}
        strokeWidth="4.2"
        strokeLinecap="round"
      />
      <Path
        d="M18 16.5 L45 20.5"
        stroke={p.secHi}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <Path
        d="M82 16.5 L55 20.5"
        stroke={p.ink}
        strokeWidth="4.2"
        strokeLinecap="round"
      />
      <Path
        d="M82 16.5 L55 20.5"
        stroke={p.secHi}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </G>
  );
}

/**
 * Joy (`sparkle` — Inside Out):
 * 3D claymorphic Joy bust with floating golden Core Memory orbs, chartreuse
 * satin V-neck dress, luminous golden-champagne skin with warm aura glow,
 * electric-cerulean pixie hair spikes, and huge sparkling cerulean eyes.
 */
export function JoyArt({
  p = CHARACTER_CLAY_PALETTES.sparkle,
}: {
  p?: CharacterClayPalette;
}) {
  return (
    <G>
      {/* Radiant golden Joy aura halo & ground shadow */}
      <Circle cx="50" cy="46" r="42" fill={p.glow} opacity={0.26} />
      <Circle cx="50" cy="44" r="31" fill={p.skinHi} opacity={0.22} />
      <Ellipse
        cx="50"
        cy="89"
        rx="28"
        ry="6"
        fill={HOME_WIDGET_ICON_SHADOW}
        opacity={0.26}
      />

      {/* Floating glowing golden Core Memory orbs & 4-point star bursts */}
      <Circle cx="16" cy="32" r="7.5" fill={p.glow} opacity={0.35} />
      <Circle
        cx="16"
        cy="32"
        r="5.2"
        fill={p.detail}
        stroke={p.ink}
        strokeWidth="1.4"
      />
      <Circle cx="16" cy="31.5" r="3.6" fill={p.skinHi} />
      <Circle cx="14.5" cy="30" r="1.4" fill={HOME_WIDGET_ICON_SHINE} />

      <Circle cx="84" cy="28" r="6.8" fill={p.glow} opacity={0.35} />
      <Circle
        cx="84"
        cy="28"
        r="4.6"
        fill={p.detail}
        stroke={p.ink}
        strokeWidth="1.4"
      />
      <Circle cx="84" cy="27.5" r="3.1" fill={p.skinHi} />
      <Circle cx="82.7" cy="26.2" r="1.2" fill={HOME_WIDGET_ICON_SHINE} />

      {/* Sparkling 4-point star bursts */}
      <Polygon
        points="20,14 21.5,17.5 25,19 21.5,20.5 20,24 18.5,20.5 15,19 18.5,17.5"
        fill={HOME_WIDGET_ICON_SHINE}
      />
      <Polygon
        points="82,48 83.2,50.8 86,52 83.2,53.2 82,56 80.8,53.2 78,52 80.8,50.8"
        fill={p.skinHi}
      />

      {/* Graceful golden-champagne neck & shoulders */}
      <Path
        d="M30 74 C32 64 42 60 50 60 C58 60 68 64 70 74 Z"
        fill={p.skinLo}
        stroke={p.ink}
        strokeWidth="2"
      />
      <Path
        d="M44 55 L56 55 L58 68 L42 68 Z"
        fill={p.skinMid}
        stroke={p.ink}
        strokeWidth="1.8"
      />

      {/* Chartreuse-green satin V-neck summer dress */}
      <Path
        d="M25 88 C26 71 34 65 40 64 L50 75 L60 64 C66 65 74 71 75 88 C62 92 38 92 25 88 Z"
        fill={p.secLo}
        stroke={p.ink}
        strokeWidth="2.3"
        strokeLinejoin="round"
      />
      <Path
        d="M27.5 86.5 C28.5 72.5 35 67 40.5 66 L50 76.5 L59.5 66 C65 67 71.5 72.5 72.5 86.5 C61 90 39 90 27.5 86.5 Z"
        fill={p.secMid}
      />
      <Path
        d="M31 73 L39 67.5 L45 75 M69 73 L61 67.5 L55 75"
        stroke={p.secHi}
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
        opacity={0.85}
      />
      {/* Sparkling dress star pattern */}
      <Polygon
        points="38,81 39.2,83.2 41.5,84 39.2,84.8 38,87 36.8,84.8 34.5,84 36.8,83.2"
        fill={p.secHi}
      />
      <Polygon
        points="61,80 62,82 64,82.8 62,83.6 61,85.6 60,83.6 58,82.8 60,82"
        fill={p.secHi}
      />

      {/* Luminous golden-champagne 3D sculpted head */}
      <Path
        d="M31 39 C31 26 39 20 50 20 C61 20 69 26 69 39 C69 52 60 60 50 60 C40 60 31 52 31 39 Z"
        fill={p.skinLo}
        stroke={p.ink}
        strokeWidth="2.3"
      />
      <Path
        d="M32.8 38.5 C32.8 27 40 21.8 50 21.8 C60 21.8 67.2 27 67.2 38.5 C67.2 50.5 59 58.2 50 58.2 C41 58.2 32.8 50.5 32.8 38.5 Z"
        fill={p.skinMid}
      />
      <Ellipse cx="50" cy="30" rx="11" ry="5" fill={p.skinHi} opacity={0.85} />

      {/* Warm pink cheek blush */}
      <Ellipse cx="37.5" cy="45.5" rx="4.5" ry="2.6" fill={p.blush} opacity={0.42} />
      <Ellipse cx="62.5" cy="45.5" rx="4.5" ry="2.6" fill={p.blush} opacity={0.42} />

      {/* Enormous sparkling cerulean-blue eyes */}
      <Ellipse
        cx="41"
        cy="39.5"
        rx="5.8"
        ry="6.2"
        fill={HOME_WIDGET_ICON_SHINE}
        stroke={p.ink}
        strokeWidth="1.8"
      />
      <Circle cx="41.5" cy="39.8" r="4.1" fill={p.eye} />
      <Circle cx="41.5" cy="39.8" r="2.2" fill={p.ink} />
      <Circle cx="39.8" cy="37.8" r="1.5" fill={HOME_WIDGET_ICON_SHINE} />
      <Circle cx="43" cy="41.4" r="0.75" fill={HOME_WIDGET_ICON_SHINE} />

      <Ellipse
        cx="59"
        cy="39.5"
        rx="5.8"
        ry="6.2"
        fill={HOME_WIDGET_ICON_SHINE}
        stroke={p.ink}
        strokeWidth="1.8"
      />
      <Circle cx="58.5" cy="39.8" r="4.1" fill={p.eye} />
      <Circle cx="58.5" cy="39.8" r="2.2" fill={p.ink} />
      <Circle cx="56.8" cy="37.8" r="1.5" fill={HOME_WIDGET_ICON_SHINE} />
      <Circle cx="60" cy="41.4" r="0.75" fill={HOME_WIDGET_ICON_SHINE} />

      {/* Joyful arched cerulean eyebrows */}
      <Path
        d="M35 31.5 Q41 28.2 46.5 31"
        stroke={p.lo}
        strokeWidth="2.3"
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M53.5 31 Q59 27.8 65 31.5"
        stroke={p.lo}
        strokeWidth="2.3"
        strokeLinecap="round"
        fill="none"
      />

      {/* Petite sculpted nose & radiant open-mouthed laugh */}
      <Path d="M48.8 41.5 Q50 44.2 51.8 42.5" stroke={p.skinLo} strokeWidth="2" strokeLinecap="round" fill="none" />
      <Path
        d="M42 47.5 Q50 50.5 58 47.5 C57.2 54.2 53.8 56.5 50 56.5 C46.2 56.5 42.8 54.2 42 47.5 Z"
        fill={p.ink}
        stroke={p.ink}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <Path
        d="M43 48 Q50 50.2 57 48 L56.2 50.5 Q50 52 43.8 50.5 Z"
        fill={HOME_WIDGET_ICON_SHINE}
      />
      <Ellipse cx="50" cy="54.2" rx="4.2" ry="2" fill={p.blush} />

      {/* Vibrant asymmetrical electric-cerulean pixie hair with swept spikes */}
      <Path
        d="M28 38 C25 26 30 16 40 12 L37 8 L48 11 L54 6 L61 11 L71 8 L67 16 C74 20 74 30 70 38 C68 29 63 24 55 23 L48 27 L44 22 C36 23 31 29 28 38 Z"
        fill={p.lo}
        stroke={p.ink}
        strokeWidth="2.3"
        strokeLinejoin="round"
      />
      <Path
        d="M30 35 C28 25 32 17 41 13.5 L39.5 10 L48.5 12.5 L54 8 L60.5 12.5 L68.5 10 L65.5 16.5 C71.5 20 72 28 69 35 C66.5 27.5 62 22.5 54.5 21.5 L48.5 25.5 L44.5 20.5 C37 21.5 32.5 27 30 35 Z"
        fill={p.mid}
      />
      {/* Shimmering cyan hair highlights */}
      <Path
        d="M36 18 Q45 13 55 14 M49 12 L54 9.5 L59 13.5 M60 16 Q66 15 68 20"
        stroke={p.hi}
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
        opacity={0.92}
      />
    </G>
  );
}

export function renderPixarMotif(motif: PixarMotif): React.ReactNode {
  switch (motif) {
    case "rocket":
      return <BuzzArt />;
    case "sheriff":
      return <WoodyArt />;
    case "robot":
      return <WalleArt />;
    case "sparkle":
      return <JoyArt />;
  }
}

export default renderPixarMotif;
