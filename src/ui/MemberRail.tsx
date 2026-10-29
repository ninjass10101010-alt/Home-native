import React from "react";
import { Image, Pressable, Text, View, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useTheme } from "../theme/ThemeProvider";
import { MIN_TARGET_DP, MOTION, RADII, TYPOGRAPHY } from "../theme/tokens";
import { accentDeepened, mix } from "../theme/mix";
import { AnimatedEmoji } from "./AnimatedEmoji";
import {
  memberAccentHex,
  memberAvatarFallbackHex,
  normalizeMemberColorName,
  WEB_MEMBER_PALETTE,
} from "../theme/memberColor";
import { isStandInRoster } from "../api/members";

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
  wrap?: boolean;
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
   Measured in reference/home/guest-dark.png at 1080×1920: the photo discs are
   50px across on an 88px pitch, the tiles 80px wide, the names 14px — 1:1 with
   the wall's 1080-wide stage, so these are dp, not scaled units. */
const TILE_W = 80;
/** The web's `gap-2`. */
const TILE_GAP = 8;
/**
 * The web's `p-2` — 8px of plate padding on every side.
 *
 * The native once traded this down to 2px to squeeze "✓ Rebecca" into the
 * 80dp tile, which squashed the plate into a near-circle (78 tall instead of
 * the reference's 91) and left the disc's ring 2px from the plate's outline.
 * The plate's geometry is measured, not negotiable: reference/home/guest-dark.png
 * puts Rebecca's plate at x 216-295 / y 105-196 — 80 × 91, r=36 — with the
 * 52px disc+ring's first ink at y 113 (7px of air under the outline) and the
 * name's ink at y 172-182 (12px of clearance inside the plate on each side).
 * The signed-in label earns its room differently now (the self check rides the
 * DISC, not the label), so the padding can go back to the web's 8.
 */
const TILE_PAD = 8;
/** The web's `gap-1` (4px) PLUS the 1px the house's 14sp name sits higher in
 *  its line box than the web's 13px one.
 *
 *  Measured off the reference: with the web's p-2 padding the plate measures
 *  91px tall (106-196) and the name's ink ends on the baseline at 182, 14px
 *  clear of the outline. The native's 14sp glyphs ink 8px tall instead of
 *  the web's 11 (a 13px face), so the gap carries the difference: the ink
 *  lands at 175-182 — the SAME baseline as the reference, with the same 14px
 *  of bottom air inside the plate. */
const NAME_GAP = 5;
/** The web's `w-12 h-12` avatar — the photo fills it edge to edge. This is the
 *  LAYOUT box: the ring is a spread shadow OUTSIDE it and never grows the
 *  tile (the reference plate is 91px tall, not 94). */
const PHOTO = 48;
/** The web's `ring-2`. */
const RING = 2;
/** The ring's OUTER footprint: the 48px avatar plus the 2px spread. */
const DISC = PHOTO + RING * 2;
/** Emoji fallback glyph (the web renders AnimatedEmoji at its "lg" = 48px
    inside the 48px avatar; the native glyph needs the line box to fit). */
const EMOJI = 40;
/**
 * The self badge — the "✓" the web prefixes to the signed-in member's name.
 *
 * The web can afford it: its label is 13px, so "✓ Rebecca" measures ~58px
 * inside the tile's 64px content box. The native's 14sp floor makes the same
 * label 72px — it cannot fit an 80dp plate with the web's 8px padding, and
 * the version that DID fit (2px of padding) left the name 2px from the
 * plate's outline. So the check leaves the label and rides the DISC, where it
 * costs the label nothing and still reads as one intentional treatment: the
 * session's accent on the plate, the wash, the name and the badge.
 */
const SELF_BADGE = 18;

/**
 * The plate's corner radius. The web tile is `rounded-2xl`, and the house
 * theme maps `rounded-2xl` to `--radius-2xl: 36px` (Home-ai
 * src/app/globals.css:66) — NOT Tailwind's stock 16px. Measured off
 * reference/home/guest-dark.png: the plate's hairline leaves its flat top
 * run at x=252..259 and sweeps 36px down the corner (x=216 at y=142), which
 * is a 36px radius on an 80×91 box. `RADII.xxl` is that 36.
 */
const PLATE_RADIUS = RADII.xxl;

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
 * rail's end. Tiles ≥ 64dp (the tile is 91dp tall: 8 pad + 48 avatar + 5 + 20).
 */
