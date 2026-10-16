#!/usr/bin/env node
/**
 * assert-painted-discs.mjs — the paint-presence gate for the wall's widget
 * header discs (WS-0 round 2, D-14).
 *
 * 53/53 tests passed while 9 of 10 wall discs rendered as empty tinted
 * circles: `tests/widget-frame.test.tsx` asserted an `<Svg>` node EXISTS inside
 * the disc, which is a statement about the tree, not about the pixels. This
 * renders the real wall in a browser, samples the INTERIOR of every disc and
 * fails when a disc has no measurable variance — which is what a dropped
 * subtree (a `<Defs>` gradient ref that never resolves, an overlay painting
 * over the artwork, a `zIndex` regression) looks like on screen.
 *
 * Pass condition, per disc and per theme: per-channel σ ≥ 12 OR a relative-
 * luminance span ≥ 0.05 across the interior. Method is the critic's.
 *
 * Wired into `npm test` as `npm run paint:audit`. If the Expo web preview is
 * not running it prints a loud SKIP banner and exits 0 — a test suite must not
 * need a dev server — but any dev server that IS up is held to the gate.
 *
 * Usage: node scripts/assert-painted-discs.mjs [--base <url>] [--route <path>]
 */
import { chromium } from "playwright";

const args = process.argv.slice(2);
const flag = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? def : args[i + 1];
};
const BASE = flag("base", process.env.BASE || "http://localhost:3200");
const ROUTE = flag("route", "/");
const THEMES = ["dark", "light"];

/**
 * Per-channel σ floor (0–255) and relative-luminance span floor across the
 * disc interior — the critic's discriminator. Reported as evidence for every
 * disc, but NOT sufficient on their own: in light theme a disc with NO
 * artwork at all still spans 0.18 relY / 0.065 σ because its own 3-stop tone
 * wash is a gradient, and that false-passes the very regression this gate
 * exists to catch.
 */
const SIGMA_MIN = 12;
const RELY_SPAN_MIN = 0.05;
/**
 * Hard-edge floor, the pass condition. Artwork draws a hard edge; a wash
 * gradient cannot. Measured on the product wall, 24%-inset disc interiors:
 *   empty disc  : σ 3.0–4.9, relY span 0.009–0.184, range 50–66
 *   painted disc: σ 45.7–78.2, relY span 0.497–0.895, range 161–250
 * 100 sits in the empty gap and still leaves a 61/255 margin.
 */
const RANGE_MIN = 100;

const SAMPLER = `(regions) => new Promise(async (resolve) => {
  const img = new Image();
  img.src = "data:image/png;base64," + window.__shotB64;
  await img.decode();
  const cv = document.createElement("canvas");
  cv.width = img.width; cv.height = img.height;
  const g = cv.getContext("2d", { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const chan = (v) => { const s = v/255; return s <= 0.03928 ? s/12.92 : Math.pow((s+0.055)/1.055, 2.4); };
  const relY = (r, gg, b) => 0.2126*chan(r) + 0.7152*chan(gg) + 0.0722*chan(b);
  resolve(regions.map((reg) => {
    const d = g.getImageData(reg.x, reg.y, reg.w, reg.h).data;
    const R = [], G = [], B = [], Y = [];
    for (let i = 0; i < d.length; i += 4) {
      R.push(d[i]); G.push(d[i+1]); B.push(d[i+2]);
      Y.push(relY(d[i], d[i+1], d[i+2]));
    }
    const sd = (a) => { const m = a.reduce((x,y)=>x+y,0)/a.length; return Math.sqrt(a.reduce((x,y)=>x+(y-m)*(y-m),0)/a.length); };
    const hi = Math.max(Math.max(...R), Math.max(...G), Math.max(...B));
    const lo = Math.min(Math.min(...R), Math.min(...G), Math.min(...B));
    return { sdMax: Math.max(sd(R), sd(G), sd(B)), relYSpan: Math.max(...Y) - Math.min(...Y), range: hi - lo };
  }));
})`;

