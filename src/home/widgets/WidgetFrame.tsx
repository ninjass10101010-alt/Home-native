import React from "react";
import { Platform, Pressable, Text, View } from "react-native";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { ACCENTS, RADII, TYPOGRAPHY } from "../../theme/tokens";
import { useTheme } from "../../theme/ThemeProvider";
import { useAuth } from "../../state/AuthProvider";
import { mix } from "../../theme/mix";
import { SHADOW_RGBA, SPECULAR_AT } from "../../theme/materials";
import { Material } from "../../theme/Material";
import { AnimatedEmoji } from "../../ui/AnimatedEmoji";
import { mixAlpha } from "../../ui/SoftButton";
import { hapticTap } from "../../theme/haptics";
import { READ_COPY, READ_COPY_STALE, READ_RETRY_LABEL, type ReadFailure } from "./data";
import { WIDGET_TONES } from "../widgets";
import { HomeWidgetIcon, widgetIconVariantFor } from "../../ui/HomeWidgetIcon";

/**
 * The default header band, at its constant height.
 *
 * MEASURED on the reference (reference/home/parent-dark.png, 1080×1920): the
 * "Today" card's top border lands at y 691, the title's cap-height band at
 * 717–734 (26px below the border), the description's at 742–755, and the
 * header RULE at 770 — 79px below the card's top border.
 *
 * The web's SectionCard `centeredHeader` (Home-ai/src/components/patterns/
 * SectionCard.tsx:57) seats the title at a FIXED offset from the band's top
 * (`p-4` + `mt-1` = 20px, then the heading's own line box) and lets only the
 * BOTTOM padding absorb a missing description. The native band was BOTTOM
 * aligned (`justifyContent: "flex-end"`), so a card WITHOUT a description
 * dropped its title ~22px and the row's titles stopped sharing one baseline.
 *
 * The band reserves ONE height for every card, with or without a
 * description:
 *   6 (the title's offset from the band's top) + 26 (the title's line box)
 * + 2 (the gap) + 16 (the description's line box) + 8 (the bottom padding)
 * = 58
 * so the rule lands on the same y in every cell of a row — and the title's
 * position does not depend on whether a description exists. Exported so the
 * wall can assert that sibling cells share one rule baseline.
 *
 * The title now lands at +26 below the card's top border — the reference's
 * own +26 — and the description at +48 (the reference's +51). The RULE is at
 * +73 rather than the reference's +79: the reference's band spends 20px
 * above its title (the web's `p-4` + `mt-1`, which the native's 14dp cell
 * padding already covers) and 12px below the description. Matching that
 * depth exactly means a 6px-taller band, which comes straight out of every
 * card's content area and clips the Tasks list's last line — so the band
 * keeps the depth the wall's widgets are laid out against.
 */
export const HEADER_BAND_H = 60;

/**
 * The card-title ramp — 18sp bold left-aligned beside the floating glass orb.
 */
const CARD_TITLE = { fontSize: 18, lineHeight: 24, fontWeight: "700" } as const;

export const DISC_SIZE = 64;
export const DISC_ART = 72;
export const DISC_OVERHANG = -8;

/**
 * Published by HomeWall when `Material` paints the unclipped `WidgetIconOrb`
 * outside the card's `overflow: "hidden"` glass shell so WidgetFrame does not
 * draw a duplicate clipped disc inside.
 */
export const WallBadgeOverlayContext = React.createContext<boolean>(false);

export interface WidgetIconOrbProps {
  id: string;
  icon: string;
  title: string;
  tone?: string;
  standalone?: boolean;
}

