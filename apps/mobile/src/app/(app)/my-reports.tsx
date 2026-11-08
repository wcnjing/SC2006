import { StyleSheet, View } from 'react-native';

import {
  AppText,
  EmptyState,
  ErrorState,
  LoadingState,
  Screen,
  ScreenHeader,
  Tag,
} from '@/components/ui';
import { useT } from '@/context/SettingsContext';
import { formatAgo } from '@/features/community/format';
import { REPORT_STATUS, reportTypeLabel } from '@/features/community/reportStatus';
import { useAsync } from '@/lib/useAsync';
import { communityService, errorMessageKey } from '@/services';
import { colors, spacing } from '@/theme/tokens';

/** My reports (FR 8.4; P3 listMyReports): what you reported and what the admins decided. */
export default function MyReportsScreen() {
  const t = useT();
  const reports = useAsync(
    async () => (await communityService.listMyReports({ limit: 50 })).reports,
  );

  return (
    <Screen
      header={<ScreenHeader title={t('myReports.title')} />}
      contentStyle={styles.content}
      refreshing={reports.refreshing}
      onRefresh={reports.refresh}
    >
      {reports.loading && !reports.data ? (
        <LoadingState />
      ) : reports.error && !reports.data ? (
        <ErrorState message={t(errorMessageKey(reports.error))} onRetry={reports.reload} />
      ) : !reports.data?.length ? (
        <EmptyState
          icon="flag-outline"
          title={t('myReports.empty')}
          body={t('myReports.emptyBody')}
        />
      ) : (
        <View accessibilityRole="list">
          {reports.data.map((r) => (
            <View key={r.id} style={styles.row}>
              <View style={styles.head}>
                <AppText variant="label" style={styles.flex}>
                  {t(reportTypeLabel(r.target_type))} · {r.reason}
                </AppText>
                <Tag label={t(REPORT_STATUS[r.status].label)} tone={REPORT_STATUS[r.status].tone} />
              </View>
              <AppText variant="caption" color={colors.textMuted}>
                {formatAgo(t, r.created_at)}
              </AppText>
              {r.resolution_note && (
                <AppText color={colors.textMuted}>
                  {t('myReports.decision', { note: r.resolution_note })}
                </AppText>
              )}
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingTop: spacing.sm },
  row: {
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
});
