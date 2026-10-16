#!/usr/bin/env node
/**
 * capture-native.mjs — deterministic 1080×1920 capture harness for the RN app.
 *
 * - If an adb target is online (and --web is absent): deep-link
 *   consuela://<route>?ws=<ws> with the app package + `am start -W`, poll
 *   `dumpsys window displays` until com.garciafam.consuela owns the foreground
 *   window (otherwise it refuses to screenshot the launcher), settle
 *   (--wait, else 4500ms cold / 2200ms warm), then grab a PNG via adb screencap.
 * - Otherwise (or forced with --web): launch Playwright Chromium at the wall
 *   viewport against the Expo web preview (--base, default
 *   http://localhost:3200), seed theme/boost/accent + the
 *   consuela-auth-user/consuela_session session state, wait (--wait, else
 *   1600ms), screenshot into
 *   screenshots/<ws>/<route>-<auth>-<theme>.png (both paths share the name).
 *
 * Usage: node scripts/capture-native.mjs [--ws <name>] [--route <path>]
 *   [--auth guest|child|parent] [--theme light|dark|dark-boost]
 *   [--web] [--wait <ms>] [--base <url>] [--allow-console-errors]
 *
 * WS-0 round 2 (D-13): the gate FAILS on a React/DOM warning. The wall capture
 * that shipped a LogBox toast reading "Invalid DOM property 'transfor…'" was
 * submitted as evidence anyway — the harness never looked at the console. Every
 * render now collects console errors + page errors, prints a loud banner, and
 * exits non-zero when any of them is a React/DOM warning rather than a network
 * failure. `--allow-console-errors` downgrades the fail to the banner.
 */
import { execSync, spawnSync } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? def : args[i + 1];
};
const WS = flag("ws", "native");
const ROUTE = flag("route", "/");
const AUTH = flag("auth", "guest");
const THEME = flag("theme", "dark");
const BASE = flag("base", "http://localhost:3200");
const FORCE_WEB = args.includes("--web");
const WAIT_MS = Number(flag("wait", "0")) || 0;
const ALLOW_CONSOLE_ERRORS = args.includes("--allow-console-errors");
const PKG = "com.garciafam.consuela";

/**
 * A React/DOM warning is a defect in the shipped surface (a LogBox toast over
 * the product wall is exactly that). A network failure is not: the harness
 * runs against a dev preview where the LAN API is legitimately unreachable.
 */
const REACT_WARNING_RE =
  /Invalid DOM property|Invalid event handler|Unknown event handler|Invalid aria prop|does not recognize the|Each child in a list|unique "key"|React does not recognize|Warning: |ReactDOM|is not a <|cannot be updated|useNativeDriver|Text strings must be rendered|Invalid hook call|deprecated|Support for defaultProps|Please update|memo\(\)/;
const NETWORK_ONLY_RE =
  /Failed to load resource|net::ERR|CORS policy|blocked by CORS|ERR_FAILED|ERR_CONNECTION|ERR_NAME_NOT_RESOLVED|fetch\(|ECONNREFUSED|ETIMEDOUT|XMLHttpRequest error/i;

function isReactWarning(text) {
  return REACT_WARNING_RE.test(text) && !/Failed to load resource|net::ERR|CORS policy/i.test(text);
}

function reportConsole(kind, text) {
  const networkOnly = !isReactWarning(text) && (NETWORK_ONLY_RE.test(text) || /^\[error\]?\s*(Access to fetch|Failed to load)/i.test(text));
  return { kind, text: text.slice(0, 300), networkOnly };
}

function hasOnlineDevice() {
  try {
    const out = execSync("adb devices", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5000,
    });
    return out.split(/\r?\n/).some((line) => /\tdevice$/.test(line.trim()));
  } catch {
    return false;
  }
}

function loadSecret() {
  const envPath = join(ROOT, "..", "Home-ai", ".env.local");
  if (!existsSync(envPath)) return null;
  const line = readFileSync(envPath, "utf8").split("\n").find((l) => l.startsWith("SESSION_SECRET="));
  return line ? line.slice("SESSION_SECRET=".length).trim() : null;
}

function b64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function mintSession(secret, { memberId, name, role }) {
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(JSON.stringify({ memberId, name, role, iat: now, exp: now + 604800 }));
  const sig = b64url(createHmac("sha256", secret).update(`v1.${payload}`).digest());
  return `v1.${payload}.${sig}`;
}

function safeRoute(route) {
  const slug = String(route || "/").replace(/^\/+|\/+$/g, "").replace(/[/?&=]+/g, "-");
  return slug || "index";
}

