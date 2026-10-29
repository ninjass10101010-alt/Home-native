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
import { formatHour, useScreensaverPrefs } from "../home/idle";

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
  const [screensaverPrefs, setScreensaverPrefs] = useScreensaverPrefs();
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

        {/* Screensaver when inactive */}
        <View
          testID="wall-screensaver-setting"
          style={{
            flexDirection: "column",
            gap: 14,
            paddingVertical: 18,
            paddingHorizontal: 18,
            borderRadius: 20,
            backgroundColor: mix(colors["color-accent-selected"] ?? colors["color-text-primary"], "transparent", 8),
            borderWidth: 1,
            borderColor: mix(colors["color-accent-selected"] ?? colors["color-text-primary"], "transparent", 20),
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
            }}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ fontSize: 18 }}>🌙</Text>
                <Text
                  style={{
                    color: colors["color-text-primary"],
                    fontSize: TYPOGRAPHY.body.fontSize,
                    fontWeight: "700",
                  }}
                >
                  Screensaver when inactive
                </Text>
              </View>
              <Text
                style={{
                  color: colors["color-text-secondary"],
                  fontSize: TYPOGRAPHY.label.fontSize,
                  lineHeight: 18,
                }}
              >
                {screensaverPrefs.mode === "off"
                  ? "Screensaver is turned off. The Home wall stays awake with your widgets visible."
                  : screensaverPrefs.mode === "night"
                  ? `Active at night from ${formatHour(screensaverPrefs.startHour)} to ${formatHour(screensaverPrefs.endHour)}. Automatically wakes at ${formatHour(screensaverPrefs.endHour)} for the day.`
                  : "Active anytime after 90 seconds of quiet on the Home wall."}
              </Text>
            </View>
            <Toggle
              testID="wall-screensaver-toggle"
              value={screensaverPrefs.mode !== "off"}
              onChange={(on) =>
                setScreensaverPrefs((p) => ({
                  ...p,
                  mode: on ? (p.mode === "off" ? "night" : p.mode) : "off",
                }))
              }
              accessibilityLabel="Screensaver when inactive"
            />
          </View>

          {screensaverPrefs.mode !== "off" ? (
            <View
              style={{
                gap: 12,
                paddingTop: 12,
                borderTopWidth: 1,
                borderTopColor: mix(colors["color-border"] ?? "transparent", "transparent", 40),
              }}
            >
              {/* Schedule Mode Selector: Night schedule vs All day */}
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <Text style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "600" }}>
                  Active schedule
                </Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Chip
                    testID="screensaver-mode-night"
                    label="Night schedule"
                    tone={screensaverPrefs.mode === "night" ? "accent" : "neutral"}
                    selected={screensaverPrefs.mode === "night"}
                    onPress={() => setScreensaverPrefs((p) => ({ ...p, mode: "night" }))}
                  />
                  <Chip
                    testID="screensaver-mode-always"
                    label="All day"
                    tone={screensaverPrefs.mode === "always" ? "accent" : "neutral"}
                    selected={screensaverPrefs.mode === "always"}
                    onPress={() => setScreensaverPrefs((p) => ({ ...p, mode: "always" }))}
                  />
                </View>
              </View>

              {/* Night Schedule Controls (when night mode selected) */}
              {screensaverPrefs.mode === "night" ? (
                <View style={{ gap: 10, paddingTop: 4 }}>
                  {/* Preset Buttons */}
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                    <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize }}>
                      Presets:
                    </Text>
                    {[
                      { label: "11 PM – 4 AM", start: 23, end: 4 },
                      { label: "10 PM – 6 AM", start: 22, end: 6 },
                      { label: "11 PM – 7 AM", start: 23, end: 7 },
                    ].map((preset) => {
                      const selected =
                        screensaverPrefs.startHour === preset.start &&
                        screensaverPrefs.endHour === preset.end;
                      return (
                        <Chip
                          key={preset.label}
                          testID={`screensaver-preset-${preset.start}-${preset.end}`}
                          label={preset.label}
                          tone={selected ? "accent" : "neutral"}
                          selected={selected}
                          onPress={() =>
                            setScreensaverPrefs((p) => ({
                              ...p,
                              startHour: preset.start,
                              endHour: preset.end,
                            }))
                          }
                        />
                      );
                    })}
                  </View>

                  {/* Start / End hour steppers */}
                  <View style={{ flexDirection: "row", gap: 16, marginTop: 4 }}>
                    {/* Start Time */}
                    <View
                      style={{
                        flex: 1,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        backgroundColor: mix(colors["color-surface-2"] ?? colors["color-text-primary"], "transparent", 20),
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 14,
                      }}
                    >
                      <View>
                        <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "600" }}>STARTS</Text>
                        <Text testID="screensaver-start-hour-text" style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
                          {formatHour(screensaverPrefs.startHour)}
                        </Text>
                      </View>
                      <View style={{ flexDirection: "row", gap: 6 }}>
                        <Pressable
                          testID="screensaver-start-prev"
                          onPress={() => setScreensaverPrefs((p) => ({ ...p, startHour: (p.startHour + 23) % 24 }))}
                          accessibilityLabel="Earlier start hour"
                          style={{ minWidth: 36, minHeight: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: mix(colors["color-text-primary"], "transparent", 10) }}
                        >
                          <Text style={{ color: colors["color-text-primary"], fontSize: 16, fontWeight: "700" }}>−</Text>
                        </Pressable>
                        <Pressable
                          testID="screensaver-start-next"
                          onPress={() => setScreensaverPrefs((p) => ({ ...p, startHour: (p.startHour + 1) % 24 }))}
                          accessibilityLabel="Later start hour"
                          style={{ minWidth: 36, minHeight: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: mix(colors["color-text-primary"], "transparent", 10) }}
                        >
                          <Text style={{ color: colors["color-text-primary"], fontSize: 16, fontWeight: "700" }}>+</Text>
                        </Pressable>
                      </View>
                    </View>

                    {/* End Time */}
                    <View
                      style={{
                        flex: 1,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        backgroundColor: mix(colors["color-surface-2"] ?? colors["color-text-primary"], "transparent", 20),
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 14,
                      }}
                    >
                      <View>
                        <Text style={{ color: colors["color-text-muted"], fontSize: TYPOGRAPHY.label.fontSize, fontWeight: "600" }}>WAKES AT</Text>
                        <Text testID="screensaver-end-hour-text" style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.body.fontSize, fontWeight: "700" }}>
                          {formatHour(screensaverPrefs.endHour)}
                        </Text>
                      </View>
                      <View style={{ flexDirection: "row", gap: 6 }}>
                        <Pressable
                          testID="screensaver-end-prev"
                          onPress={() => setScreensaverPrefs((p) => ({ ...p, endHour: (p.endHour + 23) % 24 }))}
                          accessibilityLabel="Earlier wake hour"
                          style={{ minWidth: 36, minHeight: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: mix(colors["color-text-primary"], "transparent", 10) }}
                        >
                          <Text style={{ color: colors["color-text-primary"], fontSize: 16, fontWeight: "700" }}>−</Text>
                        </Pressable>
                        <Pressable
                          testID="screensaver-end-next"
                          onPress={() => setScreensaverPrefs((p) => ({ ...p, endHour: (p.endHour + 1) % 24 }))}
                          accessibilityLabel="Later wake hour"
                          style={{ minWidth: 36, minHeight: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: mix(colors["color-text-primary"], "transparent", 10) }}
                        >
                          <Text style={{ color: colors["color-text-primary"], fontSize: 16, fontWeight: "700" }}>+</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}
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
