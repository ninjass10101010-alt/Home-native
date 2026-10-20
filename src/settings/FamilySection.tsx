import React, { useCallback, useEffect, useRef, useState } from "react";
import { Image, Text, TextInput, View } from "react-native";
import { ApiError } from "../api/client";
import { addMember, listMembersLive, updateMember, writeCachedMembers } from "../api/members";
import type { MemberAvatarSize, MemberRole } from "../api/members";
import type { ServerMember } from "../api/types";
import { useTheme } from "../theme/ThemeProvider";
import { Material } from "../theme/Material";
import { TYPOGRAPHY } from "../theme/tokens";
import { Chip } from "../ui/Chip";
import { EmptyState } from "../ui/EmptyState";
import { Modal } from "../ui/Modal";
import { SoftButton } from "../ui/SoftButton";
import { Toggle } from "../ui/Toggle";
import { isPhotoUri } from "../ui/MemberRail";

/**
 * The wall's Family surface: the live roster with honest states — server
 * truth or failure copy, never rail fallbacks/stand-ins. Parent-only;
 * renders nothing for kids/guests and never fires the doomed read for them.
 * Successful reads mirror through writeCachedMembers so the Home sign-in
 * rail cache stays current.
 */

const ROSTER_LOADING_COPY = "Loading the family…";
const ROSTER_UNAVAILABLE_COPY = "Couldn't load the family roster right now.";
const ROSTER_EMPTY_TITLE = "No members yet";
const ROSTER_EMPTY_BODY = "Add the first family member to start organizing.";

// Member editor (add + edit share one dialog — web parity).
const EDITOR_DESCRIPTION = "Family members appear in avatars, tasks, and the Home row.";
const NAME_REQUIRED_COPY = "Enter a name so tasks and avatars know who this is.";
const PIN_FORMAT_COPY = "PIN must be exactly 4 digits — or leave it blank to keep the current PIN.";
const AGE_RANGE_COPY = "Age must be 1–120 (or blank).";
const PIN_HELPER_COPY = "Leave blank to keep the current PIN.";
const AGE_HELPER_COPY = "Under 10 signs in with one tap";
const ADD_INTRO_COPY = "The server assigns their starter PIN after the member is added.";
const STARTER_PIN_ONCE_COPY = "Show this once. Share it securely with the new member.";
const NO_STARTER_PIN_COPY = "Member added, but the server did not return a starter PIN. Try again.";
const ADULTS_ONLY_COPY: Record<"add" | "edit" | "remove", string> = {
  add: "Adults only — sign in as a parent to add members.",
  edit: "Adults only — sign in as a parent to edit members.",
  remove: "Adults only — sign in as a parent to remove members.",
};
const UNREACHABLE_COPY = "Couldn't reach Consuela — check the connection and try again.";
const SAVE_FAILED_COPY = "Couldn't save that change. Try again.";
const MEMBER_CHANGED_COPY = "That member changed on the server — the roster just refreshed.";

const duplicateCopy = (name: string) => `${name} is already on the family list.`;

const EMOJI_OPTIONS = ["😊", "🌸", "🐱", "🐶", "🐉", "🦊", "🐻", "🦉", "🐢", "🦄", "🐝", "🌈", "⚽", "🎸", "🎨", "🚀"];
const ROLE_OPTIONS: { value: MemberRole; label: string }[] = [
  { value: "parent", label: "Parent" },
  { value: "child", label: "Child" },
  { value: "pet", label: "Pet" },
];
// Web AVATAR_SIZE_OPTIONS verbatim — the legacy "base" alias maps to "md"
// and is never offered.
const AVATAR_SIZE_OPTIONS: { value: MemberAvatarSize; label: string }[] = [
  { value: "xs", label: "Tiny" },
  { value: "sm", label: "Small" },
  { value: "md", label: "Medium" },
  { value: "lg", label: "Large" },
];

interface MemberForm {
  name: string;
  emoji: string;
  role: MemberRole;
  age: string;
  avatarSize: MemberAvatarSize;
  glow: boolean;
  pin: string;
}

interface MemberErrors {
  name?: string;
  age?: string;
  pin?: string;
}

const DEFAULT_FORM: MemberForm = { name: "", emoji: "😊", role: "child", age: "", avatarSize: "md", glow: false, pin: "" };

function normalizeRole(role?: string): MemberRole {
  const r = (role ?? "").trim().toLowerCase();
  return r === "parent" || r === "pet" || r === "child" ? r : "child";
}

