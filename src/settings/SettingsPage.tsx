import React, { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { api, ApiError } from "../api/client";
import { getBaseUrl, LAN_BASE_URLS, setBaseUrl } from "../api/config";
import type { ServerMember } from "../api/types";
import { useTheme } from "../theme/ThemeProvider";
import { Material } from "../theme/Material";
import { ACCENTS, TYPOGRAPHY } from "../theme/tokens";
import { useAuth } from "../state/AuthProvider";
import { useLocalSearchParams } from "expo-router";
import { useSync } from "../state/SyncManager";
import { READ_COPY_STALE } from "../home/widgets/data";
import { Chip } from "../ui/Chip";
import { EmptyState } from "../ui/EmptyState";
import { isPhotoUri } from "../ui/MemberRail";
import { Modal } from "../ui/Modal";
import { PinPad } from "../ui/PinPad";
import { SoftButton } from "../ui/SoftButton";
import { SignedOutBanner } from "../ui/SignedOutBanner";
import { Toggle } from "../ui/Toggle";
import { scheduleLocalReminder } from "../native/notifications";
import { FamilySection } from "./FamilySection";
import { HomeSection } from "./HomeSection";

/**
 * The wall's Settings surface (WS-10): the launcher by role (web contract —
 * parents get all six sections; kids/pets get Me/Safety/Appearance; the guest
 * shell drops Me and keeps Safety + Appearance, wording included) with the
 * Wave 2 essentials drilled in:
 *   Me         → profile read + sign out + the PIN-change flow (3 PinPads →
 *                POST /api/members/pin { actorPin, newPin }; 409 pin_collision
 *                and 401 get their own honest copy; PINs stay memory-only).
 *   Safety     → emergency contacts read (+ contactsSource cache badge, empty
 *                and unavailable honesty); editing is deferred, never faked.
 *   Appearance → theme/boost/accent, live through ThemeProvider (the kit's
 *                showcase pattern, no new primitives).
 *   Family     → the live roster + member CRUD (FamilySection — the
 *                2026-10-19 family settings wave: add/edit/remove, starter PIN).
 *   Home / Connections & System → honest deferral cards (the full settings
 *                wave), never dead controls.
 */

type SettingsSectionId = "me" | "family" | "safety" | "appearance" | "home" | "system";

interface SectionDef {
  id: SettingsSectionId;
  title: string;
  description: string;
  icon: string;
}

/** Verbatim Home-ai src/lib/settings-sections.ts copy (route + launcher parity). */
const SECTIONS: readonly SectionDef[] = [
  { id: "me", title: "Me", description: "Your profile and sign-in", icon: "👤" },
  { id: "family", title: "Family", description: "People, pets, and roles", icon: "👨‍👩‍👧‍👦" },
  { id: "safety", title: "Safety", description: "Emergency contacts and alerts", icon: "🛡️" },
  { id: "appearance", title: "Appearance", description: "Theme and home display", icon: "🎨" },
  { id: "home", title: "Home", description: "Layout and wall display", icon: "🏠" },
  { id: "system", title: "Connections & System", description: "Integrations, data, and updates", icon: "🔗" },
];

/** Kid/pet launcher (web SAFE_NON_PARENT_SECTION_IDS). */
const SIGNED_IN_SECTIONS: readonly SettingsSectionId[] = ["me", "safety", "appearance"];
/** The signed-out wall holds the device: guests get Me/Safety/Appearance too
 *  (Home-ai contract) — the Me panel shows the sign-in rail pointer. */
const GUEST_SECTIONS: readonly SettingsSectionId[] = ["me", "safety", "appearance"];

function sectionsFor(member: ServerMember | null): SectionDef[] {
  if (!member) return SECTIONS.filter((s) => GUEST_SECTIONS.includes(s.id));
  if (member.role === "parent") return SECTIONS.filter(() => true);
  return SECTIONS.filter((s) => SIGNED_IN_SECTIONS.includes(s.id));
}

const GUEST_NOTE = "The signed-out family holds this device — sign in on the rail to see your own settings.";
const DEFERRED_COPY = "Settings for the whole family arrive with the full settings wave.";
const HYDRATING_TITLE = "Checking your settings";
const HYDRATING_COPY = "One moment while we confirm who is using this screen.";

// Safety copy — EmergencyFlow + Home-ai settings parity.
const SAFETY_GUEST_COPY = "Sign in with your PIN to see the family's emergency contacts.";
const SAFETY_EDIT_COPY = "Contacts are managed by a parent on the phone app.";
const CONTACTS_LOADING_COPY = "Loading your emergency contacts…";
const CONTACTS_UNAVAILABLE_COPY = "Couldn't load your emergency contacts right now.";
const CONTACTS_CACHE_BADGE_COPY = "Live emergency contacts are unavailable — showing this device's saved list.";
const CONTACTS_EMPTY_TITLE = "No emergency contacts yet";
const CONTACTS_EMPTY_COPY = "Ask a parent to add or manage emergency contacts.";

// PIN flow copy (409 pin_collision / 401 honesty per the plan-locked scope).
const PIN_TAKEN_COPY = "That PIN is taken — pick another one.";
const WRONG_PIN_COPY = "Wrong PIN — try again.";
const PIN_MISMATCH_COPY = "Those PINs don't match — pick your new one again.";
const PIN_UNREACHABLE_COPY = "Couldn't reach Consuela — check the connection and try again.";
const PIN_FAILED_COPY = "Couldn't change your PIN. Try again.";

interface EmergencyContact {
  id: number | string;
  name: string;
  phone: string;
  emoji?: string;
}

type ContactsSource = "live" | "cache";

/** E.164/10-digit → (XXX) XXX-XXXX (parity with EmergencyFlow's formatter). */
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

export function SettingsPage() {
  const { colors, accentColor } = useTheme();
  const { member, hydrated } = useAuth();
  const { stale } = useSync();
  const params = useLocalSearchParams<{ section?: string }>();
  const initialSection = (["me", "family", "safety", "appearance", "home", "system"] as const).includes(
    params.section as SettingsSectionId
  )
    ? (params.section as SettingsSectionId)
    : null;
  const [openId, setOpenId] = useState<SettingsSectionId | null>(initialSection);

  const sections = sectionsFor(member);
  // If the signed-in member signs out mid-visit, their Me panel is gone — the
  // open section follows the launcher instead of ghosting a dead panel.
  const open = sections.find((s) => s.id === openId) ?? null;

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 220 }}>
      {!member ? (
        <SignedOutBanner
          title={GUEST_NOTE}
          style={{ marginBottom: 16 }}
        />
      ) : null}

      {/* Page header — reference/settings parity: eyebrow above the title. */}
      <View style={{ marginBottom: 20 }}>
        <Text
          style={{
            color: colors["color-text-muted"],
            fontSize: TYPOGRAPHY.label.fontSize,
            fontWeight: "700",
            letterSpacing: 2,
          }}
        >
          CHOOSE WHAT TO MANAGE
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 }}>
          <Text style={{ fontSize: 40 }}>⚙️</Text>
          <Text style={{ color: colors["color-text-primary"], fontSize: 40, fontWeight: "700", fontFamily: "serif" }}>Settings</Text>
        </View>
        {stale && member ? (
          <Text
            testID="settings-stale"
            style={{
              color: colors["color-accent-amber"] ?? accentColor,
              fontSize: TYPOGRAPHY.label.fontSize,
              fontWeight: "600",
              marginTop: 6,
            }}
          >
            {READ_COPY_STALE}
          </Text>
        ) : null}
      </View>


      {!hydrated ? (
        <Material tier="thin" style={{ borderRadius: 20, padding: 24 }}>
          <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.title.fontSize, fontWeight: "700" }}>
            {HYDRATING_TITLE}
          </Text>
          <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.body.fontSize, marginTop: 6 }}>
            {HYDRATING_COPY}
          </Text>
        </Material>
      ) : open ? (
        <SectionFocus def={open} onBack={() => setOpenId(null)}>
          {open.id === "me" ? (
            member ? (
              <MeSection member={member} />
            ) : (
              // Guest Me (web parity, MeSettingsSection.tsx:156-157): the guest
              // holds the family device — sign-in pointer, no profile controls.
              <EmptyState
                icon="👤"
                title="Sign in to manage your profile"
                body="Tap your picture on Home and Consuela knows it's you."
                testID="settings-me-guest"
              />
            )
          ) : open.id === "safety" ? (
            <SafetySection member={member} />
          ) : open.id === "appearance" ? (
            <AppearanceSection />
          ) : open.id === "family" ? (
            <FamilySection member={member} />
          ) : open.id === "home" ? (
            <HomeSection />
          ) : open.id === "system" ? (
            <View style={{ gap: 16 }}>
              <DeferredSection />
              <ServerConnectionSection />
            </View>
          ) : (
            <DeferredSection />
          )}
        </SectionFocus>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16, justifyContent: "space-between" }}>
          {sections.map((s) => (
            <Pressable
              key={s.id}
              testID={`settings-section-${s.id}`}
              accessibilityRole="button"
              accessibilityLabel={`${s.title}: ${s.description}`}
              onPress={() => setOpenId(s.id)}
              style={{ width: "48.8%" }}
            >
              <Material tier="regular" tone={accentColor} style={{ borderRadius: 28, padding: 24, minHeight: 188 }}>
                <Text style={{ fontSize: 36 }}>{s.icon}</Text>
                <Text
                  style={{
                    color: colors["color-text-primary"],
                    fontSize: TYPOGRAPHY.title.fontSize,
                    fontWeight: "700",
                    marginTop: 12,
                  }}
                >
                  {s.title}
                </Text>
                <Text
                  style={{
                    color: colors["color-text-secondary"],
                    fontSize: TYPOGRAPHY.body.fontSize,
                    marginTop: 4,
                  }}
                >
                  {s.description}
                </Text>
                <View pointerEvents="none" style={{ position: "absolute", bottom: 20, right: 24 }}>
                  <Text style={{ color: colors["color-text-muted"], fontSize: 36 }}>›</Text>
                </View>
              </Material>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function SectionFocus({
  def,
  onBack,
  children,
}: {
  def: SectionDef;
  onBack: () => void;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View>
      <SoftButton
        variant="ghost"
        size="sm"
        onPress={onBack}
        testID="settings-back"
        accessibilityLabel="Back to settings"
        style={{ alignSelf: "flex-start" }}
      >
        ‹ Settings
      </SoftButton>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginTop: 12, marginBottom: 24 }}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors["color-surface-1"] ?? colors["color-surface-2"],
          }}
        >
          <Text style={{ fontSize: 44 }}>{def.icon}</Text>
        </View>
        <View style={{ flexShrink: 1 }}>
          <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.stat.fontSize, fontWeight: "700" }}>
            {def.title}
          </Text>
          <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.body.fontSize, marginTop: 2 }}>
            {def.description}
          </Text>
        </View>
      </View>
      {children}
    </View>
  );
}

