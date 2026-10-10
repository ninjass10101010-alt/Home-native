/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";

import { ThemeProvider } from "../src/theme/ThemeProvider";
import { ToastProvider } from "../src/ui/Toast";
import { EmergencyFlow } from "../src/emergency/EmergencyFlow";
import { HomeWall } from "../src/home/HomeWall";

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
  useRouter: () => ({ push: mockRouterPush }),
}));

let mockMember: any = { id: "p1", name: "Rebecca (Mom)", role: "parent", emoji: "🐱", color: "green" };
jest.mock("../src/state/AuthProvider", () => ({
  useAuth: () => ({ member: mockMember, hydrated: true, signOut: jest.fn(), poke: jest.fn() }),
}));

jest.mock("../src/api/client", () => ({
  api: jest.fn(),
  ApiError: jest.requireActual("../src/api/client").ApiError,
}));
const { api } = jest.requireMock("../src/api/client") as { api: jest.Mock };
const { ApiError } = jest.requireActual("../src/api/client") as { ApiError: any };

const wrap = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>
    <ToastProvider>{children}</ToastProvider>
  </ThemeProvider>
);

/**
 * Path-prefix router for the mocked api(). Insertion order matters:
 * /api/emergency-contacts MUST be listed before /api/emergency or the
 * prefix match swallows it.
 */
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

const CONTACTS_BODY = {
  "/api/emergency-contacts": {
    contacts: [
      { id: 1, name: "Rebecca (Mom)", phone: "+15551234567", email: "r@x.com", relationship: "parent", isPrimary: true, emoji: "🐱" },
      { id: 2, name: "Alex", phone: "+15559876543", email: "a@x.com", relationship: "parent", isPrimary: false, emoji: "🐉" },
    ],
    contactsSource: "live",
  },
};

const SUCCESS_BODY = {
  ok: true,
  success: true,
  partial: false,
  message: "Emergency alert sent to 2 contacts.",
  houseAlert: { sent: 2, failed: 0, notes: [] },
};

const selectType = (getByTestId: (id: string) => any, id: string) =>
  fireEvent.press(getByTestId(`emergency-type-${id}`));

const typePin = (getByLabelText: (id: string) => any, pin: string) => {
  for (const k of pin) fireEvent.press(getByLabelText(k));
};

beforeEach(() => {
  jest.clearAllMocks();
  mockMember = { id: "p1", name: "Rebecca (Mom)", role: "parent", emoji: "🐱", color: "green" };
  api.mockReset();
});

describe("EmergencyFlow — type select", () => {
  it("renders the four big type cards and opens the PinPad with the signed-in member", async () => {
    route(CONTACTS_BODY);
    const { getByTestId, getByText, findByTestId } = render(<EmergencyFlow />, { wrapper: wrap });
    expect(getByTestId("emergency-type-fire")).toBeTruthy();
    expect(getByTestId("emergency-type-water")).toBeTruthy();
    expect(getByTestId("emergency-type-injury")).toBeTruthy();
    expect(getByTestId("emergency-type-general")).toBeTruthy();
    expect(getByText("Fire")).toBeTruthy();
    expect(getByText("Water")).toBeTruthy();
    expect(getByText("Injury")).toBeTruthy();
    expect(getByText("General")).toBeTruthy();
    selectType(getByTestId, "fire");
    expect(await findByTestId("emergency-pinpad")).toBeTruthy();
    expect(getByText("Hi Rebecca 👋")).toBeTruthy();
  });

  it("guests get the PIN gate copy, no doomed fetch, and the generic family identity", async () => {
    mockMember = null;
    const { getByTestId, getByText, findByTestId } = render(<EmergencyFlow />, { wrapper: wrap });
    expect(getByText("Sign in with your PIN to see your emergency contacts.")).toBeTruthy();
    expect(api).not.toHaveBeenCalled();
    selectType(getByTestId, "general");
    expect(await findByTestId("emergency-pinpad")).toBeTruthy();
    expect(getByText("Hi Family 👋")).toBeTruthy();
  });
});

