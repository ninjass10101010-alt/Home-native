// Home-native/src/weather/WidgetHero.tsx
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
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
import { AmbientBob } from "./useAmbient";
import {
  ChevronGlyph,
  ConditionIcon,
  CREATURE_SIZE,
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
export function WeatherPoster({ size, data }: WeatherPosterProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const code = conditionCode(data.code ?? undefined, data.isDay);
  // The clock picks the sky, the condition picks the glyph (web parity:
  // wmoToScene collapses the clear/cloudy skies to night after dark).
  const scene = sceneFor(code, data.isDay);
  const [flatTop, flatBottom] = useSceneSky(scene);
  const [posterTop, posterBottom] = posterSkyColors(colors, posterSkyWash(code, data.isDay));
  const isPoster = size === "full";
  const skyTop = isPoster ? posterTop : flatTop;
  const skyBottom = isPoster ? posterBottom : flatBottom;
  // The ink rides the field: the wall card's flat washes carry the warm dark
  // ink (web INK table — even the lamplit night field is slate-800 ink), the
  // poster page carries white on its night skin, and the storm field is the
  // one dark wall wash, so it flips to white too.
  const darkField = isPoster ? !data.isDay : scene === "storm";
  const washInk = darkField
    ? colors["color-monster-glint"] ?? colors["color-text-primary"]
    : colors["color-monster-ink-day"] ?? colors["color-text-primary"];
  const soft = mix(washInk, "transparent", 66); // AA-safe secondary on the wash
  const glint = colors["color-monster-glint"] ?? colors["color-text-primary"];
  const pinInk = colors["color-accent-coral"] ?? colors["color-accent-rose"];
  const digitsHeight = size === "full" ? 220 : 96; // the web's wall hero digits (xl:text-[96px])
  const iconSize = size === "full" ? 180 : CREATURE_SIZE;
  const pad = size === "full" ? 28 : 14;
  const gap = size === "full" ? 12 : 6;
  const phase = moonPhase(data.updatedAt).phase;

  // One glass recipe for both pills (web GLASS): a white sheen over a white
  // hairline — the chip lifts the sky instead of punching a hole in it.
  const glassFill: [string, string] = [mix(glint, "transparent", 26), mix(glint, "transparent", 8)];
  const glassBorder = mix(glint, "transparent", 28);
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

  const chipStyle = {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    paddingHorizontal: size === "full" ? 14 : 12,
    paddingVertical: size === "full" ? 9 : 6,
    borderRadius: RADII.full,
    borderWidth: 1,
    borderColor: glassBorder,
  };

  const poster = (
    <View
      testID="wx-poster-frame"
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
      <WeatherScene code={code} isDay={data.isDay} precipPct={data.precipTodayPct} moonPhase={phase} />

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
      <View style={{ flex: 1, padding: pad, gap, zIndex: 20 }}>
        {/* Row 1 — place pill (left) + details pill (right) */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <LinearGradient
            testID="wx-place-pill"
            colors={glassFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={chipStyle}
          >
            <MapPinGlyph color={pinInk} size={size === "full" ? 20 : 17} />
            <Text numberOfLines={1} style={{ color: washInk, fontSize: size === "full" ? 26 : 22, fontWeight: "600" }}>
              {data.place}
            </Text>
          </LinearGradient>
          {size === "cell" ? (
            <LinearGradient
              testID="wx-details-pill"
              colors={glassFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={chipStyle}
            >
              <Text style={{ color: washInk, fontSize: 16, fontWeight: "700" }}>Details</Text>
              <ChevronGlyph color={washInk} size={14} />
            </LinearGradient>
          ) : null}
        </View>

        {/* Row 2 — side-by-side: Monster digits (left) + the creature (right).
            The web keeps this row at its natural height (the free space falls
            to the footer below), so the creature sits just under the chips. */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 2 }}>
          <View style={{ flexShrink: 1 }}>{temperature}</View>
          <AmbientBob>
            <ConditionIcon code={code} size={iconSize} />
          </AmbientBob>
        </View>

        {/* Row 3 — condition + H/L + feels + outlook (centered) */}
        <View style={{ alignItems: "center", gap: 2 }}>
          <Text
            testID="wx-condition"
            style={{ color: washInk, fontSize: size === "full" ? 30 : 24, lineHeight: size === "full" ? 38 : 30, fontWeight: "600" }}
          >
            {titleCaseCondition(data.condition)}
          </Text>
          {hlLine ? (
            <Text style={{ color: soft, fontSize: TYPOGRAPHY.body.fontSize, lineHeight: 22, fontWeight: "600" }}>
              {hlLine}{feels}
            </Text>
          ) : null}
          {data.outlook ? (
            <Text testID="wx-outlook" style={{ color: soft, fontSize: TYPOGRAPHY.body.fontSize, lineHeight: 22, fontWeight: "500", textAlign: "center" }}>
              {data.outlook}
            </Text>
          ) : null}
        </View>

        {/* Row 4 — Updated footer (right-aligned, pushed to the card's bottom
            edge the way the web's `mt-auto` footer sits) */}
        <View style={{ alignItems: "flex-end", marginTop: "auto" }}>
          <Text style={{ color: soft, fontSize: 16, lineHeight: 20, fontWeight: "500" }}>Updated {relativeUpdated(data.updatedAt)}</Text>
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
export function WeatherHeroCell() {
  const { colors } = useTheme();
  const { status, data, failure, stale, retry } = useWidgetData<WeatherSnapshot>(fetchWeather, {
    guestVisible: true, // Open-Meteo is public; the guest wall sees weather (reference parity)
  });

  // Direct render when data is available — full-bleed, no header disc gap
  if (data) {
    return (
      <View style={{ flex: 1 }}>
        <WeatherPoster size="cell" data={data} />
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
