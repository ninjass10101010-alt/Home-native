import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Platform, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useTheme } from "../theme/ThemeProvider";
import { MOTION, SPRING, TYPOGRAPHY } from "../theme/tokens";
import { accentInk, mix } from "../theme/mix";

export type ToastIntent = "info" | "success" | "error";

interface ToastState {
  id: number;
  message: string;
  intent: ToastIntent;
}

interface ToastContextValue {
  show: (message: string, opts?: { intent?: ToastIntent; durationMs?: number }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const EXIT_MS = 180;
const DEFAULT_MS = 4000;

/**
 * RN port of ui/Toast.tsx (hosted — one toast at a time, replace-on-show).
 * Tone inks: success/error walk the accent 55% toward the body ink (the
 * measured AA fix); neutral is primary ink on surface-0. Slide in over
 * MOTION.base; reduced-motion jumps instantly. error announces assertively.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { colors, accentColor, reduceMotion } = useTheme();
  const [toast, setToast] = useState<ToastState | null>(null);
  const [leaving, setLeaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = useRef(0);

  // Unmount clears BOTH timers — a pending show/exit timer firing after the
  // provider is gone is a leak (web parity: the toast timer is cleaned up).
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    },
    []
  );

  const show = useCallback<ToastContextValue["show"]>(
    (message, opts) => {
      const intent = opts?.intent ?? "info";
      const durationMs = opts?.durationMs ?? DEFAULT_MS;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
      setLeaving(false);
      setToast({ id: ++idRef.current, message, intent });
      timerRef.current = setTimeout(() => {
        const dur = reduceMotion ? 0 : EXIT_MS;
        setLeaving(true);
        exitTimerRef.current = setTimeout(() => {
          setToast(null);
          setLeaving(false);
        }, dur);
      }, durationMs);
    },
    [reduceMotion]
  );

  const value = useMemo(() => ({ show }), [show]);

  const ty = useSharedValue(-36);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.94);
  React.useEffect(() => {
    if (!toast) return;
    if (reduceMotion) {
      ty.value = 0;
      opacity.value = 1;
      scale.value = 1;
      return;
    }
    ty.value = -36;
    opacity.value = 0;
    scale.value = 0.94;
    ty.value = withSpring(0, SPRING.settle);
    scale.value = withSpring(1, SPRING.settle);
    opacity.value = withTiming(1, { duration: MOTION.fast });
  }, [toast, reduceMotion, ty, opacity, scale]);
  React.useEffect(() => {
    if (!leaving) return;
    const dur = reduceMotion ? 0 : EXIT_MS;
    // eslint-disable-next-line react-hooks/immutability -- Reanimated shared-value write
    ty.value = withTiming(-28, { duration: dur });
    // eslint-disable-next-line react-hooks/immutability -- Reanimated shared-value write
    scale.value = withTiming(0.96, { duration: dur });
    // eslint-disable-next-line react-hooks/immutability -- Reanimated shared-value write
    opacity.value = withTiming(0, { duration: dur });
  }, [leaving, reduceMotion, ty, scale, opacity]);

  const aStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  const tone = toast?.intent ?? "info";
  const mint = colors["color-accent-mint"] ?? accentColor;
  const rose = colors["color-accent-rose"] ?? accentColor;
  // Opaque-backed mixes: a floating toast sits over page headers, so an
  // 80%-transparent wash made the copy unreadable (web parity: surface-tinted).
  const bg =
    tone === "success"
      ? mix(mint, colors["color-surface-1"], 18)
      : tone === "error"
        ? mix(rose, colors["color-surface-1"], 18)
        : mix(colors["color-surface-1"], "transparent", 96);
  const fg =
    tone === "success"
      ? accentInk(mint, colors["color-text-primary"])
      : tone === "error"
        ? accentInk(rose, colors["color-text-primary"])
        : colors["color-text-primary"];
  const border =
    tone === "success"
      ? mix(mint, "transparent", 20)
      : tone === "error"
        ? mix(rose, "transparent", 20)
        : colors["color-border"] ?? "transparent";

  return (
    <ToastContext.Provider value={value}>
      <View style={{ flex: 1 }}>{children}</View>
      {toast ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              top: 72,
              left: 0,
              right: 0,
              alignItems: "center",
              zIndex: 9998,
            },
            aStyle,
          ]}
        >
          <View
            accessibilityLiveRegion={tone === "error" ? "assertive" : "polite"}
            accessibilityRole="alert"
            style={{
              maxWidth: "92%",
              borderRadius: 20,
              borderWidth: 1,
              borderColor: border,
              backgroundColor: bg,
              paddingHorizontal: 20,
              paddingVertical: 14,
              ...(typeof jest === "undefined" && Platform.OS === "android"
                ? ({
                    boxShadow: [
                      {
                        offsetX: 0,
                        offsetY: 8,
                        blurRadius: 24,
                        color: mix(colors["color-monster-ink-blue"], "transparent", 28),
                      },
                    ],
                  } as Record<string, unknown>)
                : {}),
            }}
          >
            <Text style={{ color: fg, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "600" }}>
              {toast.message}
            </Text>
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useOptionalToast(): ToastContextValue | null {
  return useContext(ToastContext);
}

export function useToast(): ToastContextValue {
  const v = useContext(ToastContext);
  if (!v) throw new Error("useToast must be used within ToastProvider");
  return v;
}
