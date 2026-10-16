import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";
import { mix } from "../../theme/mix";

/**
 * The household clock as a hairline — port of Home-ai patterns/DayLine.tsx.
 * A text-primary rail, a tone fill consumed up to now, one dot per event at
 * its clock minute, and the now-dot in its glow ring.
 *
 * Ported from the web and now SHARED: Today's Events paints its event markers
 * (the day's appointments) and Tasks paints its bare row band (the web's
 * `<DayLine tone="#f43f5e" />`), so one implementation carries both.
 *
 * Decorative by design — the same facts exist as real text in the rows — so
 * it is hidden from assistive tech. There is no Animated node here at all:
 * fill/now are discrete 30s state ticks, so reduceMotion needs no branch
 * (nothing ever transitions).
 */

/** Marker positions closer than MIN_GAP % of the width merge into a blob —
 *  nudge them apart, deterministically (web DayLine `spread`). */
const DAYLINE_MIN_GAP = 2.2;
function spreadMarkers(markers: { position: number; color: string }[]): { position: number; color: string }[] {
  const sorted = [...markers].sort((a, b) => a.position - b.position);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].position - sorted[i - 1].position < DAYLINE_MIN_GAP) {
      sorted[i] = {
        ...sorted[i],
        position: Math.min(100 - (sorted.length - 1 - i) * DAYLINE_MIN_GAP, sorted[i - 1].position + DAYLINE_MIN_GAP),
      };
    }
  }
  return sorted;
}

export interface DayLineMarker {
  /** 0–100 across the track. */
  position: number;
  color: string;
}

/** minutes since midnight (day mode) for a "HH:MM" string — the day-line's
 *  scale. Callers hand in minutes already scaled to the day's 1440. */
export function minutesNow(): number {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes() + n.getSeconds() / 60;
}

export interface DayLineProps {
  /** Event markers to paint (omit for a bare clock band, as Tasks does). */
  markers?: DayLineMarker[];
  /** The rail/fill/now tone (a widget accent token resolved to a hex). */
  tone: string;
  testID?: string;
  /** Bottom breathing room — Today's Events uses the space the rows need. */
  marginBottom?: number;
}

export function DayLine({ markers = [], tone, testID = "dayline", marginBottom = 10 }: DayLineProps) {
  const { colors } = useTheme();
  const [minuteOfDay, setMinuteOfDay] = useState(() => minutesNow());
  useEffect(() => {
    const id = setInterval(() => setMinuteOfDay(minutesNow()), 30_000);
    return () => clearInterval(id);
  }, []);

  const fraction = Math.max(0, Math.min(1, minuteOfDay / 1440));
  const rail = mix(colors["color-text-primary"], "transparent", 14);
  const fill = mix(tone, "transparent", 62);
  const spread = spreadMarkers(markers);

  return (
    <View
      testID={testID}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ height: 16, marginBottom, justifyContent: "center" }}
    >
      <View style={{ position: "absolute", left: 0, right: 0, height: 1, borderRadius: 1, backgroundColor: rail }} />
      <View
        testID={`${testID}-fill`}
        style={{
          position: "absolute",
          left: 0,
          width: `${fraction * 100}%`,
          height: 2,
          borderRadius: 1,
          backgroundColor: fill,
        }}
      />
      {spread.map((m, i) => (
        <View
          key={`marker-${i}`}
          testID={`${testID}-marker-${i}`}
          style={{
            position: "absolute",
            left: `${m.position}%`,
            width: 5,
            height: 5,
            borderRadius: 3,
            backgroundColor: m.color,
            transform: [{ translateX: -2.5 }],
          }}
        />
      ))}
      {/* now: the tone dot inside its glow ring (the web's box-shadow, hand-built) */}
      <View
        testID={`${testID}-now`}
        style={{
          position: "absolute",
          left: `${fraction * 100}%`,
          width: 13,
          height: 13,
          borderRadius: 7,
          backgroundColor: mix(tone, "transparent", 18),
          alignItems: "center",
          justifyContent: "center",
          transform: [{ translateX: -6.5 }],
        }}
      >
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: tone }} />
      </View>
    </View>
  );
}

export default DayLine;
