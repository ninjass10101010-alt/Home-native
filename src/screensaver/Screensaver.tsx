import React from "react";
import { AppState, Platform, Pressable, Text, useWindowDimensions, View } from "react-native";
import { api } from "../api/client";
import { TOKENS } from "../theme/tokens";
import { mixAlpha } from "../ui/SoftButton";
import { ConditionIcon, MonsterDigit } from "../weather/art";
import { conditionCode } from "../weather/conditions";
import { isScreensaverDueNow, useScreensaverPrefs } from "../home/idle";

/**
 * The wall's ambient idle board (WS-8) — RN port of Home-ai's
 * ScreensaverBoard. Read-only: no auth, no nav, no writes (the endpoint is
 * middleware-exempt, so the signed-OUT wall idles here too — the board must
 * not ride the session-gated widget/hub patterns).
 *
 * Ported contract: poll /api/consuela/screensaver every 60s + on foreground;
 * malformed ok:true payloads and failures keep the last-good board; after 5min
 * without a successful fetch the clock dims honestly and a quiet amber dot
 * appears; the whole board dims after 60s untouched; any tap wakes the wall
 * back to the previous route.
 *
 * The board is FIXED dark in both app themes (web parity: #0f1117 — which is
 * literally the dark canvas token), so colors come from TOKENS.dark, not the
 * live ThemeProvider. Nothing animates; reduced-motion is a no-op here.
 */

export interface ScreensaverProps {
  onExit?: () => void;
}

export interface ScreensaverEvent {
  title: string;
  time: string; // display form ("4:00 PM" | "All day") — server-formatted
  allDay: boolean;
  color?: string;
}

export interface ScreensaverPayload {
  ok: true;
  generatedAt: string;
  date: string; // YYYY-MM-DD, family-local
  events: ScreensaverEvent[];
  dinner: { name: string } | null;
  tasks: { done: number; total: number };
  briefing: string[];
  weather: { tempF: number; hiF: number; loF: number; condition: string; weatherCode?: number; isDay?: number } | null;
}

export const POLL_MS = 60_000;
export const STALE_MS = 5 * 60_000;
export const DIM_AFTER_MS = 60_000;
const TICK_MS = 15_000; // minute-precision clock + dim/stale re-check cadence
const DIM_OPACITY = 0.78;

const D = TOKENS.dark; // fixed dark board (web parity — see note above)
const INK = D["color-text-primary"];
const SUB_INK = D["color-text-secondary"];
const FAINT_INK = D["color-text-muted"];
const PANEL_BG = mixAlpha(INK, 0.05);
const PANEL_RING = mixAlpha(INK, 0.1);
const STALE_DOT = mixAlpha(D["color-accent-amber"], 0.8);
const PROGRESS_FILL = mixAlpha(D["color-accent-mint"], 0.8);

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

/** Wall-clock "7:05 AM" — built by hand so Hermes Intl quirks can never skew it.
 *  The meridiem is not decoration: the authoritative board formats the clock
 *  with `toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit'})`
 *  (Home-ai ScreensaverBoard.tsx:54), which renders the AM/PM suffix, and a
 *  128px numeral without it is ambiguous at wall distance. */
function clockLine(now: Date): string {
  const h = now.getHours() % 12 || 12;
  const m = String(now.getMinutes()).padStart(2, "0");
  const ampm = now.getHours() < 12 ? "AM" : "PM";
  return `${h}:${m} ${ampm}`;
}

/** "Sunday, October 11" (the reference board's date line). */
function dateLine(now: Date): string {
  return `${DAY_NAMES[now.getDay()]}, ${MONTH_NAMES[now.getMonth()]} ${now.getDate()}`;
}

