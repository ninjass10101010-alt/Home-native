import React from "react";
import { Pressable, Text, View, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useTheme } from "../theme/ThemeProvider";
import { Material } from "../theme/Material";
import { accentDeepened, mix } from "../theme/mix";
import { MOTION, TYPOGRAPHY } from "../theme/tokens";
import { NavIcon } from "../ui/NavIcon";
import { SoftButton } from "../ui/SoftButton";
import {
  NavIconKey,
  NavRole,
  navItemsForRole,
  isNavItemActive,
  resolveRoute,
} from "./nav-items";

/** Legacy emoji table retained for backward compatibility. */
export const NAV_ICONS: Record<NavIconKey | "more", string> = {
  home: "🏠",
  ask: "💬",
  meals: "🍽️",
  tasks: "✅",
  rewards: "⭐",
  calendar: "📅",
  house: "🏡",
  settings: "⚙️",
  grocery: "🛒",
  skill: "🌱",
  capsule: "💌",
  analytics: "📊",
  mountain: "⛰️",
  memory: "🧠",
  photos: "📸",
  music: "🎵",
  more: "☰",
};

export interface CapsuleDockProps {
  role: NavRole;
  /** Auth hydration gate: render NOTHING until true (no parent-cap flash). */
  hydrated: boolean;
  /** Current path (the root layout supplies it from expo-router). */
  pathname: string;
  onNavigate: (path: string) => void;
  style?: ViewStyle;
  testID?: string;
}

/**
 * The ONE navigation surface: a bottom-center material-thick capsule with the
 * role's primary manifest caps (7 — Home/Ask/Meals/Tasks/Calendar + the
 * role's House↔Rewards pair + Settings; web CapsuleNav parity). The More…
 * sheet has NO dock cap — on the web the MoreButton lives on Home itself, so
 * the wall keeps exactly seven targets at thumb distance.
 * Active cap = accent disc + pill sheen per the web's --color-nav-active* chain,
 * resolved per theme+accent via mix(). Labels are always visible (this app
 * IS the wall).
 */

/**
 * The web's WALL dock geometry, measured on the reference and read off
 * Home-ai/src/components/ui/CapsuleNav.tsx (the `wall` branch) + its
 * `GEOMETRY` custom properties, evaluated at the wall viewport (1080px):
 *
 *   --capsule-edge  clamp(2px, (100vw − 320px) × 0.12, 12px)  → 12px
 *   --capsule-pad   clamp(1px, (100vw − 320px) × 0.12, 12px)  → 12px
 *   --capsule-gap   clamp(0px, (100vw − 320px) × 0.06,  6px)  →  6px
 *
 * and the wall-only cap: `h-[72px]` cell, a `h-[72px] w-[72px]` circle, a
 * `h-9 w-9` (36px) glyph box, a `px-2.5 text-lg` (10px pad, 18px) label.
 *
 * MEASURED on reference/home/parent-dark.png (1080×1920): the capsule's hairline
 * runs x 13→1067 (1055 wide — the 12px page margin either side), its top edge
 * at y 1810 and its bottom at y 1907 (98 tall = 12 pad + 72 cap + 12 pad +
 * 2 border); the idle circles are 72px across (x 170–241, 297–366, 441–510,
 * 583–652, 751–820, 899–968) and the glyph inside them ~26px of ink in a 36px
 * box; the label sits 10px after its circle and 16px before the next one.
 *
 * The native was measurably off on every count: a 892px capsule inset ~77px
 * from the wall's content margins, 48px idle circles, 22px glyphs and 14sp
 * labels — the dock read as a cramped strip of specks under the reference's
 * row of full-size caps.
 */
const CAP_EDGE = 12; // --capsule-edge at 1080px — the capsule's page margin
const CAP_PAD = 12; // --capsule-pad — the capsule's inner padding
const CAP_GAP = 6; // --capsule-gap — the gap between two caps
const CAP_DISC = 72; // the wall cap's h-[72px] w-[72px] circle
const CAP_GLYPH = 36; // the wall cap's h-9 w-9 glyph box
/**
 * The floating bar's height, and the screen-space it reserves at the foot of
 * the wall: the capsule's page margin + its own height (top padding + the cap
 * cell + the 1px rim, top and bottom). The MiniPlayer pill sits ABOVE this
 * line, so the floating chrome never overlaps.
 */
