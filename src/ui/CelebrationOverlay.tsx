import React, { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Circle, Line, Path, Polygon, Rect } from "react-native-svg";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "../theme/ThemeProvider";
import { Material } from "../theme/Material";
import { ACCENTS, FONTS, MIN_TARGET_DP, RADII, TYPOGRAPHY } from "../theme/tokens";
import { mix } from "../theme/mix";
import { mixAlpha, SoftButton } from "./SoftButton";
import {
  resolveCharacterForMember,
  useCharacterTheme,
  type CharacterMotif,
  type CharacterProfile,
} from "../theme/characterTheme";

export interface CelebrationEvent {
  kind: "chore" | "routine" | "reward";
  memberName: string;
  title: string;
  points?: number;
}

export interface CelebrationOverlayProps {
  event: CelebrationEvent | null;
  onDismiss: () => void;
  characterOverride?: CharacterProfile | null;
  autoDismissMs?: number;
  testID?: string;
}

/**
 * Pure vector SVG emblem for each of the 16 character motifs.
 * Uses direct solid fills & strokes (no `<Defs>` gradient refs) so it paints
 * deterministically across Android, iOS, and Web without touching Android text layout.
 */
export function CharacterEmblem({
  motif,
  accentHex,
  inkHex,
  size = 96,
  testID,
}: {
  motif: CharacterMotif;
  accentHex: string;
  inkHex: string;
  size?: number;
  testID?: string;
}) {
  const { colors, theme } = useTheme();
  const pal = ACCENTS[theme === "light" ? "light" : "dark"];
  const cCyan = pal.cyan;
  const cLavender = pal.lavender;
  const cCoral = pal.coral;
  const cRose = pal.rose;
  const cAmber = pal.amber;
  const cMint = pal.mint;
  const cViolet = pal.violet;
  const cApricot = pal.apricot;
  const cSage = pal.sage;
  const cNori = pal.nori;
  const cLight = colors["color-surface-1"];
  const cDark = colors["color-canvas"];
  const cSkinSurface = theme === "light" ? cLight : colors["color-text-primary"];
  const cSkinWarm = mix(cApricot, cSkinSurface, 55);
  const cSkinLight = mix(cApricot, cSkinSurface, 30);
  const cWhite =
    theme === "light"
      ? mix(cLight, colors["color-text-primary"], 85)
      : mix(colors["color-text-primary"], cLight, 85);
  const cEyeDark =
    theme === "light"
      ? mix(cDark, colors["color-text-primary"], 20)
      : mix(cDark, colors["color-text-primary"], 80);

  const ringFill = mixAlpha(accentHex, 0.22);
  const innerFill = mixAlpha(accentHex, 0.36);

  const renderMotifArtwork = () => {
    switch (motif) {
      case "alien":
        return (
          <>
            {/* Huge floppy notched alien ears */}
            <Path d="M 26 46 C 6 24 8 14 24 22 C 30 26 32 34 32 40 Z" fill={cCyan} />
            <Path d="M 24 42 C 12 26 14 18 24 24 C 28 28 30 34 30 38 Z" fill={cRose} />
            <Path d="M 74 46 C 94 24 92 14 76 22 C 70 26 68 34 68 40 Z" fill={cCyan} />
            <Path d="M 76 42 C 88 26 86 18 76 24 C 72 28 70 34 70 38 Z" fill={cRose} />
            {/* Round blue head + top fur tuft */}
            <Circle cx="50" cy="54" r="24" fill={cCyan} />
            <Path d="M 46 30 L 50 22 L 54 30" stroke={cCyan} strokeWidth="2.5" fill={cCyan} strokeLinecap="round" />
            {/* Lighter cyan tear-drop eye patches */}
            <Circle cx="39" cy="50" r="8" fill={mix(cCyan, cWhite, 45)} />
            <Circle cx="61" cy="50" r="8" fill={mix(cCyan, cWhite, 45)} />
            {/* Big glossy dark eyes */}
            <Circle cx="39" cy="50" r="5.5" fill={cEyeDark} />
            <Circle cx="61" cy="50" r="5.5" fill={cEyeDark} />
            {/* White catchlights */}
            <Circle cx="37.5" cy="48" r="2" fill={cWhite} />
            <Circle cx="59.5" cy="48" r="2" fill={cWhite} />
            {/* Big oval Stitch nose */}
            <Path d="M 43 56 C 43 51 57 51 57 56 C 57 61 43 61 43 56 Z" fill={cNori} />
            {/* Wide mischievous stitched grin */}
            <Path d="M 35 64 Q 50 73 65 64" stroke={cEyeDark} strokeWidth="3" fill="none" strokeLinecap="round" />
          </>
        );
      case "snowflake":
        return (
          <>
            {/* Shimmering ice cape/collar at bottom with snowflake brooch */}
            <Path d="M 28 84 Q 50 70 72 84" fill={cCyan} />
            <Polygon points="50,72 54,77 50,82 46,77" fill={cWhite} />
            {/* Sweeping platinum-ice hair & side braid */}
            <Circle cx="50" cy="50" r="24" fill={cWhite} />
            <Path d="M 64 56 C 74 64 72 78 64 84 C 58 78 60 64 64 56 Z" fill={mix(cLavender, cWhite, 35)} />
            {/* Ice crystal tiara crown on forehead */}
            <Polygon points="36,32 42,20 50,28 50,16 50,28 58,20 64,32" fill={cCyan} />
            {/* Face */}
            <Circle cx="50" cy="53" r="17" fill={cSkinLight} />
            {/* Big cyan eyes, pupils + catchlights */}
            <Circle cx="43" cy="51" r="3.5" fill={cCyan} />
            <Circle cx="57" cy="51" r="3.5" fill={cCyan} />
            <Circle cx="43" cy="51" r="1.8" fill={cEyeDark} />
            <Circle cx="57" cy="51" r="1.8" fill={cEyeDark} />
            <Circle cx="42" cy="50" r="0.9" fill={cWhite} />
            <Circle cx="56" cy="50" r="0.9" fill={cWhite} />
            {/* Rosy cheeks */}
            <Circle cx="38" cy="56" r="3" fill={mixAlpha(cRose, 0.45)} />
            <Circle cx="62" cy="56" r="3" fill={mixAlpha(cRose, 0.45)} />
            {/* Warm smile */}
            <Path d="M 44 60 Q 50 65 56 60" stroke={cRose} strokeWidth="2.5" fill="none" strokeLinecap="round" />
          </>
        );
      case "wave":
        return (
          <>
            {/* Lush flowing dark wavy hair */}
            <Circle cx="50" cy="52" r="25" fill={cEyeDark} />
            <Circle cx="30" cy="62" r="12" fill={cEyeDark} />
            <Circle cx="70" cy="62" r="12" fill={cEyeDark} />
            {/* Warm Polynesian face */}
            <Circle cx="50" cy="53" r="17" fill={cSkinWarm} />
            {/* Tropical coral-rose hibiscus flower by right ear */}
            <Circle cx="67" cy="40" r="6" fill={cCoral} />
            <Circle cx="67" cy="40" r="2.5" fill={cAmber} />
            {/* Expressive dark eyes with white catchlights */}
            <Circle cx="43" cy="51" r="3.5" fill={cEyeDark} />
            <Circle cx="57" cy="51" r="3.5" fill={cEyeDark} />
            <Circle cx="42" cy="50" r="1.3" fill={cWhite} />
            <Circle cx="56" cy="50" r="1.3" fill={cWhite} />
            {/* Warm smile */}
            <Path d="M 43 60 Q 50 66 57 60" stroke={cWhite} strokeWidth="2.8" fill="none" strokeLinecap="round" />
            {/* Glowing cyan/mint Heart of Te Fiti necklace pendant */}
            <Circle cx="50" cy="77" r="5" fill={cMint} stroke={cCyan} strokeWidth="2" />
          </>
        );
      case "ears":
        return (
          <>
            {/* Iconic round black mouse ears */}
            <Circle cx="26" cy="38" r="13" fill={cEyeDark} />
            <Circle cx="74" cy="38" r="13" fill={cEyeDark} />
            {/* Tall pointed blue Sorcerer hat with golden crescent moon & star */}
            <Polygon points="50,10 34,42 66,42" fill={cCyan} stroke={cViolet} strokeWidth="2" />
            <Circle cx="48" cy="28" r="3.5" fill={cAmber} />
            <Polygon points="55,22 57,26 53,26" fill={cAmber} />
            {/* Classic Mickey head + warm face mask */}
            <Circle cx="50" cy="57" r="20" fill={cEyeDark} />
            <Circle cx="44" cy="55" r="10" fill={cSkinLight} />
            <Circle cx="56" cy="55" r="10" fill={cSkinLight} />
            <Circle cx="50" cy="63" r="12" fill={cSkinLight} />
            {/* Eyes, oval button nose, and cheerful smile */}
            <Circle cx="45" cy="53" r="3" fill={cEyeDark} />
            <Circle cx="55" cy="53" r="3" fill={cEyeDark} />
            <Circle cx="50" cy="59" r="3.8" fill={cEyeDark} />
            <Path d="M 41 64 Q 50 71 59 64" stroke={cEyeDark} strokeWidth="2.5" fill="none" strokeLinecap="round" />
          </>
        );
      case "crown":
        return (
          <>
            {/* Fluffy golden lion cub ears */}
            <Circle cx="28" cy="36" r="10" fill={cAmber} />
            <Circle cx="28" cy="36" r="5.5" fill={cCoral} />
            <Circle cx="72" cy="36" r="10" fill={cAmber} />
            <Circle cx="72" cy="36" r="5.5" fill={cCoral} />
            {/* Golden lion cub head + tuft of mane on top + royal Rafiki forehead mark */}
            <Circle cx="50" cy="54" r="22" fill={cAmber} />
            <Polygon points="42,33 50,22 58,33" fill={cCoral} />
            <Rect x="46" y="35" width="8" height="4" rx="2" fill={cCoral} />
            {/* Lighter muzzle, pink triangle lion nose, bright cub eyes, and cub smile + whiskers */}
            <Circle cx="45" cy="61" r="7" fill={cSkinLight} />
            <Circle cx="55" cy="61" r="7" fill={cSkinLight} />
            <Polygon points="45,56 55,56 50,62" fill={cRose} />
            <Circle cx="41" cy="49" r="4" fill={cEyeDark} />
            <Circle cx="59" cy="49" r="4" fill={cEyeDark} />
            <Circle cx="39.5" cy="47.5" r="1.3" fill={cWhite} />
            <Circle cx="57.5" cy="47.5" r="1.3" fill={cWhite} />
            <Path d="M 44 64 Q 50 68 56 64" stroke={cEyeDark} strokeWidth="2" fill="none" strokeLinecap="round" />
            <Line x1="34" y1="62" x2="26" y2="60" stroke={cEyeDark} strokeWidth="1.5" strokeLinecap="round" />
            <Line x1="66" y1="62" x2="74" y2="60" stroke={cEyeDark} strokeWidth="1.5" strokeLinecap="round" />
          </>
        );
      case "rocket":
        return (
          <>
            {/* Space Ranger helmet dome glass */}
            <Circle cx="50" cy="48" r="25" fill={mixAlpha(cCyan, 0.25)} stroke={cCyan} strokeWidth="2.5" />
            {/* Star Command chest armor at bottom */}
            <Path d="M 24 80 Q 50 66 76 80 L 72 88 L 28 88 Z" fill={cMint} />
            <Circle cx="60" cy="79" r="3.5" fill={cCoral} />
            <Rect x="28" y="76" width="10" height="4" fill={cViolet} />
            {/* Purple ranger hood + face */}
            <Circle cx="50" cy="50" r="19" fill={cViolet} />
            <Circle cx="50" cy="52" r="15" fill={cSkinWarm} />
            {/* Confident eyes, heroic grin, and iconic chin swirl */}
            <Circle cx="44" cy="49" r="3" fill={cEyeDark} />
            <Circle cx="56" cy="49" r="3" fill={cEyeDark} />
            <Circle cx="43" cy="48" r="1" fill={cWhite} />
            <Circle cx="55" cy="48" r="1" fill={cWhite} />
            <Path d="M 44 57 Q 50 61 56 57" stroke={cWhite} strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <Path d="M 49 63 Q 52 65 50 66" stroke={cEyeDark} strokeWidth="1.8" fill="none" />
          </>
        );
      case "sheriff":
        return (
          <>
            {/* Red bandana neckerchief at neck + gold Sheriff star badge */}
            <Polygon points="34,72 66,72 50,86" fill={cCoral} />
            <Polygon points="62,74 65,80 59,80" fill={cAmber} />
            {/* Warm face, friendly eyes, and big cowboy smile */}
            <Circle cx="50" cy="55" r="17" fill={cSkinWarm} />
            <Circle cx="43" cy="53" r="3.2" fill={cEyeDark} />
            <Circle cx="57" cy="53" r="3.2" fill={cEyeDark} />
            <Circle cx="42" cy="52" r="1.1" fill={cWhite} />
            <Circle cx="56" cy="52" r="1.1" fill={cWhite} />
            <Path d="M 42 62 Q 50 68 58 62" stroke={cEyeDark} strokeWidth="2.5" fill="none" strokeLinecap="round" />
            {/* Wide-brimmed cowboy hat on top */}
            <Path d="M 18 38 Q 50 44 82 38 Q 50 32 18 38 Z" fill={cAmber} stroke={cCoral} strokeWidth="2" />
            <Path d="M 33 38 C 35 20 65 20 67 38 Z" fill={cAmber} />
            <Rect x="34" y="34" width="32" height="4" fill={cCoral} />
          </>
        );
      case "robot":
        return (
          <>
            {/* Compact golden-amber cube body below */}
            <Rect x="32" y="62" width="36" height="22" rx="4" fill={cAmber} stroke={cEyeDark} strokeWidth="2" />
            <Circle cx="42" cy="72" r="2.5" fill={cCoral} />
            <Rect x="50" y="69" width="10" height="6" fill={cEyeDark} />
            {/* Neck post */}
            <Rect x="46" y="50" width="8" height="12" fill={cEyeDark} />
            {/* Iconic tilted binocular camera eyes */}
            <Path d="M 22 36 L 47 32 L 47 50 L 22 52 Z" fill={cWhite} stroke={cEyeDark} strokeWidth="2.5" />
            <Path d="M 53 32 L 78 36 L 78 52 L 53 50 Z" fill={cWhite} stroke={cEyeDark} strokeWidth="2.5" />
            {/* Glowing cyan optical lenses inside both eyes */}
            <Circle cx="36" cy="42" r="6.5" fill={cEyeDark} />
            <Circle cx="36" cy="42" r="3.5" fill={cCyan} />
            <Circle cx="35" cy="40" r="1.2" fill={cWhite} />
            <Circle cx="64" cy="42" r="6.5" fill={cEyeDark} />
            <Circle cx="64" cy="42" r="3.5" fill={cCyan} />
            <Circle cx="63" cy="40" r="1.2" fill={cWhite} />
          </>
        );
      case "sparkle":
        return (
          <>
            {/* Floating glowing memory orbs */}
            <Circle cx="24" cy="34" r="5" fill={cAmber} />
            <Circle cx="77" cy="38" r="4.5" fill={cCyan} />
            <Circle cx="26" cy="68" r="4" fill={cMint} />
            {/* Radiant golden-glowing face */}
            <Circle cx="50" cy="54" r="18" fill={mix(cAmber, cWhite, 45)} />
            {/* Vibrant pixie-cut blue hair */}
            <Path d="M 31 50 C 30 28 52 22 68 32 C 62 36 69 42 67 48 C 56 38 40 40 31 50 Z" fill={cCyan} />
            {/* Big sparkling blue eyes and huge joyful open grin */}
            <Circle cx="43" cy="52" r="4" fill={cCyan} />
            <Circle cx="57" cy="52" r="4" fill={cCyan} />
            <Circle cx="43" cy="52" r="2" fill={cEyeDark} />
            <Circle cx="57" cy="52" r="2" fill={cEyeDark} />
            <Circle cx="42" cy="50.5" r="1" fill={cWhite} />
            <Circle cx="56" cy="50.5" r="1" fill={cWhite} />
            <Path d="M 41 60 Q 50 69 59 60 Z" fill={cWhite} stroke={cCoral} strokeWidth="2" />
          </>
        );
      case "web":
        return (
          <>
            {/* Iconic red Spider-Man mask oval */}
            <Path d="M 50 20 C 70 20 74 42 70 62 C 66 76 56 82 50 82 C 44 82 34 76 30 62 C 26 42 30 20 50 20 Z" fill={cCoral} stroke={cEyeDark} strokeWidth="2.5" />
            {/* Webbing lines across the mask */}
            <Line x1="50" y1="20" x2="50" y2="82" stroke={cEyeDark} strokeWidth="1.8" />
            <Line x1="30" y1="36" x2="70" y2="66" stroke={cEyeDark} strokeWidth="1.8" />
            <Line x1="70" y1="36" x2="30" y2="66" stroke={cEyeDark} strokeWidth="1.8" />
            <Circle cx="50" cy="52" r="14" stroke={cEyeDark} strokeWidth="1.5" fill="none" />
            {/* Bold black-rimmed white angular spider-eyes */}
            <Polygon points="33,44 47,50 45,58 31,52" fill={cWhite} stroke={cEyeDark} strokeWidth="3.5" />
            <Polygon points="67,44 53,50 55,58 69,52" fill={cWhite} stroke={cEyeDark} strokeWidth="3.5" />
          </>
        );
      case "arc":
        return (
          <>
            {/* Red outer Mark helmet */}
            <Path d="M 50 18 C 70 18 74 38 70 62 C 66 76 56 82 50 82 C 44 82 34 76 30 62 C 26 38 30 18 50 18 Z" fill={cCoral} stroke={cEyeDark} strokeWidth="2.5" />
            {/* Contoured gold faceplate */}
            <Path d="M 36 30 L 44 30 L 46 38 L 54 38 L 56 30 L 64 30 L 66 58 L 58 72 L 42 72 L 34 58 Z" fill={cAmber} stroke={cEyeDark} strokeWidth="2" />
            {/* Glowing cyan slit eyes */}
            <Polygon points="37,46 47,48 46,52 36,50" fill={cCyan} />
            <Polygon points="63,46 53,48 54,52 64,50" fill={cCyan} />
            {/* Iconic jawline grill + glowing cyan Arc Reactor at bottom */}
            <Line x1="43" y1="64" x2="57" y2="64" stroke={cEyeDark} strokeWidth="3" />
            <Circle cx="50" cy="83" r="5.5" fill={cCyan} stroke={cWhite} strokeWidth="2" />
          </>
        );
      case "leaf":
        return (
          <>
            {/* Wooden bark head with jagged tree-crown shoots */}
            <Path d="M 32 74 L 30 34 L 38 40 L 43 28 L 50 38 L 57 26 L 62 40 L 70 34 L 68 74 Q 50 80 32 74 Z" fill={mix(cAmber, cEyeDark, 35)} stroke={cEyeDark} strokeWidth="2" />
            {/* Sprouting mint-green leaves on top */}
            <Path d="M 30 32 C 20 24 26 16 34 26 Z" fill={cMint} />
            <Path d="M 57 26 C 64 14 74 20 64 30 Z" fill={cMint} />
            <Path d="M 43 28 C 40 16 50 16 48 28 Z" fill={cMint} />
            {/* Bark grain lines */}
            <Line x1="38" y1="42" x2="38" y2="50" stroke={cEyeDark} strokeWidth="1.8" />
            {/* Huge glossy dark puppy-eyes with white catchlights */}
            <Circle cx="41" cy="54" r="5.5" fill={cEyeDark} />
            <Circle cx="59" cy="54" r="5.5" fill={cEyeDark} />
            <Circle cx="39.5" cy="52" r="2" fill={cWhite} />
            <Circle cx="57.5" cy="52" r="2" fill={cWhite} />
            {/* Sweet little Groot smile */}
            <Path d="M 44 65 Q 50 70 56 65" stroke={cEyeDark} strokeWidth="2.8" fill="none" strokeLinecap="round" />
          </>
        );
      case "shield":
        return (
          <>
            {/* Pointed vibranium panther ears */}
            <Polygon points="30,34 28,18 42,28" fill={cEyeDark} stroke={cLavender} strokeWidth="2" />
            <Polygon points="70,34 72,18 58,28" fill={cEyeDark} stroke={cLavender} strokeWidth="2" />
            {/* Sleek panther mask */}
            <Path d="M 50 22 C 68 22 72 40 68 60 C 64 74 55 80 50 80 C 45 80 36 74 32 60 C 28 40 32 22 50 22 Z" fill={cEyeDark} stroke={cLavender} strokeWidth="2.5" />
            {/* Vibranium silver/lavender kinetic lines */}
            <Path d="M 36 34 L 46 44 M 64 34 L 54 44 M 34 62 L 46 72 M 66 62 L 54 72" stroke={cLavender} strokeWidth="2" strokeLinecap="round" />
            {/* Fierce angular white panther eyes */}
            <Polygon points="35,47 46,50 44,54 34,51" fill={cWhite} />
            <Polygon points="65,47 54,50 56,54 66,51" fill={cWhite} />
            {/* Vibranium claw necklace */}
            <Polygon points="38,80 41,87 44,80" fill={cLavender} />
            <Polygon points="47,82 50,89 53,82" fill={cLavender} />
            <Polygon points="56,80 59,87 62,80" fill={cLavender} />
          </>
        );
      case "force":
        return (
          <>
            {/* Giant wide-set pointed green ears */}
            <Polygon points="28,44 4,34 26,56" fill={cMint} stroke={cSage} strokeWidth="2" />
            <Polygon points="26,46 10,38 25,53" fill={cRose} />
            <Polygon points="72,44 96,34 74,56" fill={cMint} stroke={cSage} strokeWidth="2" />
            <Polygon points="74,46 90,38 75,53" fill={cRose} />
            {/* Cozy tan robe collar at bottom */}
            <Path d="M 26 66 Q 50 60 74 66 L 78 84 L 22 84 Z" fill={cAmber} stroke={cEyeDark} strokeWidth="2" />
            {/* Cute round green head */}
            <Circle cx="50" cy="50" r="20" fill={cMint} />
            {/* Huge glossy dark eyes with double white catchlights */}
            <Circle cx="41" cy="48" r="6" fill={cEyeDark} />
            <Circle cx="59" cy="48" r="6" fill={cEyeDark} />
            <Circle cx="39" cy="46" r="2.2" fill={cWhite} />
            <Circle cx="57" cy="46" r="2.2" fill={cWhite} />
            <Circle cx="43" cy="50" r="1" fill={cWhite} />
            <Circle cx="61" cy="50" r="1" fill={cWhite} />
            {/* Tiny nose & sweet smile */}
            <Circle cx="50" cy="53" r="2" fill={cSage} />
            <Path d="M 45 58 Q 50 61 55 58" stroke={cEyeDark} strokeWidth="2" fill="none" strokeLinecap="round" />
          </>
        );
      case "droid":
        return (
          <>
            {/* Cylindrical white astromech body */}
            <Rect x="28" y="54" width="44" height="28" rx="4" fill={cWhite} stroke={cEyeDark} strokeWidth="2" />
            <Rect x="42" y="60" width="16" height="4" fill={cCyan} />
            <Rect x="42" y="67" width="16" height="4" fill={cCyan} />
            {/* Silver/white dome head */}
            <Path d="M 28 54 A 22 22 0 0 1 72 54 Z" fill={cWhite} stroke={cEyeDark} strokeWidth="2.5" />
            {/* Royal blue dome panels */}
            <Rect x="34" y="38" width="8" height="12" rx="2" fill={cCyan} />
            <Rect x="58" y="38" width="8" height="12" rx="2" fill={cCyan} />
            <Path d="M 44 33 L 56 33 L 58 46 L 42 46 Z" fill={cCyan} />
            {/* Iconic black radar eye lens + red status indicator */}
            <Circle cx="50" cy="40" r="5" fill={cEyeDark} />
            <Circle cx="48.5" cy="38.5" r="1.5" fill={cWhite} />
            <Circle cx="54" cy="50" r="2.8" fill={cCoral} />
          </>
        );
      case "helmet":
      default:
        return (
          <>
            {/* Beskar silver dome helmet */}
            <Path d="M 30 46 C 30 22 70 22 70 46 L 68 74 L 56 80 L 44 80 L 32 74 Z" fill={mix(cLavender, cWhite, 50)} stroke={cEyeDark} strokeWidth="2.5" />
            {/* Central forehead ridge */}
            <Rect x="47" y="24" width="6" height="18" fill={cLavender} />
            {/* Iconic pitch-black T-shaped visor */}
            <Rect x="34" y="42" width="32" height="7" rx="2" fill={cEyeDark} />
            <Rect x="46" y="47" width="8" height="32" fill={cEyeDark} />
            {/* Angled cheek hollows */}
            <Polygon points="33,54 43,54 43,72 34,68" fill={cLavender} />
            <Polygon points="67,54 57,54 57,72 66,68" fill={cLavender} />
          </>
        );
    }
  };

  return (
    <View
      testID={testID}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Circle cx="50" cy="50" r="46" fill={ringFill} stroke={accentHex} strokeWidth="3" />
        <Circle cx="50" cy="50" r="37" fill={innerFill} />
        {renderMotifArtwork()}
      </Svg>
    </View>
  );
}

