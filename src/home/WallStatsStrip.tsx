import React from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { TYPOGRAPHY } from "../theme/tokens";
import { accentDeepened, accentInk, mix } from "../theme/mix";
import { Material } from "../theme/Material";
import { MoreButton } from "../nav/CapsuleDock";
import { HomeWidgetIcon, widgetIconVariantFor } from "../ui/HomeWidgetIcon";
import { AnimatedEmoji } from "../ui/AnimatedEmoji";
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
 * answers — the tile wears the web's own unknown-value GLYPH (a muted em
 * dash) in the numeral slot, never a fabricated 0 and never a blank that
 * could be mistaken for a rendered value.
 */

type ToneKey = "accent" | "success" | "warning" | "danger";

/**
 * KPI band height. The web's wide StatTile measures 75px at the wall's
 * 1080px viewport (1px border + 12px padding + a 28px icon row + the second
 * 16px label row). The native's 14sp label floor costs 8px more than the
 * web's 12px label, so 78 keeps the reference's short, wide pill proportion
 * instead of the old 92px card — and it puts the band back on the wall
 * header's own budget (78 tile + 12 margin = the 90 the header reserves).
 * A FIXED height also keeps the band from reflowing as answers land.
 */
const KPI_TILE_H = 78;
/** The web's StatTile `gap-x-3` — the gap between the icon and the numeral. */
const KPI_ICON_GAP = 12;
/** The web's `grid gap-3 sm:gap-4` on the KPI band — 16px at the wall width. */
const KPI_BAND_GAP = 16;
/** The web's icon chip: `h-7 w-7 rounded-xl` around a `size="sm"` (32px)
 *  HomeWidgetIcon, whose 22/48 glow halo reads as the reference's round
 *  tinted disc. */
const KPI_ICON_PX = 32;
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
  icon: string;
  widgetId: string;
  tone: ToneKey;
  testID: string;
}

function StatTile({ label, detail, value, pending, icon, widgetId, tone, testID }: TileProps) {
  const { colors, accentColor } = useTheme();
  const toneColor = colors[toneToken(tone)] ?? accentColor;
  const ink = colors[toneInkToken(tone)] ?? mix(toneColor, colors["color-text-primary"], 45);
  const variant = widgetIconVariantFor(widgetId);

  return (
    <Material
      tier="regular"
      tone={toneColor}
      style={{
        flex: 1,
        height: KPI_TILE_H,
        borderRadius: 24,
        paddingHorizontal: 12,
        paddingVertical: 10,
        justifyContent: "center",
      }}
      testID={testID}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: KPI_ICON_GAP }}>
          {/* The icon is the web's clay HomeWidgetIcon at `size="sm"` — the
              same artwork, and the same round glow halo behind it. The web
              seats it in a `rounded-xl bg-white/7%` chip; on the wall that
              chip is invisible, so the native paints the artwork on the
              card instead of tinting a square behind it (which read as a
              flat sticker, not a disc). */}
          <View style={{ width: KPI_ICON_PX, height: KPI_ICON_PX, alignItems: "center", justifyContent: "center" }}>
            {variant ? (
              <HomeWidgetIcon variant={variant} size="sm" />
            ) : (
              <AnimatedEmoji emoji={icon} size={22} />
            )}
          </View>
          {pending ? (
            /* The numeral slot while its read is unanswered: the WEB's own
               unknown-value glyph — a muted em dash, exactly the "—" the
               reference's guest capture shows on the Week tile. It is
               deliberately SUBORDINATE to a real numeral (secondary ink, not
               primary) so it can never be read as a count, and it is a GLYPH,
               not a slab, so the tile never reads as a hole. Secondary ink
               clears AA on the tile's own wash in both themes (7.5:1 dark /
               6.1:1 light), so the placeholder never drops the contrast
               floor. Static, too: a pulsing dash would flicker the floor it
               is supposed to sit under. */
            <Text
              testID={`${testID}-pending`}
              accessibilityLabel="Not known yet"
              style={{
                color: colors["color-text-secondary"],
                fontSize: TYPOGRAPHY.stat.fontSize,
                lineHeight: TYPOGRAPHY.stat.fontSize + 4,
                fontWeight: "800",
              }}
            >
              {"—"}
            </Text>
          ) : (
            <Text
              style={{
                color: colors["color-text-primary"],
                fontSize: TYPOGRAPHY.stat.fontSize,
                lineHeight: TYPOGRAPHY.stat.fontSize + 4,
                fontWeight: "800",
                fontVariant: ["tabular-nums"],
              }}
            >
              {value}
            </Text>
          )}
        </View>
        {/* The label block hugs the tile's right edge (the web's
            `md:col-start-3 md:justify-self-end md:text-right`), label over
            detail, both in the tone ink. */}
        <View style={{ alignItems: "flex-end", justifyContent: "center", flexShrink: 1 }}>
          <Text
            style={{ color: ink, fontSize: TYPOGRAPHY.label.fontSize, lineHeight: TYPOGRAPHY.label.lineHeight, fontWeight: "600" }}
            numberOfLines={1}
          >
            {label}
          </Text>
          <Text
            style={{ color: ink, fontSize: TYPOGRAPHY.label.fontSize, lineHeight: TYPOGRAPHY.label.lineHeight }}
            numberOfLines={1}
          >
            {detail}
          </Text>
        </View>
      </View>
    </Material>
  );
}


