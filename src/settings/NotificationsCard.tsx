import React, { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Material } from "../theme/Material";
import { useTheme } from "../theme/ThemeProvider";
import { mix } from "../theme/mix";
import { TYPOGRAPHY } from "../theme/tokens";
import { Chip } from "../ui/Chip";
import { SegmentedControl } from "../ui/SegmentedControl";
import { SoftButton } from "../ui/SoftButton";
import { Toggle } from "../ui/Toggle";
import { api } from "../api/client";
import { useAuth } from "../state/AuthProvider";
import {
  CATEGORY_META,
  NOTIFICATION_CATEGORIES,
  resolveTimingPreference,
  useNotificationPreferences,
  type NotificationCategory,
  type TimingPreference,
} from "../native/notificationPrefs";
import {
  NOTIFICATION_SOUNDS,
  SOUND_ICONS,
  SOUND_LABELS,
  playNotificationSound,
  type NotificationSound,
} from "../native/soundEffects";
import {
  playVoiceCallout,
  resolveVoiceCallout,
  type SoundMode,
} from "../native/voiceCallouts";
import { dispatchNotification } from "../native/notifications";

const VOLUME_STEPS = [0.25, 0.5, 0.75, 1.0];

type TimingStage = "advance" | "start";

interface HASpeakerItem {
  entityId: string;
  name: string;
  state: string;
  deviceClass: string | null;
  isGroup: boolean;
}

interface SpeakerBroadcastConfig {
  enabled: boolean;
  entities: string[];
  announceChat: boolean;
  announceRoutines: boolean;
  announceCalendar: boolean;
  announceWeather: boolean;
  volume: number | null;
}

const DEFAULT_SPEAKER_CONFIG: SpeakerBroadcastConfig = {
  enabled: false,
  entities: [],
  announceChat: true,
  announceRoutines: true,
  announceCalendar: true,
  announceWeather: true,
  volume: null,
};

const SPEAKER_CATEGORY_OPTIONS: readonly {
  key: "announceRoutines" | "announceCalendar" | "announceWeather" | "announceChat";
  label: string;
  testID: string;
}[] = [
  { key: "announceRoutines", label: "Routines", testID: "speaker-cat-routines" },
  { key: "announceCalendar", label: "Calendar", testID: "speaker-cat-calendar" },
  { key: "announceWeather", label: "Weather", testID: "speaker-cat-weather" },
  { key: "announceChat", label: "Chat Broadcasts", testID: "speaker-cat-chat" },
];

