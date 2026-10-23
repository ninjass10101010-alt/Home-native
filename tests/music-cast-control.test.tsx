/* eslint-disable @typescript-eslint/no-require-imports, import/first -- jest.mock factories run before the imports */
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const mockConnect = jest.fn(async (_id: string) => true);
const mockStartCast = jest.fn(async (_track: any) => {});
const mockDisconnect = jest.fn(async () => {});

/** An idle cast surface: no target, no error, no work in flight. */
function idleCast() {
  return {
    state: "notConnected",
    devices: [
      { id: "tv", name: "Living Room" },
      { id: "speaker", name: "Kitchen Speaker" },
    ],
    target: null,
    casting: false,
    playing: false,
    position: 0,
    duration: null,
    busy: false,
    error: null,
    connect: mockConnect,
    startCast: mockStartCast,
    disconnect: mockDisconnect,
    play: jest.fn(async () => {}),
    pause: jest.fn(async () => {}),
    seek: jest.fn(async () => {}),
    advance: jest.fn(async () => {}),
    previous: jest.fn(async () => {}),
  };
}

let mockCast: any;
jest.mock("../src/music/CastProvider", () => ({ useCast: () => mockCast }));

import React from "react";
import { StyleSheet } from "react-native";
import { act, fireEvent, render, renderHook } from "@testing-library/react-native";
import { CastControl } from "../src/music/CastControl";
import { ThemeProvider, useTheme } from "../src/theme/ThemeProvider";
import { musicTokensFor } from "../src/theme/music-tokens";
import type { MediaTrack } from "../src/music/types";

const track: MediaTrack = {
  id: "v1",
  title: "Hello",
  artist: "Adele",
  album: "25",
  durationSeconds: 295,
  artworkUrl: null,
  explicit: false,
  source: "youtube_music",
};

const wrap = ({ children }: { children: React.ReactNode }) => <ThemeProvider>{children}</ThemeProvider>;

beforeEach(() => {
  mockCast = idleCast();
  jest.clearAllMocks();
});

it("the sheet lists devices and picking one connects then casts the current track", async () => {
  const { getByTestId, getByText } = render(<CastControl track={track} />, { wrapper: wrap });
  fireEvent.press(getByTestId("cast-open"));
  expect(getByText("Living Room")).toBeTruthy();
  expect(getByText("Kitchen Speaker")).toBeTruthy();

  await act(async () => {
    fireEvent.press(getByTestId("cast-device-tv"));
  });

  expect(mockConnect).toHaveBeenCalledWith("tv");
  expect(mockStartCast).toHaveBeenCalledWith(track);
  expect(mockConnect.mock.invocationCallOrder[0]).toBeLessThan(
    mockStartCast.mock.invocationCallOrder[0]
  );
});

it("a failed connect leaves its error visible and never starts a cast", async () => {
  mockConnect.mockImplementationOnce(async () => {
    mockCast = { ...mockCast, error: "Couldn't cast to Living Room." };
    return false;
  });
  const { getByTestId, getByText, rerender } = render(<CastControl track={track} />, { wrapper: wrap });
  fireEvent.press(getByTestId("cast-open"));

  await act(async () => {
    fireEvent.press(getByTestId("cast-device-tv"));
  });
  rerender(<CastControl track={track} />);

  expect(mockConnect).toHaveBeenCalledWith("tv");
  expect(mockStartCast).not.toHaveBeenCalled();
  expect(getByTestId("cast-error")).toBeTruthy();
  expect(getByText("Couldn't cast to Living Room.")).toBeTruthy();
});

it("a connected but idle session keeps a visible Stop and can be stopped", async () => {
  mockCast = {
    ...idleCast(),
    target: { id: "tv", name: "Living Room" },
    error: "Couldn't cast to Living Room.",
  };
  const { getByTestId, getByText } = render(<CastControl track={track} />, { wrapper: wrap });
  expect(getByText("Connected · Living Room")).toBeTruthy();

  fireEvent.press(getByTestId("cast-open"));
  expect(getByText("Connected")).toBeTruthy();
  expect(getByTestId("cast-stop")).toBeTruthy();

  await act(async () => {
    fireEvent.press(getByTestId("cast-stop"));
  });
  expect(mockDisconnect).toHaveBeenCalledTimes(1);
});

