/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { AppState } from "react-native";
import { act, renderHook } from "@testing-library/react-native";
import { SyncManager, useSync, classifySyncError } from "../src/state/SyncManager";
import { ApiError } from "../src/api/client";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

let mockMember: any = null;
let mockHydrated = true;
const mockSignOut = jest.fn(async () => {});
jest.mock("../src/state/AuthProvider", () => ({
  useAuth: () => ({
    member: mockMember,
    role: mockMember ? mockMember.role : null,
    hydrated: mockHydrated,
    signOut: mockSignOut,
  }),
  AuthProvider: ({ children }: any) => children,
}));

jest.mock("../src/api/client", () => ({
  api: jest.fn(),
  ApiError: jest.requireActual("../src/api/client").ApiError,
}));
const { api } = jest.requireMock("../src/api/client") as { api: jest.Mock };

const member = { id: "p1", name: "Rebecca (Mom)", role: "parent", emoji: "🐱", color: "green" };
const wrap = ({ children }: { children: React.ReactNode }) => <SyncManager>{children}</SyncManager>;

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockMember = member;
  mockHydrated = true;
});
afterEach(() => jest.useRealTimers());

describe("SyncManager", () => {
  it("polls /api/tasks/sync at mount and every 60s while signed in", async () => {
    api.mockResolvedValue({ snapshot: { tasks: [] }, reconciled: true });
    const { result } = renderHook(() => useSync(), { wrapper: wrap });
    await act(async () => {
      await Promise.resolve();
    });
    expect(api).toHaveBeenCalledTimes(1);
    expect(result.current.lastSyncAt).not.toBeNull();
    await act(async () => {
      jest.advanceTimersByTime(60_000);
      await Promise.resolve();
    });
    expect(api.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("no polling when signed out (server requires a session — a guest poll could only 401)", async () => {
    mockMember = null;
    renderHook(() => useSync(), { wrapper: wrap });
    await act(async () => {
      await Promise.resolve();
    });
    expect(api).not.toHaveBeenCalled();
  });

  it("pulse fires only on snapshot-bearing responses", async () => {
    api.mockResolvedValueOnce({ snapshot: null, reconciled: false });
    const { result } = renderHook(() => useSync(), { wrapper: wrap });
    const listener = jest.fn();
    let un: () => void = () => {};
    act(() => {
      un = result.current.onPulse(listener);
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(listener).not.toHaveBeenCalled();

    api.mockResolvedValueOnce({ snapshot: { tasks: [1] }, reconciled: true });
    await act(async () => {
      await result.current.refreshNow();
    });
    expect(listener).toHaveBeenCalledTimes(1);
    un();
    await act(async () => {
      await result.current.refreshNow();
    });
    expect(listener).toHaveBeenCalledTimes(1); // unsubscribed
  });

  it("401 → signOut + unauthorized", async () => {
    api.mockRejectedValue(new ApiError({ message: "unauthorized", status: 401, code: "unauthorized" }));
    const { result } = renderHook(() => useSync(), { wrapper: wrap });
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockSignOut).toHaveBeenCalled();
    expect(result.current.syncError).toBe("unauthorized");
  });

  it("unreachable → stale true, then recovery clears it", async () => {
    api.mockRejectedValueOnce(new ApiError({ message: "x", status: 0, code: "unreachable", retryable: true }));
    const { result } = renderHook(() => useSync(), { wrapper: wrap });
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.stale).toBe(true);
    expect(result.current.syncError).toBe("unreachable");

    api.mockResolvedValueOnce({ snapshot: {}, reconciled: true });
    await act(async () => {
      await result.current.refreshNow();
    });
    expect(result.current.stale).toBe(false);
    expect(result.current.syncError).toBeNull();
  });

  it("NEVER synthesizes success: failed refresh leaves stale AND lastSyncAt stays null", async () => {
    api.mockRejectedValue(new ApiError({ message: "down", status: 0, code: "unreachable", retryable: true }));
    const { result } = renderHook(() => useSync(), { wrapper: wrap });
    await act(async () => {
      await Promise.resolve();
    });
    expect(api).toHaveBeenCalledTimes(1);
    expect(result.current.lastSyncAt).toBeNull();
    expect(result.current.stale).toBe(true);
  });

  it("backoff: 5s burst ×3 consecutive failures, then back to the 60s cadence", async () => {
    api.mockRejectedValue(new ApiError({ message: "down", status: 0, code: "unreachable", retryable: true }));
    renderHook(() => useSync(), { wrapper: wrap });
    await act(async () => {
      await Promise.resolve();
    });
    expect(api).toHaveBeenCalledTimes(1);
    api.mockClear();
    // failure #1 → next poll at 5s (burst 1)
    await act(async () => { jest.advanceTimersByTime(5_000); await Promise.resolve(); });
    expect(api).toHaveBeenCalledTimes(1);
    await act(async () => { jest.advanceTimersByTime(5_000); await Promise.resolve(); });
    expect(api).toHaveBeenCalledTimes(2);
    await act(async () => { jest.advanceTimersByTime(5_000); await Promise.resolve(); });
    expect(api).toHaveBeenCalledTimes(3);
    // 4th consecutive failure → cadence back to 60s, NOT another 5s burst
    await act(async () => { jest.advanceTimersByTime(5_000); await Promise.resolve(); });
    expect(api).toHaveBeenCalledTimes(3); // nothing at 5s
    await act(async () => { jest.advanceTimersByTime(55_000); await Promise.resolve(); });
    expect(api).toHaveBeenCalledTimes(4); // the 60s poll fired
  });
});

describe("SyncError taxonomy (U5.1) — a 502 is not offline", () => {
  it("classifySyncError: transport stays unreachable, HTTP errors are server, 401 is session", () => {
    expect(classifySyncError(new ApiError({ message: "x", status: 0, code: "unreachable", retryable: true }))).toBe("unreachable");
    expect(classifySyncError(new ApiError({ message: "bad gateway", status: 502, code: "http_502", retryable: true }))).toBe("server");
    expect(classifySyncError(new ApiError({ message: "not found", status: 404, code: "http_404" }))).toBe("server");
    expect(classifySyncError(new ApiError({ message: "unauthorized", status: 401, code: "unauthorized" }))).toBe("unauthorized");
    expect(classifySyncError(new Error("boom"))).toBe("unreachable"); // non-ApiError transport
  });

  it("a reachable server that fails (502) → syncError 'server', surfaces never read it as offline", async () => {
    api.mockRejectedValueOnce(new ApiError({ message: "bad gateway", status: 502, code: "http_502", retryable: true }));
    const { result } = renderHook(() => useSync(), { wrapper: wrap });
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.syncError).toBe("server");
    expect(result.current.stale).toBe(true); // still honest: the data may not be family truth
  });

  it("status 0 transport failure keeps 'unreachable'", async () => {
    api.mockRejectedValueOnce(new ApiError({ message: "x", status: 0, code: "unreachable", retryable: true }));
    const { result } = renderHook(() => useSync(), { wrapper: wrap });
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.syncError).toBe("unreachable");
  });
});

describe("initial stale honesty (U5.2) — never fresh-when-unknown", () => {
  it("signed in, no successful sync yet → stale is TRUE while the first poll is in flight", async () => {
    api.mockImplementation(() => new Promise(() => {})); // never settles
    const { result } = renderHook(() => useSync(), { wrapper: wrap });
    expect(result.current.lastSyncAt).toBeNull();
    expect(result.current.stale).toBe(true); // a never-synced wall must not claim freshness
  });

  it("signed OUT wall → not badged (guests never sync; their wall is the saved-copy rail + gates)", async () => {
    mockMember = null;
    api.mockImplementation(() => new Promise(() => {}));
    const { result } = renderHook(() => useSync(), { wrapper: wrap });
    expect(result.current.lastSyncAt).toBeNull();
    expect(result.current.stale).toBe(false);
  });

  it("the first successful sync clears the honest initial stale", async () => {
    api.mockResolvedValueOnce({ snapshot: { tasks: [] }, reconciled: true });
    const { result } = renderHook(() => useSync(), { wrapper: wrap });
    expect(result.current.stale).toBe(true); // before the poll settles
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.lastSyncAt).not.toBeNull();
    expect(result.current.stale).toBe(false);
  });
});

