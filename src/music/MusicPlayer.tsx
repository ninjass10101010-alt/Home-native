import React from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleProp,
  Text,
  TextInput,
  View,
  ViewStyle,
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
import { musicTokensFor, type MusicTokens } from "../theme/music-tokens";
import { Modal } from "../ui/Modal";
import { SegmentedControl } from "../ui/SegmentedControl";
import { usePlayback } from "./playback";
import { useCast } from "./CastProvider";
import { CastControl } from "./CastControl";
import { currentLineIndex, fetchLyrics, followOffset, FOLLOW_PAUSE_MS, type LyricLine } from "./lyrics";
import { countUnrated, isContentHidden, isDeniedTerm, searchNote, visibleTracks } from "./explicit";
import { totalDownloadBytes } from "./library";
import { bandStageTint } from "./tint";
import { LYRIC_CURRENT_SCALE, LYRIC_TYPE, STAGE_TYPE } from "./stage-type";
import type { DownloadEntry, MediaTrack, RepeatMode } from "./types";

/** The Now Playing screen's three modes. Stage is the artwork-led one. */
type Mode = "stage" | "lyrics" | "queue";

/** The artwork's crossfade, in ms. */
const STAGE_FADE_MS = 250;

/** The artwork never grows past this edge (the wall's width is the real limit). */
const STAGE_MAX_ARTWORK_EDGE = 560;

/**
 * How tall the lyrics viewport is (dp).
 *
 * The words get their own scroll: the follow moves them to the line being
 * sung, and a list inside the page's own scroll could not be followed. The
 * pane is a fixed viewport — a sheet of lyrics, not a page of them.
 */