function selectableAvatarSize(size?: string): MemberAvatarSize {
  const s = (size ?? "").trim().toLowerCase();
  return s === "xs" || s === "sm" || s === "md" || s === "lg" ? s : "md";
}

/** Body-wins-over-status error mapping for add/edit saves. */
function saveErrorCopy(e: unknown, action: "add" | "edit", displayName: string): string {
  if (e instanceof ApiError) {
    if (e.status === 401 || e.status === 403) return ADULTS_ONLY_COPY[action];
    if (e.status === 409) return duplicateCopy(displayName);
    if (e.status === 404) return MEMBER_CHANGED_COPY;
    if (e.status === 0) return UNREACHABLE_COPY;
  }
  return SAVE_FAILED_COPY;
}

/** PB `created` ("2024-05-12 08:00:00.000Z") → "May 2024"; "" when unparsable.
 *  The space→T swap keeps Hermes' ISO-only Date parser happy. */
function formatJoined(created?: string): string {
  if (!created) return "";
  const iso = created.includes(" ") ? created.replace(" ", "T") : created;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function roleLabel(role: string): string {
  return role ? role.charAt(0).toUpperCase() + role.slice(1) : "Member";
}

/** Stable row id — live rows carry pbId (or a string PB id in `id`). */
function memberRowId(m: ServerMember): string {
  return String(m.pbId ?? m.id);
}

type RosterState = "loading" | "ready" | "unavailable";

export function FamilySection({ member }: { member: ServerMember | null }) {
  const { colors } = useTheme();
  const [roster, setRoster] = useState<ServerMember[]>([]);
  const [state, setState] = useState<RosterState>("loading");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ServerMember | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadRoster = useCallback(async () => {
    setState("loading");
    try {
      const live = await listMembersLive();
      const cleaned = live.filter((m) => (m.name || "").trim());
      await writeCachedMembers(cleaned);
      setRoster(cleaned);
      setState("ready");
    } catch {
      setState("unavailable");
    }
  }, []);

  const onSaved = useCallback(
    async (message: string | null) => {
      await loadRoster();
      if (message) setFeedback(message);
    },
    [loadRoster]
  );

  // Session-gated read: kids/guests never mount this section's fetch.
  useEffect(() => {
    if (member && member.role === "parent") void loadRoster();
  }, [member, loadRoster]);

  if (!member || member.role !== "parent") return null;

  return (
    <View style={{ gap: 16 }} testID="family-section">
      {feedback ? (
        <Text
          testID="family-feedback"
          style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.body.fontSize }}
        >
          {feedback}
        </Text>
      ) : null}
      {state === "loading" ? (
        <Material tier="thin" style={{ borderRadius: 20, paddingHorizontal: 20, paddingVertical: 16 }}>
          <Text
            testID="family-roster-loading"
            style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.body.fontSize }}
          >
            {ROSTER_LOADING_COPY}
          </Text>
        </Material>
      ) : state === "unavailable" ? (
        <Material tier="thin" style={{ borderRadius: 20, padding: 24, gap: 12 }}>
          <Text
            testID="family-roster-unavailable"
            style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.body.fontSize }}
          >
            {ROSTER_UNAVAILABLE_COPY}
          </Text>
          <SoftButton
            variant="secondary"
            size="sm"
            testID="family-roster-retry"
            onPress={() => void loadRoster()}
            style={{ alignSelf: "flex-start" }}
          >
            Retry
          </SoftButton>
        </Material>
      ) : roster.length === 0 ? (
        <EmptyState
          icon="👨‍👩‍👧‍👦"
          title={ROSTER_EMPTY_TITLE}
          body={ROSTER_EMPTY_BODY}
          testID="family-roster-empty"
        />
      ) : (
        <View style={{ gap: 12 }}>
          {roster.map((m) => {
            const mid = memberRowId(m);
            const joined = formatJoined(m.created);
            const photo = m.emoji ? isPhotoUri(m.emoji) : false;
            return (
              <Material
                key={mid}
                tier="regular"
                testID={`family-member-${mid}`}
                style={{ borderRadius: 24, padding: 20 }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
                  {photo ? (
                    <Image
                      source={{ uri: m.emoji }}
                      style={{ width: 64, height: 64, borderRadius: 32 }}
                      resizeMode="cover"
                      accessibilityLabel={`${m.name}'s photo`}
                    />
                  ) : (
                    <Text style={{ fontSize: 56 }}>{m.emoji || "👤"}</Text>
                  )}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.title.fontSize, fontWeight: "700" }}
                    >
                      {m.name}
                    </Text>
                    <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.body.fontSize, marginTop: 2 }}>
                      {joined ? `${roleLabel(m.role)} · ${joined}` : roleLabel(m.role)}
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                  <SoftButton
                    variant="secondary"
                    size="sm"
                    testID={`family-edit-${mid}`}
                    accessibilityLabel={`Edit ${m.name}`}
                    onPress={() => {
                      setEditing(m);
                      setEditorOpen(true);
                    }}
                    style={{ flex: 1 }}
                  >
                    ✎ Edit
                  </SoftButton>
                </View>
              </Material>
            );
          })}
        </View>
      )}
      <View style={{ flexDirection: "row", gap: 12 }}>
        <SoftButton
          variant="primary"
          size="md"
          testID="family-add-member"
          onPress={() => {
            setEditing(null);
            setEditorOpen(true);
          }}
          style={{ flex: 1 }}
        >
          Add member
        </SoftButton>
        <SoftButton
          variant="secondary"
          size="md"
          testID="family-roster-refresh"
          onPress={() => void loadRoster()}
          style={{ flex: 1 }}
        >
          Refresh
        </SoftButton>
      </View>
      <MemberEditorDialog
        visible={editorOpen}
        editing={editing}
        onClose={() => setEditorOpen(false)}
        onSaved={onSaved}
      />
    </View>
  );
}

