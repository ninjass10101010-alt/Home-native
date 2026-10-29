import React from "react";
import Svg, { Circle, G, Path, Rect } from "react-native-svg";
import {
  HOME_WIDGET_ICON_PALETTES,
  HOME_WIDGET_ICON_SHADOW,
  HOME_WIDGET_ICON_SHINE,
  HOME_WIDGET_ICON_VARIANTS,
  type HomeWidgetIconPalette,
  type HomeWidgetIconVariant,
} from "../theme/materials";
import { mix } from "../theme/mix";
import { useTheme } from "../theme/ThemeProvider";
import { WidgetIconMotion } from "./widgetIconMotion";

export { HOME_WIDGET_ICON_VARIANTS, type HomeWidgetIconVariant };

export type HomeWidgetIconState = "default" | "near" | "unread" | "on" | "attention";
export type HomeWidgetIconSize = "sm" | "md" | "lg";

export interface HomeWidgetIconProps {
  variant: HomeWidgetIconVariant;
  state?: HomeWidgetIconState;
  size?: HomeWidgetIconSize | number;
  title?: string;
}

const SIZE_PX: Record<HomeWidgetIconSize, number> = {
  sm: 32,
  md: 44,
  lg: 56,
};

function accentOpacity(state?: HomeWidgetIconState): number {
  return state && state !== "default" ? 0.95 : 0.6;
}

export function widgetIconVariantFor(id: string): HomeWidgetIconVariant | null {
  switch (id) {
    case "morningBriefing":
    case "briefing":
      return "briefing";
    case "aiQuickAsk":
    case "ask":
      return "ask";
    case "suggestions":
      return "suggestions";
    case "leaderboard":
      return "leaderboard";
    case "todayEvents":
    case "events":
      return "events";
    case "schedule":
      return "schedule";
    case "currentMeal":
    case "meal":
      return "meal";
    case "tasks":
      return "tasks";
    case "week":
      return "week";
    case "homeSecurity":
    case "security":
      return "security";
    case "homeClimate":
    case "climate":
      return "climate";
    case "homeLights":
    case "lights":
      return "lights";
    case "ledger":
      return "ledger";
    case "music":
      return "music";
    default:
      return null;
  }
}

/** Morning Briefing: 3D clay morning sun with rays and halo */
function BriefingSun({ p }: { p: HomeWidgetIconPalette }) {
  return (
    <G>
      {/* Glowing sun halo */}
      <Circle cx="24" cy="20" r={13.5} fill={p.glow} opacity={0.25} />
      {/* Sun rays around (24, 20) */}
      <G origin="24, 20">
        <Path
          d="M24 4.5v4.2M24 31.5v4M8 20.5h4.2M35.8 20.5H40M12.5 9l3 3M32.5 29l3 3M35.5 9l-3 3M15.5 29l-3 3"
          stroke={p.lo}
          strokeWidth="3.6"
          strokeLinecap="round"
          opacity={0.7}
        />
        <Path
          d="M24 4.5v4.2M24 31.5v4M8 20.5h4.2M35.8 20.5H40M12.5 9l3 3M32.5 29l3 3M35.5 9l-3 3M15.5 29l-3 3"
          stroke={p.hi}
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </G>
      {/* 3D Clay Sun sphere */}
      <Circle cx="24" cy="21" r="10.2" fill={p.lo} />
      <Circle cx="24" cy="20" r="9.8" fill={p.mid} />
      <Path
        d="M15 17.5a9.4 9.4 0 0 1 18 0c-3.6-2.4-14.4-2.4-18 0Z"
        fill={p.hi}
        opacity={0.92}
      />
      <Circle cx="20.2" cy="15.8" r="2.2" fill={HOME_WIDGET_ICON_SHINE} opacity={0.88} />
      <Circle cx="24" cy="20.4" r="10" fill="none" stroke={p.ink} strokeWidth="1.6" />
    </G>
  );
}

/** Current Meal: rising steam wisps off hot fresh food */
function MealSteam({ p }: { p: HomeWidgetIconPalette }) {
  return (
    <G>
      <G>
        <Path d="M16.5 15c0-3.8 2.8-3.8 2.8-7.6" stroke={p.ink} strokeWidth="4" strokeLinecap="round" opacity={0.28} fill="none" />
        <Path d="M16.5 15c0-3.8 2.8-3.8 2.8-7.6" stroke={HOME_WIDGET_ICON_SHINE} strokeWidth="2.4" strokeLinecap="round" opacity={0.9} fill="none" />
      </G>
      <G>
        <Path d="M23.5 13.8c0-3.8 2.8-3.8 2.8-7.6" stroke={p.ink} strokeWidth="4" strokeLinecap="round" opacity={0.28} fill="none" />
        <Path d="M23.5 13.8c0-3.8 2.8-3.8 2.8-7.6" stroke={HOME_WIDGET_ICON_SHINE} strokeWidth="2.4" strokeLinecap="round" opacity={0.9} fill="none" />
      </G>
      <G>
        <Path d="M30.5 15c0-3.8 2.8-3.8 2.8-7.6" stroke={p.ink} strokeWidth="4" strokeLinecap="round" opacity={0.28} fill="none" />
        <Path d="M30.5 15c0-3.8 2.8-3.8 2.8-7.6" stroke={HOME_WIDGET_ICON_SHINE} strokeWidth="2.4" strokeLinecap="round" opacity={0.9} fill="none" />
      </G>
    </G>
  );
}

