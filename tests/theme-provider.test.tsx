/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { ThemeProvider, useTheme } from "../src/theme/ThemeProvider";
import { TOKENS, ACCENTS, ACCENTS_RGB } from "../src/theme/tokens";
import { contrastRatio } from "../src/lib/contrast";
import { mix } from "../src/theme/mix";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const wrap = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

afterEach(() => {
  jest.restoreAllMocks();
});

describe("ThemeProvider", () => {
  it("defaults to system scheme, nori accent, boost off", () => {
    const { result } = renderHook(() => useTheme(), { wrapper: wrap });
    expect(["light", "dark"]).toContain(result.current.theme);
    expect(result.current.accent).toBe("nori");
    expect(result.current.boost).toBe(false);
  });

  it("accent switch re-derives accentColor from the ACCENTS table", () => {
    const { result } = renderHook(() => useTheme(), { wrapper: wrap });
    act(() => result.current.setAccent("amber"));
    expect(result.current.accent).toBe("amber");
    expect(result.current.accentColor).toBe(ACCENTS[result.current.theme].amber);
  });

  it("contract: body text clears AA 4.5:1 on canvas in ALL four theme variants", () => {
    const { result } = renderHook(() => useTheme(), { wrapper: wrap });
    for (const theme of ["light", "dark"] as const) {
      for (const boost of [false, true]) {
        act(() => {
          result.current.setTheme(theme);
          result.current.setBoost(boost);
        });
        const c = result.current.colors;
        expect(contrastRatio(c["color-text-primary"], c["color-canvas"])).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(c["color-text-muted"], c["color-canvas"])).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("reduceMotion follows the Android accessibility setting", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
    const { result } = renderHook(() => useTheme(), { wrapper: wrap });
    await waitFor(() => expect(result.current.reduceMotion).toBe(true));
    (AccessibilityInfo.isReduceMotionEnabled as jest.Mock).mockRestore?.();
  });

  it("color-accent-selected mirrors the live accent (not nori)", () => {
    const { result } = renderHook(() => useTheme(), { wrapper: wrap });
    act(() => result.current.setAccent("amber"));
    expect(result.current.colors["color-accent-selected"]).toBe(ACCENTS[result.current.theme].amber);
  });

  it("every derived accent token re-derives on setAccent (nav fill/button/ink track the live accent)", () => {
    const { result } = renderHook(() => useTheme(), { wrapper: wrap });
    for (const theme of ["dark", "light"] as const) {
      act(() => {
        result.current.setTheme(theme);
        result.current.setAccent("amber");
      });
      const amber = ACCENTS[theme].amber;
      const c = result.current.colors;
      expect(c["color-primary"]).toBe(amber);
      expect(c["color-ring"]).toBe(amber);
      expect(c["color-nav-active"]).toBe(amber);
      expect(c["color-nav-active-border"]).toBe(mix(amber, "transparent", 38));
      expect(c["color-nav-active-fill"]).toBe(mix(amber, "black", 72));
      expect(c["color-accent-button"]).toBe(mix(amber, "black", 60));
      expect(c["color-accent-ink"]).toBe(
        mix(amber, TOKENS[theme]["color-text-primary"], theme === "light" ? 60 : 55)
      );
      // …and they are NOT the static nori table the generator baked
      expect(c["color-nav-active-fill"]).not.toBe(TOKENS[theme]["color-nav-active-fill"]);
      expect(c["color-accent-ink"]).not.toBe(TOKENS[theme]["color-accent-ink"]);
    }
  });

  it("accent-ink under boost mixes against the BOOST text ladder (the override that wins)", () => {
    const { result } = renderHook(() => useTheme(), { wrapper: wrap });
    act(() => {
      result.current.setTheme("light");
      result.current.setBoost(true);
      result.current.setAccent("amber");
    });
    expect(result.current.colors["color-accent-ink"]).toBe(
      mix(ACCENTS.light.amber, TOKENS.boost.light["color-text-primary"], 60)
    );
  });

  it("U1: colors['color-accent-selected-rgb'] mirrors the live accent's channels in every theme × boost", () => {
    const { result } = renderHook(() => useTheme(), { wrapper: wrap });
    for (const theme of ["light", "dark"] as const) {
      for (const accent of ["nori", "amber", "mint"] as const) {
        for (const boost of [false, true]) {
          act(() => {
            result.current.setTheme(theme);
            result.current.setAccent(accent);
            result.current.setBoost(boost);
          });
          const hex = result.current.accentColor;
          const channels = `${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}`;
          expect(result.current.colors["color-accent-selected-rgb"]).toBe(channels);
          expect(result.current.colors["color-accent-selected-rgb"]).toBe(ACCENTS_RGB[theme][accent]);
        }
      }
    }
  });

  it("boost overlays only the boost keys (canvas unchanged)", () => {
    const { result } = renderHook(() => useTheme(), { wrapper: wrap });
    act(() => {
      result.current.setTheme("dark");
      result.current.setBoost(true);
    });
    expect(result.current.colors["color-canvas"]).toBe(TOKENS.dark["color-canvas"]);
    // boost dark lifts text ladder per globals.css boost block
    expect(result.current.colors["color-text-primary"]).toBe(TOKENS.boost.dark["color-text-primary"]);
  });

  it("throws when used outside the provider", () => {
    const { result } = renderHook(() => {
      try {
        useTheme();
        return null;
      } catch (e: any) {
        return e.message;
      }
    });
    expect(result.current).toMatch(/useTheme must be used within ThemeProvider/);
  });
});
