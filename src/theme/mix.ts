/**
 * srgb color mixing — the runtime counterpart of the web's
 * `color-mix(in srgb, A x%, B)` tokens (accent-ink convention, accent-deepened
 * fills). Premultiplied-alpha interpolation, CSS Color 5. Lives in theme/ —
 * operates only on inputs (no literals), so the token-literal gate stays clean.
 */

export function parseColor(s: string): { r: number; g: number; b: number; a: number } | null {
  const v = s.trim().toLowerCase();
  if (v === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  if (v === "black") return { r: 0, g: 0, b: 0, a: 1 };
  if (v === "white") return { r: 255, g: 255, b: 255, a: 1 };
  let m = v.match(/^#([0-9a-f]{6})$/i);
  if (m) {
    const h = m[1];
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 };
  }
  m = v.match(/^#([0-9a-f]{3})$/i);
  if (m) return parseColor("#" + m[1].split("").map((c) => c + c).join(""));
  m = v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : parseFloat(m[4]) };
  return null;
}

export function toCss(c: { r: number; g: number; b: number; a: number }): string {
  const r = Math.round(c.r), g = Math.round(c.g), b = Math.round(c.b);
  const a = Number(c.a.toFixed(3));
  return a >= 1
    ? "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")
    : `rgba(${r},${g},${b},${a})`;
}

/** color-mix(in srgb, a weightA%, b (100-weightA)%). Weights are 0–100. */
export function mix(a: string, b: string, weightA: number): string {
  const c1 = parseColor(a);
  const c2 = parseColor(b);
  if (!c1 || !c2) throw new Error(`mix: unparseable input(s) "${a}", "${b}"`);
  let w1 = weightA / 100;
  let w2 = 1 - w1;
  const wSum = w1 + w2; // always 1 here; kept for parity with the generator
  const alpha = c1.a * w1 + c2.a * w2;
  if (alpha <= 0 || wSum <= 0) return "rgba(0,0,0,0)";
  const ch = (k: "r" | "g" | "b") => (c1[k] * c1.a * w1 + c2[k] * c2.a * w2) / alpha;
  return toCss({ r: ch("r"), g: ch("g"), b: ch("b"), a: alpha });
}

/** Accent ink convention (one accent colour has one ink): 55% accent → 45% body ink. */
export function accentInk(accent: string, textPrimary: string): string {
  return mix(accent, textPrimary, 55);
}

/**
 * Selected/primary fill convention: accent deepened toward black. `pct` is
 * the percent TOWARD BLACK — the web's `color-mix(in srgb, accent X%, black)`
 * equals pct = 100 − X (e.g. SoftButton primary: web X=60 ⇒ pct=40, the
 * measured-AA fill 4.60–8.33:1 dark / 7.12–12.52:1 light).
 */
export function accentDeepened(accent: string, pct: number): string {
  return mix(accent, "black", 100 - pct);
}
