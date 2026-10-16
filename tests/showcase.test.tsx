/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { StyleSheet, Text } from "react-native";
import { render } from "@testing-library/react-native";

import DesignKitShowcase from "../app/_design";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { SyncManager } from "../src/state/SyncManager";
import { ToastProvider } from "../src/ui/Toast";
import { ListRow } from "../src/ui/ListRow";
import { TYPOGRAPHY } from "../src/theme/tokens";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

let mockAuthMember: unknown = null;
jest.mock("../src/state/AuthProvider", () => ({
  useAuth: () => ({
    member: mockAuthMember,
    hydrated: true,
    signOut: jest.fn(async () => {}),
  }),
  AuthProvider: ({ children }: any) => children,
}));
jest.mock("../src/api/client", () => ({ api: jest.fn(async () => ({ snapshot: null })), ApiError: class extends Error {} }));

const wrap = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>
    <SyncManager>
      <ToastProvider>{children}</ToastProvider>
    </SyncManager>
  </ThemeProvider>
);

describe("design-kit showcase", () => {
  it("renders every section with floors intact", () => {
    const { getByText } = render(<DesignKitShowcase />, { wrapper: wrap });
    for (const s of [
      "Theme controls",
      "Controls",
      "Theme preview",
      "Inputs",
      "Lists",
      "Feedback",
      "Patterns",
      "Accents",
      "Type ramp",
    ]) {
      expect(getByText(s)).toBeTruthy();
    }
    // 10 accent chips (scoped: cyan/violet also exist as tone demos)
    const { getByTestId } = render(<DesignKitShowcase />, { wrapper: wrap });
    for (const a of ["nori", "violet", "rose", "cyan", "mint", "amber", "coral", "lavender", "apricot", "sage"]) {
      expect(getByTestId(`accent-chip-${a}`)).toBeTruthy();
    }
  });

  it("HIGH 4: masthead = eyebrow ABOVE a serif display title, debug caption demoted to a lede", () => {
    const { getByTestId } = render(<DesignKitShowcase />, { wrapper: wrap });
    const eyebrow = getByTestId("showcase-header-eyebrow");
    const title = getByTestId("showcase-header-title");
    const lede = getByTestId("showcase-header-lede");
    const e = StyleSheet.flatten(eyebrow.props.style);
    const t = StyleSheet.flatten(title.props.style);
    expect(e.textTransform).toBe("uppercase");
    expect(e.letterSpacing).toBeGreaterThan(2);
    expect(t.fontFamily).toBe("Instrument Serif");
    expect(t.fontWeight).toBe("400");
    // the debug caption is a lede (body register), NOT the masthead
    expect(StyleSheet.flatten(lede.props.style).fontSize).toBe(TYPOGRAPHY.body.fontSize);
    // ordering: eyebrow renders before the title inside the header
    const json = JSON.stringify(
      render(<DesignKitShowcase />, { wrapper: wrap }).toJSON()
    );
    expect(json.indexOf("showcase-header-eyebrow")).toBeLessThan(json.indexOf("showcase-header-title"));
  });

  it("CRITICAL 2: the calibration surface renders the BARE canvas token (no atmosphere)", () => {
    const { queryByTestId } = render(<DesignKitShowcase />, { wrapper: wrap });
    expect(queryByTestId("atmosphere")).toBeNull();
  });

  it("HIGH 5: two-column board at ≥840dp, one stacked column below it", () => {
    const RN = require("react-native") as typeof import("react-native");
    const spy = jest
      .spyOn(RN, "useWindowDimensions")
      .mockReturnValue({ width: 1080, height: 1920, scale: 1, fontScale: 1 });
    try {
      const wide = render(<DesignKitShowcase />, { wrapper: wrap });
      expect(wide.getByTestId("showcase-col-primary")).toBeTruthy();
      const primary = StyleSheet.flatten(wide.getByTestId("showcase-col-primary").props.style);
      const secondary = StyleSheet.flatten(wide.getByTestId("showcase-col-secondary").props.style);
      expect(primary.flex).toBe(58);
      expect(secondary.flex).toBe(42);
    } finally {
      spy.mockRestore();
    }
    const narrow = jest
      .spyOn(RN, "useWindowDimensions")
      .mockReturnValue({ width: 540, height: 960, scale: 2, fontScale: 1 });
    try {
      const wall = render(<DesignKitShowcase />, { wrapper: wrap });
      expect(wall.queryByTestId("showcase-col-primary")).toBeNull();
      expect(wall.getByTestId("showcase-columns")).toBeTruthy();
    } finally {
      narrow.mockRestore();
    }
  });

  it("L5: the Lists specimen chips are inert labels, not dead buttons", () => {
    const tree = render(<DesignKitShowcase />, { wrapper: wrap }).toJSON();
    const find = (node: any): any => {
      if (!node || typeof node !== "object") return null;
      if (node.props?.testID === "specimen-chips") return node;
      for (const child of node.children ?? []) {
        const hit = find(child);
        if (hit) return hit;
      }
      return null;
    };
    const json = JSON.stringify(find(tree));
    expect(json).not.toContain('"accessibilityRole":"button"');
    expect(json).not.toContain('"onPress"');
  });

  it("L3: the headline stat uses tabular figures", () => {
    const { getByTestId } = render(<DesignKitShowcase />, { wrapper: wrap });
    expect(StyleSheet.flatten(getByTestId("specimen-stat").props.style).fontVariant).toEqual([
      "tabular-nums",
    ]);
  });

  it("L4: ListRow seats `leading` in a 44dp tinted badge well", () => {
    const { getByTestId } = render(
      <ListRow testID="row" title="Pack backpack" leading={<Text>🎒</Text>} />,
      { wrapper: wrap }
    );
    const badge = StyleSheet.flatten(getByTestId("listrow-leading-badge").props.style);
    expect(badge.width).toBe(44);
    expect(badge.height).toBe(44);
    expect(badge.borderRadius).toBe(22);
    expect(badge.backgroundColor).toBeDefined();
    expect(badge.borderColor).toBeDefined();
  });

  it("CRITICAL 1: every showcase IconButton glyph carries an explicit ink", () => {
    const { getByText } = render(<DesignKitShowcase />, { wrapper: wrap });
    for (const glyph of ["＋", "⚙️", "🗑️"]) {
      const ink = StyleSheet.flatten(getByText(glyph).props.style).color;
      expect(ink).toBeDefined();
      expect(String(ink).toLowerCase()).not.toBe("#000000");
    }
  });

  it("L6: signed out, the gate shows a read-only affordance (and it is gone when signed in)", () => {
    mockAuthMember = null;
    const signedOut = render(<DesignKitShowcase />, { wrapper: wrap });
    expect(signedOut.getByTestId("showcase-guest-affordance")).toBeTruthy();
    expect(signedOut.getByText("Signed out — read-only preview")).toBeTruthy();

    mockAuthMember = {
      id: "mom",
      pbId: "mom",
      name: "Mom",
      role: "parent",
      emoji: "🐱",
      color: "gold",
      age: 38,
    };
    const signedIn = render(<DesignKitShowcase />, { wrapper: wrap });
    expect(signedIn.queryByTestId("showcase-guest-affordance")).toBeNull();
    mockAuthMember = null;
  });
});
