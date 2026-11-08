import React from "react";
import { Image, Pressable, Text, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { mix } from "../theme/mix";
import { Material } from "../theme/Material";
import { MIN_TARGET_DP, TYPOGRAPHY } from "../theme/tokens";
import { SoftButton } from "../ui/SoftButton";
import { isPhotoUri } from "../ui/MemberRail";
import { useDinnerPoll, type DinnerPollOption } from "./dinner-poll";

export interface DinnerPollCardProps {
  voterName?: string;
  voterEmoji?: string;
  isParent?: boolean;
  selectedDay?: string;
  onScheduleWinner?: (option: DinnerPollOption) => void;
}

/**
 * Skylight Family Dinner Poll Card.
 *
 * Allows family members to vote on what to cook for dinner.
 * Features live vote count badges, voter chips with photo-safe avatars,
 * and parent-only controls to schedule the winner onto the meal plan.
 */
export function DinnerPollCard({
  voterName = "Family",
  voterEmoji = "🍽️",
  isParent = false,
  selectedDay = "Mon",
  onScheduleWinner,
}: DinnerPollCardProps) {
  const { colors, accentColor } = useTheme();
  const { options, toggleVote, resetVotes, winner } = useDinnerPoll();

  const totalVotes = options.reduce((sum, opt) => sum + (opt.votes ? opt.votes.length : 0), 0);

  return (
    <Material
      testID="meals-dinner-poll-card"
      tier="regular"
      tone={colors["color-accent-amber"] ?? accentColor}
      style={{
        borderRadius: 24,
        padding: 18,
        gap: 14,
        marginTop: 4,
      }}
    >
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: mix(colors["color-accent-amber"] ?? accentColor, "transparent", 22),
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 22 }}>🗳️</Text>
          </View>
          <View>
            <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
              Family Dinner Poll
            </Text>
            <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }}>
              {`Vote for what sounds delicious for ${selectedDay} · Tap any row to vote`}
            </Text>
          </View>
        </View>

        {totalVotes > 0 ? (
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 10,
              backgroundColor: colors["color-surface-2"],
            }}
          >
            <Text style={{ color: colors["color-text-secondary"], fontSize: 14, fontWeight: "600" }}>
              {`${totalVotes} ${totalVotes === 1 ? "total vote" : "total votes"}`}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Poll Options List */}
      <View style={{ gap: 10 }}>
        {options.map((opt) => {
          const votes = opt.votes || [];
          const count = votes.length;
          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
          const isVotedByMe = votes.some((v) => v.voterName === voterName);

          return (
            <Pressable
              key={opt.id}
              testID={`dinner-poll-opt-${opt.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Vote for ${opt.name}, currently ${count} votes`}
              onPress={() => void toggleVote(opt.id, voterName, voterEmoji)}
              style={{
                minHeight: MIN_TARGET_DP,
                minWidth: MIN_TARGET_DP,
                padding: 12,
                borderRadius: 16,
                backgroundColor: isVotedByMe
                  ? mix(accentColor, "transparent", 15)
                  : colors["color-surface-1"],
                borderWidth: 1.5,
                borderColor: isVotedByMe ? accentColor : colors["color-border"],
                justifyContent: "center",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                  <Text style={{ fontSize: 24 }}>{opt.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: colors["color-text-primary"],
                        fontSize: TYPOGRAPHY.body.fontSize,
                        fontWeight: "700",
                      }}
                    >
                      {opt.name}
                    </Text>
                    <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize }}>
                      {`⏱️ ${opt.prepTime} · 🔥 ${opt.calories} kcal`}
                    </Text>
                  </View>
                </View>

                {/* Vote Count Badge */}
                <View
                  testID={`dinner-poll-votes-${opt.id}`}
                  style={{
                    minWidth: 44,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 12,
                    backgroundColor: isVotedByMe
                      ? mix(accentColor, "transparent", 25)
                      : colors["color-surface-2"],
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      color: isVotedByMe ? accentColor : colors["color-text-primary"],
                      fontSize: TYPOGRAPHY.label.fontSize,
                      fontWeight: "700",
                    }}
                  >
                    {`${count} ${count === 1 ? "vote" : "votes"}`}
                  </Text>
                </View>
              </View>

              {/* Token-Colored Progress Bar */}
              <View
                style={{
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: colors["color-surface-2"],
                  overflow: "hidden",
                  width: "100%",
                  marginTop: 8,
                }}
              >
                <View
                  style={{
                    height: "100%",
                    width: `${pct}%`,
                    backgroundColor: isVotedByMe ? accentColor : (colors["color-accent-amber"] ?? accentColor),
                    borderRadius: 3,
                  }}
                />
              </View>

              {/* Voter Chips */}
              {votes.length > 0 ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8, alignItems: "center" }}>
                  {votes.map((v, i) => (
                    <View
                      key={`${v.voterName}-${i}`}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 8,
                        backgroundColor: colors["color-surface-2"],
                      }}
                    >
                      {isPhotoUri(v.voterEmoji) ? (
                        <Image
                          testID={`poll-voter-img-${v.voterName}`}
                          source={{ uri: v.voterEmoji }}
                          style={{ width: 20, height: 20, borderRadius: 10 }}
                        />
                      ) : (
                        <Text testID={`poll-voter-emoji-${v.voterName}`} style={{ fontSize: 14 }}>
                          {v.voterEmoji}
                        </Text>
                      )}
                      <Text
                        testID={`poll-voter-name-${v.voterName}`}
                        style={{ color: colors["color-text-secondary"], fontSize: 14 }}
                      >
                        {v.voterName}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {/* Parent Actions: Schedule Winner & Reset Votes */}
      {isParent && winner ? (
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center", marginTop: 4 }}>
          <SoftButton
            testID="dinner-poll-schedule-winner"
            variant="primary"
            size="md"
            onPress={() => onScheduleWinner?.(winner)}
            style={{ minHeight: MIN_TARGET_DP, minWidth: MIN_TARGET_DP, flex: 1 }}
          >
            {`🏆 Schedule Winner (${winner.name})`}
          </SoftButton>
          <SoftButton
            testID="dinner-poll-reset"
            variant="secondary"
            size="md"
            onPress={() => void resetVotes()}
            style={{ minHeight: MIN_TARGET_DP, minWidth: MIN_TARGET_DP }}
          >
            ↺ Reset Votes
          </SoftButton>
        </View>
      ) : isParent ? (
        <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 4 }}>
          <SoftButton
            testID="dinner-poll-reset"
            variant="secondary"
            size="sm"
            onPress={() => void resetVotes()}
            style={{ minHeight: MIN_TARGET_DP, minWidth: MIN_TARGET_DP }}
          >
            ↺ Reset Votes
          </SoftButton>
        </View>
      ) : null}
    </Material>
  );
}
