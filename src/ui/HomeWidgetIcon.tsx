import React, { useId } from "react";
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  LinearGradient as RNSvgLinearGradient,
  Path,
  Rect,
  Stop as RNSvgStop,
} from "react-native-svg";
import { useTheme } from "../theme/ThemeProvider";
import {
  HOME_WIDGET_ICON_PALETTES,
  HOME_WIDGET_ICON_SHINE,
  HOME_WIDGET_ICON_VARIANTS,
  type HomeWidgetIconPalette,
  type HomeWidgetIconVariant,
} from "../theme/materials";
import { mix } from "../theme/mix";

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

const LinearGradient = RNSvgLinearGradient ?? G;
const Stop = RNSvgStop ?? G;

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
    default:
      return null;
  }
}

function renderArtwork(
  variant: HomeWidgetIconVariant,
  p: HomeWidgetIconPalette,
  id: string,
  accentFill: string,
  state?: HomeWidgetIconState
): React.ReactNode {
  const body = `url(#${id}-body)`;
  const shine = `url(#${id}-shine)`;
  const op = accentOpacity(state);

  switch (variant) {
    case "briefing":
      return (
        <G>
          <Circle cx="24" cy="21" r="10" fill={body} />
          <Circle cx="24" cy="21" r="10" fill={shine} opacity={0.55} />
          <Path
            d="M24 5v4M24 33v4M8 21h4M36 21h4M12.7 9.7l2.8 2.8M32.5 29.5l2.8 2.8M35.3 9.7l-2.8 2.8M15.5 29.5l-2.8 2.8"
            stroke={p.hi}
            strokeWidth="2.4"
            strokeLinecap="round"
            opacity={0.9}
          />
          <Path d="M4 40c6-9 12-9 18-2 5 6 12 5 18-2v6H4v-2Z" fill={p.detail} />
          <Path d="M4 44h40v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2Z" fill={p.lo} opacity={0.5} />
          <Rect x="31" y="35" width="10" height="10" rx="3" fill={accentFill} opacity={op} />
        </G>
      );

    case "ask":
      return (
        <G>
          <Path
            d="M11 8h26a6 6 0 0 1 6 6v15a6 6 0 0 1-6 6H24l-9 8v-8a6 6 0 0 1-6-6V14a6 6 0 0 1 6-6Z"
            fill={body}
          />
          <Path
            d="M13 11h20a5 5 0 0 1 5 5v3c-8-3-19-2-25 2-3 2-6 2-8 1v-5a5 5 0 0 1 5-5Z"
            fill={shine}
            opacity={0.45}
          />
          <G fill={p.detail}>
            <Circle cx="16" cy="22" r="2.6" />
            <Circle cx="24" cy="22" r="2.6" />
            <Circle cx="32" cy="22" r="2.6" />
          </G>
          <Circle cx="35" cy="34" r="6" fill={accentFill} opacity={op} />
        </G>
      );

    case "suggestions":
      return (
        <G>
          <Path
            d="M20 4c1.6 7.8 4.2 10.4 12 12-7.8 1.6-10.4 4.2-12 12-1.6-7.8-4.2-10.4-12-12 7.8-1.6 10.4-4.2 12-12Z"
            fill={body}
          />
          <Path
            d="M36 24c.9 4.4 2.3 5.8 6.7 6.7-4.4.9-5.8 2.3-6.7 6.7-.9-4.4-2.3-5.8-6.7-6.7 4.4-.9 5.8-2.3 6.7-6.7Z"
            fill={p.detail}
          />
          <Circle cx="11" cy="38" r="4" fill={accentFill} opacity={op} />
          <Circle cx="17" cy="11" r="2.2" fill={p.hi} opacity={0.85} />
        </G>
      );

    case "leaderboard":
      return (
        <G>
          <Path d="M14 7h20v11c0 7-4.5 11-10 11S14 25 14 18V7Z" fill={body} />
          <Path
            d="M14 11H8v3c0 5 3 8 7 8M34 11h6v3c0 5-3 8-7 8"
            stroke={p.lo}
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
          <Path d="M24 29v7M16 42h16l-2-6H18l-2 6Z" fill={p.lo} />
          <G clipPath={`url(#${id}-clip)`}>
            <Rect
              x="4"
              y="4"
              width="7"
              height="26"
              rx="3"
              fill={HOME_WIDGET_ICON_SHINE}
              opacity={0.5}
              rotation={18}
              originX={24}
              originY={18}
            />
          </G>
          <Path
            d="m24 11 2 4.2 4.6.7-3.3 3.2.8 4.6L24 21.6l-4.1 2.1.8-4.6-3.3-3.2 4.6-.7L24 11Z"
            fill={p.detail}
          />
          <Rect x="33" y="33" width="9" height="9" rx="3" fill={accentFill} opacity={op} />
        </G>
      );

    case "events":
      return (
        <G>
          <Rect x="6" y="10" width="36" height="32" rx="7" fill={body} />
          <Path d="M6 17h36v-3a7 7 0 0 0-7-7H13a7 7 0 0 0-7 7v3Z" fill={p.detail} />
          <Path d="M15 5v9M33 5v9" stroke={p.ink} strokeWidth="3.4" strokeLinecap="round" />
          <Rect x="20" y="24" width="11" height="11" rx="3.5" fill={p.hi} />
          <G fill={p.hi} opacity={0.6}>
            <Rect x="11" y="24" width="6" height="6" rx="2" />
            <Rect x="33" y="24" width="6" height="6" rx="2" />
            <Rect x="11" y="33" width="6" height="6" rx="2" />
            <Rect x="33" y="33" width="6" height="6" rx="2" />
          </G>
          <Rect x="11" y="33" width="6" height="6" rx="2" fill={accentFill} opacity={op} />
        </G>
      );

    case "schedule":
      return (
        <G>
          <Circle cx="24" cy="25" r="18" fill={body} />
          <Circle cx="24" cy="25" r="13" fill={shine} opacity={0.4} />
          <Path d="M24 10V6M39 25h4M24 40v4M9 25H5" stroke={p.lo} strokeWidth="2.6" strokeLinecap="round" />
          <Path d="M24 25V15" stroke={p.ink} strokeWidth="3" strokeLinecap="round" />
          <Path d="M24 25l8 5" stroke={p.ink} strokeWidth="3" strokeLinecap="round" />
          <Circle cx="24" cy="25" r="2.6" fill={p.detail} />
          <Circle cx="38" cy="11" r="5" fill={accentFill} opacity={op} />
        </G>
      );

    case "meal":
      return (
        <G>
          <G stroke={HOME_WIDGET_ICON_SHINE} strokeWidth="2.6" strokeLinecap="round" opacity={0.75} fill="none">
            <Path d="M17 15c0-4 3-4 3-8" />
            <Path d="M24 14c0-4 3-4 3-8" />
            <Path d="M31 15c0-4 3-4 3-8" />
          </G>
          <Path d="M5 24h38c0 11-8 18-19 18S5 35 5 24Z" fill={body} />
          <Path d="M5 24h38c0 3-.5 5.4-1.5 7.5H6.5C5.5 29.4 5 27 5 24Z" fill={p.hi} opacity={0.6} />
          <Path
            d="M14 21c2-6 8-8 14-6 4 1.4 7 4 9 6"
            stroke={p.detail}
            strokeWidth="3.2"
            fill="none"
            strokeLinecap="round"
          />
          <Path d="M8 44h32v2a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-2Z" fill={p.lo} opacity={0.55} />
          <Circle cx="40" cy="16" r="5" fill={accentFill} opacity={op} />
        </G>
      );

    case "tasks":
      return (
        <G>
          <Rect x="7" y="6" width="34" height="38" rx="7" fill={body} />
          <Path d="M17 6V4h14v2" stroke={p.lo} strokeWidth="3" fill="none" strokeLinecap="round" />
          <G stroke={p.hi} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.85}>
            <Path d="m13 18 3 3 6-6" />
            <Path d="M26 19h8" />
          </G>
          <Path
            d="m13 30 3 3 6-6"
            stroke={p.detail}
            strokeWidth="3.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <Path d="M26 31h8" stroke={p.hi} strokeWidth="3" strokeLinecap="round" opacity={0.7} />
          <Rect x="11" y="36" width="12" height="5" rx="2.5" fill={accentFill} opacity={op} />
        </G>
      );

    case "week":
      return (
        <G>
          <Rect x="5" y="11" width="38" height="28" rx="7" fill={body} />
          <Path d="M5 18h38v-3a7 7 0 0 0-7-7H12a7 7 0 0 0-7 7v3Z" fill={p.lo} opacity={0.65} />
          <G fill={p.detail}>
            <Rect x="11" y="29" width="5" height="6" rx="2" />
            <Rect x="21" y="23" width="5" height="12" rx="2" />
            <Rect x="31" y="26" width="5" height="9" rx="2" />
          </G>
          <G fill={p.hi} opacity={0.55}>
            <Rect x="12" y="14" width="5" height="3" rx="1.5" />
            <Rect x="22" y="14" width="5" height="3" rx="1.5" />
            <Rect x="32" y="14" width="5" height="3" rx="1.5" />
          </G>
          <Circle cx="41" cy="36" r="5" fill={accentFill} opacity={op} />
        </G>
      );

    case "security":
      return (
        <G>
          <Path d="M24 3 41 9v13c0 11-7 19-17 23-10-4-17-12-17-23V9L24 3Z" fill={body} />
          <Path d="M24 6 38 11v9c0 9-5.6 15.6-14 19.4V6Z" fill={shine} opacity={0.28} />
          <Rect x="19" y="20" width="10" height="11" rx="3" fill={p.detail} />
          <Path
            d="M21 20v-3a3 3 0 0 1 6 0v3"
            stroke={p.detail}
            strokeWidth="2.4"
            fill="none"
            strokeLinecap="round"
          />
          <Path d="M24 3v40" stroke={p.lo} strokeWidth="1.4" opacity={0.35} />
          <Circle cx="40" cy="38" r="5" fill={accentFill} opacity={op} />
        </G>
      );

    case "climate":
      return (
        <G>
          <Path d="M19 27V10a6 6 0 0 1 12 0v17a9.5 9.5 0 1 1-12 0Z" fill={body} />
          <Path d="M22 26V11a3 3 0 0 1 6 0v15a7 7 0 1 1-6 0Z" fill={p.hi} opacity={0.5} />
          <Path d="M25 34V16" stroke={p.detail} strokeWidth="4.4" strokeLinecap="round" />
          <Circle cx="25" cy="35" r="5" fill={p.detail} />
          <G stroke={p.hi} strokeWidth="2.2" strokeLinecap="round" opacity={0.8}>
            <Path d="M34 8h7M34 14h5M34 20h7" />
          </G>
          <Circle cx="10" cy="12" r="4.5" fill={accentFill} opacity={op} />
        </G>
      );

    case "lights":
      return (
        <G>
          <Circle cx="24" cy="20" r="13" fill={body} />
          <Circle cx="24" cy="20" r="8" fill={shine} opacity={0.5} />
          <Circle cx="24" cy="20" r="5.5" fill={p.hi} opacity={0.9} />
          <Path d="M20 32h8v4a3 3 0 0 1-3 3h-2a3 3 0 0 1-3-3v-4Z" fill={p.lo} />
          <Path d="M20 35h8M21 39h6" stroke={p.ink} strokeWidth="1.8" strokeLinecap="round" opacity={0.6} />
          <Path
            d="M24 2v4M6 20h4M38 20h4M11 7l3 3M34 10l3-3"
            stroke={p.detail}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <Rect x="31" y="33" width="9" height="9" rx="3" fill={accentFill} opacity={op} />
        </G>
      );

    case "ledger":
      return (
        <G>
          <Path d="M9 6h26a5 5 0 0 1 5 5v31H14a5 5 0 0 1-5-5V6Z" fill={body} />
          <Path d="M9 10h-3v27a5 5 0 0 0 5 5h3v-2H11a5 5 0 0 1-5-5V10h3Z" fill={p.lo} />
          <G stroke={p.hi} strokeWidth="2.6" strokeLinecap="round" opacity={0.8}>
            <Path d="M17 15h16M17 22h16M17 29h10" />
          </G>
          <Path d="M34 4h9v14l-4.5-3.4L34 18V4Z" fill={accentFill} opacity={op} />
          <Circle cx="32" cy="35" r="7" fill={p.detail} />
          <Path
            d="M32 31.5v7M29.8 33.4h4.4M29.8 36.6h4.4"
            stroke={p.lo}
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </G>
      );
  }
}

