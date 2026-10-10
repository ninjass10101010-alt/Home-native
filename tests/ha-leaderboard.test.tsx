/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { render } from "@testing-library/react-native";

import { ThemeProvider } from "../src/theme/ThemeProvider";
import { HomeSecurityWidget } from "../src/home/widgets/HomeSecurityWidget";
import { HomeClimateWidget } from "../src/home/widgets/HomeClimateWidget";
import { HomeLightsWidget } from "../src/home/widgets/HomeLightsWidget";
import { LeaderboardWidget } from "../src/home/widgets/LeaderboardWidget";
import { QuickAskWidget } from "../src/home/widgets/QuickAskWidget";
import { _resetHAStore } from "../src/home/widgets/ha-state";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

jest.mock("../src/state/AuthProvider", () => ({
  useAuth: () => ({ member: { id: "p1", role: "parent" }, hydrated: true, signOut: jest.fn(), poke: jest.fn() }),
}));

jest.mock("../src/api/client", () => ({
  api: jest.fn(),
  ApiError: jest.requireActual("../src/api/client").ApiError,
}));
const { api } = jest.requireMock("../src/api/client") as { api: jest.Mock };

let mockSnapshot: any = null;
let mockStale = false;
jest.mock("../src/state/SyncManager", () => ({
  useSync: () => ({
    snapshot: mockSnapshot,
    stale: mockStale,
    syncError: null,
    lastSyncAt: 1,
    refreshNow: jest.fn(async () => {}),
    onPulse: () => () => {},
  }),
  SyncManager: ({ children }: any) => children,
}));

const wrap = ({ children }: { children: React.ReactNode }) => <ThemeProvider>{children}</ThemeProvider>;

const haStates = [
  { entity_id: "person.rebecca", state: "home", attributes: {}, last_updated: "" },
  { entity_id: "person.jeffery", state: "away", attributes: {}, last_updated: "" },
  { entity_id: "binary_sensor.front_door", state: "on", attributes: { device_class: "door" }, last_updated: "" },
  { entity_id: "binary_sensor.kitchen_window", state: "off", attributes: { device_class: "window" }, last_updated: "" },
  { entity_id: "alarm_control_panel.home", state: "disarmed", attributes: {}, last_updated: "" },
  { entity_id: "climate.downstairs", state: "heat", attributes: { current_temperature: 68.4, temperature: 70, hvac_mode: "heat" }, last_updated: "" },
  { entity_id: "light.kitchen", state: "on", attributes: { friendly_name: "Kitchen" }, last_updated: "" },
  { entity_id: "light.hall", state: "on", attributes: { friendly_name: "Hall" }, last_updated: "" },
  { entity_id: "light.garage", state: "off", attributes: { friendly_name: "Garage" }, last_updated: "" },
];

describe("HA trio (shared single-fetch store)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _resetHAStore();
    api.mockReset();
    mockSnapshot = null;
    mockStale = false;
  });

  it("ONE /api/ha/sync call serves all three widgets (the shared-store contract)", async () => {
    api.mockResolvedValue({ success: true, count: haStates.length, states: haStates });
    render(
      <ThemeProvider>
        <HomeSecurityWidget />
        <HomeClimateWidget />
        <HomeLightsWidget />
      </ThemeProvider>,
      { wrapper: wrap }
    );
    // settle the shared fetch
    await Promise.resolve();
    await Promise.resolve();
    const haCalls = api.mock.calls.filter((c: any[]) => c[0] === "/api/ha/sync");
    expect(haCalls.length).toBe(1); // NOT three
  });

  it("security: presence count, open sensors, alarm state", async () => {
    api.mockResolvedValue({ success: true, count: haStates.length, states: haStates });
    const { findByText } = render(<HomeSecurityWidget />, { wrapper: wrap });
    expect(await findByText(/1 home of 2/)).toBeTruthy();
    expect(await findByText(/1 open sensor/)).toBeTruthy();
    expect(await findByText(/Alarm: disarmed/)).toBeTruthy();
  });

  it("empty HA → honest empty states (no fabricated presence)", async () => {
    api.mockResolvedValue({ success: true, count: 0, states: [] });
    const { findByText } = render(<HomeSecurityWidget />, { wrapper: wrap });
    expect(await findByText("No presence data yet.")).toBeTruthy();
  });

  it("climate: current → target with mode", async () => {
    api.mockResolvedValue({ success: true, count: haStates.length, states: haStates });
    const { findByText } = render(<HomeClimateWidget />, { wrapper: wrap });
    expect(await findByText(/68° → 70°/)).toBeTruthy();
    expect(await findByText("heat")).toBeTruthy();
  });

  it("lights: on-count + first names + overflow", async () => {
    api.mockResolvedValue({ success: true, count: haStates.length, states: haStates });
    const { findByText } = render(<HomeLightsWidget />, { wrapper: wrap });
    expect(await findByText(/2 on of 3/)).toBeTruthy();
    expect(await findByText(/Kitchen/)).toBeTruthy();
  });
});

describe("Leaderboard (shared snapshot — no widget fetch)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.mockReset();
  });

  it("ranks the week from the sync snapshot, medals for top 3", () => {
    mockSnapshot = {
      weekData: { weekStart: "2026-10-05", points: { "Bailey": 12, "Emily": 20, "Aurora": 5, "Caspian": 5 } },
    };
    const { getByText } = render(<LeaderboardWidget />, { wrapper: wrap });
    expect(getByText(/Emily — 20/)).toBeTruthy();
    expect(getByText(/Bailey — 12/)).toBeTruthy();
    expect(getByText(/🥇/)).toBeTruthy();
    expect(api).not.toHaveBeenCalled(); // reads the SHARED snapshot, no fetch
  });

  it("empty week → 'Be the first!'", () => {
    mockSnapshot = { weekData: { weekStart: "2026-10-05", points: {} } };
    const { getByText } = render(<LeaderboardWidget />, { wrapper: wrap });
    expect(getByText("Be the first!")).toBeTruthy();
  });
});

describe("QuickAsk (honest v2 placeholder)", () => {
  it("tells the family when Ask arrives — no dead input", () => {
    const { getByText } = render(<QuickAskWidget />, { wrapper: wrap });
    expect(getByText(/Arrives with chat in the next wave/)).toBeTruthy();
  });
});
