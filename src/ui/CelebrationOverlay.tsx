import React, { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
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
import { renderDisneyMotif } from "./characters/DisneyArt";
import { renderPixarMotif } from "./characters/PixarArt";
import { renderMarvelMotif } from "./characters/MarvelArt";
import { renderStarWarsMotif } from "./characters/StarWarsArt";
import {
  CharacterMotionStage,
  CHARACTER_MOTION_SPECS,
  type CharacterMotionSpec,
  type CharacterMotionStyle,
} from "./characters/CharacterMotion";
import {
  CHARACTER_CLAY_PALETTES,
  HOME_WIDGET_ICON_SHINE,
} from "../theme/materials";

export {
  CharacterMotionStage,
  CHARACTER_MOTION_SPECS,
  type CharacterMotionSpec,
  type CharacterMotionStyle,
};

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

export interface CharacterEmblemProps {
  motif: CharacterMotif;
  accentHex: string;
  inkHex: string;
  size?: number;
  animated?: boolean;
  intensity?: "ambient" | "celebration";
  testID?: string;
}

function renderMotifArtwork(motif: CharacterMotif): React.ReactNode {
  switch (motif) {
    case "alien":
    case "snowflake":
    case "wave":
    case "ears":
    case "crown":
      return renderDisneyMotif(motif);
    case "rocket":
    case "sheriff":
    case "robot":
    case "sparkle":
      return renderPixarMotif(motif);
    case "web":
    case "arc":
    case "leaf":
    case "shield":
      return renderMarvelMotif(motif);
    case "force":
    case "droid":
    case "helmet":
    default:
      return renderStarWarsMotif(motif === "force" || motif === "droid" || motif === "helmet" ? motif : "helmet");
  }
}

/**
 * 3D Claymorphic character emblem with signature REA motion stage.
 * Combines volumetric 3D clay SVG layers (zero `<Defs>` gradient refs)
 * with 60fps breathing float, personality tilt, and pulsing ambient aura.
 */
export function CharacterEmblem({
  motif,
  accentHex,
  inkHex: _inkHex,
  size = 96,
  animated = true,
  intensity = "ambient",
  testID,
}: CharacterEmblemProps) {
  const { colors } = useTheme();
  const clay = CHARACTER_CLAY_PALETTES[motif] ?? CHARACTER_CLAY_PALETTES.helmet;

  const ringFill = mixAlpha(clay.glow, 0.22);
  const recessFill = mix(clay.lo, colors["color-canvas"], 45);
  const recessStroke = mixAlpha(clay.hi, 0.35);
  const spotlightFill = mixAlpha(clay.glow, 0.24);

  return (
    <CharacterMotionStage
      motif={motif}
      size={size}
      accentHex={accentHex}
      glowHex={clay.glow}
      animated={animated}
      intensity={intensity}
      testID={testID}
    >
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {/* Outer ambient medallion ring */}
        <Circle cx="50" cy="50" r="46" fill={ringFill} stroke={accentHex} strokeWidth="3" />
        {/* Deep velvet medallion recess */}
        <Circle cx="50" cy="50" r="40" fill={recessFill} stroke={recessStroke} strokeWidth="1.5" />
        {/* Radiant inner spotlight */}
        <Circle cx="50" cy="46" r="31" fill={spotlightFill} />
        {/* 3D Claymorphic character figure */}
        {renderMotifArtwork(motif)}
        {/* Top glass specular rim arc */}
        <Path
          d="M 22 18 A 38 38 0 0 1 78 18"
          stroke={HOME_WIDGET_ICON_SHINE}
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
          opacity={0.38}
        />
      </Svg>
    </CharacterMotionStage>
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

          {/* 3D Claymorphic Character Emblem on REA Motion Stage */}
          <CharacterEmblem
            motif={character.motif}
            accentHex={accentHex}
            inkHex={inkHex}
            size={136}
            animated={true}
            intensity="celebration"
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

