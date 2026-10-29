import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Material } from "../theme/Material";
import { useTheme } from "../theme/ThemeProvider";
import { TYPOGRAPHY } from "../theme/tokens";
import { Chip } from "../ui/Chip";
import { SegmentedControl } from "../ui/SegmentedControl";
import { SoftButton } from "../ui/SoftButton";
import { Toggle } from "../ui/Toggle";
import {
  CATEGORY_META,
  NOTIFICATION_CATEGORIES,
  useNotificationPreferences,
  type NotificationCategory,
} from "../native/notificationPrefs";
import {
  NOTIFICATION_SOUNDS,
  SOUND_ICONS,
  SOUND_LABELS,
  playNotificationSound,
  type NotificationSound,
} from "../native/soundEffects";
import { dispatchNotification } from "../native/notifications";

const VOLUME_STEPS = [0.25, 0.5, 0.75, 1.0];

type TimingStage = "advance" | "start";

const SAMPLE_COPY: Record<
  NotificationCategory,
  Record<TimingStage, { title: string; body: string }>
> = {
  weather: {
    advance: {
      title: "⛈️ Weather Advisory",
      body: "Heavy snow warning in effect until 8:00 PM tonight.",
    },
    start: {
      title: "⛈️ Weather Advisory",
      body: "Heavy snow warning in effect until 8:00 PM tonight.",
    },
  },
  calendar: {
    advance: {
      title: "📅 Calendar Reminder",
      body: "Soccer Practice starts in 15 minutes at Elm Park.",
    },
    start: {
      title: "🔔 Event Starting Now",
      body: "Soccer Practice is starting now at Elm Park.",
    },
  },
  routines: {
    advance: {
      title: "⏰ Routine Reminder",
      body: "Evening Reading & Wind-down starts in 15 minutes.",
    },
    start: {
      title: "🔔 Routine Starting",
      body: "Evening Reading & Wind-down is starting now.",
    },
  },
};

