/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import { render } from "@testing-library/react-native";
import React from "react";
import { StyleSheet, Text } from "react-native";
import { MATERIALS, specularOpacity } from "../src/theme/materials";
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
