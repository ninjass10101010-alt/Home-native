/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import { render } from "@testing-library/react-native";
import React from "react";
import { StyleSheet, Text } from "react-native";
import { MATERIALS, specularOpacity, SPECULAR_AT } from "../src/theme/materials";
import { Material } from "../src/theme/Material";
import { perfTier } from "../src/theme/perf";
import { ThemeProvider, useTheme } from "../src/theme/ThemeProvider";
import { TOKENS } from "../src/theme/tokens";
import { mix } from "../src/theme/mix";

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

describe("MATERIALS descriptors", () => {
  // WS-0 round 2 (D-8/D-9): the fills are re-stepped onto real surface steps.
  // The transcribed trio was three ALPHAS of ONE color, which rendered as a
  // 0.0017-relY non-monotonic ladder in dark and three literal #ffffff cards in
  // light. Blur / border / specular keep the transcribed values.
  it("dark tiers are a monotonic surface ladder", () => {
    expect(MATERIALS.dark.thin.background).toBe("rgba(37, 44, 60, 0.42)");
    expect(MATERIALS.dark.thin.blur).toBe(12);
    expect(MATERIALS.dark.regular.background).toBe("rgba(45, 53, 72, 0.58)");
    expect(MATERIALS.dark.regular.blur).toBe(20);
    expect(MATERIALS.dark.thick.background).toBe("rgba(52, 61, 81, 0.62)");
    expect(MATERIALS.dark.thick.blur).toBe(26);
    expect(MATERIALS.dark.thick.border).toBe("rgba(255, 255, 255, 0.12)");
  });
  it("light tiers are three DISTINCT surfaces — never three #ffffff cards", () => {
    expect(MATERIALS.light.thin.background).toBe("rgba(253, 254, 255, 0.58)");
    expect(MATERIALS.light.regular.background).toBe("rgba(250, 252, 255, 0.64)");
    expect(MATERIALS.light.thick.background).toBe("rgba(245, 248, 253, 0.72)");
    expect(MATERIALS.light.thin.border).toBe("rgba(0, 0, 0, 0.03)");
    const fills = new Set([
      MATERIALS.light.thin.background,
      MATERIALS.light.regular.background,
      MATERIALS.light.thick.background,
    ]);
    expect(fills.size).toBe(3);
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
});
