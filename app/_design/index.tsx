import React from "react";
import { Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { useTheme } from "../../src/theme/ThemeProvider";
import { ACCENTS, TYPOGRAPHY, MOTION } from "../../src/theme/tokens";
import { Screen } from "../../src/theme/Screen";
import { Material } from "../../src/theme/Material";
import { useSync } from "../../src/state/SyncManager";
import { useAuth } from "../../src/state/AuthProvider";
import { Surface } from "../../src/ui/Surface";
import { SoftButton, mixAlpha } from "../../src/ui/SoftButton";
import { IconButton } from "../../src/ui/IconButton";
import { Chip } from "../../src/ui/Chip";
import { Toggle } from "../../src/ui/Toggle";
import { SegmentedControl } from "../../src/ui/SegmentedControl";
import { ListRow } from "../../src/ui/ListRow";
import { SwipeableRow } from "../../src/ui/SwipeableRow";
import { TextField } from "../../src/ui/TextField";
import { Stepper } from "../../src/ui/Stepper";
import { EmptyState } from "../../src/ui/EmptyState";
import { Modal } from "../../src/ui/Modal";
import { PinPad } from "../../src/ui/PinPad";
import { PageHeader } from "../../src/ui/PageHeader";
import { useToast } from "../../src/ui/Toast";

/** Two-column measure: the reference's 58/42 split, and the width it starts at. */
const TWO_COL_MIN_WIDTH = 840;
const COLUMN_GAP = 24;

/** Reference-shaped section card: sectionTitle header + subtitle in a material. */
function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Material tier="regular" style={{ borderRadius: 28, padding: 20, marginBottom: 20, gap: 14 }}>
      <View>
        <Text
          style={{
            color: colors["color-text-primary"],
            fontSize: TYPOGRAPHY.sectionTitle.fontSize,
            lineHeight: TYPOGRAPHY.sectionTitle.lineHeight,
            fontWeight: TYPOGRAPHY.sectionTitle.fontWeight,
            letterSpacing: TYPOGRAPHY.sectionTitle.letterSpacing,
          }}
          accessibilityRole="header"
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={{
              color: colors["color-text-secondary"],
              fontSize: TYPOGRAPHY.label.fontSize,
              lineHeight: TYPOGRAPHY.label.lineHeight,
              marginTop: 4,
            }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {children}
    </Material>
  );
}

/**
 * Dev-only design-kit showcase — the critic loop's calibration target.
 * Structured to mirror the web's Warm Glass System Review capture
 * (reference/design-system/*): eyebrow + serif display masthead, then a
 * 58/42 two-column board (Controls → Inputs → Lists → Feedback on the left;
 * Theme preview → Patterns → Accents on the right), then the type ramp.
 * Theme/boost/accent switch live from here and from Settings (WS-10).
 *
 * It renders on the BARE `color-canvas` token (`atmosphere={false}`): a palette
 * reviewed through a time-of-day gradient is reviewing the wrong thing — the
 * web's own design-system page has no warm-glass canvas either.
 */
