import React from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { TYPOGRAPHY } from "../theme/tokens";
import { musicTokensFor } from "../theme/music-tokens";
import { useCast } from "./CastProvider";

/** One button press moves the receiver this far (2%). */
const VOLUME_STEP = 0.02;

export interface CastVolumeProps {
  /**
   * A single tight row for the Now Playing stage, instead of the sheet's
   * down/level/up row with the mute button beneath it.
   */
  compact?: boolean;
}

/**
 * The receiver's volume and mute, shared by the cast sheet and the stage.
 *
 * The controls read the SAME provider the cast session drives; the level is
 * the receiver's own, never a local guess. Tokens only, and every target is
 * on the 64dp wall floor.
 */
export function CastVolume({ compact = false }: CastVolumeProps) {
  const { theme, boost } = useTheme();
  const tokens = React.useMemo(() => musicTokensFor(theme, boost), [theme, boost]);
  const cast = useCast();
  const busy = cast.busy;

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

  const ids = compact
    ? {
        row: "stage-volume",
        down: "stage-volume-down",
        up: "stage-volume-up",
        mute: "stage-volume-mute",
        percent: "stage-volume-percent",
      }
    : {
        row: undefined,
        down: "cast-volume-down",
        up: "cast-volume-up",
        mute: "cast-mute",
        percent: "cast-volume",
      };

  const fill = compact ? tokens.scrim : tokens.sheet;
  const disc = {
    width: 64,
    height: 64,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.panelRim,
    backgroundColor: fill,
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
    backgroundColor: fill,
  };

  const muteButton = (
    <Pressable
      testID={ids.mute}
      accessibilityRole="button"
      accessibilityLabel={cast.muted ? "Unmute cast device" : "Mute cast device"}
      accessibilityState={{ disabled: busy, checked: cast.muted }}
      disabled={busy}
      onPress={() => void flipMute()}
      style={muteStyle}
    >
      <Text style={{ color: tokens.label, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
        {cast.muted ? "Unmute" : "Mute"}
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
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable
          testID={ids.down}
          accessibilityRole="button"
          accessibilityLabel="Volume down"
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={() => void nudgeVolume(-VOLUME_STEP)}
          style={disc}
        >
          <Text style={{ color: tokens.label, fontSize: TYPOGRAPHY.body.fontSize }}>−</Text>
        </Pressable>
        <Text
          testID={ids.percent}
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
          testID={ids.up}
          accessibilityRole="button"
          accessibilityLabel="Volume up"
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={() => void nudgeVolume(VOLUME_STEP)}
          style={disc}
        >
          <Text style={{ color: tokens.label, fontSize: TYPOGRAPHY.body.fontSize }}>+</Text>
        </Pressable>
        {compact ? muteButton : null}
      </View>
      {compact ? null : muteButton}
    </View>
  );
}

export default CastVolume;
