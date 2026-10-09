#!/usr/bin/env node
/**
 * Token codegen: parses ../Home-ai/src/app/globals.css into a typed, committed
 * TS module (src/theme/tokens.generated.ts) + JSON snapshot
 * (src/theme/tokens.snapshot.json). tokens:check (--check) regenerates
 * in-memory and diffs against the committed files — both fail loud (exit 1)
 * when Home-ai's tokens move. That is the contract, not an error.
 *
 * Canonical blocks (brief, Task 3):
 *   dark        = `:root` base (incl. `@theme` — Tailwind v4 emits it to :root)
 *                 and bare-`:root` / `:root:not([data-theme="light"])` blocks
 *   light       = `:root[data-theme="light"]` / `:root:not([data-theme="dark"])`
 *   boost dark  = `:root:not([data-theme="light"])[data-contrast="boost"]`
 *   boost light = `:root[data-theme="light"][data-contrast="boost"]`
 *   accents     = per-accent `:root[data-accent="<n>"]` channel triples and the
 *                 `:root[data-theme="light"][data-accent="<n>"]` light table.
 * Blocks nested in @media are skipped (they duplicate the canonical ones).
 *
 * Value rules: (a) captured literally; (b) var(--x) resolves against the same
 * block's map, then the base map (two-pass via raw merge + recursive resolve);
 * (c) color-mix() is preserved verbatim under GENERATED.raw AND resolved to
 * rgba/hex where both mix inputs are constant (premultiplied srgb math).
 *
 * Home-ai is READ-ONLY. Never modify anything under ../Home-ai.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const SOURCE = join(ROOT, "..", "Home-ai", "src", "app", "globals.css");
const OUT_TS = join(ROOT, "src", "theme", "tokens.generated.ts");
const OUT_JSON = join(ROOT, "src", "theme", "tokens.snapshot.json");
const CHECK = process.argv.includes("--check");

/* ── Ground truth (brief Task 3, verified 2026-10-09 against warm-glass-v2).
      If Home-ai's tokens move, these diffs are the loud failure. ── */
const PINNED_TOKENS = {
  dark: {
    "color-canvas": "#0f1117",
    "color-surface-0": "#0f1117",
    "color-surface-1": "#181c24",
    "color-text-primary": "#f0f4ff",
    "color-text-muted": "#8892aa",
    "color-text-dim": "#828da6",
    "radius-md": "16px",
    "glass-tint-strong": "rgba(255,255,255,0.10)",
    "motion-fast": "150ms",
    "motion-base": "240ms",
    "motion-slow": "400ms",
    "motion-glide": "600ms",
    "color-gradient-start": "#b583ff",
    "color-gradient-end": "#ff6b8a",
  },
  light: {
    "color-canvas": "#f5f6fa",
    "color-surface-0": "#ffffff",
    "color-surface-1": "#f8f9fb",
    "color-text-primary": "#1a1a1a",
    "color-text-muted": "#5c5c5c",
    "color-text-dim": "#606060",
    "radius-md": "16px",
    "glass-tint-strong": "rgba(255,255,255,0.78)",
    "motion-fast": "150ms",
    "motion-base": "240ms",
    "motion-slow": "400ms",
    "motion-glide": "600ms",
    "color-gradient-start": "#7c3aed",
    "color-gradient-end": "#e11d48",
  },
};
const PINNED_ACCENTS = {
  dark: {
    nori: "#3b82f6", violet: "#7c6ff7", rose: "#f43f5e", cyan: "#06b6d4",
    mint: "#4ade80", amber: "#f59e0b", coral: "#fb7185", lavender: "#a78bfa",
    apricot: "#fb923c", sage: "#84cc16",
  },
  light: {
    nori: "#2563eb", violet: "#7c3aed", rose: "#e11d48", cyan: "#0891b2",
    mint: "#059669", amber: "#d97706", coral: "#e11d48", lavender: "#6d28d9",
    apricot: "#ea580c", sage: "#65a30d",
  },
};
const PINNED_GRADIENTS = {
  dark: {
    "gradient-canvas-dawn": "linear-gradient(160deg, rgba(251,207,232,0.22), rgba(254,215,170,0.14), rgba(254,243,199,0.08))",
    "gradient-canvas-day": "linear-gradient(160deg, rgba(219,234,254,0.18), rgba(224,242,254,0.12), rgba(240,253,244,0.08))",
    "gradient-canvas-dusk": "linear-gradient(160deg, rgba(253,230,138,0.16), rgba(253,164,175,0.12), rgba(196,181,253,0.12))",
    "gradient-canvas-night": "linear-gradient(160deg, rgba(30,27,75,0.42), rgba(49,46,129,0.30), rgba(15,23,42,0.42))",
  },
  light: {
    "gradient-canvas-dawn": "linear-gradient(160deg, rgba(251,207,232,0.72), rgba(254,215,170,0.52), rgba(254,243,199,0.38))",
    "gradient-canvas-day": "linear-gradient(160deg, rgba(219,234,254,0.70), rgba(224,242,254,0.50), rgba(240,253,244,0.42))",
    "gradient-canvas-dusk": "linear-gradient(160deg, rgba(253,230,138,0.60), rgba(253,164,175,0.48), rgba(196,181,253,0.50))",
    "gradient-canvas-night": "linear-gradient(160deg, rgba(30,27,75,0.72), rgba(49,46,129,0.62), rgba(15,23,42,0.72))",
  },
};