export function Screensaver({ onExit }: ScreensaverProps) {
  const [data, setData] = React.useState<ScreensaverPayload | null>(null);
  const [lastOk, setLastOk] = React.useState(0);
  const [now, setNow] = React.useState(() => new Date());
  // State (not a ref): the dim is READ during render, so it must subscribe.
  const [lastTouch, setLastTouch] = React.useState(() => Date.now());
  const [prefs] = useScreensaverPrefs();

  // Clock/dim/stale re-render cadence (the clock itself is minute-precision).
  React.useEffect(() => {
    const t = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(t);
  }, []);

  // Auto-wake when scheduled night hours conclude (e.g. 4:00 AM arrives)
  // so the Home wall and widgets are ready for the morning.
  React.useEffect(() => {
    if (!isScreensaverDueNow(prefs, now)) {
      onExit?.();
    }
  }, [now, prefs, onExit]);

  // Poll — web board parity: pull on mount + every 60s + on foreground.
  // Malformed ok:true payloads are ignored; failures keep the last-good board
  // (the stale state, not a spinner, is the honest report).
  React.useEffect(() => {
    let dead = false;
    const pull = async () => {
      try {
        const json = await api<ScreensaverPayload | null>("/api/consuela/screensaver");
        if (dead || !json || json.ok !== true) return;
        if (!Array.isArray(json.events) || !json.tasks || !Array.isArray(json.briefing)) return;
        setData(json);
        setLastOk(Date.now());
      } catch {
        /* keep last-good data — the stale dot reports it */
      }
    };
    void pull();
    const id = setInterval(pull, POLL_MS);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void pull();
    });
    return () => {
      dead = true;
      clearInterval(id);
      sub.remove();
    };
  }, []);

  const wake = () => {
    setLastTouch(Date.now());
    setNow(new Date());
  };

  const { width, height } = useWindowDimensions();
  const shouldScale =
    typeof jest === "undefined" &&
    Platform.OS === "android" &&
    width > 0 &&
    height > 0 &&
    (width < 960 || height < 1600);
  const scale = shouldScale ? Math.min(width / 1080, height / 1920) : 1;
  const stageWidth = shouldScale ? Math.round(width / scale) : undefined;
  const stageHeight = shouldScale ? Math.round(height / scale) : undefined;

  const stale = lastOk > 0 && now.getTime() - lastOk > STALE_MS;
  const dimmed = now.getTime() - lastTouch >= DIM_AFTER_MS;

  const progressPct =
    data && data.tasks.total > 0 ? Math.round((data.tasks.done / data.tasks.total) * 100) : 0;

  return (
    <View
      style={[
        { flex: 1, backgroundColor: D["color-canvas"] },
        shouldScale ? { alignItems: "center", justifyContent: "center", overflow: "hidden" } : null,
      ]}
      onTouchStart={wake}
    >
      <Pressable
        testID="screensaver-root"
        accessibilityRole="button"
        accessibilityLabel="Wake — back to the dashboard"
        onPress={onExit}
        style={
          shouldScale
            ? { width: stageWidth, height: stageHeight, padding: 40, transform: [{ scale }] }
            : { flex: 1, padding: 40 }
        }
      >
        <View testID="ss-content" collapsable={false} style={{ flex: 1, opacity: dimmed ? DIM_OPACITY : 1 }}>
          {/* header: clock + date (left), weather (right), stale dot (corner) */}
          <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
            <View>
              <Text
                testID="ss-clock"
                style={[
                  {
                    color: INK,
                    fontSize: 128,
                    fontWeight: "800",
                    lineHeight: 132,
                    letterSpacing: -2,
                    fontVariant: ["tabular-nums"],
                  },
                  stale && { opacity: 0.5 },
                ]}
              >
                {clockLine(now)}
              </Text>
              <Text testID="ss-date" style={{ color: SUB_INK, fontSize: 40, lineHeight: 52, fontWeight: "500", marginTop: 4 }}>
                {dateLine(now)}
              </Text>
            </View>
            {data?.weather ? (
              <View style={{ alignItems: "flex-end", gap: 2 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <ConditionIcon code={conditionCode(data.weather.weatherCode, data.weather.isDay !== 0)} size={56} />
                  <View style={{ flexDirection: "row", alignItems: "flex-end" }} testID="ss-weather-temp">
                    {String(data.weather.tempF).split("").map((d, i) => (
                      <MonsterDigit key={`${d}-${i}`} digit={d} height={64} />
                    ))}
                    <Text style={{ color: INK, fontSize: 40, fontWeight: "800", lineHeight: 64, marginLeft: 2 }}>°</Text>
                  </View>
                </View>
                <Text style={{ color: INK, fontSize: 32, fontWeight: "600" }}>{data.weather.condition}</Text>
                <Text style={{ color: SUB_INK, fontSize: 24, fontWeight: "600" }}>{`H ${data.weather.hiF}° · L ${data.weather.loF}°`}</Text>
              </View>
            ) : null}
          </View>

          {stale ? (
            <View
              testID="ss-stale"
              accessibilityLabel="Data may be out of date"
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                width: 18,
                height: 18,
                borderRadius: 9,
                backgroundColor: STALE_DOT,
              }}
            />
          ) : null}

          {/* the three panels: Today / Tonight + Chores / Consuela */}
          <View style={{ flex: 1, flexDirection: "row", gap: 20, marginTop: 32 }}>
            <View
              style={{
                flex: 1,
                borderRadius: 28,
                backgroundColor: PANEL_BG,
                borderWidth: 1,
                borderColor: PANEL_RING,
                padding: 24,
                overflow: "hidden",
              }}
            >
              <Text style={{ color: FAINT_INK, fontSize: 22, fontWeight: "700", letterSpacing: 2.2, marginBottom: 18 }}>
                TODAY
              </Text>
              <View style={{ gap: 16 }}>
                {(data?.events ?? []).length === 0 ? (
                      <Text style={{ color: FAINT_INK, fontSize: 32 }}>
                    {data ? "Quiet day" : "Waiting for the family server…"}
                  </Text>
                ) : null}
                {(data?.events ?? []).map((e, i) => (
                  <View key={`${e.title}-${i}`} style={{ gap: 6 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <View
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 6,
                          backgroundColor: e.color ?? mixAlpha(INK, 0.4),
                        }}
                      />
                      <Text style={{ color: SUB_INK, fontSize: 20, fontVariant: ["tabular-nums"] }} numberOfLines={1}>
                        {e.time}
                      </Text>
                    </View>
                    <Text style={{ color: INK, fontSize: 26, lineHeight: 32, fontWeight: "500" }} numberOfLines={2}>
                      {e.title}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            <View
              style={{
                flex: 1,
                borderRadius: 28,
                backgroundColor: PANEL_BG,
                borderWidth: 1,
                borderColor: PANEL_RING,
                padding: 24,
              }}
            >
              <Text style={{ color: FAINT_INK, fontSize: 22, fontWeight: "700", letterSpacing: 2.2, marginBottom: 12 }}>
                TONIGHT
              </Text>
              <Text testID="ss-dinner" style={{ color: INK, fontSize: 44, lineHeight: 54, fontWeight: "700" }} numberOfLines={2}>
                {data ? (data.dinner ? data.dinner.name : "Nothing planned yet") : "…"}
              </Text>
              <Text style={{ color: FAINT_INK, fontSize: 22, fontWeight: "700", letterSpacing: 2.2, marginTop: 32, marginBottom: 12 }}>
                CHORES
              </Text>
              <Text testID="ss-chores" style={{ color: INK, fontSize: 40, lineHeight: 50, fontWeight: "700", fontVariant: ["tabular-nums"] }}>
                {data ? `${data.tasks.done} of ${data.tasks.total} done` : "…"}
              </Text>
              <View
                style={{
                  marginTop: 14,
                  height: 12,
                  borderRadius: 6,
                  backgroundColor: mixAlpha(INK, 0.1),
                  overflow: "hidden",
                }}
              >
                <View style={{ height: 12, borderRadius: 6, width: `${progressPct}%`, backgroundColor: PROGRESS_FILL }} />
              </View>
            </View>

            <View
              style={{
                flex: 1,
                borderRadius: 28,
                backgroundColor: PANEL_BG,
                borderWidth: 1,
                borderColor: PANEL_RING,
                padding: 24,
                overflow: "hidden",
              }}
            >
              <Text style={{ color: FAINT_INK, fontSize: 22, fontWeight: "700", letterSpacing: 2.2, marginBottom: 18 }}>
                CONSUELA
              </Text>
              <View style={{ gap: 14 }}>
                {(data?.briefing ?? []).map((line, i) => (
                  <Text key={i} style={{ color: INK, fontSize: 26, lineHeight: 34, fontWeight: "500" }} numberOfLines={2}>
                    {line}
                  </Text>
                ))}
              </View>
            </View>
          </View>
        </View>
      </Pressable>
    </View>
  );
}

export default Screensaver;