const LYRICS_VIEWPORT_DP = 600;

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
    removeFromQueue, moveQueueItem,
    downloads, removeDownload, history, policy,
    denylist, addDenied, removeDenied,
  } = usePlayback();
  const cast = useCast();
  const casting = cast.casting;

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
          <View style={{ gap: tokens.shelfGap }}>
            {/*
              THE SEARCH FIELD — a sheet-ground box on the Liquid radius, with
              the input and the submit on the 64dp wall floor. The testIDs are
              the surface's contract and they do not move.
            */}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TextInput
                testID="music-search-input"
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={() => void search()}
                placeholder="Search YouTube Music…"
                placeholderTextColor={tokens.label2}
                style={{
                  flex: 1,
                  minHeight: 64,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: tokens.panelRim,
                  backgroundColor: tokens.sheet,
                  paddingHorizontal: 16,
                  color: tokens.label,
                  fontSize: TYPOGRAPHY.body.fontSize,
                }}
              />
              <Pressable
                testID="music-search-submit"
                accessibilityRole="button"
                accessibilityLabel="Search"
                onPress={() => void search()}
                style={{
                  minHeight: 64,
                  minWidth: 64,
                  paddingHorizontal: 20,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 14,
                  backgroundColor: tokens.accent,
                }}
              >
                {/*
                  The accent fill carries LARGE text only: `onAccent` on
                  `accent` measures 3.52:1 (dark) / 3.65:1 (light), so the
                  label sits at the `title` step (20sp, bold) — large text
                  under WCAG, whose floor is 3:1. Never body copy on the fill.
                */}
                <Text style={{ color: tokens.onAccent, fontSize: TYPOGRAPHY.title.fontSize, fontWeight: "800" }}>Go</Text>
              </Pressable>
            </View>
            {searching ? <ActivityIndicator color={tokens.label2} /> : null}
            {searchError ? (
              <Text style={{ color: colors["color-accent-rose"], ...TYPOGRAPHY.body }}>{searchError}</Text>
            ) : null}
            {/*
              The RESULTS: a Top Result card (the first track the viewer may
              see) and the remaining rows on a panel. Only VISIBLE tracks ever
              reach this list — the policy has already filtered them.
            */}
            {visible.length > 0 ? (
              <SearchResults
                tracks={visible}
                tokens={tokens}
                isParent={isParent}
                denied={policy.denied ?? []}
                onPlay={(track, list) => void play(track, list)}
                onQueue={(track) => addToQueue(track)}
              />
            ) : null}
            {note ? (
              <Text
                testID={note.testID}
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                style={{ color: tokens.label2, ...TYPOGRAPHY.body, paddingVertical: 12 }}
              >
                {note.text}
              </Text>
            ) : null}
          </View>
        ) : null}

        {visibleCurrent ? (
          <>
            {/*
              The Now Playing screen's three modes. Stage is the artwork-led
              one; Lyrics and Queue are behind the switcher until T4 restyles
              them.
            */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ flex: 1 }}>
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
              </View>
              <CastControl track={visibleCurrent} />
            </View>

            {mode === "stage" ? (
              <NowPlayingStage
                track={visibleCurrent}
                tint={stageTint}
                tokens={tokens}
                reduceMotion={reduceMotion}
                playing={casting ? cast.playing : playing}
                position={casting ? cast.position : position}
                duration={casting ? (cast.duration ?? 0) : duration}
                repeat={repeat}
                shuffle={shuffle}
                downloaded={downloaded}
                onToggle={casting ? (cast.playing ? cast.pause : cast.play) : toggle}
                onNext={casting ? () => void cast.advance(false) : () => void next()}
                onPrevious={casting ? () => void cast.previous() : () => void previous()}
                onSeek={casting ? (seconds) => void cast.seek(seconds) : (seconds) => void seek(seconds)}
                onToggleShuffle={toggleShuffleMode}
                onCycleRepeat={cycleRepeatMode}
                onDownload={() => void downloadCurrent()}
              />
            ) : null}

            {mode === "lyrics" ? (
              <LyricsPane
                lines={lyrics}
                activeIndex={activeLine}
                tokens={tokens}
                reduceMotion={reduceMotion}
                onSeek={casting ? (seconds) => void cast.seek(seconds) : (seconds) => void seek(seconds)}
              />
            ) : null}

            {mode === "queue" ? (
              <QueuePane
                queue={visibleQueue}
                history={visibleHistory}
                tokens={tokens}
                shuffle={shuffle}
                repeat={repeat}
                onToggleShuffle={toggleShuffleMode}
                onCycleRepeat={cycleRepeatMode}
                onPlay={(track, list) => void play(track, list)}
                onRemove={(index) => removeFromQueue(index)}
                onMove={(from, to) => moveQueueItem(from, to)}
              />
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
              <DownloadsTray
                downloads={visibleDownloads}
                tokens={tokens}
                onRemove={(id) => void removeDownload(id)}
              />
            ) : null}
          </>
        ) : (
          <View style={{ backgroundColor: tokens.panel, borderRadius: tokens.panelRadius, borderWidth: 1, borderColor: tokens.panelRim, padding: 24, alignItems: "center", gap: 8 }}>
            <Text style={{ fontSize: 56 }}>🎵</Text>
            <Text style={{ color: tokens.label, ...TYPOGRAPHY.title, fontWeight: "800" }}>Search YouTube Music</Text>
            <Text style={{ color: tokens.label2, ...TYPOGRAPHY.body, textAlign: "center" }}>Millions of songs, no ads. Sign in to play.</Text>
          </View>
        )}

        {/*
          The RECENTLY PLAYED shelf — the visible history, on the grouped
          ground. It plays through the visible list, exactly as it always did.
        */}
        {!visibleCurrent && visibleHistory.length > 0 ? (
          <HistoryShelf
            history={visibleHistory}
            tokens={tokens}
            onPlay={(track, list) => void play(track, list)}
          />
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

/**
 * The search RESULTS — a Top Result card and the rows below it.
 *
 * The first track the viewer may see leads: it gets its own card, with the
 * artwork at 120 and a Play button of its own. The rest are rows on a panel,
 * separated by hairlines.
 *
 * EVERY row here came from the provider's VISIBLE list (`visibleTracks`), so
 * a track this viewer may not see is never painted — for a kid and for a
 * guest alike.
 */
function SearchResults({
  tracks, tokens, isParent, denied, onPlay, onQueue,
}: {
  tracks: MediaTrack[];
  tokens: MusicTokens;
  isParent: boolean;
  denied: string[];
  onPlay: (track: MediaTrack, list: MediaTrack[]) => void;
  onQueue: (track: MediaTrack) => void;
}) {
  const [top, ...rest] = tracks;
  return (
    <View style={{ gap: tokens.shelfGap }}>
      <TopResultCard
        track={top}
        list={tracks}
        tokens={tokens}
        isParent={isParent}
        denied={denied}
        onPlay={onPlay}
        onQueue={onQueue}
      />
      {rest.length > 0 ? (
        <PanelCard testID="music-results" tokens={tokens}>
          {rest.map((track, index) => (
            <ResultRow
              key={track.id}
              track={track}
              list={tracks}
              index={index}
              tokens={tokens}
              isParent={isParent}
              denied={denied}
              onPlay={onPlay}
              onQueue={onQueue}
            />
          ))}
        </PanelCard>
      ) : null}
    </View>
  );
}

/**
 * The TOP RESULT card — the first visible result, artwork-led.
 *
 * It is the surface's headline: the cover leads at 120, the words sit beside
 * it, and the actions (Play, + Queue) are thumb-sized on their own row.
 *
 * The markers ("Unrated", "Blocked for kids") ride along here exactly as they
 * ride on a row: same copy, same parent-only visibility.
 */
function TopResultCard({
  track, list, tokens, isParent, denied, onPlay, onQueue,
}: {
  track: MediaTrack;
  list: MediaTrack[];
  tokens: MusicTokens;
  isParent: boolean;
  denied: string[];
  onPlay: (track: MediaTrack, list: MediaTrack[]) => void;
  onQueue: (track: MediaTrack) => void;
}) {
  // A parent sees every row, so an UNRATED row (no rating at all) must be
  // marked as such — a quiet label, never a badge that reads as an error.
  // Kid roles never see these rows while the filter is on (they fail
  // closed), so the marker is parent-only.
  const unratedRow = isParent && track.explicit === null;
  // The family's OWN list: a parent sees the row AND the fact that the kids
  // do not — the rule is visible and verifiable. A kid never sees this row at
  // all (the policy hides it), so the marker is parent-only too.
  const blockedRow = isParent && isDeniedTerm(track, denied);
  return (
    <View
      testID="music-top-result"
      style={{
        backgroundColor: tokens.panel,
        borderRadius: tokens.panelRadius,
        borderWidth: 1,
        borderColor: tokens.panelRim,
        padding: 16,
        gap: 14,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
        <ArtworkLead testID="music-top-result-artwork" track={track} tokens={tokens} />
        <Pressable
          testID={`music-result-${track.id}`}
          accessibilityRole="button"
          accessibilityLabel={`Play ${track.title} by ${track.artist}${unratedRow ? ", unrated" : ""}${blockedRow ? ", blocked for kids" : ""}`}
          onPress={() => onPlay(track, list)}
          style={{ flex: 1, minHeight: 64, justifyContent: "center" }}
        >
          <Text numberOfLines={2} style={{ color: tokens.label, ...TYPOGRAPHY.title, fontWeight: "700" }}>
            {track.title}
          </Text>
          <Text numberOfLines={1} style={{ color: tokens.label3, ...TYPOGRAPHY.label }}>
            {track.artist}
          </Text>
          {unratedRow || blockedRow ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
              {unratedRow ? (
                <Marker testID={`music-result-unrated-${track.id}`} label="Unrated" tokens={tokens} />
              ) : null}
              {blockedRow ? (
                <Marker testID={`music-result-blocked-${track.id}`} label="Blocked for kids" tokens={tokens} accent />
              ) : null}
            </View>
          ) : null}
        </Pressable>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable
          testID="music-top-result-play"
          accessibilityRole="button"
          accessibilityLabel={`Play ${track.title}`}
          onPress={() => onPlay(track, list)}
          style={{
            minHeight: 64,
            paddingHorizontal: 24,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: tokens.panelRadius,
            backgroundColor: tokens.accent,
          }}
        >
          {/* LARGE text on the accent fill — see the search submit. */}
          <Text style={{ color: tokens.onAccent, fontSize: TYPOGRAPHY.title.fontSize, fontWeight: "800" }}>
            Play
          </Text>
        </Pressable>
        <Pressable
          testID="music-top-result-queue"
          accessibilityRole="button"
          accessibilityLabel={`Add ${track.title} to queue`}
          onPress={() => onQueue(track)}
          style={{
            minHeight: 64,
            paddingHorizontal: 20,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: tokens.panelRadius,
            borderWidth: 1,
            borderColor: tokens.panelRim,
          }}
        >
          <Text style={{ color: tokens.label, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
            + Queue
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * One result ROW — the panel rows below the Top Result.
 *
 * The artwork is a 48dp thumb, the title reads the label tier and the artist
 * the third, and the row is a thumb-sized target that plays the track.
 */
function ResultRow({
  track, list, index, tokens, isParent, denied, onPlay, onQueue,
}: {
  track: MediaTrack;
  list: MediaTrack[];
  index: number;
  tokens: MusicTokens;
  isParent: boolean;
  denied: string[];
  onPlay: (track: MediaTrack, list: MediaTrack[]) => void;
  onQueue: (track: MediaTrack) => void;
}) {
  const unratedRow = isParent && track.explicit === null;
  const blockedRow = isParent && isDeniedTerm(track, denied);
  return (
    <Pressable
      testID={`music-result-${track.id}`}
      accessibilityRole="button"
      accessibilityLabel={`Play ${track.title} by ${track.artist}${unratedRow ? ", unrated" : ""}${blockedRow ? ", blocked for kids" : ""}`}
      onPress={() => onPlay(track, list)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        minHeight: 64,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderTopWidth: index === 0 ? 0 : 1,
        borderTopColor: tokens.panelSeparator,
      }}
    >
      <ArtworkThumb testID={`music-result-thumb-${track.id}`} track={track} tokens={tokens} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text numberOfLines={1} style={{ color: tokens.label, ...TYPOGRAPHY.body, fontWeight: "700", flexShrink: 1 }}>
            {track.title}
          </Text>
          {unratedRow ? (
            <Marker testID={`music-result-unrated-${track.id}`} label="Unrated" tokens={tokens} />
          ) : null}
          {blockedRow ? (
            <Marker testID={`music-result-blocked-${track.id}`} label="Blocked for kids" tokens={tokens} accent />
          ) : null}
        </View>
        <Text numberOfLines={1} style={{ color: tokens.label3, ...TYPOGRAPHY.label }}>
          {track.artist}
        </Text>
      </View>
      <Pressable
        testID={`music-result-queue-${track.id}`}
        accessibilityRole="button"
        accessibilityLabel={`Add ${track.title} to queue`}
        hitSlop={8}
        onPress={(e) => { e?.stopPropagation?.(); onQueue(track); }}
        style={{
          minHeight: 64,
          minWidth: 64,
          paddingHorizontal: 12,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: tokens.artworkRadius,
        }}
      >
        <Text style={{ color: tokens.label2, ...TYPOGRAPHY.label, fontWeight: "700" }}>+ Queue</Text>
      </Pressable>
    </Pressable>
  );
}

/**
 * A track's MARKER — "Unrated" or "Blocked for kids".
 *
 * WHY THE TEXT IS NOT THE ACCENT: the Liquid accent is a LARGE-text colour
 * (3.65:1 on the light ground — see music-tokens.ts), and a marker is a
 * 14sp label. So the words read the second tier and only the RIM takes the
 * accent — a rule the eye can see, a word it can read.
 */
function Marker({
  testID, label, tokens, accent,
}: {
  testID: string;
  label: string;
  tokens: MusicTokens;
  accent?: boolean;
}) {
  return (
    <View
      testID={testID}
      style={{
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: accent ? tokens.accent : tokens.panelRim,
      }}
    >
      <Text style={{ color: tokens.label2, fontSize: TYPOGRAPHY.label.fontSize, lineHeight: TYPOGRAPHY.label.lineHeight, fontWeight: "600" }}>
        {label}
      </Text>
    </View>
  );
}

/**
 * The DOWNLOADS tray — the offline shelf.
 *
 * The header keeps its honest cap copy ("Downloads · 12 MB"): the total of
 * the tracks THIS viewer may see. The rows are panel rows, and the delete is
 * a thumb-sized control of its own.
 */
function DownloadsTray({
  downloads, tokens, onRemove,
}: {
  downloads: DownloadEntry[];
  tokens: MusicTokens;
  onRemove: (id: string) => void;
}) {
  return (
    <View testID="music-downloads" style={{ gap: tokens.shelfGap }}>
      <Text style={{ color: tokens.label, ...TYPOGRAPHY.title, fontWeight: "700" }}>
        Downloads · {formatBytes(totalDownloadBytes(downloads))}
      </Text>
      <PanelCard tokens={tokens}>
        {downloads.map((item, index) => (
          <View
            key={item.id}
            testID={`music-download-${item.id}`}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              minHeight: 64,
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderTopWidth: index === 0 ? 0 : 1,
              borderTopColor: tokens.panelSeparator,
            }}
          >
            <ArtworkThumb testID={`music-download-thumb-${item.id}`} track={item} tokens={tokens} />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ color: tokens.label, ...TYPOGRAPHY.body, fontWeight: "700" }}>
                {item.title}
              </Text>
              <Text numberOfLines={1} style={{ color: tokens.label3, ...TYPOGRAPHY.label }}>
                {item.artist}
              </Text>
            </View>
            <Text style={{ color: tokens.label3, ...TYPOGRAPHY.label }}>{formatBytes(item.bytes)}</Text>
            <Pressable
              testID={`music-download-remove-${item.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Delete download ${item.title}`}
              onPress={() => onRemove(item.id)}
              style={{
                minHeight: 64,
                minWidth: 64,
                paddingHorizontal: 12,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: tokens.artworkRadius,
                borderWidth: 1,
                borderColor: tokens.panelRim,
              }}
            >
              <Text style={{ color: tokens.label, ...TYPOGRAPHY.label, fontWeight: "700" }}>Delete</Text>
            </Pressable>
          </View>
        ))}
      </PanelCard>
    </View>
  );
}

/**
 * The RECENTLY PLAYED shelf — the visible history, on the grouped ground.
 *
 * The section ground is `grouped` and the rows sit on a panel inside it, so
 * the shelf reads as a raised section of the page. The play behaviour is the
 * one it always had: the row plays the track through the VISIBLE history.
 */
function HistoryShelf({
  history, tokens, onPlay,
}: {
  history: MediaTrack[];
  tokens: MusicTokens;
  onPlay: (track: MediaTrack, list: MediaTrack[]) => void;
}) {
  return (
    <View
      testID="music-history-shelf"
      style={{
        backgroundColor: tokens.grouped,
        borderRadius: tokens.panelRadius,
        borderWidth: 1,
        borderColor: tokens.panelRim,
        overflow: "hidden",
      }}
    >
      <View style={{ paddingHorizontal: 16, paddingVertical: 8, minHeight: 64, justifyContent: "center" }}>
        <Text style={{ color: tokens.label, ...TYPOGRAPHY.title, fontWeight: "700" }}>Recently played</Text>
      </View>
      {history.length === 0 ? (
        <Text
          testID="music-history-empty"
          style={{
            color: tokens.label2,
            ...TYPOGRAPHY.body,
            paddingHorizontal: 16,
            paddingVertical: 14,
            borderTopWidth: 1,
            borderTopColor: tokens.panelSeparator,
          }}
        >
          Nothing played yet.
        </Text>
      ) : (
        <View
          style={{
            backgroundColor: tokens.panel,
            margin: 10,
            borderRadius: tokens.artworkRadius,
            borderWidth: 1,
            borderColor: tokens.panelRim,
            overflow: "hidden",
          }}
        >
          {history.slice(0, 8).map((track, index) => (
            <HistoryRow
              key={track.id}
              track={track}
              history={history}
              index={index}
              tokens={tokens}
              onPlay={onPlay}
            />
          ))}
        </View>
      )}
    </View>
  );
}

/**
 * A PANEL — the Liquid card the rows live in.
 *
 * One card per list: the fill, the hairline rim, the Liquid radius, and the
 * rows inside it separated by `panelSeparator` hairlines.
 */
function PanelCard({
  testID, children, tokens, style,
}: {
  testID?: string;
  children: React.ReactNode;
  tokens: MusicTokens;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      testID={testID}
      style={[
        {
          backgroundColor: tokens.panel,
          borderRadius: tokens.panelRadius,
          borderWidth: 1,
          borderColor: tokens.panelRim,
          overflow: "hidden",
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/**
 * The artwork at 120 — the Top Result's lead.
 *
 * The Liquid radius, the grouped ground behind the cover, and never a
 * stretched picture: the image is cropped to its square.
 */
function ArtworkLead({
  testID, track, tokens,
}: {
  testID: string;
  track: { artworkUrl: string | null };
  tokens: MusicTokens;
}) {
  return (
    <View
      testID={testID}
      style={{
        width: 120,
        height: 120,
        borderRadius: tokens.artworkRadius,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: tokens.grouped,
      }}
    >
      {track.artworkUrl ? (
        <Image source={{ uri: track.artworkUrl }} style={{ width: 120, height: 120 }} resizeMode="cover" />
      ) : (
        <Text style={{ fontSize: 40 }}>🎵</Text>
      )}
    </View>
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
            // The scrim, not a white fill: this control sits on the tint, so
            // its fill is part of the ground under its own label.
            backgroundColor: tokens.scrim,
            borderWidth: 1,
            borderColor: tokens.panelRim,
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
 * A round stage control: the disc's fill is the scrim (a DARK translucent
 * wash), and an active control (shuffle on, repeat on) wears the accent.
 *
 * WHY THE SCRIM AND NOT A WHITE FILL: the chip sits on the artwork's tint,
 * so its fill IS part of the ground its own label is measured against. A
 * white fill lifts that ground — on the dark band's brightest edge the
 * white label read 4.06:1, under the 4.5:1 floor. A dark scrim lowers it
 * instead, in both themes, without flattening the tint (see
 * tests/music-stage-contrast.test.ts).
 */
function stageDisc(tokens: MusicTokens, size: number, active?: string) {
  return {
    width: size,
    height: size,
    borderRadius: size / 2,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: active ? mix(active, "transparent", 18) : tokens.scrim,
    borderWidth: 1,
    borderColor: tokens.panelRim,
  };
}

interface LyricsPaneProps {
  /** The lines of the track, or null when it has none. */
  lines: LyricLine[] | null;
  /** The index of the line being sung (-1 before the first one). */
  activeIndex: number;
  tokens: MusicTokens;
  /** The app's reduced-motion authority — the follow arrives at once. */
  reduceMotion: boolean;
  onSeek: (seconds: number) => void;
}

/**
 * The LYRICS pane — the words, line-synced.
 *
 * Three rules, in order of importance:
 *
 *   1. THE LINE BEING SUNG IS LED: the accent colour and a touch bigger (a
 *      TRANSFORM, so the list never reflows under the finger that follows
 *      it). Its neighbours step down to the second tier, the rest to the
 *      third.
 *      (The accent is a LARGE-TEXT colour: at 22sp bold the line is large
 *      copy, so the light theme's 3.65:1 accent clears the 3:1 large-text
 *      floor — the same contract the Now Playing title follows.)
 *   2. TAPPING A LINE SEEKS TO IT — the whole point of showing the words.
 *   3. THE FOLLOW KEEPS THE CURRENT LINE IN VIEW, and pauses for ~3s when
 *      the user scrolls, so it never fights the finger.
 *
 * LINE-LEVEL only: the word-by-word fill is SP3.
 */
function LyricsPane({ lines, activeIndex, tokens, reduceMotion, onSeek }: LyricsPaneProps) {
  const scrollRef = React.useRef<ScrollView | null>(null);
  // Each line's measured y — the follow's map from a line to an offset.
  const offsets = React.useRef<Record<number, number>>({});
  const viewportHeight = React.useRef(0);
  const [followPaused, setFollowPaused] = React.useState(false);
  const resumeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToLine = React.useCallback(
    (index: number) => {
      const y = offsets.current[index];
      if (y === undefined) return;
      scrollRef.current?.scrollTo({
        y: followOffset(y, viewportHeight.current),
        // Reduced motion: the follow arrives at once (the app's authority is
        // AccessibilityInfo.isReduceMotionEnabled, read by the ThemeProvider).
        animated: !reduceMotion,
      });
    },
    [reduceMotion]
  );

  // The follow: the line being sung is brought into view whenever it
  // changes — unless the user is scrolling (then the finger wins).
  React.useEffect(() => {
    if (activeIndex < 0 || followPaused) return;
    scrollToLine(activeIndex);
  }, [activeIndex, followPaused, scrollToLine]);

  const pauseFollow = React.useCallback(() => {
    setFollowPaused(true);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setFollowPaused(false), FOLLOW_PAUSE_MS);
  }, []);

  const resumeFollow = React.useCallback(() => {
    if (resumeTimer.current) {
      clearTimeout(resumeTimer.current);
      resumeTimer.current = null;
    }
    setFollowPaused(false);
  }, []);

  React.useEffect(
    () => () => {
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    },
    []
  );

  return (
    <ScrollView
      ref={scrollRef}
      testID="music-lyrics-scroll"
      style={{ maxHeight: LYRICS_VIEWPORT_DP }}
      nestedScrollEnabled
      onLayout={(e) => {
        viewportHeight.current = e.nativeEvent.layout.height;
      }}
      onScrollBeginDrag={pauseFollow}
    >
      <View testID="music-lyrics" style={{ gap: 4, paddingVertical: 8 }}>
        {lines && lines.length > 0 ? (
          lines.map((line, index) => {
            const isCurrent = index === activeIndex;
            const isNeighbour =
              activeIndex >= 0 && (index === activeIndex - 1 || index === activeIndex + 1);
            const color = isCurrent ? tokens.accent : isNeighbour ? tokens.label2 : tokens.label3;
            return (
              <Pressable
                key={`${line.timeMs}-${index}`}
                testID={`music-lyric-${index}`}
                accessibilityRole="button"
                accessibilityLabel={line.text || "Rest"}
                onPress={() => {
                  // A tap is an intent: the follow comes back with the seek.
                  resumeFollow();
                  onSeek(line.timeMs / 1000);
                }}
                onLayout={(e) => {
                  offsets.current[index] = e.nativeEvent.layout.y;
                  // The line may be measured after the song moved on to it.
                  if (index === activeIndex) scrollToLine(index);
                }}
                style={{ minHeight: 64, justifyContent: "center", paddingVertical: 8 }}
              >
                <Text
                  style={{
                    color,
                    ...LYRIC_TYPE.line,
                    fontWeight: isCurrent
                      ? LYRIC_TYPE.current.fontWeight
                      : LYRIC_TYPE.line.fontWeight,
                    transform: isCurrent ? [{ scale: LYRIC_CURRENT_SCALE }] : undefined,
                  }}
                >
                  {line.text || "♪"}
                </Text>
              </Pressable>
            );
          })
        ) : (
          <Text
            testID="music-lyrics-empty"
            style={{ color: tokens.label2, ...TYPOGRAPHY.body, paddingVertical: 12 }}
          >
            No lyrics for this track.
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

interface QueuePaneProps {
  /** The VISIBLE queue — a track this viewer may not see never arrives here. */
  queue: MediaTrack[];
  /** The VISIBLE history — the same rule, the same list. */
  history: MediaTrack[];
  tokens: MusicTokens;
  shuffle: boolean;
  repeat: RepeatMode;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
  onPlay: (track: MediaTrack, list: MediaTrack[]) => void;
  onRemove: (index: number) => void;
  onMove: (from: number, to: number) => void;
}

/**
 * The QUEUE pane — what plays next, and what just played.
 *
 * Two panels on the Liquid grounds: "Playing Next" (the visible queue) with
 * the shuffle/repeat capsules in its header — they change what plays next,
 * so they belong with it — and "Recently played" (the visible history)
 * below.
 */
function QueuePane({
  queue, history, tokens, shuffle, repeat,
  onToggleShuffle, onCycleRepeat, onPlay, onRemove, onMove,
}: QueuePaneProps) {
  return (
    <View testID="music-queue" style={{ gap: tokens.shelfGap }}>
      <View
        style={{
          backgroundColor: tokens.panel,
          borderRadius: tokens.panelRadius,
          borderWidth: 1,
          borderColor: tokens.panelRim,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingHorizontal: 16,
            paddingVertical: 8,
            minHeight: 64,
          }}
        >
          <Text style={{ color: tokens.label, ...TYPOGRAPHY.title, fontWeight: "700", flex: 1 }}>
            Playing Next
          </Text>
          <QueueCapsule
            testID="music-queue-shuffle"
            label="Shuffle"
            active={shuffle}
            onPress={onToggleShuffle}
            tokens={tokens}
          />
          <QueueCapsule
            testID="music-queue-repeat"
            label="Repeat"
            active={repeat !== "off"}
            onPress={onCycleRepeat}
            tokens={tokens}
          />
        </View>
        {queue.length === 0 ? (
          <Text
            testID="music-queue-empty"
            style={{
              color: tokens.label2,
              ...TYPOGRAPHY.body,
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderTopWidth: 1,
              borderTopColor: tokens.panelSeparator,
            }}
          >
            The queue is empty.
          </Text>
        ) : (
          queue.map((track, index) => (
            <QueueRow
              key={`${track.id}-${index}`}
              track={track}
              index={index}
              count={queue.length}
              queue={queue}
              tokens={tokens}
              onPlay={onPlay}
              onRemove={onRemove}
              onMove={onMove}
            />
          ))
        )}
      </View>

      {/*
        The RECENTLY PLAYED shelf — the SAME shelf the page shows when
        nothing is playing, so the two never drift apart.
      */}
      <HistoryShelf history={history} tokens={tokens} onPlay={onPlay} />
    </View>
  );
}

/** One row of the queue: the artwork, the words, and the row's own actions. */
function QueueRow({
  track, index, count, queue, tokens, onPlay, onRemove, onMove,
}: {
  track: MediaTrack;
  index: number;
  count: number;
  queue: MediaTrack[];
  tokens: MusicTokens;
  onPlay: (track: MediaTrack, list: MediaTrack[]) => void;
  onRemove: (index: number) => void;
  onMove: (from: number, to: number) => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        minHeight: 64,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderTopWidth: 1,
        borderTopColor: tokens.panelSeparator,
      }}
    >
      <ArtworkThumb testID={`music-queue-thumb-${index}`} track={track} tokens={tokens} />
      <Pressable
        testID={`music-queue-row-${index}`}
        accessibilityRole="button"
        accessibilityLabel={`Play ${track.title} by ${track.artist}`}
        onPress={() => onPlay(track, queue)}
        style={{ flex: 1, minHeight: 64, justifyContent: "center" }}
      >
        <Text numberOfLines={1} style={{ color: tokens.label, ...TYPOGRAPHY.body, fontWeight: "700" }}>
          {track.title}
        </Text>
        <Text numberOfLines={1} style={{ color: tokens.label3, ...TYPOGRAPHY.label }}>
          {track.artist}
        </Text>
      </Pressable>
      <QueueAction
        testID={`music-queue-up-${index}`}
        label={`Move ${track.title} up`}
        glyph="↑"
        disabled={index === 0}
        onPress={() => onMove(index, index - 1)}
        tokens={tokens}
      />
      <QueueAction
        testID={`music-queue-down-${index}`}
        label={`Move ${track.title} down`}
        glyph="↓"
        disabled={index === count - 1}
        onPress={() => onMove(index, index + 1)}
        tokens={tokens}
      />
      <QueueAction
        testID={`music-queue-remove-${index}`}
        label={`Remove ${track.title} from the queue`}
        glyph="✕"
        onPress={() => onRemove(index)}
        tokens={tokens}
      />
    </View>
  );
}

/** One row of the recently played shelf — it plays, exactly as it always did. */
function HistoryRow({
  track, history, index, tokens, onPlay,
}: {
  track: MediaTrack;
  history: MediaTrack[];
  /** Its place in the list — the first row carries no hairline above it. */
  index: number;
  tokens: MusicTokens;
  onPlay: (track: MediaTrack, list: MediaTrack[]) => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        minHeight: 64,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderTopWidth: index === 0 ? 0 : 1,
        borderTopColor: tokens.panelSeparator,
      }}
    >
      <ArtworkThumb testID={`music-history-thumb-${track.id}`} track={track} tokens={tokens} />
      <Pressable
        testID={`music-history-${track.id}`}
        accessibilityRole="button"
        accessibilityLabel={`Play ${track.title} by ${track.artist}`}
        onPress={() => onPlay(track, history)}
        style={{ flex: 1, minHeight: 64, justifyContent: "center" }}
      >
        <Text numberOfLines={1} style={{ color: tokens.label, ...TYPOGRAPHY.body, fontWeight: "700" }}>
          {track.title}
        </Text>
        <Text numberOfLines={1} style={{ color: tokens.label3, ...TYPOGRAPHY.label }}>
          {track.artist}
        </Text>
      </Pressable>
    </View>
  );
}

/** The artwork thumbnail — 48dp, the Liquid radius, on the grouped ground. */
function ArtworkThumb({
  testID, track, tokens,
}: {
  testID: string;
  /** Anything with a cover — a search result, a download, a history row. */
  track: { artworkUrl: string | null };
  tokens: MusicTokens;
}) {
  return (
    <View
      testID={testID}
      style={{
        width: 48,
        height: 48,
        borderRadius: tokens.artworkRadius,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: tokens.grouped,
      }}
    >
      {track.artworkUrl ? (
        <Image
          source={{ uri: track.artworkUrl }}
          style={{ width: 48, height: 48 }}
          resizeMode="cover"
        />
      ) : (
        <Text style={{ fontSize: 20 }}>🎵</Text>
      )}
    </View>
  );
}

/** A row's own action — a ghost button on the 64dp wall floor. */
function QueueAction({
  testID, label, glyph, disabled, onPress, tokens,
}: {
  testID: string;
  label: string;
  glyph: string;
  disabled?: boolean;
  onPress: () => void;
  tokens: MusicTokens;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={() => {
        if (disabled) return;
        onPress();
      }}
      style={{ width: 48, height: 64, alignItems: "center", justifyContent: "center" }}
    >
      <Text style={{ color: disabled ? tokens.label3 : tokens.label2, fontSize: 20 }}>{glyph}</Text>
    </Pressable>
  );
}

/** The shuffle/repeat capsule — a state switch in the section header. */
function QueueCapsule({
  testID, label, active, onPress, tokens,
}: {
  testID: string;
  label: string;
  active: boolean;
  onPress: () => void;
  tokens: MusicTokens;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${label} ${active ? "on" : "off"}`}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{
        minWidth: 64,
        minHeight: 64,
        paddingHorizontal: 16,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? tokens.accent : tokens.panelRim,
        backgroundColor: active ? mix(tokens.accent, "transparent", 18) : "transparent",
      }}
    >
      <Text style={{ color: tokens.label, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
        {label}
      </Text>
    </Pressable>
  );
}

export default MusicPlayer;
