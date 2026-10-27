import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { NotificationsCard } from "../src/settings/NotificationsCard";
import { resetNotificationPreferencesCache } from "../src/native/notificationPrefs";
import * as soundEffects from "../src/native/soundEffects";
import * as notifications from "../src/native/notifications";

jest.mock("@react-native-async-storage/async-storage", () =>
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
});