it("keeps the Stop affordance when connect succeeds but the load fails", async () => {
  mockConnect.mockImplementationOnce(async () => {
    mockCast = { ...mockCast, target: { id: "tv", name: "Living Room" } };
    return true;
  });
  mockStartCast.mockImplementationOnce(async () => {
    mockCast = { ...mockCast, error: "Couldn't cast to Living Room." };
  });
  const { getByTestId, getByText, rerender } = render(<CastControl track={track} />, { wrapper: wrap });
  fireEvent.press(getByTestId("cast-open"));

  await act(async () => {
    fireEvent.press(getByTestId("cast-device-tv"));
  });
  rerender(<CastControl track={track} />);

  expect(mockConnect).toHaveBeenCalledWith("tv");
  expect(mockStartCast).toHaveBeenCalledWith(track);
  expect(getByTestId("cast-error")).toBeTruthy();
  expect(getByText("Connected")).toBeTruthy();
  expect(getByTestId("cast-stop")).toBeTruthy();

  await act(async () => {
    fireEvent.press(getByTestId("cast-stop"));
  });
  expect(mockDisconnect).toHaveBeenCalledTimes(1);
});

it("no devices is an honest empty state, not a spinner forever", () => {
  mockCast = { ...idleCast(), devices: [] };
  const { getByTestId, getByText } = render(<CastControl track={track} />, { wrapper: wrap });
  fireEvent.press(getByTestId("cast-open"));
  expect(getByTestId("cast-empty")).toBeTruthy();
  expect(getByText("No cast devices found.")).toBeTruthy();
});

it("names a live-but-idle session on the capsule and in its a11y label", () => {
  mockCast = {
    ...idleCast(),
    target: { id: "tv", name: "Living Room" },
  };
  const { getByText, getByTestId } = render(<CastControl track={track} />, { wrapper: wrap });
  expect(getByText("Connected · Living Room")).toBeTruthy();
  expect(getByTestId("cast-open").props.accessibilityLabel).toBe(
    "Connected to Living Room. Change cast device"
  );
});

it("the capsule reads Cast while idle and Casting · <name> while casting", () => {
  const idle = render(<CastControl track={track} />, { wrapper: wrap });
  expect(idle.getByText("Cast")).toBeTruthy();
  idle.unmount();

  mockCast = {
    ...idleCast(),
    casting: true,
    target: { id: "tv", name: "Living Room" },
  };
  const casting = render(<CastControl track={track} />, { wrapper: wrap });
  expect(casting.getByText("Casting · Living Room")).toBeTruthy();
  expect(casting.getByTestId("cast-open").props.accessibilityLabel).toBe(
    "Casting to Living Room. Change cast device"
  );
});

it("stop casting calls disconnect", async () => {
  mockCast = {
    ...idleCast(),
    casting: true,
    target: { id: "tv", name: "Living Room" },
  };
  const { getByTestId } = render(<CastControl track={track} />, { wrapper: wrap });
  fireEvent.press(getByTestId("cast-open"));
  await act(async () => {
    fireEvent.press(getByTestId("cast-stop"));
  });
  expect(mockDisconnect).toHaveBeenCalledTimes(1);
});

it("renders the provider's error copy when the cast fails", () => {
  mockCast = { ...idleCast(), error: "Couldn't cast to Living Room." };
  const { getByTestId, getByText } = render(<CastControl track={track} />, { wrapper: wrap });
  fireEvent.press(getByTestId("cast-open"));
  expect(getByTestId("cast-error")).toBeTruthy();
  expect(getByText("Couldn't cast to Living Room.")).toBeTruthy();
});

it("propagates busy by disabling every action in the sheet", () => {
  mockCast = {
    ...idleCast(),
    casting: true,
    target: { id: "tv", name: "Living Room" },
    busy: true,
  };
  const { getByTestId } = render(<CastControl track={track} />, { wrapper: wrap });
  fireEvent.press(getByTestId("cast-open"));
  expect(getByTestId("cast-device-tv").props.accessibilityState?.disabled).toBe(true);
  expect(getByTestId("cast-device-speaker").props.accessibilityState?.disabled).toBe(true);
  expect(getByTestId("cast-stop").props.accessibilityState?.disabled).toBe(true);
});

it("pressing a disabled (busy) device row makes no call", async () => {
  mockCast = { ...idleCast(), busy: true };
  const { getByTestId } = render(<CastControl track={track} />, { wrapper: wrap });
  fireEvent.press(getByTestId("cast-open"));

  await act(async () => {
    fireEvent.press(getByTestId("cast-device-tv"));
  });

  expect(mockConnect).not.toHaveBeenCalled();
  expect(mockStartCast).not.toHaveBeenCalled();
});

it("the capsule is a 64dp wall-floor control on the Liquid tokens", () => {
  const { getByTestId } = render(<CastControl track={track} />, { wrapper: wrap });
  const { theme, boost } = renderHook(() => useTheme(), { wrapper: wrap }).result.current;
  const tokens = musicTokensFor(theme, boost);
  const style = StyleSheet.flatten(getByTestId("cast-open").props.style);
  expect(style.minHeight).toBeGreaterThanOrEqual(64);
  expect(style.backgroundColor).toBe(tokens.scrim);
  expect(style.borderColor).toBe(tokens.panelRim);
});
