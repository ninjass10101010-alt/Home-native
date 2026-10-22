/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ThemeProvider } from "../src/theme/ThemeProvider";
import { FamilySection } from "../src/settings/FamilySection";
import type { ServerMember } from "../src/api/types";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

jest.mock("../src/api/client", () => ({
  api: jest.fn(),
  ApiError: jest.requireActual("../src/api/client").ApiError,
}));
const { api } = jest.requireMock("../src/api/client") as { api: jest.Mock };
const { ApiError } = jest.requireActual("../src/api/client") as { ApiError: any };

// Modal exit animations + multi-await flows take seconds under concurrent
// dev load — the 5s default flakes. 20s keeps the suite honest, not slow.
jest.setTimeout(20000);

const wrap = ({ children }: { children: React.ReactNode }) => <ThemeProvider>{children}</ThemeProvider>;
const flush = () => act(async () => {});

const parent: ServerMember = {
  id: "p1", pbId: "p1", name: "Rebecca (Mom)", role: "parent", emoji: "🐱",
  color: "green", avatarSize: "md", glow: false, created: "2024-05-12 08:00:00.000Z",
};
const child: ServerMember = {
  id: "c1", pbId: "c1", name: "Aurora", role: "child", emoji: "🌸",
  color: "amber", age: 8, avatarSize: "sm", glow: true, created: "2018-03-02 08:00:00.000Z",
};
const ROSTER = [parent, child];
const ROSTER_LIVE = { members: ROSTER, source: "live" };

/** Path-prefix + method router for the mocked api() (GET default). */
const memberRoute = (opts: { get?: unknown; post?: unknown; patch?: unknown; delete?: unknown } = {}) =>
  api.mockImplementation((path: string, init?: any) => {
    if (path.startsWith("/api/members/admin")) {
      const method = init?.method ?? "GET";
      const v =
        method === "POST" ? opts.post
        : method === "PATCH" ? opts.patch
        : method === "DELETE" ? opts.delete
        : opts.get ?? ROSTER_LIVE;
      return v instanceof Error ? Promise.reject(v) : Promise.resolve(v);
    }
    return Promise.reject(new ApiError({ message: "unmapped path", status: 404, code: "not_found" }));
  });

const writeCalls = (method: string) =>
  api.mock.calls.filter((c: any[]) => c[0] === "/api/members/admin" && c[1]?.method === method);
const getCalls = () =>
  api.mock.calls.filter((c: any[]) => c[0].startsWith("/api/members/admin") && (!c[1] || !c[1].method));
const storedPayloads = () =>
  (AsyncStorage.setItem as jest.Mock).mock.calls.map((c: any[]) => c[1]).join("\n");

/**
 * The Modal unmounts on a real 150ms exit timer; the state commit only lands
 * when the event loop yields OUTSIDE act (waitFor's act-wrapped poll never
 * observes it). A real 400ms settle first makes the exit deterministic.
 */
const settleModalExit = () => new Promise((res) => setTimeout(res, 400));

beforeEach(async () => {
  jest.clearAllMocks();
  // The async-storage-mock keeps a real in-memory store across tests.
  await AsyncStorage.clear();
  api.mockReset();
});