function SpeakerBroadcastSection() {
  const { colors, accentColor } = useTheme();
  const { role } = useAuth();
  const isParent = role === "parent";

  const [speakers, setSpeakers] = useState<HASpeakerItem[]>([]);
  const [config, setConfig] = useState<SpeakerBroadcastConfig>(DEFAULT_SPEAKER_CONFIG);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [haWarning, setHaWarning] = useState<string | null>(null);

  const loadSpeakers = useCallback(async () => {
    if (!isParent) return;
    setLoading(true);
    try {
      const res = await api<{
        ok?: boolean;
        speakers?: HASpeakerItem[];
        config?: SpeakerBroadcastConfig;
        haWarning?: string;
        error?: string;
      }>("/api/ha/speakers");
      if (Array.isArray(res?.speakers)) setSpeakers(res.speakers);
      if (res?.config) setConfig({ ...DEFAULT_SPEAKER_CONFIG, ...res.config });
      setHaWarning(res?.haWarning ?? null);
    } catch (err) {
      setHaWarning(err instanceof Error ? err.message : "Could not load speakers.");
    } finally {
      setLoading(false);
    }
  }, [isParent]);

  useEffect(() => {
    if (!isParent) return;
    let alive = true;
    void api<{
      ok?: boolean;
      speakers?: HASpeakerItem[];
      config?: SpeakerBroadcastConfig;
      haWarning?: string;
    }>("/api/ha/speakers")
      .then((res) => {
        if (!alive) return;
        if (Array.isArray(res?.speakers)) setSpeakers(res.speakers);
        if (res?.config) setConfig({ ...DEFAULT_SPEAKER_CONFIG, ...res.config });
        setHaWarning(res?.haWarning ?? null);
      })
      .catch((err) => {
        if (!alive) return;
        setHaWarning(err instanceof Error ? err.message : "Could not load speakers.");
      });
    return () => {
      alive = false;
    };
  }, [isParent]);

  const persistPatch = async (patch: Partial<SpeakerBroadcastConfig>) => {
    if (!isParent || saving) return;
    const optimistic: SpeakerBroadcastConfig = { ...config, ...patch };
    setConfig(optimistic);
    setSaving(true);
    setStatusMessage(null);
    try {
      const res = await api<{ ok?: boolean; config?: SpeakerBroadcastConfig; error?: string }>(
        "/api/ha/speakers",
        { method: "POST", body: optimistic }
      );
      if (res?.config) setConfig({ ...DEFAULT_SPEAKER_CONFIG, ...res.config });
    } catch (err) {
      setConfig(config);
      setStatusMessage(err instanceof Error ? err.message : "Could not save speaker settings.");
    } finally {
      setSaving(false);
    }
  };

  const toggleEntity = (entityId: string) => {
    const exists = config.entities.includes(entityId);
    const next = exists
      ? config.entities.filter((id) => id !== entityId)
      : [...config.entities, entityId];
    void persistPatch({ entities: next });
  };

  const runTest = async () => {
    if (!isParent || testing || config.entities.length === 0) return;
    setTesting(true);
    setStatusMessage(null);
    try {
      const res = await api<{ ok?: boolean; delivered?: number; attempted?: number; errors?: string[] }>(
        "/api/ha/speakers/test",
        { method: "POST", body: { entities: config.entities } }
      );
      if (res?.ok) {
        setStatusMessage(
          `Sent test announcement to ${res.delivered ?? config.entities.length} speaker${(res.delivered ?? 1) === 1 ? "" : "s"}.`
        );
      } else {
        setStatusMessage(res?.errors?.[0] || "Could not reach selected speakers.");
      }
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Test announcement failed.");
    } finally {
      setTesting(false);
    }
  };

  return (
    <Material
      tier="thin"
      testID="speaker-broadcast-card"
      style={{
        borderRadius: 20,
        padding: 18,
        gap: 16,
        borderWidth: 1,
        borderColor: colors["color-border-subtle"],
      }}
    >
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
            🔊 Google Speaker Broadcast
          </Text>
          <Text
            style={{
              color: colors["color-text-secondary"],
              fontSize: TYPOGRAPHY.body.fontSize,
            }}
          >
            Announce routine wake-up calls, alerts, and chat broadcasts on Google Home speakers or speaker groups.
          </Text>
        </View>
        {isParent ? (
          <Toggle
            value={config.enabled}
            onChange={(enabled) => void persistPatch({ enabled })}
            testID="speaker-broadcast-toggle"
            accessibilityLabel="Broadcast alerts to Google speakers"
          />
        ) : null}
      </View>

      {!isParent ? (
        <Text
          testID="speaker-broadcast-guest-copy"
          style={{
            color: colors["color-text-muted"],
            fontSize: TYPOGRAPHY.body.fontSize,
          }}
        >
          Sign in as a parent to choose Google speakers for house announcements.
        </Text>
      ) : (
        <View style={{ gap: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <Text
              style={{
                color: colors["color-text-secondary"],
                fontSize: TYPOGRAPHY.label.fontSize,
                fontWeight: "600",
                letterSpacing: 1,
              }}
            >
              {config.enabled ? "SPEAKERS & GROUPS" : "ENABLE ABOVE TO PICK SPEAKERS"}
            </Text>
            <SoftButton
              variant="secondary"
              size="sm"
              loading={loading}
              testID="speaker-broadcast-refresh"
              accessibilityLabel="Refresh Home Assistant speakers"
              onPress={() => void loadSpeakers()}
            >
              Refresh
            </SoftButton>
          </View>

          {haWarning ? (
            <Text
              style={{
                color: colors["color-accent-amber"],
                fontSize: TYPOGRAPHY.label.fontSize,
              }}
            >
              {haWarning}
            </Text>
          ) : null}

          {config.enabled ? (
            <View style={{ gap: 12 }}>
              {speakers.length === 0 ? (
                <Text
                  testID="speaker-broadcast-empty"
                  style={{
                    color: colors["color-text-muted"],
                    fontSize: TYPOGRAPHY.body.fontSize,
                  }}
                >
                  No Google speakers found in Home Assistant yet.
                </Text>
              ) : (
                <View style={{ gap: 8 }}>
                  {speakers.map((sp) => {
                    const selected = config.entities.includes(sp.entityId);
                    return (
                      <Pressable
                        key={sp.entityId}
                        testID={`speaker-target-${sp.entityId}`}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: selected }}
                        accessibilityLabel={`Select ${sp.name}`}
                        onPress={() => toggleEntity(sp.entityId)}
                        style={{
                          minHeight: 64,
                          paddingHorizontal: 16,
                          paddingVertical: 12,
                          borderRadius: 16,
                          borderWidth: 1,
                          borderColor: selected ? accentColor : colors["color-border-subtle"],
                          backgroundColor: selected
                            ? mix(accentColor, colors["color-surface-2"], 16)
                            : colors["color-surface-2"],
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                        }}
                      >
                        <View style={{ flex: 1, gap: 2 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <Text
                              style={{
                                color: colors["color-text-primary"],
                                fontSize: TYPOGRAPHY.body.fontSize,
                                fontWeight: "600",
                              }}
                            >
                              {sp.name}
                            </Text>
                            {sp.isGroup ? (
                              <View
                                style={{
                                  paddingHorizontal: 8,
                                  paddingVertical: 2,
                                  borderRadius: 8,
                                  backgroundColor: mix(accentColor, colors["color-surface-1"], 24),
                                }}
                              >
                                <Text
                                  style={{
                                    color: colors["color-text-primary"],
                                    fontSize: TYPOGRAPHY.label.fontSize,
                                    fontWeight: "600",
                                  }}
                                >
                                  Group
                                </Text>
                              </View>
                            ) : null}
                          </View>
                          <Text
                            style={{
                              color: colors["color-text-secondary"],
                              fontSize: TYPOGRAPHY.label.fontSize,
                            }}
                          >
                            {sp.state === "off" || sp.state === "idle" || sp.state === "playing"
                              ? `Ready (${sp.state})`
                              : sp.state}
                          </Text>
                        </View>
                        <Text
                          style={{
                            color: selected ? accentColor : colors["color-text-muted"],
                            fontSize: TYPOGRAPHY.title.fontSize,
                            fontWeight: "700",
                          }}
                        >
                          {selected ? "✓" : "○"}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              <View style={{ gap: 8, paddingTop: 4 }}>
                <Text
                  style={{
                    color: colors["color-text-secondary"],
                    fontSize: TYPOGRAPHY.label.fontSize,
                    fontWeight: "600",
                    letterSpacing: 1,
                  }}
                >
                  ANNOUNCE ON SPEAKERS
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {SPEAKER_CATEGORY_OPTIONS.map((opt) => {
                    const active = config[opt.key];
                    return (
                      <Pressable
                        key={opt.key}
                        testID={opt.testID}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        onPress={() => void persistPatch({ [opt.key]: !active })}
                        style={{
                          minHeight: 64,
                          paddingHorizontal: 16,
                          borderRadius: 16,
                          alignItems: "center",
                          justifyContent: "center",
                          borderWidth: 1,
                          borderColor: active ? accentColor : colors["color-border-subtle"],
                          backgroundColor: active ? accentColor : colors["color-surface-2"],
                        }}
                      >
                        <Text
                          style={{
                            color: active
                              ? colors["color-primary-foreground"]
                              : colors["color-text-secondary"],
                            fontSize: TYPOGRAPHY.body.fontSize,
                            fontWeight: "600",
                          }}
                        >
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <SoftButton
                variant="secondary"
                size="sm"
                loading={testing}
                disabled={config.entities.length === 0}
                testID="speaker-broadcast-test"
                accessibilityLabel="Send test announcement to selected Google speakers"
                onPress={() => void runTest()}
              >
                Test Speakers 🔊
              </SoftButton>
            </View>
          ) : null}

          {statusMessage ? (
            <Text
              testID="speaker-broadcast-status"
              style={{
                color: colors["color-text-secondary"],
                fontSize: TYPOGRAPHY.label.fontSize,
              }}
            >
              {statusMessage}
            </Text>
          ) : null}
        </View>
      )}
    </Material>
  );
}

function formatHour(h: number): string {
  if (h === 0) return "12:00 AM";
  if (h === 12) return "12:00 PM";
  if (h > 12) return `${h - 12}:00 PM`;
  return `${h}:00 AM`;
}

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
  const { prefs, updateCategory, updateQuietHours, updateGentleHours } = useNotificationPreferences();
  const [testingCategory, setTestingCategory] = useState<NotificationCategory | null>(null);
  const [timingMap, setTimingMap] = useState<Record<string, TimingStage>>({
    calendar: "advance",
    routines: "advance",
  });

  const handlePreviewSound = (sound: NotificationSound, volume: number) => {
    void playNotificationSound(sound, volume);
  };

  const handlePreviewVoice = (
    category: NotificationCategory,
    timing: TimingStage,
    volume: number
  ) => {
    const sample = SAMPLE_COPY[category][timing];
    const key = resolveVoiceCallout(category, sample.title, sample.body);
    if (key) {
      void playVoiceCallout(key, volume);
    }
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
        {/* Google Speaker Broadcasts */}
        <SpeakerBroadcastSection />

        {/* Quiet Hours / Do Not Disturb Section */}
        <Material
          tier="thin"
          testID="quiet-hours-card"
          style={{
            borderRadius: 20,
            padding: 18,
            gap: 16,
            borderWidth: 1,
            borderColor: colors["color-border-subtle"],
          }}
        >
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
                🌙 Quiet Hours (Do Not Disturb)
              </Text>
              <Text
                style={{
                  color: colors["color-text-secondary"],
                  fontSize: TYPOGRAPHY.body.fontSize,
                }}
              >
                {prefs.quietHours.enabled
                  ? `Silences routine and calendar notification audio during family sleep (${formatHour(prefs.quietHours.startHour)} – ${formatHour(prefs.quietHours.endHour)}).`
                  : "Silences routine and calendar notification audio during family sleep."}
              </Text>
            </View>
            <Toggle
              value={prefs.quietHours.enabled}
              onChange={(enabled) => updateQuietHours({ enabled })}
              testID="quiet-hours-toggle"
              accessibilityLabel="Enable Quiet Hours Do Not Disturb"
            />
          </View>

          {prefs.quietHours.enabled && (
            <View style={{ gap: 14, paddingTop: 4 }}>
              {/* Start Time Selection */}
              <View style={{ gap: 8 }}>
                <Text
                  style={{
                    color: colors["color-text-secondary"],
                    fontSize: TYPOGRAPHY.label.fontSize,
                    fontWeight: "600",
                    letterSpacing: 1,
                  }}
                >
                  QUIET HOURS START
                </Text>
                <SegmentedControl
                  options={[
                    { id: "22", label: "10:00 PM" },
                    { id: "23", label: "11:00 PM (Default)" },
                    { id: "0", label: "12:00 AM" },
                  ]}
                  value={String(prefs.quietHours.startHour)}
                  onChange={(val) => updateQuietHours({ startHour: Number(val) })}
                  testID="quiet-hours-start-selector"
                />
              </View>

              {/* End Time Selection */}
              <View style={{ gap: 8 }}>
                <Text
                  style={{
                    color: colors["color-text-secondary"],
                    fontSize: TYPOGRAPHY.label.fontSize,
                    fontWeight: "600",
                    letterSpacing: 1,
                  }}
                >
                  QUIET HOURS END (MORNING)
                </Text>
                <SegmentedControl
                  options={[
                    { id: "5", label: "5:00 AM (Default)" },
                    { id: "6", label: "6:00 AM" },
                    { id: "7", label: "7:00 AM" },
                  ]}
                  value={String(prefs.quietHours.endHour)}
                  onChange={(val) => updateQuietHours({ endHour: Number(val) })}
                  testID="quiet-hours-end-selector"
                />
              </View>

              <Text
                style={{
                  color: colors["color-text-muted"],
                  fontSize: TYPOGRAPHY.label.fontSize,
                  lineHeight: 18,
                }}
              >
                Morning routines like &quot;PAPA Leaving to work&quot; at 5:40 AM alert right on schedule after 5:00 AM. Severe weather warnings always remain active.
              </Text>
            </View>
          )}
        </Material>

        {/* Layer 2: Gentle Hours (Morning & Evening Soft Volume) */}
        <Material
          tier="thin"
          testID="gentle-hours-card"
          style={{
            borderRadius: 20,
            padding: 18,
            gap: 16,
            borderWidth: 1,
            borderColor: colors["color-border-subtle"],
          }}
        >
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
                🌅 Gentle Hours (Morning & Evening Soft Volume)
              </Text>
              <Text
                style={{
                  color: colors["color-text-secondary"],
                  fontSize: TYPOGRAPHY.body.fontSize,
                }}
              >
                {prefs.gentleHours.enabled
                  ? `Caps chime and voice announcements at ${Math.round(prefs.gentleHours.maxVolume * 100)}% volume during early morning (${formatHour(prefs.gentleHours.morningStartHour)} – ${formatHour(prefs.gentleHours.morningEndHour)}) and late evening (${formatHour(prefs.gentleHours.eveningStartHour)} – ${formatHour(prefs.gentleHours.eveningEndHour)}).`
                  : "Caps chime and voice announcements at 40% (or quieter) during morning wake-up and evening wind-down."}
              </Text>
            </View>
            <Toggle
              value={prefs.gentleHours.enabled}
              onChange={(enabled) => updateGentleHours({ enabled })}
              testID="gentle-hours-toggle"
              accessibilityLabel="Enable Gentle Hours Soft Volume"
            />
          </View>

          {prefs.gentleHours.enabled && (
            <View style={{ gap: 14, paddingTop: 4 }}>
              {/* Max Volume Cap Selection */}
              <View style={{ gap: 8 }}>
                <Text
                  style={{
                    color: colors["color-text-secondary"],
                    fontSize: TYPOGRAPHY.label.fontSize,
                    fontWeight: "600",
                    letterSpacing: 1,
                  }}
                >
                  GENTLE VOLUME CAP
                </Text>
                <SegmentedControl
                  options={[
                    { id: "0.25", label: "25% (Very Soft)" },
                    { id: "0.3", label: "30%" },
                    { id: "0.4", label: "40% (Default)" },
                    { id: "0.5", label: "50%" },
                  ]}
                  value={String(prefs.gentleHours.maxVolume)}
                  onChange={(val) => updateGentleHours({ maxVolume: Number(val) })}
                  testID="gentle-hours-volume-selector"
                />
              </View>

              {/* Morning Window Selection */}
              <View style={{ gap: 8 }}>
                <Text
                  style={{
                    color: colors["color-text-secondary"],
                    fontSize: TYPOGRAPHY.label.fontSize,
                    fontWeight: "600",
                    letterSpacing: 1,
                  }}
                >
                  MORNING GENTLE WINDOW
                </Text>
                <SegmentedControl
                  options={[
                    { id: "7", label: "5:00 AM – 7:00 AM" },
                    { id: "8", label: "5:00 AM – 8:00 AM (Default)" },
                    { id: "9", label: "5:00 AM – 9:00 AM" },
                  ]}
                  value={String(prefs.gentleHours.morningEndHour)}
                  onChange={(val) => updateGentleHours({ morningEndHour: Number(val) })}
                  testID="gentle-hours-morning-selector"
                />
              </View>

              {/* Evening Window Selection */}
              <View style={{ gap: 8 }}>
                <Text
                  style={{
                    color: colors["color-text-secondary"],
                    fontSize: TYPOGRAPHY.label.fontSize,
                    fontWeight: "600",
                    letterSpacing: 1,
                  }}
                >
                  EVENING GENTLE WINDOW
                </Text>
                <SegmentedControl
                  options={[
                    { id: "19", label: "7:00 PM – 11:00 PM" },
                    { id: "20", label: "8:00 PM – 11:00 PM (Default)" },
                    { id: "21", label: "9:00 PM – 11:00 PM" },
                  ]}
                  value={String(prefs.gentleHours.eveningStartHour)}
                  onChange={(val) => updateGentleHours({ eveningStartHour: Number(val) })}
                  testID="gentle-hours-evening-selector"
                />
              </View>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  marginTop: 4,
                }}
              >
                <Text
                  style={{
                    flex: 1,
                    color: colors["color-text-muted"],
                    fontSize: TYPOGRAPHY.label.fontSize,
                    lineHeight: 18,
                  }}
                >
                  Early morning routines (like 5:40 AM Papá leaving) and evening wind-down routines will play at {Math.round(prefs.gentleHours.maxVolume * 100)}% volume, then normal daytime volume resumes.
                </Text>
                <SoftButton
                  variant="secondary"
                  size="sm"
                  testID="gentle-hours-test-btn"
                  accessibilityLabel="Preview gentle volume"
                  onPress={() => void playNotificationSound("harp", prefs.gentleHours.maxVolume)}
                >
                  🔊 Test Volume ({Math.round(prefs.gentleHours.maxVolume * 100)}%)
                </SoftButton>
              </View>
            </View>
          )}
        </Material>

        {NOTIFICATION_CATEGORIES.map((cat) => {
          const meta = CATEGORY_META[cat];
          const config = prefs[cat];
          const isTesting = testingCategory === cat;
          const timingPref = meta.hasTimingStages ? resolveTimingPreference(config) : "both";
          const currentTiming: TimingStage = meta.hasTimingStages
            ? timingPref === "start_only"
              ? "start"
              : timingPref === "advance_only"
                ? "advance"
                : timingMap[cat] ?? "advance"
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

          const currentSoundMode: SoundMode = meta.hasTimingStages
            ? isAdvance
              ? config.advanceSoundMode ?? config.soundMode ?? "tone_and_voice"
              : config.startSoundMode ?? config.soundMode ?? "tone_and_voice"
            : config.soundMode ?? "tone_and_voice";

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
                  {/* When to Alert (Timing Mode: 15-Min Only, Start Only, Both) */}
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
                        WHEN TO ALERT
                      </Text>
                      <SegmentedControl
                        testID={`notif-timing-mode-${cat}`}
                        options={[
                          { id: "advance_only", label: "⏰ 15-Min Only" },
                          { id: "start_only", label: "🔔 Start Time Only" },
                          { id: "both", label: "✨ Both (15m + Start)" },
                        ]}
                        value={timingPref}
                        onChange={(val) => {
                          const mode = val as TimingPreference;
                          updateCategory(cat, {
                            timingMode: mode,
                            advanceEnabled: mode !== "start_only",
                            startEnabled: mode !== "advance_only",
                          });
                          if (mode === "advance_only") {
                            setTimingMap((prev) => ({ ...prev, [cat]: "advance" }));
                          } else if (mode === "start_only") {
                            setTimingMap((prev) => ({ ...prev, [cat]: "start" }));
                          }
                        }}
                      />
                      <Text
                        style={{
                          color: colors["color-text-muted"],
                          fontSize: TYPOGRAPHY.label.fontSize,
                          lineHeight: 18,
                        }}
                      >
                        {timingPref === "advance_only"
                          ? "Alerts once, 15 minutes before the scheduled time so the family has time to get ready. Will not alert again when it starts."
                          : timingPref === "start_only"
                          ? "Alerts once, right when the routine or event begins. No 15-minute advance reminder."
                          : "Alerts twice: a 15-minute advance reminder, followed by a start alert when it begins."}
                      </Text>

                      {/* Sub-selector for Stage tone/volume when "Both" is active */}
                      {timingPref === "both" && (
                        <View style={{ gap: 8, marginTop: 4 }}>
                          <Text
                            style={{
                              color: colors["color-text-secondary"],
                              fontSize: TYPOGRAPHY.label.fontSize,
                              fontWeight: "600",
                              letterSpacing: 1,
                            }}
                          >
                            CUSTOMIZE TONE & VOLUME FOR
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
                    </View>
                  )}

                  {/* Announcement Style (Tone + ElevenLabs Voice Call-Out) */}
                  <View style={{ gap: 8 }}>
                    <Text
                      style={{
                        color: colors["color-text-secondary"],
                        fontSize: TYPOGRAPHY.label.fontSize,
                        fontWeight: "600",
                        letterSpacing: 1,
                      }}
                    >
                      ANNOUNCEMENT STYLE
                    </Text>
                    <SegmentedControl
                      testID={`notif-mode-switch-${cat}`}
                      options={[
                        { id: "tone_and_voice", label: "🔔 + 🗣️ Tone & Voice" },
                        { id: "voice_only", label: "🗣️ Voice Only" },
                        { id: "tone_only", label: "🎵 Tone Only" },
                      ]}
                      value={currentSoundMode}
                      onChange={(val) => {
                        const nextMode = val as SoundMode;
                        if (meta.hasTimingStages) {
                          if (isAdvance) {
                            updateCategory(cat, {
                              advanceSoundMode: nextMode,
                              soundMode: nextMode,
                            });
                          } else {
                            updateCategory(cat, {
                              startSoundMode: nextMode,
                            });
                          }
                        } else {
                          updateCategory(cat, { soundMode: nextMode });
                        }
                      }}
                    />
                    <Text
                      style={{
                        color: colors["color-text-muted"],
                        fontSize: TYPOGRAPHY.label.fontSize,
                        marginTop: 2,
                      }}
                    >
                      {currentSoundMode === "tone_and_voice"
                        ? "Plays a gentle tone first, followed by Sarah's warm bilingual voice call-out."
                        : currentSoundMode === "voice_only"
                          ? "Plays Sarah's bilingual voice announcement directly."
                          : "Plays the classic notification tone only."}
                    </Text>
                  </View>

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
                  <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
                    <View style={{ flex: 1 }}>
                      <SoftButton
                        variant="secondary"
                        size="sm"
                        testID={`notif-preview-${cat}`}
                        accessibilityLabel={`Preview ${SOUND_LABELS[currentSound]} tone`}
                        onPress={() => handlePreviewSound(currentSound, currentVolume)}
                      >
                        Tone 🔊
                      </SoftButton>
                    </View>
                    <View style={{ flex: 1 }}>
                      <SoftButton
                        variant="secondary"
                        size="sm"
                        testID={`notif-preview-voice-${cat}`}
                        accessibilityLabel="Preview Sarah bilingual voice call-out"
                        onPress={() => handlePreviewVoice(cat, currentTiming, currentVolume)}
                      >
                        Voice 🗣️
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
                        Test 🔔
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
