import React, { useCallback, useState } from "react";
import { Text, View, ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useTheme } from "../theme/ThemeProvider";
import { MIN_TARGET_DP, SPRING } from "../theme/tokens";
import { hapticSelect, hapticTap } from "../theme/haptics";
import { mix } from "../theme/mix";
import { mixAlpha } from "./SoftButton";

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
  const openSV = useSharedValue(0);
  const maxOffset = actions.length * ACTION_WIDTH;

  const syncOpenState = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    hapticSelect();
  }, []);

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onUpdate((e) => {
      "worklet";
      offset.value = Math.max(-maxOffset, Math.min(0, e.translationX + (openSV.value ? -maxOffset : 0)));
    })
    .onEnd((e) => {
      "worklet";
      const shouldOpen = offset.value < -THRESHOLD || e.velocityX < -500;
      const target = shouldOpen ? -maxOffset : 0;
      offset.value = reduceMotion
        ? target
        : withSpring(target, { ...SPRING.settle, velocity: e.velocityX });
      const wasOpen = openSV.value === 1;
      openSV.value = shouldOpen ? 1 : 0;
      if (shouldOpen !== wasOpen) {
        runOnJS(syncOpenState)(shouldOpen);
      }
    });

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));
  // Rail opacity ramps with the swipe so the destructive rose never bleeds
  // through a translucent row at rest (opacity 0 until 24dp of travel).
  const railStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.abs(offset.value) / 24) }));

  const rail = (
    <Animated.View
      testID={testID ? `${testID}-rail` : undefined}
      style={[
        {
          position: "absolute",
          top: 0,
          bottom: 0,
          right: 0,
          flexDirection: "row",
        },
        railStyle,
      ]}
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
                hapticTap();
                a.onAction();
                offset.value = reduceMotion ? 0 : withSpring(0, SPRING.settle);
                openSV.value = 0;
                setOpen(false);
              }}
              style={{
                flex: 1,
                textAlign: "center",
                textAlignVertical: "center",
                // Web parity: bg-[rose]/20 tint + rose ink (NOT a deep black fill)
                backgroundColor: destructive ? mixAlpha(rose, 0.2) : mix(accentColor, colors["color-surface-1"], 20),
                color: destructive ? rose : colors["color-text-primary"],
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
    </Animated.View>
  );

  return (
    <View
      testID={testID}
      accessibilityState={actions.length > 0 ? { expanded: open } : undefined}
      style={[{ overflow: "hidden", borderRadius: 20 }, style]}
    >
      {actions.length > 0 ? rail : null}
      <GestureDetector gesture={pan}>
        <Animated.View style={rowStyle}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

export default SwipeableRow;
