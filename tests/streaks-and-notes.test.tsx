/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

import { ThemeProvider } from "../src/theme/ThemeProvider";
import { ToastProvider } from "../src/ui/Toast";
import { TasksPage } from "../src/tasks/TasksPage";
import {
  resolveMemberStreak,
  recordLocalStreakCompletion,
  loadLocalStreaks,
  _resetStreaksAndNotesMemoryForTest,
  loadStickyNotes,
  addStickyNote,
  togglePinStickyNote,
  deleteStickyNote,
} from "../src/tasks/streaks";

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
  useRouter: () => ({ push: mockRouterPush, canGoBack: () => false }),
  usePathname: () => "/tasks",
}));

const kid = { id: "c1", name: "Aurora", role: "child", age: 10, emoji: "🧚", color: "violet" };
let mockMember: any = kid;

jest.mock("../src/state/AuthProvider", () => ({
  useAuth: () => ({
    member: mockMember,
    role: mockMember ? mockMember.role : null,
    hydrated: true,
    signOut: jest.fn(),
    poke: jest.fn(),
    pinRequiredFor: () => false,
  }),
}));

let mockSnapshot: any = null;
let mockStale = false;
let mockLastSyncAt: number | null = Date.now();
const mockRefreshNow = jest.fn(async () => {});
const mockPulseListeners = new Set<() => void>();

const mockSyncValue = {
  get stale() {
    return mockStale;
  },
  get snapshot() {
    return mockSnapshot;
  },
  get lastSyncAt() {
    return mockLastSyncAt;
  },
  syncError: null as null,
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

const wrap = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>
    <ToastProvider>{children}</ToastProvider>
  </ThemeProvider>
);

const TASKS_FIXTURE = [
  { id: 1, title: "Make bed", assignee: "Aurora", assigneeEmoji: "🛏️", points: 5, completed: false, due: "2026-10-10" },
  { id: 2, title: "Feed cat", assignee: "Aurora", assigneeEmoji: "🐱", points: 3, completed: false },
];

beforeEach(async () => {
  jest.clearAllMocks();
  mockPulseListeners.clear();
  mockMember = kid;
  mockSnapshot = {
    tasks: TASKS_FIXTURE,
    weekData: {
      weekStart: "2026-10-05",
      points: { Aurora: 25 },
      streak: {},
      lastActive: {},
    },
  };
  mockStale = false;
  mockLastSyncAt = Date.now();
  await _resetStreaksAndNotesMemoryForTest();
});

afterEach(async () => {
  await _resetStreaksAndNotesMemoryForTest();
});

