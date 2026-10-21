import React from "react";
import { Platform, Pressable, Text, TextStyle, useWindowDimensions, View } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../theme/ThemeProvider";
import { ACCENTS, FONTS, RADII, TYPOGRAPHY } from "../theme/tokens";
import { Material } from "../theme/Material";
import { mix } from "../theme/mix";
import { MemberRail, type RailMember } from "../ui/MemberRail";
import { useAuth } from "../state/AuthProvider";
import { EmergencyShield } from "./EmergencyShield";
import { visibleOnWall, WidgetId, WidgetPlaceholder, WALL_SPANS, WIDGET_TONES, wallColumns } from "./widgets";
import { WallStatStrip, ThisWeekCard } from "./WallStatsStrip";

/* ── The wall's frame ──────────────────────────────────────────────────────────
   Every number below is MEASURED against the production web wall captured at
   1080×1920 (reference/home/parent-dark.png — the SIGNED-OUT wall, the one the
   reference matrix shows in all four themes):

     the banner strip    12 – 78      (the pill 12–77, 1px of border)
     the identity row     rail tile 92, the discs 113–164
     the greeting         cap top 203 · baseline 234 · line 2 baseline 274
     the KPI band       300 – 374
     the bento's row 1  395 – 677     (282 tall, a 296 pitch)
     the tail          1587 – 1811
     the dock          1822 – 1900

   The web's own rhythm, not a guess: `px-4` side inset, `pt-7` header top,
   `gap-5` above the KPI band, `pb-5`/`mt-6` above the bento. */

/** Grid gutter (the web's `gap-4` on the 3-column bento). */
const GRID_GAP = 16;
/**
 * The wall's side inset — the web's `px-4`. The header band, the KPI band and
 * the bento all share it, so the wall reads as ONE column: the greeting's
 * left edge, the stat tiles' left edge and the first card's left edge are the
 * same line (16px from the wall's edge).
 */
const GRID_H_PAD = 16;
/**
 * Grid top margin — the air between the KPI band and the first row of cards.
 *
 * The reference's KPI band ends at 374 and its first card row starts at 395:
 * 21px. The native's KPI tile is 78 tall against the web's 75 (the 14sp
 * label floor costs 3px), so the band's bottom border sits at 378 and 17 of
 * the same air keeps the bento's first row on the reference's 395.
 */
const GRID_TOP = 17;
/**
 * The signed-out strip (the web's SyncStatusBanner): a 66px band across the
 * very top of the wall, lifted 12px off the canvas edge — 78px of the frame
 * that only exists when there is no session.
 */
/**
 * The header band, measured row by row against the reference (signed out):
 *   the banner 78 + the band's `pt-7` 28 + the identity row (the member
 *   rail's 91px tile) − the greeting's 5 of overlap + the greeting's two
 *   lines (58 + 40) + the KPI band (its own 12 margin + the 78 tile) = 380,
 *   the KPI band's bottom border.
 */
const HEADER_BAND_H = 380;
/**
 * The same band with no banner above it: the band opens by the shield's own
 * height (IDENTITY_TOP_SIGNED_IN 107) instead of the banner's 78 — 381, the
 * same band the reference's signed-out wall measures. A signed-in wall
 * therefore carries the SAME header geometry as the reference (the banner is
 * chrome above the band; the band itself does not move).
 */
const HEADER_BAND_H_SIGNED_IN = 381;
/**
 * Head-room on the band: a longer rail label, a third greeting line or a
 * taller KPI tile must never push the bento off the panel.
 */
const HEADER_SLACK = 9;
/**
 * The dock clearance under the tail.
 *
 * The tail's bottom edge must sit ~16px above the dock's top edge — the
 * reference's gap (reference/home/guest-dark.png: the tail's bottom border at
 * 1811, the dock's top at 1828). The native's tail card is 30px shorter than
 * the reference's (the card's own height lives in src/home/WallStatsStrip.tsx),
 * so the difference is absorbed by the gutter ABOVE the tail instead of
 * leaving a hole at the bottom of the column — the band below the bento now
 * reads as one filled column, which is what the reference shows.
 */
const DOCK_CLEAR = 114;
/** "This Week" tail — the card's own fixed height (src/home/WallStatsStrip.tsx). */
const TAIL_H = 190;
/**
 * Grid → tail gap. The reference's bento ends at 1565 and its tail starts at
 * 1587 — 22px of canvas between two cards.
 *
 * The native's tail card is 30px shorter than the reference's, so the gap
 * carries the difference: the column from the bento's bottom edge to the
 * dock's top edge is the same height as the reference's, with the tail's
 * bottom landing 16px above the dock (the reference's gap) instead of 42px
 * below it (a void at the foot of the wall).
 */
