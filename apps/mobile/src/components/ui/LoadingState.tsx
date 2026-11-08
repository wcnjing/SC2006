import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useT } from '@/context/SettingsContext';
import { colors, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { EmptyState } from './EmptyState';

/** Centred spinner with a spoken label. */
export function LoadingState({ label }: { label?: string }) {
  const t = useT();
  const text = label ?? t('common.loading');
  return (
    <View style={styles.wrap} accessibilityRole="progressbar" accessibilityLabel={text}>
      <ActivityIndicator color={colors.primary} size="large" />
      <AppText variant="caption" color={colors.textMuted}>
        {text}
      </AppText>
    </View>
  );
}

/** Load failure with a retry button. */
export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const t = useT();
  return (
    <EmptyState
      icon="cloud-offline-outline"
      title={t('error.generic')}
      body={message}
      actionLabel={t('common.retry')}
      onAction={onRetry}
    />
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxxl,
  },
});