describe("streaks.ts — unit tests for resolveMemberStreak", () => {
  it("computes milestone progress accurately across 0, 3, 7, 14, and 30 days", () => {
    // 0 days
    const r0 = resolveMemberStreak({ streak: { Aurora: 0 } }, "Aurora");
    expect(r0.count).toBe(0);
    expect(r0.currentMilestone).toBeNull();
    expect(r0.nextMilestone.id).toBe("spark");
    expect(r0.nextMilestone.days).toBe(3);
    expect(r0.progressPct).toBe(0);

    // 3 days
    const r3 = resolveMemberStreak({ streak: { Aurora: 3 } }, "Aurora");
    expect(r3.count).toBe(3);
    expect(r3.currentMilestone?.id).toBe("spark");
    expect(r3.currentMilestone?.title).toBe("3-Day Spark");
    expect(r3.currentMilestone?.badge).toBe("🔥");
    expect(r3.nextMilestone.id).toBe("flame");
    expect(r3.nextMilestone.days).toBe(7);
    expect(r3.progressPct).toBe(Math.round((3 / 7) * 100)); // 43%

    // 7 days
    const r7 = resolveMemberStreak({ streak: { Aurora: 7 } }, "Aurora");
    expect(r7.count).toBe(7);
    expect(r7.currentMilestone?.id).toBe("flame");
    expect(r7.currentMilestone?.title).toBe("7-Day Flame");
    expect(r7.currentMilestone?.badge).toBe("🌟");
    expect(r7.nextMilestone.id).toBe("champion");
    expect(r7.nextMilestone.days).toBe(14);
    expect(r7.progressPct).toBe(50);

    // 14 days
    const r14 = resolveMemberStreak({ streak: { Aurora: 14 } }, "Aurora");
    expect(r14.count).toBe(14);
    expect(r14.currentMilestone?.id).toBe("champion");
    expect(r14.currentMilestone?.title).toBe("14-Day Champion");
    expect(r14.currentMilestone?.badge).toBe("👑");
    expect(r14.nextMilestone.id).toBe("legend");
    expect(r14.nextMilestone.days).toBe(30);
    expect(r14.progressPct).toBe(Math.round((14 / 30) * 100)); // 47%

    // 30 days
    const r30 = resolveMemberStreak({ streak: { Aurora: 30 } }, "Aurora");
    expect(r30.count).toBe(30);
    expect(r30.currentMilestone?.id).toBe("legend");
    expect(r30.currentMilestone?.title).toBe("30-Day Legend");
    expect(r30.currentMilestone?.badge).toBe("🏆");
    expect(r30.nextMilestone.id).toBe("legend");
    expect(r30.progressPct).toBe(100);

    // localStreaks takes precedence if higher than server weekData
    const rLocal = resolveMemberStreak({ streak: { Aurora: 2 } }, "Aurora", { Aurora: 5 });
    expect(rLocal.count).toBe(5);
    expect(rLocal.currentMilestone?.id).toBe("spark");
    expect(rLocal.nextMilestone.id).toBe("flame");
  });

  it("handles empty or missing weekData smoothly", () => {
    const rEmpty = resolveMemberStreak(undefined, "Aurora");
    expect(rEmpty.count).toBe(0);
    expect(rEmpty.currentMilestone).toBeNull();
    expect(rEmpty.nextMilestone.days).toBe(3);
    expect(rEmpty.progressPct).toBe(0);
  });

  it("records local streak completion and updates local streaks storage", async () => {
    expect(await loadLocalStreaks()).toEqual({});

    // Day 1 completion
    const count1 = await recordLocalStreakCompletion("Aurora", "2026-10-10");
    expect(count1).toBe(1);

    // Same day completion maintains count
    const count1Again = await recordLocalStreakCompletion("Aurora", "2026-10-10");
    expect(count1Again).toBe(1);

    // Next day completion increments count
    const count2 = await recordLocalStreakCompletion("Aurora", "2026-10-11");
    expect(count2).toBe(2);

    const stored = await loadLocalStreaks();
    expect(stored.Aurora).toBe(2);

    // Skipped day resets to 1
    const countReset = await recordLocalStreakCompletion("Aurora", "2026-10-15");
    expect(countReset).toBe(1);
  });
});

describe("streaks.ts — sticky notes storage and helpers", () => {
  it("adds, pins, and deletes sticky notes", async () => {
    expect(await loadStickyNotes()).toEqual([]);

    const note1 = await addStickyNote({
      text: "Great job today!",
      author: "Mom",
      emoji: "🐱",
      tone: "amber",
      pinned: false,
    });

    expect(note1.id).toBeTruthy();
    expect(note1.text).toBe("Great job today!");
    expect(note1.pinned).toBe(false);

    let notes = await loadStickyNotes();
    expect(notes.length).toBe(1);
    expect(notes[0].text).toBe("Great job today!");

    // Toggle pin
    notes = await togglePinStickyNote(note1.id);
    expect(notes[0].pinned).toBe(true);

    // Delete note
    notes = await deleteStickyNote(note1.id);
    expect(notes.length).toBe(0);
  });
});