const TAIL_GAP = 44;
const WALL_HEIGHT = 1920;
/** The emergency shield's 64dp target, inset from the wall's corner (the web's
 *  fixed Emergency button: 16px in, 64×64). */
const SHIELD_INSET = 16;
/** The rail's right-hand clearance for that shield (the web's `pr-16`). */
const SHIELD_CLEARANCE = 64;
/**
 * The identity row's top inset, signed in.
 *
 * The web's emergency button is FIXED at the corner, so the web's rail clears
 * it HORIZONTALLY (`pr-16`) and its identity row is `flex-wrap`: with the
 * sign-out button in the rail the row overflows and the rail wraps onto a
 * line of its own. The native's rail is a wrapping flex row too, but a
 * wrapped rail would leave the sign-out button on its own line, so the band
 * opens BELOW the shield instead — the same outcome the web's wrap produces:
 * every tile, including sign out, is on screen.
 *
 * The opening is the reference's own gap: the chrome's bottom edge (the
 * shield's, at y=79 — the same height as the signed-out banner's) plus the
 * 28px the reference leaves before the rail's plate (its banner ends at 78,
 * its plate starts at 105). The signed-in band therefore opens at 107 and
 * its plate clears the shield by 28px — not the 5px a band opening at 84
 * left.
 */
const IDENTITY_TOP_SIGNED_IN = 107;
/**
 * The identity row's height — the member rail's tile (8 pad + the 48 avatar
 * + 5 + the 20 name line + 8 pad; the 2px ring is a spread shadow drawn
 * outside the avatar, so it never grows the tile). The row is RESERVED at
 * this height so a wall with no roster to show (a cold device that has never
 * saved one) keeps the same band geometry instead of collapsing the
 * greeting up into the rail.
 *
 * 91 is the reference's plate (reference/home/guest-dark.png: Rebecca's plate
 * at x 216-295 / y 105-196 — 80 × 91, r=36), and the row the plate stands in.
 */
const RAIL_ROW_H = 91;

/**
 * Cell height. The derivation subtracts EVERY fixed row it sits between —
 * header, both gaps, the tail, the dock clearance and the grid's own internal
 * gaps — so the reservation sum itself fits the panel (1920 of 1920), not
 * just the "measured" one.
 *
 * GRID_CELL_H is the SIGNED-OUT height: a signed-out wall carries the 78px
 * banner band, so its cards are the shorter ones. A signed-in wall gives
 * those 78px back to the grid (web parity: the bento area is the flex child
 * that grows, so the cards absorb whatever the banner did not use).
 */
export const GRID_CELL_H = Math.floor(
  (WALL_HEIGHT - HEADER_BAND_H - HEADER_SLACK - DOCK_CLEAR - GRID_TOP - TAIL_GAP - TAIL_H - GRID_GAP * (4 - 1)) / 4
);

/** The same cell height for a signed-in wall (no banner band to pay for). */
const GRID_CELL_H_SIGNED_IN = Math.floor(
  (WALL_HEIGHT - HEADER_BAND_H_SIGNED_IN - HEADER_SLACK - DOCK_CLEAR - GRID_TOP - TAIL_GAP - TAIL_H - GRID_GAP * (4 - 1)) / 4
);

/** Time-of-day greeting matching the web's wall header. */
export function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 22) return "Good evening";
  return "Good night";
}

/**
 * The clock's season glyph — the web's month band (page.tsx:411-413), ported
 * so a hardcoded 🍂 can't be right for one month and wrong for nine.
 * Spring = Mar–May, Summer = Jun–Aug, Autumn = Sep–Nov, Winter = Dec–Feb.
 */
export function seasonGlyph(month: number): string {
  if (month >= 2 && month <= 4) return "🌸";
  if (month >= 5 && month <= 7) return "☀️";
  if (month >= 8 && month <= 10) return "🍂";
  return "❄️";
}

/** The web's SyncStatusBanner copy (Home-ai src/components/ui/SyncStatusBanner.tsx). */
const SIGNED_OUT_BANNER = "🔐 Signed out — showing your saved copy. Every change stays on this device until you sign in.";
/**
 * The same strip for a device that has NEVER saved a copy. The web's copy
 * says "showing your saved copy" because the web always has one; a cold
 * native device has none, and claiming a saved copy it does not have is the
 * one thing this strip must never do.
 */
