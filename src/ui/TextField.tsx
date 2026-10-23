import React from "react";
import { Text, TextInput, View, ViewStyle } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { TYPOGRAPHY, MIN_TARGET_DP } from "../theme/tokens";
import { mix } from "../theme/mix";

export interface TextFieldProps {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric" | "email-address" | "number-pad";
  secureTextEntry?: boolean;
  helperText?: React.ReactNode;
  errorText?: React.ReactNode;
  style?: ViewStyle;
  testID?: string;
  multiline?: boolean;
  minHeight?: number;
  autoFocus?: boolean;
}

/**
 * RN port of ui/TextField.tsx. Wall floor: 64dp field height, 14sp label /
 * helper, the focus ring is the accent at 50% border + 12% wash (from the web
 * rule); error state uses the rose accent, error text announced via live
 * region.
 */
export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  secureTextEntry,
  helperText,
  errorText,
  style,
  testID,
  multiline = false,
  minHeight,
  autoFocus = false,
}: TextFieldProps) {
  const { colors, accentColor } = useTheme();
  const [focused, setFocused] = React.useState(false);
  const rose = colors["color-accent-rose"] ?? accentColor;

  return (
    <View style={style}>
      {label ? (
        <Text
          style={{
            marginBottom: 8,
            color: colors["color-text-secondary"],
            ...TYPOGRAPHY.fieldLabel,
          }}
        >
          {label}
        </Text>
      ) : null}
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors["color-text-secondary"]}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        autoFocus={autoFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel={label}
        style={{
          minHeight: multiline ? Math.max(minHeight ?? 96, MIN_TARGET_DP) : MIN_TARGET_DP,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: errorText
            ? mix(rose, "transparent", 50)
            : focused
              ? mix(accentColor, "transparent", 50)
              : colors["color-border"] ?? "transparent",
          backgroundColor: colors["color-surface-2"],
          paddingHorizontal: 20,
          paddingVertical: 14,
          textAlignVertical: multiline ? "top" : "center",
          color: colors["color-text-primary"],
          fontSize: TYPOGRAPHY.body.fontSize,
        }}
      />
      {helperText || errorText ? (
        <Text
          accessibilityLiveRegion="polite"
          style={{
            marginTop: 6,
            fontSize: TYPOGRAPHY.label.fontSize,
            color: errorText ? rose : colors["color-text-secondary"],
          }}
        >
          {errorText || helperText}
        </Text>
      ) : null}
    </View>
  );
}

export default TextField;
