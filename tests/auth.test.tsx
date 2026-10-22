/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { act, renderHook } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  AuthProvider,
  useAuth,
  modeForMember,
  modeForRole,
  pinRequiredFor,
  INACTIVITY_TIMEOUT_MS,
  KID_INACTIVITY_TIMEOUT_MS,
  SESSION_WARN_MS,
  KID_SESSION_WARN_MS,
} from "../src/state/AuthProvider";
import type { ServerMember } from "../src/api/types";
import { _resetSessionCookieCache } from "../src/api/session";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));
const mockSecureStore = jest.requireMock("expo-secure-store") as {
  getItemAsync: jest.Mock;
  setItemAsync: jest.Mock;
  deleteItemAsync: jest.Mock;
};

// Mock the api layer wholesale
jest.mock("../src/api/auth", () => ({
  login: jest.fn(),
  quickLogin: jest.fn(),
  logout: jest.fn(async () => {}),
  whoami: jest.fn(async () => null),
  verifyPin: jest.fn(),
}));
const authApi = jest.requireMock("../src/api/auth") as {
  login: jest.Mock;
  quickLogin: jest.Mock;
  logout: jest.Mock;
  whoami: jest.Mock;
};

const parent: ServerMember = {
  id: "p1",
  pbId: "p1",
  name: "Rebecca (Mom)",
  role: "parent",
  emoji: "🐱",
  color: "green",
};
const kid: ServerMember = {
  id: "k1",
  pbId: "k1",
  name: "Aurora",
  role: "child",
  emoji: "👧",
  color: "purple",
  age: 7,
};

const wrap = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

async function settleFor(result: any) {
  // chained async hydration (cookie → whoami → state) needs all pending ticks:
  await act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
  if (result.current.hydrated !== true) {
    await act(async () => {
      for (let i = 0; i < 50; i++) await Promise.resolve();
    });
  }
}

describe("mode derivation + PIN rules (web parity)", () => {
  it("modeForMember", () => {
    expect(modeForMember(null)).toBe("family");
    expect(modeForMember(parent)).toBe("adult");
    expect(modeForMember(kid)).toBe("kid");
  });
  it("modeForRole: the CAPABILITY decides the layout (null → family)", () => {
    expect(modeForRole(null)).toBe("family");
    expect(modeForRole("parent")).toBe("adult");
    expect(modeForRole("child")).toBe("kid");
    expect(modeForRole("pet")).toBe("kid");
  });
  it("pinRequiredFor: under-10 child PIN-free; 10+ and missing age → PIN", () => {
    expect(pinRequiredFor(kid)).toBe(false);
    expect(pinRequiredFor(parent)).toBe(true);
    expect(pinRequiredFor({ ...kid, age: 10 })).toBe(true);
    expect(pinRequiredFor({ ...kid, age: undefined })).toBe(true);
    expect(pinRequiredFor({ ...kid, role: "pet", age: 3 })).toBe(true);
  });
});

