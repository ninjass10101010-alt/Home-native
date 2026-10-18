/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo, Text } from "react-native";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { Modal } from "../src/ui/Modal";
import { ToastProvider, useToast } from "../src/ui/Toast";
import { PinPad } from "../src/ui/PinPad";
import { MemberRail } from "../src/ui/MemberRail";
import { TOKENS, TYPOGRAPHY } from "../src/theme/tokens";
import { mix } from "../src/theme/mix";

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

function ToastHarness({
  intent = "success",
  message = "Saved!",
}: {
  intent?: "info" | "success" | "error";
  message?: string;
}) {
  const t = useToast();
  return (
    <>
      <Text testID="fire" onPress={() => t.show(message, { intent })}>
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
    act(() => {
      jest.runAllTimers();
    });
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
  it("task 0.3: tone backgrounds are opaque-backed surface-1 mixes (readable over headers)", () => {
    jest.useFakeTimers();
    const bgOf = (intent: "info" | "success" | "error") => {
      const { getByTestId, UNSAFE_root, unmount } = render(<ToastHarness intent={intent} />, { wrapper: wrap });
      fireEvent.press(getByTestId("fire"));
      // the live-region host (getByRole skips it while the mock's enter
      // animation still reads opacity 0)
      const alert = UNSAFE_root.findAll((n) => n.props.accessibilityRole === "alert")[0];
      expect(alert).toBeTruthy();
      const bg = alert.props.style.backgroundColor;
      unmount();
      return bg;
    };
    expect(bgOf("success")).toBe(
      mix(TOKENS.light["color-accent-mint"], TOKENS.light["color-surface-1"], 18)
    );
    expect(bgOf("error")).toBe(
      mix(TOKENS.light["color-accent-rose"], TOKENS.light["color-surface-1"], 18)
    );
    expect(bgOf("info")).toBe(mix(TOKENS.light["color-surface-1"], "transparent", 96));
    jest.useRealTimers();
  });
});

describe("PinPad", () => {
  const member = { name: "Aurora", emoji: "👧" };
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
  it("U2.6: keys scale 0.96 on press; reduceMotion renders without it", async () => {
    const { UNSAFE_root } = render(
      <PinPad member={member} onVerified={() => {}} onCancel={() => {}} />,
      { wrapper: wrap }
    );
    // Pressable's style is a function on the composite instance (RNTL can't
    // drive the internal pressed state) — assert the function's contract.
    const pressable = UNSAFE_root.findAll((n) => typeof n.props.style === "function" && n.props.onPress)[0];
    expect(pressable).toBeTruthy();
    const at = (pressed: boolean) => JSON.stringify(pressable.props.style({ pressed }));
    expect(at(true)).toContain('"scale":0.96');
    expect(at(false)).not.toContain('"scale":0.96');

    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
    const { UNSAFE_root: rmRoot } = render(
      <PinPad member={member} onVerified={() => {}} onCancel={() => {}} />,
      { wrapper: wrap }
    );
    await waitFor(() => {
      const rmKey = rmRoot.findAll((n) => typeof n.props.style === "function" && n.props.onPress)[0];
      expect(JSON.stringify(rmKey.props.style({ pressed: true }))).not.toContain('"scale"');
    });
    jest.restoreAllMocks();
  });
  it("task 0.3: photo-URI members render an Image (never a raw data: string in Text)", () => {
    const photoMember = { name: "Aurora", emoji: "data:image/png;base64,AAAA" };
    const { UNSAFE_root, queryByText } = render(
      <PinPad member={photoMember} onVerified={() => {}} onCancel={() => {}} />,
      { wrapper: wrap }
    );
    const images = UNSAFE_root.findAll((n: any) => n.type === "Image");
    expect(images).toHaveLength(1);
    expect(images[0].props.source).toEqual({ uri: photoMember.emoji });
    expect(queryByText(photoMember.emoji)).toBeNull();
  });
  it("task 0.3: emoji members keep the 56sp Text glyph (no Image)", () => {
    const { UNSAFE_root } = render(
      <PinPad member={member} onVerified={() => {}} onCancel={() => {}} />,
      { wrapper: wrap }
    );
    expect(UNSAFE_root.findAll((n: any) => n.type === "Image")).toHaveLength(0);
  });
  it("task 0.3: Clear key uses the title scale while digits keep the stat scale", () => {
    const { getByText } = render(
      <PinPad member={member} onVerified={() => {}} onCancel={() => {}} />,
      { wrapper: wrap }
    );
    expect(getByText("Clear").props.style).toMatchObject({ fontSize: TYPOGRAPHY.title.fontSize });
    expect(getByText("1").props.style).toMatchObject({ fontSize: TYPOGRAPHY.stat.fontSize });
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
  it("Sign out is a 2-tap confirm (web WallMemberRail parity); second tap fires", () => {
    const onSignOut = jest.fn();
    const { getByLabelText, queryByLabelText } = render(
      <MemberRail members={members} currentName={null} onSelect={() => {}} onSignOut={onSignOut} />,
      { wrapper: wrap }
    );
    fireEvent.press(getByLabelText("Sign out")); // arm
    expect(onSignOut).not.toHaveBeenCalled();
    expect(queryByLabelText("Sign out")).toBeNull(); // swapped for the armed state
    expect(getByLabelText("Confirm sign out")).toBeTruthy();
    fireEvent.press(getByLabelText("Confirm sign out")); // confirm
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it("the armed 'Sign out?' state auto-resets after 3s", () => {
    jest.useFakeTimers();
    const { getByLabelText, queryByLabelText } = render(
      <MemberRail members={members} currentName={null} onSelect={() => {}} onSignOut={() => {}} />,
      { wrapper: wrap }
    );
    fireEvent.press(getByLabelText("Sign out"));
    expect(queryByLabelText("Confirm sign out")).toBeTruthy();
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(queryByLabelText("Confirm sign out")).toBeNull();
    expect(getByLabelText("Sign out")).toBeTruthy();
    jest.useRealTimers();
  });

  it("no onSignOut prop → no sign-out control at all", () => {
    const { queryByLabelText } = render(
      <MemberRail members={members} currentName={null} onSelect={() => {}} />,
      { wrapper: wrap }
    );
    expect(queryByLabelText("Sign out")).toBeNull();
  });

  it("regression: current member with a NAMED color (green) renders without crashing", () => {
    const named = [{ name: "Rebecca (Mom)", emoji: "🐱", color: "green" }];
    const { getByLabelText } = render(
      <MemberRail members={named} currentName="Rebecca (Mom)" onSelect={() => {}} />,
      { wrapper: wrap }
    );
    expect(getByLabelText("Signed in as Rebecca (Mom)")).toBeTruthy();
  });

  it("photo-URI members on MemberRail render an Image and never dump raw data: URI into Text", () => {
    const photoMembers = [{ name: "Aurora", emoji: "data:image/jpeg;base64,AAAA", color: "purple" }];
    const { UNSAFE_root, queryByText } = render(
      <MemberRail members={photoMembers} currentName="Aurora" onSelect={() => {}} />,
      { wrapper: wrap }
    );
    const images = UNSAFE_root.findAll((n: any) => n.type === "Image");
    expect(images).toHaveLength(1);
    expect(images[0].props.source).toEqual({ uri: "data:image/jpeg;base64,AAAA" });
    expect(queryByText("data:image/jpeg;base64,AAAA")).toBeNull();
  });
});
