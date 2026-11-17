import React from "react";
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  createAudioPlayer,
} from "expo-audio";
import { api } from "../api/client";

export interface VoiceChatState {
  recording: boolean;
  transcribing: boolean;
  speaking: boolean;
  voiceReplyEnabled: boolean;
  error: string | null;
  toggleVoiceReply: () => void;
  startRecording: () => Promise<boolean>;
  stopRecording: () => Promise<string | null>;
  speak: (text: string) => Promise<void>;
}

export function useVoiceChat(): VoiceChatState {
  const [recording, setRecording] = React.useState(false);
  const [transcribing, setTranscribing] = React.useState(false);
  const [speaking, setSpeaking] = React.useState(false);
  const [voiceReplyEnabled, setVoiceReplyEnabled] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const currentPlayerRef = React.useRef<any>(null);
  const aliveRef = React.useRef(true);

  React.useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      if (currentPlayerRef.current) {
        try {
          currentPlayerRef.current.pause?.();
          currentPlayerRef.current.remove?.();
        } catch {
          // ignore cleanup errors
        }
      }
    };
  }, []);

  const toggleVoiceReply = React.useCallback(() => {
    setVoiceReplyEnabled((prev) => !prev);
  }, []);

  const startRecording = React.useCallback(async (): Promise<boolean> => {
    setError(null);
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm?.granted) {
        setError("Microphone permission denied");
        return false;
      }

      await recorder.prepareToRecordAsync();
      recorder.record();
      if (aliveRef.current) {
        setRecording(true);
      }
      return true;
    } catch (e: any) {
      if (aliveRef.current) {
        setError(e?.message || "Could not start microphone");
        setRecording(false);
      }
      return false;
    }
  }, [recorder]);

  const stopRecording = React.useCallback(async (): Promise<string | null> => {
    if (!recording) return null;
    setRecording(false);
    setTranscribing(true);
    setError(null);

    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) {
        setTranscribing(false);
        return null;
      }

      const formData = new FormData();
      formData.append("audio", {
        uri,
        name: "voice.m4a",
        type: "audio/m4a",
      } as any);

      const res = (await api<{ ok?: boolean; text?: string; error?: string }>("/api/voice/transcribe", {
        method: "POST",
        body: formData,
      })) as any;

      if (!aliveRef.current) return null;

      const transcript = (res?.text || "").trim();
      return transcript || null;
    } catch (e: any) {
      if (aliveRef.current) {
        setError(e?.message || "Transcription failed");
      }
      return null;
    } finally {
      if (aliveRef.current) {
        setTranscribing(false);
      }
    }
  }, [recorder, recording]);

  const speak = React.useCallback(
    async (text: string) => {
      if (!text || !text.trim()) return;
      try {
        if (currentPlayerRef.current) {
          try {
            currentPlayerRef.current.pause?.();
            currentPlayerRef.current.remove?.();
          } catch {
            // ignore
          }
          currentPlayerRef.current = null;
        }

        const res = (await api<{ ok?: boolean; url?: string }>("/api/voice/tts", {
          method: "POST",
          body: { message: text },
        })) as any;

        if (!aliveRef.current) return;

        if (res?.url) {
          const player = createAudioPlayer(res.url);
          currentPlayerRef.current = player;
          setSpeaking(true);
          player.play();
        }
      } catch {
        // Honest degradation: chat bubble remains visible even if TTS fails
      } finally {
        if (aliveRef.current) {
          setSpeaking(false);
        }
      }
    },
    []
  );

  return {
    recording,
    transcribing,
    speaking,
    voiceReplyEnabled,
    error,
    toggleVoiceReply,
    startRecording,
    stopRecording,
    speak,
  };
}
