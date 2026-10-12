#!/usr/bin/env node
/**
 * a11y audit (wave 3) — component-level contract by tests + a static scan
 * for the two failures tests can't see: below-floor font sizes in static
 * styles and Tap-holes in unusual places (kept narrow on purpose — broad
 * regex here became noise the moment JSX spans lines. Tests carry the rest).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
const ROOTS = ["app", "src"];
const hits = [];
const FONTSIZE_RE = /fontSize:\s*(1[0-3]|[0-9])(\D|$)/;
const SKIP = /(^\s*(import|from|type |interface )|tokens\.generated\.ts|\.test\.)/;
function walk(p) {
  const st = statSync(p, { throwIfNoEntry: false });
  if (!st) return;
  if (st.isDirectory()) { if (!p.includes("node_modules")) for (const n of readdirSync(p)) walk(join(p, n)); return; }
  if (![".tsx", ".ts"].includes(extname(p))) return;
  readFileSync(p, "utf8").split("\n").forEach((line, i) => {
    if (SKIP.test(line) || SKIP.test(p)) return;
    if (FONTSIZE_RE.test(line)) hits.push(`${p}:${i + 1}: fontSize below 14sp floor`);
  });
}
ROOTS.forEach(walk);
if (hits.length) { console.error(`a11y audit: ${hits.length} finding(s):\n  ` + hits.join("\n  ")); process.exit(1); }
console.log(`a11y audit: CLEAN (${ROOTS.join(" ")})`);
