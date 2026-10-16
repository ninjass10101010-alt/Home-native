import React from "react";
import { Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../src/theme/ThemeProvider";
import { ACCENTS, TYPOGRAPHY, MOTION } from "../../src/theme/tokens";
import { Screen } from "../../src/theme/Screen";
import { Material } from "../../src/theme/Material";
import { mix, accentDeepened } from "../../src/theme/mix";
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
import { SignedOutBanner } from "../../src/ui/SignedOutBanner";

/** Two-column measure: the reference's 58/42 split, and the width it starts at. */
const TWO_COL_MIN_WIDTH = 840;
const COLUMN_GAP = 24;

/**
 * The destructive specimen's glyph.
 *
 * It was the 🗑️ colour emoji, and that is exactly what made D-1 unfixable
 * through ink: a COLOUR emoji ignores `color` entirely, and its own light
 * metal measured L 0.4948 against the `#b72f47` disc — 3.10:1, matching the
 * critic's number exactly. A specimen exists to demonstrate the kit's ink
 * contract, so it has to be a glyph the contract can actually reach: this one
 * paints `color-primary-foreground`, i.e. 5.98:1 dark / 7.37:1 light on the
 * unchanged web-parity disc.
 */
function DeleteGlyph({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityLabel="Delete">
      <Path d="M4 7h16" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M9 7V5.2A1.2 1.2 0 0 1 10.2 4h3.6A1.2 1.2 0 0 1 15 5.2V7" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M6.2 7 7 19.8A1.2 1.2 0 0 0 8.2 21h7.6a1.2 1.2 0 0 0 1.2-1.2L17.8 7" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M10 11v6M14 11v6" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

/**
 * Reference-shaped section card: a LIGHTER header band (sectionTitle + subtitle)
 * over the body, divided by a 1px hairline — the two-part shape every section
 * card in `reference/design-system/parent-dark.png` has.
 *
 * WS-0 round 3, finding 1. Measured off the reference at the card's left
 * padding gutter: header band relY 0.0348 mean / 0.0379 peak, body 0.0257,
 * with a 1px rule at rgb(64,75,95). The native Section had been ONE flat
 * `regular` surface with no rule, so its header was 3% DARKER than its body and
 * nothing divided the two — a section card read as a rounded slab.
 *
 * Tier choice: the body is the ladder's `thin` tier (0.0242 composited, the
 * reference's own 0.0257) and the header band is `thick` (0.0386) — a 1.59x
 * internal step. The ladder's own single-step ratios (regular/thin 1.21x,
 * thick/regular 1.32x) cannot reach the 1.4x the composition pin demands, so
 * the band deliberately spans thin->thick rather than sitting one rung up.
 */
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
    <Material
      tier="thin"
      testID="showcase-section-body"
      style={{ borderRadius: 28, marginBottom: 20, paddingTop: 0, paddingHorizontal: 0, paddingBottom: 0 }}
    >
      <Material
        tier="thick"
        testID="showcase-section-header"
        style={{
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 14,
          borderBottomWidth: 1,
          borderBottomColor: colors["color-border"],
        }}
      >
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
      </Material>
      <View style={{ padding: 20, gap: 14 }}>{children}</View>
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
  const mint = colors["color-accent-mint"] ?? accentColor;
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
          icon={<DeleteGlyph color={colors["color-primary-foreground"]} />}
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
          {/* Reference patterns card: the hero figure is a GREEN GRADIENT tile
              with a soft green glow bleeding past its edges (measured
              reference tile relY 0.053–0.096, chroma 25–33, white ink at
              7.2–10.2:1) — not a flat ink on flat glass. The stops use the
              same accent-deepened recipe as SoftButton's success variant, so
              the white ink keeps 5.7:1 dark / 9.8:1 light at its darkest stop
              and 4.1:1 / 7.5:1 at its lightest. */}
          <View testID="specimen-stat-glow" style={{ position: "absolute", left: -18, top: -10, width: 150, height: 64, borderRadius: 32, backgroundColor: mixAlpha(colors["color-accent-mint"], 0.18) }} pointerEvents="none" />
          <LinearGradient
            testID="specimen-stat-fill"
            colors={[accentDeepened(mint, 48), accentDeepened(mint, 36)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: 12 }}
          >
            <Text
              testID="specimen-stat"
              style={{
                color: colors["color-primary-foreground"],
                fontSize: TYPOGRAPHY.stat.fontSize,
                fontWeight: "700",
                // figures that tick must not reflow their own column
                fontVariant: ["tabular-nums"],
              }}
            >
              240
            </Text>
          </LinearGradient>
          <Text style={{ fontSize: 24 }}>⭐</Text>
        </View>
        <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, textAlign: "right" }}>
          Points
        </Text>
        <Text style={{ color: colors["color-accent-mint"], fontSize: TYPOGRAPHY.label.fontSize, textAlign: "right" }}>
          +35 this week
        </Text>
      </Surface>
      {/* WS-0 round 3, finding 2: seven chips used to wrap to MON TUE WED THU FRI
          / SAT SUN — two ragged rows. A wrapped chip strip is not a baseline, so
          the row is nowrap and each chip takes an equal, shrinkable share with
          a single-line label. */}
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "nowrap" }} testID="specimen-week-strip">
        {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((d, i) => (
          // the ROW owns the distribution (each cell flex:1 / minWidth:0) and the
          // chip fills its share, so seven labels can only ever land on ONE
          // baseline — a wrapping strip was two ragged rows.
          <View key={d} testID="specimen-week-chip" style={{ flex: 1, minWidth: 0 }}>
            <Chip
              label={
                <Text numberOfLines={1} style={{ textAlign: "center" }}>
                  {d}
                </Text>
              }
              tone={i === 0 ? "accent" : "neutral"}
              selected={i === 0}
              as="span"
              size="sm"
              style={{ flex: 1, paddingHorizontal: 4 }}
            />
          </View>
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
            {/* WS-0 round 3, finding 10: the reference swatch is
                linear-gradient(135deg, accent.hex, accent.glow) — a flat fill
                reads as a colour chip, not as lit glass. */}
            <View style={{ height: 56, borderRadius: 16, overflow: "hidden", borderWidth: accent === a ? 3 : 0, borderColor: colors["color-text-primary"] }}>
              <LinearGradient
                testID="specimen-swatch-fill"
                colors={[ACCENTS[theme][a], mix(ACCENTS[theme][a], colors["color-primary-foreground"], 28)]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ flex: 1 }}
              />
            </View>
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
          <SignedOutBanner
            testID="showcase-guest-affordance"
            title="Signed out — read-only preview"
            message="Specimens only: no family data, no writes. Sign in with your PIN to edit."
            style={{ marginTop: 16, marginBottom: 20, padding: 16 }}
          />
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
