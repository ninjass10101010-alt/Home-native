import { PixelRatio, Platform } from "react-native";

export type PerfTier = "full" | "reduced";

/**
 * Effect-tier gating for the ApoloSign RK3576 panel (spec §4). Live blur is
 * GPU-hungry; on old Android or very low-density hardware we bake tints
 * instead of running BlurView. The ApoloSign (1080×1920 @ ~213dpi ≈ 1.33,
 * Android 15) lands on "full".
 *
 * Parameters are injectable for tests; defaults read the device.
 */
export function perfTier(
  density: number = PixelRatio.get(),
  androidVersion: number | null =
    Platform.OS === "android" ? (Platform.Version as number) : null
): PerfTier {
  const androidOk = androidVersion === null || androidVersion >= 31;
  return androidOk && density >= 1.3 ? "full" : "reduced";
}
