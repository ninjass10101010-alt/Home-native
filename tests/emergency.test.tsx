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
const mockRouterBack = jest.fn();
const mockRouterReplace = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockRouterPush, back: mockRouterBack, replace: mockRouterReplace, canGoBack: () => true }),
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

const typePin = (getByLabelText: (id: string) => any, pin: string) => {
  for (const k of pin) fireEvent.press(getByLabelText(k));
};

const openSituation = (getByTestId: (id: string) => any, situation: string) =>
  fireEvent.press(getByTestId(`emergency-situation-${situation}`));

const pickAlertType = (getByTestId: (id: string) => any, type: string) =>
  fireEvent.press(getByTestId(`emergency-alert-type-${type}`));

beforeEach(() => {
  jest.clearAllMocks();
  mockMember = { id: "p1", name: "Rebecca (Mom)", role: "parent", emoji: "🐱", color: "green" };
  api.mockReset();
});

describe("EmergencyFlow — signed-out banner", () => {
  it("signed out → the amber saved-copy banner with a sign-in link that routes to the Home rail", async () => {
    mockMember = null;
    const { getByTestId, getByText, findByTestId } = render(<EmergencyFlow />, { wrapper: wrap });
    expect(await findByTestId("sync-status-banner")).toBeTruthy();
    expect(
      getByText("🔐 Signed out — showing your saved copy. Every change stays on this device until you sign in.")
    ).toBeTruthy();
    expect(getByText("Sign in with your PIN →")).toBeTruthy();
    fireEvent.press(getByTestId("sync-status-banner-signin"));
    expect(mockRouterPush).toHaveBeenCalledWith("/");
  });

  it("signed in → no banner", () => {
    route(CONTACTS_BODY);
    const { queryByTestId } = render(<EmergencyFlow />, { wrapper: wrap });
    expect(queryByTestId("sync-status-banner")).toBeNull();
  });
});

describe("EmergencyFlow — emergency header bar", () => {
  it("the emergency-tinted bar carries the title, subtitle, back-to-Home and the theme toggle", () => {
    route(CONTACTS_BODY);
    const { getByTestId, getByText } = render(<EmergencyFlow />, { wrapper: wrap });
    expect(getByText("Emergency")).toBeTruthy();
    expect(getByText("Urgent Contacts & Help")).toBeTruthy();
    fireEvent.press(getByTestId("emergency-back"));
    expect(mockRouterBack).toHaveBeenCalled();
    expect(getByTestId("emergency-theme-toggle")).toBeTruthy();
  });
});

describe("EmergencyFlow — common situations grid", () => {
  it("renders the web's exact Common Situations rows (2×2 grid)", () => {
    route(CONTACTS_BODY);
    const { getByTestId, getByText, getAllByText } = render(<EmergencyFlow />, { wrapper: wrap });
    expect(getByText("Common Situations")).toBeTruthy();
    expect(getByTestId("emergency-situation-minor")).toBeTruthy();
    expect(getByTestId("emergency-situation-lost")).toBeTruthy();
    expect(getByTestId("emergency-situation-lockout")).toBeTruthy();
    expect(getByTestId("emergency-situation-sick")).toBeTruthy();
    expect(getByText("Minor Injury")).toBeTruthy();
    expect(getByText("Small cuts, scrapes, or bruises")).toBeTruthy();
    expect(getByText("Lost Item")).toBeTruthy();
    expect(getByText("Lost keys, phone, or important item")).toBeTruthy();
    expect(getByText("Call home")).toBeTruthy();
    expect(getByText("Locked Out")).toBeTruthy();
    expect(getByText("Locked out of house or car")).toBeTruthy();
    expect(getByText("Not Feeling Well")).toBeTruthy();
    expect(getByText("Mild illness or discomfort")).toBeTruthy();
    expect(getAllByText("Mom or Dad").length).toBe(3);
  });

  it("tapping a situation row opens the PIN-gated alert flow (web order: PIN first)", async () => {
    route(CONTACTS_BODY);
    const { getByTestId, findByTestId } = render(<EmergencyFlow />, { wrapper: wrap });
    openSituation(getByTestId, "minor");
    expect(await findByTestId("emergency-modal")).toBeTruthy();
    expect(await findByTestId("emergency-pinpad")).toBeTruthy();
  });

  it("guests get the generic family identity in the pad and never fire the doomed fetch", async () => {
    mockMember = null;
    const { getByTestId, findByTestId, getByText } = render(<EmergencyFlow />, { wrapper: wrap });
    expect(api).not.toHaveBeenCalled();
    openSituation(getByTestId, "lockout");
    expect(await findByTestId("emergency-pinpad")).toBeTruthy();
    expect(getByText("Hi Family 👋")).toBeTruthy();
    expect(api).not.toHaveBeenCalled();
  });
});

