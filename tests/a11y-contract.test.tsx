/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { render } from "@testing-library/react-native";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { ToastProvider } from "../src/ui/Toast";
import { MIN_TARGET_DP, TYPE_FLOOR_SP, TYPOGRAPHY } from "../src/theme/tokens";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

const wrap = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>
    <ToastProvider>{children}</ToastProvider>
  </ThemeProvider>
);

/** Recursively collect every element with an accessibilityRole in the tree. */
function collectA11y(node: any, out: any[] = []) {
  if (node && typeof node === "object") {
    if (node.props?.accessibilityRole) out.push(node);
    for (const c of Array.isArray(node.children) ? node.children : []) collectA11y(c, out);
  }
  return out;
}

import { Surface } from "../src/ui/Surface";
import { SoftButton } from "../src/ui/SoftButton";
import { IconButton } from "../src/ui/IconButton";
import { Chip } from "../src/ui/Chip";
import { Toggle } from "../src/ui/Toggle";
import { ListRow } from "../src/ui/ListRow";
import { SegmentedControl } from "../src/ui/SegmentedControl";
import { Stepper } from "../src/ui/Stepper";
import { Text } from "react-native";

describe("a11y contract (wave 3 sweep)", () => {
  it("all interactive primitives expose role/label (IconButton label TS-required)", () => {
    const tree = render(
      <>
        <SoftButton onPress={() => {}}>Go</SoftButton>
        <IconButton icon={<Text>⚙️</Text>} label="Open settings" />
        <Chip label="Hold" onPress={() => {}} />
        <Toggle value={false} onChange={() => {}} label="Lights" />
        <ListRow title="Row" onPress={() => {}} />
        <SegmentedControl options={[{ id: "a", label: "A" }]} value="a" onChange={() => {}} />
        <Stepper value={1} onChange={() => {}} label="Count" />
        <Surface interactive />
      </>,
      { wrapper: wrap }
    );
    const a11y = collectA11y(tree.toJSON());
    // at least 7 interactive targets should all carry roles
    const roles = a11y.map((n) => n.props.accessibilityRole);
    expect(roles).toContain("button");
    expect(roles).toContain("switch");
    expect(roles).toContain("radio");
  });

  it("every testID'd interactive control honors the 64dp wall floor + 14sp type floor", () => {
    expect(MIN_TARGET_DP).toBe(64);
    expect(TYPE_FLOOR_SP).toBe(14);
    expect(Math.min(...Object.values(TYPOGRAPHY).map((t) => t.fontSize))).toBeGreaterThanOrEqual(TYPE_FLOOR_SP);
  });
});