describe("reconciled:false honesty (U5.3) — Home-ai ARCHITECTURE §5.6", () => {
  it("keeps the last-good snapshot but leaves stale truthy until the server reconciles", async () => {
    api.mockResolvedValueOnce({ snapshot: { tasks: [1] }, reconciled: false });
    const { result } = renderHook(() => useSync(), { wrapper: wrap });
    await act(async () => {
      await Promise.resolve();
    });
    // the snapshot is kept (correct — the server is catching up, not empty)…
    expect(result.current.snapshot).toEqual({ tasks: [1] });
    expect(result.current.lastSyncAt).not.toBeNull();
    expect(result.current.syncError).toBeNull();
    // …but surfaces must be badged: the data on screen may still lag the family truth.
    expect(result.current.stale).toBe(true);

    // A later reconciled response clears the badge.
    api.mockResolvedValueOnce({ snapshot: { tasks: [2] }, reconciled: true });
    await act(async () => {
      await result.current.refreshNow();
    });
    expect(result.current.snapshot).toEqual({ tasks: [2] });
    expect(result.current.stale).toBe(false);
  });
});

describe("poll loop cleanup (U5.6)", () => {
  it("unmount clears the 60s timer and detaches the AppState listener", async () => {
    api.mockResolvedValue({ snapshot: {} });
    const remove = jest.fn();
    const addSpy = jest.spyOn(AppState, "addEventListener").mockReturnValue({ remove } as any);
    const { unmount } = renderHook(() => useSync(), { wrapper: wrap });
    await act(async () => {
      await Promise.resolve();
    });
    expect(api).toHaveBeenCalledTimes(1); // the mount poll fired
    expect(addSpy).toHaveBeenCalled();
    api.mockClear();

    unmount();
    await act(async () => {
      jest.advanceTimersByTime(60_000); // the leaked timer would poll here
      await Promise.resolve();
    });
    expect(api).not.toHaveBeenCalled(); // timer cleared on cleanup
    expect(remove).toHaveBeenCalled(); // AppState listener detached
    addSpy.mockRestore();
  });
});
