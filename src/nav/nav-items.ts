/**
 * nav-items.ts — the single navigation manifest (RN port of
 * ../Home-ai/src/lib/nav-items.ts, verbatim semantics; icon keys stay
 * strings until Wave 2 swaps them for the web's NavIcon SVG paths).
 *
 * Rules this file enforces (same as web):
 *   1. One ordering. Every surface renders the same sequence.
 *   2. One active-item rule (isPathActive), segment-aware.
 *   3. No orphans: a new route needs a manifest entry or an EXEMPT_ROUTES entry.
 * Roles mirror the web: "guest" = no session (family/wall screen). Mode is
 * derived from role by navModeForRole (parent → adult, else kid, guest → family).
 */

export type NavRole = "guest" | "parent" | "child" | "pet";
export type NavMode = "family" | "adult" | "kid";
/** "primary" = the dock caps; "more" = the Home More… sheet. */
export type NavGroup = "primary" | "more";

export const NAV_ICON_KEYS = [
  "home",
  "ask",
  "meals",
  "tasks",
  "rewards",
  "calendar",
  "house",
  "settings",
  "grocery",
  "skill",
  "capsule",
  "analytics",
  "mountain",
  "memory",
  "photos",
  "music",
] as const;

export type NavIconKey = (typeof NAV_ICON_KEYS)[number];

export interface NavItemDefinition {
  /** Route the item points at. Always absolute, never carries a query string. */
  path: string;
  /** Accessible name, and the visible label in the dock. */
  label: string;
  iconKey: NavIconKey;
  roles: readonly NavRole[];
  group: NavGroup;
  /** May a signed-out (guest) screen offer this destination? */
  wall: boolean;
  /** Secondary items only: the one-line blurb shown in the More… sheet. */
  description?: string;
}

const ALL_ROLES: readonly NavRole[] = ["guest", "parent", "child", "pet"];
const SIGNED_IN_ROLES: readonly NavRole[] = ["parent", "child", "pet"];
const PARENT_ONLY: readonly NavRole[] = ["parent"];
/** Kid mode = signed-in non-parent (child or pet), same as the web's resolveMode(). */
const KID_ROLES: readonly NavRole[] = ["child", "pet"];
const HOUSE_ROLES: readonly NavRole[] = ["guest", "parent"];

/** The manifest, in display order. Kid dock loses House/gains Rewards purely
 *  through roles + this order — no mode-specific splicing (7 primary always). */
export const NAV_ITEMS: readonly NavItemDefinition[] = [
  { path: "/", label: "Home", iconKey: "home", roles: ALL_ROLES, group: "primary", wall: true },
  { path: "/chat", label: "Ask", iconKey: "ask", roles: ALL_ROLES, group: "primary", wall: true },
  { path: "/meals", label: "Meals", iconKey: "meals", roles: ALL_ROLES, group: "primary", wall: true },
  { path: "/tasks", label: "Tasks", iconKey: "tasks", roles: ALL_ROLES, group: "primary", wall: true },
  { path: "/rewards", label: "Rewards", iconKey: "rewards", roles: KID_ROLES, group: "primary", wall: false },
  { path: "/calendar", label: "Calendar", iconKey: "calendar", roles: ALL_ROLES, group: "primary", wall: true },
  { path: "/ha", label: "House", iconKey: "house", roles: HOUSE_ROLES, group: "primary", wall: true },
  { path: "/settings", label: "Settings", iconKey: "settings", roles: ALL_ROLES, group: "primary", wall: true },

  // ── Secondary: the Home More… sheet ──
  {
    path: "/grocery",
    label: "Grocery",
    iconKey: "grocery",
    description: "Shopping list and sync status",
    roles: ALL_ROLES,
    group: "more",
    wall: true,
  },
  {
    path: "/skill-tree",
    label: "Skill Tree",
    iconKey: "skill",
    description: "Quests, levels and badges",
    roles: ALL_ROLES,
    group: "more",
    wall: true,
  },
  {
    path: "/time-capsule",
    label: "Time Capsule",
    iconKey: "capsule",
    description: "Letters and photos for later",
    roles: ALL_ROLES,
    group: "more",
    wall: true,
  },
  {
    path: "/analytics",
    label: "Insights",
    iconKey: "analytics",
    description: "Schedule and routine patterns",
    roles: ALL_ROLES,
    group: "more",
    wall: true,
  },
  {
    path: "/money-mountain",
    label: "Money Mountain",
    iconKey: "mountain",
    description: "Savings goals and allowance",
    roles: SIGNED_IN_ROLES,
    group: "more",
    wall: false,
  },
  {
    path: "/memory",
    label: "Family Memory",
    iconKey: "memory",
    description: "Addresses, allergies and preferences",
    roles: PARENT_ONLY,
    group: "more",
    wall: false,
  },
  {
    path: "/photos",
    label: "Photos",
    iconKey: "photos",
    description: "Add pictures and choose what the wall shows",
    roles: SIGNED_IN_ROLES,
    group: "more",
    wall: false,
  },
  {
    path: "/music",
    label: "Music",
    iconKey: "music",
    description: "Search, play and download music",
    roles: SIGNED_IN_ROLES,
    group: "more",
    wall: false,
  },
];

