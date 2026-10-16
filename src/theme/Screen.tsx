import React from "react";
import { View, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "./ThemeProvider";
import { Atmosphere } from "./Atmosphere";

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
 */
export function Screen({ children, style, testID, atmosphere = true }: ScreenProps) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={[{ flex: 1, backgroundColor: colors["color-canvas"] }, style]}>
      {atmosphere ? <Atmosphere /> : null}
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        {children}
      </SafeAreaView>
    </View>
  );
}

export default Screen;
