import React from "react";

type Props = {
  children?: React.ReactNode;
  accessibilityLabel?: string;
  accessibilityRole?: string;
  accessibilityState?: { disabled?: boolean };
  accessibilityHint?: string;
  editable?: boolean;
  multiline?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  onChangeText?: (value: string) => void;
  value?: string;
  maxLength?: number;
  numberOfLines?: number;
  placeholder?: string;
  textAlignVertical?: string;
  style?: React.CSSProperties | React.CSSProperties[];
  [key: string]: unknown;
};
const style = (value: Props["style"]) => Array.isArray(value) ? Object.assign({}, ...value) : value;

export function View({ children, accessibilityLabel, style: styleProp }: Props) {
  return <div aria-label={accessibilityLabel} style={style(styleProp)}>{children}</div>;
}
export function ScrollView({ children, style: styleProp }: Props) {
  return <main style={style(styleProp)}>{children}</main>;
}
export function Text({ children, accessibilityRole, style: styleProp }: Props) {
  const Tag = accessibilityRole === "header" ? "h3" : "span";
  return <Tag role={accessibilityRole === "alert" ? "alert" : undefined} style={style(styleProp)}>{children}</Tag>;
}
export function TextInput({
  accessibilityLabel, accessibilityHint, editable, multiline, value, onChangeText,
  maxLength, placeholder, style: styleProp,
}: Props) {
  const common = {
    "aria-label": accessibilityLabel,
    title: accessibilityHint,
    disabled: editable === false,
    value,
    maxLength,
    placeholder,
    style: style(styleProp),
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChangeText?.(event.target.value),
  };
  return multiline ? <textarea {...common} /> : <input {...common} />;
}
export function TouchableOpacity({
  children, accessibilityRole, accessibilityLabel, accessibilityState,
  disabled, onPress, style: styleProp,
}: Props) {
  return <button type="button" role={accessibilityRole === "link" ? "link" : "button"}
    aria-label={accessibilityLabel} disabled={disabled || accessibilityState?.disabled}
    onClick={onPress} style={style(styleProp)}>{children}</button>;
}
export function ActivityIndicator({ accessibilityLabel }: Props) {
  return <span role="status" aria-label={accessibilityLabel}>Loading</span>;
}
export const StyleSheet = { create: <T extends Record<string, unknown>>(styles: T) => styles, hairlineWidth: 1 };
export const Linking = { openURL: async (_url: string) => undefined };
export const Platform = { OS: "ios" };
