import React, { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { mix } from "../theme/mix";
import { MIN_TARGET_DP, RADII, TYPOGRAPHY } from "../theme/tokens";
import { Modal } from "../ui/Modal";
import { PinPad } from "../ui/PinPad";
import { SoftButton } from "../ui/SoftButton";
import { TextField } from "../ui/TextField";
import { Toggle } from "../ui/Toggle";
import { isPhotoUri } from "../ui/MemberRail";
import {
  ALL_ROUTINE_DAYS,
  ROUTINE_DAY_META,
  ROUTINE_SLOT_META,
  WEEKDAY_ROUTINE_DAYS,
  WEEKEND_ROUTINE_DAYS,
  type FamilyRoutine,
  type RoutineDayCode,
  type RoutineSettings,
  type RoutineSlot,
  type RoutineStep,
} from "./routines-api";
import {
  effectiveDaysOfWeek,
  rawRoutineTargets,
  type RoutineRosterMember,
} from "./routine-rules";

const SLOTS: RoutineSlot[] = ["morning", "afternoon", "evening", "weekend"];
const EMOJI_PRESETS = ["☀️", "🪥", "🎒", "🧹", "🌙", "📚", "🗑️", "🧽", "🐶", "🧺"];
const POINT_PRESETS = [5, 10, 15, 25, 50];

function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

function parseNonNegInt(raw: string, fallback: number, max = 500): number {
  const cleaned = raw.replace(/[^0-9]/g, "");
  if (!cleaned) return fallback;
  const n = Number.parseInt(cleaned, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(max, n));
}

export interface RoutineComposerModalProps {
  open: boolean;
  onClose: () => void;
  editingRoutine: FamilyRoutine | null;
  rosterMembers: RoutineRosterMember[];
  settings: RoutineSettings;
  onSave: (routine: FamilyRoutine) => Promise<void> | void;
  saving?: boolean;
  error?: string | null;
}

export function RoutineComposerModal(props: RoutineComposerModalProps) {
  return (
    <Modal
      visible={props.open}
      onClose={props.onClose}
      title={
        props.editingRoutine
          ? `Edit Routine · ${props.editingRoutine.title}`
          : "Add New Routine"
      }
      description="Configure schedule days, family assignees, completion points, and accountability rules."
      testID="routine-composer-modal"
    >
      {props.open ? (
        <RoutineComposerForm
          key={`${props.editingRoutine?.id ?? "new"}:${props.settings.defaultPoints}`}
          {...props}
        />
      ) : null}
    </Modal>
  );
}

function initialTargetState(editingRoutine: FamilyRoutine | null): {
  mode: "group" | "members";
  group: "All" | "Kids" | "Adults";
  members: string[];
} {
  if (!editingRoutine) {
    return { mode: "group", group: "All", members: [] };
  }
  const raw = rawRoutineTargets(editingRoutine);
  const first = raw[0]?.toLowerCase() ?? "all";
  if (raw.length === 1 && (first === "all" || first === "kids" || first === "adults")) {
    return {
      mode: "group",
      group: first === "kids" ? "Kids" : first === "adults" ? "Adults" : "All",
      members: [],
    };
  }
  return { mode: "members", group: "All", members: raw };
}

function RoutineComposerForm({
  onClose,
  editingRoutine,
  rosterMembers,
  settings,
  onSave,
  saving = false,
  error,
}: RoutineComposerModalProps) {
  const { colors, accentColor } = useTheme();
  const initTarget = initialTargetState(editingRoutine);

  const [title, setTitle] = useState(editingRoutine?.title ?? "");
  const [emoji, setEmoji] = useState(editingRoutine?.emoji || "☀️");
  const [slot, setSlot] = useState<RoutineSlot>(editingRoutine?.slot || "morning");
  const [time, setTime] = useState(editingRoutine?.time || "07:30");
  const [targetMode, setTargetMode] = useState<"group" | "members">(initTarget.mode);
  const [groupTarget, setGroupTarget] = useState<"All" | "Kids" | "Adults">(initTarget.group);
  const [selectedMembers, setSelectedMembers] = useState<string[]>(initTarget.members);
  const [daysOfWeek, setDaysOfWeek] = useState<RoutineDayCode[]>(
    editingRoutine ? effectiveDaysOfWeek(editingRoutine) : [...ALL_ROUTINE_DAYS],
  );
  const [pointsText, setPointsText] = useState(
    String(editingRoutine?.points ?? settings.defaultPoints),
  );
  const [penaltyText, setPenaltyText] = useState(
    editingRoutine?.missedPenalty === undefined ? "" : String(editingRoutine.missedPenalty),
  );
  const [requiresApproval, setRequiresApproval] = useState(
    editingRoutine?.requiresApproval ?? settings.defaultRequiresApproval,
  );
  const [steps, setSteps] = useState<RoutineStep[]>(() =>
    editingRoutine
      ? editingRoutine.steps.length > 0
        ? [...editingRoutine.steps]
        : [{ id: "st-draft-1", title: "Complete checklist", emoji: "✅" }]
      : [
          { id: "st-draft-1", title: "Step 1", emoji: "✨" },
          { id: "st-draft-2", title: "Step 2", emoji: "✅" },
        ],
  );
  const [newStepTitle, setNewStepTitle] = useState("");
  const [newStepEmoji, setNewStepEmoji] = useState("✨");
  const [bulkStepsText, setBulkStepsText] = useState("");

  const nonPetRoster = rosterMembers.filter((m) => m.role !== "pet");

  const toggleDay = (day: RoutineDayCode) => {
    setDaysOfWeek((prev) => {
      if (prev.includes(day)) {
        return prev.length <= 1 ? prev : prev.filter((d) => d !== day);
      }
      return ALL_ROUTINE_DAYS.filter((d) => prev.includes(d) || d === day);
    });
  };

  const toggleMember = (memberName: string) => {
    setTargetMode("members");
    setSelectedMembers((prev) =>
      prev.includes(memberName)
        ? prev.filter((m) => m !== memberName)
        : [...prev, memberName],
    );
  };

  const addDraftStep = () => {
    const clean = newStepTitle.trim();
    if (!clean) return;
    setSteps((prev) => [
      ...prev,
      {
        id: `st-${Date.now()}-${prev.length + 1}`,
        title: clean,
        emoji: newStepEmoji.trim() || "✓",
      },
    ]);
    setNewStepTitle("");
    setNewStepEmoji("✨");
  };

  const submit = () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    const bulkSteps: RoutineStep[] = bulkStepsText
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s, idx) => ({ id: `st-${Date.now()}-${idx + 1}`, title: s, emoji: "✨" }));
    const validSteps = bulkSteps.length > 0 ? bulkSteps : steps.filter((s) => s.title.trim());
    if (validSteps.length === 0) return;

    const points = parseNonNegInt(pointsText, settings.defaultPoints, 500);
    const trimmedPenalty = penaltyText.trim();
    const missedPenalty =
      trimmedPenalty === ""
        ? undefined
        : parseNonNegInt(trimmedPenalty, settings.defaultMissedPenalty, 500);

    let assignee: string = groupTarget;
    let assignees: string[] | undefined;
    if (targetMode === "members" && selectedMembers.length > 0) {
      assignees = selectedMembers;
      assignee = selectedMembers[0];
    }

    const routine: FamilyRoutine = {
      id: editingRoutine?.id || `rt-${Date.now()}`,
      title: cleanTitle,
      emoji: emoji.trim() || ROUTINE_SLOT_META[slot].emoji,
      slot,
      time: time.trim() || ROUTINE_SLOT_META[slot].timeDefault,
      assignee,
      ...(assignees ? { assignees } : {}),
      daysOfWeek: daysOfWeek.length > 0 ? daysOfWeek : [...ALL_ROUTINE_DAYS],
      points,
      ...(missedPenalty !== undefined ? { missedPenalty } : {}),
      requiresApproval,
      active: editingRoutine?.active ?? true,
      ...(editingRoutine?.createdAt ? { createdAt: editingRoutine.createdAt } : {}),
      steps: validSteps,
    };

    void onSave(routine);
  };

  const chipSelectedBg = mix(accentColor, colors["color-surface-2"], 22);
  const errorBg = mix(colors["color-accent-rose"], colors["color-surface-1"], 16);

  return (
    <View style={{ gap: 16 }}>
      {error ? (
        <View
          accessibilityRole="alert"
          style={{
            borderRadius: RADII.md,
            borderWidth: 1,
            borderColor: colors["color-accent-rose"],
            backgroundColor: errorBg,
            padding: 12,
          }}
        >
          <Text
            style={{
              color: colors["color-accent-ink-rose"],
              fontSize: TYPOGRAPHY.label.fontSize,
              fontWeight: "600",
            }}
          >
            {error}
          </Text>
        </View>
      ) : null}

      <TextField
        label="Routine Title"
        value={title}
        onChangeText={setTitle}
        placeholder="e.g., Sunday Trash Run"
        testID="routine-composer-title"
      />

      <View style={{ gap: 8 }}>
        <Text
          style={{
            color: colors["color-text-secondary"],
            fontSize: TYPOGRAPHY.fieldLabel.fontSize,
            fontWeight: "700",
            letterSpacing: 1.2,
            textTransform: "uppercase",
          }}
        >
          Icon
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {EMOJI_PRESETS.map((ic) => {
            const active = emoji === ic;
            return (
              <Pressable
                key={ic}
                accessibilityRole="button"
                accessibilityLabel={`Choose icon ${ic}`}
                accessibilityState={{ selected: active }}
                onPress={() => setEmoji(ic)}
                style={{
                  minWidth: MIN_TARGET_DP,
                  minHeight: MIN_TARGET_DP,
                  borderRadius: RADII.md,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: active ? accentColor : colors["color-border-subtle"],
                  backgroundColor: active ? chipSelectedBg : colors["color-surface-2"],
                }}
              >
                <Text style={{ fontSize: 26 }}>{ic}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <Text
          style={{
            color: colors["color-text-secondary"],
            fontSize: TYPOGRAPHY.fieldLabel.fontSize,
            fontWeight: "700",
            letterSpacing: 1.2,
            textTransform: "uppercase",
          }}
        >
          Time Slot
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {SLOTS.map((s) => {
            const meta = ROUTINE_SLOT_META[s];
            const active = slot === s;
            return (
              <Pressable
                key={s}
                testID={`routine-composer-slot-${s}`}
                accessibilityRole="button"
                accessibilityLabel={`Select ${meta.label}`}
                accessibilityState={{ selected: active }}
                onPress={() => {
                  setSlot(s);
                  if (!editingRoutine) {
                    setTime(meta.timeDefault);
                    if (s === "weekend") setDaysOfWeek([...WEEKEND_ROUTINE_DAYS]);
                  }
                }}
                style={{
                  minHeight: MIN_TARGET_DP,
                  paddingHorizontal: 14,
                  borderRadius: RADII.pill,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  borderWidth: 1,
                  borderColor: active ? accentColor : colors["color-border-subtle"],
                  backgroundColor: active ? chipSelectedBg : colors["color-surface-2"],
                }}
              >
                <Text style={{ fontSize: 18 }}>{meta.emoji}</Text>
                <Text
                  style={{
                    color: colors["color-text-primary"],
                    fontSize: TYPOGRAPHY.label.fontSize,
                    fontWeight: active ? "700" : "600",
                  }}
                >
                  {meta.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <TextField
        label="Target Time"
        value={time}
        onChangeText={setTime}
        placeholder="07:30"
        testID="routine-composer-time"
      />

      <View style={{ gap: 8 }}>
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <Text
            style={{
              color: colors["color-text-secondary"],
              fontSize: TYPOGRAPHY.fieldLabel.fontSize,
              fontWeight: "700",
              letterSpacing: 1.2,
              textTransform: "uppercase",
            }}
          >
            Scheduled Days
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {[
              { label: "Daily", days: [...ALL_ROUTINE_DAYS] },
              { label: "Weekdays", days: [...WEEKDAY_ROUTINE_DAYS] },
              { label: "Weekends", days: [...WEEKEND_ROUTINE_DAYS] },
            ].map((preset) => (
              <Pressable
                key={preset.label}
                accessibilityRole="button"
                accessibilityLabel={`Schedule ${preset.label}`}
                onPress={() => setDaysOfWeek(preset.days)}
                style={{
                  minHeight: MIN_TARGET_DP,
                  paddingHorizontal: 14,
                  borderRadius: RADII.pill,
                  justifyContent: "center",
                  backgroundColor: colors["color-surface-2"],
                  borderWidth: 1,
                  borderColor: colors["color-border-subtle"],
                }}
              >
                <Text
                  style={{
                    color: colors["color-text-primary"],
                    fontSize: TYPOGRAPHY.label.fontSize,
                    fontWeight: "600",
                  }}
                >
                  {preset.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {ALL_ROUTINE_DAYS.map((day) => {
            const active = daysOfWeek.includes(day);
            return (
              <Pressable
                key={day}
                testID={`routine-day-${day}`}
                accessibilityRole="button"
                accessibilityLabel={`Schedule ${ROUTINE_DAY_META[day].label}`}
                accessibilityState={{ selected: active }}
                onPress={() => toggleDay(day)}
                style={{
                  minWidth: MIN_TARGET_DP,
                  minHeight: MIN_TARGET_DP,
                  paddingHorizontal: 12,
                  borderRadius: RADII.md,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: active ? accentColor : colors["color-border-subtle"],
                  backgroundColor: active ? chipSelectedBg : colors["color-surface-2"],
                }}
              >
                <Text
                  style={{
                    color: colors["color-text-primary"],
                    fontSize: TYPOGRAPHY.label.fontSize,
                    fontWeight: active ? "700" : "600",
                  }}
                >
                  {ROUTINE_DAY_META[day].short}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <Text
          style={{
            color: colors["color-text-secondary"],
            fontSize: TYPOGRAPHY.fieldLabel.fontSize,
            fontWeight: "700",
            letterSpacing: 1.2,
            textTransform: "uppercase",
          }}
        >
          Who Is This Routine For?
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {(["All", "Kids", "Adults"] as const).map((group) => {
            const active = targetMode === "group" && groupTarget === group;
            return (
              <Pressable
                key={group}
                testID={`routine-target-group-${group.toLowerCase()}`}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  setTargetMode("group");
                  setGroupTarget(group);
                }}
                style={{
                  minHeight: MIN_TARGET_DP,
                  paddingHorizontal: 16,
                  borderRadius: RADII.pill,
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: active ? accentColor : colors["color-border-subtle"],
                  backgroundColor: active ? chipSelectedBg : colors["color-surface-2"],
                }}
              >
                <Text
                  style={{
                    color: colors["color-text-primary"],
                    fontSize: TYPOGRAPHY.label.fontSize,
                    fontWeight: active ? "700" : "600",
                  }}
                >
                  {group === "All" ? "Everyone" : group}
                </Text>
              </Pressable>
            );
          })}
          {nonPetRoster.length > 0 ? (
            <Pressable
              testID="routine-target-pick-members"
              accessibilityRole="button"
              accessibilityState={{ selected: targetMode === "members" }}
              onPress={() => {
                setTargetMode("members");
              }}
              style={{
                minHeight: MIN_TARGET_DP,
                paddingHorizontal: 16,
                borderRadius: RADII.pill,
                justifyContent: "center",
                borderWidth: 1,
                borderColor:
                  targetMode === "members" ? accentColor : colors["color-border-subtle"],
                backgroundColor:
                  targetMode === "members" ? chipSelectedBg : colors["color-surface-2"],
              }}
            >
              <Text
                style={{
                  color: colors["color-text-primary"],
                  fontSize: TYPOGRAPHY.label.fontSize,
                  fontWeight: targetMode === "members" ? "700" : "600",
                }}
              >
                Pick Individuals
              </Text>
            </Pressable>
          ) : null}
        </View>

        {targetMode === "members" && nonPetRoster.length > 0 ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
            {nonPetRoster.map((m) => {
              const cname = m.fullName || m.name;
              const active = selectedMembers.some(
                (x) => x.toLowerCase() === cname.toLowerCase(),
              );
              const label = firstNameOf(cname);
              return (
                <Pressable
                  key={cname}
                  testID={`routine-target-member-${label.toLowerCase()}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Assign ${cname}`}
                  accessibilityState={{ selected: active }}
                  onPress={() => toggleMember(cname)}
                  style={{
                    minHeight: MIN_TARGET_DP,
                    paddingHorizontal: 14,
                    borderRadius: RADII.pill,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    borderWidth: 1,
                    borderColor: active ? accentColor : colors["color-border-subtle"],
                    backgroundColor: active ? chipSelectedBg : colors["color-surface-2"],
                  }}
                >
                  {isPhotoUri(m.emoji ?? "") ? (
                    <Image
                      source={{ uri: m.emoji ?? "" }}
                      style={{ width: 24, height: 24, borderRadius: 12 }}
                      accessibilityLabel={`${cname} photo`}
                    />
                  ) : (
                    <Text style={{ fontSize: 18 }}>{m.emoji || "👤"}</Text>
                  )}
                  <Text
                    style={{
                      color: colors["color-text-primary"],
                      fontSize: TYPOGRAPHY.label.fontSize,
                      fontWeight: active ? "700" : "600",
                    }}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>

      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {POINT_PRESETS.map((pt) => {
            const active = parseNonNegInt(pointsText, -1) === pt;
            return (
              <Pressable
                key={pt}
                accessibilityRole="button"
                accessibilityLabel={`Set ${pt} points`}
                onPress={() => setPointsText(String(pt))}
                style={{
                  minWidth: MIN_TARGET_DP,
                  minHeight: MIN_TARGET_DP,
                  paddingHorizontal: 12,
                  borderRadius: RADII.md,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: active ? accentColor : colors["color-border-subtle"],
                  backgroundColor: active ? chipSelectedBg : colors["color-surface-2"],
                }}
              >
                <Text
                  style={{
                    color: colors["color-text-primary"],
                    fontSize: TYPOGRAPHY.label.fontSize,
                    fontWeight: active ? "700" : "600",
                  }}
                >
                  +{pt}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <TextField
          label="Completion Points"
          value={pointsText}
          onChangeText={setPointsText}
          keyboardType="number-pad"
          placeholder={String(settings.defaultPoints)}
          testID="routine-composer-points"
        />

        <TextField
          label={`Missed-Day Penalty (blank = default ${settings.defaultMissedPenalty})`}
          value={penaltyText}
          onChangeText={setPenaltyText}
          keyboardType="number-pad"
          placeholder={`Default ${settings.defaultMissedPenalty} (0 = none)`}
          testID="routine-composer-penalty"
        />
      </View>

      <Toggle
        value={requiresApproval}
        onChange={setRequiresApproval}
        label="Require Parent Approval"
        description="Kids submit for parent review before routine points are added to the leaderboard."
        testID="routine-composer-requires-approval"
      />

      <View style={{ gap: 8 }}>
        <Text
          style={{
            color: colors["color-text-secondary"],
            fontSize: TYPOGRAPHY.fieldLabel.fontSize,
            fontWeight: "700",
            letterSpacing: 1.2,
            textTransform: "uppercase",
          }}
        >
          Checklist Steps ({steps.length})
        </Text>
        <View style={{ gap: 8 }}>
          {steps.map((s) => (
            <View
              key={s.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                paddingHorizontal: 12,
                paddingVertical: 8,
                minHeight: MIN_TARGET_DP,
                borderRadius: RADII.md,
                backgroundColor: colors["color-surface-2"],
                borderWidth: 1,
                borderColor: colors["color-border-subtle"],
              }}
            >
              <Text
                style={{
                  flex: 1,
                  color: colors["color-text-primary"],
                  fontSize: TYPOGRAPHY.body.fontSize,
                }}
              >
                {s.emoji} {s.title}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove step ${s.title}`}
                onPress={() =>
                  setSteps((prev) =>
                    prev.length > 1 ? prev.filter((x) => x.id !== s.id) : prev,
                  )
                }
                style={{
                  minWidth: MIN_TARGET_DP,
                  minHeight: MIN_TARGET_DP,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    color: colors["color-accent-ink-rose"],
                    fontSize: TYPOGRAPHY.title.fontSize,
                    fontWeight: "700",
                  }}
                >
                  ✕
                </Text>
              </Pressable>
            </View>
          ))}
        </View>

        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <TextField
              label="Add Checklist Step"
              value={newStepTitle}
              onChangeText={setNewStepTitle}
              placeholder="e.g., Roll trash bins to curb"
              testID="routine-composer-new-step"
            />
          </View>
          <SoftButton
            variant="secondary"
            onPress={addDraftStep}
            testID="routine-composer-add-step"
            style={{ minHeight: MIN_TARGET_DP, minWidth: MIN_TARGET_DP }}
          >
            + Step
          </SoftButton>
        </View>

        <TextField
          label="Quick Steps (comma-separated, optional)"
          value={bulkStepsText}
          onChangeText={setBulkStepsText}
          placeholder="e.g., Tune instrument, Scales, Song practice"
          testID="routine-composer-steps"
        />
      </View>

      <View
        style={{
          flexDirection: "row",
          justifyContent: "flex-end",
          gap: 12,
          marginTop: 8,
        }}
      >
        <SoftButton variant="ghost" onPress={onClose} testID="routine-composer-cancel">
          Cancel
        </SoftButton>
        <SoftButton
          variant="primary"
          loading={saving}
          disabled={
            !title.trim() ||
            (targetMode === "members" && selectedMembers.length === 0) ||
            (bulkStepsText.trim().length === 0 &&
              steps.filter((s) => s.title.trim()).length === 0)
          }
          onPress={submit}
          testID="routine-composer-save"
        >
          {editingRoutine ? "Save Routine" : "Create Routine"}
        </SoftButton>
      </View>
    </View>
  );
}

export interface RoutineSettingsModalProps {
  open: boolean;
  onClose: () => void;
  settings: RoutineSettings;
  onSave: (next: RoutineSettings) => Promise<void> | void;
  saving?: boolean;
  error?: string | null;
}

export function RoutineSettingsModal(props: RoutineSettingsModalProps) {
  return (
    <Modal
      visible={props.open}
      onClose={props.onClose}
      title="Routine Point Rules & Accountability"
      description="Customize default rewards, daily missed-routine penalties, and parent race participation."
      testID="routine-settings-modal"
    >
      {props.open ? (
        <RoutineSettingsForm
          key={`${props.settings.defaultPoints}:${props.settings.defaultMissedPenalty}`}
          {...props}
        />
      ) : null}
    </Modal>
  );
}

function RoutineSettingsForm({
  onClose,
  settings,
  onSave,
  saving = false,
  error,
}: RoutineSettingsModalProps) {
  const { colors } = useTheme();
  const [defaultPointsText, setDefaultPointsText] = useState(
    String(settings.defaultPoints),
  );
  const [defaultPenaltyText, setDefaultPenaltyText] = useState(
    String(settings.defaultMissedPenalty),
  );
  const [streakDaysText, setStreakDaysText] = useState(
    String(settings.streakBonusEveryDays),
  );
  const [streakPointsText, setStreakPointsText] = useState(
    String(settings.streakBonusPoints),
  );
  const [accountabilityEnabled, setAccountabilityEnabled] = useState(
    settings.accountabilityEnabled,
  );
  const [parentCountsTowardRace, setParentCountsTowardRace] = useState(
    settings.parentCountsTowardRace,
  );
  const [defaultRequiresApproval, setDefaultRequiresApproval] = useState(
    settings.defaultRequiresApproval,
  );

  const errorBg = mix(colors["color-accent-rose"], colors["color-surface-1"], 16);

  const handleSave = () => {
    void onSave({
      defaultPoints: parseNonNegInt(defaultPointsText, settings.defaultPoints, 500),
      defaultMissedPenalty: parseNonNegInt(
        defaultPenaltyText,
        settings.defaultMissedPenalty,
        500,
      ),
      accountabilityEnabled,
      parentCountsTowardRace,
      defaultRequiresApproval,
      streakBonusEveryDays: parseNonNegInt(
        streakDaysText,
        settings.streakBonusEveryDays,
        365,
      ),
      streakBonusPoints: parseNonNegInt(
        streakPointsText,
        settings.streakBonusPoints,
        500,
      ),
    });
  };

  return (
    <View style={{ gap: 16 }}>
      {error ? (
        <View
          accessibilityRole="alert"
          style={{
            borderRadius: RADII.md,
            borderWidth: 1,
            borderColor: colors["color-accent-rose"],
            backgroundColor: errorBg,
            padding: 12,
          }}
        >
          <Text
            style={{
              color: colors["color-accent-ink-rose"],
              fontSize: TYPOGRAPHY.label.fontSize,
              fontWeight: "600",
            }}
          >
            {error}
          </Text>
        </View>
      ) : null}

      <TextField
        label="Default Completion Points"
        value={defaultPointsText}
        onChangeText={setDefaultPointsText}
        keyboardType="number-pad"
        testID="routine-settings-default-points"
      />
      <TextField
        label="Default Missed-Day Penalty Points"
        value={defaultPenaltyText}
        onChangeText={setDefaultPenaltyText}
        keyboardType="number-pad"
        testID="routine-settings-default-penalty"
      />
      <TextField
        label="Streak Milestone Every N Days (0 = off)"
        value={streakDaysText}
        onChangeText={setStreakDaysText}
        keyboardType="number-pad"
      />
      <TextField
        label="Streak Milestone Bonus Points"
        value={streakPointsText}
        onChangeText={setStreakPointsText}
        keyboardType="number-pad"
      />

      <Toggle
        value={accountabilityEnabled}
        onChange={setAccountabilityEnabled}
        label="Daily Accountability Check"
        description="Detects missed routines at rollover, resets streaks, and auto-deducts penalty points."
        testID="routine-settings-accountability"
      />
      <Toggle
        value={parentCountsTowardRace}
        onChange={setParentCountsTowardRace}
        label="Parent Points Count in Family Race"
        description="Adults keep their routine loop and streak either way; disable to race kids separately."
        testID="routine-settings-parent-race"
      />
      <Toggle
        value={defaultRequiresApproval}
        onChange={setDefaultRequiresApproval}
        label="Require Parent Approval by Default"
        description="New routines default to holding points until a parent approves."
      />

      <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 8 }}>
        <SoftButton variant="ghost" onPress={onClose}>
          Cancel
        </SoftButton>
        <SoftButton
          variant="primary"
          loading={saving}
          onPress={handleSave}
          testID="routine-settings-save"
        >
          Save Point Rules
        </SoftButton>
      </View>
    </View>
  );
}

export interface RoutineParentPinModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  error?: string | null;
  busy?: boolean;
  onVerified: (pin: string) => void;
}

export function RoutineParentPinModal({
  open,
  onClose,
  title = "Parent PIN Required",
  description = "Enter a parent PIN to authorize this change.",
  error = null,
  busy = false,
  onVerified,
}: RoutineParentPinModalProps) {
  return (
    <Modal
      visible={open}
      onClose={onClose}
      title={title}
      description={description}
      testID="routine-parent-pin-modal"
    >
      {open ? (
        <PinPad
          testID="routine-parent-pinpad"
          member={{ name: "Parent", emoji: "🔐" }}
          onVerified={onVerified}
          onCancel={onClose}
          busy={busy}
          error={error}
        />
      ) : null}
    </Modal>
  );
}
