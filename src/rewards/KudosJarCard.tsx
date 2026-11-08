import React, { useMemo, useState } from "react";
import { Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { Material } from "../theme/Material";
import { Modal } from "../ui/Modal";
import { SoftButton } from "../ui/SoftButton";
import { isPhotoUri } from "../ui/MemberRail";
import { ACCENTS, MIN_TARGET_DP, RADII, SPACING, TYPOGRAPHY } from "../theme/tokens";
import { mix } from "../theme/mix";
import { FALLBACK_MEMBERS } from "../api/members";
import {
  KUDOS_BADGES,
  KUDOS_QUICK_MESSAGES,
  useKudosJar,
  type KudosBadge,
  type KudosBadgeId,
  type KudosEntry,
} from "./kudos-jar";

export interface KudosJarMember {
  name: string;
  emoji?: string;
  role?: string;
}

export interface KudosJarCardProps {
  senderName?: string;
  senderEmoji?: string;
  roster?: KudosJarMember[];
  isParent: boolean;
  onKudosSent?: (entry: KudosEntry) => void;
}

export function KudosJarCard({
  senderName = "Family",
  senderEmoji = "🌟",
  roster = [],
  isParent,
  onKudosSent,
}: KudosJarCardProps) {
  const { colors, accentColor, theme } = useTheme();
  const { entries, addEntry, deleteEntry } = useKudosJar();

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<KudosJarMember | null>(null);
  const [selectedBadgeId, setSelectedBadgeId] = useState<KudosBadgeId>("kind-heart");
  const [message, setMessage] = useState("");

  const themeKey = theme === "light" ? "light" : "dark";

  const availableMembers = useMemo(() => {
    const list = roster && roster.length > 0 ? roster : FALLBACK_MEMBERS;
    return list.filter((m) => (m.name || "").trim());
  }, [roster]);

  const handleOpenModal = () => {
    setSelectedRecipient(null);
    setSelectedBadgeId("kind-heart");
    setMessage("");
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
  };

  const handleSubmit = async () => {
    if (!selectedRecipient || !message.trim()) return;
    const entry = await addEntry({
      fromName: senderName,
      fromEmoji: senderEmoji,
      toName: selectedRecipient.name,
      toEmoji: selectedRecipient.emoji || "🌟",
      badgeId: selectedBadgeId,
      message: message.trim(),
    });
    onKudosSent?.(entry);
    setMessage("");
    setModalOpen(false);
  };

  const getBadgeColor = (badge: KudosBadge) => {
    return ACCENTS[themeKey][badge.tone] ?? colors[`color-accent-${badge.tone}`] ?? accentColor;
  };

  return (
    <Material
      testID="rewards-kudos-jar-card"
      tier="regular"
      tone={colors["color-accent-amber"] ?? accentColor}
      style={{
        borderRadius: 24,
        padding: 20,
        gap: 16,
      }}
    >
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <View style={{ gap: 4 }}>
          <Text
            style={{
              color: colors["color-text-muted"],
              fontSize: TYPOGRAPHY.label.fontSize,
              fontWeight: "700",
              letterSpacing: 1.5,
              textTransform: "uppercase",
            }}
          >
            KINDNESS & GRATITUDE
          </Text>
          <Text
            style={{
              color: colors["color-text-primary"],
              fontSize: TYPOGRAPHY.cardTitle.fontSize,
              fontWeight: "700",
            }}
          >
            🌟 Family Kudos & Kindness Jar
          </Text>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View
            testID="kudos-jar-count"
            style={{
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: RADII.pill,
              backgroundColor: mix(colors["color-accent-amber"] ?? accentColor, "transparent", 20),
              borderWidth: 1,
              borderColor: mix(colors["color-accent-amber"] ?? accentColor, "transparent", 40),
            }}
          >
            <Text
              style={{
                color: colors["color-text-primary"],
                fontSize: TYPOGRAPHY.label.fontSize,
                fontWeight: "700",
              }}
            >
              {`${entries.length} Kindness ${entries.length === 1 ? "Star" : "Stars"}`}
            </Text>
          </View>

          <SoftButton
            variant="primary"
            size="sm"
            testID="kudos-send-open"
            accessibilityLabel="Send kudos to a family member"
            onPress={handleOpenModal}
            style={{ minHeight: MIN_TARGET_DP }}
          >
            Send Kudos +
          </SoftButton>
        </View>
      </View>

      {/* Entry List or Empty State */}
      {entries.length === 0 ? (
        <View
          style={{
            paddingVertical: 24,
            paddingHorizontal: 16,
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            borderRadius: RADII.lg,
            backgroundColor: colors["color-surface-1"],
            borderWidth: 1,
            borderColor: colors["color-border-subtle"],
          }}
        >
          <Text style={{ fontSize: 32 }}>✨</Text>
          <Text
            style={{
              color: colors["color-text-primary"],
              fontSize: TYPOGRAPHY.body.fontSize,
              fontWeight: "600",
              textAlign: "center",
            }}
          >
            The Kindness Jar is empty
          </Text>
          <Text
            style={{
              color: colors["color-text-secondary"],
              fontSize: TYPOGRAPHY.label.fontSize,
              textAlign: "center",
            }}
          >
            Be the first to drop a star for someone today!
          </Text>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          {entries.map((entry) => {
            const badge = KUDOS_BADGES.find((b) => b.id === entry.badgeId) || KUDOS_BADGES[0];
            const badgeColor = getBadgeColor(badge);
            return (
              <View
                key={entry.id}
                testID={`kudos-entry-${entry.id}`}
                style={{
                  padding: 16,
                  borderRadius: RADII.lg,
                  backgroundColor: colors["color-surface-1"],
                  borderWidth: 1,
                  borderColor: colors["color-border-subtle"],
                  gap: 10,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  {/* From -> To */}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", flex: 1 }}>
                    {/* From */}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      {entry.fromEmoji && isPhotoUri(entry.fromEmoji) ? (
                        <Image
                          testID={`kudos-from-avatar-${entry.id}`}
                          source={{ uri: entry.fromEmoji }}
                          style={{ width: 24, height: 24, borderRadius: 12 }}
                          resizeMode="cover"
                        />
                      ) : (
                        <Text testID={`kudos-from-avatar-${entry.id}`} style={{ fontSize: 18 }}>
                          {entry.fromEmoji || "🌟"}
                        </Text>
                      )}
                      <Text
                        style={{
                          color: colors["color-text-secondary"],
                          fontSize: TYPOGRAPHY.label.fontSize,
                          fontWeight: "600",
                        }}
                      >
                        {entry.fromName}
                      </Text>
                    </View>

                    <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize }}>
                      →
                    </Text>

                    {/* To */}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      {entry.toEmoji && isPhotoUri(entry.toEmoji) ? (
                        <Image
                          testID={`kudos-to-avatar-${entry.id}`}
                          source={{ uri: entry.toEmoji }}
                          style={{ width: 24, height: 24, borderRadius: 12 }}
                          resizeMode="cover"
                        />
                      ) : (
                        <Text testID={`kudos-to-avatar-${entry.id}`} style={{ fontSize: 18 }}>
                          {entry.toEmoji || "🌟"}
                        </Text>
                      )}
                      <Text
                        style={{
                          color: colors["color-text-primary"],
                          fontSize: TYPOGRAPHY.label.fontSize,
                          fontWeight: "700",
                        }}
                      >
                        {entry.toName}
                      </Text>
                    </View>

                    {/* Badge Pill */}
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: RADII.pill,
                        backgroundColor: mix(badgeColor, "transparent", 20),
                        borderWidth: 1,
                        borderColor: mix(badgeColor, "transparent", 40),
                      }}
                    >
                      <Text style={{ fontSize: 14 }}>{badge.emoji}</Text>
                      <Text
                        style={{
                          color: colors["color-text-primary"],
                          fontSize: TYPOGRAPHY.label.fontSize,
                          fontWeight: "700",
                        }}
                      >
                        {badge.label}
                      </Text>
                    </View>
                  </View>

                  {/* Parent Delete Button */}
                  {isParent ? (
                    <Pressable
                      testID={`kudos-delete-${entry.id}`}
                      accessibilityRole="button"
                      accessibilityLabel={`Delete shoutout to ${entry.toName}`}
                      onPress={() => void deleteEntry(entry.id)}
                      style={{
                        minWidth: MIN_TARGET_DP,
                        minHeight: MIN_TARGET_DP,
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: RADII.pill,
                        backgroundColor: mix(colors["color-accent-rose"], "transparent", 15),
                      }}
                    >
                      <Text
                        style={{
                          color: colors["color-accent-rose"],
                          fontSize: TYPOGRAPHY.body.fontSize,
                          fontWeight: "700",
                        }}
                      >
                        ✕
                      </Text>
                    </Pressable>
                  ) : null}
                </View>

                {/* Message */}
                <Text
                  style={{
                    color: colors["color-text-primary"],
                    fontSize: TYPOGRAPHY.body.fontSize,
                    lineHeight: 22,
                  }}
                >
                  {entry.message}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Send Kudos Modal */}
      <Modal
        visible={modalOpen}
        onClose={handleCloseModal}
        title="Send Family Kudos 🌟"
        description="Shout out a family member for doing something kind or helpful!"
        testID="kudos-send-modal"
      >
        <ScrollView style={{ maxHeight: 560 }} contentContainerStyle={{ gap: SPACING.md }}>
          {/* Recipient Picker */}
          <View style={{ gap: SPACING.xs }}>
            <Text
              style={{
                color: colors["color-text-secondary"],
                fontSize: TYPOGRAPHY.label.fontSize,
                fontWeight: "700",
              }}
            >
              Who are you shouting out?
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACING.xs }}>
              {availableMembers.map((m) => {
                const selected = selectedRecipient?.name === m.name;
                return (
                  <Pressable
                    key={m.name}
                    testID={`kudos-to-${m.name}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Send kudos to ${m.name}`}
                    accessibilityState={{ selected }}
                    onPress={() => setSelectedRecipient(m)}
                    style={{
                      minHeight: MIN_TARGET_DP,
                      minWidth: MIN_TARGET_DP,
                      paddingHorizontal: SPACING.md,
                      paddingVertical: SPACING.xs,
                      borderRadius: RADII.pill,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: SPACING.xs,
                      backgroundColor: selected
                        ? mix(accentColor, "transparent", 25)
                        : colors["color-surface-2"],
                      borderWidth: 1,
                      borderColor: selected ? accentColor : colors["color-border-subtle"],
                    }}
                  >
                    {m.emoji && isPhotoUri(m.emoji) ? (
                      <Image
                        testID={`kudos-to-avatar-${m.name}`}
                        source={{ uri: m.emoji }}
                        style={{ width: 24, height: 24, borderRadius: 12 }}
                        resizeMode="cover"
                      />
                    ) : (
                      <Text testID={`kudos-to-avatar-${m.name}`} style={{ fontSize: 18 }}>
                        {m.emoji || "👤"}
                      </Text>
                    )}
                    <Text
                      style={{
                        color: selected ? colors["color-text-primary"] : colors["color-text-secondary"],
                        fontSize: TYPOGRAPHY.label.fontSize,
                        fontWeight: selected ? "700" : "600",
                      }}
                    >
                      {m.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Badge Picker */}
          <View style={{ gap: SPACING.xs }}>
            <Text
              style={{
                color: colors["color-text-secondary"],
                fontSize: TYPOGRAPHY.label.fontSize,
                fontWeight: "700",
              }}
            >
              Choose a Kindness Badge
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACING.xs }}>
              {KUDOS_BADGES.map((b) => {
                const selected = selectedBadgeId === b.id;
                const badgeColor = getBadgeColor(b);
                return (
                  <Pressable
                    key={b.id}
                    testID={`kudos-badge-${b.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Kindness badge ${b.label}`}
                    accessibilityState={{ selected }}
                    onPress={() => setSelectedBadgeId(b.id)}
                    style={{
                      minHeight: MIN_TARGET_DP,
                      minWidth: MIN_TARGET_DP,
                      paddingHorizontal: SPACING.md,
                      paddingVertical: SPACING.xs,
                      borderRadius: RADII.pill,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: SPACING.xs,
                      backgroundColor: selected
                        ? mix(badgeColor, "transparent", 25)
                        : colors["color-surface-2"],
                      borderWidth: 1,
                      borderColor: selected ? badgeColor : colors["color-border-subtle"],
                    }}
                  >
                    <Text style={{ fontSize: 18 }}>{b.emoji}</Text>
                    <Text
                      style={{
                        color: colors["color-text-primary"],
                        fontSize: TYPOGRAPHY.label.fontSize,
                        fontWeight: selected ? "700" : "600",
                      }}
                    >
                      {b.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Quick Message Presets */}
          <View style={{ gap: SPACING.xs }}>
            <Text
              style={{
                color: colors["color-text-secondary"],
                fontSize: TYPOGRAPHY.label.fontSize,
                fontWeight: "700",
              }}
            >
              Quick Praise Ideas
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACING.xs }}>
              {KUDOS_QUICK_MESSAGES.map((preset, idx) => {
                const selected = message === preset;
                return (
                  <Pressable
                    key={preset}
                    testID={`kudos-preset-${idx}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Preset message: ${preset}`}
                    onPress={() => setMessage(preset)}
                    style={{
                      minHeight: MIN_TARGET_DP,
                      minWidth: MIN_TARGET_DP,
                      paddingHorizontal: SPACING.md,
                      paddingVertical: SPACING.xs,
                      borderRadius: RADII.pill,
                      justifyContent: "center",
                      backgroundColor: selected
                        ? mix(accentColor, "transparent", 22)
                        : colors["color-surface-2"],
                      borderWidth: 1,
                      borderColor: selected ? accentColor : colors["color-border-subtle"],
                    }}
                  >
                    <Text
                      style={{
                        color: selected ? colors["color-text-primary"] : colors["color-text-secondary"],
                        fontSize: TYPOGRAPHY.label.fontSize,
                        fontWeight: selected ? "700" : "600",
                      }}
                    >
                      {preset}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Custom Message Input */}
          <View style={{ gap: SPACING.xs }}>
            <Text
              style={{
                color: colors["color-text-secondary"],
                fontSize: TYPOGRAPHY.label.fontSize,
                fontWeight: "700",
              }}
            >
              Personal Message
            </Text>
            <TextInput
              testID="kudos-message-input"
              placeholder="Write a sweet shoutout..."
              placeholderTextColor={colors["color-text-muted"]}
              value={message}
              onChangeText={setMessage}
              multiline
              style={{
                minHeight: MIN_TARGET_DP,
                fontSize: TYPOGRAPHY.body.fontSize,
                color: colors["color-text-primary"],
                backgroundColor: colors["color-surface-2"],
                paddingHorizontal: SPACING.md,
                paddingVertical: SPACING.sm,
                borderRadius: RADII.md,
                borderWidth: 1,
                borderColor: colors["color-border-subtle"],
              }}
            />
          </View>

          {/* Actions */}
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: SPACING.sm, marginTop: SPACING.xs }}>
            <SoftButton
              variant="ghost"
              onPress={handleCloseModal}
              style={{ minHeight: MIN_TARGET_DP }}
            >
              Cancel
            </SoftButton>
            <SoftButton
              variant="primary"
              testID="kudos-send-submit"
              disabled={!selectedRecipient || !message.trim()}
              onPress={() => void handleSubmit()}
              style={{ minHeight: MIN_TARGET_DP }}
            >
              Drop in Kudos Jar 🌟
            </SoftButton>
          </View>
        </ScrollView>
      </Modal>
    </Material>
  );
}
