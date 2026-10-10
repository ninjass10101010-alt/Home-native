import React from "react";
import { Text, View } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";
import { TYPOGRAPHY } from "../../theme/tokens";
import { EmptyState } from "../../ui/EmptyState";
import { READ_COPY, READ_COPY_STALE, READ_RETRY_LABEL, type ReadFailure } from "./data";

export interface WidgetFrameProps {
  /** Widget id used to namespace testIDs (`${id}-loading` / `${id}-error`). */
  id: string;
  icon: string;
  title: string;
  description?: string;
  status: "loading" | "ready" | "error";
  failure: ReadFailure | null;
  hasData: boolean;
  stale: boolean;
  onRetry: () => void;
  /** Optional header override (e.g. the meal widget's "{Icon} Dinner Time · 6:05 PM"). */
  header?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * The shared wall-cell interior. The Material shell lives in HomeWall; this
 * renders ONLY content: a compact centered header, the loading skeleton (two
 * 64dp ghost rows), the honest failure card (calm copy + retry → refreshNow),
 * and a stale badge whenever what is on screen may not be the family truth.
 */
export function WidgetFrame({
  id,
  icon,
  title,
  description,
  status,
  failure,
  hasData,
  stale,
  onRetry,
  header,
  children,
}: WidgetFrameProps) {
  const { colors, accentColor } = useTheme();

  const headerBlock = header ?? (
    <View style={{ alignItems: "center" }}>
      <Text style={{ fontSize: 22, lineHeight: 26 }}>{icon}</Text>
      <Text
        style={{ color: colors["color-text-primary"], fontSize: TYPOGRAPHY.title.fontSize, fontWeight: "700", marginTop: 2 }}
        accessibilityRole="header"
      >
        {title}
      </Text>
      {description ? (
        <Text style={{ color: colors["color-text-secondary"], fontSize: TYPOGRAPHY.label.fontSize, marginTop: 2 }}>
          {description}
        </Text>
      ) : null}
    </View>
  );

  if (status === "loading") {
    return (
      <View testID={`${id}-loading`} accessibilityLabel={`Loading ${title}`} style={{ flex: 1, gap: 12 }}>
        {headerBlock}
        {[0, 1].map((i) => (
          <View
            key={i}
            style={{ height: 64, borderRadius: 20, backgroundColor: colors["color-surface-2"] }}
          />
        ))}
      </View>
    );
  }

  if (status === "error" && failure !== null && !hasData) {
    return (
      <View testID={`${id}-error`} style={{ flex: 1, justifyContent: "center" }}>
        <EmptyState
          flat
          icon={icon}
          title={title}
          body={READ_COPY[failure]}
          actionLabel={failure === "unauthorised" ? undefined : READ_RETRY_LABEL}
          onAction={failure === "unauthorised" ? undefined : onRetry}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, minHeight: 0 }}>
      {headerBlock}
      {stale ? (
        <Text
          testID={`${id}-stale`}
          style={{
            alignSelf: "center",
            marginTop: 6,
            color: colors["color-accent-amber"] ?? accentColor,
            fontSize: TYPOGRAPHY.label.fontSize,
            fontWeight: "600",
          }}
        >
          {READ_COPY_STALE}
        </Text>
      ) : null}
      <View style={{ flex: 1, minHeight: 0, marginTop: 10 }}>{children}</View>
    </View>
  );
}

export default WidgetFrame;
