/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { ThemeProvider } from "../src/theme/ThemeProvider";
import { ChatPage } from "../src/chat/ChatPage";
import { ToastProvider } from "../src/ui/Toast";
import { localTodayISO } from "../src/home/widgets/data";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

const mockAuth = { member: { id: "p1", name: "Rebecca (Mom)", role: "parent", emoji: "🐱", color: "green" } as any, hydrated: true };
const mockPoke = jest.fn();
jest.mock("../src/state/AuthProvider", () => ({
  useAuth: () => ({ ...mockAuth, poke: mockPoke, signOut: jest.fn() }),
}));

jest.mock("../src/api/client", () => ({
  api: jest.fn(),
  ApiError: jest.requireActual("../src/api/client").ApiError,
}));
const { api } = jest.requireMock("../src/api/client") as { api: jest.Mock };
const { ApiError } = jest.requireActual("../src/api/client") as any;

const mockRouterParams: { prompt?: string } = {};
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockRouterParams,
}));

const wrap = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>
    <ToastProvider>{children}</ToastProvider>
  </ThemeProvider>
);

const thread = {
  ok: true,
  messages: [
    { id: "m1", role: "assistant", content: "Good morning — what's on?" },
    { id: "m2", role: "user", content: "Any chores left?" },
  ],
};

const suggestions = { items: [{ id: "s1", title: "Pantry is running low on rice" }] };

const enterPin = (getByLabelText: (t: string) => any, digits = "1111") => {
  for (const d of digits) fireEvent.press(getByLabelText(d));
};

