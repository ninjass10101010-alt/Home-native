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
  const ringFill = mixAlpha(accentHex, 0.22);
  const innerFill = mixAlpha(accentHex, 0.36);

  const renderMotifArtwork = () => {
    switch (motif) {
      case "ears":
        return (
          <>
            <Circle cx="30" cy="32" r="13" fill={accentHex} />
            <Circle cx="70" cy="32" r="13" fill={accentHex} />
            <Circle cx="50" cy="54" r="22" fill={accentHex} />
            <Circle cx="43" cy="50" r="3" fill={inkHex} />
            <Circle cx="57" cy="50" r="3" fill={inkHex} />
            <Path d="M 41 61 Q 50 68 59 61" stroke={inkHex} strokeWidth="3.5" fill="none" strokeLinecap="round" />
          </>
        );
      case "snowflake":
        return (
          <>
            <Line x1="50" y1="20" x2="50" y2="80" stroke={accentHex} strokeWidth="4.5" strokeLinecap="round" />
            <Line x1="20" y1="50" x2="80" y2="50" stroke={accentHex} strokeWidth="4.5" strokeLinecap="round" />
            <Line x1="29" y1="29" x2="71" y2="71" stroke={accentHex} strokeWidth="4" strokeLinecap="round" />
            <Line x1="71" y1="29" x2="29" y2="71" stroke={accentHex} strokeWidth="4" strokeLinecap="round" />
            <Polygon points="50,36 64,50 50,64 36,50" fill={inkHex} />
          </>
        );
      case "wave":
        return (
          <>
            <Path
              d="M 22 58 Q 36 38 50 54 T 78 46"
              stroke={accentHex}
              strokeWidth="6"
              fill="none"
              strokeLinecap="round"
            />
            <Path
              d="M 24 70 Q 38 54 52 68 T 78 62"
              stroke={inkHex}
              strokeWidth="4.5"
              fill="none"
              strokeLinecap="round"
            />
            <Circle cx="50" cy="32" r="8" fill={accentHex} />
          </>
        );
      case "alien":
        return (
          <>
            <Path d="M 20 42 Q 14 22 34 34" fill={accentHex} />
            <Path d="M 80 42 Q 86 22 66 34" fill={accentHex} />
            <Circle cx="50" cy="52" r="22" fill={accentHex} />
            <Circle cx="41" cy="49" r="5.5" fill={inkHex} />
            <Circle cx="59" cy="49" r="5.5" fill={inkHex} />
            <Polygon points="50,53 45,60 55,60" fill={inkHex} />
          </>
        );
      case "crown":
        return (
          <>
            <Polygon points="24,68 28,36 42,50 50,28 58,50 72,36 76,68" fill={accentHex} />
            <Rect x="24" y="70" width="52" height="7" rx="3" fill={inkHex} />
            <Circle cx="50" cy="24" r="4" fill={inkHex} />
          </>
        );
      case "rocket":
        return (
          <>
            <Path d="M 50 20 C 62 34 64 54 60 68 L 40 68 C 36 54 38 34 50 20 Z" fill={accentHex} />
            <Polygon points="40,56 26,70 40,68" fill={inkHex} />
            <Polygon points="60,56 74,70 60,68" fill={inkHex} />
            <Circle cx="50" cy="45" r="7" fill={inkHex} />
            <Polygon points="45,70 50,82 55,70" fill={accentHex} />
          </>
        );
      case "sheriff":
      case "sparkle":
        return (
          <>
            <Polygon
              points="50,20 58,39 79,41 63,55 68,76 50,65 32,76 37,55 21,41 42,39"
              fill={accentHex}
            />
            <Circle cx="50" cy="50" r="8" fill={inkHex} />
          </>
        );
      case "robot":
      case "droid":
        return (
          <>
            <Rect x="28" y="34" width="44" height="36" rx="10" fill={accentHex} />
            <Line x1="50" y1="20" x2="50" y2="34" stroke={inkHex} strokeWidth="4" strokeLinecap="round" />
            <Circle cx="50" cy="20" r="4.5" fill={accentHex} />
            <Circle cx="40" cy="50" r="6" fill={inkHex} />
            <Circle cx="60" cy="50" r="6" fill={inkHex} />
            <Rect x="38" y="61" width="24" height="4" rx="2" fill={inkHex} />
          </>
        );
      case "web":
        return (
          <>
            <Polygon points="50,22 74,36 74,64 50,78 26,64 26,36" stroke={accentHex} strokeWidth="4" fill="none" />
            <Polygon points="50,34 64,42 64,58 50,66 36,58 36,42" stroke={inkHex} strokeWidth="3" fill="none" />
            <Line x1="50" y1="22" x2="50" y2="78" stroke={accentHex} strokeWidth="3" />
            <Line x1="26" y1="36" x2="74" y2="64" stroke={accentHex} strokeWidth="3" />
            <Line x1="74" y1="36" x2="26" y2="64" stroke={accentHex} strokeWidth="3" />
          </>
        );
      case "arc":
        return (
          <>
            <Circle cx="50" cy="50" r="26" stroke={accentHex} strokeWidth="5" fill="none" />
            <Polygon points="50,30 68,62 32,62" fill={accentHex} />
            <Circle cx="50" cy="52" r="7" fill={inkHex} />
          </>
        );
      case "leaf":
        return (
          <>
            <Path d="M 50 22 C 72 28 76 56 50 78 C 24 56 28 28 50 22 Z" fill={accentHex} />
            <Line x1="50" y1="30" x2="50" y2="74" stroke={inkHex} strokeWidth="4" strokeLinecap="round" />
            <Line x1="50" y1="48" x2="62" y2="38" stroke={inkHex} strokeWidth="3" strokeLinecap="round" />
            <Line x1="50" y1="56" x2="38" y2="46" stroke={inkHex} strokeWidth="3" strokeLinecap="round" />
          </>
        );
      case "shield":
      case "helmet":
        return (
          <>
            <Path d="M 28 26 L 72 26 L 72 52 C 72 68 50 78 50 78 C 50 78 28 68 28 52 Z" fill={accentHex} />
            <Line x1="36" y1="44" x2="64" y2="44" stroke={inkHex} strokeWidth="5" strokeLinecap="round" />
            <Line x1="50" y1="44" x2="50" y2="70" stroke={inkHex} strokeWidth="5" strokeLinecap="round" />
          </>
        );
      case "force":
      default:
        return (
          <>
            <Polygon points="16,44 36,38 34,54" fill={accentHex} />
            <Polygon points="84,44 64,38 66,54" fill={accentHex} />
            <Circle cx="50" cy="50" r="18" fill={accentHex} />
            <Circle cx="43" cy="47" r="4.5" fill={inkHex} />
            <Circle cx="57" cy="47" r="4.5" fill={inkHex} />
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

