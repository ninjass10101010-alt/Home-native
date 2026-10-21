#!/usr/bin/env node
/**
 * capture-reference.mjs — wave the PWA (Home-ai, warm-glass-v2) through the
 * core-hub route × auth × theme matrix at the WALL viewport and write the
 * ground-truth PNGs the critic loop judges against.
 *
 * Prereq: a Home-ai dev server reachable at --base (default http://localhost:3100 —
 * start one with `cd ../Home-ai && PORT=3100 npm run dev`). The script FAILS
 * if it can't reach it.
 *
 * Output: reference/<route-safe>/<auth>-<theme>.png  (gitignored — family data)
 *
 * Auth:
 *   guest  — no cookie
 *   child  — quick-login as a PIN-free child (server decides; under-10 only)
 *   parent — minted session cookie (HMAC) using SESSION_SECRET read DIRECTLY
 *            from ../Home-ai/.env.local (local-only; value never printed/committed)
 *
 * Usage: node scripts/capture-reference.mjs [--base URL] [--only route] [--auth guest|child|parent] [--theme light|dark|dark-boost]
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "reference");
const HOME_AI = join(ROOT, "..", "Home-ai");

const args = process.argv.slice(2);
const flag = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? def : args[i + 1];
};
const BASE = flag("base", "http://localhost:3100");
const ONLY = flag("only", null);
const AUTH_ONLY = flag("auth", null);
const THEME_ONLY = flag("theme", null);

const ROUTES = [
  ["home", "/"],
  ["calendar", "/calendar"],
  ["meals", "/meals"],
  ["tasks", "/tasks"],
  ["photos", "/photos"],
  ["emergency", "/emergency"],
  ["settings", "/settings"],
  ["screensaver", "/screensaver"],
  ["design-system", "/design-system"], // kit reference for Task 15's first loop
];
const AUTHS = ["guest", "child", "parent"];
const THEMES = ["light", "dark", "dark-boost"];

function loadSecret() {
  const envPath = join(HOME_AI, ".env.local");
  if (!existsSync(envPath)) return null;
  const line = readFileSync(envPath, "utf8")
    .split("\n")
    .find((l) => l.startsWith("SESSION_SECRET="));
  return line ? line.slice("SESSION_SECRET=".length).trim() : null;
}

function b64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Mint a consuela_session token exactly as Home-ai's src/lib/session.ts does. */
function mintSession(secret, { memberId, name, role }) {
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(JSON.stringify({ memberId, name, role, iat: now, exp: now + 604800 }));
  const sig = b64url(createHmac("sha256", secret).update(`v1.${payload}`).digest());
  return `v1.${payload}.${sig}`;
}

async function main() {
  // Health check — fail loudly, never capture against a dead origin.
  const probe = await fetch(`${BASE}/api/auth/whoami`).catch(() => null);
  if (!probe) {
    console.error(`capture-reference: ${BASE} unreachable — start the Home-ai dev server first (cd ../Home-ai && PORT=3100 npm run dev)`);
    process.exit(1);
  }

  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const ctxOpts = {
    viewport: { width: 1080, height: 1920 },
    hasTouch: true,
    deviceScaleFactor: 1,
  };
  const secret = loadSecret();

  let captured = 0;
  const failures = [];

  for (const [name, route] of ROUTES) {
    if (ONLY && name !== ONLY) continue;
    for (const auth of AUTHS) {
      if (AUTH_ONLY && auth !== AUTH_ONLY) continue;
      for (const theme of THEMES) {
        if (THEME_ONLY && theme !== THEME_ONLY) continue;
        const ctx = await browser.newContext(ctxOpts);
        try {
          // Theme + wall: ?wall=1 always; theme via data-theme / contrast attrs.
          if (auth === "child") {
            const page0 = await ctx.newPage();
            const res = await page0.request.post(`${BASE}/api/auth/quick-login`, {
              data: { memberName: "Aurora" },
              headers: { "Content-Type": "application/json" },
            });
            if (!res.ok()) throw new Error(`quick-login child failed: ${res.status()}`);
            await page0.close();
          } else if (auth === "parent") {
            if (!secret) throw new Error("SESSION_SECRET not readable from ../Home-ai/.env.local");
            const token = mintSession(secret, { memberId: "rebecca", name: "Rebecca (Mom)", role: "parent" });
            await ctx.addCookies([{ name: "consuela_session", value: token, url: BASE }]);
          }

          const page = await ctx.newPage();
          await page.addInitScript((t) => {
            const themeName = t === "dark-boost" ? "dark" : t;
            // The web's inline anti-FOUC script (Home-ai src/app/layout.tsx)
            // OVERWRITES data-theme from localStorage['home-ai-theme-config']
            // on every load, and the ThemeProvider then PERSISTS whatever it
            // resolved. Seeding data-theme alone therefore produced a dark
            // render for the whole light/boost matrix. Seed the key both read,
            // with a VALID accentColor (useTheme rejects the whole config when
            // accentColor is not in its allow-list, and silently falls back to
            // the default dark theme).
            window.localStorage.setItem(
              "home-ai-theme-config",
              JSON.stringify({
                mode: themeName,
                contrastBoost: t === "dark-boost",
                accentColor: "nori",
                reduceMotion: false,
              })
            );
          }, theme);

          const url = `${BASE}${route}${route.includes("?") ? "&" : "?"}wall=1`;
          await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
          await page.waitForTimeout(900); // let atmosphere/chart animations settle

          const dir = join(OUT, name);
          mkdirSync(dir, { recursive: true });
          const file = join(dir, `${auth}-${theme}.png`);
          await page.screenshot({ path: file, fullPage: false });
          captured++;
        } catch (e) {
          failures.push(`${name}/${auth}-${theme}: ${String(e?.message ?? e).slice(0, 160)}`);
        } finally {
          await ctx.close();
        }
      }
    }
  }

  console.log(`capture-reference: ${captured} captured → ${relativeish(OUT)}`);
  if (failures.length) {
    console.error(`capture-reference: ${failures.length} failed:`);
    for (const f of failures) console.error(`  ${f}`);
    process.exit(2);
  }
  await browser.close();
}

function relativeish(p) {
  return p.replace(process.cwd() + "/", "");
}

main().catch((e) => {
  console.error("capture-reference: fatal:", e?.message ?? e);
  process.exit(1);
});
