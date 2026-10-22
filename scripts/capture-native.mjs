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
 * LIVE captures (the default on the web path)
 * --------------------------------------------
 * Every native capture used to render the wall in its OFFLINE state, so the
 * critics were judging an empty wall against a live reference. Two causes,
 * both in the browser (not in the app):
 *   1. the NAS API answers with NO Access-Control-Allow-Origin, so the
 *      preview's fetch to it dies at the CORS check and every widget falls
 *      back to its offline copy;
 *   2. a browser DROPS the `Cookie` request header the app sets (it is a
 *      forbidden header name), so even a reachable API would see the wall as
 *      signed out.
 * The harness therefore runs its OWN API proxy (loopback, started and
 * stopped with the capture) and points the preview's /api/** traffic at it:
 *   - the proxy answers with CORS headers, echoing the preview's Origin;
 *   - it injects the minted `consuela_session` cookie on the way upstream, so
 *     the wall is genuinely signed in as the --auth role;
 *   - it forwards everything else untouched to --api (default
 *     http://localhost:3100 — the Home-ai dev server, the SAME origin the
 *     reference captures were taken against, so a native capture and its
 *     reference read the same family data).
 *
 * The session is minted for a REAL family member, never for a stand-in: the
 * harness signs in through the app's own committed alias map, reads the LIVE
 * roster with that session and mints the capture's session for the requested
 * role's live row. Nothing about the family is hardcoded in this file.
 *
 * --offline points the proxy at a dead port instead: the honest "the server
 * is unreachable" state, for the offline/error captures the rubric asks for.
 *
 * Usage: node scripts/capture-native.mjs [--ws <name>] [--route <path>]
 *   [--auth guest|child|parent] [--theme light|dark|dark-boost]
 *   [--web] [--wait <ms>] [--base <url>] [--api <url>] [--offline]
 *   [--allow-console-errors]
 *
 * WS-0 round 2 (D-13): the gate FAILS on a React/DOM warning. The wall capture
 * that shipped a LogBox toast reading "Invalid DOM property 'transfor…'" was
 * submitted as evidence anyway — the harness never looked at the console. Every
 * render now collects console errors + page errors, prints a loud banner, and
 * exits non-zero when any of them is a React/DOM warning rather than a network
 * failure. `--allow-console-errors` downgrades the fail to the banner.
 * A capture that could not reach LIVE data fails the same way: an offline
 * wall submitted as evidence is exactly the defect this gate exists to stop.
 */
import { execSync, spawnSync } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import http from "node:http";
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
const WAIT_MS = Number(flag("wait", "9000")) || 0;
const ALLOW_CONSOLE_ERRORS = args.includes("--allow-console-errors");
const PKG = "com.garciafam.consuela";
/**
 * The API upstream the capture proxy forwards to. It must serve /api/** AND
 * share the SESSION_SECRET of ../Home-ai/.env.local — the local Home-ai dev
 * server does both; the production container on the NAS does not accept a
 * session minted from that file, so it cannot back a signed-in capture.
 */
const API_BASE = String(flag("api", process.env.CONSUELA_CAPTURE_API || "http://localhost:3100")).replace(
  /\/+$/,
  ""
);
/** Capture the honest UNREACHABLE state (the proxy drops every connection). */
const OFFLINE = args.includes("--offline");
const TAP = flag("tap", "");

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

/* ───────────────────────── live capture: identity ───────────────────────── */

/**
 * The app's own committed stand-in → real-name alias map
 * (src/api/auth.ts STANDIN_PREFIX_MAP). The harness READS it at runtime: the
 * aliases already live in this repo, so nothing new about the family lands in
 * this file, and the harness stays in step with the app when a name changes.
 * The server resolves a session's name against the live roster (fuzzy), so an
 * alias is enough to OPEN a session — but the capture itself must run as a
 * real member (the points/ledger namespace is keyed by that name), so the
 * harness re-mints for the live roster row it finds.
 */
