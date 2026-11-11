import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DEFAULT_ACCOUNTABILITY_STATE,
  DEFAULT_ROUTINES,
  DEFAULT_ROUTINE_SETTINGS,
  loadRoutineProgress,
  loadRoutines,
  loadRoutinesBundle,
  postRoutineAction,
  postRoutineProgressAction,
  saveRoutineProgress,
  saveRoutines,
  type DailyRoutineProgress,
  type FamilyRoutine,
} from "../src/tasks/routines-api";
import {
  isRoutineScheduledForDate,
  resolveRoutineTargets,
  sanitizeRoutine,
  weekdayCodeForDateISO,
} from "../src/tasks/routine-rules";
import { api, ApiError } from "../src/api/client";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

jest.mock("../src/api/client", () => ({
  api: jest.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    code: string;
    constructor(opts: { message: string; status?: number; code?: string }) {
      super(opts.message);
      this.status = opts.status ?? 500;
      this.code = opts.code ?? "api_error";
    }
  },
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

  it("loadRoutinesBundle hydrates from server and falls back to offline cache on error", async () => {
    const sundayTrash: FamilyRoutine = {
      id: "rt-trash",
      title: "Take out trash",
      slot: "evening",
      emoji: "🗑️",
      time: "19:00",
      assignee: "Dad",
      assignees: ["Dad"],
      daysOfWeek: ["sun"],
      points: 15,
      missedPenalty: 10,
      requiresApproval: false,
      steps: [{ id: "st-1", title: "Bins to curb", emoji: "🗑️" }],
    };
    const accountability = {
      ...DEFAULT_ACCOUNTABILITY_STATE,
      lastEvaluatedDate: "2026-11-10",
      streaks: { dad: { current: 3, longest: 4, lastCompletedDate: "2026-11-10" } },
      missedEntries: [
        {
          id: "miss-1",
          date: "2026-11-10",
          routineId: "rt-trash",
          routineTitle: "Take out trash",
          routineEmoji: "🗑️",
          memberKey: "dad",
          memberName: "Dad",
          deductedPoints: 10,
          excused: false,
        },
      ],
    };

    mockApi
      .mockResolvedValueOnce({
        ok: true,
        routines: [sundayTrash],
        settings: { ...DEFAULT_ROUTINE_SETTINGS, defaultMissedPenalty: 10 },
        accountability,
      })
      .mockResolvedValueOnce({
        ok: true,
        date: "2026-11-11",
        progress: {
          checkedSteps: {},
          completedRoutines: {},
          memberCheckedSteps: {},
          memberCompleted: {},
        },
        accountability,
      });

    const live = await loadRoutinesBundle("2026-11-11");
    expect(live.offline).toBe(false);
    expect(live.routines).toEqual([sundayTrash]);
    expect(live.settings.defaultMissedPenalty).toBe(10);
    expect(live.accountability.missedEntries).toHaveLength(1);

    mockApi.mockRejectedValue(new Error("Offline"));
    const cached = await loadRoutinesBundle("2026-11-11");
    expect(cached.offline).toBe(true);
    expect(cached.routines[0].id).toBe("rt-trash");
    expect(cached.settings.defaultMissedPenalty).toBe(10);
    expect(cached.accountability.missedEntries[0].id).toBe("miss-1");
  });

  it("postRoutineAction sends x-admin-pin for upsert_routine and update_settings", async () => {
    mockApi.mockResolvedValueOnce({
      ok: true,
      routines: DEFAULT_ROUTINES,
      settings: { ...DEFAULT_ROUTINE_SETTINGS, parentCountsTowardRace: false },
      accountability: DEFAULT_ACCOUNTABILITY_STATE,
    });

    const res = await postRoutineAction({
      action: "update_settings",
      settings: { ...DEFAULT_ROUTINE_SETTINGS, parentCountsTowardRace: false },
      pin: "1234",
    });
    expect(res.settings.parentCountsTowardRace).toBe(false);
    expect(mockApi).toHaveBeenCalledWith(
      "/api/routines",
      expect.objectContaining({
        method: "POST",
        headers: { "x-admin-pin": "1234" },
        body: {
          action: "update_settings",
          settings: { ...DEFAULT_ROUTINE_SETTINGS, parentCountsTowardRace: false },
        },
      }),
    );
  });

  it("postRoutineProgressAction handles step toggles, parent excuses, and propagates ApiError", async () => {
    mockApi.mockResolvedValueOnce({
      ok: true,
      date: "2026-11-11",
      pointsDelta: 0,
      progress: {
        checkedSteps: { "rt-1": ["s1"] },
        completedRoutines: {},
        memberCheckedSteps: { "rt-1::aurora": ["s1"] },
        memberCompleted: {},
      },
      accountability: DEFAULT_ACCOUNTABILITY_STATE,
    });

    const toggled = await postRoutineProgressAction({
      action: "toggle_step",
      date: "2026-11-11",
      routineId: "rt-1",
      stepId: "s1",
      memberName: "Aurora",
    });
    expect(toggled.progress.memberCheckedSteps?.["rt-1::aurora"]).toEqual(["s1"]);

    mockApi.mockResolvedValueOnce({
      ok: true,
      date: "2026-11-11",
      pointsDelta: 10,
      progress: {
        checkedSteps: {},
        completedRoutines: {},
        memberCheckedSteps: {},
        memberCompleted: {},
      },
      accountability: {
        ...DEFAULT_ACCOUNTABILITY_STATE,
        missedEntries: [
          {
            id: "miss-1",
            date: "2026-11-10",
            routineId: "rt-trash",
            routineTitle: "Take out trash",
            routineEmoji: "🗑️",
            memberKey: "dad",
            memberName: "Dad",
            penaltyPoints: 10,
            streakBefore: 2,
            excused: true,
            excusedBy: "Rebecca",
          },
        ],
      },
    });

    const excused = await postRoutineProgressAction({
      action: "excuse_missed",
      entryId: "miss-1",
      pin: "1234",
    });
    expect(excused.pointsDelta).toBe(10);
    expect(excused.accountability.missedEntries[0].excused).toBe(true);
    expect(mockApi).toHaveBeenLastCalledWith(
      "/api/routines/progress",
      expect.objectContaining({
        method: "POST",
        headers: { "x-admin-pin": "1234" },
        body: { action: "excuse_missed", entryId: "miss-1" },
      }),
    );

    mockApi.mockRejectedValueOnce(new ApiError({ message: "Parent PIN invalid", status: 403, code: "bad_pin" }));
    await expect(
      postRoutineProgressAction({
        action: "approve_routine",
        date: "2026-11-11",
        routineId: "rt-1",
        memberName: "Aurora",
        pin: "0000",
      }),
    ).rejects.toThrow("Parent PIN invalid");
  });

  it("routine-rules schedules Sunday-only routines and resolves individual vs group targets", () => {
    expect(weekdayCodeForDateISO("2026-11-08")).toBe("sun");
    expect(weekdayCodeForDateISO("2026-11-09")).toBe("mon");

    const trash = sanitizeRoutine({
      id: "rt-trash",
      title: "Take out trash",
      slot: "evening",
      emoji: "🗑️",
      assignee: "Dad",
      daysOfWeek: ["sun"],
      points: 15,
      missedPenalty: 10,
      steps: [{ id: "s1", title: "Bins to curb", emoji: "🗑️" }],
    });
    expect(trash).not.toBeNull();
    if (!trash) throw new Error("Expected sanitized trash routine");
    expect(isRoutineScheduledForDate(trash, "2026-11-08")).toBe(true);
    expect(isRoutineScheduledForDate(trash, "2026-11-09")).toBe(false);

    const roster = [
      { id: "p1", name: "Rebecca", fullName: "Rebecca Garcia", role: "parent" as const },
      { id: "p2", name: "Dad", fullName: "Chris Garcia", role: "parent" as const },
      { id: "k1", name: "Aurora", fullName: "Aurora Garcia", role: "child" as const },
    ];
    expect(resolveRoutineTargets(trash, roster).map((m) => m.name)).toEqual(["Chris Garcia"]);

    const adultRoutine = sanitizeRoutine({
      id: "rt-adults",
      title: "Kitchen Reset",
      slot: "evening",
      emoji: "🍽️",
      assignee: "Adults",
      steps: [{ id: "s1", title: "Run dishwasher", emoji: "🍽️" }],
    });
    expect(adultRoutine).not.toBeNull();
    if (!adultRoutine) throw new Error("Expected sanitized adult routine");
    expect(resolveRoutineTargets(adultRoutine, roster).map((m) => m.name)).toEqual([
      "Rebecca Garcia",
      "Chris Garcia",
    ]);
  });
});
