/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { CapsuleDock, MoreButton } from "../src/nav/CapsuleDock";
import { MoreSheet } from "../src/nav/MoreSheet";
import { mix } from "../src/theme/mix";
import { ACCENTS } from "../src/theme/tokens";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const wrap = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

describe("CapsuleDock", () => {
  it("renders NOTHING before hydration (no parent-cap flash for kids)", () => {
    const { toJSON } = render(
      <CapsuleDock role="parent" hydrated={false} pathname="/" onNavigate={() => {}} />,
      { wrapper: wrap }
    );
    expect(toJSON()).toBeNull();
  });

  it("renders EXACTLY the 7 manifest caps (no More cap — the web dock has none)", () => {
    const { getByLabelText, queryByLabelText, getAllByRole } = render(
      <CapsuleDock role="parent" hydrated pathname="/tasks" onNavigate={() => {}} />,
      { wrapper: wrap }
    );
    for (const label of ["Home", "Ask", "Meals", "Tasks", "Calendar", "House", "Settings"]) {
      expect(getByLabelText(label)).toBeTruthy();
    }
    expect(queryByLabelText("More")).toBeNull(); // More lives on Home (web parity)
    expect(getAllByRole("button")).toHaveLength(7);
  });

  it("kid dock swaps House→Rewards", () => {
    const { getByLabelText, queryByLabelText, getAllByRole } = render(
      <CapsuleDock role="child" hydrated pathname="/" onNavigate={() => {}} />,
      { wrapper: wrap }
    );
    expect(getByLabelText("Rewards")).toBeTruthy();
    expect(queryByLabelText("House")).toBeNull();
    expect(getAllByRole("button")).toHaveLength(7);
  });

  it("guest dock caps still navigate", () => {
    const onNavigate = jest.fn();
    const { getByLabelText } = render(
      <CapsuleDock role="guest" hydrated pathname="/" onNavigate={onNavigate} />,
      { wrapper: wrap }
    );
    fireEvent.press(getByLabelText("Meals"));
    expect(onNavigate).toHaveBeenCalledWith("/meals");
  });

  it("a Wave-2 cap resolves to the honest /soon placeholder (never a dead end)", () => {
    const onNavigate = jest.fn();
    const { getByLabelText } = render(
      <CapsuleDock role="parent" hydrated pathname="/" onNavigate={onNavigate} />,
      { wrapper: wrap }
    );
    fireEvent.press(getByLabelText("Ask"));
    expect(onNavigate).toHaveBeenCalledWith("/chat");
    fireEvent.press(getByLabelText("House"));
    expect(onNavigate).toHaveBeenCalledWith("/ha");
  });

  it("/meals/archive lights NO cap (own-destination route)", () => {
    const { getAllByRole } = render(
      <CapsuleDock role="parent" hydrated pathname="/meals/archive" onNavigate={() => {}} />,
      { wrapper: wrap }
    );
    const selected = getAllByRole("button").filter((b: any) => b.props.accessibilityState?.selected);
    expect(selected).toHaveLength(0);
  });

  it("task 0.3: the ACTIVE cap's disc has a transparent ring (web CapsuleNav parity)", () => {
    const { getByTestId } = render(
      <CapsuleDock role="parent" hydrated pathname="/" onNavigate={() => {}} />,
      { wrapper: wrap }
    );
    // dock-home is the active cap; its child disc is the wall cap's 72dp
    // circle (Home-ai CapsuleNav: h-[72px] w-[72px] at the wall viewport).
    const disc = getByTestId("dock-home").findAll((n: any) => n.props.style?.width === 72)[0];
    expect(disc).toBeTruthy();
    expect(disc.props.style.borderColor).toBe("transparent");
  });
});

describe("MoreSheet", () => {
  it("task 0.3: modal carries the house description + accent icon tiles", () => {
    const { getByText, UNSAFE_root } = render(
      <MoreSheet visible onClose={() => {}} role="parent" onNavigate={() => {}} />,
      { wrapper: wrap }
    );
    expect(getByText("Everything else around the house")).toBeTruthy();
    const tile = UNSAFE_root.findAll(
      (n: any) => n.props.style?.width === 48 && n.props.style?.height === 48 && n.props.style?.borderRadius === 16
    )[0];
    expect(tile).toBeTruthy();
    expect(tile.props.style.backgroundColor).toBe(mix(ACCENTS.light.nori, "transparent", 15));
  });
});

describe("MoreButton (web page.tsx MoreButton parity)", () => {
  it("opens the More sheet — the wall's route to secondary destinations", () => {
    const onPress = jest.fn();
    const { getByLabelText, getByText } = render(
      <MoreButton onPress={onPress} />,
      { wrapper: wrap }
    );
    fireEvent.press(getByLabelText("More"));
    expect(onPress).toHaveBeenCalled();
    expect(getByText("More…")).toBeTruthy();
  });

  it("keeps the 64dp floor (SoftButton contract — md = 72dp on the wall)", () => {
    const { getByRole } = render(<MoreButton onPress={() => {}} />, { wrapper: wrap });
    // the floor is enforced inside SoftButton (styles.base + size map, pinned
    // in primitives-a); assert the wall variant rides that same md size
    const flat = JSON.stringify([].concat(getByRole("button").props.style ?? []));
    const m = flat.match(/"minHeight":(\d+)/);
    expect(m).toBeTruthy();
    expect(Number(m![1])).toBeGreaterThanOrEqual(64);
  });

  it("task 0.3: the hidden emoji glyph is absolute (no phantom Yoga flex gap)", () => {
    const { UNSAFE_root } = render(<MoreButton onPress={() => {}} />, { wrapper: wrap });
    const hidden = UNSAFE_root.findAll(
      (n: any) => n.type === "Text" && n.props.style?.opacity === 0 && n.props.style?.width === 0
    )[0];
    expect(hidden).toBeTruthy();
    expect(hidden.props.style.position).toBe("absolute");
  });
});
