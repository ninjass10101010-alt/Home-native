import React from "react";
import { Circle, Ellipse, G, Line, Path, Polygon, Rect } from "react-native-svg";
import {
  CHARACTER_CLAY_PALETTES,
  HOME_WIDGET_ICON_SHADOW,
  HOME_WIDGET_ICON_SHINE,
  type CharacterClayPalette,
} from "../../theme/materials";
import { mix } from "../../theme/mix";

export type DisneyMotif = "alien" | "snowflake" | "wave" | "ears" | "crown";

export interface DisneyCharacterArtProps {
  p?: CharacterClayPalette;
}

/**
 * Stitch (`alien`): 3D claymorphic Experiment 626 with wide notched ears,
 * volumetric koala-blue fur, sky-cyan eye patches, glossy midnight eyes,
 * sculpted indigo nose, and mischievous Stitch grin.
 */
export function StitchArt({ p = CHARACTER_CLAY_PALETTES.alien }: DisneyCharacterArtProps) {
  const furRim = mix(p.hi, HOME_WIDGET_ICON_SHINE, 35);
  const earFoldShadow = mix(p.secLo, p.ink, 25);
  const noseHighlight = mix(p.detail, p.hi, 45);

  return (
    <G>
      {/* Ground drop shadow */}
      <Ellipse cx="50" cy="86" rx="30" ry="6.5" fill={HOME_WIDGET_ICON_SHADOW} opacity={0.28} />

      {/* Left giant notched alien ear (angled wide x=4..32) */}
      <Path
        d="M31 49 C19 46 8 34 4 19 C3 14 7 12 13 15 C20 18 26 24 30 31 L25 34 L31 36 C33 40 33 45 31 49 Z"
        fill={p.lo}
        stroke={p.ink}
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <Path
        d="M30 47 C19 44 10 33 6.5 20 C6 16.5 9 15 14 17.5 C20 20.5 25 25.5 28.5 31.5 L24 34 L30 36.2 Z"
        fill={p.mid}
      />
      <Path
        d="M29 45 C20 42 12 33 9 22 C14 23 21 28 26.5 33 L23 35 L28.5 37.2 Z"
        fill={p.secMid}
      />
      <Path
        d="M28 44 C21 41 15 34 12 25 C16 26.5 21 30.5 25 35.5 Z"
        fill={p.secHi}
        opacity={0.78}
      />
      <Path
        d="M29 45 C23 43 18 39 14 33"
        stroke={earFoldShadow}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />

      {/* Right giant notched alien ear (angled wide x=68..96) */}
      <Path
        d="M69 49 C81 46 92 34 96 19 C97 14 93 12 87 15 C80 18 74 24 70 31 C71 34 71 38 69 42 L74 44 L69 46.5 Z"
        fill={p.lo}
        stroke={p.ink}
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <Path
        d="M70 47 C81 44 90 33 93.5 20 C94 16.5 91 15 86 17.5 C80 20.5 75 25.5 71.5 31.5 L71 41.5 L75 43.8 L70 46 Z"
        fill={p.mid}
      />
      <Path
        d="M71 45 C80 42 88 33 91 22 C86 23 79 28 73.5 33 L73 41 L76.5 43.2 L71.5 45 Z"
        fill={p.secMid}
      />
      <Path
        d="M72 44 C79 41 85 34 88 25 C84 26.5 79 30.5 75 35.5 Z"
        fill={p.secHi}
        opacity={0.78}
      />
      <Path
        d="M71 45 C77 43 82 39 86 33"
        stroke={earFoldShadow}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />

      {/* Sculpted blue shoulders & chest tuft at bottom (y=72..88) */}
      <Path
        d="M27 78 C29 71 38 68 50 68 C62 68 71 71 73 78 C75 83 66 87 50 87 C34 87 25 83 27 78 Z"
        fill={p.lo}
        stroke={p.ink}
        strokeWidth="2.2"
      />
      <Path
        d="M30 77 C32 72 40 70 50 70 C60 70 68 72 70 77 C71 81 63 85 50 85 C37 85 29 81 30 77 Z"
        fill={p.mid}
      />
      {/* Lighter sky-blue chest patch */}
      <Path
        d="M38 76 C41 73 45 72 50 72 C55 72 59 73 62 76 L59 83 L55 81 L50 85 L45 81 L41 83 Z"
        fill={p.skinMid}
      />
      <Path
        d="M42 75.5 C45 73.8 55 73.8 58 75.5"
        stroke={p.skinHi}
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />

      {/* Sculpted 3D koala-alien head */}
      <Path
        d="M24 53 C23 36 34 25 50 25 C66 25 77 36 76 53 C75 68 65 75 50 75 C35 75 25 68 24 53 Z"
        fill={p.lo}
      />
      <Path
        d="M25.5 51.5 C24.5 35.5 35 26 50 26 C65 26 75.5 35.5 74.5 51.5 C73.5 66 64 73 50 73 C36 73 26.5 66 25.5 51.5 Z"
        fill={p.mid}
      />
      {/* Top-left clay highlight arc */}
      <Path
        d="M31 37 C36 29 45 27.5 57 29 C48 30.5 38 33.5 32 41 C30.5 40 30.2 38.5 31 37 Z"
        fill={p.hi}
        opacity={0.9}
      />
      <Circle cx="36" cy="34" r="2.2" fill={furRim} opacity={0.75} />

      {/* 3 Forehead fur tufts + head outline */}
      <Path
        d="M44 26 L46 20 L49 25 L51 19 L53.5 25 L56.5 21 L56 26.5"
        fill={p.mid}
        stroke={p.ink}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M24 53 C23 36 34 25 50 25 C66 25 77 36 76 53 C75 68 65 75 50 75 C35 75 25 68 24 53 Z"
        fill="none"
        stroke={p.ink}
        strokeWidth="2.3"
      />

      {/* Large teardrop sky-cyan eye patches tilted inward */}
      <G transform="rotate(-14 37 49)">
        <Ellipse cx="37" cy="49.5" rx="8.8" ry="11.2" fill={p.skinLo} />
        <Ellipse cx="37" cy="49" rx="8.2" ry="10.5" fill={p.skinMid} />
        <Ellipse cx="35.8" cy="45.5" rx="5.2" ry="6.2" fill={p.skinHi} opacity={0.75} />
      </G>
      <G transform="rotate(14 63 49)">
        <Ellipse cx="63" cy="49.5" rx="8.8" ry="11.2" fill={p.skinLo} />
        <Ellipse cx="63" cy="49" rx="8.2" ry="10.5" fill={p.skinMid} />
        <Ellipse cx="61.8" cy="45.5" rx="5.2" ry="6.2" fill={p.skinHi} opacity={0.75} />
      </G>

      {/* Arched expressive brow ridges */}
      <Path
        d="M30 37 C34 34 40 35 43 39"
        stroke={p.lo}
        strokeWidth="2.8"
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M70 37 C66 34 60 35 57 39"
        stroke={p.lo}
        strokeWidth="2.8"
        strokeLinecap="round"
        fill="none"
      />

      {/* Huge glossy midnight-black eyes with dual catchlights & cyan rim reflection */}
      <Ellipse cx="37.5" cy="50" rx="6.2" ry="7.8" fill={p.eye} stroke={p.ink} strokeWidth="1.6" />
      <Path d="M33.5 54.5 A5 5 0 0 0 41.5 54.5" stroke={p.skinHi} strokeWidth="1.4" strokeLinecap="round" fill="none" opacity={0.75} />
      <Circle cx="35.5" cy="46.5" r="2.3" fill={HOME_WIDGET_ICON_SHINE} />
      <Circle cx="39.8" cy="52" r="1.1" fill={HOME_WIDGET_ICON_SHINE} opacity={0.9} />

      <Ellipse cx="62.5" cy="50" rx="6.2" ry="7.8" fill={p.eye} stroke={p.ink} strokeWidth="1.6" />
      <Path d="M58.5 54.5 A5 5 0 0 0 66.5 54.5" stroke={p.skinHi} strokeWidth="1.4" strokeLinecap="round" fill="none" opacity={0.75} />
      <Circle cx="60.5" cy="46.5" r="2.3" fill={HOME_WIDGET_ICON_SHINE} />
      <Circle cx="64.8" cy="52" r="1.1" fill={HOME_WIDGET_ICON_SHINE} opacity={0.9} />

      {/* Large 3D sculpted dark-indigo oval koala nose */}
      <Path
        d="M42 52 C42 47 58 47 58 52 C58 57.5 53.5 61 50 61 C46.5 61 42 57.5 42 52 Z"
        fill={p.lo}
      />
      <Path
        d="M42.8 51.2 C42.8 46.8 57.2 46.8 57.2 51.2 C57.2 56.2 53.2 59.8 50 59.8 C46.8 59.8 42.8 56.2 42.8 51.2 Z"
        fill={p.detail}
        stroke={p.ink}
        strokeWidth="1.8"
      />
      <Ellipse cx="48.5" cy="49.5" rx="4.2" ry="1.8" fill={noseHighlight} opacity={0.85} />
      <Ellipse cx="47.2" cy="49" rx="2.1" ry="0.9" fill={HOME_WIDGET_ICON_SHINE} opacity={0.9} />
      {/* Nostril slits */}
      <Ellipse cx="46.5" cy="55" rx="1.6" ry="0.9" fill={p.ink} />
      <Ellipse cx="53.5" cy="55" rx="1.6" ry="0.9" fill={p.ink} />

      {/* Wide mischievous Stitch grin with corner cheek creases, pink tongue peek, and teeth */}
      <Path
        d="M32 61.5 C37 68.5 63 68.5 68 61.5 C65 69.5 58 71.5 50 71.5 C42 71.5 35 69.5 32 61.5 Z"
        fill={p.secLo}
        stroke={p.ink}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {/* Pink tongue peek */}
      <Path
        d="M43 67.5 C45 65 55 65 57 67.5 C55 70.5 45 70.5 43 67.5 Z"
        fill={p.secMid}
      />
      <Path
        d="M45.5 67.5 C47.5 66.2 52.5 66.2 54.5 67.5"
        stroke={p.secHi}
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
      />
      {/* Little white teeth highlights */}
      <Polygon points="36,63.5 38.5,63.8 37.2,66.2" fill={HOME_WIDGET_ICON_SHINE} />
      <Polygon points="64,63.5 61.5,63.8 62.8,66.2" fill={HOME_WIDGET_ICON_SHINE} />
      {/* Smile line & cheek creases */}
      <Path
        d="M31 61 C38 66.5 62 66.5 69 61"
        stroke={p.ink}
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      <Path d="M29.5 59.5 C30.5 61 31.5 62.5 33 63" stroke={p.ink} strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <Path d="M70.5 59.5 C69.5 61 68.5 62.5 67 63" stroke={p.ink} strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </G>
  );
}

