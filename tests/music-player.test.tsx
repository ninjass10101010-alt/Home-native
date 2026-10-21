jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));
const mockPlay = jest.fn(async () => {});
const mockToggle = jest.fn();
const mockNext = jest.fn(async () => {});
const mockSeek = jest.fn(async () => {});
const mockRemoveDownload = jest.fn();
const DEFAULT_CURRENT = {
  id: "abc12345678", title: "Song", artist: "Artist", album: "Album",
  durationSeconds: 200, artworkUrl: null, explicit: false, source: "youtube_music",
};
let mockCurrent: any = DEFAULT_CURRENT;
let mockQueue: any[] = [];
let mockDownloads: any[] = [];
let mockHistory: any[] = [];
/** The family setting: the explicit filter is ON by default. */
let mockExplicitFilter: boolean | undefined = true;
/** The signed-in viewer. null = signed-out guest, which also fails closed. */
let mockMember: any = null;

jest.mock("../src/music/playback", () => ({
  usePlayback: () => ({
    current: mockCurrent,
    queue: mockQueue, index: 0, playing: false, position: 10, duration: 200, buffering: false,
    repeat: "off", shuffle: false, error: null,
    downloads: mockDownloads, downloadBytes: mockDownloads.reduce((sum, item) => sum + item.bytes, 0),
    history: mockHistory,
    settings: { repeat: "off", shuffle: false, explicitFilter: mockExplicitFilter },
    // The provider owns the role-aware policy — the surfaces read it from
    // there so the rule can never drift between them.
    policy: { isParent: mockMember?.role === "parent", filterOn: mockExplicitFilter !== false },
    play: mockPlay, playQueueAt: jest.fn(), toggle: mockToggle, next: mockNext, previous: jest.fn(),
    seek: mockSeek, setRepeat: jest.fn(), cycleRepeatMode: jest.fn(), toggleShuffleMode: jest.fn(),
    addToQueue: jest.fn(), removeFromQueue: jest.fn(), moveQueueItem: jest.fn(),
    downloadCurrent: jest.fn(), removeDownload: mockRemoveDownload, setExplicitFilter: jest.fn(),
  }),
}));

const CLEAN_TRACK = {
  id: "clean11111", title: "Found", artist: "A", album: "", durationSeconds: 100,
  artworkUrl: null, explicit: false, source: "youtube_music",
};
const EXPLICIT_TRACK = {
  id: "exp11111111", title: "Bad Song", artist: "B", album: "", durationSeconds: 100,
  artworkUrl: null, explicit: true, source: "youtube_music",
};
const UNRATED_TRACK = {
  id: "unr111111111", title: "Unknown Song", artist: "C", album: "", durationSeconds: 100,
  artworkUrl: null, explicit: null, source: "youtube_music",
};

/** What the engine answered for the last search (the truth the UI must honor). */
let mockSearchOutcome: { tracks: any[]; explicitKnown: boolean } = {
  tracks: [CLEAN_TRACK],
  explicitKnown: true,
};

jest.mock("../modules/youtube-engine", () => ({
  search: jest.fn(async () => mockSearchOutcome),
  related: jest.fn(async () => []),
  resolveAudio: jest.fn(async () => ({ url: "https://x.y/audio.m4a", mimeType: "audio/mp4",
    contentLength: 1, durationSeconds: 1, expiresAt: 0 })),
}));

import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { MusicPlayer } from "../src/music/MusicPlayer";
import { ThemeProvider } from "../src/theme/ThemeProvider";

const wrap = ({ children }: { children: React.ReactNode }) => <ThemeProvider>{children}</ThemeProvider>;

const KID = { id: "c1", name: "Kid", role: "child", emoji: "🐯", color: "green" };
const PARENT = { id: "p1", name: "Rebecca (Mom)", role: "parent", emoji: "🐱", color: "green" };

beforeEach(() => {
  mockCurrent = DEFAULT_CURRENT;
  mockQueue = [];
  mockDownloads = [];
  mockHistory = [];
  mockExplicitFilter = true;
  mockMember = null;
  mockSearchOutcome = { tracks: [CLEAN_TRACK], explicitKnown: true };
  jest.clearAllMocks();
});

