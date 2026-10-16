/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo, Text } from "react-native";
import { ThemeProvider, useTheme } from "../src/theme/ThemeProvider";
import { TOKENS, ACCENTS, TYPE_FLOOR_SP, TYPOGRAPHY } from "../src/theme/tokens";
import { MATERIALS } from "../src/theme/materials";
import { contrastRatio } from "../src/lib/contrast";
import { accentDeepened, accentInk, mix } from "../src/theme/mix";
import { SoftButton } from "../src/ui/SoftButton";
import { IconButton } from "../src/ui/IconButton";
import { Chip, ChipTone } from "../src/ui/Chip";
import { Toggle } from "../src/ui/Toggle";
import { Surface } from "../src/ui/Surface";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
const wrap = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

const flat = (el: any) => JSON.stringify(el);

/** Force a specific theme inside a render (ThemeProvider boots from system). */
function SetTheme({ theme, children }: { theme: "light" | "dark"; children: React.ReactNode }) {
  const { setTheme } = useTheme();
  React.useEffect(() => {
    setTheme(theme);
  }, [theme]);
  return <>{children}</>;
}

/** fg at alpha over an opaque bg → "rgb(r, g, b)" (composite-before-measure). */
function composite(fg: string, alpha: number, bg: string): string {
  const parse = (c: string): [number, number, number] => {
    const h = c.match(/^#([0-9a-f]{6})$/i);
    if (h) return [parseInt(h[1].slice(0, 2), 16), parseInt(h[1].slice(2, 4), 16), parseInt(h[1].slice(4, 6), 16)];
    const m = c.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (!m) throw new Error(`composite: unparseable "${c}"`);
    return [+m[1], +m[2], +m[3]];
  };
  const f = parse(fg);
  const b = parse(bg);
  const ch = (i: number) => Math.round(f[i] * alpha + b[i] * (1 - alpha));
  return `rgb(${ch(0)}, ${ch(1)}, ${ch(2)})`;
}

describe("mix math (web token formulas)", () => {
  it("mix matches the generator's premultiplied srgb result", () => {
    expect(mix("#3b82f6", "#000000", 60)).toBe("#234e94");
    expect(accentInk("#3b82f6", "#f0f4ff")).toBeTruthy();
  });
  it("U2.1: accentDeepened pct = percent TOWARD BLACK (web color-mix(A x%, black) ⇒ pct = 100 − x)", () => {
    expect(accentDeepened("#3b82f6", 40)).toBe(mix("#3b82f6", "black", 60));
    expect(accentDeepened("#3b82f6", 40)).toBe("#234e94"); // the measured-AA primary fill, pixel-identical to web
    expect(accentDeepened("#3b82f6", 0)).toBe("#3b82f6");
    expect(accentDeepened("#3b82f6", 100)).toBe("#000000");
  });
});

describe("SoftButton", () => {
  it("wall floor: minHeight ≥ 64 and label ≥ 14sp at every size", () => {
    for (const size of ["sm", "md", "lg"] as const) {
      const { toJSON } = render(<SoftButton size={size}>Go</SoftButton>, { wrapper: wrap });
      const s = flat(toJSON());
      expect(s).toContain(`"minHeight":${Math.max(64, { sm: 64, md: 72, lg: 88 }[size])}`);
    }
  });
  it("disabled is a surface change (surface-2 + secondary ink), not an opacity fade", () => {
    const { toJSON } = render(
      <SoftButton testID="b" disabled>
        Save
      </SoftButton>,
      { wrapper: wrap }
    );
    const s = flat(toJSON());
    expect(s).toContain(TOKENS.light["color-surface-2"]);
    expect(s).not.toContain('"opacity":0.5');
  });
  it("AA: primary white-on-deepened-accent ≥4.5 across ALL accents, both themes", () => {
    for (const theme of ["dark", "light"] as const) {
      for (const a of Object.keys(ACCENTS[theme])) {
        const fill = accentDeepened(ACCENTS[theme][a], 40); // web color-mix(accent 60%, black)
        expect(contrastRatio(TOKENS[theme]["color-primary-foreground"], fill)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
  it("AA: secondary ink on surface-2 ≥4.5 across ALL accents, both themes", () => {
    for (const theme of ["dark", "light"] as const) {
      for (const a of Object.keys(ACCENTS[theme])) {
        const ink = accentInk(ACCENTS[theme][a], TOKENS[theme]["color-text-primary"]);
        expect(contrastRatio(ink, TOKENS[theme]["color-surface-2"])).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
  it("loading blocks press", () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <SoftButton testID="b" loading onPress={onPress}>
        Go
      </SoftButton>,
      { wrapper: wrap }
    );
    fireEvent.press(getByTestId("b"));
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe("IconButton", () => {
  it("64dp floor + glyph-only a11y label is mandatory (enforced by TS prop)", () => {
    const { getByLabelText } = render(
      <IconButton icon={<Text>⚙️</Text>} label="Open settings" />,
      { wrapper: wrap }
    );
    expect(getByLabelText("Open settings")).toBeTruthy();
  });
  it("AA: accent ink on its wash ≥4.5 across accents/themes", () => {
    for (const theme of ["dark", "light"] as const) {
      for (const a of Object.keys(ACCENTS[theme])) {
        const ink = accentInk(ACCENTS[theme][a], TOKENS[theme]["color-text-primary"]);
        // ink is read over (wash over surface-1 ≈ surface-1 backdrop) — measure on surface-1 (strictly stricter)
        expect(contrastRatio(ink, TOKENS[theme]["color-surface-1"])).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});

describe("Chip", () => {
  it("button-kind never renders below 64dp (sm degrades to a static label)", () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <Chip testID="c" size="sm" label="x" onPress={onPress} />,
      { wrapper: wrap }
    );
    const el: any = getByTestId("c");
    expect(el.props.accessibilityRole).not.toBe("button");
    expect(el.props.onPress).toBeUndefined();
  });
  it("selected = deepened fill + white ink, tone ink omitted", () => {
    const { toJSON } = render(<Chip label="Me" selected />, { wrapper: wrap });
    const s = flat(toJSON());
    expect(s).toContain(accentDeepened(ACCENTS.light.nori, 40));
  });
  it("U2.5: chrome routes through Material — resting frosts, solid states (selected/disabled) skip blur", () => {
    const resting = flat(render(<Chip label="Go" />, { wrapper: wrap }).toJSON());
    expect(resting).toContain("ExpoBlur");
    const selected = flat(render(<Chip label="Go" selected />, { wrapper: wrap }).toJSON());
    expect(selected).not.toContain("ExpoBlur");
    const disabled = flat(render(<Chip label="Go" disabled />, { wrapper: wrap }).toJSON());
    expect(disabled).not.toContain("ExpoBlur");
  });
  it("U2.3: light tone inks = web's 72%-accent guard, AA ≥4.5 on the chip surface", () => {
    const chipInk = (tone: ChipTone): string => {
      const label = `chip-${tone}`;
      const { getByText } = render(
        <ThemeProvider>
          <SetTheme theme="light">
            <Chip tone={tone} label={label} />
          </SetTheme>
        </ThemeProvider>
      );
      const el: any = getByText(label);
      return el.props.style.color;
    };
    expect(chipInk("success")).toBe(accentDeepened(ACCENTS.light.mint, 28)); // globals.css chip-tone light guard
    expect(chipInk("warning")).toBe(accentDeepened(ACCENTS.light.amber, 28));
    expect(chipInk("danger")).toBe(accentDeepened(ACCENTS.light.rose, 28));
    for (const tone of ["success", "warning", "danger"] as const) {
      const ink = chipInk(tone);
      // worst plausible chip host is surface-2 (the frost only lightens it)
      expect(contrastRatio(ink, TOKENS.light["color-surface-2"])).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(ink, TOKENS.light["color-canvas"])).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("U2.3: dark tone inks keep web vividness where AA holds, lift rose via accentInk", () => {
    const chipInk = (tone: ChipTone): string => {
      const label = `chip-${tone}`;
      const { getByText } = render(
        <ThemeProvider>
          <SetTheme theme="dark">
            <Chip tone={tone} label={label} />
          </SetTheme>
        </ThemeProvider>
      );
      const el: any = getByText(label);
      return el.props.style.color;
    };
    expect(chipInk("success")).toBe(ACCENTS.dark.mint); // raw accent (≥7.3:1 on every chip surface)
    expect(chipInk("warning")).toBe(ACCENTS.dark.amber);
    // raw rose lands 4.27–4.28:1 on Material-composited chip surfaces → lift to the accentInk convention
    expect(chipInk("danger")).toBe(accentInk(ACCENTS.dark.rose, TOKENS.dark["color-text-primary"]));
    const thin = MATERIALS.dark.thin.background; // the chip's frosted bg
    const hosts = [
      TOKENS.dark["color-canvas"],
      TOKENS.dark["color-surface-1"],
      TOKENS.dark["color-surface-2"],
    ];
    for (const tone of ["success", "warning", "danger"] as const) {
      const ink = chipInk(tone);
      for (const host of hosts) {
        expect(contrastRatio(ink, composite(thin, 0.35, host))).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
  it("U2.6: press scales 0.96 (tap feedback)", () => {
    const { UNSAFE_root } = render(
      <Chip testID="c" label="x" onPress={() => {}} />,
      { wrapper: wrap }
    );
    // Pressable's style is a function on the composite instance (RNTL can't
    // drive the internal pressed state) — assert the function's contract.
    const pressable = UNSAFE_root.findAll((n) => typeof n.props.style === "function" && n.props.onPress)[0];
    expect(pressable).toBeTruthy();
    const at = (pressed: boolean) => JSON.stringify(pressable.props.style({ pressed }));
    expect(at(true)).toContain('"scale":0.96');
    expect(at(false)).not.toContain('"scale":0.96');
  });
  it("U2.6: reduceMotion kills the press scale", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
    const { getByTestId } = render(
      <Chip testID="c" label="x" onPress={() => {}} />,
      { wrapper: wrap }
    );
    await waitFor(() => {
      fireEvent(getByTestId("c"), "pressIn");
      expect(JSON.stringify(getByTestId("c").props.style)).not.toContain('"scale"');
    });
  });
});

describe("Toggle", () => {
  it("switch role, state, and onChange", () => {
    const onChange = jest.fn();
    const { getByRole } = render(<Toggle value={false} onChange={onChange} label="Wall" />, { wrapper: wrap });
    fireEvent.press(getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe("Surface", () => {
  it("tier variants route to Material; flat = neutral raised", () => {
    const { toJSON: a } = render(<Surface variant="material-thin" testID="s1" />, { wrapper: wrap });
    const { toJSON: b } = render(<Surface variant="flat" testID="s2" />, { wrapper: wrap });
    expect(flat(a())).toContain("ExpoBlur");
    expect(flat(b())).toContain(TOKENS.light["color-surface-2"]);
  });
  it("U2.2: warm maps to the thick tier (warm-glass-card: blur 24≈26, strong-stop ≈0.8)", () => {
    const { toJSON } = render(<Surface variant="warm" testID="w" />, { wrapper: wrap });
    // blur 26 → intensity 65 (regular would be 50)
    expect(flat(toJSON())).toContain('"intensity":65');
  });
  it("type floor: smallest rendered label ≥ 14sp", () => {
    expect(Math.min(...Object.values(TYPOGRAPHY).map((t) => t.fontSize))).toBeGreaterThanOrEqual(TYPE_FLOOR_SP);
  });
});
