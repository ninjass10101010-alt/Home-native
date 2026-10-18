jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
const mockToggle = jest.fn();
jest.mock("../src/music/playback", () => ({
  usePlayback: () => ({
    current: { id: "abc12345678", title: "Song", artist: "Artist", artworkUrl: null },
    playing: false, toggle: mockToggle, next: jest.fn(),
  }),
}));
let mockPath = "/";
jest.mock("expo-router", () => ({ usePathname: () => mockPath, useRouter: () => ({ push: jest.fn() }) }));

import React from "react";
import { render } from "@testing-library/react-native";
import { MiniPlayer } from "../src/music/MiniPlayer";
import { ThemeProvider } from "../src/theme/ThemeProvider";

const wrap = ({ children }: { children: React.ReactNode }) => <ThemeProvider>{children}</ThemeProvider>;

it("renders on a normal route and hides on the player route", () => {
  mockPath = "/";
  const first = render(<MiniPlayer />, { wrapper: wrap });
  expect(first.getByTestId("mini-player")).toBeTruthy();
  first.unmount();
  mockPath = "/music";
  const second = render(<MiniPlayer />, { wrapper: wrap });
  expect(second.queryByTestId("mini-player")).toBeNull();
});