describe("EmergencyFlow — alert flow (web order: PIN → type → send)", () => {
  it("wrong PIN → honest copy in the pad; the next entry starts fresh and can succeed", async () => {
    api.mockImplementation((path: string, init?: any) => {
      if (path.startsWith("/api/emergency-contacts")) return Promise.resolve(CONTACTS_BODY["/api/emergency-contacts"]);
      if (init?.body?.pin === "2222") return Promise.resolve(SUCCESS_BODY);
      return Promise.reject(new ApiError({ message: "Invalid PIN", status: 401, code: "Invalid PIN" }));
    });
    const { getByTestId, getByLabelText, findByText, findByTestId } = render(<EmergencyFlow />, { wrapper: wrap });
    openSituation(getByTestId, "minor");
    await findByText("Enter your 4-digit PIN");
    typePin(getByLabelText, "1111");
    // PIN entry advances to the type list (web order: PIN → type → send)
    expect(await findByTestId("emergency-alert-type-fire")).toBeTruthy();
    pickAlertType(getByTestId, "fire");
    // wrong PIN → back to the pad with the honest error
    expect(await findByText("Wrong PIN — try again.")).toBeTruthy();
    typePin(getByLabelText, "2222");
    expect(await findByTestId("emergency-alert-type-fire")).toBeTruthy();
    pickAlertType(getByTestId, "fire");
    expect(await findByText("Alert Sent")).toBeTruthy();
    const calls = api.mock.calls.filter((c: any[]) => c[0] === "/api/emergency");
    expect(calls[0][1]).toEqual({ method: "POST", body: { type: "fire", pin: "1111" } });
    // pin "2222" only verifies if the failed entry was cleared first
    expect(calls[1][1]).toEqual({ method: "POST", body: { type: "fire", pin: "2222" } });
  });

  it("success → calm checkmark screen, the server's message, house honesty, Done", async () => {
    route({ ...CONTACTS_BODY, "/api/emergency": SUCCESS_BODY });
    const { getByTestId, getByLabelText, findByText, getByText } = render(<EmergencyFlow />, { wrapper: wrap });
    openSituation(getByTestId, "minor");
    typePin(getByLabelText, "1234");
    pickAlertType(getByTestId, "water");
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
    openSituation(getByTestId, "sick");
    typePin(getByLabelText, "1234");
    pickAlertType(getByTestId, "injury");
    expect(await findByText("Alert Partially Sent")).toBeTruthy();
    expect(getByText("Alert partially delivered.")).toBeTruthy();
    expect(getByText("Only 1 of 2 contacts confirmed delivery.")).toBeTruthy();
    expect(getByText("House channels: 1 sent · 1 failed")).toBeTruthy();
    expect(getByText("SMS to one contact failed")).toBeTruthy();
  });

  // The route 502s ONLY when zero channels delivered (Home-ai emergency/route.ts
  // `if (!anyDelivered)`), so a 502 is a FAILURE whatever body.partial claims —
  // partial-success UI is reserved for 200s with partial:true.
  it("502 delivery_failed (partial:true in the body) → honest FAILURE, never a partial success", async () => {
    route({
      ...CONTACTS_BODY,
      "/api/emergency": new ApiError({
        message: "delivery_failed",
        status: 502,
        code: "delivery_failed",
        body: {
          ok: false,
          success: false,
          error: "delivery_failed",
          partial: true,
          message: "No emergency channel confirmed delivery.",
          warning: "All delivery channels failed.",
          contactsSource: "live",
          houseAlert: { sent: 0, failed: 1, notes: ["SMS gateway failed"] },
        },
      }),
    });
    const { getByTestId, getByLabelText, findByText, getByText, queryByText } = render(<EmergencyFlow />, {
      wrapper: wrap,
    });
    openSituation(getByTestId, "minor");
    typePin(getByLabelText, "1234");
    pickAlertType(getByTestId, "fire");
    expect(await findByText("Alert Failed")).toBeTruthy();
    expect(getByText("No emergency channel confirmed delivery.")).toBeTruthy();
    expect(queryByText("Alert Partially Sent")).toBeNull();
    expect(queryByText("Alert Sent")).toBeNull();
  });

  it("502 with only a code-shaped error → the ported copy-map sentence, never snake_case on screen", async () => {
    route({
      ...CONTACTS_BODY,
      "/api/emergency": new ApiError({
        message: "delivery_failed",
        status: 502,
        code: "delivery_failed",
        body: { error: "delivery_failed", partial: true },
      }),
    });
    const { getByTestId, getByLabelText, findByText } = render(<EmergencyFlow />, { wrapper: wrap });
    openSituation(getByTestId, "lost");
    typePin(getByLabelText, "1234");
    pickAlertType(getByTestId, "general");
    expect(
      await findByText("No emergency channel confirmed delivery. Please call emergency services directly.")
    ).toBeTruthy();
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
      openSituation(getByTestId, "sick");
      typePin(getByLabelText, "1234");
      pickAlertType(getByTestId, "injury");
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

  // Web parity (EmergencyButton EMERGENCY_ERROR_COPY): each 503 code gets its
  // own sentence + remediation — never one contacts-centric line for all three.
  it("503 contacts_unavailable → its own sentence + call-911 remediation", async () => {
    route({
      ...CONTACTS_BODY,
      "/api/emergency": new ApiError({
        message: "contacts_unavailable",
        status: 503,
        code: "contacts_unavailable",
        body: {
          ok: false,
          error: "contacts_unavailable",
          message: "Live emergency contacts are unavailable. No emergency alert was sent.",
        },
      }),
    });
    const { getByTestId, getByLabelText, findByText } = render(<EmergencyFlow />, { wrapper: wrap });
    openSituation(getByTestId, "minor");
    typePin(getByLabelText, "1234");
    pickAlertType(getByTestId, "fire");
    expect(
      await findByText(
        "Emergency contacts could not be read. No alert was sent — please call emergency services directly."
      )
    ).toBeTruthy();
  });

  it("503 pin_check_failed → its own sentence, not the contacts copy", async () => {
    route({
      ...CONTACTS_BODY,
      "/api/emergency": new ApiError({
        message: "pin_check_failed",
        status: 503,
        code: "pin_check_failed",
        body: { ok: false, error: "pin_check_failed" },
      }),
    });
    const { getByTestId, getByLabelText, findByText } = render(<EmergencyFlow />, { wrapper: wrap });
    openSituation(getByTestId, "lost");
    typePin(getByLabelText, "1234");
    pickAlertType(getByTestId, "water");
    expect(
      await findByText("Could not check the family PIN. Please try again or call emergency services directly.")
    ).toBeTruthy();
  });

  it("503 service_not_configured → its own sentence, not the contacts copy", async () => {
    route({
      ...CONTACTS_BODY,
      "/api/emergency": new ApiError({
        message: "service_not_configured",
        status: 503,
        code: "service_not_configured",
        body: {
          ok: false,
          error: "service_not_configured",
          message: "Emergency notification service is unavailable.",
        },
      }),
    });
    const { getByTestId, getByLabelText, findByText } = render(<EmergencyFlow />, { wrapper: wrap });
    openSituation(getByTestId, "sick");
    typePin(getByLabelText, "1234");
    pickAlertType(getByTestId, "injury");
    expect(
      await findByText("SMS and email are not configured for alerts. Please call emergency services directly.")
    ).toBeTruthy();
  });

  it("in-flight → honest already-sending copy with the wait-for-it remediation", async () => {
    route({
      ...CONTACTS_BODY,
      "/api/emergency": new ApiError({ message: "emergency_in_flight", status: 409, code: "emergency_in_flight" }),
    });
    const { getByTestId, getByLabelText, findByText } = render(<EmergencyFlow />, { wrapper: wrap });
    openSituation(getByTestId, "lost");
    typePin(getByLabelText, "1234");
    pickAlertType(getByTestId, "general");
    expect(
      await findByText("An emergency alert is already sending. Wait for it to finish before trying again.")
    ).toBeTruthy();
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
    openSituation(getByTestId, "lost");
    typePin(getByLabelText, "1234");
    pickAlertType(getByTestId, "water");
    expect(await findByText("Couldn't reach Consuela — check the connection and try again.")).toBeTruthy();
  });
});

describe("EmergencyFlow — contacts card", () => {
  it("signed out → the empty contacts card with the blue Open safety settings pill", async () => {
    mockMember = null;
    const { findByText, getByText, getByTestId } = render(<EmergencyFlow />, { wrapper: wrap });
    expect(await findByText("No emergency contacts yet")).toBeTruthy();
    expect(getByText("Ask a parent to add or manage emergency contacts.")).toBeTruthy();
    expect(getByTestId("emergency-contacts-safety")).toBeTruthy();
    fireEvent.press(getByTestId("emergency-contacts-safety"));
    expect(mockRouterPush).toHaveBeenCalledWith("/settings");
  });

  it("signed-in child with no contacts → the ask-a-parent copy", async () => {
    mockMember = { id: "c1", name: "Sam", role: "child", emoji: "🧒", color: "green" };
    route({ "/api/emergency-contacts": { contacts: [], contactsSource: "live" } });
    const { findByText, getByText } = render(<EmergencyFlow />, { wrapper: wrap });
    expect(await findByText("No emergency contacts yet")).toBeTruthy();
    expect(getByText("Ask a parent to add or manage emergency contacts.")).toBeTruthy();
  });

  it("parent with no contacts → the web's parent copy + Add contacts pill", async () => {
    route({ "/api/emergency-contacts": { contacts: [], contactsSource: "live" } });
    const { findByText, getByText } = render(<EmergencyFlow />, { wrapper: wrap });
    expect(await findByText("Add or manage emergency contacts to get started.")).toBeTruthy();
    expect(getByText("Add contacts")).toBeTruthy();
  });

  it("signed-in members see the family's emergency contacts", async () => {
    route(CONTACTS_BODY);
    const { findByText, getByText } = render(<EmergencyFlow />, { wrapper: wrap });
    expect(await findByText("Rebecca (Mom)")).toBeTruthy();
    expect(getByText("(555) 123-4567")).toBeTruthy();
    expect(getByText("Alex")).toBeTruthy();
    expect(getByText("(555) 987-6543")).toBeTruthy();
  });

  it("parent with contacts → the contacts list; the empty-state pill stays hidden (web parity)", async () => {
    route(CONTACTS_BODY);
    const { findByText, queryByText } = render(<EmergencyFlow />, { wrapper: wrap });
    expect(await findByText("Rebecca (Mom)")).toBeTruthy();
    expect(queryByText("Manage contacts")).toBeNull();
    expect(queryByText("No emergency contacts yet")).toBeNull();
  });

  it("contacts served from the device cache → honest stale badge over the list (web parity)", async () => {
    route({
      "/api/emergency-contacts": {
        contacts: CONTACTS_BODY["/api/emergency-contacts"].contacts,
        contactsSource: "cache",
      },
    });
    const { findByText, getByText } = render(<EmergencyFlow />, { wrapper: wrap });
    expect(
      await findByText("Live emergency contacts are unavailable — showing this device's saved list.")
    ).toBeTruthy();
    expect(getByText("Rebecca (Mom)")).toBeTruthy();
    expect(getByText("(555) 123-4567")).toBeTruthy();
  });

  it("signed-in but unreadable contacts → honest unavailable line, flow intact", async () => {
    route({
      "/api/emergency-contacts": new ApiError({ message: "unauthorized", status: 401, code: "http_401" }),
    });
    const { findByText, getByTestId } = render(<EmergencyFlow />, { wrapper: wrap });
    expect(await findByText("Couldn't load your emergency contacts right now.")).toBeTruthy();
    expect(getByTestId("emergency-situation-minor")).toBeTruthy();
  });
});

describe("EmergencyFlow — settings quick-link bar", () => {
  it("the Open safety settings bar sits below the grid and routes to Settings", async () => {
    mockMember = null;
    const { findByTestId, getByTestId } = render(<EmergencyFlow />, { wrapper: wrap });
    expect(await findByTestId("emergency-safety-bar")).toBeTruthy();
    fireEvent.press(getByTestId("emergency-safety-bar"));
    expect(mockRouterPush).toHaveBeenCalledWith("/settings");
  });

  it("parent → the bar reads Manage contacts in Safety (web label parity)", async () => {
    route(CONTACTS_BODY);
    const { findByText } = render(<EmergencyFlow />, { wrapper: wrap });
    expect(await findByText("Manage contacts in Safety")).toBeTruthy();
  });
});

describe("EmergencyFlow — stale-recipient honesty on the result screen", () => {
  it("200 success with contactsSource cache → amber stale-recipients warning (web parity)", async () => {
    route({
      ...CONTACTS_BODY,
      "/api/emergency": { ...SUCCESS_BODY, contactsSource: "cache" },
    });
    const { getByTestId, getByLabelText, findByText, getByText } = render(<EmergencyFlow />, { wrapper: wrap });
    openSituation(getByTestId, "lost");
    typePin(getByLabelText, "1234");
    pickAlertType(getByTestId, "general");
    expect(await findByText("Alert Sent")).toBeTruthy();
    expect(
      getByText("Warning: stale cached contacts were used. Recipients may be out of date; verify them before retrying.")
    ).toBeTruthy();
  });

  it("200 success with live contacts → no stale warning", async () => {
    route({
      ...CONTACTS_BODY,
      "/api/emergency": { ...SUCCESS_BODY, contactsSource: "live" },
    });
    const { getByTestId, getByLabelText, findByText, queryByText } = render(<EmergencyFlow />, { wrapper: wrap });
    openSituation(getByTestId, "lost");
    typePin(getByLabelText, "1234");
    pickAlertType(getByTestId, "general");
    expect(await findByText("Alert Sent")).toBeTruthy();
    expect(queryByText(/stale cached contacts were used/)).toBeNull();
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
