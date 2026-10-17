import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, MIN_TOUCH, radii, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import type { IconName } from './Button';

type Props = {
  title: string;
  subtitle?: string;
  /** Red subtitle, e.g. "5 pending decision" on the admin dashboard. */
  subtitleTone?: 'muted' | 'alert';
  icon?: IconName;
  left?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  /** Draw as a grey tile (admin dashboard) instead of a plain row (settings / profile menu). */
  tile?: boolean;
};

export function ListRow({
  title,
  subtitle,
  subtitleTone = 'muted',
  icon,
  left,
  right,
  onPress,
  destructive,
  tile,
}: Props) {
  const fg = destructive ? colors.error : colors.text;
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        tile && styles.tile,
        pressed && { backgroundColor: colors.divider },
      ]}
    >
      {left ?? (icon && <Ionicons name={icon} size={22} color={fg} />)}
      <View style={styles.body}>
        <AppText variant={tile ? 'h3' : 'body'} color={fg}>
          {title}
        </AppText>
        {subtitle && (
          <AppText
            variant="caption"
            color={subtitleTone === 'alert' ? colors.error : colors.textMuted}
          >
            {subtitle}
          </AppText>
        )}
      </View>
      {right ??
        (onPress && !destructive && (
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        ))}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: MIN_TOUCH + 8,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
  },
  tile: { backgroundColor: colors.surfaceMuted, paddingVertical: spacing.lg },
  body: { flex: 1, gap: 2 },
});
