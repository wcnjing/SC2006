import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useT } from '@/context/SettingsContext';
import { colors, MIN_TOUCH, radii, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import type { IconName } from './Button';
import { IconButton } from './IconButton';

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  label: string;
  /** Inline prefix shown inside the field, e.g. "Sort by:" / "Post to:" in the mockups. */
  inlineLabel?: string;
  value: T | null;
  options: Option<T>[];
  onChange: (v: T) => void;
  placeholder?: string;
  leftIcon?: IconName;
  error?: string | null;
  /** Hide the label above the field (when the screen already labels it). Still read by screen readers. */
  hideLabel?: boolean;
};

/**
 * Dropdown that opens a bottom sheet list. A native picker looks different
 * on every platform and is hard to make accessible, so this works the same
 * on iOS, Android and web.
 */
export function Select<T extends string>({
  label,
  inlineLabel,
  value,
  options,
  onChange,
  placeholder,
  leftIcon,
  error,
  hideLabel,
}: Props<T>) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);

  return (
    <View style={styles.wrap}>
      {!hideLabel && <AppText variant="label">{label}</AppText>}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current?.label ?? placeholder ?? t('common.select')}`}
        accessibilityHint={t('common.select')}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.field,
          { borderColor: error ? colors.error : colors.border, borderWidth: error ? 2 : 1.5 },
          pressed && { backgroundColor: colors.surfaceMuted },
        ]}
      >
        {leftIcon && <Ionicons name={leftIcon} size={20} color={colors.text} />}
        {inlineLabel && <AppText color={colors.textMuted}>{inlineLabel}</AppText>}
        <AppText
          variant={inlineLabel ? 'bodyStrong' : 'body'}
          color={current ? colors.text : colors.textSubtle}
          style={styles.value}
          numberOfLines={1}
        >
          {current?.label ?? placeholder ?? t('common.select')}
        </AppText>
        <Ionicons name="chevron-down" size={20} color={colors.text} />
      </Pressable>
      {error && (
        <View style={styles.errorRow} accessibilityRole="alert" accessibilityLiveRegion="polite">
          <Ionicons name="alert-circle" size={16} color={colors.error} />
          <AppText variant="caption" color={colors.error}>
            {error}
          </AppText>
        </View>
      )}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable
          style={styles.backdrop}
          onPress={() => setOpen(false)}
          accessibilityLabel={t('common.close')}
        />
        <View
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}
          accessibilityViewIsModal
        >
          <View style={styles.sheetHeader}>
            <AppText variant="h3" heading style={{ flex: 1 }}>
              {label}
            </AppText>
            <IconButton icon="close" label={t('common.close')} onPress={() => setOpen(false)} />
          </View>
          <FlatList
            data={options}
            keyExtractor={(o) => o.value}
            renderItem={({ item }) => {
              const selected = item.value === value;
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.option,
                    (pressed || selected) && { backgroundColor: colors.surfaceMuted },
                  ]}
                >
                  <AppText variant={selected ? 'bodyStrong' : 'body'} style={{ flex: 1 }}>
                    {item.label}
                  </AppText>
                  {selected && <Ionicons name="checkmark" size={22} color={colors.primary} />}
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs + 2 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: MIN_TOUCH + 4,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  value: { flex: 1 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    maxHeight: '70%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingTop: spacing.sm,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.xl,
    paddingRight: spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MIN_TOUCH + 4,
    paddingHorizontal: spacing.xl,
  },
});