it("renders now playing and drives the transport", async () => {
  const { getByTestId } = render(<MusicPlayer />, { wrapper: wrap });
  await waitFor(() => expect(getByTestId("np-title").props.children).toBe("Song"));
  fireEvent.press(getByTestId("np-play"));
  expect(mockToggle).toHaveBeenCalled();
  fireEvent.press(getByTestId("np-next"));
  expect(mockNext).toHaveBeenCalled();
});

it("lists downloads and removes one", async () => {
  // The download carries its rating: a row the viewer may not see is not
  // listed at all (see "hides an explicit download from a kid" below).
  mockDownloads = [{
    id: "abc12345678", title: "Song", artist: "Artist", album: "",
    durationSeconds: 200, artworkUrl: null, fileUri: "file:///x", bytes: 1000, savedAt: 1,
    explicit: false,
  }];
  const { getByTestId } = render(<MusicPlayer />, { wrapper: wrap });
  await waitFor(() => expect(getByTestId("music-download-abc12345678")).toBeTruthy());
  fireEvent.press(getByTestId("music-download-remove-abc12345678"));
  expect(mockRemoveDownload).toHaveBeenCalledWith("abc12345678");
});

it("searches through the native engine", async () => {
  mockCurrent = null;
  const { search } = require("../modules/youtube-engine");
  const { getByTestId, findByText } = render(<MusicPlayer />, { wrapper: wrap });
  const input = getByTestId("music-search-input");
  fireEvent.changeText(input, "beatles");
  fireEvent.press(getByTestId("music-search-submit"));
  expect(await findByText("Found")).toBeTruthy();
  expect(search).toHaveBeenCalledWith("beatles", expect.any(Number));
});

it("shows a recently played shelf when idle", async () => {
  mockCurrent = null;
  mockHistory = [{
    id: "zzz99999999", title: "Older", artist: "Artist", album: "",
    durationSeconds: 100, artworkUrl: null, explicit: false, source: "youtube_music",
  }];
  const { getByTestId } = render(<MusicPlayer />, { wrapper: wrap });
  await waitFor(() => expect(getByTestId("music-history-zzz99999999")).toBeTruthy());
});

it("hides a known-explicit track from a kid member and says so plainly", async () => {
  mockCurrent = null;
  mockMember = KID;
  mockSearchOutcome = { tracks: [EXPLICIT_TRACK], explicitKnown: true };
  const { getByTestId, findByText, queryByText } = render(<MusicPlayer />, { wrapper: wrap });
  fireEvent.changeText(getByTestId("music-search-input"), "beatles");
  fireEvent.press(getByTestId("music-search-submit"));
  expect(await findByText("Nothing here to play — ask a parent to pick something.")).toBeTruthy();
  expect(queryByText("Bad Song")).toBeNull();
});

it("fails closed: a kid member never sees an unrated track", async () => {
  mockCurrent = null;
  mockMember = KID;
  mockSearchOutcome = { tracks: [UNRATED_TRACK], explicitKnown: true };
  const { getByTestId, findByText, queryByText } = render(<MusicPlayer />, { wrapper: wrap });
  fireEvent.changeText(getByTestId("music-search-input"), "beatles");
  fireEvent.press(getByTestId("music-search-submit"));
  expect(await findByText("These tracks aren't rated, so they can't be shown here.")).toBeTruthy();
  expect(queryByText("Unknown Song")).toBeNull();
});

it("says so plainly when the ratings could not be checked at all", async () => {
  mockCurrent = null;
  mockMember = KID;
  mockSearchOutcome = { tracks: [UNRATED_TRACK], explicitKnown: false };
  const { getByTestId, findByText, queryByText } = render(<MusicPlayer />, { wrapper: wrap });
  fireEvent.changeText(getByTestId("music-search-input"), "beatles");
  fireEvent.press(getByTestId("music-search-submit"));
  expect(await findByText("Couldn't check these tracks — ask a parent to pick something.")).toBeTruthy();
  expect(queryByText("Unknown Song")).toBeNull();
});

