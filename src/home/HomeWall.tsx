import React from "react";
import { Platform, Text, TextStyle, useWindowDimensions, View } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../theme/ThemeProvider";
import { ACCENTS, FONTS, TYPOGRAPHY } from "../theme/tokens";
import { Material } from "../theme/Material";
import { MemberRail, type RailMember } from "../ui/MemberRail";
import { SignedOutBanner } from "../ui/SignedOutBanner";
import { useAuth } from "../state/AuthProvider";
import { EmergencyShield } from "./EmergencyShield";
import { visibleOnWall, WidgetId, WidgetPlaceholder, WALL_SPANS, WIDGET_TONES, wallColumns } from "./widgets";
import { WallStatStrip, ThisWeekCard } from "./WallStatsStrip";

/* ── The wall's frame ──────────────────────────────────────────────────────────
   The numbers below are MEASURED against the production web wall captured at
   1080×1920 (reference/home/parent-dark.png) — the web's own rhythm, not a
   guess: `px-4` side inset, `pt-7` header top, `mt-1` above the greeting,
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
/** Grid top margin — the web's header band `pb-5` (20px of air between the
 *  KPI band and the first row of cards). */
const GRID_TOP = 20;
/**
 * The signed-out strip (the web's SyncStatusBanner): a 66px band across the
 * very top of the wall, lifted 12px off the canvas edge — 78px of the frame
 * that only exists when there is no session.
 */
const BANNER_H = 78;
/**
 * The header band, measured row by row (the web's header band), signed out:
 *   the band top 28 + the identity row (the member rail's 94px tile)
 *   + mt-1 4 + the greeting's two lines 102 + the KPI gap 20 + the KPI band 78
 *   = 326.
 */
const HEADER_BAND_H = 326;
/**
 * The same band with no banner above it: the band opens by the shield's own
 * height (IDENTITY_TOP_SIGNED_IN 84) instead of the banner's 78 — 382.
 */
const HEADER_BAND_H_SIGNED_IN = 382;
/** Head-room on the band: a longer rail label, a third greeting line or a
 *  taller KPI tile must never push the bento off the panel. */
const HEADER_SLACK = 20;
/** The dock clearance under the tail. */
const DOCK_CLEAR = 140;
/** "This Week" tail (header 48 + strip 69 + DayLine 16 + 2×10 gaps + 24
 *  padding) = 177 measured; 190 reserved leaves 13dp. */
const TAIL_H = 190;
/** Grid → tail gap. */
const TAIL_GAP = 20;
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
 * line of its own. The native's rail is a horizontal SCROLLER, so a wrapped
 * rail would clip its last item — the sign-out button — behind the shield.
 * Opening the band by the shield's own height instead lets the row clear the
 * shield VERTICALLY, which is the same outcome the web's wrap produces: every
 * tile, including sign out, is on screen.
 */
const IDENTITY_TOP_SIGNED_IN = 84;

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
  (WALL_HEIGHT - BANNER_H - HEADER_BAND_H - HEADER_SLACK - DOCK_CLEAR - GRID_TOP - TAIL_GAP - TAIL_H - GRID_GAP * (4 - 1)) / 4
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
}

/**
 * The wall: greeting + member rail + the 12-cell widget bento (3 cols, 4
 * rows; photos spans 2 rows). Height is the contract — the wall never scrolls.
 */
export function HomeWall({ members, onSelectMember, onSignOut, widgets = {}, greetingNow, onSelectDay, onOpenMore }: HomeWallProps) {
  const { colors, accentColor, theme } = useTheme();
  const { member, hydrated } = useAuth();
  const router = useRouter();
  const now = greetingNow ?? new Date();
  const greeting = greetingFor(now.getHours());
  const day = now.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
  const date = now.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase();
  const time = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  // Web parity (page.tsx:537): signed in → the session member's first name;
  // signed out → the family label. The family surname lives only on the NAS
  // (live roster) — never in this source (public-ish remote).
  const familyName = member?.name?.split(" ")[0] ?? "family";

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
          (effectiveWallH - (signedOut ? BANNER_H + HEADER_BAND_H : HEADER_BAND_H_SIGNED_IN) - HEADER_SLACK - DOCK_CLEAR - GRID_TOP - TAIL_GAP - TAIL_H - GRID_GAP * (4 - 1)) / 4
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
    // inset. zIndex keeps this frame above the roster badge app/index.tsx
    // paints at the same corner (that badge now reads THROUGH the wall's own
    // band — see the note in the report).
    <View style={{ flex: 1, zIndex: 1 }}>
      {/* Emergency shield: 64dp, top-right of the wall — the web's fixed
          Emergency button, 16px in from the corner. */}
      <EmergencyShield style={{ top: SHIELD_INSET, right: SHIELD_INSET, zIndex: 30 }} />

      {/* The signed-out band: full width across the very top of the wall, the
          one place the family is told the wall is showing a saved copy. */}
      {signedOut ? (
        <SignedOutBanner
          title={SIGNED_OUT_BANNER}
          action={
            <Text
              style={{
                color: colors["color-accent-amber"],
                fontSize: TYPOGRAPHY.label.fontSize,
                lineHeight: TYPOGRAPHY.label.lineHeight,
                fontWeight: "700",
                textDecorationLine: "underline",
              }}
            >
              Sign in with your PIN →
            </Text>
          }
          onPress={() => router.push("/settings" as never)}
          accessibilityLabel="Sign in with your PIN"
          style={{ marginHorizontal: 16, marginTop: 12, minHeight: 66 }}
          testID="wall-signed-out-banner"
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
              fontWeight: "700",
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
            }}
          >
            <MemberRail members={members} currentName={member?.name ?? null} onSelect={onSelectMember} onSignOut={onSignOut} />
          </View>
        </View>

        {/* Row 2 — the greeting, on TWO lines (the web's `wall-board` break
            that the portrait wall keeps): the salutation, then the family
            name in the accent colour, with the season + clock badge sitting
            on the second line's baseline beside it (the web's Row 2).

            The two lines are set 44px apart — the web's leading
            (`.text-display` sets line-height 0.95, so 39.5px at the web's
            41.6px face; 44 is that ratio carried to the wall's 42px face,
            plus the room the family name's own ascender needs under the
            salutation's descender). Each line's BOX still measures 58, the
            display ramp's line height, which tests/home-wall.test.tsx pins
            on the accent span — the negative margin is what decouples the
            two. Without it the greeting would open 18px wider than the
            reference, and those 18px would come out of the bento's cards. */}
        <View style={{ marginTop: 4 }}>
          <Text numberOfLines={1} style={greetingStyle}>
            {greeting},
          </Text>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 12, marginTop: -14 }}>
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
            The strip owns its own 12dp top margin; the wall adds the web's
            `gap-5` on top of it. */}
        <View style={{ marginTop: 8 }}>
          <WallStatStrip />
        </View>
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
