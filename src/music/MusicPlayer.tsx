import React from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
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
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [current, setCurrent] = React.useState<Track | null>(null);
  const [playing, setPlaying] = React.useState(false);
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

  const playTrack = async (track: Track) => {
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
      sound.setOnPlaybackStatusUpdate((s: any) => {
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

  React.useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync();
    };
  }, []);

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.title.fontSize, fontWeight: "700" }}>Music</Text>
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
      <ScrollView style={{ flex: 1 }}>
        {tracks.map((t) => (
          <Pressable key={t.id} onPress={() => playTrack(t)} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors["color-border"] }}>
            <Text style={{ color: colors["color-text-primary"], fontWeight: "600" }}>{t.title}</Text>
            <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }}>{t.artist}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

export default MusicPlayer;
