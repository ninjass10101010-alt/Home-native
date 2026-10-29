import React from "react";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "../theme/ThemeProvider";
import type { NavIconKey } from "../nav/nav-items";

export interface NavIconProps {
  iconKey: NavIconKey | "more";
  active?: boolean;
  size?: number;
  color?: string;
}

function renderIconPaths(iconKey: NavIconKey | "more", strokeColor: string, active: boolean): React.ReactNode {
  const fillTint = active ? 0.24 : 0.1;
  switch (iconKey) {
    case "home":
      return (
        <>
          <Path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9L12 4.2 5 10Z" fill={strokeColor} fillOpacity={fillTint} stroke="none" />
          <Path d="M3 11.5 12 4l9 7.5" />
          <Path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
        </>
      );
    case "ask":
      return (
        <>
          <Path
            d="M12 3a8 8 0 0 0-8 8c0 1.6.5 3.1 1.3 4.4L4 21l5.6-1.3A8 8 0 1 0 12 3Z"
            fill={strokeColor}
            fillOpacity={fillTint}
          />
          <Circle cx="8.5" cy="11" r="1.2" fill={strokeColor} stroke="none" />
          <Circle cx="12" cy="11" r="1.2" fill={strokeColor} stroke="none" />
          <Circle cx="15.5" cy="11" r="1.2" fill={strokeColor} stroke="none" />
        </>
      );
    case "meals":
      return (
        <>
          <Path d="M17 3c-2 0-3 2-3 5s1 5 3 5V3Z" fill={strokeColor} fillOpacity={fillTint} stroke="none" />
          <Path d="M4 3v8a4 4 0 0 0 4 4v6" />
          <Path d="M8 3v8" />
          <Path d="M8 15v6" />
          <Path d="M17 3c-2 0-3 2-3 5s1 5 3 5v8" />
        </>
      );
    case "tasks":
      return (
        <>
          <Rect x="4" y="4" width="16" height="16" rx="3.5" fill={strokeColor} fillOpacity={fillTint} />
          <Path d="m8.5 12 2.5 2.5 4.5-5" />
        </>
      );
    case "rewards":
      return (
        <>
          <Rect x="3.5" y="8" width="17" height="4" rx="1" fill={strokeColor} fillOpacity={fillTint * 1.3} />
          <Path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" fill={strokeColor} fillOpacity={fillTint * 0.8} />
          <Path d="M12 8v12" />
          <Path d="M12 8s-1.2-4-4-4a2.2 2.2 0 0 0 0 4h4Z" />
          <Path d="M12 8s1.2-4 4-4a2.2 2.2 0 0 1 0 4h-4Z" />
        </>
      );
    case "calendar":
      return (
        <>
          <Rect x="3.5" y="4.5" width="17" height="16" rx="3" fill={strokeColor} fillOpacity={fillTint * 0.7} />
          <Path d="M3.5 7.5a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3v2h-17v-2Z" fill={strokeColor} fillOpacity={fillTint * 1.4} stroke="none" />
          <Path d="M3.5 9.5h17" />
          <Path d="M8 2.5v4" />
          <Path d="M16 2.5v4" />
          <Circle cx="8.5" cy="13.5" r="1.05" fill={strokeColor} stroke="none" />
          <Circle cx="12" cy="13.5" r="1.05" fill={strokeColor} stroke="none" />
          <Circle cx="15.5" cy="13.5" r="1.05" fill={strokeColor} stroke="none" />
          <Circle cx="8.5" cy="17" r="1.05" fill={strokeColor} stroke="none" />
          <Circle cx="12" cy="17" r="1.05" fill={strokeColor} stroke="none" />
          <Circle cx="15.5" cy="17" r="1.05" fill={strokeColor} stroke="none" />
        </>
      );
    case "house":
      return (
        <>
          <Path d="M5 4v4" />
          <Path d="M5 12v8" />
          <Circle cx="5" cy="10" r="2" fill={strokeColor} fillOpacity={fillTint * 1.4} />
          <Path d="M12 4v9" />
          <Path d="M12 17v3" />
          <Circle cx="12" cy="15" r="2" fill={strokeColor} fillOpacity={fillTint * 1.4} />
          <Path d="M19 4v3" />
          <Path d="M19 11v9" />
          <Circle cx="19" cy="9" r="2" fill={strokeColor} fillOpacity={fillTint * 1.4} />
        </>
      );
    case "settings":
      return (
        <>
          <Path
            d="M12 1.5l.8 3.3a8.5 8.5 0 0 1 1.9.8l3.1-1.7 1.4 1.4-1.7 3.1a8.5 8.5 0 0 1 .8 1.9l3.3.8v1.8l-3.3.8a8.5 8.5 0 0 1-.8 1.9l1.7 3.1-1.4 1.4-3.1-1.7a8.5 8.5 0 0 1-1.9.8L12 22.5h-1l-.8-3.3a8.5 8.5 0 0 1-1.9-.8l-3.1 1.7-1.4-1.4 1.7-3.1a8.5 8.5 0 0 1-.8-1.9L1.5 12v-1l3.3-.8a8.5 8.5 0 0 1 .8-1.9l-1.7-3.1 1.4-1.4 3.1 1.7a8.5 8.5 0 0 1 1.9-.8L11 1.5z"
            fill={strokeColor}
            fillOpacity={fillTint}
          />
          <Circle cx="12" cy="12" r="3" />
        </>
      );
    case "grocery":
      return (
        <>
          <Path d="M6 7h14l-1.6 7.2a1 1 0 0 1-1 .8H8.4a1 1 0 0 1-1-.8L6 7Z" fill={strokeColor} fillOpacity={fillTint} stroke="none" />
          <Path d="M3 4h2l2.4 10.2a1 1 0 0 0 1 .8h8.6a1 1 0 0 0 1-.8L20 7H6" />
          <Circle cx="9.5" cy="19" r="1.4" fill={strokeColor} />
          <Circle cx="17" cy="19" r="1.4" fill={strokeColor} />
        </>
      );
    case "skill":
      return (
        <Path
          d="m12 3 2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.2 5.9-.8Z"
          fill={strokeColor}
          fillOpacity={fillTint}
        />
      );
    case "capsule":
      return (
        <>
          <Rect x="3.5" y="6" width="17" height="12" rx="2.5" fill={strokeColor} fillOpacity={fillTint} />
          <Path d="m4.5 8 7.5 5 7.5-5" />
        </>
      );
    case "analytics":
      return (
        <>
          <Path d="M4 5v14h16" />
          <Path d="M8.5 16v-4" />
          <Path d="M12.5 16V9" />
          <Path d="M16.5 16v-6" />
        </>
      );
    case "mountain":
      return (
        <>
          <Path d="m4.5 19 6-11 3.2 5.8L16 10l4 9H4.5Z" fill={strokeColor} fillOpacity={fillTint} stroke="none" />
          <Path d="M3 19h18" />
          <Path d="m4.5 19 6-11 3.2 5.8L16 10l4 9" />
        </>
      );
    case "memory":
      return (
        <>
          <Path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v16H7.5A2.5 2.5 0 0 0 5 21.5Z" fill={strokeColor} fillOpacity={fillTint} />
          <Path d="M10 7h5" />
          <Path d="M10 11h5" />
        </>
      );
    case "photos":
      return (
        <>
          <Rect x="3" y="5" width="18" height="14" rx="2.5" fill={strokeColor} fillOpacity={fillTint * 0.8} />
          <Path d="m5 17 4.2-5.6 2.8 3.4 2.6-3.2L19 15.5" />
          <Circle cx="9" cy="9" r="1.2" fill={strokeColor} />
        </>
      );
    case "music":
      return (
        <>
          <Path d="M9 18V5l10-2v13" />
          <Circle cx="6" cy="18" r="3" fill={strokeColor} fillOpacity={fillTint * 1.4} />
          <Circle cx="16" cy="16" r="3" fill={strokeColor} fillOpacity={fillTint * 1.4} />
        </>
      );
    case "more":
      return <Path d="M4 7h16M4 12h16M4 17h16" />;
  }
}

export function NavIcon({ iconKey, active = false, size = 24, color }: NavIconProps) {
  const { colors, reduceMotion } = useTheme();
  const strokeColor = color ?? colors["color-text-primary"];
  const scale = useSharedValue(active ? 1.06 : 1);

  React.useEffect(() => {
    if (reduceMotion) {
      scale.value = active ? 1.05 : 1;
      return;
    }
    if (active) {
      scale.value = withSequence(
        withTiming(1.14, { duration: 150, easing: Easing.out(Easing.quad) }),
        withTiming(1.06, { duration: 160, easing: Easing.inOut(Easing.ease) })
      );
    } else {
      scale.value = withTiming(1, { duration: 160 });
    }
  }, [active, reduceMotion, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={strokeColor}
        strokeWidth={active ? 2.5 : 2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {renderIconPaths(iconKey, strokeColor, active)}
      </Svg>
    </Animated.View>
  );
}

export default NavIcon;
