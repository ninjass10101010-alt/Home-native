// Home-native/tests/weather/astro.test.ts
import { moonPhase, moonPhaseName, moonLitPath, nextMoonEvents } from "../../src/weather/astro";

describe("moon math (weather-astro.ts:11-44 verbatim port)", () => {
  it("reference new moon epoch lands at phase 0", () => {
    const { phase, illumination } = moonPhase(Date.UTC(2000, 0, 6, 18, 14));
    expect(phase).toBeLessThan(0.001);
    expect(illumination).toBeLessThan(0.001);
  });
  it("phase names at the 8 canonical points", () => {
    expect(moonPhaseName(0.0)).toBe("New Moon");
    expect(moonPhaseName(0.12)).toBe("Waxing Crescent");
    expect(moonPhaseName(0.25)).toBe("First Quarter");
    expect(moonPhaseName(0.4)).toBe("Waxing Gibbous");
    expect(moonPhaseName(0.5)).toBe("Full Moon");
    expect(moonPhaseName(0.6)).toBe("Waning Gibbous");
    expect(moonPhaseName(0.75)).toBe("Last Quarter");
    expect(moonPhaseName(0.9)).toBe("Waning Crescent");
  });
  it("lit path is an SVG path with the epsilon arc", () => {
    expect(moonLitPath(0.25, 80)).toMatch(/^M 0 -80 A 80 80 0 0 1 0 80 A /);
  });
  it("nextMoonEvents finds both dates within 30 days", () => {
    const { nextFullISO, nextNewISO } = nextMoonEvents(Date.now());
    expect(nextFullISO).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(nextNewISO).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const days = (iso: string) => (Date.parse(iso + "T12:00:00Z") - Date.now()) / 86400000;
    expect(days(nextFullISO!)).toBeGreaterThan(0);
    expect(days(nextFullISO!)).toBeLessThanOrEqual(31);
    expect(days(nextNewISO!)).toBeGreaterThan(0);
    expect(days(nextNewISO!)).toBeLessThanOrEqual(31);
  });
});
