/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";

import { ThemeProvider } from "../src/theme/ThemeProvider";
import { TodayEventsWidget } from "../src/home/widgets/TodayEventsWidget";
import { localTodayISO } from "../src/home/widgets/data";
import { contrastRatio } from "../src/lib/contrast";
import { mix } from "../src/theme/mix";
import { TOKENS } from "../src/theme/tokens";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

const parent = { id: "p1", name: "Rebecca (Mom)", role: "parent", emoji: "🐱", color: "green" };
let mockMember: any = parent;
jest.mock("../src/state/AuthProvider", () => ({
  useAuth: () => ({ member: mockMember, hydrated: true, signOut: jest.fn(), poke: jest.fn() }),
}));

const mockRefreshNow = jest.fn(async () => {});
const mockPulseListeners = new Set<() => void>();
const mockSyncValue = {
  stale: false,
  syncError: null,
  snapshot: null,
  lastSyncAt: null,
  refreshNow: mockRefreshNow,
  onPulse: (l: () => void) => {
    mockPulseListeners.add(l);
    return () => {
      mockPulseListeners.delete(l);
    };
  },
};
jest.mock("../src/state/SyncManager", () => ({
  useSync: () => mockSyncValue,
}));

jest.mock("../src/api/client", () => ({
  api: jest.fn(),
  ApiError: jest.requireActual("../src/api/client").ApiError,
}));
const { api } = jest.requireMock("../src/api/client") as { api: jest.Mock };
const { ApiError } = jest.requireActual("../src/api/client") as { ApiError: any };

const wrap = ({ children }: { children: React.ReactNode }) => <ThemeProvider>{children}</ThemeProvider>;
const today = localTodayISO();

const route = (handlers: Record<string, unknown>) =>
  api.mockImplementation((path: string) => {
    for (const key of Object.keys(handlers)) {
      if (path.startsWith(key)) {
        const v = handlers[key];
        return v instanceof Error ? Promise.reject(v) : Promise.resolve(v);
      }
    }
    return Promise.reject(new ApiError({ message: "unmapped path", status: 404, code: "not_found" }));
  });

const googleOk = (events: any[]) => ({ ok: true, connected: true, events, calendar_colors: null });
const pulse = async () => {
  await act(async () => {
    mockPulseListeners.forEach((l) => l());
    await Promise.resolve();
    await Promise.resolve();
  });
};

/** Depth-first host-node lookup on the rendered JSON. */
function findNode(node: any, testID: string): any {
  if (!node || typeof node !== "object") return null;
  if (node.props?.testID === testID) return node;
  const kids = Array.isArray(node.children) ? node.children : node.children ? [node.children] : [];
  for (const k of kids) {
    const hit = findNode(k, testID);
    if (hit) return hit;
  }
  return null;
}

/** Depth-first host Text whose string children equal `text`. */
function findText(node: any, text: string): any {
  if (!node || typeof node !== "object") return null;
  if (node.type === "Text") {
    const value = Array.isArray(node.children) ? node.children.join("") : String(node.children ?? "");
    if (value === text) return node;
  }
  const kids = Array.isArray(node.children) ? node.children : node.children ? [node.children] : [];
  for (const k of kids) {
    const hit = findText(k, text);
    if (hit) return hit;
  }
  return null;
}

/** The absolute 4dp rail View inside a ListRow. */
function railColorOf(row: any): string | undefined {
  const stack = row ? [row] : [];
  while (stack.length) {
    const n = stack.pop();
    if (!n || typeof n !== "object") continue;
    const styles = Array.isArray(n.props?.style) ? n.props.style.flat() : [n.props?.style];
    for (const s of styles) {
      if (s && typeof s === "object" && s.position === "absolute" && s.width === 4) return s.backgroundColor;
    }
    const kids = Array.isArray(n.children) ? n.children : n.children ? [n.children] : [];
    stack.push(...kids);
  }
  return undefined;
}

/** Resolve the rendered style of a host node (Pressable styles are functions). */
function styleOf(node: any): Record<string, any> {
  const raw = node?.props?.style;
  const s = typeof raw === "function" ? raw({ pressed: false }) : raw;
  const flat = (Array.isArray(s) ? s.flat(Infinity) : [s]).filter(Boolean);
  return Object.assign({}, ...flat.map((x) => (typeof x === "object" ? x : {})));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPulseListeners.clear();
  mockMember = parent;
  api.mockReset();
});

