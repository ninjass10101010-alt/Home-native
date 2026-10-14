// Home-native/src/weather/WidgetHero.tsx
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
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
import { ConditionIcon, MonsterDigit } from "./art";
import { conditionCode } from "./conditions";
import { fetchWeather, type WeatherSnapshot } from "./data";
import { washInkToken, washPair, WASH_TOKENS, WX_LABEL } from "./language";

/** Web parity: "Updated just now" / "Updated Nm ago" / clock past an hour. */
function relativeUpdated(ms: number, now: Date = new Date()): string {
  const mins = Math.max(0, Math.round((now.getTime() - ms) / 60_000));
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export interface WeatherPosterProps {
  size: "cell" | "full";
  data: WeatherSnapshot;
}

/**
 * The Monster hero poster — full-bleed wash, condition icon (ambient bob),
 * segmented MonsterDigit temperature, condition/H:L/outlook stack. Pure: the
 * fetching cell (WeatherHeroCell) and the gallery route both render it.
 */
export function WeatherPoster({ size, data }: WeatherPosterProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const code = conditionCode(data.code ?? undefined, data.isDay);
  const [washTop, washBottom] = WASH_TOKENS[washPair(code)];
  const washInk = colors[washInkToken(code)] ?? colors["color-text-primary"];
  const soft = mix(washInk, "transparent", 64); // AA-safe secondary on the wash
  const digitsHeight = size === "full" ? 260 : 132;
  const iconSize = size === "full" ? 200 : 96;

  const temperature =
    data.tempF == null ? (
      <Text testID="wx-temp-empty" style={{ fontSize: digitsHeight, lineHeight: digitsHeight * 1.05, color: washInk, fontWeight: "700" }}>
        —
      </Text>
    ) : (
      <View style={{ flexDirection: "row", alignItems: "flex-end" }} testID="wx-temp-digits">
        {String(Math.round(data.tempF)).split("").map((d, i) => (
          <MonsterDigit key={`${d}-${i}`} digit={d} height={digitsHeight} />
        ))}
        <Text style={{ fontSize: digitsHeight * 0.5, lineHeight: digitsHeight * 0.9, color: washInk, fontWeight: "700" }}>°</Text>
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
    <LinearGradient
      testID="wx-poster"
      colors={[colors[washTop] ?? colors["color-surface-1"], colors[washBottom] ?? colors["color-surface-2"]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.65, y: 1 }}
      style={{ flex: 1, borderRadius: RADII.xl, padding: size === "full" ? 28 : 14, gap: size === "full" ? 16 : 8, overflow: "hidden" }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
        <View style={{ flex: 1, alignItems: "flex-start" }}>
          <Text numberOfLines={1} style={[WX_LABEL, { color: washInk, fontSize: TYPOGRAPHY.label.fontSize }]}>
            {data.place}
          </Text>
        </View>
        <AmbientBob>
          <ConditionIcon code={code} size={iconSize} />
        </AmbientBob>
      </View>

      <View style={{ alignItems: "center" }}>
        {temperature}
        <Text style={[WX_LABEL, { color: washInk, fontSize: TYPOGRAPHY.title.fontSize }]}>{data.condition}</Text>
        {hlLine ? (
          <Text style={{ color: soft, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "600" }}>
            {hlLine}
            {feels}
          </Text>
        ) : null}
      </View>

      <View style={{ alignItems: "center" }}>
        {data.outlook ? (
          <Text testID="wx-outlook" style={{ color: soft, fontSize: TYPOGRAPHY.body.fontSize, textAlign: "center" }}>
            {data.outlook}
          </Text>
        ) : null}
        <Text style={{ color: soft, fontSize: TYPOGRAPHY.label.fontSize }}>Updated {relativeUpdated(data.updatedAt)}</Text>
      </View>
    </LinearGradient>
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

/** Wall cell — one fetch on mount + sync pulses, guest-visible, honest states. */
export function WeatherHeroCell() {
  const { colors } = useTheme();
  const { status, data, failure, stale, retry } = useWidgetData<WeatherSnapshot>(fetchWeather, {
    guestVisible: true, // Open-Meteo is public; the guest wall sees weather (reference parity)
  });
  return (
    <WidgetFrame
      id="weather"
      icon="⛅"
      title="Weather"
      // The reference poster is full-bleed: no title band (identity lives in
      // the poster's place line). The frame keeps an accessible header label.
      header={<View testID="weather-header" accessibilityRole="header" accessibilityLabel="Weather" style={{ height: 0, overflow: "hidden" }} />}
      status={status}
      failure={data !== null ? null : failure}
      hasData={data !== null}
      stale={false} /* the poster paints its own honest badge below */
      onRetry={retry}
    >
      {data ? (
        <>
          <WeatherPoster size="cell" data={data} />
          {stale ? (
            <Text testID="wx-stale" style={{ color: colors["color-accent-ink-amber"] ?? colors["color-accent-amber"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
              {READ_COPY_STALE}
            </Text>
          ) : null}
        </>
      ) : null}
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
      description={`📍 ${data.place} · ${data.condition}`}
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
