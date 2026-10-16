/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
/**
 * WS-0 critic round 2 — the atmosphere is a PIXEL contract, so these are pixel
 * maths: srgb alpha compositing exactly as RN/browsers do, then perceptual
 * measurement of the result (CIE lightness/chroma + WCAG relative luminance).
 *
 * Ground truth on disk:
 *   reference/design-system/parent-dark.png → bare `--color-canvas` canvas
 *     L* ≈ 5.0 / Y ≈ 0.0056, glass card Y ≈ 0.0169 (3.0×)
 *   reference/home/parent-dark.png → canvas L* 5.5–9.2, cards L* ≈ 19–21
 * The light reference set is a capture bug (the *light* PNGs are byte-identical
 * to the dark ones), so light is judged against Home-ai's globals.css tokens.
 */
import React from "react";
import { render } from "@testing-library/react-native";
import { Text } from "react-native";
import {
  ATMOSPHERE_BUDGET,
  Atmosphere,
  canvasComposite,
  resolveCanvasToken,
  type AtmospherePhase,
} from "../src/theme/Atmosphere";
import { Screen } from "../src/theme/Screen";
import { ThemeProvider, useTheme } from "../src/theme/ThemeProvider";
import { TOKENS } from "../src/theme/tokens";
import { contrastRatio, toRgb } from "../src/lib/contrast";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const wrap = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

function wrapTheme(theme: "light" | "dark") {
  return function Themed({ children }: { children: React.ReactNode }) {
    return (
      <ThemeProvider>
        <ForceTheme theme={theme}>{children}</ForceTheme>
      </ThemeProvider>
    );
  };
}
function ForceTheme({ theme, children }: { theme: "light" | "dark"; children: React.ReactNode }) {
  const { setTheme } = useTheme();
  React.useEffect(() => {
    setTheme(theme);
  }, [theme]);
  return <>{children}</>;
}

/** srgb `over` — what RN, CSS and the browser actually do (not linear-light). */
function over(fg: string, alpha: number, bg: [number, number, number]): [number, number, number] {
  const f = toRgb(fg);
  return [
    alpha * f[0] + (1 - alpha) * bg[0],
    alpha * f[1] + (1 - alpha) * bg[1],
    alpha * f[2] + (1 - alpha) * bg[2],
  ];
}

