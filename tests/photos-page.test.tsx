/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";

import { ThemeProvider } from "../src/theme/ThemeProvider";
import { ToastProvider } from "../src/ui/Toast";
import { PhotosPage } from "../src/photos/PhotosPage";
import PhotosRoute from "../app/photos";

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
  useRouter: () => ({ push: mockRouterPush, canGoBack: () => true, back: jest.fn() }),
  usePathname: () => "/photos",
}));

const parent = { id: "p1", name: "Rebecca (Mom)", role: "parent", emoji: "🐱", color: "green" };
const kid = { id: "k1", name: "Aurora", role: "child", emoji: "👧", color: "violet", age: 8 };

let mockMember: any = parent;
jest.mock("../src/state/AuthProvider", () => ({
  useAuth: () => ({
    member: mockMember,
    hydrated: true,
    signOut: jest.fn(),
    poke: jest.fn(),
    pinRequiredFor: jest.requireActual("../src/state/AuthProvider").pinRequiredFor,
  }),
}));

let mockStale = false;
const mockRefreshNow = jest.fn(async () => {});
const mockPulseListeners = new Set<() => void>();
const mockSyncValue = {
  get stale() {
    return mockStale;
  },
  syncError: null as null,
  lastSyncAt: null as null,
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
const { api } = jest.requireMock("../src/api/client") as { api: jest.Mock };
const { ApiError } = jest.requireActual("../src/api/client") as { ApiError: any };

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

const wrap = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>
    <ToastProvider>{children}</ToastProvider>
  </ThemeProvider>
);

/** Path-prefix router for the mocked api(). */
const route = (handlers: Record<string, unknown>) =>
  api.mockImplementation((path: string) => {
    for (const key of Object.keys(handlers)) {
      if (path.startsWith(key)) {
        const v = handlers[key];
        return v instanceof Error ? Promise.reject(v) : Promise.resolve(v);
      }
    }
    return Promise.reject(new ApiError({ message: "unmapped path", status: 404, code: "not_found" }));
  });

// ph1 is ON the wall, ph2 is deliberately hidden — the management feed shows both.
const PHOTOS = [
  {
    id: "ph1",
    url: "/api/photos/file?r=ph1&f=beach.jpg",
    width: 400,
    height: 600,
    takenAt: "2026-10-10T10:00:00Z",
    caption: "Beach day 🏖️",
    showOnWall: true,
  },
  {
    id: "ph2",
    url: "/api/photos/file?r=ph2&f=cake.jpg",
    width: 600,
    height: 400,
    takenAt: "2026-10-09T10:00:00Z",
    showOnWall: false,
  },
];

// The PATCH verb maps to the bare path (insertion order keeps the GET feed winning).
const fullRoute = () =>
  route({
    "/api/photos?all=1": { ok: true, photos: PHOTOS },
    "/api/photos": { ok: true },
  });

beforeEach(() => {
  jest.clearAllMocks();
  mockPulseListeners.clear();
  mockMember = parent;
  mockStale = false;
  api.mockReset();
});

