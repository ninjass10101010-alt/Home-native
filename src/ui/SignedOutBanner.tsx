import React from "react";
import { StyleProp, Text, View, ViewStyle } from "react-native";
import { Material } from "../theme/Material";
import { useTheme } from "../theme/ThemeProvider";
import { mix } from "../theme/mix";
import { RADII, TYPOGRAPHY } from "../theme/tokens";

/**
 * The signed-out / saved-copy banner — the web's SyncStatusBanner pill.
 *
 * It is AMBER by contract, not by accent: "this is stale local copy, not
 * synced truth" has to read the same in all ten accents, and on the wall it
 * is competing with thirteen per-widget tones for attention. Keying the rim
 * and the fill off `accentColor` turned it into whatever the current accent
 * happened to be (a cool blue rim in the nori captures), so a state the user
 * must never mistake for "synced" was indistinguishable from chrome.
 *
 * The values are MEASURED against `reference/home/guest-dark.png`:
 *   rim  #7c5719 — `color-accent-amber` at 45% over the tier fill
 *   body #2b2924 — `color-accent-amber` at 9% into `color-surface-1`
 *   ink  `color-accent-ink-amber` — 9.23:1 dark / 5.97:1 light on that body
 */

/** Amber share of the rim, as a percent. 45% lands the composited rim on #7c5719. */
const SIGNED_OUT_BANNER_RIM = 45;
/** Amber share of the body, as a percent. 9% lands the composited body on #2b2924. */
const SIGNED_OUT_BANNER_BODY = 9;

export interface SignedOutBannerProps {
  /** The headline copy, in amber ink. */
  title: string;
  /** Optional second row (the web's sub-copy), in secondary ink. */
  message?: React.ReactNode;
  /** Optional trailing sign-in affordance (the web's "Sign in with your PIN →"). */
  action?: React.ReactNode;
  /** Wrap the whole banner in a link to the sign-in surface. */
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function SignedOutBanner({
  title,
  message,
  action,
  onPress,
  accessibilityLabel,
  style,
  testID,
}: SignedOutBannerProps) {
  const { colors } = useTheme();
  const amber = colors["color-accent-amber"];
  const ink = colors["color-accent-ink-amber"] ?? amber;

  const body = (
    <Material
      tier="thin"
      testID={testID}
      style={[
        {
          borderRadius: RADII.xl,
          borderWidth: 1,
          borderColor: mix(amber, "transparent", SIGNED_OUT_BANNER_RIM),
          backgroundColor: mix(amber, colors["color-surface-1"], SIGNED_OUT_BANNER_BODY),
          paddingHorizontal: 16,
          paddingVertical: 12,
          gap: 8,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          flexWrap: "wrap",
        },
        style,
      ]}
    >
      <Text
        style={{
          color: ink,
          fontSize: TYPOGRAPHY.label.fontSize,
          lineHeight: TYPOGRAPHY.label.lineHeight,
          fontWeight: "600",
          flexShrink: 1,
        }}
      >
        {title}
        {message ? "\n" : null}
        {message ? (
          <Text style={{ color: colors["color-text-secondary"], fontWeight: "400" }}>{message}</Text>
        ) : null}
      </Text>
      {action}
    </Material>
  );

  if (!onPress) return body;
  return (
    <View accessibilityRole="link" accessibilityLabel={accessibilityLabel} onTouchEnd={onPress}>
      {body}
    </View>
  );
}

export default SignedOutBanner;