/** Music: beamed musical notes */
function MusicNotes({ p }: { p: HomeWidgetIconPalette }) {
  return (
    <G origin="25, 25">
      <Path
        d="M21 32V19.5l10-2.2V29.8"
        stroke={p.ink}
        strokeWidth="4.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M21 32V19.5l10-2.2V29.8"
        stroke={p.detail}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Circle cx="18.8" cy="32.8" r="3.6" fill={p.detail} stroke={p.ink} strokeWidth="1.5" />
      <Circle cx="28.8" cy="30.6" r="3.6" fill={p.detail} stroke={p.ink} strokeWidth="1.5" />
      <Circle cx="17.8" cy="31.8" r="1.1" fill={HOME_WIDGET_ICON_SHINE} opacity={0.9} />
      <Circle cx="27.8" cy="29.6" r="1.1" fill={HOME_WIDGET_ICON_SHINE} opacity={0.9} />
    </G>
  );
}

/** Tasks: completed checkmark victory shimmer */
function TasksCheckmarks({ p }: { p: HomeWidgetIconPalette }) {
  return (
    <G>
      {/* Row 1: check + bar (with ink shadow backing) */}
      <Path
        d="m13 19.5 3 3 6-6"
        stroke={p.ink}
        strokeWidth="4.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity={0.45}
      />
      <Path
        d="m13 19 3 3 6-6"
        stroke={p.hi}
        strokeWidth="3.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Rect x="25" y="17" width="9.5" height="3.6" rx="1.8" fill={p.hi} opacity={0.92} />
      {/* Row 2: golden check + bar */}
      <G origin="16, 32">
        <Path
          d="m13 29.8 3 3 6-6"
          stroke={p.ink}
          strokeWidth="4.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity={0.5}
        />
        <Path
          d="m13 29.2 3 3 6-6"
          stroke={p.detail}
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </G>
      <Rect x="25" y="27.2" width="9.5" height="3.6" rx="1.8" fill={p.hi} opacity={0.78} />
    </G>
  );
}

/** Events: hero date tile */
function EventsHeroTile({ p }: { p: HomeWidgetIconPalette }) {
  return (
    <G origin="25.5, 28">
      <Rect x="20" y="23.5" width="11" height="12" rx="3.5" fill={p.ink} opacity={0.45} />
      <Rect x="20" y="22.5" width="11" height="11" rx="3.5" fill={p.hi} stroke={p.ink} strokeWidth="1.3" />
      <Rect x="21.5" y="23.8" width="8" height="2.2" rx="1.1" fill={HOME_WIDGET_ICON_SHINE} opacity={0.88} />
    </G>
  );
}

/** Lights: warm incandescent bulb glow */
function LightsBulbGlow({ p }: { p: HomeWidgetIconPalette }) {
  return (
    <G>
      <G origin="24, 19.8">
        <Path
          d="M24 4v3.5M24 35v3.5M9.5 20H6M42 20h-3.5M13.8 9.8l2.5 2.5M31.7 27.7l2.5 2.5M34.2 9.8l-2.5 2.5M16.3 27.7l-2.5 2.5"
          stroke={p.lo}
          strokeWidth="3.2"
          strokeLinecap="round"
          opacity={0.65}
        />
        <Path
          d="M24 4v3.5M24 35v3.5M9.5 20H6M42 20h-3.5M13.8 9.8l2.5 2.5M31.7 27.7l2.5 2.5M34.2 9.8l-2.5 2.5M16.3 27.7l-2.5 2.5"
          stroke={p.hi}
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </G>
      <Circle cx="24" cy="19.8" r="14" fill={p.glow} opacity={0.25} />
      <Circle cx="24" cy="19.8" r="12.2" fill={p.mid} opacity={0.8} />
      <Circle cx="24" cy="18.8" r="8.8" fill={p.hi} opacity={0.88} />
      <Circle cx="21" cy="15.5" r="3.2" fill={HOME_WIDGET_ICON_SHINE} opacity={0.9} />
    </G>
  );
}

/** Climate: mercury stem */
function ClimateMercury({ p }: { p: HomeWidgetIconPalette }) {
  return (
    <G>
      <G origin="25, 35">
        <Path d="M25 34V15.5" stroke={p.ink} strokeWidth="5.8" strokeLinecap="round" opacity={0.45} />
        <Path d="M25 34V15.5" stroke={p.detail} strokeWidth="4.2" strokeLinecap="round" />
      </G>
      <Circle cx="25" cy="35" r="5.4" fill={p.detail} stroke={p.ink} strokeWidth="1.4" />
      <Circle cx="23.2" cy="33.2" r="1.8" fill={HOME_WIDGET_ICON_SHINE} opacity={0.85} />
    </G>
  );
}