describe("PhotosPage — the shared library grid", () => {
  it("renders every library photo (on- and off-wall) with the state chip", async () => {
    fullRoute();
    const { getByTestId, findByTestId, getByText } = render(<PhotosPage />, { wrapper: wrap });
    expect(await findByTestId("photo-cell-ph1")).toBeTruthy();
    expect(getByTestId("photo-cell-ph2")).toBeTruthy();
    // chips carry the wall-state voice verbatim from the web grid
    expect(getByText("On wall")).toBeTruthy();
    expect(getByText("Hidden")).toBeTruthy();
  });

  it("thumbnails ride the session cookie via the shared photo source", async () => {
    fullRoute();
    const { findByTestId } = render(<PhotosPage />, { wrapper: wrap });
    const img = await findByTestId("photo-img-ph1");
    expect(img.props.source.uri).toBe("http://nas.local:3000/api/photos/file?r=ph1&f=beach.jpg");
    expect(img.props.source.headers.Cookie).toBe("consuela_session=sess-cookie");
  });

  it("guest gate: honest PIN copy and no doomed fetches", async () => {
    mockMember = null;
    const { findByText } = render(<PhotosPage />, { wrapper: wrap });
    expect(await findByText("Sign in with your PIN to see the family's photos.")).toBeTruthy();
    expect(api).not.toHaveBeenCalled();
  });

  it("empty library: honest copy, no fabricated grid", async () => {
    route({ "/api/photos?all=1": { ok: true, photos: [] } });
    const { findByText } = render(<PhotosPage />, { wrapper: wrap });
    expect(
      await findByText("Nothing uploaded yet — add the first picture from the phone and it lands on the wall.")
    ).toBeTruthy();
  });

  it("read failure: honest error copy with retry that reloads", async () => {
    route({
      "/api/photos?all=1": new ApiError({ message: "error", status: 502, code: "http_502", retryable: true }),
    });
    const { findByText, getByText } = render(<PhotosPage />, { wrapper: wrap });
    expect(await findByText("Couldn't load this right now.")).toBeTruthy();
    fullRoute();
    await act(async () => {
      fireEvent.press(getByText("Try again"));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(await findByText("On wall")).toBeTruthy();
  });

  it("stale badge follows the sync layer", async () => {
    mockStale = true;
    fullRoute();
    const { getByTestId, findByTestId } = render(<PhotosPage />, { wrapper: wrap });
    await findByTestId("photo-cell-ph1");
    expect(getByTestId("photos-stale").props.children).toBe("Showing your saved copy — couldn't refresh.");
  });
});

describe("PhotosPage — parent moderation", () => {
  it("tap on an on-wall thumb PATCHes {id, showOnWall:false} and flips the chip optimistically", async () => {
    fullRoute();
    const { getByTestId, findByTestId, getByText, findByText } = render(<PhotosPage />, { wrapper: wrap });
    await findByTestId("photo-cell-ph1");
    await act(async () => {
      fireEvent.press(getByTestId("photo-cell-ph1"));
      await Promise.resolve();
      await Promise.resolve();
    });
    const calls = api.mock.calls.filter((c) => c[1]?.method === "PATCH");
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe("/api/photos");
    expect(calls[0][1].body).toEqual({ id: "ph1", showOnWall: false });
    // the flip landed on screen (override kept, server state confirms on next pulse)
    expect(getByTestId("photo-cell-ph1").props.accessibilityState.checked).toBe(false);
    void findByText; void getByText;
  });

  it("tap on a hidden thumb re-enables it ({id, showOnWall:true})", async () => {
    fullRoute();
    const { getByTestId, findByTestId } = render(<PhotosPage />, { wrapper: wrap });
    await findByTestId("photo-cell-ph2");
    await act(async () => {
      fireEvent.press(getByTestId("photo-cell-ph2"));
      await Promise.resolve();
      await Promise.resolve();
    });
    const calls = api.mock.calls.filter((c) => c[1]?.method === "PATCH");
    expect(calls).toHaveLength(1);
    expect(calls[0][1].body).toEqual({ id: "ph2", showOnWall: true });
    expect(getByTestId("photo-cell-ph2").props.accessibilityState.checked).toBe(true);
  });

  it("PATCH failure rolls the chip back and says so honestly", async () => {
    api.mockImplementation((path: string, init?: any) => {
      if (init?.method === "PATCH")
        return Promise.reject(new ApiError({ message: "error", status: 502, code: "http_502", retryable: true }));
      if (path.startsWith("/api/photos?all=1")) return Promise.resolve({ ok: true, photos: PHOTOS });
      return Promise.reject(new ApiError({ message: "unmapped", status: 404, code: "not_found" }));
    });
    const { getByTestId, findByTestId, findByText } = render(<PhotosPage />, { wrapper: wrap });
    await findByTestId("photo-cell-ph1");
    await act(async () => {
      fireEvent.press(getByTestId("photo-cell-ph1"));
      await Promise.resolve();
      await Promise.resolve();
    });
    // rolled back to the server truth + honest toast
    expect(getByTestId("photo-cell-ph1").props.accessibilityState.checked).toBe(true);
    expect(await findByText("Couldn't update the photo — try again.")).toBeTruthy();
  });

  it("server refusal (the live parent re-verify denies) gets honest copy, no fake flip", async () => {
    api.mockImplementation((path: string, init?: any) => {
      if (init?.method === "PATCH")
        return Promise.reject(new ApiError({ message: "parent_session_required", status: 403, code: "parent_session_required" }));
      if (path.startsWith("/api/photos?all=1")) return Promise.resolve({ ok: true, photos: PHOTOS });
      return Promise.reject(new ApiError({ message: "unmapped", status: 404, code: "not_found" }));
    });
    const { getByTestId, findByTestId, findByText } = render(<PhotosPage />, { wrapper: wrap });
    await findByTestId("photo-cell-ph1");
    await act(async () => {
      fireEvent.press(getByTestId("photo-cell-ph1"));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(getByTestId("photo-cell-ph1").props.accessibilityState.checked).toBe(true);
    expect(await findByText("Only a parent can change what's on the wall.")).toBeTruthy();
  });

  it("kids see the library but never a toggle (gate before, server re-verifies anyway)", async () => {
    mockMember = kid;
    fullRoute();
    const { getByTestId, findByTestId, findByText } = render(<PhotosPage />, { wrapper: wrap });
    await findByTestId("photo-cell-ph1");
    // kid cells are plain views — no switch role, and no dead affordance
    expect(getByTestId("photo-cell-ph1").props.accessibilityRole ?? undefined).toBeUndefined();
    fireEvent.press(getByTestId("photo-cell-ph1"));
    await act(async () => {
      await Promise.resolve();
    });
    expect(api.mock.calls.filter((c) => c[1]?.method === "PATCH")).toHaveLength(0);
    expect(await findByText("A parent picks what's on the wall.")).toBeTruthy();
  });
});

describe("PhotosPage — upload honesty", () => {
  it("the upload affordance shows the next-wave deferral copy (no fake uploader)", async () => {
    fullRoute();
    const { getByTestId, findByTestId, findByText } = render(<PhotosPage />, { wrapper: wrap });
    await findByTestId("photo-cell-ph1");
    await act(async () => {
      fireEvent.press(getByTestId("photos-upload"));
      await Promise.resolve();
    });
    expect(await findByText("Uploads from the wall arrive with the next wave — use the phone.")).toBeTruthy();
  });
});

describe("Photos route", () => {
  it("app/photos renders the page with the manifest dock mounted", async () => {
    fullRoute();
    const { getByTestId, findByTestId } = render(<PhotosRoute />, { wrapper: wrap });
    expect(getByTestId("photos-route")).toBeTruthy();
    expect(await findByTestId("photos-page")).toBeTruthy();
    expect(getByTestId("dock-home")).toBeTruthy();
  });
});
