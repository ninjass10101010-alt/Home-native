import React from "react";
import { Pressable, StyleSheet, ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useRouter } from "expo-router";
import { useTheme } from "../theme/ThemeProvider";
import { mix } from "../theme/mix";
import { MIN_TARGET_DP } from "../theme/tokens";

export interface EmergencyShieldProps {
  style?: ViewStyle;
}

const SHIELD_DP = Math.max(64, MIN_TARGET_DP);
/**
 * The alarm glyph — the web's own emergency SVG (Home-ai
 * src/components/ui/EmergencyButton.tsx:254): a 24×24 shield OUTLINE with an
 * exclamation mark, stroked in the surface's foreground ink.
 *
 * The native used the 🛡️ emoji: a full-colour raster — a silver shield with
 * a red zigzag and NO exclamation — so the one control that has to read as
 * EMERGENCY read as "protection", and the raster broke the disc's monochrome
 * material. The white outline is measured in all four reference PNGs
 * (rgb 255,255,255 in dark, light and boost alike).
 */
const GLYPH_PX = 24;

/**
 * The always-visible emergency affordance (RN port of Home-ai's
 * EmergencyButton alarm surface): a 64dp rose shield floating top-right of
 * the Home header — never over the rail — one tap to /emergency. Rose stays
 * reserved for alarm semantics; the glyph carries no data (a11y label does).
 */
export function EmergencyShield({ style }: EmergencyShieldProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const rose = colors["color-accent-rose"] ?? colors["color-accent-selected"];
  const ink = colors["color-primary-foreground"];
  return (
    <Pressable
      testID="emergency-shield"
      accessibilityRole="button"
      accessibilityLabel="Emergency"
      onPress={() => router.push("/emergency" as never)}
      style={[
        styles.shield,
        { backgroundColor: rose, borderColor: mix(rose, "transparent", 78), shadowColor: rose },
        style,
      ]}
    >
      <Svg width={GLYPH_PX} height={GLYPH_PX} viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth={2}>
        <Path
          d="M12 2L4 7v6c0 5 3.5 9.7 8 11 4.5-1.3 8-6 8-11V7l-8-5z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path d="M12 8v4M12 16h.01" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shield: {
    position: "absolute",
    // Yoga positions absolute children by inset + border only (parent padding
    // is ignored — see yoga AbsoluteLayout.cpp), so the 24s ARE the wall's
    // edge rhythm (GRID_H_PAD/header pad), not 24 more on top of it.
    top: 24,
    right: 24,
    width: SHIELD_DP,
    height: SHIELD_DP,
    borderRadius: SHIELD_DP / 2,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
    elevation: 8,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
  },
});

export default EmergencyShield;