/** Security: protective shield and padlock */
function SecurityShield({ p }: { p: HomeWidgetIconPalette }) {
  return (
    <G>
      {/* 3D Shield base + mid + specular half + keyline */}
      <Path
        d="M24 3 41 9v13c0 11-7 19-17 23-10-4-17-12-17-23V9L24 3Z"
        fill={p.lo}
        stroke={p.ink}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <Path d="M24 4.2 39.5 9.8v11.8c0 9.8-6.2 17-15.5 20.8-9.3-3.8-15.5-11-15.5-20.8V9.8L24 4.2Z" fill={p.mid} />
      <Path d="M24 5.5 38 10.5v9.5c0 9-5.6 15.6-14 19.4V5.5Z" fill={p.hi} opacity={0.42} />
      <Path d="M24 3.8v39.5" stroke={p.ink} strokeWidth="1.3" opacity={0.35} />
      {/* 3D Gold padlock with glint */}
      <G origin="24, 25">
        <Path
          d="M21 20v-3a3 3 0 0 1 6 0v3"
          stroke={p.ink}
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />
        <Path
          d="M21 20v-3a3 3 0 0 1 6 0v3"
          stroke={p.detail}
          strokeWidth="2.4"
          fill="none"
          strokeLinecap="round"
        />
        <Rect x="18.5" y="20" width="11" height="11.5" rx="3" fill={p.detail} stroke={p.ink} strokeWidth="1.4" />
        <Rect x="20" y="21.2" width="8" height="2" rx="1" fill={HOME_WIDGET_ICON_SHINE} opacity={0.85} />
        <Circle cx="24" cy="25.8" r="1.5" fill={p.ink} />
      </G>
    </G>
  );
}

/** Schedule: clock hands */
function ScheduleClockHands({ p }: { p: HomeWidgetIconPalette }) {
  return (
    <G>
      <Path d="M24 24.5V15" stroke={p.ink} strokeWidth="3.2" strokeLinecap="round" />
      <Path d="M24 24.5l8 5" stroke={p.ink} strokeWidth="3.2" strokeLinecap="round" />
      <Circle cx="24" cy="24.5" r="3" fill={p.detail} stroke={p.ink} strokeWidth="1.2" />
    </G>
  );
}

/** Suggestions: 4-point clay star */
function SuggestionsStars({ p }: { p: HomeWidgetIconPalette }) {
  return (
    <G>
      {/* Primary 4-point clay star */}
      <G origin="20, 16">
        <Path
          d="M20 4c1.6 7.8 4.2 10.4 12 12-7.8 1.6-10.4 4.2-12 12-1.6-7.8-4.2-10.4-12-12 7.8-1.6 10.4-4.2 12-12Z"
          fill={p.lo}
          stroke={p.ink}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <Path
          d="M20 4.5c1.4 7 3.8 9.5 10.8 11-7 1.4-9.4 3.8-10.8 10.8-1.4-7-3.8-9.4-10.8-10.8 7-1.5 9.4-4 10.8-11Z"
          fill={p.mid}
        />
        <Path
          d="M20 6.5c1 4.5 2.5 6 7 7-4.5 1-6 2.5-7 7-1-4.5-2.5-6-7-7 4.5-1 6-2.5 7-7Z"
          fill={p.hi}
          opacity={0.85}
        />
        <Circle cx="18.2" cy="12" r="2" fill={HOME_WIDGET_ICON_SHINE} opacity={0.85} />
      </G>
      {/* Secondary rose star */}
      <G origin="36, 30.7">
        <Path
          d="M36 24c.9 4.4 2.3 5.8 6.7 6.7-4.4.9-5.8 2.3-6.7 6.7-.9-4.4-2.3-5.8-6.7-6.7 4.4-.9 5.8-2.3 6.7-6.7Z"
          fill={p.detail}
          stroke={p.ink}
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <Circle cx="35" cy="29.5" r="1.4" fill={HOME_WIDGET_ICON_SHINE} opacity={0.75} />
      </G>
    </G>
  );
}

/** Week: rhythm columns */
function WeekColumns({ p }: { p: HomeWidgetIconPalette }) {
  return (
    <G>
      <G origin="13.7, 35">
        <Rect x="11" y="28" width="5.5" height="7" rx="2" fill={p.detail} stroke={p.ink} strokeWidth="1.2" />
        <Rect x="12" y="29" width="3.5" height="1.8" rx="0.9" fill={HOME_WIDGET_ICON_SHINE} opacity={0.7} />
      </G>
      <G origin="23.7, 35">
        <Rect x="21" y="22" width="5.5" height="13" rx="2" fill={p.detail} stroke={p.ink} strokeWidth="1.2" />
        <Rect x="22" y="23" width="3.5" height="1.8" rx="0.9" fill={HOME_WIDGET_ICON_SHINE} opacity={0.7} />
      </G>
      <G origin="33.7, 35">
        <Rect x="31" y="25" width="5.5" height="10" rx="2" fill={p.detail} stroke={p.ink} strokeWidth="1.2" />
        <Rect x="32" y="26" width="3.5" height="1.8" rx="0.9" fill={HOME_WIDGET_ICON_SHINE} opacity={0.7} />
      </G>
    </G>
  );
}

