import React from "react";
import { View, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "./ThemeProvider";
import { Atmosphere } from "./Atmosphere";

export interface ScreenProps {
  children: React.ReactNode;
  style?: ViewStyle;
  testID?: string;
}

/**
 * Every route wraps Screen: canvas background (token), the atmosphere
 * gradient, safe-area padding. CapsuleDock floats above (rendered by the
 * layout or route, per its own contract).
 */
export function Screen({ children, style, testID }: ScreenProps) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={[{ flex: 1, backgroundColor: colors["color-canvas"] }, style]}>
      <Atmosphere />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        {children}
      </SafeAreaView>
    </View>
  );
}

export default Screen;