export const DOCK_TOP_OFFSET = CAP_EDGE + CAP_PAD * 2 + CAP_DISC + 2;
/**
 * The wall cap's label. The web writes `text-lg` (18px); the native's system
 * face measures a shade wider per glyph, and the KID dock swaps "House" (5
 * characters) for "Rewards" (7) — at 18sp the widest role's seven labels no
 * longer fit the capsule's inner width and the last one ("Settings") is
 * clipped mid-letter. 17sp is the largest size at which EVERY role's seven
 * labels still fit the reference's capsule, and it renders 1px shorter in ink
 * than the reference's 18px.
 */
const CAP_LABEL = 17;
const CAP_LABEL_PAD_LEFT = 10; // the label's px-2.5 — the gap after the disc
const CAP_LABEL_PAD_RIGHT = 6; // …and before the next cap (the reference's 16 total)

export function CapsuleDock({ role, hydrated, pathname, onNavigate, style, testID }: CapsuleDockProps) {
  const { colors, accentColor, reduceMotion } = useTheme();
  if (!hydrated) return null;

  const caps = navItemsForRole(role);

  const activeBg = mix(accentColor, "transparent", 20);
  const activeBorder = mix(accentColor, "transparent", 38);
  const activeDiscBg = colors["color-nav-active-fill"] ?? accentDeepened(accentColor, 28);
  // transparent ring (web CapsuleNav parity): the old 55%-accent ring read as
  // a bruised halo around the active disc in light mode.
  const activeDiscBorder = "transparent";
  const idleDiscBg = mix(colors["color-surface-2"], "transparent", 58);
  const idleDiscBorder = mix(colors["color-text-primary"], "transparent", 12);

  return (
    <View
      testID={testID ?? "floating-dock"}
      style={[
        // The web's nav is `fixed bottom-0 left-0 right-0` with the capsule
        // inset by --capsule-edge and lifted by `mb-3` (12px). The native
        // centred a CONTENT-WIDTH capsule instead, which left a ~77px gutter
        // on each side of the wall — the dock read as a floating strip rather
        // than as the wall's chrome.
        //
        // SP3-B: it is the FLOATING GLASS DOCK — a fixed bar with page margins
        // on all three sides, no morph, no drag. The routes, labels and
        // testIDs are unchanged; only the Yuma glass language is adopted.
        {
          position: "absolute",
          left: CAP_EDGE,
          right: CAP_EDGE,
          bottom: CAP_EDGE,
          alignItems: "stretch",
          zIndex: 50,
          elevation: 10,
        },
        style,
      ]}
    >
      <Material
        tier="thick"
        style={{
          flexDirection: "row",
          alignItems: "center",
          borderRadius: 9999,
          paddingHorizontal: CAP_PAD,
          paddingVertical: CAP_PAD,
          gap: CAP_GAP,
          // The reference's caps FILL the capsule (its content is exactly the
          // capsule's inner width), so the row spreads its caps edge to edge
          // and the leftover space becomes the inter-cap gap — never a lump of
          // empty glass at one end.
          justifyContent: "space-between",
          backgroundColor: mix(colors["color-surface-0"], "transparent", 82),
          borderColor: mix(colors["color-text-primary"], "transparent", 14),
        }}
      >
        {caps.map((item) => {
          const active = isNavItemActive(pathname, item);
          return (
            <DockCap
              key={item.path}
              iconKey={item.iconKey as NavIconKey}
              label={item.label}
              active={active}
              activeBg={activeBg}
              activeBorder={activeBorder}
              activeDiscBg={activeDiscBg}
              activeDiscBorder={activeDiscBorder}
              idleDiscBg={idleDiscBg}
              idleDiscBorder={idleDiscBorder}
              activeGlyphColor={colors["color-primary-foreground"]}
              idleGlyphColor={colors["color-text-secondary"]}
              activeLabelInk={colors["color-text-primary"]}
              inactiveInk={colors["color-text-secondary"]}
              onPress={() => onNavigate(resolveRoute(item.path, item.label))}
              reduceMotion={reduceMotion}
              testID={`dock-${item.label.toLowerCase()}`}
            />
          );
        })}
      </Material>
    </View>
  );
}