describe("TasksPage — Chore Streak & Habit Milestone Card", () => {
  it("displays tasks-streak-card and 7-Day Flame badge when weekData.streak = { Aurora: 7 }", async () => {
    mockMember = kid;
    mockSnapshot = {
      tasks: TASKS_FIXTURE,
      weekData: {
        weekStart: "2026-10-05",
        points: { Aurora: 25 },
        streak: { Aurora: 7 },
        lastActive: {},
      },
    };

    const { getByTestId, findByText, getByText } = render(<TasksPage />, { wrapper: wrap });

    expect(getByTestId("tasks-streak-card")).toBeTruthy();
    expect(getByTestId("tasks-streak-count")).toBeTruthy();
    expect(getByText(/7-day streak/)).toBeTruthy();

    const badge = getByTestId("tasks-streak-badge");
    expect(badge).toBeTruthy();
    expect(getByText(/7-Day Flame · Full Week Hero/)).toBeTruthy();

    expect(await findByText(/Next badge: 14-Day Champion \(7\/14 days\)/)).toBeTruthy();
  });

  it("displays zero streak state when no streak is present", async () => {
    mockMember = kid;
    mockSnapshot = {
      tasks: TASKS_FIXTURE,
      weekData: {
        weekStart: "2026-10-05",
        points: { Aurora: 25 },
        streak: { Aurora: 0 },
        lastActive: {},
      },
    };

    const { getByTestId, queryByTestId, findByText } = render(<TasksPage />, { wrapper: wrap });

    expect(getByTestId("tasks-streak-card")).toBeTruthy();
    expect(getByTestId("tasks-streak-count")).toBeTruthy();
    expect(await findByText(/Start your daily streak today!/)).toBeTruthy();
    // Milestone badge pill only appears when count >= 3
    expect(queryByTestId("tasks-streak-badge")).toBeNull();
    expect(await findByText(/Next badge: 3-Day Spark \(0\/3 days\)/)).toBeTruthy();
  });

  it("displays unlocked legend caption when streak reaches 30+ days", async () => {
    mockMember = kid;
    mockSnapshot = {
      tasks: TASKS_FIXTURE,
      weekData: {
        weekStart: "2026-10-05",
        points: { Aurora: 25 },
        streak: { Aurora: 30 },
        lastActive: {},
      },
    };

    const { getByTestId, findByText } = render(<TasksPage />, { wrapper: wrap });

    expect(getByTestId("tasks-streak-card")).toBeTruthy();
    expect(await findByText("All habit badges unlocked! 🏆")).toBeTruthy();
  });
});

