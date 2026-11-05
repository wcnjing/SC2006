import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Card,
  ErrorState,
  ListRow,
  LoadingState,
  Screen,
  ScreenHeader,
  Section,
} from '@/components/ui';
import { useT } from '@/context/SettingsContext';
import { formatAgo } from '@/features/community/format';
import { REPORT_TYPES, reportTypeLabel } from '@/features/community/reportStatus';
import { useAsync } from '@/lib/useAsync';
import { communityService, errorMessageKey } from '@/services';
import { colors, spacing } from '@/theme/tokens';

/**
 * Admin dashboard (Dialog Map 5; FR 12.1). Open reports by content type (post, comment, activity)
 * (P3 listModerationReports) and the latest moderation decisions from the
 * audit log (P3 listModerationAudit). Route guarded by can('report:review').
 */
export default function AdminDashboardScreen() {
  const t = useT();
  const page = useAsync(async () => {
    const [open, audit] = await Promise.all([
      communityService.listModerationReports({ status: 'open', limit: 50 }),
      communityService.listModerationAudit({ limit: 10 }),
    ]);
    const count = (type: string) => open.reports.filter((r) => r.target_type === type).length;
    return {
      open: { post: count('post'), comment: count('comment'), activity: count('activity') },
      audit: audit.entries,
    };
  });
  const openCounts = page.data?.open;

  return (
    <Screen
      header={<ScreenHeader title={t('admin.title')} />}
      contentStyle={styles.content}
      refreshing={page.refreshing}
      onRefresh={page.refresh}
    >
      {page.loading && !page.data ? (
        <LoadingState />
      ) : page.error && !page.data ? (
        <ErrorState message={t(errorMessageKey(page.error))} onRetry={page.reload} />
      ) : (
        page.data && (
          <>
            <Section title={t('admin.reportsTitle')}>
              <View style={styles.tiles}>
                {(Object.keys(REPORT_TYPES) as (keyof typeof REPORT_TYPES)[]).map((type) => (
                  <ListRow
                    key={type}
                    tile
                    icon={REPORT_TYPES[type].icon}
                    title={t(REPORT_TYPES[type].queue)}
                    subtitle={t('admin.openCount', { count: openCounts?.[type] ?? 0 })}
                    subtitleTone={openCounts?.[type] ? 'alert' : 'muted'}
                    onPress={() =>
                      router.push({ pathname: '/admin/queue/[type]', params: { type } })
                    }
                  />
                ))}
              </View>
            </Section>

            <Section title={t('admin.auditTitle')}>
              {page.data.audit.length === 0 ? (
                <AppText color={colors.textMuted}>{t('admin.auditEmpty')}</AppText>
              ) : (
                <Card variant="outline">
                  <View style={styles.audit}>
                    {page.data.audit.map((e) => (
                      <AppText key={e.id} variant="caption">
                        {t(
                          e.action === 'remove_content'
                            ? 'admin.auditRemoved'
                            : 'admin.auditDismissed',
                          {
                            type: t(reportTypeLabel(e.target_type)),
                            when: formatAgo(t, e.created_at),
                          },
                        )}
                      </AppText>
                    ))}
                  </View>
                </Card>
              )}
            </Section>

            <Section title={t('admin.accountsTitle')}>
              <View style={styles.tiles}>
                <ListRow
                  tile
                  icon="people-outline"
                  title={t('admin.manageUsers')}
                  onPress={() => router.push('/admin/users')}
                />
                <ListRow
                  tile
                  icon="checkmark-done-outline"
                  title={t('admin.verifyOrganisers')}
                  onPress={() => router.push('/admin/verify')}
                />
              </View>
            </Section>
          </>
        )
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xl, paddingTop: spacing.sm },
  tiles: { gap: spacing.sm },
  audit: { gap: spacing.sm },
});
