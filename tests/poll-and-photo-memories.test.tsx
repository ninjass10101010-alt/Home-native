/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ThemeProvider } from "../src/theme/ThemeProvider";
import { ToastProvider } from "../src/ui/Toast";
import {
  _resetDinnerPollForTest,
  computePollWinner,
  DEFAULT_POLL_OPTIONS,
  loadDinnerPoll,
  resetDinnerPollVotes,
  toggleDinnerVote,
  addDinnerPollOption,
} from "../src/meals/dinner-poll";
import { DinnerPollCard } from "../src/meals/DinnerPollCard";
import {
  _resetPhotoMemoriesForTest,
  loadPhotoMemories,
  reactToPhoto,
  savePhotoCaption,
} from "../src/photos/photo-memories";
import { PhotosPage } from "../src/photos/PhotosPage";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

const mockRouterPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockRouterPush, canGoBack: () => true, back: jest.fn() }),
  usePathname: () => "/photos",
  useLocalSearchParams: () => ({}),
}));

const parent = { id: "p1", name: "Rebecca (Mom)", role: "parent", emoji: "🐱", color: "green" };

let mockMember: any = parent;
jest.mock("../src/state/AuthProvider", () => ({
  useAuth: () => ({
    member: mockMember,
    role: mockMember ? mockMember.role : null,
    hydrated: true,
    signOut: jest.fn(),
    poke: jest.fn(),
    pinRequiredFor: jest.requireActual("../src/state/AuthProvider").pinRequiredFor,
  }),
}));

let mockStale = false;
const mockRefreshNow = jest.fn(async () => {});
const mockPulseListeners = new Set<() => void>();
const mockSyncValue = {
  get stale() {
    return mockStale;
  },
  syncError: null as null,
  lastSyncAt: null as null,
  refreshNow: mockRefreshNow,
  onPulse: (l: () => void) => {
    mockPulseListeners.add(l);
    return () => {
      mockPulseListeners.delete(l);
    };
  },
};
jest.mock("../src/state/SyncManager", () => ({
  useSync: () => mockSyncValue,
}));

jest.mock("../src/api/client", () => ({
  api: jest.fn(),
  ApiError: jest.requireActual("../src/api/client").ApiError,
}));
const { api } = jest.requireMock("../src/api/client") as { api: jest.Mock };
const { ApiError } = jest.requireActual("../src/api/client") as { ApiError: any };

jest.mock("../src/api/config", () => ({
  getBaseUrl: () => "http://nas.local:3000",
  hydrateBaseUrl: jest.fn(async () => {}),
  setBaseUrl: jest.fn(async () => {}),
  DEFAULT_BASE_URL: "http://nas.local:3000",
}));
jest.mock("../src/api/session", () => ({
  getSessionCookie: () => "sess-cookie",
  saveSessionCookie: jest.fn(async () => {}),
  loadSessionCookie: jest.fn(async () => "sess-cookie"),
  clearSessionCookie: jest.fn(async () => {}),
  readSetCookie: jest.fn(),
}));

const wrap = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>
    <ToastProvider>{children}</ToastProvider>
  </ThemeProvider>
);

const PHOTOS = [
  {
    id: "ph1",
    url: "/api/photos/file?r=ph1&f=beach.jpg",
    width: 400,
    height: 600,
    takenAt: "2026-10-10T10:00:00Z",
    caption: "Beach day 🏖️",
    showOnWall: true,
  },
  {
    id: "ph2",
    url: "/api/photos/file?r=ph2&f=cake.jpg",
    width: 600,
    height: 400,
    takenAt: "2026-10-09T10:00:00Z",
    showOnWall: false,
  },
];

const route = (handlers: Record<string, unknown>) =>
  api.mockImplementation((path: string) => {
    for (const key of Object.keys(handlers)) {
      if (path.startsWith(key)) {
        const v = handlers[key];
        return v instanceof Error ? Promise.reject(v) : Promise.resolve(v);
      }
    }
    return Promise.reject(new ApiError({ message: "unmapped path", status: 404, code: "not_found" }));
  });

