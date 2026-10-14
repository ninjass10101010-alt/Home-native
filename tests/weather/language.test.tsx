// Home-native/tests/weather/language.test.tsx
/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { Text } from "react-native";
import { render } from "@testing-library/react-native";
import { ThemeProvider } from "../../src/theme/ThemeProvider";
import { WEATHER_MATERIAL, washPair, washInkToken, CONDITION_TONE, WX_LABEL } from "../../src/weather/language";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const wrap = ({ children }: { children: React.ReactNode }) => <ThemeProvider>{children}</ThemeProvider>;

describe("skin seam", () => {
  it("ships exactly one material", () => {
    expect(WEATHER_MATERIAL).toBe("monster");
  });
  it("wash pairs follow the web skin bands", () => {
    expect(washPair("clear")).toBe("clear");
    expect(washPair("partly")).toBe("clear");
    expect(washPair("cloudy")).toBe("day");
    expect(washPair("rain")).toBe("day");
    expect(washPair("fog")).toBe("day");
    expect(washPair("storm")).toBe("storm");
    expect(washPair("snow")).toBe("snow");
    expect(washPair("night")).toBe("night");
    expect(washPair("partly-night")).toBe("night");
  });
  it("wash ink flips to glint at night, dark ink by day", () => {
    expect(washInkToken("night")).toBe("color-monster-glint");
    expect(washInkToken("clear")).toBe("color-monster-ink-day");
    expect(washInkToken("storm")).toBe("color-monster-ink-day");
  });
  it("every condition has a tone", () => {
    for (const code of ["clear", "partly", "partly-night", "cloudy", "rain", "storm", "snow", "fog", "night"] as const) {
      expect(CONDITION_TONE[code]).toBeTruthy();
    }
  });
  it("WX_LABEL carries the rounded-skin register", () => {
    expect(WX_LABEL.fontFamily).toBe("Fredoka");
    render(<Text style={WX_LABEL}>NEXT 24 HOURS</Text>, { wrapper: wrap });
  });
});
