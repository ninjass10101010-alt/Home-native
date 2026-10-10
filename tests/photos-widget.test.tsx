/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { act, render } from "@testing-library/react-native";

import { ThemeProvider } from "../src/theme/ThemeProvider";
import { ToastProvider } from "../src/ui/Toast";
import { PhotosWidget } from "../src/home/widgets/PhotosWidget";


jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => "sess-cookie"),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

let mockMember: any = { id: "p1", name: "Rebecca (Mom)", role: "parent", emoji: "🐱", color: "green" };
jest.mock("../src/state/AuthProvider", () => ({
  useAuth: () => ({ member: mockMember, hydrated: true, signOut: jest.fn(), poke: jest.fn() }),
}));

const mockSyncValue = {
  stale: false,
  syncError: null,
  lastSyncAt: null,
  refreshNow: jest.fn(async () => {}),
  onPulse: () => () => {},
};
jest.mock("../src/state/SyncManager", () => ({
  useSync: () => mockSyncValue,
}));

jest.mock("../src/api/client", () => ({
  api: jest.fn(),
  ApiError: jest.requireActual("../src/api/client").ApiError,
}));
const { api } = jest.requireMock("../src/api/client") as { api: jest.Mock };
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

jest.useFakeTimers();

const wrap = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>
    <ToastProvider>{children}</ToastProvider>
  </ThemeProvider>
);

const photos = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `ph${i}`,
    url: `/api/photos/file?r=ph${i}&f=photo${i}.jpg`,
    width: 400,
    height: 600,
    takenAt: "2026-10-01T10:00:00Z",
    caption: i === 0 ? "Beach day 🏖️" : undefined,
  }));

describe("PhotosWidget (wall hero)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMember = { id: "p1", name: "Rebecca (Mom)", role: "parent", emoji: "🐱", color: "green" };
    api.mockReset();
  });

  it("renders the current photo with the session cookie in the image source", async () => {
    api.mockImplementation((path: string) => {
      if (path.startsWith("/api/photos?")) return Promise.resolve({ ok: true, photos: photos(3) });
      if (path.startsWith("/api/photos/settings"))
        return Promise.resolve({ ok: true, settings: { rotateSeconds: 75, transition: "crossfade", order: "shuffle", showCaption: true } });
      return Promise.reject(new Error("unmapped"));
    });
    const { findByTestId } = render(<PhotosWidget />, { wrapper: wrap });
    const img = await findByTestId("photos-hero-image");
    expect(img.props.source.uri).toBe("http://nas.local:3000/api/photos/file?r=ph0&f=photo0.jpg");
    expect(img.props.source.headers.Cookie).toBe("consuela_session=sess-cookie");
  });

  it("advances on the settings cadence and wraps around the batch", async () => {
    api.mockImplementation((path: string) => {
      if (path.startsWith("/api/photos?")) return Promise.resolve({ ok: true, photos: photos(3) });
      if (path.startsWith("/api/photos/settings"))
        return Promise.resolve({ ok: true, settings: { rotateSeconds: 10, transition: "cut", order: "shuffle", showCaption: false } });
      return Promise.reject(new Error("unmapped"));
    });
    const { findByTestId } = render(<PhotosWidget />, { wrapper: wrap });
    let img = await findByTestId("photos-hero-image");
    expect(img.props.source.uri).toContain("ph0");
    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    img = await findByTestId("photos-hero-image");
    expect(img.props.source.uri).toContain("ph1");
    act(() => {
      jest.advanceTimersByTime(10_000);
      jest.advanceTimersByTime(10_000);
    });
    img = await findByTestId("photos-hero-image");
    expect(img.props.source.uri).toContain("ph0"); // wrapped
  });

  it("degraded settings fall back to defaults and badge honestly", async () => {
    api.mockImplementation((path: string) => {
      if (path.startsWith("/api/photos?")) return Promise.resolve({ ok: true, photos: photos(1) });
      if (path.startsWith("/api/photos/settings"))
        return Promise.resolve({ ok: true, degraded: true, settings: { rotateSeconds: 75, transition: "crossfade", order: "shuffle", showCaption: true } });
      return Promise.reject(new Error("unmapped"));
    });
    const { findByText } = render(<PhotosWidget />, { wrapper: wrap });
    expect(await findByText("settings unavailable — default rotation")).toBeTruthy();
  });

  it("no photos → honest empty state (no fabricated hero)", async () => {
    api.mockImplementation((path: string) => {
      if (path.startsWith("/api/photos?")) return Promise.resolve({ ok: true, photos: [] });
      if (path.startsWith("/api/photos/settings"))
        return Promise.resolve({ ok: true, settings: { rotateSeconds: 75, transition: "crossfade", order: "shuffle", showCaption: true } });
      return Promise.reject(new Error("unmapped"));
    });
    const { findByText } = render(<PhotosWidget />, { wrapper: wrap });
    expect(await findByText("No photos yet.")).toBeTruthy();
  });
});
