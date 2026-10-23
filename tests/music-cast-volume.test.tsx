/* eslint-disable @typescript-eslint/no-require-imports, import/first -- jest.mock factories run before the imports */
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

/** An idle cast surface: no target, no error, no work in flight. */
function idleCast() {
  return {
    state: "notConnected",
    devices: [],
    target: { id: "tv", name: "Living Room" },
    casting: true,
    playing: true,
    position: 0,
    duration: null,
    busy: false,
    error: null,
    volume: 0.5,
    muted: false,
    connect: jest.fn(async () => true),
    startCast: jest.fn(async () => {}),
    disconnect: jest.fn(async () => {}),
    play: jest.fn(async () => {}),
    pause: jest.fn(async () => {}),
    seek: jest.fn(async () => {}),
    advance: jest.fn(async () => {}),
    previous: jest.fn(async () => {}),
    adjustVolume: jest.fn(async () => {}),
    toggleMute: jest.fn(async () => {}),
  };
}

let mockCast: any;
jest.mock("../src/music/CastProvider", () => ({ useCast: () => mockCast }));

import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import { CastVolume } from "../src/music/CastVolume";
import { ThemeProvider } from "../src/theme/ThemeProvider";

const wrap = ({ children }: { children: React.ReactNode }) => <ThemeProvider>{children}</ThemeProvider>;

beforeEach(() => {
  mockCast = idleCast();
  jest.clearAllMocks();
});

it("the compact row renders the receiver's level as a percentage", () => {
  mockCast = { ...idleCast(), volume: 0.35 };
  const { getByTestId, getByText } = render(<CastVolume compact />, { wrapper: wrap });
  expect(getByTestId("stage-volume")).toBeTruthy();
  expect(getByTestId("stage-volume-percent")).toBeTruthy();
  expect(getByText("35%")).toBeTruthy();
});

it("the compact volume buttons nudge the receiver by two percent", async () => {
  const adjustVolume = jest.fn(async () => {});
  mockCast = { ...idleCast(), adjustVolume };
  const { getByTestId } = render(<CastVolume compact />, { wrapper: wrap });

  await act(async () => {
    fireEvent.press(getByTestId("stage-volume-down"));
  });
  expect(adjustVolume).toHaveBeenCalledWith(-0.02);

  await act(async () => {
    fireEvent.press(getByTestId("stage-volume-up"));
  });
  expect(adjustVolume).toHaveBeenCalledWith(0.02);
});

it("the compact mute button calls toggleMute and its label follows muted", async () => {
  const toggleMute = jest.fn(async () => {});
  mockCast = { ...idleCast(), muted: false, toggleMute };
  const { getByTestId, getByText, queryByText, rerender } = render(<CastVolume compact />, {
    wrapper: wrap,
  });
  expect(getByText("Mute")).toBeTruthy();
  expect(getByTestId("stage-volume-mute").props.accessibilityLabel).toBe("Mute cast device");
  expect(getByTestId("stage-volume-mute").props.accessibilityState.checked).toBe(false);

  await act(async () => {
    fireEvent.press(getByTestId("stage-volume-mute"));
  });
  expect(toggleMute).toHaveBeenCalledTimes(1);

  mockCast = { ...mockCast, muted: true };
  rerender(<CastVolume compact />);
  expect(getByText("Unmute")).toBeTruthy();
  expect(queryByText("Mute")).toBeNull();
  expect(getByTestId("stage-volume-mute").props.accessibilityLabel).toBe("Unmute cast device");
  expect(getByTestId("stage-volume-mute").props.accessibilityState.checked).toBe(true);
});