function readAliasPrefixes() {
  const out = [];
  try {
    const src = readFileSync(join(ROOT, "src", "api", "auth.ts"), "utf8");
    const block = src.match(/STANDIN_PREFIX_MAP[\s\S]*?\{([\s\S]*?)\}/);
    if (block) {
      const re = /"?([A-Za-z][A-Za-z0-9 ]*)"?\s*:\s*"([A-Za-z]{2,})"/g;
      let m;
      while ((m = re.exec(block[1]))) {
        out.push({ alias: m[2], role: /^child/i.test(m[1]) ? "child" : "parent" });
      }
    }
  } catch {
    /* unreadable app source → no aliases */
  }
  return out;
}

async function apiJson(url, cookie) {
  try {
    const res = await fetch(url, { headers: cookie ? { cookie } : {} });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * The live roster row the capture should run as.
 * parent → the first parent (the reference capture signs in as the first).
 * child  → the youngest PIN-free child (under 10), which is what the
 *          reference capture's server-side quick-login resolves to.
 */
function pickMemberForRole(roster, role) {
  const parents = roster.filter((m) => m && m.role === "parent");
  const kids = roster.filter((m) => m && m.role === "child");
  if (role === "parent") return parents[0] || null;
  if (role === "child") {
    const pinFree = kids.find((m) => typeof m.age === "number" && m.age < 10);
    return pinFree || kids[0] || null;
  }
  return null;
}

/**
 * Resolve the LIVE roster and (for a signed-in role) a LIVE session.
 * Returns { token, member, roster } or null when the API could not answer.
 * `guest` gets NO session on purpose: a guest capture is the signed-out wall.
 * Its roster is still read live and handed to the app as the device's SAVED
 * copy (the state the real panel is in after it has synced once) — the wall
 * then shows the family instead of sample tiles, exactly like the reference.
 */
async function resolveLiveIdentity({ role, secret, api }) {
  if (!secret) return null;
  for (const { alias, role: aliasRole } of readAliasPrefixes()) {
    const probe = mintSession(secret, { memberId: alias, name: alias, role: aliasRole });
    const cookie = `consuela_session=${probe}`;
    const who = await apiJson(`${api}/api/auth/whoami`, cookie);
    if (!who || !who.member) continue;
    const live = await apiJson(`${api}/api/members/admin?source=live`, cookie);
    const roster = live && Array.isArray(live.members) ? live.members : null;
    if (!roster || !roster.length) continue;
    if (role === "guest") return { token: null, member: null, roster };
    const pick = pickMemberForRole(roster, role);
    if (!pick) continue;
    return {
      token: mintSession(secret, { memberId: pick.id, name: pick.name, role: pick.role }),
      member: pick,
      roster,
    };
  }
  return null;
}

/* ─────────────────────────── live capture: proxy ────────────────────────── */

/**
 * The capture proxy.
 *
 * It exists for the two browser-only failures above: it answers with CORS
 * headers (echoing the preview's Origin) and it injects the minted
 * `consuela_session` cookie on the way upstream, so the wall is genuinely
 * signed in as the --auth role instead of falling back to its offline copy.
 * Everything else (method, path, query, body, status, content type) is
 * forwarded untouched.
 *
 * It binds LOOPBACK on an OS-assigned port and is closed with the capture —
 * it never outlives the process and never collides with the NAS's :3000.
 */
function startCaptureProxy({ upstream, token, offline }) {
  const hits = [];
  const target = new URL(upstream);

  const server = http.createServer((req, res) => {
    const origin = req.headers.origin;
    const cors = {
      "access-control-allow-origin": origin || "*",
      "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
      "access-control-allow-headers": req.headers["access-control-request-headers"] || "*",
      "access-control-max-age": "600",
      vary: "Origin",
    };
    if (req.method === "OPTIONS") {
      res.writeHead(204, cors);
      res.end();
      return;
    }
    if (offline) {
      // The honest UNREACHABLE state: drop the connection so the app sees a
      // transport failure (status 0), never a server answer it could trust.
      hits.push({ path: req.url, status: 0 });
      req.socket.destroy();
      return;
    }
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const body = Buffer.concat(chunks);
      const headers = { ...req.headers };
      delete headers["accept-encoding"]; // identity upstream → no content-encoding to unwrap
      delete headers["content-length"];
      delete headers.connection;
      delete headers.host;
      delete headers.origin;
      delete headers.referer;
      if (token) headers.cookie = `consuela_session=${token}`;
      if (body.length) headers["content-length"] = String(body.length);
      const path = req.url || "/";
      const up = http.request(
        {
          hostname: target.hostname,
          port: target.port || 80,
          path,
          method: req.method,
          headers: { ...headers, host: target.host },
        },
        (r) => {
          const out = { ...cors };
          for (const [k, v] of Object.entries(r.headers)) {
            // hop-by-hop + the upstream's own CORS/set-cookie never travel:
            // the proxy owns the CORS contract, and a Set-Cookie the browser
            // cannot use would only confuse the app's own session state.
            if (/^(connection|keep-alive|transfer-encoding|content-encoding|set-cookie|access-control-)/i.test(k)) {
              continue;
            }
            out[k] = v;
          }
          hits.push({ path, status: r.statusCode });
          res.writeHead(r.statusCode, out);
          r.pipe(res);
        }
      );
      up.on("error", (e) => {
        hits.push({ path, status: 0 });
        if (res.headersSent) {
          res.destroy();
          return;
        }
        res.writeHead(502, { ...cors, "content-type": "application/json" });
        res.end(JSON.stringify({ error: "capture_proxy_upstream_unreachable" }));
      });
      if (body.length) up.write(body);
      up.end();
    });
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        base: `http://127.0.0.1:${port}`,
        hits,
        close: () =>
          new Promise((done) => {
            server.close(() => done());
            server.closeAllConnections?.();
          }),
      });
    });
  });
}

