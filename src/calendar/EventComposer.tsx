import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Modal } from "../ui/Modal";
import { TextField } from "../ui/TextField";
import { SoftButton } from "../ui/SoftButton";
import { Chip } from "../ui/Chip";
import { Toggle } from "../ui/Toggle";
import { Stepper } from "../ui/Stepper";
import { useTheme } from "../theme/ThemeProvider";
import { TYPOGRAPHY } from "../theme/tokens";
import { addDaysISO, parseClockToHHMM, selectedWeekISO } from "./date-utils";

export type EventDraft = {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  member: string;
  location: string;
  notes: string;
  notify: boolean;
};

type Props = {
  visible: boolean;
  defaultDate: string;
  members: string[];
  saving: boolean;
  error: string | null;
  onClose(): void;
  onSave(draft: EventDraft): void;
};

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = Math.min(h * 60 + m + minutes, 23 * 60 + 59);
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

function to12Hour(hhmm: string): { hour: number; minute: number; period: "AM" | "PM" } {
  const [h24, minute] = hhmm.split(":").map(Number);
  return {
    hour: h24 % 12 || 12,
    minute,
    period: h24 >= 12 ? "PM" : "AM",
  };
}

function from12Hour(hour: number, minute: number, period: "AM" | "PM"): string {
  const h24 = (hour % 12) + (period === "PM" ? 12 : 0);
  return `${pad(h24)}:${pad(minute)}`;
}

function TimeStepper({
  label,
  value,
  onChange,
}: {
  label: "Start" | "End";
  value: string;
  onChange(value: string): void;
}) {
  const { colors } = useTheme();
  const { hour, minute, period } = to12Hour(value);
  const set = (nextHour: number, nextMinute: number, nextPeriod: "AM" | "PM") =>
    onChange(from12Hour(nextHour, nextMinute, nextPeriod));
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: colors["color-text-secondary"], ...TYPOGRAPHY.fieldLabel }}>{label}</Text>
      <Stepper
        label={`${label} hour`}
        value={hour}
        min={1}
        max={12}
        onChange={(nextHour) => set(nextHour, minute, period)}
      />
      <Stepper
        label={`${label} minutes`}
        value={minute}
        min={0}
        max={55}
        step={5}
        onChange={(nextMinute) => set(hour, nextMinute, period)}
      />
      <Chip
        label={period}
        onPress={() => set(hour, minute, period === "AM" ? "PM" : "AM")}
        accessibilityLabel={`${label} AM/PM`}
      />
    </View>
  );
}

export function EventComposer({
  visible,
  defaultDate,
  members,
  saving,
  error,
  onClose,
  onSave,
}: Props) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState<EventDraft>(() => ({
    title: "",
    date: defaultDate,
    startTime: "09:00",
    endTime: "10:00",
    allDay: false,
    member: "All",
    location: "",
    notes: "",
    notify: false,
  }));
  const [titleTouched, setTitleTouched] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setDraft({
      title: "",
      date: defaultDate,
      startTime: "09:00",
      endTime: "10:00",
      allDay: false,
      member: "All",
      location: "",
      notes: "",
      notify: false,
    });
    setTitleTouched(false);
  }, [visible, defaultDate]);

  const dateChoices = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDaysISO(selectedWeekISO(defaultDate), i)),
    [defaultDate],
  );

  const start = draft.allDay ? null : parseClockToHHMM(draft.startTime);
  const end = draft.allDay ? null : parseClockToHHMM(draft.endTime);
  const clocksValid = draft.allDay || Boolean(start && end && end > start);
  const canSave = Boolean(draft.title.trim()) && clocksValid;
  const titleError = titleTouched && !draft.title.trim() ? "Add a title." : null;

  const update = (patch: Partial<EventDraft>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch };
      if (!next.allDay) {
        const nextStart = parseClockToHHMM(next.startTime);
        const nextEnd = parseClockToHHMM(next.endTime);
        if (nextStart && (!nextEnd || nextEnd <= nextStart)) {
          next.endTime = addMinutes(nextStart, 60);
        }
      }
      return next;
    });
  };

  const submit = () => {
    if (!canSave) {
      setTitleTouched(true);
      return;
    }
    onSave({
      ...draft,
      title: draft.title.trim(),
      startTime: draft.allDay ? "" : start ?? "",
      endTime: draft.allDay ? "" : end ?? "",
    });
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title="Add event"
      description="Saved to the family calendar first."
      testID="event-composer"
      footer={
        <>
          <SoftButton variant="secondary" onPress={onClose}>Cancel</SoftButton>
          <SoftButton
            testID="composer-save"
            loading={saving}
            disabled={!canSave}
            onPress={submit}
          >
            Add event
          </SoftButton>
        </>
      }
    >
      {error ? (
        <Text
          testID="composer-error"
          accessibilityLiveRegion="assertive"
          style={{ color: colors["color-accent-rose"], marginBottom: 12, fontSize: TYPOGRAPHY.label.fontSize }}
        >
          {error}
        </Text>
      ) : null}
      <TextField
        label="Event title"
        value={draft.title}
        autoFocus
        onChangeText={(title) => {
          setTitleTouched(true);
          update({ title });
        }}
        errorText={titleError}
      />
      <Text style={{ color: colors["color-text-secondary"], marginTop: 12, ...TYPOGRAPHY.fieldLabel }}>
        Date
      </Text>
      <ScrollView horizontal style={{ marginTop: 8 }}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {dateChoices.map((iso) => {
            const day = Number(iso.slice(8, 10));
            const weekday = WEEKDAY_SHORT[new Date(`${iso}T12:00:00`).getDay()];
            return (
              <Chip
                key={iso}
                label={`${weekday} ${day}`}
                selected={draft.date === iso}
                onPress={() => update({ date: iso })}
                accessibilityLabel={`Choose ${iso}`}
              />
            );
          })}
        </View>
      </ScrollView>
      <View style={{ marginTop: 12 }}>
        <Toggle
          label="All day"
          value={draft.allDay}
          onChange={(allDay) => update({ allDay, startTime: allDay ? "" : "09:00", endTime: allDay ? "" : "10:00" })}
        />
      </View>
      {!draft.allDay ? (
        <View style={{ marginTop: 12, gap: 12 }}>
          <TimeStepper label="Start" value={draft.startTime} onChange={(startTime) => update({ startTime })} />
          <TimeStepper label="End" value={draft.endTime} onChange={(endTime) => update({ endTime })} />
        </View>
      ) : null}
      <Text style={{ color: colors["color-text-secondary"], marginTop: 12, ...TYPOGRAPHY.fieldLabel }}>
        Member
      </Text>
      <ScrollView horizontal style={{ marginTop: 8 }}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Chip
            label="All"
            selected={draft.member === "All"}
            onPress={() => update({ member: "All" })}
            accessibilityLabel="Choose all members"
          />
          {members.map((name) => (
            <Chip
              key={name}
              label={name}
              selected={draft.member === name}
              onPress={() => update({ member: name })}
              accessibilityLabel={`Choose ${name}`}
            />
          ))}
        </View>
      </ScrollView>
      <View style={{ marginTop: 12, gap: 12 }}>
        <TextField
          label="Location"
          value={draft.location}
          onChangeText={(location) => update({ location })}
        />
        <TextField
          label="Notes"
          value={draft.notes}
          onChangeText={(notes) => update({ notes })}
          multiline
        />
        <Toggle
          label="Notify the family"
          value={draft.notify}
          onChange={(notify) => update({ notify })}
        />
      </View>
    </Modal>
  );
}

export default EventComposer;
