import React from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { api, ApiError } from "../api/client";
import { useTheme } from "../theme/ThemeProvider";
import { TYPOGRAPHY } from "../theme/tokens";
import { useAuth } from "../state/AuthProvider";
import { useSync } from "../state/SyncManager";
import { Chip } from "../ui/Chip";
import { EmptyState } from "../ui/EmptyState";
import { SoftButton } from "../ui/SoftButton";
import { useToast } from "../ui/Toast";
import { READ_COPY, READ_COPY_STALE, READ_RETRY_LABEL, useWidgetData } from "../home/widgets/data";
import { photoSource, setPhotoShowOnWall, type WallPhoto } from "./library";

/**
 * The wall's Photos surface (WS-8): the shared family library as a management
 * grid (GET /api/photos?all=1 — hidden pictures stay listed, web parity).
 *
 * Moderation is `showOnWall`, not delete — a toggle, not a removal
 * (WallPhotoGrid parity). It is parent-only GATED BEFORE the tap: kids see the
 * library read-only with honest copy, and the server's live parent re-verify
 * (verifyLiveParentSession) stays the authority either way — a stale cookie
 * role is never trusted (a 401/403 refusal here tells the truth instead of
 * keeping the fake flip).
 *
 * Uploads are genuinely a phone job (the wall has no camera roll), so the
 * affordance says so instead of faking an uploader.
 */

const GUEST_COPY = "Sign in with your PIN to see the family's photos.";
const LOADING_COPY = "Loading the family's photos…";
const EMPTY_COPY = "Nothing uploaded yet — add the first picture from the phone and it lands on the wall.";
const UPLOAD_DEFER_COPY = "Uploads from the wall arrive with the next wave — use the phone.";
const KID_NOTE_COPY = "A parent picks what's on the wall.";
const MOD_FAIL_COPY = "Couldn't update the photo — try again.";
const MOD_DENY_COPY = "Only a parent can change what's on the wall.";

export function PhotosPage() {
  const { colors } = useTheme();
  const toast = useToast();
  const { member } = useAuth();
  const { stale: syncStale } = useSync();

  const { status, data, failure, stale: dataStale, retry } = useWidgetData<{ photos: WallPhoto[] }>(async () => {
    const res = await api<{ ok: boolean; photos: WallPhoto[] }>("/api/photos?all=1");
    return { photos: Array.isArray(res?.photos) ? res.photos : [] };
  });

  // Optimistic moderation state (web parity): the flip paints instantly; a
  // refusal removes it. A fresh feed (new data identity) is the truth and
  // supersedes anything optimistic still on screen.
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
        <View style={{ position: "absolute", bottom: 10, alignSelf: "center" }}>
          <Chip
            as="span"
            size="sm"
            tone={shown ? "accent" : "neutral"}
            label={shown ? "On wall" : "Hidden"}
          />
        </View>
      </>
    );
    const cellStyle = {
      width: "48%" as const,
      aspectRatio: 1,
      borderRadius: 20,
      overflow: "hidden" as const,
      backgroundColor: colors["color-surface-0"],
      borderWidth: 1,
      borderColor: colors["color-border"] ?? "transparent",
      minHeight: 64,
    };
    if (!isParent) {
      // Kids see the library, never the lever (no dead affordances).
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

  return (
    <View testID="photos-page" style={{ flex: 1, paddingHorizontal: 24, paddingTop: 16 }}>
      {/* Page header (web hero parity) */}
      <View style={{ marginBottom: 20 }}>
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
        <EmptyState icon="📸" title="Photos" body={GUEST_COPY} />
      ) : status === "loading" ? (
        <View testID="photos-loading" accessibilityLabel={LOADING_COPY} style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={{ width: "48%", aspectRatio: 1, borderRadius: 20, backgroundColor: colors["color-surface-2"] }}
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
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", marginBottom: 16 }}>
            <SoftButton
              variant="secondary"
              size="sm"
              testID="photos-upload"
              accessibilityLabel="Add photos"
              onPress={() => toast.show(UPLOAD_DEFER_COPY, { intent: "info" })}
            >
              📷 Add photos
            </SoftButton>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 180 }} showsVerticalScrollIndicator={false}>
            {photos.length === 0 ? (
              <View testID="photos-empty">
                <EmptyState flat icon="📸" title="Photos" body={EMPTY_COPY} />
              </View>
            ) : (
              <View testID="photos-grid" style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                {photos.map(renderCell)}
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
