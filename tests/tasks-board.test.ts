/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import {
  completedByWeek,
  completedHistory,
  completedWaiting,
  crewFull,
  filterOptions,
  isOpenable,
  isSnatchable,
  memberScoped,
  openBoard,
  pendingBoard,
  priorityColor,
  taskStats,
  weekGroupLabel,
} from "../src/tasks/board";
import { normalizeSnapshotTasks, type WallTask } from "../src/tasks/claim";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

/** A wall task with every display field the board reads. */
function task(over: Partial<WallTask>): WallTask {
  return {
    id: 1,
    title: "Chore",
    assignee: "Aurora",
    assigneeEmoji: "🧚",
    points: 5,
    completed: false,
    pendingApproval: null,
    due: "",
    category: "Chores",
    priority: "medium",
    universal: false,
    stealable: false,
    crewSize: null,
    crewMembers: [],
    speedBonus: 0,
    completedInWeek: "",
    completedBy: "",
    ...over,
  };
}

// Frozen "today" for deterministic due/snatchable math.
const TODAY = "2026-10-12";

describe("wall task normalization", () => {
  it("carries the board fields through, dropping unparseable rows", () => {
    const rows = normalizeSnapshotTasks([
      {
        id: 7,
        title: "Clean the steps",
        assignee: "Aurora",
        assigneeEmoji: "🧚",
        points: 7,
        due: "2026-10-02",
        category: "Chores",
        priority: "high",
        universal: true,
        stealable: true,
        speedBonus: 2,
        crewSize: 3,
        crew: { members: [{ name: "Aurora", emoji: "🧚", joinedAt: "x" }, { name: "Bailey", emoji: "🙂", joinedAt: "y", checkedInAt: "z" }] },
        completed: false,
      },
      { id: 0, title: "no id" },
      "junk",
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 7,
      due: "2026-10-02",
      priority: "high",
      universal: true,
      stealable: true,
      speedBonus: 2,
      crewSize: 3,
      completed: false,
    });
    expect(rows[0].crewMembers).toEqual([
      { name: "Aurora", emoji: "🧚", checkedIn: false },
      { name: "Bailey", emoji: "🙂", checkedIn: true },
    ]);
  });

  it("collapses a photo data-URL emoji to the silhouette (never a Text glyph)", () => {
    const [row] = normalizeSnapshotTasks([
      { id: 1, title: "T", assigneeEmoji: "data:image/png;base64,AAAA", points: 1 },
    ]);
    expect(row.assigneeEmoji).toBe("👤");
  });
});

describe("snatchable + openable (web isSnatchable/openBoard parity)", () => {
  it("snatchable = stealable && !completed && due < today", () => {
    expect(isSnatchable(task({ stealable: true, due: "2026-10-01" }), TODAY)).toBe(true);
    expect(isSnatchable(task({ stealable: true, due: "2026-10-13" }), TODAY)).toBe(false);
    expect(isSnatchable(task({ stealable: true, completed: true, due: "2026-10-01" }), TODAY)).toBe(false);
    expect(isSnatchable(task({ stealable: false, due: "2026-10-01" }), TODAY)).toBe(false);
  });

  it("a universal row is open to anyone", () => {
    expect(isOpenable(task({ universal: true }), "Aurora")).toBe(true);
    expect(isOpenable(task({ universal: true, assignee: "Aurora" }), "Aurora")).toBe(true);
  });

  it("a crew task with room is open; full crews and my crews are not", () => {
    const crew = { crewSize: 3, crewMembers: [{ name: "Aurora", emoji: "🧚", checkedIn: false }] };
    expect(isOpenable(task(crew), "Bailey")).toBe(true);
    expect(crewFull({ crewSize: 3, crewMembers: [crew.crewMembers[0], { name: "x", emoji: "🙂", checkedIn: false }, { name: "y", emoji: "🙂", checkedIn: false }] })).toBe(true);
    expect(isOpenable(task({ ...crew, crewSize: 1 }), "Bailey")).toBe(false);
    expect(isOpenable(task(crew), "Aurora")).toBe(false); // already joined
  });

  it("openBoard sorts points descending (richest first)", () => {
    const board = openBoard(
      [task({ id: 1, universal: true, points: 3 }), task({ id: 2, universal: true, points: 9 }), task({ id: 3, universal: true, points: 6 })],
      "Aurora",
      "All"
    );
    expect(board.map((t) => t.points)).toEqual([9, 6, 3]);
  });

  it("a member filter collapses the Open board (web openBoard parity)", () => {
    const rows = [task({ id: 1, universal: true }), task({ id: 2, universal: true })];
    expect(openBoard(rows, "Aurora", "All")).toHaveLength(2);
    expect(openBoard(rows, "Aurora", "My Tasks")).toHaveLength(2);
    expect(openBoard(rows, "Aurora", "Open")).toHaveLength(2);
    expect(openBoard(rows, "Aurora", "Bailey")).toHaveLength(0);
  });
});

