import React from "react";
import { Text } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "../theme/ThemeProvider";

/**
 * The wall's animated emoji — the native port of the web's AnimatedEmoji
 * fallback (Home-ai src/components/ui/AnimatedEmoji.tsx:180): a 2s
 * `popBounce` idle so a static glyph reads as alive. Reduced motion renders
 * the same artwork completely still (the web's `anim()` helper).
 */
export function AnimatedEmoji({
  emoji,
  size = 24,
  animated = true,
  style,
  testID,
}: {
  emoji: string;
  size?: number;
  animated?: boolean;
  style?: any;
  testID?: string;
}) {
  const { reduceMotion } = useTheme();
  const doAnim = animated && !reduceMotion;
  const t = useSharedValue(0);

  React.useEffect(() => {
    if (!doAnim) {
      cancelAnimation(t);
      t.value = 0;
      return;
    }
    t.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
    return () => cancelAnimation(t);
  }, [doAnim, t]);

  const animatedStyle = useAnimatedStyle(() => ({
    // The web's popBounce: a 0.9→1.06 scale with a small lift.
    transform: [{ translateY: -1.5 * t.value }, { scale: 0.9 + 0.16 * t.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Text testID={testID} style={[{ fontSize: size, lineHeight: size * 1.15 }, style]}>
        {emoji}
      </Text>
    </Animated.View>
  );
}

export default AnimatedEmoji;
