import React from "react";
import { Image, Pressable, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { api, ApiError } from "../../api/client";
import { photoSource, type WallPhoto } from "../../photos/library";
import { useTheme } from "../../theme/ThemeProvider";
import { MOTION, TYPOGRAPHY } from "../../theme/tokens";
import { EmptyState } from "../../ui/EmptyState";
import { mixAlpha } from "../../ui/SoftButton";
import { useWidgetData } from "./data";
import { WidgetFrame } from "./WidgetFrame";
import { useToast } from "../../ui/Toast";

interface PhotoSettings {
  rotateSeconds: number; // clamped 10–600, default 75
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

/** Server validates order (400 on unknown) — clamp the interval like the web. */
function clampSettings(s: Partial<PhotoSettings>): PhotoSettings {
  const raw = Number(s.rotateSeconds);
  const rotateSeconds = Number.isFinite(raw) ? Math.min(600, Math.max(10, Math.round(raw))) : DEFAULT_SETTINGS.rotateSeconds;
  return { ...DEFAULT_SETTINGS, ...s, rotateSeconds };
}

interface PhotosState {
  photos: WallPhoto[];
  settings: PhotoSettings;
  degraded: boolean; // settings read failed → defaults (route never 5xxs)
}

async function loadPhotos(recentIds: string[] = []): Promise<PhotosState> {
  // Settings FIRST — the rotation order drives the photo query (web parity).
  let settings = DEFAULT_SETTINGS;
  let degraded = false;
  try {
    const s = await api<{ ok: boolean; settings: PhotoSettings; degraded?: boolean }>(
      "/api/photos/settings"
    );
    if (s?.settings) settings = clampSettings(s.settings);
    degraded = !!s?.degraded;
  } catch (e) {
    if (e instanceof ApiError && e.status === 503) {
      degraded = true; // documented: settings route degrades to defaults, never 5xxs
    } else if (e instanceof ApiError && e.status !== 401) {
      degraded = true;
    }
  }
  const recent = recentIds.length ? `&recent=${encodeURIComponent(recentIds.join(","))}` : "";
  const res = await api<{ ok: boolean; photos: WallPhoto[] }>(
    `/api/photos?limit=12&order=${encodeURIComponent(settings.order)}${recent}`
  );
  const photos = Array.isArray(res?.photos) ? res.photos : [];
  return { photos, settings, degraded };
}

/**
 * Wall photos hero (row-span-2 cell): rotates the shared library per
 * photo_settings (seconds/order/transition/caption), pulses on sync, and
 * re-reads settings + a fresh (recent-avoiding) batch at the end of each
 * rotation — the web's advance→refresh pattern, so a phone change lands
 * within one rotation. Pause/play is a hard a11y requirement (WCAG 2.2.2):
 * reduceMotion starts paused, an explicit press always wins. Cookie-auth
 * image bytes via source.headers (RN fresco).
 */
export function PhotosWidget() {
  const { colors, reduceMotion } = useTheme();
  const toast = useToast();
  const { status, data: batch, failure, stale, retry } = useWidgetData<PhotosState>(() => loadPhotos());

  const [override, setOverride] = React.useState<PhotosState | null>(null);
  const data = override ?? batch;
  const [index, setIndex] = React.useState(0);
  const [pausedByChoice, setPausedByChoice] = React.useState<boolean | null>(null);
  const paused = pausedByChoice ?? reduceMotion;
  const [failedIds, setFailedIds] = React.useState<ReadonlySet<string>>(new Set());
  const shownRef = React.useRef<string[]>([]);
  const fade = useSharedValue(1);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- batch reset on data identity change (last-batch honesty)
    setIndex(0); // a fresh batch always starts at the top
    setOverride(null);
  }, [batch]);

  const photos = React.useMemo(
    () => (data?.photos ?? []).filter((p) => !failedIds.has(p.id)),
    [data, failedIds]
  );
  const current = photos.length ? photos[index % photos.length] : null;
  const prev = photos.length > 1 ? photos[(index - 1 + photos.length * 1000) % photos.length] : null;

  // End-of-rotation refresh: re-read settings + a recent-avoiding batch so a
  // phone change lands within one rotation (the web's advance→refresh loop).
  const refreshBatch = React.useCallback(async () => {
    try {
      setOverride(await loadPhotos(shownRef.current.slice(-12)));
    } catch {
      /* keep the current batch on screen; the next rotation tries again */
    }
  }, []);

  const seconds = data?.settings.rotateSeconds ?? 75;
  React.useEffect(() => {
    if (!data || photos.length < 2 || paused || !current) return;
    const t = setInterval(() => {
      const id = String(current.id);
      if (!shownRef.current.includes(id)) shownRef.current.push(id);
      void refreshBatch();
      setIndex((i) => i + 1);
    }, Math.max(10, seconds) * 1000);
    return () => clearInterval(t);
  }, [data, photos.length, paused, current, seconds, refreshBatch]);

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

  const allFailed = !!data && data.photos.length > 0 && photos.length === 0;

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
        >
          {prev ? (
            <Image source={photoSource(prev)} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} resizeMode="cover" />
          ) : null}
          <Animated.View style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }, fadeStyle]}>
            <Image
              testID="photos-hero-image"
              source={photoSource(current)}
              style={{ flex: 1 }}
              resizeMode="cover"
              onError={() => {
                // a broken file must not freeze the tile — fail it and move on
                const id = String(current.id);
                setFailedIds((s) => new Set(s).add(id));
                setIndex((i) => i + 1);
              }}
            />
          </Animated.View>
          {photos.length > 1 ? (
            <Pressable
              testID="photos-pause"
              accessibilityRole="button"
              accessibilityLabel={paused ? "Resume photo rotation" : "Pause photo rotation"}
              onPress={() => setPausedByChoice((was) => !(was ?? reduceMotion))}
              hitSlop={8}
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                width: 64,
                height: 64,
                borderRadius: 32,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: mixAlpha(colors["color-canvas"], 0.45),
              }}
            >
              <Text style={{ fontSize: 24, color: colors["color-primary-foreground"] }} accessibilityElementsHidden>
                {paused ? "▶️" : "⏸️"}
              </Text>
            </Pressable>
          ) : null}
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
      ) : allFailed ? (
        <EmptyState flat icon="📸" title="Couldn't load this photo." body="Check the shared library on the Photos page." />
      ) : data && data.photos.length === 0 ? (
        <EmptyState flat icon="📸" title="No photos yet." body="Add pictures from the Photos page and the wall picks them up." />
      ) : null}
    </WidgetFrame>
  );
}

export default PhotosWidget;
