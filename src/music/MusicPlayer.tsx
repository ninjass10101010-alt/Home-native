import React from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { artworkColors, search as engineSearch } from "../../modules/youtube-engine";
import { useTheme } from "../theme/ThemeProvider";
import { FONTS, TYPOGRAPHY } from "../theme/tokens";
import { mix } from "../theme/mix";
import { Material } from "../theme/Material";
import { musicTokensFor, type MusicTokens } from "../theme/music-tokens";
import { Modal } from "../ui/Modal";
import { SegmentedControl } from "../ui/SegmentedControl";
import { usePlayback } from "./playback";
import { currentLineIndex, fetchLyrics, type LyricLine } from "./lyrics";
import { countUnrated, isContentHidden, isDeniedTerm, searchNote, visibleTracks } from "./explicit";
import { totalDownloadBytes } from "./library";
import { bandStageTint } from "./tint";
import { STAGE_TYPE } from "./stage-type";
import type { MediaTrack, RepeatMode } from "./types";

/** The Now Playing screen's three modes. Stage is the artwork-led one. */
type Mode = "stage" | "lyrics" | "queue";

/** The artwork's crossfade, in ms. */
const STAGE_FADE_MS = 250;

/** The artwork never grows past this edge (the wall's width is the real limit). */
const STAGE_MAX_ARTWORK_EDGE = 560;

