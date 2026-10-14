// Home-native/src/weather/WidgetGallery.tsx
import React from "react";
import { ScrollView } from "react-native";
import { useWidgetData } from "../home/widgets/data";
import { fetchWeather, type WeatherSnapshot } from "./data";
import { GalleryHero } from "./WidgetHero";
import { WeatherTimeline } from "./WidgetTimeline";
import { WeatherAirQuality } from "./WidgetAirQuality";
import { WeatherMoon } from "./WidgetMoon";

export { WeatherTimeline, WeatherAirQuality, WeatherMoon };

/**
 * The /weather gallery — ONE fetch for hero + cards (the one-fetch rule).
 * Forecast failure → the hero's honest failure card; cards render only with
 * live data (a gallery of stale-skeletons is worse than one honest failure).
 */
export function WeatherGallery() {
  const { status, data, failure, stale, retry } = useWidgetData<WeatherSnapshot>(fetchWeather, {
    guestVisible: true,
  });
  return (
    <ScrollView
      testID="wx-gallery"
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 18, gap: 18, paddingBottom: 160 }}
    >
      <GalleryHero status={status} data={data} stale={stale} retry={retry} failure={failure} />
      {data ? <WeatherTimeline data={data} /> : null}
      {data ? <WeatherAirQuality data={data} /> : null}
      {data ? <WeatherMoon data={data} /> : null}
    </ScrollView>
  );
}