interface DockCapProps {
  iconKey: NavIconKey;
  label: string;
  active: boolean;
  activeBg: string;
  activeBorder: string;
  activeDiscBg: string;
  activeDiscBorder: string;
  idleDiscBg: string;
  idleDiscBorder: string;
  activeGlyphColor: string;
  idleGlyphColor: string;
  activeLabelInk: string;
  inactiveInk: string;
  onPress: () => void;
  reduceMotion: boolean;
  testID?: string;
}

function DockCap({
  iconKey,
  label,
  active,
  activeBg,
  activeBorder,
  activeDiscBg,
  activeDiscBorder,
  idleDiscBg,
  idleDiscBorder,
  activeGlyphColor,
  idleGlyphColor,
  activeLabelInk,
  inactiveInk,
  onPress,
  reduceMotion,
  testID,
}: DockCapProps) {
  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View
      style={[
        aStyle,
        {
          borderRadius: 9999,
          borderWidth: 1,
          borderColor: active ? activeBorder : "transparent",
          backgroundColor: active ? activeBg : "transparent",
        },
      ]}
    >
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: active }}
        onPress={onPress}
        onPressIn={() => {
          if (!reduceMotion) {
            // eslint-disable-next-line react-hooks/immutability -- Reanimated shared-value write is the idiom
            scale.value = withTiming(0.96, { duration: MOTION.fast });
          }
        }}
        onPressOut={() => {
          // eslint-disable-next-line react-hooks/immutability -- Reanimated shared-value write is the idiom
          scale.value = withTiming(1, { duration: MOTION.fast });
        }}
        style={{
          // The web's wall cap cell is 72px tall (h-[72px]) — above the 64dp
          // target floor, so the whole cell is the hit box.
          minWidth: CAP_DISC,
          minHeight: CAP_DISC,
          height: CAP_DISC,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 9999,
        }}
      >
        <View
          style={{
            width: CAP_DISC,
            height: CAP_DISC,
            borderRadius: CAP_DISC / 2,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: active ? activeDiscBg : idleDiscBg,
            borderWidth: 1,
            borderColor: active ? activeDiscBorder : idleDiscBorder,
            // The circle must not shrink when the row is tight: it IS the cap.
            flexShrink: 0,
          }}
        >
          <NavIcon
            iconKey={iconKey}
            active={active}
            size={CAP_GLYPH}
            color={active ? activeGlyphColor : idleGlyphColor}
          />
        </View>
        <Text
          numberOfLines={1}
          style={{
            color: active ? activeLabelInk : inactiveInk,
            fontSize: CAP_LABEL,
            lineHeight: Math.round(CAP_LABEL * 1.3),
            // The reference's dock label reads as a MEDIUM weight (the web's
            // `font-semibold` in the reference's geometric sans); the native's
            // 600/700 at 14sp read as a slab. It clears the 14sp floor.
            fontWeight: "500",
            paddingLeft: CAP_LABEL_PAD_LEFT,
            paddingRight: CAP_LABEL_PAD_RIGHT,
            // A long label shrinks rather than pushing the capsule wider.
            flexShrink: 1,
          }}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export default CapsuleDock;

/**
 * The Home "More…" trigger (web page.tsx MoreButton parity): the secondary
 * destinations live in the More — sheet, and the web opens it from Home's
 * own action row, NOT the dock (the dock is the 7 primary caps only).
 */
export function MoreButton({ onPress, style }: { onPress: () => void; style?: ViewStyle }) {
  const { colors } = useTheme();
  return (
    <SoftButton
      variant="secondary"
      onPress={onPress}
      accessibilityLabel="More"
      testID="home-more"
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        paddingHorizontal: 22,
        ...(style ?? {}),
      }}
    >
      <NavIcon iconKey="more" size={20} color={colors["color-text-primary"]} />
      {/* hidden emoji a11y fallback — absolute so Yoga does not insert a
          phantom flex gap next to the (zero-size) glyph */}
      <Text style={{ position: "absolute", fontSize: 14, width: 0, height: 0, opacity: 0 }}>{NAV_ICONS.more}</Text>
      <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "600" }}>
        More…
      </Text>
    </SoftButton>
  );
}