describe("FamilySection — roster read", () => {
  it("renders the live roster with role · joined subtitles and mirrors the cache", async () => {
    memberRoute();
    const { getByTestId, findByText, getByText } = render(<FamilySection role="parent" />, { wrapper: wrap });
    expect(await findByText("Rebecca (Mom)")).toBeTruthy();
    expect(getByTestId("family-member-p1")).toBeTruthy();
    expect(getByText("Parent · May 2024")).toBeTruthy();
    expect(getByTestId("family-member-c1")).toBeTruthy();
    expect(getByText("Child · Mar 2018")).toBeTruthy();
    const rosterCall = (AsyncStorage.setItem as jest.Mock).mock.calls.find((c: any[]) => c[0] === "consuela-members");
    expect(rosterCall).toBeTruthy();
    expect(JSON.parse(rosterCall![1]).map((m: any) => m.name)).toEqual(["Rebecca (Mom)", "Aurora"]);
  });

  it("loading → unavailable → Retry honesty", async () => {
    api.mockRejectedValue(new ApiError({ message: "unreachable", status: 0, code: "unreachable" }));
    const { getByTestId, findByTestId, queryByTestId } = render(<FamilySection role="parent" />, { wrapper: wrap });
    expect(getByTestId("family-roster-loading")).toBeTruthy();
    expect(await findByTestId("family-roster-unavailable")).toBeTruthy();
    expect(queryByTestId("family-member-p1")).toBeNull();
    memberRoute();
    fireEvent.press(getByTestId("family-roster-retry"));
    expect(await findByTestId("family-member-p1")).toBeTruthy();
  });

  it("empty roster → honest empty state", async () => {
    memberRoute({ get: { members: [], source: "live" } });
    const { findByTestId } = render(<FamilySection role="parent" />, { wrapper: wrap });
    expect(await findByTestId("family-roster-empty")).toBeTruthy();
  });

  it("renders nothing without a parent capability (kid + no live session) and never fires the doomed GET", async () => {
    api.mockImplementation(() => {
      throw new Error("must not be called");
    });
    const { queryByTestId } = render(<FamilySection role="child" />, { wrapper: wrap });
    await flush();
    expect(queryByTestId("family-section")).toBeNull();
    const { queryByTestId: q } = render(<FamilySection role={null} />, { wrapper: wrap });
    await flush();
    expect(q("family-section")).toBeNull();
    expect(api).not.toHaveBeenCalled();
  });

  it("photo roster rows render without crashing the emoji branch", async () => {
    memberRoute({ get: { members: [{ ...child, emoji: "http://nas.local:3000/api/photos/file?r=1&f=a.jpg" }], source: "live" } });
    const { findByTestId } = render(<FamilySection role="parent" />, { wrapper: wrap });
    expect(await findByTestId("family-member-c1")).toBeTruthy();
  });
});

