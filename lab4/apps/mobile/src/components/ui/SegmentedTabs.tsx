import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radii, spacing } from '@/theme/tokens';

import { AppText } from './AppText';

type Props<T extends string> = {
  tabs: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  accessibilityLabel: string;
};

/**
 * In-screen tab switcher: Upcoming / Saved / Past, Latest / Announcements,
 * Upcoming / Nearby Places. Replaces the mockups' mix of teal and blue tab styles.
 */
export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
  accessibilityLabel,
}: Props<T>) {
  return (
    <View accessibilityRole="tablist" accessibilityLabel={accessibilityLabel} style={styles.track}>
      {tabs.map((tab) => {
        const selected = tab.value === value;
        return (
          <Pressable
            key={tab.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(tab.value)}
            style={[styles.tab, selected && styles.selected]}
          >
            <AppText
              variant="label"
              color={selected ? colors.primary : colors.textMuted}
              numberOfLines={1}
            >
              {tab.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  tab: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
  },
  selected: {
    backgroundColor: colors.surface,
    shadowColor: '#101828',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
});
