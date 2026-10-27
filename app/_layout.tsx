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
import { CastProvider } from "../src/music/CastProvider";
import { MusicIsland } from "../src/music/MusicIsland";
import { ToastProvider } from "../src/ui/Toast";
import { hydrateBaseUrl } from "../src/api/config";
import { configureNotifications } from "../src/native/notifications";
import { NotificationMonitor } from "../src/native/useNotificationMonitor";
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
    Oswald: require("../assets/fonts/Oswald-SemiBold.ttf"),
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
            <CastProvider>
              <SyncManager>
                <ToastProvider>
                  <StatusBar hidden />
                  <NavigationBar hidden />
                  <NotificationMonitor />
                  <PokeBoundary>
                    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "transparent" } }} />
                    {/*
                      THE FLOATING CHROME (SP3-B Task 5).

                      The app's nav is the floating glass dock
                      (src/nav/CapsuleDock.tsx), rendered per route; the
                      mini-player pill is the one global piece of floating
                      chrome. It renders DIRECTLY here — its own wrapper
                      (testID `mini-player-floating`) is already
                      absolute + `pointerEvents="box-none"` and only occupies
                      the pill's band, so it sits above the page and clears the
                      dock's reserved band (DOCK_TOP_OFFSET) without covering
                      it. Wrapping it in an extra full-screen box-none layer
                      was tried and reverted: on Fabric Android that layer
                      swallowed the dock's taps.
                    */}
                    <MusicIsland />
                  </PokeBoundary>
                </ToastProvider>
              </SyncManager>
            </CastProvider>
          </PlaybackProvider>
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