/**
 * The hosts the app talks its API to — read out of the app's own config
 * (src/api/config.ts DEFAULT_BASE_URL + LAN_BASE_URLS) so the harness never
 * guesses a server address. The interception is scoped to THESE hosts: the
 * app also fetches third-party APIs whose paths start with /api/ (the lyrics
 * lookup on lrclib.net), and those must keep going to the internet.
 */
function readApiHosts() {
  const hosts = new Set();
  try {
    const src = readFileSync(join(ROOT, "src", "api", "config.ts"), "utf8");
    const re = /"(https?:\/\/[^"]+)"/g;
    let m;
    while ((m = re.exec(src))) {
      try {
        hosts.add(new URL(m[1]).host);
      } catch {
        /* not a URL */
      }
    }
  } catch {
    /* unreadable app config */
  }
  return hosts;
}

/**
 * Point the preview's API traffic at the capture proxy. The app resolves its
 * own base URL (the NAS, by default) and the browser would then hit the NAS
 * cross-origin — so every request to an app API host is rewritten to the
 * proxy, which answers it with CORS and a real session.
 */
async function routeApiThroughProxy(ctx, proxyBase) {
  const apiHosts = readApiHosts();
  await ctx.route(
    (url) =>
      url.pathname.startsWith("/api/") && (apiHosts.has(url.host) || url.port === "3000"),
    async (route) => {
      const request = route.request();
      const u = new URL(request.url());
      try {
        await route.continue({ url: `${proxyBase}${u.pathname}${u.search}` });
      } catch {
        try {
          await route.abort();
        } catch {
          /* the route is already gone */
        }
      }
    }
  );
}

/**
 * What the page actually PAINTED — the honest check that the capture is
 * live and not the offline wall. Reads the rendered rail, never the wire.
 */
