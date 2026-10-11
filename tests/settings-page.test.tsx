/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ThemeProvider } from "../src/theme/ThemeProvider";
import { ACCENTS } from "../src/theme/tokens";
import { SettingsPage } from "../src/settings/SettingsPage";
import SettingsRoute from "../app/settings";

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
  usePathname: () => "/settings",
}));

const parent = { id: "p1", name: "Rebecca (Mom)", role: "parent", emoji: "🐱", color: "green" };
const child = { id: "c1", name: "Aurora", role: "child", emoji: "🌸", color: "amber", age: 8 };
const pet = { id: "pt1", name: "Waffles", role: "pet", emoji: "🐶", color: "cyan" };

let mockMember: any = parent;
let mockHydrated = true;
const mockSignOut = jest.fn(async () => {});
jest.mock("../src/state/AuthProvider", () => ({
  useAuth: () => ({ member: mockMember, hydrated: mockHydrated, signOut: mockSignOut, poke: jest.fn() }),
}));

let mockStale = false;
// Stable value object — mirrors SyncManager's useMemo so effect deps settle.
const mockSyncValue = {
  get stale() {
    return mockStale;
  },
  syncError: null as null,
  lastSyncAt: null as null,
  snapshot: null,
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
const { ApiError } = jest.requireActual("../src/api/client") as { ApiError: any };

const wrap = ({ children }: { children: React.ReactNode }) => <ThemeProvider>{children}</ThemeProvider>;

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

const CONTACTS = [
  { id: 1, name: "Rebecca (Mom)", phone: "+15551234567", email: "r@x.com", relationship: "parent", isPrimary: true, emoji: "🐱" },
  { id: 2, name: "Alex", phone: "+15559876543", email: "a@x.com", relationship: "parent", isPrimary: false, emoji: "🐉" },
];
const CONTACTS_LIVE = { contacts: CONTACTS, contactsSource: "live" };
const CONTACTS_CACHE = { contacts: CONTACTS, contactsSource: "cache" };

const typePin = (getByLabelText: (label: string) => any, pin: string) => {
  for (const k of pin) fireEvent.press(getByLabelText(k));
};

/** Flush ThemeProvider's async hydration (AsyncStorage + AccessibilityInfo) inside act(). */
const flush = () => act(async () => {});

const pinCalls = () => api.mock.calls.filter((c: any[]) => c[0] === "/api/members/pin");

const setItemMock = () => AsyncStorage.setItem as jest.Mock;

beforeEach(async () => {
  jest.clearAllMocks();
  // The async-storage-mock keeps a real in-memory store across tests; a later
  // ThemeProvider hydration must not pick up an earlier test's persisted keys.
  await AsyncStorage.clear();
  mockMember = parent;
  mockHydrated = true;
  mockStale = false;
  api.mockReset();
});

describe("SettingsPage — launcher by role", () => {
  it("parent sees all six sections", async () => {
    const { getByTestId, queryByTestId } = render(<SettingsPage />, { wrapper: wrap });
    await flush();
    for (const id of ["me", "family", "safety", "appearance", "home", "system"]) {
      expect(getByTestId(`settings-section-${id}`)).toBeTruthy();
    }
    expect(queryByTestId("settings-stale")).toBeNull();
  });

  it("child sees only Me, Safety, Appearance", async () => {
    mockMember = child;
    const { getByTestId, queryByTestId } = render(<SettingsPage />, { wrapper: wrap });
    await flush();
    for (const id of ["me", "safety", "appearance"]) {
      expect(getByTestId(`settings-section-${id}`)).toBeTruthy();
    }
    for (const id of ["family", "home", "system"]) {
      expect(queryByTestId(`settings-section-${id}`)).toBeNull();
    }
  });

  it("pet sees only Me, Safety, Appearance", async () => {
    mockMember = pet;
    const { getByTestId, queryByTestId } = render(<SettingsPage />, { wrapper: wrap });
    await flush();
    for (const id of ["me", "safety", "appearance"]) {
      expect(getByTestId(`settings-section-${id}`)).toBeTruthy();
    }
    for (const id of ["family", "home", "system"]) {
      expect(queryByTestId(`settings-section-${id}`)).toBeNull();
    }
  });

  it("guest sees Me + Safety + Appearance (web contract: guest Me points at the rail)", async () => {
    mockMember = null;
    const { getByTestId, queryByTestId, getByText } = render(<SettingsPage />, { wrapper: wrap });
    await flush();
    expect(getByTestId("settings-section-safety")).toBeTruthy();
    expect(getByTestId("settings-section-appearance")).toBeTruthy();
    expect(getByTestId("settings-section-me")).toBeTruthy();
    for (const id of ["family", "home", "system"]) {
      expect(queryByTestId(`settings-section-${id}`)).toBeNull();
    }
    expect(
      getByText("The signed-out family holds this device — sign in on the rail to see your own settings.")
    ).toBeTruthy();
  });

  it("guest Me drills into the honest guest branch (no profile controls)", async () => {
    mockMember = null;
    const { getByTestId, findByText, findByTestId } = render(<SettingsPage />, { wrapper: wrap });
    await flush();
    fireEvent.press(getByTestId("settings-section-me"));
    expect(await findByText("Sign in to manage your profile")).toBeTruthy();
    expect(await findByText("Tap your picture on Home and Consuela knows it's you.")).toBeTruthy();
    // must NOT fall through to the deferred-family copy (the latent landmine)
    expect((await findByTestId("settings-me-guest"))).toBeTruthy();
  });

  it("drilling into a section swaps the launcher for the section, and back returns", async () => {
    route({ "/api/emergency-contacts": CONTACTS_LIVE });
    const { getByTestId, findByTestId, queryByTestId } = render(<SettingsPage />, { wrapper: wrap });
    fireEvent.press(getByTestId("settings-section-safety"));
    expect(await findByTestId("settings-back")).toBeTruthy();
    expect(queryByTestId("settings-section-me")).toBeNull();
    fireEvent.press(getByTestId("settings-back"));
    expect(await findByTestId("settings-section-me")).toBeTruthy();
  });
});

describe("SettingsPage — Me", () => {
  it("shows the signed-in member's emoji, name and role line", async () => {
    const { getByTestId, getByText } = render(<SettingsPage />, { wrapper: wrap });
    await flush();
    fireEvent.press(getByTestId("settings-section-me"));
    expect(getByText("Rebecca (Mom)")).toBeTruthy();
    expect(getByText("Parent")).toBeTruthy();
    expect(getByText("🐱")).toBeTruthy();
    expect(getByTestId("settings-change-pin")).toBeTruthy();
    expect(getByTestId("settings-sign-out")).toBeTruthy();
  });

  it("sign out calls the auth signOut", async () => {
    const { getByTestId } = render(<SettingsPage />, { wrapper: wrap });
    await flush();
    fireEvent.press(getByTestId("settings-section-me"));
    fireEvent.press(getByTestId("settings-sign-out"));
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});

describe("SettingsPage — PIN change flow", () => {
  const pinApi = (pinResponder: (body: any) => unknown) =>
    api.mockImplementation((path: string, init?: any) => {
      if (path === "/api/members/pin") {
        const v = pinResponder(init?.body);
        return v instanceof Error ? Promise.reject(v) : Promise.resolve(v);
      }
      return Promise.reject(new ApiError({ message: "unmapped path", status: 404, code: "not_found" }));
    });

  it("three pads verify in order, the POST carries { actorPin, newPin }, and PINs never reach storage", async () => {
    pinApi(() => ({ success: true }));
    const { getByTestId, getByLabelText, findByText } = render(<SettingsPage />, { wrapper: wrap });
    fireEvent.press(getByTestId("settings-section-me"));
    fireEvent.press(getByTestId("settings-change-pin"));

    expect(await findByText("First, enter your current PIN.")).toBeTruthy();
    typePin(getByLabelText, "1111");
    expect(await findByText("Choose a new 4-digit PIN.")).toBeTruthy();
    typePin(getByLabelText, "4321");
    expect(await findByText("Enter it once more to be sure.")).toBeTruthy();
    typePin(getByLabelText, "4321");

    expect(await findByText("PIN changed.")).toBeTruthy();
    expect(pinCalls().map((c) => c[1])).toEqual([{ method: "POST", body: { actorPin: "1111", newPin: "4321" } }]);
    // The PIN-memory contract: no PIN value is ever written to device storage.
    for (const call of setItemMock().mock.calls) {
      const blob = JSON.stringify(call);
      expect(blob.includes("1111")).toBe(false);
      expect(blob.includes("4321")).toBe(false);
    }
  });

  it("409 pin_collision → honest copy and back to the new-PIN pad", async () => {
    pinApi(() => new ApiError({ message: "pin_collision", status: 409, code: "pin_collision", body: { error: "pin_collision" } }));
    const { getByTestId, getByLabelText, findByText } = render(<SettingsPage />, { wrapper: wrap });
    fireEvent.press(getByTestId("settings-section-me"));
    fireEvent.press(getByTestId("settings-change-pin"));
    await findByText("First, enter your current PIN.");
    typePin(getByLabelText, "1111");
    await findByText("Choose a new 4-digit PIN.");
    typePin(getByLabelText, "4321");
    await findByText("Enter it once more to be sure.");
    typePin(getByLabelText, "4321");
    expect(await findByText("That PIN is taken — pick another one.")).toBeTruthy();
    expect(await findByText("Choose a new 4-digit PIN.")).toBeTruthy();
  });

  it("wrong current PIN (401) → honest copy, back on the current-PIN pad", async () => {
    pinApi(() => new ApiError({ message: "Invalid PIN", status: 401, code: "Invalid PIN", body: { error: "Invalid PIN" } }));
    const { getByTestId, getByLabelText, findByText } = render(<SettingsPage />, { wrapper: wrap });
    fireEvent.press(getByTestId("settings-section-me"));
    fireEvent.press(getByTestId("settings-change-pin"));
    await findByText("First, enter your current PIN.");
    typePin(getByLabelText, "1111");
    await findByText("Choose a new 4-digit PIN.");
    typePin(getByLabelText, "4321");
    await findByText("Enter it once more to be sure.");
    typePin(getByLabelText, "4321");
    expect(await findByText("Wrong PIN — try again.")).toBeTruthy();
    expect(await findByText("First, enter your current PIN.")).toBeTruthy();
  });

  it("mismatched confirmation → honest copy, back to the new-PIN pad, no POST", async () => {
    pinApi(() => ({ success: true }));
    const { getByTestId, getByLabelText, findByText } = render(<SettingsPage />, { wrapper: wrap });
    fireEvent.press(getByTestId("settings-section-me"));
    fireEvent.press(getByTestId("settings-change-pin"));
    await findByText("First, enter your current PIN.");
    typePin(getByLabelText, "1111");
    await findByText("Choose a new 4-digit PIN.");
    typePin(getByLabelText, "4321");
    await findByText("Enter it once more to be sure.");
    typePin(getByLabelText, "9999");
    expect(await findByText("Those PINs don't match — pick your new one again.")).toBeTruthy();
    expect(await findByText("Choose a new 4-digit PIN.")).toBeTruthy();
    expect(pinCalls()).toEqual([]);
  });
});

describe("SettingsPage — Appearance (live writes)", () => {
  it("theme SoftButton flips the live theme and persists consuela-theme", async () => {
    mockMember = null;
    const { getByTestId, getByText, queryByText } = render(<SettingsPage />, { wrapper: wrap });
    await flush();
    fireEvent.press(getByTestId("settings-section-appearance"));
    // Scheme-agnostic: read the current ball, press, expect the flip persisted.
    const wasDark = !!queryByText("Dark 🌙");
    fireEvent.press(getByTestId("settings-theme-toggle"));
    const expected = wasDark ? "light" : "dark";
    expect(getByText(wasDark ? "Light ☀️" : "Dark 🌙")).toBeTruthy();
    expect(setItemMock().mock.calls.some(([k, v]) => k === "consuela-theme" && v === expected)).toBe(true);
  });

  it("high-contrast Toggle persists consuela-boost", async () => {
    mockMember = null;
    const { getByTestId } = render(<SettingsPage />, { wrapper: wrap });
    await flush();
    fireEvent.press(getByTestId("settings-section-appearance"));
    fireEvent.press(getByTestId("settings-boost-toggle"));
    expect(setItemMock().mock.calls.some(([k, v]) => k === "consuela-boost" && v === "1")).toBe(true);
  });

  it("all ten accent chips render and a pick persists consuela-accent", async () => {
    mockMember = null;
    const { getByTestId } = render(<SettingsPage />, { wrapper: wrap });
    await flush();
    fireEvent.press(getByTestId("settings-section-appearance"));
    const names = Object.keys(ACCENTS.dark);
    expect(names.length).toBe(10);
    for (const a of names) expect(getByTestId(`settings-accent-${a}`)).toBeTruthy();
    fireEvent.press(getByTestId("settings-accent-rose"));
    expect(setItemMock().mock.calls.some(([k, v]) => k === "consuela-accent" && v === "rose")).toBe(true);
  });
});

describe("SettingsPage — Safety", () => {
  it("reads the family emergency contacts with the editing-deferred note", async () => {
    route({ "/api/emergency-contacts": CONTACTS_LIVE });
    const { getByTestId, findByText, getByText } = render(<SettingsPage />, { wrapper: wrap });
    fireEvent.press(getByTestId("settings-section-safety"));
    expect(await findByText("Rebecca (Mom)")).toBeTruthy();
    expect(getByText("Alex")).toBeTruthy();
    expect(getByText("Contacts are managed by a parent on the phone app.")).toBeTruthy();
  });

  it("a cache answer carries the honest cache badge", async () => {
    route({ "/api/emergency-contacts": CONTACTS_CACHE });
    const { getByTestId, findByText } = render(<SettingsPage />, { wrapper: wrap });
    fireEvent.press(getByTestId("settings-section-safety"));
    expect(
      await findByText("Live emergency contacts are unavailable — showing this device's saved list.")
    ).toBeTruthy();
  });

  it("empty contacts get the honest empty state — never a fabricated list", async () => {
    route({ "/api/emergency-contacts": { contacts: [], contactsSource: "live" } });
    const { getByTestId, findByText, getByText } = render(<SettingsPage />, { wrapper: wrap });
    fireEvent.press(getByTestId("settings-section-safety"));
    expect(await findByText("No emergency contacts yet")).toBeTruthy();
    expect(getByText("Ask a parent to add or manage emergency contacts.")).toBeTruthy();
  });

  it("a failed read is honest, with no contacts invented", async () => {
    route({
      "/api/emergency-contacts": new ApiError({ message: "contacts_unavailable", status: 503, code: "contacts_unavailable" }),
    });
    const { getByTestId, findByText } = render(<SettingsPage />, { wrapper: wrap });
    fireEvent.press(getByTestId("settings-section-safety"));
    expect(await findByText("Couldn't load your emergency contacts right now.")).toBeTruthy();
  });

  it("guest Safety shows the sign-in gate and never fires the doomed fetch", async () => {
    mockMember = null;
    const { getByTestId, findByText } = render(<SettingsPage />, { wrapper: wrap });
    fireEvent.press(getByTestId("settings-section-safety"));
    expect(await findByText("Sign in with your PIN to see the family's emergency contacts.")).toBeTruthy();
    expect(api).not.toHaveBeenCalled();
  });
});

describe("SettingsPage — deferred sections (parent)", () => {
  it("Family, Home and Connections & System render the honest deferral copy", async () => {
    const { getByTestId, findByText, queryByText } = render(<SettingsPage />, { wrapper: wrap });
    for (const id of ["family", "home", "system"]) {
      fireEvent.press(getByTestId(`settings-section-${id}`));
      expect(await findByText("Settings for the whole family arrive with the full settings wave.")).toBeTruthy();
      fireEvent.press(getByTestId("settings-back"));
      expect(queryByText("Settings for the whole family arrive with the full settings wave.")).toBeNull();
    }
  });
});

describe("SettingsPage — page states", () => {
  it("stale badge when the sync layer reports staleness", async () => {
    mockStale = true;
    const { getByTestId } = render(<SettingsPage />, { wrapper: wrap });
    await flush();
    expect(getByTestId("settings-stale")).toBeTruthy();
    expect(getByTestId("settings-stale").props.children).toBe("Showing your saved copy — couldn't refresh.");
  });

  it("before auth hydration the launcher waits with the honest checking state", async () => {
    mockHydrated = false;
    const { getByText, queryByTestId } = render(<SettingsPage />, { wrapper: wrap });
    await flush();
    expect(getByText("Checking your settings")).toBeTruthy();
    expect(getByText("One moment while we confirm who is using this screen.")).toBeTruthy();
    expect(queryByTestId("settings-section-safety")).toBeNull();
  });
});

describe("Settings route", () => {
  it("app/settings renders the page + the manifest dock with the Settings cap active and a working More sheet", async () => {
    route({ "/api/emergency-contacts": CONTACTS_LIVE });
    const { getByTestId, findByTestId } = render(<SettingsRoute />, { wrapper: wrap });
    expect(getByTestId("settings-route")).toBeTruthy();
    await findByTestId("settings-section-me");
    expect(getByTestId("dock-settings")).toBeTruthy();
    expect(getByTestId("dock-settings").props.accessibilityState?.selected).toBe(true);
    fireEvent.press(getByTestId("dock-more"));
    expect(await findByTestId("more-grocery")).toBeTruthy();
  });
});