/**
 * Queen Elsa (`snowflake`): Shimmering glacial cyan ice gown & cape,
 * volumetric platinum-white hair with over-shoulder braid, 5-spire crystal tiara,
 * warm porcelain-peach sculpted face, lavender eyelids, and sparkling ice-blue eyes.
 */
export function ElsaArt({ p = CHARACTER_CLAY_PALETTES.snowflake }: DisneyCharacterArtProps) {
  const hairRim = mix(p.hi, p.secHi, 30);
  const gownDeep = mix(p.secLo, p.ink, 20);

  return (
    <G>
      {/* Ground drop shadow */}
      <Ellipse cx="50" cy="87" rx="28" ry="6" fill={HOME_WIDGET_ICON_SHADOW} opacity={0.28} />

      {/* Sheer glacial cape & back hair volume */}
      <Path
        d="M23 84 C25 69 34 63 50 63 C66 63 75 69 77 84 C70 88 30 88 23 84 Z"
        fill={p.secLo}
        stroke={p.ink}
        strokeWidth="2"
      />
      <Path
        d="M27 83 C29 71 37 66 50 66 C63 66 71 71 73 83 C66 86.5 34 86.5 27 83 Z"
        fill={p.secMid}
      />
      {/* Off-shoulder ice sleeve wrap */}
      <Path
        d="M26 75 C34 71 42 73 50 75 C58 73 66 71 74 75 C72 79 62 81 50 81 C38 81 28 79 26 75 Z"
        fill={p.secHi}
        opacity={0.88}
      />

      {/* Crystalline diamond snowflake bodice brooch */}
      <Polygon points="50,72 53.5,77 50,82 46.5,77" fill={HOME_WIDGET_ICON_SHINE} stroke={gownDeep} strokeWidth="1.2" />
      <Circle cx="50" cy="77" r="1.4" fill={p.secMid} />

      {/* Sculpted neck & shoulders */}
      <Rect x="44.5" y="59" width="11" height="12" rx="5" fill={p.skinLo} />
      <Path
        d="M34 73 C37 68 43 66 50 66 C57 66 63 68 66 73 Z"
        fill={p.skinMid}
      />

      {/* Volumetric platinum-white hair back base */}
      <Path
        d="M25 46 C23 30 34 19 50 19 C66 19 77 30 75 46 C74 56 68 62 50 62 C32 62 26 56 25 46 Z"
        fill={p.lo}
        stroke={p.ink}
        strokeWidth="2.2"
      />
      <Path
        d="M27 44 C25.5 30 35.5 20.5 50 20.5 C64.5 20.5 74.5 30 73 44 C72 52 66 58 50 58 C34 58 28 52 27 44 Z"
        fill={p.mid}
      />

      {/* Warm 3D porcelain-peach face */}
      <Path
        d="M32 45 C32 33 40 28 50 28 C60 28 68 33 68 45 C68 56 59 64 50 64 C41 64 32 56 32 45 Z"
        fill={p.skinLo}
        stroke={p.ink}
        strokeWidth="2"
      />
      <Path
        d="M33.2 44 C33.2 33.5 40.5 29 50 29 C59.5 29 66.8 33.5 66.8 44 C66.8 54.5 58.5 62 50 62 C41.5 62 33.2 54.5 33.2 44 Z"
        fill={p.skinMid}
      />
      {/* Forehead & cheekbone highlight */}
      <Path
        d="M37 36 C41 31.5 56 31.5 61 36 C56 34 43 34 37 36 Z"
        fill={p.skinHi}
        opacity={0.9}
      />
      <Ellipse cx="38.5" cy="51.5" rx="4.2" ry="2.4" fill={p.blush} opacity={0.38} />
      <Ellipse cx="61.5" cy="51.5" rx="4.2" ry="2.4" fill={p.blush} opacity={0.38} />

      {/* Expressive lavender-shaded eyelids */}
      <Path d="M35.5 44.5 C37.5 40.5 43.5 40.5 45.5 44.5 Z" fill={p.detail} opacity={0.55} />
      <Path d="M54.5 44.5 C56.5 40.5 62.5 40.5 64.5 44.5 Z" fill={p.detail} opacity={0.55} />

      {/* Large sparkling ice-blue eyes & dark eyelashes */}
      <Ellipse cx="40.5" cy="46" rx="4.8" ry="4.2" fill={HOME_WIDGET_ICON_SHINE} />
      <Circle cx="41" cy="46" r="3.3" fill={p.eye} />
      <Circle cx="41" cy="46" r="1.8" fill={p.ink} />
      <Circle cx="39.6" cy="44.6" r="1.3" fill={HOME_WIDGET_ICON_SHINE} />
      <Circle cx="42.4" cy="47.3" r="0.7" fill={HOME_WIDGET_ICON_SHINE} />
      <Path
        d="M35 45 C37 41.2 43.5 41.2 45.8 45"
        stroke={p.ink}
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      <Path d="M35 44.5 L33.2 42.8" stroke={p.ink} strokeWidth="1.6" strokeLinecap="round" />

      <Ellipse cx="59.5" cy="46" rx="4.8" ry="4.2" fill={HOME_WIDGET_ICON_SHINE} />
      <Circle cx="59" cy="46" r="3.3" fill={p.eye} />
      <Circle cx="59" cy="46" r="1.8" fill={p.ink} />
      <Circle cx="57.6" cy="44.6" r="1.3" fill={HOME_WIDGET_ICON_SHINE} />
      <Circle cx="60.4" cy="47.3" r="0.7" fill={HOME_WIDGET_ICON_SHINE} />
      <Path
        d="M54.2 45 C56.5 41.2 63 41.2 65 45"
        stroke={p.ink}
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      <Path d="M65 44.5 L66.8 42.8" stroke={p.ink} strokeWidth="1.6" strokeLinecap="round" />

      {/* Delicate eyebrows & nose bridge */}
      <Path d="M35.5 39.5 C38 38 42.5 38.2 45 39.8" stroke={p.lo} strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <Path d="M55 39.8 C57.5 38.2 62 38 64.5 39.5" stroke={p.lo} strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <Path d="M49.5 45.5 L48.5 51.2 C49.5 52.2 50.8 52.2 51.8 51.2" stroke={p.skinLo} strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <Circle cx="50" cy="50.8" r="1" fill={p.skinHi} />

      {/* Confident warm rose-tinted smile with lip gloss highlight */}
      <Path
        d="M44.5 56 C47 58.8 53 58.8 55.5 56 C53.5 59.8 46.5 59.8 44.5 56 Z"
        fill={p.blush}
        stroke={p.ink}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <Path d="M48 57.6 L52 57.6" stroke={HOME_WIDGET_ICON_SHINE} strokeWidth="1.1" strokeLinecap="round" opacity={0.85} />

      {/* Swept platinum-white crown hair waves */}
      <Path
        d="M26 42 C27 27 38 19 52 20 C65 21 74 29 73 43 C68 34 59 31 48 32 C38 33 31 36 26 42 Z"
        fill={p.mid}
        stroke={p.ink}
        strokeWidth="2"
      />
      <Path
        d="M30 35 C36 24 49 21 63 25 C53 25 40 27 32 36 Z"
        fill={p.hi}
      />
      <Path
        d="M34 29 C42 24 54 24 64 29"
        stroke={hairRim}
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />

      {/* Sculpted 5-spire crystalline ice tiara */}
      <Polygon
        points="38,26 41,18 44.5,24 47,15 50,22 50,11 50,22 53,15 55.5,24 59,18 62,26"
        fill={p.secHi}
        stroke={p.secMid}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <Polygon points="50,11 52.2,21 50,24 47.8,21" fill={HOME_WIDGET_ICON_SHINE} />
      <Circle cx="50" cy="19" r="1.4" fill={p.secMid} />

      {/* Thick multi-segment braided ponytail sweeping over right shoulder (x=60..78, y=52..88) */}
      <G>
        <Circle cx="67" cy="56" r="6.2" fill={p.lo} stroke={p.ink} strokeWidth="1.8" />
        <Circle cx="66.5" cy="55.5" r="4.8" fill={p.mid} />
        <Path d="M64 53.5 A4 4 0 0 1 69 53.5" stroke={p.hi} strokeWidth="1.8" strokeLinecap="round" fill="none" />

        <Circle cx="69" cy="64" r="5.8" fill={p.lo} stroke={p.ink} strokeWidth="1.8" />
        <Circle cx="68.5" cy="63.5" r="4.5" fill={p.mid} />
        <Path d="M66 61.5 A3.8 3.8 0 0 1 71 61.5" stroke={p.hi} strokeWidth="1.8" strokeLinecap="round" fill="none" />

        <Circle cx="67.5" cy="72" r="5.3" fill={p.lo} stroke={p.ink} strokeWidth="1.8" />
        <Circle cx="67" cy="71.5" r="4.1" fill={p.mid} />
        <Path d="M65 69.5 A3.5 3.5 0 0 1 69.5 69.5" stroke={p.hi} strokeWidth="1.6" strokeLinecap="round" fill="none" />

        <Path
          d="M64 76 C63 82 66 87 70 88 C72 84 73 79 70 75 Z"
          fill={p.mid}
          stroke={p.ink}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        {/* Tiny ice crystals tucked into the braid */}
        <Polygon points="69,58 71,60 69,62 67,60" fill={p.secHi} />
        <Polygon points="67,67 68.8,68.8 67,70.6 65.2,68.8" fill={HOME_WIDGET_ICON_SHINE} />
        <Circle cx="72" cy="64" r="1.2" fill={HOME_WIDGET_ICON_SHINE} />
      </G>
    </G>
  );
}

