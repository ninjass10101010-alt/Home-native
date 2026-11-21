jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

import React from "react";
import { render, waitFor, act } from "@testing-library/react-native";
import { BroadcastReceiver } from "../src/native/useBroadcastReceiver";
import { api } from "../src/api/client";
import { playNotificationSound } from "../src/native/soundEffects";
import { postActiveNotification } from "../src/native/notificationFeed";
import { createAudioPlayer } from "expo-audio";

jest.mock("../src/api/client", () => ({
  api: jest.fn(),
}));

jest.mock("../src/native/soundEffects", () => ({
  playNotificationSound: jest.fn(async () => {}),
}));

jest.mock("../src/native/notificationFeed", () => ({
  postActiveNotification: jest.fn(),
}));

const mockPlay = jest.fn();
const mockRemove = jest.fn();
const mockPause = jest.fn();

jest.mock("expo-audio", () => ({
  createAudioPlayer: jest.fn((url: string) => ({
    url,
    play: mockPlay,
    remove: mockRemove,
    pause: mockPause,
  })),
}));

describe("BroadcastReceiver", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("polls for broadcasts and triggers chime, notification banner, and audio speech", async () => {
    let callCount = 0;
    (api as jest.Mock).mockImplementation(async (url: string) => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: true,
          broadcasts: [
            {
              id: "bc-1",
              message: "Dinner is ready, please come downstairs!",
              title: "Dinner Time 🍽️",
              audioUrl: "http://mock-ha:8123/api/tts_proxy/dinner.mp3",
            },
          ],
          latestId: "bc-1",
        };
      }
      // Hold subsequent poll
      return new Promise((resolve) => setTimeout(() => resolve({ ok: true, broadcasts: [] }), 500));
    });

    const { unmount } = render(<BroadcastReceiver />);

    await waitFor(() => {
      expect(playNotificationSound).toHaveBeenCalledWith("chime", 0.9);
      expect(postActiveNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "broadcast-bc-1",
          title: "Dinner Time 🍽️",
          body: "Dinner is ready, please come downstairs!",
          category: "general",
        })
      );
      expect(createAudioPlayer).toHaveBeenCalledWith(
        "http://mock-ha:8123/api/tts_proxy/dinner.mp3"
      );
      expect(mockPlay).toHaveBeenCalled();
    });

    unmount();
  });

  it("ignores duplicate broadcasts with the same id", async () => {
    let callCount = 0;
    (api as jest.Mock).mockImplementation(async () => {
      callCount++;
      if (callCount <= 2) {
        return {
          ok: true,
          broadcasts: [
            {
              id: "bc-dup",
              message: "Repeat message",
              audioUrl: "http://mock-ha:8123/api/tts_proxy/repeat.mp3",
            },
          ],
        };
      }
      return { ok: true, broadcasts: [] };
    });

    const { unmount } = render(<BroadcastReceiver />);

    await waitFor(() => {
      expect(postActiveNotification).toHaveBeenCalledTimes(1);
    });

    unmount();
  });

  it("shows a silent banner and skips tablet chime + TTS audio when muteAudio is true", async () => {
    let callCount = 0;
    (api as jest.Mock).mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: true,
          broadcasts: [
            {
              id: "bc-muted",
              message: "Girls, mom needs a favor!",
              title: "Family Announcement 📢",
              muteAudio: true,
            },
          ],
          latestId: "bc-muted",
        };
      }
      return new Promise((resolve) => setTimeout(() => resolve({ ok: true, broadcasts: [] }), 500));
    });

    const { unmount } = render(<BroadcastReceiver />);

    await waitFor(() => {
      expect(postActiveNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "broadcast-bc-muted",
          body: "Girls, mom needs a favor!",
        })
      );
    });

    expect(playNotificationSound).not.toHaveBeenCalled();
    expect(createAudioPlayer).not.toHaveBeenCalled();
    expect(mockPlay).not.toHaveBeenCalled();

    unmount();
  });
});
