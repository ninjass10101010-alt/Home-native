import React, { useCallback, useEffect, useState } from "react";
import {
  Modal as RNModal,
  Pressable,
  ScrollView,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useTheme } from "../theme/ThemeProvider";
import { MOTION, RADII, SPRING, TYPOGRAPHY } from "../theme/tokens";
import { hapticTap } from "../theme/haptics";
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
  /** "dialog" = centered card (default); "sheet" = bottom-anchored sheet with drag handle. */
  variant?: "dialog" | "sheet";
  style?: ViewStyle;
  testID?: string;
}

/**
 * RN port of ui/Modal.tsx. Scrim 55% black + blur; the panel is material-thick
 * (surface-1 at 94% — the "surface above its fields" measured fix) with the XL
 * radius. Android back closes when dismissable. Enter/exit animate with spring
 * settle; reduced-motion renders instant. Errors announce via assertive live
 * region in descendants (Toast) or callers.
 */
export function Modal({
  visible,
  onClose,
  title,
  description,
  children,
  footer,
  dismissable = true,
  variant = "dialog",
  style,
  testID,
}: ModalProps) {
  const { colors, reduceMotion } = useTheme();
  const isSheet = variant === "sheet";
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(isSheet ? 140 : 16);
  const scale = useSharedValue(isSheet ? 1 : 0.94);
  const dragY = useSharedValue(0);
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-then-animate is the exit-animation pattern
      setMounted(true);
      dragY.value = 0;
      if (reduceMotion) {
        opacity.value = 1;
        translateY.value = 0;
        scale.value = 1;
      } else {
        opacity.value = withTiming(1, { duration: MOTION.fast });
        translateY.value = isSheet ? 140 : 16;
        translateY.value = withSpring(0, SPRING.settle);
        if (isSheet) {
          scale.value = 1;
        } else {
          scale.value = 0.94;
          scale.value = withSpring(1, SPRING.settle);
        }
      }
    } else {
      const dur = reduceMotion ? 0 : MOTION.fast;
      opacity.value = withTiming(0, { duration: dur });
      translateY.value = withTiming(isSheet ? 160 : 12, { duration: dur });
      if (!isSheet) {
        scale.value = withTiming(0.96, { duration: dur });
      }
      const t = setTimeout(() => setMounted(false), dur);
      return () => clearTimeout(t);
    }
  }, [visible, reduceMotion, isSheet, opacity, translateY, scale, dragY]);

  const triggerDragDismiss = useCallback(() => {
    hapticTap();
    onClose();
  }, [onClose]);

  const sheetPan = Gesture.Pan()
    .enabled(isSheet && dismissable)
    .activeOffsetY([8, 9999])
    .onUpdate((e) => {
      "worklet";
      // eslint-disable-next-line react-hooks/immutability -- Reanimated shared-value write
      dragY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      "worklet";
      if (dragY.value > 90 || e.velocityY > 600) {
        runOnJS(triggerDragDismiss)();
      } else {
        // eslint-disable-next-line react-hooks/immutability -- Reanimated shared-value write
        dragY.value = reduceMotion ? 0 : withSpring(0, SPRING.settle);
      }
    });

  const scrimStyle = useAnimatedStyle(() => ({ opacity: opacity.value * 0.5 }));
  const panelStyle = useAnimatedStyle(() => ({
    width: "100%",
    maxHeight: "100%",
    alignItems: "center",
    justifyContent: isSheet ? "flex-end" : "center",
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value + dragY.value },
      { scale: scale.value },
    ],
  }));

  if (!mounted) return null;

  const headerBlock = (
    <View style={{ marginBottom: 16 }}>
      {isSheet && dismissable ? (
        <View
          testID="modal-sheet-grabber"
          style={{
            width: 44,
            height: 5,
            borderRadius: 3,
            alignSelf: "center",
            marginBottom: 14,
            backgroundColor: mix(colors["color-text-primary"], "transparent", 22),
          }}
        />
      ) : null}
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
  );

  const modalBody = (
    <View
      accessibilityViewIsModal
      style={{
        flex: 1,
        justifyContent: isSheet ? "flex-end" : "center",
        padding: isSheet ? 16 : 24,
        paddingBottom: 24,
      }}
    >
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
              maxHeight: isSheet ? "90%" : "92%",
              borderRadius: isSheet ? RADII.xxl : RADII.xl,
              padding: 24,
              maxWidth: isSheet ? 720 : 640,
              alignSelf: "center",
              width: "100%",
              backgroundColor: mix(colors["color-surface-1"], "transparent", 94),
            },
            style,
          ]}
        >
          {isSheet ? (
            <GestureDetector gesture={sheetPan}>{headerBlock}</GestureDetector>
          ) : (
            headerBlock
          )}
          <ScrollView
            style={{ flexShrink: 1, width: "100%" }}
            contentContainerStyle={{ paddingBottom: 32 }}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
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
  );

  return (
    <RNModal
      visible
      transparent
      animationType="none"
      onRequestClose={() => dismissable && onClose()}
      statusBarTranslucent
      testID={testID}
    >
      {isSheet && typeof jest === "undefined" ? (
        <GestureHandlerRootView style={{ flex: 1 }}>{modalBody}</GestureHandlerRootView>
      ) : (
        modalBody
      )}
    </RNModal>
  );
}

export default Modal;
