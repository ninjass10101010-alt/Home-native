/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import { api, _setFetchImpl } from "../src/api/client";
import {
  saveSessionCookie,
  loadSessionCookie,
  clearSessionCookie,
  getSessionCookie,
  readSetCookie,
  _resetSessionCookieCache,
} from "../src/api/session";
import { login, quickLogin, logout, whoami, verifyPin, PinRequired } from "../src/api/auth";
import {
  listMembersSmart,
  mergeMemberFallbacks,
  FALLBACK_MEMBERS,
} from "../src/api/members";
import { _resetBaseUrlCache } from "../src/api/config";
import { ServerMember } from "../src/api/types";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

const member: ServerMember = {
  id: "abc123def456ghi",
  pbId: "abc123def456ghi",
  name: "Rebecca (Mom)",
  role: "parent",
  emoji: "🐱",
  color: "green",
};

function mockRes(status: number, body: any, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    headers: { get: (n: string) => headers[n.toLowerCase()] ?? null },
  } as unknown as Response;
}

let calls: { url: string; init: any }[] = [];
function installFetch(handler: (url: string, init: any) => Response | Promise<Response> | never): void {
  calls = [];
  _setFetchImpl((async (url: any, init: any) => {
    calls.push({ url: String(url), init });
    return handler(String(url), init);
  }) as any);
}

beforeEach(() => {
  _resetSessionCookieCache();
  _resetBaseUrlCache();
  calls = [];
});
afterEach(() => jest.restoreAllMocks());

describe("api client", () => {
  it("injects the session cookie when stored", async () => {
    await saveSessionCookie("tok123");
    installFetch(() => mockRes(200, { ok: true }));
    await api("/api/auth/whoami");
    expect(calls[0].init.headers.Cookie).toBe("consuela_session=tok123");
  });

  it("401 {error:'unauthorized'} → ApiError code unauthorized, retryable false", async () => {
    installFetch(() => mockRes(401, { error: "unauthorized" }));
    await expect(api("/api/db/events")).rejects.toMatchObject({
      name: "ApiError",
      status: 401,
      code: "unauthorized",
      retryable: false,
    });
  });

  it("503 with retryable → retryable true", async () => {
    installFetch(() => mockRes(503, { error: "photos_unreachable" }));
    await expect(api("/api/photos")).rejects.toMatchObject({ code: "photos_unreachable", retryable: true });
  });

  it("network rejection → code unreachable (calm offline path)", async () => {
    installFetch(() => {
      throw new Error("ENOTFOUND");
    });
    await expect(api("/api/auth/whoami")).rejects.toMatchObject({ code: "unreachable", status: 0 });
  });

  it("200 with {ok:false, degraded:true} RESOLVES (body truth over status)", async () => {
    installFetch(() => mockRes(200, { ok: false, degraded: true, settings: {} }));
    const res: any = await api("/api/photos/settings");
    expect(res.degraded).toBe(true);
  });

  it("JSON content-type only when body present", async () => {
    installFetch(() => mockRes(200, {}));
    await api("/api/db/events");
    expect(calls[0].init.headers["Content-Type"]).toBeUndefined();
    await api("/api/db/events", { method: "POST", body: { a: 1 } });
    expect(calls[1].init.headers["Content-Type"]).toBe("application/json");
  });
});

describe("session cookie store", () => {
  it("readSetCookie extracts the consuela_session value", () => {
    const res = {
      headers: {
        get: (n: string) =>
          n === "set-cookie"
            ? "consuela_session=v1.payload.sig; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800"
            : null,
      },
    };
    expect(readSetCookie(res)).toBe("v1.payload.sig");
  });
  it("save/load/clear round-trip (SecureStore mocked)", async () => {
    await saveSessionCookie("abc");
    expect(getSessionCookie()).toBe("abc");
    expect(await loadSessionCookie()).toBe("abc");
    await clearSessionCookie();
    expect(getSessionCookie()).toBeNull();
  });
});

describe("auth flows", () => {
  it("login captures the cookie and returns the member", async () => {
    installFetch(() =>
      mockRes(200, { success: true, member }, {
        "set-cookie": "consuela_session=tok!; Path=/; HttpOnly",
      })
    );
    const m = await login("Rebecca (Mom)", "1234");
    expect(m.name).toBe("Rebecca (Mom)");
    expect(getSessionCookie()).toBe("tok!");
  });

  it("quickLogin 403 pin_required → PinRequired (fallback to PIN)", async () => {
    installFetch(() => mockRes(403, { error: "pin_required" }));
    await expect(quickLogin("Aurora")).rejects.toBeInstanceOf(PinRequired);
  });

  it("quickLogin success returns member + cookie", async () => {
    installFetch(() =>
      mockRes(200, { success: true, member: { ...member, name: "Aurora", role: "child" } }, {
        "set-cookie": "consuela_session=kid; Path=/",
      })
    );
    const m = await quickLogin("Aurora");
    expect(m.role).toBe("child");
  });

  it("whoami: 401 → null (signed out, NOT an error)", async () => {
    installFetch(() => mockRes(401, { error: "unauthorized" }));
    await expect(whoami()).resolves.toBeNull();
  });

  it("verifyPin: true on success, false on 401, throws on 500", async () => {
    installFetch(() => mockRes(200, { success: true, member }));
    await expect(verifyPin("Rebecca (Mom)", "1234")).resolves.toBe(true);
    installFetch(() => mockRes(401, { error: "Invalid PIN" }));
    await expect(verifyPin("Rebecca (Mom)", "9999")).resolves.toBe(false);
    installFetch(() => mockRes(500, { error: "Verification failed" }));
    await expect(verifyPin("Rebecca (Mom)", "1234")).rejects.toMatchObject({ status: 500 });
  });

  it("logout always clears the local cookie even if the call fails", async () => {
    await saveSessionCookie("tok");
    installFetch(() => {
      throw new Error("down");
    });
    await expect(logout()).rejects.toBeTruthy();
    expect(getSessionCookie()).toBeNull();
  });
});

describe("members roster", () => {
  it("live wins over cache; cache refreshed on success; source=live", async () => {
    installFetch(() => mockRes(200, { members: [member] }));
    const r = await listMembersSmart();
    expect(r.source).toBe("live");
    expect(r.members[0].name).toBe("Rebecca (Mom)");
    expect(r.members.length).toBe(9); // live + fallbacks merged
  });

  it("401 signed-out → cache or fallback, source honestly marked", async () => {
    installFetch(() => mockRes(401, { error: "unauthorized" }));
    const r = await listMembersSmart();
    expect(["cache", "fallback"]).toContain(r.source);
    expect(r.members.length).toBe(9);
  });

  it("mergeMemberFallbacks: live wins by first name, blanks dropped, string id gains pbId", () => {
    const merged = mergeMemberFallbacks([
      { id: "pb1", name: "Aurora", role: "child", emoji: "X" } as any,
      { id: "pb2", name: "  ", role: "child", emoji: "?" } as any,
    ]);
    expect(merged.find((m) => m.name.startsWith("Aurora"))!.emoji).toBe("X");
    expect(merged.find((m) => m.name.startsWith("Aurora"))!.pbId).toBe("pb1");
    expect(merged.some((m) => !m.name.trim())).toBe(false);
    expect(merged.length).toBe(9);
  });

  it("fallback rows carry NO credentials and no pins", () => {
    for (const f of FALLBACK_MEMBERS) {
      expect((f as any).pin).toBeUndefined();
      expect((f as any).accessCode).toBeUndefined();
    }
  });
});