describe("AuthProvider", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    // Hydration reads the profile cache + session cookie — isolate both, or
    // one test's persisted profile leaks into the next test's cold start.
    await AsyncStorage.clear();
    _resetSessionCookieCache();
  });
  afterEach(() => jest.useRealTimers());

  it("hydrates to family mode with no session", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: wrap });
    await settleFor(result);
    expect(result.current.hydrated).toBe(true);
    expect(result.current.member).toBeNull();
    expect(result.current.mode).toBe("family");
  });

  it("hydrates a live session via whoami", async () => {
    mockSecureStore.getItemAsync.mockResolvedValueOnce("cookie");
    authApi.whoami.mockResolvedValueOnce(parent);
    const { result } = renderHook(() => useAuth(), { wrapper: wrap });
    await settleFor(result);
    expect(result.current.member?.name).toBe("Rebecca (Mom)");
    expect(result.current.mode).toBe("adult");
  });

  it("hydration arms the idle clock when whoami confirms a live session", async () => {
    mockSecureStore.getItemAsync.mockResolvedValueOnce("cookie");
    authApi.whoami.mockResolvedValueOnce(parent);
    const { result } = renderHook(() => useAuth(), { wrapper: wrap });
    await settleFor(result);
    expect(result.current.hydrated).toBe(true);
    act(() => jest.advanceTimersByTime(INACTIVITY_TIMEOUT_MS - SESSION_WARN_MS));
    expect(result.current.sessionWarn).toBe(true);
    act(() => jest.advanceTimersByTime(SESSION_WARN_MS));
    expect(result.current.member).toBeNull(); // expired → signed out
  });

  it("dead session (whoami null) → family mode", async () => {
    mockSecureStore.getItemAsync.mockResolvedValueOnce("cookie");
    authApi.whoami.mockResolvedValueOnce(null);
    const { result } = renderHook(() => useAuth(), { wrapper: wrap });
    await settleFor(result);
    expect(result.current.member).toBeNull();
  });

  it("whoami null + cached profile → cached display profile paints (capture fallback)", async () => {
    mockSecureStore.getItemAsync.mockResolvedValueOnce("cookie");
    authApi.whoami.mockResolvedValueOnce(null);
    await AsyncStorage.setItem("consuela-auth-user", JSON.stringify(parent));
    const { result } = renderHook(() => useAuth(), { wrapper: wrap });
    await settleFor(result);
    expect(result.current.hydrated).toBe(true);
    expect(result.current.member?.name).toBe("Rebecca (Mom)");
    // NEW CONTRACT (SP1.7): the cached profile DISPLAYS, it does not CAPABILITIZE.
    expect(result.current.role).toBeNull();
    expect(result.current.sessionVerified).toBe(false);
    expect(result.current.mode).toBe("family");
  });

  it("offline cold start (whoami rejects) + cached profile → cached profile paints", async () => {
    mockSecureStore.getItemAsync.mockResolvedValueOnce("cookie");
    authApi.whoami.mockRejectedValueOnce(new Error("network down"));
    await AsyncStorage.setItem("consuela-auth-user", JSON.stringify(kid));
    const { result } = renderHook(() => useAuth(), { wrapper: wrap });
    await settleFor(result);
    expect(result.current.hydrated).toBe(true);
    expect(result.current.member?.name).toBe("Aurora");
    // NEW CONTRACT (SP1.7): offline = no live session = no capability.
    expect(result.current.role).toBeNull();
    expect(result.current.sessionVerified).toBe(false);
    expect(result.current.mode).toBe("family");
  });

  it("no session cookie + cached profile → cached profile paints", async () => {
    await AsyncStorage.setItem("consuela-auth-user", JSON.stringify(parent));
    const { result } = renderHook(() => useAuth(), { wrapper: wrap });
    await settleFor(result);
    expect(result.current.hydrated).toBe(true);
    expect(result.current.member?.name).toBe("Rebecca (Mom)");
    // NEW CONTRACT (SP1.7): a cookie-less start = no live session = no capability.
    expect(result.current.role).toBeNull();
    expect(result.current.sessionVerified).toBe(false);
    expect(result.current.mode).toBe("family");
  });

  it("signIn with PIN → member + adult mode + profile persisted", async () => {
    authApi.login.mockResolvedValueOnce(parent);
    const { result } = renderHook(() => useAuth(), { wrapper: wrap });
    await settleFor(result);
    await act(async () => {
      await result.current.signIn("Rebecca (Mom)", "1234");
    });
    expect(authApi.login).toHaveBeenCalledWith("Rebecca (Mom)", "1234");
    expect(result.current.mode).toBe("adult");
    const stored = await AsyncStorage.getItem("consuela-auth-user");
    expect(stored && JSON.parse(stored).name).toBe("Rebecca (Mom)");
  });

  it("signIn without PIN (PIN-free kid) → quickLogin + kid mode", async () => {
    authApi.quickLogin.mockResolvedValueOnce(kid);
    const { result } = renderHook(() => useAuth(), { wrapper: wrap });
    await settleFor(result);
    await act(async () => {
      await result.current.signIn("Aurora");
    });
    expect(authApi.quickLogin).toHaveBeenCalledWith("Aurora");
    expect(result.current.mode).toBe("kid");
  });

  it("timer parity: parent warns at 30:00−30s and expires at 30:00", async () => {
    authApi.login.mockResolvedValueOnce(parent);
    const { result } = renderHook(() => useAuth(), { wrapper: wrap });
    await settleFor(result);
    await act(async () => {
      await result.current.signIn("Rebecca (Mom)", "1234");
    });
    const warnAt = INACTIVITY_TIMEOUT_MS - SESSION_WARN_MS;
    act(() => jest.advanceTimersByTime(warnAt));
    expect(result.current.sessionWarn).toBe(true);
    act(() => jest.advanceTimersByTime(SESSION_WARN_MS));
    expect(result.current.member).toBeNull(); // expired → signed out
  });

  it("timer parity: kid warns at 15:00−5:00 and expires at 15:00", async () => {
    authApi.quickLogin.mockResolvedValueOnce(kid);
    const { result } = renderHook(() => useAuth(), { wrapper: wrap });
    await settleFor(result);
    await act(async () => {
      await result.current.signIn("Aurora");
    });
    const warnAt = KID_INACTIVITY_TIMEOUT_MS - KID_SESSION_WARN_MS;
    act(() => jest.advanceTimersByTime(warnAt));
    expect(result.current.sessionWarn).toBe(true);
    act(() => jest.advanceTimersByTime(KID_SESSION_WARN_MS));
    expect(result.current.member).toBeNull();
  });

  it("poke() resets the idle clock", async () => {
    authApi.login.mockResolvedValueOnce(parent);
    const { result } = renderHook(() => useAuth(), { wrapper: wrap });
    await settleFor(result);
    await act(async () => {
      await result.current.signIn("Rebecca (Mom)", "1234");
    });
    act(() => jest.advanceTimersByTime(INACTIVITY_TIMEOUT_MS - 10_000));
    act(() => result.current.poke());
    act(() => jest.advanceTimersByTime(20_000)); // past the OLD deadline
    expect(result.current.member).not.toBeNull(); // still signed in
  });

  it("refreshIdentity re-arms the idle clock (a live identity read IS activity)", async () => {
    authApi.login.mockResolvedValueOnce(parent);
    const { result } = renderHook(() => useAuth(), { wrapper: wrap });
    await settleFor(result);
    await act(async () => {
      await result.current.signIn("Rebecca (Mom)", "1234");
    });
    act(() => jest.advanceTimersByTime(INACTIVITY_TIMEOUT_MS - 10_000));
    authApi.whoami.mockResolvedValueOnce(parent);
    await act(async () => {
      await result.current.refreshIdentity();
    });
    act(() => jest.advanceTimersByTime(20_000)); // past the OLD deadline
    expect(result.current.member).not.toBeNull(); // re-armed, still signed in
    expect(result.current.sessionWarn).toBe(false);
  });

  it("PINs NEVER touch a store (memory-only contract)", async () => {
    authApi.login.mockResolvedValueOnce(parent);
    const { result } = renderHook(() => useAuth(), { wrapper: wrap });
    await settleFor(result);
    await act(async () => {
      await result.current.signIn("Rebecca (Mom)", "9876");
    });
    for (const call of mockSecureStore.setItemAsync.mock.calls) {
      const [key, value] = call as [string, string];
      expect(String(value)).not.toContain("9876");
      expect(key).not.toMatch(/pin/i);
    }
    const allKeys = (AsyncStorage as any).__store
      ? Array.from((AsyncStorage as any).__store.keys())
      : [];
    for (const k of allKeys) expect(k).not.toMatch(/pin/i);
  });

  it("signOut clears member, profile, and calls the server logout", async () => {
    authApi.login.mockResolvedValueOnce(parent);
    const { result } = renderHook(() => useAuth(), { wrapper: wrap });
    await settleFor(result);
    await act(async () => {
      await result.current.signIn("Rebecca (Mom)", "1234");
    });
    await act(async () => {
      await result.current.signOut();
    });
    expect(result.current.member).toBeNull();
    expect(authApi.logout).toHaveBeenCalled();
    expect(await AsyncStorage.getItem("consuela-auth-user")).toBeNull();
  });
});

