import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, radii, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import type { IconName } from './Button';

type Tone = 'info' | 'warning' | 'error' | 'success' | 'insight';

const TONES: Record<Tone, { bg: string; fg: string; icon: IconName }> = {
  info: { bg: colors.infoSoft, fg: colors.info, icon: 'information-circle' },
  warning: { bg: colors.warningSoft, fg: colors.warning, icon: 'warning' },
  error: { bg: colors.errorSoft, fg: colors.error, icon: 'alert-circle' },
  success: { bg: colors.successSoft, fg: colors.success, icon: 'checkmark-circle' },
  insight: { bg: colors.insightSoft, fg: colors.insight, icon: 'sparkles' },
};

/**
 * Inline message strip. Use cases:
 *  - error: form submit failures (announced to screen readers)
 *  - warning: weather warnings ("Check for updates before leaving")
 *  - insight: recommendation reasons (FR 5.1.6)
 *  - info / success: neutral notices, confirmations
 */
export function Banner({
  tone = 'info',
  children,
  icon,
}: {
  tone?: Tone;
  children: ReactNode;
  icon?: IconName;
}) {
  const c = TONES[tone];
  const urgent = tone === 'error' || tone === 'warning';
  return (
    <View
      style={[styles.banner, { backgroundColor: c.bg }]}
      accessibilityRole={urgent ? 'alert' : 'summary'}
      accessibilityLiveRegion={urgent ? 'assertive' : 'polite'}
    >
      <Ionicons name={icon ?? c.icon} size={20} color={c.fg} />
      <AppText variant="caption" color={c.fg} style={styles.text}>
        {children}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
  },
  text: { flex: 1, fontWeight: '600' },
});
