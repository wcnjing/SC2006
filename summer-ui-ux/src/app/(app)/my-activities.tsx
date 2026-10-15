import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import {
  Banner,
  Button,
  EmptyState,
  ErrorState,
  IconButton,
  LoadingState,
  Screen,
  ScreenHeader,
  SegmentedTabs,
  type IconName,
} from '@/components/ui';
import { findNeighbourhood } from '@/config/catalog';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { ActivityRow, StatusBadge } from '@/features/activities/ActivityRow';
import { hasEnded } from '@/features/activities/format';
import { Stars } from '@/features/activities/Stars';
import type { TranslationKey } from '@/i18n/en';
import { distanceKm, hasCoordinates } from '@/lib/geo';
import { useAsync } from '@/lib/useAsync';
import { activityService, errorMessageKey } from '@/services';
import { colors, spacing } from '@/theme/tokens';
import type { Activity, MyActivityCard } from '@/types/models';

type TabKey = 'upcoming' | 'saved' | 'past';

const EMPTY: Record<TabKey, { icon: IconName; title: TranslationKey; body: TranslationKey }> = {
  upcoming: {
    icon: 'calendar-outline',
    title: 'myActivities.emptyUpcoming',
    body: 'myActivities.emptyUpcomingBody',
  },
  saved: {
    icon: 'bookmark-outline',
    title: 'myActivities.emptySaved',
    body: 'myActivities.emptySavedBody',
  },
  past: {
    icon: 'time-outline',
    title: 'myActivities.emptyPast',
    body: 'myActivities.emptyPastBody',
  },
};

const isTab = (v: unknown): v is TabKey => v === 'upcoming' || v === 'saved' || v === 'past';

/**
 * My activities (mockup 4.F right; Dialog Map: do / displayUpcomingSavedPast(),
 * reached from Profile → tapEventsJoined).
 *   Upcoming = joined and not started · Saved = bookmarked / swiped right (FR 3.2.4)
 *   Past = joined and started, with Rate (Dialog Map: tapRate [activityConcluded])
 * Open on a tab with /my-activities?tab=saved.
 */
export default function MyActivitiesScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const { t } = useSettings();
  const { session } = useAuth();
  const hood = findNeighbourhood(session?.profile?.neighbourhoodId);
  const me = session?.account.accountId;
  const [tab, setTab] = useState<TabKey>(isTab(params.tab) ? params.tab : 'upcoming');
  const [status, setStatus] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const mine = useAsync(async () => {
    const lists = await activityService.listMine();
    // Which past activities this user already rated (FR 9.1.3: one rating each).
    const rated = new Map<string, number>();
    await Promise.all(
      lists.history.map(async ({ activity }) => {
        const mineRating = (await activityService.listRatings(activity.id)).find(
          (r) => r.user_id === me,
        );
        if (mineRating) rated.set(activity.id, mineRating.rating);
      }),
    );
    return { ...lists, rated };
  });

  const km = (a: Activity) => (hood && hasCoordinates(a) ? distanceKm(hood, a) : null);

  const unsave = async (card: MyActivityCard) => {
    setRemoving(card.activity.id);
    try {
      await activityService.unsave(card.activity.id);
      const text = t('detail.unsavedToast');
      setStatus(text);
      AccessibilityInfo.announceForAccessibility(text);
      await mine.revalidate();
    } catch (e) {
      setStatus(t(errorMessageKey(e)));
    } finally {
      setRemoving(null);
    }
  };

  const lists = mine.data && {
    upcoming: mine.data.joined,
    saved: mine.data.saved,
    past: mine.data.history,
  };
  const items = lists?.[tab] ?? [];

  const renderRow = (card: MyActivityCard) => {
    const { activity } = card;
    const cancelled = activity.status === 'cancelled';
    const rating = mine.data?.rated.get(activity.id);
    return (
      <ActivityRow
        key={activity.id}
        activity={activity}
        distanceKm={tab === 'past' ? null : km(activity)}
        badges={
          cancelled ? (
            <StatusBadge label={t('activity.cancelled')} tone="error" />
          ) : tab === 'saved' && card.joined ? (
            <StatusBadge label={t('myActivities.goingBadge')} tone="success" />
          ) : tab === 'past' && rating ? (
            <Stars value={rating} size={14} />
          ) : undefined
        }
        actions={
          tab === 'saved' ? (
            <IconButton
              icon="bookmark"
              color={colors.primary}
              label={t('myActivities.unsave', { title: activity.title })}
              disabled={removing === activity.id}
              onPress={() => unsave(card)}
            />
          ) : tab === 'past' && !rating && hasEnded(activity) && !cancelled ? (
            <Button
              label={t('myActivities.rate')}
              accessibilityLabel={`${t('detail.rate')}: ${activity.title}`}
              icon="star-outline"
              size="sm"
              fullWidth={false}
              onPress={() =>
                router.push({ pathname: '/activity/[id]/rate', params: { id: activity.id } })
              }
            />
          ) : undefined
        }
      />
    );
  };

  return (
    <Screen
      header={<ScreenHeader title={t('myActivities.title')} />}
      contentStyle={styles.content}
      refreshing={mine.refreshing}
      onRefresh={mine.refresh}
    >
      <SegmentedTabs
        accessibilityLabel={t('myActivities.tabs')}
        value={tab}
        onChange={(v) => {
          setTab(v);
          setStatus(null);
        }}
        tabs={[
          { value: 'upcoming', label: t('myActivities.upcoming') },
          { value: 'saved', label: t('myActivities.saved') },
          { value: 'past', label: t('myActivities.past') },
        ]}
      />

      {status && <Banner tone="success">{status}</Banner>}

      {mine.loading && !mine.data ? (
        <LoadingState />
      ) : mine.error && !mine.data ? (
        <ErrorState message={t(errorMessageKey(mine.error))} onRetry={mine.reload} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={EMPTY[tab].icon}
          title={t(EMPTY[tab].title)}
          body={t(EMPTY[tab].body)}
          actionLabel={tab === 'past' ? undefined : t('myActivities.discover')}
          onAction={() => router.navigate('/discover')}
        />
      ) : (
        <View accessibilityRole="list">{items.map(renderRow)}</View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingTop: spacing.sm },
});
