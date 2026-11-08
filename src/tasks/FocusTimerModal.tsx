import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useTheme } from "../theme/ThemeProvider";
import { ACCENTS, MIN_TARGET_DP, RADII, SPACING, TYPOGRAPHY } from "../theme/tokens";
import { mix } from "../theme/mix";
import { Material } from "../theme/Material";
import { Modal } from "../ui/Modal";
import { SoftButton } from "../ui/SoftButton";
import type { FamilyRoutine } from "./routines-api";
import {
  computeTimerProgress,
  FOCUS_PRESETS,
  formatTimerMMSS,
  type FocusPreset,
} from "./focus-timer";

const RADIUS = 96;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function getInitialPreset(activeRoutine?: FamilyRoutine | null): FocusPreset {
  if (!activeRoutine) return FOCUS_PRESETS[0];
  const titleLower = activeRoutine.title.toLowerCase();
  const found = FOCUS_PRESETS.find((p) => {
    if (titleLower.includes("brush") && p.id === "brush") return true;
    if (
      (titleLower.includes("toy") || titleLower.includes("clean")) &&
      p.id === "cleanup"
    )
      return true;
    if (titleLower.includes("morning") && p.id === "morning") return true;
    if (
      (titleLower.includes("homework") ||
        titleLower.includes("study") ||
        titleLower.includes("book")) &&
      p.id === "homework"
    )
      return true;
    if (
      (titleLower.includes("bed") ||
        titleLower.includes("night") ||
        titleLower.includes("sleep")) &&
      p.id === "bedtime"
    )
      return true;
    return false;
  });
  return found ?? FOCUS_PRESETS[0];
}

interface FocusTimerContentProps {
  activeRoutine?: FamilyRoutine | null;
  onCompleteRoutine?: (routine: FamilyRoutine) => void;
  onClose: () => void;
}

