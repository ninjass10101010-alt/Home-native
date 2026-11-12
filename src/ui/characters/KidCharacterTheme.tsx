import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../theme/ThemeProvider";
import { Material } from "../../theme/Material";
import { ACCENTS, MIN_TARGET_DP, RADII, TYPOGRAPHY } from "../../theme/tokens";
import { mix } from "../../theme/mix";
import { Modal } from "../Modal";
import { SoftButton } from "../SoftButton";
import { CharacterEmblem } from "../CelebrationOverlay";
import {
  assignCharacterToMember,
  charactersForFranchise,
  FRANCHISE_OPTIONS,
  resolveCharacterForMember,
  useCharacterTheme,
  type CharacterFranchise,
} from "../../theme/characterTheme";
import type { KidCharacterSkin } from "../../theme/kidCharacter";

/**
 * Kid character skin for the SHARED Home + Tasks pages.
 *
 * Three pieces, all keyed off `useKidCharacter()` (null for adults):
 *   - CharacterMotifBackdrop — a soft accent wash + scattered character glyphs
 *     behind a page header (decorative, hidden from screen readers, no touch).
 *   - KidCharacterHero — the kid's character greeting (emblem + quote). Tapping
 *     the emblem opens the picker. `compact` fits beside the Home greeting.
 *   - CharacterPickerSheet — the kid picks their own character in place.
 *
 * Layout never changes: the page keeps its widgets/rows; only color, a header
 * backdrop, and the hero are added — so it still feels like the same page.
 */

/** Scattered motif glyph positions (percent of the backdrop), deterministic. */
const GLYPH_SPOTS: readonly { top: string; left: string; size: number; rotate: string; opacity: number }[] = [
  { top: "8%", left: "4%", size: 34, rotate: "-12deg", opacity: 0.16 },
  { top: "18%", left: "28%", size: 22, rotate: "8deg", opacity: 0.1 },
  { top: "6%", left: "52%", size: 28, rotate: "-4deg", opacity: 0.12 },
  { top: "22%", left: "76%", size: 36, rotate: "14deg", opacity: 0.14 },
  { top: "52%", left: "14%", size: 24, rotate: "10deg", opacity: 0.1 },
  { top: "60%", left: "44%", size: 32, rotate: "-16deg", opacity: 0.12 },
  { top: "48%", left: "64%", size: 22, rotate: "6deg", opacity: 0.1 },
  { top: "70%", left: "88%", size: 28, rotate: "-8deg", opacity: 0.14 },
];

export function CharacterMotifBackdrop({
  skin,
  height,
  testID = "kid-character-backdrop",
}: {
  skin: KidCharacterSkin;
  /** Backdrop height in dp; omit to fill the parent. */
  height?: number;
  testID?: string;
}) {
  const glyph = skin.character.badgeGlyph;
  return (
    <View
      testID={testID}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        ...(height != null ? { height } : { bottom: 0 }),
        overflow: "hidden",
      }}
    >
      <LinearGradient
        colors={[
          mix(skin.accentHex, "transparent", 26),
          mix(skin.accentHex, "transparent", 10),
          mix(skin.accentHex, "transparent", 0),
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.4, y: 1 }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />
      {GLYPH_SPOTS.map((s, i) => (
        <Text
          key={i}
          style={{
            position: "absolute",
            top: s.top as `${number}%`,
            left: s.left as `${number}%`,
            fontSize: s.size,
            opacity: s.opacity,
            transform: [{ rotate: s.rotate }],
          }}
        >
          {glyph}
        </Text>
      ))}
    </View>
  );
}