async function readRenderedState(page) {
  return page
    .evaluate(() => {
      const labels = Array.from(document.querySelectorAll("[aria-label]")).map((el) =>
        el.getAttribute("aria-label") || ""
      );
      const badge = document.querySelector('[data-testid="roster-badge"]');
      return {
        railTiles: labels.filter((l) => /^(Sign|Signed) in as /.test(l)).length,
        standIn: labels.some((l) => l.startsWith("Sample members")),
        // A signed-in child gets the kid wall, not the family rail.
        kidWall: !!document.querySelector('[data-testid="kid-home"]'),
        badge: badge ? (badge.textContent || "").trim() : null,
      };
    })
    .catch(() => ({ railTiles: 0, standIn: false, kidWall: false, badge: null }));
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
  const identity = await resolveLiveIdentity({ role: AUTH, secret, api: API_BASE });
  if (!identity && !OFFLINE) {
    console.error("");
    console.error("╔══════════════════════════════════════════════════════════════════╗");
    console.error("║ capture-native: NO LIVE IDENTITY — the capture will be OFFLINE   ║");
    console.error("╚══════════════════════════════════════════════════════════════════╝");
    console.error(`  upstream: ${API_BASE} (no roster, no session)`);
    console.error("  start the Home-ai dev server: cd ../Home-ai && PORT=3100 npm run dev");
    console.error("");
  }

  const proxy = await startCaptureProxy({
    upstream: API_BASE,
    token: identity ? identity.token : null,
    offline: OFFLINE,
  });

  let browser = null;
  try {
    let profile = null;
    let token = null;
    if (identity && identity.member) {
      const m = identity.member;
      profile = {
        id: m.id,
        pbId: m.pbId || m.id,
        name: m.name,
        role: m.role,
        emoji: m.emoji,
        color: m.color,
        age: m.age,
      };
      token = identity.token;
    } else if (AUTH === "child") {
      profile = { id: "child-1", pbId: "child-1", name: "Child 1", role: "child", emoji: "👧", color: "sky", age: 8 };
      if (secret) token = mintSession(secret, { memberId: "child-1", name: "Child 1", role: "child" });
    } else if (AUTH === "parent") {
      profile = { id: "mom", pbId: "mom", name: "Mom", role: "parent", emoji: "🐱", color: "gold", age: 38 };
      if (secret) token = mintSession(secret, { memberId: "mom", name: "Mom", role: "parent" });
    }

    browser = await chromium.launch();
    const ctx = await browser.newContext({
      viewport: { width: 1080, height: 1920 },
      hasTouch: true,
      deviceScaleFactor: 1,
    });

    // Every /api/** call the preview makes goes through the capture proxy.
    await routeApiThroughProxy(ctx, proxy.base);

    await ctx.addInitScript(
      ({ theme, auth, profile, token, roster }) => {
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
        // The device's SAVED roster (AsyncStorage on web === localStorage).
        // A signed-out wall reads it instead of the stand-in set, so the
        // guest capture shows the family — the state the real panel is in
        // after it has synced once — and not sample tiles.
        if (roster && roster.length) {
          window.localStorage.setItem("consuela-members", JSON.stringify(roster));
        }
      },
      {
        theme: THEME,
        auth: AUTH,
        profile,
        token,
        roster: AUTH === "guest" && identity ? identity.roster : null,
      }
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
    await page.waitForTimeout(WAIT_MS || 9000);

    if (TAP) {
      await page.click(TAP, { timeout: 5_000 });
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    await page.screenshot({ path: outFile, fullPage: false });
    console.log(`capture-native: ${outFile}`);

    const painted = await readRenderedState(page);
    const ok = proxy.hits.filter((h) => h.status >= 200 && h.status < 400).length;
    // 401/403 is an ANSWER ("this surface needs a session"), not a failure —
    // the signed-out wall is supposed to meet the gate that way.
    const gated = proxy.hits.filter((h) => h.status === 401 || h.status === 403).length;
    const failedHits = proxy.hits.filter(
      (h) => h.status === 0 || (h.status >= 500 || (h.status >= 400 && h.status < 500 && h.status !== 401 && h.status !== 403))
    );
    console.log(
      `capture-native: api ${proxy.hits.length} proxied (ok ${ok}, session-gated ${gated}, failed ${failedHits.length}) via ${
        OFFLINE ? "offline sink" : API_BASE
      }`
    );
    for (const h of failedHits.slice(0, 6)) {
      console.log(`capture-native:   api ${h.status || "transport-error"} ${h.path}`);
    }
    if (identity && identity.member) {
      console.log(
        `capture-native: live session as ${identity.member.role} · live roster ${
          identity.roster ? identity.roster.length : 0
        } member(s)`
      );
    }
    console.log(
      `capture-native: painted ${
        painted.kidWall ? "kid wall" : `rail ${painted.railTiles} tile(s)`
      }${painted.standIn ? " (STAND-IN roster)" : ""}${painted.badge ? ` · badge "${painted.badge}"` : ""}`
    );

    const defects = consoleHits.filter((h) => !h.networkOnly);
    const network = consoleHits.filter((h) => h.networkOnly);
    if (network.length) {
      console.log(
        `capture-native: ${network.length} network console error(s) (backend unreachable from the preview host — not a surface defect)`
      );
    }
    // The gates set a reason and the capture exits non-zero AFTER the proxy is
    // closed (process.exit() would skip the finally and leave the server up).
    let gateFailed = null;
    if (defects.length) {
      console.error("");
      console.error("╔══════════════════════════════════════════════════════════════════╗");
      console.error("║ capture-native: PAGE REPORTED REACT/DOM WARNINGS — GATE FAILED   ║");
      console.error("╚══════════════════════════════════════════════════════════════════╝");
      for (const d of defects) console.error(`  [${d.kind}] ${d.text}`);
      console.error(`  capture: ${outFile} (written for diagnosis — DO NOT submit as evidence)`);
      console.error("");
      gateFailed = "react-dom-warning";
    }

    // The live gate: a capture that fell back to the offline wall must not be
    // submitted as evidence — that is the defect this whole harness exists to
    // prevent. (--offline asks for that state on purpose.)
    //
    // The gate reads the WIRE, not the picture: a 2xx from /api/auth/whoami
    // is the proof that the app is genuinely signed in as the --auth role, and
    // a 2xx from the live roster is the proof that the wall's family is the
    // real one. A painted stand-in roster or an empty rail is the failure.
    if (!gateFailed) {
      // Only the WALL reads the roster; a route like /tasks never asks for it,
      // so demanding a roster hit there would fail a perfectly live capture.
      const isWallRoute = safeRoute(ROUTE) === "index";
      const whoamiOk = proxy.hits.some(
        (h) => h.path.startsWith("/api/auth/whoami") && h.status >= 200 && h.status < 300
      );
      const rosterOk = proxy.hits.some(
        (h) => h.path.startsWith("/api/members/admin") && h.status >= 200 && h.status < 300
      );
      let notLive = null;
      if (!OFFLINE) {
        if (!identity) notLive = "no live identity (the API did not answer)";
        else if (AUTH !== "guest" && !whoamiOk) notLive = "the app never got a live session (whoami never answered 2xx)";
        else if (AUTH === "guest") {
          // A signed-out wall reads its SAVED roster (the harness seeds it),
          // so /api/members/admin legitimately 401s - the rail is the proof.
          if (isWallRoute && !painted.railTiles) notLive = "the guest wall painted no roster";
        } else if (AUTH === "child") {
          if (isWallRoute && !painted.kidWall) notLive = "the kid wall never painted (the child session never landed)";
        } else if (isWallRoute) {
          // The wall's RAIL is the visible proof that the live roster landed.
          // A route like /tasks has no rail, so these checks are wall-only.
          if (!rosterOk) notLive = "the live roster never arrived (the members endpoint never answered 2xx)";
          else if (painted.standIn) notLive = "the wall painted the stand-in roster (the live roster never landed)";
          else if (!painted.railTiles) notLive = "the wall painted no member rail";
        }
        if (process.env.CAPTURE_DEBUG) {
          console.error("DEBUG hits:", JSON.stringify(proxy.hits.map((h) => `${h.path} ${h.status}`)));
        }
      }
      if (notLive) {
        console.error("");
        console.error("╔══════════════════════════════════════════════════════════════════╗");
        console.error("║ capture-native: CAPTURE IS NOT LIVE — GATE FAILED               ║");
        console.error("╚══════════════════════════════════════════════════════════════════╝");
        console.error(`  reason: ${notLive}`);
        console.error(`  capture: ${outFile} (written for diagnosis — DO NOT submit as evidence)`);
        console.error("");
        gateFailed = "not-live";
      }
    }

    await ctx.close();
    await browser.close();
    browser = null;
    if (gateFailed && !ALLOW_CONSOLE_ERRORS) process.exitCode = 1;
  } finally {
    if (browser) await browser.close().catch(() => {});
    await proxy.close();
  }
}

main().catch((e) => {
  console.error("capture-native: fatal:", e?.message ?? e);
  process.exit(1);
});
