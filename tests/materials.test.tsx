/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import { render } from "@testing-library/react-native";
import React from "react";
import { Text } from "react-native";
import { MATERIALS, specularOpacity } from "../src/theme/materials";
import { Material } from "../src/theme/Material";
import { perfTier } from "../src/theme/perf";
import { ThemeProvider } from "../src/theme/ThemeProvider";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const wrap = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

describe("MATERIALS descriptors", () => {
  it("dark tiers match the contract table exactly", () => {
    expect(MATERIALS.dark.thin.background).toBe("rgba(30, 35, 48, 0.35)");
    expect(MATERIALS.dark.thin.blur).toBe(12);
    expect(MATERIALS.dark.regular.background).toBe("rgba(30, 35, 48, 0.45)");
    expect(MATERIALS.dark.regular.blur).toBe(20);
    expect(MATERIALS.dark.thick.background).toBe("rgba(30, 35, 48, 0.55)");
    expect(MATERIALS.dark.thick.blur).toBe(26);
    expect(MATERIALS.dark.thick.border).toBe("rgba(255, 255, 255, 0.12)");
  });
  it("light tiers match the contract table exactly", () => {
    expect(MATERIALS.light.thin.background).toBe("rgba(255, 255, 255, 0.4)");
    expect(MATERIALS.light.regular.background).toBe("rgba(255, 255, 255, 0.6)");
    expect(MATERIALS.light.thick.background).toBe("rgba(255, 255, 255, 0.8)");
    expect(MATERIALS.light.thin.border).toBe("rgba(0, 0, 0, 0.03)");
  });
  it("specular alphas per tier", () => {
    expect(specularOpacity("dark", "thin")).toBeCloseTo(0.04);
    expect(specularOpacity("dark", "regular")).toBeCloseTo(0.02);
    expect(specularOpacity("dark", "thick")).toBeCloseTo(0.07);
  });
});

describe("perfTier (injected params)", () => {
  it("reduced on old Android", () => {
    expect(perfTier(2, 30)).toBe("reduced");
  });
  it("reduced on very low density", () => {
    expect(perfTier(1.0, 35)).toBe("reduced");
  });
  it("full on the ApoloSign class (density ~1.33, Android 15)", () => {
    expect(perfTier(1.33, 35)).toBe("full");
  });
  it("non-Android is full at adequate density", () => {
    expect(perfTier(2, null)).toBe("full");
  });
});

describe("<Material>", () => {
  it("renders a BlurView mapped from css blur via intensity for tier thick (dark)", () => {
    const { toJSON } = render(
      <Material tier="thick" testID="m">
        <Text>x</Text>
      </Material>,
      { wrapper: wrap }
    );
    const json: any = toJSON();
    expect(json.props.testID).toBe("m");
    // BlurView is in the tree with our intensity (blur 26 → intensity 65)
    const flat = JSON.stringify(json);
    expect(flat).toContain('"intensity":65');
  });
});
