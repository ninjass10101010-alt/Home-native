import React from "react";
import type { CastValue } from "./CastProvider";

/**
 * The web preview's Cast provider.
 *
 * `react-native-google-cast` is native-only: importing it on web threw before
 * the app tree could paint (the provider is mounted in the root layout), which
 * took the whole wall — and the paint audit — down. Metro resolves this file
 * for web, so the native module is never evaluated there.
 *
 * Everything is an honest no-op: casting is UNAVAILABLE on this platform, and
 * the UI must say so rather than pretend a device might appear.
 */
const noopCast: CastValue = {
  state: "unavailable",
  devices: [],
  target: null,
  casting: false,
  playing: false,
  position: 0,
  duration: null,
  busy: false,
  error: null,
  connect: async () => false,
  startCast: async () => {},
  disconnect: async () => {},
  play: async () => {},
  pause: async () => {},
  seek: async () => {},
  advance: async () => {},
  previous: async () => {},
};

export function CastProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function useCast(): CastValue {
  return noopCast;
}

export default CastProvider;
