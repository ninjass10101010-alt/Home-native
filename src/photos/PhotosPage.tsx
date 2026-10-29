import React from "react";
import {
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { api, ApiError } from "../api/client";
import { useTheme } from "../theme/ThemeProvider";
import { MOTION, RADII, TYPOGRAPHY } from "../theme/tokens";
import { mix } from "../theme/mix";
import { useAuth } from "../state/AuthProvider";
import { useSync } from "../state/SyncManager";
import { Material } from "../theme/Material";
import { EmptyState } from "../ui/EmptyState";
import { SignedOutBanner } from "../ui/SignedOutBanner";
import { useToast } from "../ui/Toast";
import { mixAlpha } from "../ui/SoftButton";
import { Toggle } from "../ui/Toggle";
import { READ_COPY, READ_COPY_STALE, READ_RETRY_LABEL, useWidgetData } from "../home/widgets/data";
import {
  DEFAULT_PHOTO_SETTINGS,
  getPhotoSettings,
  PHOTO_ORDER_OPTIONS,
  PHOTO_ROTATE_PRESETS,
  PHOTO_TRANSITION_OPTIONS,
  photoSource,
  setPhotoShowOnWall,
  updatePhotoSettings,
  type PhotoOrder,
  type PhotoSettings,
  type PhotoTransition,
  type WallPhoto,
} from "./library";

const GUEST_COPY = "Sign in with your PIN to see the family's photos.";
const LOADING_COPY = "Loading the family's photos…";
const EMPTY_COPY = "Nothing uploaded yet — add the first picture from the phone and it lands on the wall.";
const UPLOAD_DEFER_COPY = "Uploads from the wall arrive with the next wave — use the phone.";
const KID_NOTE_COPY = "A parent picks what's on the wall.";
const MOD_FAIL_COPY = "Couldn't update the photo — try again.";
const MOD_DENY_COPY = "Only a parent can change what's on the wall.";
const SIGNED_OUT_BANNER = "🔐 Signed out — showing your saved copy.";

function fallbackCaption(takenAt?: string): string | null {
  if (!takenAt) return null;
  const d = new Date(takenAt);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function PhotosPage() {
  const { colors, accentColor, reduceMotion } = useTheme();
  const toast = useToast();
  const router = useRouter();
  const { member, role } = useAuth();
  const { stale: syncStale } = useSync();

  // Load photos and settings
  const { status, data, failure, stale: dataStale, retry } = useWidgetData<{
    photos: WallPhoto[];
    settings: PhotoSettings;
  }>(async () => {
    const [photosRes, settingsRes] = await Promise.all([
      api<{ ok: boolean; photos: WallPhoto[] }>("/api/photos?all=1"),
      getPhotoSettings(),
    ]);
    return {
      photos: Array.isArray(photosRes?.photos) ? photosRes.photos : [],
      settings: settingsRes.settings,
    };
  });

  const [overrides, setOverrides] = React.useState<Record<string, boolean>>({});
  const [pendingIds, setPendingIds] = React.useState<ReadonlySet<string>>(new Set());
  const [settingsOverride, setSettingsOverride] = React.useState<PhotoSettings | null>(null);
  const [savingSettings, setSavingSettings] = React.useState(false);
  const [filterMode, setFilterMode] = React.useState<"all" | "wall" | "hidden">("all");
  const [previewIndex, setPreviewIndex] = React.useState(0);
  const [animTrigger, setAnimTrigger] = React.useState(0);

  // Reanimated values for live transition demonstration
  const previewFade = useSharedValue(1);
  const previewSlideX = useSharedValue(0);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset overrides on data reload (server truth wins)
    setOverrides({});
    setSettingsOverride(null);
  }, [data]);

  const isParent = role === "parent";
  const photos = React.useMemo(() => data?.photos ?? [], [data?.photos]);
  const settings = settingsOverride ?? data?.settings ?? DEFAULT_PHOTO_SETTINGS;
  const stale = dataStale || syncStale;

  const shownOf = React.useCallback(
    (p: WallPhoto) => overrides[p.id] ?? p.showOnWall !== false,
    [overrides]
  );

  const wallPhotos = React.useMemo(
    () => photos.filter((p) => shownOf(p)),
    [photos, shownOf]
  );
  const hiddenPhotos = React.useMemo(
    () => photos.filter((p) => !shownOf(p)),
    [photos, shownOf]
  );

  const activePreviewPhoto = wallPhotos.length > 0
    ? wallPhotos[previewIndex % wallPhotos.length]
    : null;

  // Run transition animation
  React.useEffect(() => {
    if (reduceMotion) {
      previewFade.value = 1;
      previewSlideX.value = 0;
      return;
    }
    const transitionType = settings.transition;
    if (transitionType === "cut") {
      previewFade.value = 1;
      previewSlideX.value = 0;
      return;
    }
    if (transitionType === "slide") {
      const dur = MOTION.glide;
      previewSlideX.value = 80;
      previewSlideX.value = withTiming(0, { duration: dur });
      previewFade.value = 0.2;
      previewFade.value = withTiming(1, { duration: dur });
      return;
    }
    const dur = transitionType === "dissolve" ? 850 : MOTION.glide;
    previewSlideX.value = 0;
    previewFade.value = 0;
    previewFade.value = withTiming(1, { duration: dur });
  }, [animTrigger, settings.transition, reduceMotion, previewFade, previewSlideX]);

  const animPreviewStyle = useAnimatedStyle(() => ({
    opacity: previewFade.value,
    transform: [{ translateX: previewSlideX.value }],
  }));

  const handleSelectTransition = (trans: PhotoTransition) => {
    if (!isParent || savingSettings) return;
    const nextSettings = { ...settings, transition: trans };
    setSettingsOverride(nextSettings);
    setAnimTrigger((t) => t + 1);
    setSavingSettings(true);
    void (async () => {
      try {
        await updatePhotoSettings({ transition: trans });
        toast.show(`Transition set to ${trans}`, { intent: "info" });
      } catch {
        setSettingsOverride(null);
        toast.show("Couldn't update transition setting.", { intent: "error" });
      } finally {
        setSavingSettings(false);
      }
    })();
  };

  const handleSelectCadence = (seconds: number) => {
    if (!isParent || savingSettings) return;
    const nextSettings = { ...settings, rotateSeconds: seconds };
    setSettingsOverride(nextSettings);
    setSavingSettings(true);
    void (async () => {
      try {
        await updatePhotoSettings({ rotateSeconds: seconds });
        toast.show(`Rotation speed set to ${seconds}s`, { intent: "info" });
      } catch {
        setSettingsOverride(null);
        toast.show("Couldn't update rotation cadence.", { intent: "error" });
      } finally {
        setSavingSettings(false);
      }
    })();
  };

  const handleSelectOrder = (order: PhotoOrder) => {
    if (!isParent || savingSettings) return;
    const nextSettings = { ...settings, order };
    setSettingsOverride(nextSettings);
    setSavingSettings(true);
    void (async () => {
      try {
        await updatePhotoSettings({ order });
        toast.show(`Photo order set to ${order}`, { intent: "info" });
      } catch {
        setSettingsOverride(null);
        toast.show("Couldn't update photo order.", { intent: "error" });
      } finally {
        setSavingSettings(false);
      }
    })();
  };

  const handleToggleCaptions = (showCaption: boolean) => {
    if (!isParent || savingSettings) return;
    const nextSettings = { ...settings, showCaption };
    setSettingsOverride(nextSettings);
    setSavingSettings(true);
    void (async () => {
      try {
        await updatePhotoSettings({ showCaption });
        toast.show(showCaption ? "Captions enabled on the wall" : "Captions hidden on the wall", { intent: "info" });
      } catch {
        setSettingsOverride(null);
        toast.show("Couldn't update caption setting.", { intent: "error" });
      } finally {
        setSavingSettings(false);
      }
    })();
  };

  const toggle = (photo: WallPhoto) => {
    if (!isParent || pendingIds.has(photo.id)) return;
    const next = !shownOf(photo);
    setPendingIds((ids) => new Set(ids).add(photo.id));
    setOverrides((o) => ({ ...o, [photo.id]: next }));
    void (async () => {
      try {
        await setPhotoShowOnWall(photo.id, next);
      } catch (e) {
        setOverrides((o) => {
          const rest = { ...o };
          delete rest[photo.id];
          return rest;
        });
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          toast.show(MOD_DENY_COPY, { intent: "error" });
        } else {
          toast.show(MOD_FAIL_COPY, { intent: "error" });
        }
      } finally {
        setPendingIds((ids) => {
          const rest = new Set(ids);
          rest.delete(photo.id);
          return rest;
        });
      }
    })();
  };

  const renderCell = (photo: WallPhoto) => {
    const shown = shownOf(photo);
    const label = photo.caption || "Family photo";
    const inner = (
      <>
        <Image
          testID={`photo-img-${photo.id}`}
          source={photoSource(photo)}
          accessibilityLabel={label}
          resizeMode="cover"
          style={[
            { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
            !shown && { opacity: 0.3 },
          ]}
        />
        <View
          style={{
            position: "absolute",
            left: 4,
            right: 4,
            bottom: 4,
            borderRadius: 8,
            paddingVertical: 4,
            alignItems: "center",
            backgroundColor: shown
              ? mix(colors["color-monster-ink-blue"], "transparent", 32)
              : mixAlpha(colors["color-surface-2"], 0.88),
          }}
        >
          <Text
            style={{
              color: shown ? colors["color-primary-foreground"] : colors["color-text-secondary"],
              fontSize: TYPOGRAPHY.label.fontSize,
              fontWeight: "700",
              textTransform: "uppercase",
            }}
          >
            {shown ? "On wall" : "Hidden"}
          </Text>
        </View>
      </>
    );
    const cellStyle = {
      width: "15.5%" as const,
      aspectRatio: 1,
      borderRadius: 18,
      overflow: "hidden" as const,
      backgroundColor: colors["color-surface-0"],
      borderWidth: 1,
      borderColor: colors["color-border"] ?? "transparent",
    };
    if (!isParent) {
      return (
        <View key={photo.id} testID={`photo-cell-${photo.id}`} style={cellStyle}>
          {inner}
        </View>
      );
    }
    return (
      <Pressable
        key={photo.id}
        testID={`photo-cell-${photo.id}`}
        accessibilityRole="switch"
        accessibilityLabel={shown ? `${label} — on the wall` : `${label} — hidden`}
        accessibilityState={{ checked: shown, busy: pendingIds.has(photo.id) }}
        onPress={() => toggle(photo)}
        style={cellStyle}
      >
        {inner}
      </Pressable>
    );
  };

  const uploaderCard = (
    <Material tier="regular" tone={accentColor} style={{ borderRadius: 24, padding: 18, gap: 14 }}>
      <Pressable
        testID="photos-upload"
        accessibilityLabel="Add photos"
        onPress={() => toast.show(UPLOAD_DEFER_COPY, { intent: "info" })}
        style={{
          minHeight: 100,
          borderRadius: 18,
          borderWidth: 2,
          borderStyle: "dashed",
          borderColor: colors["color-border"],
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        }}
      >
        <Text style={{ fontSize: 28 }}>📸</Text>
        <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "600" }}>
          Drop photos here, or tap to choose
        </Text>
        <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }}>
          The full-quality original is kept; the panel gets a resized copy.
        </Text>
      </Pressable>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700", letterSpacing: 1.2 }}>CAPTION</Text>
          <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize }}>Beach day</Text>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700", letterSpacing: 1.2 }}>ALBUM</Text>
          <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize }}>Oregon 2026</Text>
        </View>
      </View>
      <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }}>
        Applied to every file in this batch. An album keeps one trip from taking over the wall.
      </Text>
    </Material>
  );

  const displayedList = React.useMemo(() => {
    if (filterMode === "wall") return wallPhotos;
    if (filterMode === "hidden") return hiddenPhotos;
    return photos;
  }, [filterMode, wallPhotos, hiddenPhotos, photos]);

  return (
    <View testID="photos-page" style={{ flex: 1, paddingHorizontal: 24, paddingTop: 16 }}>
      <Pressable onPress={() => router.push("/")} style={{ minHeight: 44, alignSelf: "flex-start", justifyContent: "center" }} hitSlop={10}>
        <Text style={{ color: accentColor, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "600" }}>← Back to Home</Text>
      </Pressable>

      <View style={{ marginBottom: 16, marginTop: 4 }}>
        <Text style={{ color: colors["color-text-primary"], fontSize: 50, fontWeight: "700" }}>Photos</Text>
        <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.body.fontSize, marginTop: 4 }}>
          Pictures added here rotate through the wall on a slow, quiet loop.
        </Text>
        {stale && member ? (
          <Text
            testID="photos-stale"
            style={{
              color: colors["color-accent-amber"],
              fontSize: TYPOGRAPHY.label.fontSize,
              fontWeight: "600",
              marginTop: 6,
            }}
          >
            {READ_COPY_STALE}
          </Text>
        ) : null}
      </View>

      {!member ? (
        <SignedOutBanner
          title={SIGNED_OUT_BANNER}
          action={
            <Text
              style={{
                color: colors["color-accent-amber"],
                fontSize: TYPOGRAPHY.label.fontSize,
                fontWeight: "700",
                textDecorationLine: "underline",
              }}
            >
              Sign in with your PIN →
            </Text>
          }
          onPress={() => router.push("/settings")}
        />
      ) : null}

      {!member ? (
        <View style={{ flex: 1, marginTop: 16, gap: 16 }}>
          {uploaderCard}
          <View style={{ gap: 8 }}>
            <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.label.fontSize + 2, fontWeight: "700" }}>
              On the wall
            </Text>
            <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.body.fontSize }}>
              {GUEST_COPY}
            </Text>
          </View>
        </View>
      ) : status === "loading" ? (
        <View testID="photos-loading" accessibilityLabel={LOADING_COPY} style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={{ width: "15.5%", aspectRatio: 1, borderRadius: 18, backgroundColor: colors["color-surface-2"] }}
            />
          ))}
        </View>
      ) : status === "error" ? (
        <View testID="photos-error">
          <EmptyState
            icon="📸"
            title="Photos"
            body={READ_COPY[failure ?? "error"]}
            actionLabel={READ_RETRY_LABEL}
            onAction={retry}
          />
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 20, paddingBottom: 180 }} showsVerticalScrollIndicator={false}>
          {/* Section 1: Active Wall Display & Transition Showcase */}
          <Material tier="regular" tone={accentColor} style={{ borderRadius: 28, padding: 22, gap: 18 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ gap: 4 }}>
                <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.title.fontSize, fontWeight: "700" }}>
                  Now on the Wall
                </Text>
                <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }}>
                  {wallPhotos.length} {wallPhotos.length === 1 ? "photo" : "photos"} currently in active wall rotation
                </Text>
              </View>
              <View
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 12,
                  backgroundColor: mixAlpha(accentColor, 0.15),
                  borderWidth: 1,
                  borderColor: mixAlpha(accentColor, 0.3),
                }}
              >
                <Text style={{ color: accentColor, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
                  Transition: {settings.transition.toUpperCase()}
                </Text>
              </View>
            </View>

            {/* Live Preview & Transition Box */}
            <View style={{ flexDirection: "row", gap: 20, alignItems: "stretch" }}>
              {/* Photo preview frame */}
              <View
                style={{
                  width: 260,
                  height: 340,
                  borderRadius: RADII.xl,
                  overflow: "hidden",
                  backgroundColor: colors["color-surface-0"],
                  borderWidth: 1,
                  borderColor: colors["color-border"],
                }}
              >
                {activePreviewPhoto ? (
                  <>
                    <Animated.View style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }, animPreviewStyle]}>
                      <Image
                        testID="photo-preview-image"
                        source={photoSource(activePreviewPhoto)}
                        style={{ flex: 1 }}
                        resizeMode="cover"
                      />
                    </Animated.View>
                    {settings.showCaption ? (
                      <>
                        <LinearGradient
                          pointerEvents="none"
                          colors={["transparent", mix(colors["color-monster-ink-blue"], "transparent", 75)]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 0, y: 1 }}
                          style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 90 }}
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
                          {activePreviewPhoto.caption || fallbackCaption(activePreviewPhoto.takenAt) || "Family photo"}
                        </Text>
                      </>
                    ) : null}
                    <View
                      style={{
                        position: "absolute",
                        top: 10,
                        left: 10,
                        backgroundColor: mix(colors["color-monster-ink-blue"], "transparent", 40),
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 8,
                      }}
                    >
                      <Text style={{ color: colors["color-primary-foreground"], fontSize: TYPOGRAPHY.label.fontSize - 1, fontWeight: "700" }}>
                        {((previewIndex % wallPhotos.length) + 1)} / {wallPhotos.length}
                      </Text>
                    </View>
                  </>
                ) : (
                  <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 16 }}>
                    <Text style={{ fontSize: 32 }}>🖼️</Text>
                    <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, textAlign: "center", marginTop: 8 }}>
                      No photos active on the wall. Tap any photo below to show it.
                    </Text>
                  </View>
                )}
              </View>

              {/* Transition Settings Details */}
              <View style={{ flex: 1, gap: 14 }}>
                <View style={{ gap: 6 }}>
                  <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
                    Transition Effect
                  </Text>
                  <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }}>
                    Choose how photos animate when changing on the wall:
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                    {PHOTO_TRANSITION_OPTIONS.map((opt) => {
                      const selected = settings.transition === opt.id;
                      return (
                        <Pressable
                          key={opt.id}
                          testID={`transition-opt-${opt.id}`}
                          disabled={!isParent}
                          onPress={() => handleSelectTransition(opt.id)}
                          style={{
                            paddingHorizontal: 16,
                            paddingVertical: 10,
                            borderRadius: 14,
                            borderWidth: 1.5,
                            borderColor: selected ? accentColor : colors["color-border"],
                            backgroundColor: selected ? mixAlpha(accentColor, 0.18) : colors["color-surface-1"],
                            minWidth: 120,
                          }}
                        >
                          <Text
                            style={{
                              color: selected ? colors["color-text-primary"] : colors["color-text-secondary"],
                              fontSize: TYPOGRAPHY.label.fontSize,
                              fontWeight: selected ? "700" : "500",
                            }}
                          >
                            {opt.label}
                          </Text>
                          <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize - 2, marginTop: 2 }}>
                            {opt.description}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {/* Rotation Cadence and Order */}
                <View style={{ flexDirection: "row", gap: 16, marginTop: 4 }}>
                  <View style={{ flex: 1, gap: 6 }}>
                    <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
                      Rotation Speed
                    </Text>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {PHOTO_ROTATE_PRESETS.map((p) => {
                        const selected = settings.rotateSeconds === p.seconds;
                        return (
                          <Pressable
                            key={p.seconds}
                            testID={`rotate-preset-${p.seconds}`}
                            disabled={!isParent}
                            onPress={() => handleSelectCadence(p.seconds)}
                            style={{
                              paddingHorizontal: 12,
                              paddingVertical: 8,
                              borderRadius: 10,
                              backgroundColor: selected ? mixAlpha(accentColor, 0.2) : colors["color-surface-1"],
                              borderWidth: 1,
                              borderColor: selected ? accentColor : colors["color-border"],
                            }}
                          >
                            <Text
                              style={{
                                color: selected ? colors["color-text-primary"] : colors["color-text-secondary"],
                                fontSize: TYPOGRAPHY.label.fontSize,
                                fontWeight: selected ? "700" : "500",
                              }}
                            >
                              {p.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>

                  <View style={{ flex: 1, gap: 6 }}>
                    <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
                      Photo Order
                    </Text>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {PHOTO_ORDER_OPTIONS.map((ord) => {
                        const selected = settings.order === ord.id;
                        return (
                          <Pressable
                            key={ord.id}
                            testID={`order-opt-${ord.id}`}
                            disabled={!isParent}
                            onPress={() => handleSelectOrder(ord.id)}
                            style={{
                              paddingHorizontal: 12,
                              paddingVertical: 8,
                              borderRadius: 10,
                              backgroundColor: selected ? mixAlpha(accentColor, 0.2) : colors["color-surface-1"],
                              borderWidth: 1,
                              borderColor: selected ? accentColor : colors["color-border"],
                            }}
                          >
                            <Text
                              style={{
                                color: selected ? colors["color-text-primary"] : colors["color-text-secondary"],
                                fontSize: TYPOGRAPHY.label.fontSize,
                                fontWeight: selected ? "700" : "500",
                              }}
                            >
                              {ord.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                </View>

                {/* Captions Toggle & Preview Trigger */}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
                  <Toggle
                    value={settings.showCaption}
                    onChange={handleToggleCaptions}
                    label="Show Captions"
                    description="Displays photo date or caption on the wall"
                    disabled={!isParent}
                  />

                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <Pressable
                      testID="preview-prev-btn"
                      disabled={wallPhotos.length < 2}
                      onPress={() => {
                        setPreviewIndex((i) => (i - 1 + wallPhotos.length) % wallPhotos.length);
                        setAnimTrigger((t) => t + 1);
                      }}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 10,
                        backgroundColor: colors["color-surface-2"],
                      }}
                    >
                      <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "600" }}>
                        ◀ Prev
                      </Text>
                    </Pressable>

                    <Pressable
                      testID="preview-next-btn"
                      disabled={wallPhotos.length < 2}
                      onPress={() => {
                        setPreviewIndex((i) => (i + 1) % wallPhotos.length);
                        setAnimTrigger((t) => t + 1);
                      }}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 10,
                        backgroundColor: colors["color-surface-2"],
                      }}
                    >
                      <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "600" }}>
                        Next ▶
                      </Text>
                    </Pressable>

                    <Pressable
                      testID="preview-transition-btn"
                      onPress={() => setAnimTrigger((t) => t + 1)}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        borderRadius: 10,
                        backgroundColor: accentColor,
                      }}
                    >
                      <Text style={{ color: colors["color-primary-foreground"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
                        Test {settings.transition}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>

            {/* Rotation Queue Thumbnail Strip */}
            {wallPhotos.length > 0 ? (
              <View style={{ gap: 8, marginTop: 4 }}>
                <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "600" }}>
                  Active in rotation queue ({wallPhotos.length}):
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                  {wallPhotos.map((p, idx) => {
                    const isSelected = (previewIndex % wallPhotos.length) === idx;
                    return (
                      <Pressable
                        key={`strip-${p.id}`}
                        onPress={() => {
                          setPreviewIndex(idx);
                          setAnimTrigger((t) => t + 1);
                        }}
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: 12,
                          overflow: "hidden",
                          borderWidth: isSelected ? 2.5 : 1,
                          borderColor: isSelected ? accentColor : colors["color-border"],
                        }}
                      >
                        <Image
                          source={photoSource(p)}
                          style={{ width: "100%", height: "100%" }}
                          resizeMode="cover"
                        />
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}
          </Material>

          {/* Section 2: Library Curation & All Photos Grid */}
          <View style={{ gap: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ gap: 4 }}>
                <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.title.fontSize, fontWeight: "700" }}>
                  On the wall
                </Text>
                <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }}>
                  Tap any photo to toggle whether it appears on the wall.
                </Text>
              </View>

              {/* Filter Tabs */}
              <View style={{ flexDirection: "row", gap: 6, backgroundColor: colors["color-surface-1"], padding: 4, borderRadius: 12 }}>
                {(["all", "wall", "hidden"] as const).map((mode) => {
                  const active = filterMode === mode;
                  const count = mode === "all" ? photos.length : mode === "wall" ? wallPhotos.length : hiddenPhotos.length;
                  const label = mode === "all" ? "All" : mode === "wall" ? "On Wall" : "Hidden";
                  return (
                    <Pressable
                      key={mode}
                      onPress={() => setFilterMode(mode)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 8,
                        backgroundColor: active ? colors["color-surface-3"] : "transparent",
                      }}
                    >
                      <Text
                        style={{
                          color: active ? colors["color-text-primary"] : colors["color-text-muted"],
                          fontSize: TYPOGRAPHY.label.fontSize,
                          fontWeight: active ? "700" : "500",
                        }}
                      >
                        {label} ({count})
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {photos.length === 0 ? (
              <View testID="photos-empty">
                <EmptyState flat icon="📸" title="Photos" body={EMPTY_COPY} />
              </View>
            ) : (
              <View testID="photos-grid" style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {displayedList.map(renderCell)}
              </View>
            )}

            {!isParent && photos.length > 0 ? (
              <Text
                style={{
                  marginTop: 10,
                  color: colors["color-text-muted"],
                  fontSize: TYPOGRAPHY.label.fontSize,
                  textAlign: "center",
                }}
              >
                {KID_NOTE_COPY}
              </Text>
            ) : null}
          </View>

          {/* Section 3: Uploader Card */}
          {uploaderCard}
        </ScrollView>
      )}
    </View>
  );
}

export default PhotosPage;
