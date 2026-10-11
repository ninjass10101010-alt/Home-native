import React from "react";
import { useRouter } from "expo-router";
import { Screensaver } from "../src/screensaver/Screensaver";

/**
 * /screensaver — the wall's ambient idle board (WS-8). EXEMPT_ROUTE: no dock,
 * no nav — full-bleed. Reached by Home's idle timeout; any tap exits back to
 * the previous route (or Home when the stack is empty, so it's never a dead
 * end — same contract as /emergency).
 */
export default function ScreensaverRoute() {
  const router = useRouter();
  const onExit = React.useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/" as never);
  }, [router]);
  return <Screensaver onExit={onExit} />;
}