describe("FamilySection — add member flow", () => {
  const openAddDialog = async () => {
    memberRoute();
    const r = render(<FamilySection role="parent" />, { wrapper: wrap });
    await r.findByTestId("family-member-p1");
    fireEvent.press(r.getByTestId("family-add-member"));
    await r.findByTestId("family-field-name");
    return r;
  };

  it("add mode shows the intro copy and no PIN field", async () => {
    const { getByTestId, queryByTestId, getByText } = await openAddDialog();
    expect(queryByTestId("family-field-pin")).toBeNull();
    expect(getByText("The server assigns their starter PIN after the member is added.")).toBeTruthy();
    expect(getByTestId("family-role-child").props.accessibilityState?.selected).toBe(true);
  });

  it("validation: empty name and bad age block the save with honest copy", async () => {
    const { getByTestId, getByText } = await openAddDialog();
    fireEvent.press(getByTestId("family-editor-save"));
    expect(getByText("Enter a name so tasks and avatars know who this is.")).toBeTruthy();
    fireEvent.changeText(getByTestId("family-field-name"), "Waffles Jr");
    fireEvent.changeText(getByTestId("family-field-age"), "999");
    fireEvent.press(getByTestId("family-editor-save"));
    expect(getByText("Age must be 1–120 (or blank).")).toBeTruthy();
    expect(writeCalls("POST")).toHaveLength(0);
  });

  it("happy add: POST body shape, starter PIN panel, Done clears, roster refetch, PIN never stored", async () => {
    const r = await openAddDialog();
    fireEvent.changeText(r.getByTestId("family-field-name"), "Waffles Jr");
    fireEvent.press(r.getByTestId("family-role-pet"));
    memberRoute({ post: { success: true, starterPin: "4321" } });
    fireEvent.press(r.getByTestId("family-editor-save"));
    expect(await r.findByTestId("family-starter-pin")).toBeTruthy();
    expect(r.getByTestId("family-starter-pin").props.children).toBe("4321");
    const posts = writeCalls("POST");
    expect(posts).toHaveLength(1);
    expect(posts[0][1].body).toMatchObject({
      name: "Waffles Jr", emoji: "😊", role: "pet", avatarSize: "md", glow: false,
    });
    expect(typeof posts[0][1].body.joined).toBe("string");
    expect(posts[0][1].body.joined.length).toBeGreaterThan(0);
    fireEvent.press(r.getByTestId("family-starter-pin-done"));
    // The Modal unmounts on its 150ms exit timer — settle outside act first.
    await settleModalExit();
    expect(r.queryByTestId("family-field-name")).toBeNull();
    expect(await r.findByText("Added Waffles Jr.")).toBeTruthy();
    expect(getCalls().length).toBeGreaterThanOrEqual(2); // initial read + post-save refetch
    expect(storedPayloads()).not.toContain("4321");
  });

  it("server omits the starter PIN → honest copy, dialog stays open, roster still refreshes", async () => {
    const r = await openAddDialog();
    fireEvent.changeText(r.getByTestId("family-field-name"), "Mia");
    memberRoute({ post: { success: true } });
    fireEvent.press(r.getByTestId("family-editor-save"));
    expect(await r.findByText("Member added, but the server did not return a starter PIN. Try again.")).toBeTruthy();
    expect(r.getByTestId("family-field-name")).toBeTruthy();
    expect(getCalls().length).toBeGreaterThanOrEqual(2);
  });

  it("write errors map to honest copy: 403 adults, 409 duplicate, unreachable, other", async () => {
    const cases: { err: any; copy: string }[] = [
      { err: new ApiError({ message: "adult_only", status: 403, code: "adult_only", body: { error: "adult_only" } }), copy: "Adults only — sign in as a parent to add members." },
      { err: new ApiError({ message: "duplicate", status: 409, code: "duplicate", body: { error: "duplicate" } }), copy: "Waffles Jr is already on the family list." },
      { err: new ApiError({ message: "unreachable", status: 0, code: "unreachable" }), copy: "Couldn't reach Consuela — check the connection and try again." },
      { err: new ApiError({ message: "http_500", status: 500, code: "http_500" }), copy: "Couldn't save that change. Try again." },
    ];
    for (const c of cases) {
      const r = await openAddDialog();
      fireEvent.changeText(r.getByTestId("family-field-name"), "Waffles Jr");
      memberRoute({ post: c.err });
      fireEvent.press(r.getByTestId("family-editor-save"));
      expect(await r.findByText(c.copy)).toBeTruthy();
      expect(r.getByTestId("family-field-name")).toBeTruthy(); // failure keeps the form
      r.unmount();
    }
  });
});