it("a parent member sees both an explicit and an unrated track", async () => {
  mockCurrent = null;
  mockMember = PARENT;
  mockSearchOutcome = { tracks: [EXPLICIT_TRACK, UNRATED_TRACK], explicitKnown: true };
  const { getByTestId, findByText } = render(<MusicPlayer />, { wrapper: wrap });
  fireEvent.changeText(getByTestId("music-search-input"), "beatles");
  fireEvent.press(getByTestId("music-search-submit"));
  expect(await findByText("Bad Song")).toBeTruthy();
  expect(await findByText("Unknown Song")).toBeTruthy();
});

it("with the filter off, a kid member sees an explicit track", async () => {
  mockCurrent = null;
  mockExplicitFilter = false;
  mockMember = KID;
  mockSearchOutcome = { tracks: [EXPLICIT_TRACK], explicitKnown: true };
  const { getByTestId, findByText } = render(<MusicPlayer />, { wrapper: wrap });
  fireEvent.changeText(getByTestId("music-search-input"), "beatles");
  fireEvent.press(getByTestId("music-search-submit"));
  expect(await findByText("Bad Song")).toBeTruthy();
});

it("says plainly when the search found nothing at all", async () => {
  mockCurrent = null;
  mockMember = KID;
  mockSearchOutcome = { tracks: [], explicitKnown: true };
  const { getByTestId, findByText } = render(<MusicPlayer />, { wrapper: wrap });
  fireEvent.changeText(getByTestId("music-search-input"), "zzzz");
  fireEvent.press(getByTestId("music-search-submit"));
  expect(await findByText("No songs matched that search.")).toBeTruthy();
});

it("fails closed when the persisted setting has no explicitFilter key at all", async () => {
  mockCurrent = null;
  mockMember = KID;
  // A payload written before the key existed: `explicitFilter` is undefined,
  // so the filter must stay ON (only an explicit `false` turns it off).
  mockExplicitFilter = undefined;
  mockSearchOutcome = { tracks: [EXPLICIT_TRACK], explicitKnown: true };
  const { getByTestId, findByText, queryByText } = render(<MusicPlayer />, { wrapper: wrap });
  fireEvent.changeText(getByTestId("music-search-input"), "beatles");
  fireEvent.press(getByTestId("music-search-submit"));
  expect(await findByText("Nothing here to play — ask a parent to pick something.")).toBeTruthy();
  expect(queryByText("Bad Song")).toBeNull();
});

it("marks an unrated row as Unrated for a parent", async () => {
  mockCurrent = null;
  mockMember = PARENT;
  mockSearchOutcome = { tracks: [UNRATED_TRACK, CLEAN_TRACK], explicitKnown: true };
  const { getByTestId, findByTestId, findByText, queryByTestId } = render(<MusicPlayer />, { wrapper: wrap });
  fireEvent.changeText(getByTestId("music-search-input"), "beatles");
  fireEvent.press(getByTestId("music-search-submit"));
  const marker = await findByTestId(`music-result-unrated-${UNRATED_TRACK.id}`);
  expect(marker).toBeTruthy();
  expect(await findByText("Unrated")).toBeTruthy();
  // A row that is not marked explicit carries no marker.
  expect(queryByTestId(`music-result-unrated-${CLEAN_TRACK.id}`)).toBeNull();
});

it("does not mark a row that is not marked explicit", async () => {
  mockCurrent = null;
  mockMember = PARENT;
  mockSearchOutcome = { tracks: [CLEAN_TRACK], explicitKnown: true };
  const { getByTestId, findByText, queryByTestId } = render(<MusicPlayer />, { wrapper: wrap });
  fireEvent.changeText(getByTestId("music-search-input"), "beatles");
  fireEvent.press(getByTestId("music-search-submit"));
  expect(await findByText("Found")).toBeTruthy();
  expect(queryByTestId(`music-result-unrated-${CLEAN_TRACK.id}`)).toBeNull();
});

