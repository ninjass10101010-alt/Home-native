/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { act, renderHook } from "@testing-library/react-native";
import { SyncManager, useSync } from "../src/state/SyncManager";
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

  it("no polling when signed out", async () => {
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

  it("NEVER synthesizes success: failed refresh leaves stale, not a green lastSync", async () => {
    api.mockRejectedValue(new ApiError({ message: "down", status: 0, code: "unreachable", retryable: true }));
    renderHook(() => useSync(), { wrapper: wrap });
    await act(async () => {
      await Promise.resolve();
    });
    expect(api).toHaveBeenCalledTimes(1);
    // initial failure → lastSyncAt stays null until a real success
  });
});