/**
 * SP1.7 — a role is a CAPABILITY, not a cached label. `member` is who the
 * panel last showed (display); `role` is what the viewer may do, and it is
 * non-null ONLY when a live whoami / sign-in confirmed the session.
 */
describe("capability role (a role is a capability, not a cached label)", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    await AsyncStorage.clear();
    _resetSessionCookieCache();
  });
  afterEach(() => jest.useRealTimers());

  it("a cached profile grants NO capability: role is null and the mode is family", async () => {
    // A PARENT profile cached, but no session cookie → no live session.
    await AsyncStorage.setItem("consuela-auth-user", JSON.stringify(parent));
    const { result } = renderHook(() => useAuth(), { wrapper: wrap });
    await settleFor(result);
    expect(result.current.hydrated).toBe(true);
    expect(result.current.member?.name).toBe("Rebecca (Mom)"); // display survives
    expect(result.current.role).toBeNull();
    expect(result.current.sessionVerified).toBe(false);
    expect(result.current.mode).toBe("family");
  });

  it("a live whoami grants the capability: role is the live role and the mode follows it", async () => {
    mockSecureStore.getItemAsync.mockResolvedValueOnce("cookie");
    authApi.whoami.mockResolvedValueOnce(parent);
    const { result } = renderHook(() => useAuth(), { wrapper: wrap });
    await settleFor(result);
    expect(result.current.member?.name).toBe("Rebecca (Mom)");
    expect(result.current.role).toBe("parent");
    expect(result.current.sessionVerified).toBe(true);
    expect(result.current.mode).toBe("adult");
  });

  it("a 401 from whoami drops the capability even when a profile is cached", async () => {
    mockSecureStore.getItemAsync.mockResolvedValueOnce("cookie");
    authApi.whoami.mockResolvedValueOnce(null); // 401 → the server says "no"
    await AsyncStorage.setItem("consuela-auth-user", JSON.stringify(parent));
    const { result } = renderHook(() => useAuth(), { wrapper: wrap });
    await settleFor(result);
    expect(result.current.member?.name).toBe("Rebecca (Mom)"); // display still paints
    expect(result.current.role).toBeNull();
    expect(result.current.sessionVerified).toBe(false);
    expect(result.current.mode).toBe("family");
  });

  it("signing out clears the capability", async () => {
    authApi.login.mockResolvedValueOnce(parent);
    const { result } = renderHook(() => useAuth(), { wrapper: wrap });
    await settleFor(result);
    await act(async () => {
      await result.current.signIn("Rebecca (Mom)", "1234");
    });
    expect(result.current.role).toBe("parent");
    expect(result.current.sessionVerified).toBe(true);
    expect(result.current.mode).toBe("adult");
    await act(async () => {
      await result.current.signOut();
    });
    expect(result.current.role).toBeNull();
    expect(result.current.sessionVerified).toBe(false);
    expect(result.current.mode).toBe("family");
  });
});
