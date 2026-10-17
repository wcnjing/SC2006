import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radii, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import type { IconName } from './Button';

type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: IconName;
  /** 'checkbox' for multi-select groups, 'radio' for single-select. */
  mode?: 'checkbox' | 'radio';
};

/**
 * Selectable pill (interests, filter categories, distance). Selected state is
 * filled red. The mockups mixed red and teal for this; red is now the only
 * selected colour. A check icon is shown too, so selection is not conveyed
 * by colour alone (WCAG 1.4.1).
 */
export function Chip({ label, selected, onPress, icon, mode = 'checkbox' }: ChipProps) {
  return (
    <Pressable
      accessibilityRole={mode}
      accessibilityState={mode === 'radio' ? { selected } : { checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={{ top: 4, bottom: 4 }}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.selected : styles.unselected,
        pressed && { opacity: 0.75 },
      ]}
    >
      {selected ? (
        <Ionicons name="checkmark" size={18} color={colors.onPrimary} />
      ) : (
        icon && <Ionicons name={icon} size={18} color={colors.text} />
      )}
      <AppText variant="label" color={selected ? colors.onPrimary : colors.text}>
        {label}
      </AppText>
    </Pressable>
  );
}

type ChipGroupProps<T extends string> = {
  options: { value: T; label: string; icon?: IconName }[];
  /** Multi-select when an array, single-select when a value or null. */
  value: T[] | T | null;
  onChange: (next: T[] | T) => void;
  accessibilityLabel: string;
};

export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: ChipGroupProps<T>) {
  const multi = Array.isArray(value);
  const isSelected = (v: T) => (multi ? value.includes(v) : value === v);
  const toggle = (v: T) => {
    if (multi) onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
    else onChange(v);
  };
  return (
    <View
      accessibilityRole={multi ? undefined : 'radiogroup'}
      accessibilityLabel={accessibilityLabel}
      style={styles.group}
    >
      {options.map((o) => (
        <Chip
          key={o.value}
          label={o.label}
          icon={o.icon}
          selected={isSelected(o.value)}
          mode={multi ? 'checkbox' : 'radio'}
          onPress={() => toggle(o.value)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    borderWidth: 1.5,
  },
  selected: { backgroundColor: colors.primary, borderColor: colors.primary },
  unselected: { backgroundColor: colors.surface, borderColor: colors.border },
});