/** Family / Home / Connections & System: honest deferral, never dead controls. */
function DeferredSection() {
  const { colors } = useTheme();
  return (
    <Material tier="thin" style={{ borderRadius: 24, padding: 24 }}>
      <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.body.fontSize, lineHeight: 26 }}>
        {DEFERRED_COPY}
      </Text>
    </Material>
  );
}

function ServerConnectionSection() {
  const { colors, accentColor } = useTheme();
  const [urlInput, setUrlInput] = useState(() => getBaseUrl());
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const saveAndTest = async (targetUrl?: string) => {
    const next = (targetUrl ?? urlInput).trim();
    if (!next) return;
    setUrlInput(next);
    setTesting(true);
    setStatusMsg(null);
    await setBaseUrl(next);
    try {
      await api("/api/consuela/screensaver", { timeoutMs: 4000 });
      setStatusMsg(`Connected to ${getBaseUrl()}`);
    } catch (e) {
      if (e instanceof ApiError && e.status > 0) {
        setStatusMsg(`Connected to ${getBaseUrl()}`);
      } else {
        setStatusMsg(`Couldn't reach ${getBaseUrl()} — check LAN IP & port.`);
      }
    } finally {
      setTesting(false);
    }
  };

  return (
    <Material tier="regular" style={{ borderRadius: 24, padding: 24, gap: 14 }}>
      <Text
        style={{
          color: colors["color-text-secondary"],
          fontSize: TYPOGRAPHY.label.fontSize,
          fontWeight: "700",
          letterSpacing: 2,
        }}
      >
        FAMILY SERVER URL (LAN)
      </Text>
      <TextInput
        testID="settings-server-url-input"
        value={urlInput}
        onChangeText={setUrlInput}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="http://192.168.0.28:3000"
        placeholderTextColor={colors["color-text-muted"]}
        style={{
          minHeight: 64,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors["color-border"],
          backgroundColor: colors["color-surface-1"],
          paddingHorizontal: 16,
          color: colors["color-text-primary"],
          fontSize: TYPOGRAPHY.body.fontSize,
        }}
      />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {LAN_BASE_URLS.slice(0, 3).map((preset) => (
          <Chip
            key={preset}
            label={preset.replace(/^http:\/\//, "")}
            tone="neutral"
            selected={urlInput === preset}
            onPress={() => void saveAndTest(preset)}
          />
        ))}
      </View>
      <SoftButton
        variant="primary"
        size="md"
        testID="settings-server-url-save"
        disabled={testing}
        onPress={() => void saveAndTest()}
      >
        {testing ? "Testing connection…" : "Save & test connection"}
      </SoftButton>
      {statusMsg ? (
        <Text
          style={{
            color: statusMsg.startsWith("Connected")
              ? colors["color-accent-mint"] ?? accentColor
              : colors["color-accent-amber"] ?? accentColor,
            fontSize: TYPOGRAPHY.label.fontSize,
            fontWeight: "600",
          }}
        >
          {statusMsg}
        </Text>
      ) : null}
    </Material>
  );
}

function MeSection({ member }: { member: ServerMember }) {
  const { colors } = useTheme();
  const { signOut } = useAuth();
  const [pinOpen, setPinOpen] = useState(false);
  const roleLabel =
    typeof member.role === "string" && member.role.length > 0
      ? member.role.charAt(0).toUpperCase() + member.role.slice(1)
      : "Member";
  const hasPhoto = member.emoji ? isPhotoUri(member.emoji) : false;

  return (
    <View>
      <Material tier="regular" style={{ borderRadius: 28, padding: 24 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 20 }}>
          {hasPhoto ? (
            <Image
              source={{ uri: member.emoji }}
              style={{ width: 72, height: 72, borderRadius: 36 }}
              resizeMode="cover"
            />
          ) : (
            <Text style={{ fontSize: 72 }}>{member.emoji || "👤"}</Text>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.title.fontSize, fontWeight: "700" }}>
              {member.name}
            </Text>
            <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.body.fontSize, marginTop: 2 }}>
              {roleLabel}
            </Text>
          </View>
        </View>
        <View style={{ marginTop: 24, gap: 12 }}>
          <SoftButton variant="secondary" size="lg" testID="settings-change-pin" onPress={() => setPinOpen(true)}>
            Change my PIN
          </SoftButton>
          <SoftButton variant="ghost" testID="settings-sign-out" onPress={() => void signOut()}>
            Sign out
          </SoftButton>
        </View>
      </Material>
      <PinChangeDialog member={member} visible={pinOpen} onClose={() => setPinOpen(false)} />
    </View>
  );
}

