 
import {
  NAV_ITEMS,
  navItemsForRole,
  moreNavItemsForRole,
  navRoleForUser,
  navModeForRole,
  isPathActive,
  navItemForPath,
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

  it("More… sheet counts: 7 parent / 6 kid / 4 guest (photos IS in the sheet)", () => {
    expect(moreNavItemsForRole("parent")).toHaveLength(7);
    expect(moreNavItemsForRole("child")).toHaveLength(6);
    expect(moreNavItemsForRole("pet")).toHaveLength(6);
    expect(moreNavItemsForRole("guest")).toHaveLength(4);
    expect(moreNavItemsForRole("parent").map((i) => i.path)).toContain("/photos");
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
});
