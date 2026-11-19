/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { StyleSheet, Text } from "react-native";
import { act, fireEvent, render } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { PRESS_IN_MS, SPRING, Spring } from "../src/theme/tokens";
import { hapticError, hapticSelect, hapticSuccess, hapticTap } from "../src/theme/haptics";
import { RootWallStage, Screen, WallStageContext } from "../src/theme/Screen";
import { CapsuleDock, RootDockContext } from "../src/nav/CapsuleDock";
import { Modal } from "../src/ui/Modal";
import { ToastProvider, useToast } from "../src/ui/Toast";
import { WallStatStrip } from "../src/home/WallStatsStrip";
import { publishWallStats, resetWallStats } from "../src/home/wall-stats";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
}));

const wrap = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>
    <ToastProvider>{children}</ToastProvider>
  </ThemeProvider>
);

function ToastTrigger() {
  const toast = useToast();
  return (
    <Text testID="fire-toast" onPress={() => toast.show("Polished!", { intent: "info" })}>
      Fire
    </Text>
  );
}

describe("motion presets & haptics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("exports calibrated spring configs and snappy press-in duration", () => {
    expect(PRESS_IN_MS).toBe(70);
    expect(SPRING.press).toMatchObject({ damping: 20, stiffness: 420, mass: 0.7 });
    expect(SPRING.settle).toMatchObject({ damping: 24, stiffness: 280, mass: 0.85 });
    expect(SPRING.bouncy).toMatchObject({ damping: 14, stiffness: 260, mass: 0.8 });
    expect(Spring).toBe(SPRING);
  });

  it("haptic helpers invoke expo-haptics and swallow rejections safely", async () => {
    (Haptics.impactAsync as jest.Mock).mockRejectedValueOnce(new Error("no vibrator"));
    (Haptics.selectionAsync as jest.Mock).mockRejectedValueOnce(new Error("no vibrator"));
    (Haptics.notificationAsync as jest.Mock).mockRejectedValue(new Error("no vibrator"));

    expect(() => {
      hapticTap();
      hapticSelect();
      hapticSuccess();
      hapticError();
    }).not.toThrow();

    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Error);
    await Promise.resolve();
  });
});

describe("persistent root dock & wall stage", () => {
  it("defers per-route CapsuleDock inside RootDockContext unless isRoot is true", () => {
    const inside = render(
      <ThemeProvider>
        <RootDockContext.Provider value={true}>
          <CapsuleDock role="parent" hydrated pathname="/" onNavigate={() => {}} />
        </RootDockContext.Provider>
      </ThemeProvider>
    );
    expect(inside.toJSON()).toBeNull();
    expect(inside.queryByTestId("floating-dock")).toBeNull();

    const root = render(
      <RootDockContext.Provider value={true}>
        <CapsuleDock isRoot role="parent" hydrated pathname="/" onNavigate={() => {}} />
      </RootDockContext.Provider>,
      { wrapper: wrap }
    );
    expect(root.getByTestId("floating-dock")).toBeTruthy();

    const standalone = render(
      <CapsuleDock role="parent" hydrated pathname="/" onNavigate={() => {}} />,
      { wrapper: wrap }
    );
    expect(standalone.getByTestId("floating-dock")).toBeTruthy();
  });

  it("renders Screen cleanly inside RootWallStage and WallStageContext", () => {
    const staged = render(
      <RootWallStage>
        <Screen testID="staged-screen">
          <Text>In Stage</Text>
        </Screen>
      </RootWallStage>,
      { wrapper: wrap }
    );
    expect(staged.getByTestId("staged-screen")).toBeTruthy();
    expect(staged.getByText("In Stage")).toBeTruthy();

    const ctxStaged = render(
      <WallStageContext.Provider value={true}>
        <Screen testID="ctx-screen">
          <Text>Ctx Stage</Text>
        </Screen>
      </WallStageContext.Provider>,
      { wrapper: wrap }
    );
    expect(ctxStaged.getByTestId("ctx-screen")).toBeTruthy();
  });
});

describe("Modal sheet variant & Toast band clearance", () => {
  it("sheet variant shows grabber only when dismissable and closes on dismiss", () => {
    const onClose = jest.fn();
    const { getByTestId, getByLabelText, queryByTestId, rerender } = render(
      <ThemeProvider>
        <Modal visible variant="sheet" title="More…" onClose={onClose} testID="sheet-m">
          <Text>Items</Text>
        </Modal>
      </ThemeProvider>
    );
    expect(getByTestId("modal-sheet-grabber")).toBeTruthy();
    fireEvent.press(getByLabelText("Dismiss"));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent(getByTestId("sheet-m"), "requestClose");
    expect(onClose).toHaveBeenCalledTimes(2);

    rerender(
      <ThemeProvider>
        <Modal visible variant="sheet" dismissable={false} title="Locked" onClose={onClose} testID="sheet-m">
          <Text>Items</Text>
        </Modal>
      </ThemeProvider>
    );
    expect(queryByTestId("modal-sheet-grabber")).toBeNull();
  });

  it("positions Toast below the MusicIsland band (top: 72, zIndex: 9998)", () => {
    jest.useFakeTimers();
    const { getByTestId, UNSAFE_root } = render(<ToastTrigger />, { wrapper: wrap });
    fireEvent.press(getByTestId("fire-toast"));
    const alert = UNSAFE_root.findAll((n) => n.props.accessibilityRole === "alert")[0];
    expect(alert).toBeTruthy();
    const host = UNSAFE_root.findAll((n) => {
      const s = StyleSheet.flatten(n.props?.style);
      return s?.position === "absolute" && s?.top === 72 && s?.zIndex === 9998;
    });
    expect(host.length).toBeGreaterThan(0);
    act(() => {
      jest.runAllTimers();
    });
    jest.useRealTimers();
  });
});

describe("interactive WallStatStrip KPI shortcuts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetWallStats();
  });

  it("navigates to /calendar, /tasks, and /meals when each KPI tile is pressed", () => {
    publishWallStats({ eventsToday: 2, openTasks: 5, plannedDays: 4 });
    const { getByTestId } = render(<WallStatStrip />, { wrapper: wrap });

    fireEvent.press(getByTestId("wall-stat-events"));
    expect(mockReplace).toHaveBeenCalledWith("/calendar");

    fireEvent.press(getByTestId("wall-stat-tasks"));
    expect(mockReplace).toHaveBeenCalledWith("/tasks");

    fireEvent.press(getByTestId("wall-stat-week"));
    expect(mockReplace).toHaveBeenCalledWith("/meals");
  });

  it("reserves explicit KPI tile height on row, wrapper, and Pressable so Android Yoga does not collapse", () => {
    publishWallStats({ eventsToday: 2, openTasks: 5, plannedDays: 4 });
    const { getByTestId, getByLabelText } = render(<WallStatStrip />, { wrapper: wrap });

    const rowStyle = StyleSheet.flatten(getByTestId("wall-stat-row").props.style);
    expect(rowStyle.height).toBe(75);

    const tileStyle = StyleSheet.flatten(getByTestId("wall-stat-events").props.style);
    expect(tileStyle.height).toBe(75);
    expect(tileStyle.flex).toBeUndefined();

    const pressable = getByLabelText("Events — Today: 2");
    const pressableStyle = StyleSheet.flatten(pressable.props.style);
    expect(pressableStyle.height).toBe(75);
    expect(pressableStyle.flex).toBeUndefined();
  });
});
