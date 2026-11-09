import React from "react";
import {
  Circle,
  Ellipse,
  G,
  Line,
  Path,
  Polygon,
} from "react-native-svg";
import {
  CHARACTER_CLAY_PALETTES,
  HOME_WIDGET_ICON_SHADOW,
  HOME_WIDGET_ICON_SHINE,
  type CharacterClayPalette,
} from "../../theme/materials";
import { mix } from "../../theme/mix";

export type MarvelMotif = "web" | "arc" | "leaf" | "shield";

/**
 * Spider-Man (`web`):
 * AAA 3D claymorphic bust with Spider-Sense zig-zag waves, cobalt & crimson
 * suit shoulders, chest spider emblem, volumetric crimson mask with radial
 * and concentric black web lines, and oversized pearl-white lenses.
 */
export function SpiderManArt({
  p = CHARACTER_CLAY_PALETTES.web,
}: {
  p?: CharacterClayPalette;
}) {
  const maskWarmMid = mix(p.mid, p.hi, 25);
  const suitDeep = mix(p.secLo, p.ink, 35);
  const lensShadow = mix(p.skinLo, p.secHi, 35);

  return (
    <G>
      {/* 1. Ground drop shadow */}
      <Ellipse
        cx="50"
        cy="88"
        rx="34"
        ry="7"
        fill={HOME_WIDGET_ICON_SHADOW}
        opacity={0.28}
      />

      {/* 2-5. Spider-Sense zig-zag electric waves around upper temples */}
      <Path
        d="M12 34 L19 29 L15 24 L23 19 L19 14"
        stroke={p.detail}
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity={0.85}
      />
      <Path
        d="M14 43 L20 39 L17 35 L23 32"
        stroke={HOME_WIDGET_ICON_SHINE}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity={0.8}
      />
      <Path
        d="M88 34 L81 29 L85 24 L77 19 L81 14"
        stroke={p.detail}
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity={0.85}
      />
      <Path
        d="M86 43 L80 39 L83 35 L77 32"
        stroke={HOME_WIDGET_ICON_SHINE}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity={0.8}
      />

      {/* 6-10. Red & deep cobalt-blue Spider-Suit shoulders */}
      <Path
        d="M14 87 C15 71 27 65 50 65 C73 65 85 71 86 87 C76 93 64 95 50 95 C36 95 24 93 14 87 Z"
        fill={suitDeep}
        stroke={p.ink}
        strokeWidth="2.4"
      />
      <Path
        d="M16 86 C18 73 28 67 50 67 C72 67 82 73 84 86 C74 91 63 93 50 93 C37 93 26 91 16 86 Z"
        fill={p.secMid}
      />
      {/* Left & right cobalt shoulder highlights */}
      <Path
        d="M18 83 C20 75 26 71 34 70 L31 87 C25 86 21 85 18 83 Z"
        fill={p.secHi}
        opacity={0.45}
      />
      <Path
        d="M82 83 C80 75 74 71 66 70 L69 87 C75 86 79 85 82 83 Z"
        fill={p.secLo}
        opacity={0.65}
      />
      {/* Center crimson chest V-panel */}
      <Path
        d="M32 67 C38 66 62 66 68 67 L62 93 C54 94 46 94 38 93 Z"
        fill={p.lo}
        stroke={p.ink}
        strokeWidth="1.8"
      />
      <Path
        d="M34 68 C40 67 60 67 66 68 L60 91 C53 92 47 92 40 91 Z"
        fill={p.mid}
      />

      {/* 11-13. Chest web lines & black Spider emblem silhouette */}
      <Path
        d="M35 74 Q50 79 65 74 M37 83 Q50 87 63 83 M50 68 L50 92"
        stroke={p.ink}
        strokeWidth="1.3"
        fill="none"
        opacity={0.55}
      />
      <Ellipse cx="50" cy="79" rx="3.2" ry="4.5" fill={p.ink} />
      <Circle cx="50" cy="74" r="2.1" fill={p.ink} />
      <Path
        d="M47 76 L41 72 M47 78 L40 78 M47 80 L41 84 M48 82 L43 88 M53 76 L59 72 M53 78 L60 78 M53 80 L59 84 M52 82 L57 88"
        stroke={p.ink}
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />

      {/* 14-18. Sculpted 3D Marvel crimson mask */}
      {/* Mask drop shadow on neck */}
      <Ellipse
        cx="50"
        cy="69"
        rx="16"
        ry="5.5"
        fill={HOME_WIDGET_ICON_SHADOW}
        opacity={0.35}
      />
      {/* Outer shaded jaw & skull base */}
      <Path
        d="M50 13 C28 13 21 29 22 46 C23 60 35 72 50 73 C65 72 77 60 78 46 C79 29 72 13 50 13 Z"
        fill={p.lo}
        stroke={p.ink}
        strokeWidth="2.6"
      />
      {/* Main volumetric crimson dome */}
      <Path
        d="M50 15 C30 15 23.5 29.5 24.5 45 C25.5 57.5 36.5 68.5 50 69.5 C63.5 68.5 74.5 57.5 75.5 45 C76.5 29.5 70 15 50 15 Z"
        fill={p.mid}
      />
      {/* Upper temple & cheek 3D clay mid-hi sculpt */}
      <Path
        d="M50 16.5 C34 16.5 27 26.5 27.5 39 C34 34 66 34 72.5 39 C73 26.5 66 16.5 50 16.5 Z"
        fill={maskWarmMid}
      />
      {/* Top crown clay highlight & cheek puffs */}
      <Ellipse
        cx="50"
        cy="22"
        rx="15"
        ry="5.5"
        fill={p.hi}
        opacity={0.78}
      />
      <Ellipse
        cx="33"
        cy="56"
        rx="5.5"
        ry="3.2"
        fill={p.hi}
        opacity={0.45}
      />
      <Ellipse
        cx="67"
        cy="56"
        rx="5.5"
        ry="3.2"
        fill={p.hi}
        opacity={0.45}
      />

      {/* 19-24. Intricate radial & concentric curved black web lines converging at nose bridge (50, 48) */}
      {/* Radial web spokes */}
      <Path
        d="M50 48 L50 14 M50 48 L34 17 M50 48 L66 17 M50 48 L23 31 M50 48 L77 31 M50 48 L23 48 M50 48 L77 48 M50 48 L28 61 M50 48 L72 61 M50 48 L39 69 M50 48 L61 69 M50 48 L50 72"
        stroke={p.ink}
        strokeWidth="1.45"
        strokeLinecap="round"
        fill="none"
        opacity={0.82}
      />
      {/* Inner concentric scalloped web ring */}
      <Path
        d="M50 36 Q44 39 40 37 Q35 42 34 48 Q37 54 42 58 Q50 56 58 58 Q63 54 66 48 Q65 42 60 37 Q56 39 50 36 Z"
        stroke={p.ink}
        strokeWidth="1.35"
        fill="none"
        opacity={0.78}
      />
      {/* Mid concentric scalloped web ring */}
      <Path
        d="M50 26 Q41 30 34 26 Q28 33 27 42 Q28 51 33 58 Q41 62 50 63 Q59 62 67 58 Q72 51 73 42 Q72 33 66 26 Q59 30 50 26 Z"
        stroke={p.ink}
        strokeWidth="1.4"
        fill="none"
        opacity={0.78}
      />
      {/* Outer concentric scalloped web ring */}
      <Path
        d="M50 18 Q39 22 30 20 Q24 29 24 39 Q25 50 30 59 Q39 67 50 69 Q61 67 70 59 Q75 50 76 39 Q76 29 70 20 Q61 22 50 18 Z"
        stroke={p.ink}
        strokeWidth="1.4"
        fill="none"
        opacity={0.72}
      />
      {/* Center web convergence knot at nose bridge */}
      <Circle cx="50" cy="48" r="2.2" fill={p.ink} />

      {/* 25-34. Iconic oversized expressive Spider-Man lenses */}
      {/* Left lens drop shadow */}
      <Path
        d="M25 36 C25 29 36 33 46 43 C47 51 38 56 29 50 C25 47 24 41 25 36 Z"
        fill={HOME_WIDGET_ICON_SHADOW}
        opacity={0.32}
      />
      {/* Right lens drop shadow */}
      <Path
        d="M75 36 C75 29 64 33 54 43 C53 51 62 56 71 50 C75 47 76 41 75 36 Z"
        fill={HOME_WIDGET_ICON_SHADOW}
        opacity={0.32}
      />
      {/* Left thick sculpted jet-black outer lens frame */}
      <Path
        d="M25.5 34.5 C26.5 27.5 37.5 31.5 46.8 41.8 C47.5 49.8 38.5 54.8 29.5 49 C25.5 46 24.5 40 25.5 34.5 Z"
        fill={p.ink}
      />
      {/* Right thick sculpted jet-black outer lens frame */}
      <Path
        d="M74.5 34.5 C73.5 27.5 62.5 31.5 53.2 41.8 C52.5 49.8 61.5 54.8 70.5 49 C74.5 46 75.5 40 74.5 34.5 Z"
        fill={p.ink}
      />
      {/* Subtle cobalt-blue rim sheen on black lens frames */}
      <Path
        d="M27 33.5 C31 30.8 39 34.5 45.2 41"
        stroke={p.secHi}
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity={0.75}
      />
      <Path
        d="M73 33.5 C69 30.8 61 34.5 54.8 41"
        stroke={p.secHi}
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity={0.75}
      />
      {/* Left pearl-white inner lens base (`p.skinMid` -> `p.skinHi`) */}
      <Path
        d="M28.2 36.2 C29.2 31.5 37.5 34.8 44.2 42.5 C44.5 47.8 38 51.2 31.2 46.8 C28.5 44.8 27.5 40.2 28.2 36.2 Z"
        fill={p.skinMid}
      />
      <Path
        d="M29 36.5 C30 32.8 36.8 35.2 43 42 C39 45.5 33 45.5 29 36.5 Z"
        fill={p.skinHi}
      />
      {/* Right pearl-white inner lens base (`p.skinMid` -> `p.skinHi`) */}
      <Path
        d="M71.8 36.2 C70.8 31.5 62.5 34.8 55.8 42.5 C55.5 47.8 62 51.2 68.8 46.8 C71.5 44.8 72.5 40.2 71.8 36.2 Z"
        fill={p.skinMid}
      />
      <Path
        d="M71 36.5 C70 32.8 63.2 35.2 57 42 C61 45.5 67 45.5 71 36.5 Z"
        fill={p.skinHi}
      />
      {/* Inner lens subtle lower bevel */}
      <Path
        d="M30.5 45.8 C35.5 49.2 41.5 47.5 43.8 43.2"
        stroke={lensShadow}
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M69.5 45.8 C64.5 49.2 58.5 47.5 56.2 43.2"
        stroke={lensShadow}
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
      />
      {/* Diagonal glass specular reflection bars on both lenses */}
      <Polygon
        points="31,36 35,36.8 39,45.5 35,44.5"
        fill={HOME_WIDGET_ICON_SHINE}
        opacity={0.92}
      />
      <Polygon
        points="61,36.8 65,36 69,44.5 65,45.5"
        fill={HOME_WIDGET_ICON_SHINE}
        opacity={0.92}
      />
      {/* Crown specular pearl dot */}
      <Ellipse
        cx="43"
        cy="19.5"
        rx="4.2"
        ry="1.8"
        fill={HOME_WIDGET_ICON_SHINE}
        opacity={0.55}
      />
    </G>
  );
}

