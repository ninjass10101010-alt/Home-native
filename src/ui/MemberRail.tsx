import React from "react";
import { Pressable, ScrollView, Text, View, ViewStyle } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { MIN_TARGET_DP, TYPOGRAPHY } from "../theme/tokens";
import { Material } from "../theme/Material";
import { mix } from "../theme/mix";

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

/**
 * Wall member rail (the wall-mode header rail from the 2026-09-09 wall spec §5):
 * one avatar tile per member, current member glows in their accent with a ✓,
 * Sign out at the rail's end. Tiles ≥ 64dp (rail tiles run 88).
 */
export function MemberRail({ members, currentName = null, onSelect, onSignOut, style, testID }: MemberRailProps) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={style} accessibilityLabel="Family members">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, alignItems: "center" }}>
        {members.map((m) => {
          const current = m.name === currentName;
          return (
            <Pressable
              key={m.name}
              accessibilityRole="button"
              accessibilityLabel={current ? `Signed in as ${m.name}` : `Sign in as ${m.name}`}
              onPress={() => onSelect(m)}
              style={{ alignItems: "center", minWidth: Math.max(88, MIN_TARGET_DP) }}
            >
              <View
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: 44,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 3,
                  borderColor: current ? m.color ?? colors["color-accent-selected"] ?? colors["color-text-primary"] : "transparent",
                  backgroundColor: current
                    ? mix(m.color ?? colors["color-accent-selected"] ?? colors["color-text-primary"], "transparent", 20)
                    : "transparent",
                }}
              >
                <Material tier="regular" style={{ width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 34 }}>{m.emoji}</Text>
                </Material>
                {current ? (
                  <View
                    style={{
                      position: "absolute",
                      top: -2,
                      right: -2,
                      width: 26,
                      height: 26,
                      borderRadius: 13,
                      backgroundColor: colors["color-accent-mint"] ?? "transparent",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: colors["color-primary-foreground"], fontSize: 14, fontWeight: "800" }}>✓</Text>
                  </View>
                ) : null}
              </View>
              <Text
                numberOfLines={1}
                style={{
                  marginTop: 6,
                  color: current ? colors["color-text-primary"] : colors["color-text-secondary"],
                  fontSize: TYPOGRAPHY.label.fontSize,
                  fontWeight: current ? "700" : "500",
                  maxWidth: 96,
                }}
              >
                {m.name}
              </Text>
            </Pressable>
          );
        })}
        {onSignOut ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            onPress={onSignOut}
            style={{ alignItems: "center", justifyContent: "center", minHeight: MIN_TARGET_DP, paddingHorizontal: 16 }}
          >
            <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "600" }}>
              Sign out
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

export default MemberRail;