const SIGNED_OUT_BANNER_NO_COPY =
  "🔐 Signed out — no saved copy on this device yet. Sign in to load your family.";
/**
 * The OFFLINE strip — the same notice, but it must ALSO say that the copy on
 * screen could not be refreshed.
 *
 * The wall's signed-out band carries ONE notice (the reference's guest
 * capture leaves y 78-105 empty canvas), so the roster badge that used to
 * carry this disclosure (an amber-rimmed pill crowding the band, 2px above
 * the rail) is gone. The disclosure therefore moves INTO the strip — the
 * honest place for it. The copy is kept short enough to hold the strip's
 * single line: the reference's strip is one line of copy plus the link.
 */
const SIGNED_OUT_BANNER_OFFLINE =
  "🔐 Signed out — couldn't reach Consuela. Showing your saved copy; changes stay on this device.";
const SIGNED_OUT_BANNER_OFFLINE_NO_COPY =
  "🔐 Signed out — couldn't reach Consuela, and this device has no saved copy yet.";

/**
 * The wall's signed-out strip — the web's SyncStatusBanner, NOT the app's
 * shared `SignedOutBanner` chip.
 *
 * Two measured differences are why the wall paints its own:
 *
 *   1. INK — the web sets the WHOLE strip to `text-[var(--color-text-primary)]`,
 *      so the copy AND the link are near-white (#f0f4ff, measured in all four
 *      reference PNGs). The shared chip is amber-inked, which reads as an
 *      alarm strip; the web's is a neutral notice. The chip lives in
 *      src/ui/SignedOutBanner.tsx (shared with Meals/Tasks/Calendar/Photos/
 *      Settings/Emergency) — the orchestrator owns that file; this wall
 *      matches the WEB.
 *   2. LAYOUT — the web's link rides its OWN line above the copy (the link's
 *      baseline 38, the copy's 50, measured), because the link's 44px hit box
 *      makes it the tallest item in a centre-aligned row. The chip's row
 *      centres both on one baseline, which flattens the strip.
 */
/**
 * The strip's body — the web's `bg-[accent-amber]/15` over the canvas.
 *
 * The native paints a FLAT body (the web composites over its canvas
 * gradient, which carries a blue cast the canvas token does not), so the
 * share is the one that lands on the reference's MEASURED fill — rgb(43,33,31)
 * in dark, rgb(238,214,192) in light (reference/home/parent-dark.png and
 * parent-light.png, sampled at y=20, x=600). The dark backdrop carries the
 * canvas's blue cast so the body lands warm-neutral like the reference's
 * instead of orange; the light share is higher because the native's light
 * canvas token is a cool near-white where the web's canvas is a warm one.
 */
const AMBER_SHARE_DARK = 11;
const AMBER_SHARE_LIGHT = 25;
/** The web's canvas is navy-tinted; the canvas token is a neutral near-black. */
const CANVAS_BLUE_CAST = 18;

function WallSignedOutBanner({ copy, onSignIn }: { copy: string; onSignIn: () => void }) {
  const { colors, theme } = useTheme();
  const amber = colors["color-accent-amber"];
  const ink = colors["color-text-primary"];
  const backdrop =
    theme === "light"
      ? colors["color-canvas"]
      : mix(colors["color-nori-950"], colors["color-canvas"], CANVAS_BLUE_CAST);
  const body = mix(amber, backdrop, theme === "light" ? AMBER_SHARE_LIGHT : AMBER_SHARE_DARK);
  const rim = mix(amber, "transparent", 40);
  return (
    <View
      testID="wall-signed-out-banner"
      accessibilityLiveRegion="polite"
      style={{
        marginHorizontal: 16,
        marginTop: 12,
        minHeight: 66,
        borderRadius: RADII.xl,
        borderWidth: 1,
        borderColor: rim,
        backgroundColor: body,
        paddingHorizontal: 16,
        paddingVertical: 10,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      }}
    >
      <Text
        style={{
          color: ink,
          fontSize: TYPOGRAPHY.label.fontSize,
          lineHeight: TYPOGRAPHY.label.lineHeight,
          fontWeight: "600",
          flexShrink: 1,
        }}
      >
        {copy}
      </Text>
      <Pressable onPress={onSignIn} accessibilityRole="link" accessibilityLabel="Sign in with your PIN">
        <Text
          style={{
            color: ink,
            fontSize: TYPOGRAPHY.label.fontSize,
            lineHeight: TYPOGRAPHY.label.lineHeight,
            fontWeight: "600",
            textDecorationLine: "underline",
            textDecorationStyle: "dotted",
            // The web's link rides the strip's UPPER line: its baseline sits
            // 12px above the copy's. A transform lifts it without moving the
            // copy (which the strip centres).
            transform: [{ translateY: -12 }],
          }}
        >
          Sign in with your PIN →
        </Text>
      </Pressable>
    </View>
  );
}

