import React from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { api } from "../api/client";
import { useTheme } from "../theme/ThemeProvider";
import { TYPOGRAPHY } from "../theme/tokens";
import { mix } from "../theme/mix";
import { useAuth } from "../state/AuthProvider";
import { localTodayISO } from "../home/widgets/data";
import { Modal } from "../ui/Modal";
import { PinPad } from "../ui/PinPad";

const GUEST_COPY = "Sign in with your PIN to see the family's chat.";
const UNREACHABLE_COPY = "Couldn't reach Consuela — check the connection and try again.";
const ERROR_COPY = "Couldn't load this right now.";
// const EMPTY_COPY = "Ask Consuela anything below.";

type ChatMessage = { id: string; role: string; content: string; proposals?: any[] };

export function ChatPage() {
  const { colors, accentColor } = useTheme();
  const { member, hydrated, poke } = useAuth();
  const params = useLocalSearchParams<{ prompt?: string }>();
  const promptParam = Array.isArray(params.prompt) ? params.prompt[0] : params.prompt;

  const today = localTodayISO();
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [errorText, setErrorText] = React.useState<string>(ERROR_COPY);
  const [suggestions, setSuggestions] = React.useState<any[]>([]);
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [pinTarget, setPinTarget] = React.useState<
    | { kind: "proposal"; proposal: any }
    | { kind: "act"; suggestion: any }
    | { kind: "dismiss"; suggestion: any }
    | null
  >(null);
  const [pinError, setPinError] = React.useState<string | null>(null);
  const [pinBusy, setPinBusy] = React.useState(false);

  const promptSentRef = React.useRef(false);
  const aliveRef = React.useRef(true);

  const loadSuggestions = React.useCallback(async () => {
    try {
      const res = (await api<any>("/api/consuela/suggestions")) as any;
      if (!aliveRef.current) return;
      setSuggestions(Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : []);
    } catch {
      // ignore
    }
  }, []);

  const loadThread = React.useCallback(async () => {
    setStatus("loading");
    try {
      const res = (await api<{ ok?: boolean; messages?: ChatMessage[] }>(
        `/api/chat/messages?threadId=${today}`
      )) as any;
      if (!aliveRef.current) return;
      setMessages(Array.isArray(res?.messages) ? res.messages : []);
      setStatus("ready");
    } catch (e: any) {
      if (!aliveRef.current) return;
      const msg = e?.status === 0 ? UNREACHABLE_COPY : e?.status === 401 || e?.status === 403 ? GUEST_COPY : ERROR_COPY;
      setErrorText(msg);
      if (messages.length === 0) setStatus("error");
      else setStatus("ready");
    }
  }, [today]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    if (!member) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadThread();
    void loadSuggestions();
  }, [hydrated, member, loadThread, loadSuggestions]);

  const sendPrompt = React.useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;
      setSending(true);
      const uid = `u-${Date.now()}`;
      setMessages((prev) => [...prev, { id: uid, role: "user", content: trimmed }]);
      try {
        const res = (await api<any>("/api/hermes/chat", {
          method: "POST",
          body: { message: trimmed, history: messages.map((m) => ({ role: m.role, content: m.content })), stream: false },
        })) as any;
        const reply = res?.content ?? res?.message ?? "";
        const proposals = Array.isArray(res?.proposals) ? res.proposals : [];
        setMessages((prev) => [
          ...prev,
          { id: `a-${Date.now()}`, role: "assistant", content: String(reply), proposals },
        ]);
        if (proposals.length > 0) {
          setPinTarget({ kind: "proposal", proposal: proposals[0] });
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          { id: `e-${Date.now()}`, role: "assistant", content: "Hey, I hit a snag connecting to my brain right now. Give me a moment and try again! 🔧" },
        ]);
      } finally {
        setSending(false);
        setInput("");
        poke();
      }
    },
    [messages, sending, poke]
  );

  // pre-fill/execute ?prompt=
  React.useEffect(() => {
    if (!promptParam || promptSentRef.current) return;
    if (status !== "ready") return;
    promptSentRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void sendPrompt(promptParam);
  }, [promptParam, status, sendPrompt]);

  async function handlePinVerified(pin: string) {
    if (!pinTarget) return;
    setPinBusy(true);
    setPinError(null);
    try {
      if (pinTarget.kind === "proposal") {
        const prop = pinTarget.proposal;
        await api("/api/consuela/planner/apply", {
          method: "POST",
          headers: { "x-consuela-pin": pin },
          body: { tool: prop?.tool, args: prop?.args, operationId: prop?.operationId },
        });
        setMessages((prev) => [
          ...prev,
          { id: `a-${Date.now()}`, role: "assistant", content: "Done — applied." },
        ]);
      } else if (pinTarget.kind === "act") {
        await api("/api/consuela/suggestions/act", {
          method: "POST",
          headers: { "x-consuela-pin": pin },
          body: { id: pinTarget.suggestion?.id },
        });
        setSuggestions((prev) => prev.filter((s) => s?.id !== pinTarget.suggestion?.id));
      } else if (pinTarget.kind === "dismiss") {
        await api("/api/consuela/suggestions", {
          method: "PATCH",
          headers: { "x-consuela-pin": pin },
          body: { id: pinTarget.suggestion?.id, status: "dismissed" },
        });
        setSuggestions((prev) => prev.filter((s) => s?.id !== pinTarget.suggestion?.id));
      }
      setPinTarget(null);
      setPinError(null);
    } catch (e: any) {
      if (e?.status === 0) setPinError(UNREACHABLE_COPY);
      else setPinError("Wrong PIN — try again.");
    } finally {
      setPinBusy(false);
    }
  }

  const retry = () => void loadThread();

  const guest = hydrated && !member;

  return (
    <View testID="chat-page" style={{ flex: 1 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
        <Text style={{ fontSize: 22 }}>✨</Text>
        <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.title.fontSize, fontWeight: "700" }}>Consuela</Text>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors["color-accent-mint"] ?? accentColor }} />
        <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }}>AI Family Assistant</Text>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 120 }}>
        {/* proactive suggestions strip */}
        {member && suggestions.length > 0 ? (
          <View testID="chat-suggestions" style={{ gap: 8 }}>
            <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "600" }}>
              Proactive suggestions
            </Text>
            {suggestions.map((s) => (
              <View key={String(s?.id)} testID={`chat-suggestion-${String(s?.id)}`} style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <Text style={{ flex: 1, color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize }}>
                  {String(s?.title ?? s?.body ?? "Suggestion")}
                </Text>
                <Pressable
                  testID={`chat-suggestion-act-${String(s?.id)}`}
                  accessibilityRole="button"
                  onPress={() => setPinTarget({ kind: "act", suggestion: s })}
                  style={{ minHeight: 44, paddingHorizontal: 12, justifyContent: "center" }}
                >
                  <Text style={{ color: accentColor, fontWeight: "700" }}>Act</Text>
                </Pressable>
                <Pressable
                  testID={`chat-suggestion-dismiss-${String(s?.id)}`}
                  accessibilityRole="button"
                  onPress={() => setPinTarget({ kind: "dismiss", suggestion: s })}
                  style={{ minHeight: 44, paddingHorizontal: 12, justifyContent: "center" }}
                >
                  <Text style={{ color: colors["color-text-secondary"], fontWeight: "700" }}>Dismiss</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        {guest ? (
          <View testID="chat-guest" style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.body.fontSize, textAlign: "center" }}>
              {GUEST_COPY}
            </Text>
          </View>
        ) : status === "loading" ? (
          <View testID="chat-loading" style={{ flex: 1, gap: 12 }}>
            <View style={{ height: 64, borderRadius: 20, backgroundColor: colors["color-surface-2"] }} />
            <View style={{ height: 64, borderRadius: 20, backgroundColor: colors["color-surface-2"] }} />
          </View>
        ) : status === "error" ? (
          <View testID="chat-error" style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Text style={{ color: colors["color-accent-rose"] ?? colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, textAlign: "center" }}>
              {errorText}
            </Text>
            <Pressable testID="chat-retry" accessibilityRole="button" onPress={retry} style={{ minHeight: 44, paddingHorizontal: 12, justifyContent: "center" }}>
              <Text style={{ color: accentColor, fontWeight: "700" }}>Try again</Text>
            </Pressable>
          </View>
        ) : (
          <View testID="chat-ready">
            {messages.length === 0 ? (
              <View style={{ alignItems: "center", gap: 12, paddingVertical: 24 }}>
                <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: mix(accentColor, "transparent", 20), alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 36 }}>✨</Text>
                </View>
                <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.title.fontSize, fontWeight: "700" }}>Hi, I&apos;m Consuela</Text>
              </View>
            ) : null}
            {member && status === "ready" ? (
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
                {["Dinner", "Next up", "Speaking as"].map((label, i) => (
                  <View key={label} style={{ flex: 1, padding: 12, borderRadius: 16, backgroundColor: colors["color-surface-2"] }}>
                    <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>{label}</Text>
                    <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, marginTop: 4 }}>
                      {i === 2 ? member.name : "—"}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
            <View testID="chat-thread" style={{ gap: 10 }}>
              {messages.map((m, i) => (
                <View key={m.id ?? i} testID={`chat-message-${i}`} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "85%" }}>
                  <View
                    testID={`chat-bubble-${m.role}`}
                    style={{
                      borderRadius: 16,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      backgroundColor: m.role === "user" ? (colors["color-accent-selected"] ?? accentColor) : colors["color-surface-2"],
                    }}
                  >
                    <Text style={{ color: m.role === "user" ? colors["color-text-on-accent"] : colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize }}>
                      {m.content}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

      </ScrollView>

      {member && status === "ready" ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 12, paddingBottom: 120 }}>
          <TextInput
            testID="chat-input"
            value={input}
            onChangeText={setInput}
            placeholder="Ask Consuela…"
            style={{ flex: 1, minHeight: 64, borderWidth: 1, borderColor: colors["color-border"], borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize }}
          />
          <Pressable
            testID="chat-send"
            accessibilityRole="button"
            disabled={sending}
            onPress={() => void sendPrompt(input)}
            style={{ minHeight: 64, minWidth: 64, paddingHorizontal: 12, justifyContent: "center", alignItems: "center", borderRadius: 12, backgroundColor: accentColor }}
          >
            <Text style={{ color: colors["color-text-on-accent"], fontWeight: "700" }}>{sending ? "…" : "Send"}</Text>
          </Pressable>
        </View>
      ) : null}

      <Modal
        visible={!!pinTarget}
        onClose={() => !pinBusy && setPinTarget(null)}
        title={pinTarget?.kind === "proposal" ? "Confirm proposal" : pinTarget?.kind === "act" ? "Act on suggestion" : "Dismiss suggestion"}
      >
        {pinTarget?.kind === "proposal" ? (
          <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, marginBottom: 12 }}>
            {String(pinTarget.proposal?.tool ?? "proposal")}
          </Text>
        ) : null}
        <PinPad
          testID="chat-pinpad"
          member={member ? { name: member.name, emoji: member.emoji ?? "🙂", color: member.color } : { name: "Family", emoji: "🙂" }}
          onVerified={(pin) => void handlePinVerified(pin)}
          onCancel={() => setPinTarget(null)}
          busy={pinBusy}
          error={pinError}
        />
      </Modal>
    </View>
  );
}

export default ChatPage;
