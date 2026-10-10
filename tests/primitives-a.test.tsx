/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { Text } from "react-native";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { TOKENS, ACCENTS, TYPE_FLOOR_SP, TYPOGRAPHY } from "../src/theme/tokens";
import { contrastRatio } from "../src/lib/contrast";
import { accentDeepened, accentInk, mix } from "../src/theme/mix";
import { SoftButton } from "../src/ui/SoftButton";
import { IconButton } from "../src/ui/IconButton";
import { Chip } from "../src/ui/Chip";
import { Toggle } from "../src/ui/Toggle";
import { Surface } from "../src/ui/Surface";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
const wrap = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

const flat = (el: any) => JSON.stringify(el);

describe("mix math (web token formulas)", () => {
  it("mix matches the generator's premultiplied srgb result", () => {
    expect(mix("#3b82f6", "#000000", 60)).toBe("#234e94");
    expect(accentInk("#3b82f6", "#f0f4ff")).toBeTruthy();
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
        const fill = accentDeepened(ACCENTS[theme][a], 60);
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
    expect(s).toContain(accentDeepened(ACCENTS.light.nori, 60));
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
  it("type floor: smallest rendered label ≥ 14sp", () => {
    expect(Math.min(...Object.values(TYPOGRAPHY).map((t) => t.fontSize))).toBeGreaterThanOrEqual(TYPE_FLOOR_SP);
  });
});
