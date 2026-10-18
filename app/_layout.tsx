import React, { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Stack } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import { NavigationBar } from "expo-navigation-bar";
import { activateKeepAwakeAsync } from "expo-keep-awake";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { TOKENS } from "../src/theme/tokens";
import { AuthProvider, useAuth } from "../src/state/AuthProvider";
import { SyncManager } from "../src/state/SyncManager";
import { PlaybackProvider } from "../src/music/playback";
import { ToastProvider } from "../src/ui/Toast";
import { hydrateBaseUrl } from "../src/api/config";
import { configureNotifications } from "../src/native/notifications";
import { View } from "react-native";

/**
 * Root layout. Provider chain (final order as more providers land):
 *   GestureHandlerRootView > ThemeProvider > AuthProvider (Task 12) >
 *   SyncManager (Task 13) > ToastProvider > Stack
 * Device locks per the single-device contract (spec decision 7): portrait
 * only, always-on while the app runs, immersive navigation bar.
 */
/** Wall-touch activity → idle timers reset (the web's activity-listener parity). */
function PokeBoundary({ children }: { children: React.ReactNode }) {
  const { poke } = useAuth();
  return (
    <View style={{ flex: 1 }} onTouchStart={poke}>
      {children}
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Fredoka: require("../assets/fonts/Fredoka.ttf"),
    // The web's --font-display (Home-ai layout.tsx:28-33, weight 400). Bundled
    // rather than falling back to the generic "serif": the review set is set in
    // Instrument, and the greeting / display mastheads depend on its shapes.
    "Instrument Serif": require("../assets/fonts/InstrumentSerif-Regular.ttf"),
  });
  useEffect(() => {
    hydrateBaseUrl().catch(() => {});
    configureNotifications();
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    activateKeepAwakeAsync("consuela-wall").catch(() => {});
  }, []);

  if (!fontsLoaded && !fontError) {
    return typeof jest !== "undefined" ? null : (
      <View style={{ flex: 1, backgroundColor: TOKENS.dark["color-canvas"] }} />
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AuthProvider>
          <PlaybackProvider>
            <SyncManager>
              <ToastProvider>
                <StatusBar hidden />
                <NavigationBar hidden />
                <PokeBoundary>
                  <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "transparent" } }} />
                </PokeBoundary>
              </ToastProvider>
            </SyncManager>
          </PlaybackProvider>
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
