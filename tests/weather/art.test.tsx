// Home-native/tests/weather/art.test.tsx
/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factory idiom */
import React from "react";
import { render } from "@testing-library/react-native";
import { ThemeProvider } from "../../src/theme/ThemeProvider";
import { TOKENS } from "../../src/theme/tokens";
import { mix } from "../../src/theme/mix";
import { MonsterDigit, ConditionIcon, MoonDisc, DIGIT_ASPECT } from "../../src/weather/art";
import type { ConditionCode } from "../../src/weather/language";

// ThemeProvider reads persisted prefs via AsyncStorage (native module absent in
// Jest) — same per-file mock as tests/theme-provider.test.tsx.
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const wrap = ({ children }: { children: React.ReactNode }) => <ThemeProvider>{children}</ThemeProvider>;
// The react-native-svg Jest mock is a function component rendering a host
// string, so each testID exists on both the composite and the host node —
// count host nodes only (same basis as the `n.type === "Line"` assertions).
const findAllByProp = (root: any, key: string, value: string) =>
  root.findAll((n: any) => typeof n.type === "string" && n.props[key] === value);

const INK = (name: string) => TOKENS.dark[`color-monster-${name}`] as string;

describe("MonsterDigit (web parity: WxToys.tsx:887-1044)", () => {
  it("aspect is the web viewBox ratio", () => {
    expect(DIGIT_ASPECT).toBeCloseTo(200 / 272, 5);
  });

  it("renders exactly the web's segments for '5' with pinned fills", () => {
    const { root } = render(<MonsterDigit digit="5" height={120} />, { wrapper: wrap });
    const expectSegment = (seg: string, ink: string) => {
      const nodes = findAllByProp(root, "testID", `wx-digit-segment-${seg}`);
      expect(nodes).toHaveLength(1);
      expect(nodes[0].props.fill).toBe(INK(ink));
    };
    expectSegment("top", "orange");
    expectSegment("upperLeft", "teal");
    expectSegment("middle", "purple");
    expectSegment("lowerRight", "red");
    expectSegment("bottom", "blue");
    expect(findAllByProp(root, "testID", "wx-digit-segment-upperRight")).toHaveLength(0);
  });

  it("every digit 0-9 renders with exactly one eye; '-' has none", () => {
    for (const d of "0123456789") {
      const { root } = render(<MonsterDigit digit={d} height={80} />, { wrapper: wrap });
      expect(findAllByProp(root, "testID", `wx-digit-${d}`)).toHaveLength(1);
      expect(findAllByProp(root, "testID", "wx-digit-eye")).toHaveLength(1);
    }
    const minus = render(<MonsterDigit digit="-" height={80} />, { wrapper: wrap });
    expect(findAllByProp(minus.root, "testID", "wx-digit-segment-middle")).toHaveLength(1);
    expect(findAllByProp(minus.root, "testID", "wx-digit-eye")).toHaveLength(0);
  });

  it("extrusion: depth rect offset +7/+9 with the 68/32 ink-blue mix (web 0.32 t)", () => {
    const { root } = render(<MonsterDigit digit="0" height={80} />, { wrapper: wrap });
    const depth = findAllByProp(root, "testID", "wx-digit-depth-top")[0];
    expect(depth.props.x).toBe(44 + 7);
    expect(depth.props.y).toBe(34 + 9);
    expect(depth.props.rx).toBe(12);
    expect(depth.props.fill).toBe(mix(INK("orange"), INK("ink-blue"), 68));
  });

  it("unknown characters fall back to text, never a blank glyph", () => {
    const { getByText } = render(<MonsterDigit digit="°" height={80} />, { wrapper: wrap });
    expect(getByText("°")).toBeTruthy();
  });
});

describe("ConditionIcon (web parity: WxToys.tsx:633-1130)", () => {
  it.each([
    "clear", "partly", "partly-night", "cloudy", "rain", "storm", "snow", "fog", "night",
  ] as ConditionCode[])("renders %s with its testID", (code) => {
    const { getByTestId } = render(<ConditionIcon code={code} size={120} />, { wrapper: wrap });
    expect(getByTestId(`wx-icon-${code}`)).toBeTruthy();
  });

  it("clear carries 16 rays (ink under-stroke + orange) + disc + knot + glint", () => {
    const { root } = render(<ConditionIcon code="clear" size={120} />, { wrapper: wrap });
    const lines = root.findAll((n: any) => n.type === "Line");
    expect(lines).toHaveLength(16);
    expect(root.findAll((n: any) => n.type === "Ellipse")).toHaveLength(1);
  });

  it("storm carries the bolt path and a glint-filled cloud", () => {
    const { root } = render(<ConditionIcon code="storm" size={120} />, { wrapper: wrap });
    const paths = root.findAll((n: any) => n.type === "Path");
    expect(paths.some((n: any) => String(n.props.d).startsWith("M55 50 L40 74"))).toBe(true);
  });
});

describe("MoonDisc (lit-limb parity: weather-astro moonLitPath)", () => {
  it("renders the disc + lit path", () => {
    const { root, getByTestId } = render(<MoonDisc phase={0.25} size={200} />, { wrapper: wrap });
    expect(getByTestId("wx-moon-disc")).toBeTruthy();
    const paths = root.findAll((n: any) => n.type === "Path");
    expect(paths.some((n: any) => String(n.props.d).includes("A 88 88"))).toBe(true);
  });
});