/**
 * Moana (`wave`): Cascading espresso-cocoa wavy island curls, coral-red Motunui
 * bodice, glowing turquoise Heart of Te Fiti necklace, warm Polynesian bronze
 * 3D face, and 5-petal coral plumeria flower tucked by her right temple.
 */
export function MoanaArt({ p = CHARACTER_CLAY_PALETTES.wave }: DisneyCharacterArtProps) {
  const curlShine = mix(p.hi, p.skinHi, 30);
  const amuletGlow = mix(p.detail, HOME_WIDGET_ICON_SHINE, 50);

  return (
    <G>
      {/* Ground drop shadow */}
      <Ellipse cx="50" cy="87" rx="29" ry="6" fill={HOME_WIDGET_ICON_SHADOW} opacity={0.28} />

      {/* Cascading dark espresso-cocoa wavy island hair back volume (down to y=88) */}
      <Path
        d="M21 52 C19 32 31 18 50 18 C69 18 81 32 79 52 C82 66 79 80 73 87 C64 89 36 89 27 87 C21 80 18 66 21 52 Z"
        fill={p.lo}
        stroke={p.ink}
        strokeWidth="2.2"
      />
      <Path
        d="M23.5 51 C22 33 33 20 50 20 C67 20 78 33 76.5 51 C79 64 76 77 71 84 C62 86 38 86 29 84 C24 77 21 64 23.5 51 Z"
        fill={p.mid}
      />

      {/* Sculpted bronze shoulders & neck */}
      <Rect x="44" y="60" width="12" height="12" rx="5" fill={p.skinLo} />
      <Path
        d="M31 76 C34 68 41 66 50 66 C59 66 66 68 69 76 L69 85 L31 85 Z"
        fill={p.skinMid}
        stroke={p.ink}
        strokeWidth="1.8"
      />

      {/* Traditional coral-red & woven-cream Motunui bodice top */}
      <Path
        d="M34 75 C40 73 60 73 66 75 L68 86 C58 88 42 88 32 86 Z"
        fill={p.secLo}
        stroke={p.ink}
        strokeWidth="1.8"
      />
      <Path
        d="M35.5 76 C41 74.5 59 74.5 64.5 76 L66 84.5 C57 86 43 86 34 84.5 Z"
        fill={p.secMid}
      />
      <Path
        d="M35 78.5 C43 77 57 77 65 78.5"
        stroke={p.skinHi}
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />

      {/* Woven necklace cord & glowing turquoise Heart of Te Fiti amulet */}
      <Path
        d="M41 67 C43 74 57 74 59 67"
        stroke={p.skinHi}
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      <Circle cx="50" cy="73.5" r="4.8" fill={p.detail} opacity={0.35} />
      <Ellipse cx="50" cy="73.5" rx="3.4" ry="4.1" fill={p.detail} stroke={p.ink} strokeWidth="1.4" />
      <Path
        d="M49.5 72.5 C50.8 71.8 51.6 73.2 50.5 74.2 C49.2 75.2 48.2 73.5 49.5 71.8"
        stroke={amuletGlow}
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
      />

      {/* Warm Polynesian bronze 3D sculpted face */}
      <Path
        d="M32 46 C32 33 40 27.5 50 27.5 C60 27.5 68 33 68 46 C68 57 59.5 64.5 50 64.5 C40.5 64.5 32 57 32 46 Z"
        fill={p.skinLo}
        stroke={p.ink}
        strokeWidth="2"
      />
      <Path
        d="M33.5 45 C33.5 33.5 40.8 29 50 29 C59.2 29 66.5 33.5 66.5 45 C66.5 55.5 58.5 62.5 50 62.5 C41.5 62.5 33.5 55.5 33.5 45 Z"
        fill={p.skinMid}
      />
      <Path
        d="M38 36 C43 32 57 32 62 36 C56 34.5 44 34.5 38 36 Z"
        fill={p.skinHi}
        opacity={0.75}
      />
      {/* Warm island cheek glow */}
      <Ellipse cx="38.5" cy="52" rx="4.2" ry="2.5" fill={p.blush} opacity={0.32} />
      <Ellipse cx="61.5" cy="52" rx="4.2" ry="2.5" fill={p.blush} opacity={0.32} />

      {/* Expressive arched eyebrows */}
      <Path d="M35 39.5 C38 37.2 43 37.5 45.5 39.5" stroke={p.lo} strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <Path d="M54.5 39.5 C57 37.5 62 37.2 65 39.5" stroke={p.lo} strokeWidth="2.4" strokeLinecap="round" fill="none" />

      {/* Large warm amber-brown irises, deep pupils & dual white catchlights */}
      <Ellipse cx="40.5" cy="46" rx="4.8" ry="4.3" fill={HOME_WIDGET_ICON_SHINE} />
      <Circle cx="41" cy="46" r="3.4" fill={p.eye} />
      <Circle cx="41" cy="46" r="1.8" fill={p.ink} />
      <Circle cx="39.6" cy="44.5" r="1.3" fill={HOME_WIDGET_ICON_SHINE} />
      <Circle cx="42.4" cy="47.2" r="0.7" fill={HOME_WIDGET_ICON_SHINE} />
      <Path d="M35.2 45 C37.5 41.2 43.8 41.2 45.8 45" stroke={p.ink} strokeWidth="2.2" strokeLinecap="round" fill="none" />

      <Ellipse cx="59.5" cy="46" rx="4.8" ry="4.3" fill={HOME_WIDGET_ICON_SHINE} />
      <Circle cx="59" cy="46" r="3.4" fill={p.eye} />
      <Circle cx="59" cy="46" r="1.8" fill={p.ink} />
      <Circle cx="57.6" cy="44.5" r="1.3" fill={HOME_WIDGET_ICON_SHINE} />
      <Circle cx="60.4" cy="47.2" r="0.7" fill={HOME_WIDGET_ICON_SHINE} />
      <Path d="M54.2 45 C56.2 41.2 62.5 41.2 64.8 45" stroke={p.ink} strokeWidth="2.2" strokeLinecap="round" fill="none" />

      {/* Sculpted nose with soft highlight */}
      <Path d="M48 51.2 C49.2 52.6 50.8 52.6 52 51.2" stroke={p.skinLo} strokeWidth="2" strokeLinecap="round" fill="none" />
      <Circle cx="50" cy="50.2" r="1.3" fill={p.skinHi} opacity={0.85} />

      {/* Bright adventurous smile showing a pearly white tooth gleam */}
      <Path
        d="M43.5 55.5 C46.5 60.5 53.5 60.5 56.5 55.5 C54 57 46 57 43.5 55.5 Z"
        fill={p.secLo}
        stroke={p.ink}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <Path
        d="M44.5 56 C47 58.2 53 58.2 55.5 56 C53 56.8 47 56.8 44.5 56 Z"
        fill={HOME_WIDGET_ICON_SHINE}
      />

      {/* Sculpted front curl ribbons framing both shoulders */}
      <Path
        d="M27 36 C22 48 22 68 28 84 C32 76 31 60 33 44 C34 35 42 30 52 30 C61 30 66 36 67 45 C69 60 68 76 72 84 C78 68 78 48 73 36 C68 24 59 20 50 20 C41 20 32 24 27 36 Z"
        fill={p.mid}
      />
      <Path
        d="M25 46 C22 56 24 68 28 79"
        stroke={p.hi}
        strokeWidth="3.2"
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M75 46 C78 56 76 68 72 79"
        stroke={p.hi}
        strokeWidth="3.2"
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M31 28 C38 22 50 21 61 25"
        stroke={curlShine}
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
        opacity={0.8}
      />

      {/* Lush 5-petal coral-rose plumeria/hibiscus flower tucked by right temple */}
      <G transform="translate(67, 31)">
        <Circle cx="0" cy="-4.5" r="3.6" fill={p.secMid} stroke={p.ink} strokeWidth="1.2" />
        <Circle cx="4.3" cy="-1.4" r="3.6" fill={p.secMid} stroke={p.ink} strokeWidth="1.2" />
        <Circle cx="2.6" cy="3.6" r="3.6" fill={p.secLo} stroke={p.ink} strokeWidth="1.2" />
        <Circle cx="-2.6" cy="3.6" r="3.6" fill={p.secLo} stroke={p.ink} strokeWidth="1.2" />
        <Circle cx="-4.3" cy="-1.4" r="3.6" fill={p.secMid} stroke={p.ink} strokeWidth="1.2" />
        <Circle cx="0" cy="-4.2" r="2" fill={p.secHi} />
        <Circle cx="3.8" cy="-1.2" r="2" fill={p.secHi} />
        <Circle cx="-3.8" cy="-1.2" r="2" fill={p.secHi} />
        <Circle cx="0" cy="0" r="2.2" fill={p.skinHi} stroke={p.secLo} strokeWidth="1" />
        <Circle cx="-0.5" cy="-0.5" r="0.8" fill={HOME_WIDGET_ICON_SHINE} />
      </G>
    </G>
  );
}

