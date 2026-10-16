/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { render } from "@testing-library/react-native";
import { ThemeProvider, useTheme } from "../src/theme/ThemeProvider";
import { Atmosphere, phaseForHour, stopsFromToken } from "../src/theme/Atmosphere";
import { Screen } from "../src/theme/Screen";
import { TOKENS } from "../src/theme/tokens";
import { mix } from "../src/theme/mix";
import { Text } from "react-native";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const wrap = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

function ForceTheme({ theme, children }: { theme: "light" | "dark"; children: React.ReactNode }) {
  const { setTheme } = useTheme();
  React.useEffect(() => {
    setTheme(theme);
  }, [theme]);
  return <>{children}</>;
}

function wrapTheme(theme: "light" | "dark") {
  return function Themed({ children }: { children: React.ReactNode }) {
    return (
      <ThemeProvider>
        <ForceTheme theme={theme}>{children}</ForceTheme>
      </ThemeProvider>
    );
  };
}

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

  it("the violet bloom rides the top-right at the BUDGETED alpha (.warm-glass-canvas's second radial, ellipse 60% 40% at 85% 0%)", () => {
    // The web screen-blends its radials at 14% dark / 10% light; RN
    // alpha-composites them and that veil outranked the glass plates, so the
    // budget (tests/atmosphere.test.tsx) drops them to 2% dark / none in light.
    const dark = JSON.stringify(render(<Atmosphere />, { wrapper: wrapTheme("dark") }).toJSON());
    expect(dark).toContain(mix(TOKENS.dark["color-accent-violet"], "transparent", 2));
    expect(dark).toContain('"x":0.85'); // anchored top-right (85% horizontal)
    const light = JSON.stringify(render(<Atmosphere />, { wrapper: wrapTheme("light") }).toJSON());
    expect(light).not.toContain(TOKENS.light["color-accent-violet"]);
  });
});