function lin(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
function Y(rgb: [number, number, number]): number {
  return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
}
function lstar(rgb: [number, number, number]): number {
  const y = Y(rgb);
  return y <= 216 / 24389 ? y * 24389 / 27 : 116 * Math.pow(y, 1 / 3) - 16;
}
/** CIE L*a*b* — chroma is the "saturated pastel block?" measure. */
function labChroma(rgb: [number, number, number]): number {
  const r = lin(rgb[0]), g = lin(rgb[1]), b = lin(rgb[2]);
  const X = 0.4124 * r + 0.3576 * g + 0.1805 * b;
  const Yv = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const Z = 0.0193 * r + 0.1192 * g + 0.9505 * b;
  const f = (t: number, n: number) => (t / n > 0.008856 ? Math.cbrt(t / n) : 7.787 * t + 16 / 116);
  const fx = f(X, 0.95047), fy = f(Yv, 1), fz = f(Z, 1.08883);
  return Math.sqrt(Math.pow(500 * (fx - fy), 2) + Math.pow(200 * (fy - fz), 2));
}

const hex = (c: [number, number, number]) =>
  "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

const PHASES: AtmospherePhase[] = ["dawn", "day", "dusk", "night"];

describe("HIGH 1 — the light canvas is neither saturated nor clock-dependent", () => {
  it("light resolves gradient-canvas-day at EVERY phase (the web never switches)", () => {
    for (const phase of PHASES) {
      expect(resolveCanvasToken("light", phase, TOKENS.light)).toBe(
        TOKENS.light["gradient-canvas-day"]
      );
    }
  });
  it("dark stays on gradient-canvas-night at every phase", () => {
    for (const phase of PHASES) {
      expect(resolveCanvasToken("dark", phase, TOKENS.dark)).toBe(
        TOKENS.dark["gradient-canvas-night"]
      );
    }
  });
  it("the budgeted light canvas stays near-neutral (chroma < 6) and within ~4 L* of glass", () => {
    const canvas = toRgb(canvasComposite("light", TOKENS.light, "day"));
    const card = over("#ffffff", 0.78, canvas); // --glass-tint-strong light
    expect(labChroma(canvas)).toBeLessThan(6);
    expect(Math.abs(lstar(card) - lstar(canvas))).toBeLessThanOrEqual(4.2);
    // the pre-fix dawn capture measured a pink/peach #d7c0eb block
    expect(hex(canvas).toLowerCase()).not.toBe("#d7c0eb");
  });
  it("light mounts no bloom layers (the web SCREEN-blends them; RN alpha muddies)", () => {
    expect(ATMOSPHERE_BUDGET.light.accent).toBe(0);
    expect(ATMOSPHERE_BUDGET.light.violet).toBe(0);
    const s = JSON.stringify(render(<Atmosphere />, { wrapper: wrapTheme("light") }).toJSON());
    expect(s).toContain("ExpoLinearGradient"); // the canvas gradient survives
    expect(s).not.toContain(TOKENS.light["color-accent-selected"]);
    expect(s).not.toContain(TOKENS.light["color-accent-violet"]);
  });
});

describe("CRITICAL 2 — dark cards read as glass plates ABOVE the canvas", () => {
  it("canvas ≤8 L* (reference 5.0–9.2) with glass ≥2.5× the canvas luminance", () => {
    const canvas = toRgb(canvasComposite("dark", TOKENS.dark, "night"));
    const card = over("#ffffff", 0.1, canvas); // glass-tint-strong dark = white @ 10%
    expect(lstar(canvas)).toBeLessThanOrEqual(8);
    expect(Y(card) / Y(canvas)).toBeGreaterThanOrEqual(2.5);
    // the pre-fix capture measured canvas #242957 (L* 18.6) OVER its own card
    expect(lstar(card)).toBeGreaterThan(lstar(canvas));
  });
  it("keeps depth: the budget never flattens the atmosphere to a bare canvas", () => {
    expect(ATMOSPHERE_BUDGET.dark.gradient).toBeGreaterThan(0.1);
    expect(ATMOSPHERE_BUDGET.dark.accent).toBeGreaterThan(0);
    expect(ATMOSPHERE_BUDGET.dark.violet).toBeGreaterThan(0);
    expect(canvasComposite("dark", TOKENS.dark, "night").toLowerCase()).not.toBe(
      TOKENS.dark["color-canvas"]
    );
  });
});

describe("HIGH 2 — canvas-borne ink clears AA on the composited canvas", () => {
  it("light ink ≥4.5:1 on the composited light canvas (was 4.31 on #dcc5e4)", () => {
    const canvas = hex(toRgb(canvasComposite("light", TOKENS.light, "day")));
    for (const ink of ["color-text-primary", "color-text-secondary", "color-text-muted"]) {
      expect(contrastRatio(TOKENS.light[ink], canvas)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("dark sub-primary ladder ≥4.5:1 on the composited dark canvas", () => {
    const canvas = hex(toRgb(canvasComposite("dark", TOKENS.dark, "night")));
    for (const ink of ["color-text-primary", "color-text-secondary", "color-text-muted"]) {
      expect(contrastRatio(TOKENS.dark[ink], canvas)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("Screen atmosphere switch", () => {
  it("mounts the atmosphere by default and skips it on the calibration surface", () => {
    const on = render(
      <Screen testID="s1">
        <Text>x</Text>
      </Screen>,
      { wrapper: wrap }
    );
    expect(on.getByTestId("atmosphere")).toBeTruthy();
    const off = render(
      <Screen testID="s2" atmosphere={false}>
        <Text>x</Text>
      </Screen>,
      { wrapper: wrap }
    );
    expect(off.queryByTestId("atmosphere")).toBeNull();
  });
});
