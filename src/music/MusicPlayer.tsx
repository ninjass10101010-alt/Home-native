import React from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { search as engineSearch } from "../../modules/youtube-engine";
import { useTheme } from "../theme/ThemeProvider";
import { FONTS, TYPOGRAPHY } from "../theme/tokens";
import { mix } from "../theme/mix";
import { Material } from "../theme/Material";
import { usePlayback } from "./playback";
import { currentLineIndex, fetchLyrics, type LyricLine } from "./lyrics";
import { countUnrated, isExplicitHidden, searchNote, visibleTracks } from "./explicit";
import { totalDownloadBytes } from "./library";
import type { MediaTrack } from "./types";

type Tab = "lyrics" | "queue";

export function MusicPlayer() {
  const { colors, accentColor } = useTheme();
  const {
    current, queue, playing, position, duration, error,
    play, toggle, next, previous, seek, repeat, shuffle,
    cycleRepeatMode, toggleShuffleMode, downloadCurrent, addToQueue,
    downloads, removeDownload, history, policy,
  } = usePlayback();

  const [query, setQuery] = React.useState("");
  const [tracks, setTracks] = React.useState<MediaTrack[]>([]);
  const [explicitKnown, setExplicitKnown] = React.useState(true);
  const [hasSearched, setHasSearched] = React.useState(false);
  const [searching, setSearching] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<Tab>("lyrics");
  const [lyricsFor, setLyricsFor] = React.useState<{ id: string; lines: LyricLine[] | null } | null>(null);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [seekWidth, setSeekWidth] = React.useState(0);

  // The role-aware policy comes from the provider — it knows who is watching
  // (a parent sees everything; a kid role and a signed-out guest fail
  // closed). See src/music/explicit.ts.
  const isParent = policy.isParent;
  const visible = visibleTracks(tracks, policy);
  // The queue, the history and the downloads tray are track surfaces too:
  // the policy covers every place a kid can SEE a track, not just the search
  // results.
  const visibleQueue = visibleTracks(queue, policy);
  const visibleHistory = visibleTracks(history, policy);
  const visibleDownloads = visibleTracks(downloads, policy);
  // The Now Playing panel is a surface as well: a track the viewer may not
  // see is never painted here either (the provider already stops it — this
  // is the same rule on the same screen).
  const visibleCurrent = current && !isExplicitHidden(current, policy) ? current : null;
  const unrated = countUnrated(tracks);
  const note =
    hasSearched && !searching && !searchError
      ? searchNote({ visible: visible.length, total: tracks.length, unrated, explicitKnown, isParent })
      : null;

  React.useEffect(() => {
    if (!visibleCurrent) return;
    let alive = true;
    void fetchLyrics(visibleCurrent).then((lines) => { if (alive) setLyricsFor({ id: visibleCurrent.id, lines }); });
    return () => { alive = false; };
  }, [visibleCurrent]);

  const lyrics = visibleCurrent && lyricsFor?.id === visibleCurrent.id ? lyricsFor.lines : null;

  const search = async () => {
    const term = query.trim();
    if (!term) return;
    setSearching(true);
    setSearchError(null);
    try {
      const outcome = await engineSearch(term, 20);
      setTracks(outcome.tracks);
      setExplicitKnown(outcome.explicitKnown);
      setHasSearched(true);
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : "search_failed");
      setTracks([]);
      // The search FAILED: it never established any rating, so the ratings
      // are NOT authoritative. Never claim authority a failed search lacks.
      setExplicitKnown(false);
      setHasSearched(true);
    } finally {
      setSearching(false);
    }
  };

  const progress = duration > 0 ? Math.min(1, position / duration) : 0;
  const activeLine = lyrics ? currentLineIndex(lyrics, position * 1000) : -1;
  const downloaded = !!visibleCurrent && downloads.some((d) => d.id === visibleCurrent.id);

  return (
    <ScrollView testID="music-player" contentContainerStyle={{ padding: 24, gap: 18, paddingBottom: 200 }} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Text style={{ color: colors["color-text-primary"], fontFamily: FONTS.display, fontSize: 44 }}>Music</Text>
        <View style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: mix(accentColor, "transparent", 18), borderWidth: 1, borderColor: mix(accentColor, "transparent", 40) }}>
          <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>Ad-free</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Search music" hitSlop={12} onPress={() => setSearchOpen((v) => !v)} style={{ marginLeft: "auto", minHeight: 48, paddingHorizontal: 14, justifyContent: "center", borderRadius: 14, backgroundColor: mix(colors["color-text-primary"], "transparent", 6) }}>
          <Text style={{ color: colors["color-text-primary"], fontWeight: "700" }}>Search</Text>
        </Pressable>
      </View>

      {searchOpen || !visibleCurrent ? (
        <Material tier="thin" style={{ borderRadius: 20, padding: 14, gap: 10 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput
              testID="music-search-input"
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => void search()}
              placeholder="Search YouTube Music…"
              placeholderTextColor={colors["color-text-secondary"]}
              style={{ flex: 1, minHeight: 52, borderWidth: 1, borderColor: colors["color-border"], borderRadius: 14, paddingHorizontal: 14, color: colors["color-text-primary"] }}
            />
            <Pressable testID="music-search-submit" accessibilityRole="button" accessibilityLabel="Search" onPress={() => void search()} style={{ minHeight: 52, paddingHorizontal: 18, justifyContent: "center", borderRadius: 14, backgroundColor: accentColor }}>
              <Text style={{ color: colors["color-text-on-accent"], fontWeight: "800" }}>Go</Text>
            </Pressable>
          </View>
          {searching ? <ActivityIndicator /> : null}
          {searchError ? <Text style={{ color: colors["color-accent-rose"] }}>{searchError}</Text> : null}
          {visible.map((track) => {
            // A parent sees every row, so an UNRATED row (no rating at all)
            // must be marked as such — a quiet label, never a badge that
            // reads as an error. Kid roles never see these rows while the
            // filter is on (they fail closed), so the marker is parent-only.
            const unratedRow = isParent && track.explicit === null;
            return (
              <Pressable
                key={track.id}
                testID={`music-result-${track.id}`}
                accessibilityRole="button"
                accessibilityLabel={`Play ${track.title} by ${track.artist}${unratedRow ? ", unrated" : ""}`}
                onPress={() => void play(track, visible)}
                style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors["color-border"] }}
              >
                <Material tier="thin" style={{ width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  {track.artworkUrl ? <Image source={{ uri: track.artworkUrl }} style={{ width: 48, height: 48 }} /> : <Text>🎵</Text>}
                </Material>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text numberOfLines={1} style={{ color: colors["color-text-primary"], fontWeight: "700", flexShrink: 1 }}>{track.title}</Text>
                    {unratedRow ? (
                      <View
                        testID={`music-result-unrated-${track.id}`}
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor: mix(colors["color-text-primary"], "transparent", 30),
                        }}
                      >
                        <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, lineHeight: TYPOGRAPHY.label.lineHeight, fontWeight: "600" }}>
                          Unrated
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text numberOfLines={1} style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }}>{track.artist}</Text>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel={`Add ${track.title} to queue`} hitSlop={12} onPress={(e) => { e?.stopPropagation?.(); addToQueue(track); }} style={{ minHeight: 44, paddingHorizontal: 10, justifyContent: "center", borderRadius: 10, backgroundColor: mix(colors["color-text-primary"], "transparent", 6) }}>
                  <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.label.fontSize }}>+ Queue</Text>
                </Pressable>
              </Pressable>
            );
          })}
          {note ? (
            <Text
              testID={note.testID}
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.body.fontSize, lineHeight: TYPOGRAPHY.body.lineHeight, paddingVertical: 12 }}
            >
              {note.text}
            </Text>
          ) : null}
        </Material>
      ) : null}

      {visibleCurrent ? (
        <>
          <View style={{ alignItems: "center", gap: 10 }}>
            <Material tier="regular" style={{ width: 420, height: 420, borderRadius: 36, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              {visibleCurrent.artworkUrl ? (
                <Image source={{ uri: visibleCurrent.artworkUrl }} style={{ width: 420, height: 420 }} resizeMode="cover" />
              ) : (
                <Text style={{ fontSize: 120 }}>🎵</Text>
              )}
            </Material>
            <Text testID="np-title" numberOfLines={1} style={{ color: colors["color-text-primary"], fontSize: 30, fontWeight: "800", textAlign: "center" }}>{visibleCurrent.title}</Text>
            <Text numberOfLines={1} style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.body.fontSize }}>{visibleCurrent.artist}</Text>
            {error ? <Text style={{ color: colors["color-accent-rose"] }}>{error}</Text> : null}
          </View>

          <Pressable
            testID="np-seek"
            accessibilityRole="adjustable"
            accessibilityLabel="Seek"
            onLayout={(e) => setSeekWidth(e.nativeEvent.layout.width)}
            onPress={(e) => { if (seekWidth > 0 && duration > 0) void seek((e.nativeEvent.locationX / seekWidth) * duration); }}
            style={{ height: 44, justifyContent: "center" }}
          >
            <View style={{ height: 6, borderRadius: 3, backgroundColor: mix(colors["color-text-primary"], "transparent", 12), overflow: "hidden" }}>
              <View style={{ width: `${Math.round(progress * 100)}%`, height: 6, backgroundColor: accentColor }} />
            </View>
          </Pressable>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }}>{clock(position)}</Text>
            <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }}>{clock(duration)}</Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 18 }}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Shuffle ${shuffle ? "on" : "off"}`} onPress={toggleShuffleMode} style={iconButton(colors, shuffle ? accentColor : undefined)}>
              <Text style={{ color: colors["color-text-primary"], fontSize: 20 }}>🔀</Text>
            </Pressable>
            <Pressable testID="np-prev" accessibilityRole="button" accessibilityLabel="Previous track" onPress={() => void previous()} style={iconButton(colors)}>
              <Text style={{ color: colors["color-text-primary"], fontSize: 26 }}>⏮</Text>
            </Pressable>
            <Pressable testID="np-play" accessibilityRole="button" accessibilityLabel={playing ? "Pause" : "Play"} onPress={toggle} style={{ width: 84, height: 84, borderRadius: 42, alignItems: "center", justifyContent: "center", backgroundColor: accentColor }}>
              <Text style={{ color: colors["color-text-on-accent"], fontSize: 32 }}>{playing ? "❚❚" : "▶"}</Text>
            </Pressable>
            <Pressable testID="np-next" accessibilityRole="button" accessibilityLabel="Next track" onPress={() => void next()} style={iconButton(colors)}>
              <Text style={{ color: colors["color-text-primary"], fontSize: 26 }}>⏭</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Repeat ${repeat}`} onPress={cycleRepeatMode} style={iconButton(colors, repeat !== "off" ? accentColor : undefined)}>
              <Text style={{ color: colors["color-text-primary"], fontSize: 20 }}>{repeat === "one" ? "🔂" : "🔁"}</Text>
            </Pressable>
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable accessibilityRole="button" accessibilityLabel={downloaded ? "Downloaded" : "Download this track"} disabled={downloaded} onPress={() => void downloadCurrent()} style={{ flex: 1, minHeight: 56, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: mix(colors["color-text-primary"], "transparent", downloaded ? 3 : 8) }}>
              <Text style={{ color: colors["color-text-primary"], fontWeight: "700" }}>{downloaded ? "Downloaded ✓" : "Download"}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Open search" onPress={() => setSearchOpen(true)} style={{ flex: 1, minHeight: 56, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: mix(colors["color-text-primary"], "transparent", 8) }}>
              <Text style={{ color: colors["color-text-primary"], fontWeight: "700" }}>Search more</Text>
            </Pressable>
          </View>

          {visibleDownloads.length > 0 ? (
            <Material tier="thin" style={{ borderRadius: 20, padding: 18, gap: 8 }}>
              <Text style={{ color: colors["color-text-primary"], fontWeight: "800", fontSize: TYPOGRAPHY.title.fontSize }}>
                Downloads · {formatBytes(totalDownloadBytes(visibleDownloads))}
              </Text>
              {visibleDownloads.map((item) => (
                <View key={item.id} testID={`music-download-${item.id}`} style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 56 }}>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ color: colors["color-text-primary"], fontWeight: "600" }}>{item.title}</Text>
                    <Text numberOfLines={1} style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }}>{item.artist}</Text>
                  </View>
                  <Pressable
                    testID={`music-download-remove-${item.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete download ${item.title}`}
                    hitSlop={10}
                    onPress={() => void removeDownload(item.id)}
                    style={{ minHeight: 48, paddingHorizontal: 14, justifyContent: "center", borderRadius: 12, backgroundColor: mix(colors["color-accent-rose"] ?? accentColor, "transparent", 14) }}
                  >
                    <Text style={{ color: colors["color-text-primary"], fontWeight: "700" }}>Delete</Text>
                  </Pressable>
                </View>
              ))}
            </Material>
          ) : null}

          <View style={{ flexDirection: "row", gap: 8 }}>
            {(["lyrics", "queue"] as const).map((key) => (
              <Pressable key={key} testID={key === "lyrics" ? "np-lyrics" : "np-queue"} accessibilityRole="tab" accessibilityState={{ selected: tab === key }} onPress={() => setTab(key)} style={{ flex: 1, minHeight: 52, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: mix(colors["color-text-primary"], "transparent", tab === key ? 12 : 5) }}>
                <Text style={{ color: colors["color-text-primary"], fontWeight: "700", textTransform: "capitalize" }}>{key}</Text>
              </Pressable>
            ))}
          </View>

          {tab === "lyrics" ? (
            <Material tier="thin" style={{ borderRadius: 20, padding: 18, minHeight: 180 }}>
              {lyrics && lyrics.length > 0 ? (
                lyrics.map((line, i) => (
                  <Text key={`${line.timeMs}-${i}`} style={{ color: i === activeLine ? colors["color-text-primary"] : colors["color-text-secondary"], fontSize: i === activeLine ? 24 : TYPOGRAPHY.body.fontSize, lineHeight: 34, fontWeight: i === activeLine ? "800" : "500", marginBottom: 6 }}>
                    {line.text || "♪"}
                  </Text>
                ))
              ) : (
                <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.body.fontSize }}>No lyrics for this track.</Text>
              )}
            </Material>
          ) : (
            <Material tier="thin" style={{ borderRadius: 20, padding: 18, gap: 6 }}>
              {visibleQueue.length === 0 ? (
                <Text style={{ color: colors["color-text-secondary"] }}>The queue is empty.</Text>
              ) : (
                visibleQueue.map((track, i) => (
                  <Pressable key={`${track.id}-${i}`} accessibilityRole="button" accessibilityLabel={`Play ${track.title}`} onPress={() => void play(track, visibleQueue)} style={{ minHeight: 52, justifyContent: "center", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors["color-border"] }}>
                    <Text numberOfLines={1} style={{ color: i === 0 ? accentColor : colors["color-text-primary"], fontWeight: "700" }}>{track.title}</Text>
                    <Text numberOfLines={1} style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }}>{track.artist}</Text>
                  </Pressable>
                ))
              )}
            </Material>
          )}
        </>
      ) : (
        <Material tier="thin" style={{ borderRadius: 20, padding: 24, alignItems: "center", gap: 8 }}>
          <Text style={{ fontSize: 56 }}>🎵</Text>
          <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.title.fontSize, fontWeight: "800" }}>Search YouTube Music</Text>
          <Text style={{ color: colors["color-text-secondary"], textAlign: "center" }}>Millions of songs, no ads. Sign in to play.</Text>
        </Material>
      )}

      {!visibleCurrent && visibleHistory.length > 0 ? (
        <Material tier="thin" style={{ borderRadius: 20, padding: 18, gap: 6 }}>
          <Text style={{ color: colors["color-text-primary"], fontWeight: "800", fontSize: TYPOGRAPHY.title.fontSize }}>Recently played</Text>
          {visibleHistory.slice(0, 8).map((track) => (
            <Pressable
              key={track.id}
              testID={`music-history-${track.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Play ${track.title} by ${track.artist}`}
              onPress={() => void play(track, visibleHistory)}
              style={{ minHeight: 52, justifyContent: "center", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors["color-border"] }}
            >
              <Text numberOfLines={1} style={{ color: colors["color-text-primary"], fontWeight: "700" }}>{track.title}</Text>
              <Text numberOfLines={1} style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }}>{track.artist}</Text>
            </Pressable>
          ))}
        </Material>
      ) : null}
    </ScrollView>
  );
}

function clock(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
}

function iconButton(colors: Record<string, string | undefined>, tint?: string) {
  return {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: tint ? mix(tint, "transparent", 18) : mix(colors["color-text-primary"] ?? "transparent", "transparent", 6),
  };
}

export default MusicPlayer;