describe("FamilySection — edit member flow", () => {
  const openEdit = async (id = "p1") => {
    memberRoute();
    const r = render(<FamilySection role="parent" />, { wrapper: wrap });
    await r.findByTestId(`family-member-${id}`);
    fireEvent.press(r.getByTestId(`family-edit-${id}`));
    await r.findByTestId("family-field-name");
    return r;
  };

  it("edit mode prefills the form from the member", async () => {
    const r = await openEdit();
    expect(r.getByTestId("family-field-name").props.value).toBe("Rebecca (Mom)");
    expect(r.getByTestId("family-role-parent").props.accessibilityState?.selected).toBe(true);
    expect(r.getByTestId("family-size-md").props.accessibilityState?.selected).toBe(true);
    expect(r.getByTestId("family-field-glow").props.accessibilityState?.checked).toBe(false);
    expect(r.getByTestId("family-field-pin")).toBeTruthy();
  });

  it("stored sm size + glow prefill on a child row (legacy base maps to md)", async () => {
    const r = await openEdit("c1");
    expect(r.getByTestId("family-size-sm").props.accessibilityState?.selected).toBe(true);
    expect(r.getByTestId("family-field-glow").props.accessibilityState?.checked).toBe(true);
  });

  it("PATCH body carries { id, name, patch } with the typed PIN; success closes and feeds back", async () => {
    const r = await openEdit();
    fireEvent.changeText(r.getByTestId("family-field-name"), "Becky");
    fireEvent.changeText(r.getByTestId("family-field-pin"), "5678");
    fireEvent.press(r.getByTestId("family-editor-save"));
    expect(await r.findByText("Updated Becky.")).toBeTruthy();
    const patches = writeCalls("PATCH");
    expect(patches).toHaveLength(1);
    expect(patches[0][1].body).toEqual({
      id: "p1",
      name: "Rebecca (Mom)",
      patch: { name: "Becky", emoji: "🐱", role: "parent", age: undefined, avatarSize: "md", glow: false, pin: "5678" },
    });
    // The Modal unmounts on its 150ms exit timer — settle outside act first.
    await settleModalExit();
    expect(r.queryByTestId("family-field-name")).toBeNull();
    expect(storedPayloads()).not.toContain("5678");
  });

  it("blank PIN ⇒ the pin key is never sent", async () => {
    const r = await openEdit();
    fireEvent.changeText(r.getByTestId("family-field-name"), "Becky");
    fireEvent.press(r.getByTestId("family-editor-save"));
    await r.findByText("Updated Becky.");
    expect("pin" in writeCalls("PATCH")[0][1].body.patch).toBe(false);
  });

  it("PATCH 404 → the changed-on-server copy and the dialog stays open", async () => {
    const r = await openEdit();
    memberRoute({ patch: new ApiError({ message: "Member not found", status: 404, code: "Member not found", body: { error: "Member not found" } }) });
    fireEvent.press(r.getByTestId("family-editor-save"));
    expect(await r.findByText("That member changed on the server — the roster just refreshed.")).toBeTruthy();
    expect(r.getByTestId("family-field-name")).toBeTruthy();
  });
});

describe("FamilySection — remove member flow", () => {
  const openRemove = async (id = "c1") => {
    memberRoute();
    const r = render(<FamilySection role="parent" />, { wrapper: wrap });
    await r.findByTestId(`family-member-${id}`);
    fireEvent.press(r.getByTestId(`family-remove-${id}`));
    await r.findByTestId("family-delete-confirm");
    return r;
  };

  it("confirm dialog copy; Cancel fires no DELETE", async () => {
    const r = await openRemove();
    expect(r.getByText("Remove Aurora?")).toBeTruthy();
    expect(r.getByText("They'll disappear from avatars, tasks, and the family row on every device.")).toBeTruthy();
    fireEvent.press(r.getByTestId("family-delete-cancel"));
    // The Modal unmounts on its 150ms exit timer — settle outside act first.
    await settleModalExit();
    expect(r.queryByTestId("family-delete-confirm")).toBeNull();
    expect(writeCalls("DELETE")).toHaveLength(0);
  });

  it("confirm → DELETE { id, name }, roster refetch, Removed feedback", async () => {
    const r = await openRemove();
    fireEvent.press(r.getByTestId("family-delete-confirm"));
    expect(await r.findByText("Removed Aurora.")).toBeTruthy();
    await settleModalExit();
    expect(r.queryByTestId("family-delete-confirm")).toBeNull();
    expect(writeCalls("DELETE")).toHaveLength(1);
    expect(writeCalls("DELETE")[0][1].body).toEqual({ id: "c1", name: "Aurora" });
  });

  it("last_parent → honest copy, confirm stays open, no retry storm", async () => {
    const r = await openRemove("p1");
    memberRoute({ delete: new ApiError({ message: "last_parent", status: 400, code: "last_parent", body: { error: "last_parent" } }) });
    fireEvent.press(r.getByTestId("family-delete-confirm"));
    expect(await r.findByTestId("family-delete-error")).toBeTruthy();
    expect(r.getByTestId("family-delete-error").props.children).toBe("At least one parent must remain.");
    expect(r.getByTestId("family-delete-confirm")).toBeTruthy();
    expect(writeCalls("DELETE")).toHaveLength(1);
  });
});
