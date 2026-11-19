import React, { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Stack, usePathname, useRouter } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import { NavigationBar } from "expo-navigation-bar";
import { activateKeepAwakeAsync } from "expo-keep-awake";
import { AccentScope, ThemeProvider, useTheme } from "../src/theme/ThemeProvider";
import { RootWallStage } from "../src/theme/Screen";
import { useKidCharacter } from "../src/theme/kidCharacter";
import { TOKENS } from "../src/theme/tokens";
import { AuthProvider, useAuth } from "../src/state/AuthProvider";
import { SyncManager } from "../src/state/SyncManager";
import { PlaybackProvider } from "../src/music/playback";
import { CastProvider } from "../src/music/CastProvider";
import { MusicIsland } from "../src/music/MusicIsland";
import { CapsuleDock, RootDockContext } from "../src/nav/CapsuleDock";
import { ToastProvider } from "../src/ui/Toast";
import { hydrateBaseUrl } from "../src/api/config";
import { configureNotifications } from "../src/native/notifications";
import { NotificationMonitor } from "../src/native/useNotificationMonitor";
import { BroadcastReceiver } from "../src/native/useBroadcastReceiver";
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

/**
 * Persistent wall chrome: Stack with calm fade transitions, root CapsuleDock
 * (so tab switches never tear down or flash the dock), and floating MusicIsland.
 */
function WallAppChrome() {
  const { reduceMotion } = useTheme();
  const { role, hydrated } = useAuth();
  const kidSkin = useKidCharacter();
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const navRole = role === "parent" ? "parent" : role ? "child" : "guest";
  const showDock = pathname !== "/screensaver" && !pathname.startsWith("/_design");

  return (
    <>
      <RootDockContext.Provider value={true}>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: reduceMotion ? "none" : "fade",
            animationTypeForReplace: "push",
            contentStyle: { backgroundColor: "transparent" },
          }}
        />
      </RootDockContext.Provider>
      {showDock ? (
        <AccentScope accent={kidSkin?.accentKey}>
          <CapsuleDock
            isRoot
            role={navRole}
            hydrated={hydrated}
            pathname={pathname}
            onNavigate={(p) => router.replace(p as never)}
          />
        </AccentScope>
      ) : null}
      {/*
        THE FLOATING CHROME (SP3-B Task 5).

        The app's nav is the persistent floating glass dock (src/nav/CapsuleDock.tsx);
        the mini-player / dynamic island pill is the top global piece of floating
        chrome. It renders DIRECTLY here without a full-screen box-none wrapper
        so Fabric Android never swallows dock taps.
      */}
      <MusicIsland />
    </>
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
                <RootWallStage>
                  <ToastProvider>
                    <StatusBar hidden />
                    <NavigationBar hidden />
                    <NotificationMonitor />
                    <BroadcastReceiver />
                    <PokeBoundary>
                      <WallAppChrome />
                    </PokeBoundary>
                  </ToastProvider>
                </RootWallStage>
              </SyncManager>
            </CastProvider>
          </PlaybackProvider>
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
