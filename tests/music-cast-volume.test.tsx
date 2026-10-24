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
    setVolume: jest.fn(async () => {}),
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
  expect(getByTestId("stage-volume-bar")).toBeTruthy();
  expect(getByTestId("stage-volume-percent")).toBeTruthy();
  expect(getByTestId("stage-volume-bar").props.accessibilityRole).toBe("adjustable");
  expect(getByTestId("stage-volume-bar").props.accessibilityValue).toEqual({
    min: 0,
    max: 100,
    now: 35,
    text: "35%",
  });
  expect(getByText("35%")).toBeTruthy();
});

it("tapping the compact volume bar sets the receiver at the tapped fraction", async () => {
  const setVolume = jest.fn(async () => {});
  mockCast = { ...idleCast(), volume: 0.2, setVolume };
  const { getByTestId } = render(<CastVolume compact />, { wrapper: wrap });
  const bar = getByTestId("stage-volume-bar");
  fireEvent(bar, "layout", {
    nativeEvent: { layout: { width: 200, height: 64, x: 0, y: 0 } },
  });

  await act(async () => {
    fireEvent(bar, "responderGrant", { nativeEvent: { locationX: 100 } });
  });
  expect(setVolume).toHaveBeenCalledWith(0.5);
});

it("dragging the compact volume bar updates the receiver continuously", async () => {
  const setVolume = jest.fn(async () => {});
  mockCast = { ...idleCast(), volume: 0.2, setVolume };
  const { getByTestId } = render(<CastVolume compact />, { wrapper: wrap });
  const bar = getByTestId("stage-volume-bar");
  fireEvent(bar, "layout", {
    nativeEvent: { layout: { width: 200, height: 64, x: 0, y: 0 } },
  });

  await act(async () => {
    fireEvent(bar, "responderGrant", { nativeEvent: { locationX: 40 } });
  });
  expect(setVolume).toHaveBeenLastCalledWith(0.2);

  await act(async () => {
    fireEvent(bar, "responderMove", { nativeEvent: { locationX: 150 } });
  });
  expect(setVolume).toHaveBeenLastCalledWith(0.75);
});

it("the compact volume bar's accessibility actions nudge the receiver by two percent", async () => {
  const adjustVolume = jest.fn(async () => {});
  mockCast = { ...idleCast(), adjustVolume };
  const { getByTestId } = render(<CastVolume compact />, { wrapper: wrap });
  const bar = getByTestId("stage-volume-bar");

  await act(async () => {
    fireEvent(bar, "accessibilityAction", { nativeEvent: { actionName: "increment" } });
  });
  expect(adjustVolume).toHaveBeenCalledWith(0.02);

  await act(async () => {
    fireEvent(bar, "accessibilityAction", { nativeEvent: { actionName: "decrement" } });
  });
  expect(adjustVolume).toHaveBeenCalledWith(-0.02);
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
