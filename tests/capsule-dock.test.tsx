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

  it("renders 7 caps + More, active cap labelled, others icon-only", () => {
    const { getByLabelText, getByText, queryByText } = render(
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
    // Only the ACTIVE cap shows its label
    expect(getByText("Tasks")).toBeTruthy();
    expect(queryByText("Meals")).toBeNull();
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
    const { queryByText } = render(
      <CapsuleDock role="parent" hydrated pathname="/meals/archive" onNavigate={() => {}} onOpenMore={() => {}} />,
      { wrapper: wrap }
    );
    // no active cap → zero visible labels
    expect(queryByText("Meals")).toBeNull();
    expect(queryByText("Home")).toBeNull();
  });
});
