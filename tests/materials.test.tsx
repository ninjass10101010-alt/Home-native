/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import { render } from "@testing-library/react-native";
import React from "react";
import { StyleSheet, Text } from "react-native";
import { MATERIALS, specularOpacity, SPECULAR_AT, type MaterialTier } from "../src/theme/materials";
import { Material } from "../src/theme/Material";
import { perfTier } from "../src/theme/perf";
import { ThemeProvider, useTheme } from "../src/theme/ThemeProvider";
import { TOKENS } from "../src/theme/tokens";
import { mix, parseColor } from "../src/theme/mix";
import { toRgb } from "../src/lib/contrast";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const wrap = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

function ForceTheme({ theme, boost = false, children }: { theme: "light" | "dark"; boost?: boolean; children: React.ReactNode }) {
  const { setTheme, setBoost } = useTheme();
  React.useEffect(() => {
    setTheme(theme);
    if (boost) setBoost(true);
  }, [theme, boost]);
  return <>{children}</>;
}

function wrapTheme(theme: "light" | "dark", boost = false) {
  return function Themed({ children }: { children: React.ReactNode }) {
    return (
      <ThemeProvider>
        <ForceTheme theme={theme} boost={boost}>
          {children}
        </ForceTheme>
      </ThemeProvider>
    );
  };
}

/** First node in the rendered tree whose flattened style satisfies `pred`. */
function findNodeByStyle(node: any, pred: (s: Record<string, unknown>) => boolean): any {
  const stack = [node];
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || typeof cur !== "object") continue;
    const flat = StyleSheet.flatten(cur.props?.style) as Record<string, unknown> | undefined | false;
    if (flat && typeof flat === "object" && pred(flat)) return cur;
    const kids = Array.isArray(cur.children) ? cur.children : cur.children ? [cur.children] : [];
    stack.push(...kids);
  }
  return null;
}

/** Every ExpoLinearGradient host node in the rendered tree. */
function gradientNodes(node: any): any[] {
  const out: any[] = [];
  const stack = [node];
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || typeof cur !== "object") continue;
    if (cur.type === "ExpoLinearGradient") out.push(cur);
    const kids = Array.isArray(cur.children) ? cur.children : cur.children ? [cur.children] : [];
    stack.push(...kids);
  }
  return out;
}

/**
 * WS-0 round 3, finding 3. The round-2 ladder test asserted STRING LITERALS —
 * three distinct strings in ANY order pass, so inverting the ladder and
 * collapsing the rendered composited steps (round 2's own D-8) stayed green.
 * These assertions are about the PROPERTY: what the three tiers composite to
 * over the theme's canvas, compared to each other. Nothing here names a value;
 * renaming/re-stepping the fills can only pass by changing the composite.
 */
const srgb = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
const relY = (rgb: [number, number, number]) =>
  0.2126 * srgb(rgb[0] / 255) + 0.7152 * srgb(rgb[1] / 255) + 0.0722 * srgb(rgb[2] / 255);
const chroma = (rgb: [number, number, number]) => Math.max(...rgb) - Math.min(...rgb);

type Rgb = [number, number, number];
function fillOf(background: string): { rgb: Rgb; a: number } {
  const m = background.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i
  );
  if (!m) throw new Error(`unparseable material fill "${background}"`);
  return { rgb: [+m[1], +m[2], +m[3]], a: m[4] === undefined ? 1 : parseFloat(m[4]) };
}
function compositeOver(fg: Rgb, a: number, bg: Rgb): Rgb {
  return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a)) as Rgb;
}
/** The surface a tier actually paints: its fill composited over the canvas. */
function compositedTier(theme: "dark" | "light", tier: MaterialTier): Rgb {
  const canvas = toRgb((TOKENS[theme] as unknown as Record<string, string>)["color-canvas"]);
  const { rgb, a } = fillOf(MATERIALS[theme][tier].background);
  return compositeOver(rgb, a, canvas);
}

