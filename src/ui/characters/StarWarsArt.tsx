import React from "react";
import { Circle, Ellipse, G, Line, Path, Polygon, Rect } from "react-native-svg";
import {
  CHARACTER_CLAY_PALETTES,
  HOME_WIDGET_ICON_SHADOW,
  HOME_WIDGET_ICON_SHINE,
  type CharacterClayPalette,
} from "../../theme/materials";
import { mix } from "../../theme/mix";

export type StarWarsMotif = "force" | "droid" | "helmet";

/**
 * Grogu (Baby Yoda): 3D Claymorphic collectible figure in medallion viewBox 0 0 100 100
 */
export function GroguArt({ p = CHARACTER_CLAY_PALETTES.force }: { p?: CharacterClayPalette }) {
  const cloakCream = mix(p.secHi, HOME_WIDGET_ICON_SHINE, 35);
  const earPeachShadow = mix(p.blush, p.lo, 30);
  const eyelidTone = mix(p.mid, p.lo, 45);
  const forceRing = mix(p.glow, HOME_WIDGET_ICON_SHINE, 40);

  return (
    <G>
      {/* Ambient ground drop shadow */}
      <Ellipse cx="50" cy="88" rx="33" ry="7.5" fill={HOME_WIDGET_ICON_SHADOW} opacity={0.28} />

      {/* Levitating Razor Crest shift-knob sphere with Force halo */}
      <G>
        <Circle cx="82" cy="21" r="10.5" fill={p.glow} opacity={0.24} />
        <Circle
          cx="82"
          cy="21"
          r="8.2"
          fill="none"
          stroke={forceRing}
          strokeWidth="1.2"
          strokeDasharray="3 2"
          opacity={0.75}
        />
        <Circle
          cx="82"
          cy="21.5"
          r="5.6"
          fill={p.lo}
          stroke={p.ink}
          strokeWidth="1.4"
        />
        <Circle cx="82" cy="21" r="5" fill={p.detail} />
        <Path
          d="M78.2 19a4.5 4.5 0 0 1 7.6 0c-1.8-1.2-5.8-1.2-7.6 0Z"
          fill={HOME_WIDGET_ICON_SHINE}
          opacity={0.85}
        />
        <Circle cx="80.2" cy="18.8" r="1.4" fill={HOME_WIDGET_ICON_SHINE} opacity={0.95} />
        {/* Force sparkle motes */}
        <Circle cx="71" cy="26" r="1.3" fill={forceRing} opacity={0.85} />
        <Circle cx="89" cy="12" r="1.1" fill={HOME_WIDGET_ICON_SHINE} opacity={0.8} />
        <Circle cx="73" cy="13" r="0.9" fill={p.glow} opacity={0.9} />
      </G>

      {/* Enormous wide-set expressive pointed green ears (x=2..30 and x=70..98) */}
      {/* Left Ear */}
      <G>
        {/* Outer ear drop shadow & base */}
        <Path
          d="M31 41C19 37 8 39 2.5 44.5 6.5 53 16 58.5 31 56.5Z"
          fill={p.lo}
          stroke={p.ink}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        {/* Sculpted mid-tone ear body */}
        <Path
          d="M31 41.5C19.5 38 9.2 39.8 4 44.6c3.8 7.2 12.6 12 27 10.6Z"
          fill={p.mid}
        />
        {/* Upper ear cartilage ridge highlight */}
        <Path
          d="M30.5 42C20 38.8 10.5 40.2 4.8 44.3c4.8-1.8 14.2-1.8 25.2 1.2Z"
          fill={p.hi}
          opacity={0.9}
        />
        {/* Soft translucent rosy-pink inner ear hollow */}
        <Path
          d="M29.5 45.2C20.5 43.2 12 44.5 7.2 47.2c3.6 4.8 11.2 7.8 22.3 6.8Z"
          fill={earPeachShadow}
        />
        <Path
          d="M29.5 45.8C21 44 13.2 45 8.5 47.4c3.2 3.8 10 6.2 21 5.5Z"
          fill={p.blush}
          opacity={0.88}
        />
        {/* Inner ear crease line */}
        <Path
          d="M28.5 48.5c-6.5-0.8-12.5 0-16.8 1.6"
          stroke={p.lo}
          strokeWidth="1.1"
          strokeLinecap="round"
          fill="none"
          opacity={0.55}
        />
      </G>

      {/* Right Ear */}
      <G>
        {/* Outer ear drop shadow & base */}
        <Path
          d="M69 41c12-4 23-2 28.5 3.5-4 8.5-13.5 14-28.5 12Z"
          fill={p.lo}
          stroke={p.ink}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        {/* Sculpted mid-tone ear body */}
        <Path
          d="M69 41.5c11.5-3.5 21.8-1.7 27 3.1-3.8 7.2-12.6 12-27 10.6Z"
          fill={p.mid}
        />
        {/* Upper ear cartilage ridge highlight */}
        <Path
          d="M69.5 42c10.5-3.2 20-1.8 25.7 2.3-4.8-1.8-14.2-1.8-25.2 1.2Z"
          fill={p.hi}
          opacity={0.9}
        />
        {/* Soft translucent rosy-pink inner ear hollow */}
        <Path
          d="M70.5 45.2c9-2 17.5-0.7 22.3 2-3.6 4.8-11.2 7.8-22.3 6.8Z"
          fill={earPeachShadow}
        />
        <Path
          d="M70.5 45.8c8.5-1.8 16.3-0.8 21 1.6-3.2 3.8-10 6.2-21 5.5Z"
          fill={p.blush}
          opacity={0.88}
        />
        {/* Inner ear crease line */}
        <Path
          d="M71.5 48.5c6.5-0.8 12.5 0 16.8 1.6"
          stroke={p.lo}
          strokeWidth="1.1"
          strokeLinecap="round"
          fill="none"
          opacity={0.55}
        />
      </G>

      {/* Sculpted 3D sage-pistachio baby head */}
      <G>
        {/* Wispy white fuzz highlights at the crown */}
        <Path
          d="M45 25.5c-1.2-2.6-0.4-4.2 1.2-5.2M50 24.8c0-2.8 1-4.5 2.5-5.2M55 25.8c1.4-2.4 2.8-3.5 4.2-3.8"
          stroke={HOME_WIDGET_ICON_SHINE}
          strokeWidth="1.3"
          strokeLinecap="round"
          opacity={0.65}
        />
        {/* Head base shadow */}
        <Ellipse
          cx="50"
          cy="46.5"
          rx="23.5"
          ry="19.5"
          fill={p.lo}
          stroke={p.ink}
          strokeWidth="2"
        />
        {/* Main sculpted green cranium & cheeks */}
        <Ellipse cx="50" cy="45.2" rx="22.4" ry="18.2" fill={p.mid} />
        {/* Broad forehead & cheek volume highlight */}
        <Path
          d="M31 39.5c2.5-9.2 11-14.2 19-14.2s16.5 5 19 14.2c-5.5-4.2-12-5.5-19-5.5s-13.5 1.3-19 5.5Z"
          fill={p.skinHi}
          opacity={0.88}
        />
        <Ellipse cx="50" cy="33.5" rx="12.5" ry="5.2" fill={HOME_WIDGET_ICON_SHINE} opacity={0.32} />

        {/* Cute sculpted forehead wrinkles & brow furrows */}
        <Path
          d="M41.5 32.2c2.8-1.3 14.2-1.3 17 0"
          stroke={p.lo}
          strokeWidth="1.3"
          strokeLinecap="round"
          fill="none"
          opacity={0.65}
        />
        <Path
          d="M44 35c2-0.9 10-0.9 12 0"
          stroke={p.lo}
          strokeWidth="1.2"
          strokeLinecap="round"
          fill="none"
          opacity={0.55}
        />
        {/* Soft brow arches */}
        <Path
          d="M34.5 39.2c3.2-2.2 7.8-2.2 10.8-0.4M54.7 38.8c3-1.8 7.6-1.8 10.8 0.4"
          stroke={p.lo}
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
          opacity={0.7}
        />

        {/* Rosy cheeks */}
        <Ellipse cx="34.5" cy="52.5" rx="4.6" ry="2.7" fill={p.blush} opacity={0.42} />
        <Ellipse cx="65.5" cy="52.5" rx="4.6" ry="2.7" fill={p.blush} opacity={0.42} />

        {/* Huge, soulful glossy dark eyes with warm lower eyelids */}
        {/* Left Eye */}
        <Ellipse cx="39.5" cy="46.5" rx="6.6" ry="6.2" fill={eyelidTone} />
        <Circle
          cx="39.5"
          cy="46"
          r="5.8"
          fill={p.eye}
          stroke={p.ink}
          strokeWidth="1.5"
        />
        <Circle cx="39.5" cy="46" r="4.2" fill={p.ink} />
        {/* Left eye oversized primary + secondary specular catchlights */}
        <Circle cx="37.6" cy="43.8" r="2.1" fill={HOME_WIDGET_ICON_SHINE} opacity={0.96} />
        <Circle cx="41.6" cy="47.8" r="1.05" fill={HOME_WIDGET_ICON_SHINE} opacity={0.85} />
        <Path
          d="M33.8 49.2c2.2 2 8.8 2 11.2 0"
          stroke={p.skinMid}
          strokeWidth="1.3"
          strokeLinecap="round"
          fill="none"
          opacity={0.85}
        />

        {/* Right Eye */}
        <Ellipse cx="60.5" cy="46.5" rx="6.6" ry="6.2" fill={eyelidTone} />
        <Circle
          cx="60.5"
          cy="46"
          r="5.8"
          fill={p.eye}
          stroke={p.ink}
          strokeWidth="1.5"
        />
        <Circle cx="60.5" cy="46" r="4.2" fill={p.ink} />
        {/* Right eye oversized primary + secondary specular catchlights */}
        <Circle cx="58.6" cy="43.8" r="2.1" fill={HOME_WIDGET_ICON_SHINE} opacity={0.96} />
        <Circle cx="62.6" cy="47.8" r="1.05" fill={HOME_WIDGET_ICON_SHINE} opacity={0.85} />
        <Path
          d="M55 49.2c2.4 2 9 2 11.2 0"
          stroke={p.skinMid}
          strokeWidth="1.3"
          strokeLinecap="round"
          fill="none"
          opacity={0.85}
        />

        {/* Tiny sculpted button nose */}
        <Ellipse cx="50" cy="50.2" rx="2.6" ry="1.8" fill={p.lo} opacity={0.75} />
        <Ellipse cx="50" cy="49.7" rx="2.2" ry="1.4" fill={p.skinMid} />
        <Ellipse cx="49.5" cy="49.3" rx="1" ry="0.6" fill={HOME_WIDGET_ICON_SHINE} opacity={0.65} />

        {/* Sweet contented Grogu smile & sculpted chin dimple */}
        <Path
          d="M45.2 54.2c2.2 2 7.4 2 9.6 0"
          stroke={p.ink}
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d="M47.8 56.8c1.2 0.7 3.2 0.7 4.4 0"
          stroke={p.lo}
          strokeWidth="1.1"
          strokeLinecap="round"
          fill="none"
          opacity={0.6}
        />
      </G>

      {/* Cozy oversized oatmeal-tan woven Jedi cloak & thick fleecy rolled collar at bottom */}
      <G>
        {/* Outer cloak body */}
        <Path
          d="M21 66c2-5.5 9-9 29-9s27 3.5 29 9l4 18c-8 5.5-21 7.5-33 7.5S25 89.5 17 84Z"
          fill={p.secLo}
          stroke={p.ink}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {/* Mid-tone woven cloak folds */}
        <Path
          d="M22.5 67c2.2-4.8 9.5-7.8 27.5-7.8s25.3 3 27.5 7.8l3.2 15.8c-7.5 4.8-19.5 6.6-30.7 6.6s-23.2-1.8-30.7-6.6Z"
          fill={p.secMid}
        />
        {/* Cloak crossover seam & fabric drapery */}
        <Path
          d="M36 69l18 20M64 68l-10 11"
          stroke={p.secLo}
          strokeWidth="2.2"
          strokeLinecap="round"
          opacity={0.75}
        />
        {/* Thick fleecy rolled collar ring */}
        <Path
          d="M23 61.5c0-4.2 8.5-6.5 27-6.5s27 2.3 27 6.5c0 5.5-9.5 9.5-27 9.5s-27-4-27-9.5Z"
          fill={p.secLo}
          stroke={p.ink}
          strokeWidth="1.9"
        />
        <Path
          d="M24.5 60.8c0-3.6 8.2-5.5 25.5-5.5s25.5 1.9 25.5 5.5c0 4.6-8.8 8-25.5 8s-25.5-3.4-25.5-8Z"
          fill={p.secHi}
        />
        {/* Fluffy collar top highlight & seam folds */}
        <Path
          d="M28 59.2c5.5-2.6 14-3.2 22-3.2s16.5 0.6 22 3.2c-5.5 1.8-13.5 2.5-22 2.5s-16.5-0.7-22-2.5Z"
          fill={cloakCream}
          opacity={0.92}
        />
        <Path
          d="M33 58.5c1.5 3.2 3 6.2 4.5 8.2M67 58.5c-1.5 3.2-3 6.2-4.5 8.2M50 60.5v7.5"
          stroke={p.secMid}
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity={0.65}
        />

        {/* Tiny 3D green three-fingered hand peeking over the cloak */}
        <Ellipse
          cx="34"
          cy="72.5"
          rx="4.8"
          ry="3.6"
          fill={p.mid}
          stroke={p.ink}
          strokeWidth="1.5"
        />
        <Circle cx="31.8" cy="70.8" r="1.5" fill={p.skinHi} />
        <Circle cx="34.2" cy="70.3" r="1.5" fill={p.skinHi} />
        <Circle cx="36.5" cy="71" r="1.4" fill={p.skinHi} />
      </G>
    </G>
  );
}

