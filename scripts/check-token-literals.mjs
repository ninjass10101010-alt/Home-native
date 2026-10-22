#!/usr/bin/env node
/**
 * Token-literal ban gate (design contract: tokens are the only color source).
 * Fails (exit 1) if any hex (#abc/#abcdef…#aabbccdd) or rgb()/rgba() literal
 * appears in the scanned roots OUTSIDE src/theme/tokens.generated.ts.
 *
 * Usage: node scripts/check-token-literals.mjs [roots...] [--check]
 *   roots    space-separated dirs/files to scan (default: app src)
 *   --check  reserved for Task 3 (regeneration check composes here); accepted
 *            and ignored for now so package.json can wire it once.
 * Comment-only lines (//, /*, *) are skipped.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const args = process.argv.slice(2).filter((a) => a !== "--check");
const ROOTS = args.length ? args : ["app", "src"];
const ALLOW = new Set([
  "src/theme/tokens.generated.ts",
  // Token-level descriptor tables (the .material-* CSS-class contract is not a
  // custom property, so the generator can't emit it). Specular helpers too.
  "src/theme/materials.ts",
  // Token math (zero-alpha sentinel string is a helper, not a design color).
  "src/theme/mix.ts",
  // Music-surface palette (SP2): Shiny's Liquid palette as a token module —
  // the colour SOURCE for /music, so the ban applies downstream of it.
  "src/theme/music-tokens.ts",
]);
const PATTERN = /#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+/g;
const COMMENT_LINE = /^\s*(\/\/|\/\*|\*)/;

const hits = [];

function walk(p) {
  let st;
  try {
    st = statSync(p);
  } catch {
    return; // root may not exist yet (e.g. app/ in early tasks)
  }
  if (st.isDirectory()) {
    if (p.split("/").includes("node_modules")) return;
    for (const name of readdirSync(p)) walk(join(p, name));
    return;
  }
  if (![".ts", ".tsx"].includes(extname(p))) return;
  if (ALLOW.has(p)) return;
  readFileSync(p, "utf8")
    .split("\n")
    .forEach((line, i) => {
      if (COMMENT_LINE.test(line)) return;
      PATTERN.lastIndex = 0;
      if (PATTERN.test(line)) hits.push(`${p}:${i + 1}: ${line.trim()}`);
    });
}

ROOTS.forEach(walk);

if (hits.length) {
  console.error(
    `token-literal ban: ${hits.length} hit(s) — use theme tokens:\n` +
      hits.join("\n")
  );
  process.exit(1);
}
console.log(`token-literal ban: CLEAN (${ROOTS.join(" ")})`);
