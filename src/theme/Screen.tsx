import React from "react";
import { Platform, useWindowDimensions, View, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "./ThemeProvider";
import { Atmosphere } from "./Atmosphere";

const DESIGN_WIDTH = 1080;
const DESIGN_HEIGHT = 1920;

export interface ScreenProps {
  children: React.ReactNode;
  style?: ViewStyle;
  testID?: string;
  /**
   * Mount the full-bleed atmosphere behind the canvas. Product surfaces leave
   * it on; the WS-0 design-kit page (`/_design`) turns it OFF so the capture
   * shows the bare `--color-canvas` token, exactly like the web's design-system
   * page (Home-ai src/app/design-system/page.tsx:90, whose reference capture
   * measures L* 5.0 = #0f1117). Reviewing a palette through a time-of-day
   * gradient is reviewing the wrong thing.
   */
  atmosphere?: boolean;
}

/**
 * Every route wraps Screen: canvas background (token), the atmosphere
 * gradient, safe-area padding. CapsuleDock floats above (rendered by the
 * layout or route, per its own contract).
 *
 * On physical Android hardware (where OS density may be 160/213/240/320/480 dpi
 * so useWindowDimensions() is not 1080×1920 dp), the 1080×1920 wall stage is
 * proportionally scaled to fit the exact device viewport without clipping.
 */
export function Screen({ children, style, testID, atmosphere = true }: ScreenProps) {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const shouldScale =
    typeof jest === "undefined" &&
    Platform.OS === "android" &&
    width > 0 &&
    height > 0 &&
    (width < 960 || height < 1600);

  if (!shouldScale) {
    return (
      <View testID={testID} style={[{ flex: 1, backgroundColor: colors["color-canvas"] }, style]}>
        {atmosphere ? <Atmosphere /> : null}
        <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
          {children}
        </SafeAreaView>
      </View>
    );
  }

  const scale = Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT);
  const stageWidth = Math.round(width / scale);
  const stageHeight = Math.round(height / scale);

  return (
    <View
      testID={testID}
      style={[
        {
          flex: 1,
          backgroundColor: colors["color-canvas"],
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        },
        style,
      ]}
    >
      {atmosphere ? <Atmosphere /> : null}
      <View
        style={{
          width: stageWidth,
          height: stageHeight,
          transform: [{ scale }],
        }}
      >
        <SafeAreaView style={{ flex: 1 }} edges={["left", "right"]}>
          {children}
        </SafeAreaView>
      </View>
    </View>
  );
}

export default Screen;
