/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { ThemeProvider } from "../src/theme/ThemeProvider";
import { HousePage } from "../src/ha/HousePage";
import { _resetHAStore } from "../src/home/widgets/ha-state";
import { ToastProvider } from "../src/ui/Toast";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

const mockRoleState = { role: "parent" };
jest.mock("../src/state/AuthProvider", () => ({
  useAuth: () => ({ member: { id: "p1", role: mockRoleState.role }, role: mockRoleState.role === "parent" ? "parent" : null, hydrated: true, signOut: jest.fn(), poke: jest.fn() }),
}));

jest.mock("../src/api/client", () => ({
  api: jest.fn(),
  ApiError: jest.requireActual("../src/api/client").ApiError,
}));
const { api } = jest.requireMock("../src/api/client") as { api: jest.Mock };
const { ApiError } = jest.requireActual("../src/api/client") as any;

jest.mock("../src/state/SyncManager", () => ({
  useSync: () => ({ snapshot: null, stale: false, syncError: null, lastSyncAt: 1, refreshNow: jest.fn(async () => {}), onPulse: () => () => {} }),
  SyncManager: ({ children }: any) => children,
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => "/ha",
}));

const haStates = [
  { entity_id: "person.rebecca", state: "home", attributes: { friendly_name: "Rebecca", area_id: "Living Room" }, last_updated: "" },
  { entity_id: "binary_sensor.front_door", state: "on", attributes: { device_class: "door", friendly_name: "Front door", area_id: "Entry" }, last_updated: "" },
  { entity_id: "alarm_control_panel.home", state: "disarmed", attributes: { area_id: "Entry" }, last_updated: "" },
  { entity_id: "climate.downstairs", state: "heat", attributes: { current_temperature: 68.4, temperature: 70, hvac_mode: "heat", area_id: "Living Room" }, last_updated: "" },
  { entity_id: "light.kitchen", state: "on", attributes: { friendly_name: "Kitchen", area_id: "Kitchen" }, last_updated: "" },
  { entity_id: "light.hall", state: "off", attributes: { friendly_name: "Hall", area_id: "Hallway" }, last_updated: "" },
  { entity_id: "switch.porch", state: "on", attributes: { friendly_name: "Porch", area_id: "Outside" }, last_updated: "" },
];

const wrap = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>
    <ToastProvider>{children}</ToastProvider>
  </ThemeProvider>
);