const fullRoute = () =>
  route({
    "/api/photos?all=1": { ok: true, photos: PHOTOS },
    "/api/photos/settings": {
      ok: true,
      settings: {
        rotateSeconds: 75,
        transition: "crossfade",
        order: "shuffle",
        showCaption: true,
      },
    },
    "/api/photos": { ok: true },
  });

beforeEach(async () => {
  jest.clearAllMocks();
  mockPulseListeners.clear();
  mockMember = parent;
  mockStale = false;
  api.mockReset();
  await AsyncStorage.clear();
  await _resetDinnerPollForTest();
  await _resetPhotoMemoriesForTest();
});

describe("Part 1 — Dinner Poll Logic & Component", () => {
  it("loadDinnerPoll seeds default options when storage is empty", async () => {
    const options = await loadDinnerPoll();
    expect(options).toHaveLength(3);
    expect(options[0].id).toBe("poll-tacos");
    expect(options[0].name).toBe("Taco Fiesta");
    expect(options[1].id).toBe("poll-pizza");
    expect(options[2].id).toBe("poll-pasta");
  });

  it("toggleDinnerVote casts and toggles votes correctly", async () => {
    // 1. Vote for Taco Fiesta
    let options = await toggleDinnerVote("poll-tacos", "Aurora", "👧");
    const tacos = options.find((o) => o.id === "poll-tacos");
    expect(tacos?.votes).toHaveLength(1);
    expect(tacos?.votes[0]).toEqual({ voterName: "Aurora", voterEmoji: "👧" });

    // 2. Another family member votes for Taco Fiesta
    options = await toggleDinnerVote("poll-tacos", "Dad", "👨");
    const tacos2 = options.find((o) => o.id === "poll-tacos");
    expect(tacos2?.votes).toHaveLength(2);

    // 3. Aurora toggles her vote off
    options = await toggleDinnerVote("poll-tacos", "Aurora", "👧");
    const tacos3 = options.find((o) => o.id === "poll-tacos");
    expect(tacos3?.votes).toHaveLength(1);
    expect(tacos3?.votes[0].voterName).toBe("Dad");
  });

  it("computePollWinner correctly determines leader or returns null when empty", () => {
    // When all options have 0 votes -> null
    expect(computePollWinner(DEFAULT_POLL_OPTIONS)).toBeNull();

    // When options have votes
    const mockOpts = [
      { ...DEFAULT_POLL_OPTIONS[0], votes: [{ voterName: "Aurora", voterEmoji: "👧" }] },
      {
        ...DEFAULT_POLL_OPTIONS[1],
        votes: [
          { voterName: "Mom", voterEmoji: "👩" },
          { voterName: "Dad", voterEmoji: "👨" },
        ],
      },
      { ...DEFAULT_POLL_OPTIONS[2], votes: [] },
    ];
    const winner = computePollWinner(mockOpts);
    expect(winner?.id).toBe("poll-pizza");
    expect(winner?.name).toBe("Homemade Pizza");
  });

  it("resetDinnerPollVotes clears all votes across all options", async () => {
    await toggleDinnerVote("poll-pizza", "Mom", "👩");
    await toggleDinnerVote("poll-tacos", "Aurora", "👧");
    let options = await loadDinnerPoll();
    expect(options.some((o) => o.votes.length > 0)).toBe(true);

    options = await resetDinnerPollVotes();
    expect(options.every((o) => o.votes.length === 0)).toBe(true);
  });

  it("addDinnerPollOption adds a custom dinner option", async () => {
    const updated = await addDinnerPollOption("Burger Night", "🍔");
    expect(updated).toHaveLength(4);
    const added = updated.find((o) => o.name === "Burger Night");
    expect(added).toBeDefined();
    expect(added?.emoji).toBe("🍔");
  });

  it("renders DinnerPollCard, handles voting, and parent schedule winner callback", async () => {
    const onSchedule = jest.fn();
    const { findByTestId, getByTestId, queryByTestId, findByText } = render(
      <DinnerPollCard
        voterName="Aurora"
        voterEmoji="👧"
        isParent={true}
        selectedDay="Wed"
        onScheduleWinner={onSchedule}
      />,
      { wrapper: wrap }
    );

    // Card renders
    expect(await findByTestId("meals-dinner-poll-card")).toBeTruthy();

    // Tap Taco Fiesta row to vote
    const tacosBtn = getByTestId("dinner-poll-opt-poll-tacos");
    await act(async () => {
      fireEvent.press(tacosBtn);
    });

    // Check vote count badge shows 1 vote
    const votesBadge = await findByTestId("dinner-poll-votes-poll-tacos");
    expect(votesBadge).toBeTruthy();
    expect(await findByText("1 vote")).toBeTruthy();

    // Parent sees schedule winner button
    const scheduleBtn = await findByTestId("dinner-poll-schedule-winner");
    expect(scheduleBtn).toBeTruthy();

    await act(async () => {
      fireEvent.press(scheduleBtn);
    });
    expect(onSchedule).toHaveBeenCalledTimes(1);
    expect(onSchedule).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "poll-tacos",
        name: "Taco Fiesta",
      })
    );

    // Reset votes button clears votes
    const resetBtn = getByTestId("dinner-poll-reset");
    await act(async () => {
      fireEvent.press(resetBtn);
    });

    await waitFor(() => {
      expect(queryByTestId("dinner-poll-schedule-winner")).toBeNull();
    });
  });

  it("renders Image avatar for photo URIs adhering to the Avatar Safety Contract", async () => {
    // Vote with a data:image URI (photo avatar)
    const photoUri = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
    await toggleDinnerVote("poll-pizza", "PhotoMom", photoUri);

    const { findByTestId } = render(
      <DinnerPollCard
        voterName="Dad"
        voterEmoji="👨"
        isParent={false}
        selectedDay="Fri"
      />,
      { wrapper: wrap }
    );

    const voterImg = await findByTestId("poll-voter-img-PhotoMom");
    expect(voterImg).toBeTruthy();
    expect(voterImg.props.source).toEqual({ uri: photoUri });
  });
});