/**
 * Iron Man (`arc`):
 * AAA 3D claymorphic Mark LXXXV armor bust with crimson & gold shoulder
 * pauldrons, blazing pentagonal Arc Reactor, sculpted metallic hot-rod
 * crimson helmet shell, brushed gold-titanium faceplate with widow's peak
 * and angled jaw vents, and blinding cyan-white LED eyes.
 */
export function IronManArt({
  p = CHARACTER_CLAY_PALETTES.arc,
}: {
  p?: CharacterClayPalette;
}) {
  const crimsonHighlight = mix(p.mid, p.hi, 55);
  const goldDeep = mix(p.secLo, p.ink, 30);

  return (
    <G>
      {/* 1. Ground drop shadow */}
      <Ellipse
        cx="50"
        cy="89"
        rx="35"
        ry="6.8"
        fill={HOME_WIDGET_ICON_SHADOW}
        opacity={0.3}
      />

      {/* 2-7. Mark LXXXV shoulder pauldrons & chest armor plate */}
      <Path
        d="M12 85 C13 69 26 63 50 63 C74 63 87 69 88 85 C78 92 65 95 50 95 C35 95 22 92 12 85 Z"
        fill={p.lo}
        stroke={p.ink}
        strokeWidth="2.5"
      />
      <Path
        d="M15 84 C16 71 28 65 50 65 C72 65 84 71 85 84 C75 90 64 93 50 93 C36 93 25 90 15 84 Z"
        fill={p.mid}
      />
      {/* Left & right gold titanium shoulder trim inlays */}
      <Polygon
        points="16,78 31,68 35,74 19,85"
        fill={p.secMid}
        stroke={p.ink}
        strokeWidth="1.6"
      />
      <Polygon
        points="84,78 69,68 65,74 81,85"
        fill={p.secMid}
        stroke={p.ink}
        strokeWidth="1.6"
      />
      <Polygon points="18,78 30,70 32,73 20,81" fill={p.secHi} opacity={0.75} />
      <Polygon points="82,78 70,70 68,73 80,81" fill={p.secHi} opacity={0.75} />

      {/* Sculpted sternum armor collar */}
      <Polygon
        points="33,66 67,66 62,92 38,92"
        fill={p.lo}
        stroke={p.ink}
        strokeWidth="1.8"
      />

      {/* 8-13. Blazing pentagonal/circular Arc Reactor on chest */}
      <Circle cx="50" cy="80" r="11.5" fill={p.detail} opacity={0.35} />
      <Polygon
        points="50,69.5 60.5,75.5 57,87.5 43,87.5 39.5,75.5"
        fill={goldDeep}
        stroke={p.ink}
        strokeWidth="1.8"
      />
      <Circle
        cx="50"
        cy="79"
        r="7.4"
        fill={p.detail}
        stroke={p.ink}
        strokeWidth="1.4"
      />
      <Circle cx="50" cy="79" r="5.6" fill={p.eye} />
      <Circle cx="50" cy="79" r="3.6" fill={HOME_WIDGET_ICON_SHINE} />
      {/* Geometric reactor turbine struts */}
      <Path
        d="M50 71.5 L50 74.5 M57 76.5 L54.2 77.5 M54.5 85 L52.5 82.5 M45.5 85 L47.5 82.5 M43 76.5 L45.8 77.5"
        stroke={p.ink}
        strokeWidth="1.3"
        strokeLinecap="round"
      />

      {/* 14-19. Sculpted 3D metallic hot-rod crimson helmet shell */}
      <Ellipse
        cx="50"
        cy="67"
        rx="17"
        ry="5.5"
        fill={HOME_WIDGET_ICON_SHADOW}
        opacity={0.38}
      />
      {/* Outer shaded crimson helmet shell */}
      <Path
        d="M50 11 C28 11 21 24 22 43 C23 57 32 69 50 71 C68 69 77 57 78 43 C79 24 72 11 50 11 Z"
        fill={p.lo}
        stroke={p.ink}
        strokeWidth="2.6"
      />
      {/* Mid crimson metallic dome & cheek guards */}
      <Path
        d="M50 13 C30 13 23.5 25 24.5 42.5 C25.5 55 34 66.5 50 68.5 C66 66.5 74.5 55 75.5 42.5 C76.5 25 70 13 50 13 Z"
        fill={p.mid}
      />
      {/* Forehead center ridge crest */}
      <Polygon
        points="44,13 56,13 53.5,28 46.5,28"
        fill={crimsonHighlight}
        stroke={p.ink}
        strokeWidth="1.4"
      />
      <Polygon
        points="46,14.5 54,14.5 52,25 48,25"
        fill={p.hi}
        opacity={0.85}
      />
      {/* Specular dome glint */}
      <Ellipse
        cx="38"
        cy="19"
        rx="5.5"
        ry="2.2"
        fill={HOME_WIDGET_ICON_SHINE}
        opacity={0.65}
      />
      {/* Crimson jaw pods at bottom corners */}
      <Polygon
        points="26,51 35,55 39,65 30,62"
        fill={p.lo}
        stroke={p.ink}
        strokeWidth="1.5"
      />
      <Polygon
        points="74,51 65,55 61,65 70,62"
        fill={p.lo}
        stroke={p.ink}
        strokeWidth="1.5"
      />

      {/* 20-26. Contoured brushed gold-titanium faceplate */}
      {/* Shaded gold faceplate bevel */}
      <Path
        d="M32 23 L43 23 L50 30 L57 23 L68 23 L72 39 L66 57 L57 65 L43 65 L34 57 L28 39 Z"
        fill={p.secLo}
        stroke={p.ink}
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      {/* Main brushed gold-titanium faceplate */}
      <Path
        d="M33.5 24.8 L42.5 24.8 L50 31.8 L57.5 24.8 L66.5 24.8 L70 39 L64.5 55.5 L56.5 63 L43.5 63 L35.5 55.5 L30 39 Z"
        fill={p.secMid}
      />
      {/* Upper gold forehead & cheekbone bright plates */}
      <Polygon
        points="34.5,26.5 42,26.5 47.5,32 32.5,36"
        fill={p.secHi}
        opacity={0.88}
      />
      <Polygon
        points="65.5,26.5 58,26.5 52.5,32 67.5,36"
        fill={p.secHi}
        opacity={0.88}
      />
      {/* Sculpted gold cheekbone planes */}
      <Polygon
        points="31.5,43 42,45 44,53 35.5,52"
        fill={p.secHi}
        opacity={0.55}
      />
      <Polygon
        points="68.5,43 58,45 56,53 64.5,52"
        fill={p.secHi}
        opacity={0.55}
      />
      {/* Metallic cheekbone seam lines & angled jaw mouth slit */}
      <Path
        d="M31 44 L41 50 L44 62 M69 44 L59 50 L56 62"
        stroke={p.ink}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity={0.75}
      />
      <Path
        d="M38 56 L44 53.5 L56 53.5 L62 56"
        stroke={p.ink}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Chin red trapezoid plate */}
      <Polygon
        points="44.5,60 55.5,60 53.5,65.5 46.5,65.5"
        fill={p.mid}
        stroke={p.ink}
        strokeWidth="1.5"
      />

      {/* 27-34. Blinding glowing cyan-white LED eyes & brow armor */}
      {/* Outer cyan LED eye halos */}
      <Ellipse cx="39.5" cy="39.5" rx="8.5" ry="4.5" fill={p.detail} opacity={0.42} />
      <Ellipse cx="60.5" cy="39.5" rx="8.5" ry="4.5" fill={p.detail} opacity={0.42} />
      {/* Dark armored eye sockets */}
      <Polygon
        points="31,37 47,39.5 45.5,43.8 32.5,42"
        fill={p.ink}
      />
      <Polygon
        points="69,37 53,39.5 54.5,43.8 67.5,42"
        fill={p.ink}
      />
      {/* Cyan inner optical lenses */}
      <Polygon
        points="32.5,38.2 45.8,40.2 44.5,42.8 33.5,41.2"
        fill={p.eye}
      />
      <Polygon
        points="67.5,38.2 54.2,40.2 55.5,42.8 66.5,41.2"
        fill={p.eye}
      />
      {/* Blinding white LED cores */}
      <Polygon
        points="34.5,39 44,40.4 43.2,41.9 35,40.8"
        fill={HOME_WIDGET_ICON_SHINE}
      />
      <Polygon
        points="65.5,39 56,40.4 56.8,41.9 65,40.8"
        fill={HOME_WIDGET_ICON_SHINE}
      />
      {/* Heavy angled brow armor ridge */}
      <Path
        d="M30.5 36.2 L47.5 39 M69.5 36.2 L52.5 39"
        stroke={p.ink}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </G>
  );
}