describe("ChatPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.mockReset();
    mockAuth.member = { id: "p1", name: "Rebecca (Mom)", role: "parent", emoji: "🐱", color: "green" };
    mockAuth.hydrated = true;
    delete mockRouterParams.prompt;
    api.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/chat/messages")) return thread;
      if (path === "/api/consuela/suggestions") return suggestions;
      if (path === "/api/hermes/chat") return { content: "Tacos tonight." };
      return { ok: true };
    });
  });

  it("guest sees the sign-in copy with ZERO doomed fetches", async () => {
    mockAuth.member = null;
    const { findByTestId, findByText } = render(<ChatPage />, { wrapper: wrap });
    expect(await findByTestId("chat-guest")).toBeTruthy();
    expect(await findByText("Sign in with your PIN to see the family's chat.")).toBeTruthy();
    expect(api).not.toHaveBeenCalled();
  });

  it("loads today's thread (honest threadId) and the suggestions strip", async () => {
    const { findByTestId, findByText } = render(<ChatPage />, { wrapper: wrap });
    expect(await findByTestId("chat-ready")).toBeTruthy();
    expect(await findByText("Good morning — what's on?")).toBeTruthy();
    expect(api).toHaveBeenCalledWith(`/api/chat/messages?threadId=${localTodayISO()}`);
    expect(await findByTestId("chat-suggestion-s1")).toBeTruthy();
    expect(await findByText("Pantry is running low on rice")).toBeTruthy();
    expect(await findByText("Act")).toBeTruthy();
    expect(await findByText("Dismiss")).toBeTruthy();
  });

  it("an unreachable server renders the honest copy + Try again refetches", async () => {
    let failNext = true;
    api.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/chat/messages")) {
        if (failNext) {
          failNext = false;
          throw new ApiError({ message: "down", status: 0, code: "unreachable" });
        }
        return thread;
      }
      if (path === "/api/consuela/suggestions") return suggestions;
      return { ok: true };
    });
    const { findByTestId, getByTestId, findByText } = render(<ChatPage />, { wrapper: wrap });
    expect(await findByText("Couldn't reach Consuela — check the connection and try again.")).toBeTruthy();
    expect(await findByTestId("chat-retry")).toBeTruthy();
    const threadCalls = () => api.mock.calls.filter((c: any[]) => String(c[0]).startsWith("/api/chat/messages")).length;
    expect(threadCalls()).toBe(1);
    fireEvent.press(getByTestId("chat-retry"));
    expect(await findByTestId("chat-ready")).toBeTruthy();
    expect(await findByText("Good morning — what's on?")).toBeTruthy();
    expect(threadCalls()).toBe(2);
  });

  it("sends a prompt with history + stream:false and renders the reply", async () => {
    const { findByTestId, getByTestId, getByText, findByText, getByPlaceholderText } = render(<ChatPage />, { wrapper: wrap });
    await findByTestId("chat-ready");
    const input = getByPlaceholderText("Ask Consuela…");
    fireEvent.changeText(input, "what's for dinner?");
    fireEvent.press(getByTestId("chat-send"));
    expect(await findByText("Tacos tonight.")).toBeTruthy();
    const call = api.mock.calls.find((c: any[]) => c[0] === "/api/hermes/chat");
    expect(call).toBeTruthy();
    expect(call![1].method).toBe("POST");
    expect(call![1].body).toEqual({
      message: "what's for dinner?",
      history: [
        { role: "assistant", content: "Good morning — what's on?" },
        { role: "user", content: "Any chores left?" },
      ],
      stream: false,
    });
    // input cleared, poke() counts the send as activity
    expect((getByPlaceholderText("Ask Consuela…") as any).props.value).toBe("");
    expect(mockPoke).toHaveBeenCalled();
  });

  it("a failed send lands as an honest assistant bubble — never a silent drop", async () => {
    api.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/chat/messages")) return { ok: true, messages: [] };
      if (path === "/api/consuela/suggestions") return suggestions;
      if (path === "/api/hermes/chat") throw new ApiError({ message: "down", status: 0, code: "unreachable" });
      return { ok: true };
    });
    const { findByTestId, getByTestId, getByText, findByText, getByPlaceholderText } = render(<ChatPage />, { wrapper: wrap });
    await findByTestId("chat-ready");
    fireEvent.changeText(getByPlaceholderText("Ask Consuela…"), "hello?");
    fireEvent.press(getByTestId("chat-send"));
    expect(await findByText("Hey, I hit a snag connecting to my brain right now. Give me a moment and try again! 🔧")).toBeTruthy();
    // sending flag released — Send is back to its idle label (not "…")
    expect(getByText("Send")).toBeTruthy();
  });

  it("a proposal opens the confirm modal; a verified PIN applies it with the PIN header", async () => {
    const proposal = { tool: "add_task", args: { title: "Mop" }, operationId: "op-1" };
    api.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/chat/messages")) return { ok: true, messages: [] };
      if (path === "/api/consuela/suggestions") return { items: [] };
      if (path === "/api/hermes/chat") return { content: "On it.", proposals: [proposal] };
      if (path === "/api/consuela/planner/apply") return { ok: true };
      return { ok: true };
    });
    const { findByTestId, findByText, getByTestId, getByLabelText, getByPlaceholderText } = render(<ChatPage />, { wrapper: wrap });
    await findByTestId("chat-ready");
    fireEvent.changeText(getByPlaceholderText("Ask Consuela…"), "add a mop chore");
    fireEvent.press(getByTestId("chat-send"));
    expect(await findByText("Confirm proposal")).toBeTruthy();
    expect(await findByText("add_task")).toBeTruthy();
    await enterPin(getByLabelText);
    expect(await findByText("Done — applied.")).toBeTruthy();
    const call = api.mock.calls.find((c: any[]) => c[0] === "/api/consuela/planner/apply");
    expect(call![1].headers["x-consuela-pin"]).toBe("1111");
    expect(call![1].body).toEqual({ tool: "add_task", args: { title: "Mop" }, operationId: "op-1" });
  });

  it("a refused PIN keeps the pad open with the honest wrong-PIN copy", async () => {
    const proposal = { tool: "add_task", args: {}, operationId: "op-1" };
    api.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/chat/messages")) return { ok: true, messages: [] };
      if (path === "/api/consuela/suggestions") return { items: [] };
      if (path === "/api/hermes/chat") return { content: "On it.", proposals: [proposal] };
      if (path === "/api/consuela/planner/apply") throw new ApiError({ message: "nope", status: 401, code: "unauthorized" });
      return { ok: true };
    });
    const { findByTestId, findByText, getByTestId, getByLabelText, getByPlaceholderText } = render(<ChatPage />, { wrapper: wrap });
    await findByTestId("chat-ready");
    fireEvent.changeText(getByPlaceholderText("Ask Consuela…"), "add a chore");
    fireEvent.press(getByTestId("chat-send"));
    await findByText("Confirm proposal");
    await enterPin(getByLabelText);
    expect(await findByText("Wrong PIN — try again.")).toBeTruthy();
    // modal never closes on a refusal
    expect(await findByTestId("chat-pinpad")).toBeTruthy();
  });

  it("Dismissing a suggestion PATCHes with the PIN header and removes the row", async () => {
    const { findByTestId, getByTestId, getByText, findByText, getByLabelText, queryByTestId } = render(<ChatPage />, { wrapper: wrap });
    await findByTestId("chat-suggestion-s1");
    fireEvent.press(getByTestId("chat-suggestion-dismiss-s1"));
    expect(await findByText("Dismiss suggestion")).toBeTruthy();
    await enterPin(getByLabelText);
    // Yield once: the PATCH promise settles on a microtask and the row's
    // removal commits through React's scheduler on a macrotask — asserting in
    // the SAME task as the 4th keypress races that commit (flaky under a
    // loaded full-suite run).
    await new Promise((r) => setTimeout(r, 250));
    const call = api.mock.calls.find((c: any[]) => c[0] === "/api/consuela/suggestions" && c[1]?.method === "PATCH");
    expect(call![1].method).toBe("PATCH");
    expect(call![1].headers["x-consuela-pin"]).toBe("1111");
    expect(call![1].body).toEqual({ id: "s1", status: "dismissed" });
    await waitFor(() => expect(queryByTestId("chat-suggestion-s1")).toBeNull(), { timeout: 5000, interval: 50 });
  }, 20000);

  it("?prompt= auto-sends exactly once when the thread is ready", async () => {
    mockRouterParams.prompt = "is the laundry done?";
    const { findByTestId } = render(<ChatPage />, { wrapper: wrap });
    await findByTestId("chat-ready");
    const sends = await waitForSends(1);
    expect(sends[0][1].body.message).toBe("is the laundry done?");
    expect(sends).toHaveLength(1);
  });
});

async function waitForSends(min: number): Promise<any[]> {
  for (let i = 0; i < 40; i++) {
    const calls = (jest.requireMock("../src/api/client") as { api: jest.Mock }).api.mock.calls.filter(
      (c: any[]) => c[0] === "/api/hermes/chat",
    );
    if (calls.length >= min) return calls;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error(`expected ${min} hermes/chat send(s)`);
}
