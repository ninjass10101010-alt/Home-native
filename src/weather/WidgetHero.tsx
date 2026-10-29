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
import { AmbientBob, AmbientDigitPop } from "./useAmbient";
import {
  ChevronGlyph,
  ConditionIcon,
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
  const [scrubIdx, setScrubIdx] = useState(0);
  const isPoster = size === "full";
  const spacious = !isPoster && span === 2;
  const activeHour = isPoster && scrubIdx > 0 && data.hours[scrubIdx] ? data.hours[scrubIdx] : null;
  const activeIsDay = activeHour ? activeHour.isDay : data.isDay;
  const activeTempF = activeHour ? activeHour.tempF : data.tempF;
  const code = conditionCode(data.code ?? undefined, activeIsDay);
  // The clock picks the sky, the condition picks the glyph (web parity:
  // wmoToScene collapses the clear/cloudy skies to night after dark).
  const scene = sceneFor(code, activeIsDay);
  const [flatTop, flatBottom] = useSceneSky(scene);
  const [posterTop, posterBottom] = posterSkyColors(colors, posterSkyWash(code, activeIsDay));
  const skyTop = isPoster ? posterTop : flatTop;
  const skyBottom = isPoster ? posterBottom : flatBottom;
  // The ink rides the field: saturated night electric blue and storm washes carry crisp white;
  // daytime fields carry slate-800.
  const darkField = !activeIsDay || scene === "storm" || scene === "night";
  const glint = colors["color-monster-glint"] ?? colors["color-text-primary"];
  const slateInk = mix(
    glint,
    mix(colors["color-monster-ink-blue"], colors["color-monster-ink-day"], 60),
    3
  );
  const washInk = darkField
    ? colors["color-monster-glint"] ?? colors["color-text-primary"]
    : slateInk;
  const soft = mix(washInk, "transparent", boost ? 90 : 92);
  const pinInk = colors["color-accent-coral"] ?? colors["color-accent-rose"];
  const digitsHeight = size === "full" ? 220 : spacious ? 128 : 96;
  const iconSize = size === "full" ? 180 : spacious ? 160 : 124;
  const phase = moonPhase(data.updatedAt).phase;
  const type = isPoster ? FULL_TYPE : spacious ? ROOMY_CELL_TYPE : CELL_TYPE;
  const expression: "open" | "sleepy" | "storm" =
    !activeIsDay || scene === "night" ? "sleepy" : scene === "storm" ? "storm" : "open";

  // The card's own box — the wall shell owns the cell, so the card measures
  // itself and the scene (the night moon) is placed from that box.
  const [cell, setCell] = useState({ w: 0, h: 0 });
  const onCellLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setCell((c) => (c.w === width && c.h === height ? c : { w: width, h: height }));
  };
  const padH = isPoster ? 28 : spacious ? 22 : 18;
  const padT = isPoster ? 28 : 16;
  const padB = isPoster ? 28 : 14;
  const gap = isPoster ? 12 : 0;
  // The glass sheen over the whole card on the full poster page only.
  const sheenFill: [string, string, string] = [
    mix(glint, "transparent", 15),
    mix(glint, "transparent", 0),
    mix(glint, "transparent", 5),
  ];

  const temperature =
    activeTempF == null ? (
      <Text testID="wx-temp-empty" style={{ fontSize: digitsHeight, lineHeight: digitsHeight * 1.05, color: washInk, fontWeight: "700" }}>
        —
      </Text>
    ) : (
      <AmbientDigitPop triggerKey={`${scrubIdx}-${activeTempF}`}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "center" }} testID="wx-temp-digits">
          {String(Math.round(activeTempF)).split("").map((d, i) => (
            <MonsterDigit key={`${d}-${i}`} digit={d} height={digitsHeight} expression={expression} index={i} />
          ))}
          <Text style={{ color: soft, fontSize: digitsHeight * 0.28, lineHeight: digitsHeight * 0.32, fontWeight: "300", marginLeft: 2, marginTop: digitsHeight * 0.05 }}>
            °
          </Text>
        </View>
      </AmbientDigitPop>
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
      {/* 1 — flat background (pure solid color, or poster gradient on full page) */}
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

      {/* 3 — on full poster page only: scrim and sheen */}
      {isPoster ? <PosterScrim scene={scene} /> : null}
      {isPoster ? (
        <LinearGradient
          colors={sheenFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}

      {/* 4 — Card Content */}
      <View style={{ flex: 1, paddingHorizontal: padH, paddingTop: padT, paddingBottom: padB, gap, zIndex: 20 }}>
        {/* Header Row: Flat Place Chip (Left) + Flat Details Pill (Right) */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            height: isPoster ? undefined : 28,
          }}
        >
          <View
            testID="wx-place-pill"
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
            }}
          >
            <MapPinGlyph color={pinInk} size={isPoster ? 18 : 14} />
            <Text
              numberOfLines={1}
              style={{
                color: washInk,
                fontFamily: isPoster ? undefined : "Oswald",
                fontSize: isPoster ? type.place.fontSize : 14,
                fontWeight: isPoster ? "500" : "600",
                letterSpacing: isPoster ? undefined : 1.2,
                textTransform: isPoster ? "none" : "uppercase",
                opacity: 0.9,
              }}
            >
              {data.place}
            </Text>
          </View>
          {size === "cell" ? (
            <View
              testID="wx-details-pill"
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 3,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: RADII.full,
                backgroundColor: mix(washInk, "transparent", 12),
              }}
            >
              <Text
                style={{
                  color: washInk,
                  fontFamily: "Oswald",
                  fontSize: 14,
                  fontWeight: "600",
                  letterSpacing: 0.8,
                  textTransform: "uppercase",
                }}
              >
                Details
              </Text>
              <ChevronGlyph color={washInk} size={11} />
            </View>
          ) : null}
        </View>

        {isPoster ? (
          /* Full page poster: side-by-side or large layout */
          <>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                marginTop: 2,
              }}
            >
              <View style={{ flexShrink: 1 }}>{temperature}</View>
              <View
                style={{
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <AmbientBob>
                  <ConditionIcon code={code} size={iconSize} />
                </AmbientBob>
              </View>
            </View>
            <View style={{ alignItems: "center", marginTop: 2 }}>
              <Text testID="wx-condition" style={{ color: washInk, ...type.condition, lineHeight: 32 }}>
                {titleCaseCondition(data.condition)}
              </Text>
              {hlLine ? (
                <Text style={{ color: soft, ...type.meta, lineHeight: 28, marginTop: 2 }}>
                  {hlLine}{feels}
                </Text>
              ) : null}
              {data.outlook ? (
                <Text testID="wx-outlook" style={{ color: soft, ...type.meta, lineHeight: 28, marginTop: 2, textAlign: "center" }}>
                  {data.outlook}
                </Text>
              ) : null}
            </View>
            {/* Interactive Not Boring Monsters Capsule Hour Scrubber (Mobbin video 00:15–00:23) */}
            {data.hours.length >= 2 ? (
              <View testID="wx-capsule-scrubber" style={{ marginTop: 8, gap: 6 }}>
                {activeHour ? (
                  <View style={{ alignSelf: "center", paddingHorizontal: 14, paddingVertical: 4, borderRadius: RADII.full, backgroundColor: colors["color-monster-teal"] ?? washInk }}>
                    <Text style={{ fontFamily: "Oswald", fontSize: 16, fontWeight: "700", color: colors["color-monster-ink-blue"] ?? washInk }}>
                      {activeHour.label}
                    </Text>
                  </View>
                ) : null}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    borderRadius: RADII.full,
                    paddingHorizontal: 14,
                    paddingVertical: 4,
                    backgroundColor: mix(washInk, "transparent", 18),
                    gap: 6,
                  }}
                >
                  <Text style={{ fontFamily: "Oswald", fontSize: 18, fontWeight: "700", color: washInk }}>
                    {data.highF ?? "—"}
                  </Text>
                  <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-around" }}>
                    {data.hours.slice(0, 6).map((h, i) => {
                      const active = scrubIdx === i;
                      return (
                        <Pressable
                          key={`${h.label}-${i}`}
                          testID={`wx-scrub-hour-${i}`}
                          onPress={() => setScrubIdx(i)}
                          accessibilityRole="button"
                          accessibilityLabel={`Preview weather for ${i === 0 ? "Now" : h.label}`}
                          style={{
                            minWidth: 64,
                            minHeight: 64,
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: RADII.md,
                            paddingHorizontal: 8,
                            backgroundColor: active ? (colors["color-monster-teal"] ?? washInk) : "transparent",
                          }}
                        >
                          <Text
                            style={{
                              fontFamily: "Oswald",
                              fontSize: 14,
                              fontWeight: "700",
                              color: active ? (colors["color-monster-ink-blue"] ?? washInk) : washInk,
                            }}
                          >
                            {i === 0 ? "NOW" : h.label}
                          </Text>
                          <Text
                            style={{
                              fontFamily: "Oswald",
                              fontSize: 16,
                              fontWeight: "700",
                              color: active ? (colors["color-monster-ink-blue"] ?? washInk) : soft,
                            }}
                          >
                            {h.tempF}°
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Text style={{ fontFamily: "Oswald", fontSize: 18, fontWeight: "700", color: washInk }}>
                    {data.lowF ?? "—"}
                  </Text>
                </View>
              </View>
            ) : null}
            <View style={{ alignItems: "flex-end", marginTop: "auto" }}>
              <Text testID="wx-updated" style={{ color: soft, ...type.meta, lineHeight: 28 }}>
                Updated {relativeUpdated(data.updatedAt)}
              </Text>
            </View>
          </>
        ) : (
          /* Wall card: Not Boring Monsters signature vertical stack + 5-day strip! */
          <View style={{ flex: 1, justifyContent: "space-between" }}>
            {/* Creature + Big Digits + Condition */}
            <View style={{ alignItems: "center", justifyContent: "center", marginTop: 4 }}>
              <AmbientBob>
                <ConditionIcon code={code} size={iconSize} />
              </AmbientBob>
              <View style={{ marginTop: 2 }}>
                {temperature}
              </View>
              <Text
                testID="wx-condition"
                style={{
                  color: washInk,
                  fontFamily: "Oswald",
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  textAlign: "center",
                  marginTop: 2,
                  ...type.condition,
                }}
              >
                {data.condition}
              </Text>
              {data.outlook ? (
                <Text
                  testID="wx-outlook"
                  style={{
                    color: soft,
                    textAlign: "center",
                    marginTop: 2,
                    ...type.meta,
                  }}
                >
                  {data.outlook}
                </Text>
              ) : null}
            </View>

            {/* 5-Day Forecast Row directly on the card! */}
            {data.days && data.days.length > 0 ? (
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "flex-end",
                  width: "100%",
                  paddingTop: 8,
                  paddingBottom: 2,
                  borderTopWidth: 1,
                  borderTopColor: mix(washInk, "transparent", 18),
                }}
              >
                {data.days.slice(0, 5).map((d) => (
                  <View key={d.key} style={{ alignItems: "center", flex: 1, gap: 3 }}>
                    <Text
                      style={{
                        fontFamily: "Oswald",
                        fontSize: 14,
                        letterSpacing: 1,
                        color: washInk,
                        opacity: 0.82,
                        textTransform: "uppercase",
                      }}
                    >
                      {d.label.slice(0, 3)}
                    </Text>
                    <ConditionIcon code={conditionCode(d.code ?? undefined, true)} size={18} />
                    <Text
                      style={{
                        fontFamily: "Oswald",
                        fontSize: 14,
                        fontWeight: "700",
                        color: washInk,
                      }}
                    >
                      {d.highF != null ? `${d.highF}°` : "—"}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={{ alignItems: "flex-end", marginTop: "auto" }}>
              <Text testID="wx-updated" style={{ color: soft, ...type.meta }}>
                Updated {relativeUpdated(data.updatedAt)}
              </Text>
            </View>
          </View>
        )}
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
