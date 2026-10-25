import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCast } from "./CastProvider";

const VOLUME_KEY = "music.localVolume";
const DEFAULT_VOLUME = 0.5;

export function useOutputVolume(player: { volume: number } | null) {
  const cast = useCast();
  const [localVolume, setLocalVolume] = useState(DEFAULT_VOLUME);
  const [localMuted, setLocalMuted] = useState(false);

  // Hydrate local volume from storage
  useEffect(() => {
    AsyncStorage.getItem(VOLUME_KEY)
      .then((v) => {
        if (v) {
          const parsed = parseFloat(v);
          if (!isNaN(parsed)) {
            setLocalVolume(Math.max(0, Math.min(1, parsed)));
          }
        }
      })
      .catch(() => {});
  }, []);

  // Local volume setters (always called, regardless of casting state)
  const setValueLocal = useCallback(
    (v: number) => {
      const clamped = Math.max(0, Math.min(1, v));
      setLocalVolume(clamped);

      const p = player as any;
      if (p) {
        try {
          // eslint-disable-next-line react-hooks/immutability
          p.volume = localMuted ? 0 : clamped;
        } catch (e) {
          console.warn("Local volume set failed", e);
        }
      }

      AsyncStorage.setItem(VOLUME_KEY, clamped.toString()).catch(() => {});
    },
    [player, localMuted]
  );

  const nudgeLocal = useCallback(
    (delta: number) => {
      setValueLocal(localVolume + delta);
    },
    [localVolume, setValueLocal]
  );

  const toggleMuteLocal = useCallback(() => {
    const newMuted = !localMuted;
    setLocalMuted(newMuted);

    const p = player as any;
    if (p) {
      try {
        // eslint-disable-next-line react-hooks/immutability
        p.volume = newMuted ? 0 : localVolume;
      } catch (e) {
        console.warn("Local mute toggle failed", e);
      }
    }
  }, [localMuted, localVolume, player]);

  const target = cast.casting ? "cast" : "local";

  // Cast path
  if (cast.casting) {
    return {
      value: cast.volume,
      muted: cast.muted,
      setValue: cast.setVolume,
      nudge: cast.adjustVolume,
      toggleMute: cast.toggleMute,
      target,
    };
  }

  // Local path
  return {
    value: localVolume,
    muted: localMuted,
    setValue: setValueLocal,
    nudge: nudgeLocal,
    toggleMute: toggleMuteLocal,
    target,
  };
}