const SPARKLE_POSITIONS = [
  { top: 18, left: 26, glyph: "✨" },
  { top: 22, right: 28, glyph: "⭐" },
  { bottom: 26, left: 32, glyph: "🌟" },
  { bottom: 22, right: 26, glyph: "✨" },
] as const;

export function CelebrationOverlay({
  event,
  onDismiss,
  characterOverride,
  autoDismissMs = 3400,
  testID = "character-celebration-overlay",
}: CelebrationOverlayProps) {
  const { colors, theme, reduceMotion } = useTheme();
  const [prefs] = useCharacterTheme();
  const doAnim = !reduceMotion;

  const pop = useSharedValue(1);
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (!event) return;
    if (!doAnim) {
      cancelAnimation(pop);
      cancelAnimation(pulse);
      pop.value = 1;
      pulse.value = 0;
    } else {
      pop.value = 0.86;
      pop.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) });
      pulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 750, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 750, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    }
    return () => {
      cancelAnimation(pop);
      cancelAnimation(pulse);
    };
  }, [event, doAnim, pop, pulse]);

  useEffect(() => {
    if (!event || autoDismissMs <= 0) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, autoDismissMs);
    return () => clearTimeout(timer);
  }, [event, autoDismissMs, onDismiss]);

  const cardAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }],
  }));

  const sparkleAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -4 * pulse.value }, { scale: 0.94 + 0.12 * pulse.value }],
  }));

  if (!event) return null;

  const character = characterOverride ?? resolveCharacterForMember(event.memberName, prefs);
  const palette = ACCENTS[theme === "light" ? "light" : "dark"];
  const accentHex = palette[character.accentKey] ?? colors["color-accent-selected"] ?? colors["color-text-primary"];
  const inkHex = colors["color-text-primary"];
  const backdropColor = mixAlpha(colors["color-canvas"], 0.78);
  const pillBg = mix(accentHex, colors["color-surface-2"], 28);
  const pillBorder = mix(accentHex, colors["color-border"] ?? inkHex, 55);

  const cheerCopy = event.kind === "reward" ? character.rewardCheer : character.choreCheer;
  const kindLabel =
    event.kind === "reward"
      ? "REWARD UNLOCKED"
      : event.kind === "routine"
      ? "ROUTINE COMPLETE"
      : "CHORE COMPLETE";

  const pointsText =
    event.kind === "reward"
      ? typeof event.points === "number" && event.points > 0
        ? `🎉 Redeemed · ${event.points} pts`
        : "🎉 Reward Pass Ready!"
      : typeof event.points === "number" && event.points > 0
      ? `⭐ +${event.points} pts for ${event.memberName}`
      : `⭐ Way to go, ${event.memberName}!`;

  return (
    <View
      testID={testID}
      accessibilityRole="alert"
      accessibilityLabel={`${character.name} celebration for ${event.memberName}: ${cheerCopy}`}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 90,
        backgroundColor: backdropColor,
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss celebration"
        onPress={onDismiss}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
      />

      <Animated.View style={[{ width: "100%", maxWidth: 580 }, doAnim ? cardAnimStyle : null]}>
        <Material
          tier="thick"
          tone={accentHex}
          style={{
            borderRadius: RADII.xxl,
            paddingHorizontal: 32,
            paddingVertical: 36,
            alignItems: "center",
            gap: 16,
            borderWidth: 2,
            borderColor: pillBorder,
          }}
        >
          {/* Floating celebration sparkles */}
          {SPARKLE_POSITIONS.map((pos, idx) => (
            <Animated.View
              key={idx}
              pointerEvents="none"
              style={[
                {
                  position: "absolute",
                  top: "top" in pos ? pos.top : undefined,
                  bottom: "bottom" in pos ? pos.bottom : undefined,
                  left: "left" in pos ? pos.left : undefined,
                  right: "right" in pos ? pos.right : undefined,
                },
                doAnim ? sparkleAnimStyle : null,
              ]}
            >
              <Text style={{ fontSize: 28 }}>{pos.glyph}</Text>
            </Animated.View>
          ))}

          {/* Franchise + Character Pill */}
          <View
            style={{
              paddingHorizontal: 16,
              paddingVertical: 6,
              borderRadius: RADII.pill,
              backgroundColor: pillBg,
              borderWidth: 1,
              borderColor: pillBorder,
            }}
          >
            <Text
              testID="celebration-character-name"
              style={{
                color: inkHex,
                fontSize: TYPOGRAPHY.label.fontSize,
                fontWeight: "700",
                letterSpacing: 1.8,
                textTransform: "uppercase",
              }}
            >
              {`${character.franchiseLabel} · ${character.name}`}
            </Text>
          </View>

          {/* Character Vector Emblem */}
          <CharacterEmblem
            motif={character.motif}
            accentHex={accentHex}
            inkHex={inkHex}
            size={124}
            testID={`character-emblem-${character.id}`}
          />

          {/* Kind Kicker */}
          <Text
            style={{
              color: accentHex,
              fontSize: TYPOGRAPHY.label.fontSize,
              fontWeight: "800",
              letterSpacing: 2.2,
            }}
          >
            {kindLabel}
          </Text>

          {/* Task or Reward Title */}
          <Text
            testID="celebration-title"
            style={{
              color: inkHex,
              fontSize: TYPOGRAPHY.stat.fontSize,
              lineHeight: TYPOGRAPHY.stat.lineHeight,
              fontFamily: FONTS.display,
              fontWeight: "700",
              textAlign: "center",
            }}
          >
            {event.title}
          </Text>

          {/* Character Cheer Quote */}
          <Text
            testID="celebration-cheer"
            style={{
              color: colors["color-text-secondary"],
              fontSize: TYPOGRAPHY.title.fontSize,
              lineHeight: TYPOGRAPHY.title.lineHeight,
              fontWeight: "600",
              textAlign: "center",
            }}
          >
            {`${character.badgeGlyph} "${cheerCopy}"`}
          </Text>

          {/* Points / Pass Pill */}
          <View
            style={{
              marginTop: 4,
              paddingHorizontal: 22,
              paddingVertical: 10,
              borderRadius: RADII.pill,
              backgroundColor: pillBg,
              borderWidth: 1,
              borderColor: pillBorder,
            }}
          >
            <Text
              testID="celebration-points"
              style={{
                color: inkHex,
                fontSize: TYPOGRAPHY.body.fontSize,
                fontWeight: "700",
                fontVariant: ["tabular-nums"],
              }}
            >
              {pointsText}
            </Text>
          </View>

          {/* Primary Action Button (>= 64dp tap target) */}
          <SoftButton
            variant="primary"
            size="lg"
            testID="celebration-dismiss"
            onPress={onDismiss}
            style={{ minHeight: MIN_TARGET_DP, alignSelf: "stretch", marginTop: 8 }}
          >
            Awesome! ✨
          </SoftButton>
        </Material>
      </Animated.View>
    </View>
  );
}

export default CelebrationOverlay;

