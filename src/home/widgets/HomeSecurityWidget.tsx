import React from "react";
import { Text, View } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";
import { TYPOGRAPHY } from "../../theme/tokens";
import { Chip } from "../../ui/Chip";
import { useRouter } from "expo-router";
import { resolveRoute } from "../../nav/nav-items";
import { useHAState, entitiesByDomain, openSensors, alarmPanel } from "./ha-state";
import { WidgetFrame } from "./WidgetFrame";

const EMPTY_SECURITY = "No presence data yet"; // web copy — no trailing period

/** Web entityFriendlyName: friendly_name → last entity_id segment. */
function friendlyName(s: { entity_id: string; attributes: Record<string, unknown> }): string {
  const n = s.attributes?.friendly_name;
  if (typeof n === "string" && n.trim()) return n.trim();
  return s.entity_id.split(".")[1]?.replace(/_/g, " ") ?? s.entity_id;
}

/** Uppercase muted section kicker (web's "Presence"/"Sensors"). */
function SectionLabel({ label }: { label: string }) {
  const { colors } = useTheme();
  return (
    <Text
      style={{
        color: colors["color-text-muted"],
        fontSize: TYPOGRAPHY.label.fontSize,
        fontWeight: "700",
        letterSpacing: 1.2,
        marginBottom: 6,
      }}
    >
      {label.toUpperCase()}
    </Text>
  );
}

/** Wall security tile (web HomeSecurityWidget.tsx parity, read-only Wave 1). */
export interface HomeSecurityWidgetProps {
  /** Where "Open Home controls" lands. Absent = the honest /soon fallback. */
  onOpenHomeControls?: () => void;
}

export function HomeSecurityWidget({ onOpenHomeControls }: HomeSecurityWidgetProps = {}) {
  const { colors, accentColor } = useTheme();
  const router = useRouter();
  const { states, loaded, error, refresh } = useHAState();

  const people = entitiesByDomain(states, "person");
  const home = people.filter((p) => p.state === "home");
  const sensors = openSensors(states);
  const alarm = alarmPanel(states);
  const alarmState = alarm?.state ?? "unavailable";

  return (
    <WidgetFrame
      id="homeSecurity"
      icon="🛡️"
      title="Home Security"
      status={loaded ? (error && states.length === 0 ? "error" : "ready") : "loading"}
      failure={error && states.length === 0 ? "error" : null}
      hasData={states.length > 0}
      stale={!!error && states.length > 0}
      onRetry={refresh}
    >
      <View style={{ flex: 1, minHeight: 0 }}>
        <View>
          <SectionLabel label="Presence" />
          {people.length === 0 ? (
            <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize }}>
              {EMPTY_SECURITY}
            </Text>
          ) : (
            <>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {people.map((person) => (
                  <Chip
                    key={person.entity_id}
                    as="span"
                    size="sm"
                    tone="neutral"
                    label={`👤 ${friendlyName(person).split(" ")[0]} · ${person.state === "home" ? "home" : "away"}`}
                  />
                ))}
              </View>
              <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, marginTop: 6 }}>
                {home.length} home
              </Text>
            </>
          )}
        </View>

        <View style={{ marginTop: 12 }}>
          <SectionLabel label="Sensors" />
          {sensors.length === 0 ? (
            <Chip as="span" size="sm" tone="success" label="Doors & windows closed" />
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {sensors.slice(0, 4).map((s) => (
                <Chip key={s.entity_id} as="span" size="sm" tone="danger" label={friendlyName(s)} />
              ))}
              {sensors.length > 4 ? (
                <Chip as="span" size="sm" tone="danger" label={`+${sensors.length - 4} more`} />
              ) : null}
            </View>
          )}
        </View>

        {alarm ? (
          <View style={{ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Chip
              as="span"
              size="sm"
              tone={alarmState === "disarmed" ? "success" : "danger"}
              label={alarmState}
            />
          </View>
        ) : null}

        {/* Web footer (HomeSecurityWidget.tsx:49-52): the route to the full
            controls surface. resolveRoute keeps the manifest's honest
            fallback — /ha lands on /soon with the dock alive rather than on a
            toast, which is the app's own convention for an unshipped cap. */}
        <View style={{ minHeight: 64, justifyContent: "center", marginTop: 10 }}>
          <Text
            testID="open-home-controls"
            accessibilityRole="link"
            onPress={() => (onOpenHomeControls ? onOpenHomeControls() : router.push(resolveRoute("/ha", "House") as never))}
            style={{ color: accentColor, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}
          >
            Open Home controls →
          </Text>
        </View>
      </View>
    </WidgetFrame>
  );
}

export default HomeSecurityWidget;
