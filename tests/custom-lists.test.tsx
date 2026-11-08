/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

import { ThemeProvider } from "../src/theme/ThemeProvider";
import { ToastProvider } from "../src/ui/Toast";
import { TasksPage } from "../src/tasks/TasksPage";
import {
  _resetCustomListsForTest,
  addChecklistItem,
  createCustomChecklist,
  deleteChecklistItem,
  deleteCustomChecklist,
  loadCustomLists,
  resetChecklistChecks,
  STARTER_CHECKLISTS,
  toggleChecklistItem,
} from "../src/tasks/custom-lists";

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
const parent = { id: "p1", name: "David", role: "parent", emoji: "👨", color: "nori" };
let mockMember: any = kid;
let mockRole: any = "child";

jest.mock("../src/state/AuthProvider", () => ({
  useAuth: () => ({
    member: mockMember,
    role: mockRole,
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
  await _resetCustomListsForTest();
  mockMember = kid;
  mockRole = "child";
  mockSnapshot = {
    tasks: TASKS_FIXTURE,
    weekData: {
      weekStart: "2026-10-05",
      points: { Aurora: 25 },
      streak: { Aurora: 3 },
      lastActive: {},
    },
  };
});

describe("custom-lists.ts — Unit tests", () => {
  it("loadCustomLists seeds storage with STARTER_CHECKLISTS on first load", async () => {
    expect(STARTER_CHECKLISTS.length).toBe(3);
    const lists = await loadCustomLists();
    expect(lists.length).toBe(3);
    expect(lists[0].id).toBe("list-backpack");
    expect(lists[0].title).toBe("School Backpack");
    expect(lists[0].emoji).toBe("🎒");
    expect(lists[0].tone).toBe("cyan");
    expect(lists[0].items.length).toBe(4);
    expect(lists[0].items.map((i) => i.label)).toEqual([
      "Homework folder",
      "Water bottle",
      "Lunchbox",
      "Charged tablet",
    ]);

    expect(lists[1].id).toBe("list-sports");
    expect(lists[1].title).toBe("Sports & Practice Bag");

    expect(lists[2].id).toBe("list-camping");
    expect(lists[2].title).toBe("Weekend Trip Packing");
  });

  it("toggleChecklistItem toggles checked state of an item", async () => {
    await loadCustomLists();
    const updated1 = await toggleChecklistItem("list-backpack", "bp-1");
    const backpack1 = updated1.find((l) => l.id === "list-backpack")!;
    expect(backpack1.items.find((i) => i.id === "bp-1")?.checked).toBe(true);

    const updated2 = await toggleChecklistItem("list-backpack", "bp-1");
    const backpack2 = updated2.find((l) => l.id === "list-backpack")!;
    expect(backpack2.items.find((i) => i.id === "bp-1")?.checked).toBe(false);
  });

  it("resetChecklistChecks unchecks all items in a list", async () => {
    await loadCustomLists();
    await toggleChecklistItem("list-backpack", "bp-1");
    await toggleChecklistItem("list-backpack", "bp-2");

    const res = await resetChecklistChecks("list-backpack");
    const backpack = res.find((l) => l.id === "list-backpack")!;
    expect(backpack.items.every((i) => !i.checked)).toBe(true);
  });

  it("addChecklistItem adds a new item to the checklist", async () => {
    await loadCustomLists();
    const updated = await addChecklistItem("list-backpack", "Pencil pouch");
    const backpack = updated.find((l) => l.id === "list-backpack")!;
    expect(backpack.items.length).toBe(5);
    expect(backpack.items.some((i) => i.label === "Pencil pouch")).toBe(true);
  });

  it("deleteChecklistItem removes an item from the checklist", async () => {
    await loadCustomLists();
    const updated = await deleteChecklistItem("list-backpack", "bp-4");
    const backpack = updated.find((l) => l.id === "list-backpack")!;
    expect(backpack.items.length).toBe(3);
    expect(backpack.items.some((i) => i.id === "bp-4")).toBe(false);
  });

  it("createCustomChecklist creates a new list and persists it", async () => {
    await loadCustomLists();
    const created = await createCustomChecklist({
      title: "Beach Trip",
      emoji: "🏖️",
      tone: "coral",
      items: ["Sunscreen", "Beach towel"],
    });

    expect(created.title).toBe("Beach Trip");
    expect(created.emoji).toBe("🏖️");
    expect(created.tone).toBe("coral");
    expect(created.items.length).toBe(2);

    const all = await loadCustomLists();
    expect(all.length).toBe(4);
    expect(all.some((l) => l.id === created.id)).toBe(true);
  });

  it("deleteCustomChecklist removes a checklist", async () => {
    await loadCustomLists();
    const updated = await deleteCustomChecklist("list-camping");
    expect(updated.length).toBe(2);
    expect(updated.some((l) => l.id === "list-camping")).toBe(false);

    const all = await loadCustomLists();
    expect(all.length).toBe(2);
  });
});

describe("TasksPage — CustomListsCard Component Tests", () => {
  it("renders starter lists including School Backpack", async () => {
    const { findByTestId, getByText } = render(<TasksPage />, { wrapper: wrap });

    const card = await findByTestId("custom-lists-card");
    expect(card).toBeTruthy();
    expect(getByText("📋 Reusable Family Checklists")).toBeTruthy();
    expect(getByText("School Backpack")).toBeTruthy();
    expect(getByText("Sports & Practice Bag")).toBeTruthy();
    expect(getByText("Weekend Trip Packing")).toBeTruthy();

    const progress = await findByTestId("custom-list-progress");
    expect(progress).toBeTruthy();
    expect(getByText("0 of 4 packed")).toBeTruthy();
  });

  it("toggling an item updates progress (1 of 4 packed)", async () => {
    const { findByTestId, getByTestId, getByText } = render(<TasksPage />, { wrapper: wrap });

    await findByTestId("custom-lists-card");
    const itemPressable = getByTestId("custom-list-item-bp-1");
    expect(itemPressable).toBeTruthy();

    await act(async () => {
      fireEvent.press(itemPressable);
    });

    await waitFor(() => {
      expect(getByText("1 of 4 packed")).toBeTruthy();
    });
  });

  it("pressing custom-list-reset resets all checks to 0 of 4 packed", async () => {
    const { findByTestId, getByTestId, getByText } = render(<TasksPage />, { wrapper: wrap });

    await findByTestId("custom-lists-card");
    const itemPressable = getByTestId("custom-list-item-bp-1");

    await act(async () => {
      fireEvent.press(itemPressable);
    });

    await waitFor(() => {
      expect(getByText("1 of 4 packed")).toBeTruthy();
    });

    const resetBtn = getByTestId("custom-list-reset");
    await act(async () => {
      fireEvent.press(resetBtn);
    });

    await waitFor(() => {
      expect(getByText("0 of 4 packed")).toBeTruthy();
    });
  });

  it("adding a new item works and updates the list", async () => {
    const { findByTestId, getByTestId, getByText } = render(<TasksPage />, { wrapper: wrap });

    await findByTestId("custom-lists-card");
    const input = getByTestId("custom-list-item-input");
    const addBtn = getByTestId("custom-list-item-add");

    await act(async () => {
      fireEvent.changeText(input, "Colored pencils");
    });

    await act(async () => {
      fireEvent.press(addBtn);
    });

    await waitFor(() => {
      expect(getByText("Colored pencils")).toBeTruthy();
      expect(getByText("0 of 5 packed")).toBeTruthy();
    });
  });

  it("allows parent to create a new custom list via custom-list-create-modal", async () => {
    mockMember = parent;
    mockRole = "parent";

    const { findByTestId, getByTestId, getByText } = render(<TasksPage />, { wrapper: wrap });

    await findByTestId("custom-lists-card");
    const newOpenBtn = getByTestId("custom-list-new-open");
    expect(newOpenBtn).toBeTruthy();

    await act(async () => {
      fireEvent.press(newOpenBtn);
    });

    const modal = await findByTestId("custom-list-create-modal");
    expect(modal).toBeTruthy();

    const titleInput = getByTestId("custom-list-title-input");
    await act(async () => {
      fireEvent.changeText(titleInput, "Beach Gear");
    });

    const emojiBtn = getByTestId("custom-list-emoji-🏖️");
    await act(async () => {
      fireEvent.press(emojiBtn);
    });

    const toneBtn = getByTestId("custom-list-tone-coral");
    await act(async () => {
      fireEvent.press(toneBtn);
    });

    const saveBtn = getByTestId("custom-list-create-save");
    await act(async () => {
      fireEvent.press(saveBtn);
    });

    await waitFor(() => {
      expect(getByText("Beach Gear")).toBeTruthy();
    });
  });

  it("allows parent to delete an item from the checklist", async () => {
    mockMember = parent;
    mockRole = "parent";

    const { findByTestId, getByTestId, getByText, queryByTestId } = render(<TasksPage />, { wrapper: wrap });

    await findByTestId("custom-lists-card");
    const removeBtn = getByTestId("custom-list-item-remove-bp-4");
    expect(removeBtn).toBeTruthy();

    await act(async () => {
      fireEvent.press(removeBtn);
    });

    await waitFor(() => {
      expect(queryByTestId("custom-list-item-remove-bp-4")).toBeNull();
      expect(getByText("0 of 3 packed")).toBeTruthy();
    });
  });
});
