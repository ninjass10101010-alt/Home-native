/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { Text } from "react-native";
import { render } from "@testing-library/react-native";

import { ThemeProvider } from "../src/theme/ThemeProvider";
import { WidgetFrame } from "../src/home/widgets/WidgetFrame";
import { READ_COPY, READ_COPY_STALE } from "../src/home/widgets/data";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

const wrap = ({ children }: { children: React.ReactNode }) => <ThemeProvider>{children}</ThemeProvider>;

const base = {
  id: "wf",
  icon: "✅",
  title: "Tasks",
  description: "2 pending for the family",
};

function Frame(props: Partial<React.ComponentProps<typeof WidgetFrame>>) {
  return (
    <WidgetFrame
      {...base}
      status="ready"
      failure={null}
      hasData
      stale={false}
      onRetry={() => {}}
      {...props}
    >
      {props.children ?? <Text testID="wf-body">body</Text>}
    </WidgetFrame>
  );
}

describe("WidgetFrame default header (U13.7) — left-aligned band + protruding top-left disc", () => {
  it("renders the identity disc overlapping the band's top edge (web WidgetCard/SectionCard parity)", () => {
    const { getByTestId, getByText, getByRole } = render(<Frame />, { wrapper: wrap });
    // The disc is decorative (aria-hidden on web): the title carries identity,
    // so the glyph is excluded from the a11y tree — query with hidden elements.
    const disc = getByTestId("wf-icon-disc", { includeHiddenElements: true });
    // ~56dp disc seated in the Material's 18dp padding: negative offsets pull it
    // toward the card corner while staying inside the clipped Material bounds.
    expect(disc.props.style).toMatchObject({
      position: "absolute",
      top: -8,
      left: -6,
      width: 56,
      height: 56,
      borderRadius: 28,
    });
    expect(getByText("✅", { includeHiddenElements: true })).toBeTruthy(); // the glyph lives on the disc…
    const title = getByRole("header");
    expect(title.props.children).toBe("Tasks"); // …and the title is LEFT of it
    expect(getByText("2 pending for the family")).toBeTruthy();
  });

  it("honors the type floors: title 20sp bold, description 14sp", () => {
    const { getByRole, getByText } = render(<Frame />, { wrapper: wrap });
    expect(getByRole("header").props.style).toMatchObject({ fontSize: 20, fontWeight: "700" });
    expect(getByText(base.description).props.style).toMatchObject({ fontSize: 14 });
  });

  it("the header override prop still wins over the default band", () => {
    const { getByText, queryByTestId } = render(<Frame header={<Text>Custom band</Text>} />, { wrapper: wrap });
    expect(getByText("Custom band")).toBeTruthy();
    expect(queryByTestId("wf-icon-disc")).toBeNull(); // the override owns identity
  });
});

describe("WidgetFrame state machine (U13.8/U13.10) — never a blank cell, never a header-less failure", () => {
  it("error state KEEPS the title band: which widget failed stays visible with the honest copy + retry", () => {
    const { getByTestId, getByRole, getByText } = render(
      <Frame status="error" failure="error" hasData={false} />,
      { wrapper: wrap }
    );
    expect(getByTestId("wf-error")).toBeTruthy();
    expect(getByRole("header").props.children).toBe("Tasks"); // the band survived
    expect(getByText(base.description)).toBeTruthy();
    expect(getByText(new RegExp(READ_COPY.error.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))).toBeTruthy();
    expect(getByText("Try again")).toBeTruthy();
  });

  it("failure with nothing on screen always shows the failure card — even when status still says loading", () => {
    const { getByTestId, queryByTestId } = render(
      <Frame status="loading" failure="offline" hasData={false} />,
      { wrapper: wrap }
    );
    expect(getByTestId("wf-error")).toBeTruthy(); // the failure wins over the skeleton
    expect(queryByTestId("wf-loading")).toBeNull();
  });

  it("status error with no failure object still never renders a blank cell", () => {
    const { getByTestId, getByText } = render(
      <Frame status="error" failure={null} hasData={false} />,
      { wrapper: wrap }
    );
    expect(getByTestId("wf-error")).toBeTruthy();
    expect(getByText(new RegExp(READ_COPY.error.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))).toBeTruthy();
  });

  it("loading stays the skeleton when there is no failure", () => {
    const { getByTestId } = render(<Frame status="loading" failure={null} hasData={false} />, { wrapper: wrap });
    expect(getByTestId("wf-loading")).toBeTruthy();
  });

  it("failure with last-good data: children stay AND the stale badge shows even if the caller forgot", () => {
    const { getByTestId } = render(<Frame status="ready" failure="error" hasData stale={false} />, { wrapper: wrap });
    expect(getByTestId("wf-body")).toBeTruthy(); // last-good content kept
    expect(getByTestId("wf-stale")).toBeTruthy(); // …badged — the frame is airtight
    expect(getByTestId("wf-stale").props.children).toBe(READ_COPY_STALE);
  });
});
