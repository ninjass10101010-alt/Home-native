import React from "react";
import { Pressable, Text, View, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useTheme } from "../theme/ThemeProvider";
import { Material } from "../theme/Material";
import { accentDeepened, mix } from "../theme/mix";
import { MIN_TARGET_DP, MOTION, TYPOGRAPHY } from "../theme/tokens";
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
export function CapsuleDock({ role, hydrated, pathname, onNavigate, style, testID }: CapsuleDockProps) {
  const { colors, accentColor, reduceMotion } = useTheme();
  if (!hydrated) return null;

  const caps = navItemsForRole(role);

  const activeBg = mix(accentColor, "transparent", 20);
  const activeBorder = mix(accentColor, "transparent", 38);
  const activeDiscBg = colors["color-nav-active-fill"] ?? accentDeepened(accentColor, 28);
  const activeDiscBorder = mix(accentColor, "transparent", 55);
  const idleDiscBg = mix(colors["color-surface-2"], "transparent", 58);
  const idleDiscBorder = mix(colors["color-text-primary"], "transparent", 12);

  return (
    <View
      testID={testID}
      style={[
        { position: "absolute", left: 0, right: 0, bottom: 18, alignItems: "center" },
        style,
      ]}
    >
      <Material
        tier="thick"
        style={{
          flexDirection: "row",
          alignItems: "center",
          borderRadius: 9999,
          paddingHorizontal: 10,
          paddingVertical: 8,
          gap: 6,
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
          minWidth: MIN_TARGET_DP,
          minHeight: MIN_TARGET_DP,
          height: 64,
          paddingLeft: 6,
          paddingRight: 12,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          borderRadius: 9999,
        }}
      >
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: active ? activeDiscBg : idleDiscBg,
            borderWidth: 1,
            borderColor: active ? activeDiscBorder : idleDiscBorder,
          }}
        >
          <NavIcon
            iconKey={iconKey}
            active={active}
            size={active ? 24 : 22}
            color={active ? activeGlyphColor : idleGlyphColor}
          />
        </View>
        <Text
          numberOfLines={1}
          style={{
            color: active ? activeLabelInk : inactiveInk,
            fontSize: TYPOGRAPHY.label.fontSize,
            fontWeight: active ? "700" : "600",
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
      <Text style={{ fontSize: 14, width: 0, height: 0, opacity: 0 }}>{NAV_ICONS.more}</Text>
      <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "600" }}>
        More…
      </Text>
    </SoftButton>
  );
}
