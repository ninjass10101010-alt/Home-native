import React from "react";
import { Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../theme/ThemeProvider";
import { mix } from "../theme/mix";
import { MIN_TARGET_DP } from "../theme/tokens";

export interface EmergencyShieldProps {
  style?: ViewStyle;
}

const SHIELD_DP = Math.max(64, MIN_TARGET_DP);

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
      <Text style={styles.glyph}>🛡️</Text>
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
  glyph: { fontSize: 32 },
});

export default EmergencyShield;