/**
 * Baby Groot (`leaf`):
 * AAA 3D claymorphic wooden bust with mossy bark shoulders, walnut-oak
 * sculpted head with jagged tree-crown shoots and carved wood-grain lines,
 * vibrant emerald-lime sprouting leaves with veins & glowing spores, and
 * huge glossy dark puppy eyes with dual catchlights.
 */
export function GrootArt({
  p = CHARACTER_CLAY_PALETTES.leaf,
}: {
  p?: CharacterClayPalette;
}) {
  const barkLight = mix(p.mid, p.hi, 55);
  const barkShadow = mix(p.lo, p.ink, 35);
  const eyeRim = mix(p.mid, p.lo, 50);

  return (
    <G>
      {/* 1. Ground drop shadow */}
      <Ellipse
        cx="50"
        cy="88"
        rx="32"
        ry="6.5"
        fill={HOME_WIDGET_ICON_SHADOW}
        opacity={0.28}
      />

      {/* 2-6. Floating bioluminescent forest spore dots */}
      <Circle cx="18" cy="28" r="2.2" fill={p.blush} opacity={0.85} />
      <Circle cx="18" cy="28" r="1" fill={HOME_WIDGET_ICON_SHINE} />
      <Circle cx="83" cy="24" r="2.4" fill={p.blush} opacity={0.85} />
      <Circle cx="83" cy="24" r="1.1" fill={HOME_WIDGET_ICON_SHINE} />
      <Circle cx="22" cy="15" r="1.6" fill={p.secHi} opacity={0.75} />

      {/* 7-11. Mossy wooden shoulders & chest bark at bottom */}
      <Path
        d="M19 86 C21 72 32 66 50 66 C68 66 79 72 81 86 C72 92 61 94 50 94 C39 94 28 92 19 86 Z"
        fill={p.lo}
        stroke={p.ink}
        strokeWidth="2.4"
      />
      <Path
        d="M22 85 C24 74 34 68 50 68 C66 68 76 74 78 85 C69 90 60 92 50 92 C40 92 31 90 22 85 Z"
        fill={p.mid}
      />
      {/* Carved wood-grain grooves on chest */}
      <Path
        d="M35 70 C34 77 35 84 37 90 M50 69 L50 92 M64 70 C65 77 64 84 62 90"
        stroke={p.lo}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      {/* Lush emerald moss collar vines */}
      <Path
        d="M26 73 C33 78 42 75 50 79 C58 75 67 78 74 73 C70 81 61 84 50 83 C39 84 30 81 26 73 Z"
        fill={p.secMid}
        stroke={p.ink}
        strokeWidth="1.6"
      />
      <Path
        d="M31 75 C38 78 44 77 50 80 C56 77 62 78 69 75"
        stroke={p.secHi}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity={0.85}
      />

      {/* 12-19. Sculpted 3D walnut-oak wooden head with organic tree-crown shoots */}
      <Ellipse
        cx="50"
        cy="69"
        rx="15"
        ry="5"
        fill={HOME_WIDGET_ICON_SHADOW}
        opacity={0.35}
      />
      {/* Shaded wooden head silhouette with jagged top bark crown */}
      <Path
        d="M26 42 L25 23 L33 27 L37 16 L45 24 L50 14 L56 23 L64 15 L68 26 L75 21 L74 42 C76 56 66 69 50 70 C34 69 24 56 26 42 Z"
        fill={p.lo}
        stroke={p.ink}
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      {/* Main warm walnut-oak head fill */}
      <Path
        d="M28 42 L27.2 26.2 L33.5 29.5 L37.5 19.5 L45 26.5 L50 17.5 L55.8 25.8 L63.5 18.5 L67.2 28.5 L72.8 24.5 L72 42 C73.5 54.5 64.5 66.5 50 67.5 C35.5 66.5 26.5 54.5 28 42 Z"
        fill={p.mid}
      />
      {/* Sunlit forehead & crown wooden planks */}
      <Path
        d="M31 38 L30.5 29 L35 31 L38 22.5 L45 28.5 L50 20.5 L55.5 27.5 L62.5 21.5 L66 30.5 L69.5 28 L69 38 C62 34 38 34 31 38 Z"
        fill={barkLight}
      />
      <Ellipse
        cx="50"
        cy="33"
        rx="14"
        ry="5.5"
        fill={p.skinHi}
        opacity={0.55}
      />
      {/* Warm wooden cheek highlights */}
      <Ellipse cx="33" cy="54" rx="5.5" ry="3.8" fill={p.hi} opacity={0.65} />
      <Ellipse cx="67" cy="54" rx="5.5" ry="3.8" fill={p.hi} opacity={0.65} />
      {/* Vertical carved wood-grain lines & bark crevices */}
      <Path
        d="M37 21 L39 36 M45 26 L46 39 M55 26 L54 39 M63 20 L61 36 M31 44 C30 51 32 58 36 63 M69 44 C70 51 68 58 64 63 M45 60 L45 67 M55 60 L55 67"
        stroke={barkShadow}
        strokeWidth="1.7"
        strokeLinecap="round"
        fill="none"
        opacity={0.85}
      />

      {/* 20-26. Lush vibrant emerald-lime sprouting leaves & twigs */}
      {/* Top-left sprouting twig & leaf */}
      <Path
        d="M36 20 Q29 14 24 17"
        stroke={p.lo}
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M32 17 C24 9 14 14 19 23 C24 26 31 23 32 17 Z"
        fill={p.secMid}
        stroke={p.ink}
        strokeWidth="1.8"
      />
      <Path
        d="M30 17 C24 12 18 15 20 20 C24 21 28 20 30 17 Z"
        fill={p.secHi}
        opacity={0.8}
      />
      <Path
        d="M31 17.5 Q24 17.5 19.5 19.5"
        stroke={p.secLo}
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
      />
      {/* Top-right double leaf sprout */}
      <Path
        d="M64 18 C71 8 83 12 79 22 C74 26 66 23 64 18 Z"
        fill={p.secMid}
        stroke={p.ink}
        strokeWidth="1.8"
      />
      <Path
        d="M66 17.5 C71 11 79 13 77 19.5 C73 21.5 68 20 66 17.5 Z"
        fill={p.secHi}
        opacity={0.85}
      />
      <Path
        d="M65 18 Q72 17 77.5 18.5"
        stroke={p.secLo}
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
      />
      {/* Side temple baby leaf bud */}
      <Path
        d="M74 35 C81 31 86 36 81 42 C77 44 74 39 74 35 Z"
        fill={p.detail}
        stroke={p.ink}
        strokeWidth="1.6"
      />

      {/* 27-36. Huge ultra-expressive glossy dark puppy eyes, button nose & sweet smile */}
      {/* Soft green bioluminescent cheek blush */}
      <Ellipse cx="32" cy="55.5" rx="4.5" ry="2.4" fill={p.blush} opacity={0.42} />
      <Ellipse cx="68" cy="55.5" rx="4.5" ry="2.4" fill={p.blush} opacity={0.42} />
      {/* Warm wood eye-socket rims */}
      <Circle cx="38.5" cy="46.5" r="8.4" fill={eyeRim} stroke={p.ink} strokeWidth="1.6" />
      <Circle cx="61.5" cy="46.5" r="8.4" fill={eyeRim} stroke={p.ink} strokeWidth="1.6" />
      {/* Giant glossy dark puppy eyes */}
      <Circle cx="38.5" cy="46.5" r="6.8" fill={p.eye} />
      <Circle cx="61.5" cy="46.5" r="6.8" fill={p.eye} />
      {/* Subtle lower amber iris warmth */}
      <Path
        d="M33.5 49.5 A5.8 5.8 0 0 0 43.5 49.5"
        stroke={p.hi}
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity={0.55}
      />
      <Path
        d="M56.5 49.5 A5.8 5.8 0 0 0 66.5 49.5"
        stroke={p.hi}
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity={0.55}
      />
      {/* Giant primary + secondary white specular catchlights */}
      <Circle cx="36.2" cy="43.8" r="2.5" fill={HOME_WIDGET_ICON_SHINE} />
      <Circle cx="41.2" cy="49.2" r="1.15" fill={HOME_WIDGET_ICON_SHINE} opacity={0.9} />
      <Circle cx="59.2" cy="43.8" r="2.5" fill={HOME_WIDGET_ICON_SHINE} />
      <Circle cx="64.2" cy="49.2" r="1.15" fill={HOME_WIDGET_ICON_SHINE} opacity={0.9} />
      {/* Tiny wooden button nose */}
      <Ellipse
        cx="50"
        cy="51.5"
        rx="2.6"
        ry="1.8"
        fill={p.lo}
        stroke={p.ink}
        strokeWidth="1.2"
      />
      <Ellipse cx="50" cy="51" rx="1.4" ry="0.8" fill={p.hi} opacity={0.8} />
      {/* Sweet happy Baby Groot smile */}
      <Path
        d="M43.5 56.5 Q50 61.5 56.5 56.5"
        stroke={p.ink}
        strokeWidth="2.3"
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M42.5 55.5 Q43.5 57 44.5 56 M57.5 55.5 Q56.5 57 55.5 56"
        stroke={p.ink}
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
    </G>
  );
}