/* ── CSS block extraction ── */

function parseRules(css, context) {
  const rules = [];
  let i = 0;
  const n = css.length;
  while (i < n) {
    const open = css.indexOf("{", i);
    if (open === -1) break;
    const rawPrelude = css.slice(i, open);
    // prelude may trail a previous statement (`@import …;`) — keep the tail
    const prelude = rawPrelude.split(";").pop().replace(/\s+/g, " ").trim();
    let depth = 1;
    let j = open + 1;
    while (j < n && depth > 0) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}") depth--;
      j++;
    }
    const body = css.slice(open + 1, j - 1);
    rules.push({ prelude, body, context });
    if (/^@(media|supports|layer|container)\b/.test(prelude)) {
      rules.push(...parseRules(body, [...context, prelude]));
    }
    i = j;
  }
  return rules;
}

function classifySelector(sel) {
  if (sel === ":root" || sel === "@theme") return "base";
  if (sel === ":root:not([data-theme=\"light\"])") return "base"; // dark base
  if (sel === ":root[data-theme=\"light\"]") return "light";
  if (sel === ":root:not([data-theme=\"dark\"])") return "light"; // pre-hydration light
  if (sel === ":root:not([data-theme=\"light\"])[data-contrast=\"boost\"]") return "boostDark";
  if (sel === ":root[data-theme=\"light\"][data-contrast=\"boost\"]") return "boostLight";
  let m = sel.match(/^:root\[data-theme="light"\]\[data-accent="(\w+)"\]$/);
  if (m) return "accentLight:" + m[1];
  m = sel.match(/^:root\[data-accent="(\w+)"\]$/);
  if (m) return "accentDark:" + m[1];
  return null;
}

const DECL_RE = /(--[\w-]+)\s*:\s*([^;]+);/g;

function extract(css) {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = parseRules(stripped, []);
  const raw = { base: {}, light: {}, boostDark: {}, boostLight: {} };
  const accentRgb = { dark: {}, light: {} };
  for (const rule of rules) {
    if (rule.context.some((c) => /^@media/.test(c))) continue;
    for (const part of rule.prelude.split(",")) {
      const cls = classifySelector(part.trim());
      if (!cls) continue;
      DECL_RE.lastIndex = 0;
      let d;
      while ((d = DECL_RE.exec(rule.body))) {
        const key = d[1].slice(2);
        const value = d[2].replace(/\s+/g, " ").trim();
        if (cls.startsWith("accentDark:")) {
          if (key === "color-accent-selected-rgb") accentRgb.dark[cls.slice(11)] = value;
        } else if (cls.startsWith("accentLight:")) {
          if (key === "color-accent-selected-rgb") accentRgb.light[cls.slice(12)] = value;
        } else {
          raw[cls][key] = value; // source order: later wins
        }
      }
    }
  }
  return { raw, accentRgb };
}

/* ── Resolution: var() (same block first, then base — the raw merge IS that
     two-pass), then color-mix() where both inputs are constant. ── */

