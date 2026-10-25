// Home-native/src/weather/WidgetHero.tsx
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent, type TextStyle } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../theme/ThemeProvider";
import { mix } from "../theme/mix";
import { RADII, TYPOGRAPHY } from "../theme/tokens";
import { ListRow } from "../ui/ListRow";
import { Modal } from "../ui/Modal";
import { SoftButton } from "../ui/SoftButton";
import { READ_COPY_STALE, useWidgetData, type ReadFailure } from "../home/widgets/data";
import { WidgetFrame } from "../home/widgets/WidgetFrame";
import type { WallSpan } from "../home/widgets";
import { AmbientBob } from "./useAmbient";
import {
  ChevronGlyph,
  ConditionIcon,
  CREATURE_SIZE,
  GlassChip,
  MapPinGlyph,
  MonsterDigit,
  PosterScrim,
  sceneFor,
  useSceneSky,
  WeatherScene,
} from "./art";
import { moonPhase } from "./astro";
import { conditionCode } from "./conditions";
import { fetchWeather, type WeatherSnapshot } from "./data";
import { WASH_TOKENS, WX_LABEL, type ConditionCode, type WashKey } from "./language";

/** Web parity: "Updated just now" / "Updated Nm ago" / clock past an hour. */
function relativeUpdated(ms: number, now: Date = new Date()): string {
  const mins = Math.max(0, Math.round((now.getTime() - ms) / 60_000));
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/**
 * The /weather PAGE hero is a different surface from the wall card: the web
 * paints it with the poster skin (a diagonal gradient on the season wash, or
 * the night skin after dark), while the wall card paints the flat per-scene
 * SKY field (see useSceneSky). Two surfaces, two skies — as the web has them.
 */
function posterSkyWash(code: ConditionCode, isDay: boolean): WashKey {
  if (!isDay) return "night";
  if (code === "storm") return "storm";
  if (code === "snow") return "snow";
  if (code === "clear" || code === "partly") return "clear";
  return "day";
}

/**
 * The poster-page field (web WeatherSkins posterSkyGradient): a diagonal
 * gradient on the season wash, or the night skin after dark. The wall card
 * paints the flat per-scene SKY field instead (see useSceneSky).
 */
function posterSkyColors(colors: Record<string, string | undefined>, wash: WashKey): [string, string] {
  const [top, bottom] = WASH_TOKENS[wash];
  const topColor = colors[top] ?? colors["color-surface-1"] ?? "";
  const bottomColor = colors[bottom] ?? colors["color-surface-2"] ?? "";
  return [topColor, bottomColor];
}

/**
 * The web titles the condition word ("Partly Cloudy"); the native carries the
 * API's sentence case ("Partly cloudy"). Only the sky-state noun is lifted —
 * "Light rain" stays "Light rain".
 */
const CONDITION_TITLE_WORDS = new Set(["cloudy", "showers"]);

function titleCaseCondition(text: string): string {
  return text
    .split(" ")
    .map((word, i) => {
      const lower = word.toLowerCase();
      if (i > 0 && !CONDITION_TITLE_WORDS.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

export interface WeatherPosterProps {
  size: "cell" | "full";
  data: WeatherSnapshot;
  span?: WallSpan;
}

// ─── The wall card's type ramp ────────────────────────────────────────
//
// Measured off the 1080×1920 reference capture (ink boxes, not guesses):
//
//   place chip    "Holland, MI"  ink 83×15  → 16sp / 500
//   details chip  "Details"      ink 46×11  → 14sp / 600
//   condition     "Clear sky"    cap ≈12    → 16sp / 500
//   H/L · outlook · footer        cap ≈11    → 14sp / 500 (the 14sp floor)
//
// The web renders these at 14/12/15/12px in Geist; the native's own stack is
// taller-capped, so the native's sizes land a step lower to land on the
// reference's measured ink. The gallery poster is the same ramp at 1.6×.
const CELL_TYPE: Record<"place" | "details" | "condition" | "meta", TextStyle> = {
  place: { fontSize: 16, fontWeight: "500" },
  details: { fontSize: 14, fontWeight: "600" },
  condition: { fontSize: 16, fontWeight: "500" },
  meta: { fontSize: 14, fontWeight: "500" },
};

const ROOMY_CELL_TYPE: Record<"place" | "details" | "condition" | "meta", TextStyle> = {
  place: { fontSize: 18, fontWeight: "500" },
  details: { fontSize: 18, fontWeight: "600" },
  condition: { fontSize: 20, fontWeight: "500" },
  meta: { fontSize: 16, fontWeight: "500" },
};

const FULL_TYPE: Record<"place" | "details" | "condition" | "meta", TextStyle> = {
  place: { fontSize: 26, fontWeight: "500" },
  details: { fontSize: 22, fontWeight: "600" },
  condition: { fontSize: 26, fontWeight: "500" },
  meta: { fontSize: 22, fontWeight: "500" },
};

/** The chips' row height on the wall card — the Details pill's 44px box. */
const CELL_CHIPS_H = 44;
/** The reference card's hero-icon box (the web's wall `124px` container). */
const CELL_ART_MAX = 124;
/** The digits' box — the art row never shrinks past the digits. */
const CELL_ART_MIN = 96;
const ROOMY_CELL_ART_MAX = 160;
const ROOMY_CELL_ART_MIN = 120;
const ROOMY_CELL_CHIPS_H = 52;
/** The air the text block keeps above the footer on a short cell. */
const CELL_SLACK = 8;

/**
 * The wall card's vertical rhythm.
 *
 * The reference card is 330 tall (pt-4 → pb-4) and its offsets are: chips
 * +16, art row +68, condition ink +197, outlook +239, footer +291 — the
 * footer sitting ~30 above the card's bottom edge.
 *
 * The CELL's height belongs to the wall shell, not to this widget, so the
 * content adapts instead of clipping: on a short cell the art row gives up
 * its slack first (the reference's 124 icon box → the digits' 96 floor) and
 * the text block keeps the reference's ramp. The footer is always anchored
 * to the bottom with the reference's air under it, so the card's own edge
 * can never cut the last line.
 */
export function cellRhythm(height: number, spacious = false) {
  const roomy = spacious || height >= 300;
  const top = spacious ? 20 : roomy ? 16 : 14;
  const bottom = spacious ? 28 : 26;
  const gapArt = spacious ? 14 : roomy ? 8 : 6;
  const gapCond = spacious ? 6 : roomy ? 4 : 2;
  const gapLine = spacious ? 6 : roomy ? 4 : 1;
  const line = spacious ? 24 : roomy ? 18 : 16;
  const chipsH = spacious ? ROOMY_CELL_CHIPS_H : CELL_CHIPS_H;
  const artMax = spacious ? ROOMY_CELL_ART_MAX : CELL_ART_MAX;
  const artMin = spacious ? ROOMY_CELL_ART_MIN : CELL_ART_MIN;
  const fixed =
    top + chipsH + gapArt + gapCond + line + gapLine + line + gapLine + line + line + bottom;
  const art = Math.max(artMin, Math.min(artMax, height - fixed - CELL_SLACK));
  return { top, bottom, gapArt, gapCond, gapLine, line, chipsH, art };
}

/**
 * The Monster hero poster — a SCENE, not a tint: the sky wash, the night
 * stars and moon, the soft cloud puffs, the precipitation, a radial scrim and
 * a glass sheen, with the monster digits and the condition creature floating
 * above it.
 *
 * Layout (web parity with Home-ai WeatherWidget):
 *   Row 1: [📍 place glass pill]   [Details › glass pill]
 *   Row 2: [Monster digits]         [Condition creature]   ← side-by-side
 *   Row 3: condition / H:L · feels  (centered)
 *   Row 4: outlook                  (centered)
 *   Row 5: Updated …               (right-aligned footer)
 *
 * Digit heights: cell=96dp, full=220dp.
 * Creature size: cell=124dp (the web's wall scale), full=180dp.
 */
export function WeatherPoster({ size, data, span = 1 }: WeatherPosterProps) {
  const { colors, boost } = useTheme();
  const router = useRouter();
  const code = conditionCode(data.code ?? undefined, data.isDay);
  // The clock picks the sky, the condition picks the glyph (web parity:
  // wmoToScene collapses the clear/cloudy skies to night after dark).
  const scene = sceneFor(code, data.isDay);
  const [flatTop, flatBottom] = useSceneSky(scene);
  const [posterTop, posterBottom] = posterSkyColors(colors, posterSkyWash(code, data.isDay));
  const isPoster = size === "full";
  const spacious = !isPoster && span === 2;
  const skyTop = isPoster ? posterTop : flatTop;
  const skyBottom = isPoster ? posterBottom : flatBottom;
  // The ink rides the field: the wall card's flat washes carry the web's
  // INK table ink — slate-800, a COOL dark — while the poster page carries
  // white on its night skin, and the storm field is the one dark wall wash,
  // so it flips to white too.
  const darkField = isPoster ? !data.isDay : scene === "storm";
  const glint = colors["color-monster-glint"] ?? colors["color-text-primary"];
  // The web's slate-800 (#1E293B) ink, composed from the monster palette:
  // the monster's own ink blue and its warm day ink, lifted a hair. The
  // reference capture measures exactly this ink on the card's text.
  const slateInk = mix(
    glint,
    mix(colors["color-monster-ink-blue"], colors["color-monster-ink-day"], 60),
    3
  );
  const washInk = darkField
    ? colors["color-monster-glint"] ?? colors["color-text-primary"]
    : slateInk;
  // The web's inkSoft: slate-800 at 0.92 (0.9 in boost) — tuned so the H/L,
  // outlook and footer lines clear 4.5:1 on the worst painted stop of every
  // light scene family (the web's WeatherWidget.tsx:970).
  const soft = mix(washInk, "transparent", boost ? 90 : 92);
  const pinInk = colors["color-accent-coral"] ?? colors["color-accent-rose"];
  const digitsHeight = size === "full" ? 220 : spacious ? 128 : 96;
  const iconSize = size === "full" ? 180 : spacious ? 160 : CREATURE_SIZE;
  const phase = moonPhase(data.updatedAt).phase;
  const type = isPoster ? FULL_TYPE : spacious ? ROOMY_CELL_TYPE : CELL_TYPE;

  // The card's own box — the wall shell owns the cell, so the card measures
  // itself and the scene (the night moon) is placed from that box.
  const [cell, setCell] = useState({ w: 0, h: 0 });
  const onCellLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setCell((c) => (c.w === width && c.h === height ? c : { w: width, h: height }));
  };
  const rhythm = cellRhythm(cell.h || (spacious ? 574 : 300), spacious);
  const padH = isPoster ? 28 : spacious ? 24 : 20;
  const padT = isPoster ? 28 : rhythm.top;
  const padB = isPoster ? 28 : rhythm.bottom;
  const gap = isPoster ? 12 : 0;
  const chipsH = isPoster ? undefined : rhythm.chipsH;
  // The glass sheen over the whole card (web WeatherWidget.tsx:1166).
  const sheenFill: [string, string, string] = [
    mix(glint, "transparent", 15),
    mix(glint, "transparent", 0),
    mix(glint, "transparent", 5),
  ];

  const temperature =
    data.tempF == null ? (
      <Text testID="wx-temp-empty" style={{ fontSize: digitsHeight, lineHeight: digitsHeight * 1.05, color: washInk, fontWeight: "700" }}>
        —
      </Text>
    ) : (
      <View style={{ flexDirection: "row", alignItems: "flex-start" }} testID="wx-temp-digits">
        {String(Math.round(data.tempF)).split("").map((d, i) => (
          <MonsterDigit key={`${d}-${i}`} digit={d} height={digitsHeight} />
        ))}
        <Text style={{ color: soft, fontSize: digitsHeight * 0.26, lineHeight: digitsHeight * 0.3, fontWeight: "300", marginLeft: 2, marginTop: digitsHeight * 0.07 }}>
          °
        </Text>
      </View>
    );

  const hlLine =
    data.highF != null || data.lowF != null
      ? `${data.highF != null ? `H:${data.highF}°` : ""}${data.lowF != null ? ` L:${data.lowF}°` : ""}`
      : null;
  const feels =
    data.feelsLikeF != null && data.tempF != null && Math.abs(data.feelsLikeF - data.tempF) >= 2
      ? ` · Feels like ${data.feelsLikeF}°`
      : "";

  const poster = (
    <View
      testID="wx-poster-frame"
      onLayout={isPoster ? undefined : onCellLayout}
      style={{
        flex: 1,
        borderRadius: RADII.xl,
        overflow: "hidden",
        backgroundColor: skyTop,
      }}
    >
      {/* 1 — the sky: the wall card's flat per-scene wash falls straight down
          (web bg-gradient-to-b); the poster page's skin runs corner to corner. */}
      <LinearGradient
        testID="wx-poster"
        colors={[skyTop, skyBottom]}
        start={{ x: 0, y: 0 }}
        end={isPoster ? { x: 1, y: 1 } : { x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* 2 — the scene: stars, moon character, cloud puffs, precipitation */}
      <WeatherScene
        code={code}
        isDay={data.isDay}
        precipPct={data.precipTodayPct}
        moonPhase={phase}
        cardW={cell.w}
        cardH={cell.h}
      />

      {/* 3 — the scrim: a soft bloom that lifts the hero off the sky */}
      <PosterScrim scene={scene} />

      {/* 4 — the glass sheen: light glancing off the card surface */}
      <LinearGradient
        colors={sheenFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* 5 — the content. The scene layers are absolutely positioned, so the
          content needs its own stacking rung (the web uses z-20 for exactly
          this: the glass chips sit OVER the moon character, not under it). */}
      <View style={{ flex: 1, paddingHorizontal: padH, paddingTop: padT, paddingBottom: padB, gap, zIndex: 20 }}>
        {/* Row 1 — place pill (left) + details pill (right). Both are the web's
            ONE glass recipe: the 135° white gradient, the specular top-half
            sheen and the white hairline — so the pane LIFTS the sky instead
            of cutting a hole in it. */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            height: chipsH,
          }}
        >
          <GlassChip
            testID="wx-place-pill"
            night={scene === "storm"}
            boost={boost}
            backdropTop={skyTop}
            backdropBottom={skyBottom}
            style={{ borderRadius: RADII.full }}
            contentStyle={{
              gap: 6,
              paddingHorizontal: isPoster ? 14 : spacious ? 14 : 12,
              paddingVertical: isPoster ? 9 : spacious ? 6 : 4,
            }}
          >
            <MapPinGlyph color={pinInk} size={isPoster ? 20 : spacious ? 16 : 14} />
            <Text
              numberOfLines={1}
              style={{ color: washInk, ...type.place, lineHeight: isPoster ? 32 : spacious ? 24 : 20 }}
            >
              {data.place}
            </Text>
          </GlassChip>
          {size === "cell" ? (
            <GlassChip
              testID="wx-details-pill"
              night={scene === "storm"}
              boost={boost}
              backdropTop={skyTop}
              backdropBottom={skyBottom}
              style={{ borderRadius: RADII.full }}
              contentStyle={{
                gap: 4,
                justifyContent: "center",
                minHeight: rhythm.chipsH,
                paddingHorizontal: 12,
              }}
            >
              <Text style={{ color: washInk, ...type.details }}>Details</Text>
              <ChevronGlyph color={washInk} size={14} />
            </GlassChip>
          ) : null}
        </View>

        {/* Row 2 — side-by-side: Monster digits (left) + the creature (right).
            The web's hero icon lives in a 124px box; the native keeps that box
            so the digits sit in the same place on the card, and the box gives
            up its slack first when the cell is short. */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginTop: isPoster ? 2 : rhythm.gapArt,
            height: isPoster ? undefined : rhythm.art,
          }}
        >
          <View style={{ flexShrink: 1 }}>{temperature}</View>
          <View
            style={{
              width: isPoster ? undefined : rhythm.art,
              height: isPoster ? undefined : rhythm.art,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <AmbientBob>
              <ConditionIcon code={code} size={iconSize} />
            </AmbientBob>
          </View>
        </View>

        {/* Row 3 — condition + H/L + feels + outlook (centered) */}
        <View style={{ alignItems: "center", marginTop: isPoster ? 2 : rhythm.gapCond }}>
          <Text
            testID="wx-condition"
            style={{
              color: washInk,
              ...type.condition,
              lineHeight: isPoster ? 32 : rhythm.line,
            }}
          >
            {titleCaseCondition(data.condition)}
          </Text>
          {hlLine ? (
            <Text
              style={{
                color: soft,
                ...type.meta,
                lineHeight: isPoster ? 28 : rhythm.line,
                marginTop: isPoster ? 2 : rhythm.gapLine,
              }}
            >
              {hlLine}{feels}
            </Text>
          ) : null}
          {data.outlook ? (
            <Text
              testID="wx-outlook"
              style={{
                color: soft,
                ...type.meta,
                lineHeight: isPoster ? 28 : rhythm.line,
                marginTop: isPoster ? 2 : rhythm.gapLine,
                textAlign: "center",
              }}
            >
              {data.outlook}
            </Text>
          ) : null}
        </View>

        {/* Row 4 — Updated footer (right-aligned, pushed to the card's bottom
            edge the way the web's `mt-auto` footer sits). The card's own
            padding keeps the reference's ~30 of air under the last line, so
            the card's edge can never cut the footer's descenders. */}
        <View style={{ alignItems: "flex-end", marginTop: "auto" }}>
          <Text
            testID="wx-updated"
            style={{ color: soft, ...type.meta, lineHeight: isPoster ? 28 : rhythm.line }}
          >
            Updated {relativeUpdated(data.updatedAt)}
          </Text>
        </View>
      </View>
    </View>
  );

  if (size === "cell") {
    return (
      <Pressable
        testID="wx-poster-press"
        onPress={() => router.push("/weather")}
        accessibilityRole="button"
        accessibilityLabel="Weather"
        accessibilityHint="Open the full weather gallery"
        style={{ flex: 1 }}
      >
        {poster}
      </Pressable>
    );
  }
  return (
    <View style={{ height: 620, borderRadius: RADII.xl, overflow: "hidden" }}>
      {poster}
    </View>
  );
}

/**
 * Wall cell — one fetch on mount + sync pulses, guest-visible, honest states.
 * When data is available, renders WeatherPoster directly (full-bleed, no
 * WidgetFrame header disc or marginTop gap). WidgetFrame is kept only for
 * loading/error states when data === null.
 */
export function WeatherHeroCell({ span = 1 }: { span?: WallSpan }) {
  const { colors } = useTheme();
  const { status, data, failure, stale, retry } = useWidgetData<WeatherSnapshot>(fetchWeather, {
    guestVisible: true, // Open-Meteo is public; the guest wall sees weather (reference parity)
  });

  // Direct render when data is available — full-bleed, no header disc gap
  if (data) {
    return (
      <View style={{ flex: 1 }}>
        <WeatherPoster size="cell" data={data} span={span} />
        {stale ? (
          <Text testID="wx-stale" style={{ color: colors["color-accent-ink-amber"] ?? colors["color-accent-amber"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
            {READ_COPY_STALE}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <WidgetFrame
      id="weather"
      icon="⛅"
      title="Weather"
      // The reference poster is full-bleed: no title band (identity lives in
      // the poster's place line). The frame keeps an accessible header label.
      header={<View testID="weather-header" accessibilityRole="header" accessibilityLabel="Weather" style={{ height: 0, overflow: "hidden" }} />}
      status={status}
      failure={failure}
      hasData={false}
      stale={false}
      onRetry={retry}
    >
      {null}
    </WidgetFrame>
  );
}

/** Details modal — stat rows + the 5-day strip off the SAME snapshot. */
function StatRow({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 56, paddingHorizontal: 14, borderRadius: RADII.md, borderWidth: 1, borderColor: colors["color-border"] ?? "transparent", backgroundColor: colors["color-surface-1"] }}>
      <Text style={[WX_LABEL, { color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }]}>{label}</Text>
      <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>{value}</Text>
    </View>
  );
}

export function WeatherDetailsModal({ visible, onClose, data }: { visible: boolean; onClose: () => void; data: WeatherSnapshot }) {
  const { colors } = useTheme();
  const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  const windLine =
    data.windMph != null
      ? `${data.windMph} mph${data.windDirDeg != null ? ` ${COMPASS[Math.round((data.windDirDeg % 360) / 22.5) % 16]}` : ""}`
      : "—";
  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title="Weather details"
      description={`${data.place} · ${titleCaseCondition(data.condition)}`}
      testID="wx-details-modal"
      footer={<SoftButton size="sm" variant="secondary" onPress={onClose} testID="wx-details-close">Close</SoftButton>}
    >
      <View style={{ gap: 8 }}>
        <StatRow label="Feels like" value={data.feelsLikeF != null ? `${data.feelsLikeF}°` : "—"} />
        <StatRow label="Humidity" value={data.humidityPct != null ? `${data.humidityPct}%` : "—"} />
        <StatRow label="Wind" value={windLine} />
        <StatRow label="UV index" value={data.uvIndex != null ? String(Math.round(data.uvIndex * 10) / 10) : "—"} />
        <StatRow label="Rain chance" value={data.precipTodayPct != null ? `${data.precipTodayPct}%` : "—"} />
        {data.days.length > 0 ? (
          <>
            <Text style={[WX_LABEL, { color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, marginTop: 8 }]}>5-Day Forecast</Text>
            {data.days.map((d) => (
              <ListRow
                key={d.key}
                leading={<ConditionIcon code={conditionCode(d.code ?? undefined, true)} size={44} />}
                title={d.label}
                subtitle={`H:${d.highF ?? "—"}° L:${d.lowF ?? "—"}°`}
              />
            ))}
          </>
        ) : null}
      </View>
    </Modal>
  );
}

export interface GalleryHeroProps {
  status: "loading" | "ready" | "error";
  data: WeatherSnapshot | null;
  failure: ReadFailure | null;
  stale: boolean;
  retry: () => void;
}

/** Gallery hero — full-size poster + the Details affordance + the shared modal. */
export function GalleryHero({ status, data, failure, stale, retry }: GalleryHeroProps) {
  const { colors } = useTheme();
  const [detailsOpen, setDetailsOpen] = useState(false);
  if (status === "loading" && !data) {
    return (
      <View testID="wx-gallery-hero-loading" style={{ height: 620, borderRadius: RADII.xl, backgroundColor: colors["color-surface-1"] }}>
        <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.body.fontSize, padding: 28 }}>Loading weather…</Text>
      </View>
    );
  }
  if (!data) {
    return (
      <View
        testID="wx-gallery-hero-error"
        style={{ height: 620, borderRadius: RADII.xl, borderWidth: 1, borderColor: colors["color-border"] ?? "transparent", padding: 28, justifyContent: "center", gap: 12 }}
      >
        <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.title.fontSize, fontWeight: "700" }}>Weather</Text>
        <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.body.fontSize }}>{"Couldn't load this right now."}</Text>
        <SoftButton size="sm" variant="secondary" onPress={retry} testID="wx-gallery-hero-retry">Try again</SoftButton>
      </View>
    );
  }
  return (
    <View>
      <WeatherPoster size="full" data={data} />
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
        {stale ? (
          <Text style={{ color: colors["color-accent-ink-amber"] ?? colors["color-accent-amber"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
            {READ_COPY_STALE}
          </Text>
        ) : (
          <View />
        )}
        <Pressable
          testID="wx-details"
          onPress={() => setDetailsOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Open weather details"
          accessibilityHint="Feels like, humidity, wind, UV and the five day forecast"
          style={{ minHeight: 64, minWidth: 64, borderRadius: 999, paddingHorizontal: 20, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors["color-border"] ?? "transparent" }}
        >
          <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>Details ›</Text>
        </Pressable>
      </View>
      <WeatherDetailsModal visible={detailsOpen} onClose={() => setDetailsOpen(false)} data={data} />
    </View>
  );
}
