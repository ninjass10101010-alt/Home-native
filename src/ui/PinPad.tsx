import React, { useState } from "react";
import { Pressable, Text, View, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import { useTheme } from "../theme/ThemeProvider";
import { MOTION, MIN_TARGET_DP, TYPOGRAPHY } from "../theme/tokens";
import { Material } from "../theme/Material";
import { SoftButton } from "./SoftButton";

export interface PinPadProps {
  /** Display name + emoji of the member signing in. */
  member: { name: string; emoji: string; color?: string };
  /** Called with the complete 4-digit code. Verification is the caller's job. */
  onVerified: (pin: string) => void;
  onCancel: () => void;
  busy?: boolean;
  /** When set/changed, the pads shakes + clears (unless reduceMotion). */
  error?: string | null;
  style?: ViewStyle;
  testID?: string;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "Clear", "0", "⌫"] as const;

/**
 * Presentational wall PIN pad (port of components/wall/WallPinPad.tsx at wall
 * scale: 96dp keys — above the 64dp floor, sized for 3-10ft reach).
 * Presentational ONLY: never stores the PIN beyond local state, clears on
 * failure, honest error copy is the caller's (auth layer, Task 12).
 */
export function PinPad({ member, onVerified, onCancel, busy = false, error = null, style, testID }: PinPadProps) {
  const { colors, reduceMotion } = useTheme();
  const [pin, setPin] = useState("");
  const shake = useSharedValue(0);

  React.useEffect(() => {
    if (!error) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clear-on-error is the honest-failure contract
    setPin("");
    if (reduceMotion) return;
    shake.value = withSequence(
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(-8, { duration: 50 }),
      withTiming(8, { duration: 50 }),
      withTiming(0, { duration: MOTION.fast })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- shake is a stable Reanimated shared value (a ref-like mutable, correctly omitted; listing it made the clear re-fire on every render under the jest mock where useSharedValue is per-render)
  }, [error, reduceMotion]);

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  const press = (k: string) => {
    if (busy) return;
    if (k === "Clear") return setPin("");
    if (k === "⌫") return setPin((p) => p.slice(0, -1));
    const next = (pin + k).slice(0, 4);
    setPin(next);
    if (next.length === 4) onVerified(next);
  };

  const firstName = member.name.split(" ")[0];

  return (
    <View testID={testID} style={style}>
      <View style={{ alignItems: "center", marginBottom: 24 }}>
        <Text style={{ fontSize: 56 }}>{member.emoji}</Text>
        <Text
          style={{
            color: colors["color-text-primary"],
            fontSize: TYPOGRAPHY.stat.fontSize,
            fontWeight: "700",
            marginTop: 8,
          }}
        >
          Hi {firstName} 👋
        </Text>
        <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.body.fontSize, marginTop: 4 }}>
          Enter your 4-digit PIN
        </Text>
      </View>

      <Animated.View style={[shakeStyle, { flexDirection: "row", justifyContent: "center", gap: 18, marginBottom: 20 }]}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              borderWidth: 2,
              borderColor: colors["color-text-secondary"],
              backgroundColor: i < pin.length ? colors["color-text-primary"] : "transparent",
            }}
          />
        ))}
      </Animated.View>

      {error ? (
        <Text
          accessibilityLiveRegion="assertive"
          style={{
            textAlign: "center",
            color: colors["color-accent-rose"] ?? colors["color-text-primary"],
            fontSize: TYPOGRAPHY.body.fontSize,
            marginBottom: 12,
          }}
        >
          {error}
        </Text>
      ) : null}

      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "center",
          width: 3 * 96 + 2 * 16,
          gap: 16,
          alignSelf: "center",
        }}
      >
        {KEYS.map((k) => (
          <Pressable
            key={k}
            accessibilityRole="button"
            accessibilityLabel={k === "⌫" ? "Backspace" : k}
            accessibilityState={{ busy }}
            disabled={busy}
            onPress={() => press(k)}
            style={({ pressed }) => [
              { borderRadius: 48 },
              pressed && !reduceMotion ? { transform: [{ scale: 0.96 }] } : null,
            ]}
          >
            <Material
              tier="thin"
              style={{
                width: Math.max(96, MIN_TARGET_DP),
                height: Math.max(96, MIN_TARGET_DP),
                borderRadius: 48,
                alignItems: "center",
                justifyContent: "center",
                opacity: busy ? 0.6 : 1,
              }}
            >
              <Text
                style={{
                  color: colors["color-text-primary"],
                  fontSize: TYPOGRAPHY.stat.fontSize,
                  fontWeight: "600",
                }}
              >
                {k}
              </Text>
            </Material>
          </Pressable>
        ))}
      </View>

      <View style={{ alignItems: "center", marginTop: 20 }}>
        <SoftButton variant="ghost" onPress={onCancel} accessibilityLabel="Cancel sign in">
          Cancel
        </SoftButton>
      </View>
    </View>
  );
}

export default PinPad;
