/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ThemeProvider } from "../src/theme/ThemeProvider";
import { ToastProvider } from "../src/ui/Toast";
import FamilyMemoryRoute from "../app/memory";
import { MIN_TARGET_DP, TYPE_FLOOR_SP, TYPOGRAPHY } from "../src/theme/tokens";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

const mockRouterReplace = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockRouterReplace, canGoBack: () => false }),
  usePathname: () => "/memory",
  useLocalSearchParams: () => ({}),
}));

let mockRole: "parent" | "child" | "pet" | null = "parent";

jest.mock("../src/state/AuthProvider", () => ({
  useAuth: () => ({
    member: { id: "m1", name: "David", role: mockRole, emoji: "👨", color: "nori" },
    role: mockRole,
    hydrated: true,
    signOut: jest.fn(),
    poke: jest.fn(),
    pinRequiredFor: () => false,
  }),
}));

const wrap = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>
    <ToastProvider>{children}</ToastProvider>
  </ThemeProvider>
);

describe("FamilyMemoryRoute — Babysitter & Pinned VIP Cards", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockRole = "parent";
    await AsyncStorage.clear();
  });

  it("renders emergency quick-sheet banner with default pinned VIP cards count and toggle", async () => {
    const { findByTestId, getByTestId, findByText } = render(<FamilyMemoryRoute />, { wrapper: wrap });

    expect(await findByTestId("memory-route")).toBeTruthy();
    expect(await findByTestId("memory-emergency-banner")).toBeTruthy();

    const countLabel = getByTestId("memory-pinned-count");
    expect(countLabel.props.children).toContain("2 Pinned VIP cards ready for sitters, grandparents & guests");

    const toggleBtn = getByTestId("memory-pinned-toggle");
    expect(toggleBtn).toBeTruthy();
    expect(await findByText("📌 Filter Pinned VIP")).toBeTruthy();

    // Default items: mem-1 and mem-2 pinned, mem-3 unpinned
    expect(await findByTestId("memory-card-mem-1")).toBeTruthy();
    expect(await findByTestId("memory-card-mem-2")).toBeTruthy();
    expect(await findByTestId("memory-card-mem-3")).toBeTruthy();

    // Pin badges/buttons
    expect(getByTestId("memory-pin-mem-1")).toBeTruthy();
    expect(getByTestId("memory-pin-mem-2")).toBeTruthy();
    expect(getByTestId("memory-pin-mem-3")).toBeTruthy();
  });

  it("toggles pinned-only mode to show only pinned cards", async () => {
    const { findByTestId, getByTestId, findByText, queryByTestId } = render(<FamilyMemoryRoute />, { wrapper: wrap });

    expect(await findByTestId("memory-card-mem-3")).toBeTruthy();

    // Toggle pinned-only
    await act(async () => {
      fireEvent.press(getByTestId("memory-pinned-toggle"));
    });

    expect(await findByText("📌 Showing Pinned Only")).toBeTruthy();

    // Pinned cards remain visible
    expect(queryByTestId("memory-card-mem-1")).toBeTruthy();
    expect(queryByTestId("memory-card-mem-2")).toBeTruthy();

    // Unpinned cards are hidden
    expect(queryByTestId("memory-card-mem-3")).toBeNull();
    expect(queryByTestId("memory-card-mem-4")).toBeNull();
    expect(queryByTestId("memory-card-mem-5")).toBeNull();

    // Toggle back off
    await act(async () => {
      fireEvent.press(getByTestId("memory-pinned-toggle"));
    });

    expect(await findByText("📌 Filter Pinned VIP")).toBeTruthy();
    expect(await findByTestId("memory-card-mem-3")).toBeTruthy();
  });

  it("pins and unpins VIP cards, updates banner count and persists to AsyncStorage", async () => {
    const { findByTestId, getByTestId } = render(<FamilyMemoryRoute />, { wrapper: wrap });

    expect(await findByTestId("memory-card-mem-3")).toBeTruthy();
    const countLabel = getByTestId("memory-pinned-count");
    expect(countLabel.props.children).toContain("2 Pinned VIP cards");

    // Pin mem-3
    await act(async () => {
      fireEvent.press(getByTestId("memory-pin-mem-3"));
    });

    expect(countLabel.props.children).toContain("3 Pinned VIP cards");
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      "@consuela/family_memory_v1",
      expect.stringContaining('"id":"mem-3"')
    );

    // Unpin mem-1
    await act(async () => {
      fireEvent.press(getByTestId("memory-pin-mem-1"));
    });

    expect(countLabel.props.children).toContain("2 Pinned VIP cards");
  });

  it("offers 1-tap starter templates in composer modal that prefill draft fields", async () => {
    const { findByTestId, getByTestId, findByText } = render(<FamilyMemoryRoute />, { wrapper: wrap });

    // Open composer
    await act(async () => {
      fireEvent.press(getByTestId("memory-add-button"));
    });

    expect(await findByTestId("memory-composer-modal")).toBeTruthy();
    expect(await findByTestId("memory-tpl-sitters")).toBeTruthy();
    expect(await findByTestId("memory-tpl-bedtime")).toBeTruthy();
    expect(await findByTestId("memory-tpl-pets")).toBeTruthy();
    expect(await findByTestId("memory-tpl-wifi")).toBeTruthy();

    // Tap sitters template
    await act(async () => {
      fireEvent.press(getByTestId("memory-tpl-sitters"));
    });

    const titleInput = getByTestId("memory-composer-title");
    const detailInput = getByTestId("memory-composer-detail");
    expect(titleInput.props.value).toBe("Emergency Contacts & Neighbors");
    expect(detailInput.props.value).toContain("Poison Control: 800-222-1222");

    // Save template item
    await act(async () => {
      fireEvent.press(getByTestId("memory-composer-save"));
    });

    expect(await findByText("Emergency Contacts & Neighbors")).toBeTruthy();

    // Verify bedtime template in a second add flow
    await act(async () => {
      fireEvent.press(getByTestId("memory-add-button"));
    });
    await act(async () => {
      fireEvent.press(getByTestId("memory-tpl-bedtime"));
    });
    expect(getByTestId("memory-composer-title").props.value).toBe("Bedtime & House Rules");
    expect(getByTestId("memory-composer-detail").props.value).toContain("Pajamas & brush teeth");
  });

  it("gates card deletion capability strictly for parent role", async () => {
    // Parent session: delete buttons are present
    mockRole = "parent";
    const { findByTestId, queryByTestId, unmount } = render(<FamilyMemoryRoute />, { wrapper: wrap });

    expect(await findByTestId("memory-card-mem-1")).toBeTruthy();
    expect(queryByTestId("memory-delete-mem-1")).toBeTruthy();

    unmount();

    // Child session: delete buttons are hidden, but pin toggle remains accessible
    mockRole = "child";
    const childRender = render(<FamilyMemoryRoute />, { wrapper: wrap });

    expect(await childRender.findByTestId("memory-card-mem-1")).toBeTruthy();
    expect(childRender.queryByTestId("memory-delete-mem-1")).toBeNull();
    expect(childRender.getByTestId("memory-pin-mem-1")).toBeTruthy();
  });

  it("deleting a card removes it when performed by parent", async () => {
    mockRole = "parent";
    const { findByTestId, getByTestId, queryByTestId } = render(<FamilyMemoryRoute />, { wrapper: wrap });

    expect(await findByTestId("memory-card-mem-5")).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId("memory-delete-mem-5"));
    });

    await waitFor(() => {
      expect(queryByTestId("memory-card-mem-5")).toBeNull();
    });
  });

  it("enforces 64dp tap target floor and 14sp type floor contracts", async () => {
    const { findByTestId, getByTestId } = render(<FamilyMemoryRoute />, { wrapper: wrap });

    expect(await findByTestId("memory-route")).toBeTruthy();

    const bannerToggle = getByTestId("memory-pinned-toggle");
    const bannerToggleStyle = StyleSheet.flatten(bannerToggle.props.style);
    expect(bannerToggleStyle.minHeight).toBeGreaterThanOrEqual(MIN_TARGET_DP);
    expect(bannerToggleStyle.minWidth).toBeGreaterThanOrEqual(MIN_TARGET_DP);

    const pinBtn = getByTestId("memory-pin-mem-1");
    const pinStyle = StyleSheet.flatten(pinBtn.props.style);
    expect(pinStyle.minHeight).toBeGreaterThanOrEqual(MIN_TARGET_DP);
    expect(pinStyle.minWidth).toBeGreaterThanOrEqual(MIN_TARGET_DP);

    const filterBtn = getByTestId("memory-filter-Medical & Allergies");
    const filterStyle = StyleSheet.flatten(filterBtn.props.style);
    expect(filterStyle.minHeight).toBeGreaterThanOrEqual(MIN_TARGET_DP);
    expect(filterStyle.minWidth).toBeGreaterThanOrEqual(MIN_TARGET_DP);

    // Open composer to check modal buttons
    await act(async () => {
      fireEvent.press(getByTestId("memory-add-button"));
    });

    const tplBtn = getByTestId("memory-tpl-sitters");
    const tplStyle = StyleSheet.flatten(tplBtn.props.style);
    expect(tplStyle.minHeight).toBeGreaterThanOrEqual(MIN_TARGET_DP);
    expect(tplStyle.minWidth).toBeGreaterThanOrEqual(MIN_TARGET_DP);

    const catBtn = getByTestId("memory-composer-cat-Medical & Allergies");
    const catStyle = StyleSheet.flatten(catBtn.props.style);
    expect(catStyle.minHeight).toBeGreaterThanOrEqual(MIN_TARGET_DP);
    expect(catStyle.minWidth).toBeGreaterThanOrEqual(MIN_TARGET_DP);

    // Validate type floor contract token
    expect(TYPE_FLOOR_SP).toBeGreaterThanOrEqual(14);
    expect(TYPOGRAPHY.label.fontSize).toBeGreaterThanOrEqual(14);
  });
});
