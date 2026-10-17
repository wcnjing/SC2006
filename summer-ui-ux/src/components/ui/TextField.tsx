import { Ionicons } from '@expo/vector-icons';
import { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { useSettings } from '@/context/SettingsContext';
import { colors, MIN_TOUCH, radii, spacing, typography } from '@/theme/tokens';

import { AppText } from './AppText';
import type { IconName } from './Button';

export type TextFieldProps = TextInputProps & {
  label: string;
  hint?: string;
  error?: string | null;
  optional?: boolean;
  leftIcon?: IconName;
  /** Renders a show/hide toggle and masks input. */
  password?: boolean;
};

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, hint, error, optional, leftIcon, password, style, multiline, ...rest },
  ref,
) {
  const { t, textScale } = useSettings();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const borderColor = error ? colors.error : focused ? colors.text : colors.border;

  return (
    <View style={styles.wrap}>
      <AppText variant="label" nativeID={`${label}-label`}>
        {label}
        {optional && (
          <AppText variant="caption" color={colors.textSubtle}>
            {'  '}
            {t('common.optional')}
          </AppText>
        )}
      </AppText>
      {hint && (
        <AppText variant="caption" color={colors.textMuted}>
          {hint}
        </AppText>
      )}
      <View
        style={[
          styles.box,
          multiline && styles.multiline,
          { borderColor, borderWidth: focused || error ? 2 : 1.5 },
        ]}
      >
        {leftIcon && <Ionicons name={leftIcon} size={20} color={colors.textMuted} />}
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          accessibilityHint={hint}
          aria-invalid={!!error}
          placeholderTextColor={colors.textSubtle}
          secureTextEntry={password && hidden}
          autoCapitalize={password ? 'none' : rest.autoCapitalize}
          autoCorrect={password ? false : rest.autoCorrect}
          multiline={multiline}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          style={[
            styles.input,
            typography('body', textScale),
            multiline && styles.inputMultiline,
            style,
          ]}
          {...rest}
        />
        {password && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? t('common.showPassword') : t('common.hidePassword')}
            onPress={() => setHidden((h) => !h)}
            hitSlop={8}
            style={styles.eye}
          >
            <Ionicons
              name={hidden ? 'eye-outline' : 'eye-off-outline'}
              size={22}
              color={colors.textMuted}
            />
          </Pressable>
        )}
      </View>
      {error && (
        <View style={styles.errorRow} accessibilityLiveRegion="polite" accessibilityRole="alert">
          <Ionicons name="alert-circle" size={16} color={colors.error} />
          <AppText variant="caption" color={colors.error} style={styles.errorText}>
            {error}
          </AppText>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs + 2 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: MIN_TOUCH + 4,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  multiline: { alignItems: 'flex-start', paddingVertical: spacing.md },
  input: {
    flex: 1,
    color: colors.text,
    paddingVertical: spacing.sm,
    outlineStyle: 'none',
  } as object,
  inputMultiline: { minHeight: 96, textAlignVertical: 'top' },
  eye: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -spacing.sm,
  },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  errorText: { flex: 1 },
});