/**
 * The family label for the greeting's second line.
 *
 * Signed in, the web shows the session member's first name (page.tsx:537).
 * Signed out, the web hardcodes "Garcia family" — a real family's surname,
 * which must never live in this repo's public-ish source, so the native reads
 * the label off the SAVED roster instead and says the plain "family" when the
 * roster carries no surname to give. It never invents one.
 *
 * The roster rows come in two shapes: "First Last (Role)" and a bare
 * "First Last". Both carry the surname in the same place, so both are read;
 * a row that is only a first name (or a first name plus a role, e.g. the live
 * roster's "Rebecca (Mom)") carries no surname and is skipped.
 */
export function savedFamilyLabel(members: RailMember[]): string | null {
  const surnames = members
    .map((m) => m.name.match(/^(\S+)\s+([A-Z][\w'’-]+)(?:\s+\([^)]+\))?$/)?.[2] ?? null)
    .filter((s): s is string => !!s);
  if (surnames.length < 2) return null;
  const counts = new Map<string, number>();
  for (const s of surnames) counts.set(s, (counts.get(s) ?? 0) + 1);
  const [surname, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return n >= 2 ? `${surname} family` : null;
}

export interface HomeWallProps {
  members: RailMember[];
  onSelectMember: (m: RailMember) => void;
  onSignOut?: () => void;
  /** id → component; ids absent from the registry render a placeholder cell. */
  widgets?: Partial<Record<WidgetId, React.ComponentType>>;
  greetingNow?: Date;
  /** The "This Week" strip's destination (/meals?day=). Absent = read-only. */
  onSelectDay?: (dayId: string) => void;
  /** Opens the Home "More…" sheet. */
  onOpenMore?: () => void;
  /**
   * True when the device holds a saved copy of the family (the roster cache
   * or the live roster). False = the wall has nothing saved, and the
   * signed-out strip says so instead of claiming a saved copy.
   */
  hasSavedRoster?: boolean;
  /**
   * True when the roster read could not reach Consuela at all (the NAS is
   * down). The signed-out strip then says so INSTEAD of a second badge: the
   * wall's band carries one notice, and a strip that claims "showing your
   * saved copy" without saying the copy could not be refreshed would be a
   * half-truth.
   */
  rosterUnreachable?: boolean;
}

/**
 * The wall: greeting + member rail + the 12-cell widget bento (3 cols, 4
 * rows; photos spans 2 rows). Height is the contract — the wall never scrolls.
 */
export function HomeWall({
  members,
  onSelectMember,
  onSignOut,
  widgets = {},
  greetingNow,
  onSelectDay,
  onOpenMore,
  hasSavedRoster = true,
  rosterUnreachable = false,
}: HomeWallProps) {
  const { colors, accentColor, theme } = useTheme();
  const { member, hydrated } = useAuth();
  const router = useRouter();
  const now = greetingNow ?? new Date();
  const greeting = greetingFor(now.getHours());
  const day = now.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
  const date = now.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase();
  const time = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  // Web parity (page.tsx:537): signed in → the session member's first name;
  // signed out → the family label the saved roster carries, if it carries one.
  const familyName = member?.name?.split(" ")[0] ?? savedFamilyLabel(members) ?? "family";

  /**
   * The signed-out state. The web's wall shows the SyncStatusBanner strip
   * across the very top whenever there is no session; the banner is the wall's
   * only sign-in invitation, so it is a WALL FRAME row, not a card.
   *
   * It waits for the auth to hydrate: before that, "no member" means "we do
   * not know yet", and a banner that flashes on every cold start is a lie the
   * family reads for a second.
   */
  const signedOut = hydrated && !member;

  const defs = visibleOnWall();
  const columns = wallColumns(defs);
  const { width: winW, height: winH } = useWindowDimensions();
  const effectiveWallH =
    typeof jest === "undefined" && Platform.OS === "android" && winW >= 960 && winH > WALL_HEIGHT
      ? winH
      : WALL_HEIGHT;
  const cellH =
    effectiveWallH === WALL_HEIGHT
      ? signedOut
        ? GRID_CELL_H
        : GRID_CELL_H_SIGNED_IN
      : Math.floor(
          (effectiveWallH - (signedOut ? HEADER_BAND_H : HEADER_BAND_H_SIGNED_IN) - HEADER_SLACK - DOCK_CLEAR - GRID_TOP - TAIL_GAP - TAIL_H - GRID_GAP * (4 - 1)) / 4
        );

  /**
   * The greeting's display face (the web's `.text-display`: Instrument Serif
   * 400, -0.03em tracking, 2.6rem at the wall's width).
   *
   * The wall's greeting is set at the WEB's size — 42px against the
   * reference's 41.6px — because the reference's own greeting is the thing
   * being matched. The leading is decoupled from the line box below.
   */
  const greetingStyle: TextStyle = {
    color: colors["color-text-primary"],
    fontFamily: FONTS.display,
    fontWeight: "400",
    fontSize: 42,
    lineHeight: 58,
    letterSpacing: -1.3,
  };

  return (
    // The wall root owns NO padding: the emergency shield and the signed-out
    // band are positioned against the wall's EDGES (the web's `fixed` chrome
    // is inset 16px from the corner), and every content row carries its own
    // inset. The roster badge app/index.tsx paints at the same corner sits in
    // a SIBLING of this frame, so it needs a z-index of its own to stay
    // visible — see the note there.
    <View style={{ flex: 1, zIndex: 1 }}>
      {/* Emergency shield: 64dp, top-right of the wall — the web's fixed
          Emergency button, 16px in from the corner. */}
      <EmergencyShield style={{ top: SHIELD_INSET, right: SHIELD_INSET, zIndex: 30 }} />

      {/* The signed-out band: full width across the very top of the wall, the
          one place the family is told the wall is showing a saved copy — and
          the ONLY notice the signed-out wall carries. The reference's guest
          capture leaves the band between the strip and the identity row empty
          canvas (y 78-105), so nothing else may sit there. */}
      {signedOut ? (
        <WallSignedOutBanner
          copy={
            rosterUnreachable
              ? hasSavedRoster
                ? SIGNED_OUT_BANNER_OFFLINE
                : SIGNED_OUT_BANNER_OFFLINE_NO_COPY
              : hasSavedRoster
                ? SIGNED_OUT_BANNER
                : SIGNED_OUT_BANNER_NO_COPY
          }
          onSignIn={() => router.push("/settings" as never)}
        />
      ) : null}

      {/* The header band. Signed out, the banner band above already carries the
          wall past the shield, so the band opens by the web's pt-7. Signed in
          there is no banner, so the band opens by the shield's own height and
          the identity row clears it vertically. */}
      <View style={{ paddingHorizontal: GRID_H_PAD, paddingTop: signedOut ? 28 : IDENTITY_TOP_SIGNED_IN }}>
        {/* Row 1 — the date eyebrow (left) and the identity rail (right), the
            web's header band: `flex flex-wrap items-center justify-between`.
            The rail carries the shield's clearance so its last tile never
            slides under the emergency button. */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Text
            numberOfLines={1}
            style={{
              color: colors["color-text-secondary"],
              fontSize: TYPOGRAPHY.label.fontSize,
              lineHeight: TYPOGRAPHY.label.lineHeight,
              // The web's eyebrow is `font-semibold` (600) — the native's 700
              // read heavier AND wider than the reference's, whose 'T' is 6px
              // across against the native's 9.
              fontWeight: "600",
              letterSpacing: 2,
              // The web's eyebrow is `flex-1 truncate`: when the rail needs
              // the room, the date truncates rather than pushing the rail.
              flexShrink: 1,
            }}
          >
            {day} · {date}
          </Text>
          <View
            style={{
              flex: 1,
              minWidth: 0,
              // The web's `pr-16` clearance for the fixed emergency button.
              // Signed in, the identity row already clears the shield
              // vertically, so the rail takes the full width instead — the web
              // gets that width by WRAPPING its rail onto a second line.
              paddingRight: signedOut ? SHIELD_CLEARANCE : 0,
              // The row is reserved at the rail tile's height so a wall with
              // no roster to show keeps the band's geometry.
              minHeight: RAIL_ROW_H,
            }}
          >
            <MemberRail members={members} currentName={member?.name ?? null} onSelect={onSelectMember} onSignOut={onSignOut} />
          </View>
        </View>

        {/* Row 2 — the greeting, on TWO lines (the web's `wall-board` break
            that the portrait wall keeps): the salutation, then the family
            name in the accent colour, with the season + clock badge sitting
            on the second line's baseline beside it (the web's Row 2).

            The two lines are set 40px apart — the reference's measured pitch
            (baseline 234 → 274). Each line's BOX still measures 58, the
            display ramp's line height, which tests/home-wall.test.tsx pins on
            the accent span; the negative margins are what decouple the two.
            The greeting itself rides 5px INTO the identity row's own air:
            the reference's cap top (203) sits 3px above the rail tile's
            bottom, and a 58px line box carries 13px of leading above the
            caps. */}
        <View style={{ marginTop: -5 }}>
          <Text numberOfLines={1} style={greetingStyle}>
            {greeting},
          </Text>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 12, marginTop: -18 }}>
            <Text numberOfLines={1} style={greetingStyle}>
              {/* lineHeight is explicit on the nested span too: the outer
                  lineHeight caps inherited children at the platform default
                  (~65 at 54sp), and the card height budget depends on this
                  line measuring 58. */}
              <Text style={{ color: accentColor, lineHeight: 58 }}>{familyName}</Text>
            </Text>
            <Text
              numberOfLines={1}
              style={{
                color: colors["color-text-secondary"],
                fontSize: TYPOGRAPHY.label.fontSize,
                lineHeight: TYPOGRAPHY.label.lineHeight,
                fontWeight: "600",
                letterSpacing: 1.6,
                fontVariant: ["tabular-nums"],
                // The badge rides the greeting's baseline (the web's `pb-1`).
                marginBottom: 12,
              }}
            >
              {seasonGlyph(now.getMonth())} {time}
            </Text>
          </View>
        </View>

        {/* The KPI band — the web's three StatTiles (Events/Tasks/Week), fed by
            the widgets that already own each fact (src/home/wall-stats.ts).
            The strip owns its own 12dp top margin; the web's `gap-5` above
            it lands the band on the reference's 300. */}
        <WallStatStrip />
      </View>

      {/* 12-cell bento: three explicit columns (web grid-flow-dense port) so
          photos can span rows 1–2 in col-1 while cols 2–3 fill beside it.
          Total height = 4×cellH + 3×GRID_GAP = WALL_HEIGHT − header − dock. */}
      <View style={{ paddingHorizontal: GRID_H_PAD }}>
        <View style={{ flexDirection: "row", gap: GRID_GAP, marginTop: GRID_TOP }} testID="wall-grid">
          {columns.map((col, ci) => (
            <View key={`col-${ci}`} style={{ flex: 1, gap: GRID_GAP }} testID={`wall-col-${ci}`}>
              {col.map((def) => {
                const span = WALL_SPANS[def.id] ?? 1;
                const Cell = widgets[def.id];
                const isFullBleed = def.id === "photos" || def.id === "weather";
                // Per-widget tone (web WidgetCard parity): a tone wash + tone
                // hairline on every card — the wall's most distinctive cue.
                const tone = (ACCENTS as { dark: Record<string, string>; light: Record<string, string> })[theme]?.[WIDGET_TONES[def.id]] ?? accentColor;
                return (
                  <View
                    key={def.id}
                    testID={`widget-${def.id}`}
                    style={{ height: span === 2 ? cellH * 2 + GRID_GAP : cellH }}
                  >
                    <Material
                      tier="regular"
                      tone={isFullBleed ? undefined : tone}
                      style={{
                        flex: 1,
                        borderRadius: 28,
                        padding: isFullBleed ? 0 : 14,
                      }}
                    >
                      {Cell ? <Cell /> : <WidgetPlaceholder def={def} />}
                    </Material>
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        {/* "This Week" tail (web page.tsx:1070-1095): the week strip + a
            week-mode DayLine, in a sibling below the bento — one tap from Home,
            /meals?day= is the same contract the web relies on. */}
        <View style={{ marginTop: TAIL_GAP, paddingBottom: DOCK_CLEAR }}>
          <ThisWeekCard onSelectDay={onSelectDay} onOpenMore={onOpenMore} />
        </View>
      </View>
    </View>
  );
}

export default HomeWall;
