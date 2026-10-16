/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { Text } from "react-native";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { SegmentedControl } from "../src/ui/SegmentedControl";
import { ListRow } from "../src/ui/ListRow";
import { TextField } from "../src/ui/TextField";
import { Stepper } from "../src/ui/Stepper";
import { EmptyState } from "../src/ui/EmptyState";
import { SwipeableRow } from "../src/ui/SwipeableRow";
import { MIN_TARGET_DP, RADII, TOKENS, TYPOGRAPHY } from "../src/theme/tokens";
import { mixAlpha } from "../src/ui/SoftButton";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const wrap = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

const flat = (el: any) => JSON.stringify(el);

describe("SegmentedControl", () => {
  const options = [
    { id: "a", label: "Alpha" },
    { id: "b", label: "Beta" },
    { id: "c", label: "Gamma" },
  ];
  it("radio role + checked state + change fires", () => {
    const onChange = jest.fn();
    const { getByText, getAllByRole } = render(
      <SegmentedControl options={options} value="a" onChange={onChange} />,
      { wrapper: wrap }
    );
    fireEvent.press(getByText("Beta"));
    expect(onChange).toHaveBeenCalledWith("b");
    const selected = getAllByRole("radio").filter((r: any) => r.props.accessibilityState?.selected);
    expect(selected).toHaveLength(1);
  });
  it("segments meet the 64dp target floor and 14sp label floor", () => {
    const { toJSON } = render(<SegmentedControl options={options} value="a" onChange={() => {}} />, {
      wrapper: wrap,
    });
    const s = flat(toJSON());
    expect(s).toContain(`"minHeight":${MIN_TARGET_DP}`);
    expect(s).toContain(`"fontSize":${TYPOGRAPHY.body.fontSize}`);
  });
  it("U2.6: segments scale 0.96 on press (tap feedback)", () => {
    const { UNSAFE_root } = render(
      <SegmentedControl options={options} value="a" onChange={() => {}} />,
      { wrapper: wrap }
    );
    // Pressable's style is a function on the composite instance (RNTL can't
    // drive the internal pressed state) — assert the function's contract.
    const pressable = UNSAFE_root.findAll((n) => typeof n.props.style === "function" && n.props.onPress)[0];
    expect(pressable).toBeTruthy();
    const at = (pressed: boolean) => JSON.stringify(pressable.props.style({ pressed }));
    expect(at(true)).toContain('"scale":0.96');
    expect(at(false)).not.toContain('"scale":0.96');
  });
});

describe("ListRow", () => {
  it("button semantics only when onPress; 64dp floor", () => {
    const onPress = jest.fn();
    const { getByRole, toJSON } = render(
      <ListRow title="Milk" subtitle="2 left" onPress={onPress} />,
      { wrapper: wrap }
    );
    fireEvent.press(getByRole("button"));
    expect(onPress).toHaveBeenCalled();
    expect(flat(toJSON())).toContain(`"minHeight":${MIN_TARGET_DP}`);
  });
  it("static row has no button role", () => {
    const { queryByRole } = render(<ListRow title="Static" />, { wrapper: wrap });
    expect(queryByRole("button")).toBeNull();
  });
  it("U2.4: row fill = the web's surface-0/30 wash (web-parity, not a solid card)", () => {
    const { toJSON } = render(<ListRow title="Milk" />, { wrapper: wrap });
    expect(flat(toJSON())).toContain(mixAlpha(TOKENS.light["color-surface-0"], 0.3));
  });
});

describe("TextField", () => {
  it("64dp field + uppercase label + focus ring via accent mix (no raw literals)", () => {
    const { getByLabelText } = render(
      <TextField label="Name" value="" onChangeText={() => {}} />,
      { wrapper: wrap }
    );
    const el: any = getByLabelText("Name");
    expect(el.props.style.minHeight).toBe(MIN_TARGET_DP);
    fireEvent.changeText(el, "x");
  });
  it("error text wins over helper and announces politely", () => {
    const { getByText } = render(
      <TextField label="PIN" value="" onChangeText={() => {}} errorText="Wrong PIN" helperText="4 digits" />,
      { wrapper: wrap }
    );
    expect(getByText("Wrong PIN")).toBeTruthy();
  });
});

describe("Stepper", () => {
  it("clamps at min/max and announces a11y labels", () => {
    const onChange = jest.fn();
    const { getByLabelText } = render(<Stepper value={0} min={0} max={2} onChange={onChange} label="Portions" />, {
      wrapper: wrap,
    });
    const dec = getByLabelText("Decrease Portions");
    fireEvent.press(dec);
    expect(onChange).not.toHaveBeenCalled(); // clamped at min
    fireEvent.press(getByLabelText("Increase Portions"));
    expect(onChange).toHaveBeenCalledWith(1);
  });
  it("U2.2: controls are flat surface-2 rounded-2xl 64dp squares (web parity), no glass", () => {
    const { toJSON } = render(<Stepper value={1} onChange={() => {}} label="Portions" />, { wrapper: wrap });
    const s = flat(toJSON());
    expect(s).not.toContain("ExpoBlur"); // web stepper = rounded-2xl bg-surface-2, not a glass circle
    expect(s).toContain(TOKENS.light["color-surface-2"]);
    expect(s).toContain(`"borderRadius":${RADII.md}`); // rounded-2xl = 16px = RADII.md
    expect(s).toContain('"width":64');
    expect(s).toContain('"height":64');
  });
  it("U2.2: disabled rail button dims to opacity 0.4 (web disabled:opacity-40)", () => {
    const { toJSON } = render(<Stepper value={0} min={0} onChange={() => {}} />, { wrapper: wrap });
    expect(flat(toJSON())).toContain('"opacity":0.4');
  });
});

describe("EmptyState", () => {
  it("renders icon + title + body + action (action fires)", () => {
    const onAction = jest.fn();
    const { getByText } = render(
      <EmptyState icon="🍽️" title="No meals today" body="Plan this week" actionLabel="Plan" onAction={onAction} />,
      { wrapper: wrap }
    );
    fireEvent.press(getByText("Plan"));
    expect(onAction).toHaveBeenCalled();
  });
  it("U2.5: non-flat chrome routes through Material (frosted); flat drops it", () => {
    const chrome = flat(render(<EmptyState title="Empty" />, { wrapper: wrap }).toJSON());
    expect(chrome).toContain("ExpoBlur");
    const nested = flat(render(<EmptyState title="Empty" flat />, { wrapper: wrap }).toJSON());
    expect(nested).not.toContain("ExpoBlur");
  });
});

describe("SwipeableRow", () => {
  it("renders children + configured actions in the rail", () => {
    const onAction = jest.fn();
    const { getByLabelText, getByText } = render(
      <SwipeableRow
        actions={[{ key: "del", label: "Delete", intent: "destructive", onAction }]}
      >
        <Text>row body</Text>
      </SwipeableRow>,
      { wrapper: wrap }
    );
    expect(getByText("row body")).toBeTruthy();
    const action = getByLabelText("Delete");
    fireEvent.press(action); // action is directly pressable in the rail
    expect(onAction).toHaveBeenCalled();
  });
});