describe("MATERIALS descriptors", () => {
  const T = (theme: "dark" | "light", tier: MaterialTier) => relY(compositedTier(theme, tier));

  it("dark tiers composite to a strictly monotonic ladder (thin < regular < thick)", () => {
    expect(T("dark", "thin")).toBeLessThan(T("dark", "regular"));
    expect(T("dark", "regular")).toBeLessThan(T("dark", "thick"));
  });

  it("light tiers are monotonic the OTHER way (thick < regular < thin)", () => {
    expect(T("light", "thick")).toBeLessThan(T("light", "regular"));
    expect(T("light", "regular")).toBeLessThan(T("light", "thin"));
  });

  it("the dark ladder SPANS at least 1.4x from thin to thick", () => {
    expect(T("dark", "thick") / T("dark", "thin")).toBeGreaterThanOrEqual(1.4);
  });

  it("all three tiers are pairwise distinct by >= 0.004 relY, in BOTH themes", () => {
    for (const theme of ["dark", "light"] as const) {
      const [thin, regular, thick] = (["thin", "regular", "thick"] as const).map((t) => T(theme, t));
      expect(Math.abs(regular - thin)).toBeGreaterThanOrEqual(0.004);
      expect(Math.abs(thick - regular)).toBeGreaterThanOrEqual(0.004);
      expect(Math.abs(thick - thin)).toBeGreaterThanOrEqual(0.004);
    }
  });

  it("no light tier composites to pure #ffffff (three white cards is not a ladder)", () => {
    for (const tier of ["thin", "regular", "thick"] as const) {
      const c = compositedTier("light", tier);
      expect(c).not.toEqual([255, 255, 255]);
      expect(relY(c)).toBeLessThan(1);
    }
  });

  // WS-0 round 3, finding 4a: the re-stepped dark fills were BLUE surface values
  // (chroma 23–29/255), so every wall cell wore a permanent chroma-27 blue that
  // competed with the per-widget tone — the dark wall's chroma vocabulary
  // collapsed to 8–32/255 when the reference spans 0→52. Near-neutral glass lets
  // the TONE supply the chroma again.
  it("dark glass is near-NEUTRAL (composited chroma <= 12/255 in every tier)", () => {
    for (const tier of ["thin", "regular", "thick"] as const) {
      expect(chroma(compositedTier("dark", tier))).toBeLessThanOrEqual(12);
    }
  });

  it("light glass stays near-neutral too (chroma <= 12/255 in every tier)", () => {
    for (const tier of ["thin", "regular", "thick"] as const) {
      expect(chroma(compositedTier("light", tier))).toBeLessThanOrEqual(12);
    }
  });

  // Blur / border / specular are transcribed CONSTANTS, not properties — the
  // literal pins are the right shape for them and stay.
  it("blur / border / specular keep the transcribed values", () => {
    expect(MATERIALS.dark.thin.blur).toBe(12);
    expect(MATERIALS.dark.regular.blur).toBe(20);
    expect(MATERIALS.dark.thick.blur).toBe(26);
    expect(MATERIALS.dark.thick.border).toBe("rgba(255, 255, 255, 0.12)");
    expect(MATERIALS.light.thin.border).toBe("rgba(0, 0, 0, 0.03)");
    expect(MATERIALS.dark.thin.saturate).toBe(1.2);
    expect(MATERIALS.light.thick.saturate).toBe(1.6);
    expect(specularOpacity("dark", "thin")).toBeCloseTo(0.04);
    expect(specularOpacity("dark", "regular")).toBeCloseTo(0.02);
    expect(specularOpacity("dark", "thick")).toBeCloseTo(0.07);
    expect(specularOpacity("light", "thin")).toBeCloseTo(0.04);
    expect(specularOpacity("light", "regular")).toBeCloseTo(0.02);
    expect(specularOpacity("light", "thick")).toBeCloseTo(0.07);
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
  it("U2.5: light thick's box-shadow lands on an outer (non-clipping) shell", () => {
    const { toJSON } = render(
      <Material tier="thick" testID="m" style={{ borderRadius: 28 }}>
        <Text>x</Text>
      </Material>,
      { wrapper: wrapTheme("light") }
    );
    const json: any = toJSON();
    expect(json.props.testID).toBe("m"); // outermost carries the testID (shadow shell)
    const s = JSON.stringify(json);
    expect(s).toContain('"shadowOpacity":0.08'); // light thick: 0 4px 16px rgba(0,0,0,0.08)
    expect(s).toContain('"shadowRadius":16');
    expect(s).toContain('"elevation":8');
    expect(s).toContain('"borderRadius":28'); // shell follows the surface radius
  });
  it("U2.5: dark thick parses the leading clause and skips the inset highlight", () => {
    const { toJSON } = render(
      <Material tier="thick" testID="m">
        <Text>x</Text>
      </Material>,
      { wrapper: wrapTheme("dark") }
    );
    const s = JSON.stringify(toJSON());
    expect(s).toContain('"shadowOpacity":0.14'); // 0 16px 48px rgba(0,0,0,0.14), inset …
    expect(s).toContain('"shadowRadius":48');
    expect(s).toContain('"elevation":24'); // min(24, blur/2)
  });
  it("U2.5: tiers without a shadow descriptor render unwrapped (dark thin/regular)", () => {
    const { toJSON } = render(
      <Material tier="thin" testID="m">
        <Text>x</Text>
      </Material>,
      { wrapper: wrapTheme("dark") }
    );
    expect(JSON.stringify(toJSON())).not.toContain("shadowOpacity");
  });
  it("U2.5: boost thickens the border to 1.5 and lifts it toward text-primary/30", () => {
    const { toJSON } = render(
      <Material tier="thin" testID="m">
        <Text>x</Text>
      </Material>,
      { wrapper: wrapTheme("light", true) }
    );
    const s = JSON.stringify(toJSON());
    expect(s).toContain('"borderWidth":1.5');
    // boost overlays its own text ladder — measure against the LIVE boost token
    expect(s).toContain(mix(TOKENS.boost.light["color-text-primary"], "transparent", 30));
  });
  it("U2.5: background fill = solid state path (no blur, no specular)", () => {
    const fill = mix(TOKENS.light["color-accent-selected"], "black", 40);
    const { toJSON } = render(
      <Material tier="thin" background={fill} testID="m">
        <Text>x</Text>
      </Material>,
      { wrapper: wrap }
    );
    const s = JSON.stringify(toJSON());
    expect(s).not.toContain("ExpoBlur");
    expect(s).toContain(fill);
  });

  // ── Layout contract (the light-theme card collapse regression) ────────────
  // The shadow shell must carry the CALLER's layout style on the OUTER box:
  // that is the box that takes part in the parent's flex layout. With the
  // caller's flex on the inner view alone, an auto-height parent resolved it
  // to 0 and every wall card rendered as a ~32px header sliver — and because
  // only the light `regular`/`thick` tiers shadow, the bug was invisible in
  // dark mode (the wall's default theme).
  it("the shadow shell carries the caller's layout style on the OUTER box (flex/height survive)", () => {
    const { getByTestId } = render(
      <Material tier="regular" testID="shell" style={{ flex: 1, width: 200, borderRadius: 28, padding: 18 }}>
        <Text>x</Text>
      </Material>,
      { wrapper: wrap }
    );
    const outer: any = getByTestId("shell");
    const outerStyle = StyleSheet.flatten(outer.props.style) ?? {};
    expect(outerStyle.flex).toBe(1);
    expect(outerStyle.width).toBe(200);
    // the inner view still fills the outer shell so the material layers cover it
    const inner: any = outer.children[0];
    const innerStyle = StyleSheet.flatten(inner.props.style) ?? {};
    expect(innerStyle.flex).toBe(1);
  });

  it("the shadow shell strips overflow from the OUTER box (a clipping shadow box loses the iOS shadow)", () => {
    const { getByTestId } = render(
      <Material tier="regular" testID="clip" style={{ flex: 1, overflow: "hidden", borderRadius: 24 }}>
        <Text>x</Text>
      </Material>,
      { wrapper: wrap }
    );
    const outer: any = getByTestId("clip");
    const outerStyle = StyleSheet.flatten(outer.props.style) ?? {};
    expect(outerStyle.overflow).toBeUndefined();
    // the INNER view keeps the clipping (it holds the blur layers)
    const inner: any = outer.children[0];
    const innerStyle = StyleSheet.flatten(inner.props.style) ?? {};
    expect(innerStyle.overflow).toBe("hidden");
  });

  it("without a shadow the caller's style stays on the single surface (unchanged path)", () => {
    const { getByTestId } = render(
      <Material tier="thin" testID="flat" style={{ flex: 1, height: 96 }}>
        <Text>x</Text>
      </Material>,
      { wrapper: wrap }
    );
    const flat: any = getByTestId("flat");
    const flatStyle = StyleSheet.flatten(flat.props.style) ?? {};
    expect(flatStyle.flex).toBe(1);
    expect(flatStyle.height).toBe(96);
    // one View, no shadow shell
    expect(flat.children).toHaveLength(1);
  });
});

// ── Task 0.2: tone (.widget-card parity) + caller-tint extraction ────────────
describe("<Material> tone (.widget-card from Home-ai globals.css)", () => {
  const toneDark = TOKENS.dark["color-accent-violet"];
  const toneLight = TOKENS.light["color-accent-violet"];

  it("dark: 160° tone wash 16%→5% + 35% tone border", () => {
    const { toJSON } = render(
      <Material tier="thin" tone={toneDark} testID="m">
        <Text>x</Text>
      </Material>,
      { wrapper: wrapTheme("dark") }
    );
    const json: any = toJSON();
    const rootStyle = StyleSheet.flatten(json.props.style) ?? {};
    expect(rootStyle.borderColor).toBe(mix(toneDark, "transparent", 35));
    const wash = gradientNodes(json).find(
      (n) =>
        n.props.colors[0] === mix(toneDark, "transparent", 16) &&
        n.props.colors[1] === mix(toneDark, "transparent", 5)
    );
    expect(wash).toBeTruthy();
  });

  it("light: barely-there wash 3%→1% + tone border mixed into color-border (the pastel-mud fix)", () => {
    const { toJSON } = render(
      <Material tier="thin" tone={toneLight} testID="m">
        <Text>x</Text>
      </Material>,
      { wrapper: wrapTheme("light") }
    );
    const json: any = toJSON();
    // light thin carries a shadow descriptor → the border rides the INNER
    // surface (the outer shell stays a non-clipping shadow box)
    const surface = findNodeByStyle(json, (s) => s.borderWidth === 1);
    expect(surface).toBeTruthy();
    expect(StyleSheet.flatten(surface.props.style).borderColor).toBe(
      mix(toneLight, TOKENS.light["color-border"], 24)
    );
    const wash = gradientNodes(json).find(
      (n) =>
        n.props.colors[0] === mix(toneLight, "transparent", 3) &&
        n.props.colors[1] === mix(toneLight, "transparent", 1)
    );
    expect(wash).toBeTruthy();
  });

  it("no tone → tier border unchanged (tone support is opt-in)", () => {
    const { toJSON } = render(
      <Material tier="thin" testID="m">
        <Text>x</Text>
      </Material>,
      { wrapper: wrapTheme("dark") }
    );
    const rootStyle = StyleSheet.flatten((toJSON() as any).props.style) ?? {};
    expect(rootStyle.borderColor).toBe(MATERIALS.dark.thin.border);
  });

  it("top specular rim rides every frosted surface", () => {
    const { toJSON } = render(
      <Material tier="thin" testID="m">
        <Text>x</Text>
      </Material>,
      { wrapper: wrapTheme("dark") }
    );
    const rim = findNodeByStyle(toJSON(), (s) => s.height === 1 && s.top === 0 && s.position === "absolute");
    expect(rim).toBeTruthy();
    expect(rim.props.style.backgroundColor).toBe(SPECULAR_AT(0.08));
  });
});

describe("<Material> caller backgroundColor extraction", () => {
  it("style backgroundColor renders as an absolute layer ABOVE the frost — never the surface's own fill", () => {
    const bg = mix(TOKENS.dark["color-accent-mint"], "transparent", 88);
    const { toJSON } = render(
      <Material tier="thin" style={{ borderRadius: 20, backgroundColor: bg }} testID="m">
        <Text>x</Text>
      </Material>,
      { wrapper: wrapTheme("dark") }
    );
    const json: any = toJSON();
    // the surface box no longer carries the caller's fill (it used to paint
    // BEHIND the frost's d.background in full mode / OVERWRITE the bake in
    // reduced mode)…
    expect(StyleSheet.flatten(json.props.style)?.backgroundColor).toBeUndefined();
    // …it rides as its own layer inside, above the frost, below tone/specular
    const layer = findNodeByStyle(
      json,
      (s) => s.position === "absolute" && s.backgroundColor === bg
    );
    expect(layer).toBeTruthy();
  });

  it("layout keys still land on the surface (the split only peels off backgroundColor)", () => {
    const bg = mix(TOKENS.dark["color-accent-amber"], "transparent", 80);
    const { getByTestId } = render(
      <Material tier="thin" style={{ flex: 1, padding: 12, backgroundColor: bg }} testID="m">
        <Text>x</Text>
      </Material>,
      { wrapper: wrapTheme("dark") }
    );
    const style = StyleSheet.flatten((getByTestId("m") as any).props.style) ?? {};
    expect(style.flex).toBe(1);
    expect(style.padding).toBe(12);
    expect(style.backgroundColor).toBeUndefined();
  });

  /**
   * WS-0 round 3, finding 4b: the dark tone ceiling was pulling every faint
   * wash 45% back toward a neutral surface step, which bounded the wall's
   * luminance at the cost of its CHROMA — the per-widget cue. With the glass
   * itself now near-neutral, the ceiling only has to stop one bright tone from
   * owning the hierarchy, so it drops to 15%. Pinned as a PROPERTY (the
   * wash stays recognisably its own accent, only 15% pulled back) rather than
   * as a constant, so raising the clip back toward 45% fails here.
   */
  it("a faint dark caller wash keeps >= 85% of its own accent (15% ceiling, not 45%)", () => {
    const accent = TOKENS.dark["color-accent-mint"];
    // the WALL's per-widget tone: mixAlpha(tone, 0.10) (HomeWall.tsx)
    const bg = mix(accent, "transparent", 10);
    const { toJSON } = render(
      <Material tier="regular" style={{ borderRadius: 28, backgroundColor: bg }} testID="m">
        <Text>x</Text>
      </Material>,
      { wrapper: wrapTheme("dark") }
    );
    const layer = findNodeByStyle(
      toJSON(),
      (s) =>
        s.position === "absolute" &&
        typeof s.backgroundColor === "string" &&
        Math.abs((parseColor(String(s.backgroundColor))?.a ?? -1) - 0.1) < 0.01
    );
    expect(layer).toBeTruthy();
    const painted = parseColor(String(StyleSheet.flatten(layer.props.style)?.backgroundColor));
    const ceiling = parseColor(TOKENS.dark["color-surface-6"]);
    const source = parseColor(accent);
    expect(painted && ceiling && source).toBeTruthy();
    // residual accent: how far the paint still sits from the neutral ceiling
    const residual = (k: "r" | "g" | "b") =>
      Math.abs(painted![k] - ceiling![k]) / Math.max(1, Math.abs(source![k] - ceiling![k]));
    for (const k of ["r", "g", "b"] as const) {
      expect(residual(k)).toBeGreaterThan(0.85);
    }
    // …and the alpha is preserved (a mix() would have made it an opaque fill)
    expect(painted!.a).toBeCloseTo(0.1, 3);
  });
});