/**
 * Sorcerer Mickey (`ears`): Iconic 3D round obsidian mouse ears, tall pointed
 * cobalt-blue Fantasia Sorcerer hat with golden crescent moon & stars,
 * sculpted widow's-peak face mask, vintage oval eyes, 3D button nose, and crimson robe.
 */
export function MickeyArt({ p = CHARACTER_CLAY_PALETTES.ears }: DisneyCharacterArtProps) {
  const velvetRim = mix(p.hi, HOME_WIDGET_ICON_SHINE, 25);
  const robeShadow = mix(p.blush, p.ink, 35);

  return (
    <G>
      {/* Ground drop shadow */}
      <Ellipse cx="50" cy="88" rx="28" ry="5.5" fill={HOME_WIDGET_ICON_SHADOW} opacity={0.28} />

      {/* Crimson sorcerer robe collar & golden-amber tie at bottom */}
      <Path
        d="M28 84 C31 74 39 71 50 71 C61 71 69 74 72 84 C65 88 35 88 28 84 Z"
        fill={robeShadow}
        stroke={p.ink}
        strokeWidth="2"
      />
      <Path
        d="M31 83 C34 75 40 73 50 73 C60 73 66 75 69 83 C62 86.5 38 86.5 31 83 Z"
        fill={p.blush}
      />
      {/* Golden-amber robe cord & V-neck */}
      <Polygon points="45,73 55,73 50,82" fill={p.lo} />
      <Circle cx="50" cy="79" r="2.5" fill={p.detail} stroke={p.ink} strokeWidth="1.2" />

      {/* Iconic large 3D round obsidian mouse ears */}
      <Circle cx="22" cy="36" r="14.5" fill={p.lo} stroke={p.ink} strokeWidth="2.2" />
      <Circle cx="22" cy="35.5" r="12.5" fill={p.mid} />
      <Path d="M13 29 A10.5 10.5 0 0 1 29 27" stroke={p.hi} strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <Circle cx="16.5" cy="28.5" r="1.8" fill={velvetRim} opacity={0.75} />

      <Circle cx="78" cy="36" r="14.5" fill={p.lo} stroke={p.ink} strokeWidth="2.2" />
      <Circle cx="78" cy="35.5" r="12.5" fill={p.mid} />
      <Path d="M69 27 A10.5 10.5 0 0 1 85 29" stroke={p.hi} strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <Circle cx="73.5" cy="28.5" r="1.8" fill={velvetRim} opacity={0.75} />

      {/* Classic Mickey black head */}
      <Circle cx="50" cy="54" r="20.5" fill={p.lo} stroke={p.ink} strokeWidth="2.2" />
      <Circle cx="50" cy="53.5" r="19" fill={p.mid} />

      {/* Sculpted peach-cream widow's-peak face mask & puffy 3D smiling cheek pads */}
      <Path
        d="M34 55 C30 55 28 60 31 65 C34 71 42 74 50 74 C58 74 66 71 69 65 C72 60 70 55 66 55 C67 46 62 39 56 39 C53 39 51 42 50 44 C49 42 47 39 44 39 C38 39 33 46 34 55 Z"
        fill={p.skinLo}
        stroke={p.ink}
        strokeWidth="1.8"
      />
      <Path
        d="M35 55 C31.5 55 29.8 59.5 32.2 64 C35 69.5 42.5 72.5 50 72.5 C57.5 72.5 65 69.5 67.8 64 C70.2 59.5 68.5 55 65 55 C65.8 46.8 61.2 40.2 55.8 40.2 C53 40.2 51 42.8 50 45 C49 42.8 47 40.2 44.2 40.2 C38.8 40.2 34.2 46.8 35 55 Z"
        fill={p.skinMid}
      />
      <Path
        d="M39 43 C42 41 46 42 48 45 M52 45 C54 42 58 41 61 43"
        stroke={p.skinHi}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />

      {/* Expressive vintage vertical oval eyes */}
      <Ellipse cx="45" cy="50" rx="3.6" ry="6.5" fill={HOME_WIDGET_ICON_SHINE} stroke={p.ink} strokeWidth="1.5" />
      <Ellipse cx="45.8" cy="51.2" rx="2.1" ry="3.8" fill={p.ink} />
      <Circle cx="44.8" cy="49.2" r="1.1" fill={HOME_WIDGET_ICON_SHINE} />

      <Ellipse cx="55" cy="50" rx="3.6" ry="6.5" fill={HOME_WIDGET_ICON_SHINE} stroke={p.ink} strokeWidth="1.5" />
      <Ellipse cx="54.2" cy="51.2" rx="2.1" ry="3.8" fill={p.ink} />
      <Circle cx="53.2" cy="49.2" r="1.1" fill={HOME_WIDGET_ICON_SHINE} />

      {/* Cheerful open smile with pink/red tongue & cheek dimples */}
      <Path
        d="M38 61 C41 70 59 70 62 61 C58 64 42 64 38 61 Z"
        fill={p.lo}
        stroke={p.ink}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <Path
        d="M44 65.5 C46 63.5 54 63.5 56 65.5 C54 68.5 46 68.5 44 65.5 Z"
        fill={p.blush}
      />
      <Path
        d="M35.5 59.5 C40 64.5 60 64.5 64.5 59.5"
        stroke={p.ink}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <Path d="M33.5 58 C34.5 59.5 35.5 60.8 37 61.2" stroke={p.ink} strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <Path d="M66.5 58 C65.5 59.5 64.5 60.8 63 61.2" stroke={p.ink} strokeWidth="1.6" strokeLinecap="round" fill="none" />

      {/* Protruding 3D glossy black oval button nose */}
      <Ellipse cx="50" cy="57.5" rx="6.2" ry="4.2" fill={p.lo} stroke={p.ink} strokeWidth="1.6" />
      <Ellipse cx="48.2" cy="55.8" rx="2.4" ry="1.2" fill={HOME_WIDGET_ICON_SHINE} opacity={0.92} />

      {/* Tall pointed cobalt-blue Fantasia Sorcerer hat */}
      <Path
        d="M31 36 C32 23 41 11 53 7 C57 6 59 9 56 14 C54 18 59 26 69 36 Z"
        fill={p.secLo}
        stroke={p.ink}
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <Path
        d="M33 35.5 C34 24 42 12.5 52.5 8.8 C55.5 8 56.8 10 54.5 14.2 C52.2 18.5 57.5 26 67 35.5 Z"
        fill={p.secMid}
      />
      <Path
        d="M36 33 C37 24 43 15 51 11"
        stroke={p.secHi}
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
        opacity={0.85}
      />
      {/* Sculpted curved sorcerer hat brim */}
      <Path
        d="M27 36.5 C36 31.5 64 31.5 73 36.5 C66 40.5 34 40.5 27 36.5 Z"
        fill={p.secLo}
        stroke={p.ink}
        strokeWidth="2"
      />
      <Path
        d="M29.5 36.2 C37 32.5 63 32.5 70.5 36.2 C64 39 36 39 29.5 36.2 Z"
        fill={p.secHi}
        opacity={0.75}
      />

      {/* Glowing golden-amber crescent moon & 4-point star sparkles on hat */}
      <Path
        d="M44 22 C41.5 23.5 41.5 27.5 44 29 C46 30 48.2 29.2 49 27.8 C46.5 28 44.8 26.2 45 24 C45.2 22.5 46.2 21.5 44 22 Z"
        fill={p.detail}
      />
      <Polygon
        points="54,19 55.2,21.8 58,23 55.2,24.2 54,27 52.8,24.2 50,23 52.8,21.8"
        fill={HOME_WIDGET_ICON_SHINE}
      />
      <Polygon
        points="48,14 48.8,15.8 50.6,16.6 48.8,17.4 48,19.2 47.2,17.4 45.4,16.6 47.2,15.8"
        fill={p.detail}
      />
      <Circle cx="58.5" cy="29.5" r="1.3" fill={HOME_WIDGET_ICON_SHINE} />
    </G>
  );
}

