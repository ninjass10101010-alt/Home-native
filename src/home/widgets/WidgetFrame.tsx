import React from "react";
import { Platform, Pressable, Text, View } from "react-native";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { ACCENTS, RADII, TYPOGRAPHY } from "../../theme/tokens";
import { useTheme } from "../../theme/ThemeProvider";
import { useAuth } from "../../state/AuthProvider";
import { mix } from "../../theme/mix";
import { SPECULAR_AT } from "../../theme/materials";
import { Material } from "../../theme/Material";
import { AnimatedEmoji } from "../../ui/AnimatedEmoji";
import { mixAlpha } from "../../ui/SoftButton";
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
export const HEADER_BAND_H = 58;

/**
 * The card-title ramp (critic round 2, finding 5).
 *
 * The web's wall card title is the SectionCard `centeredHeader` heading, whose
 * size is set by the wall-mode rule
 *   `html[data-wall="true"] .widget-card .text-sm { font-size: 1.125rem }`
 * (Home-ai/src/app/globals.css) — 18px, `font-bold` (700). Probed live on the
 * production reference at 1080×1920: "Today" / "Tasks" / "Home Security" /
 * "Home Climate" / "Home Lights" / "Quick ask" / "This Week" all compute to
 * font-size 18px, font-weight 700, line-height 25.71px.
 *
 * The shared frame was rendering the title at TYPOGRAPHY.title (20sp/700), so
 * every card title was ~11% wider and a stem heavier than the reference, and
 * the long ones ("This Week's Leaderboard") wrapped onto two centred lines
 * where the reference fits one.
 *
 * The 18sp lives HERE, not in tokens.ts: TYPOGRAPHY.title is the app's
 * in-card heading level and other surfaces read it. The tokens.ts change to
 * report: `title` should be 18sp (the wall's card-title size), or a new
 * `cardTitle` level should be added at 18/28/700.
 *
 * The lineHeight is the web's measured 25.71px (Tailwind v4's unitless
 * `text-sm` leading at the wall's 18px), rounded to 26 — the header band
 * below is sized from it.
 */
const CARD_TITLE = { fontSize: 18, lineHeight: 26, fontWeight: "700" } as const;

/**
 * The identity badge (critic round 2, finding 4 → round 3, finding 1).
 *
 * The web seats a 56px glass disc on the card's top-left corner
 * (Home-ai/src/components/patterns/WidgetCard.tsx: `absolute z-30 -top-1
 * -left-1 grid h-14 w-14 place-items-center rounded-full`) and drops the
 * clay artwork (HomeWidgetIcon size="lg" = 64px) INSIDE it.
 *
 * Two details of that seat are easy to miss and both are load-bearing:
 *
 *   1. THE ARTWORK IS NOT CENTRED IN THE DISC. The badge is a grid whose
 *      track sizes to its 64px child, so the artwork sits at the badge's
 *      TOP-LEFT and overflows the 56px disc to the right and down. The
 *      artwork's own top-left corner is the badge's top-left corner.
 *   2. THE BADGE SITS 3px OUTSIDE THE CARD'S BORDER BOX (`-top-1 -left-1`
 *      is 4px out from the card's PADDING box, and the border is 1px), so
 *      the disc's rim crosses the card's left border and the card's corner
 *      arc shorn the badge.
 *
 * MEASURED on the reference (reference/home/parent-dark.png, 1080×1920):
 * the "Today" card's border box starts at x371/y691 and its clay calendar's
 * ink starts at x376/y698 — 5px inside the left border, 7px below the top.
 * The "This Week" tail's card border is at x16 and its badge at x13, the
 * same 3px out.
 *
 * The native's frame content starts 15px inside the card (the Material's 1px
 * border + the cell's 14dp padding), so the badge has to sit 18px out from
 * the content origin to land on the card's corner. The disc's ELEMENT keeps
 * the offset the frame contract pins (DISC_OFFSET) and the seat rides on it
 * as a transform, so the element's MEASURED box is the artwork's box — the
 * wall's paint gate samples that box, and the frame's own suite pins the
 * offset.
 *
 * The Material clips its content (overflow hidden + the card's 28px radius),
 * so the card's corner arc does the shaving the web's overflow:visible
 * cannot: the badge's overhang is cut by the card's own rounded edge instead
 * of floating 10px inside it as a sticker.
 */
const DISC_SIZE = 56; // the web's badge (h-14 w-14)
const DISC_ART = 64; // the web's HomeWidgetIcon "lg" (h-16 w-16)
/** The disc ELEMENT's offset from the frame's content origin (frame contract). */
const DISC_OFFSET = -10;
/**
 * The badge's seat: the extra offset that carries the disc (and the artwork
 * with it) onto the card's corner. −18 from the content origin = −3 from the
 * card's BORDER box, which is exactly where the web's `-top-1 -left-1` puts
 * the badge's top-left corner.
 */
