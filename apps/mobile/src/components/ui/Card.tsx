import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radii, shadow, spacing } from '@/theme/tokens';

type Props = {
  children: ReactNode;
  onPress?: () => void;
  /** Required when onPress is set: what the card opens, read by screen readers. */
  accessibilityLabel?: string;
  /** 'raised' = white with shadow (activity cards); 'muted' = grey fill (info tiles, dashboard rows). */
  variant?: 'raised' | 'muted' | 'outline';
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Card({
  children,
  onPress,
  accessibilityLabel,
  variant = 'raised',
  padded = true,
  style,
}: Props) {
  const base = [styles.card, styles[variant], padded && styles.padded, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [...base, pressed && { opacity: 0.85 }]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.lg, overflow: 'hidden' },
  padded: { padding: spacing.lg },
  raised: { backgroundColor: colors.surface, ...shadow.card },
  muted: { backgroundColor: colors.surfaceMuted },
  outline: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border },
});
