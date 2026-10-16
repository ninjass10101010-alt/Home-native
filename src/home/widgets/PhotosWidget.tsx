import React from "react";
import { Image, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { api, ApiError } from "../../api/client";
import { photoSource, type WallPhoto } from "../../photos/library";
import { useTheme } from "../../theme/ThemeProvider";
import { MOTION, TYPOGRAPHY } from "../../theme/tokens";
import { EmptyState } from "../../ui/EmptyState";
import { mixAlpha } from "../../ui/SoftButton";
import { READ_COPY_STALE, READ_RETRY_LABEL, useWidgetData } from "./data";
import { WidgetFrame } from "./WidgetFrame";

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

/** The web's captionFor date fallback: "October 2026" when no family caption. */
function fallbackCaption(takenAt?: string): string | null {
  if (!takenAt) return null;
  const d = new Date(takenAt);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
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
  const { colors, accentColor, reduceMotion } = useTheme();
  const router = useRouter();
  const { status, data: batch, failure, stale, retry } = useWidgetData<PhotosState>(() => loadPhotos());

  const [override, setOverride] = React.useState<PhotosState | null>(null);
  const data = override ?? batch;
  const [index, setIndex] = React.useState(0);
  const [pausedByChoice, setPausedByChoice] = React.useState<boolean | null>(null);
  const paused = pausedByChoice ?? reduceMotion;
  const [failedIds, setFailedIds] = React.useState<ReadonlySet<string>>(new Set());
  const shownRef = React.useRef<string[]>([]);
  const fade = useSharedValue(1);

  // A "fresh batch" is NEW PHOTO IDS, not a new object identity — the 60s
  // sync pulse rebuilds the data object with the same photos and must NOT
  // reset the hero mid-hold (web keys the rotation on the interval number).
  const batchKey = React.useMemo(
    () => (batch?.photos ?? []).map((p) => String(p.id)).join("|"),
    [batch]
  );
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- batch reset on data identity change (last-batch honesty)
    setIndex(0); // a genuinely fresh batch always starts at the top
    setOverride(null);
  }, [batchKey]);

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

  // Guest state (reference capture): "Photos unavailable" + Try again — the
  // photo bytes are session-gated, so a signed-out wall says exactly that,
  // never a generic PIN line on a title-bearing card.
  if (failure === "unauthorised") {
    return (
      <View testID="photos-unavailable" style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 10 }}>
        <Text style={{ fontSize: 32 }}>📡</Text>
        <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.title.fontSize, fontWeight: "700" }}>
          Photos unavailable
        </Text>
        <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, textAlign: "center" }}>
          {/* React Native does not decode HTML entities in JSX text — the copy
              lives in an expression (eslint's no-unescaped-entities parity). */}
          {"The family photo library can't be reached right now."}
        </Text>
        <Pressable
          onPress={retry}
          accessibilityRole="button"
          accessibilityLabel="Photos unavailable. Try again"
          style={{ minHeight: 64, justifyContent: "center", paddingHorizontal: 16 }}
        >
          <Text
            style={{
              color: colors["color-accent-selected"] ?? accentColor,
              fontSize: TYPOGRAPHY.label.fontSize,
              fontWeight: "700",
              textDecorationLine: "underline",
            }}
          >
            {READ_RETRY_LABEL}
          </Text>
        </Pressable>
      </View>
    );
  }

  // Full-bleed hero (reference: the photo IS the card — no title band): the
  // ready state renders bare; the WidgetFrame chrome serves loading/error only.
  if (status === "ready" && data) {
    if (allFailed) {
      return (
        <EmptyState flat icon="📸" title="Couldn't load this photo." body="Check the shared library on the Photos page." style={{ flex: 1 }} />
      );
    }
    if (!current) {
      return (
        <EmptyState
          flat
          icon="📸"
          title="No photos yet"
          body="Add a picture from the Photos page and it will appear here."
          actionLabel="Add a photo"
          onAction={() => router.push("/photos")}
          style={{ flex: 1 }}
        />
      );
    }
    const caption = current.caption || fallbackCaption(current.takenAt);
    return (
      <View style={{ flex: 1, borderRadius: 16, overflow: "hidden" }}>
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
            accessibilityLabel="Pause photo rotation"
            accessibilityState={{ checked: paused }}
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
        {data.settings.showCaption && caption ? (
          <>
            {/* The scrim is what keeps the caption legible against a snow
                scene (web globals): a flat translucent band + white ink. */}
            <View
              pointerEvents="none"
              style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 72, backgroundColor: mixAlpha(colors["color-canvas"], 0.38) }}
            />
            <Text
              numberOfLines={2}
              style={{
                position: "absolute",
                bottom: 12,
                left: 12,
                right: 12,
                color: colors["color-primary-foreground"],
                fontSize: TYPOGRAPHY.label.fontSize,
                fontWeight: "600",
              }}
            >
              {caption}
            </Text>
          </>
        ) : null}
        {stale ? (
          <Text
            testID="photos-stale"
            style={{
              position: "absolute",
              top: 16,
              left: 12,
              color: colors["color-primary-foreground"],
              fontSize: TYPOGRAPHY.label.fontSize,
              fontWeight: "600",
              textShadowColor: colors["color-canvas"],
              textShadowRadius: 4,
            }}
          >
            {READ_COPY_STALE}
          </Text>
        ) : null}
        {data.degraded ? (
          <Text
            style={{
              position: "absolute",
              bottom: 84,
              left: 12,
              color: colors["color-primary-foreground"],
              fontSize: TYPOGRAPHY.label.fontSize,
              textShadowColor: colors["color-canvas"],
              textShadowRadius: 4,
            }}
          >
            settings unavailable — default rotation
          </Text>
        ) : null}
      </View>
    );
  }

  // Loading / non-guest failures ride the shared frame (skeletons + pill).
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
      {null}
    </WidgetFrame>
  );
}

export default PhotosWidget;
