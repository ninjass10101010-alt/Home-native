import React, { useEffect, useState } from "react";
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useTheme } from "../theme/ThemeProvider";
import { scheduleLocalReminder } from "../native/notifications";
import { NavIcon } from "../ui/NavIcon";
import { Material } from "../theme/Material";
import { MOTION, TYPOGRAPHY } from "../theme/tokens";
import { accentInk, mix } from "../theme/mix";
import { IconButton } from "../ui/IconButton";
import { ListRow } from "../ui/ListRow";
import { isPhotoUri } from "../ui/MemberRail";
import { Modal } from "../ui/Modal";
import { PinPad } from "../ui/PinPad";
import { SoftButton } from "../ui/SoftButton";
import { useToast } from "../ui/Toast";
import { SignedOutBanner } from "../ui/SignedOutBanner";
import { api, ApiError } from "../api/client";
import { useAuth } from "../state/AuthProvider";

export type EmergencyType = "fire" | "water" | "injury" | "general";

interface TypeDef {
  id: EmergencyType;
  label: string;
  icon: string;
}

/**
 * The alert types are the web EmergencyButton's real list (Home-ai
 * components/ui/EmergencyButton.tsx:11-16) — the only place the web lets a
 * family raise a PIN-gated alert. Shown inside the alert modal AFTER the PIN
 * verifies, the web's order (PIN → type → send).
 */
const ALERT_TYPES: TypeDef[] = [
  { id: "fire", label: "Fire", icon: "🔥" },
  { id: "water", label: "Water Leak", icon: "💧" },
  { id: "injury", label: "Injury", icon: "🤕" },
  { id: "general", label: "General", icon: "🚨" },
];

type SituationId = "minor" | "lost" | "lockout" | "sick";

interface SituationDef {
  id: SituationId;
  label: string;
  icon: string;
  desc: string;
  contact: string;
}

/**
 * Common Situations — verbatim port of the web emergency page's
 * emergencyTypes (Home-ai src/app/emergency/page.tsx:47-52). These rows are
 * the page's situation content for every signed-out visitor; tapping one
 * opens the PIN-gated alert flow (the web's EmergencyButton flow).
 */
