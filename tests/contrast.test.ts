import { contrastRatio, toRgb } from "../src/lib/contrast";

describe("contrastRatio", () => {
  it("scores white on black at 21:1", () => {
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 0);
  });

  it("accepts shorthand hex", () => {
    expect(contrastRatio("#fff", "#000")).toBeCloseTo(21, 0);
  });

  it("accepts rgba with alpha = 1", () => {
    expect(contrastRatio("rgba(255,255,255,1)", "#000000")).toBeCloseTo(21, 0);
  });

  it("REJECTS translucent colors (composite first, never measure through glass)", () => {
    expect(() => contrastRatio("rgba(136,146,170,0.5)", "#000000")).toThrow(
      /translucent/
    );
  });

  it("throws on unparseable input", () => {
    expect(() => toRgb("banana")).toThrow(/unparseable/);
  });

  it("round-trips known token pair: dark muted on canvas clears 4.5:1", () => {
    expect(contrastRatio("#8892aa", "#0f1117")).toBeGreaterThanOrEqual(4.5);
  });

  it("round-trips light token pair: light muted on canvas clears 4.5:1", () => {
    expect(contrastRatio("#5c5c5c", "#f5f6fa")).toBeGreaterThanOrEqual(4.5);
  });
});