describe("TodayEventsWidget — dayline, rails, chips (reference parity)", () => {
  it("paints the DayLine above the rows with an event marker, and hides it from a11y", async () => {
    route({
      "/api/db/events": { items: [{ id: "e1", title: "Piano lesson", date: today, time: "17:30", member: "Aurora", icon: "🎹" }] },
      "/api/google-calendar": googleOk([{ google_id: "g1", summary: "Soccer game", start_iso: `${today}T15:00:00`, all_day: false, calendar_id: "primary" }]),
    });
    const { findByText, toJSON } = render(<TodayEventsWidget />, { wrapper: wrap });
    await findByText("2 events on the family calendar");

    const json = toJSON();
    const dayline = findNode(json, "todayEvents-dayline");
    expect(dayline).toBeTruthy();
    // decorative: the same facts exist as real text in the rows
    expect(dayline.props.accessibilityElementsHidden).toBe(true);
    expect(findNode(json, "todayEvents-dayline-fill")).toBeTruthy();
    expect(findNode(json, "todayEvents-dayline-now")).toBeTruthy();
    // the 3:00 PM Google event has a marker on the rail
    expect(findNode(json, "todayEvents-dayline-marker-0")).toBeTruthy();
  });

  it("renders the per-event left rail: cyan for Google, the MEMBER colour for family", async () => {
    route({
      "/api/db/events": {
        items: [
          { id: "e1", title: "Piano lesson", date: today, time: "17:30", member: "Aurora", icon: "🎹", color: "green" },
          { id: "e2", title: "Chores", date: today, time: "18:30", member: "Bailey", icon: "✅" },
        ],
      },
      "/api/google-calendar": googleOk([{ google_id: "g1", summary: "Soccer game", start_iso: `${today}T15:00:00`, all_day: false, calendar_id: "primary" }]),
    });
    const { findByText, toJSON } = render(<TodayEventsWidget />, { wrapper: wrap });
    await findByText("3 events on the family calendar");

    const json = toJSON();
    // budget = 2 rows: the 15:00 Google and 17:30 green rows are on screen.
    const googleRow = findNode(json, "todayEvents-row-g_g1");
    const greenRow = findNode(json, "todayEvents-row-db_e1");
    expect(googleRow).toBeTruthy();
    expect(greenRow).toBeTruthy();

    const cyan = [TOKENS.dark["color-accent-cyan"], TOKENS.light["color-accent-cyan"]];
    const green = [TOKENS.dark["color-accent-selected"], TOKENS.light["color-accent-selected"]];
    expect(cyan).toContain(railColorOf(googleRow)); // web eventLineColor: Google → cyan
    expect(green).toContain(railColorOf(greenRow)); // member colour green → accent-selected
  });

  it("no member colour → the web's amber fallback rail (never a blanket nori)", async () => {
    route({
      "/api/db/events": { items: [{ id: "e1", title: "Chores", date: today, time: "18:30", member: "Bailey", icon: "✅" }] },
      "/api/google-calendar": googleOk([]),
    });
    const { findByText, toJSON } = render(<TodayEventsWidget />, { wrapper: wrap });
    await findByText("1 event on the family calendar");
    const amber = [TOKENS.dark["color-accent-amber"], TOKENS.light["color-accent-amber"]];
    expect(amber).toContain(railColorOf(findNode(toJSON(), "todayEvents-row-db_e1")));
  });

  it("member chip is a tinted pill of the event accent with body ink — never a neutral label", async () => {
    route({
      "/api/db/events": { items: [] },
      "/api/google-calendar": googleOk([{ google_id: "g1", summary: "Soccer game", start_iso: `${today}T15:00:00`, all_day: false, calendar_id: "primary" }]),
    });
    const { findByText, toJSON } = render(<TodayEventsWidget />, { wrapper: wrap });
    await findByText("1 event on the family calendar");
    expect(await findByText("Google")).toBeTruthy();

    const chip = findNode(toJSON(), "todayEvents-member-chip-Google");
    expect(chip).toBeTruthy();
    const style = styleOf(chip);
    const neutrals = (["dark", "light"] as const).flatMap((t) => [
      TOKENS[t]["color-surface-0"],
      TOKENS[t]["color-surface-1"],
      TOKENS[t]["color-surface-2"],
    ]);
    expect(style.backgroundColor).toBeTruthy();
    expect(neutrals).not.toContain(style.backgroundColor); // tinted, not glass/neutral
    expect(style.borderWidth).toBe(1);

    // the label carries the body ink (primary), not muted secondary text
    const label = findText(chip, "Google");
    expect(label).toBeTruthy();
    expect(
      ["dark", "light"].map((t) => TOKENS[t as "dark"]["color-text-primary"])
    ).toContain(label.props.style.color);
  });
});

