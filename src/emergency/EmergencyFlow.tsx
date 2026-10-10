import React, { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { Material } from "../theme/Material";
import { TYPOGRAPHY } from "../theme/tokens";
import { accentInk, mix } from "../theme/mix";
import { Modal } from "../ui/Modal";
import { PinPad } from "../ui/PinPad";
import { SoftButton } from "../ui/SoftButton";
import { useToast } from "../ui/Toast";
import { api, ApiError } from "../api/client";
import { useAuth } from "../state/AuthProvider";

export type EmergencyType = "fire" | "water" | "injury" | "general";

interface TypeDef {
  id: EmergencyType;
  label: string;
  icon: string;
}

/** Verified contract types (wave1-endpoints + the brief) — nothing invented. */
const TYPES: TypeDef[] = [
  { id: "fire", label: "Fire", icon: "🔥" },
  { id: "water", label: "Water", icon: "🌊" },
  { id: "injury", label: "Injury", icon: "🚑" },
  { id: "general", label: "General", icon: "🆘" },
];

interface HouseAlert {
  sent: number;
  failed: number;
  notes: string[];
}

interface EmergencyOk {
  ok?: boolean;
  success?: boolean;
  partial?: boolean;
  warning?: string;
  message?: string;
  houseAlert?: HouseAlert;
}

interface EmergencyContact {
  id: number | string;
  name: string;
  phone: string;
  email?: string;
  relationship?: string;
  isPrimary?: boolean;
  emoji?: string;
}

type EmergencyResult =
  | { outcome: "success"; partial: boolean; message: string; warning?: string; houseAlert?: HouseAlert }
  | { outcome: "failure"; message: string };

/** The emergency route takes ANY family member's PIN — guests get the neutral identity. */
const GENERIC_MEMBER = { name: "Family member", emoji: "🔐" };

const WRONG_PIN_COPY = "Wrong PIN — try again.";
const PIN_REQUIRED_COPY = "Enter the family PIN to send this alert.";
const UNREACHABLE_COPY = "Couldn't reach Consuela — check the connection and try again.";
const CONTACTS_CALM_COPY =
  "Couldn't reach the emergency contacts right now — check the Settings → Safety contacts.";
const COOLDOWN_COPY = "An emergency alert was sent recently. Wait a moment before trying again.";
const IN_FLIGHT_COPY = "An alert is already sending…";
const GENERIC_FAILURE_COPY = "Emergency alert failed. Please try again or call emergency services directly.";
const DELIVERY_PARTIAL_COPY =
  "Only some emergency channels confirmed delivery — treat this as not fully sent.";
const GUEST_CONTACTS_COPY = "Sign in with your PIN to see your emergency contacts.";
const CONTACTS_UNAVAILABLE_COPY = "Couldn't load your emergency contacts right now.";
const NINE_ELEVEN_COPY = "If this is a life-threatening emergency, call 911.";
const DEFAULT_COOLDOWN_MS = 30_000; // the server's documented cooldown window
const MAX_COOLDOWN_S = 600;

const RETRY_NOTICE = (s: number) => `You can try again in ${s} second${s === 1 ? "" : "s"}.`;

/** E.164/10-digit → (XXX) XXX-XXXX (port of the web's formatPhoneForDisplay). */
function formatPhoneForDisplay(phone: string): string {
  const cleaned = phone.replace(/[^0-9]/g, "");
  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

/**
 * The wall's Emergency surface (WS-9): contacts preview (session-gated) +
 * four big type cards → PinPad (any family PIN) → honest result screens —
 * success/partial/delivery truth from the server body, cooldown honored in
 * real time, calm copy everywhere. POST /api/emergency self-authenticates.
 */
export function EmergencyFlow() {
  const { colors } = useTheme();
  const toast = useToast();
  const { member } = useAuth();

  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [contactsState, setContactsState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [selectedType, setSelectedType] = useState<TypeDef | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<EmergencyResult | null>(null);
  const [retrySeconds, setRetrySeconds] = useState(0);

  // Contacts preview: session-gated — guests never fire the doomed 401.
  useEffect(() => {
    if (!member) return;
    let alive = true;
    api<{ contacts?: EmergencyContact[] }>("/api/emergency-contacts")
      .then((res) => {
        if (!alive) return;
        if (Array.isArray(res?.contacts)) {
          setContacts(res.contacts);
          setContactsState("ready");
        } else {
          setContactsState("unavailable");
        }
      })
      .catch(() => {
        if (alive) setContactsState("unavailable");
      });
    return () => {
      alive = false;
    };
  }, [member]);

  // The server-declared cooldown, honored in real time (1s tick, web parity).
  useEffect(() => {
    if (retrySeconds <= 0) return;
    const t = setInterval(() => setRetrySeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [retrySeconds]);

  const reset = () => {
    setSelectedType(null);
    setResult(null);
    setPinError(null);
    setRetrySeconds(0);
  };

  const send = async (pin: string) => {
    if (!selectedType || busy) return;
    setBusy(true);
    setPinError(null);
    try {
      const res = await api<EmergencyOk>("/api/emergency", { method: "POST", body: { type: selectedType.id, pin } });
      if (res && res.success === true) {
        setResult({
          outcome: "success",
          partial: res.partial === true,
          message: res.message || "Emergency alert sent.",
          ...(res.warning ? { warning: res.warning } : {}),
          ...(res.houseAlert ? { houseAlert: res.houseAlert } : {}),
        });
      } else {
        setResult({ outcome: "failure", message: res?.message || GENERIC_FAILURE_COPY });
      }
    } catch (e) {
      if (e instanceof ApiError) {
        const body = (e.body ?? {}) as Record<string, unknown>;
        if (e.status === 401) {
          // Stay in the pad — it shakes + clears; the family keeps their place.
          setPinError(e.code === "Invalid PIN" ? WRONG_PIN_COPY : PIN_REQUIRED_COPY);
        } else if (e.status === 429 && e.code === "emergency_cooldown") {
          const ms =
            typeof body.retryAfterMs === "number" && body.retryAfterMs > 0 ? body.retryAfterMs : DEFAULT_COOLDOWN_MS;
          setRetrySeconds(Math.min(Math.ceil(ms / 1000), MAX_COOLDOWN_S));
          setResult({ outcome: "failure", message: COOLDOWN_COPY });
        } else if (e.status === 409) {
          setResult({ outcome: "failure", message: IN_FLIGHT_COPY });
        } else if (e.status === 503) {
          setResult({ outcome: "failure", message: CONTACTS_CALM_COPY });
        } else if (e.status === 502) {
          if (body.partial === true) {
            setResult({ outcome: "success", partial: true, message: (body.message as string) || DELIVERY_PARTIAL_COPY });
          } else {
            setResult({ outcome: "failure", message: (body.message as string) || GENERIC_FAILURE_COPY });
          }
        } else if (e.status === 0) {
          setResult({ outcome: "failure", message: UNREACHABLE_COPY });
        } else {
          setResult({ outcome: "failure", message: (body.message as string) || GENERIC_FAILURE_COPY });
        }
      } else {
        setResult({ outcome: "failure", message: GENERIC_FAILURE_COPY });
      }
    } finally {
      setBusy(false);
    }
  };

  const call911 = () => {
    Linking.openURL("tel:911").catch(() => {
      toast.show("Couldn't open the dialer on this device — call 911 from a phone.", { intent: "error" });
    });
  };

  const rose = colors["color-accent-rose"];
  const amber = colors["color-accent-amber"] ?? rose;
  const mint = colors["color-accent-mint"] ?? rose;
  const resultTone =
    result?.outcome === "success" ? (result.partial ? amber : mint) : rose;
  const resultTitle =
    result?.outcome === "success" ? (result.partial ? "Alert Partially Sent" : "Alert Sent") : "Alert Failed";

  const amberChip = {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 14,
    marginTop: 12,
    alignSelf: "center" as const,
    backgroundColor: mix(amber, "transparent", 88),
    borderColor: mix(amber, "transparent", 75),
  };
  const amberInk = accentInk(amber, colors["color-text-primary"]);

  return (
    <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 16 }}>
      {/* Page header (web TopBar parity) */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{ color: colors["color-text-primary"], fontSize: 54, fontWeight: "700" }}>Emergency</Text>
        <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.body.fontSize, marginTop: 4 }}>
          Urgent Contacts & Help
        </Text>
      </View>

      {/* Contacts preview strip — session-gated */}
      <View style={{ marginBottom: 24 }}>
        {!member ? (
          <Material tier="thin" style={{ borderRadius: 20, paddingHorizontal: 20, paddingVertical: 16 }}>
            <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.body.fontSize }}>
              {GUEST_CONTACTS_COPY}
            </Text>
          </Material>
        ) : contactsState === "ready" ? (
          <View>
            <Text
              style={{
                color: colors["color-text-secondary"],
                fontSize: TYPOGRAPHY.label.fontSize,
                fontWeight: "700",
                letterSpacing: 2,
                marginBottom: 10,
              }}
            >
              EMERGENCY CONTACTS
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              {contacts.map((c) => (
                <Material key={String(c.id)} tier="thin" style={{ borderRadius: 999, paddingHorizontal: 20, paddingVertical: 14 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ fontSize: 28 }}>{c.emoji || "👤"}</Text>
                    <View>
                      <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "600" }}>
                        {c.name}
                      </Text>
                      <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }}>
                        {formatPhoneForDisplay(c.phone)}
                      </Text>
                    </View>
                  </View>
                </Material>
              ))}
            </ScrollView>
          </View>
        ) : contactsState === "unavailable" ? (
          <Material tier="thin" style={{ borderRadius: 20, paddingHorizontal: 20, paddingVertical: 16 }}>
            <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.body.fontSize }}>
              {CONTACTS_UNAVAILABLE_COPY}
            </Text>
          </Material>
        ) : (
          <Material tier="thin" style={{ borderRadius: 20, paddingHorizontal: 20, paddingVertical: 16 }}>
            <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.body.fontSize }}>
              Loading your emergency contacts…
            </Text>
          </Material>
        )}
      </View>

      {/* Type picker */}
      <View style={{ marginBottom: 16 }}>
        <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.title.fontSize, fontWeight: "700" }}>
          {"What's happening?"}
        </Text>
        <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.body.fontSize, marginTop: 4 }}>
          {"Pick the emergency — we'll ask for the family PIN before anything sends."}
        </Text>
      </View>
      <View style={styles.typeGrid}>
        {TYPES.map((t) => (
          <Pressable
            key={t.id}
            testID={`emergency-type-${t.id}`}
            accessibilityRole="button"
            accessibilityLabel={t.label}
            onPress={() => {
              setSelectedType(t);
              setPinError(null);
            }}
            style={styles.typeCard}
          >
            <Material tier="regular" style={{ flex: 1, borderRadius: 28, alignItems: "center", justifyContent: "center", gap: 10 }}>
              <Text style={{ fontSize: 72 }}>{t.icon}</Text>
              <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.stat.fontSize, fontWeight: "700" }}>
                {t.label}
              </Text>
            </Material>
          </Pressable>
        ))}
      </View>

      {/* 911 — the reference page's life-threatening card */}
      <Material tier="regular" style={{ borderRadius: 28, padding: 24, marginTop: 24, alignItems: "center" }}>
        <Text style={{ fontSize: 44 }}>🚨</Text>
        <Text
          style={{
            color: accentInk(rose, colors["color-text-primary"]),
            fontSize: TYPOGRAPHY.title.fontSize,
            fontWeight: "700",
            marginTop: 8,
          }}
        >
          Life-Threatening Emergency
        </Text>
        <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.body.fontSize, marginTop: 4 }}>
          Call 911 immediately
        </Text>
        <SoftButton
          variant="danger"
          size="lg"
          onPress={call911}
          testID="emergency-911"
          style={{ alignSelf: "stretch", marginTop: 16 }}
        >
          Call 911
        </SoftButton>
      </Material>

      {/* The alert flow: PinPad → honest result. */}
      <Modal
        visible={!!selectedType}
        onClose={() => !busy && reset()}
        title={result ? "Emergency" : "Emergency alert"}
        description={
          result
            ? undefined
            : selectedType
              ? `Sending a ${selectedType.label} alert to the family's emergency contacts.`
              : undefined
        }
        dismissable={!busy}
        testID="emergency-modal"
      >
        {result ? (
          <View testID="emergency-result" style={{ alignItems: "center", paddingBottom: 8 }}>
            <View
              style={[
                styles.resultBadge,
                {
                  backgroundColor: mix(resultTone, "transparent", 85),
                  borderColor: mix(resultTone, "transparent", 75),
                },
              ]}
            >
              <Text
                style={{
                  color: accentInk(resultTone, colors["color-text-primary"]),
                  fontSize: 44,
                  fontWeight: "700",
                }}
              >
                {result.outcome === "success" ? "✓" : "✕"}
              </Text>
            </View>
            <Text
              style={{
                color: accentInk(resultTone, colors["color-text-primary"]),
                fontSize: TYPOGRAPHY.title.fontSize,
                fontWeight: "700",
                marginTop: 12,
              }}
            >
              {resultTitle}
            </Text>
            <Text
              accessibilityRole={result.outcome === "success" ? undefined : "alert"}
              accessibilityLiveRegion={result.outcome === "success" ? "polite" : "assertive"}
              style={{
                color: colors["color-text-secondary"],
                fontSize: TYPOGRAPHY.body.fontSize,
                textAlign: "center",
                marginTop: 6,
              }}
            >
              {result.message}
            </Text>
            {result.outcome === "success" && result.partial && result.warning ? (
              <View style={amberChip} accessibilityRole="alert">
                <Text style={{ color: amberInk, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "600" }}>{result.warning}</Text>
              </View>
            ) : null}
            {result.outcome === "success" && result.houseAlert ? (
              <View style={{ marginTop: 12, alignItems: "center" }}>
                <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "600" }}>
                  House channels: {result.houseAlert.sent} sent · {result.houseAlert.failed} failed
                </Text>
                {result.houseAlert.notes.length > 0 ? (
                  <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.body.fontSize, marginTop: 4 }}>
                    {result.houseAlert.notes.join("; ")}
                  </Text>
                ) : null}
              </View>
            ) : null}
            <Text
              style={{
                color: colors["color-text-muted"],
                fontSize: TYPOGRAPHY.label.fontSize,
                marginTop: 14,
                textAlign: "center",
              }}
            >
              {NINE_ELEVEN_COPY}
            </Text>
            {result.outcome === "failure" && retrySeconds > 0 ? (
              <View style={amberChip} accessibilityRole="alert">
                <Text style={{ color: amberInk, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "600" }}>
                  {RETRY_NOTICE(retrySeconds)}
                </Text>
              </View>
            ) : null}
            {result.outcome === "success" ? (
              <SoftButton variant="primary" size="lg" testID="emergency-done" onPress={reset} style={{ alignSelf: "stretch", marginTop: 16 }}>
                Done
              </SoftButton>
            ) : (
              <SoftButton
                variant="danger"
                size="lg"
                testID="emergency-retry"
                disabled={retrySeconds > 0}
                onPress={() => {
                  if (retrySeconds > 0) return;
                  setResult(null);
                  setPinError(null);
                }}
                style={{ alignSelf: "stretch", marginTop: 16 }}
              >
                Try again
              </SoftButton>
            )}
          </View>
        ) : (
          <PinPad
            testID="emergency-pinpad"
            member={member ? { name: member.name, emoji: member.emoji || "👤" } : GENERIC_MEMBER}
            onVerified={(pin) => void send(pin)}
            onCancel={() => !busy && reset()}
            busy={busy}
            error={pinError}
          />
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  typeCard: {
    // Wall lock: 1080 − 2×24 pad − 16 gap → two 508-wide cards (≥64dp floor by far)
    width: 508,
    height: 240,
  },
  resultBadge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default EmergencyFlow;
