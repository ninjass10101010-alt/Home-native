import React, { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { createAudioPlayer } from "expo-audio";
import { api } from "../api/client";
import { getBaseUrl } from "../api/config";
import { playNotificationSound } from "./soundEffects";
import { postActiveNotification } from "./notificationFeed";

export interface BroadcastItem {
  id: string;
  message: string;
  title?: string;
  sender?: string;
  audioUrl?: string;
  muteAudio?: boolean;
  createdAt?: string;
}

const BACKOFF_MS = 5000;
const LONG_POLL_TIMEOUT_MS = 25000;
const TICK_DELAY_MS = 200;

export function useBroadcastReceiver(): void {
  const aliveRef = useRef(true);
  const lastIdRef = useRef<string>("now");
  const currentPlayerRef = useRef<any>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    aliveRef.current = true;

    async function handleBroadcast(item: BroadcastItem) {
      if (!aliveRef.current || !item?.message) return;
      if (seenIdsRef.current.has(item.id)) return;
      seenIdsRef.current.add(item.id);

      // Keep seenIds bounded to last 50
      if (seenIdsRef.current.size > 50) {
        const first = seenIdsRef.current.values().next().value;
        if (first) seenIdsRef.current.delete(first);
      }

      // 1. Play attention chime unless speakers already handled audio
      if (item.muteAudio !== true) {
        try {
          await playNotificationSound("chime", 0.9);
        } catch {
          // ignore sound errors
        }
      }

      // 2. Post visual announcement to MusicIsland / notification banner
      postActiveNotification({
        id: `broadcast-${item.id}`,
        category: "general",
        title: item.title || "Family Announcement 📢",
        body: item.message,
        timestamp: Date.now(),
      });

      // 3. Play voice speech via Piper TTS unless speakers already handled audio
      if (item.muteAudio !== true && item.audioUrl && Platform.OS !== "web") {
        try {
          if (currentPlayerRef.current) {
            try {
              currentPlayerRef.current.pause?.();
              currentPlayerRef.current.remove?.();
            } catch {
              // ignore cleanup errors
            }
            currentPlayerRef.current = null;
          }

          let finalUrl = item.audioUrl;
          if (finalUrl.startsWith("/")) {
            finalUrl = `${getBaseUrl()}${finalUrl}`;
          }

          const player = createAudioPlayer(finalUrl);
          currentPlayerRef.current = player;
          player.play();

          // Auto-cleanup player resource after 30s
          if (audioTimerRef.current) clearTimeout(audioTimerRef.current);
          audioTimerRef.current = setTimeout(() => {
            if (currentPlayerRef.current === player) {
              try {
                player.remove?.();
              } catch {
                // ignore
              }
              currentPlayerRef.current = null;
            }
          }, 30000);
        } catch (err) {
          console.warn("[BroadcastReceiver] Audio playback failed:", err);
        }
      }
    }

    async function doPoll() {
      if (!aliveRef.current) return;
      try {
        const res = (await api<{
          ok?: boolean;
          broadcasts?: BroadcastItem[];
          latestId?: string;
        }>(`/api/broadcast?since=${lastIdRef.current}&timeout=${LONG_POLL_TIMEOUT_MS}`)) as any;

        if (!aliveRef.current) return;

        if (res?.latestId && lastIdRef.current === "now") {
          lastIdRef.current = res.latestId;
        }

        const broadcasts = Array.isArray(res?.broadcasts) ? res.broadcasts : [];
        for (const b of broadcasts) {
          if (b?.id) {
            lastIdRef.current = b.id;
            await handleBroadcast(b);
          }
        }
        scheduleNextPoll(TICK_DELAY_MS);
      } catch {
        if (!aliveRef.current) return;
        scheduleNextPoll(BACKOFF_MS);
      }
    }

    function scheduleNextPoll(delayMs: number) {
      if (!aliveRef.current) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void doPoll();
      }, delayMs);
    }

    // Small boot delay so network and auth hydrate first
    const bootDelay = typeof jest !== "undefined" ? 0 : 1500;
    scheduleNextPoll(bootDelay);

    return () => {
      aliveRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (audioTimerRef.current) {
        clearTimeout(audioTimerRef.current);
        audioTimerRef.current = null;
      }
      if (currentPlayerRef.current) {
        try {
          currentPlayerRef.current.pause?.();
          currentPlayerRef.current.remove?.();
        } catch {
          // ignore
        }
        currentPlayerRef.current = null;
      }
    };
  }, []);
}

export function BroadcastReceiver(): React.ReactNode {
  useBroadcastReceiver();
  return null;
}
