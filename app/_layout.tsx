import React, { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Stack } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import { NavigationBar } from "expo-navigation-bar";
import { activateKeepAwakeAsync } from "expo-keep-awake";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { ToastProvider } from "../src/ui/Toast";

/**
 * Root layout. Provider chain (final order as more providers land):
 *   GestureHandlerRootView > ThemeProvider > AuthProvider (Task 12) >
 *   SyncManager (Task 13) > ToastProvider > Stack
 * Device locks per the single-device contract (spec decision 7): portrait
 * only, always-on while the app runs, immersive navigation bar.
 */
export default function RootLayout() {
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    activateKeepAwakeAsync("consuela-wall").catch(() => {});
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <ToastProvider>
          <StatusBar hidden />
          <NavigationBar hidden />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "transparent" } }} />
        </ToastProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
