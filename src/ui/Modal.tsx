import React, { useEffect, useState } from "react";
import {
  Modal as RNModal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
  ViewStyle,
} from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useTheme } from "../theme/ThemeProvider";
import { MOTION, TYPOGRAPHY } from "../theme/tokens";
import { mix } from "../theme/mix";
import { Material } from "../theme/Material";

export interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  dismissable?: boolean;
  style?: ViewStyle;
  testID?: string;
}

/**
 * RN port of ui/Modal.tsx. Scrim 55% black + blur; the panel is material-thick
 * (surface-1 at 94% — the "surface above its fields" measured fix) with the XL
 * radius. Android back closes when dismissable. Enter/exit animate with timing;
 * reduced-motion renders instant. Errors announce via assertive live region in
 * descendants (Toast) or callers.
 */
export function Modal({
  visible,
  onClose,
  title,
  description,
  children,
  footer,
  dismissable = true,
  style,
  testID,
}: ModalProps) {
  const { colors, reduceMotion } = useTheme();
  const { width, height } = useWindowDimensions();
  const modalScale =
    typeof jest === "undefined" &&
    Platform.OS === "android" &&
    width > 0 &&
    height > 0 &&
    (width < 960 || height < 1600)
      ? Math.min(1, Math.min(width / 1080, height / 1920))
      : 1;
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(24);
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-then-animate is the exit-animation pattern
      setMounted(true);
      const dur = reduceMotion ? 0 : MOTION.base;
       
      opacity.value = withTiming(1, { duration: dur });
       
      translateY.value = withTiming(0, { duration: dur });
    } else {
      const dur = reduceMotion ? 0 : MOTION.fast;
       
      opacity.value = withTiming(0, { duration: dur });
       
      translateY.value = withTiming(24, { duration: dur });
      const t = setTimeout(() => setMounted(false), dur);
      return () => clearTimeout(t);
    }
  }, [visible, reduceMotion, opacity, translateY]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: opacity.value * 0.5 }));
  const panelStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform:
      modalScale !== 1
        ? [{ translateY: translateY.value }, { scale: modalScale }]
        : [{ translateY: translateY.value }],
  }));

  if (!mounted) return null;

  return (
    <RNModal
      visible
      transparent
      animationType="none"
      onRequestClose={() => dismissable && onClose()}
      statusBarTranslucent
      testID={testID}
    >
      <View accessibilityViewIsModal style={{ flex: 1, justifyContent: "center", padding: 24 }}>
        <Animated.View
          style={[
            { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "black" },
            scrimStyle,
          ]}
        />
        {dismissable ? (
          <Pressable
            accessibilityLabel="Dismiss"
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
            onPress={onClose}
          />
        ) : null}
        <Animated.View style={panelStyle}>
          <Material
            tier="thick"
            style={[
              {
                maxHeight: "85%",
                borderRadius: 28,
                padding: 24,
                maxWidth: 640,
                alignSelf: "center",
                width: "100%",
                backgroundColor: mix(colors["color-surface-1"], "transparent", 94),
              },
              style,
            ]}
          >
            <View style={{ marginBottom: 16 }}>
              <Text
                style={{
                  color: colors["color-text-primary"],
                  fontSize: TYPOGRAPHY.title.fontSize,
                  fontWeight: "700",
                }}
              >
                {title}
              </Text>
              {description ? (
                <Text
                  style={{
                    marginTop: 4,
                    color: colors["color-text-secondary"],
                    fontSize: TYPOGRAPHY.body.fontSize,
                  }}
                >
                  {description}
                </Text>
              ) : null}
            </View>
            <ScrollView style={{ flexShrink: 1 }}>{children}</ScrollView>
            {footer ? (
              <View
                style={{
                  marginTop: 16,
                  paddingTop: 16,
                  borderTopWidth: 1,
                  borderTopColor: colors["color-border"] ?? "transparent",
                  flexDirection: "row",
                  gap: 12,
                }}
              >
                {footer}
              </View>
            ) : null}
          </Material>
        </Animated.View>
      </View>
    </RNModal>
  );
}

export default Modal;
