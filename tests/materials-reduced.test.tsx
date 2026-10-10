/* eslint-disable @typescript-eslint/no-require-imports, import/first -- jest.mock factories hoist; mocks stay visibly on top */
jest.mock("../src/theme/perf", () => ({ perfTier: () => "reduced" }));

import { render } from "@testing-library/react-native";
import React from "react";
import { Text } from "react-native";
import { Material } from "../src/theme/Material";
import { ThemeProvider } from "../src/theme/ThemeProvider";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const wrap = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

describe("<Material> on reduced perf tier", () => {
  it("falls back to a baked tint (no BlurView / intensity in the tree)", () => {
    const { toJSON } = render(
      <Material tier="regular" testID="m">
        <Text>x</Text>
      </Material>,
      { wrapper: wrap }
    );
    const flat = JSON.stringify(toJSON());
    expect(flat).not.toContain("ExpoBlur");
    expect(flat).not.toContain('"intensity"');
    // jest env defaults to light theme: regular light bg alpha 0.6 → baked 0.95
    expect(flat).toContain("rgba(255,255,255,0.95)");
  });
});