it("never marks a row for a kid role", async () => {
  mockCurrent = null;
  mockMember = KID;
  mockExplicitFilter = false;
  mockSearchOutcome = { tracks: [UNRATED_TRACK], explicitKnown: true };
  const { getByTestId, findByText, queryByTestId } = render(<MusicPlayer />, { wrapper: wrap });
  fireEvent.changeText(getByTestId("music-search-input"), "beatles");
  fireEvent.press(getByTestId("music-search-submit"));
  expect(await findByText("Unknown Song")).toBeTruthy();
  expect(queryByTestId(`music-result-unrated-${UNRATED_TRACK.id}`)).toBeNull();
});

it("says the check failed when the ratings were unknown and no track came back", async () => {
  mockCurrent = null;
  mockMember = KID;
  mockSearchOutcome = { tracks: [], explicitKnown: false };
  const { getByTestId, findByText, queryByText } = render(<MusicPlayer />, { wrapper: wrap });
  fireEvent.changeText(getByTestId("music-search-input"), "zzzz");
  fireEvent.press(getByTestId("music-search-submit"));
  // An empty list must never read as "nothing found" when the truth is
  // "we could not check the ratings".
  expect(await findByText("Couldn't check these tracks — ask a parent to pick something.")).toBeTruthy();
  expect(queryByText("No songs matched that search.")).toBeNull();
});

it("says nothing matched to a parent when the search found nothing", async () => {
  mockCurrent = null;
  mockMember = PARENT;
  mockSearchOutcome = { tracks: [], explicitKnown: false };
  const { getByTestId, findByText, queryByText } = render(<MusicPlayer />, { wrapper: wrap });
  fireEvent.changeText(getByTestId("music-search-input"), "zzzz");
  fireEvent.press(getByTestId("music-search-submit"));
  expect(await findByText("No songs matched that search.")).toBeTruthy();
  expect(queryByText("Couldn't check these tracks — ask a parent to pick something.")).toBeNull();
});

it("is accurate when only some of the hidden tracks are unrated", async () => {
  mockCurrent = null;
  mockMember = KID;
  mockSearchOutcome = { tracks: [UNRATED_TRACK, EXPLICIT_TRACK], explicitKnown: true };
  const { getByTestId, findByText } = render(<MusicPlayer />, { wrapper: wrap });
  fireEvent.changeText(getByTestId("music-search-input"), "beatles");
  fireEvent.press(getByTestId("music-search-submit"));
  expect(await findByText("Some of these tracks aren't rated, so they can't be shown here.")).toBeTruthy();
});

it("announces the search note to screen readers", async () => {
  mockCurrent = null;
  mockMember = KID;
  mockSearchOutcome = { tracks: [], explicitKnown: true };
  const { getByTestId, findByTestId } = render(<MusicPlayer />, { wrapper: wrap });
  fireEvent.changeText(getByTestId("music-search-input"), "zzzz");
  fireEvent.press(getByTestId("music-search-submit"));
  const note = await findByTestId("music-search-note-empty");
  expect(note.props.accessibilityRole).toBe("alert");
  expect(note.props.accessibilityLiveRegion).toBe("polite");
});

/**
 * The queue, the history and the downloads are track surfaces too: the
 * explicit policy covers every place a kid can SEE a track, not just the
 * search results.
 */
