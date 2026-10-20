import React from "react";
import { Image, Pressable, ScrollView, Text, View, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useTheme } from "../theme/ThemeProvider";
import { MIN_TARGET_DP, MOTION, RADII, TYPOGRAPHY } from "../theme/tokens";
import { accentDeepened, mix } from "../theme/mix";
import { AnimatedEmoji } from "./AnimatedEmoji";
import { memberAccentHex } from "../theme/memberColor";

export interface RailMember {
  name: string;
  emoji: string;
  color?: string;
}

export interface MemberRailProps {
  members: RailMember[];
  currentName?: string | null;
  onSelect: (member: RailMember) => void;
  onSignOut?: () => void;
  style?: ViewStyle;
  testID?: string;
}

/** True when the member's "emoji" slot carries a photo (data-URI or URL). */
export function isPhotoUri(emoji: string): boolean {
  return (
    typeof emoji === "string" &&
    (emoji.startsWith("data:image/") || emoji.startsWith("http") || emoji.startsWith("/"))
  );
}

/** Auto-reset window for the armed "Sign out?" state (web WallMemberRail parity). */
const SIGN_OUT_ARM_MS = 3000;

/* ── Geometry, measured off the production web capture (1080×1920) ──────────
   The web rail (Home-ai src/components/wall/WallMemberRail.tsx) is a row of
   `w-[80px]` tiles on a `gap-2` (8px) pitch, each holding a `w-12 h-12` (48px)
   avatar inside a `ring-2` (2px) ring, the first name centred underneath.
   Measured in reference/home/parent-dark.png at 1080×1920: the photo discs are
   50px across on an 88px pitch, the tiles 80px wide, the names 14px — 1:1 with
   the wall's 1080-wide stage, so these are dp, not scaled units. */
const TILE_W = 80;
/** The web's `gap-2`. */
const TILE_GAP = 8;
/** The web's `p-2`. */
const TILE_PAD = 8;
/** The web's `gap-1` between the disc and the name. */
const NAME_GAP = 4;
/** The avatar's OUTER footprint: a 48px avatar plus the web's 2px ring. */
const DISC = 52;
/** The web's `w-12 h-12` avatar — the photo fills it edge to edge. */
const PHOTO = 48;
/** The web's `ring-2`. */
const RING = 2;
/** Emoji fallback glyph (the web renders AnimatedEmoji at its "lg" = 48px
    inside the 48px avatar; the native glyph needs the line box to fit). */
const EMOJI = 40;

/**
 * The rail's press response — the web's `.tap` (active:scale-[0.97], 150ms).
 * A tile is a control, so it answers the finger; reduced motion keeps the
 * artwork still.
 */