/**
 * R2-D2: 3D Claymorphic astromech droid figure in medallion viewBox 0 0 100 100
 */
export function R2D2Art({ p = CHARACTER_CLAY_PALETTES.droid }: { p?: CharacterClayPalette }) {
  const silverMid = mix(p.skinMid, p.lo, 28);
  const domeRim = mix(p.lo, p.ink, 35);
  const holoBeam = mix(p.glow, HOME_WIDGET_ICON_SHINE, 35);

  return (
    <G>
      {/* Ground drop shadow */}
      <Ellipse cx="50" cy="89" rx="32" ry="7" fill={HOME_WIDGET_ICON_SHADOW} opacity={0.28} />

      {/* Twin outer articulated droid legs & shoulders */}
      {/* Left Droid Leg */}
      <G>
        <Rect
          x="15"
          y="46"
          width="11"
          height="39"
          rx="5"
          fill={p.lo}
          stroke={p.ink}
          strokeWidth="1.9"
        />
        <Rect x="16.2" y="47" width="8.5" height="36.5" rx="4" fill={p.mid} />
        <Rect x="17.2" y="48.5" width="3.2" height="33" rx="1.6" fill={p.hi} opacity={0.9} />
        {/* Shoulder pivot hub & vertical cobalt stripe */}
        <Circle
          cx="20.5"
          cy="52.5"
          r="3.8"
          fill={silverMid}
          stroke={p.ink}
          strokeWidth="1.4"
        />
        <Circle cx="20.5" cy="52.5" r="1.6" fill={p.hi} />
        <Rect x="18.5" y="59" width="4" height="16" rx="1.5" fill={p.secMid} />
        <Rect x="19" y="60" width="1.5" height="14" rx="0.75" fill={p.secHi} opacity={0.85} />
        {/* Left trapezoidal foot */}
        <Polygon
          points="12,86 28,86 25.5,79 14.5,79"
          fill={p.mid}
          stroke={p.ink}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <Line x1="14.5" y1="83.5" x2="25.5" y2="83.5" stroke={p.lo} strokeWidth="1.5" />
      </G>

      {/* Right Droid Leg */}
      <G>
        <Rect
          x="74"
          y="46"
          width="11"
          height="39"
          rx="5"
          fill={p.lo}
          stroke={p.ink}
          strokeWidth="1.9"
        />
        <Rect x="75.2" y="47" width="8.5" height="36.5" rx="4" fill={p.mid} />
        <Rect x="76.2" y="48.5" width="3.2" height="33" rx="1.6" fill={p.hi} opacity={0.9} />
        {/* Shoulder pivot hub & vertical cobalt stripe */}
        <Circle
          cx="79.5"
          cy="52.5"
          r="3.8"
          fill={silverMid}
          stroke={p.ink}
          strokeWidth="1.4"
        />
        <Circle cx="79.5" cy="52.5" r="1.6" fill={p.hi} />
        <Rect x="77.5" y="59" width="4" height="16" rx="1.5" fill={p.secMid} />
        <Rect x="78" y="60" width="1.5" height="14" rx="0.75" fill={p.secHi} opacity={0.85} />
        {/* Right trapezoidal foot */}
        <Polygon
          points="72,86 88,86 85.5,79 74.5,79"
          fill={p.mid}
          stroke={p.ink}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <Line x1="74.5" y1="83.5" x2="85.5" y2="83.5" stroke={p.lo} strokeWidth="1.5" />
      </G>

      {/* Cylindrical white astromech barrel torso */}
      <G>
        <Path
          d="M26 45h48v35c0 4.5-8.5 7.5-24 7.5S26 84.5 26 80Z"
          fill={p.lo}
          stroke={p.ink}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <Path
          d="M27.5 46h45v33.2c0 3.8-7.8 6.3-22.5 6.3s-22.5-2.5-22.5-6.3Z"
          fill={p.mid}
        />
        {/* Cylindrical highlight column on left-center of barrel */}
        <Path
          d="M30 46h15v38.5c-6.5-0.6-12.5-2.4-15-5Z"
          fill={p.hi}
          opacity={0.92}
        />

        {/* Horizontal cobalt-blue data vents & silver utility arm latches */}
        <Rect x="37" y="49" width="26" height="4.2" rx="1.8" fill={p.secLo} stroke={p.ink} strokeWidth="1.2" />
        <Rect x="38" y="49.6" width="24" height="2.8" rx="1.2" fill={p.secMid} />
        <Rect x="39" y="50" width="10" height="1.2" rx="0.6" fill={p.secHi} opacity={0.9} />

        <Rect x="37" y="55.5" width="26" height="4.2" rx="1.8" fill={p.secLo} stroke={p.ink} strokeWidth="1.2" />
        <Rect x="38" y="56.1" width="24" height="2.8" rx="1.2" fill={p.secMid} />
        <Rect x="39" y="56.5" width="10" height="1.2" rx="0.6" fill={p.secHi} opacity={0.9} />

        {/* Side vertical silver vents */}
        <Rect x="29.5" y="50" width="4.5" height="24" rx="1.5" fill={p.skinMid} stroke={p.lo} strokeWidth="1" />
        <Rect x="66" y="50" width="4.5" height="24" rx="1.5" fill={p.skinMid} stroke={p.lo} strokeWidth="1" />

        {/* Octagonal blue & silver central chest port */}
        <Rect
          x="39"
          y="62.5"
          width="22"
          height="14.5"
          rx="3"
          fill={p.secLo}
          stroke={p.ink}
          strokeWidth="1.4"
        />
        <Rect x="40.2" y="63.7" width="19.6" height="12.1" rx="2.2" fill={p.secMid} />
        <Circle cx="46" cy="69.8" r="3.4" fill={p.skinMid} stroke={p.ink} strokeWidth="1.2" />
        <Circle cx="46" cy="69.8" r="1.5" fill={p.hi} />
        <Rect x="52" y="66.5" width="5.5" height="6.5" rx="1.2" fill={p.secHi} opacity={0.85} />
      </G>

      {/* Iconic 3D brushed-silver hemispherical dome head */}
      <G>
        {/* Dome base shadow & hemisphere */}
        <Path
          d="M25 45.5C25 26.5 36 16 50 16s25 10.5 25 29.5Z"
          fill={p.lo}
          stroke={p.ink}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <Path
          d="M26.5 45C26.5 27.5 36.8 17.5 50 17.5S73.5 27.5 73.5 45Z"
          fill={p.skinMid}
        />
        {/* Metallic dome upper highlight & curved specular reflection arc */}
        <Path
          d="M29 44.5C29 29 37.5 19 50 19c7.5 0 13.8 4.2 17.5 11.2-6.5-5.2-15.5-6.5-24.5-3.2-7.2 2.6-11.8 9.2-14 17.5Z"
          fill={p.hi}
          opacity={0.92}
        />
        <Path
          d="M34 27.5A18 18 0 0 1 56 21"
          stroke={HOME_WIDGET_ICON_SHINE}
          strokeWidth="2.6"
          strokeLinecap="round"
          fill="none"
          opacity={0.92}
        />

        {/* Upper cobalt-blue dome panels */}
        <Path
          d="M30.5 32.5c2.2-4.8 5.8-8.2 10.2-10l2.2 6.8c-3.8 1.4-6.8 4-8.6 7.4Z"
          fill={p.secMid}
          stroke={p.ink}
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <Path
          d="M69.5 32.5c-2.2-4.8-5.8-8.2-10.2-10l-2.2 6.8c3.8 1.4 6.8 4 8.6 7.4Z"
          fill={p.secMid}
          stroke={p.ink}
          strokeWidth="1.2"
          strokeLinejoin="round"
        />

        {/* Large glossy black primary radar eye housing */}
        <Rect
          x="43.5"
          y="22.5"
          width="13"
          height="11.5"
          rx="3"
          fill={p.secLo}
          stroke={p.ink}
          strokeWidth="1.5"
        />
        <Rect x="44.5" y="23.3" width="11" height="9.8" rx="2.2" fill={p.secMid} />
        <Circle
          cx="50"
          cy="28.2"
          r="4.2"
          fill={p.eye}
          stroke={p.ink}
          strokeWidth="1.4"
        />
        <Circle cx="48.5" cy="26.8" r="1.6" fill={HOME_WIDGET_ICON_SHINE} opacity={0.95} />
        <Circle cx="51.4" cy="29.6" r="0.7" fill={p.glow} opacity={0.85} />

        {/* Lower dome ring cobalt-blue panels */}
        <Rect x="28.5" y="37" width="8.5" height="5.5" rx="1.3" fill={p.secMid} stroke={p.ink} strokeWidth="1.2" />
        <Rect x="39" y="37" width="7" height="5.5" rx="1.3" fill={p.secMid} stroke={p.ink} strokeWidth="1.2" />
        <Rect x="63" y="37" width="8.5" height="5.5" rx="1.3" fill={p.secMid} stroke={p.ink} strokeWidth="1.2" />

        {/* Glowing crimson & amber logic display indicator */}
        <Circle
          cx="51"
          cy="39.8"
          r="2.8"
          fill={p.detail}
          stroke={p.ink}
          strokeWidth="1.2"
        />
        <Circle cx="50.3" cy="39" r="1.1" fill={p.blush} />
        <Circle cx="50" cy="38.8" r="0.6" fill={HOME_WIDGET_ICON_SHINE} />

        {/* Silver holoprojector nozzle with faint cyan holographic beam glint */}
        <Circle
          cx="58.2"
          cy="39.8"
          r="2.9"
          fill={p.skinHi}
          stroke={p.ink}
          strokeWidth="1.3"
        />
        <Circle cx="58.2" cy="39.8" r="1.4" fill={p.glow} />
        <Polygon
          points="58.2,39.8 66,33 68,38.5"
          fill={holoBeam}
          opacity={0.42}
        />

        {/* Dark metallic base ring under dome */}
        <Rect
          x="24.5"
          y="43.5"
          width="51"
          height="3.2"
          rx="1.6"
          fill={domeRim}
          stroke={p.ink}
          strokeWidth="1.5"
        />
        <Line x1="28" y1="45" x2="72" y2="45" stroke={p.skinHi} strokeWidth="1" opacity={0.65} />
      </G>
    </G>
  );
}

