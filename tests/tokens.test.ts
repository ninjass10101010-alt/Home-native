import { TOKENS, ACCENTS, TYPOGRAPHY, RADII, MOTION } from "../src/theme/tokens";
import snap from "../src/theme/tokens.snapshot.json";

describe("tokens", () => {
  it("pins dark truth", () => {
    expect(TOKENS.dark["color-canvas"]).toBe("#0f1117");
    expect(TOKENS.dark["color-text-muted"]).toBe("#a3adc4"); // final cascade (globals.css:465-503 lifts the ladder)
    expect(TOKENS.dark["color-text-secondary"]).toBe("#a8b2c8");
    expect(TOKENS.dark["color-text-dim"]).toBe("#a0aac2");
    expect(TOKENS.dark["glass-tint-strong"]).toBe("rgba(255,255,255,0.10)");
  });
  it("pins light truth", () => {
    expect(TOKENS.light["color-canvas"]).toBe("#f5f6fa");
    expect(TOKENS.light["color-text-muted"]).toBe("#5c5c5c");
  });
  it("pins all 10 accents, both themes", () => {
    expect(Object.keys(ACCENTS)).toHaveLength(10);
    expect(ACCENTS.dark.nori).toBe("#3b82f6");
    expect(ACCENTS.light.sage).toBe("#65a30d");
  });
  it("generated module matches the committed snapshot byte-for-byte (regen is deterministic)", () => {
    expect(JSON.parse(JSON.stringify(TOKENS))).toEqual(snap.tokens);
  });
  it("wall type floor: nothing under 14sp exists in the scale", () => {
    expect(Math.min(...Object.values(TYPOGRAPHY).map((t) => t.fontSize))).toBeGreaterThanOrEqual(14);
  });
  it("pins motion + radii", () => {
    expect(MOTION).toMatchObject({ fast: 150, base: 240, slow: 400, glide: 600 });
    expect(RADII).toMatchObject({ sm: 10, md: 16, lg: 20, xl: 28, xxl: 36, full: 9999 });
  });
});
