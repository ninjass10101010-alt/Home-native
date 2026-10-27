import React from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { TYPOGRAPHY } from "../theme/tokens";
import { musicTokensFor } from "../theme/music-tokens";
import { useCast } from "./CastProvider";
import { useOutputVolume } from "./output-volume";

/** One accessibility step moves the receiver this far (2%). */
const VOLUME_STEP = 0.02;

/** The visual track's thickness; the touch area around it is 64dp. */
const TRACK_HEIGHT = 8;
const KNOB_SIZE = 18;

/**
 * RN 0.86 registers `onShouldBlockNativeResponder` as a direct event on
 * Android (it is in `BaseViewConfig.android.js`) but no longer publishes it
 * in `ViewProps`, so the bar declares the prop it needs. It is what keeps the
 * sheet's / stage's ScrollView from taking the drag away from the volume.
 */
type NativeResponderBlock = { onShouldBlockNativeResponder: () => boolean };
const BLOCK_NATIVE_RESPONDER = {
  onShouldBlockNativeResponder: () => true,
} as NativeResponderBlock;

export interface CastVolumeProps {
  /**
   * A single tight row for the Now Playing stage, instead of the sheet's
   * bar/percentage row with the mute button beneath it.
   */
  compact?: boolean;
  /**
   * The local audio player for contextual volume when not casting.
   */
  player?: { volume: number } | null;
}

/**
 * The receiver's volume and mute, shared by the cast sheet and the stage.
 *
 * When casting is active or a cast target is connected, controls the receiver.
 * Otherwise, seamlessly controls the local tablet audio output via useOutputVolume.
 * The horizontal bar is a responder: a tap anywhere sets the tapped fraction,
 * and a drag reports every move.
 * Tokens only, and the touch area is on the 64dp wall floor.
 */
export function CastVolume({ compact = false, player = null }: CastVolumeProps) {
  const { theme, boost } = useTheme();
  const tokens = React.useMemo(() => musicTokensFor(theme, boost), [theme, boost]);
  const cast = useCast();
  const volume = useOutputVolume(player);
  const isCast = volume.target === "cast";
  const busy = isCast ? cast.busy : false;
  const [barWidth, setBarWidth] = React.useState(0);

  const percent = Math.min(100, Math.max(0, Math.round(volume.value * 100)));

  const setLevel = async (value: number) => {
    if (busy) return;
    try {
      volume.setValue(value);
    } catch {
      // The provider owns receiver failures; a rejecting method must not
      // escape through `void`.
    }
  };

  const nudgeVolume = async (delta: number) => {
    if (busy) return;
    try {
      volume.nudge(delta);
    } catch {
      // The provider owns receiver failures; a rejecting method must not
      // escape through `void`.
    }
  };

  const flipMute = async () => {
    if (busy) return;
    try {
      volume.toggleMute();
    } catch {
      // The provider owns receiver failures; a rejecting method must not
      // escape through `void`.
    }
  };

  const setFromTouch = (locationX: number) => {
    if (busy || barWidth <= 0) return;
    void setLevel(Math.min(1, Math.max(0, locationX / barWidth)));
  };

  const ids = compact
    ? {
        row: "stage-volume",
        bar: "stage-volume-bar",
        mute: "stage-volume-mute",
        percent: "stage-volume-percent",
      }
    : {
        row: undefined,
        bar: "cast-volume-bar",
        mute: "cast-mute",
        percent: "cast-volume",
      };

  const muteStyle = {
    minHeight: 64,
    minWidth: 64,
    paddingHorizontal: 20,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.panelRim,
    backgroundColor: compact ? tokens.scrim : tokens.sheet,
  };

  const muteButton = (
    <Pressable
      testID={ids.mute}
      accessibilityRole="button"
      accessibilityLabel={
        isCast
          ? volume.muted
            ? "Unmute cast device"
            : "Mute cast device"
          : volume.muted
          ? "Unmute"
          : "Mute"
      }
      accessibilityState={{ disabled: busy, checked: volume.muted }}
      disabled={busy}
      onPress={() => void flipMute()}
      style={muteStyle}
    >
      <Text style={{ color: tokens.label, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
        {volume.muted ? "Unmute" : "Mute"}
      </Text>
    </Pressable>
  );

  return (
    <View
      testID={ids.row}
      style={
        compact
          ? { flexDirection: "row", alignItems: "center", gap: 12 }
          : { gap: 12 }
      }
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          flex: compact ? 1 : undefined,
        }}
      >
        <Text style={{ fontSize: 16 }}>
          {volume.muted ? "🔇" : percent === 0 ? "🔈" : percent < 50 ? "🔉" : "🔊"}
        </Text>
        <View
          testID={ids.bar}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={isCast ? "Cast volume" : "Volume"}
          accessibilityValue={{ min: 0, max: 100, now: percent, text: `${percent}%` }}
          accessibilityState={{ disabled: busy }}
          accessibilityActions={[
            { name: "increment", label: "Volume up" },
            { name: "decrement", label: "Volume down" },
          ]}
          onAccessibilityAction={(event) => {
            const action = event.nativeEvent.actionName;
            if (action === "increment") void nudgeVolume(VOLUME_STEP);
            if (action === "decrement") void nudgeVolume(-VOLUME_STEP);
          }}
          onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}
          onStartShouldSetResponder={() => !busy}
          onMoveShouldSetResponder={() => !busy}
          onResponderGrant={(event) => setFromTouch(event.nativeEvent.locationX)}
          onResponderMove={(event) => setFromTouch(event.nativeEvent.locationX)}
          onResponderRelease={(event) => setFromTouch(event.nativeEvent.locationX)}
          // The bar lives inside a ScrollView (the stage, and the sheet's
          // modal body). Without this the scroll takes the gesture and a drag
          // scrolls the panel instead of moving the volume.
          {...BLOCK_NATIVE_RESPONDER}
          style={{ flex: 1, height: 64, justifyContent: "center" }}
        >
          <View
            style={{
              height: TRACK_HEIGHT,
              borderRadius: TRACK_HEIGHT / 2,
              borderWidth: 1,
              borderColor: tokens.panelRim,
              backgroundColor: tokens.scrim,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                width: `${percent}%`,
                height: "100%",
                borderRadius: TRACK_HEIGHT / 2,
                backgroundColor: volume.muted ? tokens.label3 : tokens.accent,
              }}
            />
          </View>
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: (64 - KNOB_SIZE) / 2,
              left: `${percent}%`,
              marginLeft: -KNOB_SIZE / 2,
              width: KNOB_SIZE,
              height: KNOB_SIZE,
              borderRadius: KNOB_SIZE / 2,
              backgroundColor: tokens.label,
              borderWidth: 1,
              borderColor: tokens.panelRim,
            }}
          />
        </View>
        <Text
          testID={ids.percent}
          accessibilityLabel={`Volume ${percent} percent`}
          style={{
            minWidth: 52,
            textAlign: "right",
            color: tokens.label,
            fontSize: TYPOGRAPHY.body.fontSize,
            fontWeight: "700",
          }}
        >
          {percent}%
        </Text>
      </View>
      {muteButton}
    </View>
  );
}

export default CastVolume;
