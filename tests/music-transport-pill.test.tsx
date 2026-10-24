/**
 * THE TRANSPORT PILL — the Now Playing transport as one glass cluster
 * (SP3-B task 3).
 *
 * The pill is the Yuma-inspired grammar: shuffle · prev · a BIG circular
 * play/pause · next · repeat, in ONE translucent cluster, so the transport
 * reads as a single object instead of three loose rows.
 *
 * TWO CONTRACTS:
 *
 *   1. THE ACTIONS ARE THE OLD ONES. The pill is a RESTYLE, not a rewrite:
 *      every control fires the handler it always fired, under the same
 *      testID. A family that learned "the round button in the middle" keeps
 *      working.
 *   2. THE PILL IS OPAQUE. It sits over a backdrop whose colour is unknown
 *      (it is a cover), so only an opaque fill can GUARANTEE the glyphs'
 *      contrast over it — that is why the token family has a dedicated
 *      `glassStrong` for it.
 */
import React from "react";
import { StyleSheet } from "react-native";
import { fireEvent, render, renderHook } from "@testing-library/react-native";
import { TransportPill } from "../src/music/TransportPill";
import { ThemeProvider, useTheme } from "../src/theme/ThemeProvider";
import { musicTokensFor } from "../src/theme/music-tokens";
import type { RepeatMode } from "../src/music/types";

/* eslint-disable @typescript-eslint/no-require-imports -- the AsyncStorage mock's own idiom */
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
/* eslint-enable @typescript-eslint/no-require-imports */

const wrap = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

/** The tokens the app resolved — the theme is the device's, not a guess. */
const resolvedTokens = () => {
  const { theme, boost } = renderHook(() => useTheme(), { wrapper: wrap }).result.current;
  return musicTokensFor(theme, boost);
};

const onToggle = jest.fn();
const onNext = jest.fn();
const onPrevious = jest.fn();
const onToggleShuffle = jest.fn();
const onCycleRepeat = jest.fn();

function renderPill(overrides: Partial<React.ComponentProps<typeof TransportPill>> = {}) {
  return render(
    <TransportPill
      playing={false}
      repeat={"off" as RepeatMode}
      shuffle={false}
      onToggle={onToggle}
      onNext={onNext}
      onPrevious={onPrevious}
      onToggleShuffle={onToggleShuffle}
      onCycleRepeat={onCycleRepeat}
      {...overrides}
    />,
    { wrapper: wrap }
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("the transport pill", () => {
  it("holds the five controls, under the testIDs they always had", () => {
    const { getByTestId } = renderPill();
    for (const id of ["np-shuffle", "np-prev", "np-play", "np-next", "np-repeat"]) {
      expect(getByTestId(id)).toBeTruthy();
    }
  });

  it("fires the SAME actions the stage's rows fired", () => {
    const { getByTestId } = renderPill();
    fireEvent.press(getByTestId("np-play"));
    expect(onToggle).toHaveBeenCalledTimes(1);
    fireEvent.press(getByTestId("np-next"));
    expect(onNext).toHaveBeenCalledTimes(1);
    fireEvent.press(getByTestId("np-prev"));
    expect(onPrevious).toHaveBeenCalledTimes(1);
    fireEvent.press(getByTestId("np-shuffle"));
    expect(onToggleShuffle).toHaveBeenCalledTimes(1);
    fireEvent.press(getByTestId("np-repeat"));
    expect(onCycleRepeat).toHaveBeenCalledTimes(1);
  });

  it("the play glyph follows the playback, and so does its label", () => {
    const { getByTestId, rerender } = renderPill({ playing: false });
    expect(getByTestId("np-play").props.accessibilityLabel).toBe("Play");

    rerender(
      <TransportPill
        playing
        repeat={"off" as RepeatMode}
        shuffle={false}
        onToggle={onToggle}
        onNext={onNext}
        onPrevious={onPrevious}
        onToggleShuffle={onToggleShuffle}
        onCycleRepeat={onCycleRepeat}
      />
    );
    expect(getByTestId("np-play").props.accessibilityLabel).toBe("Pause");
  });

  it("is ONE pill: the opaque glass fill, the hairline rim, one row", () => {
    const { getByTestId } = renderPill();
    const tokens = resolvedTokens();
    const style = StyleSheet.flatten(getByTestId("np-transport-pill").props.style);
    // OPAQUE on purpose: the glyphs sit over a cover of unknown colour.
    expect(style.backgroundColor).toBe(tokens.glassStrong);
    expect(style.borderColor).toBe(tokens.glassRim);
    expect(style.flexDirection).toBe("row");
    // the cluster is a pill, not a card
    expect(style.borderRadius).toBeGreaterThanOrEqual(40);
  });

  it("the play disc is the big one, and it wears the accent", () => {
    const { getByTestId } = renderPill();
    const tokens = resolvedTokens();
    const play = StyleSheet.flatten(getByTestId("np-play").props.style);
    expect(play.width).toBe(88);
    expect(play.height).toBe(88);
    expect(play.borderRadius).toBe(44);
    expect(play.backgroundColor).toBe(tokens.accent);
  });

  it("every control is on the 64dp wall floor", () => {
    const { getByTestId } = renderPill();
    for (const id of ["np-shuffle", "np-prev", "np-play", "np-next", "np-repeat"]) {
      const style = StyleSheet.flatten(getByTestId(id).props.style);
      expect(Math.min(style.width, style.height)).toBeGreaterThanOrEqual(64);
    }
  });

  it("the state of shuffle and repeat is readable, never colour-only", () => {
    const { getByTestId } = renderPill({ shuffle: true, repeat: "all" as RepeatMode });
    expect(getByTestId("np-shuffle").props.accessibilityLabel).toBe("Shuffle on");
    expect(getByTestId("np-repeat").props.accessibilityLabel).toBe("Repeat all");
    expect(getByTestId("np-shuffle").props.accessibilityState).toEqual({ selected: true });
    expect(getByTestId("np-repeat").props.accessibilityState).toEqual({ selected: true });
  });
});