/**
 * Role for a session. null/undefined is a guest (no PIN used yet).
 * An unknown signed-in role is treated as a child ("parent" is the only
 * privileged role), so a future role can never inherit adult nav by accident.
 */
export function navRoleForUser(user: { role?: string } | null | undefined): NavRole {
  if (!user) return "guest";
  const role = user.role;
  if (role === "parent" || role === "child" || role === "pet") return role;
  return "child";
}

/** Mode implied by a role — the one place navigation derives mode from role. */
export function navModeForRole(role: NavRole): NavMode {
  if (role === "guest") return "family";
  if (role === "parent") return "adult";
  return "kid";
}

function isVisible(item: NavItemDefinition, role: NavRole): boolean {
  if (!item.roles.includes(role)) return false;
  // Guests are the shared screen: wall-safe destinations only.
  return role !== "guest" || item.wall;
}

/** Primary items (the dock caps) for a role, in manifest order. */
export function navItemsForRole(role: NavRole): NavItemDefinition[] {
  return NAV_ITEMS.filter((item) => item.group === "primary" && isVisible(item, role));
}

/** Secondary items for a role — the Home More… sheet. */
export function moreNavItemsForRole(role: NavRole): NavItemDefinition[] {
  return NAV_ITEMS.filter((item) => item.group === "more" && isVisible(item, role));
}

/**
 * Routes that sit under a destination's URL prefix but are NOT a section of it
 * (e.g. /meals/archive is the week-restore screen, not the planner).
 */
export const OWN_DESTINATION_ROUTES: readonly string[] = ["/meals/archive"];

function isOwnDestinationPath(pathname: string): boolean {
  return OWN_DESTINATION_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

/**
 * Is `pathname` inside `path`? Exact for the root ("/" must not match every
 * route), segment-aware otherwise; false for own-destination sub-routes.
 */
export function isPathActive(pathname: string, path: string): boolean {
  if (path === "/") return pathname === "/";
  if (pathname === path) return true;
  if (isOwnDestinationPath(pathname) && !isOwnDestinationPath(path)) return false;
  return pathname.startsWith(`${path}/`);
}

export function isNavItemActive(pathname: string, item: NavItemDefinition): boolean {
  return isPathActive(pathname, item.path);
}

/** The manifest entry a route belongs to, if any (titles/breadcrumbs). */
export function navItemForPath(pathname: string): NavItemDefinition | undefined {
  return NAV_ITEMS.find((item) => isNavItemActive(pathname, item));
}

/**
 * Routes that actually exist under app/ today (Wave 1 surfaces).
 *
 * CONTRACT: every entry here MUST have a matching route file (app/index.tsx
 * for "/"), or resolveRoute will strand the wall on expo-router's Unmatched
 * view — the very failure it exists to prevent. tests/nav-items.test.ts
 * walks the real app/ tree and fails on any entry without a file.
 */
const LIVE_ROUTES: ReadonlySet<string> = new Set([
  "/",
  "/tasks",
  "/meals",
  "/calendar",
  "/photos",
  "/music",
  "/settings",
  "/emergency",
  "/weather",
  "/ha",
  "/chat",
  "/rewards",
  "/grocery",
  "/skill-tree",
  "/time-capsule",
  "/analytics",
  "/money-mountain",
  "/memory",
]);

/**
 * U3 navigation guard: a manifest path that has no route yet (Ask/House/
 * Rewards + the More… sheet's secondary destinations — Wave 2) must NEVER
 * strand the family on expo-router's Unmatched view (dock unmounted, wall
 * dead). Unknown paths land on /soon with an honest "arrives in the next
 * wave" surface that keeps the dock alive.
 */
export function resolveRoute(path: string, label?: string): string {
  if (LIVE_ROUTES.has(path)) return path;
  const name = label ?? path;
  return `/soon?label=${encodeURIComponent(name)}`;
}

/**
 * Routes that deliberately have no manifest entry, each with the reason it
 * is allowed to stay orphans.
 */
export const EXEMPT_ROUTES: Readonly<Record<string, string>> = {
  "/design-system": "Dev-only design-system preview (production-gated).",
  "/_design": "Dev-only design-kit showcase for Home-native (the critic loop target).",
  "/emergency": "Reached from the always-visible Emergency shield; not a dock cap.",
  "/ledger": "Parent-only finance embed; v2 on native.",
  "/meals/archive": "Week-restore drill-down of /meals; listed in OWN_DESTINATION_ROUTES.",
  "/player": "Reached from Home's Music widget; a drill-down, not a cap.",
  "/screensaver": "Idle wall board — reached by inactivity, not nav.",
  "/suggestions": "Reached from Home's Suggestions widget ('See all').",
  "/weather": "Reached from Home's weather cell poster — a drill-down, not a cap.",
  "/soon": "Honest fallback for destinations that have not shipped (dock stays alive).",
};