/**
 * Black Panther (`shield`):
 * AAA 3D claymorphic Wakandan bust with obsidian-vibranium shoulders,
 * 5-claw chrome-silver & royal-violet Vibranium Claw Necklace, sleek
 * matte-black & slate-steel panther cowl with pointed ears, glowing
 * violet kinetic energy seams, and fierce angular white vibranium eyes.
 */
export function BlackPantherArt({
  p = CHARACTER_CLAY_PALETTES.shield,
}: {
  p?: CharacterClayPalette;
}) {
  const cowlSlate = mix(p.mid, p.hi, 45);
  const cowlDeep = mix(p.lo, p.ink, 40);

  return (
    <G>
      {/* 1. Ground drop shadow */}
      <Ellipse
        cx="50"
        cy="89"
        rx="34"
        ry="6.8"
        fill={HOME_WIDGET_ICON_SHADOW}
        opacity={0.32}
      />

      {/* 2-6. Sculpted obsidian-vibranium shoulders & royal collar */}
      <Path
        d="M13 86 C15 70 27 64 50 64 C73 64 85 70 87 86 C77 92 64 95 50 95 C36 95 23 92 13 86 Z"
        fill={p.lo}
        stroke={p.ink}
        strokeWidth="2.5"
      />
      <Path
        d="M16 85 C18 72 29 66 50 66 C71 66 82 72 84 85 C74 90 63 93 50 93 C37 93 26 90 16 85 Z"
        fill={p.mid}
      />
      {/* Kinetic purple shoulder armor weave channels */}
      <Path
        d="M19 82 C23 75 30 72 38 71 M81 82 C77 75 70 72 62 71"
        stroke={p.secMid}
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
        opacity={0.85}
      />
      <Path
        d="M22 86 C28 80 35 78 43 78 M78 86 C72 80 65 78 57 78"
        stroke={p.detail}
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity={0.8}
      />

      {/* 7-14. Iconic chrome-silver & violet Vibranium Claw Necklace (5 sculpted teeth) */}
      {/* Necklace kinetic purple collar band */}
      <Path
        d="M27 71 Q50 80 73 71"
        stroke={p.detail}
        strokeWidth="2.6"
        strokeLinecap="round"
        fill="none"
      />
      {/* Left outer claw tooth */}
      <Polygon
        points="27,71 31,73 28,83 25,75"
        fill={p.skinMid}
        stroke={p.ink}
        strokeWidth="1.4"
      />
      {/* Left mid claw tooth */}
      <Polygon
        points="36,74 41,75.5 39,87 35,78"
        fill={p.skinHi}
        stroke={p.ink}
        strokeWidth="1.5"
      />
      {/* Center royal vibranium prime claw tooth */}
      <Polygon
        points="47,75.5 53,75.5 50,90"
        fill={p.skinHi}
        stroke={p.ink}
        strokeWidth="1.6"
      />
      {/* Right mid claw tooth */}
      <Polygon
        points="64,74 59,75.5 61,87 65,78"
        fill={p.skinHi}
        stroke={p.ink}
        strokeWidth="1.5"
      />
      {/* Right outer claw tooth */}
      <Polygon
        points="73,71 69,73 72,83 75,75"
        fill={p.skinMid}
        stroke={p.ink}
        strokeWidth="1.4"
      />
      {/* Glowing violet kinetic notches on claw bases */}
      <Path
        d="M28.5 73 L28 76 M38.5 75.5 L38.5 79 M50 76.5 L50 81 M61.5 75.5 L61.5 79 M71.5 73 L72 76"
        stroke={p.secMid}
        strokeWidth="1.6"
        strokeLinecap="round"
      />

      {/* 15-20. Sculpted pointed panther ears */}
      {/* Left panther ear */}
      <Polygon
        points="25,31 23,12 38,21"
        fill={p.lo}
        stroke={p.ink}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <Polygon points="26.5,28 25.5,16 35,22" fill={p.hi} />
      <Polygon points="28,27 27,19 33,23" fill={p.secHi} opacity={0.75} />
      {/* Right panther ear */}
      <Polygon
        points="75,31 77,12 62,21"
        fill={p.lo}
        stroke={p.ink}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <Polygon points="73.5,28 74.5,16 65,22" fill={p.hi} />
      <Polygon points="72,27 73,19 67,23" fill={p.secHi} opacity={0.75} />

      {/* 21-26. Sleek 3D matte-black & slate-steel panther cowl */}
      <Ellipse
        cx="50"
        cy="68"
        rx="16"
        ry="5.5"
        fill={HOME_WIDGET_ICON_SHADOW}
        opacity={0.4}
      />
      {/* Outer obsidian cowl silhouette */}
      <Path
        d="M50 14 C30 14 23 27 24 44 C25 57 34 69 50 72 C66 69 75 57 76 44 C77 27 70 14 50 14 Z"
        fill={p.lo}
        stroke={p.ink}
        strokeWidth="2.6"
      />
      {/* Mid slate-steel sculpted cowl volume */}
      <Path
        d="M50 16 C32 16 25.5 28 26.5 43.5 C27.5 55.5 35.5 66.5 50 69.5 C64.5 66.5 72.5 55.5 73.5 43.5 C74.5 28 68 16 50 16 Z"
        fill={p.mid}
      />
      {/* Sculpted panther nose bridge & forehead crown plane */}
      <Polygon
        points="43,17 57,17 54,49 50,54 46,49"
        fill={cowlSlate}
      />
      <Polygon
        points="45,18.5 55,18.5 52.5,35 47.5,35"
        fill={p.hi}
        opacity={0.85}
      />
      {/* Angular dark muzzle & chin facet */}
      <Polygon
        points="35,51 46,49 50,54 54,49 65,51 59,66 50,70 41,66"
        fill={cowlDeep}
        stroke={p.ink}
        strokeWidth="1.5"
      />

      {/* 27-32. Glowing royal-violet kinetic energy seams & silver vibranium accents */}
      {/* Forehead kinetic V-chevrons */}
      <Path
        d="M42 20 L50 28 L58 20 M40 26 L50 35 L60 26"
        stroke={p.detail}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M42 20 L50 28 L58 20"
        stroke={p.secHi}
        strokeWidth="0.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Cheekbone & jawline glowing kinetic purple channels */}
      <Path
        d="M27 42 L36 49 L42 64 M73 42 L64 49 L58 64"
        stroke={p.secMid}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M27 42 L36 49 L42 64 M73 42 L64 49 L58 64"
        stroke={p.secHi}
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Chrome-silver cheekbone & chin tribal dot studs */}
      <Line
        x1="31"
        y1="52"
        x2="38"
        y2="61"
        stroke={p.skinMid}
        strokeWidth="1.6"
        strokeDasharray="2 3"
        strokeLinecap="round"
      />
      <Line
        x1="69"
        y1="52"
        x2="62"
        y2="61"
        stroke={p.skinMid}
        strokeWidth="1.6"
        strokeDasharray="2 3"
        strokeLinecap="round"
      />

      {/* 33-38. Fierce angular white vibranium-lens eyes & silver-chrome brow ridges */}
      {/* Silver-chrome upper brow armor ridges */}
      <Path
        d="M29 36.5 L45 41.5 M71 36.5 L55 41.5"
        stroke={p.skinMid}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      {/* Left angular eye frame & white vibranium lens */}
      <Polygon
        points="30,38.5 45.5,42.8 42.5,47.5 32,44.5"
        fill={p.ink}
      />
      <Polygon
        points="31.5,39.8 44,43.2 41.8,46.2 33,43.8"
        fill={p.skinMid}
      />
      <Polygon
        points="32.5,40.3 42.5,43.1 41,45.2 33.8,43.2"
        fill={HOME_WIDGET_ICON_SHINE}
      />
      {/* Right angular eye frame & white vibranium lens */}
      <Polygon
        points="70,38.5 54.5,42.8 57.5,47.5 68,44.5"
        fill={p.ink}
      />
      <Polygon
        points="68.5,39.8 56,43.2 58.2,46.2 67,43.8"
        fill={p.skinMid}
      />
      <Polygon
        points="67.5,40.3 57.5,43.1 59,45.2 66.2,43.2"
        fill={HOME_WIDGET_ICON_SHINE}
      />
    </G>
  );
}

export function renderMarvelMotif(motif: MarvelMotif): React.ReactNode {
  switch (motif) {
    case "web":
      return <SpiderManArt />;
    case "arc":
      return <IronManArt />;
    case "leaf":
      return <GrootArt />;
    case "shield":
      return <BlackPantherArt />;
  }
}

export default renderMarvelMotif;