export function CharacterPickerSheet({
  visible,
  onClose,
  memberName,
}: {
  visible: boolean;
  onClose: () => void;
  memberName: string;
}) {
  const { colors, theme } = useTheme();
  const [prefs] = useCharacterTheme();
  // The parent's pack filter (Settings) decides which worlds a kid sees; a kid
  // can still browse the other worlds inside that set.
  const [world, setWorld] = useState<CharacterFranchise>(prefs.franchise);
  const palette = ACCENTS[theme === "light" ? "light" : "dark"];
  const worlds = prefs.franchise === "all" ? FRANCHISE_OPTIONS : FRANCHISE_OPTIONS.filter((f) => f.id === prefs.franchise);
  const activeWorld = worlds.some((w) => w.id === world) ? world : prefs.franchise;
  const choices = charactersForFranchise(activeWorld);
  const currentId = resolveCharacterForMember(memberName, prefs).id;

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={`Pick your character, ${memberName.split(" ")[0]}`}
      description="Your character colors your Home and Tasks pages and cheers when you finish chores."
      testID="kid-character-picker"
    >
      {worlds.length > 1 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          {worlds.map((f) => {
            const on = activeWorld === f.id;
            return (
              <Pressable
                key={f.id}
                testID={`kid-character-world-${f.id}`}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`Show ${f.label} characters`}
                onPress={() => setWorld(f.id)}
                style={{
                  minHeight: MIN_TARGET_DP,
                  paddingHorizontal: 16,
                  borderRadius: RADII.pill,
                  justifyContent: "center",
                  backgroundColor: on ? mix(colors["color-accent-selected"], colors["color-surface-2"], 30) : colors["color-surface-1"],
                  borderWidth: on ? 2 : 1,
                  borderColor: on ? colors["color-accent-selected"] : colors["color-border"],
                }}
              >
                <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: on ? "700" : "500" }}>
                  {f.badge} {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {choices.map((c) => {
          const selected = currentId === c.id;
          const cHex = palette[c.accentKey] ?? colors["color-accent-selected"];
          return (
            <Pressable
              key={c.id}
              testID={`kid-character-pick-${c.id}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`Choose ${c.name} from ${c.franchiseLabel}`}
              onPress={() => {
                void assignCharacterToMember(memberName, c.id);
                onClose();
              }}
              style={{
                width: "23%",
                minHeight: 128,
                minWidth: MIN_TARGET_DP,
                borderRadius: RADII.lg,
                paddingVertical: 12,
                paddingHorizontal: 6,
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                backgroundColor: selected ? mix(cHex, colors["color-surface-2"], 30) : colors["color-surface-1"],
                borderWidth: selected ? 2 : 1,
                borderColor: selected ? cHex : colors["color-border"],
              }}
            >
              <CharacterEmblem motif={c.motif} accentHex={cHex} inkHex={colors["color-text-primary"]} size={60} animated={selected} />
              <Text numberOfLines={1} style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
                {c.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Modal>
  );
}

/**
 * The kid's character greeting.
 * - `compact` (Home): emblem + speech bubble, sized to sit in the greeting row.
 * - default (Tasks): full-width banner card with the cheer and a change button.
 */
export function KidCharacterHero({ skin, compact = false }: { skin: KidCharacterSkin; compact?: boolean }) {
  const { colors } = useTheme();
  const [pickerOpen, setPickerOpen] = useState(false);
  const { character, accentHex, memberName } = skin;
  const firstName = memberName.split(" ")[0];
  const eyebrow = `${character.franchiseLabel.toUpperCase()} · ${character.name.toUpperCase()}`;

  const emblem = (size: number) => (
    <Pressable
      testID="kid-character-emblem"
      accessibilityRole="button"
      accessibilityLabel={`${character.name} is your character. Tap to pick a different character.`}
      onPress={() => setPickerOpen(true)}
      hitSlop={8}
      style={{ minWidth: MIN_TARGET_DP, minHeight: MIN_TARGET_DP, alignItems: "center", justifyContent: "center" }}
    >
      <CharacterEmblem motif={character.motif} accentHex={accentHex} inkHex={colors["color-text-primary"]} size={size} animated />
    </Pressable>
  );

  const picker = (
    <CharacterPickerSheet visible={pickerOpen} onClose={() => setPickerOpen(false)} memberName={memberName} />
  );

  if (compact) {
    return (
      <View testID="kid-character-hero" style={{ flexDirection: "row", alignItems: "center", gap: 10, maxWidth: 440, flexShrink: 1 }}>
        {emblem(80)}
        <View
          style={{
            flexShrink: 1,
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: RADII.lg,
            borderTopLeftRadius: 6,
            backgroundColor: mix(accentHex, colors["color-surface-1"], 16),
            borderWidth: 1,
            borderColor: mix(accentHex, colors["color-border"], 45),
          }}
        >
          <Text numberOfLines={1} style={{ color: accentHex, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "800", letterSpacing: 1.4 }}>
            {eyebrow}
          </Text>
          <Text numberOfLines={2} style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "600", marginTop: 2 }}>
            {`${character.badgeGlyph} ${character.screensaverScene.quote}`}
          </Text>
        </View>
        {picker}
      </View>
    );
  }

  return (
    <Material
      tier="thin"
      tone={accentHex}
      testID="kid-character-hero"
      style={{
        borderRadius: RADII.xl,
        paddingHorizontal: 20,
        paddingVertical: 16,
        flexDirection: "row",
        alignItems: "center",
        gap: 18,
        borderWidth: 1.5,
        borderColor: mix(accentHex, colors["color-border"], 50),
        overflow: "hidden",
      }}
    >
      <CharacterMotifBackdrop skin={skin} testID="kid-character-hero-backdrop" />
      {emblem(96)}
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Text numberOfLines={1} style={{ color: accentHex, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "800", letterSpacing: 1.6 }}>
          {eyebrow}
        </Text>
        <Text numberOfLines={1} style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.title.fontSize, fontWeight: "700" }}>
          {`${firstName}'s quest board`}
        </Text>
        <Text numberOfLines={2} style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.body.fontSize, fontStyle: "italic" }}>
          {`${character.badgeGlyph} "${character.choreCheer}"`}
        </Text>
      </View>
      <SoftButton
        variant="secondary"
        size="sm"
        testID="kid-character-change"
        accessibilityLabel="Pick a different character"
        onPress={() => setPickerOpen(true)}
        style={{ minHeight: MIN_TARGET_DP }}
      >
        Change ✨
      </SoftButton>
      {picker}
    </Material>
  );
}