export function NotificationsCard() {
  const { colors, accentColor } = useTheme();
  const { prefs, updateCategory } = useNotificationPreferences();
  const [testingCategory, setTestingCategory] = useState<NotificationCategory | null>(null);
  const [timingMap, setTimingMap] = useState<Record<string, TimingStage>>({
    calendar: "advance",
    routines: "advance",
  });

  const handlePreviewSound = (sound: NotificationSound, volume: number) => {
    void playNotificationSound(sound, volume);
  };

  const handleTestNotification = async (
    category: NotificationCategory,
    timing: TimingStage
  ) => {
    setTestingCategory(category);
    const sample = SAMPLE_COPY[category][timing];
    try {
      await dispatchNotification({
        category,
        title: sample.title,
        body: sample.body,
        data: { test: true },
        timing,
      });
    } finally {
      setTimeout(() => setTestingCategory(null), 1000);
    }
  };

  return (
    <Material
      tier="regular"
      testID="notifications-card"
      style={{ borderRadius: 28, padding: 24, gap: 24 }}
    >
      <View>
        <Text
          style={{
            color: colors["color-text-secondary"],
            fontSize: TYPOGRAPHY.label.fontSize,
            fontWeight: "700",
            letterSpacing: 2,
            marginBottom: 4,
          }}
        >
          NOTIFICATIONS & SOUNDS
        </Text>
        <Text
          style={{
            color: colors["color-text-muted"],
            fontSize: TYPOGRAPHY.body.fontSize,
          }}
        >
          Customize alert tones and volume levels for each notification type on this wall.
        </Text>
      </View>

      <View style={{ gap: 20 }}>
        {NOTIFICATION_CATEGORIES.map((cat) => {
          const meta = CATEGORY_META[cat];
          const config = prefs[cat];
          const isTesting = testingCategory === cat;
          const currentTiming: TimingStage = meta.hasTimingStages
            ? timingMap[cat] ?? "advance"
            : "advance";

          // Resolve sound and volume based on timing stage
          const isAdvance = currentTiming === "advance";
          const currentSound: NotificationSound = meta.hasTimingStages
            ? isAdvance
              ? config.advanceSound ?? config.sound
              : config.startSound ?? "beacon"
            : config.sound;

          const currentVolume: number = meta.hasTimingStages
            ? isAdvance
              ? config.advanceVolume ?? config.volume
              : config.startVolume ?? 0.8
            : config.volume;

          const timingSubtitle = meta.hasTimingStages
            ? isAdvance
              ? "Plays 15 minutes before the event so the family has time to get ready."
              : "Plays right when the event or routine begins."
            : null;

          return (
            <Material
              key={cat}
              tier="thin"
              testID={`notif-category-${cat}`}
              style={{
                borderRadius: 20,
                padding: 20,
                gap: 16,
                borderWidth: 1,
                borderColor: config.enabled ? colors["color-border"] : "transparent",
              }}
            >
              {/* Category Header + Enable Toggle */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text
                    style={{
                      color: colors["color-text-primary"],
                      fontSize: TYPOGRAPHY.title.fontSize,
                      fontWeight: "600",
                    }}
                  >
                    {meta.icon} {meta.title}
                  </Text>
                  <Text
                    style={{
                      color: colors["color-text-secondary"],
                      fontSize: TYPOGRAPHY.body.fontSize,
                    }}
                  >
                    {meta.subtitle}
                  </Text>
                </View>
                <Toggle
                  value={config.enabled}
                  onChange={(enabled) => updateCategory(cat, { enabled })}
                  testID={`notif-toggle-${cat}`}
                  accessibilityLabel={`Enable ${meta.title}`}
                />
              </View>

              {config.enabled && (
                <View style={{ gap: 16, marginTop: 4 }}>
                  {/* Segmented Control for 15-Min Reminder vs Starting Now */}
                  {meta.hasTimingStages && (
                    <View style={{ gap: 8 }}>
                      <Text
                        style={{
                          color: colors["color-text-secondary"],
                          fontSize: TYPOGRAPHY.label.fontSize,
                          fontWeight: "600",
                          letterSpacing: 1,
                        }}
                      >
                        TIMING STAGE
                      </Text>
                      <SegmentedControl
                        testID={`notif-timing-switch-${cat}`}
                        options={[
                          { id: "advance", label: "⏰ 15-Min Reminder" },
                          { id: "start", label: "🔔 Starting Now" },
                        ]}
                        value={currentTiming}
                        onChange={(val) =>
                          setTimingMap((prev) => ({
                            ...prev,
                            [cat]: val as TimingStage,
                          }))
                        }
                      />
                      {timingSubtitle && (
                        <Text
                          style={{
                            color: colors["color-text-muted"],
                            fontSize: TYPOGRAPHY.label.fontSize,
                            marginTop: 2,
                          }}
                        >
                          {timingSubtitle}
                        </Text>
                      )}
                    </View>
                  )}

                  {/* Sound Tone Picker */}
                  <View style={{ gap: 8 }}>
                    <Text
                      style={{
                        color: colors["color-text-secondary"],
                        fontSize: TYPOGRAPHY.label.fontSize,
                        fontWeight: "600",
                        letterSpacing: 1,
                      }}
                    >
                      {meta.hasTimingStages
                        ? isAdvance
                          ? "15-MIN ALERT TONE"
                          : "STARTING NOW ALERT TONE"
                        : "ALERT TONE"}
                    </Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                      {NOTIFICATION_SOUNDS.map((snd) => {
                        const isSelected = currentSound === snd;
                        return (
                          <Chip
                            key={snd}
                            testID={`notif-sound-${cat}-${snd}`}
                            label={`${SOUND_ICONS[snd]} ${SOUND_LABELS[snd]}`}
                            tone={isSelected ? "accent" : "neutral"}
                            selected={isSelected}
                            as="button"
                            size="md"
                            onPress={() => {
                              if (meta.hasTimingStages) {
                                if (isAdvance) {
                                  updateCategory(cat, {
                                    advanceSound: snd,
                                    sound: snd,
                                  });
                                } else {
                                  updateCategory(cat, {
                                    startSound: snd,
                                  });
                                }
                              } else {
                                updateCategory(cat, { sound: snd });
                              }
                              handlePreviewSound(snd, currentVolume);
                            }}
                          />
                        );
                      })}
                    </View>
                  </View>

                  {/* Volume Control */}
                  <View style={{ gap: 8 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Text
                        style={{
                          color: colors["color-text-secondary"],
                          fontSize: TYPOGRAPHY.label.fontSize,
                          fontWeight: "600",
                          letterSpacing: 1,
                        }}
                      >
                        VOLUME
                      </Text>
                      <Text
                        testID={`notif-volume-display-${cat}`}
                        style={{
                          color: colors["color-text-primary"],
                          fontSize: TYPOGRAPHY.body.fontSize,
                          fontWeight: "600",
                        }}
                      >
                        {Math.round(currentVolume * 100)}%
                      </Text>
                    </View>

                    <View style={{ flexDirection: "row", gap: 10 }}>
                      {VOLUME_STEPS.map((step) => {
                        const isSelected = Math.abs(currentVolume - step) < 0.05;
                        return (
                          <Pressable
                            key={step}
                            testID={`notif-vol-${cat}-${Math.round(step * 100)}`}
                            accessibilityLabel={`Set volume to ${Math.round(step * 100)} percent`}
                            onPress={() => {
                              if (meta.hasTimingStages) {
                                if (isAdvance) {
                                  updateCategory(cat, {
                                    advanceVolume: step,
                                    volume: step,
                                  });
                                } else {
                                  updateCategory(cat, {
                                    startVolume: step,
                                  });
                                }
                              } else {
                                updateCategory(cat, { volume: step });
                              }
                              handlePreviewSound(currentSound, step);
                            }}
                            style={{
                              flex: 1,
                              height: 52,
                              borderRadius: 14,
                              alignItems: "center",
                              justifyContent: "center",
                              backgroundColor: isSelected
                                ? accentColor
                                : colors["color-surface-2"],
                            }}
                          >
                            <Text
                              style={{
                                color: isSelected
                                  ? colors["color-primary-foreground"]
                                  : colors["color-text-secondary"],
                                fontSize: TYPOGRAPHY.body.fontSize,
                                fontWeight: "600",
                              }}
                            >
                              {Math.round(step * 100)}%
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>

                  {/* Actions Row: Preview & Send Test */}
                  <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
                    <View style={{ flex: 1 }}>
                      <SoftButton
                        variant="secondary"
                        size="sm"
                        testID={`notif-preview-${cat}`}
                        accessibilityLabel={`Preview ${SOUND_LABELS[currentSound]} tone`}
                        onPress={() => handlePreviewSound(currentSound, currentVolume)}
                      >
                        Preview Tone 🔊
                      </SoftButton>
                    </View>
                    <View style={{ flex: 1 }}>
                      <SoftButton
                        variant="secondary"
                        size="sm"
                        testID={`notif-test-${cat}`}
                        loading={isTesting}
                        accessibilityLabel={`Send test ${meta.title} notification`}
                        onPress={() => void handleTestNotification(cat, currentTiming)}
                      >
                        {meta.hasTimingStages
                          ? isAdvance
                            ? "Test 15m Tone 🔔"
                            : "Test Start Tone 🔔"
                          : "Send Test 🔔"}
                      </SoftButton>
                    </View>
                  </View>
                </View>
              )}
            </Material>
          );
        })}
      </View>
    </Material>
  );
}
