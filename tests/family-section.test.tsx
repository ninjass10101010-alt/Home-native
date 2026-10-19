/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ThemeProvider } from "../src/theme/ThemeProvider";
import { FamilySection } from "../src/settings/FamilySection";

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

const wrap = ({ children }: { children: React.ReactNode }) => <ThemeProvider>{children}</ThemeProvider>;
const flush = () => act(async () => {});

const parent = {
  id: "p1", pbId: "p1", name: "Rebecca (Mom)", role: "parent", emoji: "🐱",
  color: "green", avatarSize: "md", glow: false, created: "2024-05-12 08:00:00.000Z",
};
const child = {
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

beforeEach(async () => {
  jest.clearAllMocks();
  // The async-storage-mock keeps a real in-memory store across tests.
  await AsyncStorage.clear();
  api.mockReset();
});

describe("FamilySection — roster read", () => {
  it("renders the live roster with role · joined subtitles and mirrors the cache", async () => {
    memberRoute();
    const { getByTestId, findByText, getByText } = render(<FamilySection member={parent} />, { wrapper: wrap });
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
    const { getByTestId, findByTestId, queryByTestId } = render(<FamilySection member={parent} />, { wrapper: wrap });
    expect(getByTestId("family-roster-loading")).toBeTruthy();
    expect(await findByTestId("family-roster-unavailable")).toBeTruthy();
    expect(queryByTestId("family-member-p1")).toBeNull();
    memberRoute();
    fireEvent.press(getByTestId("family-roster-retry"));
    expect(await findByTestId("family-member-p1")).toBeTruthy();
  });

  it("empty roster → honest empty state", async () => {
    memberRoute({ get: { members: [], source: "live" } });
    const { findByTestId } = render(<FamilySection member={parent} />, { wrapper: wrap });
    expect(await findByTestId("family-roster-empty")).toBeTruthy();
  });

  it("renders nothing without a parent member (kid + guest) and never fires the doomed GET", async () => {
    api.mockImplementation(() => {
      throw new Error("must not be called");
    });
    const { queryByTestId } = render(<FamilySection member={child} />, { wrapper: wrap });
    await flush();
    expect(queryByTestId("family-section")).toBeNull();
    const { queryByTestId: q } = render(<FamilySection member={null} />, { wrapper: wrap });
    await flush();
    expect(q("family-section")).toBeNull();
    expect(api).not.toHaveBeenCalled();
  });

  it("photo roster rows render without crashing the emoji branch", async () => {
    memberRoute({ get: { members: [{ ...child, emoji: "http://nas.local:3000/api/photos/file?r=1&f=a.jpg" }], source: "live" } });
    const { findByTestId } = render(<FamilySection member={parent} />, { wrapper: wrap });
    expect(await findByTestId("family-member-c1")).toBeTruthy();
  });
});
