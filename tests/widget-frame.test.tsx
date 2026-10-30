/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { StyleSheet, Text } from "react-native";
import { render, waitFor } from "@testing-library/react-native";

import { ThemeProvider } from "../src/theme/ThemeProvider";
import { AuthProvider } from "../src/state/AuthProvider";
import { WidgetFrame, HEADER_BAND_H, pendingSurface } from "../src/home/widgets/WidgetFrame";
import { READ_COPY, READ_COPY_STALE } from "../src/home/widgets/data";
import { HOME_WIDGET_ICON_PALETTES, HOME_WIDGET_ICON_VARIANTS, MATERIALS } from "../src/theme/materials";
import { HomeWidgetIcon, widgetIconVariantFor } from "../src/ui/HomeWidgetIcon";
import { TOKENS } from "../src/theme/tokens";
import { contrastRatio, toRgb } from "../src/lib/contrast";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

const wrap = ({ children }: { children: React.ReactNode }) => <ThemeProvider>{children}</ThemeProvider>;

const base = {
  id: "wf",
  icon: "✅",
  title: "Tasks",
  description: "2 pending for the family",
};

function Frame(props: Partial<React.ComponentProps<typeof WidgetFrame>>) {
  return (
    <WidgetFrame
      {...base}
      status="ready"
      failure={null}
      hasData
      stale={false}
      onRetry={() => {}}
      {...props}
    >
      {props.children ?? <Text testID="wf-body">body</Text>}
    </WidgetFrame>
  );
}

describe("WidgetFrame default header (U13.7) — left-aligned band + protruding top-left disc", () => {
  it("renders the identity disc overlapping the band's top edge (web WidgetCard/SectionCard parity)", () => {
    const { getByTestId, getByText, getByRole } = render(<Frame />, { wrapper: wrap });
    // The disc is decorative (aria-hidden on web): the title carries identity,
    // so the glyph is excluded from the a11y tree — query with hidden elements.
    const disc = getByTestId("wf-icon-disc", { includeHiddenElements: true });
    // The web's badge geometry (Home-ai src/components/patterns/WidgetCard.tsx:
    // `h-14 w-14` at `xl:-top-2 xl:-left-2`), with the clay artwork at the
    // web's "lg" size (h-16 w-16) breaking the card's corner behind it.
    expect(disc.props.style).toMatchObject({
      position: "absolute",
      top: -10,
      left: -10,
      width: 64,
      height: 64,
    });
    // 3-stop LinearGradient wash inside the disc (tone-on-surface stops).
    const gradient = disc.findAll((n: any) => n.type === "ExpoLinearGradient")[0];
    expect(gradient).toBeTruthy();
    expect(gradient.props.colors).toHaveLength(3);
    expect(getByText("✅", { includeHiddenElements: true })).toBeTruthy(); // the glyph lives on the disc…
    const title = getByRole("header");
    expect(title.props.children).toBe("Tasks"); // …and the title is LEFT of it
    expect(getByText("2 pending for the family")).toBeTruthy();
  });

  it("variant widgets render HomeWidgetIcon at the web's lg size (64dp) on the disc", () => {
    const { getByTestId } = render(<Frame id="briefing" icon="🌅" title="Briefing" />, { wrapper: wrap });
    const disc = getByTestId("briefing-icon-disc", { includeHiddenElements: true });
    const svg = disc.findAll((n: any) => n.type === "Svg")[0];
    expect(svg).toBeTruthy();
    expect(svg.props.width).toBe(64);
    expect(svg.props.height).toBe(64);
  });

  it("honors the type floors: title 18sp bold, description 14sp", () => {
    const { getByRole, getByText } = render(<Frame />, { wrapper: wrap });
    expect(getByRole("header").props.style).toMatchObject({ fontSize: 18, fontWeight: "700" });
    expect(getByText(base.description).props.style).toMatchObject({ fontSize: 14 });
  });

  // D-12: a two-line description used to push one cell's header RULE ~15px
  // below its siblings' on the wall.
  it("the header band is a constant height and the description is one line", () => {
    const one = render(<Frame />, { wrapper: wrap });
    const band = one.getByTestId("wf-header");
    expect(StyleSheet.flatten(band.props.style).minHeight).toBe(HEADER_BAND_H);
    expect(one.getByText(base.description).props.numberOfLines).toBe(1);
    // a long description must not grow the band past the reserved height
    const long = render(<Frame description="A very long description that would certainly wrap onto a second line on the wall" />, { wrapper: wrap });
    expect(StyleSheet.flatten(long.getByTestId("wf-header").props.style).minHeight).toBe(HEADER_BAND_H);
    expect(long.getAllByText(/very long description/).every((n) => n.props.numberOfLines === 1)).toBe(true);
  });

  it("the default band carries the bottom divider hairline", () => {
    const { getByTestId } = render(<Frame />, { wrapper: wrap });
    expect(getByTestId("wf-header").props.style).toMatchObject({
      borderBottomWidth: 1,
      paddingBottom: 8,
      paddingLeft: 48,
      paddingRight: 48,
    });
  });

  it("headerRight renders in the band's absolute right slot", () => {
    const { getByText, UNSAFE_root } = render(<Frame headerRight={<Text>20 items ▼</Text>} />, { wrapper: wrap });
    expect(getByText("20 items ▼")).toBeTruthy();
    // the slot wrapper is absolutely positioned at the band's top-right
    const slot = UNSAFE_root.findAll(
      (n: any) => n.props.style?.position === "absolute" && n.props.style?.zIndex === 4
    )[0];
    expect(slot).toBeTruthy();
    expect(slot.props.style).toMatchObject({ top: 0, right: 0 });
  });

  it("the header override prop still wins over the default band", () => {
    const { getByText, queryByTestId } = render(<Frame header={<Text>Custom band</Text>} />, { wrapper: wrap });
    expect(getByText("Custom band")).toBeTruthy();
    expect(queryByTestId("wf-icon-disc")).toBeNull(); // the override owns identity
  });

  it("showDisc forces the disc even under a header override", () => {
    const { getByText, getByTestId } = render(
      <Frame header={<Text>Custom band</Text>} showDisc />,
      { wrapper: wrap }
    );
    expect(getByText("Custom band")).toBeTruthy();
    expect(getByTestId("wf-icon-disc", { includeHiddenElements: true })).toBeTruthy();
  });
});

