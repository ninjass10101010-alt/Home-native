import React from "react";
import Svg, { Circle, Line, Path, Polygon, Rect } from "react-native-svg";

export type MusicIconName =
  | "play"
  | "pause"
  | "prev"
  | "next"
  | "shuffle"
  | "repeat"
  | "repeatOne"
  | "heart"
  | "star"
  | "lyrics"
  | "queue"
  | "library"
  | "cast"
  | "speaker"
  | "volume"
  | "volumeMute"
  | "download"
  | "check"
  | "radio"
  | "sparkles"
  | "search"
  | "close"
  | "plus"
  | "playNext"
  | "trash"
  | "up"
  | "down"
  | "lock"
  | "shield"
  | "moon"
  | "playlist"
  | "clock"
  | "music";

export interface MusicIconProps {
  name: MusicIconName;
  size?: number;
  color: string;
  filled?: boolean;
  strokeWidth?: number;
}

/**
 * Vector icon set for /music (duotone stroke/fill style matching src/ui/NavIcon.tsx).
 * Strictly color-token driven via the `color` prop; zero color literals here.
 */
export function MusicIcon({
  name,
  size = 22,
  color,
  filled = false,
  strokeWidth = 2,
}: MusicIconProps) {
  const fillTint = filled ? 0.92 : 0.14;

  const renderPaths = (): React.ReactNode => {
    switch (name) {
      case "play":
        return (
          <Polygon
            points="7 4.5 19.5 12 7 19.5 7 4.5"
            fill={color}
            fillOpacity={filled ? 1 : 0.92}
            stroke={color}
          />
        );
      case "pause":
        return (
          <>
            <Rect x="6" y="4.5" width="4.2" height="15" rx="1.4" fill={color} />
            <Rect x="13.8" y="4.5" width="4.2" height="15" rx="1.4" fill={color} />
          </>
        );
      case "prev":
        return (
          <>
            <Line x1="5" y1="5" x2="5" y2="19" />
            <Polygon
              points="18.5 5.5 8.5 12 18.5 18.5 18.5 5.5"
              fill={color}
              fillOpacity={filled ? 1 : 0.85}
            />
          </>
        );
      case "next":
        return (
          <>
            <Line x1="19" y1="5" x2="19" y2="19" />
            <Polygon
              points="5.5 5.5 15.5 12 5.5 18.5 5.5 5.5"
              fill={color}
              fillOpacity={filled ? 1 : 0.85}
            />
          </>
        );
      case "shuffle":
        return (
          <>
            <Path d="M16 3h5v5" />
            <Path d="M4 20 21 3" />
            <Path d="M21 16v5h-5" />
            <Path d="M15 15 21 21" />
            <Path d="M4 4l5 5" />
          </>
        );
      case "repeat":
        return (
          <>
            <Path d="m17 2 4 4-4 4" />
            <Path d="M3 11v-1a4 4 0 0 1 4-4h14" />
            <Path d="m7 22-4-4 4-4" />
            <Path d="M21 13v1a4 4 0 0 1-4 4H3" />
          </>
        );
      case "repeatOne":
        return (
          <>
            <Path d="m17 2 4 4-4 4" />
            <Path d="M3 11v-1a4 4 0 0 1 4-4h14" />
            <Path d="m7 22-4-4 4-4" />
            <Path d="M21 13v1a4 4 0 0 1-4 4H3" />
            <Path d="M11 10.5 12.2 9.5V15" />
          </>
        );
      case "heart":
        return (
          <Path
            d="M12 20.4s-7.5-4.7-9.2-9.2C1.6 7.8 3.8 4.5 7.2 4.5c1.9 0 3.7 1 4.8 2.6 1.1-1.6 2.9-2.6 4.8-2.6 3.4 0 5.6 3.3 4.4 6.7-1.7 4.5-9.2 9.2-9.2 9.2Z"
            fill={color}
            fillOpacity={filled ? 0.96 : 0.08}
          />
        );
      case "star":
        return (
          <Path
            d="m12 3 2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8-5.4 2.8 1-6L3.3 9.4l6-.9Z"
            fill={color}
            fillOpacity={filled ? 0.96 : 0.08}
          />
        );
      case "lyrics":
        return (
          <>
            <Path
              d="M20 14a3 3 0 0 1-3 3H8l-4 3.5V6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v8Z"
              fill={color}
              fillOpacity={fillTint}
            />
            <Line x1="8" y1="8.5" x2="16" y2="8.5" />
            <Line x1="8" y1="12" x2="13.5" y2="12" />
          </>
        );
      case "queue":
        return (
          <>
            <Line x1="4" y1="6" x2="20" y2="6" />
            <Line x1="4" y1="11.5" x2="15" y2="11.5" />
            <Line x1="4" y1="17" x2="12" y2="17" />
            <Polygon points="16.5 13.5 21 16.5 16.5 19.5" fill={color} />
          </>
        );
      case "library":
        return (
          <>
            <Rect x="4" y="4" width="6.5" height="16" rx="1.8" fill={color} fillOpacity={fillTint} />
            <Rect x="13.5" y="4" width="6.5" height="16" rx="1.8" fill={color} fillOpacity={fillTint * 0.7} />
          </>
        );
      case "cast":
        return (
          <>
            <Path d="M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6" />
            <Path d="M2 12a9 9 0 0 1 8 8" />
            <Path d="M2 16a5 5 0 0 1 4 4" />
            <Circle cx="2.5" cy="19.5" r="1" fill={color} stroke="none" />
          </>
        );
      case "speaker":
        return (
          <>
            <Rect x="5.5" y="3" width="13" height="18" rx="3" fill={color} fillOpacity={fillTint} />
            <Circle cx="12" cy="8" r="1.2" fill={color} stroke="none" />
            <Circle cx="12" cy="14.5" r="3" />
          </>
        );
      case "volume":
        return (
          <>
            <Polygon points="11 5 6 9 3 9 3 15 6 15 11 19 11 5" fill={color} fillOpacity={fillTint} />
            <Path d="M15.5 8.5a5 5 0 0 1 0 7" />
            <Path d="M18.5 6a8.5 8.5 0 0 1 0 12" />
          </>
        );
      case "volumeMute":
        return (
          <>
            <Polygon points="11 5 6 9 3 9 3 15 6 15 11 19 11 5" fill={color} fillOpacity={fillTint} />
            <Line x1="16" y1="9" x2="21" y2="15" />
            <Line x1="21" y1="9" x2="16" y2="15" />
          </>
        );
      case "download":
        return (
          <>
            <Path d="M12 4v10" />
            <Path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
            <Path d="M5 18.5h14" />
          </>
        );
      case "check":
        return <Path d="m5 12.5 4.5 4.5L19 7" />;
      case "radio":
        return (
          <>
            <Circle cx="12" cy="12" r="2.2" fill={color} />
            <Path d="M8.5 8.5a5 5 0 0 0 0 7" />
            <Path d="M15.5 8.5a5 5 0 0 1 0 7" />
            <Path d="M5.5 5.5a9.2 9.2 0 0 0 0 13" />
            <Path d="M18.5 5.5a9.2 9.2 0 0 1 0 13" />
          </>
        );
      case "sparkles":
        return (
          <>
            <Path
              d="m11 3 1.7 4.3L17 9l-4.3 1.7L11 15l-1.7-4.3L5 9l4.3-1.7Z"
              fill={color}
              fillOpacity={fillTint}
            />
            <Path d="m18.5 14 .9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9Z" />
          </>
        );
      case "search":
        return (
          <>
            <Circle cx="11" cy="11" r="6.5" fill={color} fillOpacity={fillTint} />
            <Path d="m20 20-4-4" />
          </>
        );
      case "close":
        return (
          <>
            <Line x1="6" y1="6" x2="18" y2="18" />
            <Line x1="18" y1="6" x2="6" y2="18" />
          </>
        );
      case "plus":
        return (
          <>
            <Line x1="12" y1="5" x2="12" y2="19" />
            <Line x1="5" y1="12" x2="19" y2="12" />
          </>
        );
      case "playNext":
        return (
          <>
            <Polygon points="4 6 12 11 4 16 4 6" fill={color} fillOpacity={0.85} />
            <Line x1="15" y1="8" x2="21" y2="8" />
            <Line x1="15" y1="13" x2="21" y2="13" />
            <Line x1="15" y1="18" x2="21" y2="18" />
          </>
        );
      case "trash":
        return (
          <>
            <Path d="M4 7h16" />
            <Path d="M9 7V4.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V7" />
            <Path d="M6.5 7v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2V7" fill={color} fillOpacity={fillTint * 0.7} />
          </>
        );
      case "up":
        return <Path d="m6 14 6-6 6 6" />;
      case "down":
        return <Path d="m6 10 6 6 6-6" />;
      case "lock":
        return (
          <>
            <Rect x="5" y="11" width="14" height="9" rx="2.5" fill={color} fillOpacity={fillTint} />
            <Path d="M8 11V7.5a4 4 0 0 1 8 0V11" />
          </>
        );
      case "shield":
        return (
          <Path
            d="M12 3 5 6v5.5c0 4.6 3 8.4 7 9.5 4-1.1 7-4.9 7-9.5V6l-7-3Z"
            fill={color}
            fillOpacity={fillTint}
          />
        );
      case "moon":
        return (
          <Path
            d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10Z"
            fill={color}
            fillOpacity={fillTint}
          />
        );
      case "playlist":
        return (
          <>
            <Line x1="4" y1="7" x2="15" y2="7" />
            <Line x1="4" y1="12" x2="15" y2="12" />
            <Line x1="4" y1="17" x2="11" y2="17" />
            <Circle cx="17.5" cy="17.5" r="2.5" fill={color} fillOpacity={fillTint} />
            <Path d="M20 17.5V9.5l-2.5-.5" />
          </>
        );
      case "clock":
        return (
          <>
            <Circle cx="12" cy="12" r="8.5" fill={color} fillOpacity={fillTint} />
            <Path d="M12 7.5V12l3 2" />
          </>
        );
      case "music":
      default:
        return (
          <>
            <Path d="M9 17.5V6.5l10-2v11" />
            <Circle cx="6.5" cy="17.5" r="2.5" fill={color} fillOpacity={fillTint} />
            <Circle cx="16.5" cy="15.5" r="2.5" fill={color} fillOpacity={fillTint} />
          </>
        );
    }
  };

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessible={false}
    >
      {renderPaths()}
    </Svg>
  );
}

export default MusicIcon;
