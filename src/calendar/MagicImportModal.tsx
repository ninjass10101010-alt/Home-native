import React, { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Modal } from "../ui/Modal";
import { SoftButton, mixAlpha } from "../ui/SoftButton";
import { Chip } from "../ui/Chip";
import { TextField } from "../ui/TextField";
import { useTheme } from "../theme/ThemeProvider";
import { MIN_TARGET_DP, TYPOGRAPHY } from "../theme/tokens";
import type { EventDraft } from "./EventComposer";
import {
  ExtractedFlyerEvent,
  SAMPLE_FLYERS,
  extractFlyerEventsSmart,
} from "./magic-import";

export interface MagicImportModalProps {
  visible: boolean;
  defaultDate: string;
  members: string[];
  onClose: () => void;
  onImportEvents: (drafts: EventDraft[]) => Promise<void>;
}

export function MagicImportModal({
  visible,
  defaultDate,
  members,
  onClose,
  onImportEvents,
}: MagicImportModalProps) {
  const { colors, accentColor } = useTheme();

  const [rawText, setRawText] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState<string | null>(null);
  const [extractedEvents, setExtractedEvents] = useState<ExtractedFlyerEvent[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [extractSource, setExtractSource] = useState<"ai" | "local" | null>(null);
  const [importing, setImporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedCount = extractedEvents.filter((e) => e.selected).length;

  const handlePickImage = async () => {
    setErrorMessage(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setImageUri(asset.uri);
        const name = asset.fileName || asset.uri.split("/").pop() || "flyer.jpg";
        setImageFileName(name);
      }
    } catch {
      setErrorMessage("Couldn't open photos. You can paste the flyer text directly.");
    }
  };

  const handleClearImage = () => {
    setImageUri(null);
    setImageFileName(null);
  };

  const handleExtract = async (textToUse?: string, imgToUse?: string | null) => {
    const text = textToUse !== undefined ? textToUse : rawText;
    const img = imgToUse !== undefined ? imgToUse : imageUri;

    if (!text.trim() && !img) {
      setErrorMessage("Please paste flyer text or pick a photo to extract.");
      return;
    }

    setExtracting(true);
    setErrorMessage(null);

    try {
      const res = await extractFlyerEventsSmart({
        text: text.trim(),
        imageUri: img ?? undefined,
        baseDateISO: defaultDate,
        rosterNames: members,
      });

      setExtractedEvents(res.events);
      setExtractSource(res.source);

      if (res.events.length === 0) {
        setErrorMessage("No schedule events could be parsed. Try adding date lines like 'Monday Oct 12: 9:00 AM Event'.");
      }
    } catch {
      setErrorMessage("Extraction failed. Check the text format and try again.");
    } finally {
      setExtracting(false);
    }
  };

  const handleLoadSample = (sample: { label: string; text: string }) => {
    setRawText(sample.text);
    handleClearImage();
    void handleExtract(sample.text, null);
  };

  const toggleEventSelect = (index: number) => {
    setExtractedEvents((prev) =>
      prev.map((ev, i) => (i === index ? { ...ev, selected: !ev.selected } : ev))
    );
  };

  const handleSelectMember = (index: number, memberName: string) => {
    setExtractedEvents((prev) =>
      prev.map((ev, i) => (i === index ? { ...ev, member: memberName } : ev))
    );
  };

  const handleImport = async () => {
    const selected = extractedEvents.filter((e) => e.selected);
    if (selected.length === 0) return;

    setImporting(true);
    setErrorMessage(null);

    try {
      const drafts: EventDraft[] = selected.map((ev) => ({
        title: ev.title,
        date: ev.date,
        startTime: ev.startTime,
        endTime: ev.endTime,
        allDay: ev.allDay,
        member: ev.member,
        location: ev.location,
        notes: ev.notes,
        notify: false,
      }));

      await onImportEvents(drafts);
    } catch {
      setErrorMessage("Failed to import some events. Check the calendar connection.");
    } finally {
      setImporting(false);
    }
  };

  const allMembers = ["All", ...members];

  const footer = (
    <View style={{ gap: 12, width: "100%" }}>
      {errorMessage ? (
        <Text
          accessibilityLiveRegion="assertive"
          style={{
            color: colors["color-accent-rose"] ?? accentColor,
            fontSize: TYPOGRAPHY.label.fontSize,
            textAlign: "center",
          }}
        >
          {errorMessage}
        </Text>
      ) : null}
      <View style={{ flexDirection: "row", gap: 12, justifyContent: "flex-end" }}>
        <SoftButton
          testID="magic-import-cancel"
          accessibilityLabel="Cancel import"
          variant="secondary"
          size="md"
          disabled={importing}
          onPress={onClose}
          style={{ flex: 1 }}
        >
          Cancel
        </SoftButton>
        <SoftButton
          testID="magic-import-submit"
          accessibilityLabel={`Import ${selectedCount} events`}
          variant="primary"
          size="md"
          disabled={selectedCount === 0 || importing}
          loading={importing}
          onPress={handleImport}
          style={{ flex: 2 }}
        >
          {selectedCount === 0
            ? "Import Events"
            : `Import ${selectedCount} Event${selectedCount === 1 ? "" : "s"}`}
        </SoftButton>
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title="Magic Import"
      description="Scan a flyer photo or paste a schedule to extract family events instantly."
      testID="magic-import-modal"
      footer={footer}
    >
      <ScrollView
        style={{ width: "100%", maxHeight: 600 }}
        contentContainerStyle={{ gap: 18, paddingVertical: 8 }}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Photo Picker & Attachment Pill */}
        <View style={{ gap: 8 }}>
          <Text style={{ color: colors["color-text-secondary"], ...TYPOGRAPHY.fieldLabel }}>
            Flyer Photo
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <SoftButton
              testID="magic-import-pick-image"
              accessibilityLabel="Snap or Pick Flyer Photo"
              variant="secondary"
              size="sm"
              onPress={handlePickImage}
            >
              📷 Snap or Pick Flyer Photo
            </SoftButton>
            {imageUri ? (
              <View
                testID="magic-import-image-pill"
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 16,
                  backgroundColor: colors["color-surface-2"],
                  borderWidth: 1,
                  borderColor: colors["color-border"],
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    color: colors["color-text-primary"],
                    fontSize: TYPOGRAPHY.label.fontSize,
                    fontWeight: "600",
                    maxWidth: 180,
                  }}
                >
                  📎 {imageFileName ?? "Flyer attached"}
                </Text>
                <Pressable
                  testID="magic-import-clear-image"
                  accessibilityRole="button"
                  accessibilityLabel="Remove attached flyer photo"
                  onPress={handleClearImage}
                  style={{
                    padding: 8,
                    minWidth: MIN_TARGET_DP,
                    minHeight: MIN_TARGET_DP,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: colors["color-text-secondary"], fontSize: 16, fontWeight: "700" }}>
                    ✕
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>

        {/* 2. Sample Flyers Presets */}
        <View style={{ gap: 8 }}>
          <Text style={{ color: colors["color-text-secondary"], ...TYPOGRAPHY.fieldLabel }}>
            Try A Sample Flyer
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10 }}
          >
            {SAMPLE_FLYERS.map((sample, idx) => (
              <Chip
                key={sample.label}
                testID={`magic-import-sample-${idx}`}
                label={sample.label}
                size="md"
                tone="accent"
                onPress={() => handleLoadSample(sample)}
                accessibilityLabel={`Load sample: ${sample.label}`}
              />
            ))}
          </ScrollView>
        </View>

        {/* 3. Text Input & Extract Action */}
        <View style={{ gap: 10 }}>
          <TextField
            testID="magic-import-text-input"
            label="Schedule Text"
            placeholder="Paste flyer text, email schedule, or type dates (e.g. 'Monday Oct 12: Pajama Day')..."
            value={rawText}
            onChangeText={setRawText}
            multiline
            minHeight={120}
          />
          <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
            <SoftButton
              testID="magic-import-extract-btn"
              accessibilityLabel="Extract events"
              variant="primary"
              size="md"
              loading={extracting}
              disabled={extracting || (!rawText.trim() && !imageUri)}
              onPress={() => handleExtract()}
            >
              🪄 Extract Events
            </SoftButton>
          </View>
        </View>

        {/* 4. Extracted Events Review List */}
        {extractedEvents.length > 0 ? (
          <View style={{ gap: 12, marginTop: 4 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: colors["color-text-secondary"], ...TYPOGRAPHY.fieldLabel }}>
                {`Extracted Events (${selectedCount} of ${extractedEvents.length} selected)`}
              </Text>
              {extractSource ? (
                <Chip
                  size="sm"
                  as="span"
                  tone={extractSource === "ai" ? "accent" : "neutral"}
                  label={extractSource === "ai" ? "✨ AI Extracted" : "⚡ Smart Parser"}
                />
              ) : null}
            </View>

            <View style={{ gap: 10 }}>
              {extractedEvents.map((ev, idx) => {
                const isSelected = ev.selected;
                const timeLabel = ev.allDay ? "All day" : `${ev.startTime} – ${ev.endTime}`;
                return (
                  <View
                    key={ev.id}
                    testID={`magic-import-row-${idx}`}
                    style={{
                      borderRadius: 18,
                      padding: 16,
                      backgroundColor: isSelected
                        ? colors["color-surface-2"]
                        : mixAlpha(colors["color-surface-2"], 0.5),
                      borderWidth: 1,
                      borderColor: isSelected
                        ? mixAlpha(accentColor, 0.4)
                        : colors["color-border"],
                      gap: 12,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      {/* Checkbox toggle */}
                      <Pressable
                        testID={`magic-import-check-${idx}`}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: isSelected }}
                        accessibilityLabel={`Select ${ev.title}`}
                        onPress={() => toggleEventSelect(idx)}
                        style={{
                          width: MIN_TARGET_DP,
                          height: MIN_TARGET_DP,
                          minWidth: MIN_TARGET_DP,
                          minHeight: MIN_TARGET_DP,
                          borderRadius: 16,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: isSelected
                            ? accentColor
                            : colors["color-surface-1"],
                          borderWidth: 1,
                          borderColor: isSelected ? accentColor : colors["color-border"],
                        }}
                      >
                        <Text
                          style={{
                            color: isSelected
                              ? colors["color-primary-foreground"]
                              : colors["color-text-secondary"],
                            fontSize: 20,
                            fontWeight: "700",
                          }}
                        >
                          {isSelected ? "✓" : "○"}
                        </Text>
                      </Pressable>

                      <View style={{ flex: 1, gap: 4 }}>
                        <Text
                          numberOfLines={1}
                          style={{
                            color: colors["color-text-primary"],
                            fontSize: 18,
                            fontWeight: "700",
                          }}
                        >
                          {ev.title}
                        </Text>
                        <Text
                          style={{
                            color: colors["color-text-secondary"],
                            fontSize: TYPOGRAPHY.label.fontSize,
                            fontWeight: "600",
                          }}
                        >
                          {`${ev.date} · ${timeLabel}`}
                        </Text>
                        {ev.location ? (
                          <Text
                            numberOfLines={1}
                            style={{
                              color: colors["color-text-secondary"],
                              fontSize: TYPOGRAPHY.label.fontSize,
                            }}
                          >
                            📍 {ev.location}
                          </Text>
                        ) : null}
                        {ev.notes ? (
                          <Text
                            numberOfLines={1}
                            style={{
                              color: colors["color-text-muted"],
                              fontSize: TYPOGRAPHY.label.fontSize,
                            }}
                          >
                            📝 {ev.notes}
                          </Text>
                        ) : null}
                      </View>
                    </View>

                    {/* Member Assignment Strip */}
                    <View style={{ gap: 6, paddingTop: 4 }}>
                      <Text
                        style={{
                          color: colors["color-text-secondary"],
                          fontSize: TYPOGRAPHY.label.fontSize,
                          fontWeight: "600",
                        }}
                      >
                        Assign To:
                      </Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ gap: 8 }}
                      >
                        {allMembers.map((m) => (
                          <Chip
                            key={m}
                            testID={`magic-import-member-${idx}-${m}`}
                            label={m}
                            size="md"
                            selected={ev.member === m}
                            tone={ev.member === m ? "accent" : "neutral"}
                            onPress={() => handleSelectMember(idx, m)}
                            accessibilityLabel={`Assign ${ev.title} to ${m}`}
                          />
                        ))}
                      </ScrollView>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </Modal>
  );
}
