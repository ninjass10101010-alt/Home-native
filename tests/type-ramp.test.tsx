/**
 * WS-0 critic round 2 HIGH 4 / L1 / L2 — the type ramp is a CONTRACT, not a
 * per-call-site decision: one field-label system, one page masthead (a real
 * bundled serif at weight 400), and distinct levels for section headers, in-card
 * headings and data.
 */
import { TYPOGRAPHY, FONTS } from "../src/theme/tokens";
import { parseColor } from "../src/theme/mix";

describe("type contract (L1 / L2 / HIGH 4)", () => {
  it("ONE field label system, pinned", () => {
    expect(TYPOGRAPHY.fieldLabel).toMatchObject({
      fontSize: 14,
      fontWeight: "700",
      letterSpacing: 1.2,
      textTransform: "uppercase",
    });
  });
  it("the display ramp is a real bundled serif face (never the generic fallback)", () => {
    expect(FONTS.display).toBe("Instrument Serif");
    expect(TYPOGRAPHY.display.fontFamily).toBe(FONTS.display);
    expect(TYPOGRAPHY.display.fontWeight).toBe("400");
    expect(TYPOGRAPHY.display.letterSpacing).toBeLessThan(0);
    expect(TYPOGRAPHY.display.fontSize).toBeGreaterThan(TYPOGRAPHY.sectionTitle.fontSize);
  });
  it("section headers outrank in-card headings, which outrank body (L2)", () => {
    expect(TYPOGRAPHY.sectionTitle.fontSize).toBeGreaterThan(TYPOGRAPHY.title.fontSize);
    expect(TYPOGRAPHY.title.fontSize).toBeGreaterThan(TYPOGRAPHY.body.fontSize);
  });
  it("parseColor still round-trips the rgba the composite maths relies on", () => {
    expect(parseColor("rgba(30,27,75,0.42)")).toEqual({ r: 30, g: 27, b: 75, a: 0.42 });
  });
});
