/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { ThemeProvider } from "../src/theme/ThemeProvider";
import { EventComposer } from "../src/calendar/EventComposer";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const wrap = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

const base = {
  visible: true,
  defaultDate: "2026-10-21",
  members: ["Rebecca (Mom)", "Aurora"],
  onClose: jest.fn(),
  onSave: jest.fn(),
  saving: false,
  error: null,
};

it("keeps Add event disabled until the title is valid", () => {
  render(<EventComposer {...base} />, { wrapper: wrap });
  const save = screen.getByTestId("composer-save");
  expect(save.props.accessibilityState.disabled).toBe(true);
  fireEvent.changeText(screen.getByLabelText("Event title"), "Dentist");
  expect(screen.getByTestId("composer-save").props.accessibilityState.disabled).toBe(false);
});

it("sends the selected date and a default one-hour timed slot", () => {
  const onSave = jest.fn();
  render(<EventComposer {...base} onSave={onSave} />, { wrapper: wrap });
  fireEvent.changeText(screen.getByLabelText("Event title"), "Dentist");
  fireEvent.press(screen.getByLabelText("Choose 2026-10-22"));
  fireEvent.press(screen.getByTestId("composer-save"));
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
    title: "Dentist",
    date: "2026-10-22",
    startTime: "09:00",
    endTime: "10:00",
    allDay: false,
    member: "All",
  }));
});

it("moves the start time with the hour stepper and keeps end after start", () => {
  const onSave = jest.fn();
  render(<EventComposer {...base} onSave={onSave} />, { wrapper: wrap });
  fireEvent.changeText(screen.getByLabelText("Event title"), "Late dentist");
  fireEvent.press(screen.getByLabelText("Increase Start hour"));
  fireEvent.press(screen.getByLabelText("Increase Start minutes"));
  fireEvent.press(screen.getByTestId("composer-save"));
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
    startTime: "10:05",
    endTime: "11:00",
  }));
});

it("clears clock values for all-day", () => {
  const onSave = jest.fn();
  render(<EventComposer {...base} onSave={onSave} />, { wrapper: wrap });
  fireEvent.changeText(screen.getByLabelText("Event title"), "Holiday");
  fireEvent.press(screen.getByLabelText("All day"));
  fireEvent.press(screen.getByTestId("composer-save"));
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
    allDay: true,
    startTime: "",
    endTime: "",
  }));
});

it("shows the parent error and stays open while saving fails", () => {
  render(<EventComposer {...base} error="Event wasn't saved — check the connection." />, { wrapper: wrap });
  expect(screen.getByText("Event wasn't saved — check the connection.")).toBeTruthy();
  expect(screen.getByTestId("composer-save").props.accessibilityState.disabled).toBe(true);
});