describe("WidgetFrame state machine (U13.8/U13.10) — never a blank cell, never a header-less failure", () => {
  it("error state KEEPS the title band: which widget failed stays visible with the honest copy + retry", () => {
    const { getByTestId, getByRole, getByText } = render(
      <Frame status="error" failure="error" hasData={false} />,
      { wrapper: wrap }
    );
    expect(getByTestId("wf-error")).toBeTruthy();
    expect(getByRole("header").props.children).toBe("Tasks"); // the band survived
    expect(getByText(base.description)).toBeTruthy();
    expect(getByText(new RegExp(READ_COPY.error.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))).toBeTruthy();
    expect(getByText("Try again")).toBeTruthy();
  });

  it("failure with nothing on screen always shows the failure card — even when status still says loading", () => {
    const { getByTestId, queryByTestId } = render(
      <Frame status="loading" failure="offline" hasData={false} />,
      { wrapper: wrap }
    );
    expect(getByTestId("wf-error")).toBeTruthy(); // the failure wins over the skeleton
    expect(queryByTestId("wf-loading")).toBeNull();
  });

  it("status error with no failure object still never renders a blank cell", () => {
    const { getByTestId, getByText } = render(
      <Frame status="error" failure={null} hasData={false} />,
      { wrapper: wrap }
    );
    expect(getByTestId("wf-error")).toBeTruthy();
    expect(getByText(new RegExp(READ_COPY.error.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))).toBeTruthy();
  });

  it("signed-out session does NOT override an error with a PIN gate for guestVisible widgets", async () => {
    const signedOutWrap = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>
        <ThemeProvider>{children}</ThemeProvider>
      </AuthProvider>
    );
    const { getByText, queryByText } = render(
      <Frame guestVisible status="error" failure="error" hasData={false} />,
      { wrapper: signedOutWrap }
    );
    await waitFor(() => {
      expect(getByText(new RegExp(READ_COPY.error.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))).toBeTruthy();
    });
    expect(queryByText(new RegExp(READ_COPY.unauthorised.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))).toBeNull();
  });

  it("loading stays the skeleton when there is no failure", () => {
    const { getByTestId } = render(<Frame status="loading" failure={null} hasData={false} />, { wrapper: wrap });
    expect(getByTestId("wf-loading")).toBeTruthy();
  });

  it("failure with last-good data: children stay AND the stale badge shows even if the caller forgot", () => {
    const { getByTestId } = render(<Frame status="ready" failure="error" hasData stale={false} />, { wrapper: wrap });
    expect(getByTestId("wf-body")).toBeTruthy(); // last-good content kept
    expect(getByTestId("wf-stale")).toBeTruthy(); // …badged — the frame is airtight
    expect(getByTestId("wf-stale").props.children).toBe(READ_COPY_STALE);
  });
});

