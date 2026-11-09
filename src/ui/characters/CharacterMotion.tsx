import React, { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "../../theme/ThemeProvider";
import type { CharacterMotif } from "../../theme/characterTheme";
import { mixAlpha } from "../SoftButton";

export type CharacterMotionStyle =
  | "mischief-bounce"
  | "crystal-float"
  | "ocean-sway"
  | "magic-conductor"
  | "royal-pride"
  | "star-hover"
  | "cowboy-nod"
  | "curious-tilt"
  | "joy-sparkle"
  | "web-swing"
  | "repulsor-pulse"
  | "groot-groove"
  | "vibranium-stealth"
  | "force-levitate"
  | "droid-rock"
  | "beskar-stance";

export interface CharacterMotionSpec {
  style: CharacterMotionStyle;
  duration: number;
  verticalAmp: number;
  tiltDeg: number;
  scaleAmp: number;
  auraPulse: number;
}

export const CHARACTER_MOTION_SPECS: Record<CharacterMotif, CharacterMotionSpec> = {
  alien: {
    style: "mischief-bounce",
    duration: 2400,
    verticalAmp: 3.5,
    tiltDeg: 5,
    scaleAmp: 0.045,
    auraPulse: 0.14,
  },
  snowflake: {
    style: "crystal-float",
    duration: 3600,
    verticalAmp: 3.0,
    tiltDeg: 2,
    scaleAmp: 0.03,
    auraPulse: 0.16,
  },
  wave: {
    style: "ocean-sway",
    duration: 3200,
    verticalAmp: 2.8,
    tiltDeg: 4.5,
    scaleAmp: 0.03,
    auraPulse: 0.12,
  },
  ears: {
    style: "magic-conductor",
    duration: 2600,
    verticalAmp: 3.2,
    tiltDeg: 4,
    scaleAmp: 0.04,
    auraPulse: 0.15,
  },
  crown: {
    style: "royal-pride",
    duration: 3000,
    verticalAmp: 2.6,
    tiltDeg: 3,
    scaleAmp: 0.045,
    auraPulse: 0.14,
  },
  rocket: {
    style: "star-hover",
    duration: 2800,
    verticalAmp: 3.8,
    tiltDeg: 2.5,
    scaleAmp: 0.035,
    auraPulse: 0.14,
  },
  sheriff: {
    style: "cowboy-nod",
    duration: 2700,
    verticalAmp: 2.8,
    tiltDeg: 5,
    scaleAmp: 0.035,
    auraPulse: 0.11,
  },
  robot: {
    style: "curious-tilt",
    duration: 3100,
    verticalAmp: 2.0,
    tiltDeg: 6.5,
    scaleAmp: 0.025,
    auraPulse: 0.1,
  },
  sparkle: {
    style: "joy-sparkle",
    duration: 2200,
    verticalAmp: 4.2,
    tiltDeg: 4.5,
    scaleAmp: 0.05,
    auraPulse: 0.18,
  },
  web: {
    style: "web-swing",
    duration: 2500,
    verticalAmp: 3.4,
    tiltDeg: 6,
    scaleAmp: 0.04,
    auraPulse: 0.13,
  },
  arc: {
    style: "repulsor-pulse",
    duration: 2400,
    verticalAmp: 3.2,
    tiltDeg: 2,
    scaleAmp: 0.04,
    auraPulse: 0.18,
  },
  leaf: {
    style: "groot-groove",
    duration: 2300,
    verticalAmp: 3.0,
    tiltDeg: 7,
    scaleAmp: 0.045,
    auraPulse: 0.13,
  },
  shield: {
    style: "vibranium-stealth",
    duration: 3400,
    verticalAmp: 2.2,
    tiltDeg: 2,
    scaleAmp: 0.035,
    auraPulse: 0.15,
  },
  force: {
    style: "force-levitate",
    duration: 3800,
    verticalAmp: 3.6,
    tiltDeg: 3.5,
    scaleAmp: 0.03,
    auraPulse: 0.16,
  },
  droid: {
    style: "droid-rock",
    duration: 2100,
    verticalAmp: 2.5,
    tiltDeg: 6,
    scaleAmp: 0.035,
    auraPulse: 0.12,
  },
  helmet: {
    style: "beskar-stance",
    duration: 3600,
    verticalAmp: 2.0,
    tiltDeg: 2,
    scaleAmp: 0.025,
    auraPulse: 0.11,
  },
};

export interface CharacterMotionStageProps {
  motif: CharacterMotif;
  size: number;
  accentHex: string;
  glowHex: string;
  animated?: boolean;
  intensity?: "ambient" | "celebration";
  children: React.ReactNode;
  testID?: string;
}

export function CharacterMotionStage({
  motif,
  size,
  accentHex,
  glowHex,
  animated = true,
  intensity = "ambient",
  children,
  testID,
}: CharacterMotionStageProps) {
  const { reduceMotion } = useTheme();
  const spec = CHARACTER_MOTION_SPECS[motif] ?? CHARACTER_MOTION_SPECS.helmet;
  const shouldAnimate = Boolean(animated && !reduceMotion);
  const boost = intensity === "celebration" ? 1.35 : 1;

  const phase = useSharedValue(0);
  const aura = useSharedValue(0);

  useEffect(() => {
    if (!shouldAnimate) {
      cancelAnimation(phase);
      cancelAnimation(aura);
      phase.value = 0;
      aura.value = 0;
      return;
    }

    const half = Math.max(200, Math.round(spec.duration / 2));
    const auraHalf = Math.max(240, Math.round((spec.duration * 0.85) / 2));
    const easeSin = { easing: Easing.inOut(Easing.sin) };
    const easeQuad = { easing: Easing.inOut(Easing.quad) };

    phase.value = withRepeat(
      withSequence(
        withTiming(1, { duration: half, ...easeSin }),
        withTiming(-1, { duration: half, ...easeSin })
      ),
      -1,
      true
    );

    aura.value = withDelay(
      60,
      withRepeat(
        withSequence(
          withTiming(1, { duration: auraHalf, ...easeQuad }),
          withTiming(0, { duration: auraHalf, ...easeQuad })
        ),
        -1,
        true
      )
    );

    return () => {
      cancelAnimation(phase);
      cancelAnimation(aura);
    };
  }, [aura, phase, shouldAnimate, spec.duration]);

  const emblemStyle = useAnimatedStyle(() => {
    if (!shouldAnimate) {
      return {
        transform: [{ translateY: 0 }, { rotateZ: "0deg" }, { scale: 1 }],
      };
    }
    const p = phase.value;
    const absP = Math.abs(p);
    const translateY = -p * spec.verticalAmp * boost;
    const tilt = p * spec.tiltDeg * boost;
    const scale = 1 + absP * spec.scaleAmp * boost;
    return {
      transform: [
        { translateY },
        { rotateZ: `${tilt}deg` },
        { scale },
      ],
    };
  });

  const auraRingStyle = useAnimatedStyle(() => {
    if (!shouldAnimate) {
      return {
        opacity: 0.24,
        transform: [{ scale: 1 }],
      };
    }
    const a = aura.value;
    const ringScale = 0.96 + a * (0.12 * boost + spec.auraPulse * 0.25);
    const ringOpacity = 0.22 + a * 0.26;
    return {
      opacity: ringOpacity,
      transform: [{ scale: ringScale }],
    };
  });

  const haloSize = Math.round(size * 1.06);
  const haloBg = mixAlpha(glowHex, 0.28);
  const haloBorder = mixAlpha(accentHex, 0.45);

  return (
    <View
      testID={testID ?? `character-motion-stage-${motif}`}
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Animated.View
        pointerEvents="none"
        testID={testID ? `${testID}-aura` : `character-motion-aura-${motif}`}
        style={[
          {
            position: "absolute",
            width: haloSize,
            height: haloSize,
            borderRadius: haloSize / 2,
            backgroundColor: haloBg,
            borderWidth: Math.max(1.5, Math.round(size * 0.022)),
            borderColor: haloBorder,
          },
          auraRingStyle,
        ]}
      />
      <Animated.View
        testID={testID ? `${testID}-emblem` : `character-motion-emblem-${motif}`}
        style={[
          {
            width: size,
            height: size,
            alignItems: "center",
            justifyContent: "center",
          },
          emblemStyle,
        ]}
      >
        {children}
      </Animated.View>
    </View>
  );
}

export default CharacterMotionStage;