describe("member scoping (web memberScoped parity)", () => {
  const tasks = [
    task({ id: 1, assignee: "Aurora", universal: false }),
    task({ id: 2, assignee: "Emily", universal: true }),
    task({ id: 3, assignee: "Aurora", universal: false }),
  ];

  it("All shows everything", () => {
    expect(memberScoped(tasks, "All", "", { myTasksLabel: "All" })).toHaveLength(3);
  });

  it("My Tasks shows mine plus claimable", () => {
    const mine = memberScoped(tasks, "My Tasks", "Aurora", { myTasksLabel: "My Tasks" });
    expect(mine.map((t) => t.id)).toEqual([1, 2, 3]);
  });

  it("Open shows only claimable rows", () => {
    const open = memberScoped(tasks, "Open", "Aurora", { myTasksLabel: "My Tasks" });
    expect(open.map((t) => t.id)).toEqual([2]);
  });

  it("a member filter shows exactly that member's rows", () => {
    expect(memberScoped(tasks, "Emily", "Aurora", { myTasksLabel: "My Tasks" }).map((t) => t.id)).toEqual([2]);
  });

  it("pendingBoard drops completed rows", () => {
    expect(pendingBoard([task({ id: 1, completed: true }), task({ id: 2 })])).toHaveLength(1);
  });
});

describe("completed groups", () => {
  it("pins waiting-on-approval first, newest tap first, then history newest week first", () => {
    const waiting = completedWaiting([
      task({ id: 1, completed: true, pendingApproval: { byName: "Aurora", points: 5, at: "2026-10-10T10:00:00Z" } }),
      task({ id: 2, completed: true, pendingApproval: { byName: "Bailey", points: 5, at: "2026-10-10T12:00:00Z" } }),
      task({ id: 3, completed: true, completedInWeek: "2026-10-05" }),
    ]);
    // the LATER tap leads the queue (a parent scans what landed since last look)
    expect(waiting.map((t) => t.id)).toEqual([2, 1]);
    const history = completedHistory([
      task({ id: 2, completed: true, completedInWeek: "2026-10-05" }),
      task({ id: 3, completed: true, completedInWeek: "2026-09-28" }),
    ]);
    expect(history.map((t) => t.id)).toEqual([2, 3]);
  });

  it("groups history by week - one header per week, never a borrowed label", () => {
    const groups = completedByWeek([
      task({ id: 1, completed: true, completedInWeek: "2026-10-05" }),
      task({ id: 2, completed: true, completedInWeek: "2026-09-28" }),
      task({ id: 3, completed: true, completedInWeek: "2026-10-05" }),
    ]);
    expect(groups.map((g) => g.weekKey)).toEqual(["2026-10-05", "2026-09-28"]);
    expect(groups[0].rows.map((t) => t.id)).toEqual([1, 3]);
  });
});

describe("stats (server facts only)", () => {
  it("counts pending, this-week completions and the week ledger sum", () => {
    const stats = taskStats(
      [
        task({ id: 1 }),
        task({ id: 2, completed: true, completedInWeek: "2026-10-05" }),
        // a prior-week completion must NOT inflate the tile labelled "This week"
        task({ id: 3, completed: true, completedInWeek: "2026-09-28" }),
        task({ id: 4, completed: true, completedInWeek: "" }),
      ],
      { Aurora: 12, Bailey: 7 },
      "2026-10-05"
    );
    expect(stats).toEqual({ pending: 1, completedThisWeek: 1, earnedThisWeek: 19 });
  });
});

