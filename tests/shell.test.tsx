/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { render } from "@testing-library/react-native";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { phaseForHour, stopsFromToken } from "../src/theme/Atmosphere";
import { Screen } from "../src/theme/Screen";
import { TOKENS } from "../src/theme/tokens";
import { Text } from "react-native";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const wrap = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

describe("atmosphere phase", () => {
  it("maps hours: dawn 5–11, day 11–17, dusk 17–21, night 21–5", () => {
    expect(phaseForHour(6)).toBe("dawn");
    expect(phaseForHour(13)).toBe("day");
    expect(phaseForHour(19)).toBe("dusk");
    expect(phaseForHour(23)).toBe("night");
    expect(phaseForHour(2)).toBe("night");
  });
});

describe("gradient token parsing", () => {
  it("parses the token gradient strings into 3 stops", () => {
    const dawn = TOKENS.dark["gradient-canvas-dawn"];
    const stops = stopsFromToken(dawn);
    expect(stops).toHaveLength(3);
    expect(stops![0]).toMatch(/^rgba/);
  });
  it("returns null on missing/malformed token", () => {
    expect(stopsFromToken(undefined)).toBeNull();
    expect(stopsFromToken("banana")).toBeNull();
  });
});

describe("Screen + Atmosphere", () => {
  it("renders canvas + gradient + children", () => {
    const { getByText, getByTestId, toJSON } = render(
      <Screen testID="screen">
        <Text>content</Text>
      </Screen>,
      { wrapper: wrap }
    );
    expect(getByText("content")).toBeTruthy();
    expect(getByTestId("atmosphere")).toBeTruthy();
    const s = JSON.stringify(toJSON());
    expect(s).toContain("ExpoLinearGradient");
  });
  it("canvas color comes from tokens, light AND dark", () => {
    expect(TOKENS.light["color-canvas"]).toBe("#f5f6fa");
    expect(TOKENS.dark["color-canvas"]).toBe("#0f1117");
  });
});
