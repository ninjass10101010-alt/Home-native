import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DEFAULT_ROUTINES,
  loadRoutineProgress,
  loadRoutines,
  saveRoutineProgress,
  saveRoutines,
  type DailyRoutineProgress,
  type FamilyRoutine,
} from "../src/tasks/routines-api";
import { api } from "../src/api/client";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

jest.mock("../src/api/client", () => ({
  api: jest.fn(),
  ApiError: class ApiError extends Error {},
}));

const mockApi = api as jest.MockedFunction<typeof api>;

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

describe("routines-api two-way sync with Home-ai", () => {
  it("loadRoutines falls back to DEFAULT_ROUTINES when storage and server are empty", async () => {
    mockApi.mockRejectedValueOnce(new Error("Network down"));
    const routines = await loadRoutines();
    expect(routines).toEqual(DEFAULT_ROUTINES);
  });

  it("loadRoutines fetches from /api/routines and caches to AsyncStorage", async () => {
    const customRoutines: FamilyRoutine[] = [
      {
        id: "rt-custom",
        title: "Homework Power Hour",
        emoji: "📖",
        slot: "afternoon",
        time: "16:00",
        assignee: "All",
        points: 25,
        steps: [{ id: "s1", title: "Math practice", emoji: "✏️" }],
      },
    ];
    mockApi.mockResolvedValueOnce({ ok: true, routines: customRoutines });

    const routines = await loadRoutines();
    expect(mockApi).toHaveBeenCalledWith("/api/routines", expect.objectContaining({ timeoutMs: 4000 }));
    expect(routines).toEqual(customRoutines);

    // Verify written to AsyncStorage
    const cached = await AsyncStorage.getItem("@consuela/routines_v1");
    expect(cached).toBe(JSON.stringify(customRoutines));
  });

  it("saveRoutines writes locally and calls PUT /api/routines", async () => {
    mockApi.mockResolvedValueOnce({ ok: true, count: 1 });
    const newRoutines: FamilyRoutine[] = [
      {
        id: "rt-1",
        title: "Morning Routine",
        emoji: "☀️",
        slot: "morning",
        time: "07:00",
        assignee: "All",
        points: 10,
        steps: [{ id: "s1", title: "Wake up", emoji: "⏰" }],
      },
    ];

    await saveRoutines(newRoutines);

    const cached = await AsyncStorage.getItem("@consuela/routines_v1");
    expect(cached).toBe(JSON.stringify(newRoutines));

    expect(mockApi).toHaveBeenCalledWith("/api/routines", {
      method: "PUT",
      body: { routines: newRoutines },
      timeoutMs: 5000,
    });
  });

  it("loadRoutineProgress merges local progress with server progress", async () => {
    const date = "2026-11-05";
    // Local has step 1 checked
    await AsyncStorage.setItem(
      `@consuela/routine_progress_v1:${date}`,
      JSON.stringify({
        checkedSteps: { "rt-1": ["s1"] },
        completedRoutines: { "rt-1": false },
      }),
    );

    // Server has step 2 checked
    mockApi.mockResolvedValueOnce({
      ok: true,
      progress: {
        checkedSteps: { "rt-1": ["s2"] },
        completedRoutines: { "rt-1": false },
      },
    });

    const merged = await loadRoutineProgress(date);
    expect(merged.checkedSteps["rt-1"]).toEqual(expect.arrayContaining(["s1", "s2"]));
    expect(mockApi).toHaveBeenCalledWith(
      `/api/routines/progress?date=${date}`,
      expect.objectContaining({ timeoutMs: 4000 }),
    );
  });

  it("saveRoutineProgress writes to AsyncStorage and PUTs /api/routines/progress", async () => {
    const date = "2026-11-05";
    const prog: DailyRoutineProgress = {
      checkedSteps: { "rt-1": ["s1", "s2"] },
      completedRoutines: { "rt-1": true },
    };
    mockApi.mockResolvedValueOnce({ ok: true, date, progress: prog });

    await saveRoutineProgress(date, prog);

    const cached = await AsyncStorage.getItem(`@consuela/routine_progress_v1:${date}`);
    expect(cached).toBe(JSON.stringify(prog));

    expect(mockApi).toHaveBeenCalledWith("/api/routines/progress", {
      method: "PUT",
      body: { date, progress: prog },
      timeoutMs: 5000,
    });
  });
});
