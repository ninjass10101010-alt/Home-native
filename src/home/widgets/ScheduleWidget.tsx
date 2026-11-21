import React, { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { api } from "../../api/client";
import type { DbListEnvelope } from "../../api/types";
import { useTheme } from "../../theme/ThemeProvider";
import { hapticTap } from "../../theme/haptics";
import { TYPOGRAPHY, RADII } from "../../theme/tokens";
import { mix } from "../../theme/mix";
import { WidgetFrame } from "./WidgetFrame";
import { useWidgetData } from "./data";
import { DayLine, type DayLineMarker } from "./DayLine";
import { EmptyState } from "../../ui/EmptyState";
import {
  type MealPlanEntryRow,
  type ScheduleRow,
  SCHEDULE_RAIL_TOKENS,
  schedulesForDay,
} from "../../calendar/events-merge";
import { postActiveNotification } from "../../native/notificationFeed";
import { playNotificationAudio } from "../../native/voiceCallouts";
import {
  getEffectiveNotificationVolume,
  loadNotificationPreferences,
} from "../../native/notificationPrefs";
import type { WallShape, WallSpan } from "../widgets";

export interface ScheduleWidgetProps {
  span?: WallSpan;
  shape?: WallShape;
  now?: Date;
}

interface ScheduleData {
  schedules: ScheduleRow[];
  meals: MealPlanEntryRow[] | null;
}

export function ScheduleWidget({ span = 1, shape, now: injectedNow }: ScheduleWidgetProps) {
  const { colors, theme, accentColor } = useTheme();
  const cyan = colors["color-accent-cyan"] ?? accentColor;
  const cyanInk = colors["color-accent-ink-cyan"] ?? cyan;
  const router = useRouter();
  const isWide = shape === "2x1";
  const openCalendar = React.useCallback(() => router.push("/calendar" as never), [router]);

  const { status, data, failure, stale, retry } = useWidgetData<ScheduleData>(
    async () => {
      const [res, mealsRes] = await Promise.all([
        api<DbListEnvelope<ScheduleRow>>("/api/db/schedules"),
        api<DbListEnvelope<MealPlanEntryRow>>("/api/db/meal_plan_entries").catch(() => null),
      ]);
      return {
        schedules: Array.isArray(res?.items) ? res.items : [],
        meals: Array.isArray(mealsRes?.items) ? mealsRes.items : null,
      };
    },
    { guestVisible: true, cacheKey: "scheduleWidget" }
  );

  const [clock, setClock] = React.useState(() => new Date());
  React.useEffect(() => {
    if (injectedNow) return;
    const id = setInterval(() => setClock(new Date()), 30_000);
    return () => clearInterval(id);
  }, [injectedNow]);

  const now = injectedNow ?? clock;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const { todayRoutines, upcomingRoutines, markers } = useMemo(() => {
    const all = data?.schedules ?? [];
    const dayRows = schedulesForDay(all, now, data?.meals);

    const upcoming = dayRows.filter((r) => r.sortMinutes >= nowMinutes);
    const sortedUpcoming = [...upcoming].sort((a, b) => a.sortMinutes - b.sortMinutes);

    const mList: DayLineMarker[] = dayRows
      .filter((r) => r.sortMinutes >= 0 && r.sortMinutes <= 1440)
      .map((r) => {
        const raw = all.find((s) => `s_${String(s.id)}` === r.id);
        const tokenKey = raw?.color ? SCHEDULE_RAIL_TOKENS[raw.color.toLowerCase()] : null;
        const col = (tokenKey && colors[tokenKey]) || cyan || accentColor;
        return {
          position: (r.sortMinutes / 1440) * 100,
          color: col,
        };
      });

    return {
      todayRoutines: dayRows,
      upcomingRoutines: sortedUpcoming,
      markers: mList,
    };
  }, [data, now, nowMinutes, colors, cyan, accentColor]);

  const maxVisible = span === 2 ? 6 : 2;
  const visibleRoutines = upcomingRoutines.slice(0, maxVisible);
  const remainingCount = upcomingRoutines.length - visibleRoutines.length;

  const countLabel =
    status === "ready" || data
      ? `${upcomingRoutines.length} upcoming`
      : "";

  const handleAnnounceSchedule = () => {
    const nextRoutines = upcomingRoutines.slice(0, 3);
    const bodyText =
      nextRoutines.length > 0
        ? nextRoutines.map((r) => `${r.time || "Today"}: ${r.title}`).join(" • ")
        : "All routines completed for today!";

    postActiveNotification({
      id: `sched-announce-${Date.now()}`,
      category: "routines",
      title: `📅 Today's Schedule (${upcomingRoutines.length} upcoming)`,
      body: bodyText,
      timing: "start",
      timestamp: Date.now(),
    });

    void (async () => {
      let vol = 0.8;
      try {
        const prefs = await loadNotificationPreferences();
        const eff = getEffectiveNotificationVolume(
          prefs.routines.volume ?? 0.8,
          new Date(),
          prefs.gentleHours
        );
        vol = eff.volume;
      } catch {
        // fallback
      }

      void playNotificationAudio({
        sound: "chime",
        volume: vol,
        soundMode: "tone_and_voice",
        category: "routines",
        title: "Daily Schedule",
        body: "Today's daily schedule summary",
      });
    })();
  };

  return (
    <WidgetFrame
      id="schedule"
      guestVisible
      icon="🕐"
      title="Daily Schedule"
      description={countLabel}
      onHeaderPress={openCalendar}
      headerPressLabel="Open calendar"
      showHeaderChevron
      status={status}
      failure={failure}
      hasData={Boolean(data)}
      stale={stale}
      onRetry={retry}
      headerRight={
        upcomingRoutines.length > 0 ? (
          <Pressable
            testID="schedule-announce-btn"
            onPress={handleAnnounceSchedule}
            accessibilityRole="button"
            accessibilityLabel="Announce daily schedule out loud"
            hitSlop={{ top: 14, bottom: 14, left: 12, right: 12 }}
            style={({ pressed }) => ({
              minHeight: 36,
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: RADII.full,
              backgroundColor: pressed ? mix(cyan, "transparent", 28) : mix(cyan, "transparent", 16),
              borderWidth: 1,
              borderColor: mix(cyan, "transparent", 36),
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
            })}
          >
            <Text style={{ fontSize: 14 }}>🔊</Text>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "700",
                color: cyanInk,
                letterSpacing: 0.3,
              }}
            >
              Speak
            </Text>
          </Pressable>
        ) : null
      }
    >
      <View testID="schedule-widget" style={{ flex: 1 }}>
        {/* The household clock DayLine */}
        <View style={{ marginBottom: isWide ? 8 : 10 }}>
          <DayLine tone={cyan} markers={markers} marginBottom={0} />
        </View>

        {/* Content Rows or Empty State */}
        {todayRoutines.length === 0 ? (
          <Pressable
            testID="schedule-empty-open"
            accessibilityRole="button"
            accessibilityLabel="No routines — open calendar"
            onPress={() => {
              hapticTap();
              openCalendar();
            }}
            style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.78 : 1 })}
          >
            <EmptyState
              flat
              icon="🕐"
              title="No routines"
              body="No routines are scheduled for today."
              style={{ flex: 1 }}
            />
          </Pressable>
        ) : upcomingRoutines.length === 0 ? (
          <View style={{ flex: 1, justifyContent: "center" }}>
            <EmptyState
              flat
              icon="🎉"
              title="All done"
              body="All routines completed for today."
              style={{ flex: 1 }}
            />
            <Pressable
              onPress={() => router.push("/calendar")}
              accessibilityRole="button"
              accessibilityLabel="View today's schedule in calendar"
              style={({ pressed }) => ({
                paddingTop: 4,
                alignItems: "center",
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text
                style={{
                  fontSize: TYPOGRAPHY.label.fontSize,
                  fontWeight: "600",
                  color: cyanInk,
                }}
              >
                {"See today's schedule →"}
              </Text>
            </Pressable>
          </View>
        ) : isWide ? (
          <View style={{ flex: 1, gap: 6 }}>
            {[0, 2, 4].map((startIdx) => {
              const pair = visibleRoutines.slice(startIdx, startIdx + 2);
              if (!pair.length) return null;
              return (
                <View key={`sched-row-${startIdx}`} style={{ flexDirection: "row", gap: 10 }}>
                  {pair.map((routine) => {
                    const raw = data?.schedules.find((s) => `s_${String(s.id)}` === routine.id);
                    const tokenKey = raw?.color ? SCHEDULE_RAIL_TOKENS[raw.color.toLowerCase()] : null;
                    const col = (tokenKey && colors[tokenKey]) || cyan;
                    const firstName = routine.member ? routine.member.split(" ")[0] : null;
                    return (
                      <Pressable
                        key={routine.id}
                        testID={`schedule-row-${routine.id}`}
                        accessibilityRole="button"
                        accessibilityLabel={`${routine.time || "All day"} ${routine.title}. Open calendar`}
                        onPress={() => {
                          hapticTap();
                          openCalendar();
                        }}
                        style={({ pressed }) => ({
                          flex: 1,
                          minWidth: 0,
                          flexDirection: "row",
                          alignItems: "center",
                          backgroundColor: mix(col, colors["color-surface-0"], theme === "dark" ? 18 : 14),
                          borderColor: mix(col, "transparent", theme === "dark" ? 32 : 24),
                          borderWidth: 1,
                          borderRadius: RADII.lg,
                          paddingHorizontal: 9,
                          paddingVertical: 7,
                          gap: 6,
                          opacity: pressed ? 0.78 : 1,
                        })}
                      >
                        <View
                          style={{
                            width: 3,
                            height: 22,
                            borderRadius: RADII.sm,
                            backgroundColor: col,
                          }}
                        />
                        <Text
                          style={{
                            fontSize: TYPOGRAPHY.label.fontSize,
                            lineHeight: TYPOGRAPHY.label.lineHeight,
                            fontFamily: "SpaceGrotesk-Medium",
                            fontVariant: ["tabular-nums"],
                            color: colors["color-text-secondary"],
                            width: 58,
                          }}
                          numberOfLines={1}
                        >
                          {routine.time || "All day"}
                        </Text>
                        <Text style={{ fontSize: 16 }}>{routine.icon || "⏰"}</Text>
                        <Text
                          numberOfLines={1}
                          style={{
                            flex: 1,
                            fontSize: TYPOGRAPHY.label.fontSize,
                            lineHeight: TYPOGRAPHY.label.lineHeight,
                            color: colors["color-text-primary"],
                            fontWeight: "600",
                          }}
                        >
                          {routine.title}
                        </Text>
                        {firstName ? (
                          <View
                            style={{
                              backgroundColor: mix(col, colors["color-surface-2"], 28),
                              paddingHorizontal: 7,
                              paddingVertical: 2,
                              borderRadius: RADII.pill,
                              flexShrink: 0,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: TYPOGRAPHY.label.fontSize,
                                fontWeight: "600",
                                color: colors["color-text-primary"],
                              }}
                            >
                              {firstName}
                            </Text>
                          </View>
                        ) : null}
                      </Pressable>
                    );
                  })}
                  {pair.length === 1 ? <View style={{ flex: 1 }} /> : null}
                </View>
              );
            })}
          </View>
        ) : (
          <View style={{ flex: 1, gap: 6 }}>
            {visibleRoutines.map((routine) => {
              const raw = data?.schedules.find((s) => `s_${String(s.id)}` === routine.id);
              const tokenKey = raw?.color ? SCHEDULE_RAIL_TOKENS[raw.color.toLowerCase()] : null;
              const col = (tokenKey && colors[tokenKey]) || cyan;
              const firstName = routine.member ? routine.member.split(" ")[0] : null;

              return (
                <Pressable
                  key={routine.id}
                  testID={`schedule-row-${routine.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${routine.time || "All day"} ${routine.title}. Open calendar`}
                  onPress={() => {
                    hapticTap();
                    openCalendar();
                  }}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: mix(col, colors["color-surface-1"], 14),
                    borderColor: mix(col, "transparent", 28),
                    borderWidth: 1,
                    borderRadius: RADII.lg,
                    paddingHorizontal: 10,
                    paddingVertical: 7,
                    gap: 8,
                    opacity: pressed ? 0.78 : 1,
                  })}
                >
                  {/* Glowing left accent bar */}
                  <View
                    style={{
                      width: 3,
                      height: 22,
                      borderRadius: RADII.sm,
                      backgroundColor: col,
                    }}
                  />

                  {/* 12-hour formatted time */}
                  <Text
                    style={{
                      fontSize: TYPOGRAPHY.label.fontSize,
                      lineHeight: TYPOGRAPHY.label.lineHeight,
                      fontFamily: "SpaceGrotesk-Medium",
                      fontVariant: ["tabular-nums"],
                      color: colors["color-text-primary"],
                      width: 66,
                    }}
                    numberOfLines={1}
                  >
                    {routine.time || "All day"}
                  </Text>

                  {/* Icon / emoji */}
                  <Text style={{ fontSize: 16 }}>{routine.icon || "⏰"}</Text>

                  {/* Routine title */}
                  <Text
                    numberOfLines={1}
                    style={{
                      flex: 1,
                      fontSize: TYPOGRAPHY.label.fontSize,
                      lineHeight: TYPOGRAPHY.label.lineHeight,
                      color: colors["color-text-primary"],
                      fontWeight: "600",
                    }}
                  >
                    {routine.title}
                  </Text>

                  {/* Member pill badge */}
                  {firstName ? (
                    <View
                      style={{
                        backgroundColor: mix(col, colors["color-surface-2"], 32),
                        paddingHorizontal: 7,
                        paddingVertical: 2,
                        borderRadius: RADII.pill,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: TYPOGRAPHY.label.fontSize,
                          fontWeight: "600",
                          color: colors["color-text-primary"],
                        }}
                      >
                        {firstName}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Footer link to Calendar if there are more routines */}
        {remainingCount > 0 ? (
          <Pressable
            onPress={() => router.push("/calendar")}
            accessibilityRole="button"
            accessibilityLabel={`+${remainingCount} more routines. Open calendar.`}
            hitSlop={12}
            style={({ pressed }) => ({
              paddingTop: 4,
              alignItems: "center",
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text
              style={{
                fontSize: TYPOGRAPHY.label.fontSize,
                fontWeight: "600",
                color: cyanInk,
              }}
            >
              +{remainingCount} more · See all →
            </Text>
          </Pressable>
        ) : null}
      </View>
    </WidgetFrame>
  );
}

export default ScheduleWidget;