/** Ledger: gold coin */
function LedgerCoin({ p }: { p: HomeWidgetIconPalette }) {
  return (
    <G origin="32, 35">
      <Circle cx="32" cy="35" r="7.2" fill={p.detail} stroke={p.ink} strokeWidth="1.5" />
      <Circle cx="30" cy="32.5" r="1.8" fill={HOME_WIDGET_ICON_SHINE} opacity={0.85} />
      <Path
        d="M32 31.5v7M29.8 33.4h4.4M29.8 36.6h4.4"
        stroke={p.ink}
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </G>
  );
}

/** Leaderboard: victory star */
function LeaderboardStar({ p }: { p: HomeWidgetIconPalette }) {
  return (
    <G origin="24, 18">
      <Path
        d="m24 11 2 4.2 4.6.7-3.3 3.2.8 4.6L24 21.6l-4.1 2.1.8-4.6-3.3-3.2 4.6-.7L24 11Z"
        fill={p.detail}
        stroke={p.ink}
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </G>
  );
}

function TypingDot({ cx, cy, r }: { cx: number; cy: number; r: number; index?: number }) {
  return <Circle cx={cx} cy={cy} r={r} />;
}

function LeaderboardShine() {
  return (
    <Rect
      x={15}
      y={9}
      width={5}
      height={13}
      rx={2.5}
      fill={HOME_WIDGET_ICON_SHINE}
      opacity={0.3}
    />
  );
}

