import React, { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { api } from "../../api/client";
import type { DbListEnvelope } from "../../api/types";
import { useTheme } from "../../theme/ThemeProvider";
import { TYPOGRAPHY, RADII } from "../../theme/tokens";
import { mix } from "../../theme/mix";
import { WidgetFrame } from "./WidgetFrame";
import { useWidgetData } from "./data";
import { DayLine, type DayLineMarker } from "./DayLine";
import { EmptyState } from "../../ui/EmptyState";
import {
  type ScheduleRow,
  SCHEDULE_RAIL_TOKENS,
  schedulesForDay,
} from "../../calendar/events-merge";
import type { WallSpan } from "../widgets";

export interface ScheduleWidgetProps {
  span?: WallSpan;
}

interface ScheduleData {
  schedules: ScheduleRow[];
}

export function ScheduleWidget({ span = 1 }: ScheduleWidgetProps) {
  const { colors, accentColor } = useTheme();
  const cyan = colors["color-accent-cyan"];
  const router = useRouter();

  const { status, data, failure, stale, retry } = useWidgetData<ScheduleData>(
    async () => {
      const res = await api<DbListEnvelope<ScheduleRow>>("/api/db/schedules");
      return {
        schedules: Array.isArray(res?.items) ? res.items : [],
      };
    },
    { guestVisible: true }
  );

  const now = useMemo(() => new Date(), []);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const { todayRoutines, upcomingRoutines, markers } = useMemo(() => {
    const all = data?.schedules ?? [];
    const dayRows = schedulesForDay(all, now);

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

  const maxVisible = span === 2 ? 4 : 2;
  const visibleRoutines = upcomingRoutines.slice(0, maxVisible);
  const remainingCount = upcomingRoutines.length - visibleRoutines.length;

  const countLabel =
    status === "ready" || data
      ? `${upcomingRoutines.length} upcoming`
      : "";

  return (
    <WidgetFrame
      id="schedule"
      icon="🕐"
      title="Daily Schedule"
      description={countLabel}
      status={status}
      failure={failure}
      hasData={Boolean(data)}
      stale={stale}
      onRetry={retry}
    >
      <View testID="schedule-widget" style={{ flex: 1, paddingHorizontal: 12, paddingBottom: 10 }}>
        {/* The household clock DayLine */}
        <View style={{ marginBottom: 12 }}>
          <DayLine tone={cyan} markers={markers} />
        </View>

        {/* Content Rows or Empty State */}
        {todayRoutines.length === 0 ? (
          <EmptyState
            flat
            icon="🕐"
            title="No routines"
            body="No routines are scheduled for today."
            style={{ flex: 1 }}
          />
        ) : upcomingRoutines.length === 0 ? (
          <EmptyState
            flat
            icon="🎉"
            title="All done"
            body="All routines completed for today."
            style={{ flex: 1 }}
          />
        ) : (
          <View style={{ flex: 1, gap: 6 }}>
            {visibleRoutines.map((routine) => {
              const raw = data?.schedules.find((s) => `s_${String(s.id)}` === routine.id);
              const tokenKey = raw?.color ? SCHEDULE_RAIL_TOKENS[raw.color.toLowerCase()] : null;
              const col = (tokenKey && colors[tokenKey]) || cyan;
              const firstName = routine.member ? routine.member.split(" ")[0] : null;

              return (
                <View
                  key={routine.id}
                  testID={`schedule-row-${routine.id}`}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: mix(col, colors["color-surface-1"], 14),
                    borderColor: mix(col, "transparent", 28),
                    borderWidth: 1,
                    borderRadius: RADII.lg,
                    paddingHorizontal: 10,
                    paddingVertical: 7,
                    gap: 8,
                  }}
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
                      fontSize: 13,
                      lineHeight: 18,
                      fontFamily: "SpaceGrotesk-Medium",
                      fontVariant: ["tabular-nums"],
                      color: colors["color-text-primary"],
                      width: 62,
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
                          fontSize: 11,
                          fontWeight: "600",
                          color: colors["color-text-primary"],
                        }}
                      >
                        {firstName}
                      </Text>
                    </View>
                  ) : null}
                </View>
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
            style={({ pressed }) => ({
              paddingTop: 6,
              alignItems: "center",
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: colors["color-accent-cyan"],
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
