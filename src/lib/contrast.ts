/**
 * WCAG 2.x contrast between two opaque colors: "#rgb" | "#rrggbb" |
 * "rgb(r,g,b)" | "rgba(r,g,b,1)". Translucent colors are rejected on purpose:
 * a contrast measured THROUGH glass is meaningless — composite first, then
 * measure. Used by theme/primitive contract tests (plan Task 2+).
 */
export function contrastRatio(fg: string, bg: string): number {
  const luminance = (c: string): number => {
    const [r, g, b] = toRgb(c);
    const channel = (v: number) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  };
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

export function toRgb(c: string): [number, number, number] {
  const v = c.trim();
  if (/^#[0-9a-f]{3}$/i.test(v)) {
    return [
      parseInt(v[1] + v[1], 16),
      parseInt(v[2] + v[2], 16),
      parseInt(v[3] + v[3], 16),
    ];
  }
  if (/^#[0-9a-f]{6}$/i.test(v)) {
    return [
      parseInt(v.slice(1, 3), 16),
      parseInt(v.slice(3, 5), 16),
      parseInt(v.slice(5, 7), 16),
    ];
  }
  const m = v.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/i
  );
  if (m) {
    if (m[4] !== undefined && parseFloat(m[4]) !== 1) {
      throw new Error(
        `contrastRatio: translucent colors unsupported, composite first: "${c}"`
      );
    }
    return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
  }
  throw new Error(`contrastRatio: unparseable color "${c}"`);
}