describe("TasksPage — Family Sticky Notes Board", () => {
  it("displays family-notes-card, allows a signed-in member to open family-notes-modal, type a sticky note, post it, pin it, and delete it", async () => {
    mockMember = kid;
    mockSnapshot = {
      tasks: TASKS_FIXTURE,
      weekData: {
        weekStart: "2026-10-05",
        points: { Aurora: 25 },
        streak: { Aurora: 3 },
        lastActive: {},
      },
    };

    const { findByTestId, getByTestId, getByText, queryByTestId } = render(<TasksPage />, {
      wrapper: wrap,
    });

    // 1. Board renders
    const notesCard = await findByTestId("family-notes-card");
    expect(notesCard).toBeTruthy();
    expect(getByText("📌 Family Sticky Notes")).toBeTruthy();
    expect(getByText("No sticky notes yet")).toBeTruthy();

    // 2. Open Add Note Modal
    const addBtn = getByTestId("family-notes-add-btn");
    expect(addBtn).toBeTruthy();

    await act(async () => {
      fireEvent.press(addBtn);
    });

    const modal = await findByTestId("family-notes-modal");
    expect(modal).toBeTruthy();

    // 3. Type text into input
    const input = getByTestId("family-notes-input");
    await act(async () => {
      fireEvent.changeText(input, "Don't forget soccer practice at 5pm!");
    });

    // 4. Select a tone
    const mintToneBtn = getByTestId("family-notes-tone-mint");
    await act(async () => {
      fireEvent.press(mintToneBtn);
    });

    // 5. Post note
    const saveBtn = getByTestId("family-notes-save");
    await act(async () => {
      fireEvent.press(saveBtn);
    });

    // Modal closes and note appears in the board
    await waitFor(() => {
      expect(getByText("Don't forget soccer practice at 5pm!")).toBeTruthy();
    });

    // 6. Check created note cards
    const notes = await loadStickyNotes();
    expect(notes.length).toBe(1);
    const createdNoteId = notes[0].id;
    const noteCard = getByTestId(`sticky-note-${createdNoteId}`);
    expect(noteCard).toBeTruthy();

    // 7. Pin note
    const pinBtn = getByTestId(`sticky-note-pin-${createdNoteId}`);
    await act(async () => {
      fireEvent.press(pinBtn);
    });

    await waitFor(async () => {
      const updatedNotes = await loadStickyNotes();
      expect(updatedNotes[0].pinned).toBe(true);
    });

    // 8. Delete note
    const deleteBtn = getByTestId(`sticky-note-delete-${createdNoteId}`);
    await act(async () => {
      fireEvent.press(deleteBtn);
    });

    await waitFor(async () => {
      const remainingNotes = await loadStickyNotes();
      expect(remainingNotes.length).toBe(0);
      expect(queryByTestId(`sticky-note-${createdNoteId}`)).toBeNull();
    });
  });

  it("allows selecting a quick preset note in the modal", async () => {
    mockMember = kid;
    const { findByTestId, getByTestId, getByText } = render(<TasksPage />, { wrapper: wrap });

    await act(async () => {
      fireEvent.press(await findByTestId("family-notes-add-btn"));
    });

    // Press quick preset
    const presetBtn = getByTestId("family-notes-preset-0");
    await act(async () => {
      fireEvent.press(presetBtn);
    });

    // Verify input populated with preset text
    const input = getByTestId("family-notes-input");
    expect(input.props.value).toBe("Good luck on your test! 🌟");

    // Save
    await act(async () => {
      fireEvent.press(getByTestId("family-notes-save"));
    });

    await waitFor(() => {
      expect(getByText("Good luck on your test! 🌟")).toBeTruthy();
    });
  });

  it("renders photo avatar via Image when note emoji is a data URI", async () => {
    mockMember = kid;
    const photoUri =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    await addStickyNote({
      id: "note-photo-1",
      text: "Dentist at 3pm",
      author: "Dad",
      emoji: photoUri,
      tone: "cyan",
      pinned: false,
    });

    const { findByTestId, getByText } = render(<TasksPage />, { wrapper: wrap });

    const avatarImg = await findByTestId("sticky-note-avatar-img-note-photo-1");
    expect(avatarImg).toBeTruthy();
    expect(avatarImg.props.source.uri).toBe(photoUri);
    expect(getByText("Dentist at 3pm")).toBeTruthy();
    expect(getByText("Dad")).toBeTruthy();
  });

  it("gates note modification so non-author kid cannot delete another member's note while parent can", async () => {
    await addStickyNote({
      id: "note-dad-1",
      text: "Family meeting tonight",
      author: "Dad",
      emoji: "👨",
      tone: "lavender",
      pinned: false,
    });

    // 1. As child 'Aurora', non-author cannot pin or delete Dad's note
    mockMember = kid;
    const { findByTestId, queryByTestId, unmount } = render(<TasksPage />, { wrapper: wrap });

    expect(await findByTestId("sticky-note-note-dad-1")).toBeTruthy();
    expect(queryByTestId("sticky-note-pin-note-dad-1")).toBeNull();
    expect(queryByTestId("sticky-note-delete-note-dad-1")).toBeNull();
    unmount();

    // 2. As parent, can pin and delete Dad's note
    mockMember = { id: "p1", name: "Rebecca (Mom)", role: "parent", emoji: "🐱", color: "green" };
    const { findByTestId: findParentTestId, getByTestId: getParentTestId } = render(<TasksPage />, {
      wrapper: wrap,
    });

    expect(await findParentTestId("sticky-note-note-dad-1")).toBeTruthy();
    expect(getParentTestId("sticky-note-pin-note-dad-1")).toBeTruthy();
    expect(getParentTestId("sticky-note-delete-note-dad-1")).toBeTruthy();
  });

  it("renders family sticky notes in read-only mode for signed-out wall", async () => {
    await addStickyNote({
      id: "note-public-1",
      text: "Welcome home family!",
      author: "Mom",
      emoji: "🐱",
      tone: "coral",
      pinned: true,
    });

    mockMember = null;
    const { findByTestId, getByText, queryByTestId } = render(<TasksPage />, { wrapper: wrap });

    expect(await findByTestId("family-notes-card")).toBeTruthy();
    expect(await findByTestId("sticky-note-note-public-1")).toBeTruthy();
    expect(getByText("Welcome home family!")).toBeTruthy();
    expect(queryByTestId("family-notes-add-btn")).toBeNull();
    expect(queryByTestId("sticky-note-pin-note-public-1")).toBeNull();
    expect(queryByTestId("sticky-note-delete-note-public-1")).toBeNull();
  });
});