/**
 * Simba (`crown`): Rounded 3D golden-amber lion cub ears, royal red-ochre
 * Rafiki ceremonial forehead stripe, fluffy golden-orange crown mane tuft,
 * cream-ivory muzzle pads, rosy triangular lion nose, and warm amber cub eyes.
 */
export function SimbaArt({ p = CHARACTER_CLAY_PALETTES.crown }: DisneyCharacterArtProps) {
  const maneHighlight = mix(p.detail, p.hi, 50);
  const earInnerRim = mix(p.secLo, p.ink, 25);

  return (
    <G>
      {/* Ground drop shadow */}
      <Ellipse cx="50" cy="87" rx="28" ry="6" fill={HOME_WIDGET_ICON_SHADOW} opacity={0.28} />

      {/* Golden lion cub chest/shoulders at bottom */}
      <Path
        d="M28 82 C30 72 38 69 50 69 C62 69 70 72 72 82 C66 87 34 87 28 82 Z"
        fill={p.lo}
        stroke={p.ink}
        strokeWidth="2.2"
      />
      <Path
        d="M31 81 C33 73.5 40 71 50 71 C60 71 67 73.5 69 81 C63 85 37 85 31 81 Z"
        fill={p.mid}
      />
      {/* Cream chest fur tuft */}
      <Path
        d="M40 75 C44 73 56 73 60 75 L57 83 L53 80.5 L50 84.5 L47 80.5 L43 83 Z"
        fill={p.skinHi}
      />

      {/* Rounded 3D golden-amber lion cub ears with sienna inner hollows & dark rim tufts */}
      <Circle cx="24" cy="34" r="11.5" fill={p.lo} stroke={p.ink} strokeWidth="2.2" />
      <Circle cx="24" cy="33.5" r="9.8" fill={p.mid} />
      <Circle cx="24.5" cy="34.5" r="6.2" fill={p.secLo} />
      <Circle cx="25" cy="35" r="4.5" fill={p.secMid} opacity={0.75} />
      <Path d="M16 27 A9.5 9.5 0 0 1 28 24.5" stroke={p.ink} strokeWidth="3.2" strokeLinecap="round" fill="none" />
      <Path d="M18 29 A7.5 7.5 0 0 1 28 27" stroke={p.hi} strokeWidth="1.8" strokeLinecap="round" fill="none" />

      <Circle cx="76" cy="34" r="11.5" fill={p.lo} stroke={p.ink} strokeWidth="2.2" />
      <Circle cx="76" cy="33.5" r="9.8" fill={p.mid} />
      <Circle cx="75.5" cy="34.5" r="6.2" fill={p.secLo} />
      <Circle cx="75" cy="35" r="4.5" fill={p.secMid} opacity={0.75} />
      <Path d="M72 24.5 A9.5 9.5 0 0 1 84 27" stroke={p.ink} strokeWidth="3.2" strokeLinecap="round" fill="none" />
      <Path d="M72 27 A7.5 7.5 0 0 1 82 29" stroke={p.hi} strokeWidth="1.8" strokeLinecap="round" fill="none" />

      {/* Sculpted golden lion cub head */}
      <Path
        d="M25 51 C24 34 34 24 50 24 C66 24 76 34 75 51 C77 61 67 72 50 72 C33 72 23 61 25 51 Z"
        fill={p.lo}
        stroke={p.ink}
        strokeWidth="2.2"
      />
      <Path
        d="M26.8 50 C26 35 35 25.5 50 25.5 C65 25.5 74 35 73.2 50 C75 59.5 65.5 70 50 70 C34.5 70 25 59.5 26.8 50 Z"
        fill={p.mid}
      />
      <Path
        d="M33 33 C39 27.5 61 27.5 67 33 C59 30.5 41 30.5 33 33 Z"
        fill={p.hi}
        opacity={0.88}
      />

      {/* Royal red-ochre Rafiki ceremonial forehead stripe */}
      <Path
        d="M44 33 C47 30.5 53 30.5 56 33 C55 37.5 52.5 40 50 40 C47.5 40 45 37.5 44 33 Z"
        fill={p.secMid}
        opacity={0.88}
      />
      <Path
        d="M46.5 33.5 C48.5 32 51.5 32 53.5 33.5"
        stroke={p.secHi}
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />

      {/* Fluffy golden-orange crown mane tuft */}
      <Path
        d="M42 25.5 L45 18.5 L48.5 23.5 L51 17 L53.5 23.5 L57 19 L58 25.5 Z"
        fill={p.detail}
        stroke={p.ink}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <Path d="M46 23 L50.8 19 L54.5 23.5" stroke={maneHighlight} strokeWidth="1.8" strokeLinecap="round" fill="none" />

      {/* Warm cream eye patches & bold cub brow arches */}
      <Ellipse cx="39.5" cy="46.5" rx="6.2" ry="6.8" fill={p.skinHi} opacity={0.7} />
      <Ellipse cx="60.5" cy="46.5" rx="6.2" ry="6.8" fill={p.skinHi} opacity={0.7} />
      <Path d="M33 39.5 C36 36.5 42 36.8 45 39.8" stroke={p.ink} strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <Path d="M55 39.8 C58 36.8 64 36.5 67 39.5" stroke={p.ink} strokeWidth="2.4" strokeLinecap="round" fill="none" />

      {/* Warm amber-brown cub eyes with dual white catchlights */}
      <Ellipse cx="40" cy="47" rx="4.6" ry="5" fill={HOME_WIDGET_ICON_SHINE} stroke={p.ink} strokeWidth="1.5" />
      <Circle cx="40.5" cy="47.2" r="3.4" fill={p.eye} />
      <Circle cx="40.5" cy="47.2" r="1.8" fill={p.ink} />
      <Circle cx="39.2" cy="45.6" r="1.3" fill={HOME_WIDGET_ICON_SHINE} />
      <Circle cx="41.8" cy="48.5" r="0.7" fill={HOME_WIDGET_ICON_SHINE} />

      <Ellipse cx="60" cy="47" rx="4.6" ry="5" fill={HOME_WIDGET_ICON_SHINE} stroke={p.ink} strokeWidth="1.5" />
      <Circle cx="59.5" cy="47.2" r="3.4" fill={p.eye} />
      <Circle cx="59.5" cy="47.2" r="1.8" fill={p.ink} />
      <Circle cx="58.2" cy="45.6" r="1.3" fill={HOME_WIDGET_ICON_SHINE} />
      <Circle cx="60.8" cy="48.5" r="0.7" fill={HOME_WIDGET_ICON_SHINE} />

      {/* 3D cream-ivory muzzle pads + chin tuft */}
      <Ellipse cx="50" cy="65.5" rx="8.5" ry="5.2" fill={p.skinMid} stroke={p.ink} strokeWidth="1.6" />
      <Circle cx="44" cy="59.5" r="7.2" fill={p.skinLo} />
      <Circle cx="56" cy="59.5" r="7.2" fill={p.skinLo} />
      <Circle cx="44" cy="59" r="6.6" fill={p.skinHi} />
      <Circle cx="56" cy="59" r="6.6" fill={p.skinHi} />

      {/* Proud cub smile */}
      <Path
        d="M50 58 L50 62.5 M42.5 61.5 C45 64.5 48.5 64 50 62.2 C51.5 64 55 64.5 57.5 61.5"
        stroke={p.ink}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Sculpted rosy-pink triangular lion nose */}
      <Polygon
        points="44,53 56,53 50,59.5"
        fill={p.blush}
        stroke={earInnerRim}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <Polygon points="46,53.8 54,53.8 50,56.5" fill={p.secHi} opacity={0.85} />
      <Ellipse cx="48.5" cy="54.2" rx="2" ry="0.8" fill={HOME_WIDGET_ICON_SHINE} opacity={0.9} />

      {/* 3 crisp whiskers on each side */}
      <Line x1="36" y1="57.5" x2="21" y2="55" stroke={p.ink} strokeWidth="1.5" strokeLinecap="round" />
      <Line x1="36" y1="60" x2="20" y2="60" stroke={p.ink} strokeWidth="1.5" strokeLinecap="round" />
      <Line x1="36.5" y1="62.5" x2="22" y2="64.5" stroke={p.ink} strokeWidth="1.5" strokeLinecap="round" />

      <Line x1="64" y1="57.5" x2="79" y2="55" stroke={p.ink} strokeWidth="1.5" strokeLinecap="round" />
      <Line x1="64" y1="60" x2="80" y2="60" stroke={p.ink} strokeWidth="1.5" strokeLinecap="round" />
      <Line x1="63.5" y1="62.5" x2="78" y2="64.5" stroke={p.ink} strokeWidth="1.5" strokeLinecap="round" />
    </G>
  );
}

/**
 * Renders the 3D Claymorphic Disney Classics motif artwork inside a `0 0 100 100` SVG medallion.
 */
export function renderDisneyMotif(motif: DisneyMotif): React.ReactNode {
  switch (motif) {
    case "alien":
      return <StitchArt />;
    case "snowflake":
      return <ElsaArt />;
    case "wave":
      return <MoanaArt />;
    case "ears":
      return <MickeyArt />;
    case "crown":
      return <SimbaArt />;
  }
}

export default renderDisneyMotif;