export function MemberRail({ members, currentName = null, onSelect, onSignOut, style, testID, wrap = true }: MemberRailProps) {
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
  /* The web's Avatar falls back to GREEN for a colour name it cannot resolve
     (Avatar.tsx:28/38) — never to the theme's selected accent, which painted
     all nine rings the same blue and erased the family. */
  const fallbackHex = memberAvatarFallbackHex(theme);

  /* A stand-in roster (the built-in fallback, no live roster and no cache)
     must announce itself: the wall shows sample tiles, and telling a screen
     reader "Family members" while the tiles are placeholders is a lie. */
  const standIn = isStandInRoster(members);

  return (
    <View
      testID={testID}
      style={[{ width: "100%" }, style]}
      accessibilityLabel={standIn ? "Sample members — the family roster is unavailable" : "Family members"}
    >
      {/* The web rail is `flex flex-wrap items-center justify-end gap-2` — a
          STATIC row that WRAPS when the roster is wider than the wall. The
          native used a horizontal ScrollView, so an over-wide roster scrolled
          invisibly with no affordance that more members existed. */}
      <View
        style={{
          flexDirection: "row",
          flexWrap: wrap ? "wrap" : "nowrap",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: TILE_GAP,
        }}
      >
        {members.map((m, idx) => {
          const current = m.name === currentName;
          /* The member's colour, resolved the way the WEB resolves it. The live
             roster carries NO colour (PocketBase's `members.color` is empty on
             every row), so the accent comes from the web's canonical member
             palette by INDEX (Home-ai/src/db/index.ts:164 `memberColor(i)`) —
             the exact order the reference wall renders. A row that DOES carry
             a colour (the built-in stand-in roster, a row edited on the
             device) keeps it; an unknown name falls back to the web's green. */
          const colorName =
            normalizeMemberColorName(m.color) ?? WEB_MEMBER_PALETTE[idx % WEB_MEMBER_PALETTE.length];
          const memberHex = memberAccentHex(colorName, theme, accentColor, fallbackHex);
          const photo = isPhotoUri(m.emoji);
          // The web's `ring-<accent>/30` (violet rides at 40%).
          const ringColor = mix(memberHex, "transparent", colorName === "violet" ? 40 : 30);
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
                borderRadius: PLATE_RADIUS,
                borderWidth: 1,
                borderColor: current ? selfBorder : plateBorder,
                backgroundColor: current ? selfBg : plateBg,
                gap: NAME_GAP,
              }}
            >
              {/* The avatar. The web's `ring-2` is a SPREAD shadow drawn
                  OUTSIDE the 48px circle, over the plate — never over the
                  wash. Painting it inside (RN's borderWidth) composited the
                  accent over the accent wash and made the ring 1.4x too
                  bright, so the ring is its own 52px circle centred on the
                  48px avatar, drawn UNDER it. */}
              <View style={{ width: PHOTO, height: PHOTO, alignItems: "center", justifyContent: "center" }}>
                <View
                  style={{
                    position: "absolute",
                    top: -RING,
                    left: -RING,
                    width: DISC,
                    height: DISC,
                    borderRadius: DISC / 2,
                    borderWidth: RING,
                    borderColor: ringColor,
                  }}
                />
                <View
                  style={{
                    width: PHOTO,
                    height: PHOTO,
                    borderRadius: PHOTO / 2,
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
                {/* The self check — the web's "✓ " prefix, moved off the label
                    onto the disc (see SELF_BADGE). It wears the session's
                    accent, the same colour as the plate's rim, wash and name:
                    one treatment, not two. */}
                {current ? (
                  <View
                    pointerEvents="none"
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                    style={{
                      position: "absolute",
                      right: -SELF_BADGE / 2,
                      bottom: -SELF_BADGE / 2,
                      width: SELF_BADGE,
                      height: SELF_BADGE,
                      borderRadius: SELF_BADGE / 2,
                      backgroundColor: accentColor,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{
                        color: colors["color-primary-foreground"],
                        fontSize: TYPOGRAPHY.label.fontSize,
                        lineHeight: TYPOGRAPHY.label.fontSize,
                        fontWeight: "700",
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
                {/* web WallMemberRail parity: FIRST name only. The self check
                    rides the DISC (see SELF_BADGE), so the label keeps the room
                    the reference gives it — the name's ink sits 12px inside
                    the plate on each side, exactly as the reference measures.
                    The leading null keeps this Text's children a LIST rather
                    than a bare name, so the greeting's accent span stays the
                    only Text whose children IS a name. */}
                {null}
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
                borderRadius: PLATE_RADIUS,
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
                borderRadius: PLATE_RADIUS,
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
    </View>
  );
}

export default MemberRail;
