import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { api } from "../../api/client";
import { useTheme } from "../../theme/ThemeProvider";
import { TYPOGRAPHY } from "../../theme/tokens";
import { EmptyState } from "../../ui/EmptyState";
import { ListRow } from "../../ui/ListRow";
import { Chip } from "../../ui/Chip";
import { mixAlpha } from "../../ui/SoftButton";
import { WidgetFrame, HEADER_BAND_H } from "./WidgetFrame";
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
  const { colors, accentColor } = useTheme();

  // Web model (MorningBriefingWidget.tsx:73,136-149): the wall card is
  // COLLAPSED by default — a compact teaser + an expand toggle. The family
  // reads the day at a glance; the badge opens the detail.
  const [expanded, setExpanded] = React.useState(false);
  const [acked, setAcked] = React.useState(false);
  const [ackBusy, setAckBusy] = React.useState(false);

  const { status, data, failure, stale, retry } = useWidgetData(async () => {
    // Body-over-status: ok:false means the read is not truth even on a 200.
    const res = await api<BriefingBody>(`/api/consuela/briefing?scopeDate=${localTodayISO()}`);
    if (!res || res.ok === false) throw new Error("briefing not ok");
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

  const acknowledged = !!briefing?.acknowledged || acked;

  const description = briefing && !acknowledged ? "What Consuela lined up for today" : undefined;

  const showToggle = !!briefing && !acknowledged && (total > 0 || !!note);

  async function handleAck() {
    if (!briefing || ackBusy) return;
    setAckBusy(true);
    try {
      await api("/api/consuela/briefing", { method: "PATCH", body: { id: briefing.id } });
      setAcked(true);
    } catch {
      setAcked(false);
    } finally {
      setAckBusy(false);
    }
  }

  // The count badge (web badge parity).
  //
  // THE BADGE IS THE WEB'S (critic round 4, HIGH 3): a NEUTRAL translucent
  // glass pill — `bg-[--color-surface-0]/20` with a `--color-accent-selected/25`
  // hairline — whose copy is a MUTED ink, never the saturated accent. It used
  // to be accent-blue on both the hairline and the copy, which made it read
  // as a selected pill and left the only saturated blue on the wall's header.
  // Measured on the reference (parent-dark): the pill interior is (50,38,47) —
  // a neutral plum glass, not a blue wash.
  const pill = (
    <Pressable
      testID="briefing-toggle"
      accessibilityRole="button"
      accessibilityLabel={expanded ? "Collapse morning briefing" : "Expand morning briefing"}
      accessibilityState={{ expanded }}
      hitSlop={{ top: 20, bottom: 20, left: 16, right: 16 }}
      onPress={() => setExpanded((v) => !v)}
      style={{
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 5,
        borderRadius: 9999,
        borderWidth: 1,
        borderColor: mixAlpha(accentColor, 0.25),
        backgroundColor: mixAlpha(colors["color-surface-0"] ?? accentColor, 0.2),
        paddingHorizontal: 9,
        paddingVertical: 4,
      }}
    >
      <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
        {total} item{total === 1 ? "" : "s"}
      </Text>
      <Text style={{ color: colors["color-text-secondary"], fontSize: 14 }}>{expanded ? "▲" : "▼"}</Text>
    </Pressable>
  );

  const titleText = (
    <Text
      style={{
        color: colors["color-text-primary"],
        fontSize: 18,
        lineHeight: 26,
        fontWeight: "700",
      }}
      accessibilityRole="header"
    >
      Morning Briefing
    </Text>
  );

  // The header band (critic round 4, HIGH 3).
  //
  // The count badge is IN the title row, not floating over it: the shared
  // band's `headerRight` slot paints the pill at the band's top-right corner
  // ABSOLUTELY, so on the native's wider title face the pill's fill started
  // BEFORE the title's last glyph and painted it (the reference leaves a
  // clear gap between "Morning Briefing" and the pill). In flow, the title
  // stops at the pill's edge and the gap is structural, whatever the face.
  //
  // The band's own geometry is the shared one (paddingTop 6 / paddingBottom 8
  // / minHeight HEADER_BAND_H / the 1px rule), so the rule still lands on the
  // same y as every sibling cell — but the horizontal padding is the WEB's
  // `p-4` (16), not the shared band's 48. The 48 is the identity disc's
  // gutter, and the disc sits at the card's top-LEFT corner while the title
  // and the description are centred — so the gutter only ever cost this card
  // its subtitle: at 48 the description truncated to "What Consuela lined up
  // for tod…" while the reference prints it in full.
  const header = (
    <View
      testID="morningBriefing-header"
      style={{
        paddingTop: 6,
        paddingBottom: 8,
        minHeight: HEADER_BAND_H,
        justifyContent: "flex-start",
        borderBottomWidth: 1,
        borderBottomColor: colors["color-border"],
      }}
    >
      {showToggle ? (
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ flex: 1, alignItems: "flex-end" }}>{titleText}</View>
          {/* The clear gap between the title and the pill (the reference's 7px). */}
          <View style={{ width: 10 }} />
          {pill}
        </View>
      ) : (
        <Text style={{ textAlign: "center" }}>{titleText}</Text>
      )}
      {description ? (
        <Text
          numberOfLines={1}
          style={{
            color: colors["color-text-secondary"],
            fontSize: TYPOGRAPHY.label.fontSize,
            lineHeight: 16,
            marginTop: 2,
            textAlign: "center",
            paddingHorizontal: 16,
          }}
        >
          {description}
        </Text>
      ) : null}
    </View>
  );

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
      header={header}
      showDisc
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
      ) : acknowledged ? (
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
      ) : !expanded ? (
        // Collapsed teaser (web parity) — the badge above opens the plan.
        <View style={{ flex: 1, justifyContent: "center", gap: 6, paddingHorizontal: 4 }}>
          {note ? (
            <Text
              style={{
                color: colors["color-accent-amber"] ?? colors["color-text-secondary"],
                fontSize: TYPOGRAPHY.label.fontSize,
                fontWeight: "600",
                textAlign: "center",
              }}
            >
              {note}
            </Text>
          ) : null}
          <Text
            style={{
              color: colors["color-text-muted"],
              fontSize: TYPOGRAPHY.label.fontSize,
              textAlign: "center",
            }}
          >
            {"Tap the badge above to see today's plan."}
          </Text>
          {!acknowledged && briefing ? (
            <Pressable
              testID="briefing-ack"
              accessibilityRole="button"
              accessibilityLabel="Acknowledge briefing"
              disabled={ackBusy}
              onPress={() => void handleAck()}
              style={{
                marginTop: 6,
                minHeight: 36,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 6,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: accentColor,
                alignSelf: "center",
              }}
            >
              <Text style={{ color: colors["color-text-on-accent"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
                ✓ Got it
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
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
            {!acknowledged && briefing ? (
              <Pressable
                testID="briefing-ack"
                accessibilityRole="button"
                accessibilityLabel="Acknowledge briefing"
                disabled={ackBusy}
                onPress={() => void handleAck()}
                style={{
                  minHeight: 36,
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 6,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: accentColor,
                  alignSelf: "center",
                }}
              >
                <Text style={{ color: colors["color-text-on-accent"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
                  ✓ Got it
                </Text>
              </Pressable>
            ) : null}
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
        </ScrollView>
      )}
    </WidgetFrame>
  );
}

export default BriefingWidget;
