import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  Screen,
  ScreenHeader,
  SegmentedTabs,
} from '@/components/ui';
import { useT } from '@/context/SettingsContext';
import { ActivityRow, StatusBadge } from '@/features/activities/ActivityRow';
import { hasStarted } from '@/features/activities/format';
import { useAsync } from '@/lib/useAsync';
import { activityService, errorMessageKey } from '@/services';
import { spacing } from '@/theme/tokens';
import type { Activity } from '@/types/models';

type Tab = 'upcoming' | 'past' | 'cancelled';
const tabOf = (a: Activity): Tab =>
  a.status === 'cancelled' ? 'cancelled' : hasStarted(a) ? 'past' : 'upcoming';

/**
 * Organiser dashboard (Dialog Map 4; FR 11). The organiser's own activities
 * (P2 listMyActivities): upcoming ones can be edited or cancelled; past and
 * cancelled ones are read-only, as P2 only manages scheduled, not-yet-started ones.
 */
export default function OrganiserDashboardScreen() {
  const t = useT();
  const [tab, setTab] = useState<Tab>('upcoming');
  const mine = useAsync(() => activityService.listOrganised());
  const items = (mine.data ?? []).filter((a) => tabOf(a) === tab);
  if (tab === 'past') items.reverse();

  return (
    <Screen
      header={<ScreenHeader title={t('organiser.title')} />}
      contentStyle={styles.content}
      refreshing={mine.refreshing}
      onRefresh={mine.refresh}
      footer={
        <Button
          label={t('organiser.create')}
          icon="add-circle-outline"
          onPress={() => router.push('/organiser/create')}
        />
      }
    >
      <SegmentedTabs
        accessibilityLabel={t('organiser.title')}
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'upcoming', label: t('myActivities.upcoming') },
          { value: 'past', label: t('myActivities.past') },
          { value: 'cancelled', label: t('activity.cancelled') },
        ]}
      />
      {mine.loading && !mine.data ? (
        <LoadingState />
      ) : mine.error && !mine.data ? (
        <ErrorState message={t(errorMessageKey(mine.error))} onRetry={mine.reload} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="clipboard-outline"
          title={t('organiser.empty')}
          body={tab === 'upcoming' ? t('organiser.emptyBody') : undefined}
        />
      ) : (
        <View accessibilityRole="list">
          {items.map((a) => (
            <ActivityRow
              key={a.id}
              activity={a}
              badges={
                tab === 'cancelled' ? (
                  <StatusBadge label={t('activity.cancelled')} tone="error" />
                ) : undefined
              }
              actions={
                tab === 'upcoming' && (
                  <Button
                    label={t('organiser.edit')}
                    accessibilityLabel={`${t('organiser.edit')}: ${a.title}`}
                    icon="create-outline"
                    size="sm"
                    fullWidth={false}
                    onPress={() =>
                      router.push({ pathname: '/organiser/[id]/edit', params: { id: a.id } })
                    }
                  />
                )
              }
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({ content: { gap: spacing.md, paddingTop: spacing.sm } });