describe("the other track surfaces", () => {
  it("hides an explicit track from the queue for a kid", async () => {
    mockMember = KID;
    mockQueue = [CLEAN_TRACK, EXPLICIT_TRACK];
    const { getByTestId, queryByText, findByText } = render(<MusicPlayer />, { wrapper: wrap });
    fireEvent.press(getByTestId("np-queue"));
    expect(await findByText("Found")).toBeTruthy();
    expect(queryByText("Bad Song")).toBeNull();
  });

  it("shows an explicit track in the queue to a parent", async () => {
    mockMember = PARENT;
    mockQueue = [CLEAN_TRACK, EXPLICIT_TRACK];
    const { getByTestId, findByText } = render(<MusicPlayer />, { wrapper: wrap });
    fireEvent.press(getByTestId("np-queue"));
    expect(await findByText("Bad Song")).toBeTruthy();
  });

  it("hands the player the FILTERED queue, never the raw one", async () => {
    mockMember = KID;
    mockQueue = [CLEAN_TRACK, EXPLICIT_TRACK];
    const { getByTestId, findByText } = render(<MusicPlayer />, { wrapper: wrap });
    fireEvent.press(getByTestId("np-queue"));
    fireEvent.press(await findByText("Found"));
    expect(mockPlay).toHaveBeenCalledWith(CLEAN_TRACK, [CLEAN_TRACK]);
  });

  it("hands a parent the whole queue", async () => {
    mockMember = PARENT;
    mockQueue = [CLEAN_TRACK, EXPLICIT_TRACK];
    const { getByTestId, findByText } = render(<MusicPlayer />, { wrapper: wrap });
    fireEvent.press(getByTestId("np-queue"));
    fireEvent.press(await findByText("Found"));
    expect(mockPlay).toHaveBeenCalledWith(CLEAN_TRACK, [CLEAN_TRACK, EXPLICIT_TRACK]);
  });

  it("hides an explicit track from the recently played shelf for a kid", async () => {
    mockCurrent = null;
    mockMember = KID;
    mockHistory = [CLEAN_TRACK, EXPLICIT_TRACK];
    const { getByTestId, queryByTestId } = render(<MusicPlayer />, { wrapper: wrap });
    expect(getByTestId(`music-history-${CLEAN_TRACK.id}`)).toBeTruthy();
    expect(queryByTestId(`music-history-${EXPLICIT_TRACK.id}`)).toBeNull();
  });

  it("plays the recently played track from the FILTERED shelf", async () => {
    mockCurrent = null;
    mockMember = KID;
    mockHistory = [CLEAN_TRACK, EXPLICIT_TRACK];
    const { getByTestId } = render(<MusicPlayer />, { wrapper: wrap });
    fireEvent.press(getByTestId(`music-history-${CLEAN_TRACK.id}`));
    expect(mockPlay).toHaveBeenCalledWith(CLEAN_TRACK, [CLEAN_TRACK]);
  });

  it("hides an explicit download from a kid", async () => {
    mockMember = KID;
    mockDownloads = [
      { ...CLEAN_TRACK, fileUri: "file:///clean.m4a", bytes: 1000, savedAt: 1 },
      { ...EXPLICIT_TRACK, fileUri: "file:///bad.m4a", bytes: 2000, savedAt: 1 },
    ];
    const { getByTestId, queryByTestId } = render(<MusicPlayer />, { wrapper: wrap });
    expect(getByTestId(`music-download-${CLEAN_TRACK.id}`)).toBeTruthy();
    expect(queryByTestId(`music-download-${EXPLICIT_TRACK.id}`)).toBeNull();
  });

  it("shows an explicit download to a parent", async () => {
    mockMember = PARENT;
    mockDownloads = [
      { ...EXPLICIT_TRACK, fileUri: "file:///bad.m4a", bytes: 2000, savedAt: 1 },
    ];
    const { getByTestId } = render(<MusicPlayer />, { wrapper: wrap });
    expect(getByTestId(`music-download-${EXPLICIT_TRACK.id}`)).toBeTruthy();
  });

  it("never paints a now-playing panel for a track the viewer may not see", async () => {
    mockMember = KID;
    mockCurrent = EXPLICIT_TRACK;
    const { queryByTestId, queryByText } = render(<MusicPlayer />, { wrapper: wrap });
    expect(queryByTestId("np-title")).toBeNull();
    expect(queryByText("Bad Song")).toBeNull();
  });

  it("paints the now-playing panel for a track the viewer may see", async () => {
    mockMember = KID;
    mockCurrent = CLEAN_TRACK;
    const { getByTestId } = render(<MusicPlayer />, { wrapper: wrap });
    expect(getByTestId("np-title").props.children).toBe("Found");
  });
});