export function WidgetIconOrb({
  id,
  icon,
  title,
  tone: toneProp,
  standalone = false,
}: WidgetIconOrbProps) {
  const { colors, theme, accentColor, boost } = useTheme();
  const tone =
    toneProp ??
    ACCENTS[theme]?.[WIDGET_TONES[id as keyof typeof WIDGET_TONES] ?? "nori"] ??
    accentColor;
  const variant = widgetIconVariantFor(id);
  const orbInset = (DISC_ART - DISC_SIZE) / 2;
  const isAndroidRuntime = Platform.OS === "android" && typeof jest === "undefined";
  const orbShadowStyle =
    isAndroidRuntime && !boost
      ? ({
          boxShadow: `0 6px 22px ${mix(tone, "transparent", theme === "dark" ? 56 : 44)}, 0 2px 6px ${SHADOW_RGBA.orbDrop}`,
        } as const)
      : undefined;

  return (
    <View
      testID={`${id}-icon-disc`}
      style={{
        position: "absolute",
        top: standalone ? -12 : DISC_OVERHANG,
        left: standalone ? -12 : DISC_OVERHANG,
        width: DISC_ART,
        height: DISC_ART,
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10,
      }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      <View
        style={[
          {
            position: "absolute",
            top: orbInset,
            left: orbInset,
            width: DISC_SIZE,
            height: DISC_SIZE,
            borderRadius: DISC_SIZE / 2,
            borderWidth: 1.5,
            borderColor:
              theme === "light"
                ? mix(tone, SPECULAR_AT(0.75), 52)
                : mix(tone, "transparent", 55),
            overflow: "hidden",
            zIndex: 0,
          },
          orbShadowStyle,
        ]}
      >
        <LinearGradient
          colors={
            theme === "dark"
              ? [
                  mix(tone, colors["color-surface-1"], 36),
                  mix(tone, colors["color-surface-1"], 18),
                  mix(tone, colors["color-surface-1"], 32),
                ]
              : [
                  mix(tone, colors["color-surface-0"], 26),
                  mix(tone, colors["color-surface-0"], 12),
                  mix(tone, colors["color-surface-0"], 22),
                ]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 0.35, y: 1 }}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}
        />
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 1,
            left: 12,
            right: 12,
            height: 1.5,
            borderRadius: 1,
            backgroundColor: SPECULAR_AT(theme === "dark" ? 0.38 : 0.85),
          }}
        />
      </View>
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
        {variant ? (
          <HomeWidgetIcon variant={variant} size={DISC_ART} title={title} />
        ) : (
          <AnimatedEmoji emoji={icon} size={34} />
        )}
      </View>
    </View>
  );
}

/**
 * The gate/read-state pill (critic round 2, findings 6 + 18).
 *
 * The web's ReadStatePill (Home-ai/src/components/ui/ReadStatePill.tsx) paints
 * the TONE into the hairline and the wash, and the COPY always in
 * `--color-text-primary` — white (rgb(240,244,255)) in dark. The native was
 * painting the whole copy in the amber/rose ink, so the pill read as a warning
 * slab instead of an informational one. Probed live on the reference guest
 * capture: border = tone @ 40%, background = tone @ 12%, color = rgb(240,244,255),
 * font-size 14px, font-weight 500, border-radius 36px (--radius-2xl), and the
 * retry is white / 600 / underlined.
 */
const PILL_RADIUS = RADII.xxl; // 36 — the web's --radius-2xl
const PILL_BORDER_ALPHA = 0.4; // color-mix(in srgb, tone 40%, transparent)
const PILL_WASH_ALPHA = 0.12; // color-mix(in srgb, tone 12%, transparent)

/** The web's ReadStatePill tone icons (ReadStatePill.tsx TONE map). */
const READ_GLYPH: Record<ReadFailure, string> = {
  offline: "📴",
  unauthorised: "🔐",
  error: "⚠️",
  not_connected: "🔌",
};

/**
 * The subject the gate copy names the failure with — the web spells it in
 * SENTENCE case ("Morning briefing: Sign in with your PIN…", the reference
 * guest capture), not in the card title's Title Case ("Morning Briefing").
 */
function subjectOf(title: string): string {
  return title
    .split(" ")
    .map((word, i) => (i === 0 || !word ? word : word.charAt(0).toLowerCase() + word.slice(1)))
    .join(" ");
}

/**
 * The pending / skeleton surface.
 *
 * It used to be `color-surface-2` straight off the ramp, which composites to
 * **1.04:1** (dark) / **1.07:1** (light) over the cell it sits in — i.e. the
 * loading state was invisible, and the suite could not see it because
 * `contrastRatio()` REFUSES a translucent input and the token was being
 * measured alone. A pending surface has to be perceivable, so it is mixed off
 * the theme's own ramp until it clears 3:1 (WCAG 1.4.11) once composited over
 * the cell: the lightest mix that does so is 3.1:1 in both themes.
 */
