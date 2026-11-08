import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { colors, MIN_TOUCH, radii } from '@/theme/tokens';

import { AppText } from './AppText';
import type { IconName } from './Button';

type Props = Omit<PressableProps, 'children'> & {
  icon: IconName;
  /** Required: icon-only controls must have a spoken label (WCAG 4.1.2). */
  label: string;
  color?: string;
  size?: number;
  /** Unread count / dot. 0 hides it. */
  badge?: number | boolean;
  /** Filled circular style, e.g. the Discover ✕ / ♥ buttons. */
  filled?: string;
};

export function IconButton({
  icon,
  label,
  color = colors.text,
  size = 24,
  badge,
  filled,
  style,
  ...rest
}: Props) {
  const dim = filled ? Math.max(MIN_TOUCH, size * 2.4) : MIN_TOUCH;
  const badgeCount = typeof badge === 'number' ? badge : 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={badgeCount ? `${label}, ${badgeCount}` : label}
      hitSlop={4}
      style={(state) => [
        styles.base,
        { width: dim, height: dim },
        filled && { backgroundColor: filled, borderRadius: radii.pill },
        state.pressed && { opacity: 0.6 },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}
    >
      <Ionicons name={icon} size={size} color={color} />
      {!!badge && (
        <View style={[styles.badge, badgeCount ? styles.badgeCount : styles.badgeDot]}>
          {!!badgeCount && (
            <AppText variant="caption" color={colors.onPrimary} style={styles.badgeText}>
              {badgeCount > 9 ? '9+' : badgeCount}
            </AppText>
          )}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
  },
  badgeDot: { width: 10, height: 10, borderWidth: 2, borderColor: colors.surface },
  badgeCount: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    top: 4,
    right: 4,
  },
  badgeText: { fontSize: 11, lineHeight: 14, fontWeight: '700' },
});
