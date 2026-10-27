import React from "react";
import { Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../theme/ThemeProvider";
import { FONTS, TYPOGRAPHY } from "../theme/tokens";
import { accentDeepened, mix } from "../theme/mix";
import { SPECULAR_AT } from "../theme/materials";
import { Material } from "../theme/Material";
import { HomeWidgetIcon, widgetIconVariantFor } from "../ui/HomeWidgetIcon";
import { AnimatedEmoji } from "../ui/AnimatedEmoji";
import { MoreButton } from "../nav/CapsuleDock";
import { useWallStats, weekSkeletonFor, type WallDayCell } from "./wall-stats";

/**
 * The wall header's KPI band — port of Home-ai page.tsx:744-754 (three
 * StatTiles, one baseline, calm tones). The numeral is the thing being read
 * from across the room, so it is the loudest element on a tile; the icon is
 * the web's clay HomeWidgetIcon, whose own glow halo is the reference's
 * round tinted disc, and the label/detail pair paints the tone ink (the same
 * accent-ink recipe Chip/Avatar use) so AA holds over the tone wash.
 *
 * Composition (web StatTile `compact wide`, measured on the 1080px wall
 * capture): [icon][gap][numeral] … [label / detail, right-aligned]. The
 * numeral is LEFT-aligned right after the icon and the label block hugs the
 * tile's right edge — the tile is a short, wide PILL, not a card with a
 * number floating in the middle of it.
 *
 * Honesty: only truth renders. `null` tiles stay blank until their source
 * answers — the tile wears the web's own unknown-value GLYPH (the em dash,
 * in the same primary ink the reference uses) in the numeral slot, never a
 * fabricated 0 and never a blank that could be mistaken for a rendered value.
 */

type ToneKey = "accent" | "success" | "warning" | "danger";

/**
 * The KPI band geometry — the web's wide StatTile, measured on the 1080px
 * wall capture (Home-ai StatTile.tsx:96-98 + globals.css `.text-numeral-hero`).
 *
 * The web tile is a 2-row CSS GRID:
 *   row 1   [icon chip 28px] [value — spans rows 1-2] [label]
 *   row 2                                        [detail]
 * with `gap-x: 12px` (gap-x-3), `gap-y: 2px` (gap-y-0.5) and 12px padding
 * (p-3). Measured on reference/home/parent-dark.png:
 *   tile    x 16..354, y 300..374   (75 tall)
 *   chip    x 28..56,  artwork ink y 314..342 (the chip box is 28)
 *   value   ink x 70..83, y 328..346 (14 x 19 — a 27.2px mono digit)
 *   label   ink y 321..331, right-aligned at the tile's 12px inset
 *   detail  ink y 347..359
 * So the icon rides 9px ABOVE the value's centre (the web seats the chip in
 * row 1 while the value spans both rows), and the label/detail pair is 25-26px
 * apart (the label sits in row 1, which is as tall as the chip).
 */
/**
 * KPI band height. The web's wide StatTile measures 75px at the wall's
 * 1080px viewport (1px border + 12px padding + a 28px icon row + the second
 * 16px label row). The tile reproduces the web's 2-row grid, so the native's
 * 14sp label floor no longer costs the extra 3px it used to: the label sits
 * in the chip's own 28px row and the detail in a 20px row, which is exactly
 * the reference's 50px content. A FIXED height also keeps the band from
 * reflowing as answers land.
 */
const KPI_TILE_H = 75;
/** The web's `p-3` — the tile's inner inset on all four sides. */
const KPI_PAD = 12;
/** The web's icon chip: `h-7 w-7` (28px) around the 32px HomeWidgetIcon,
 *  whose artwork deliberately overflows the chip by 2px a side. */
const KPI_ICON_PX = 28;
/** The web's `gap-x-3` — the gap between the icon chip and the numeral. */
const KPI_ICON_GAP = 12;
/** Grid row 1 is as tall as the icon chip (the web's `row-start-1` cells). */
const KPI_LABEL_ROW1 = 28;
/** Grid row 2 carries the detail line (the native's 14sp label floor). */
const KPI_LABEL_ROW2 = 20;
/** The web's `gap-y-0.5`. */
const KPI_ROW_GAP = 2;
/** The two label rows + the gap — the tile's content height. */
const KPI_CONTENT_H = KPI_LABEL_ROW1 + KPI_ROW_GAP + KPI_LABEL_ROW2;
/**
 * The web's value size: `sm:text-[1.7rem]` = 27.2px at the wall width
 * (`xl:text-[2.75rem]` needs a 1280px viewport — the wall is 1080).
 */
const KPI_NUMERAL_SIZE = 27.2;
/**
 * The web's `.text-numeral-hero` tracking: -0.04em (letter-spacing is px in
 * React Native, so the em value is resolved here).
 */
const KPI_NUMERAL_TRACKING = -0.04 * KPI_NUMERAL_SIZE;
/**
 * The unknown-value glyph's width. The web's em dash is a MONOSPACE advance
 * (0.6em ≈ 16px, ink ≈ 15px) in the 27.2px hero face; the app's own face is
 * proportional (Fredoka's em dash inks 17.5px), so the placeholder is
 * compressed back to the reference's 15px tick. The bar is 5px tall there
 * against the reference's 4px — one pixel, and it is the same glyph.
 */
const KPI_DASH_SCALE = 15 / 17.5;

/** The web's `grid gap-3 sm:gap-4` on the KPI band — 16px at the wall width. */
const KPI_BAND_GAP = 16;
/** "This Week" card height — the same 190 the wall's tail budget reserves
 *  (measured content 177 leaves 13dp of slack). Definite for the same reason
 *  as KPI_TILE_H above. */
const THIS_WEEK_H = 190;

function toneToken(key: ToneKey): string {
  switch (key) {
    case "success":
      return "color-accent-mint";
    case "warning":
      return "color-accent-amber";
    case "danger":
      return "color-accent-rose";
    default:
      return "color-accent-selected";
  }
}

/** The tone's ink token (web StatTile's toneInkClass: the accent-ink recipe
 *  Avatar and Chip use). "accent" is the plain `color-accent-ink` — the
 *  nonexistent `-ink-selected` was silently falling through to a mix. */
function toneInkToken(key: ToneKey): string {
  const suffix = toneToken(key).replace("color-accent-", "");
  return suffix === "selected" ? "color-accent-ink" : `color-accent-ink-${suffix}`;
}

interface TileProps {
  label: string;
  detail: string;
  value: string;
  /** True = the source hasn't answered: the numeral slot wears the muted
   *  em-dash placeholder — never a blank, never a fabricated 0. */
  pending?: boolean;
  /**
   * True = the value on screen is the LAST-GOOD copy (the refresh failed).
   * The tile then MARKS it — a stale number published without a marker is a
   * live claim the wall cannot back up ("stale data is badged or hidden,
   * never faked"), and the band must not disagree with the card below it.
   */
  stale?: boolean;
  icon: string;
  widgetId: string;
  tone: ToneKey;
  testID: string;
}

/** The tile's stale marker — the band-level twin of the card's stale badge. */
const STALE_MARK = "stale";

function StatTile({ label, detail, value, pending, stale, icon, widgetId, tone, testID }: TileProps) {
  const { colors, accentColor } = useTheme();
  const toneColor = colors[toneToken(tone)] ?? accentColor;
  const ink = colors[toneInkToken(tone)] ?? mix(toneColor, colors["color-text-primary"], 45);
  // The app's stale ink (the same one the widget cards' stale badge wears).
  const staleInk = colors["color-accent-ink-amber"] ?? colors["color-text-secondary"];
  const variant = widgetIconVariantFor(widgetId);

  return (
    <Material
      tier="regular"
      tone={toneColor}
      style={{
        flex: 1,
        height: KPI_TILE_H,
        borderRadius: 24,
        paddingHorizontal: KPI_PAD,
        paddingVertical: KPI_PAD,
        justifyContent: "flex-start",
      }}
      testID={testID}
    >
      {/* The web's 2-row grid: the chip in row 1, the value spanning both
          rows, the label/detail pair in column 3. `alignItems: flex-start`
          reproduces the web's `alignContent: start` (the rows start at the
          content's top edge). */}
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        {/* The icon is the web's clay HomeWidgetIcon at `size="sm"` — the
            same artwork, and the same round glow halo behind it. The web
            seats it in a `rounded-xl bg-white/7%` chip; on the wall that
            chip is invisible, so the native paints the artwork on the
            card instead of tinting a square behind it (which read as a
            flat sticker, not a disc). The chip BOX is the web's 28px
            `h-7 w-7` — the 32px artwork overflows it by 2px a side,
            exactly as it does on the web. */}
        <View
          style={{
            width: KPI_ICON_PX,
            height: KPI_ICON_PX,
            borderRadius: 10,
            backgroundColor: mix(toneColor, "transparent", 12),
            borderWidth: 1,
            borderColor: mix(toneColor, "transparent", 24),
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {variant ? (
            <HomeWidgetIcon variant={variant} size="sm" />
          ) : (
            <AnimatedEmoji emoji={icon} size={22} />
          )}
        </View>
        {/* The value column: the numeral spans rows 1-2, so it is centred on
            the tile's CONTENT height (the web's `row-span-2`), which is what
            puts the icon 9px above it. */}
        <View style={{ marginLeft: KPI_ICON_GAP, height: KPI_CONTENT_H, justifyContent: "center", flexShrink: 0 }}>
          {pending ? (
            /* The numeral slot while its read is unanswered: the WEB's own
               unknown-value glyph — the em dash the reference shows on a tile
               whose source has not answered. It wears the same primary ink as
               a real numeral (the reference's dash is white, not dimmed) but
               is unmistakably a GLYPH, not a slab, so the tile never reads as
               a hole. Static, too: a pulsing dash would flicker the floor it
               is supposed to sit under. */
            <Text
              testID={`${testID}-pending`}
              accessibilityLabel="Not known yet"
              style={{
                color: colors["color-text-primary"],
                fontFamily: FONTS.rounded,
                fontSize: KPI_NUMERAL_SIZE,
                lineHeight: KPI_NUMERAL_SIZE,
                fontWeight: "700",
                transform: [{ scaleX: KPI_DASH_SCALE }],
                transformOrigin: "left center",
              }}
            >
              {"—"}
            </Text>
          ) : (
            <Text
              style={{
                color: colors["color-text-primary"],
                fontFamily: FONTS.rounded,
                fontSize: KPI_NUMERAL_SIZE,
                lineHeight: KPI_NUMERAL_SIZE,
                fontWeight: "700",
                letterSpacing: KPI_NUMERAL_TRACKING,
                fontVariant: ["tabular-nums"],
              }}
            >
              {value}
            </Text>
          )}
        </View>
        {/* The label block hugs the tile's right edge (the web's
            `md:col-start-3 md:justify-self-end md:text-right`), label over
            detail, both in the tone ink. The label sits in grid row 1 — as
            tall as the icon chip — and the detail in row 2, which is what
            gives the pair the reference's 25-26px pitch. */}
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <View style={{ height: KPI_LABEL_ROW1, justifyContent: "center" }}>
            <Text
              style={{ color: ink, fontSize: TYPOGRAPHY.label.fontSize, lineHeight: TYPOGRAPHY.label.lineHeight, fontWeight: "500" }}
              numberOfLines={1}
            >
              {label}
            </Text>
          </View>
          <View style={{ height: KPI_LABEL_ROW2, justifyContent: "center", marginTop: KPI_ROW_GAP }}>
            <Text
              style={{ color: ink, fontSize: TYPOGRAPHY.label.fontSize, lineHeight: TYPOGRAPHY.label.lineHeight }}
              numberOfLines={1}
            >
              {detail}
              {/* The tile carries the staleness of its OWN number: the count
                  above is the last-good copy the card below is also showing
                  (badged there), and the band can never publish it as a live
                  figure. The marker rides the detail line so the numeral
                  stays the loudest thing on the tile. */}
              {stale ? (
                <Text testID={`${testID}-stale`} style={{ color: staleInk, fontWeight: "600" }}>
                  {` · ${STALE_MARK}`}
                </Text>
              ) : null}
            </Text>
          </View>
        </View>
      </View>
    </Material>
  );
}


export function WallStatStrip() {
  const { eventsToday, openTasks, openTasksStale, plannedDays } = useWallStats();

  // Tone parity (critic round 4, HIGH 4): the strip's three tiles must read
  // as three TONES, the way the reference does in every capture — amber
  // events / mint tasks / blue week. The Tasks tile's tone is the TASKS
  // widget's identity (the reference measures the same teal fill (36,60,64)
  // and mint ink (136,212,171) in parent-dark, parent-light and guest-dark
  // alike), and the unknown-count fallback used to collapse tiles 2 and 3
  // onto the same blue, which cost the strip its three-tone read.
  //
  // The tone is an IDENTITY cue, not a verdict on the count: the numeral's
  // own state — live, stale or unknown — is carried by the numeral itself
  // and by the stale marker.
  return (
    <View style={{ flexDirection: "row", gap: KPI_BAND_GAP, marginTop: 12 }} testID="wall-stat-row">
      <StatTile
        testID="wall-stat-events"
        icon="📅"
        widgetId="events"
        label={eventsToday === 1 ? "Event" : "Events"}
        detail="Today"
        value={eventsToday === null ? "" : String(eventsToday)}
        pending={eventsToday === null}
        tone={eventsToday !== null && eventsToday > 0 ? "warning" : "accent"}
      />
      <StatTile
        testID="wall-stat-tasks"
        icon="✅"
        widgetId="tasks"
        label="Tasks"
        detail="Pending"
        value={openTasks === null ? "" : String(openTasks)}
        pending={openTasks === null}
        stale={openTasks !== null && openTasksStale}
        tone="success"
      />
      <StatTile
        testID="wall-stat-week"
        icon="🗓️"
        widgetId="week"
        label="Week"
        detail="Days planned"
        value={plannedDays === null ? "" : String(plannedDays)}
        pending={plannedDays === null}
        tone="accent"
      />
    </View>
  );
}

/**
 * "This Week" — port of the web's tail (page.tsx:1074): the week strip
 * plus a week-mode DayLine whose fill is the family's true position in the
 * week (Monday-index + day fraction ÷ 7), one marker per day boundary. The
 * strip navigates to /meals?day=, which is what makes it more than a
 * decoration — the same contract the web's relies on.
 *
 * The tail is the ONE card the wall owns end to end, so its identity badge
 * is painted the web's way: a SIBLING of the card, not a child of it. The
 * web's `.widget-card` is `overflow: visible`, so its 56px glass disc
 * straddles the card's corner and the card's 24px arc shorn it. A child of
 * the Material would be clipped square to the card's box and could never
 * break the edge — which is exactly what the bento cards' badges used to do.
 */

/**
 * The identity disc's seat, in the card's border box. The web's badge is
 * `-top-1 -left-1` — 4px out from the card's PADDING box, 3px out from its
 * BORDER box (WidgetCard.tsx:24). MEASURED on the reference: the tail card's
 * border is at x16 and its badge's rim at x12–13, its calendar ink at x19.
 */
const TAIL_BADGE_SEAT = -3;
/** The web's badge: a 56px glass disc (h-14 w-14). */
const TAIL_BADGE_DISC = 56;
/** The web's HomeWidgetIcon "lg": the 64px clay artwork (h-16 w-16). */
const TAIL_BADGE_ART = 64;
/**
 * The day chips (the web's DayStrip `compact`).
 *
 * MEASURED on the reference (reference/home/parent-dark.png): each chip is
 * a PORTRAIT PILL 55px wide and 85px tall, its label is 14px UPPERCASE with
 * 0.12em tracking, its date numeral is 30px, the seven chips hug the LEFT
 * (they end at x468 of a 1040px row) and there is NO planned-day dot. The
 * web's chip is `rounded-2xl` at the phone size; on the wall the 30px
 * numeral drives the width and the pill is fully rounded (the measured
 * corner arc is the chip's own half-width).
 */
const DAY_CHIP_W = 55;
const DAY_CHIP_H = 85;
/** The web's `gap-2` between the chips (the 1px borders make it read as 9). */
const DAY_CHIP_GAP = 8;
/** The label's tracking: the web's `tracking-[0.12em]` at its 14px size. */
const DAY_CHIP_TRACKING = 0.12 * 14;
/** The date numeral's tracking: the web's `.display-numeral` (-0.04em). */
const DAY_CHIP_DATE_TRACKING = -0.04 * 30;
/**
 * The header's title gutter. The web's SectionCard reserves `pl-[72px]` for
 * the badge that overhangs the corner, so the title starts 73px inside the
 * card's border box; the card's own 16px padding carries the rest.
 */
const TAIL_TITLE_GUTTER = 56;
/**
 * The header RULE runs the card's FULL width (the web's SectionCard draws it
 * on the header band, which is a direct child of the card), so the native's
 * header row pulls its own padding out to the card's edges.
 */
const TAIL_RULE_INSET = -16;
/**
 * The card's vertical rhythm, in the native's 190px tail budget.
 *
 * The web's tail card is 228px tall (the header band 79 + the gap 16 + the
 * chips 85 + the gap 22 + the rail 16 + the bottom 26) and the native's
 * budget is 190 (the wall's own reservation), so the native keeps the
 * reference's SHAPE — the 85px pill, the 16px header-to-chips air, the
 * 16px rail — and gives up the deep bottom padding. The chips' strip sits
 * where the reference's does relative to the rule.
 */
const TAIL_TOP_PAD = 12;
const TAIL_BOTTOM_PAD = 6;
const TAIL_CHIPS_GAP = 10;
const TAIL_RAIL_GAP = 6;

/** Week fraction (0–1) at `now`, recomputed every 30s — no transition, so
 *  reduceMotion needs no branch (the fill is a discrete tick, like DayLine). */
function useWeekFraction(): number {
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    // A re-render per half-minute is all the fill needs: it is a discrete
    // position, never a transition, so reduceMotion needs no branch.
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  const now = new Date();
  const dayFraction = (now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60) / 1440;
  const mondayIndex = (now.getDay() + 6) % 7;
  return (mondayIndex + dayFraction) / 7;
}

interface ThisWeekCardProps {
  onSelectDay?: (dayId: string) => void;
  /**
   * The web's tail puts its "More…" in the ACTION ROW below the card, and the
   * portrait wall shows no control on the card at all (critic round 3,
   * finding 7). The prop stays so the wall's call site is unchanged, but the
   * card does not wear the control: the wall's More… sheet is one dock cap
   * away, and a "More…" that only the wall's header knew about was a
   * second, differently-drawn navigation surface.
   */
  onOpenMore?: () => void;
}

export function ThisWeekCard({ onSelectDay, onOpenMore }: ThisWeekCardProps) {
  const { colors, theme, accentColor } = useTheme();
  const { weekCells } = useWallStats();
  const fraction = useWeekFraction();
  // The tail's tone (critic round 4, L1): the web's tail card wears emerald
  // (#10b981) — a TEAL, not the mint the native painted. The reference's
  // tail measures a blue-teal card interior (hue 206 against the mint's
  // 184) and a teal rail fill (24,136,107 against the mint's 59,160,99).
  // The app's ramp has no emerald-500, so the tone is the ramp's mint pulled
  // 45% toward cyan: the nearest legal token pair that reproduces the
  // reference's teal (rail ≈ 32,141,129; interior hue ≈ 203) in BOTH themes.
  const tone = mix(
    colors["color-accent-mint"] ?? accentColor,
    colors["color-accent-cyan"] ?? accentColor,
    45
  );
  const isTodayFill = accentDeepened(accentColor, 40);

  return (
    // The card's own box, so the badge can be seated ON its corner: the
    // wrapper is the card's border box and the badge hangs 3px outside it.
    <View style={{ position: "relative" }}>
      <Material
        tier="regular"
        tone={tone}
        style={{
          borderRadius: 20,
          paddingHorizontal: 16,
          paddingTop: TAIL_TOP_PAD,
          paddingBottom: TAIL_BOTTOM_PAD,
          height: THIS_WEEK_H,
        }}
        testID="wall-this-week"
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            borderBottomWidth: 1,
            borderBottomColor: colors["color-border"],
            paddingBottom: 6,
            // The rule spans the card's full width (the web's header band is
            // a direct child of the card); the title keeps the web's 72px
            // badge gutter inside it.
            marginHorizontal: TAIL_RULE_INSET,
            paddingLeft: TAIL_TITLE_GUTTER - TAIL_RULE_INSET,
          }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              accessibilityRole="header"
              style={{
                color: colors["color-text-primary"],
                // The web's wall card title is 18px/700 (the same level as
                // every other card on the wall) — the tail was the one card
                // wearing the app's 20sp title level.
                fontSize: 18,
                lineHeight: 26,
                fontWeight: "700",
              }}
            >
              This Week
            </Text>
            <Text
              numberOfLines={1}
              style={{
                color: colors["color-text-secondary"],
                fontSize: TYPOGRAPHY.label.fontSize,
                lineHeight: TYPOGRAPHY.label.lineHeight,
              }}
            >
              Meal and family rhythm at a glance
            </Text>
          </View>
        </View>

        {/* Day strip: a week-at-a-glance row of the web's portrait day pills
            (the web's DayStrip `compact`). Seven of them, hugging the left —
            the web's `flex snap-x` row, not a stretched grid — with the
            optional More… button right-aligned on the same 74dp row so the
            More sheet is reachable from the wall without adding vertical
            height. */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: TAIL_CHIPS_GAP }}>
          <View style={{ flexDirection: "row", gap: DAY_CHIP_GAP }} testID="wall-week-strip">
            {(weekCells ?? weekSkeletonFor(new Date())).map((cell: WallDayCell) => {
              const label = cell.label.toUpperCase();
              return (
                <Pressable
                  key={cell.label}
                  testID={`wall-week-${cell.label}`}
                  disabled={!onSelectDay}
                  accessibilityRole="button"
                  accessibilityLabel={`${label} ${cell.date}${cell.planned ? " · meals planned" : ""}`}
                  onPress={onSelectDay ? () => onSelectDay(cell.label) : undefined}
                  // The reference's pill is 55px wide — narrower than the
                  // app's 64dp tap floor — so the TOUCH target is widened to
                  // the floor without moving a pixel of the artwork.
                  hitSlop={{ left: 5, right: 5 }}
                  style={{
                    width: DAY_CHIP_W,
                    height: DAY_CHIP_H,
                    // A full pill: the measured chip's corner arc is its own
                    // half-WIDTH (27.5px), not half its height — a taller
                    // radius would draw an ellipse, not the web's stadium.
                    borderRadius: DAY_CHIP_W / 2,
                    alignItems: "center",
                    justifyContent: "flex-start",
                    paddingTop: 4,
                    gap: 8,
                    borderWidth: 1,
                    borderColor: cell.isToday ? isTodayFill : colors["color-border"],
                    backgroundColor: cell.isToday
                      ? isTodayFill
                      : mix(colors["color-surface-0"] ?? "", "transparent", 30),
                  }}
                >
                  <Text
                    style={{
                      color: cell.isToday ? colors["color-primary-foreground"] : colors["color-text-primary"],
                      fontSize: 14,
                      lineHeight: 20,
                      fontWeight: "600",
                      letterSpacing: DAY_CHIP_TRACKING,
                    }}
                  >
                    {label}
                  </Text>
                  <Text
                    style={{
                      color: cell.isToday ? colors["color-primary-foreground"] : colors["color-text-primary"],
                      // The web's DayStrip date is `font-bold display-numeral` —
                      // the BODY face at 30px, tabular, -0.04em. It is not the
                      // app's rounded numeral register (the KPI band's), and on
                      // the wall the difference reads: a chunky rounded "2" is
                      // not the reference's numeral.
                      fontSize: 30,
                      lineHeight: 34,
                      fontWeight: "700",
                      letterSpacing: DAY_CHIP_DATE_TRACKING,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {String(cell.date)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {onOpenMore ? <MoreButton onPress={onOpenMore} /> : null}
        </View>

        {/* Week-mode DayLine: fill = (mondayIndex + dayFraction)/7, one marker
            per day boundary — the web's markers prop verbatim. In WEEK mode
            the web's marker is a 1px VERTICAL TICK (h-[7px] w-px), not the
            day mode's 5px round dot. */}
        <View
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ height: 16, justifyContent: "center", marginTop: TAIL_RAIL_GAP }}
          testID="wall-week-dayline"
        >
          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              height: 1,
              borderRadius: 1,
              backgroundColor: mix(colors["color-text-primary"], "transparent", 14),
            }}
          />
          <View
            style={{
              position: "absolute",
              left: 0,
              width: `${Math.max(0, Math.min(1, fraction)) * 100}%`,
              height: 2,
              borderRadius: 1,
              backgroundColor: mix(tone, "transparent", 62),
            }}
          />
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <View
              key={i}
              style={{
                position: "absolute",
                left: `${(i / 7) * 100}%`,
                // The web's week-mode marker: a 7px TALL, 1px WIDE tick.
                width: 1,
                height: 7,
                backgroundColor: mix(tone, colors["color-text-primary"], 55),
                transform: [{ translateX: -0.5 }],
              }}
            />
          ))}
          <View
            style={{
              position: "absolute",
              left: `${Math.max(0, Math.min(1, fraction)) * 100}%`,
              width: 13,
              height: 13,
              borderRadius: 7,
              backgroundColor: mix(tone, "transparent", 18),
              alignItems: "center",
              justifyContent: "center",
              transform: [{ translateX: -6.5 }],
            }}
          >
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: tone }} />
          </View>
        </View>
      </Material>

      {/* The identity badge — a SIBLING of the card, so it paints OVER the
          card's edge exactly as the web's does: a 56px glass disc with the
          64px clay calendar at its top-left, both straddling the corner. */}
      <View
        testID="wall-week-icon-disc"
        style={{
          position: "absolute",
          top: TAIL_BADGE_SEAT,
          left: TAIL_BADGE_SEAT,
          width: TAIL_BADGE_ART,
          height: TAIL_BADGE_ART,
          zIndex: 6,
        }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
      >
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: TAIL_BADGE_DISC,
            height: TAIL_BADGE_DISC,
            borderRadius: TAIL_BADGE_DISC / 2,
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
          {widgetIconVariantFor("week") ? (
            <HomeWidgetIcon variant={widgetIconVariantFor("week")!} size={TAIL_BADGE_ART} title="This Week" />
          ) : (
            <Text style={{ fontSize: 30 }}>🗓️</Text>
          )}
        </View>
      </View>
    </View>
  );
}
