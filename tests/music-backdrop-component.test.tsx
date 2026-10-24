/**
 * The living artwork backdrop's component contract (SP3-B Task 2).
 *
 * The pure maths is checked in tests/music-backdrop.test.ts. THIS file checks
 * the thing the maths cannot: what the wallpaper actually PAINTS, and what it
 * refuses to paint.
 *
 * FOUR RULES:
 *
 *   1. NO ARTWORK, NO WALLPAPER. The component renders nothing without a URI
 *      — an idle wall must cost nothing at all (not even a mounted layer).
 *   2. THE WALLPAPER IS THE ARTWORK'S OWN COLOUR. The tint is the artwork's
 *      dominant colour, veiled for legibility — not the app's accent, and
 *      never a made-up hue.
 *   3. THE DRIFT IS THE POSITION'S. The artwork is scaled and drifted by the
 *      pure maths, and a reduced-motion wall gets NO drift at all.
 *   4. THE GRAIN IS STATIC. A faint overlay, painted once — never animated.
 */
/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { Image, StyleSheet } from "react-native";
import { render } from "@testing-library/react-native";
import { MusicBackdrop } from "../src/music/MusicBackdrop";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { legibilityTint } from "../src/music/backdrop";
import { musicTokensFor } from "../src/theme/music-tokens";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const wrap = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

/** The blurred artwork the engine handed over. */
const BLURRED = "file:///data/cache/artwork-blur/abc123.jpg";

function renderBackdrop(props: Partial<React.ComponentProps<typeof MusicBackdrop>> = {}) {
  return render(
    <MusicBackdrop
      uri={BLURRED}
      dominantHex="#3B82F6"
      theme="dark"
      boost={false}
      positionMs={0}
      {...props}
    />,
    { wrapper: wrap }
  );
}

describe("MusicBackdrop", () => {
  it("renders nothing without an artwork — an idle wall costs nothing", () => {
    const { queryByTestId, toJSON } = renderBackdrop({ uri: null });
    expect(queryByTestId("music-backdrop")).toBeNull();
    expect(toJSON()).toBeNull();
  });

  it("paints the blurred artwork it was given", () => {
    const { getByTestId } = renderBackdrop();
    const image = getByTestId("music-backdrop-art").findByType(Image);
    expect(image.props.source).toEqual({ uri: BLURRED });
  });

  it("tints itself with the ARTWORK's own colour", () => {
    const { getByTestId } = renderBackdrop({ dominantHex: "#3B82F6" });
    const tint = StyleSheet.flatten(getByTestId("music-backdrop-tint").props.style);
    expect(tint.backgroundColor).toBe(legibilityTint("#3B82F6", "dark"));
  });

  it("the tint is the artwork's colour, not the app's accent", () => {
    const { getByTestId } = renderBackdrop({ dominantHex: "#FF2D55" });
    const tint = StyleSheet.flatten(getByTestId("music-backdrop-tint").props.style);
    expect(tint.backgroundColor).toBe(legibilityTint("#FF2D55", "dark"));
    expect(tint.backgroundColor).not.toBe(legibilityTint("#3B82F6", "dark"));
  });

  it("the grain is the theme's own STATIC overlay", () => {
    const { getByTestId } = renderBackdrop();
    const grain = StyleSheet.flatten(getByTestId("music-backdrop-grain").props.style);
    expect(grain.backgroundColor).toBe(musicTokensFor("dark", false).grain);
  });

  it("the drift is the position's: the artwork is scaled and moved", () => {
    const { getByTestId } = renderBackdrop({ positionMs: 10000 });
    const style = StyleSheet.flatten(getByTestId("music-backdrop-art").props.style);
    const transform = style.transform as { scale: number }[];
    // The cycle's midpoint: the artwork is 3% bigger (and it has drifted).
    expect(transform[0].scale).toBeCloseTo(1.03, 3);
    expect(transform).toHaveLength(3);
  });

  it("at the cycle's start the artwork sits still", () => {
    const { getByTestId } = renderBackdrop({ positionMs: 0 });
    const style = StyleSheet.flatten(getByTestId("music-backdrop-art").props.style);
    const transform = style.transform as { scale: number }[];
    expect(transform[0].scale).toBeCloseTo(1.0, 3);
  });
});
