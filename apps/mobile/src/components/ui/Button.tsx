import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, MIN_TOUCH, radii, spacing } from '@/theme/tokens';

import { AppText } from './AppText';

export type IconName = ComponentProps<typeof Ionicons>['name'];

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';

export type ButtonProps = Omit<PressableProps, 'style' | 'children'> & {
  label: string;
  variant?: Variant;
  size?: 'md' | 'sm';
  icon?: IconName;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Custom content (e.g. the Singpass wordmark) in place of the label text. Label is still used for a11y. */
  children?: ReactNode;
};

const VARIANTS: Record<Variant, { bg: string; bgPressed: string; fg: string; border?: string }> = {
  primary: { bg: colors.primary, bgPressed: colors.primaryPressed, fg: colors.onPrimary },
  secondary: { bg: colors.surfaceMuted, bgPressed: colors.divider, fg: colors.text },
  outline: {
    bg: colors.surface,
    bgPressed: colors.surfaceMuted,
    fg: colors.text,
    border: colors.borderStrong,
  },
  ghost: { bg: 'transparent', bgPressed: colors.surfaceMuted, fg: colors.primary },
  danger: {
    bg: colors.surface,
    bgPressed: colors.errorSoft,
    fg: colors.error,
    border: colors.error,
  },
};

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  icon,
  loading,
  disabled,
  fullWidth = true,
  style,
  children,
  ...rest
}: ButtonProps) {
  const v = VARIANTS[variant];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      hitSlop={size === 'sm' ? 8 : 0}
      style={({ pressed }) => [
        styles.base,
        size === 'sm' && styles.sm,
        fullWidth && styles.full,
        { backgroundColor: pressed ? v.bgPressed : v.bg },
        v.border && { borderWidth: 1.5, borderColor: v.border },
        isDisabled && styles.disabled,
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <View style={styles.row}>
          {icon && <Ionicons name={icon} size={size === 'sm' ? 18 : 20} color={v.fg} />}
          {children ?? (
            <AppText variant={size === 'sm' ? 'label' : 'button'} color={v.fg}>
              {label}
            </AppText>
          )}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TOUCH + 4,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sm: { minHeight: 40, paddingHorizontal: spacing.lg, borderRadius: radii.sm },
  full: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  disabled: { opacity: 0.5 },
});
