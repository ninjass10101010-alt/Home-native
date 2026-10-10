import React, { useState } from "react";
import { Text, View, ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useTheme } from "../theme/ThemeProvider";
import { MOTION, MIN_TARGET_DP } from "../theme/tokens";
import { accentDeepened, mix } from "../theme/mix";

export interface SwipeAction {
  key: string;
  label: string;
  icon?: React.ReactNode;
  intent?: "default" | "destructive";
  onAction: () => void;
}

export interface SwipeableRowProps {
  children: React.ReactNode;
  /** Revealed by swiping left (row slides left). */
  actions?: SwipeAction[];
  style?: ViewStyle;
  testID?: string;
}

const THRESHOLD = 48;
const ACTION_WIDTH = 96; // wall scale (web: 88)

/**
 * RN port of ui/SwipeableRow.tsx. Swipe left reveals the action rail; release
 * past threshold snaps open, tap an action fires and closes. Destructive =
 * rose deepened fill + white label (the web's danger recipe).
 */
export function SwipeableRow({ children, actions = [], style, testID }: SwipeableRowProps) {
  const { colors, accentColor, reduceMotion } = useTheme();
  const [open, setOpen] = useState(false);
  const offset = useSharedValue(0);
  const maxOffset = actions.length * ACTION_WIDTH;

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onUpdate((e) => {
      offset.value = Math.max(-maxOffset, Math.min(0, e.translationX + (open ? -maxOffset : 0)));
    })
    .onEnd(() => {
      const dur = reduceMotion ? 0 : MOTION.fast;
      const shouldOpen = offset.value < -THRESHOLD;
      offset.value = withTiming(shouldOpen ? -maxOffset : 0, { duration: dur });
      // Shared value → React state (JS thread) for a11y + press behavior
      if (shouldOpen !== open) setOpen(shouldOpen);
    });

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));

  const rail = (
    <View
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        right: 0,
        flexDirection: "row",
      }}
    >
      {actions.map((a) => {
        const destructive = a.intent === "destructive";
        const rose = colors["color-accent-rose"] ?? accentColor;
        return (
          <Animated.View key={a.key} style={{ width: ACTION_WIDTH }}>
            <Text
              accessibilityRole="button"
              accessibilityLabel={a.label}
              onPress={() => {
                a.onAction();
                offset.value = withTiming(0, { duration: reduceMotion ? 0 : MOTION.fast });
                setOpen(false);
              }}
              style={{
                flex: 1,
                textAlign: "center",
                textAlignVertical: "center",
                backgroundColor: destructive ? accentDeepened(rose, 75) : mix(accentColor, colors["color-surface-1"], 20),
                color: destructive ? colors["color-primary-foreground"] : colors["color-text-primary"],
                fontSize: 15,
                fontWeight: "700",
                minHeight: MIN_TARGET_DP,
              }}
            >
              {a.icon}
              {a.label}
            </Text>
          </Animated.View>
        );
      })}
    </View>
  );

  return (
    <View testID={testID} style={[{ overflow: "hidden", borderRadius: 20 }, style]}>
      {actions.length > 0 ? rail : null}
      <GestureDetector gesture={pan}>
        <Animated.View style={rowStyle}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

export default SwipeableRow;
