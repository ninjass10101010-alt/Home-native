import React from "react";
import { Image, Pressable, ScrollView, Text, View, ViewStyle } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { MIN_TARGET_DP, TYPOGRAPHY } from "../theme/tokens";
import { Material } from "../theme/Material";
import { IconButton } from "./IconButton";
import { mix } from "../theme/mix";
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

/**
 * Wall member rail (the wall-mode header rail from the 2026-09-09 wall spec §5):
 * one avatar tile per member, current member glows in their accent with a ✓,
 * Sign out at the rail's end. Tiles ≥ 64dp (rail tiles run 88).
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
  const inkRose = colors["color-accent-ink-rose"] ?? rose;

  return (
    <View testID={testID} style={style} accessibilityLabel="Family members">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, alignItems: "center" }}>
        {members.map((m) => {
          const current = m.name === currentName;
          // color arrives as a NAME from the roster — resolve to a token first
          const memberHex = memberAccentHex(m.color, theme, accentColor);
          const photo = isPhotoUri(m.emoji);
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
                  borderColor: current ? memberHex : "transparent",
                  backgroundColor: current ? mix(memberHex, "transparent", 20) : "transparent",
                }}
              >
                <Material
                  tier="regular"
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 36,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: mix(memberHex, "transparent", 18),
                    borderWidth: 1.5,
                    borderColor: mix(memberHex, "transparent", 45),
                  }}
                >
                  {photo ? (
                    <>
                      <Image
                        source={{ uri: m.emoji }}
                        style={{ width: 68, height: 68, borderRadius: 34 }}
                        resizeMode="cover"
                      />
                      <Text style={{ position: "absolute", opacity: 0, fontSize: 14 }}>{m.emoji}</Text>
                    </>
                  ) : (
                    <Text style={{ fontSize: 34 }}>{m.emoji}</Text>
                  )}
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
                  {/* web WallMemberRail parity: FIRST name only, with the
                      "✓ " prefix marking the session's own tile (a suffixed
                      name truncated the rail instead of fitting it). */}
                  {current ? "✓ " : ""}
                  {m.name.split(" ")[0]}
                </Text>
            </Pressable>
          );
        })}
        {onSignOut ? (
          arming ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Confirm sign out"
              onPress={() => {
                setArming(false);
                onSignOut();
              }}
              style={{
                alignItems: "center",
                justifyContent: "center",
                minHeight: MIN_TARGET_DP,
                paddingHorizontal: 16,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: mix(rose, "transparent", 40),
                backgroundColor: mix(rose, "transparent", 15),
              }}
            >
              <Text style={{ color: inkRose, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
                Sign out?
              </Text>
            </Pressable>
          ) : (
            <IconButton
              icon={<Text>⏻</Text>}
              label="Sign out"
              variant="danger"
              size="sm"
              onPress={() => setArming(true)}
            />
          )
        ) : null}
      </ScrollView>
    </View>
  );
}

export default MemberRail;
