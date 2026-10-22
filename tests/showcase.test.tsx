/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { StyleSheet, Text } from "react-native";
import { render } from "@testing-library/react-native";

import DesignKitShowcase from "../app/_design";
import { ThemeProvider, useTheme } from "../src/theme/ThemeProvider";
import { SyncManager } from "../src/state/SyncManager";
import { ToastProvider } from "../src/ui/Toast";
import { ListRow } from "../src/ui/ListRow";
import { TOKENS, TYPOGRAPHY, ACCENTS } from "../src/theme/tokens";
import { MATERIALS } from "../src/theme/materials";
import { toRgb } from "../src/lib/contrast";

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
    role: (mockAuthMember as any)?.role ?? null,
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

/** Same tree, pinned to dark: the section-band luminance ratio is measured
 *  against the dark canvas (the reference's own numbers come from its dark
 *  capture, and in light the ladder legitimately runs the other way). */
function ForceDark({ children }: { children: React.ReactNode }) {
  const { setTheme } = useTheme();
  React.useEffect(() => {
    setTheme("dark");
  }, [setTheme]);
  return <>{children}</>;
}

const wrapDark = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>
    <SyncManager>
      <ToastProvider>
        <ForceDark>{children}</ForceDark>
      </ToastProvider>
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
    for (const glyph of ["＋", "⚙️"]) {
      const ink = StyleSheet.flatten(getByText(glyph).props.style).color;
      expect(ink).toBeDefined();
      expect(String(ink).toLowerCase()).not.toBe("#000000");
    }
  });

  // D-1: the destructive glyph is a solid SVG, not the 🗑️ colour emoji — a
  // colour emoji ignores `color`, and its own light metal measured 3.10:1 on the
  // `#b72f47` disc no matter what ink IconButton resolved.
  it("D-1: the destructive specimen paints a solid glyph in primary-foreground ink", () => {
    const { UNSAFE_root } = render(<DesignKitShowcase />, { wrapper: wrap });
    const primary = TOKENS.light["color-primary-foreground"].toLowerCase();
    const paths = UNSAFE_root.findAll((n: any) => n.type === "Path");
    const strokes = paths.map((p) => p.props.stroke).filter(Boolean);
    expect(strokes.length).toBeGreaterThan(0);
    for (const s of new Set(strokes)) expect(String(s).toLowerCase()).toBe(primary);
    expect(UNSAFE_root.findAll((n: any) => n.type === "Text" && n.children?.includes?.("🗑️")).length).toBe(0);
  });

  it("L6: signed out, the gate shows a read-only affordance (and it is gone when signed in)", () => {
    mockAuthMember = null;
    const signedOut = render(<DesignKitShowcase />, { wrapper: wrap });
    expect(signedOut.getByTestId("showcase-guest-affordance")).toBeTruthy();
    expect(signedOut.getByText(/Signed out — read-only preview/)).toBeTruthy();

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

  // ── WS-0 round 3, finding 1: the Section card lost the reference's two-part
  // shape. The reference's section cards (reference/design-system/parent-dark
  // .png, measured) carry a LIGHTER header band (relY 0.0348 mean, peak 0.0379)
  // over the card body (0.0257), separated by a 1px rule at rgb(64,75,95). The
  // native Section was one flat `regular` with no tone and no rule, so its
  // header was 3% DARKER than its body and nothing divided them.
  describe("finding 1: the section card is a header band + body, divided by a hairline", () => {
    const DARK_TIER_FILLS = (["thin", "regular", "thick"] as const).map(
      (t) => MATERIALS.dark[t].background
    );

    /** Breadth-first, so the OUTERMOST material fill wins: the body's own tier
     *  paints before the header band nested inside it. */
    function tierFillUnder(root: any): string {
      const queue = [root];
      while (queue.length) {
        const cur = queue.shift();
        if (!cur || typeof cur !== "object") continue;
        const s = StyleSheet.flatten(cur.props?.style);
        if (s && s.position === "absolute" && typeof s.backgroundColor === "string") {
          const bc = String(s.backgroundColor);
          if (DARK_TIER_FILLS.includes(bc)) return bc;
        }
        const kids = Array.isArray(cur.children) ? cur.children : cur.children ? [cur.children] : [];
        queue.push(...kids);
      }
      throw new Error("no material tier fill found in subtree");
    }

    /** The caller's rule (the thick tier's shadow shell carries the testID; the
     *  border rides the inner clipping surface). */
    function ruleIn(root: any): Record<string, unknown> | null {
      const stack = [root];
      while (stack.length) {
        const cur = stack.pop();
        if (!cur || typeof cur !== "object") continue;
        const s = StyleSheet.flatten(cur.props?.style);
        if (s && s.borderBottomWidth === 1 && typeof s.borderBottomColor === "string") return s;
        const kids = Array.isArray(cur.children) ? cur.children : cur.children ? [cur.children] : [];
        stack.push(...kids);
      }
      return null;
    }

    const relY = (c: [number, number, number]) => {
      const s = (v: number) => {
        const x = v / 255;
        return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * s(c[0]) + 0.7152 * s(c[1]) + 0.0722 * s(c[2]);
    };
    const over = (fill: string, bg: [number, number, number]): [number, number, number] => {
      const m = fill.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/i)!;
      const a = parseFloat(m[4]);
      return [0, 1, 2].map((i) => +m[i + 1] * a + bg[i] * (1 - a)) as [number, number, number];
    };

    it("EVERY section card has a header band and a body (nothing is flat any more)", () => {
      const { getAllByTestId } = render(<DesignKitShowcase />, { wrapper: wrap });
      const headers = getAllByTestId("showcase-section-header");
      const bodies = getAllByTestId("showcase-section-body");
      expect(headers.length).toBeGreaterThanOrEqual(9);
      expect(bodies.length).toBe(headers.length);
    });

    it("the header band composites >= 1.4x the body's luminance in DARK", () => {
      const canvas = toRgb(TOKENS.dark["color-canvas"]);
      const { getAllByTestId } = render(<DesignKitShowcase />, { wrapper: wrapDark });
      const headerFill = tierFillUnder(getAllByTestId("showcase-section-header")[0]);
      const bodyFill = tierFillUnder(getAllByTestId("showcase-section-body")[0]);
      // the band is the ladder's top tier over the body's bottom tier
      expect(headerFill).toBe(MATERIALS.dark.thick.background);
      expect(bodyFill).toBe(MATERIALS.dark.thin.background);
      const headerY = relY(over(headerFill, canvas));
      const bodyY = relY(over(bodyFill, canvas));
      // reference band, for the record: header 0.0348 / body 0.0257
      expect(headerY / bodyY).toBeGreaterThanOrEqual(1.4);
      expect(headerY).toBeGreaterThan(bodyY);
    });

    it("every header carries a 1px rule beneath it", () => {
      const { getAllByTestId } = render(<DesignKitShowcase />, { wrapper: wrap });
      for (const h of getAllByTestId("showcase-section-header")) {
        const rule = ruleIn(h);
        expect(rule).toBeTruthy();
        expect(rule).toMatchObject({ borderBottomWidth: 1 });
      }
    });
  });

  // ── WS-0 round 3, finding 2: seven weekday chips wrapped into two ragged rows
  // (MON TUE WED THU FRI / SAT SUN) because the strip wrapped and the chips had
  // no width contract.
  describe("finding 2: the weekday strip is one baseline of seven chips", () => {
    it("the strip does not wrap and every chip takes an equal share of the row", () => {
      const { getByTestId, getAllByTestId } = render(<DesignKitShowcase />, { wrapper: wrap });
      expect(StyleSheet.flatten(getByTestId("specimen-week-strip").props.style)).toMatchObject({
        flexDirection: "row",
        flexWrap: "nowrap",
      });
      const chips = getAllByTestId("specimen-week-chip");
      expect(chips).toHaveLength(7);
      for (const chip of chips) {
        expect(StyleSheet.flatten(chip.props.style)).toMatchObject({
          flex: 1,
          minWidth: 0,
        });
      }
    });

    it("every chip label is one line (no chip grows the row and breaks the baseline)", () => {
      const { getAllByText } = render(<DesignKitShowcase />, { wrapper: wrap });
      for (const day of ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]) {
        const label = getAllByText(day);
        expect(label.length).toBeGreaterThan(0);
        expect(label[0].props.numberOfLines).toBe(1);
      }
    });
  });

  // ── WS-0 round 3, finding 10: reference parity for the accent swatches and the
  // headline stat. The reference paints swatches `linear-gradient(135deg,
  // accent.hex, accent.glow)` (design-system/page.tsx:194) and a GREEN gradient
  // hero figure with a soft glow; the native specimens were constant fills.
  describe("finding 10: swatches and the headline stat carry the reference's gradients", () => {
    it("every accent swatch is a 135deg hex->glow gradient, not a flat fill", () => {
      const { getAllByTestId } = render(<DesignKitShowcase />, { wrapper: wrap });
      const swatches = getAllByTestId("specimen-swatch-fill");
      expect(swatches).toHaveLength(Object.keys(ACCENTS.dark).length);
      for (const swatch of swatches) {
        expect(swatch.type).toBe("ExpoLinearGradient");
        expect(swatch.props.colors[0]).not.toBe(swatch.props.colors[1]); // a real two-stop ramp, not one colour twice
        expect(swatch.props.start).toEqual({ x: 0, y: 0 });
        expect(swatch.props.end).toEqual({ x: 1, y: 1 });
      }
    });

    it("the headline stat is a green gradient with a soft glow behind it", () => {
      const { getByTestId } = render(<DesignKitShowcase />, { wrapper: wrap });
      const stat = getByTestId("specimen-stat-fill");
      expect(stat.type).toBe("ExpoLinearGradient");
      expect(String(stat.props.colors[0])).not.toBe(String(stat.props.colors[1]));
      const glow = getByTestId("specimen-stat-glow");
      expect(typeof StyleSheet.flatten(glow.props.style).backgroundColor).toBe("string");
      expect(glow.props.style).toMatchObject({ position: "absolute" });
    });
  });
});