export default function DesignKitShowcase() {
  const { colors, theme, boost, accent, accentColor, setBoost, setAccent, setTheme } = useTheme();
  const toast = useToast();
  const sync = useSync();
  const { member } = useAuth();
  const { width } = useWindowDimensions();
  const twoColumn = width >= TWO_COL_MIN_WIDTH;
  const [seg, setSeg] = React.useState("home");
  const [toggled, setToggled] = React.useState(true);
  const [text, setText] = React.useState("Pack lunch");
  const [count, setCount] = React.useState(3);
  const [modalOpen, setModalOpen] = React.useState(false);

  const themeControls = (
    <Section title="Theme controls" subtitle="Live review switches">
      <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <SoftButton variant="secondary" size="sm" onPress={() => setTheme(theme === "dark" ? "light" : "dark")}>
          Toggle theme
        </SoftButton>
        <Toggle value={boost} onChange={setBoost} label="High contrast" />
      </View>
    </Section>
  );

  const controls = (
    <Section title="Controls" subtitle="Core tactile and glass controls">
      <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <SoftButton variant="primary">Primary</SoftButton>
        <SoftButton variant="secondary">Secondary</SoftButton>
        <SoftButton variant="ghost">Ghost</SoftButton>
        <SoftButton variant="destructive">Destructive</SoftButton>
        <SoftButton variant="success">Success</SoftButton>
        <SoftButton loading>Loading</SoftButton>
        <SoftButton disabled>Disabled</SoftButton>
      </View>
      <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        {/* explicit ink on every specimen glyph: an unstyled <Text> falls back
            to RN Web's default black, which is what CRITICAL 1 was made of */}
        <IconButton
          icon={<Text style={{ fontSize: 22, color: colors["color-text-primary"] }}>＋</Text>}
          label="Add"
          variant="glass"
        />
        <IconButton
          icon={<Text style={{ fontSize: 22, color: colors["color-text-primary"] }}>⚙️</Text>}
          label="Settings"
          variant="accent"
        />
        <IconButton
          icon={<Text style={{ fontSize: 22, color: colors["color-text-primary"] }}>🗑️</Text>}
          label="Delete"
          variant="danger"
        />
        <Toggle value={toggled} onChange={setToggled} label="Enable warm glass" />
      </View>
    </Section>
  );

  const inputs = (
    <Section title="Inputs" subtitle="Text, segmented, stepper, and form fields">
      <SegmentedControl
        options={[
          { id: "home", label: "Home" },
          { id: "tasks", label: "Tasks" },
          { id: "meals", label: "Meals" },
        ]}
        value={seg}
        onChange={setSeg}
        accessibilityLabel="Demo segments"
      />
      <TextField
        label="Task name"
        value={text}
        onChangeText={setText}
        placeholder="Pack lunch"
        helperText="Neumorphic inset field"
      />
      <Stepper value={count} onChange={setCount} min={0} max={8} label="Amount" />
    </Section>
  );

  const lists = (
    <Section title="Lists" subtitle="Rows, chips, and swipe affordances">
      {/* Specimens, not controls: a tappable chip with no onPress is a dead
          control (7 of them were, rendered as buttons). as="span" is the
          static-label kind. */}
      <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }} testID="specimen-chips">
        <Chip label="Today" as="span" />
        <Chip label="Done" tone="success" as="span" />
        <Chip label="Later" tone="warning" as="span" />
        <Chip label="accent" tone="accent" as="span" />
        <Chip label="danger" tone="danger" as="span" />
        <Chip label="violet" tone="violet" as="span" />
        <Chip label="cyan" tone="cyan" as="span" />
        <Chip label="static (span)" as="span" size="sm" />
      </View>
      <ListRow
        title="Pack backpack"
        subtitle="Due today · 10 pts"
        leftRailColor={colors["color-accent-mint"]}
        leading={<Text style={{ fontSize: 24 }}>🎒</Text>}
        trailing={<Chip as="span" size="sm" tone="neutral" label="+10 pts" />}
        onPress={() => toast.show("ListRow pressed")}
        showDisclosure
      />
      <SwipeableRow
        actions={[
          { key: "done", label: "Done", onAction: () => toast.show("Done ✅", { intent: "success" }) },
          { key: "del", label: "Delete", intent: "destructive", onAction: () => toast.show("Deleted", { intent: "error" }) },
        ]}
      >
        <ListRow title="Wipe counters" subtitle="Swipe right to complete" leading={<Text style={{ fontSize: 24 }}>✨</Text>} />
      </SwipeableRow>
    </Section>
  );

  const feedback = (
    <Section title="Feedback" subtitle="Empty, error, skeleton, modal, toast, PIN">
      <EmptyState
        icon="🧹"
        title="No chores"
        body="Everything is caught up"
        actionLabel="Add chore"
        onAction={() => toast.show("Planning…")}
      />
      {/* Error-state sample: rose-tinted card + retry (WidgetFrame parity) */}
      <View
        style={{
          borderRadius: 20,
          padding: 20,
          alignItems: "center",
          gap: 8,
          backgroundColor: mixAlpha(colors["color-accent-rose"] ?? accentColor, 0.12),
          borderWidth: 1,
          borderColor: mixAlpha(colors["color-accent-rose"] ?? accentColor, 0.3),
        }}
        testID="sample-error-state"
      >
        <Text style={{ fontSize: 32 }}>⚠️</Text>
        <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.title.fontSize, fontWeight: "700" }}>
          {"Couldn't sync"}
        </Text>
        <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, textAlign: "center" }}>
          Try again when the connection is back
        </Text>
        <SoftButton variant="destructive" size="sm" onPress={() => toast.show("Retrying…", { intent: "info" })}>
          Retry
        </SoftButton>
      </View>
      {/* Skeleton ghost rows — the loading shape every widget uses */}
      <View style={{ gap: 12 }} testID="sample-skeleton">
        {[0, 1].map((i) => (
          <View key={i} style={{ height: 64, borderRadius: 20, backgroundColor: colors["color-surface-2"] }} />
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
        <SoftButton variant="secondary" onPress={() => setModalOpen(true)}>
          Open modal
        </SoftButton>
        <SoftButton variant="primary" onPress={() => toast.show("Showing a toast", { intent: "success" })}>
          Show toast
        </SoftButton>
      </View>
      <PinPad
        member={{ name: "Demo member", emoji: "🐱" }}
        onVerified={() => toast.show("PIN verified (demo)", { intent: "success" })}
        onCancel={() => toast.show("Cancelled", { intent: "info" })}
      />
    </Section>
  );

  const themePreview = (
    <Section title="Theme preview" subtitle="Manual surface tokens for review">
      <View style={{ gap: 10 }}>
        {(["thin", "regular", "thick"] as const).map((t) => (
          <Material key={t} tier={t} style={{ borderRadius: 16, padding: 16 }}>
            <Text style={{ color: colors["color-text-primary"], fontWeight: "600" }}>Material {t}</Text>
          </Material>
        ))}
        <Surface variant="glass" style={{ borderRadius: 16, padding: 16 }}>
          <Text style={{ color: colors["color-text-primary"] }}>Dark glass — visible</Text>
        </Surface>
        <Surface variant="glass-strong" glow style={{ borderRadius: 16, padding: 16 }}>
          <Text style={{ color: colors["color-text-primary"] }}>Strong glass + glow</Text>
        </Surface>
      </View>
    </Section>
  );

  const patterns = (
    <Section title="Patterns" subtitle="Stat tile, day strip, navigation rows">
      <Surface variant="glass-strong" style={{ borderRadius: 20, padding: 20 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <Text
            testID="specimen-stat"
            style={{
              color: colors["color-text-primary"],
              fontSize: TYPOGRAPHY.stat.fontSize,
              fontWeight: "700",
              // figures that tick must not reflow their own column
              fontVariant: ["tabular-nums"],
            }}
          >
            240
          </Text>
          <Text style={{ fontSize: 24 }}>⭐</Text>
        </View>
        <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, textAlign: "right" }}>
          Points
        </Text>
        <Text style={{ color: colors["color-accent-mint"], fontSize: TYPOGRAPHY.label.fontSize, textAlign: "right" }}>
          +35 this week
        </Text>
      </Surface>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((d, i) => (
          <Chip key={d} label={d} tone={i === 0 ? "accent" : "neutral"} selected={i === 0} as="span" size="sm" />
        ))}
      </View>
      <ListRow title="Grocery" subtitle="Shopping list" leading={<Text style={{ fontSize: 22 }}>🛒</Text>} showDisclosure onPress={() => toast.show("Grocery")} />
      <ListRow title="Emergency" subtitle="Contacts" leading={<Text style={{ fontSize: 22 }}>🚨</Text>} showDisclosure onPress={() => toast.show("Emergency")} />
    </Section>
  );

  const accents = (
    <Section title="Accents" subtitle="Warm Glass v2 accent palette — tap to apply">
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {Object.keys(ACCENTS.dark).map((a) => (
          // Reference structure (design-system capture): the accent NAME
          // sits OUTSIDE the swatch in primary ink on the card — the
          // swatch itself is pure accent color. (An in-pill label over a
          // raw accent fill failed AA: 1.6–3.4:1.)
          <Pressable
            key={a}
            testID={`accent-chip-${a}`}
            accessibilityRole="button"
            accessibilityLabel={`Accent ${a}`}
            accessibilityState={{ selected: accent === a }}
            onPress={() => setAccent(a)}
            style={{ width: "47%", minHeight: 64, gap: 8 }}
          >
            <View
              style={{
                height: 56,
                borderRadius: 16,
                backgroundColor: ACCENTS[theme][a],
                borderWidth: accent === a ? 3 : 0,
                borderColor: colors["color-text-primary"],
              }}
            />
            <Text
              style={{
                color: colors["color-text-primary"],
                fontSize: TYPOGRAPHY.label.fontSize,
                fontWeight: "600",
              }}
            >
              {a}
            </Text>
          </Pressable>
        ))}
      </View>
    </Section>
  );

  const typeRamp = (
    <Section
      title="Type ramp"
      subtitle={`Wall scale · ${TYPOGRAPHY.label.fontSize}sp floor · motion ${MOTION.fast}/${MOTION.base}/${MOTION.slow}/${MOTION.glide}ms`}
    >
      {Object.entries(TYPOGRAPHY).map(([name, t]) => (
        <Text key={name} style={{ color: colors["color-text-primary"], fontSize: t.fontSize, lineHeight: t.lineHeight }}>
          {name} — {t.fontSize}sp
        </Text>
      ))}
      <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize }}>
        muted at floor size
      </Text>
    </Section>
  );

  return (
    <Screen testID="design-kit" atmosphere={false}>
      <ScrollView
        contentContainerStyle={{
          padding: 24,
          paddingBottom: 120,
          maxWidth: 1120,
          width: "100%",
          alignSelf: "center",
        }}
      >
        <PageHeader
          testID="showcase-header"
          eyebrow="Primitives and patterns in dark and light review modes"
          title="Warm Glass System Review"
          lede={`theme ${theme} · boost ${boost ? "on" : "off"} · accent ${accent}${
            sync ? ` · sync ${sync.stale ? "stale" : "ok"} ${sync.lastSyncAt ? new Date(sync.lastSyncAt).toLocaleTimeString() : "—"}` : ""
          }`}
        />

        {/* L6: the gate must show guest-specific evidence, not just a sync
            caption differing between the parent and guest captures. */}
        {member ? null : (
          <Material
            tier="thin"
            testID="showcase-guest-affordance"
            style={{
              borderRadius: 20,
              padding: 16,
              marginTop: 16,
              marginBottom: 20,
              borderWidth: 1,
              borderColor: mixAlpha(accentColor, 0.28),
            }}
          >
            <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.title.fontSize, fontWeight: "700" }}>
              Signed out — read-only preview
            </Text>
            <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, marginTop: 4 }}>
              Specimens only: no family data, no writes. Sign in with your PIN to edit.
            </Text>
          </Material>
        )}

        {twoColumn ? (
          <View style={{ flexDirection: "row", gap: COLUMN_GAP }} testID="showcase-columns">
            <View style={{ flex: 58 }} testID="showcase-col-primary">
              {themeControls}
              {controls}
              {inputs}
              {lists}
              {feedback}
            </View>
            <View style={{ flex: 42 }} testID="showcase-col-secondary">
              {themePreview}
              {patterns}
              {accents}
            </View>
          </View>
        ) : (
          <View testID="showcase-columns">
            {themeControls}
            {controls}
            {inputs}
            {lists}
            {feedback}
            {themePreview}
            {patterns}
            {accents}
          </View>
        )}
        {typeRamp}

        <Modal visible={modalOpen} onClose={() => setModalOpen(false)} title="Demo modal" description="Reference-shaped dialog">
          <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.body.fontSize, paddingVertical: 12 }}>
            Modals share the glass material and the 64dp action floor.
          </Text>
        </Modal>
      </ScrollView>
    </Screen>
  );
}