async function main() {
  const dir = join(ROOT, "screenshots", WS);
  mkdirSync(dir, { recursive: true });
  const outFile = join(dir, `${safeRoute(ROUTE)}-${AUTH}-${THEME}.png`);

  if (!FORCE_WEB && hasOnlineDevice()) {
    const routePart = String(ROUTE).replace(/^\/+/, "");
    const deeplink = `consuela:///${routePart}${routePart.includes("?") ? "&" : "?"}ws=${encodeURIComponent(WS)}`;
    const wasRunning =
      spawnSync("adb", ["shell", "pidof", PKG], { encoding: "utf8" }).stdout.trim().length > 0;
    const startRes = spawnSync(
      "adb",
      ["shell", "am", "start", "-W", "-a", "android.intent.action.VIEW", "-d", deeplink, PKG],
      { encoding: "utf8" }
    );
    if (startRes.status !== 0 || /Error:/i.test(String(startRes.stdout) + String(startRes.stderr))) {
      console.error(`capture-native: am start failed for ${PKG}`);
      process.exit(1);
    }
    const deadline = Date.now() + 10_000;
    let focused = false;
    while (Date.now() < deadline) {
      const win = spawnSync("adb", ["shell", "dumpsys", "window", "displays"], { encoding: "utf8" }).stdout;
      if (win && win.includes(`${PKG}/`)) {
        focused = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    if (!focused) {
      console.error(`capture-native: ${PKG} did not reach foreground focus; refusing to screenshot launcher`);
      process.exit(1);
    }
    const settleMs = WAIT_MS || (wasRunning ? 2200 : 4500);
    await new Promise((r) => setTimeout(r, settleMs));
    const fd = openSync(outFile, "w");
    spawnSync("adb", ["exec-out", "screencap", "-p"], { stdio: ["ignore", fd, "ignore"] });
    closeSync(fd);
    console.log(`capture-native: ${outFile}`);
    return;
  }

  const probe = await fetch(BASE).catch(() => null);
  if (!probe) {
    console.error(`capture-native: ${BASE} unreachable — start Expo web first (npx expo start --web --port 3200)`);
    process.exit(1);
  }

  const secret = loadSecret();
  let token = null;
  let profile = null;
  if (AUTH === "child") {
    profile = { id: "child-1", pbId: "child-1", name: "Child 1", role: "child", emoji: "👧", color: "sky", age: 8 };
    if (secret) token = mintSession(secret, { memberId: "child-1", name: "Child 1", role: "child" });
  } else if (AUTH === "parent") {
    profile = { id: "mom", pbId: "mom", name: "Mom", role: "parent", emoji: "🐱", color: "gold", age: 38 };
    if (secret) token = mintSession(secret, { memberId: "mom", name: "Mom", role: "parent" });
  }

  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1080, height: 1920 },
    hasTouch: true,
    deviceScaleFactor: 1,
  });

  await ctx.addInitScript(
    ({ theme, auth, profile, token }) => {
      const t = theme === "dark-boost" ? "dark" : theme;
      window.localStorage.setItem("consuela-theme", t);
      window.localStorage.setItem("consuela-boost", theme === "dark-boost" ? "1" : "0");
      window.localStorage.setItem("consuela-accent", "nori");
      if (auth === "guest") {
        window.localStorage.removeItem("consuela-auth-user");
        window.localStorage.removeItem("consuela_session");
      } else {
        if (profile) window.localStorage.setItem("consuela-auth-user", JSON.stringify(profile));
        if (token) window.localStorage.setItem("consuela_session", token);
      }
    },
    { theme: THEME, auth: AUTH, profile, token }
  );

  const page = await ctx.newPage();
  const consoleHits = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") {
      consoleHits.push(reportConsole(msg.type(), msg.text()));
    }
  });
  page.on("pageerror", (err) => consoleHits.push({ kind: "pageerror", text: String(err?.message ?? err).slice(0, 300), networkOnly: false }));

  const urlPath = ROUTE.startsWith("/") ? ROUTE : `/${ROUTE}`;
  await page.goto(`${BASE}${urlPath}`, { waitUntil: "networkidle", timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(WAIT_MS || 1600);

  await page.screenshot({ path: outFile, fullPage: false });
  console.log(`capture-native: ${outFile}`);

  const defects = consoleHits.filter((h) => !h.networkOnly);
  const network = consoleHits.filter((h) => h.networkOnly);
  if (network.length) {
    console.log(
      `capture-native: ${network.length} network console error(s) (backend unreachable from the preview host — not a surface defect)`
    );
  }
  if (defects.length) {
    console.error("");
    console.error("╔══════════════════════════════════════════════════════════════════╗");
    console.error("║ capture-native: PAGE REPORTED REACT/DOM WARNINGS — GATE FAILED   ║");
    console.error("╚══════════════════════════════════════════════════════════════════╝");
    for (const d of defects) console.error(`  [${d.kind}] ${d.text}`);
    console.error(`  capture: ${outFile} (written for diagnosis — DO NOT submit as evidence)`);
    console.error("");
    await ctx.close();
    await browser.close();
    if (!ALLOW_CONSOLE_ERRORS) process.exit(1);
  }

  await ctx.close();
  await browser.close();
}

main().catch((e) => {
  console.error("capture-native: fatal:", e?.message ?? e);
  process.exit(1);
});