export function WallStatStrip() {
  const { eventsToday, openTasks, plannedDays } = useWallStats();

  // Tone parity: a non-zero count is the interesting state, not an error —
  // events amber, tasks rose, all-clear mint. No progress hairline (the web
  // deleted it: a percentage under "Days planned" reads as a share of events).
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
        tone={openTasks !== null && openTasks > 0 ? "danger" : "success"}
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
 * "This Week" — port of the web's tail (page.tsx:1070-1076): the week strip
 * plus a week-mode DayLine whose fill is the family's true position in the
 * week (Monday-index + day fraction ÷ 7), one marker per day boundary. The
 * strip navigates to /meals?day=, which is what makes it more than a
 * decoration — the same contract the web's relies on.
 */

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
  onOpenMore?: () => void;
}

export function ThisWeekCard({ onSelectDay, onOpenMore }: ThisWeekCardProps) {
  const { colors, accentColor } = useTheme();
  const { weekCells } = useWallStats();
  const fraction = useWeekFraction();
  const tone = colors["color-accent-mint"] ?? accentColor;
  const isTodayFill = accentDeepened(accentColor, 40);
  // The web declares --color-accent-sage for a planned day (page.tsx:571).
  // Raw sage measures 2.61:1 on the card's light wash — under the 3:1
  // non-text floor — so the dot wears the kit's accentInk recipe (accent 55%
  // toward body ink), the same AA-on-wash treatment Avatar/Chip/StatTile use.
  const sage = accentInk(colors["color-accent-sage"] ?? tone, colors["color-text-primary"]);

  return (
    <Material
      tier="regular"
      tone={tone}
      style={{ borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, gap: 6, height: THIS_WEEK_H }}
      testID="wall-this-week"
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: colors["color-border"], paddingBottom: 6 }}>
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: mix(tone, "transparent", 20),
          }}
        >
          {widgetIconVariantFor("week") ? (
            <HomeWidgetIcon variant={widgetIconVariantFor("week")!} size={20} title="This Week" />
          ) : (
            <Text style={{ fontSize: 16 }}>🗓️</Text>
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            accessibilityRole="header"
            style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.title.fontSize, fontWeight: "700" }}
          >
            This Week
          </Text>
          <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }}>
            Meal and family rhythm at a glance
          </Text>
        </View>
        {onOpenMore ? <MoreButton onPress={onOpenMore} /> : null}
      </View>

      {/* Day strip: a week-at-a-glance row; a planned day carries the sage dot. */}
      <View style={{ flexDirection: "row", gap: 6 }} testID="wall-week-strip">
        {(weekCells ?? weekSkeletonFor(new Date())).map((cell: WallDayCell) => (
          <Pressable
            key={cell.label}
            testID={`wall-week-${cell.label}`}
            disabled={!onSelectDay}
            accessibilityRole="button"
            accessibilityLabel={`${cell.label} ${cell.date}${cell.planned ? " · meals planned" : ""}`}
            onPress={onSelectDay ? () => onSelectDay(cell.label) : undefined}
            style={{
              flex: 1,
              alignItems: "center",
              gap: 2,
              paddingVertical: 5,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: cell.isToday ? isTodayFill : colors["color-border"],
              backgroundColor: cell.isToday ? isTodayFill : "transparent",
            }}
          >
            <Text
              style={{
                color: cell.isToday ? colors["color-primary-foreground"] : colors["color-text-secondary"],
                fontSize: TYPOGRAPHY.label.fontSize,
                fontWeight: "600",
                letterSpacing: 0,
              }}
            >
              {cell.label}
            </Text>
            <Text
              style={{
                color: cell.isToday ? colors["color-primary-foreground"] : colors["color-text-primary"],
                fontSize: TYPOGRAPHY.body.fontSize,
                fontWeight: "700",
                fontVariant: ["tabular-nums"],
              }}
            >
              {String(cell.date)}
            </Text>
            <View
              style={{
                width: 5,
                height: 5,
                borderRadius: 3,
                backgroundColor: cell.planned ? sage : "transparent",
              }}
            />
          </Pressable>
        ))}
      </View>

      {/* Week-mode DayLine: fill = (mondayIndex + dayFraction)/7, one marker
          per day boundary — the web's markers prop verbatim. */}
      <View
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ height: 16, justifyContent: "center" }}
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
              width: 5,
              height: 5,
              borderRadius: 3,
              backgroundColor: mix(colors["color-text-secondary"], "transparent", 40),
              transform: [{ translateX: -2.5 }],
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
          <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: tone }} />
        </View>
      </View>
    </Material>
  );
}
