import React, { useState } from "react";
import { Image, Pressable, Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../theme/ThemeProvider";
import { ACCENTS, MIN_TARGET_DP, RADII, TYPOGRAPHY } from "../theme/tokens";
import { mix } from "../theme/mix";
import { Material } from "../theme/Material";
import { Modal } from "../ui/Modal";
import { SoftButton } from "../ui/SoftButton";
import { displayEmoji } from "./claim";
import { isPhotoUri } from "../ui/MemberRail";
import { FamilyStickyNote, useFamilyStickyNotes } from "./streaks";

export interface FamilyNotesCardProps {
  memberName?: string;
  memberEmoji?: string;
  isParent?: boolean;
}

const TONES: FamilyStickyNote["tone"][] = ["amber", "mint", "cyan", "lavender", "coral"];

const PRESETS = [
  "Good luck on your test! 🌟",
  "Don't forget soccer cleats ⚽",
  "Proud of you today! ❤️",
];

export function FamilyNotesCard({
  memberName,
  memberEmoji = "📝",
  isParent,
}: FamilyNotesCardProps) {
  const { colors, theme } = useTheme();
  const { notes, addNote, togglePin, deleteNote } = useFamilyStickyNotes();

  const [modalOpen, setModalOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [selectedTone, setSelectedTone] = useState<FamilyStickyNote["tone"]>("amber");

  const sortedNotes = [...notes].sort(
    (a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.createdAt.localeCompare(a.createdAt)
  );

  const handleSave = async () => {
    const trimmed = noteText.trim();
    if (!trimmed) return;
    await addNote({
      text: trimmed,
      author: memberName || "Family",
      emoji: memberEmoji || "📝",
      tone: selectedTone,
      pinned: false,
    });
    setNoteText("");
    setModalOpen(false);
  };

  const cardTone = colors["color-accent-amber"] ?? colors["color-accent"];

  return (
    <Material
      tier="regular"
      testID="family-notes-card"
      style={{
        borderRadius: RADII.xl,
        borderColor: mix(cardTone, "transparent", theme === "dark" ? 35 : 14),
        overflow: "hidden",
      }}
    >
      <LinearGradient
        colors={[
          mix(cardTone, "transparent", theme === "dark" ? 14 : 3),
          mix(cardTone, "transparent", theme === "dark" ? 4 : 1),
        ]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <View style={{ paddingHorizontal: 20, paddingVertical: 20, gap: 16 }}>
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            paddingBottom: 14,
            borderBottomWidth: 1,
            borderBottomColor: colors["color-border"] ?? mix(cardTone, "transparent", 20),
          }}
        >
          <View style={{ flex: 1, minWidth: 200 }}>
            <Text
              style={{
                color: colors["color-text-primary"],
                fontSize: TYPOGRAPHY.title.fontSize,
                fontWeight: "700",
              }}
            >
              📌 Family Sticky Notes
            </Text>
            <Text
              style={{
                color: colors["color-text-secondary"],
                fontSize: TYPOGRAPHY.label.fontSize,
                marginTop: 2,
              }}
            >
              Leave a cheer, reminder, or desk memo for the family
            </Text>
          </View>

          {Boolean(memberName || isParent) ? (
            <SoftButton
              variant="secondary"
              size="sm"
              testID="family-notes-add-btn"
              onPress={() => setModalOpen(true)}
              style={{ minHeight: MIN_TARGET_DP }}
            >
              Add Note +
            </SoftButton>
          ) : null}
        </View>

        {/* Content list or empty state */}
        {sortedNotes.length === 0 ? (
          <View
            style={{
              paddingVertical: 28,
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <Text style={{ fontSize: 32 }}>📝</Text>
            <Text
              style={{
                color: colors["color-text-primary"],
                fontSize: TYPOGRAPHY.body.fontSize,
                fontWeight: "600",
              }}
            >
              No sticky notes yet
            </Text>
            <Text
              style={{
                color: colors["color-text-secondary"],
                fontSize: TYPOGRAPHY.label.fontSize,
                textAlign: "center",
              }}
            >
              Leave a cheer, reminder, or desk memo for the family!
            </Text>
          </View>
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
            {sortedNotes.map((note) => {
              const toneHex =
                ACCENTS[theme === "light" ? "light" : "dark"][note.tone] ?? colors["color-accent-amber"];
              const canModify = Boolean(
                isParent || (memberName && note.author.toLowerCase() === memberName.toLowerCase())
              );

              return (
                <View
                  key={note.id}
                  testID={`sticky-note-${note.id}`}
                  style={{
                    flexBasis: "48%",
                    flexGrow: 1,
                    minWidth: 260,
                    borderRadius: RADII.lg,
                    padding: 16,
                    backgroundColor: mix(toneHex, colors["color-surface-1"], theme === "light" ? 18 : 22),
                    borderWidth: 1,
                    borderColor: mix(toneHex, "transparent", 40),
                    gap: 12,
                    justifyContent: "space-between",
                    overflow: "hidden",
                  }}
                >
                  <LinearGradient
                    colors={[mix(toneHex, "transparent", 15), mix(toneHex, "transparent", 5)]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
                    pointerEvents="none"
                  />

                  <View style={{ gap: 8 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        {isPhotoUri(note.emoji) ? (
                          <Image
                            testID={`sticky-note-avatar-img-${note.id}`}
                            source={{ uri: note.emoji }}
                            style={{ width: 22, height: 22, borderRadius: 11 }}
                            resizeMode="cover"
                          />
                        ) : null}
                        <Text
                          style={{
                            color: colors["color-text-secondary"],
                            fontSize: TYPOGRAPHY.label.fontSize,
                            fontWeight: "700",
                          }}
                        >
                          {isPhotoUri(note.emoji) ? note.author : `${displayEmoji(note.emoji)} ${note.author}`}
                        </Text>
                      </View>
                      {note.pinned ? (
                        <View
                          style={{
                            borderRadius: RADII.full,
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            backgroundColor: mix(toneHex, "transparent", 30),
                          }}
                        >
                          <Text style={{ fontSize: TYPOGRAPHY.label.fontSize }}>📌</Text>
                        </View>
                      ) : null}
                    </View>

                    <Text
                      style={{
                        color: colors["color-text-primary"],
                        fontSize: TYPOGRAPHY.body.fontSize,
                        fontWeight: "600",
                        lineHeight: 22,
                      }}
                    >
                      {note.text}
                    </Text>
                  </View>

                  {canModify ? (
                    <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
                      <SoftButton
                        variant="ghost"
                        size="sm"
                        testID={`sticky-note-pin-${note.id}`}
                        accessibilityLabel={note.pinned ? "Unpin note" : "Pin note"}
                        onPress={() => void togglePin(note.id)}
                        style={{ minHeight: MIN_TARGET_DP, minWidth: MIN_TARGET_DP }}
                      >
                        {note.pinned ? "📌 Pinned" : "📌 Pin"}
                      </SoftButton>
                      <SoftButton
                        variant="ghost"
                        size="sm"
                        testID={`sticky-note-delete-${note.id}`}
                        accessibilityLabel="Delete note"
                        onPress={() => void deleteNote(note.id)}
                        style={{ minHeight: MIN_TARGET_DP, minWidth: MIN_TARGET_DP }}
                      >
                        ✕
                      </SoftButton>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* Add note modal */}
      <Modal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add a Family Note"
        description="Leave a cheer, reminder, or desk memo"
        testID="family-notes-modal"
      >
        <View style={{ gap: 16 }}>
          <TextInput
            testID="family-notes-input"
            placeholder="Type a cheer, reminder, or memo..."
            placeholderTextColor={colors["color-text-secondary"]}
            multiline
            value={noteText}
            onChangeText={setNoteText}
            style={{
              color: colors["color-text-primary"],
              fontSize: TYPOGRAPHY.body.fontSize,
              minHeight: 100,
              padding: 14,
              borderRadius: RADII.md,
              backgroundColor: colors["color-surface-2"],
              borderWidth: 1,
              borderColor: mix(colors["color-border"] ?? colors["color-text-primary"], "transparent", 30),
              textAlignVertical: "top",
            }}
          />

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
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {PRESETS.map((preset, idx) => (
                <Pressable
                  key={idx}
                  testID={`family-notes-preset-${idx}`}
                  accessibilityRole="button"
                  onPress={() => setNoteText(preset)}
                  style={{
                    minHeight: MIN_TARGET_DP,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: RADII.full,
                    backgroundColor: colors["color-surface-2"],
                    borderWidth: 1,
                    borderColor: mix(colors["color-accent-amber"] ?? colors["color-accent"], "transparent", 25),
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      color: colors["color-text-primary"],
                      fontSize: TYPOGRAPHY.label.fontSize,
                      fontWeight: "500",
                    }}
                  >
                    {preset}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Tone picker */}
          <View style={{ gap: 8 }}>
            <Text
              style={{
                color: colors["color-text-secondary"],
                fontSize: TYPOGRAPHY.label.fontSize,
                fontWeight: "600",
              }}
            >
              Color tone:
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {TONES.map((t) => {
                const isSelected = selectedTone === t;
                const toneHex =
                  ACCENTS[theme === "light" ? "light" : "dark"][t] ?? colors["color-accent-amber"];

                return (
                  <Pressable
                    key={t}
                    testID={`family-notes-tone-${t}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => setSelectedTone(t)}
                    style={{
                      minHeight: MIN_TARGET_DP,
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      borderRadius: RADII.md,
                      backgroundColor: isSelected ? mix(toneHex, "transparent", 30) : colors["color-surface-2"],
                      borderWidth: 2,
                      borderColor: isSelected ? toneHex : "transparent",
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
                        backgroundColor: toneHex,
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

          {/* Post button */}
          <SoftButton
            variant="primary"
            size="md"
            testID="family-notes-save"
            disabled={!noteText.trim()}
            onPress={() => void handleSave()}
            style={{ minHeight: MIN_TARGET_DP, marginTop: 8 }}
          >
            Post Note
          </SoftButton>
        </View>
      </Modal>
    </Material>
  );
}

export default FamilyNotesCard;
