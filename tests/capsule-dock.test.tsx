/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { CapsuleDock } from "../src/nav/CapsuleDock";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const wrap = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

describe("CapsuleDock", () => {
  it("renders NOTHING before hydration (no parent-cap flash for kids)", () => {
    const { toJSON } = render(
      <CapsuleDock role="parent" hydrated={false} pathname="/" onNavigate={() => {}} onOpenMore={() => {}} />,
      { wrapper: wrap }
    );
    expect(toJSON()).toBeNull();
  });

  it("renders 7 caps + More; wall labels ALWAYS visible; exactly one selected cap", () => {
    const { getByLabelText, getByText, getAllByRole } = render(
      <CapsuleDock role="parent" hydrated pathname="/tasks" onNavigate={() => {}} onOpenMore={() => {}} />,
      { wrapper: wrap }
    );
    expect(getByLabelText("Home")).toBeTruthy();
    expect(getByLabelText("Ask")).toBeTruthy();
    expect(getByLabelText("Meals")).toBeTruthy();
    expect(getByLabelText("Tasks")).toBeTruthy();
    expect(getByLabelText("Calendar")).toBeTruthy();
    expect(getByLabelText("House")).toBeTruthy();
    expect(getByLabelText("Settings")).toBeTruthy();
    expect(getByLabelText("More")).toBeTruthy();
    // wall rule: every cap shows its label…
    expect(getByText("Tasks")).toBeTruthy();
    expect(getByText("Meals")).toBeTruthy();
    // …but exactly one cap is marked selected (the accessibility contract
    // carries state; labels alone must not fake it)
    const selected = getAllByRole("button").filter((b: any) => b.props.accessibilityState?.selected);
    expect(selected).toHaveLength(1);
    expect(selected[0].props.accessibilityLabel).toBe("Tasks");
  });

  it("kid dock swaps House→Rewards", () => {
    const { getByLabelText, queryByLabelText } = render(
      <CapsuleDock role="child" hydrated pathname="/" onNavigate={() => {}} onOpenMore={() => {}} />,
      { wrapper: wrap }
    );
    expect(getByLabelText("Rewards")).toBeTruthy();
    expect(queryByLabelText("House")).toBeNull();
  });

  it("navigation + More callbacks", () => {
    const onNavigate = jest.fn();
    const onOpenMore = jest.fn();
    const { getByLabelText } = render(
      <CapsuleDock role="guest" hydrated pathname="/" onNavigate={onNavigate} onOpenMore={onOpenMore} />,
      { wrapper: wrap }
    );
    fireEvent.press(getByLabelText("Meals"));
    expect(onNavigate).toHaveBeenCalledWith("/meals");
    fireEvent.press(getByLabelText("More"));
    expect(onOpenMore).toHaveBeenCalled();
  });

  it("/meals/archive lights NO cap (own-destination route)", () => {
    const { getAllByRole } = render(
      <CapsuleDock role="parent" hydrated pathname="/meals/archive" onNavigate={() => {}} onOpenMore={() => {}} />,
      { wrapper: wrap }
    );
    const selected = getAllByRole("button").filter((b: any) => b.props.accessibilityState?.selected);
    expect(selected).toHaveLength(0);
  });
});