export function MusicPlayer() {
  const { colors, accentColor, theme, boost, reduceMotion } = useTheme();
  // The music surface's OWN palette (Shiny's Liquid), gated in
  // src/theme/music-tokens.ts — every colour below comes from here or from
  // the app's existing theme tokens. Never a literal.
  const tokens = React.useMemo(() => musicTokensFor(theme, boost), [theme, boost]);
  const {
    current, queue, playing, position, duration, error,
    play, toggle, next, previous, seek, repeat, shuffle,
    cycleRepeatMode, toggleShuffleMode, downloadCurrent, addToQueue,
    downloads, removeDownload, history, policy,
    denylist, addDenied, removeDenied,
  } = usePlayback();

  const [query, setQuery] = React.useState("");
  const [tracks, setTracks] = React.useState<MediaTrack[]>([]);
  const [explicitKnown, setExplicitKnown] = React.useState(true);
  const [hasSearched, setHasSearched] = React.useState(false);
  const [searching, setSearching] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<Mode>("stage");
  const [lyricsFor, setLyricsFor] = React.useState<{ id: string; lines: LyricLine[] | null } | null>(null);
  const [searchOpen, setSearchOpen] = React.useState(false);
  /**
   * The parent-only deny-list editor.
   *
   * The button that opens it is rendered for a PARENT role only — a kid
   * (child/pet/guest) must never see the family's list, so the whole
   * control (and this state) is parent-only.
   */
  const [denyOpen, setDenyOpen] = React.useState(false);
  const [denyTerm, setDenyTerm] = React.useState("");

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
  const visibleCurrent = current && !isContentHidden(current, policy) ? current : null;
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

  const activeLine = lyrics ? currentLineIndex(lyrics, position * 1000) : -1;
  const downloaded = !!visibleCurrent && downloads.some((d) => d.id === visibleCurrent.id);

  /**
   * The stage's tint — the artwork's OWN colour, banded so body text stays AA.
   *
   * The colour is read on-device (AndroidX Palette, in the engine module) and
   * banded by the pure `bandStageTint`. The result is cached BY TRACK (and by
   * theme — the band differs) so a re-render never re-reads the cover.
   *
   * NO FAKE COLOUR: a track with no artwork, or an extraction that failed,
   * falls back to the ACCENT banded — never to a random or invented hue.
   */
  const [tintCache, setTintCache] = React.useState<Record<string, string>>({});
  const trackId = visibleCurrent?.id ?? null;
  const artworkUrl = visibleCurrent?.artworkUrl ?? null;
  const tintKey = trackId ? `${theme}:${trackId}` : null;

  React.useEffect(() => {
    // No track, or no artwork at all: the banded accent is the honest ground
    // and the engine is never asked.
    if (!trackId || !artworkUrl || !tintKey) return;
    // Already resolved for this cover — never read it twice.
    if (tintCache[tintKey]) return;
    let alive = true;
    const settle = (value: string) => {
      if (!alive) return;
      setTintCache((prev) => ({ ...prev, [tintKey]: value }));
    };
    const fallback = bandStageTint(tokens.accent, theme);
    void artworkColors(artworkUrl)
      .then((extracted) =>
        settle(extracted.dominant ? bandStageTint(extracted.dominant, theme) : fallback)
      )
      .catch(() => settle(fallback));
    return () => { alive = false; };
  }, [trackId, artworkUrl, tintKey, tintCache, theme, tokens.accent]);

  // Until the cover's colour lands, the stage wears the banded accent — the
  // field is NEVER unpainted.
  const stageTint = (tintKey ? tintCache[tintKey] : undefined) ?? bandStageTint(tokens.accent, theme);

  /**
   * Adds a term to the family's own list and clears the input.
   *
   * The provider owns the rule (it ignores a blank term and a duplicate, so
   * the list stays the family's, not the app's) — this only hands it over.
   */
  const addDenyTerm = () => {
    const term = denyTerm.trim();
    if (!term) return;
    void addDenied(term);
    setDenyTerm("");
  };

  return (
    <>
      <ScrollView testID="music-player" contentContainerStyle={{ padding: tokens.pageMargin, gap: tokens.shelfGap, paddingBottom: 200 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Text style={{ color: colors["color-text-primary"], fontFamily: FONTS.display, fontSize: 44 }}>Music</Text>
          <View style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: mix(accentColor, "transparent", 18), borderWidth: 1, borderColor: mix(accentColor, "transparent", 40) }}>
            <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>Ad-free</Text>
          </View>
          <View style={{ marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 10 }}>
            {/*
              The deny-list editor is PARENT-ONLY: a kid role (child/pet/guest)
              must never see the control — nor the family's list behind it.
            */}
            {isParent ? (
              <Pressable
                testID="music-deny-open"
                accessibilityRole="button"
                accessibilityLabel="Blocked artists and songs"
                hitSlop={12}
                onPress={() => setDenyOpen(true)}
                style={{ minHeight: 48, paddingHorizontal: 14, justifyContent: "center", borderRadius: 14, backgroundColor: mix(colors["color-text-primary"], "transparent", 6) }}
              >
                <Text style={{ color: colors["color-text-primary"], fontWeight: "700" }}>Blocked</Text>
              </Pressable>
            ) : null}
            <Pressable accessibilityRole="button" accessibilityLabel="Search music" hitSlop={12} onPress={() => setSearchOpen((v) => !v)} style={{ minHeight: 48, paddingHorizontal: 14, justifyContent: "center", borderRadius: 14, backgroundColor: mix(colors["color-text-primary"], "transparent", 6) }}>
              <Text style={{ color: colors["color-text-primary"], fontWeight: "700" }}>Search</Text>
            </Pressable>
          </View>
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
              // The family's OWN list: a parent sees the row AND the fact that
              // the kids do not — the rule is visible and verifiable. A kid never
              // sees this row at all (the policy hides it), so the marker is
              // parent-only too.
              const blockedRow = isParent && isDeniedTerm(track, policy.denied ?? []);
              return (
                <Pressable
                  key={track.id}
                  testID={`music-result-${track.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Play ${track.title} by ${track.artist}${unratedRow ? ", unrated" : ""}${blockedRow ? ", blocked for kids" : ""}`}
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
                      {blockedRow ? (
                        <View
                          testID={`music-result-blocked-${track.id}`}
                          style={{
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor: mix(accentColor, "transparent", 40),
                          }}
                        >
                          <Text style={{ color: colors["color-accent-ink"] ?? colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, lineHeight: TYPOGRAPHY.label.lineHeight, fontWeight: "600" }}>
                            Blocked for kids
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
            {/*
              The Now Playing screen's three modes. Stage is the artwork-led
              one; Lyrics and Queue are behind the switcher until T4 restyles
              them.
            */}
            <SegmentedControl
              testID="music-mode"
              accessibilityLabel="Now Playing view"
              options={[
                { id: "stage", label: "Now Playing" },
                { id: "lyrics", label: "Lyrics" },
                { id: "queue", label: "Queue" },
              ]}
              value={mode}
              onChange={(id) => setMode(id as Mode)}
            />

            {mode === "stage" ? (
              <NowPlayingStage
                track={visibleCurrent}
                tint={stageTint}
                tokens={tokens}
                reduceMotion={reduceMotion}
                playing={playing}
                position={position}
                duration={duration}
                repeat={repeat}
                shuffle={shuffle}
                downloaded={downloaded}
                onToggle={toggle}
                onNext={() => void next()}
                onPrevious={() => void previous()}
                onSeek={(seconds) => void seek(seconds)}
                onToggleShuffle={toggleShuffleMode}
                onCycleRepeat={cycleRepeatMode}
                onDownload={() => void downloadCurrent()}
              />
            ) : null}

            {mode === "lyrics" ? (
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
            ) : null}

            {mode === "queue" ? (
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
            ) : null}

            {/*
              The error line sits NEXT to the stage, never on its tint: the
              rose is a page-level colour and it needs the page's ground to
              stay readable. Its copy is untouched.
            */}
            {error ? (
              <Text style={{ color: colors["color-accent-rose"], fontSize: TYPOGRAPHY.body.fontSize, lineHeight: TYPOGRAPHY.body.lineHeight }}>{error}</Text>
            ) : null}

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

      {/*
        The parent's editor for the family's own list.

        It lives BEHIND the parent-only "Blocked" button, and it is only
        rendered for a parent — a kid role never sees the list at all.
      */}
      {isParent ? (
        <Modal
          visible={denyOpen}
          onClose={() => setDenyOpen(false)}
          title="Blocked artists & songs"
          testID="music-deny-modal"
        >
          <View style={{ gap: 12 }}>
            <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.body.fontSize, lineHeight: TYPOGRAPHY.body.lineHeight }}>
              Anything matching these stays away from the kids.
            </Text>

            {denylist.length === 0 ? (
              <Text testID="music-deny-empty" style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.body.fontSize, lineHeight: TYPOGRAPHY.body.lineHeight }}>
                Nothing blocked yet.
              </Text>
            ) : (
              denylist.map((entry, index) => (
                <View
                  key={`${entry.term}-${index}`}
                  style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64 }}
                >
                  <Text numberOfLines={1} style={{ flex: 1, color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize }}>
                    {entry.term}
                  </Text>
                  <Pressable
                    testID={`music-deny-remove-${index}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${entry.term} from the blocked list`}
                    onPress={() => void removeDenied(entry.term)}
                    style={{ minHeight: 64, minWidth: 64, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: mix(colors["color-text-primary"], "transparent", 8) }}
                  >
                    <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>Remove</Text>
                  </Pressable>
                </View>
              ))
            )}

            <View style={{ flexDirection: "row", gap: 10 }}>
              <TextInput
                testID="music-deny-input"
                value={denyTerm}
                onChangeText={setDenyTerm}
                onSubmitEditing={addDenyTerm}
                placeholder="Artist or song name"
                placeholderTextColor={colors["color-text-secondary"]}
                style={{ flex: 1, minHeight: 64, borderWidth: 1, borderColor: colors["color-border"], borderRadius: 16, paddingHorizontal: 16, color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize }}
              />
              <Pressable
                testID="music-deny-add"
                accessibilityRole="button"
                accessibilityLabel="Add to the blocked list"
                onPress={addDenyTerm}
                style={{ minHeight: 64, paddingHorizontal: 20, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: accentColor }}
              >
                <Text style={{ color: colors["color-text-on-accent"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "800" }}>Add</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}

interface StageProps {
  track: MediaTrack;
  /** The banded tint — the artwork's own colour (or the banded accent). */
  tint: string;
  tokens: MusicTokens;
  reduceMotion: boolean;
  playing: boolean;
  position: number;
  duration: number;
  repeat: RepeatMode;
  shuffle: boolean;
  downloaded: boolean;
  onToggle: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSeek: (seconds: number) => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
  onDownload: () => void;
}

/**
 * The Now Playing STAGE — the artwork-led, cover-tinted surface.
 *
 * The stage is a full-width tinted field: the artwork leads, the field wears
 * the cover's own banded colour, and the chrome (scrubber, transport) recedes
 * under it. Every colour comes from the music tokens; the artwork's colour
 * arrives already banded (see bandStageTint).
 */
function NowPlayingStage({
  track, tint, tokens, reduceMotion,
  playing, position, duration, repeat, shuffle, downloaded,
  onToggle, onNext, onPrevious, onSeek, onToggleShuffle, onCycleRepeat, onDownload,
}: StageProps) {
  // The artwork's crossfade: on a track change it comes up from 0.96 with a
  // fade, so the cover never SNAPS between tracks. Reduced motion kills it
  // (the app's authority: AccessibilityInfo.isReduceMotionEnabled, read by
  // the ThemeProvider).
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);

  React.useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(opacity);
      cancelAnimation(scale);
      opacity.value = 1;
      scale.value = 1;
      return;
    }
    cancelAnimation(opacity);
    cancelAnimation(scale);
    opacity.value = 0;
    scale.value = 0.96;
    opacity.value = withTiming(1, { duration: STAGE_FADE_MS });
    scale.value = withTiming(1, { duration: STAGE_FADE_MS });
  }, [track.id, reduceMotion, opacity, scale]);

  const artworkStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  // The artwork's edge: the full width minus the page margins, capped so a
  // wide wall never grows a giant cover.
  const windowWidth = Dimensions.get("window").width;
  const artworkEdge = Math.min(windowWidth - 2 * tokens.pageMargin, STAGE_MAX_ARTWORK_EDGE);

  const [seekWidth, setSeekWidth] = React.useState(0);
  const progress = duration > 0 ? Math.min(1, position / duration) : 0;

  return (
    <View
      testID="np-stage"
      style={{
        backgroundColor: tint,
        borderRadius: tokens.panelRadius,
        padding: tokens.pageMargin,
        gap: tokens.shelfGap,
      }}
    >
      {/* The artwork: a soft shadow under a rounded cover. */}
      <Animated.View
        style={[
          {
            width: artworkEdge,
            height: artworkEdge,
            borderRadius: tokens.artworkRadius,
            shadowColor: mix(tokens.label, "transparent", 84),
            shadowOpacity: 1,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 12 },
            elevation: 6,
          },
          artworkStyle,
        ]}
      >
        <View
          testID="np-artwork"
          style={{
            width: artworkEdge,
            height: artworkEdge,
            borderRadius: tokens.artworkRadius,
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: mix(tokens.label, "transparent", 8),
          }}
        >
          {track.artworkUrl ? (
            <Image source={{ uri: track.artworkUrl }} style={{ width: artworkEdge, height: artworkEdge }} resizeMode="cover" />
          ) : (
            <Text style={{ fontSize: 96 }}>🎵</Text>
          )}
        </View>
      </Animated.View>

      <View style={{ alignItems: "center", gap: 4 }}>
        <Text testID="np-title" numberOfLines={2} style={{ color: tokens.label, ...STAGE_TYPE.title, textAlign: "center" }}>
          {track.title}
        </Text>
        {/*
          THE ARTIST reads the FULL label token, never a dim tier: the ground
          here is the tinted field, not the page ground, and the dim tier
          measures ~3.4:1 on it. The hierarchy is carried by the type step and
          the weight — never by colour (see tests/music-stage-contrast.test.ts).
        */}
        <Text numberOfLines={1} style={{ color: tokens.label, ...STAGE_TYPE.artist, textAlign: "center" }}>
          {track.artist}
        </Text>
      </View>

      {/* The scrubber: a 6px track over the tint, a 64dp hit area. */}
      <Pressable
        testID="np-seek"
        accessibilityRole="adjustable"
        accessibilityLabel="Seek"
        onLayout={(e) => setSeekWidth(e.nativeEvent.layout.width)}
        onPress={(e) => { if (seekWidth > 0 && duration > 0) onSeek((e.nativeEvent.locationX / seekWidth) * duration); }}
        style={{ height: 64, justifyContent: "center" }}
      >
        <View style={{ height: 6, borderRadius: 3, backgroundColor: tokens.panel, overflow: "hidden" }}>
          <View style={{ width: `${Math.round(progress * 100)}%`, height: 6, backgroundColor: tokens.accent }} />
        </View>
      </Pressable>
      {/*
        THE TIMES read the full label token too — the smallest step on the
        tinted field, where the dim tier measured ~2.6:1. Size and weight
        carry the hierarchy; colour never does.
      */}
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: tokens.label, fontSize: TYPOGRAPHY.label.fontSize, lineHeight: TYPOGRAPHY.label.lineHeight, fontWeight: "500" }}>{clock(position)}</Text>
        <Text style={{ color: tokens.label, fontSize: TYPOGRAPHY.label.fontSize, lineHeight: TYPOGRAPHY.label.lineHeight, fontWeight: "500" }}>{clock(duration)}</Text>
      </View>

      {/* The transport: an 88dp play disc, 72dp skips — all thumb-sized. */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 24 }}>
        <Pressable testID="np-prev" accessibilityRole="button" accessibilityLabel="Previous track" onPress={onPrevious} style={stageDisc(tokens, 72)}>
          <Text style={{ color: tokens.label, fontSize: 26 }}>⏮</Text>
        </Pressable>
        <Pressable testID="np-play" accessibilityRole="button" accessibilityLabel={playing ? "Pause" : "Play"} onPress={onToggle} style={{ width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center", backgroundColor: tokens.accent }}>
          <Text style={{ color: tokens.onAccent, fontSize: 32 }}>{playing ? "❚❚" : "▶"}</Text>
        </Pressable>
        <Pressable testID="np-next" accessibilityRole="button" accessibilityLabel="Next track" onPress={onNext} style={stageDisc(tokens, 72)}>
          <Text style={{ color: tokens.label, fontSize: 26 }}>⏭</Text>
        </Pressable>
      </View>

      {/* The secondary row: shuffle, repeat, download. */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 }}>
        <Pressable testID="np-shuffle" accessibilityRole="button" accessibilityLabel={`Shuffle ${shuffle ? "on" : "off"}`} onPress={onToggleShuffle} style={stageDisc(tokens, 64, shuffle ? tokens.accent : undefined)}>
          <Text style={{ color: tokens.label, fontSize: 20 }}>🔀</Text>
        </Pressable>
        <Pressable testID="np-repeat" accessibilityRole="button" accessibilityLabel={`Repeat ${repeat}`} onPress={onCycleRepeat} style={stageDisc(tokens, 64, repeat !== "off" ? tokens.accent : undefined)}>
          <Text style={{ color: tokens.label, fontSize: 20 }}>{repeat === "one" ? "🔂" : "🔁"}</Text>
        </Pressable>
        <Pressable
          testID="np-download"
          accessibilityRole="button"
          accessibilityLabel={downloaded ? "Downloaded" : "Download this track"}
          disabled={downloaded}
          onPress={onDownload}
          style={{
            flex: 1,
            minHeight: 64,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: tokens.panelRadius,
            backgroundColor: mix(tokens.label, "transparent", downloaded ? 6 : 12),
          }}
        >
          <Text style={{ color: tokens.label, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
            {downloaded ? "Downloaded ✓" : "Download"}
          </Text>
        </Pressable>
      </View>
    </View>
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
  const mb = (bytes / (1024 * 1024));
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
}

/**
 * A round stage control: the disc's fill is the tint's own light, and an
 * active control (shuffle on, repeat on) wears the accent.
 */
function stageDisc(tokens: MusicTokens, size: number, tint?: string) {
  return {
    width: size,
    height: size,
    borderRadius: size / 2,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: tint ? mix(tint, "transparent", 18) : mix(tokens.label, "transparent", 10),
  };
}

export default MusicPlayer;
