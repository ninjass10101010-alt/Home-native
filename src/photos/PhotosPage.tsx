import React from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { api, ApiError } from "../api/client";
import { useTheme } from "../theme/ThemeProvider";
import { TYPOGRAPHY } from "../theme/tokens";
import { mix } from "../theme/mix";
import { useAuth } from "../state/AuthProvider";
import { useSync } from "../state/SyncManager";
import { Material } from "../theme/Material";
import { EmptyState } from "../ui/EmptyState";
import { SignedOutBanner } from "../ui/SignedOutBanner";
import { useToast } from "../ui/Toast";
import { mixAlpha } from "../ui/SoftButton";
import { useRouter } from "expo-router";
import { READ_COPY, READ_COPY_STALE, READ_RETRY_LABEL, useWidgetData } from "../home/widgets/data";
import { photoSource, setPhotoShowOnWall, type WallPhoto } from "./library";

const GUEST_COPY = "Sign in with your PIN to see the family's photos.";
const LOADING_COPY = "Loading the family's photos…";
const EMPTY_COPY = "Nothing uploaded yet — add the first picture from the phone and it lands on the wall.";
const UPLOAD_DEFER_COPY = "Uploads from the wall arrive with the next wave — use the phone.";
const KID_NOTE_COPY = "A parent picks what's on the wall.";
const MOD_FAIL_COPY = "Couldn't update the photo — try again.";
const MOD_DENY_COPY = "Only a parent can change what's on the wall.";
const SIGNED_OUT_BANNER = "🔐 Signed out — showing your saved copy.";

export function PhotosPage() {
  const { colors, accentColor } = useTheme();
  const toast = useToast();
  const router = useRouter();
  const { member } = useAuth();
  const { stale: syncStale } = useSync();

  const { status, data, failure, stale: dataStale, retry } = useWidgetData<{ photos: WallPhoto[] }>(async () => {
    const res = await api<{ ok: boolean; photos: WallPhoto[] }>("/api/photos?all=1");
    return { photos: Array.isArray(res?.photos) ? res.photos : [] };
  });

  const [overrides, setOverrides] = React.useState<Record<string, boolean>>({});
  const [pendingIds, setPendingIds] = React.useState<ReadonlySet<string>>(new Set());
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on data identity change (the family's truth wins)
    setOverrides({});
  }, [data]);

  const isParent = !!member && member.role === "parent";
  const photos = data?.photos ?? [];
  const stale = dataStale || syncStale;
  const shownOf = (p: WallPhoto) => overrides[p.id] ?? p.showOnWall !== false;

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
        <View style={{ position: "absolute", left: 4, right: 4, bottom: 4, borderRadius: 8, paddingVertical: 4, alignItems: "center", backgroundColor: shown ? mix(colors["color-monster-ink-blue"], "transparent", 32) : mixAlpha(colors["color-surface-2"], 0.88) }}>
          <Text style={{ color: shown ? colors["color-primary-foreground"] : colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700", textTransform: "uppercase" }}>
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
          minHeight: 120,
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

  return (
    <View testID="photos-page" style={{ flex: 1, paddingHorizontal: 24, paddingTop: 16 }}>
      <Pressable onPress={() => router.push("/")} style={{ minHeight: 44, alignSelf: "flex-start", justifyContent: "center" }} hitSlop={10}>
        <Text style={{ color: accentColor, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "600" }}>← Back to Home</Text>
      </Pressable>

      <View style={{ marginBottom: 20, marginTop: 8 }}>
        <Text style={{ color: colors["color-text-primary"], fontSize: 54, fontWeight: "700" }}>Photos</Text>
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
        <View style={{ flex: 1, gap: 16 }}>
          {uploaderCard}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 180 }} showsVerticalScrollIndicator={false}>
            {photos.length === 0 ? (
              <View testID="photos-empty">
                <EmptyState flat icon="📸" title="Photos" body={EMPTY_COPY} />
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.label.fontSize + 2, fontWeight: "700" }}>
                  On the wall
                </Text>
                <View testID="photos-grid" style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                  {photos.map(renderCell)}
                </View>
              </View>
            )}
            {!isParent && photos.length > 0 ? (
              <Text
                style={{
                  marginTop: 20,
                  color: colors["color-text-muted"],
                  fontSize: TYPOGRAPHY.label.fontSize,
                  textAlign: "center",
                }}
              >
                {KID_NOTE_COPY}
              </Text>
            ) : null}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

export default PhotosPage;