async function audit(browser) {
  const failures = [];
  let checked = 0;

  for (const theme of THEMES) {
    const ctx = await browser.newContext({
      viewport: { width: 1080, height: 1920 },
      hasTouch: true,
      deviceScaleFactor: 1,
    });
    await ctx.addInitScript((t) => {
      window.localStorage.setItem("consuela-theme", t);
      window.localStorage.setItem("consuela-boost", "0");
      window.localStorage.setItem("consuela-accent", "nori");
    }, theme);
    const page = await ctx.newPage();
    await page.goto(`${BASE}${ROUTE}`, { waitUntil: "networkidle", timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(2000);

    const regions = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-testid$="-icon-disc"]')).map((el) => {
        const b = el.getBoundingClientRect();
        // 24% inset keeps the sample box inside the 38dp artwork inside the
        // 52dp disc, so the surrounding wash cannot fake the variance.
        const inset = Math.round(b.width * 0.24);
        return {
          id: el.getAttribute("data-testid"),
          x: Math.round(b.x) + inset,
          y: Math.round(b.y) + inset,
          w: Math.max(4, Math.round(b.width) - inset * 2),
          h: Math.max(4, Math.round(b.height) - inset * 2),
        };
      })
    );

    if (!regions.length) {
      failures.push(`${theme}: no [data-testid$="-icon-disc"] found on ${ROUTE} — the gate cannot see the discs`);
    }

    const shot = await page.screenshot({ fullPage: true });
    await page.evaluate((b64) => { window.__shotB64 = b64; }, shot.toString("base64"));
    const stats = regions.length ? await page.evaluate(`(${SAMPLER})(${JSON.stringify(regions)})`) : [];

    regions.forEach((reg, i) => {
      checked += 1;
      const s = stats[i] ?? { sdMax: 0, relYSpan: 0 };
      const painted = s.range >= RANGE_MIN;
      const verdict = painted ? "painted" : "EMPTY";
      console.log(`  ${theme.padEnd(5)} ${reg.id.padEnd(26)} σ ${s.sdMax.toFixed(1).padStart(5)}  relY span ${s.relYSpan.toFixed(4)}  range ${String(s.range).padStart(5)}  ${verdict}`);
      if (!painted) {
        failures.push(
          `${theme}: ${reg.id} rendered EMPTY (σ ${s.sdMax.toFixed(1)} < ${SIGMA_MIN}, relY span ${s.relYSpan.toFixed(4)} < ${RELY_SPAN_MIN}, range ${s.range} < ${RANGE_MIN})`
        );
      }
    });

    await ctx.close();
  }
  return { checked, failures };
}

async function main() {
  let browser;
  try {
    browser = await chromium.launch();
    await browser.newContext().then((c) => c.close());
  } catch {
    console.error("paint audit: playwright/chromium unavailable — SKIP");
    return 0;
  }
  const probe = await fetch(BASE).catch(() => null);
  if (!probe || !probe.ok) {
    console.log("");
    console.log("╔══════════════════════════════════════════════════════════════════╗");
    console.log("║ paint audit SKIPPED — no Expo web preview on " + BASE.padEnd(27) + " ║");
    console.log("║ Run `npx expo start --web --port 3200` to hold the gate.        ║");
    console.log("╚══════════════════════════════════════════════════════════════════╝");
    console.log("");
    await browser.close();
    return 0;
  }

  console.log(`paint audit: sampling widget disc interiors from ${BASE}${ROUTE}`);
  const { checked, failures } = await audit(browser);
  await browser.close();

  if (!checked) {
    console.error("paint audit: FAILED — 0 discs sampled");
    return 1;
  }
  if (failures.length) {
    console.error("");
    console.error(`paint audit: FAILED — ${failures.length} of ${checked} disc(s) do not paint:`);
    for (const f of failures) console.error(`  - ${f}`);
    console.error("  A disc that exists in the tree but paints nothing is a dropped");
    console.error("  subtree: check for `fill=\"url(#…)\"` gradient refs, an opaque");
    console.error("  overlay painting over the artwork, or the disc's zIndex ladder.");
    return 1;
  }
  console.log(`paint audit: CLEAN (${checked} discs across ${THEMES.length} themes)`);
  return 0;
}

process.exit(await main());