const DISC_SEAT = -8;

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
  showDisc = false,
  guestVisible = false,
  children,
}: WidgetFrameProps) {
  const { colors, theme, accentColor, reduceMotion } = useTheme();
  const { member, hydrated } = useAuth();
  const signedOut = hydrated && !member;

  const tone = ACCENTS[theme]?.[WIDGET_TONES[id as keyof typeof WIDGET_TONES] ?? "nori"] ?? accentColor;
  const amber = colors["color-accent-amber"] ?? accentColor;
  const inkAmber = colors["color-accent-ink-amber"] ?? amber;
  const rose = colors["color-accent-rose"] ?? accentColor;

  // 3-stop seated badge (warm-glass web reference): tone-on-surface wash with
  // a 42%-transparent ring, seated ON the card's corner so the card's own
  // rounded edge shorn it — the web's `overflow: visible` badge, as close as
  // the clipped Material allows.
  const disc = !header || showDisc ? (
    <View
      testID={`${id}-icon-disc`}
      style={{
        position: "absolute",
        top: DISC_OFFSET,
        left: DISC_OFFSET,
        width: DISC_ART,
        height: DISC_ART,
        alignItems: "center",
        justifyContent: "center",
        zIndex: 3,
        // The seat: −8 on top of the element's own offset puts the badge's
        // top-left corner 3px outside the card's border box (the web's
        // `-top-1 -left-1`). It is a transform, not a re-offset, so the
        // element's measured box IS the badge's box.
        transform: [{ translateX: DISC_SEAT }, { translateY: DISC_SEAT }],
      }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      // The web's badge is `pointer-events-none` — it is decoration, and it
      // now overhangs the card's corner, so it must never eat a tap.
      pointerEvents="none"
    >
      {/* The web's badge: a 56px seated glass disc (tone-on-surface wash + a
          42% tone ring). It sits at the badge's TOP-LEFT, where the web's
          grid track puts the 64px artwork — the artwork is NOT centred in
          the disc (see the note above). */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: DISC_SIZE,
          height: DISC_SIZE,
          borderRadius: DISC_SIZE / 2,
          borderWidth: 1,
          borderColor: mix(tone, "transparent", 42),
          overflow: "hidden",
          zIndex: 0,
        }}
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
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 1,
            left: 10,
            right: 10,
            height: 1.5,
            borderRadius: 1,
            backgroundColor: SPECULAR_AT(theme === "dark" ? 0.3 : 0.65),
          }}
        />
      </View>
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
          <HomeWidgetIcon variant={widgetIconVariantFor(id)!} size={DISC_ART} title={title} />
        ) : (
          <AnimatedEmoji emoji={icon} size={30} />
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
        // The title's FIXED offset from the band's top — the web's
        // `centeredHeader` seats the heading at the same offset whether or not
        // a description follows it, so a card without a second line cannot
        // slide its title down (and break the row's shared title baseline).
        //
        // Constant band height: the header RULE has to land on the same y in
        // every sibling cell or the wall reads as a broken baseline. The
        // description's line box is RESERVED either way, so a card without a
        // description keeps the same band height (and the same rule) as its
        // neighbours; the spare space falls BELOW the title, where the web
        // puts its bottom padding.
        paddingTop: 6,
        paddingBottom: 8,
        minHeight: HEADER_BAND_H,
        justifyContent: "flex-start",
        borderBottomWidth: 1,
        borderBottomColor: colors["color-border"],
      }}
      testID={`${id}-header`}
    >
      <Text
        style={{
          color: colors["color-text-primary"],
          fontSize: CARD_TITLE.fontSize,
          fontWeight: CARD_TITLE.fontWeight,
          lineHeight: CARD_TITLE.lineHeight,
          textAlign: "center",
        }}
        accessibilityRole="header"
      >
        {title}
      </Text>
      {description ? (
        <Text
          numberOfLines={1}
          style={{
            color: colors["color-text-secondary"],
            fontSize: TYPOGRAPHY.label.fontSize,
            // The web's description is `text-xs` — Tailwind v4's unitless
            // leading at the wall's 14px (≈18.7px, and 1rem=16px before the
            // wall's font-size override). The native's label ramp carries a
            // 20px line box, which would push the description 4px below the
            // reference's; the band is sized from this line box.
            lineHeight: 16,
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
      <View style={{ flex: 1, minHeight: 0, marginTop: 10 }}>{children}</View>
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