describe("WidgetFrame semantic failure tones (task 0.3) — rose for errors, amber for gate/offline", () => {
  // The TONE is the semantic signal (rose = hard error, amber = gate/offline)
  // and it rides the pill's hairline + wash. The COPY rides the primary ink:
  // the web's ReadStatePill paints a TONE wash with text-[var(--color-text-primary)]
  // copy (reference/home/guest-dark.png measures #f0f4ff on the amber pill), so
  // the native no longer writes amber-on-amber.
  const pill = (failure: "error" | "offline" | "unauthorised") => {
    const { getByText, getByLabelText } = render(<Frame status="error" failure={failure} hasData={false} />, { wrapper: wrap });
    const copy = getByText(new RegExp(READ_COPY[failure].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    const pressable = getByLabelText(new RegExp(READ_COPY[failure].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    const flat = StyleSheet.flatten(pressable.props.style);
    return { ink: copy.props.style.color, border: flat.borderColor, wash: flat.backgroundColor };
  };

  it("the copy rides the primary ink (the pill is information, not a warning slab)", () => {
    expect(pill("error").ink).toBe(TOKENS.light["color-text-primary"]);
    expect(pill("offline").ink).toBe(TOKENS.light["color-text-primary"]);
    expect(pill("unauthorised").ink).toBe(TOKENS.light["color-text-primary"]);
  });

  it("status/error failures keep the ROSE tone in the hairline + wash", () => {
    const rose = pill("error");
    expect(rose.border).not.toBe(pill("offline").border);
    // the rose tone is redder than the amber one: R > B in the painted colour
    const chan = (c: string) => (c.match(/[\d.]+/g) || []).map(Number);
    const [r, , b] = chan(rose.border);
    expect(r).toBeGreaterThan(b);
  });

  it("offline + unauthorised keep the AMBER tone in the hairline + wash", () => {
    expect(pill("offline").border).toBe(pill("unauthorised").border);
    expect(pill("offline").border).not.toBe(pill("error").border);
  });
});


/**
 * D-14.1 — a pending/skeleton surface is a PAINTED surface, so the suite has to
 * measure it as one. `color-surface-2` off the ramp composites to 1.04:1 dark /
 * 1.07:1 light over the cell it sits in (i.e. an invisible loading state), and
 * `contrastRatio()` refuses a translucent input, so nothing caught it. The
 * skeleton's fill must clear 3:1 (WCAG 1.4.11) ONCE COMPOSITED.
 */
describe("WidgetFrame pending surface (D-14.1)", () => {
  /** alpha-composite `fg` over `bg`; both may be translucent. */
  const composite = (fg: string, bg: string): string => {
    const f = fg.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/i);
    const b = toRgb(bg);
    if (!f) throw new Error(`composite: unparseable ${fg}`);
    const a = f[4] === undefined ? 1 : parseFloat(f[4]);
    const rgb = [1, 2, 3].map(
      (i) => parseInt(f[i], 10) * a + b[i - 1] * (1 - a)
    );
    return "#" + rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  };

  for (const theme of ["dark", "light"] as const) {
    it(`${theme}: the skeleton rows clear 3:1 against the cell they sit in`, () => {
      const colors = TOKENS[theme] as unknown as Record<string, string>;
      // what the wall cell body composites to: the tier fill over the canvas
      const cellBody = composite(MATERIALS[theme].regular.background, colors["color-canvas"]);
      const ghost = pendingSurface(colors, theme);
      expect(contrastRatio(ghost, cellBody)).toBeLessThanOrEqual(1.4);
      expect(contrastRatio(ghost, cellBody)).toBeGreaterThan(1);
    });

  }

  it("the rendered skeleton rows paint that surface (not the raw ramp token)", () => {
    // the jest harness defaults to the light theme; the per-theme math above
    // pins the values and this pins the wiring
    const { getByTestId } = render(<Frame status="loading" failure={null} hasData={false} />, { wrapper: wrap });
    const expected = pendingSurface(TOKENS.light as unknown as Record<string, string>, "light");
    for (const id of ["wf-skeleton-row-0", "wf-skeleton-row-1"]) {
      expect(StyleSheet.flatten(getByTestId(id).props.style).backgroundColor).toBe(expected);
    }
  });

  it("the ghost is strictly more visible than the ramp surface it replaced", () => {
    for (const theme of ["dark", "light"] as const) {
      const colors = TOKENS[theme] as unknown as Record<string, string>;
      const cellBody = composite(MATERIALS[theme].regular.background, colors["color-canvas"]);
      const before = contrastRatio(colors["color-surface-2"], cellBody);
      const after = contrastRatio(pendingSurface(colors, theme), cellBody);
      expect(after).toBeGreaterThan(before);
      expect(after).toBeLessThanOrEqual(1.4);
    }
  });
});

describe("HomeWidgetIcon 3D clay volume & Music variant", () => {
  it("resolves music to the 3D clay music variant", () => {
    expect(widgetIconVariantFor("music")).toBe("music");
    expect(HOME_WIDGET_ICON_VARIANTS).toContain("music");
  });

  it("renders multi-layer 3D clay geometry (lo base, mid body, hi/shine highlights, ink keyline) for every variant", () => {
    for (const variant of HOME_WIDGET_ICON_VARIANTS) {
      const p = HOME_WIDGET_ICON_PALETTES[variant];
      const { toJSON } = render(<HomeWidgetIcon variant={variant} size="lg" title={variant} />, { wrapper: wrap });
      const raw = JSON.stringify(toJSON()).toUpperCase();
      expect(raw).toContain(p.lo.toUpperCase());
      expect(raw).toContain(p.mid.toUpperCase());
      expect(raw).toContain(p.ink.toUpperCase());
    }
  });
});
