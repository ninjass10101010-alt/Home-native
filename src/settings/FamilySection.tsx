import React, { useCallback, useEffect, useState } from "react";
import { Image, Text, View } from "react-native";
import { listMembersLive, writeCachedMembers } from "../api/members";
import type { ServerMember } from "../api/types";
import { useTheme } from "../theme/ThemeProvider";
import { Material } from "../theme/Material";
import { TYPOGRAPHY } from "../theme/tokens";
import { EmptyState } from "../ui/EmptyState";
import { SoftButton } from "../ui/SoftButton";
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

  // Session-gated read: kids/guests never mount this section's fetch.
  useEffect(() => {
    if (member && member.role === "parent") void loadRoster();
  }, [member, loadRoster]);

  if (!member || member.role !== "parent") return null;

  return (
    <View style={{ gap: 16 }} testID="family-section">
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
              </Material>
            );
          })}
        </View>
      )}
      <SoftButton
        variant="secondary"
        size="md"
        testID="family-roster-refresh"
        onPress={() => void loadRoster()}
      >
        Refresh
      </SoftButton>
    </View>
  );
}

export default FamilySection;
