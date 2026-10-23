import React from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { TYPOGRAPHY } from "../theme/tokens";
import { musicTokensFor } from "../theme/music-tokens";
import { Modal } from "../ui/Modal";
import { useCast } from "./CastProvider";
import type { MediaTrack } from "./types";

export interface CastControlProps {
  track: MediaTrack | null;
}

export function CastControl({ track }: CastControlProps) {
  const { colors, theme, boost } = useTheme();
  const tokens = React.useMemo(() => musicTokensFor(theme, boost), [theme, boost]);
  const cast = useCast();
  const [open, setOpen] = React.useState(false);
  const [working, setWorking] = React.useState(false);

  const busy = cast.busy || working;
  const unavailable = cast.state === "unavailable";
  const searching = cast.state === "connecting" || busy;
  const castingLabel =
    cast.casting && cast.target
      ? `Casting · ${cast.target.name}`
      : cast.casting
        ? "Casting"
        : cast.target
          ? `Connected · ${cast.target.name}`
          : "Cast";

  const pick = async (id: string) => {
    if (busy) return;
    setWorking(true);
    try {
      const connected = await cast.connect(id);
      if (connected && track) await cast.startCast(track);
    } catch {
      // The provider surfaces its own failure copy; never let a rejecting
      // provider method escape through `void`.
    } finally {
      setWorking(false);
    }
  };

  const stop = async () => {
    if (busy) return;
    setWorking(true);
    try {
      await cast.disconnect();
    } catch {
      // The provider surfaces its own failure copy; never let a rejecting
      // provider method escape through `void`.
    } finally {
      setWorking(false);
    }
  };

  const nudgeVolume = async (delta: number) => {
    if (busy) return;
    try {
      await cast.adjustVolume(delta);
    } catch {
      // The provider owns receiver failures; a rejecting method must not
      // escape through `void`.
    }
  };

  const flipMute = async () => {
    if (busy) return;
    try {
      await cast.toggleMute();
    } catch {
      // The provider owns receiver failures; a rejecting method must not
      // escape through `void`.
    }
  };

  return (
    <>
      <Pressable
        testID="cast-open"
        accessibilityRole="button"
        accessibilityLabel={
          cast.casting && cast.target
            ? `Casting to ${cast.target.name}. Change cast device`
            : cast.target
              ? `Connected to ${cast.target.name}. Change cast device`
              : "Cast to a device"
        }
        onPress={() => setOpen(true)}
        style={{
          minHeight: 64,
          minWidth: 64,
          maxWidth: 300,
          paddingHorizontal: 18,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 999,
          backgroundColor: tokens.scrim,
          borderWidth: 1,
          borderColor: tokens.panelRim,
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            color: tokens.label,
            fontSize: TYPOGRAPHY.label.fontSize,
            fontWeight: "700",
          }}
        >
          {castingLabel}
        </Text>
      </Pressable>

      <Modal
        visible={open}
        onClose={() => setOpen(false)}
        title="Cast"
        testID="cast-modal"
      >
        <View style={{ gap: 12 }}>
          {cast.error ? (
            <Text
              testID="cast-error"
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={{
                color: colors["color-accent-rose"],
                fontSize: TYPOGRAPHY.body.fontSize,
                lineHeight: TYPOGRAPHY.body.lineHeight,
              }}
            >
              {cast.error}
            </Text>
          ) : null}

          {unavailable ? (
            <Text
              testID="cast-unavailable"
              style={{
                color: tokens.label2,
                fontSize: TYPOGRAPHY.body.fontSize,
                lineHeight: TYPOGRAPHY.body.lineHeight,
              }}
            >
              {"Casting isn't available on this device."}
            </Text>
          ) : searching && cast.devices.length === 0 ? (
            <Text
              testID="cast-searching"
              style={{
                color: tokens.label2,
                fontSize: TYPOGRAPHY.body.fontSize,
                lineHeight: TYPOGRAPHY.body.lineHeight,
              }}
            >
              Searching for cast devices…
            </Text>
          ) : cast.devices.length === 0 ? (
            <Text
              testID="cast-empty"
              style={{
                color: tokens.label2,
                fontSize: TYPOGRAPHY.body.fontSize,
                lineHeight: TYPOGRAPHY.body.lineHeight,
              }}
            >
              No cast devices found.
            </Text>
          ) : (
            cast.devices.map((device) => {
              const connected = cast.target?.id === device.id;
              return (
                <Pressable
                  key={device.id}
                  testID={`cast-device-${device.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Cast to ${device.name}`}
                  accessibilityState={{ disabled: busy, selected: connected }}
                  disabled={busy}
                  onPress={() => void pick(device.id)}
                  style={{
                    minHeight: 64,
                    paddingHorizontal: 16,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: tokens.panelRim,
                    backgroundColor: tokens.sheet,
                  }}
                >
                  <Text
                    numberOfLines={1}
                    style={{ flex: 1, color: tokens.label, fontSize: TYPOGRAPHY.body.fontSize }}
                  >
                    {device.name}
                  </Text>
                  {connected ? (
                    <Text style={{ color: tokens.label2, fontSize: TYPOGRAPHY.label.fontSize }}>
                      Connected
                    </Text>
                  ) : null}
                </Pressable>
              );
            })
          )}

          {cast.target !== null ? (
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Pressable
                  testID="cast-volume-down"
                  accessibilityRole="button"
                  accessibilityLabel="Volume down"
                  accessibilityState={{ disabled: busy }}
                  disabled={busy}
                  onPress={() => void nudgeVolume(-0.1)}
                  style={{
                    width: 64,
                    height: 64,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: tokens.panelRim,
                    backgroundColor: tokens.sheet,
                  }}
                >
                  <Text style={{ color: tokens.label, fontSize: TYPOGRAPHY.body.fontSize }}>
                    −
                  </Text>
                </Pressable>
                <Text
                  testID="cast-volume"
                  accessibilityLabel={`Volume ${Math.round(cast.volume * 100)} percent`}
                  style={{
                    flex: 1,
                    textAlign: "center",
                    color: tokens.label,
                    fontSize: TYPOGRAPHY.body.fontSize,
                    fontWeight: "700",
                  }}
                >
                  {Math.round(cast.volume * 100)}%
                </Text>
                <Pressable
                  testID="cast-volume-up"
                  accessibilityRole="button"
                  accessibilityLabel="Volume up"
                  accessibilityState={{ disabled: busy }}
                  disabled={busy}
                  onPress={() => void nudgeVolume(0.1)}
                  style={{
                    width: 64,
                    height: 64,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: tokens.panelRim,
                    backgroundColor: tokens.sheet,
                  }}
                >
                  <Text style={{ color: tokens.label, fontSize: TYPOGRAPHY.body.fontSize }}>
                    +
                  </Text>
                </Pressable>
              </View>
              <Pressable
                testID="cast-mute"
                accessibilityRole="button"
                accessibilityLabel={cast.muted ? "Unmute cast device" : "Mute cast device"}
                accessibilityState={{ disabled: busy, checked: cast.muted }}
                disabled={busy}
                onPress={() => void flipMute()}
                style={{
                  minHeight: 64,
                  paddingHorizontal: 20,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: tokens.panelRim,
                  backgroundColor: tokens.sheet,
                }}
              >
                <Text
                  style={{
                    color: tokens.label,
                    fontSize: TYPOGRAPHY.body.fontSize,
                    fontWeight: "700",
                  }}
                >
                  {cast.muted ? "Unmute" : "Mute"}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {cast.target !== null ? (
            <Pressable
              testID="cast-stop"
              accessibilityRole="button"
              accessibilityLabel="Stop casting"
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={() => void stop()}
              style={{
                minHeight: 64,
                paddingHorizontal: 20,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 14,
                borderWidth: 1,
                borderColor: tokens.panelRim,
                backgroundColor: tokens.scrim,
              }}
            >
              <Text style={{ color: tokens.label, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
                Stop casting
              </Text>
            </Pressable>
          ) : null}
        </View>
      </Modal>
    </>
  );
}

export default CastControl;
