import React from "react";
import { Text, View } from "react-native";
import { api } from "../../api/client";
import { useTheme } from "../../theme/ThemeProvider";
import { TYPOGRAPHY } from "../../theme/tokens";
import { EmptyState } from "../../ui/EmptyState";
import { ListRow } from "../../ui/ListRow";
import { Chip } from "../../ui/Chip";
import { WidgetFrame } from "./WidgetFrame";
import { localTodayISO, useWidgetData } from "./data";

/** Briefing shape per docs/wave1-endpoints.md: { ok: true, briefing } with
 *  briefing.summary sections (events/tasks/meals/suggestions). Ack (PATCH) is
 *  out of Wave 1 scope — this surface is read-only. */
interface BriefingSummary {
  events?: Record<string, unknown>[];
  tasks?: Record<string, unknown>[];
  meals?: Record<string, unknown>[];
  suggestions?: Record<string, unknown>[];
  taskSource?: string;
}

interface Briefing {
  id: string;
  scopeDate?: string;
  acknowledged?: boolean;
  summary?: BriefingSummary | null;
}

interface BriefingBody {
  ok?: boolean;
  briefing?: Briefing | null;
}

const str = (v: unknown, fallback = ""): string =>
  typeof v === "string" && v ? v : typeof v === "number" ? String(v) : fallback;

/** Port of briefingTaskSourceNote — an unread/backup chore list is admitted. */
function taskSourceNote(briefing: Briefing): string | null {
  const source = briefing.summary?.taskSource;
  if (source === "unavailable") return "❓ Chore list unavailable — Consuela couldn't read it";
  if (source === "pb") return "⚠️ Chores are from a backup copy, not the live list";
  return null;
}

const WALL_ROW_BUDGET = 3;

export function BriefingWidget() {
  const { colors } = useTheme();

  const { status, data, failure, stale, retry } = useWidgetData(async () => {
    // Body-over-status: ok:false means the read is not truth even on a 200.
    const res = await api<BriefingBody>(`/api/consuela/briefing?scopeDate=${localTodayISO()}`);
    if (!res || res.ok === false) throw Object.assign(new Error("briefing not ok"), { status: 502 });
    return res.briefing ?? null;
  });

  const briefing = data;
  const summary = briefing?.summary ?? null;
  const counts = {
    events: summary?.events?.length ?? 0,
    tasks: summary?.tasks?.length ?? 0,
    meals: summary?.meals?.length ?? 0,
    suggestions: summary?.suggestions?.length ?? 0,
  };
  const total = counts.events + counts.tasks + counts.meals + counts.suggestions;
  const note = briefing ? taskSourceNote(briefing) : null;

  const rows: { key: string; icon: string; title: string; meta?: string }[] = briefing
    ? [
        ...(summary?.events ?? []).map((e, i) => ({
          key: `event-${str(e.id, String(i))}`,
          icon: str(e.icon, "📅"),
          title: str(e.title, "Untitled event"),
          meta: str(e.time) || undefined,
        })),
        ...(summary?.tasks ?? []).map((t, i) => ({
          key: `task-${str(t.id, String(i))}`,
          icon: str(t.icon, "✅"),
          title: str(t.title, "Untitled task"),
          meta: str(t.assignee) || undefined,
        })),
        ...(summary?.meals ?? []).map((m, i) => ({
          key: `meal-${str(m.id, String(i))}`,
          icon: str(m.emoji, "🍽️"),
          title: str(m.name, "Untitled meal"),
          meta: [str(m.mealType), str(m.time)].filter(Boolean).join(" · ") || undefined,
        })),
        ...(summary?.suggestions ?? []).map((s, i) => ({
          key: `suggestion-${str(s.id, String(i))}`,
          icon: str(s.emoji, "✨"),
          title: str(s.title, "Suggestion"),
          meta: str(s.body) || undefined,
        })),
      ]
    : [];

  const visible = rows.slice(0, WALL_ROW_BUDGET);
  const hidden = rows.length - visible.length;

  const description = briefing && !briefing.acknowledged ? "What Consuela lined up for today" : undefined;

  return (
    <WidgetFrame
      id="morningBriefing"
      icon="🌅"
      title="Morning Briefing"
      description={description}
      status={status}
      failure={failure}
      hasData={briefing != null}
      stale={stale}
      onRetry={retry}
    >
      {briefing === null ? (
        // A genuinely empty briefing (not a failed read — that renders above).
        <EmptyState
          flat
          icon="🌅"
          title="Nothing lined up for today yet."
          body="Consuela will post the morning briefing here."
          style={{ flex: 1 }}
        />
      ) : briefing.acknowledged ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, textAlign: "center" }}>
            Seen for today — Consuela will refresh it tomorrow
          </Text>
          <Chip as="span" size="sm" tone="success" label="Acknowledged ✓" />
        </View>
      ) : total === 0 && !note ? (
        <EmptyState
          flat
          icon="🌅"
          title="Nothing lined up for today yet."
          body="Consuela will post the morning briefing here."
          style={{ flex: 1 }}
        />
      ) : (
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {note ? (
              <Text
                style={{
                  flex: 1,
                  color: colors["color-accent-amber"] ?? colors["color-text-secondary"],
                  fontSize: TYPOGRAPHY.label.fontSize,
                  fontWeight: "600",
                }}
              >
                {note}
              </Text>
            ) : null}
            <Chip as="span" size="sm" tone="accent" label={`${total} item${total === 1 ? "" : "s"}`} />
          </View>
          {visible.map((row) => (
            <ListRow key={row.key} leading={<Text style={{ fontSize: 20 }}>{row.icon}</Text>} title={row.title} subtitle={row.meta} />
          ))}
          {hidden > 0 ? (
            <Text
              style={{
                color: colors["color-text-secondary"],
                fontSize: TYPOGRAPHY.label.fontSize,
                fontWeight: "600",
                textAlign: "center",
                marginTop: 2,
              }}
            >
              +{hidden} more
            </Text>
          ) : null}
        </View>
      )}
    </WidgetFrame>
  );
}

export default BriefingWidget;