function RailTap({
  accessibilityLabel,
  onPress,
  children,
  style,
}: {
  accessibilityLabel: string;
  onPress: () => void;
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const { reduceMotion } = useTheme();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        onPressIn={() => {
          // eslint-disable-next-line react-hooks/immutability -- Reanimated shared-value write is the idiom
          if (!reduceMotion) scale.value = withTiming(0.97, { duration: MOTION.fast });
        }}
        onPressOut={() => {
          // eslint-disable-next-line react-hooks/immutability -- Reanimated shared-value write is the idiom
          scale.value = withTiming(1, { duration: MOTION.fast });
        }}
        style={style}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

/**
 * Wall member rail (the wall-mode header rail from the 2026-09-09 wall spec §5):
 * one avatar per member, the signed-in tile carries the accent, Sign out at the
 * rail's end. Tiles ≥ 64dp (the tile is 92dp tall: 8 pad + 52 disc + 4 + 20).
 */
export function MemberRail({ members, currentName = null, onSelect, onSignOut, style, testID }: MemberRailProps) {
  const { colors, theme, accentColor } = useTheme();
  // Web WallMemberRail parity: sign-out is a 2-tap confirm — the first tap
  // arms ("Sign out?"), the second fires; the armed state auto-resets.
  const [arming, setArming] = React.useState(false);

  React.useEffect(() => {
    if (!arming) return;
    const t = setTimeout(() => setArming(false), SIGN_OUT_ARM_MS);
    return () => clearTimeout(t);
  }, [arming]);

  const rose = colors["color-accent-rose"] ?? accentColor;

  /* The tile plate. The web draws `border-white/10` over `bg-surface-0/25`:
     a hairline over a wash that sinks into the canvas, so the rail reads as a
     row of photos and not a row of cards. The house `color-border` token is
     that hairline; the wash is the surface token at 25%. On the signed-in
     tile the web swaps both for the live accent (60% border / 15% wash). */
  const plateBorder = colors["color-border"];
  const plateBg = mix(colors["color-surface-0"], "transparent", 25);
  const selfBorder = mix(accentColor, "transparent", 60);
  const selfBg = mix(accentColor, "transparent", 15);

  return (
    <View testID={testID} style={[{ width: "100%" }, style]} accessibilityLabel="Family members">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, alignItems: "center" }}
      >
        {/* The web rail is `justify-end` — the members hug the right of the
            header. `marginLeft: auto` reproduces that WITHOUT the flex-end
            overflow trap: a roster wider than the wall then starts at x=0 and
            stays scrollable instead of spilling off the left edge. */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: TILE_GAP, marginLeft: "auto" }}>
          {members.map((m) => {
            const current = m.name === currentName;
            // color arrives as a NAME from the roster — resolve to a token first.
            // A roster row with no colour takes the web Avatar's own default
            // ("green" → mint), NOT the theme accent: an accent-coloured ring
            // on every tile would read as "every member is signed in".
            const memberHex = memberAccentHex(m.color ?? "green", theme, accentColor);
            const photo = isPhotoUri(m.emoji);
            // The web's `ring-<accent>/30` (violet rides at 40%).
            const ringColor = mix(memberHex, "transparent", m.color === "violet" ? 40 : 30);
            // The web's emoji disc wash (`bg-<accent>/20`). It also sits under a
            // photo, so a photo that never loads leaves the member's colour
            // instead of an empty hole.
            const discBg = mix(memberHex, "transparent", 20);
            return (
              <RailTap
                key={m.name}
                accessibilityLabel={current ? `Signed in as ${m.name}` : `Sign in as ${m.name}`}
                onPress={() => onSelect(m)}
                style={{
                  width: TILE_W,
                  alignItems: "center",
                  justifyContent: "flex-start",
                  minHeight: MIN_TARGET_DP,
                  paddingVertical: TILE_PAD,
                  paddingHorizontal: TILE_PAD,
                  borderRadius: RADII.md,
                  borderWidth: 1,
                  borderColor: current ? selfBorder : plateBorder,
                  backgroundColor: current ? selfBg : plateBg,
                  gap: NAME_GAP,
                }}
              >
                <View style={{ width: DISC, height: DISC, alignItems: "center", justifyContent: "center" }}>
                  <View
                    style={{
                      width: DISC,
                      height: DISC,
                      borderRadius: DISC / 2,
                      borderWidth: RING,
                      borderColor: ringColor,
                      backgroundColor: discBg,
                      overflow: "hidden",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {photo ? (
                      <Image
                        source={{ uri: m.emoji }}
                        style={{ width: PHOTO, height: PHOTO, borderRadius: PHOTO / 2 }}
                        resizeMode="cover"
                      />
                    ) : (
                      <AnimatedEmoji emoji={m.emoji} size={EMOJI} />
                    )}
                  </View>
                  {current ? (
                    <View
                      style={{
                        position: "absolute",
                        top: -5,
                        right: -5,
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        backgroundColor: mix(colors["color-accent-mint"] ?? accentColor, "transparent", 30),
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          color: colors["color-accent-ink-mint"] ?? colors["color-text-primary"],
                          fontSize: TYPOGRAPHY.label.fontSize,
                          lineHeight: TYPOGRAPHY.label.lineHeight,
                          fontWeight: "800",
                        }}
                      >
                        ✓
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text
                  numberOfLines={1}
                  style={{
                    color: current ? accentColor : colors["color-text-secondary"],
                    fontSize: TYPOGRAPHY.label.fontSize,
                    lineHeight: TYPOGRAPHY.label.lineHeight,
                    fontWeight: "600",
                    width: "100%",
                    textAlign: "center",
                  }}
                >
                  {/* web WallMemberRail parity: FIRST name only, with the
                      "✓ " prefix marking the session's own tile (a suffixed
                      name truncated the rail instead of fitting it). */}
                  {current ? "✓ " : ""}
                  {m.name.split(" ")[0]}
                </Text>
              </RailTap>
            );
          })}
          {onSignOut ? (
            arming ? (
              <RailTap
                accessibilityLabel="Confirm sign out"
                onPress={() => {
                  setArming(false);
                  onSignOut();
                }}
                style={{
                  minHeight: MIN_TARGET_DP,
                  paddingHorizontal: 16,
                  borderRadius: RADII.md,
                  backgroundColor: accentDeepened(rose, 25),
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    color: colors["color-primary-foreground"],
                    fontSize: TYPOGRAPHY.body.fontSize,
                    fontWeight: "700",
                  }}
                >
                  Sign out?
                </Text>
              </RailTap>
            ) : (
              <RailTap
                accessibilityLabel="Sign out"
                onPress={() => setArming(true)}
                style={{
                  minHeight: MIN_TARGET_DP,
                  paddingHorizontal: 16,
                  borderRadius: RADII.md,
                  borderWidth: 1,
                  borderColor: plateBorder,
                  backgroundColor: plateBg,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    color: colors["color-text-secondary"],
                    fontSize: TYPOGRAPHY.body.fontSize,
                    fontWeight: "600",
                  }}
                >
                  Sign out
                </Text>
              </RailTap>
            )
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

export default MemberRail;
