import React from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { musicTokensFor } from "../theme/music-tokens";
import { Modal } from "../ui/Modal";
import { CastVolume } from "./CastVolume";
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
          maxWidth: 320,
          paddingHorizontal: 18,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          borderRadius: 999,
          backgroundColor: tokens.scrim,
          borderWidth: 1,
          borderColor: tokens.panelRim,
        }}
      >
        <Text style={{ fontSize: 18 }}>{cast.casting ? "🔊" : "📺"}</Text>
        <Text
          numberOfLines={1}
          style={{
            color: tokens.label,
            fontSize: 16,
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
        style={{
          maxWidth: 780,
          width: "92%",
          padding: 32,
          borderRadius: 32,
        }}
      >
        <View style={{ gap: 16 }}>
          {cast.error ? (
            <Text
              testID="cast-error"
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={{
                color: colors["color-accent-rose"],
                fontSize: 18,
                lineHeight: 26,
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
                fontSize: 18,
                lineHeight: 26,
              }}
            >
              {"Casting isn't available on this device."}
            </Text>
          ) : searching && cast.devices.length === 0 ? (
            <Text
              testID="cast-searching"
              style={{
                color: tokens.label2,
                fontSize: 18,
                lineHeight: 26,
              }}
            >
              Searching for cast devices…
            </Text>
          ) : cast.devices.length === 0 ? (
            <Text
              testID="cast-empty"
              style={{
                color: tokens.label2,
                fontSize: 18,
                lineHeight: 26,
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
                    minHeight: 76,
                    paddingHorizontal: 22,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 16,
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: tokens.panelRim,
                    backgroundColor: tokens.sheet,
                  }}
                >
                  <Text style={{ fontSize: 22 }}>{connected ? "🔊" : "📺"}</Text>
                  <Text
                    numberOfLines={1}
                    style={{ flex: 1, color: tokens.label, fontSize: 20, fontWeight: "600" }}
                  >
                    {device.name}
                  </Text>
                  {connected ? (
                    <View
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 999,
                        backgroundColor: tokens.scrim,
                        borderWidth: 1,
                        borderColor: tokens.panelRim,
                      }}
                    >
                      <Text style={{ color: tokens.label, fontSize: 16, fontWeight: "600" }}>
                        Connected
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })
          )}

          {cast.target !== null ? <CastVolume /> : null}

          {cast.target !== null ? (
            <Pressable
              testID="cast-stop"
              accessibilityRole="button"
              accessibilityLabel="Stop casting"
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={() => void stop()}
              style={{
                minHeight: 76,
                paddingHorizontal: 24,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 18,
                borderWidth: 1,
                borderColor: tokens.panelRim,
                backgroundColor: tokens.scrim,
              }}
            >
              <Text style={{ color: tokens.label, fontSize: 20, fontWeight: "700" }}>
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
