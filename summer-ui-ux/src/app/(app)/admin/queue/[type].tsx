import type { ReportStatus } from '@communitylink/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  EmptyState,
  ErrorState,
  ListRow,
  LoadingState,
  Screen,
  ScreenHeader,
  SegmentedTabs,
  Tag,
} from '@/components/ui';
import { useT } from '@/context/SettingsContext';
import { formatAgo } from '@/features/community/format';
import { REPORT_STATUS } from '@/features/community/reportStatus';
import { useAsync } from '@/lib/useAsync';
import { communityService, errorMessageKey } from '@/services';
import { colors, spacing } from '@/theme/tokens';

/** Reported posts or comments (FR 12.1.1): /admin/queue/post or /admin/queue/comment. */
export default function ReportQueueScreen() {
  const { type } = useLocalSearchParams<{ type: string }>();
  const t = useT();
  const [status, setStatus] = useState<ReportStatus>('open');

  return (
    <Screen
      header={
        <ScreenHeader
          title={t(type === 'comment' ? 'admin.reportedComments' : 'admin.reportedPosts')}
        />
      }
      contentStyle={styles.content}
    >
      <SegmentedTabs
        accessibilityLabel={t('admin.statusTabs')}
        value={status}
        onChange={setStatus}
        tabs={(['open', 'actioned', 'dismissed'] as const).map((s) => ({
          value: s,
          label: t(REPORT_STATUS[s].label),
        }))}
      />
      {/* Keyed, so each status tab loads its own list. */}
      <Reports key={status} status={status} type={type} />
    </Screen>
  );
}

function Reports({ status, type }: { status: ReportStatus; type: string }) {
  const t = useT();
  const reports = useAsync(async () =>
    (await communityService.listModerationReports({ status, limit: 50 })).reports.filter(
      (r) => r.target_type === type,
    ),
  );

  if (reports.loading && !reports.data) return <LoadingState />;
  if (reports.error && !reports.data)
    return <ErrorState message={t(errorMessageKey(reports.error))} onRetry={reports.reload} />;
  if (!reports.data?.length)
    return <EmptyState icon="shield-checkmark-outline" title={t('admin.queueEmpty')} />;
  return (
    <View accessibilityRole="list">
      {reports.data.map((r, i) => (
        <View key={r.id} style={i > 0 && styles.sep}>
          <ListRow
            title={r.reason}
            subtitle={[formatAgo(t, r.created_at), r.details].filter(Boolean).join(' · ')}
            right={
              <Tag label={t(REPORT_STATUS[r.status].label)} tone={REPORT_STATUS[r.status].tone} />
            }
            onPress={() => router.push({ pathname: '/admin/content/[id]', params: { id: r.id } })}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingTop: spacing.sm },
  sep: { borderTopWidth: 1, borderTopColor: colors.divider },
});
