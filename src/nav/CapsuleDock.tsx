import React from "react";
import { Pressable, Text, View, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useTheme } from "../theme/ThemeProvider";
import { Material } from "../theme/Material";
import { mix } from "../theme/mix";
import { MIN_TARGET_DP, MOTION, TYPOGRAPHY } from "../theme/tokens";
import {
  NavIconKey,
  NavItemDefinition,
  NavRole,
  navItemsForRole,
  isNavItemActive,
} from "./nav-items";

/** Emoji placeholder glyphs until Wave 2 ports the web's NavIcon SVG paths. */
export const NAV_ICONS: Record<NavIconKey, string> = {
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
};

export interface CapsuleDockProps {
  role: NavRole;
  /** Auth hydration gate: render NOTHING until true (no parent-cap flash). */
  hydrated: boolean;
  /** Current path (the root layout supplies it from expo-router). */
  pathname: string;
  onNavigate: (path: string) => void;
  onOpenMore: () => void;
  style?: ViewStyle;
  testID?: string;
}

/**
 * The ONE navigation surface: a bottom-center material-thick capsule with the
 * 7 manifest caps (+ a More cap). Active cap = accent ink + halo per the
 * web's --color-nav-active* chain, resolved per theme+accent via mix().
 * Label renders on the ACTIVE cap only (web contract).
 */
export function CapsuleDock({ role, hydrated, pathname, onNavigate, onOpenMore, style, testID }: CapsuleDockProps) {
  const { colors, accentColor, reduceMotion } = useTheme();
  if (!hydrated) return null;

  const caps = navItemsForRole(role);
  const items: (NavItemDefinition | { path: "__more__"; label: string; iconKey: NavIconKey })[] = [
    ...caps,
    { path: "__more__", label: "More", iconKey: "memory" as NavIconKey },
  ];

  const activeBg = mix(accentColor, "transparent", 8);      // wash ≈ 6–8%
  const activeBorder = mix(accentColor, "transparent", 38); // border ≈ 38%
  const activeLabelInk = accentInkSafe(accentColor, colors["color-text-primary"]);

  return (
    <View
      testID={testID}
      style={[
        { position: "absolute", left: 0, right: 0, bottom: 24, alignItems: "center" },
        style,
      ]}
    >
      <Material
        tier="thick"
        style={{
          flexDirection: "row",
          borderRadius: 9999,
          padding: 8,
          gap: 4,
        }}
      >
        {items.map((item) => {
          const isMore = item.path === "__more__";
          const active = !isMore && isNavItemActive(pathname, item as NavItemDefinition);
          return (
            <DockCap
              key={item.path}
              icon={<Text style={{ fontSize: 26 }}>{NAV_ICONS[item.iconKey as NavIconKey]}</Text>}
              label={item.label}
              active={active}
              activeBg={activeBg}
              activeBorder={activeBorder}
              activeLabelInk={activeLabelInk}
              onPress={() => (isMore ? onOpenMore() : onNavigate(item.path))}
              reduceMotion={reduceMotion}
              testID={isMore ? "dock-more" : `dock-${(item as NavItemDefinition).label.toLowerCase()}`}
            />
          );
        })}
      </Material>
    </View>
  );
}

interface DockCapProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  activeBg: string;
  activeBorder: string;
  activeLabelInk: string;
  onPress: () => void;
  reduceMotion: boolean;
  testID?: string;
}

/** Label ink on the active cap: the 55% accent→body ink convention. */
function accentInkSafe(accent: string, textPrimary: string): string {
  return mix(accent, textPrimary, 55);
}

function DockCap({ icon, label, active, activeBg, activeBorder, activeLabelInk, onPress, reduceMotion, testID }: DockCapProps) {
  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View
      style={[
        aStyle,
        {
          borderRadius: 22,
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
          paddingHorizontal: 16,
          paddingVertical: 10,
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
        }}
      >
        {icon}
        {active ? (
          <Text
            style={{
              color: activeLabelInk,
              fontSize: TYPOGRAPHY.label.fontSize,
              fontWeight: "600",
            }}
          >
            {label}
          </Text>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

export default CapsuleDock;
