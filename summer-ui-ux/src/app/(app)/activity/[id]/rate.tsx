import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Banner,
  Button,
  EmptyState,
  ErrorState,
  IconButton,
  LoadingState,
  Screen,
  ScreenHeader,
  TextField,
} from '@/components/ui';
import { useT } from '@/context/SettingsContext';
import { useAsync } from '@/lib/useAsync';
import { activityService, errorMessageKey, errorText } from '@/services';
import { colors, spacing } from '@/theme/tokens';

/**
 * Rate an activity (FR 9.1, UC RateActivity; P2 submitActivityRating): 1–5
 * stars and an optional review, once, by residents who joined, after it ended.
 */
export default function RateActivityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const activity = useAsync(() => activityService.getActivity(id));
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const header = <ScreenHeader title={t('rate.title')} />;
  if (!activity.data) {
    return (
      <Screen header={header}>
        {activity.loading ? (
          <LoadingState />
        ) : activity.error ? (
          <ErrorState message={t(errorMessageKey(activity.error))} onRetry={activity.reload} />
        ) : (
          <EmptyState icon="calendar-clear-outline" title={t('detail.unavailableTitle')} />
        )}
      </Screen>
    );
  }
  if (done) {
    return (
      <Screen header={header}>
        <EmptyState
          icon="star"
          title={t('rate.thanks')}
          actionLabel={t('common.done')}
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  const submit = async () => {
    if (!stars) return setError(t('rate.pickStars'));
    setBusy(true);
    setError(null);
    try {
      await activityService.rate(id, { rating: stars, comment });
      setDone(true);
    } catch (e) {
      setError(errorText(t, e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      header={header}
      contentStyle={styles.content}
      footer={<Button label={t('rate.submit')} loading={busy} onPress={submit} />}
    >
      <AppText variant="h2" heading>
        {activity.data.title}
      </AppText>
      {error && <Banner tone="error">{error}</Banner>}
      <AppText variant="label">{t('rate.starsLabel')}</AppText>
      <View style={styles.stars} accessibilityRole="radiogroup">
        {[1, 2, 3, 4, 5].map((n) => (
          <IconButton
            key={n}
            icon={n <= stars ? 'star' : 'star-outline'}
            color={colors.star}
            size={36}
            label={t('rate.starA11y', { count: n })}
            accessibilityRole="radio"
            accessibilityState={{ checked: n === stars }}
            onPress={() => setStars(n)}
          />
        ))}
      </View>
      <TextField
        label={t('rate.commentLabel')}
        optional
        multiline
        value={comment}
        onChangeText={setComment}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingTop: spacing.sm },
  stars: { flexDirection: 'row', gap: spacing.xs },
});