type PinStage = "current" | "new" | "confirm";

const PIN_STAGE_DESCRIPTIONS: Record<PinStage, string> = {
  current: "First, enter your current PIN.",
  new: "Choose a new 4-digit PIN.",
  confirm: "Enter it once more to be sure.",
};

/**
 * PIN change = three pads (current → new → confirm) then one POST. The pads
 * remount across stages (key=stage) so each entry starts empty. PINs live in
 * component state ONLY — the PIN-memory contract: never storage, never logs,
 * cleared on every close path.
 */
function PinChangeDialog({
  member,
  visible,
  onClose,
}: {
  member: ServerMember;
  visible: boolean;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const [stage, setStage] = useState<PinStage>("current");
  const [actorPin, setActorPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const reset = () => {
    setStage("current");
    setActorPin("");
    setNewPin("");
    setError(null);
    setBusy(false);
    setDone(false);
  };

  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const submit = async (current: string, next: string) => {
    setBusy(true);
    setError(null);
    try {
      await api("/api/members/pin", { method: "POST", body: { actorPin: current, newPin: next } });
      setActorPin("");
      setNewPin("");
      setDone(true);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        // pin_collision: the new PIN belongs to someone else in the family.
        setNewPin("");
        setStage("new");
        setError(PIN_TAKEN_COPY);
      } else if (e instanceof ApiError && e.status === 401) {
        // The current PIN was wrong — the flow starts over honestly.
        setActorPin("");
        setNewPin("");
        setStage("current");
        setError(WRONG_PIN_COPY);
      } else if (e instanceof ApiError && e.status === 0) {
        setActorPin("");
        setNewPin("");
        setStage("current");
        setError(PIN_UNREACHABLE_COPY);
      } else {
        setActorPin("");
        setNewPin("");
        setStage("current");
        setError(PIN_FAILED_COPY);
      }
    } finally {
      setBusy(false);
    }
  };

  const onVerified = (pin: string) => {
    if (busy) return;
    if (stage === "current") {
      setActorPin(pin);
      setError(null);
      setStage("new");
      return;
    }
    if (stage === "new") {
      setNewPin(pin);
      setError(null);
      setStage("confirm");
      return;
    }
    // confirm
    if (pin !== newPin) {
      setNewPin("");
      setStage("new");
      setError(PIN_MISMATCH_COPY);
      return;
    }
    void submit(actorPin, pin);
  };

  return (
    <Modal
      visible={visible}
      onClose={close}
      title="Change my PIN"
      description={done ? undefined : PIN_STAGE_DESCRIPTIONS[stage]}
      dismissable={!busy}
      testID="settings-pin-modal"
    >
      {done ? (
        <View style={{ alignItems: "center", paddingBottom: 8 }}>
          <Text
            style={{
              color: colors["color-text-primary"],
              fontSize: TYPOGRAPHY.title.fontSize,
              fontWeight: "700",
            }}
          >
            PIN changed.
          </Text>
          <Text
            style={{
              color: colors["color-text-secondary"],
              fontSize: TYPOGRAPHY.body.fontSize,
              marginTop: 6,
              textAlign: "center",
            }}
          >
            Use your new PIN the next time the wall asks.
          </Text>
          <SoftButton
            variant="primary"
            size="lg"
            testID="settings-pin-done"
            onPress={close}
            style={{ alignSelf: "stretch", marginTop: 16 }}
          >
            Done
          </SoftButton>
        </View>
      ) : (
        <PinPad
          key={stage}
          testID="settings-pin-pad"
          member={{ name: member.name, emoji: member.emoji || "👤", color: member.color }}
          onVerified={onVerified}
          onCancel={close}
          busy={busy}
          error={error}
        />
      )}
    </Modal>
  );
}

function SafetySection({ member }: { member: ServerMember | null }) {
  const { colors } = useTheme();
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [source, setSource] = useState<ContactsSource>("live");

  // Session-gated read (guests never fire the doomed 401); the server declares
  // the source and "cache" is badged honestly below.
  useEffect(() => {
    if (!member) return;
    let alive = true;
    api<{ contacts?: EmergencyContact[]; contactsSource?: ContactsSource }>("/api/emergency-contacts")
      .then((res) => {
        if (!alive) return;
        if (res?.contactsSource === "live" || res?.contactsSource === "cache") setSource(res.contactsSource);
        if (Array.isArray(res?.contacts)) {
          setContacts(res.contacts);
          setState("ready");
        } else {
          setState("unavailable");
        }
      })
      .catch(() => {
        if (alive) setState("unavailable");
      });
    return () => {
      alive = false;
    };
  }, [member]);

  return (
    <View style={{ gap: 16 }}>
      {!member ? (
        <Material tier="thin" style={{ borderRadius: 20, paddingHorizontal: 20, paddingVertical: 16 }}>
          <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.body.fontSize }}>
            {SAFETY_GUEST_COPY}
          </Text>
        </Material>
      ) : state === "ready" ? (
        contacts.length === 0 ? (
          // Honest empty state — the wall never fabricates contacts.
          <Material tier="thin" style={{ borderRadius: 20, paddingHorizontal: 20, paddingVertical: 24, alignItems: "center" }}>
            <Text style={{ fontSize: 40, marginBottom: 8 }}>📋</Text>
            <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.title.fontSize, fontWeight: "700" }}>
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
              {CONTACTS_EMPTY_COPY}
            </Text>
          </Material>
        ) : (
          <View>
            {source === "cache" ? (
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
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              {contacts.map((c) => (
                <Material
                  key={String(c.id)}
                  tier="thin"
                  testID={`settings-contact-${c.id}`}
                  style={{ borderRadius: 999, paddingHorizontal: 20, paddingVertical: 14 }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    {c.emoji && isPhotoUri(c.emoji) ? (
                      <Image
                        source={{ uri: c.emoji }}
                        style={{ width: 40, height: 40, borderRadius: 20 }}
                        resizeMode="cover"
                      />
                    ) : (
                      <Text style={{ fontSize: 40 }}>{c.emoji || "👤"}</Text>
                    )}
                    <View>
                      <Text
                        style={{
                          color: colors["color-text-primary"],
                          fontSize: TYPOGRAPHY.body.fontSize,
                          fontWeight: "600",
                        }}
                      >
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
        )
      ) : state === "unavailable" ? (
        <Material tier="thin" style={{ borderRadius: 20, paddingHorizontal: 20, paddingVertical: 16 }}>
          <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.body.fontSize }}>
            {CONTACTS_UNAVAILABLE_COPY}
          </Text>
        </Material>
      ) : (
        <Material tier="thin" style={{ borderRadius: 20, paddingHorizontal: 20, paddingVertical: 16 }}>
          <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.body.fontSize }}>
            {CONTACTS_LOADING_COPY}
          </Text>
        </Material>
      )}

      {/* Editing is deferred — the wall reads the family truth and says so. */}
      <Material tier="thin" style={{ borderRadius: 20, paddingHorizontal: 20, paddingVertical: 16 }}>
        <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.body.fontSize }}>{SAFETY_EDIT_COPY}</Text>
      </Material>
    </View>
  );
}