function renderArtwork(
  variant: HomeWidgetIconVariant,
  p: HomeWidgetIconPalette,
  accentFill: string,
  state?: HomeWidgetIconState
): React.ReactNode {
  const op = accentOpacity(state);

  switch (variant) {
    case "briefing":
      return (
        <G>
          {/* Ground drop shadow */}
          <Path d="M4 44.5h40v2.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2.5Z" fill={HOME_WIDGET_ICON_SHADOW} opacity={0.28} />
          {/* Sun & rotating rays */}
          <BriefingSun p={p} />
          {/* Back horizon hill */}
          <Path d="M6 41c5-7 11-7.5 17-2.5 5.5 4.5 11.5 4 19-2.5v6H6v-1Z" fill={p.lo} opacity={0.85} />
          {/* Front emerald hill + lit ridge */}
          <Path
            d="M4 40c6-9 12-9 18-2 5 6 12 5 22-2v7H4v-3Z"
            fill={p.detail}
            stroke={p.ink}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <Path
            d="M6 38.5c5-6.2 10-6.2 15.2-.8"
            stroke={HOME_WIDGET_ICON_SHINE}
            strokeWidth="1.8"
            strokeLinecap="round"
            opacity={0.65}
            fill="none"
          />
          <Path d="M4 43h40v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2Z" fill={p.lo} stroke={p.ink} strokeWidth="1.2" />
          <Rect x="32" y="34" width="10" height="10" rx="3" fill={accentFill} opacity={op} stroke={p.ink} strokeWidth="1.2" />
        </G>
      );

    case "ask":
      return (
        <G>
          {/* Ground drop shadow */}
          <Path
            d="M11 10.5h26a6 6 0 0 1 6 6v15a6 6 0 0 1-6 6H24l-9 8v-8a6 6 0 0 1-6-6v-15a6 6 0 0 1 6-6Z"
            fill={HOME_WIDGET_ICON_SHADOW}
            opacity={0.28}
          />
          {/* 3D Clay speech bubble: shaded base -> mid body -> top gloss -> keyline */}
          <Path
            d="M11 8.5h26a6 6 0 0 1 6 6v15a6 6 0 0 1-6 6H24l-9 8v-8a6 6 0 0 1-6-6v-15a6 6 0 0 1 6-6Z"
            fill={p.lo}
            stroke={p.ink}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <Path
            d="M11 8h26a6 6 0 0 1 6 6v13.5a6 6 0 0 1-6 6H23.5L15 40v-6.5a6 6 0 0 1-6-6V14a6 6 0 0 1 6-6Z"
            fill={p.mid}
          />
          <Path
            d="M12 10h24a4.5 4.5 0 0 1 4.5 4.5v2.5c-8-3-20-2.5-28.5 1.5-2.2 1-3.5 1-4.5.5v-4.5A4.5 4.5 0 0 1 12 10Z"
            fill={p.hi}
            opacity={0.75}
          />
          <Path
            d="M14 11.2h18"
            stroke={HOME_WIDGET_ICON_SHINE}
            strokeWidth="1.8"
            strokeLinecap="round"
            opacity={0.7}
          />
          {/* Typing dots with subtle ink shadow */}
          <G fill={p.ink} opacity={0.45}>
            <Circle cx="16" cy="23.2" r="2.8" />
            <Circle cx="24" cy="23.2" r="2.8" />
            <Circle cx="32" cy="23.2" r="2.8" />
          </G>
          <G fill={p.detail}>
            <TypingDot cx={16} cy={22} r={2.7} index={0} />
            <TypingDot cx={24} cy={22} r={2.7} index={1} />
            <TypingDot cx={32} cy={22} r={2.7} index={2} />
          </G>
          <Circle cx="35" cy="34" r="6" fill={accentFill} opacity={op} stroke={p.ink} strokeWidth="1.3" />
        </G>
      );

    case "suggestions":
      return (
        <G>
          {/* Drop shadow */}
          <Path
            d="M20 6c1.6 7.8 4.2 10.4 12 12-7.8 1.6-10.4 4.2-12 12-1.6-7.8-4.2-10.4-12-12 7.8-1.6 10.4-4.2 12-12Z"
            fill={HOME_WIDGET_ICON_SHADOW}
            opacity={0.26}
          />
          <SuggestionsStars p={p} />
          <Circle cx="11" cy="38" r="4.5" fill={accentFill} opacity={op} stroke={p.ink} strokeWidth="1.3" />
        </G>
      );

    case "leaderboard":
      return (
        <G>
          {/* Ground drop shadow */}
          <Rect x="15" y="41.5" width="18" height="3" rx="1.5" fill={HOME_WIDGET_ICON_SHADOW} opacity={0.3} />
          <Path
            d="M14 11H8v3c0 5 3 8 7 8M34 11h6v3c0 5-3 8-7 8"
            stroke={p.ink}
            strokeWidth="5.6"
            fill="none"
            strokeLinecap="round"
          />
          <Path
            d="M14 11H8v3c0 5 3 8 7 8M34 11h6v3c0 5-3 8-7 8"
            stroke={p.mid}
            strokeWidth="3.4"
            fill="none"
            strokeLinecap="round"
          />
          <Path d="M14 7h20v11c0 7-4.5 11-10 11S14 25 14 18V7Z" fill={p.lo} />
          <Path d="M14 7h20v11.5c-4.6 5-15.4 5-20 0V7Z" fill={p.mid} />
          <Path d="M14 7h20v3.4c-4.6 2.4-15.4 2.4-20 0V7Z" fill={p.hi} opacity={0.92} />
          <Path
            d="M14 7h20v11c0 7-4.5 11-10 11S14 25 14 18V7Z"
            fill="none"
            stroke={p.ink}
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <LeaderboardShine />
          <LeaderboardStar p={p} />
          <Path
            d="M24 29v7M16 42h16l-2-6H18l-2 6Z"
            fill={p.lo}
            stroke={p.ink}
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <Rect x="33" y="33" width="9" height="9" rx="3" fill={accentFill} opacity={op} />
        </G>
      );

    case "events":
      return (
        <G>
          {/* Ground drop shadow */}
          <Rect x="6" y="12.5" width="36" height="32" rx="7" fill={HOME_WIDGET_ICON_SHADOW} opacity={0.28} />
          {/* 3D extruded calendar base */}
          <Rect x="6" y="10" width="36" height="33" rx="7" fill={p.lo} stroke={p.ink} strokeWidth="1.8" />
          {/* Sculpted mid body */}
          <Rect x="6.8" y="10.5" width="34.4" height="29.5" rx="6.2" fill={p.mid} />
          {/* Inner recessed page well */}
          <Rect x="9" y="19.5" width="30" height="19" rx="4.2" fill={p.lo} opacity={0.32} />
          {/* Top coral-rose header band + keyline */}
          <Path
            d="M6 18h36v-3a6.5 6.5 0 0 0-6.5-6.5h-23A6.5 6.5 0 0 0 6 15v3Z"
            fill={p.detail}
            stroke={p.ink}
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          {/* Top specular shine on header */}
          <Path
            d="M11 10.5h26"
            stroke={HOME_WIDGET_ICON_SHINE}
            strokeWidth="2"
            strokeLinecap="round"
            opacity={0.68}
          />
          {/* Binder ring sockets + metallic rings */}
          <Circle cx="15" cy="14" r="2.4" fill={p.ink} />
          <Circle cx="33" cy="14" r="2.4" fill={p.ink} />
          <Path d="M15 4.8v8.8M33 4.8v8.8" stroke={p.ink} strokeWidth="4.4" strokeLinecap="round" />
          <Path d="M15 5.2v8M33 5.2v8" stroke={p.hi} strokeWidth="2.2" strokeLinecap="round" />
          {/* Featured hero date tile (3D raised with animated pulse) */}
          <EventsHeroTile p={p} />
          {/* Surrounding date cells */}
          <G fill={p.hi} opacity={0.78}>
            <Rect x="11" y="22.5" width="6.2" height="6.2" rx="2" />
            <Rect x="33" y="22.5" width="6.2" height="6.2" rx="2" />
            <Rect x="33" y="31.5" width="6.2" height="6.2" rx="2" />
          </G>
          {/* Active accent date cell */}
          <Rect x="11" y="31.5" width="6.2" height="6.2" rx="2" fill={accentFill} opacity={op} stroke={p.ink} strokeWidth="1.1" />
        </G>
      );

    case "schedule":
      return (
        <G>
          {/* Ground shadow */}
          <Circle cx="24" cy="27" r="18" fill={HOME_WIDGET_ICON_SHADOW} opacity={0.28} />
          {/* 3D Clay clock body */}
          <Circle cx="24" cy="25.5" r="18" fill={p.lo} stroke={p.ink} strokeWidth="1.8" />
          <Circle cx="24" cy="24.5" r="17" fill={p.mid} />
          {/* Top rim specular arc */}
          <Path
            d="M10 17.5a15.5 15.5 0 0 1 28 0"
            stroke={p.hi}
            strokeWidth="2.6"
            strokeLinecap="round"
            fill="none"
            opacity={0.85}
          />
          {/* Inner dial face */}
          <Circle cx="24" cy="24.5" r="13.2" fill={p.hi} opacity={0.35} />
          <Circle cx="24" cy="24.5" r="12.5" fill={HOME_WIDGET_ICON_SHINE} opacity={0.32} />
          <Path d="M24 10V6.5M38.5 24.5H42M24 39v3.5M9.5 24.5H6" stroke={p.ink} strokeWidth="2.4" strokeLinecap="round" opacity={0.75} />
          <ScheduleClockHands p={p} />
          <Circle cx="38" cy="11" r="5" fill={accentFill} opacity={op} stroke={p.ink} strokeWidth="1.3" />
        </G>
      );

    case "meal":
      return (
        <G>
          {/* Ground shadow */}
          <Path d="M8 44.5h32v2.5a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-2.5Z" fill={HOME_WIDGET_ICON_SHADOW} opacity={0.3} />
          {/* Rising hot steam wisps */}
          <MealSteam p={p} />
          {/* Warm golden meal dome inside the bowl */}
          <Path
            d="M10.5 24c2.2-6.5 8.2-9.2 15-7.8 4.8 1 8.8 3.8 11 7.8h-26Z"
            fill={p.detail}
            stroke={p.ink}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <Path
            d="M15 21.2c2.5-2.8 6.5-3.8 11-2.8"
            stroke={HOME_WIDGET_ICON_SHINE}
            strokeWidth="2"
            strokeLinecap="round"
            opacity={0.78}
            fill="none"
          />
          {/* 3D Clay Bowl: shaded base -> sculpted mid body -> lit top band -> keyline */}
          <Path
            d="M5 24h38c0 11.5-8 18.5-19 18.5S5 35.5 5 24Z"
            fill={p.lo}
            stroke={p.ink}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <Path d="M5.8 24h36.4c0 9-7.4 15.2-18.2 15.2S5.8 33 5.8 24Z" fill={p.mid} />
          <Path d="M6 24h36c0 2.8-.6 5.2-1.8 7H7.8C6.6 29.2 6 26.8 6 24Z" fill={p.hi} opacity={0.74} />
          <Path d="M9.5 26.2h15" stroke={HOME_WIDGET_ICON_SHINE} strokeWidth="2" strokeLinecap="round" opacity={0.72} />
          <Path d="M5 24h38" stroke={p.ink} strokeWidth="1.8" strokeLinecap="round" />
          {/* Footed base */}
          <Rect x="13" y="42" width="22" height="3.8" rx="1.9" fill={p.lo} stroke={p.ink} strokeWidth="1.5" />
          <Circle cx="40" cy="16" r="5" fill={accentFill} opacity={op} stroke={p.ink} strokeWidth="1.3" />
        </G>
      );

    case "tasks":
      return (
        <G>
          {/* Ground drop shadow */}
          <Rect x="7" y="8.5" width="34" height="38" rx="7" fill={HOME_WIDGET_ICON_SHADOW} opacity={0.28} />
          {/* 3D Clipboard base + keyline */}
          <Rect x="7" y="6.5" width="34" height="38" rx="7" fill={p.lo} stroke={p.ink} strokeWidth="1.8" />
          {/* Sculpted mid body */}
          <Rect x="7.8" y="7" width="32.4" height="34.8" rx="6.2" fill={p.mid} />
          {/* Top specular bevel */}
          <Path
            d="M11 9h26"
            stroke={p.hi}
            strokeWidth="2.2"
            strokeLinecap="round"
            opacity={0.75}
          />
          {/* Inner recessed board well */}
          <Rect x="10.5" y="13" width="27" height="26.5" rx="4.5" fill={p.lo} opacity={0.34} />
          {/* Sculpted golden clipboard clip at top */}
          <Rect x="16" y="3" width="16" height="6.8" rx="3.2" fill={p.detail} stroke={p.ink} strokeWidth="1.6" />
          <Rect x="18.5" y="4.3" width="11" height="2" rx="1" fill={HOME_WIDGET_ICON_SHINE} opacity={0.75} />
          {/* Row checkmarks with animated victory shimmer */}
          <TasksCheckmarks p={p} />
          {/* Accent badge pill */}
          <Rect x="11.5" y="34.5" width="13" height="5" rx="2.5" fill={accentFill} opacity={op} stroke={p.ink} strokeWidth="1.1" />
        </G>
      );

    case "week":
      return (
        <G>
          {/* Ground drop shadow */}
          <Rect x="5" y="13" width="38" height="28" rx="7" fill={HOME_WIDGET_ICON_SHADOW} opacity={0.28} />
          {/* 3D Clay week board */}
          <Rect x="5" y="11" width="38" height="28" rx="7" fill={p.lo} stroke={p.ink} strokeWidth="1.8" />
          <Rect x="5.8" y="11.5" width="36.4" height="25.2" rx="6.2" fill={p.mid} />
          {/* Top header bar */}
          <Path
            d="M5 18.5h38V16a5 5 0 0 0-5-5H10a5 5 0 0 0-5 5v2.5Z"
            fill={p.lo}
            stroke={p.ink}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <Path
            d="M10 12.8h28"
            stroke={HOME_WIDGET_ICON_SHINE}
            strokeWidth="1.8"
            strokeLinecap="round"
            opacity={0.62}
          />
          {/* Rhythm columns with wave breathing */}
          <WeekColumns p={p} />
          <G fill={p.hi} opacity={0.85}>
            <Rect x="12" y="14" width="5" height="2.8" rx="1.4" />
            <Rect x="22" y="14" width="5" height="2.8" rx="1.4" />
            <Rect x="32" y="14" width="5" height="2.8" rx="1.4" />
          </G>
          <Circle cx="41" cy="36" r="5" fill={accentFill} opacity={op} stroke={p.ink} strokeWidth="1.3" />
        </G>
      );

    case "security":
      return (
        <G>
          {/* Ground drop shadow */}
          <Path d="M24 5.5 41 11.5v13c0 11-7 19-17 23-10-4-17-12-17-23v-13L24 5.5Z" fill={HOME_WIDGET_ICON_SHADOW} opacity={0.28} />
          <SecurityShield p={p} />
          <Circle cx="40" cy="38" r="5" fill={accentFill} opacity={op} stroke={p.ink} strokeWidth="1.3" />
        </G>
      );

    case "climate":
      return (
        <G>
          {/* Ground shadow */}
          <Path d="M19 29V12a6 6 0 0 1 12 0v17a9.5 9.5 0 1 1-12 0Z" fill={HOME_WIDGET_ICON_SHADOW} opacity={0.28} />
          {/* 3D Thermometer housing */}
          <Path
            d="M19 27V10a6 6 0 0 1 12 0v17a9.5 9.5 0 1 1-12 0Z"
            fill={p.lo}
            stroke={p.ink}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <Path d="M20 26.8V10.2a5 5 0 0 1 10 0v16.6a8.3 8.3 0 1 1-10 0Z" fill={p.mid} />
          <Path d="M22 26V11a3 3 0 0 1 6 0v15a7 7 0 1 1-6 0Z" fill={p.hi} opacity={0.62} />
          {/* Animated living mercury */}
          <ClimateMercury p={p} />
          {/* Scale ticks */}
          <G stroke={p.ink} strokeWidth="3.2" strokeLinecap="round" opacity={0.45}>
            <Path d="M34.5 9h6.5M34.5 14.5h4.5M34.5 20h6.5" />
          </G>
          <G stroke={p.hi} strokeWidth="2" strokeLinecap="round">
            <Path d="M34.5 9h6.5M34.5 14.5h4.5M34.5 20h6.5" />
          </G>
          <Circle cx="10" cy="12" r="4.5" fill={accentFill} opacity={op} stroke={p.ink} strokeWidth="1.3" />
        </G>
      );

    case "lights":
      return (
        <G>
          {/* Ground shadow */}
          <Rect x="19" y="34" width="10" height="8.5" rx="3" fill={HOME_WIDGET_ICON_SHADOW} opacity={0.28} />
          {/* Glowing bulb & rays */}
          <LightsBulbGlow p={p} />
          {/* Screw base */}
          <Path
            d="M19.5 31.5h9v5.2a3.2 3.2 0 0 1-3.2 3.2h-2.6a3.2 3.2 0 0 1-3.2-3.2v-5.2Z"
            fill={p.lo}
            stroke={p.ink}
            strokeWidth="1.6"
          />
          <Path d="M20.5 34.5h7M21.2 37.5h5.6" stroke={p.hi} strokeWidth="1.6" strokeLinecap="round" opacity={0.75} />
          <Rect x="31" y="33" width="9" height="9" rx="3" fill={accentFill} opacity={op} stroke={p.ink} strokeWidth="1.3" />
        </G>
      );

    case "ledger":
      return (
        <G>
          {/* Ground shadow */}
          <Path d="M9 8.5h26a5 5 0 0 1 5 5v30H14a5 5 0 0 1-5-5V8.5Z" fill={HOME_WIDGET_ICON_SHADOW} opacity={0.28} />
          {/* Spine & 3D Book cover */}
          <Path d="M9 10h-3v27a5 5 0 0 0 5 5h3v-2H11a5 5 0 0 1-5-5V10h3Z" fill={p.lo} stroke={p.ink} strokeWidth="1.4" />
          <Path
            d="M9 6h26a5 5 0 0 1 5 5v31H14a5 5 0 0 1-5-5V6Z"
            fill={p.lo}
            stroke={p.ink}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <Path d="M10 6.8h24.5a4.2 4.2 0 0 1 4.2 4.2v28.5H14a4 4 0 0 1-4-4V6.8Z" fill={p.mid} />
          <Path d="M12 8.8h22" stroke={p.hi} strokeWidth="2" strokeLinecap="round" opacity={0.72} />
          {/* Ledger lines */}
          <G stroke={p.hi} strokeWidth="2.6" strokeLinecap="round" opacity={0.9}>
            <Path d="M16.5 15.5h15.5M16.5 22h15.5M16.5 28.5h9.5" />
          </G>
          {/* Bookmark ribbon */}
          <Path d="M33.5 4h9v14l-4.5-3.4L33.5 18V4Z" fill={accentFill} opacity={op} stroke={p.ink} strokeWidth="1.2" strokeLinejoin="round" />
          {/* Animated gleaming gold coin */}
          <LedgerCoin p={p} />
        </G>
      );

    case "music":
      return (
        <G>
          {/* Ground drop shadow */}
          <Circle cx="24" cy="27" r="17" fill={HOME_WIDGET_ICON_SHADOW} opacity={0.26} />
          {/* 3D Clay Headphone headband arc */}
          <Path
            d="M9.5 26v-3.5a14.5 14.5 0 0 1 29 0V26"
            stroke={p.ink}
            strokeWidth="6.8"
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M9.5 26v-3.5a14.5 14.5 0 0 1 29 0V26"
            stroke={p.mid}
            strokeWidth="4.4"
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M13.5 14.5a12.5 12.5 0 0 1 21 0"
            stroke={p.hi}
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
            opacity={0.9}
          />
          {/* Left & Right 3D Cushioned Earcups */}
          <Rect x="6" y="23" width="8.5" height="14.5" rx="4.25" fill={p.lo} stroke={p.ink} strokeWidth="1.8" />
          <Rect x="6.8" y="23.6" width="6.8" height="12" rx="3.4" fill={p.mid} />
          <Rect x="8" y="24.8" width="2.4" height="5.5" rx="1.2" fill={p.hi} opacity={0.85} />

          <Rect x="33.5" y="23" width="8.5" height="14.5" rx="4.25" fill={p.lo} stroke={p.ink} strokeWidth="1.8" />
          <Rect x="34.3" y="23.6" width="6.8" height="12" rx="3.4" fill={p.mid} />
          <Rect x="35.5" y="24.8" width="2.4" height="5.5" rx="1.2" fill={p.hi} opacity={0.85} />

          {/* Center 3D Golden Beamed Music Note with rhythmic beat */}
          <MusicNotes p={p} />
          {/* Accent badge */}
          <Circle cx="39" cy="38" r="4.8" fill={accentFill} opacity={op} stroke={p.ink} strokeWidth="1.3" />
        </G>
      );
  }
}


export function HomeWidgetIcon({ variant, state = "default", size = "md", title }: HomeWidgetIconProps) {
  const { accentColor } = useTheme();
  const p = HOME_WIDGET_ICON_PALETTES[variant];
  const px = typeof size === "number" ? size : SIZE_PX[size];
  const accentFill = mix(accentColor, p.ink, 72);

  const art = (
    <Svg
      width={px}
      height={px}
      viewBox="0 0 48 48"
      fill="none"
      accessibilityLabel={title}
    >
      {/* Warm Glass v2 multi-layer diffused inner radiance */}
      <Circle cx="24" cy="24" r="22" fill={p.glow} opacity={0.22} />
      <Circle cx="24" cy="24" r="16" fill={p.hi} opacity={0.12} />
      {/* Top rim glass specular curve */}
      <Path
        d="M11 9a16.5 16.5 0 0 1 26 0"
        stroke={HOME_WIDGET_ICON_SHINE}
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity={0.32}
      />
      {renderArtwork(variant, p, accentFill, state)}
    </Svg>
  );

  return <WidgetIconMotion variant={variant}>{art}</WidgetIconMotion>;
}

export default HomeWidgetIcon;
