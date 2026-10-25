import React from "react";
import { Image, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { api, ApiError } from "../../api/client";
import { photoSource, type WallPhoto } from "../../photos/library";
import { mix } from "../../theme/mix";
import { useTheme } from "../../theme/ThemeProvider";
import { MOTION, RADII, TYPOGRAPHY } from "../../theme/tokens";
import { EmptyState } from "../../ui/EmptyState";
import { READ_COPY, READ_COPY_STALE, READ_RETRY_LABEL, useWidgetData } from "./data";
import { pendingSurface } from "./WidgetFrame";

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
 *
 * The cell is CHROME-FREE — the reference's Photos cell is the photo itself
 * (edge to edge, one pause control at the top-right, a caption over a scrim)
 * or a PLAIN centred state (reference/home/guest-dark.png): a muted glyph, the
 * honest headline, one action. It never wears a title band and never wears an
 * identity disc. The disc used to be painted by the shared WidgetFrame at
 * (-6, -6) against the cell's own 28dp radius, so the card's corner clipped
 * it into an orphaned sticker floating over the photo — the widget header the
 * reference does not have.
 */
export function PhotosWidget() {
  const { colors, theme, reduceMotion } = useTheme();
  const router = useRouter();
  const { status, data: batch, failure, stale, retry } = useWidgetData<PhotosState>(() => loadPhotos(), { guestVisible: true });

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
  // photo bytes are session-gated, so a signed-out wall says exactly that.
  // The reference's guest cell is PLAIN and CENTRED: a muted glyph, the
  // headline, the action. No title band, no disc, and no paragraph under the
  // headline (the reference capture shows none).
  if (failure === "unauthorised") {
    return (
      <View testID="photos-unavailable" style={{ flex: 1 }}>
        <EmptyState
          flat
          icon="📡"
          title="Photos unavailable"
          actionLabel={READ_RETRY_LABEL}
          onAction={retry}
          style={{ flex: 1 }}
        />
      </View>
    );
  }

  // Full-bleed hero (reference: the photo IS the card — no title band): the
  // ready state renders bare; the plain states below serve loading/error.
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
      <View style={{ flex: 1, borderRadius: RADII.xl, overflow: "hidden" }}>
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
            hitSlop={12}
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: mix(colors["color-monster-ink-blue"], "transparent", 55),
            }}
          >
            <Text style={{ fontSize: 18, color: colors["color-primary-foreground"] }} accessibilityElementsHidden>
              {paused ? "▶" : "⏸"}
            </Text>
          </Pressable>
        ) : null}
        {data.settings.showCaption && caption ? (
          <>
            {/* Dark gradient scrim keeps white caption text legible in both
                light and dark themes — a flat canvas-alpha band washes out
                on light mode (the web fix: color-monster-ink-blue gradient). */}
            <LinearGradient
              pointerEvents="none"
              colors={["transparent", mix(colors["color-monster-ink-blue"], "transparent", 75)]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 96 }}
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

  // Loading: the web paints a bare skeleton surface for this tile
  // (`.wall-photo-skeleton`) — no title, no icon, nothing that could pass for
  // a photo. The native paints the SAME perceivable skeleton surface the rest
  // of the wall uses (pendingSurface clears 3:1 once composited), with the
  // honest line under it, so the cell is a state and never a blank hole.
  if (status === "loading") {
    return (
      <View
        testID="photos-loading"
        accessibilityLabel="Loading photos"
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: pendingSurface(colors, theme),
        }}
      >
        <Text
          style={{
            color: colors["color-text-secondary"],
            fontSize: TYPOGRAPHY.label.fontSize,
            lineHeight: TYPOGRAPHY.label.lineHeight,
            fontWeight: "600",
          }}
        >
          {"Loading photos…"}
        </Text>
      </View>
    );
  }

  // A failed read with nothing to show: the SAME plain centred composition as
  // the guest state (reference parity), plus the shared read vocabulary so the
  // family knows WHICH failure it is — offline is not the same story as a
  // broken library. Never a title-bearing card (the reference's Photos cell
  // has no title) and never a fabricated photo.
  return (
    <View testID="photos-error" style={{ flex: 1 }}>
      <EmptyState
        flat
        icon="📡"
        title="Photos unavailable"
        body={failure ? READ_COPY[failure] : undefined}
        actionLabel={READ_RETRY_LABEL}
        onAction={retry}
        style={{ flex: 1 }}
      />
    </View>
  );
}

export default PhotosWidget;