/**
 * The Mandalorian (Din Djarin): 3D Claymorphic Beskar helmet & pauldrons in medallion viewBox 0 0 100 100
 */
export function MandalorianArt({ p = CHARACTER_CLAY_PALETTES.helmet }: { p?: CharacterClayPalette }) {
  const beskarDark = mix(p.lo, p.ink, 38);
  const beskarBright = mix(p.hi, HOME_WIDGET_ICON_SHINE, 45);
  const copperGlow = mix(p.secHi, HOME_WIDGET_ICON_SHINE, 30);

  return (
    <G>
      {/* Ground drop shadow */}
      <Ellipse cx="50" cy="89" rx="34" ry="7" fill={HOME_WIDGET_ICON_SHADOW} opacity={0.3} />

      {/* Armored Beskar shoulder pauldrons & dark bandolier chest */}
      <G>
        {/* Chest & cape base */}
        <Path
          d="M17 75c5-8 16-12 33-12s28 4 33 12l3 11c-9 4.5-22 6.5-36 6.5S23 90.5 14 86Z"
          fill={beskarDark}
          stroke={p.ink}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {/* Left brushed-steel Beskar shoulder pauldron */}
        <Path
          d="M13 78c1.5-9.5 8.5-15 20-16.5l3 14.5c-8 1.5-15.5 4.5-21 8Z"
          fill={p.lo}
          stroke={p.ink}
          strokeWidth="1.9"
          strokeLinejoin="round"
        />
        <Path
          d="M14.8 77c1.5-7.8 7.5-12.5 17.2-13.8l2 11.2c-6.8 1.2-13.2 3.5-19.2 6.2Z"
          fill={p.mid}
        />
        <Path
          d="M17 72.5c2.2-4.8 6.8-7.8 13.5-8.8"
          stroke={p.hi}
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          opacity={0.85}
        />

        {/* Right warm copper-orange Mudhorn signet pauldron */}
        <Path
          d="M87 78c-1.5-9.5-8.5-15-20-16.5L64 76c8 1.5 15.5 4.5 21 8Z"
          fill={p.secLo}
          stroke={p.ink}
          strokeWidth="1.9"
          strokeLinejoin="round"
        />
        <Path
          d="M85.2 77c-1.5-7.8-7.5-12.5-17.2-13.8L66 74.4c6.8 1.2 13.2 3.5 19.2 6.2Z"
          fill={p.secMid}
        />
        <Path
          d="M83 72.5c-2.2-4.8-6.8-7.8-13.5-8.8"
          stroke={p.secHi}
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
          opacity={0.9}
        />
        {/* Stylized Mudhorn horn crest glint on right pauldron */}
        <Path
          d="M72 72.5c2.8-0.5 5.2-2.2 6.2-4.5 0.5 2.5-1.2 5.2-4.8 6Z"
          fill={copperGlow}
          opacity={0.88}
        />

        {/* Dark leather bandolier strap & silver ammo canisters */}
        <Path
          d="M34 66l24 23"
          stroke={p.ink}
          strokeWidth="6"
          strokeLinecap="round"
        />
        <Path
          d="M34 66l24 23"
          stroke={p.secLo}
          strokeWidth="3.6"
          strokeLinecap="round"
        />
        <Rect
          x="40"
          y="71"
          width="5.5"
          height="3"
          rx="1"
          rotation="-42"
          origin="42.5, 72.5"
          fill={p.hi}
          stroke={p.ink}
          strokeWidth="1"
        />
        <Rect
          x="46"
          y="77"
          width="5.5"
          height="3"
          rx="1"
          rotation="-42"
          origin="48.5, 78.5"
          fill={p.hi}
          stroke={p.ink}
          strokeWidth="1"
        />
      </G>

      {/* Sculpted 3D polished Beskar Chrome helmet */}
      <G>
        {/* Angular temple ear-caps / rangefinder mounts */}
        <Rect
          x="23.5"
          y="40"
          width="5"
          height="19"
          rx="2"
          fill={p.skinLo}
          stroke={p.ink}
          strokeWidth="1.7"
        />
        <Rect x="24.5" y="41.5" width="2.5" height="16" rx="1" fill={p.mid} />
        <Rect
          x="71.5"
          y="40"
          width="5"
          height="19"
          rx="2"
          fill={p.skinLo}
          stroke={p.ink}
          strokeWidth="1.7"
        />
        <Rect x="73" y="41.5" width="2.5" height="16" rx="1" fill={p.mid} />

        {/* Outer Beskar helmet silhouette (slate shadow base) */}
        <Path
          d="M27 42C27 23.5 36.5 14 50 14s23 9.5 23 28v21.5L63.5 74.5H36.5L27 63.5Z"
          fill={p.lo}
          stroke={p.ink}
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        {/* Mid-tone brushed steel helmet shell */}
        <Path
          d="M28.5 42C28.5 24.8 37.5 15.8 50 15.8S71.5 24.8 71.5 42v20.5L62.8 72.8H37.2L28.5 62.5Z"
          fill={p.mid}
        />
        {/* Chrome highlight across upper dome & brow */}
        <Path
          d="M30.5 38.5C31.2 24.5 39 17 50 17s18.8 7.5 19.5 21.5c-6-3.2-12.5-4.5-19.5-4.5s-13.5 1.3-19.5 4.5Z"
          fill={p.hi}
          opacity={0.92}
        />

        {/* Bright vertical specular reflection streak on left dome */}
        <Path
          d="M35.5 22.5c-2.5 4.5-3.8 10-4 15.5 2.5-1.4 5.2-2.4 8.2-3 0.2-5.5 1.5-10.5 3.8-14.8-3.2 0.5-5.8 1.3-8 2.3Z"
          fill={HOME_WIDGET_ICON_SHINE}
          opacity={0.78}
        />

        {/* Raised central forehead mohawk ridge & crown bevel */}
        <Polygon
          points="46.5,14.8 53.5,14.8 52.5,35.5 47.5,35.5"
          fill={p.skinHi}
          stroke={p.lo}
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <Line x1="49" y1="16" x2="48.5" y2="34.5" stroke={HOME_WIDGET_ICON_SHINE} strokeWidth="1.4" opacity={0.85} />

        {/* Deeply recessed slate-steel cheek hollows with sharp metallic bevels */}
        {/* Left cheek hollow */}
        <Polygon
          points="29,46.5 44.5,48.5 44.5,72 37,72 29,62.5"
          fill={p.skinLo}
          stroke={p.ink}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <Polygon
          points="30.2,48 43.2,49.8 43.2,70.8 37.5,70.8 30.2,62"
          fill={p.lo}
        />
        {/* Left cheek sharp metallic bevel ridge */}
        <PolylinePoints
          d="M29.5 46.2L44.8 48.2L44.8 72"
          stroke={beskarBright}
          strokeWidth="1.6"
        />

        {/* Right cheek hollow */}
        <Polygon
          points="71,46.5 55.5,48.5 55.5,72 63,72 71,62.5"
          fill={p.skinLo}
          stroke={p.ink}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <Polygon
          points="69.8,48 56.8,49.8 56.8,70.8 62.5,70.8 69.8,62"
          fill={p.lo}
        />
        {/* Right cheek sharp metallic bevel ridge */}
        <PolylinePoints
          d="M70.5 46.2L55.2 48.2L55.2 72"
          stroke={p.hi}
          strokeWidth="1.6"
        />

        {/* Crisp silver-white bevel rim framing the T-shaped visor */}
        <Polygon
          points="28.5,38 71.5,38 69.5,45.8 55,47.5 54.2,73.2 45.8,73.2 45,47.5 30.5,45.8"
          fill={p.skinHi}
          stroke={p.ink}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {/* Iconic pitch-black T-shaped visor */}
        <Polygon
          points="30.2,39.4 69.8,39.4 68.2,44.4 53.4,46.2 52.6,72 47.4,72 46.6,46.2 31.8,44.4"
          fill={p.ink}
        />

        {/* Subtle diagonal glass reflection glints across the T-visor */}
        <Polygon
          points="34,39.6 41,39.6 38,44.6 31.8,43.9"
          fill={HOME_WIDGET_ICON_SHINE}
          opacity={0.45}
        />
        <Polygon
          points="48,50 52,47.5 52,55 48,57.5"
          fill={HOME_WIDGET_ICON_SHINE}
          opacity={0.32}
        />
        {/* Upper visor brow highlight line */}
        <Line
          x1="31"
          y1="38.2"
          x2="69"
          y2="38.2"
          stroke={HOME_WIDGET_ICON_SHINE}
          strokeWidth="1.3"
          strokeLinecap="round"
          opacity={0.9}
        />
      </G>
    </G>
  );
}

function PolylinePoints({
  d,
  stroke,
  strokeWidth,
}: {
  d: string;
  stroke: string;
  strokeWidth: string;
}) {
  return (
    <Path
      d={d}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  );
}

export function renderStarWarsMotif(motif: StarWarsMotif): React.ReactNode {
  switch (motif) {
    case "force":
      return <GroguArt p={CHARACTER_CLAY_PALETTES.force} />;
    case "droid":
      return <R2D2Art p={CHARACTER_CLAY_PALETTES.droid} />;
    case "helmet":
      return <MandalorianArt p={CHARACTER_CLAY_PALETTES.helmet} />;
  }
}

export default renderStarWarsMotif;
