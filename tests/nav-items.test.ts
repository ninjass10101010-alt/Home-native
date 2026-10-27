 
import fs from "node:fs";
import path from "node:path";
import {
  NAV_ITEMS,
  navItemsForRole,
  moreNavItemsForRole,
  navRoleForUser,
  navModeForRole,
  isPathActive,
  navItemForPath,
  resolveRoute,
  EXEMPT_ROUTES,
} from "../src/nav/nav-items";

describe("nav manifest (port of Home-ai nav-items contracts)", () => {
  it("exactly 7 dock caps for EVERY role", () => {
    for (const role of ["guest", "parent", "child", "pet"] as const) {
      expect(navItemsForRole(role)).toHaveLength(7);
    }
  });

  it("kid swaps House for Rewards — exactly one of the pair is present", () => {
    const kid = navItemsForRole("child").map((i) => i.path);
    expect(kid).toContain("/rewards");
    expect(kid).not.toContain("/ha");
    const parent = navItemsForRole("parent").map((i) => i.path);
    expect(parent).toContain("/ha");
    expect(parent).not.toContain("/rewards");
    const guest = navItemsForRole("guest").map((i) => i.path);
    expect(guest).toContain("/ha");
    expect(guest).not.toContain("/rewards");
  });

  it("More… sheet counts: 8 parent / 7 kid / 4 guest (music IS signed-in only)", () => {
    expect(moreNavItemsForRole("parent")).toHaveLength(8);
    expect(moreNavItemsForRole("child")).toHaveLength(7);
    expect(moreNavItemsForRole("pet")).toHaveLength(7);
    expect(moreNavItemsForRole("guest")).toHaveLength(4);
    expect(moreNavItemsForRole("parent").map((i) => i.path)).toContain("/photos");
    expect(moreNavItemsForRole("parent").map((i) => i.path)).toContain("/music");
    expect(moreNavItemsForRole("guest").map((i) => i.path)).not.toContain("/music");
  });

  it("/music is a manifest destination, not an exemption", () => {
    expect(NAV_ITEMS.some((item) => item.path === "/music")).toBe(true);
    expect(EXEMPT_ROUTES["/music"]).toBeUndefined();
  });

  it("personal destinations leave the guest wall (money-mountain, memory, photos)", () => {
    const guest = moreNavItemsForRole("guest").map((i) => i.path);
    expect(guest).not.toContain("/money-mountain");
    expect(guest).not.toContain("/memory");
    expect(guest).not.toContain("/photos");
  });

  it("navRoleForUser: none→guest, unknown signed-in role→child (never adult by accident)", () => {
    expect(navRoleForUser(null)).toBe("guest");
    expect(navRoleForUser({ role: "parent" })).toBe("parent");
    expect(navRoleForUser({ role: "pet" })).toBe("pet");
    expect(navRoleForUser({ role: "mystery" })).toBe("child");
  });

  it("navModeForRole", () => {
    expect(navModeForRole("guest")).toBe("family");
    expect(navModeForRole("parent")).toBe("adult");
    expect(navModeForRole("child")).toBe("kid");
    expect(navModeForRole("pet")).toBe("kid");
  });

  it("isPathActive: root exact-only; /settings lights on /settings/me; /meals/archive lights NOTHING", () => {
    expect(isPathActive("/", "/")).toBe(true);
    expect(isPathActive("/tasks", "/")).toBe(false);
    expect(isPathActive("/settings/me", "/settings")).toBe(true);
    expect(isPathActive("/meals/recipes/12", "/meals")).toBe(true);
    expect(isPathActive("/meals/archive", "/meals")).toBe(false);
    expect(isPathActive("/mealsomething", "/meals")).toBe(false);
  });

  it("navItemForPath returns the manifest entry", () => {
    expect(navItemForPath("/calendar")?.label).toBe("Calendar");
    expect(navItemForPath("/nope")).toBeUndefined();
  });

  it("every manifest path is unique", () => {
    const paths = NAV_ITEMS.map((i) => i.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("EXEMPT_ROUTES always carry a reason", () => {
    for (const [route, reason] of Object.entries(EXEMPT_ROUTES)) {
      expect(reason.length).toBeGreaterThan(8);
      expect(route.startsWith("/")).toBe(true);
    }
  });

  // ── The no-orphans guard, ported verbatim from the web's own contract test:
  // every route file under app/ must be either a manifest path, a manifest
  // prefix, or an EXEMPT_ROUTES entry. Reading the real directory (not a
  // hardcoded list) is what makes the rule actually bite — a snapshot test
  // over a literal list passes forever while the tree drifts. ──
  it("every route under app/ is a manifest path, a manifest prefix, or EXEMPT_ROUTES", () => {
    const routeFiles = fs.readdirSync(path.join(__dirname, "..", "app"));
    const routes: string[] = [];
    for (const entry of routeFiles) {
      const full = path.join(__dirname, "..", "app", entry);
      if (fs.statSync(full).isFile() && entry.endsWith(".tsx")) {
        // expo-router: index.tsx IS the parent route ("/"), not a route of its own.
        routes.push(entry === "index.tsx" ? "/" : `/${entry.replace(/\.tsx$/, "")}`);
      }
    }
    const orphans = routes.filter((route) => {
      if (route === "/_layout") return false; // expo-router root layout, not a surface
      if (EXEMPT_ROUTES[route]) return false;
      return !NAV_ITEMS.some((item) => item.path === route);
    });
    expect(routes.length).toBeGreaterThan(5); // the walk actually found the tree
    expect(orphans).toEqual([]);
  });

  // ── The REVERSE direction of the no-orphans guard: the walk above proves
  // every route FILE has a home; this proves every path resolveRoute claims
  // is "live" has a file. A LIVE_ROUTES entry without a route (e.g. the
  // early /grocery bug) pushes straight to expo-router's Unmatched view —
  // dock unmounted, wall dead — which is the exact failure resolveRoute
  // exists to prevent. ──
  it("resolveRoute only returns paths that have a real route file", () => {
    const routeFiles = fs
      .readdirSync(path.join(__dirname, "..", "app"))
      .filter((e) => e.endsWith(".tsx"))
      .map((e) => (e === "index.tsx" ? "/" : `/${e.replace(/\.tsx$/, "")}`));
    for (const item of NAV_ITEMS) {
      const resolved = resolveRoute(item.path, item.label);
      if (resolved === item.path) {
        expect(routeFiles).toContain(item.path);
      } else {
        expect(resolved).toBe(`/soon?label=${encodeURIComponent(item.label)}`);
      }
    }
    // Every manifest destination now has a live route file; unknown paths still take the /soon fallback.
    expect(resolveRoute("/grocery", "Grocery")).toBe("/grocery");
    expect(resolveRoute("/skill-tree", "Skill Tree")).toBe("/skill-tree");
    expect(resolveRoute("/time-capsule", "Time Capsule")).toBe("/time-capsule");
    expect(resolveRoute("/analytics", "Insights")).toBe("/analytics");
    expect(resolveRoute("/money-mountain", "Money Mountain")).toBe("/money-mountain");
    expect(resolveRoute("/memory", "Family Memory")).toBe("/memory");
    expect(resolveRoute("/unknown-wave-route", "Future")).toMatch(/^\/soon\?label=/);
  });
});
