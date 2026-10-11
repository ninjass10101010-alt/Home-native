import React from "react";
import { ScrollView, Text, View } from "react-native";
import { useTheme } from "../../src/theme/ThemeProvider";
import { ACCENTS, TYPOGRAPHY, MOTION } from "../../src/theme/tokens";
import { Screen } from "../../src/theme/Screen";
import { Material } from "../../src/theme/Material";
import { useSync } from "../../src/state/SyncManager";
import { Surface } from "../../src/ui/Surface";
import { SoftButton } from "../../src/ui/SoftButton";
import { IconButton } from "../../src/ui/IconButton";
import { Chip } from "../../src/ui/Chip";
import { Toggle } from "../../src/ui/Toggle";
import { SegmentedControl } from "../../src/ui/SegmentedControl";
import { ListRow } from "../../src/ui/ListRow";
import { SwipeableRow } from "../../src/ui/SwipeableRow";
import { TextField } from "../../src/ui/TextField";
import { Stepper } from "../../src/ui/Stepper";
import { EmptyState } from "../../src/ui/EmptyState";
import { useToast } from "../../src/ui/Toast";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 12, marginBottom: 32 }}>
      <Text
        style={{
          color: colors["color-text-secondary"],
          fontSize: TYPOGRAPHY.label.fontSize,
          fontWeight: "700",
          textTransform: "uppercase",
          letterSpacing: 1.5,
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

/**
 * Dev-only design-kit showcase — the critic loop's calibration target (Task 15).
 * Renders every primitive across variants/materials/ramp in the CURRENT theme
 * (theme/boost/accent are switched live from the Settings surface, WS-10).
 */
export default function DesignKitShowcase() {
  const { colors, theme, boost, accent, setBoost, setAccent, setTheme } = useTheme();
  const toast = useToast();
  const sync = useSync();
  const [seg, setSeg] = React.useState("plan");
  const [toggled, setToggled] = React.useState(true);
  const [text, setText] = React.useState("");
  const [count, setCount] = React.useState(2);

  return (
    <Screen testID="design-kit">
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 120 }}>
        <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.hero.fontSize, fontWeight: "700" }}>
          Consuela kit
        </Text>
        <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.body.fontSize, marginBottom: 8 }}>
          theme {theme} · boost {boost ? "on" : "off"} · accent {accent}
          {sync ? ` · sync ${sync.stale ? "stale" : "ok"} ${sync.lastSyncAt ? new Date(sync.lastSyncAt).toLocaleTimeString() : "—"}` : ""}
        </Text>

        <Section title="Theme controls">
          <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
            <SoftButton variant="secondary" size="sm" onPress={() => setTheme(theme === "dark" ? "light" : "dark")}>
              Toggle theme
            </SoftButton>
            <Toggle value={boost} onChange={setBoost} label="High contrast" />
          </View>
          <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
            {Object.keys(ACCENTS.dark).map((a) => (
              <Chip key={a} testID={`accent-chip-${a}`} label={a} tone="accent" selected={accent === a} onPress={() => setAccent(a)} />
            ))}
          </View>
        </Section>

        <Section title="Materials">
          <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
            {(["thin", "regular", "thick"] as const).map((t) => (
              <Material key={t} tier={t} style={{ width: 200, height: 120, alignItems: "center", justifyContent: "center", borderRadius: 24 }}>
                <Text style={{ color: colors["color-text-primary"], fontWeight: "600" }}>{t}</Text>
              </Material>
            ))}
          </View>
        </Section>

        <Section title="Surfaces">
          <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
            <Surface variant="glass" style={{ width: 220, height: 110 }}>
              <Text style={{ color: colors["color-text-primary"] }}>glass</Text>
            </Surface>
            <Surface variant="flat" style={{ width: 220, height: 110 }}>
              <Text style={{ color: colors["color-text-primary"] }}>flat</Text>
            </Surface>
            <Surface variant="glass-strong" glow style={{ width: 220, height: 110 }}>
              <Text style={{ color: colors["color-text-primary"] }}>strong + glow</Text>
            </Surface>
          </View>
        </Section>

        <Section title="Buttons">
          <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <SoftButton variant="primary">Primary</SoftButton>
            <SoftButton variant="secondary">Secondary</SoftButton>
            <SoftButton variant="ghost">Ghost</SoftButton>
            <SoftButton variant="destructive">Destructive</SoftButton>
            <SoftButton variant="success">Success</SoftButton>
            <SoftButton loading>Loading</SoftButton>
            <SoftButton disabled>Disabled</SoftButton>
            <IconButton icon={<Text style={{ fontSize: 22 }}>⚙️</Text>} label="Settings" variant="accent" />
            <IconButton icon={<Text style={{ fontSize: 22 }}>🗑️</Text>} label="Delete" variant="danger" />
          </View>
        </Section>

        <Section title="Chips">
          <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
            <Chip label="neutral" />
            <Chip label="accent" tone="accent" />
            <Chip label="selected" tone="accent" selected />
            <Chip label="success" tone="success" />
            <Chip label="danger" tone="danger" />
            <Chip label="warning" tone="warning" />
            <Chip label="violet" tone="violet" />
            <Chip label="cyan" tone="cyan" />
            <Chip label="static (span)" as="span" size="sm" />
          </View>
        </Section>

        <Section title="Segmented + Toggle + Stepper">
          <SegmentedControl
            options={[
              { id: "plan", label: "Plan" },
              { id: "shop", label: "Shop" },
              { id: "stock", label: "Stock" },
            ]}
            value={seg}
            onChange={setSeg}
            accessibilityLabel="Demo segments"
          />
          <SegmentedControl
            emphasize
            options={[
              { id: "tasks", label: "Tasks" },
              { id: "board", label: "Leaderboard" },
            ]}
            value={"tasks"}
            onChange={() => {}}
            accessibilityLabel="Emphasized segments"
          />
          <Toggle value={toggled} onChange={setToggled} label="Family notifications" description="Pushes to the wall" />
          <Stepper value={count} onChange={setCount} min={0} max={8} label="Portions" />
        </Section>

        <Section title="List + Swipe">
          <ListRow title="Bailey" subtitle="3 tasks done today" leading={<Text style={{ fontSize: 28 }}>👧</Text>} showDisclosure onPress={() => toast.show("ListRow pressed")} />
          <SwipeableRow
            actions={[
              { key: "done", label: "Done", onAction: () => toast.show("Done ✅", { intent: "success" }) },
              { key: "del", label: "Delete", intent: "destructive", onAction: () => toast.show("Deleted", { intent: "error" }) },
            ]}
          >
            <ListRow title="Take out trash" subtitle="Kitchen" leading={<Text style={{ fontSize: 28 }}>🗑️</Text>} />
          </SwipeableRow>
        </Section>

        <Section title="Field + Empty + PinPad">
          <TextField label="Member name" value={text} onChangeText={setText} placeholder="Aurora…" helperText="Helper text at floor size" />
          <EmptyState icon="🍽️" title="No meals planned" body="Plan this week and breakfast shows up here." actionLabel="Plan meals" onAction={() => toast.show("Planning…")} />
        </Section>

        <Section title="Type ramp">
          {Object.entries(TYPOGRAPHY).map(([name, t]) => (
            <Text key={name} style={{ color: colors["color-text-primary"], fontSize: t.fontSize, lineHeight: t.lineHeight }}>
              {name} — {t.fontSize}sp
            </Text>
          ))}
          <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize }}>
            muted at floor (motion {MOTION.fast}/{MOTION.base}/{MOTION.slow}/{MOTION.glide}ms)
          </Text>
        </Section>
      </ScrollView>
    </Screen>
  );
}
