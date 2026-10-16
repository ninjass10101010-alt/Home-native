import React from "react";
import { Text, View, ViewStyle } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { TYPOGRAPHY } from "../theme/tokens";

export interface PageHeaderProps {
  /** The display title — serif masthead (web `.text-display`, wall-scaled). */
  title: string;
  /** Tracked uppercase kicker ABOVE the title (web `.text-eyebrow`). */
  eyebrow?: string;
  /** Muted sentence BELOW the title — real copy, never truncated. */
  lede?: string;
  /** Right-side actions (toggles, buttons) sharing the title's baseline band. */
  action?: React.ReactNode;
  style?: ViewStyle;
  testID?: string;
}

/**
 * Page-title architecture (RN port of Home-ai's PageHeader pattern,
 * components/patterns/PageHeader.tsx:34-36): a muted tracked uppercase EYEBROW
 * above a serif DISPLAY title at weight 400 with tight tracking, optional
 * actions to the right, optional lede below.
 *
 * The eye reads the system in this order — eyebrow (register) → display (voice)
 * → lede (detail). A bold sans slab at 72sp collapsed all three into one
 * shouting block, which is what the WS-0 critic caught on /_design.
 */
export function PageHeader({
  title,
  eyebrow,
  lede,
  action,
  style,
  testID,
}: PageHeaderProps) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={[{ gap: 10 }, style]}>
      {eyebrow ? (
        <Text testID={testID ? `${testID}-eyebrow` : undefined} style={{ color: colors["color-text-muted"], ...TYPOGRAPHY.eyebrow }}>
          {eyebrow}
        </Text>
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
        <Text
          testID={testID ? `${testID}-title` : undefined}
          accessibilityRole="header"
          numberOfLines={2}
          style={{ flexShrink: 1, color: colors["color-text-primary"], ...TYPOGRAPHY.display }}
        >
          {title}
        </Text>
        {action ? <View style={{ flexShrink: 0 }}>{action}</View> : null}
      </View>
      {lede ? (
        <Text testID={testID ? `${testID}-lede` : undefined} style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.body.fontSize, lineHeight: TYPOGRAPHY.body.lineHeight }}>
          {lede}
        </Text>
      ) : null}
    </View>
  );
}

export default PageHeader;
