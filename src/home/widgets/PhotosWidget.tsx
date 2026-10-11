import React from "react";
import { Image, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { api, ApiError } from "../../api/client";
import { photoSource, type WallPhoto } from "../../photos/library";
import { useTheme } from "../../theme/ThemeProvider";
import { MOTION, TYPOGRAPHY } from "../../theme/tokens";
import { EmptyState } from "../../ui/EmptyState";
import { useWidgetData } from "./data";
import { WidgetFrame } from "./WidgetFrame";
import { useToast } from "../../ui/Toast";

interface PhotoSettings {
  rotateSeconds: number; // 10–600, default 75
  transition: "crossfade" | "dissolve" | "slide" | "cut";
  order: "shuffle" | "newest" | "oldest";
  showCaption: boolean;
}

const DEFAULT_SETTINGS: PhotoSettings = {
  rotateSeconds: 75,
  transition: "crossfade",
  order: "shuffle",
  showCaption: true,
};

interface PhotosState {
  photos: WallPhoto[];
  settings: PhotoSettings;
  degraded: boolean; // settings read failed → defaults (route never 5xxs)
}

async function loadPhotos(): Promise<PhotosState> {
  // Photos first (settings may degrade to defaults — the route's own honesty).
  const res = await api<{ ok: boolean; photos: WallPhoto[] }>(
    `/api/photos?limit=12${""}`
  );
  const photos = Array.isArray(res?.photos) ? res.photos : [];
  let settings = DEFAULT_SETTINGS;
  let degraded = false;
  try {
    const s = await api<{ ok: boolean; settings: PhotoSettings; degraded?: boolean }>(
      "/api/photos/settings"
    );
    if (s?.settings) settings = { ...DEFAULT_SETTINGS, ...s.settings };
    degraded = !!s?.degraded;
  } catch (e) {
    if (e instanceof ApiError && e.status === 503) {
      degraded = true; // documented: settings route degrades to defaults, never 5xxs
    } else if (e instanceof ApiError && e.status !== 401) {
      degraded = true;
    }
  }
  return { photos, settings, degraded };
}

/**
 * Wall photos hero (row-span-2 cell): rotates the shared library per
 * photo_settings (seconds/order/transition/caption), pulses on sync, and
 * re-reads settings at the end of each rotation (the web's advance→refresh
 * pattern — a phone change lands within one rotation). Cookie-authenticated
 * image bytes via source.headers (RN fresco). reduceMotion → cut, no fade.
 */
export function PhotosWidget() {
  const { colors, reduceMotion } = useTheme();
  const toast = useToast();
  const { status, data, failure, stale, retry } = useWidgetData<PhotosState>(loadPhotos);

  const [index, setIndex] = React.useState(0);
  const fade = useSharedValue(1);
  const advance = React.useCallback(() => {
    setIndex((i) => {
      const next = i + 1;
      return next;
    });
  }, []);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- batch reset on data identity change (last-batch honesty)
    setIndex(0); // a fresh batch always starts at the top
  }, [data]);

  const seconds = data?.settings.rotateSeconds ?? 75;
  React.useEffect(() => {
    if (!data || data.photos.length < 2) return;
    const t = setInterval(advance, Math.max(10, seconds) * 1000);
    return () => clearInterval(t);
  }, [data, seconds, advance]);

  const photos = data?.photos ?? [];
  const current = photos.length ? photos[index % photos.length] : null;
  const prev = photos.length > 1 ? photos[(index - 1 + photos.length * 1000) % photos.length] : null;

  // Transition: crossfade/dissolve/slide all map to an opacity fade on the
  // wall tile (slide is the web's phone treatment); cut → instant.
  React.useEffect(() => {
    const dur =
      !reduceMotion && data && (data.settings.transition === "crossfade" || data.settings.transition === "dissolve")
        ? MOTION.glide
        : 0;
    fade.value = 0;
    fade.value = withTiming(1, { duration: dur });
  }, [index, reduceMotion, data, fade]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  return (
    <WidgetFrame
      id="photos"
      icon="📸"
      title="Photos"
      status={status}
      failure={failure}
      hasData={data !== null}
      stale={stale}
      onRetry={retry}
    >
      {current ? (
        <View
          style={{ flex: 1, borderRadius: 16, overflow: "hidden" }}
          onTouchStart={() => toast.show("The full Photos wall arrives with the Photos wave.", { intent: "info" })}
        >          {prev ? (
            <Image source={photoSource(prev)} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} resizeMode="cover" />
          ) : null}
          <Animated.View style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }, fadeStyle]}>
            <Image
              testID="photos-hero-image"
              source={photoSource(current)}
              style={{ flex: 1 }}
              resizeMode="cover"
            />
          </Animated.View>
          {data?.settings.showCaption && current.caption ? (
            <View style={{ position: "absolute", bottom: 8, left: 8, right: 8 }}>
              <Text
                style={{
                  color: colors["color-text-primary"],
                  fontSize: TYPOGRAPHY.label.fontSize,
                  fontWeight: "600",
                  textShadowColor: colors["color-canvas"],
                  textShadowRadius: 4,
                }}
                numberOfLines={2}
              >
                {current.caption}
              </Text>
            </View>
          ) : null}
          {data?.degraded ? (
            <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize, marginTop: 4 }}>
              settings unavailable — default rotation
            </Text>
          ) : null}
        </View>
      ) : data && data.photos.length === 0 ? (
        <EmptyState flat icon="📸" title="No photos yet." body="Add pictures from the Photos page and the wall picks them up." />
      ) : null}
    </WidgetFrame>
  );
}

export default PhotosWidget;