describe("EmergencyFlow — sending states", () => {
  it("wrong PIN → honest copy in the pad and the next entry starts fresh (input cleared)", async () => {
    api.mockImplementation((path: string, init?: any) => {
      if (path.startsWith("/api/emergency-contacts")) return Promise.resolve(CONTACTS_BODY["/api/emergency-contacts"]);
      if (init?.body?.pin === "2222") return Promise.resolve(SUCCESS_BODY);
      return Promise.reject(new ApiError({ message: "Invalid PIN", status: 401, code: "Invalid PIN" }));
    });
    const { getByTestId, getByLabelText, findByText, findByTestId } = render(<EmergencyFlow />, { wrapper: wrap });
    selectType(getByTestId, "fire");
    await findByTestId("emergency-pinpad");
    typePin(getByLabelText, "1111");
    expect(await findByText("Wrong PIN — try again.")).toBeTruthy();
    typePin(getByLabelText, "2222");
    expect(await findByText("Alert Sent")).toBeTruthy();
    const calls = api.mock.calls.filter((c: any[]) => c[0] === "/api/emergency");
    expect(calls[0][1]).toEqual({ method: "POST", body: { type: "fire", pin: "1111" } });
    // pin "2222" only verifies if the failed entry was cleared first
    expect(calls[1][1]).toEqual({ method: "POST", body: { type: "fire", pin: "2222" } });
  });

  it("success → calm checkmark screen, the server's message, house honesty, Done", async () => {
    route({ ...CONTACTS_BODY, "/api/emergency": SUCCESS_BODY });
    const { getByTestId, getByLabelText, findByText, getByText } = render(<EmergencyFlow />, { wrapper: wrap });
    selectType(getByTestId, "water");
    typePin(getByLabelText, "1234");
    expect(await findByText("Alert Sent")).toBeTruthy();
    expect(getByText("Emergency alert sent to 2 contacts.")).toBeTruthy();
    expect(getByText("House channels: 2 sent · 0 failed")).toBeTruthy();
    expect(getByText("If this is a life-threatening emergency, call 911.")).toBeTruthy();
    expect(getByTestId("emergency-done")).toBeTruthy();
  });

  it("partial delivery → honest partial title + the server's warning", async () => {
    route({
      ...CONTACTS_BODY,
      "/api/emergency": {
        ok: true,
        success: true,
        partial: true,
        warning: "Only 1 of 2 contacts confirmed delivery.",
        message: "Alert partially delivered.",
        houseAlert: { sent: 1, failed: 1, notes: ["SMS to one contact failed"] },
      },
    });
    const { getByTestId, getByLabelText, findByText, getByText } = render(<EmergencyFlow />, { wrapper: wrap });
    selectType(getByTestId, "injury");
    typePin(getByLabelText, "1234");
    expect(await findByText("Alert Partially Sent")).toBeTruthy();
    expect(getByText("Alert partially delivered.")).toBeTruthy();
    expect(getByText("Only 1 of 2 contacts confirmed delivery.")).toBeTruthy();
    expect(getByText("House channels: 1 sent · 1 failed")).toBeTruthy();
    expect(getByText("SMS to one contact failed")).toBeTruthy();
  });

  it("502 delivery_failed with partial:true → partial honesty, never silent success", async () => {
    route({
      ...CONTACTS_BODY,
      "/api/emergency": new ApiError({
        message: "delivery_failed",
        status: 502,
        code: "delivery_failed",
        body: { error: "delivery_failed", partial: true, message: "1 of 2 contacts confirmed — the rest failed." },
      }),
    });
    const { getByTestId, getByLabelText, findByText, getByText } = render(<EmergencyFlow />, { wrapper: wrap });
    selectType(getByTestId, "fire");
    typePin(getByLabelText, "1234");
    expect(await findByText("Alert Partially Sent")).toBeTruthy();
    expect(getByText("1 of 2 contacts confirmed — the rest failed.")).toBeTruthy();
  });

  it("cooldown → countdown disables Try again, then re-enables after the server's window", async () => {
    jest.useFakeTimers();
    try {
      route({
        ...CONTACTS_BODY,
        "/api/emergency": new ApiError({
          message: "emergency_cooldown",
          status: 429,
          code: "emergency_cooldown",
          body: { error: "emergency_cooldown", retryAfterMs: 5000 },
        }),
      });
      const { getByTestId, getByLabelText, findByText, findByTestId, getByText, queryByText } = render(<EmergencyFlow />, {
        wrapper: wrap,
      });
      selectType(getByTestId, "injury");
      typePin(getByLabelText, "1234");
      expect(await findByText("An emergency alert was sent recently. Wait a moment before trying again.")).toBeTruthy();
      expect(getByText("You can try again in 5 seconds.")).toBeTruthy();
      expect(getByTestId("emergency-retry").props.accessibilityState?.disabled).toBe(true);
      act(() => {
        jest.advanceTimersByTime(5_000);
      });
      expect(queryByText(/You can try again in/)).toBeNull();
      expect(getByTestId("emergency-retry").props.accessibilityState?.disabled).toBe(false);
      fireEvent.press(getByTestId("emergency-retry"));
      expect(await findByTestId("emergency-pinpad")).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  it("contacts_unavailable → the calm Settings→Safety copy", async () => {
    route({
      ...CONTACTS_BODY,
      "/api/emergency": new ApiError({ message: "contacts_unavailable", status: 503, code: "contacts_unavailable" }),
    });
    const { getByTestId, getByLabelText, findByText, getByTestId: g } = render(<EmergencyFlow />, { wrapper: wrap });
    selectType(getByTestId, "fire");
    typePin(getByLabelText, "1234");
    expect(
      await findByText("Couldn't reach the emergency contacts right now — check the Settings → Safety contacts.")
    ).toBeTruthy();
    expect(g("emergency-retry")).toBeTruthy();
  });

  it("in-flight → honest already-sending copy, retry stays open", async () => {
    route({
      ...CONTACTS_BODY,
      "/api/emergency": new ApiError({ message: "emergency_in_flight", status: 409, code: "emergency_in_flight" }),
    });
    const { getByTestId, getByLabelText, findByText } = render(<EmergencyFlow />, { wrapper: wrap });
    selectType(getByTestId, "general");
    typePin(getByLabelText, "1234");
    expect(await findByText("An alert is already sending…")).toBeTruthy();
    expect(getByTestId("emergency-retry").props.accessibilityState?.disabled).toBe(false);
  });

  it("LAN down → honest unreachable copy", async () => {
    route({
      ...CONTACTS_BODY,
      "/api/emergency": new ApiError({
        message: "Couldn't reach Consuela — check the connection",
        status: 0,
        code: "unreachable",
        retryable: true,
      }),
    });
    const { getByTestId, getByLabelText, findByText } = render(<EmergencyFlow />, { wrapper: wrap });
    selectType(getByTestId, "water");
    typePin(getByLabelText, "1234");
    expect(await findByText("Couldn't reach Consuela — check the connection and try again.")).toBeTruthy();
  });
});

describe("EmergencyFlow — contacts preview strip", () => {
  it("signed-in members see the family's emergency contacts", async () => {
    route(CONTACTS_BODY);
    const { findByText, getByText } = render(<EmergencyFlow />, { wrapper: wrap });
    expect(await findByText("Rebecca (Mom)")).toBeTruthy();
    expect(getByText("(555) 123-4567")).toBeTruthy();
    expect(getByText("Alex")).toBeTruthy();
    expect(getByText("(555) 987-6543")).toBeTruthy();
  });

  it("signed-in but unreadable contacts → honest unavailable line, flow intact", async () => {
    route({
      "/api/emergency-contacts": new ApiError({ message: "unauthorized", status: 401, code: "http_401" }),
    });
    const { findByText, getByTestId } = render(<EmergencyFlow />, { wrapper: wrap });
    expect(await findByText("Couldn't load your emergency contacts right now.")).toBeTruthy();
    expect(getByTestId("emergency-type-fire")).toBeTruthy();
  });
});

describe("EmergencyShield on the Home wall", () => {
  it("renders on HomeWall and navigates to /emergency on press", () => {
    const { getByTestId } = render(<HomeWall members={[]} onSelectMember={() => {}} />, { wrapper: wrap });
    const shield = getByTestId("emergency-shield");
    expect(shield).toBeTruthy();
    fireEvent.press(shield);
    expect(mockRouterPush).toHaveBeenCalledWith("/emergency");
  });
});