describe("filter options", () => {
  it("All + roster + Open for guests, My Tasks when signed in", () => {
    const guests = filterOptions([], { signedIn: false, roster: [], me: "" });
    expect(guests.map((o) => o.id)).toEqual(["All", "Open"]);
    const kid = filterOptions([task({ assignee: "Aurora", assigneeEmoji: "🧚" })], {
      signedIn: true,
      roster: [{ name: "Bailey", emoji: "🙂" }],
      me: "Aurora",
    });
    expect(kid.map((o) => o.id)).toEqual(["My Tasks", "Aurora", "Bailey", "Open"]);
    expect(kid.find((o) => o.id === "Aurora")).toMatchObject({ label: "Aurora", emoji: "🧚" });
  });

  it("prefers the live roster avatar over a collapsed task glyph", () => {
    // The PB boundary collapses a photo member's assigneeEmoji to 👤; the
    // roster still holds the real avatar. The chip must read the roster first.
    const PHOTO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const opts = filterOptions([task({ assignee: "Aurora", assigneeEmoji: "👤" })], {
      signedIn: true,
      roster: [{ name: "Aurora", emoji: PHOTO }],
      me: "Rebecca (Mom)",
    });
    expect(opts.find((o) => o.id === "Aurora")?.emoji).toBe(PHOTO);
  });

  it("keeps the stored glyph for a non-roster assignee", () => {
    const opts = filterOptions([task({ assignee: "Grandma", assigneeEmoji: "👵" })], {
      signedIn: true,
      roster: [{ name: "Aurora", emoji: "🧚" }],
      me: "Rebecca (Mom)",
    });
    expect(opts.find((o) => o.id === "Grandma")?.emoji).toBe("👵");
  });

  it("the signed-in My Tasks tile carries the session member's own emoji", () => {
    const opts = filterOptions([], { signedIn: true, roster: [], me: "Aurora", meEmoji: "🧚" });
    expect(opts[0]).toMatchObject({ id: "My Tasks", emoji: "🧚" });
    // guests keep the group glyph
    expect(filterOptions([], { signedIn: false, roster: [], me: "" })[0].emoji).toBe("👥");
  });

  it("the earned tile follows the member filter (web scopedEarned)", () => {
    const rows = [task({ id: 1 }), task({ id: 2, assignee: "Bailey" })];
    const points = { Aurora: 12, Bailey: 7 };
    expect(taskStats(rows, points, "2026-10-05", "All").earnedThisWeek).toBe(19);
    expect(taskStats(rows, points, "2026-10-05", "Aurora").earnedThisWeek).toBe(12);
    // "My Tasks" resolves through the session member (the label is not a name)
    expect(taskStats(rows, points, "2026-10-05", "My Tasks", "Aurora").earnedThisWeek).toBe(12);
    expect(taskStats(rows, points, "2026-10-05", "My Tasks", "Bailey").earnedThisWeek).toBe(7);
    expect(taskStats(rows, points, "2026-10-05", "Open").earnedThisWeek).toBe(19);
  });
});

describe("presentation helpers", () => {
  it("priority rails map to the semantic tokens", () => {
    const colors = { "color-accent-rose": "#r", "color-accent-amber": "#a", "color-accent-mint": "#m" };
    expect(priorityColor("high", colors)).toBe("#r");
    expect(priorityColor("medium", colors)).toBe("#a");
    expect(priorityColor("low", colors)).toBe("#m");
  });

  it("a past week reads 'Week of Sep 28' — never a raw ISO key in a family card", () => {
    expect(weekGroupLabel("2026-10-05", "2026-10-05")).toBe("This week");
    expect(weekGroupLabel("2026-09-28", "2026-10-05")).toBe("Week of Sep 28");
    expect(weekGroupLabel("", "2026-10-05")).toBe("Earlier");
  });
});
