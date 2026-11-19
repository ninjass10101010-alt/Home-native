import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { NotificationsCard } from "../src/settings/NotificationsCard";
import { resetNotificationPreferencesCache } from "../src/native/notificationPrefs";
import * as soundEffects from "../src/native/soundEffects";
import * as notifications from "../src/native/notifications";

let mockAuthRole: "parent" | "child" | "pet" | null = null;
const mockApi = jest.fn();

jest.mock("../src/state/AuthProvider", () => ({
  useAuth: () => ({
    member: null,
    role: mockAuthRole,
    sessionVerified: mockAuthRole !== null,
    mode: "family",
    hydrated: true,
    sessionWarn: false,
    pinRequiredFor: () => false,
    signIn: jest.fn(),
    signOut: jest.fn(),
    refreshIdentity: jest.fn(),
    poke: jest.fn(),
  }),
}));

jest.mock("../src/api/client", () => ({
  api: (...args: any[]) => mockApi(...args),
}));

jest.mock("@react-native-async-storage/async-storage", () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factory
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const wrap = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

describe("NotificationsCard", () => {
  let playSoundSpy: jest.SpyInstance;
  let dispatchNotifSpy: jest.SpyInstance;

  beforeEach(async () => {
    await AsyncStorage.clear();
    resetNotificationPreferencesCache();
    mockAuthRole = null;
    mockApi.mockReset();
    jest.clearAllMocks();
    playSoundSpy = jest
      .spyOn(soundEffects, "playNotificationSound")
      .mockImplementation(async () => {});
    dispatchNotifSpy = jest
      .spyOn(notifications, "dispatchNotification")
      .mockImplementation(async () => "test-id");
  });

  afterEach(() => {
    playSoundSpy.mockRestore();
    dispatchNotifSpy.mockRestore();
  });

  it("renders the 3 notification categories with default settings", async () => {
    const { getByTestId, findByText } = render(<NotificationsCard />, {
      wrapper: wrap,
    });

    expect(await findByText("NOTIFICATIONS & SOUNDS")).toBeTruthy();
    expect(getByTestId("notif-category-weather")).toBeTruthy();
    expect(getByTestId("notif-category-calendar")).toBeTruthy();
    expect(getByTestId("notif-category-routines")).toBeTruthy();
  });

  it("toggles a category off and hides its sound/volume controls", async () => {
    const { getByTestId, queryByTestId } = render(<NotificationsCard />, {
      wrapper: wrap,
    });

    expect(getByTestId("notif-preview-weather")).toBeTruthy();

    const toggle = getByTestId("notif-toggle-weather");
    await act(async () => {
      fireEvent.press(toggle);
    });

    await waitFor(() => {
      expect(queryByTestId("notif-preview-weather")).toBeNull();
    });
  });

  it("changes the alert sound and plays a preview", async () => {
    const { getByTestId } = render(<NotificationsCard />, { wrapper: wrap });

    const bellChip = getByTestId("notif-sound-calendar-bell");
    await act(async () => {
      fireEvent.press(bellChip);
    });

    expect(playSoundSpy).toHaveBeenCalledWith("bell", expect.any(Number));
  });

  it("adjusts volume level and plays preview at new volume", async () => {
    const { getByTestId } = render(<NotificationsCard />, {
      wrapper: wrap,
    });

    const vol50Btn = getByTestId("notif-vol-routines-50");
    await act(async () => {
      fireEvent.press(vol50Btn);
    });

    expect(playSoundSpy).toHaveBeenCalledWith(expect.any(String), 0.5);
    const display = getByTestId("notif-volume-display-routines");
    expect(display).toBeTruthy();
  });

  it("triggers a test notification when Send Test is pressed", async () => {
    const { getByTestId } = render(<NotificationsCard />, { wrapper: wrap });

    const testBtn = getByTestId("notif-test-calendar");
    await act(async () => {
      fireEvent.press(testBtn);
    });

    expect(dispatchNotifSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "calendar",
        title: expect.stringContaining("Calendar Reminder"),
      })
    );
  });

  it("switches timing stage and configures separate starting now tone", async () => {
    const { getByTestId, findAllByText } = render(<NotificationsCard />, {
      wrapper: wrap,
    });

    // Switch Calendar to "Starting Now" (first matching tab is calendar)
    const startTabs = await findAllByText("🔔 Starting Now");
    await act(async () => {
      fireEvent.press(startTabs[0]);
    });

    // Pick new tone option "beacon"
    const beaconChip = getByTestId("notif-sound-calendar-beacon");
    await act(async () => {
      fireEvent.press(beaconChip);
    });

    expect(playSoundSpy).toHaveBeenCalledWith("beacon", expect.any(Number));
  });

  it("renders the Quiet Hours card and toggles it off and on", async () => {
    const { getByTestId, queryByTestId, findByText } = render(<NotificationsCard />, {
      wrapper: wrap,
    });

    expect(await findByText("🌙 Quiet Hours (Do Not Disturb)")).toBeTruthy();
    expect(getByTestId("quiet-hours-card")).toBeTruthy();
    expect(getByTestId("quiet-hours-toggle")).toBeTruthy();
    expect(getByTestId("quiet-hours-start-selector")).toBeTruthy();
    expect(getByTestId("quiet-hours-end-selector")).toBeTruthy();

    // Toggle Quiet Hours off
    const toggle = getByTestId("quiet-hours-toggle");
    await act(async () => {
      fireEvent.press(toggle);
    });

    await waitFor(() => {
      expect(queryByTestId("quiet-hours-start-selector")).toBeNull();
      expect(queryByTestId("quiet-hours-end-selector")).toBeNull();
    });
  });

  it("switches routine timingMode to 15-Min Only and updates preference", async () => {
    const { findAllByText, findByText } = render(<NotificationsCard />, {
      wrapper: wrap,
    });

    const advanceOnlyButtons = await findAllByText("⏰ 15-Min Only");
    // Press routines timing mode (second occurrence)
    await act(async () => {
      fireEvent.press(advanceOnlyButtons[1]);
    });

    expect(await findByText(/Alerts once, 15 minutes before the scheduled time/)).toBeTruthy();
  });

  it("renders the Gentle Hours card with soft volume controls and test preview", async () => {
    const { getByTestId, queryByTestId, findByText } = render(<NotificationsCard />, {
      wrapper: wrap,
    });

    expect(
      await findByText("🌅 Gentle Hours (Morning & Evening Soft Volume)")
    ).toBeTruthy();
    expect(getByTestId("gentle-hours-card")).toBeTruthy();
    expect(getByTestId("gentle-hours-toggle")).toBeTruthy();
    expect(getByTestId("gentle-hours-volume-selector")).toBeTruthy();
    expect(getByTestId("gentle-hours-morning-selector")).toBeTruthy();
    expect(getByTestId("gentle-hours-evening-selector")).toBeTruthy();
    expect(getByTestId("gentle-hours-test-btn")).toBeTruthy();

    // Test volume preview sound
    const previewBtn = getByTestId("gentle-hours-test-btn");
    await act(async () => {
      fireEvent.press(previewBtn);
    });
    expect(playSoundSpy).toHaveBeenCalledWith("harp", 0.4);

    // Toggle Gentle Hours off
    const toggle = getByTestId("gentle-hours-toggle");
    await act(async () => {
      fireEvent.press(toggle);
    });

    await waitFor(() => {
      expect(queryByTestId("gentle-hours-volume-selector")).toBeNull();
      expect(queryByTestId("gentle-hours-morning-selector")).toBeNull();
      expect(queryByTestId("gentle-hours-evening-selector")).toBeNull();
    });
  });

  it("shows neutral guest copy in speaker broadcast card without fetching HA speakers when non-parent", async () => {
    mockAuthRole = null;
    const { getByTestId, queryByTestId } = render(<NotificationsCard />, {
      wrapper: wrap,
    });

    expect(getByTestId("speaker-broadcast-card")).toBeTruthy();
    expect(getByTestId("speaker-broadcast-guest-copy")).toBeTruthy();
    expect(queryByTestId("speaker-broadcast-toggle")).toBeNull();
    expect(mockApi).not.toHaveBeenCalled();
  });

  it("loads speakers for a parent, persists selection, and triggers test broadcast", async () => {
    mockAuthRole = "parent";
    mockApi.mockImplementation(async (path: string, init?: { method?: string; body?: unknown }) => {
      if (path === "/api/ha/speakers" && !init?.method) {
        return {
          ok: true,
          speakers: [
            {
              entityId: "media_player.downstairs_group",
              name: "Downstairs Group",
              state: "off",
              deviceClass: null,
              isGroup: true,
            },
            {
              entityId: "media_player.kitchen_speaker",
              name: "Kitchen speaker",
              state: "idle",
              deviceClass: "speaker",
              isGroup: false,
            },
          ],
          config: {
            enabled: false,
            entities: [],
            announceChat: true,
            announceRoutines: true,
            announceCalendar: true,
            announceWeather: true,
            volume: null,
          },
        };
      }
      if (path === "/api/ha/speakers" && init?.method === "POST") {
        expect(typeof init.body).toBe("object");
        return { ok: true, config: init.body };
      }
      if (path === "/api/ha/speakers/test" && init?.method === "POST") {
        expect(typeof init.body).toBe("object");
        return { ok: true, attempted: 1, delivered: 1, failed: 0, errors: [] };
      }
      return { ok: true };
    });

    const { getByTestId, findByTestId, findByText } = render(<NotificationsCard />, {
      wrapper: wrap,
    });

    expect(mockApi).toHaveBeenCalledWith("/api/ha/speakers");
    const toggle = await findByTestId("speaker-broadcast-toggle");

    await act(async () => {
      fireEvent.press(toggle);
    });

    expect(mockApi).toHaveBeenCalledWith("/api/ha/speakers", {
      method: "POST",
      body: expect.objectContaining({ enabled: true }),
    });

    const kitchenRow = await findByTestId("speaker-target-media_player.kitchen_speaker");
    expect(await findByText("Downstairs Group")).toBeTruthy();
    await act(async () => {
      fireEvent.press(kitchenRow);
    });

    const testBtn = getByTestId("speaker-broadcast-test");
    await act(async () => {
      fireEvent.press(testBtn);
    });

    expect(mockApi).toHaveBeenCalledWith("/api/ha/speakers/test", {
      method: "POST",
      body: { entities: ["media_player.kitchen_speaker"] },
    });
    expect(await findByText(/Sent test announcement to 1 speaker/)).toBeTruthy();
  });

  it("keeps speaker save error visible if enabling rolls back to disabled", async () => {
    mockAuthRole = "parent";
    mockApi.mockImplementation(async (path: string, init?: { method?: string }) => {
      if (path === "/api/ha/speakers" && !init?.method) {
        return {
          ok: true,
          speakers: [],
          config: {
            enabled: false,
            entities: [],
            announceChat: true,
            announceRoutines: true,
            announceCalendar: true,
            announceWeather: true,
            volume: null,
          },
        };
      }
      if (path === "/api/ha/speakers" && init?.method === "POST") {
        throw new Error("Could not reach server");
      }
      return { ok: true };
    });

    const { findByTestId } = render(<NotificationsCard />, { wrapper: wrap });
    const toggle = await findByTestId("speaker-broadcast-toggle");

    await act(async () => {
      fireEvent.press(toggle);
    });

    const status = await findByTestId("speaker-broadcast-status");
    expect(status.props.children).toBe("Could not reach server");
  });
});
