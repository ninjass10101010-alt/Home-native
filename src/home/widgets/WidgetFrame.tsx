import React from "react";
import { Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ACCENTS, TYPOGRAPHY } from "../../theme/tokens";
import { useTheme } from "../../theme/ThemeProvider";
import { mix } from "../../theme/mix";
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
  /** Right-of-header slot (pills, expand chevrons) on the default band. */
  headerRight?: React.ReactNode;
  /** Force the identity disc even when a `header` override is passed. */
  showDisc?: boolean;
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
  headerRight,
  showDisc = false,
  children,
}: WidgetFrameProps) {
  const { colors, theme, accentColor } = useTheme();

  const tone = ACCENTS[theme]?.[WIDGET_TONES[id as keyof typeof WIDGET_TONES] ?? "nori"] ?? accentColor;
  const amber = colors["color-accent-amber"] ?? accentColor;
  const inkAmber = colors["color-accent-ink-amber"] ?? amber;
  const rose = colors["color-accent-rose"] ?? accentColor;
  const inkRose = colors["color-accent-ink-rose"] ?? rose;

  // 3-stop seated badge (warm-glass web reference): tone-on-surface wash with
  // a 42%-transparent ring, sized to seat inside the Material's 14dp padding.
  const disc = !header || showDisc ? (
    <View
      testID={`${id}-icon-disc`}
      style={{
        position: "absolute",
        top: -6,
        left: -6,
        width: 52,
        height: 52,
        borderRadius: 26,
        borderWidth: 1,
        borderColor: mix(tone, "transparent", 42),
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        zIndex: 3,
      }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <LinearGradient
        colors={[
          mix(tone, colors["color-surface-1"], 34),
          mix(tone, colors["color-surface-1"], 20),
          mix(tone, colors["color-surface-1"], 30),
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.35, y: 1 }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}
      />
      {/* The wash is OPAQUE, and on react-native-web a positioned descendant
          paints ABOVE in-flow content — so an in-flow <Svg> underneath it
          vanishes entirely (every wall disc rendered as an empty tinted
          circle). The artwork rides its own positioned layer at zIndex 1,
          which is what makes it visible over the wash. */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1,
        }}
        pointerEvents="none"
      >
        {widgetIconVariantFor(id) ? (
          <HomeWidgetIcon variant={widgetIconVariantFor(id)!} size={38} title={title} />
        ) : (
          <Text style={{ fontSize: 24, lineHeight: 28 }}>{icon}</Text>
        )}
      </View>
    </View>
  ) : null;

  const defaultHeader = (
    <View
      style={{
        alignItems: "center",
        paddingLeft: 48,
        paddingRight: 48,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: colors["color-border"],
      }}
      testID={`${id}-header`}
    >
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
      {headerRight ? (
        <View style={{ position: "absolute", top: 0, right: 0, zIndex: 4 }}>{headerRight}</View>
      ) : null}
    </View>
  );

  // 1. The failure card — whenever a failure has nothing to show, or the
  //    status says error. Widgets with a legitimately EMPTY payload pass
  //    status "ready" and render their own honest empty state as children.
  const failed = !hasData && (failure !== null || status === "error");
  if (failed) {
    const shown: ReadFailure = failure ?? "error";
    const lock = shown === "unauthorised";
    // Semantic pill tone: hard errors read rose; the guest PIN gate and
    // connectivity failures read amber (web ReadStatePill parity).
    const pillTone = shown === "error" ? rose : amber;
    const pillInk = shown === "error" ? inkRose : inkAmber;
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
              borderColor: mixAlpha(pillTone, 0.45),
              backgroundColor: mixAlpha(pillTone, 0.14),
              paddingHorizontal: 14,
              paddingVertical: 12,
              gap: 6,
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                color: pillInk,
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
                color: pillInk,
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