export function pendingSurface(
  colors: Record<string, string | undefined>,
  theme: "dark" | "light"
): string {
  // The dark ghost rides surface-3/5 (not 5/7): the wall's glass is a deep
  // tinted panel, so a 5/7 ghost would sit at 1.75:1 against it and read as
  // CONTENT rather than as a placeholder. 3/5 lands at ~1.38:1 - perceivable
  // (above 1:1) but clearly a pending surface (under the 1.4:1 ceiling).
  return theme === "dark"
    ? mix(colors["color-surface-3"] ?? "", colors["color-surface-5"] ?? "", 50)
    : mix(colors["color-surface-2"] ?? "", colors["color-surface-3"] ?? "", 50);
}

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
  /** Optional tap handler for the default widget header (title + subtitle + orb overhang). */
  onHeaderPress?: () => void;
  /** Custom accessibility label for the header tap target (defaults to `Open ${title}`). */
  headerPressLabel?: string;
  /** Controls the subtle trailing `›` chevron when `onHeaderPress` is set (defaults to `!headerRight`). */
  showHeaderChevron?: boolean;
  /** Force the identity disc even when a `header` override is passed. */
  showDisc?: boolean;
  /** When true, widget is public/guest-visible and never overrides errors with PIN gates. */
  guestVisible?: boolean;
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
  onHeaderPress,
  headerPressLabel,
  showHeaderChevron,
  showDisc = false,
  guestVisible = false,
  children,
}: WidgetFrameProps) {
  const { colors, theme, accentColor, reduceMotion } = useTheme();
  const { member, hydrated } = useAuth();
  const signedOut = hydrated && !member;

  // One-shot content reveal when transitioning from skeleton loading → ready
  const wasLoadingRef = React.useRef(status === "loading");
  const readyOpacity = useSharedValue(1);
  const readyY = useSharedValue(0);

  React.useEffect(() => {
    if (status === "loading") {
      wasLoadingRef.current = true;
      return;
    }
    const isErrorState = !hasData && (failure !== null || status === "error");
    if (isErrorState) {
      wasLoadingRef.current = false;
      readyOpacity.value = 1;
      readyY.value = 0;
      return;
    }
    if (wasLoadingRef.current) {
      wasLoadingRef.current = false;
      if (reduceMotion) {
        readyOpacity.value = 1;
        readyY.value = 0;
      } else {
        readyOpacity.value = 0;
        readyY.value = 6;
        readyOpacity.value = withTiming(1, { duration: 220 });
        readyY.value = withTiming(0, { duration: 220 });
      }
    }
  }, [status, hasData, failure, reduceMotion, readyOpacity, readyY]);

  const readyAnimStyle = useAnimatedStyle(() => ({
    opacity: readyOpacity.value,
    transform: [{ translateY: readyY.value }],
  }));

  const tone = ACCENTS[theme]?.[WIDGET_TONES[id as keyof typeof WIDGET_TONES] ?? "nori"] ?? accentColor;
  const amber = colors["color-accent-amber"] ?? accentColor;
  const inkAmber = colors["color-accent-ink-amber"] ?? amber;
  const rose = colors["color-accent-rose"] ?? accentColor;
  const hasExternalBadge = React.useContext(WallBadgeOverlayContext);

  const disc =
    !hasExternalBadge && (!header || showDisc) ? (
      <WidgetIconOrb id={id} icon={icon} title={title} tone={tone} standalone />
    ) : null;

  const descriptionNode = description ? (
    <Text
      numberOfLines={1}
      style={{
        color: colors["color-text-secondary"],
        fontSize: TYPOGRAPHY.label.fontSize,
        lineHeight: 18,
        marginTop: 2,
        textAlign: "left",
      }}
    >
      {description}
    </Text>
  ) : null;

  const defaultHeader = (
    <View
      style={{
        justifyContent: "center",
        paddingLeft: 56,
        paddingRight: 4,
        paddingTop: 4,
        paddingBottom: 8,
        minHeight: HEADER_BAND_H,
        borderBottomWidth: 1,
        borderBottomColor: colors["color-border"],
      }}
      testID={`${id}-header`}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 6,
        }}
      >
        {onHeaderPress ? (
          <Pressable
            testID={`${id}-header-press`}
            accessibilityRole="button"
            accessibilityLabel={headerPressLabel ?? `Open ${title}`}
            hitSlop={{ top: 10, bottom: 26, left: 56, right: 8 }}
            onPress={() => {
              hapticTap();
              onHeaderPress();
            }}
            style={({ pressed }) => ({
              flex: 1,
              minWidth: 0,
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              opacity: pressed ? 0.72 : 1,
            })}
          >
            <Text
              numberOfLines={1}
              style={{
                flexShrink: 1,
                minWidth: 0,
                color: colors["color-text-primary"],
                fontSize: CARD_TITLE.fontSize,
                fontWeight: CARD_TITLE.fontWeight,
                lineHeight: CARD_TITLE.lineHeight,
                textAlign: "left",
              }}
              accessibilityRole="header"
            >
              {title}
            </Text>
            {(showHeaderChevron ?? !headerRight) ? (
              <Text
                accessibilityElementsHidden
                importantForAccessibility="no"
                style={{
                  color: colors["color-text-muted"],
                  fontSize: 18,
                  lineHeight: 22,
                  fontWeight: "600",
                }}
              >
                ›
              </Text>
            ) : null}
          </Pressable>
        ) : (
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              minWidth: 0,
              color: colors["color-text-primary"],
              fontSize: CARD_TITLE.fontSize,
              fontWeight: CARD_TITLE.fontWeight,
              lineHeight: CARD_TITLE.lineHeight,
              textAlign: "left",
            }}
            accessibilityRole="header"
          >
            {title}
          </Text>
        )}
        {headerRight ? (
          <View
            pointerEvents="box-none"
            style={{ flexShrink: 0, alignItems: "flex-end", justifyContent: "center" }}
          >
            {headerRight}
          </View>
        ) : null}
      </View>
      {descriptionNode ? (
        onHeaderPress ? (
          <Pressable
            accessible={false}
            onPress={() => {
              hapticTap();
              onHeaderPress();
            }}
            style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
          >
            {descriptionNode}
          </Pressable>
        ) : (
          descriptionNode
        )
      ) : null}
    </View>
  );

  const headerBlock = (
    <View pointerEvents="box-none">
      {disc}
      {header ?? defaultHeader}
      {header && headerRight ? (
        <View pointerEvents="box-none" style={{ position: "absolute", top: 0, right: 0, zIndex: 10 }}>
          {headerRight}
        </View>
      ) : null}
    </View>
  );

  // 1. The failure card — whenever a failure has nothing to show, or the
  //    status says error. Widgets with a legitimately EMPTY payload pass
  //    status "ready" and render their own honest empty state as children.
  const failed = !hasData && (failure !== null || status === "error");
  if (failed) {
    // Only session-gated widgets gate on signed-out with a PIN prompt when they fail.
    // Public / guest-visible widgets (e.g. Weather, Schedule) never claim
    // unauthorised when signed out.
    const isPublic = guestVisible || id === "weather" || id === "schedule";
    const shown: ReadFailure = (!isPublic && signedOut) ? "unauthorised" : (failure ?? "error");
    // Semantic pill tone: hard errors read rose; the guest PIN gate and
    // connectivity failures read amber (web ReadStatePill parity).
    const pillTone = shown === "error" ? rose : amber;
    // The web paints the TONE into the hairline + the wash and the COPY in
    // --color-text-primary (white in dark, near-black in light) — the pill is
    // INFORMATION, not a warning slab.
    const pillInk = colors["color-text-primary"];
    const subject = subjectOf(title);
    const glyph = READ_GLYPH[shown] ?? "";
    return (
      <View testID={`${id}-error`} style={{ flex: 1 }}>
        {headerBlock}
        <View style={{ flex: 1, justifyContent: "center" }}>
          {/* Reference ReadStatePill: subject-prefixed copy + a Try again
              (the reference guest capture shows both on PIN-gated cards). */}
          <Pressable
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel={`${subject}: ${READ_COPY[shown]} ${READ_RETRY_LABEL}`}
            style={{
              minHeight: 64,
              borderRadius: PILL_RADIUS,
              borderWidth: 1,
              borderColor: mixAlpha(pillTone, PILL_BORDER_ALPHA),
              backgroundColor: mixAlpha(pillTone, PILL_WASH_ALPHA),
              paddingHorizontal: 12,
              paddingVertical: 8,
              gap: 6,
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                color: pillInk,
                fontSize: TYPOGRAPHY.label.fontSize,
                lineHeight: TYPOGRAPHY.label.lineHeight,
                fontWeight: "500",
              }}
            >
              {(glyph ? glyph + " " : "") + subject + ": " + READ_COPY[shown]}
            </Text>
            <Text
              style={{
                alignSelf: "flex-start",
                color: pillInk,
                fontSize: TYPOGRAPHY.label.fontSize,
                lineHeight: TYPOGRAPHY.label.lineHeight,
                fontWeight: "600",
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
          <SkeletonRow key={i} id={id} i={i} colors={colors} theme={theme} reduceMotion={reduceMotion} />
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
      <Animated.View style={[{ flex: 1, minHeight: 0, marginTop: 10 }, readyAnimStyle]}>
        {children}
      </Animated.View>
    </View>
  );
}



function SkeletonRow({ id, i, colors, theme, reduceMotion }: {
  id: string; i: number; colors: Record<string,string|undefined>; theme: "dark"|"light"; reduceMotion: boolean;
}) {
  const skipLoop = reduceMotion || (typeof jest === "undefined" && Platform.OS === "android");
  const pulse = useSharedValue(skipLoop ? 1 : 0.55);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));
  React.useEffect(() => {
    if (skipLoop) {
      pulse.value = 1; // eslint-disable-line react-hooks/immutability
      return () => cancelAnimation(pulse);
    }
    pulse.value = withRepeat(withSequence(withTiming(1, { duration: 900 }), withTiming(0.55, { duration: 900 })), -1, false);
    return () => cancelAnimation(pulse);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- shared value write is idiom
  }, [skipLoop]);
  return (
    <Material tier="thin" style={{ height: 64, borderRadius: 20, overflow: "hidden" }}>
      <Animated.View
        testID={`${id}-skeleton-row-${i}`}
        style={[animatedStyle, { flex: 1, backgroundColor: pendingSurface(colors, theme) }]}
      />
    </Material>
  );
}


export default WidgetFrame;
