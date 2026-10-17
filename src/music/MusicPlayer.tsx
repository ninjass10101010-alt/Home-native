import React from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Audio } from "expo-av";
let CastButton: any = null;
try { CastButton = require("react-native-google-cast").CastButton; } catch { CastButton = null; }
import { getBaseUrl } from "../api/config";
import { loadSessionCookie } from "../api/session";
import { useTheme } from "../theme/ThemeProvider";
import { TYPOGRAPHY } from "../theme/tokens";

type Track = { id: string; title: string; artist: string; artworkUrl?: string | null };

export function MusicPlayer() {
  const { colors, accentColor } = useTheme();
  const [query, setQuery] = React.useState("");
  const [tracks, setTracks] = React.useState<Track[]>([]);
  const [queue, setQueue] = React.useState<Track[]>([]);
  const [queueIndex, setQueueIndex] = React.useState(0);
  const [lyrics, setLyrics] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [current, setCurrent] = React.useState<Track | null>(null);
  const [playing, setPlaying] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);
  const [position, setPosition] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const soundRef = React.useRef<Audio.Sound | null>(null);

  const search = async () => {
    setLoading(true);
    setError(null);
    try {
      const cookie = await loadSessionCookie();
      const base = getBaseUrl();
      const res = await fetch(`${base}/api/media/search?q=${encodeURIComponent(query)}`, {
        headers: cookie ? { Cookie: `consuela_session=${cookie}` } : {},
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "search_failed");
      setTracks(Array.isArray(json?.tracks) ? json.tracks : []);
    } catch (e: any) {
      setError(e?.message ?? "search_failed");
    } finally {
      setLoading(false);
    }
  };

  const playTrack = async (track: Track, replaceQueue = true) => {
    if (replaceQueue) {
      setQueue([track]);
      setQueueIndex(0);
    }
    setLyrics(null);
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      const cookie = await loadSessionCookie();
      const base = getBaseUrl();
      const { sound } = await Audio.Sound.createAsync(
        { uri: `${base}/api/media/stream?id=${track.id}`, headers: cookie ? { Cookie: `consuela_session=${cookie}` } : {} },
        { shouldPlay: true }
      );
      soundRef.current = sound;
      setCurrent(track);
      setPlaying(true);
      void fetchLyrics(track);
      sound.setOnPlaybackStatusUpdate((s: any) => {
        if (s?.isLoaded) {
          setPosition(s.positionMillis ?? 0);
          setDuration(s.durationMillis ?? 0);
        }
        if (s?.didJustFinish) setPlaying(false);
      });
    } catch (e: any) {
      setError(e?.message ?? "play_failed");
    }
  };

  const toggle = async () => {
    const s = soundRef.current;
    if (!s) return;
    const status: any = await s.getStatusAsync();
    if (status?.isPlaying) {
      await s.pauseAsync();
      setPlaying(false);
    } else {
      await s.playAsync();
      setPlaying(true);
    }
  };

  const fetchLyrics = async (track: Track) => {
    try {
      const url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(track.artist)}&track_name=${encodeURIComponent(track.title)}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const json = await res.json();
      setLyrics(typeof json?.syncedLyrics === "string" ? json.syncedLyrics : (typeof json?.plainLyrics === "string" ? json.plainLyrics : null));
    } catch {
      setLyrics(null);
    }
  };

  const addToQueue = (track: Track) => {
    setQueue((q) => [...q, track]);
  };

  const playNext = async () => {
    if (queue.length === 0) return;
    const nextIndex = (queueIndex + 1) % queue.length;
    setQueueIndex(nextIndex);
    await playTrack(queue[nextIndex], false);
  };

  React.useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync();
    };
  }, []);

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.title.fontSize, fontWeight: "700" }}>Music</Text>
        <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: colors["color-accent-mint"] }}>
          <Text style={{ color: colors["color-text-on-accent"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>Ad-free</Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search YouTube Music…"
          style={{ flex: 1, borderWidth: 1, borderColor: colors["color-border"], borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: colors["color-text-primary"] }}
        />
        <Pressable onPress={search} style={{ paddingHorizontal: 16, justifyContent: "center", borderRadius: 12, backgroundColor: accentColor }}>
          <Text style={{ color: colors["color-text-on-accent"], fontWeight: "700" }}>Search</Text>
        </Pressable>
      </View>
      {loading ? <ActivityIndicator /> : null}
      {error ? <Text style={{ color: colors["color-accent-rose"] }}>{error}</Text> : null}
      {CastButton ? <CastButton style={{ width: 32, height: 32 }} /> : null}
      {current ? (
        <View style={{ padding: 12, borderRadius: 16, backgroundColor: colors["color-surface-2"], gap: 8 }}>
          <Text style={{ color: colors["color-text-primary"], fontWeight: "700" }}>{current.title}</Text>
          <Text style={{ color: colors["color-text-secondary"] }}>{current.artist}</Text>
          <Pressable onPress={toggle} style={{ alignSelf: "flex-start", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: accentColor }}>
            <Text style={{ color: colors["color-text-on-accent"], fontWeight: "700" }}>{playing ? "Pause" : "Play"}</Text>
          </Pressable>
        </View>
      ) : null}
      {expanded && current ? (
        <View style={{ flex: 1, alignItems: "center", gap: 12, paddingVertical: 16 }}>
          {current.artworkUrl ? (
            <Image source={{ uri: current.artworkUrl }} style={{ width: 240, height: 240, borderRadius: 24 }} />
          ) : (
            <View style={{ width: 240, height: 240, borderRadius: 24, backgroundColor: colors["color-surface-2"], alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 64 }}>🎵</Text>
            </View>
          )}
          <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.title.fontSize, fontWeight: "700", textAlign: "center" }}>{current.title}</Text>
          <Text style={{ color: colors["color-text-secondary"] }}>{current.artist}</Text>
          <View style={{ width: "100%", height: 4, borderRadius: 2, backgroundColor: colors["color-surface-2"], overflow: "hidden" }}>
            <View style={{ width: duration > 0 ? `${(position / duration) * 100}%` : "0%", height: 4, backgroundColor: accentColor }} />
          </View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Pressable onPress={toggle} style={{ paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12, backgroundColor: accentColor }}>
              <Text style={{ color: colors["color-text-on-accent"], fontWeight: "700" }}>{playing ? "Pause" : "Play"}</Text>
            </Pressable>
            <Pressable onPress={() => setExpanded(false)} style={{ paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12, backgroundColor: colors["color-surface-2"] }}>
              <Text style={{ color: colors["color-text-primary"], fontWeight: "700" }}>Minimize</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      {!expanded && current ? (
        <Pressable onPress={() => setExpanded(true)} style={{ alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: colors["color-surface-2"] }}>
          <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.label.fontSize }}>Expand now playing</Text>
        </Pressable>
      ) : null}
      {lyrics ? (
        <View style={{ padding: 12, borderRadius: 16, backgroundColor: colors["color-surface-1"], gap: 4 }}>
          <Text style={{ color: colors["color-text-primary"], fontWeight: "700" }}>Lyrics</Text>
          <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }}>{lyrics}</Text>
        </View>
      ) : null}
      {queue.length > 1 ? (
        <View style={{ gap: 4 }}>
          <Text style={{ color: colors["color-text-primary"], fontWeight: "700" }}>Queue ({queue.length})</Text>
          {queue.map((t, i) => (
            <Pressable key={`q-${t.id}-${i}`} onPress={() => { setQueueIndex(i); void playTrack(t, false); }} style={{ paddingVertical: 6 }}>
              <Text style={{ color: i === queueIndex ? accentColor : colors["color-text-primary"] }}>{t.title} — {t.artist}</Text>
            </Pressable>
          ))}
          <Pressable onPress={playNext} style={{ alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: accentColor }}>
            <Text style={{ color: colors["color-text-on-accent"], fontWeight: "700" }}>Next</Text>
          </Pressable>
        </View>
      ) : null}
      <ScrollView style={{ flex: 1 }}>
        {tracks.map((t) => (
          <View key={t.id} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors["color-border"], gap: 8 }}>
            <Pressable style={{ flex: 1 }} onPress={() => playTrack(t)}>
              <Text style={{ color: colors["color-text-primary"], fontWeight: "600" }}>{t.title}</Text>
              <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }}>{t.artist}</Text>
            </Pressable>
            <Pressable onPress={() => addToQueue(t)} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: colors["color-surface-2"] }}>
              <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.label.fontSize }}>+Queue</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

export default MusicPlayer;
