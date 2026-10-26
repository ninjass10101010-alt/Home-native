import React from "react";
import { Pressable, Text, View } from "react-native";
import { Material } from "../theme/Material";
import { TYPOGRAPHY } from "../theme/tokens";
import { useTheme } from "../theme/ThemeProvider";
import { mix } from "../theme/mix";
import { Chip } from "../ui/Chip";
import { Toggle } from "../ui/Toggle";
import { ALL_WIDGETS, WALL_CONFIGURABLE_WIDGETS, type WidgetId, type WallSpan } from "../home/widgets";
import {
  layoutCells,
  layoutSpan,
  useWallLayout,
  WALL_CELLS,
  type WallLayout,
} from "../home/wallLayout";

/**
 * Settings → Home — the wall's own arrangement.
 *
 * The board is a fixed 3x4 grid (12 cells) that never scrolls, so the SIZE of
 * a widget is a decision about the family's space: a widget takes one cell, or
 * two (two rows of one column - the photo hero's shape). The board is full
 * today, so making a widget bigger has to come from somewhere: this panel
 * therefore edits the sizes and the on/off switches TOGETHER, and shows the
 * cell budget as it changes ("9 of 12 cells used"), so the family can see
 * what a change costs before they make it.
 *
 * A change that would need more than 12 cells is REFUSED (the control is
 * disabled and the reason is said) rather than dropping a widget off the
 * bottom of the wall.
 */

const SIZE_OPTIONS: { span: WallSpan; label: string }[] = [
  { span: 1, label: "1 cell" },
  { span: 2, label: "2 cells" },
];

function widgetLabel(id: WidgetId): string {
  return ALL_WIDGETS.find((w) => w.id === id)?.label ?? id;
}

function widgetEmoji(id: WidgetId): string {
  return ALL_WIDGETS.find((w) => w.id === id)?.emoji ?? "•";
}

export function HomeSection() {
  const { colors } = useTheme();
  const { layout, setLayout, reset: resetLayout } = useWallLayout();
  const cells = layoutCells(layout);

  /** Apply a new layout, and say why it was refused when it does not fit. */
  const apply = (next: WallLayout): boolean => setLayout(next);

  const setSpan = (id: WidgetId, span: WallSpan) => {
    apply({ ...layout, spans: { ...layout.spans, [id]: span } });
  };

  const setHidden = (id: WidgetId, hidden: boolean) => {
    const next = hidden
      ? { ...layout, hidden: [...layout.hidden, id] }
      : { ...layout, hidden: layout.hidden.filter((x) => x !== id) };
    apply(next);
  };

  const reset = () => {
    resetLayout();
  };

  return (
    <View style={{ gap: 16 }}>
      <Material tier="regular" style={{ borderRadius: 28, padding: 24, gap: 18 }}>
        <View style={{ gap: 4 }}>
          <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.title.fontSize, fontWeight: "700" }}>
            Widget layout
          </Text>
          <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.body.fontSize }}>
            Choose how much of the wall each widget takes. The board is {WALL_CELLS} cells and never scrolls.
          </Text>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <Text
            testID="wall-layout-cells"
            style={{ color: cells.free === 0 ? colors["color-text-secondary"] : colors["color-accent-amber"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}
          >
            {cells.used} of {WALL_CELLS} cells used
            {cells.free > 0 ? ` · ${cells.free} free` : ""}
          </Text>
          <Pressable
            testID="wall-layout-reset"
            accessibilityRole="button"
            accessibilityLabel="Reset the widget layout"
            onPress={reset}
            style={{ minHeight: 44, justifyContent: "center" }}
          >
            <Text style={{ color: colors["color-accent-selected"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "700" }}>
              Reset
            </Text>
          </Pressable>
        </View>

        <Text
          testID="wall-layout-hint"
          style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize }}
        >
          {cells.free === 0
            ? "The board is full. Turn a widget off to give another one more room."
            : `${cells.free} ${cells.free === 1 ? "cell is" : "cells are"} free — a widget can grow into it.`}
        </Text>

        {/* Dynamic Activity Layout Toggle */}
        <View
          testID="wall-layout-auto-arrange"
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            paddingVertical: 14,
            paddingHorizontal: 16,
            borderRadius: 20,
            backgroundColor: mix(colors["color-accent-selected"] ?? colors["color-text-primary"], "transparent", 8),
            borderWidth: 1,
            borderColor: mix(colors["color-accent-selected"] ?? colors["color-text-primary"], "transparent", 20),
          }}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontSize: 18 }}>⚡</Text>
              <Text
                style={{
                  color: colors["color-text-primary"],
                  fontSize: TYPOGRAPHY.body.fontSize,
                  fontWeight: "700",
                }}
              >
                Auto-arrange by activity
              </Text>
            </View>
            <Text
              style={{
                color: colors["color-text-secondary"],
                fontSize: TYPOGRAPHY.label.fontSize,
                lineHeight: 18,
              }}
            >
              Automatically expand active widgets (like pending tasks or upcoming events) and shrink idle ones to keep the most important things in view.
            </Text>
          </View>
          <Toggle
            testID="wall-layout-auto-arrange-toggle"
            value={Boolean(layout.autoArrange)}
            onChange={(enabled) => apply({ ...layout, autoArrange: enabled })}
            accessibilityLabel="Auto-arrange widgets by activity"
          />
        </View>

        <View style={{ gap: 10 }}>
          {WALL_CONFIGURABLE_WIDGETS.map((id) => {
            const hidden = layout.hidden.includes(id);
            const span = layoutSpan(layout, id);
            // A size change is only offered when the board can carry it.
            const trial = { ...layout, spans: { ...layout.spans, [id]: span === 1 ? 2 : 1 } };
            const trialCells = layoutCells(trial);
            const blocked = trialCells.used > WALL_CELLS;
            return (
              <View
                key={id}
                testID={`wall-layout-row-${id}`}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingVertical: 10,
                  borderTopWidth: 1,
                  borderTopColor: colors["color-border"] ?? "transparent",
                }}
              >
                <Text style={{ fontSize: 22 }}>{widgetEmoji(id)}</Text>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    numberOfLines={1}
                    style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "600" }}
                  >
                    {widgetLabel(id)}
                  </Text>
                  {blocked && !hidden ? (
                    <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize }}>
                      {span === 1 ? "Bigger needs a free cell" : "Smaller frees a cell"}
                    </Text>
                  ) : null}
                </View>
                <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                  {SIZE_OPTIONS.map((option) => (
                    <Chip
                      key={option.span}
                      testID={`wall-layout-size-${id}-${option.span}`}
                      label={option.label}
                      tone={span === option.span ? "accent" : "neutral"}
                      selected={span === option.span}
                      disabled={hidden || (option.span !== span && blocked)}
                      onPress={() => setSpan(id, option.span)}
                    />
                  ))}
                </View>
                <Toggle
                  testID={`wall-layout-visible-${id}`}
                  value={!hidden}
                  onChange={(on) => setHidden(id, !on)}
                  accessibilityLabel={`Show ${widgetLabel(id)} on the wall`}
                />
              </View>
            );
          })}
        </View>
      </Material>
    </View>
  );
}

export default HomeSection;