describe("TodayEventsWidget — Google failure is admitted, retryable, and keeps last-good rows", () => {
  it("the pill is a ≥64dp retry target that re-reads and clears itself", async () => {
    route({
      "/api/db/events": { items: [] },
      "/api/google-calendar": new ApiError({ message: "google upstream 502", status: 502, code: "http_502", retryable: true }),
    });
    const { getByTestId, findByText, queryByTestId } = render(<TodayEventsWidget />, { wrapper: wrap });
    await findByText("Google Calendar couldn't load — family events may be incomplete.");

    const pill = getByTestId("todayEvents-google-pill");
    expect(styleOf(pill).minHeight).toBeGreaterThanOrEqual(64); // the wall's tap floor
    expect(pill.props.accessibilityRole).toBe("button");
    expect(api.mock.calls.filter((c) => String(c[0]).startsWith("/api/google-calendar"))).toHaveLength(1);

    route({
      "/api/db/events": { items: [] },
      "/api/google-calendar": googleOk([]),
    });
    await act(async () => {
      fireEvent.press(pill);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockRefreshNow).toHaveBeenCalled(); // the retry seam
    expect(queryByTestId("todayEvents-google-pill")).toBeNull(); // recovered → pill gone
    expect(api.mock.calls.filter((c) => String(c[0]).startsWith("/api/google-calendar"))).toHaveLength(2);
  });

  it("last-good Google rows survive a transient failed refresh (badged by the pill)", async () => {
    route({
      "/api/db/events": { items: [] },
      "/api/google-calendar": googleOk([{ google_id: "g1", summary: "Soccer game", start_iso: `${today}T15:00:00`, all_day: false, calendar_id: "primary" }]),
    });
    const { findByText, getByText, queryByTestId } = render(<TodayEventsWidget />, { wrapper: wrap });
    await findByText("Soccer game");
    expect(queryByTestId("todayEvents-google-pill")).toBeNull();

    // the next pulse: Google 502s with NO surviving body — the rows must not vanish
    route({
      "/api/db/events": { items: [] },
      "/api/google-calendar": new ApiError({ message: "google upstream 502", status: 502, code: "http_502", retryable: true }),
    });
    await pulse();

    expect(getByText("Soccer game")).toBeTruthy(); // kept, web googleTodayRawRef parity
    expect(getByText(/couldn't load/i)).toBeTruthy(); // …and honestly badged
    expect(api.mock.calls.filter((c) => String(c[0]).startsWith("/api/google-calendar"))).toHaveLength(2);
  });

  it("an explicit disconnect DROPS the Google rows (never a stale ghost of a removed account)", async () => {
    route({
      "/api/db/events": { items: [] },
      "/api/google-calendar": googleOk([{ google_id: "g1", summary: "Soccer game", start_iso: `${today}T15:00:00`, all_day: false, calendar_id: "primary" }]),
    });
    const { findByText, getByText, queryByText } = render(<TodayEventsWidget />, { wrapper: wrap });
    await findByText("Soccer game");

    route({
      "/api/db/events": { items: [] },
      "/api/google-calendar": { ok: true, connected: false, source: "none", events: [] },
    });
    await pulse();

    expect(queryByText("Soccer game")).toBeNull();
    expect(getByText("Google Calendar isn't connected.")).toBeTruthy();
  });
});

describe("TodayEventsWidget — guest split (reference capture: family live, Google gated)", () => {
  it("a signed-out wall reads FAMILY events live and gates ONLY the Google pill", async () => {
    mockMember = null;
    route({
      "/api/db/events": { items: [{ id: "e1", title: "Piano lesson", date: localTodayISO(), time: "17:30", member: "Aurora", icon: "🎹" }] },
    });
    const { findByText, queryByText } = render(<TodayEventsWidget />, { wrapper: wrap });
    // family rows render live (the db-gateway read is public)
    expect(await findByText("Piano lesson")).toBeTruthy();
    expect(await findByText("1 event on the family calendar")).toBeTruthy();
    // only the Google lane is PIN-gated — with the reference's exact pill copy
    expect(
      await findByText("🔒 Google Calendar: Sign in with your PIN to see the family's data.")
    ).toBeTruthy();
    // zero doomed Google fetches for a guest
    expect(api.mock.calls.filter((c) => String(c[0]).startsWith("/api/google-calendar")).length).toBe(0);
    expect(queryByText("Sign in with your PIN to see the family's data.")).toBeNull();
  });
});

describe("TodayEventsWidget — the amber pill ink clears AA in both themes", () => {
  it("color-accent-ink-amber on the 14% amber wash ≥ 4.5:1 dark AND light", () => {
    for (const t of ["dark", "light"] as const) {
      const ink = TOKENS[t]["color-accent-ink-amber"];
      const amber = TOKENS[t]["color-accent-amber"];
      const surface = TOKENS[t]["color-surface-0"];
      // the pill paints mix(amber, transparent, 14) over the card surface —
      // compositing that over an opaque surface is mix(amber, surface, 14).
      const wash = mix(amber, surface, 14);
      expect(contrastRatio(ink, wash)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(ink, surface)).toBeGreaterThanOrEqual(4.5); // and on the bare card
    }
  });
});