function FocusTimerContent({
  activeRoutine,
  onCompleteRoutine,
  onClose,
}: FocusTimerContentProps) {
  const { colors, theme, accentColor } = useTheme();
  const accentPalette = ACCENTS[theme === "light" ? "light" : "dark"];

  const initialPreset = useMemo(() => getInitialPreset(activeRoutine), [activeRoutine]);
  const [selectedPreset, setSelectedPreset] = useState<FocusPreset>(initialPreset);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(initialPreset.seconds);
  const [totalSeconds, setTotalSeconds] = useState<number>(initialPreset.seconds);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  // Timer tick effect
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          setIsRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  const toneColor = useMemo(() => {
    return (
      colors[`color-accent-${selectedPreset.tone}`] ??
      accentPalette[selectedPreset.tone] ??
      accentColor
    );
  }, [colors, accentPalette, accentColor, selectedPreset.tone]);

  const progressInfo = useMemo(() => {
    return computeTimerProgress(remainingSeconds, totalSeconds);
  }, [remainingSeconds, totalSeconds]);

  const handleSelectPreset = useCallback((preset: FocusPreset) => {
    setSelectedPreset(preset);
    setIsRunning(false);
    setRemainingSeconds(preset.seconds);
    setTotalSeconds(preset.seconds);
  }, []);

  const handleToggle = useCallback(() => {
    if (isRunning) {
      setIsRunning(false);
    } else {
      if (remainingSeconds <= 0) {
        setRemainingSeconds(totalSeconds > 0 ? totalSeconds : selectedPreset.seconds);
      }
      setIsRunning(true);
    }
  }, [isRunning, remainingSeconds, totalSeconds, selectedPreset.seconds]);

  const handleReset = useCallback(() => {
    setIsRunning(false);
    setRemainingSeconds(selectedPreset.seconds);
    setTotalSeconds(selectedPreset.seconds);
  }, [selectedPreset.seconds]);

  const handlePlusOne = useCallback(() => {
    setRemainingSeconds((prev) => prev + 60);
    setTotalSeconds((prev) => prev + 60);
  }, []);

  const handleFinishRoutine = useCallback(() => {
    if (activeRoutine) {
      onCompleteRoutine?.(activeRoutine);
      onClose();
    }
  }, [activeRoutine, onCompleteRoutine, onClose]);

  const progressPctClamped = Math.min(100, Math.max(0, progressInfo.pct));
  const strokeOffset = CIRCUMFERENCE * (1 - progressPctClamped / 100);

  return (
    <View style={{ gap: SPACING.md, alignItems: "center", width: "100%" }}>
      {/* Preset Selector Strip */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: SPACING.xs, paddingVertical: SPACING.xs }}
      >
        {FOCUS_PRESETS.map((preset) => {
          const isSelected = preset.id === selectedPreset.id;
          const pTone =
            colors[`color-accent-${preset.tone}`] ??
            accentPalette[preset.tone] ??
            accentColor;
          return (
            <Pressable
              key={preset.id}
              testID={`focus-preset-${preset.id}`}
              accessibilityRole="button"
              accessibilityLabel={`${preset.title}, ${formatTimerMMSS(preset.seconds)}`}
              accessibilityState={{ selected: isSelected }}
              onPress={() => handleSelectPreset(preset)}
              style={{
                minHeight: MIN_TARGET_DP,
                minWidth: MIN_TARGET_DP,
                paddingHorizontal: SPACING.md,
                paddingVertical: SPACING.xs,
                borderRadius: RADII.pill,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: isSelected ? pTone : colors["color-border-subtle"],
                backgroundColor: isSelected
                  ? mix(pTone, "transparent", 22)
                  : colors["color-surface-1"],
              }}
            >
              <Text
                style={{
                  color: colors["color-text-primary"],
                  fontSize: TYPOGRAPHY.label.fontSize,
                  fontWeight: isSelected ? "700" : "600",
                }}
              >
                {preset.emoji} {preset.title}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Coach Cheer Banner */}
      <Material
        tier="thin"
        style={{
          width: "100%",
          borderRadius: RADII.lg,
          padding: SPACING.md,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: mix(toneColor, "transparent", 14),
          borderWidth: 1,
          borderColor: mix(toneColor, "transparent", 32),
        }}
      >
        <Text
          testID="focus-timer-cheer"
          style={{
            color: colors["color-text-primary"],
            fontSize: TYPOGRAPHY.body.fontSize,
            fontWeight: "600",
            textAlign: "center",
          }}
        >
          {activeRoutine
            ? `Routine: ${activeRoutine.title} · ${selectedPreset.cheer}`
            : selectedPreset.cheer}
        </Text>
      </Material>

      {/* Circular SVG Ring & Clock Readout */}
      <View
        style={{
          width: 220,
          height: 220,
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          marginVertical: SPACING.sm,
        }}
      >
        <Svg width={220} height={220} viewBox="0 0 220 220">
          <Circle
            cx={110}
            cy={110}
            r={RADIUS}
            stroke={colors["color-surface-2"]}
            strokeWidth={12}
            fill="none"
          />
          <Circle
            cx={110}
            cy={110}
            r={RADIUS}
            stroke={toneColor}
            strokeWidth={12}
            fill="none"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={strokeOffset}
            strokeLinecap="round"
            transform="rotate(-90 110 110)"
          />
        </Svg>
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: SPACING.md,
          }}
        >
          <Text style={{ fontSize: 32 }}>{selectedPreset.emoji}</Text>
          <Text
            testID="focus-timer-clock"
            style={{
              color: colors["color-text-primary"],
              fontSize: 44,
              fontWeight: "800",
              fontVariant: ["tabular-nums"],
            }}
          >
            {formatTimerMMSS(remainingSeconds)}
          </Text>
          <Text
            testID="focus-timer-phase"
            style={{
              color: colors["color-text-secondary"],
              fontSize: TYPOGRAPHY.label.fontSize,
              fontWeight: "600",
              marginTop: 4,
              textAlign: "center",
            }}
          >
            {progressInfo.phaseLabel}
          </Text>
        </View>
      </View>

      {/* Controls Row */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: SPACING.sm,
          width: "100%",
          flexWrap: "wrap",
        }}
      >
        <SoftButton
          variant={isRunning ? "secondary" : "primary"}
          size="sm"
          testID="focus-timer-toggle"
          accessibilityLabel={isRunning ? "Pause timer" : "Start timer"}
          style={{ minHeight: MIN_TARGET_DP, minWidth: MIN_TARGET_DP }}
          onPress={handleToggle}
        >
          {isRunning ? "⏸️ Pause" : remainingSeconds <= 0 ? "🔄 Restart" : "▶️ Start"}
        </SoftButton>

        <SoftButton
          variant="secondary"
          size="sm"
          testID="focus-timer-reset"
          accessibilityLabel="Reset timer"
          style={{ minHeight: MIN_TARGET_DP, minWidth: MIN_TARGET_DP }}
          onPress={handleReset}
        >
          ↺ Reset
        </SoftButton>

        <SoftButton
          variant="secondary"
          size="sm"
          testID="focus-timer-plus1"
          accessibilityLabel="Add 1 minute"
          style={{ minHeight: MIN_TARGET_DP, minWidth: MIN_TARGET_DP }}
          onPress={handlePlusOne}
        >
          +1 Min
        </SoftButton>
      </View>

      {/* Finish Routine Action Button (when routine is active) */}
      {activeRoutine && onCompleteRoutine ? (
        <SoftButton
          variant="success"
          size="sm"
          testID="focus-timer-finish-routine"
          accessibilityLabel={`Finish routine ${activeRoutine.title}`}
          style={{ minHeight: MIN_TARGET_DP, minWidth: MIN_TARGET_DP, width: "100%" }}
          onPress={handleFinishRoutine}
        >
          {`🎉 Finish "${activeRoutine.title}"`}
        </SoftButton>
      ) : null}
    </View>
  );
}

export interface FocusTimerModalProps {
  visible: boolean;
  onClose: () => void;
  activeRoutine?: FamilyRoutine | null;
  onCompleteRoutine?: (routine: FamilyRoutine) => void;
}

export function FocusTimerModal({
  visible,
  onClose,
  activeRoutine,
  onCompleteRoutine,
}: FocusTimerModalProps) {
  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title="⏱️ Focus & Routine Sprint"
      description="Power through your family routines with a quick sprint"
      testID="focus-timer-modal"
    >
      {visible ? (
        <FocusTimerContent
          key={`${activeRoutine?.id ?? "general"}-${visible ? "open" : "closed"}`}
          activeRoutine={activeRoutine}
          onCompleteRoutine={onCompleteRoutine}
          onClose={onClose}
        />
      ) : null}
    </Modal>
  );
}