describe("HousePage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _resetHAStore();
    api.mockReset();
    mockRoleState.role = "parent";
    api.mockImplementation(async (path: string) => {
      if (path === "/api/ha/health") return { ok: true, wsConnected: true };
      if (path === "/api/ha/sync") return { success: true, count: haStates.length, states: haStates };
      return { success: true };
    });
  });

  it("renders four sections", async () => {
    const { findByText } = render(<HousePage />, { wrapper: wrap });
    expect(await findByText("Security & Alarm")).toBeTruthy();
    expect(await findByText("Climate")).toBeTruthy();
    expect(await findByText("Lights & Switches")).toBeTruthy();
    expect(await findByText("Presence & Sensors")).toBeTruthy();
  });

  it("shows CONNECTED pill", async () => {
    const { findByTestId } = render(<HousePage />, { wrapper: wrap });
    const pill = await findByTestId("ha-connection-pill");
    expect(pill).toBeTruthy();
  });

  it("guest shows parent-gate banner", async () => {
    mockRoleState.role = "guest";
    const { findByText } = render(<HousePage />, { wrapper: wrap });
    expect(await findByText("Sign in as a parent to control the house.")).toBeTruthy();
  });

  it("offline honest state", async () => {
    api.mockImplementation(async (path: string) => {
      if (path === "/api/ha/health") return { ok: false, wsConnected: false };
      if (path === "/api/ha/sync") throw new ApiError({ message: "down", status: 502, code: "server_error" });
      return { success: true };
    });
    const { findByText } = render(<HousePage />, { wrapper: wrap });
    expect(await findByText("Home Assistant is offline")).toBeTruthy();
  });

  it("filters out UniFi/system switches while keeping real smart outlets and supports room filtering", async () => {
    const richStates = [
      {
        entity_id: "light.kitchen_main_light",
        state: "on",
        attributes: {
          friendly_name: "Kitchen Main Light",
          area_id: "Kitchen",
          supported_color_modes: ["color_temp"],
          brightness: 204,
          color_temp_kelvin: 3500,
        },
        last_updated: "",
      },
      {
        entity_id: "switch.plant_light_socket",
        state: "off",
        attributes: {
          device_class: "outlet",
          friendly_name: "Living Room Plant Light",
          area_id: "Living Room",
        },
        last_updated: "",
      },
      {
        entity_id: "switch.unifi_network_plex",
        state: "on",
        attributes: { friendly_name: "UniFi Network Plex" },
        last_updated: "",
      },
      {
        entity_id: "switch.plant_light_child_lock",
        state: "off",
        attributes: { friendly_name: "Plant light Child lock" },
        last_updated: "",
      },
      {
        entity_id: "switch.demo_sim_front_door",
        state: "off",
        attributes: { friendly_name: "Demo Sim Front Door" },
        last_updated: "",
      },
    ];
    api.mockImplementation(async (path: string) => {
      if (path === "/api/ha/health") return { ok: true, wsConnected: true };
      if (path === "/api/ha/sync") return { success: true, count: richStates.length, states: richStates };
      return { success: true };
    });

    const { findByText, findByTestId, queryByText } = render(<HousePage />, { wrapper: wrap });
    expect(await findByText(/Kitchen Main Light/)).toBeTruthy();
    expect(await findByText(/Living Room Plant Light/)).toBeTruthy();
    expect(queryByText(/UniFi Network Plex/)).toBeNull();
    expect(queryByText(/Child lock/)).toBeNull();
    expect(queryByText(/Demo Sim Front Door/)).toBeNull();

    const livingChip = await findByTestId("area-chip-Living Room");
    fireEvent.press(livingChip);
    await waitFor(() => {
      expect(queryByText(/Kitchen Main Light/)).toBeNull();
      expect(queryByText(/Living Room Plant Light/)).toBeTruthy();
    });
  });

  it("sends brightness_pct and color_temp_kelvin service calls for tunable bulbs", async () => {
    const bulbStates = [
      {
        entity_id: "light.kitchen_main_light",
        state: "on",
        attributes: {
          friendly_name: "Kitchen Main Light",
          area_id: "Kitchen",
          supported_color_modes: ["color_temp"],
          brightness: 128,
          color_temp_kelvin: 3500,
        },
        last_updated: "",
      },
    ];
    api.mockImplementation(async (path: string) => {
      if (path === "/api/ha/health") return { ok: true, wsConnected: true };
      if (path === "/api/ha/sync") return { success: true, count: bulbStates.length, states: bulbStates };
      return { success: true };
    });

    const { findByTestId } = render(<HousePage />, { wrapper: wrap });
    const bright75 = await findByTestId("brightness-light.kitchen_main_light-75");
    fireEvent.press(bright75);

    await waitFor(() => {
      const call = api.mock.calls.find((c: any[]) => c[0] === "/api/ha/call-service");
      expect(call).toBeTruthy();
      expect((call![1] as any).body).toMatchObject({
        domain: "light",
        service: "turn_on",
        entity_id: "light.kitchen_main_light",
        service_data: { brightness_pct: 75 },
      });
    });

    const warm2700 = await findByTestId("colortemp-light.kitchen_main_light-2700");
    fireEvent.press(warm2700);

    await waitFor(() => {
      const calls = api.mock.calls.filter((c: any[]) => c[0] === "/api/ha/call-service");
      expect(calls.length).toBeGreaterThanOrEqual(2);
      expect((calls[calls.length - 1][1] as any).body).toMatchObject({
        domain: "light",
        service: "turn_on",
        entity_id: "light.kitchen_main_light",
        service_data: { color_temp_kelvin: 2700 },
      });
    });
  });

  it("renders door and motion sensors with simulation toggles calling switch.toggle", async () => {
    const sensorStates = [
      {
        entity_id: "binary_sensor.front_door",
        state: "off",
        attributes: {
          device_class: "door",
          friendly_name: "Front Door",
          area_id: "Living Room",
          demo_sim_entity: "switch.demo_sim_front_door",
        },
        last_updated: "",
      },
      {
        entity_id: "binary_sensor.kitchen_motion",
        state: "off",
        attributes: {
          device_class: "motion",
          friendly_name: "Kitchen Motion",
          area_id: "Kitchen",
          demo_sim_entity: "switch.demo_sim_kitchen_motion",
        },
        last_updated: "",
      },
    ];
    api.mockImplementation(async (path: string) => {
      if (path === "/api/ha/health") return { ok: true, wsConnected: true };
      if (path === "/api/ha/sync") return { success: true, count: sensorStates.length, states: sensorStates };
      return { success: true };
    });

    const { findByText, findByTestId } = render(<HousePage />, { wrapper: wrap });
    expect(await findByText("DOORS & WINDOWS (1)")).toBeTruthy();
    expect(await findByText("MOTION SENSORS (1)")).toBeTruthy();
    expect(await findByText(/Front Door/)).toBeTruthy();
    expect(await findByText(/Kitchen Motion/)).toBeTruthy();

    const simDoor = await findByTestId("sim-sensor-binary_sensor.front_door");
    fireEvent.press(simDoor);
    await waitFor(() => {
      const call = api.mock.calls.find((c: any[]) => c[0] === "/api/ha/call-service");
      expect((call![1] as any).body).toMatchObject({
        domain: "switch",
        service: "toggle",
        entity_id: "switch.demo_sim_front_door",
      });
    });

    const simMotion = await findByTestId("sim-sensor-binary_sensor.kitchen_motion");
    fireEvent.press(simMotion);
    await waitFor(() => {
      const calls = api.mock.calls.filter((c: any[]) => c[0] === "/api/ha/call-service");
      expect((calls[calls.length - 1][1] as any).body).toMatchObject({
        domain: "switch",
        service: "toggle",
        entity_id: "switch.demo_sim_kitchen_motion",
      });
    });
  });
});

