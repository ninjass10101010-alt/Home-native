import React from "react";
import { Pressable, Text, View } from "react-native";
import { ACCENTS, TYPOGRAPHY } from "../../theme/tokens";
import { useTheme } from "../../theme/ThemeProvider";
import { mixAlpha } from "../../ui/SoftButton";
import { READ_COPY, READ_COPY_STALE, READ_RETRY_LABEL, type ReadFailure } from "./data";
import { WIDGET_TONES } from "../widgets";
import { HomeWidgetIcon, widgetIconVariantFor } from "../../ui/HomeWidgetIcon";

export interface WidgetFrameProps {
  /** Widget id used to namespace testIDs (`${id}-loading` / `${id}-error`). */
  id: string;
  icon: string;
  title: string;
  description?: string;
  status: "loading" | "ready" | "error";
  failure: ReadFailure | null;
  hasData: boolean;
  stale: boolean;
  onRetry: () => void;
  /** Optional header override (e.g. the meal widget's "{Icon} Dinner Time · 6:05 PM"). */
  header?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * The shared wall-cell interior. The Material shell lives in HomeWall (padding
 * 18, borderRadius 28 — it clips); this renders ONLY content.
 *
 * Layout (U13 rev — reference parity): a per-widget TONED identity disc
 * seated at the card's top-left, with a CENTERED title band (the web's
 * SectionCard centeredHeader pattern — the captures show centered titles in
 * every card). The disc stays inside the cell bounds (Material clips).
 *
 * State machine (airtight, no blank cells):
 *   1. !hasData && (failure || status !== "loading") → the failure card
 *      (header kept; subject-prefixed copy + Try again — the reference's
 *      ReadStatePill pattern, including the guest PIN-gate states). A
 *      misaligned caller can never render a blank cell.
 *   2. status === "loading"          → header + two 64dp ghost rows.
 *   3. otherwise                     → header + stale badge + children.
 */
export function WidgetFrame({
  id,
  icon,
  title,
  description,
  status,
  failure,
  hasData,
  stale,
  onRetry,
  header,
  children,
}: WidgetFrameProps) {
  const { colors, theme, accentColor } = useTheme();

  const tone = ACCENTS[theme]?.[WIDGET_TONES[id as keyof typeof WIDGET_TONES] ?? "nori"] ?? accentColor;
  const amber = colors["color-accent-amber"] ?? accentColor;
  const inkAmber = colors["color-accent-ink-amber"] ?? amber;

  const disc = (
    <View
      testID={`${id}-icon-disc`}
      style={{
        position: "absolute",
        top: -8,
        left: -6,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: mixAlpha(tone, 0.18),
        borderWidth: 1,
        borderColor: mixAlpha(tone, 0.38),
        alignItems: "center",
        justifyContent: "center",
        zIndex: 3,
      }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {widgetIconVariantFor(id) ? (
        <HomeWidgetIcon variant={widgetIconVariantFor(id)!} size={44} title={title} />
      ) : (
        <Text style={{ fontSize: 28, lineHeight: 32 }}>{icon}</Text>
      )}
    </View>
  );

  const defaultHeader = (
    <View style={{ alignItems: "center", paddingLeft: 44, paddingRight: 44 }} testID={`${id}-header`}>
      <Text
        style={{
          color: colors["color-text-primary"],
          fontSize: TYPOGRAPHY.title.fontSize,
          fontWeight: "700",
          lineHeight: TYPOGRAPHY.title.lineHeight,
          textAlign: "center",
        }}
        accessibilityRole="header"
      >
        {title}
      </Text>
      {description ? (
        <Text
          style={{
            color: colors["color-text-secondary"],
            fontSize: TYPOGRAPHY.label.fontSize,
            lineHeight: TYPOGRAPHY.label.lineHeight,
            marginTop: 2,
            textAlign: "center",
          }}
        >
          {description}
        </Text>
      ) : null}
    </View>
  );

  const headerBlock = (
    <View>
      {disc}
      {header ?? defaultHeader}
    </View>
  );

  // 1. The failure card — whenever a failure has nothing to show, or the
  //    status says error. Widgets with a legitimately EMPTY payload pass
  //    status "ready" and render their own honest empty state as children.
  const failed = !hasData && (failure !== null || status === "error");
  if (failed) {
    const shown: ReadFailure = failure ?? "error";
    const lock = shown === "unauthorised";
    return (
      <View testID={`${id}-error`} style={{ flex: 1 }}>
        {headerBlock}
        <View style={{ flex: 1, justifyContent: "center" }}>
          {/* Reference ReadStatePill: subject-prefixed copy + a Try again
              (the reference guest capture shows both on PIN-gated cards). */}
          <Pressable
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel={`${title}: ${READ_COPY[shown]} ${READ_RETRY_LABEL}`}
            style={{
              minHeight: 64,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: mixAlpha(amber, 0.45),
              backgroundColor: mixAlpha(amber, 0.14),
              paddingHorizontal: 14,
              paddingVertical: 12,
              gap: 6,
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                color: inkAmber,
                fontSize: TYPOGRAPHY.label.fontSize,
                lineHeight: TYPOGRAPHY.label.lineHeight,
                fontWeight: "600",
              }}
            >
              {(lock ? "🔒 " : "⚠️ ") + title + ": " + READ_COPY[shown]}
            </Text>
            <Text
              style={{
                alignSelf: "flex-start",
                color: inkAmber,
                fontSize: TYPOGRAPHY.label.fontSize,
                lineHeight: TYPOGRAPHY.label.lineHeight,
                fontWeight: "700",
                textDecorationLine: "underline",
              }}
            >
              {READ_RETRY_LABEL}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // 2. Loading skeleton (no failure in play).
  if (status === "loading") {
    return (
      <View testID={`${id}-loading`} accessibilityLabel={`Loading ${title}`} style={{ flex: 1, gap: 12 }}>
        {headerBlock}
        {[0, 1].map((i) => (
          <View
            key={i}
            style={{ height: 64, borderRadius: 20, backgroundColor: colors["color-surface-2"] }}
          />
        ))}
      </View>
    );
  }

  // 3. Ready content — last-good data with a failure set is kept AND badged
  //    even if the caller forgot to pass stale (the frame stays honest).
  const showStale = stale || (failure !== null && hasData);
  return (
    <View style={{ flex: 1, minHeight: 0 }}>
      {headerBlock}
      {showStale ? (
        <Text
          testID={`${id}-stale`}
          style={{
            alignSelf: "center",
            marginTop: 6,
            // ink-amber clears AA in BOTH themes (the raw amber fails light on glass)
            color: inkAmber,
            fontSize: TYPOGRAPHY.label.fontSize,
            fontWeight: "600",
          }}
        >
          {READ_COPY_STALE}
        </Text>
      ) : null}
      <View style={{ flex: 1, minHeight: 0, marginTop: 10 }}>{children}</View>
    </View>
  );
}

export default WidgetFrame;