describe("Part 2 — Photo Memories & Guestbook Reactions", () => {
  it("reactToPhoto increments reactions and persists to storage", async () => {
    let rec = await reactToPhoto("ph1", "love");
    expect(rec.reactions.love).toBe(1);
    expect(rec.reactions.haha).toBe(0);

    rec = await reactToPhoto("ph1", "love");
    expect(rec.reactions.love).toBe(2);

    rec = await reactToPhoto("ph1", "party");
    expect(rec.reactions.party).toBe(1);

    const all = await loadPhotoMemories();
    expect(all["ph1"]?.reactions.love).toBe(2);
    expect(all["ph1"]?.reactions.party).toBe(1);
  });

  it("savePhotoCaption saves and updates custom photo caption", async () => {
    const rec = await savePhotoCaption("ph1", "Summer trip to the coast! 🌊");
    expect(rec.customCaption).toBe("Summer trip to the coast! 🌊");

    const all = await loadPhotoMemories();
    expect(all["ph1"]?.customCaption).toBe("Summer trip to the coast! 🌊");
  });

  it("renders photo-memories-bar in PhotosPage, handles reaction increments and caption saving", async () => {
    fullRoute();

    const { findByTestId, getByTestId, findByText } = render(<PhotosPage />, { wrapper: wrap });

    // Ensure photo page loads and activePreviewPhoto (ph1) is displayed
    expect(await findByTestId("photo-memories-bar")).toBeTruthy();

    // Check reaction love button
    const loveBtn = getByTestId("photo-react-love");
    expect(loveBtn).toBeTruthy();

    // Click love reaction button
    await act(async () => {
      fireEvent.press(loveBtn);
    });

    // Reaction count increments to 1
    expect(await findByText("❤️ 1")).toBeTruthy();

    // Caption input and save note
    const captionInput = getByTestId("photo-caption-input");
    const saveNoteBtn = getByTestId("photo-caption-save");

    await act(async () => {
      fireEvent.changeText(captionInput, "Best day at the beach with kids! 🐚");
    });

    await act(async () => {
      fireEvent.press(saveNoteBtn);
    });

    // Custom caption appears on the preview frame
    expect(await findByText("Best day at the beach with kids! 🐚")).toBeTruthy();

    // Stored in photo memories
    const stored = await loadPhotoMemories();
    expect(stored["ph1"]?.customCaption).toBe("Best day at the beach with kids! 🐚");
  });
});