export default FamilySection;

function MemberEditorDialog({
  visible,
  editing,
  onClose,
  onSaved,
}: {
  visible: boolean;
  editing: ServerMember | null;
  onClose: () => void;
  /** Refresh the roster behind the dialog; a message sets the inline feedback line. */
  onSaved: (message: string | null) => void | Promise<void>;
}) {
  const { colors } = useTheme();
  const [form, setForm] = useState<MemberForm>(DEFAULT_FORM);
  const [errors, setErrors] = useState<MemberErrors>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [starterPin, setStarterPin] = useState<{ name: string; pin: string } | null>(null);
  const [emojiTouched, setEmojiTouched] = useState(false);
  const sessionRef = useRef(0);

  useEffect(() => {
    if (!visible) return;
    sessionRef.current += 1;
    setStarterPin(null);
    setError(null);
    setErrors({});
    setEmojiTouched(false);
    setForm(
      editing
        ? {
            name: editing.name,
            emoji: editing.emoji && !isPhotoUri(editing.emoji) ? editing.emoji : "😊",
            role: normalizeRole(editing.role),
            age: editing.age !== undefined && editing.age !== null ? String(editing.age) : "",
            avatarSize: selectableAvatarSize(editing.avatarSize),
            glow: Boolean(editing.glow),
            pin: "",
          }
        : { ...DEFAULT_FORM }
    );
  }, [visible, editing]);

  /** Keep the member's photo unless an emoji chip was picked. */
  const keepPhoto = () => Boolean(editing && !emojiTouched && editing.emoji && isPhotoUri(editing.emoji));

  const clearFormState = () => {
    // PIN-memory contract: every close path wipes the form and the starter PIN.
    setForm({ ...DEFAULT_FORM });
    setStarterPin(null);
    setError(null);
    setErrors({});
  };

  const close = () => {
    if (busy) return;
    clearFormState();
    onClose();
  };

  const hardClose = () => {
    clearFormState();
    onClose();
  };

  const validate = () => {
    const next: MemberErrors = {};
    if (!form.name.trim()) next.name = NAME_REQUIRED_COPY;
    if (form.pin && !/^\d{4}$/.test(form.pin)) next.pin = PIN_FORMAT_COPY;
    if (form.age !== "" && (!/^\d{1,3}$/.test(form.age) || Number(form.age) < 1 || Number(form.age) > 120)) {
      next.age = AGE_RANGE_COPY;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const save = async () => {
    if (busy || !validate()) return;
    setBusy(true);
    setError(null);
    const session = sessionRef.current;
    const trimmedName = form.name.trim();
    try {
      if (editing) {
        await updateMember({
          id: memberRowId(editing),
          name: editing.name,
          patch: {
            name: trimmedName,
            emoji: keepPhoto() ? editing.emoji : form.emoji,
            role: form.role,
            age: form.age === "" ? undefined : Number(form.age),
            avatarSize: form.avatarSize,
            glow: form.glow,
            ...(form.pin ? { pin: form.pin } : {}),
          },
        });
        if (sessionRef.current !== session) return;
        await onSaved(`Updated ${trimmedName}.`);
        if (sessionRef.current !== session) return;
        hardClose();
      } else {
        const res = await addMember({
          name: trimmedName,
          emoji: form.emoji,
          role: form.role,
          age: form.age === "" ? undefined : Number(form.age),
          avatarSize: form.avatarSize,
          glow: form.glow,
        });
        if (sessionRef.current !== session) return;
        const returned = typeof res?.starterPin === "string" ? res.starterPin : "";
        if (!/^\d{4}$/.test(returned)) {
          // The member exists server-side; the roster refreshes behind the
          // dialog, but the PIN never displayed — say exactly that.
          await onSaved(null);
          if (sessionRef.current !== session) return;
          setError(NO_STARTER_PIN_COPY);
          return;
        }
        setStarterPin({ name: trimmedName, pin: returned });
        setForm({ ...DEFAULT_FORM });
        setErrors({});
        await onSaved(`Added ${trimmedName}.`);
      }
    } catch (e) {
      if (sessionRef.current !== session) return;
      setError(saveErrorCopy(e, editing ? "edit" : "add", trimmedName));
    } finally {
      if (sessionRef.current === session) setBusy(false);
    }
  };

  const fieldStyle = {
    minHeight: 64,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors["color-border"],
    backgroundColor: colors["color-surface-1"],
    paddingHorizontal: 16,
    color: colors["color-text-primary"],
    fontSize: TYPOGRAPHY.body.fontSize,
  };

  const labelStyle = {
    color: colors["color-text-secondary"],
    fontSize: TYPOGRAPHY.label.fontSize,
    fontWeight: "700",
    letterSpacing: 2,
  };

  const errorStyle = {
    color: colors["color-accent-rose"] ?? colors["color-text-primary"],
    fontSize: TYPOGRAPHY.label.fontSize,
  };

  return (
    <Modal
      visible={visible}
      onClose={close}
      title={editing ? "Edit member" : "Add member"}
      description={EDITOR_DESCRIPTION}
      dismissable={!busy}
      testID="family-editor-modal"
      footer={
        starterPin ? (
          <SoftButton variant="primary" size="lg" testID="family-starter-pin-done" onPress={hardClose} style={{ flex: 1 }}>
            Done
          </SoftButton>
        ) : (
          <>
            <SoftButton
              variant="primary"
              size="lg"
              testID="family-editor-save"
              loading={busy}
              onPress={() => void save()}
              style={{ flex: 1 }}
            >
              Save
            </SoftButton>
            <SoftButton
              variant="secondary"
              size="lg"
              testID="family-editor-cancel"
              disabled={busy}
              onPress={close}
              style={{ flex: 1 }}
            >
              Cancel
            </SoftButton>
          </>
        )
      }
    >
      {error ? (
        <Text
          accessibilityRole="alert"
          testID="family-editor-error"
          style={{ ...errorStyle, marginBottom: 12 }}
        >
          {error}
        </Text>
      ) : null}
      {starterPin ? (
        <View style={{ alignItems: "center", gap: 10, paddingVertical: 16 }} testID="family-starter-pin-panel">
          <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.title.fontSize, fontWeight: "700" }}>
            Starter PIN for {starterPin.name}
          </Text>
          <Text
            testID="family-starter-pin"
            style={{ color: colors["color-accent-mint"] ?? colors["color-text-primary"], fontSize: 48, fontWeight: "700", letterSpacing: 8 }}
          >
            {starterPin.pin}
          </Text>
          <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.body.fontSize, textAlign: "center" }}>
            {STARTER_PIN_ONCE_COPY}
          </Text>
        </View>
      ) : (
        <View style={{ gap: 16 }}>
          {/* Name */}
          <View style={{ gap: 6 }}>
            <Text style={labelStyle}>NAME</Text>
            <TextInput
              testID="family-field-name"
              value={form.name}
              onChangeText={(v) => {
                setForm((f) => ({ ...f, name: v }));
                setErrors((e) => ({ ...e, name: undefined }));
              }}
              placeholder="Member name"
              placeholderTextColor={colors["color-text-muted"]}
              style={fieldStyle}
            />
            {errors.name ? (
              <Text accessibilityRole="alert" style={errorStyle}>
                {errors.name}
              </Text>
            ) : null}
          </View>

          {/* Avatar (emoji-only this wave; a photo member keeps their photo until a chip is picked) */}
          <View style={{ gap: 10 }}>
            <Text style={labelStyle}>AVATAR</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
              <View
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: 44,
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  backgroundColor: colors["color-surface-1"],
                }}
              >
                {keepPhoto() && editing ? (
                  <Image
                    source={{ uri: editing.emoji }}
                    style={{ width: 88, height: 88, borderRadius: 44 }}
                    resizeMode="cover"
                    accessibilityLabel={`${editing.name}'s photo`}
                  />
                ) : (
                  <Text style={{ fontSize: 56 }}>{form.emoji}</Text>
                )}
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, flex: 1 }}>
                {EMOJI_OPTIONS.map((e) => (
                  <Chip
                    key={e}
                    label={e}
                    tone="neutral"
                    selected={!keepPhoto() && form.emoji === e}
                    onPress={() => {
                      setForm((f) => ({ ...f, emoji: e }));
                      setEmojiTouched(true);
                    }}
                    testID={`family-emoji-${e}`}
                  />
                ))}
              </View>
            </View>
          </View>

          {/* Role */}
          <View style={{ gap: 10 }}>
            <Text style={labelStyle}>ROLE</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {ROLE_OPTIONS.map((r) => (
                <Chip
                  key={r.value}
                  label={r.label}
                  tone="neutral"
                  selected={form.role === r.value}
                  onPress={() => setForm((f) => ({ ...f, role: r.value }))}
                  testID={`family-role-${r.value}`}
                />
              ))}
            </View>
          </View>

          {/* Age */}
          <View style={{ gap: 6 }}>
            <Text style={labelStyle}>AGE</Text>
            <TextInput
              testID="family-field-age"
              value={form.age}
              onChangeText={(v) => {
                setForm((f) => ({ ...f, age: v.replace(/[^0-9]/g, "").slice(0, 3) }));
                setErrors((e) => ({ ...e, age: undefined }));
              }}
              keyboardType="number-pad"
              placeholder="Age"
              placeholderTextColor={colors["color-text-muted"]}
              style={fieldStyle}
            />
            <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize }}>{AGE_HELPER_COPY}</Text>
            {errors.age ? (
              <Text accessibilityRole="alert" style={errorStyle}>
                {errors.age}
              </Text>
            ) : null}
          </View>

          {/* PIN (edit only) — memory-only state, cleared on every close path */}
          {editing ? (
            <View style={{ gap: 6 }}>
              <Text style={labelStyle}>PIN</Text>
              <TextInput
                testID="family-field-pin"
                value={form.pin}
                onChangeText={(v) => {
                  setForm((f) => ({ ...f, pin: v.replace(/[^0-9]/g, "").slice(0, 4) }));
                  setErrors((e) => ({ ...e, pin: undefined }));
                }}
                secureTextEntry
                keyboardType="number-pad"
                maxLength={4}
                placeholder="0000"
                placeholderTextColor={colors["color-text-muted"]}
                style={[fieldStyle, { textAlign: "center", fontSize: TYPOGRAPHY.title.fontSize, letterSpacing: 8 }]}
              />
              <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize }}>{PIN_HELPER_COPY}</Text>
              {errors.pin ? (
                <Text accessibilityRole="alert" style={errorStyle}>
                  {errors.pin}
                </Text>
              ) : null}
            </View>
          ) : (
            <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize }}>{ADD_INTRO_COPY}</Text>
          )}

          {/* Avatar size */}
          <View style={{ gap: 10 }}>
            <Text style={labelStyle}>AVATAR SIZE</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {AVATAR_SIZE_OPTIONS.map((s) => (
                <Chip
                  key={s.value}
                  label={s.label}
                  tone="neutral"
                  selected={form.avatarSize === s.value}
                  onPress={() => setForm((f) => ({ ...f, avatarSize: s.value }))}
                  testID={`family-size-${s.value}`}
                />
              ))}
            </View>
          </View>

          {/* Glow */}
          <Toggle
            value={form.glow}
            onChange={(v) => setForm((f) => ({ ...f, glow: v }))}
            label="Glow"
            testID="family-field-glow"
          />
        </View>
      )}
    </Modal>
  );
}
