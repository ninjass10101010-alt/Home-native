#!/usr/bin/env node
/**
 * capture-native.mjs — deterministic 1080×1920 capture harness for the RN app.
 *
 * - If an adb target is online: deep-link consuela://<route>?ws=<ws> on device and
 *   grab a PNG via adb screencap.
 * - Otherwise: launch Playwright Chromium at the wall viewport against the Expo
 *   web preview (http://localhost:3200), seed theme/boost/session state, wait 900ms,
 *   screenshot into screenshots/<ws>/<route>-<auth>-<theme>.png.
 *
 * Usage: node scripts/capture-native.mjs [--ws <name>] [--route <path>] [--auth guest|child|parent] [--theme light|dark|dark-boost]
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
  const slug = String(route || "/").replace(/^\/+|\/+$/g, "").replace(/\//g, "-");
  return slug || "index";
}

async function main() {
  const dir = join(ROOT, "screenshots", WS);
  mkdirSync(dir, { recursive: true });

  if (hasOnlineDevice()) {
    const routePart = String(ROUTE).replace(/^\/+/, "");
    const deeplink = `consuela://${routePart}?ws=${encodeURIComponent(WS)}`;
    spawnSync("adb", ["shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", deeplink], {
      stdio: "ignore",
    });
    await new Promise((r) => setTimeout(r, 1200));
    const outPath = join(dir, `${WS}.png`);
    const fd = openSync(outPath, "w");
    spawnSync("adb", ["exec-out", "screencap", "-p"], { stdio: ["ignore", fd, "ignore"] });
    closeSync(fd);
    console.log(`capture-native: ${outPath}`);
    return;
  }

  const BASE = "http://localhost:3200";
  const probe = await fetch(BASE).catch(() => null);
  if (!probe) {
    console.error(`capture-native: ${BASE} unreachable — start Expo web first (npm run web)`);
    process.exit(1);
  }

  const secret = loadSecret();
  let token = null;
  let profile = null;
  if (AUTH === "child") {
    profile = { id: "aurora", pbId: "aurora", name: "Aurora", role: "child", emoji: "👧", color: "#4F8EDB", age: 8 };
    if (secret) token = mintSession(secret, { memberId: "aurora", name: "Aurora", role: "child" });
  } else if (AUTH === "parent") {
    profile = { id: "rebecca", pbId: "rebecca", name: "Rebecca (Mom)", role: "parent", emoji: "👩", color: "#B26A3D" };
    if (secret) token = mintSession(secret, { memberId: "rebecca", name: "Rebecca (Mom)", role: "parent" });
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
  const urlPath = ROUTE.startsWith("/") ? ROUTE : `/${ROUTE}`;
  await page.goto(`${BASE}${urlPath}`, { waitUntil: "networkidle", timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(900);

  const file = join(dir, `${safeRoute(ROUTE)}-${AUTH}-${THEME}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`capture-native: ${file}`);

  await ctx.close();
  await browser.close();
}

main().catch((e) => {
  console.error("capture-native: fatal:", e?.message ?? e);
  process.exit(1);
});