function AppearanceSection() {
  const { colors, theme, boost, accent, setTheme, setBoost, setAccent } = useTheme();
  return (
    <View style={{ gap: 16 }}>
      <Material tier="regular" style={{ borderRadius: 28, padding: 24, gap: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <View style={{ flexShrink: 1 }}>
            <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "600" }}>
              Theme
            </Text>
            <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize, marginTop: 2 }}>
              Light or dark on the wall
            </Text>
          </View>
          <SoftButton
            variant="secondary"
            size="sm"
            testID="settings-theme-toggle"
            accessibilityLabel="Switch theme"
            onPress={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? "Dark 🌙" : "Light ☀️"}
          </SoftButton>
        </View>
        <Toggle
          value={boost}
          onChange={setBoost}
          label="High contrast"
          description="Bolder colors for easier reading"
          testID="settings-boost-toggle"
        />
        <SoftButton
          variant="secondary"
          size="sm"
          testID="settings-test-notification"
          onPress={() => void scheduleLocalReminder("Consuela", "Test reminder from the wall", 5)}
        >
          Send test notification
        </SoftButton>
      </Material>

      <Material tier="regular" style={{ borderRadius: 28, padding: 24 }}>
        <Text
          style={{
            color: colors["color-text-secondary"],
            fontSize: TYPOGRAPHY.label.fontSize,
            fontWeight: "700",
            letterSpacing: 2,
          }}
        >
          ACCENT COLOR
        </Text>
        {/* The kit's showcase pattern: ten ACCENTS chips, live via useTheme. */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14 }}>
          {Object.keys(ACCENTS.dark).map((a) => (
            <Chip
              key={a}
              testID={`settings-accent-${a}`}
              label={a}
              tone="accent"
              selected={accent === a}
              onPress={() => setAccent(a)}
            />
          ))}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
          {Object.keys(ACCENTS.dark).map((a) => (
            <Pressable
              key={`swatch-${a}`}
              testID={`settings-swatch-${a}`}
              onPress={() => setAccent(a)}
              style={{ width: "18%" }}
            >
              <View
                style={{
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: ACCENTS[theme === "light" ? "light" : "dark"][a],
                  borderWidth: accent === a ? 2 : 0,
                  borderColor: colors["color-text-primary"],
                }}
              />
            </Pressable>
          ))}
        </View>
      </Material>
    </View>
  );
}

export default SettingsPage;
