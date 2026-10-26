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
import { useAsync } from '@/lib/useAsync';
import { communityService, errorMessageKey } from '@/services';
import { colors, spacing } from '@/theme/tokens';

/**
 * Admin dashboard (Dialog Map 5; FR 12.1). Open reports by content type
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
    return { posts: count('post'), comments: count('comment'), audit: audit.entries };
  });

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
                <ListRow
                  tile
                  icon="document-text-outline"
                  title={t('admin.reportedPosts')}
                  subtitle={t('admin.openCount', { count: page.data.posts })}
                  subtitleTone={page.data.posts ? 'alert' : 'muted'}
                  onPress={() =>
                    router.push({ pathname: '/admin/queue/[type]', params: { type: 'post' } })
                  }
                />
                <ListRow
                  tile
                  icon="chatbox-ellipses-outline"
                  title={t('admin.reportedComments')}
                  subtitle={t('admin.openCount', { count: page.data.comments })}
                  subtitleTone={page.data.comments ? 'alert' : 'muted'}
                  onPress={() =>
                    router.push({ pathname: '/admin/queue/[type]', params: { type: 'comment' } })
                  }
                />
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
                            type: e.target_type,
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
