import { AppState, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as notificationFeed from "../src/native/notificationFeed";
import { resetNotificationPreferencesCache } from "../src/native/notificationPrefs";
import {
  configureNotifications,
  dispatchNotification,
  forwardNotificationToSpeakers,
  resetNotificationsConfiguredForTests,
  resetRecentDispatchesCache,
  scheduleCategoryReminder,
} from "../src/native/notifications";
import * as soundEffects from "../src/native/soundEffects";
import * as voiceCallouts from "../src/native/voiceCallouts";
import { api } from "../src/api/client";

jest.mock("@react-native-async-storage/async-storage", () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factory
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

jest.mock("../src/api/client", () => ({
  api: jest.fn(async () => ({ ok: true })),
}));

describe("notifications foreground suppression & speaker forwarding", () => {
  const originalOS = Platform.OS;
  const originalAppState = AppState.currentState;
  let postSpy: jest.SpyInstance;
  let soundSpy: jest.SpyInstance;
  let audioSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    resetNotificationsConfiguredForTests();
    resetRecentDispatchesCache();
    resetNotificationPreferencesCache();
    Object.defineProperty(Platform, "OS", { value: "android", configurable: true });
    Object.defineProperty(AppState, "currentState", { value: "active", configurable: true });
    postSpy = jest.spyOn(notificationFeed, "postActiveNotification").mockImplementation(() => {});
    soundSpy = jest.spyOn(soundEffects, "playNotificationSound").mockResolvedValue();
    audioSpy = jest.spyOn(voiceCallouts, "playNotificationAudio").mockResolvedValue();
  });

  afterEach(() => {
    Object.defineProperty(Platform, "OS", { value: originalOS, configurable: true });
    Object.defineProperty(AppState, "currentState", { value: originalAppState, configurable: true });
    postSpy.mockRestore();
    soundSpy.mockRestore();
    audioSpy.mockRestore();
  });

  it("configureNotifications suppresses foreground OS banners, lists, and sounds", async () => {
    configureNotifications();

    expect(Notifications.setNotificationHandler).toHaveBeenCalledTimes(1);
    const handlerArg = (Notifications.setNotificationHandler as jest.Mock).mock.calls[0][0];
    const behavior = await handlerArg.handleNotification();

    expect(behavior).toEqual({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: false,
      shouldShowList: false,
    });
  });

  it("dispatchNotification posts in-app banner and skips OS shade when AppState is active", async () => {
    Object.defineProperty(AppState, "currentState", { value: "active", configurable: true });

    const id = await dispatchNotification({
      category: "routines",
      title: "Routine Starting",
      body: "\"Take Dogs Out!\" is starting now.",
      timing: "start",
    });

    expect(id).toBeTruthy();
    expect(postSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "routines",
        title: "Routine Starting",
        body: "\"Take Dogs Out!\" is starting now.",
      })
    );
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("dispatchNotification schedules Android OS notification with trigger.channelId when backgrounded", async () => {
    Object.defineProperty(AppState, "currentState", { value: "background", configurable: true });

    const id = await dispatchNotification({
      category: "routines",
      title: "Routine Starting",
      body: "\"Dinner Time\" is starting now.",
      timing: "start",
    });

    expect(id).toBe("id");
    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
      content: {
        title: "Routine Starting",
        body: "\"Dinner Time\" is starting now.",
        data: {},
        sound: false,
      },
      trigger: { channelId: "consuela-routines" },
    });
  });

  it("scheduleCategoryReminder places channelId on trigger for Android", async () => {
    const id = await scheduleCategoryReminder("calendar", "Calendar Event", "Soccer in 15 min", 900);
    expect(id).toBe("id");
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
      content: {
        title: "Calendar Event",
        body: "Soccer in 15 min",
        data: {},
        sound: true,
      },
      trigger: {
        type: "timeInterval",
        seconds: 900,
        repeats: false,
        channelId: "consuela-calendar",
      },
    });
  });

  it("forwardNotificationToSpeakers posts message, voiceKey, and skipTablet: true to /api/broadcast", async () => {
    await forwardNotificationToSpeakers({
      category: "routines",
      title: "Routine Starting",
      body: "Time to take the dogs out!",
      volume: 0.4,
    });

    expect(api).toHaveBeenCalledWith("/api/broadcast", {
      method: "POST",
      body: {
        message: "Time to take the dogs out!",
        title: "Routine Starting",
        category: "routines",
        voiceKey: "routine_dogs",
        volume: 0.4,
        skipTablet: true,
      },
    });
  });
});
