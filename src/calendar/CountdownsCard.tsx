import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { ACCENTS, MIN_TARGET_DP, RADII, TYPOGRAPHY } from "../theme/tokens";
import { mix } from "../theme/mix";
import { Material } from "../theme/Material";
import { Modal } from "../ui/Modal";
import { SoftButton } from "../ui/SoftButton";
import {
  COUNTDOWN_PRESETS,
  computeCountdownDays,
  useCountdowns,
  type CountdownPreset,
  type CountdownTone,
} from "./countdowns";

export interface CountdownsCardProps {
  now?: Date;
  isParent?: boolean;
  defaultDateISO?: string;
}

const TONES: CountdownTone[] = ["amber", "mint", "cyan", "lavender", "coral"];
const EMOJIS = ["🏰", "🎂", "🏖️", "👵", "🎄", "🎉", "✈️", "🎓", "🎃", "🌟"];

function addDaysToDate(d: Date, days: number): string {
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + days, 12);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`;
}

function formatTargetDate(iso: string): string {
  try {
    const [y, m, d] = iso.split("-").map(Number);
    const date = new Date(y, m - 1, d, 12);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

export function CountdownsCard({
  now = new Date(),
  isParent = false,
  defaultDateISO,
}: CountdownsCardProps) {
  const { colors, theme, accentColor } = useTheme();
  const palette = ACCENTS[theme === "light" ? "light" : "dark"];
  const { countdowns, addCountdown, deleteCountdown } = useCountdowns();

  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [targetDate, setTargetDate] = useState(() => defaultDateISO || addDaysToDate(now, 7));
  const [emoji, setEmoji] = useState("🎉");
  const [tone, setTone] = useState<CountdownTone>("amber");

  // Sorted by upcoming soonest first
  const sortedCountdowns = useMemo(() => {
    return [...countdowns].sort((a, b) => {
      const resA = computeCountdownDays(a.targetDate, now);
      const resB = computeCountdownDays(b.targetDate, now);

      if (resA.daysLeft >= 0 && resB.daysLeft >= 0) {
        return resA.daysLeft - resB.daysLeft;
      }
      if (resA.daysLeft >= 0 && resB.daysLeft < 0) {
        return -1;
      }
      if (resA.daysLeft < 0 && resB.daysLeft >= 0) {
        return 1;
      }
      return resB.daysLeft - resA.daysLeft;
    });
  }, [countdowns, now]);

  const handleOpenModal = () => {
    setTitle("");
    setTargetDate(defaultDateISO || addDaysToDate(now, 7));
    setEmoji("🎉");
    setTone("amber");
    setModalOpen(true);
  };

  const handleApplyPreset = (preset: CountdownPreset) => {
    setTitle(preset.title);
    setEmoji(preset.emoji);
    setTone(preset.tone);
    setTargetDate(addDaysToDate(now, preset.daysOut));
  };

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    const trimmedDate = targetDate.trim();
    if (!trimmedTitle || !/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) return;

    await addCountdown({
      title: trimmedTitle,
      targetDate: trimmedDate,
      emoji,
      tone,
    });

    setTitle("");
    setTargetDate(defaultDateISO || addDaysToDate(now, 7));
    setEmoji("🎉");
    setTone("amber");
    setModalOpen(false);
  };

  return (
    <Material
      tier="regular"
      testID="calendar-countdowns-card"
      style={{
        borderRadius: RADII.xl,
        padding: 20,
        gap: 16,
      }}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <View style={{ flex: 1, minWidth: 200, gap: 2 }}>
          <Text
            style={{
              color: colors["color-text-primary"],
              fontSize: TYPOGRAPHY.title.fontSize,
              fontWeight: "700",
            }}
          >
            ⏳ Event Countdowns
          </Text>
          <Text
            style={{
              color: colors["color-text-secondary"],
              fontSize: TYPOGRAPHY.label.fontSize,
            }}
          >
            Days until the family&apos;s big moments
          </Text>
        </View>

        {isParent ? (
          <SoftButton
            testID="countdown-add-open"
            accessibilityLabel="Add Countdown"
            variant="secondary"
            size="sm"
            onPress={handleOpenModal}
            style={{ minHeight: MIN_TARGET_DP, minWidth: MIN_TARGET_DP }}
          >
            + Add Countdown
          </SoftButton>
        ) : null}
      </View>

      {/* Countdown Tiles or Empty State */}
      {sortedCountdowns.length === 0 ? (
        <View
          testID="countdown-empty"
          style={{
            paddingVertical: 24,
            paddingHorizontal: 16,
            borderRadius: RADII.lg,
            backgroundColor: colors["color-surface-2"],
            borderWidth: 1,
            borderColor: colors["color-border"],
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <Text style={{ fontSize: 32 }}>🗓️</Text>
          <Text
            style={{
              color: colors["color-text-secondary"],
              fontSize: TYPOGRAPHY.body.fontSize,
              fontWeight: "500",
              textAlign: "center",
            }}
          >
            No countdowns pinned yet — parents can add upcoming trips, birthdays, or holidays.
          </Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 14, paddingVertical: 4 }}
        >
          {sortedCountdowns.map((item) => {
            const { badgeLabel } = computeCountdownDays(item.targetDate, now);
            const toneColor = palette[item.tone] ?? accentColor;

            return (
              <View
                key={item.id}
                testID={`countdown-tile-${item.id}`}
                style={{
                  minWidth: 240,
                  borderRadius: RADII.lg,
                  padding: 16,
                  backgroundColor: mix(toneColor, colors["color-surface-1"], theme === "light" ? 16 : 22),
                  borderWidth: 1,
                  borderColor: mix(toneColor, "transparent", 40),
                  gap: 12,
                  justifyContent: "space-between",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <Text style={{ fontSize: 32 }}>{item.emoji}</Text>
                  <View
                    testID={`countdown-badge-${item.id}`}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: RADII.full,
                      backgroundColor: mix(toneColor, "transparent", theme === "dark" ? 35 : 18),
                      borderWidth: 1,
                      borderColor: mix(toneColor, "transparent", 50),
                    }}
                  >
                    <Text
                      style={{
                        color: toneColor,
                        fontSize: TYPOGRAPHY.label.fontSize,
                        fontWeight: "700",
                      }}
                    >
                      {badgeLabel}
                    </Text>
                  </View>
                </View>

                <View style={{ gap: 4 }}>
                  <Text
                    numberOfLines={2}
                    style={{
                      color: colors["color-text-primary"],
                      fontSize: 18,
                      fontWeight: "700",
                    }}
                  >
                    {item.title}
                  </Text>
                  <Text
                    style={{
                      color: colors["color-text-secondary"],
                      fontSize: TYPOGRAPHY.label.fontSize,
                      fontWeight: "500",
                    }}
                  >
                    {formatTargetDate(item.targetDate)}
                  </Text>
                </View>

                {isParent ? (
                  <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 4 }}>
                    <Pressable
                      testID={`countdown-delete-${item.id}`}
                      accessibilityRole="button"
                      accessibilityLabel={`Delete countdown for ${item.title}`}
                      onPress={() => void deleteCountdown(item.id)}
                      style={({ pressed }) => ({
                        minWidth: MIN_TARGET_DP,
                        minHeight: MIN_TARGET_DP,
                        width: MIN_TARGET_DP,
                        height: MIN_TARGET_DP,
                        borderRadius: RADII.full,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: pressed
                          ? mix(colors["color-accent-rose"] ?? accentColor, "transparent", 35)
                          : colors["color-surface-2"],
                        borderWidth: 1,
                        borderColor: mix(
                          colors["color-border"] ?? colors["color-text-secondary"],
                          "transparent",
                          30
                        ),
                      })}
                    >
                      <Text style={{ fontSize: 18, color: colors["color-text-secondary"] }}>✕</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Add Countdown Modal */}
      {modalOpen ? (
        <Modal
          visible={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Add Event Countdown"
          description="Count down the days to an upcoming family moment"
          testID="countdown-add-modal"
        >
          <View style={{ gap: 16 }}>
            {/* Quick presets */}
            <View style={{ gap: 8 }}>
              <Text
                style={{
                  color: colors["color-text-secondary"],
                  fontSize: TYPOGRAPHY.label.fontSize,
                  fontWeight: "600",
                }}
              >
                Quick presets:
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
              >
                {COUNTDOWN_PRESETS.map((preset, idx) => (
                  <Pressable
                    key={preset.title}
                    testID={`countdown-preset-${idx}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Use preset ${preset.title}`}
                    onPress={() => handleApplyPreset(preset)}
                    style={{
                      minHeight: MIN_TARGET_DP,
                      minWidth: MIN_TARGET_DP,
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: RADII.full,
                      backgroundColor: colors["color-surface-2"],
                      borderWidth: 1,
                      borderColor: mix(palette[preset.tone] ?? accentColor, "transparent", 35),
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 18 }}>{preset.emoji}</Text>
                    <Text
                      style={{
                        color: colors["color-text-primary"],
                        fontSize: TYPOGRAPHY.label.fontSize,
                        fontWeight: "600",
                      }}
                    >
                      {preset.title}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {/* Title input */}
            <View style={{ gap: 6 }}>
              <Text
                style={{
                  color: colors["color-text-secondary"],
                  fontSize: TYPOGRAPHY.label.fontSize,
                  fontWeight: "600",
                }}
              >
                Event Title:
              </Text>
              <TextInput
                testID="countdown-title-input"
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Family Vacation, Birthday Party"
                placeholderTextColor={colors["color-text-secondary"]}
                style={{
                  color: colors["color-text-primary"],
                  fontSize: TYPOGRAPHY.body.fontSize,
                  minHeight: 52,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderRadius: RADII.md,
                  backgroundColor: colors["color-surface-2"],
                  borderWidth: 1,
                  borderColor: colors["color-border"],
                }}
              />
            </View>

            {/* Date input */}
            <View style={{ gap: 6 }}>
              <Text
                style={{
                  color: colors["color-text-secondary"],
                  fontSize: TYPOGRAPHY.label.fontSize,
                  fontWeight: "600",
                }}
              >
                Target Date (YYYY-MM-DD):
              </Text>
              <TextInput
                testID="countdown-date-input"
                value={targetDate}
                onChangeText={setTargetDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors["color-text-secondary"]}
                style={{
                  color: colors["color-text-primary"],
                  fontSize: TYPOGRAPHY.body.fontSize,
                  minHeight: 52,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderRadius: RADII.md,
                  backgroundColor: colors["color-surface-2"],
                  borderWidth: 1,
                  borderColor: colors["color-border"],
                }}
              />
            </View>

            {/* Emoji selector chips */}
            <View style={{ gap: 6 }}>
              <Text
                style={{
                  color: colors["color-text-secondary"],
                  fontSize: TYPOGRAPHY.label.fontSize,
                  fontWeight: "600",
                }}
              >
                Choose Emoji:
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
              >
                {EMOJIS.map((em) => {
                  const isSelected = emoji === em;
                  return (
                    <Pressable
                      key={em}
                      testID={`countdown-emoji-${em}`}
                      accessibilityRole="button"
                      accessibilityLabel={`Choose emoji ${em}`}
                      accessibilityState={{ selected: isSelected }}
                      onPress={() => setEmoji(em)}
                      style={{
                        minWidth: MIN_TARGET_DP,
                        minHeight: MIN_TARGET_DP,
                        width: MIN_TARGET_DP,
                        height: MIN_TARGET_DP,
                        borderRadius: RADII.md,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: isSelected
                          ? mix(accentColor, "transparent", 25)
                          : colors["color-surface-2"],
                        borderWidth: 2,
                        borderColor: isSelected ? accentColor : "transparent",
                      }}
                    >
                      <Text style={{ fontSize: 24 }}>{em}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* 5 Tone selector chips */}
            <View style={{ gap: 6 }}>
              <Text
                style={{
                  color: colors["color-text-secondary"],
                  fontSize: TYPOGRAPHY.label.fontSize,
                  fontWeight: "600",
                }}
              >
                Color Tone:
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {TONES.map((t) => {
                  const isSelected = tone === t;
                  const toneColor = palette[t] ?? accentColor;

                  return (
                    <Pressable
                      key={t}
                      testID={`countdown-tone-${t}`}
                      accessibilityRole="button"
                      accessibilityLabel={`Color tone ${t}`}
                      accessibilityState={{ selected: isSelected }}
                      onPress={() => setTone(t)}
                      style={{
                        minHeight: MIN_TARGET_DP,
                        minWidth: MIN_TARGET_DP,
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        borderRadius: RADII.md,
                        backgroundColor: isSelected
                          ? mix(toneColor, "transparent", 30)
                          : colors["color-surface-2"],
                        borderWidth: 2,
                        borderColor: isSelected ? toneColor : "transparent",
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        justifyContent: "center",
                      }}
                    >
                      <View
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 10,
                          backgroundColor: toneColor,
                        }}
                      />
                      <Text
                        style={{
                          color: colors["color-text-primary"],
                          fontSize: TYPOGRAPHY.label.fontSize,
                          fontWeight: isSelected ? "700" : "500",
                          textTransform: "capitalize",
                        }}
                      >
                        {t}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Save Button */}
            <SoftButton
              testID="countdown-save-btn"
              variant="primary"
              size="md"
              accessibilityLabel="Save Countdown"
              disabled={!title.trim() || !targetDate.trim()}
              onPress={() => void handleSave()}
              style={{ minHeight: MIN_TARGET_DP, minWidth: MIN_TARGET_DP, marginTop: 8 }}
            >
              Save Countdown
            </SoftButton>
          </View>
        </Modal>
      ) : null}
    </Material>
  );
}

export default CountdownsCard;
