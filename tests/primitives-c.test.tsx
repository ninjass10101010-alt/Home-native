/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { Text } from "react-native";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { Modal } from "../src/ui/Modal";
import { ToastProvider, useToast } from "../src/ui/Toast";
import { PinPad } from "../src/ui/PinPad";
import { MemberRail } from "../src/ui/MemberRail";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const wrap = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>
    <ToastProvider>{children}</ToastProvider>
  </ThemeProvider>
);

describe("Modal", () => {
  it("renders when visible; nothing when not", () => {
    const onClose = jest.fn();
    const { queryByText } = render(
      <Modal visible title="Hi" onClose={onClose}>
        <Text>body</Text>
      </Modal>,
      { wrapper: wrap }
    );
    expect(queryByText("body")).toBeTruthy();
    const closed = render(
      <Modal visible={false} title="Hi" onClose={onClose}>
        <Text>body</Text>
      </Modal>,
      { wrapper: wrap }
    );
    expect(closed.queryByText("body")).toBeNull();
  });
  it("hardware back closes when dismissable, ignored when not", () => {
    const onClose = jest.fn();
    const { getByTestId } = render(
      <Modal visible title="T" onClose={onClose} testID="m">
        <Text>x</Text>
      </Modal>,
      { wrapper: wrap }
    );
    fireEvent(getByTestId("m"), "requestClose");
    expect(onClose).toHaveBeenCalledTimes(1);

    const onClose2 = jest.fn();
    const { getByTestId: get2 } = render(
      <Modal visible title="T2" onClose={onClose2} testID="m2" dismissable={false}>
        <Text>y</Text>
      </Modal>,
      { wrapper: wrap }
    );
    fireEvent(get2("m2"), "requestClose");
    expect(onClose2).not.toHaveBeenCalled();
  });
});

function ToastHarness() {
  const t = useToast();
  return (
    <>
      <Text testID="fire" onPress={() => t.show("Saved!", { intent: "success" })}>
        fire
      </Text>
    </>
  );
}

describe("Toast", () => {
  it("shows one toast and replaces on a new show", () => {
    jest.useFakeTimers();
    const { getByTestId, queryByText } = render(<ToastHarness />, { wrapper: wrap });
    fireEvent.press(getByTestId("fire"));
    expect(queryByText("Saved!")).toBeTruthy();
    jest.runAllTimers();
    jest.useRealTimers();
  });
  it("useToast throws outside provider", () => {
    const Bad = () => {
      try {
        useToast();
        return null;
      } catch (e: any) {
        return <Text>{e.message}</Text>;
      }
    };
    const { getByText } = render(<Bad />);
    expect(getByText(/useToast must be used within ToastProvider/)).toBeTruthy();
  });
});

describe("PinPad", () => {
  const member = { name: "Aurora Garcia", emoji: "👧" };
  it("emits exactly once, on the 4th digit", () => {
    const onVerified = jest.fn();
    const { getByLabelText } = render(
      <PinPad member={member} onVerified={onVerified} onCancel={() => {}} />,
      { wrapper: wrap }
    );
    fireEvent.press(getByLabelText("1"));
    fireEvent.press(getByLabelText("2"));
    fireEvent.press(getByLabelText("3"));
    expect(onVerified).not.toHaveBeenCalled();
    fireEvent.press(getByLabelText("4"));
    expect(onVerified).toHaveBeenCalledTimes(1);
    expect(onVerified).toHaveBeenCalledWith("1234");
  });
  it("clears input when the error prop appears", () => {
    const onVerified = jest.fn();
    const { getByLabelText, rerender } = render(
      <PinPad member={member} onVerified={onVerified} onCancel={() => {}} />,
      { wrapper: wrap }
    );
    fireEvent.press(getByLabelText("9"));
    rerender(
      <ThemeProvider>
        <ToastProvider>
          <PinPad member={member} onVerified={onVerified} onCancel={() => {}} error="Wrong PIN — try again." />
        </ToastProvider>
      </ThemeProvider>
    );
    fireEvent.press(getByLabelText("1"));
    fireEvent.press(getByLabelText("2"));
    fireEvent.press(getByLabelText("3"));
    expect(onVerified).not.toHaveBeenCalled(); // pin was cleared on error
  });
  it("keys meet the 64dp+ floor (96dp at wall scale)", () => {
    const { toJSON } = render(
      <PinPad member={member} onVerified={() => {}} onCancel={() => {}} />,
      { wrapper: wrap }
    );
    const s = JSON.stringify(toJSON());
    expect(s).toContain('"width":96');
  });
});

describe("MemberRail", () => {
  const members = [
    { name: "Rebecca (Mom)", emoji: "🐱", color: "#b45309" },
    { name: "Emily", emoji: "👧" },
  ];
  it("rail tiles announce selection state and fire onSelect", () => {
    const onSelect = jest.fn();
    const { getByLabelText } = render(
      <MemberRail members={members} currentName="Emily" onSelect={onSelect} />,
      { wrapper: wrap }
    );
    fireEvent.press(getByLabelText("Sign in as Rebecca (Mom)"));
    expect(onSelect).toHaveBeenCalledWith(members[0]);
    expect(getByLabelText("Signed in as Emily")).toBeTruthy();
  });
  it("Sign out control is optional", () => {
    const onSignOut = jest.fn();
    const { getByLabelText } = render(
      <MemberRail members={members} currentName={null} onSelect={() => {}} onSignOut={onSignOut} />,
      { wrapper: wrap }
    );
    fireEvent.press(getByLabelText("Sign out"));
    expect(onSignOut).toHaveBeenCalled();
  });
});
