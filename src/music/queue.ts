import type { MediaTrack, QueueState, RepeatMode } from "./types";

export function createQueue(
  tracks: MediaTrack[],
  startIndex = 0,
  repeat: RepeatMode = "off"
): QueueState {
  const index = tracks.length === 0 ? -1 : Math.min(Math.max(startIndex, 0), tracks.length - 1);
  return { tracks, baseTracks: tracks, index, repeat, shuffle: false };
}

export function cycleRepeat(mode: RepeatMode): RepeatMode {
  return mode === "off" ? "all" : mode === "all" ? "one" : "off";
}

export function nextIndex(state: QueueState, options: { auto?: boolean } = {}): number {
  if (state.tracks.length === 0 || state.index < 0) return -1;
  const auto = options.auto === true;
  if (auto && state.repeat === "one") return state.index;
  if (state.index + 1 < state.tracks.length) return state.index + 1;
  if (state.repeat === "all") return 0;
  return auto ? -1 : state.index;
}

export function previousIndex(state: QueueState): number {
  if (state.tracks.length === 0 || state.index < 0) return -1;
  if (state.index > 0) return state.index - 1;
  return state.repeat === "all" ? state.tracks.length - 1 : 0;
}

/** Fisher–Yates with an injectable RNG, so the test can pin the result. */
export function shuffleTracks(tracks: MediaTrack[], random: () => number): MediaTrack[] {
  const copy = [...tracks];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function toggleShuffle(state: QueueState, random: () => number = Math.random): QueueState {
  if (state.tracks.length === 0) return { ...state, shuffle: !state.shuffle };
  const current = state.tracks[state.index];

  if (state.shuffle) {
    const index = state.baseTracks.findIndex((track) => track.id === current?.id);
    return { ...state, tracks: state.baseTracks, index: index >= 0 ? index : 0, shuffle: false };
  }

  const rest = state.tracks.filter((_, i) => i !== state.index);
  const shuffled = current ? [current, ...shuffleTracks(rest, random)] : shuffleTracks(rest, random);
  return { ...state, tracks: shuffled, index: 0, shuffle: true };
}

export function removeAt(state: QueueState, removeIndex: number): QueueState {
  if (removeIndex < 0 || removeIndex >= state.tracks.length) return state;
  const removed = state.tracks[removeIndex];
  const tracks = state.tracks.filter((_, i) => i !== removeIndex);
  const baseTracks = state.baseTracks.filter((track) => track.id !== removed.id);
  if (tracks.length === 0) return { ...state, tracks, baseTracks, index: -1 };
  let index = state.index;
  if (removeIndex < state.index) index -= 1;
  else if (removeIndex === state.index) index = Math.min(index, tracks.length - 1);
  return { ...state, tracks, baseTracks, index };
}

export function moveInQueue(state: QueueState, from: number, to: number): QueueState {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= state.tracks.length ||
    to >= state.tracks.length
  ) {
    return state;
  }
  const currentId = state.tracks[state.index]?.id;
  const tracks = [...state.tracks];
  const [moved] = tracks.splice(from, 1);
  tracks.splice(to, 0, moved);
  const index = currentId ? tracks.findIndex((track) => track.id === currentId) : 0;
  return { ...state, tracks, index: index >= 0 ? index : 0 };
}