const SITUATIONS: SituationDef[] = [
  { id: "minor", label: "Minor Injury", icon: "🤕", desc: "Small cuts, scrapes, or bruises", contact: "Mom or Dad" },
  { id: "lost", label: "Lost Item", icon: "🔍", desc: "Lost keys, phone, or important item", contact: "Call home" },
  { id: "lockout", label: "Locked Out", icon: "🔒", desc: "Locked out of house or car", contact: "Mom or Dad" },
  { id: "sick", label: "Not Feeling Well", icon: "🤒", desc: "Mild illness or discomfort", contact: "Mom or Dad" },
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
  contactsSource?: ContactsSource;
  houseAlert?: HouseAlert;
  details?: { houseAlert?: HouseAlert };
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

type ContactsSource = "live" | "cache";

type EmergencyResult =
  | {
      outcome: "success";
      partial: boolean;
      message: string;
      warning?: string;
      houseAlert?: HouseAlert;
      contactsSource?: ContactsSource;
    }
  | { outcome: "failure"; message: string; contactsSource?: ContactsSource };

/** The emergency route takes ANY family member's PIN — guests get the neutral identity. */
const GENERIC_MEMBER = { name: "Family member", emoji: "🔐" };

const WRONG_PIN_COPY = "Wrong PIN — try again.";
const PIN_REQUIRED_COPY = "Enter the family PIN to send this alert.";
const UNREACHABLE_COPY = "Couldn't reach Consuela — check the connection and try again.";
const COOLDOWN_COPY = "An emergency alert was sent recently. Wait a moment before trying again.";
const IN_FLIGHT_COPY = "An emergency alert is already sending. Wait for it to finish before trying again.";
const GENERIC_FAILURE_COPY = "Emergency alert failed. Please try again or call emergency services directly.";
const CONTACTS_UNAVAILABLE_COPY = "Couldn't load your emergency contacts right now.";
const CONTACTS_CACHE_BADGE_COPY = "Live emergency contacts are unavailable — showing this device's saved list.";
const CONTACTS_EMPTY_TITLE = "No emergency contacts yet";
const STALE_RECIPIENTS_WARNING =
  "Warning: stale cached contacts were used. Recipients may be out of date; verify them before retrying.";
const NINE_ELEVEN_COPY = "If this is a life-threatening emergency, call 911.";
const DEFAULT_COOLDOWN_MS = 30_000; // the server's documented cooldown window
const MAX_COOLDOWN_S = 600;

const RETRY_NOTICE = (s: number) => `You can try again in ${s} second${s === 1 ? "" : "s"}.`;

// Port of the web's EMERGENCY_ERROR_COPY (Home-ai EmergencyButton.tsx:46-54):
// a parent mid-emergency never reads a snake_case code off the result screen —
// every route error code gets its own human sentence + remediation.
const EMERGENCY_ERROR_COPY: Record<string, string> = {
  emergency_cooldown: "An emergency alert was sent recently. Wait a moment before trying again.",
  emergency_in_flight: "An emergency alert is already sending. Wait for it to finish before trying again.",
  pin_check_failed: "Could not check the family PIN. Please try again or call emergency services directly.",
  contacts_unavailable: "Emergency contacts could not be read. No alert was sent — please call emergency services directly.",
  delivery_failed: "No emergency channel confirmed delivery. Please call emergency services directly.",
  service_not_configured: "SMS and email are not configured for alerts. Please call emergency services directly.",
  config_resolution_failed: "SMS and email could not be configured. Please call emergency services directly.",
};

// machine_code / machine_code_with_digits — anything shaped like an internal
// identifier rather than a sentence (web ERROR_CODE_SHAPE).
const ERROR_CODE_SHAPE = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/;

/** Web humanizeError port: a human sentence wins; a code-shaped string is
 *  translated via the copy map; anything else falls back to the generic copy. */
function humanizeServerMessage(message: unknown, code: string): string {
  const text = typeof message === "string" ? message.trim() : "";
  if (text && !ERROR_CODE_SHAPE.test(text)) return text;
  return EMERGENCY_ERROR_COPY[text || code] ?? GENERIC_FAILURE_COPY;
}

/** Web parseContactsSource port: only the two declared sources count. */
function parseContactsSource(value: unknown): ContactsSource | undefined {
  return value === "live" || value === "cache" ? value : undefined;
}

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
 * The wall's Emergency surface (WS-9) — a faithful port of the web emergency
 * page (Home-ai src/app/emergency/page.tsx): the signed-out saved-copy banner,
 * the rose-tinted emergency header bar, the honest contacts card, the Common
 * Situations grid, the settings quick-link bar and the 911 card. The web's
 * PIN-gated alert flow (EmergencyButton: PIN → type → POST /api/emergency →
 * honest result screens) opens from a situation tap; the PIN is the
 * authentication, exactly as on the web.
 */
export function EmergencyFlow() {
  const { colors, theme, setTheme } = useTheme();
  const toast = useToast();
  const { member, hydrated } = useAuth();
  const router = useRouter();

  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [contactsState, setContactsState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [contactsSource, setContactsSource] = useState<ContactsSource>("live");
  const [alertSituation, setAlertSituation] = useState<SituationDef | null>(null);
  const [modalStage, setModalStage] = useState<"pin" | "type" | "result">("pin");
  const [pendingPin, setPendingPin] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<EmergencyResult | null>(null);
  const [retrySeconds, setRetrySeconds] = useState(0);

  // Contacts preview: session-gated — guests never fire the doomed 401. The
  // server declares which source answered; "cache" is badged honestly below.
  useEffect(() => {
    if (!member) return;
    let alive = true;
    api<{ contacts?: EmergencyContact[]; contactsSource?: ContactsSource }>("/api/emergency-contacts")
      .then((res) => {
        if (!alive) return;
        const source = parseContactsSource(res?.contactsSource);
        if (source) setContactsSource(source);
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
    setAlertSituation(null);
    setModalStage("pin");
    setPendingPin(null);
    setResult(null);
    setPinError(null);
    setRetrySeconds(0);
  };

  const openAlert = (s: SituationDef) => {
    setAlertSituation(s);
    setModalStage("pin");
    setPendingPin(null);
    setResult(null);
    setPinError(null);
    setRetrySeconds(0);
  };

  const goBack = () => {
    // The shield pushes /emergency; back returns to Home. Opened with no
    // history, replace with Home so the route is never a dead end.
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  const send = async (typeId: string, pin: string) => {
    if (busy) return;
    setBusy(true);
    setPinError(null);
    const fail = (message: string, source?: ContactsSource) => {
      setResult({ outcome: "failure", message, ...(source ? { contactsSource: source } : {}) });
      setModalStage("result");
    };
    try {
      const res = await api<EmergencyOk>("/api/emergency", { method: "POST", body: { type: typeId, pin } });
      if (res && res.success === true) {
        const source = parseContactsSource(res.contactsSource);
        setResult({
          outcome: "success",
          partial: res.partial === true,
          message: res.message || "Emergency alert sent.",
          ...(res.warning ? { warning: res.warning } : {}),
          ...((res.details?.houseAlert ?? res.houseAlert) ? { houseAlert: (res.details?.houseAlert ?? res.houseAlert) as HouseAlert } : {}),
          ...(source ? { contactsSource: source } : {}),
        });
        setModalStage("result");
        void scheduleLocalReminder("Emergency alert", res.message || "Emergency alert sent.", 2);
      } else {
        fail(humanizeServerMessage(res?.message, ""), parseContactsSource(res?.contactsSource));
      }
    } catch (e) {
      if (e instanceof ApiError) {
        const body = (e.body ?? {}) as Record<string, unknown>;
        const source = parseContactsSource(body.contactsSource);
        const errorCode = typeof body.error === "string" ? body.error : e.code;
        if (e.status === 401) {
          // Back to the pad — it shakes + clears; the family keeps their place.
          setPinError(e.code === "Invalid PIN" ? WRONG_PIN_COPY : PIN_REQUIRED_COPY);
          setModalStage("pin");
        } else if (e.status === 429 && e.code === "emergency_cooldown") {
          const ms =
            typeof body.retryAfterMs === "number" && body.retryAfterMs > 0 ? body.retryAfterMs : DEFAULT_COOLDOWN_MS;
          setRetrySeconds(Math.min(Math.ceil(ms / 1000), MAX_COOLDOWN_S));
          fail(COOLDOWN_COPY, source);
        } else if (e.status === 409) {
          fail(IN_FLIGHT_COPY, source);
        } else if (e.status === 503) {
          // Web parity: each 503 code gets its own sentence + remediation.
          fail(EMERGENCY_ERROR_COPY[errorCode] ?? humanizeServerMessage(body.message, errorCode), source);
        } else if (e.status === 502) {
          // The route only 502s when ZERO channels delivered (its
          // `if (!anyDelivered)` branch) — that is a failure whatever the
          // body's `partial` claims. Partial-success UI is reserved for
          // 200s with partial:true.
          fail(humanizeServerMessage(body.message, errorCode), source);
        } else if (e.status === 0) {
          fail(UNREACHABLE_COPY);
        } else {
          fail(humanizeServerMessage(body.message, errorCode), source);
        }
      } else {
        fail(GENERIC_FAILURE_COPY);
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
  // Safe non-rose fallbacks: apricot (warm) and sage (green) keep the
  // semantic distinction even if a regeneration ever drops the accent.
  const amber = colors["color-accent-amber"] ?? colors["color-accent-apricot"];
  const mint = colors["color-accent-mint"] ?? colors["color-accent-sage"];
  const resultTone =
    result?.outcome === "success" ? (result.partial ? amber : mint) : rose;
  const resultTitle =
    result?.outcome === "success" ? (result.partial ? "Alert Partially Sent" : "Alert Sent") : "Alert Failed";

  const amberChip = {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 14,
    marginTop: 16,
    alignSelf: "center" as const,
    backgroundColor: mix(amber, "transparent", 88),
    borderColor: mix(amber, "transparent", 75),
  };
  const amberInk = accentInk(amber, colors["color-text-primary"]);

  const isParent = hydrated && member?.role === "parent";
  const emptyContactsDescription = isParent
    ? "Add or manage emergency contacts to get started."
    : "Ask a parent to add or manage emergency contacts.";
  const safetyActionLabel = isParent
    ? contacts.length > 0
      ? "Manage contacts"
      : "Add contacts"
    : "Open safety settings";
  const safetyBarLabel = isParent
    ? contacts.length > 0
      ? "Manage contacts in Safety"
      : "Add or manage contacts in Safety"
    : "Open safety settings";

  const roseInk = accentInk(rose, colors["color-text-primary"]);

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 180 }}>
      {/* Signed-out banner (web SyncStatusBanner parity): the saved-copy state
          is never indistinguishable from "synced". The sign-in link routes to
          the Home rail — the app's only sign-in surface. */}
      {!member ? (
        <SignedOutBanner
          testID="sync-status-banner"
          accessibilityLabel="Sign in with your PIN"
          style={{ marginBottom: 16 }}
          title="🔐 Signed out — showing your saved copy. Every change stays on this device until you sign in."
          action={
            <Pressable
              testID="sync-status-banner-signin"
              accessibilityRole="link"
              accessibilityLabel="Sign in with your PIN"
              onPress={() => router.push("/")}
              style={{ minHeight: 64, justifyContent: "center", paddingHorizontal: 8 }}
            >
              <Text
                style={{
                  color: colors["color-text-primary"],
                  fontSize: TYPOGRAPHY.label.fontSize,
                  fontWeight: "600",
                  textDecorationLine: "underline",
                  textDecorationStyle: "dotted",
                }}
              >
                Sign in with your PIN →
              </Text>
            </Pressable>
          }
        />
      ) : null}

      {/* Emergency header bar (web TopBar variant="emergency" parity): the
          alarm bar keeps rose semantics — tinted fill, rose border, rose glow,
          rose ink — with back-to-Home left and the theme toggle right. */}
      <View style={{ marginBottom: 20 }}>
        <View
          style={{
            shadowColor: mix(rose, "transparent", 35),
            shadowOpacity: 1,
            shadowRadius: 32,
            shadowOffset: { width: 0, height: 0 },
            elevation: 16,
            borderRadius: 24,
          }}
        >
          <Material
            tier="thin"
            style={{
              borderRadius: 24,
              borderWidth: 2,
              backgroundColor: mix(rose, "transparent", 12),
              borderColor: mix(rose, "transparent", 30),
              paddingHorizontal: 12,
              paddingVertical: 8,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <IconButton
              variant="glass"
              size="md"
              testID="emergency-back"
              icon={<Text style={{ color: roseInk, fontSize: 24 }}>←</Text>}
              label="Back to Home"
              onPress={goBack}
              style={{ backgroundColor: mix(rose, "transparent", 18) }}
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: roseInk, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
                Emergency
              </Text>
              <Text
                style={{
                  color: roseInk,
                  fontSize: TYPOGRAPHY.label.fontSize,
                  opacity: 0.8,
                }}
              >
                Urgent Contacts & Help
              </Text>
            </View>
            <IconButton
              variant="glass"
              size="md"
              testID="emergency-theme-toggle"
              icon={
                <Text style={{ color: colors["color-text-primary"], fontSize: 24 }}>
                  {theme === "dark" ? "🌙" : "☀️"}
                </Text>
              }
              label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              onPress={toggleTheme}
            />
          </Material>
        </View>
      </View>

      {/* Contacts card — honest per state (web page parity) */}
      <View style={{ marginBottom: 24 }}>
        {!member ? (
          // Signed out: the saved copy has no contacts — the empty card, never
          // an invented list (the web falls back to the local cache, also empty).
          <EmptyContactsCard copy={emptyContactsDescription} actionLabel={safetyActionLabel} />
        ) : contactsState === "ready" ? (
          contacts.length === 0 ? (
            <EmptyContactsCard copy={emptyContactsDescription} actionLabel={safetyActionLabel} />
          ) : (
            <View>
              {contactsSource === "cache" ? (
                <Text
                  accessibilityRole="alert"
                  style={{
                    color: colors["color-text-secondary"],
                    fontSize: TYPOGRAPHY.body.fontSize,
                    marginBottom: 10,
                  }}
                >
                  {CONTACTS_CACHE_BADGE_COPY}
                </Text>
              ) : null}
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
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                {contacts.map((c) => (
                  <Material key={String(c.id)} tier="thin" style={{ borderRadius: 999, paddingHorizontal: 20, paddingVertical: 14 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      {c.emoji && isPhotoUri(c.emoji) ? (
                        <Image
                          source={{ uri: c.emoji }}
                          style={{ width: 32, height: 32, borderRadius: 16 }}
                          resizeMode="cover"
                        />
                      ) : (
                        <Text style={{ fontSize: 28 }}>{c.emoji || "👤"}</Text>
                      )}
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
              </View>
            </View>
          )
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

      {/* Common Situations (web page parity) — the primary content for every
          visitor; a tap opens the PIN-gated alert flow. */}
      <View style={{ marginBottom: 16 }}>
        <Text
          style={{
            color: colors["color-text-primary"],
            fontSize: TYPOGRAPHY.title.fontSize,
            fontWeight: "700",
            marginBottom: 12,
          }}
        >
          Common Situations
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {SITUATIONS.map((s) => (
            <SituationRow key={s.id} situation={s} onPress={() => openAlert(s)} />
          ))}
        </View>
      </View>

      {/* Settings quick-link bar (web page parity): left-aligned label, trailing
          chevron — a destination, not a disabled field. */}
      <ListRow
        testID="emergency-safety-bar"
        leading={<NavIcon iconKey="settings" size={22} color={colors["color-text-secondary"]} />}
        title={
          <Text
            style={{
              color: colors["color-text-secondary"],
              fontSize: TYPOGRAPHY.body.fontSize,
              fontWeight: "600",
            }}
          >
            {safetyBarLabel}
          </Text>
        }
        showDisclosure
        onPress={() => router.push("/settings")}
        accessibilityLabel="Open safety settings"
        style={{ marginBottom: 24, borderStyle: "dashed", backgroundColor: colors["color-surface-2"] }}
      />

      {/* 911 — the reference page's life-threatening card */}
      <Material tier="regular" tone={rose} style={{ borderRadius: 28, padding: 24, marginTop: 24, alignItems: "center", borderColor: mix(rose, "transparent", 35), backgroundColor: mix(rose, "transparent", 10) }}>
        <Text style={{ fontSize: 44 }}>🚨</Text>
        <Text
          style={{
            color: roseInk,
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
          style={{ alignSelf: "stretch", marginTop: 16, backgroundColor: mix(rose, "transparent", 18), borderWidth: 1, borderColor: mix(rose, "transparent", 30) }}
        >
          <Text style={{ color: roseInk, fontWeight: "700" }}>Call 911</Text>
        </SoftButton>
      </Material>

      {/* The alert flow (web EmergencyButton parity): PIN → type → honest
          result. The PIN is memory-only and the authentication — any family
          member's PIN sends. */}
      <Modal
        visible={!!alertSituation}
        onClose={() => !busy && reset()}
        title={result ? "Emergency" : "Emergency alert"}
        description={
          result
            ? undefined
            : modalStage === "type"
              ? "PIN verified — choose the alert to send."
              : alertSituation
                ? `Sending a ${alertSituation.label} alert to the family's emergency contacts.`
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
            {result.contactsSource === "cache" ? (
              // Web parity (EmergencyButton): stale cached recipients are
              // warned about on the result, success or failure.
              <View style={amberChip} accessibilityRole="alert">
                <Text style={{ color: amberInk, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "600" }}>
                  {STALE_RECIPIENTS_WARNING}
                </Text>
              </View>
            ) : null}
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
                  setPendingPin(null);
                  setModalStage("pin");
                }}
                style={{ alignSelf: "stretch", marginTop: 16 }}
              >
                Try again
              </SoftButton>
            )}
          </View>
        ) : modalStage === "type" ? (
          <View testID="emergency-type-list" style={{ gap: 12 }}>
            {ALERT_TYPES.map((t) => (
              <AlertTypeRow
                key={t.id}
                type={t}
                busy={busy}
                onPress={() => {
                  if (pendingPin) void send(t.id, pendingPin);
                }}
              />
            ))}
          </View>
        ) : (
          <PinPad
            testID="emergency-pinpad"
            member={member ? { name: member.name, emoji: member.emoji || "👤" } : GENERIC_MEMBER}
            onVerified={(pin) => {
              setPendingPin(pin);
              setPinError(null);
              setModalStage("type");
            }}
            onCancel={() => !busy && reset()}
            busy={busy}
            error={pinError}
          />
        )}
      </Modal>
    </ScrollView>
  );
}

/** The empty-contacts card (web page parity): clipboard glyph, honest title
 *  and copy, and the blue settings pill — never an invented contact. */
function EmptyContactsCard({ copy, actionLabel }: { copy: string; actionLabel: string }) {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <Material tier="thin" style={{ borderRadius: 20, padding: 24, alignItems: "center" }}>
      <Text style={{ fontSize: 44, marginBottom: 8 }}>📋</Text>
      <Text
        style={{
          color: colors["color-text-primary"],
          fontSize: TYPOGRAPHY.title.fontSize,
          fontWeight: "700",
        }}
      >
        {CONTACTS_EMPTY_TITLE}
      </Text>
      <Text
        style={{
          color: colors["color-text-secondary"],
          fontSize: TYPOGRAPHY.body.fontSize,
          marginTop: 4,
          textAlign: "center",
        }}
      >
        {copy}
      </Text>
      <SoftButton
        size="sm"
        onPress={() => router.push("/settings")}
        testID="emergency-contacts-safety"
        style={{ marginTop: 16 }}
      >
        {actionLabel}
      </SoftButton>
    </Material>
  );
}

/** One Common Situations row (web page parity): icon, label + description,
 *  right-aligned contact — with the kit's material press response. */
function SituationRow({ situation, onPress }: { situation: SituationDef; onPress: () => void }) {
  const { colors, reduceMotion } = useTheme();
  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={[aStyle, { flex: 1, minWidth: 460 }]}>
      <Pressable
        testID={`emergency-situation-${situation.id}`}
        accessibilityRole="button"
        accessibilityLabel={`${situation.label} — ${situation.desc}. Contact: ${situation.contact}`}
        onPress={onPress}
        onPressIn={() => { // eslint-disable-next-line react-hooks/immutability -- Reanimated shared-value write is the idiom
        if (!reduceMotion) scale.value = withTiming(0.96, { duration: MOTION.fast }); }}
        onPressOut={() => { // eslint-disable-next-line react-hooks/immutability -- Reanimated shared-value write is the idiom
        scale.value = withTiming(1, { duration: MOTION.fast }); }}
      >
        <Material
          tier="thin"
          style={{
            borderRadius: 20,
            padding: 16,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            minHeight: 96,
          }}
        >
          <Text style={{ fontSize: 28 }}>{situation.icon}</Text>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              numberOfLines={1}
              style={{
                color: colors["color-text-primary"],
                fontSize: TYPOGRAPHY.body.fontSize,
                fontWeight: "600",
              }}
            >
              {situation.label}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                color: colors["color-text-secondary"],
                fontSize: TYPOGRAPHY.label.fontSize,
                marginTop: 2,
              }}
            >
              {situation.desc}
            </Text>
          </View>
          <Text
            style={{
              color: colors["color-text-secondary"],
              fontSize: TYPOGRAPHY.label.fontSize,
            }}
          >
            {situation.contact}
          </Text>
        </Material>
      </Pressable>
    </Animated.View>
  );
}

/** One alert-type row inside the alert modal (web EmergencyButton parity):
 *  rose-tinted row, icon + label — the send button once the PIN is verified. */
function AlertTypeRow({ type, busy, onPress }: { type: TypeDef; busy: boolean; onPress: () => void }) {
  const { colors, reduceMotion } = useTheme();
  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={aStyle}>
      <Pressable
        testID={`emergency-alert-type-${type.id}`}
        accessibilityRole="button"
        accessibilityLabel={type.label}
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        onPress={onPress}
        onPressIn={() => { // eslint-disable-next-line react-hooks/immutability -- Reanimated shared-value write is the idiom
        if (!reduceMotion) scale.value = withTiming(0.96, { duration: MOTION.fast }); }}
        onPressOut={() => { // eslint-disable-next-line react-hooks/immutability -- Reanimated shared-value write is the idiom
        scale.value = withTiming(1, { duration: MOTION.fast }); }}
      >
        <Material
          tier="thin"
          style={{
            borderRadius: 20,
            padding: 14,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            backgroundColor: mix(colors["color-accent-rose"], "transparent", 10),
            opacity: busy ? 0.5 : 1,
          }}
        >
          <Text style={{ fontSize: 28 }}>{type.icon}</Text>
          <Text
            style={{
              color: colors["color-text-primary"],
              fontSize: TYPOGRAPHY.body.fontSize,
              fontWeight: "600",
            }}
          >
            {type.label}
          </Text>
        </Material>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
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