export function HomeWidgetIcon({ variant, state = "default", size = "md", title }: HomeWidgetIconProps) {
  const { accentColor } = useTheme();
  const id = `hwi-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const p = HOME_WIDGET_ICON_PALETTES[variant];
  const px = typeof size === "number" ? size : SIZE_PX[size];
  const accentFill = mix(accentColor, p.ink, 72);

  return (
    <Svg
      width={px}
      height={px}
      viewBox="0 0 48 48"
      fill="none"
      accessibilityLabel={title}
    >
      <Defs>
        <LinearGradient id={`${id}-body`} x1="0" y1="0" x2="0.35" y2="1">
          <Stop offset="0%" stopColor={p.hi} />
          <Stop offset="52%" stopColor={p.mid} />
          <Stop offset="100%" stopColor={p.lo} />
        </LinearGradient>
        <LinearGradient id={`${id}-shine`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={HOME_WIDGET_ICON_SHINE} stopOpacity="0.9" />
          <Stop offset="100%" stopColor={HOME_WIDGET_ICON_SHINE} stopOpacity="0" />
        </LinearGradient>
        <ClipPath id={`${id}-clip`}>
          <Rect x="12" y="5" width="24" height="27" rx="6" />
        </ClipPath>
      </Defs>
      <Circle cx="24" cy="24" r="22" fill={p.glow} opacity={0.16} />
      {renderArtwork(variant, p, id, accentFill, state)}
    </Svg>
  );
}

export default HomeWidgetIcon;