function resolveView(rawView) {
  const out = {};
  const resolveKey = (key, seen) => {
    if (!(key in rawView)) return undefined;
    const value = rawView[key].replace(
      /var\((--[\w-]+)\s*(?:,\s*([^)]*))?\)/g,
      (whole, name, fallback) => {
        const bare = name.slice(2);
        if (seen.has(bare)) return whole; // cycle guard
        const inner = resolveKey(bare, new Set([...seen, bare]));
        if (inner !== undefined) return inner;
        if (fallback !== undefined) return fallback.trim();
        return whole; // unresolvable (e.g. --font-geist-sans): keep literal
      }
    );
    return value.trim();
  };
  for (const key of Object.keys(rawView)) out[key] = resolveKey(key, new Set([key]));
  return out;
}

function parseColor(s) {
  s = s.trim().toLowerCase();
  if (s === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  if (s === "black") return { r: 0, g: 0, b: 0, a: 1 };
  if (s === "white") return { r: 255, g: 255, b: 255, a: 1 };
  let m = s.match(/^#([0-9a-f]{6})$/);
  if (m) {
    const h = m[1];
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 };
  }
  m = s.match(/^#([0-9a-f]{3})$/);
  if (m) {
    const h = m[1].split("").map((c) => c + c).join("");
    return parseColor("#" + h);
  }
  m = s.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
  if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
  return null;
}

const MIX_RE = /color-mix\(\s*in srgb\s*,\s*([^,]+?)\s+([\d.]+)%\s*,\s*([^,]+?)\s*(?:([\d.]+)%)?\s*\)/g;

function resolveMixes(value) {
  return value.replace(MIX_RE, (whole, c1s, w1s, c2s, w2s) => {
    const c1 = parseColor(c1s);
    const c2 = parseColor(c2s);
    if (!c1 || !c2) return whole; // inputs not constant — keep the string
    let w1 = +w1s / 100;
    let w2 = w2s === undefined ? 1 - w1 : +w2s / 100;
    const wSum = w1 + w2;
    const scale = wSum > 0 ? Math.min(wSum, 1) : 1;
    w1 /= wSum;
    w2 /= wSum;
    const a = (c1.a * w1 + c2.a * w2) * scale;
    if (a <= 0) return "rgba(0,0,0,0)";
    // premultiplied interpolation, then un-premultiply (CSS Color 5)
    const ch = (k) => Math.round((c1[k] * c1.a * w1 + c2[k] * c2.a * w2) / a);
    const r = ch("r"), g = ch("g"), b = ch("b");
    if (Math.abs(a - 1) < 1e-6) {
      return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
    }
    return `rgba(${r},${g},${b},${Number(a.toFixed(3))})`;
  });
}

function resolveAll(rawView) {
  const varResolved = resolveView(rawView);
  const values = {};
  const raw = {};
  for (const [key, value] of Object.entries(varResolved)) {
    if (value.includes("color-mix(")) raw[key] = rawView[key]; // verbatim original
    values[key] = resolveMixes(value);
  }
  return { values, raw };
}

/* ── Pinned ground-truth verification (fail LOUD when Home-ai moves) ── */

function verifyPinned(tokens, accents) {
  const diffs = [];
  const expect = (path, actual, wanted) => {
    if (actual === undefined) diffs.push(`MISSING ${path} (expected ${want(wanted)})`);
    else if (actual !== wanted) diffs.push(`DIFF ${path}: got ${want(actual)} — expected ${want(wanted)}`);
  };
  const want = (v) => JSON.stringify(v);
  for (const theme of ["dark", "light"]) {
    for (const [key, v] of Object.entries(PINNED_TOKENS[theme])) {
      expect(`tokens.${theme}["${key}"]`, tokens[theme][key], v);
    }
    for (const [key, v] of Object.entries(PINNED_GRADIENTS[theme])) {
      expect(`tokens.${theme}["${key}"]`, tokens[theme][key], v);
    }
    for (const [name, v] of Object.entries(PINNED_ACCENTS[theme])) {
      expect(`accents.${theme}.${name}`, accents[theme][name], v);
    }
  }
  return diffs;
}

/* ── Main ── */

function main() {
  if (!existsSync(SOURCE)) {
    console.error(
      `gen-tokens: source not found: ${SOURCE}\n` +
        "Expected a sibling checkout of Home-ai (../Home-ai/src/app/globals.css). " +
        "Home-native's tokens are generated FROM Home-ai — ask the human where it lives."
    );
    process.exit(1);
  }
  const css = readFileSync(SOURCE, "utf8");
  const { raw, accentRgb } = extract(css);

  const darkView = { ...raw.base };
  const lightView = { ...raw.base, ...raw.light };
  const boostDarkView = { ...raw.base, ...raw.boostDark };
  const boostLightView = { ...raw.base, ...raw.light, ...raw.boostLight };

  const dark = resolveAll(darkView);
  const light = resolveAll(lightView);
  const boostDark = resolveAll(boostDarkView);
  const boostLight = resolveAll(boostLightView);
  const pick = (values, keys) => Object.fromEntries(keys.map((k) => [k, values[k]]));

  const tokens = {
    dark: dark.values,
    light: light.values,
    boost: {
      dark: pick(boostDark.values, Object.keys(raw.boostDark)),
      light: pick(boostLight.values, Object.keys(raw.boostLight)),
    },
  };
  const rawMirror = {
    dark: dark.raw,
    light: light.raw,
    boost: {
      dark: pick(boostDark.raw, Object.keys(raw.boostDark)),
      light: pick(boostLight.raw, Object.keys(raw.boostLight)),
    },
  };

  const accentNames = Object.keys(PINNED_ACCENTS.dark);
  const accents = {
    dark: Object.fromEntries(accentNames.map((n) => [n, dark.values["color-accent-" + n]])),
    light: Object.fromEntries(accentNames.map((n) => [n, light.values["color-accent-" + n]])),
  };
  const accentsRgb = {
    dark: Object.fromEntries(accentNames.map((n) => [n, accentRgb.dark[n]])),
    light: Object.fromEntries(accentNames.map((n) => [n, accentRgb.light[n]])),
  };

  const diffs = verifyPinned(tokens, accents);
  for (const theme of ["dark", "light"]) {
    for (const n of accentNames) {
      if (accentsRgb[theme][n] === undefined) {
        diffs.push(`MISSING accentsRgb.${theme}.${n} (per-accent rgb table incomplete)`);
      }
    }
  }
  if (diffs.length) {
    console.error(
      "gen-tokens: Home-ai's tokens moved — regen FAILED LOUD (this is the contract):\n  " +
        diffs.join("\n  ") +
        `\nSource: ${relative(ROOT, SOURCE)}`
    );
    process.exit(1);
  }

  const generated = {
    meta: {
      source: "Home-ai/src/app/globals.css",
      generator: "scripts/gen-tokens.mjs",
      note: "AUTO-GENERATED — do not hand-edit. Regen: npm run tokens:gen; verify: npm run tokens:check.",
    },
    tokens,
    raw: rawMirror,
    accents,
    accentsRgb,
  };

  const tsText =
    "// AUTO-GENERATED by scripts/gen-tokens.mjs from ../Home-ai/src/app/globals.css — DO NOT EDIT.\n" +
    "// Regenerate: `npm run tokens:gen`. Verify drift: `npm run tokens:check` (fails loud).\n" +
    "export const GENERATED = " +
    JSON.stringify(generated, null, 2) +
    " as const;\n";
  const jsonText = JSON.stringify(generated, null, 2) + "\n";

  if (CHECK) {
    const drift = [];
    for (const [path, text] of [[OUT_TS, tsText], [OUT_JSON, jsonText]]) {
      if (!existsSync(path) || readFileSync(path, "utf8") !== text) {
        drift.push(relative(ROOT, path));
      }
    }
    if (drift.length) {
      console.error(
        "gen-tokens --check: committed generated files are STALE:\n  " +
          drift.join("\n  ") +
          "\nRun `npm run tokens:gen` and commit the result."
      );
      process.exit(1);
    }
  } else {
    mkdirSync(dirname(OUT_TS), { recursive: true });
    writeFileSync(OUT_TS, tsText);
    writeFileSync(OUT_JSON, jsonText);
  }
  console.log(
    `gen-tokens: ${CHECK ? "CHECK OK" : "wrote src/theme/tokens.generated.ts + tokens.snapshot.json"}` +
      ` (dark=${Object.keys(tokens.dark).length} light=${Object.keys(tokens.light).length}` +
      ` boost=${Object.keys(tokens.boost.dark).length}+${Object.keys(tokens.boost.light).length}` +
      ` accents=${accentNames.length}x2 rawMixes=${Object.keys(rawMirror.dark).length}+${Object.keys(rawMirror.light).length})`
  );
}

main();
