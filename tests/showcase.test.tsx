/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { render } from "@testing-library/react-native";
 
import DesignKitShowcase from "../app/_design";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { SyncManager } from "../src/state/SyncManager";
import { ToastProvider } from "../src/ui/Toast";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

jest.mock("../src/state/AuthProvider", () => ({
  useAuth: () => ({
    member: null,
    hydrated: true,
    signOut: jest.fn(async () => {}),
  }),
  AuthProvider: ({ children }: any) => children,
}));
jest.mock("../src/api/client", () => ({ api: jest.fn(async () => ({ snapshot: null })), ApiError: class extends Error {} }));

const wrap = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>
    <SyncManager>
      <ToastProvider>{children}</ToastProvider>
    </SyncManager>
  </ThemeProvider>
);

describe("design-kit showcase", () => {
  it("renders every section with floors intact", () => {
    const { getByText } = render(<DesignKitShowcase />, { wrapper: wrap });
    for (const s of [
      "Theme controls",
      "Materials",
      "Surfaces",
      "Buttons",
      "Chips",
      "Segmented + Toggle + Stepper",
      "List + Swipe",
      "Field + Empty + PinPad",
      "Type ramp",
    ]) {
      expect(getByText(s)).toBeTruthy();
    }
    // 10 accent chips (scoped: cyan/violet also exist as tone demos)
    const { getByTestId } = render(<DesignKitShowcase />, { wrapper: wrap });
    for (const a of ["nori", "violet", "rose", "cyan", "mint", "amber", "coral", "lavender", "apricot", "sage"]) {
      expect(getByTestId(`accent-chip-${a}`)).toBeTruthy();
    }
  });
});