describe("HA actions call-site contract", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.mockReset();
    api.mockResolvedValue({ success: true });
  });

  it("callHAService posts to /api/ha/call-service", async () => {
    const { callHAService } = require("../src/ha/actions");
    await callHAService({ domain: "light", service: "toggle", entity_id: "light.kitchen" });
    expect(api).toHaveBeenCalledWith("/api/ha/call-service", expect.objectContaining({ method: "POST" }));
    const body = (api.mock.calls[0][1] as any).body;
    expect(body.domain).toBe("light");
    expect(body.service).toBe("toggle");
    expect(body.entity_id).toBe("light.kitchen");
  });

  it("triggerHAAlarm posts to /api/ha/alarm", async () => {
    const { triggerHAAlarm } = require("../src/ha/actions");
    await triggerHAAlarm({ action: "arm_home", pin: "1234", entity_id: "alarm_control_panel.home" });
    expect(api).toHaveBeenCalledWith("/api/ha/alarm", expect.objectContaining({ method: "POST" }));
    const body = (api.mock.calls[0][1] as any).body;
    expect(body.action).toBe("arm_home");
    expect(body.pin).toBe("1234");
    expect(body.entity_id).toBe("alarm_control_panel.home");
  });

  it("classifies 403 vs 502", () => {
    const { classifyHAError } = require("../src/ha/actions");
    expect(classifyHAError(new ApiError({ message: "x", status: 403, code: "forbidden" }))).toBe("forbidden");
    expect(classifyHAError(new ApiError({ message: "x", status: 502, code: "server" }))).toBe("server");
    expect(classifyHAError(new ApiError({ message: "x", status: 0, code: "unreachable" }))).toBe("offline");
  });
});
