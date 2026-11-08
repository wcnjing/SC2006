import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { colors, spacing } from '@/theme/tokens';

type Props = {
  title: string;
  /** Right-side link, e.g. "See all". */
  actionLabel?: string;
  onAction?: () => void;
  children: ReactNode;
};

/** Titled content block ("Recommended for you", "Happening nearby", "Reports"). */
export function Section({ title, actionLabel, onAction, children }: Props) {
  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <AppText variant="h3" heading style={{ flex: 1 }}>
          {title}
        </AppText>
        {actionLabel && onAction && (
          <Pressable accessibilityRole="link" onPress={onAction} hitSlop={12}>
            <AppText variant="label" color={colors.primary}>
              {actionLabel}
            </AppText>
          </Pressable>
        )}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center' },
});
